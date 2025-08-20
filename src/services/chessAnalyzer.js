const { Chess } = require('chess.js');
const { getStockfishEvaluation } = require('./stockfish');
const { classifyOpening } = require('./ecoClassifier');

/**
 * COMPLETELY FIXED chess game analyzer 
 * Book moves now count as 100% accurate, per-player accuracy calculated properly
 */

/**
 * Classifies a move based on evaluation change and context
 */
function classifyMove(position, context = {}) {
  const evalChange = position.evalChange;
  const isInBook = context.inBook || false;
  
  // Book moves get special classification
  if (isInBook) {
    return 'book';
  }
  
  // Evaluation-based classification for non-book moves
  if (evalChange >= 300) return 'blunder';
  if (evalChange >= 200) return 'mistake';
  if (evalChange >= 100) return 'inaccuracy';
  if (evalChange >= 50) return 'questionable';
  if (evalChange <= -50) return 'excellent';
  if (evalChange <= -20) return 'good';
  
  return 'normal';
}

/**
 * Detects game phases based on actual book moves, not arbitrary numbers
 */
function detectGamePhases(positions) {
  const phases = {
    opening: { start: 1, end: null },
    middlegame: { start: null, end: null },
    endgame: { start: null, end: null }
  };
  
  // Find actual last book move
  let lastBookMove = 0;
  for (const pos of positions) {
    if (pos.classification === 'book' || pos.opening?.inBook) {
      lastBookMove = Math.max(lastBookMove, pos.moveNumber);
    }
  }
  
  // Opening ends when book theory actually ends
  phases.opening.end = lastBookMove > 0 ? lastBookMove : 10;
  phases.middlegame.start = phases.opening.end + 1;
  
  // Enhanced endgame detection
  const totalMoves = Math.max(...positions.map(p => p.moveNumber));
  if (totalMoves > 25) {
    phases.endgame.start = Math.max(20, Math.floor(totalMoves * 0.7));
    phases.middlegame.end = phases.endgame.start - 1;
  }
  
  return phases;
}

/**
 * Identifies critical moments, EXCLUDING book moves
 */
function identifyCriticalMoments(positions) {
  const criticalMoments = [];
  
  for (let i = 1; i < positions.length; i++) {
    const current = positions[i];
    const previous = positions[i - 1];
    
    // NEVER flag book moves as critical moments
    const isCurrentBook = current.classification === 'book' || current.opening?.inBook;
    
    // Large evaluation swings (only for non-book moves)
    if (!isCurrentBook && current.evalChange >= 150) {
      criticalMoments.push({
        type: 'blunder',
        moveNumber: current.moveNumber,
        move: current.move,
        description: `Major tactical error losing ${(current.evalChange / 100).toFixed(1)} pawns`,
        severity: current.evalChange >= 300 ? 'critical' : 'major'
      });
    }
    
    // Missed opportunities
    if (i < positions.length - 1) {
      const next = positions[i + 1];
      const isNextBook = next.classification === 'book' || next.opening?.inBook;
      
      if (!isCurrentBook && !isNextBook && current.evalChange <= -100 && next.evalChange >= 50) {
        criticalMoments.push({
          type: 'missed_opportunity',
          moveNumber: next.moveNumber,
          move: next.move,
          description: 'Failed to capitalize on opponent\'s mistake'
        });
      }
    }
    
    // Book deviations
    const isPreviousBook = previous.classification === 'book' || previous.opening?.inBook;
    if (isPreviousBook && !isCurrentBook) {
      criticalMoments.push({
        type: 'book_deviation',
        moveNumber: current.moveNumber,
        move: current.move,
        description: 'First deviation from opening theory'
      });
    }
  }
  
  return criticalMoments.sort((a, b) => {
    const severityOrder = { 'critical': 3, 'major': 2 };
    return (severityOrder[b.severity] || 1) - (severityOrder[a.severity] || 1);
  });
}

/**
 * FIXED: Calculate player accuracy INCLUDING book moves as 100% accurate
 */
function calculatePlayerAccuracy(positions, color) {
  const playerMoves = positions.filter(p => p.color === color);
  
  if (playerMoves.length === 0) return 100;
  
  let totalAccuracyPoints = 0;
  
  for (const move of playerMoves) {
    if (move.classification === 'book') {
      // Book moves are 100% accurate (perfect theoretical moves)
      totalAccuracyPoints += 100;
    } else {
      // Non-book moves: gradual scoring based on centipawn loss
      if (move.evalChange <= 10) totalAccuracyPoints += 100;      // Perfect move
      else if (move.evalChange <= 25) totalAccuracyPoints += 95;  // Excellent
      else if (move.evalChange <= 50) totalAccuracyPoints += 85;  // Good
      else if (move.evalChange <= 100) totalAccuracyPoints += 70; // Questionable/Inaccuracy
      else if (move.evalChange <= 200) totalAccuracyPoints += 40; // Mistake
      else totalAccuracyPoints += 10;                             // Blunder (still some points)
    }
  }
  
  return Math.round(totalAccuracyPoints / playerMoves.length);
}

