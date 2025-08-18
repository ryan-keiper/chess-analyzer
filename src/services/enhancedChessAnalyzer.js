// src/services/enhancedChessAnalyzer.js
const { Chess } = require('chess.js');
const { WikiBooksDetector } = require('./wikiBooksDetector');
const { analyzePosition } = require('./stockfish');

class EnhancedChessAnalyzer {
  constructor() {
    this.wikibooks = new WikiBooksDetector();
  }

  /**
   * Main analysis function that combines WikiBooks theory with AI analysis
   */
  async analyzeGame(pgn) {
    console.log('🎯 Starting enhanced chess analysis...');
    
    try {
      // Parse the PGN
      const chess = new Chess();
      const gameInfo = this.extractGameInfo(pgn);
      
      // Load the game and collect positions
      chess.loadPgn(pgn);
      const history = chess.history({ verbose: true });
      const positions = [];
      
      // Reset and replay to collect all positions
      chess.reset();
      positions.push({
        fen: chess.fen(),
        move: null,
        moveNumber: 0,
        san: '',
        evaluation: null
      });
      
      // Play through all moves and collect positions
      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        chess.move(move);
        
        positions.push({
          fen: chess.fen(),
          move: move,
          moveNumber: Math.floor(i / 2) + 1,
          san: move.san,
          evaluation: null,
          color: move.color
        });
      }

      console.log(`📋 Game loaded: ${positions.length} positions to analyze`);

      // Phase 1: WikiBooks book detection
      const bookAnalysis = await this.wikibooks.analyzeGameWithBookDetection(positions);
      
      console.log(`📚 Book analysis complete:`);
      console.log(`   - Theory followed until move ${bookAnalysis.bookEndMove}`);
      console.log(`   - Opening: ${bookAnalysis.openingInfo?.name || 'Unknown'}`);
      console.log(`   - Strategic analysis needed for ${bookAnalysis.strategicPhase.length} positions`);

      // Phase 2: Stockfish analysis for strategic phase only
      const strategicAnalysis = await this.analyzeStrategicPhase(bookAnalysis.strategicPhase);
      
      console.log(`🤖 Strategic analysis complete for ${strategicAnalysis.length} positions`);

      // Phase 3: Combine results
      const enhancedResults = this.combineAnalysisResults(
        gameInfo,
        bookAnalysis,
        strategicAnalysis
      );

      console.log('✅ Enhanced analysis complete!');
      return enhancedResults;

    } catch (error) {
      console.error('❌ Enhanced analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze only the strategic phase (post-book) with Stockfish
   */
  async analyzeStrategicPhase(strategicPositions) {
    if (strategicPositions.length === 0) {
      return [];
    }

    console.log(`🤖 Analyzing ${strategicPositions.length} strategic positions with Stockfish...`);
    
    const results = [];
    
    for (let i = 0; i < strategicPositions.length; i++) {
      const position = strategicPositions[i];
      
      try {
        console.log(`   Analyzing move ${position.moveNumber}: ${position.san}`);
        
        // Get Stockfish analysis
        const analysis = await analyzePosition(position.fen, {
          depth: 15,
          time: 1000
        });

        results.push({
          ...position,
          evaluation: analysis.evaluation,
          bestMove: analysis.bestMove,
          principalVariation: analysis.pv,
          analysis: analysis,
          classification: this.classifyMove(analysis)
        });

      } catch (error) {
        console.error(`Error analyzing position ${position.moveNumber}:`, error);
        results.push({
          ...position,
          evaluation: null,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Classify move quality based on evaluation
   */
  classifyMove(analysis) {
    if (!analysis.evaluation) return 'unknown';
    
    const evalChange = analysis.evaluationChange || 0;
    
    if (Math.abs(evalChange) < 10) return 'excellent';
    if (Math.abs(evalChange) < 25) return 'good';
    if (Math.abs(evalChange) < 50) return 'normal';
    if (Math.abs(evalChange) < 100) return 'questionable';
    if (Math.abs(evalChange) < 200) return 'inaccuracy';
    if (Math.abs(evalChange) < 500) return 'mistake';
    return 'blunder';
  }

  /**
   * Extract game information from PGN
   */
  extractGameInfo(pgn) {
    const info = {
      white: 'Unknown',
      black: 'Unknown',
      result: '*',
      date: 'Unknown',
      event: 'Unknown',
      site: 'Unknown'
    };

    const headerRegex = /\[(\w+)\s+"([^"]+)"\]/g;
    let match;
    
    while ((match = headerRegex.exec(pgn)) !== null) {
      const [, key, value] = match;
      switch (key) {
        case 'White':
          info.white = value;
          break;
        case 'Black':
          info.black = value;
          break;
        case 'Result':
          info.result = value;
          break;
        case 'Date':
          info.date = value;
          break;
        case 'Event':
          info.event = value;
          break;
        case 'Site':
          info.site = value;
          break;
      }
    }

    return info;
  }

  /**
   * Combine WikiBooks and Stockfish analysis into final result
   */
  combineAnalysisResults(gameInfo, bookAnalysis, strategicAnalysis) {
    // Merge opening and strategic phases
    const allPositions = [
      ...bookAnalysis.openingPhase,
      ...strategicAnalysis
    ];

    // Calculate summary statistics
    const summary = this.calculateSummaryStats(allPositions, bookAnalysis);

    // Identify critical moments
    const criticalMoments = this.identifyCriticalMoments(strategicAnalysis);

    // Detect game phases
    const phases = this.detectGamePhases(allPositions, bookAnalysis.bookEndMove);

    return {
      gameInfo: {
        ...gameInfo,
        opening: bookAnalysis.openingInfo?.name || 'Unknown Opening',
        openingUrl: bookAnalysis.openingInfo?.wikiUrl || null,
        totalMoves: allPositions.length,
        analysisType: 'enhanced_wikibooks'
      },
      
      positions: allPositions,
      
      summary: {
        ...summary,
        bookMoves: bookAnalysis.bookMoves,
        strategicMoves: strategicAnalysis.length,
        openingTheory: bookAnalysis.openingInfo?.theoryText || '',
        analysisScope: {
          bookPhase: `Moves 1-${bookAnalysis.bookMoves}`,
          strategicPhase: bookAnalysis.bookMoves < allPositions.length 
            ? `Moves ${bookAnalysis.bookMoves + 1}-${allPositions.length}`
            : 'None (game entirely in book)'
        }
      },
      
      phases: phases,
      
      criticalMoments: criticalMoments,
      
      bookAnalysis: {
        endMove: bookAnalysis.bookEndMove,
        openingInfo: bookAnalysis.openingInfo,
        theoryFollowed: bookAnalysis.bookMoves > 0
      },

      // Prepare data structure for future LLM integration
      llmContext: {
        gameType: this.classifyGameType(gameInfo, bookAnalysis),
        strategicDecisions: criticalMoments.length,
        complexityScore: this.calculateComplexity(strategicAnalysis),
        keyPositions: criticalMoments.slice(0, 5), // Top 5 for LLM analysis
        narrative: {
          opening: this.generateOpeningNarrative(bookAnalysis),
          transition: this.generateTransitionNarrative(bookAnalysis, strategicAnalysis),
          keyMoments: criticalMoments.map(moment => this.generateMomentNarrative(moment))
        }
      }
    };
  }

  /**
   * Calculate summary statistics
   */
  calculateSummaryStats(positions, bookAnalysis) {
    const strategicPositions = positions.filter(p => p.phase === 'strategic');
    
    if (strategicPositions.length === 0) {
      return {
        accuracy: { white: null, black: null },
        averageEval: null,
        totalBlunders: 0,
        totalMistakes: 0,
        totalInaccuracies: 0,
        gameResult: 'Book game - no strategic phase'
      };
    }

    const whitePositions = strategicPositions.filter(p => p.color === 'w');
    const blackPositions = strategicPositions.filter(p => p.color === 'b');

    const classificationCounts = {
      blunder: 0,
      mistake: 0,
      inaccuracy: 0,
      questionable: 0
    };

    strategicPositions.forEach(pos => {
      if (pos.classification && classificationCounts.hasOwnProperty(pos.classification)) {
        classificationCounts[pos.classification]++;
      }
    });

    return {
      accuracy: {
        white: this.calculateAccuracy(whitePositions),
        black: this.calculateAccuracy(blackPositions)
      },
      averageEval: this.calculateAverageEval(strategicPositions),
      totalBlunders: classificationCounts.blunder,
      totalMistakes: classificationCounts.mistake,
      totalInaccuracies: classificationCounts.inaccuracy,
      totalQuestionable: classificationCounts.questionable,
      gameResult: this.determineGameResult(strategicPositions)
    };
  }

  /**
   * Calculate accuracy for a set of positions
   */
  calculateAccuracy(positions) {
    if (positions.length === 0) return null;
    
    const excellentMoves = positions.filter(p => 
      ['excellent', 'good', 'normal'].includes(p.classification)
    ).length;
    
    return Math.round((excellentMoves / positions.length) * 100);
  }

  /**
   * Calculate average evaluation
   */
  calculateAverageEval(positions) {
  const evaluations = positions
    .map(p => p.evaluation)
    .filter(evaluation => evaluation !== null && evaluation !== undefined);
  
  if (evaluations.length === 0) return null;
  
  return evaluations.reduce((sum, evaluation) => sum + evaluation, 0) / evaluations.length;
}

  /**
   * Determine game result based on final evaluation
   */
  determineGameResult(positions) {
    if (positions.length === 0) return 'Unknown';
    
    const finalEval = positions[positions.length - 1]?.evaluation;
    if (finalEval === null || finalEval === undefined) return 'Unknown';
    
    if (finalEval > 200) return 'White winning';
    if (finalEval < -200) return 'Black winning';
    return 'Balanced position';
  }

  /**
   * Identify critical moments in the game
   */
  identifyCriticalMoments(strategicPositions) {
    const moments = [];
    
    for (let i = 0; i < strategicPositions.length; i++) {
      const position = strategicPositions[i];
      
      if (position.classification === 'blunder') {
        moments.push({
          type: 'blunder',
          moveNumber: position.moveNumber,
          move: position.san,
          evaluation: position.evaluation,
          description: `Major tactical error`,
          severity: 'critical'
        });
      } else if (position.classification === 'mistake') {
        moments.push({
          type: 'mistake',
          moveNumber: position.moveNumber,
          move: position.san,
          evaluation: position.evaluation,
          description: `Significant strategic error`,
          severity: 'major'
        });
      }
    }
    
    // Sort by severity and evaluation swing
    return moments.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1;
      }
      return Math.abs(b.evaluation || 0) - Math.abs(a.evaluation || 0);
    });
  }

  /**
   * Detect game phases
   */
  detectGamePhases(positions, bookEndMove) {
    const phases = {
      opening: { start: 1, end: Math.max(1, bookEndMove - 1) },
      middlegame: { start: bookEndMove, end: null },
      endgame: { start: null, end: null }
    };
    
    // Simple endgame detection based on material count
    for (let i = bookEndMove - 1; i < positions.length; i++) {
      const position = positions[i];
      if (this.isEndgamePosition(position.fen)) {
        phases.endgame = { start: position.moveNumber, end: positions.length };
        phases.middlegame.end = position.moveNumber - 1;
        break;
      }
    }
    
    if (!phases.endgame.start) {
      phases.middlegame.end = positions.length;
    }
    
    return phases;
  }

  /**
   * Simple endgame detection
   */
  isEndgamePosition(fen) {
    const chess = new Chess(fen);
    const pieces = chess.board().flat().filter(piece => piece !== null);
    
    // Count pieces (excluding kings and pawns)
    const majorPieces = pieces.filter(piece => 
      piece && ['q', 'r', 'b', 'n'].includes(piece.type.toLowerCase())
    ).length;
    
    return majorPieces <= 6; // Arbitrary threshold for endgame
  }

  /**
   * Generate opening narrative for LLM context
   */
  generateOpeningNarrative(bookAnalysis) {
    if (!bookAnalysis.openingInfo) {
      return 'Game started with non-standard or unknown opening moves.';
    }
    
    const { name, moveCount, theoryText } = bookAnalysis.openingInfo;
    return `Opening: ${name}. Theory was followed for ${moveCount} moves. ${theoryText.substring(0, 200)}...`;
  }

  /**
   * Generate transition narrative
   */
  generateTransitionNarrative(bookAnalysis, strategicAnalysis) {
    if (strategicAnalysis.length === 0) {
      return 'Game remained in opening theory throughout.';
    }
    
    const firstStrategicMove = strategicAnalysis[0];
    return `Players left theory at move ${bookAnalysis.bookEndMove} with ${firstStrategicMove.san}. Strategic phase began.`;
  }

  /**
   * Generate moment narrative
   */
  generateMomentNarrative(moment) {
    return `Move ${moment.moveNumber}: ${moment.move} - ${moment.description} (${moment.type})`;
  }

  /**
   * Classify game type for LLM context
   */
  classifyGameType(gameInfo, bookAnalysis) {
    if (!bookAnalysis.openingInfo) return 'irregular';
    
    const openingName = bookAnalysis.openingInfo.name.toLowerCase();
    
    if (openingName.includes('ruy lopez') || openingName.includes('italian')) {
      return 'classical';
    }
    if (openingName.includes('sicilian')) {
      return 'sharp';
    }
    if (openingName.includes('french') || openingName.includes('caro')) {
      return 'solid';
    }
    
    return 'standard';
  }

  /**
   * Calculate game complexity
   */
  calculateComplexity(strategicPositions) {
    if (strategicPositions.length === 0) return 0;
    
    const tacticalMoves = strategicPositions.filter(p => 
      ['blunder', 'mistake'].includes(p.classification)
    ).length;
    
    return Math.min(10, Math.round((tacticalMoves / strategicPositions.length) * 10));
  }
}

module.exports = { EnhancedChessAnalyzer };