/**
 * FIXED: Calculate phase accuracy INCLUDING book moves as perfect
 */
function calculateAccuracyMetrics(positions) {
  if (positions.length === 0) return { overall: 100, opening: 100, middlegame: 100, endgame: 100 };
  
  const phases = detectGamePhases(positions);
  
  const calculatePhaseAccuracy = (start, end) => {
    const phasePositions = positions.filter(p => 
      p.moveNumber >= start && p.moveNumber <= (end || positions.length)
    );
    
    if (phasePositions.length === 0) return 100;
    
    let totalAccuracyPoints = 0;
    
    for (const pos of phasePositions) {
      if (pos.classification === 'book') {
        // Book moves are 100% accurate
        totalAccuracyPoints += 100;
      } else {
        // Non-book moves: gradual scoring
        if (pos.evalChange <= 10) totalAccuracyPoints += 100;
        else if (pos.evalChange <= 25) totalAccuracyPoints += 95;
        else if (pos.evalChange <= 50) totalAccuracyPoints += 85;
        else if (pos.evalChange <= 100) totalAccuracyPoints += 70;
        else if (pos.evalChange <= 200) totalAccuracyPoints += 40;
        else totalAccuracyPoints += 10;
      }
    }
    
    return Math.round(totalAccuracyPoints / phasePositions.length);
  };
  
  const accuracyMetrics = {
    overall: calculatePhaseAccuracy(1, positions.length),
    opening: calculatePhaseAccuracy(phases.opening.start, phases.opening.end),
    middlegame: calculatePhaseAccuracy(phases.middlegame.start, phases.middlegame.end),
    endgame: phases.endgame.start ? calculatePhaseAccuracy(phases.endgame.start, positions.length) : null
  };
  
  console.log(`Accuracy (including book moves): Overall ${accuracyMetrics.overall}%, Opening ${accuracyMetrics.opening}%, Middlegame ${accuracyMetrics.middlegame}%`);
  
  return accuracyMetrics;
}

/**
 * Enhanced game analysis with PROPERLY FIXED statistics
 */
async function analyzeGame(pgn, depth = 15) {
  try {
    const game = new Chess();
    
    console.log('Loading PGN into enhanced analyzer...');
    game.loadPgn(pgn);
    
    const testHistory = game.history();
    if (testHistory.length === 0) {
      throw new Error('No moves found in PGN');
    }
    
    console.log(`PGN loaded successfully with ${testHistory.length} moves`);

    // Database-powered opening classification
    console.log('Classifying opening using database...');
    const openingClassification = await classifyOpening(testHistory);
    console.log(`Opening classified: ${openingClassification.name} (${openingClassification.eco})`);

    // Get headers
    const headers = game.header();
    
    // Get the game history with detailed move information
    const history = game.history({ verbose: true });
    const positions = [];
    const blunders = [];
    
    // Reset game to start position for move-by-move analysis
    game.reset();
    let previousEval = 0;
    
    console.log(`Analyzing ${history.length} moves with enhanced features...`);
    
    // Analyze each position
    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      
      // Make the move
      const madeMove = game.move(move);
      if (!madeMove) {
        console.error(`Failed to make move ${i + 1}: ${move.san}`);
        continue;
      }
      
      const fen = game.fen();
      const moveNumber = Math.ceil((i + 1) / 2);
      
      // Get Stockfish evaluation
      const evaluation = await getStockfishEvaluation(fen, depth);
      
      // Determine if this move is still in opening theory
      const inBook = moveNumber <= openingClassification.lastBookMove;
      
      // Create opening info for this position
      const openingInfo = {
        name: openingClassification.name,
        eco: openingClassification.eco,
        inBook: inBook,
        popularity: inBook ? 1000 : 0,
        topMoves: [],
        source: 'database'
      };
      
      // Calculate evaluation change
      const evalChange = Math.abs(evaluation.score - previousEval);
      
      // Classify the move
      const classification = classifyMove({ evalChange }, { inBook });
      
      // Store enhanced position data
      const positionData = {
        moveNumber: moveNumber,
        color: move.color,
        move: move.san,
        fen: fen,
        evaluation: evaluation,
        evalChange: evalChange,
        previousEval: previousEval,
        classification: classification,
        opening: openingInfo,
        // Additional analysis data
        isCapture: move.captured !== undefined,
        isCheck: move.flags.includes('c'),
        isPromotion: move.flags.includes('p'),
        pieceType: move.piece
      };
      
      positions.push(positionData);
      
      // Collect blunders (FIXED: exclude book moves)
      if ((classification === 'blunder' || classification === 'mistake') && !inBook) {
        const blunderSeverity = classification === 'blunder' ? 'critical' : 'major';
        
        blunders.push({
          ...positionData,
          severity: blunderSeverity,
          description: `${move.color === 'w' ? 'White' : 'Black'} played ${move.san}, losing ${(evalChange / 100).toFixed(1)} pawns of advantage`
        });
      }
      
      previousEval = evaluation.score;
    }
    
    // Enhanced analysis with FIXED calculations
    const gamePhases = detectGamePhases(positions);
    const criticalMoments = identifyCriticalMoments(positions);
    const accuracyMetrics = calculateAccuracyMetrics(positions);
    
    // Calculate per-player accuracy
    const whiteAccuracy = calculatePlayerAccuracy(positions, 'w');
    const blackAccuracy = calculatePlayerAccuracy(positions, 'b');
    
    // Sort blunders by severity
    blunders.sort((a, b) => b.evalChange - a.evalChange);
    
    console.log(`Analysis complete! Opening: ${openingClassification.name}`);
    console.log(`Book moves: ${openingClassification.lastBookMove}, Total blunders: ${blunders.length}`);
    console.log(`Player accuracy - White: ${whiteAccuracy}%, Black: ${blackAccuracy}%`);
    
    return {
      // Existing structure for backward compatibility
      gameInfo: {
        result: headers.Result || '*',
        white: headers.White || 'Unknown',
        black: headers.Black || 'Unknown',
        totalMoves: history.length,
        event: headers.Event || '',
        site: headers.Site || '',
        date: headers.Date || '',
        opening: openingClassification.name,
        eco: openingClassification.eco
      },
      positions: positions,
      blunders: blunders.slice(0, 10),
      summary: {
        totalBlunders: blunders.length,
        biggestBlunder: blunders.length > 0 ? blunders[0] : null,
        
        // ENHANCED: Per-player accuracy (NEW!)
        playerAccuracy: {
          white: whiteAccuracy,
          black: blackAccuracy,
          combined: accuracyMetrics.overall
        },
        
        // Keep old field for compatibility
        averageAccuracy: accuracyMetrics.overall,
        
        // Enhanced summary
        accuracyByPhase: accuracyMetrics,
        totalMistakes: positions.filter(p => p.classification === 'mistake' && p.classification !== 'book').length,
        totalInaccuracies: positions.filter(p => p.classification === 'inaccuracy' && p.classification !== 'book').length,
        bookMoves: positions.filter(p => p.classification === 'book').length,
        excellentMoves: positions.filter(p => p.classification === 'excellent').length
      },
      phases: gamePhases,
      criticalMoments: criticalMoments,
      opening: {
        name: openingClassification.name,
        eco: openingClassification.eco,
        pgn: openingClassification.pgn,
        lastBookMove: openingClassification.lastBookMove,
        theoryTexts: openingClassification.theoryTexts || [], // NEW: Theory texts for each book move
        deviation: positions.find(p => !p.opening?.inBook && p.moveNumber <= 25)
      },
      // FIXED: Strategic context with accurate player calculations
      strategicContext: {
        gameType: openingClassification.eco?.charAt(0) || 'Unknown',
        complexity: criticalMoments.length,
        phases: gamePhases,
        keyMoments: criticalMoments.slice(0, 5),
        playerStyles: {
          white: {
            accuracy: whiteAccuracy, // FIXED
            aggression: positions.filter(p => p.color === 'w' && (p.isCapture || p.isCheck)).length,
            bookKnowledge: positions.filter(p => p.color === 'w' && p.classification === 'book').length
          },
          black: {
            accuracy: blackAccuracy, // FIXED
            aggression: positions.filter(p => p.color === 'b' && (p.isCapture || p.isCheck)).length,
            bookKnowledge: positions.filter(p => p.color === 'b' && p.classification === 'book').length
          }
        }
      }
    };
    
  } catch (error) {
    console.error('Error in enhanced game analysis:', error);
    throw new Error(`Enhanced analysis failed: ${error.message}`);
  }
}

/**
 * Legacy compatibility functions
 */
function getBlunderSeverity(evalChange) {
  if (evalChange >= 300) return 'critical';
  if (evalChange >= 200) return 'major';
  if (evalChange >= 100) return 'minor';
  return 'inaccuracy';
}

function calculateAccuracy(positions) {
  return calculateAccuracyMetrics(positions).overall;
}

module.exports = {
  analyzeGame,
  getBlunderSeverity,
  calculateAccuracy,
  // Enhanced functionality exports
  classifyMove,
  detectGamePhases,
  identifyCriticalMoments,
  calculateAccuracyMetrics,
  calculatePlayerAccuracy
};