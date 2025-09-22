import { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Upload, Play, Settings } from 'lucide-react';
import MoveAnalysisDisplay from './MoveAnalysisDisplay';
import GameNavigation from './GameNavigation';
import MoveList from './MoveList';
import EvalBar from './EvalBar';
import HeuristicsPanel from './HeuristicsPanel';

const ChessAnalyzer = ({ onAnalyze, loading }) => {
  // Game state
  const [chess] = useState(new Chess());
  const [gameState, setGameState] = useState({
    moves: [],
    currentMoveIndex: -1,
    analysis: null,
    isAnalyzed: false,
    pgn: ''
  });
  
  // UI state
  const [boardPosition, setBoardPosition] = useState(chess.fen());
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [pgn, setPgn] = useState('');
  const [depth, setDepth] = useState(15);
  const [showSettings, setShowSettings] = useState(false);
  const [analysisText, setAnalysisText] = useState('Enter a chess game in PGN format to begin analysis. The board will become interactive once analysis is complete.');
  const [includeAIContext] = useState(true); // Enable AI context by default for testing
  const [currentAIContext, setCurrentAIContext] = useState(null);
  const [currentEval, setCurrentEval] = useState(0);
  const [currentHeuristics, setCurrentHeuristics] = useState({});

  const samplePgn = `[Event "Sample Game"]
[Site "Chess.com"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 
6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 
11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4?? 14. g3 Qh3 15. Bf4 1-0`;


  // Parse PGN and setup moves for navigation
  const setupGame = useCallback((pgnString, analysisData = null) => {
    try {
      const tempChess = new Chess();
      tempChess.loadPgn(pgnString);
      
      // Get move history
      const moves = tempChess.history({ verbose: true });
      
      // Reset to starting position to build move-by-move positions
      tempChess.reset();
      const positions = [tempChess.fen()]; // Starting position
      
      // Build position for each move
      moves.forEach(move => {
        tempChess.move(move);
        positions.push(tempChess.fen());
      });

      setGameState(prev => ({
        ...prev,
        moves,
        positions,
        currentMoveIndex: -1, // Start at beginning
        analysis: analysisData,
        isAnalyzed: !!analysisData,
        pgn: pgnString
      }));

      // Set board to starting position
      setBoardPosition(positions[0]);
      
      if (analysisData) {
        setAnalysisText('Use the navigation controls to step through each move and see the analysis.');
      }

      return true;
    } catch (error) {
      return false;
    }
  }, []);

  // Extract heuristics from position and context
  const extractHeuristics = (position, aiContext, analysis) => {
    const heuristics = {};
    
    if (!position) return heuristics;
    
    // Game phase
    const moveNumber = position.moveNumber;
    const lastBookMove = analysis?.opening?.lastBookMove || 0;
    if (moveNumber <= lastBookMove) {
      heuristics.phase = 'opening';
    } else if (moveNumber <= 25) {
      heuristics.phase = 'middlegame';
    } else {
      heuristics.phase = 'endgame';
    }
    
    // Move quality
    heuristics.bookMove = position.classification === 'book';
    heuristics.excellentMove = position.classification === 'excellent';
    heuristics.goodMove = position.classification === 'good';
    heuristics.inaccuracy = position.classification === 'inaccuracy';
    heuristics.mistake = position.classification === 'mistake';
    heuristics.blunder = position.classification === 'blunder';
    
    // Tactics
    heuristics.capture = position.isCapture;
    heuristics.check = position.isCheck;
    heuristics.promotion = position.isPromotion;
    
    // From AI context if available
    if (aiContext) {
      // Key moment types
      const momentType = aiContext.meta?.momentType;
      heuristics.openingTransition = momentType === 'opening_transition';
      heuristics.hiddenPlan = momentType === 'hidden_plan';
      heuristics.pawnStructureChange = momentType === 'pawn_structure_change';
      heuristics.criticalDecision = momentType === 'critical_decision';
      heuristics.prophylactic = momentType === 'prophylactic';
      heuristics.planSequence = momentType === 'plan_sequence';
      
      // Pawn structure
      if (aiContext.pawnStructure) {
        const ps = aiContext.pawnStructure;
        heuristics.passedPawnWhite = ps.white?.passed?.length > 0;
        heuristics.passedPawnBlack = ps.black?.passed?.length > 0;
        heuristics.isolatedPawns = (ps.white?.isolated?.length > 0) || (ps.black?.isolated?.length > 0);
        heuristics.doubledPawns = (ps.white?.doubled?.length > 0) || (ps.black?.doubled?.length > 0);
        heuristics.backwardPawns = (ps.white?.backward?.length > 0) || (ps.black?.backward?.length > 0);
        heuristics.pawnChain = (ps.white?.chains?.length > 0) || (ps.black?.chains?.length > 0);
        heuristics.centerTension = ps.tension?.length > 0;
      }
      
      // King safety
      if (aiContext.kingSafety) {
        const ks = aiContext.kingSafety;
        heuristics.whiteKingCastled = ks.white?.castled;
        heuristics.whiteKingExposed = ks.white?.pawnShield === 'compromised' || ks.white?.openFiles?.length > 0;
        heuristics.blackKingCastled = ks.black?.castled;
        heuristics.blackKingExposed = ks.black?.pawnShield === 'compromised' || ks.black?.openFiles?.length > 0;
      }
      
      // Material
      if (aiContext.material) {
        heuristics.materialImbalance = Math.abs(aiContext.material.difference) > 1;
      }
      
      // Strategic themes
      if (aiContext.strategicThemes) {
        const themes = aiContext.strategicThemes;
        const spaceTheme = themes.find(t => t.theme === 'space_advantage');
        if (spaceTheme) {
          heuristics.whiteSpaceAdvantage = spaceTheme.side === 'white';
          heuristics.blackSpaceAdvantage = spaceTheme.side === 'black';
        }
        
        const majorityThemes = themes.filter(t => t.theme === 'pawn_majority');
        majorityThemes.forEach(t => {
          if (t.flank === 'queenside') heuristics.queensideMajority = true;
          if (t.flank === 'kingside') heuristics.kingsideMajority = true;
        });
      }
      
      // Board control
      if (aiContext.boardControl) {
        const bc = aiContext.boardControl;
        if (bc.centerControl) {
          heuristics.whiteCenterControl = bc.centerControl.assessment === 'white_controls';
          heuristics.blackCenterControl = bc.centerControl.assessment === 'black_controls';
          heuristics.centerContested = bc.centerControl.assessment === 'contested';
        }
        heuristics.outpost = bc.outposts?.length > 0;
        heuristics.weakSquare = bc.weakSquares?.length > 0;
      }
    }
    
    // Detect pawn breaks and piece trades
    if (position.pieceType === 'p' && position.isCapture) {
      heuristics.pawnBreak = true;
    }
    if (position.isCapture && ['q', 'r', 'b', 'n'].includes(position.pieceType)) {
      heuristics.pieceTrade = true;
    }
    
    // High complexity (simplified check)
    heuristics.highComplexity = position.evalChange >= 100 && !position.classification === 'book';
    
    return heuristics;
  };

  // Navigate to specific move
  const goToMove = useCallback((moveIndex) => {
    if (gameState.positions && moveIndex >= -1 && moveIndex < gameState.moves.length) {
      const positionIndex = moveIndex + 1; // positions array includes starting position at index 0
      setBoardPosition(gameState.positions[positionIndex]);
      setGameState(prev => ({ ...prev, currentMoveIndex: moveIndex }));
      
      // Check if this is a key moment and get AI context
      let aiContext = null;
      if (gameState.analysis?.keyMoments && gameState.analysis?.aiContexts) {
        const keyMomentIndex = gameState.analysis.keyMoments.findIndex(moment => 
          moment.moveIndex === moveIndex || 
          (moment.moves && moment.moves.includes(moveIndex))
        );
        if (keyMomentIndex >= 0) {
          aiContext = gameState.analysis.aiContexts[keyMomentIndex];
        }
      }
      setCurrentAIContext(aiContext);
      
      // Update eval for eval bar
      if (gameState.analysis?.positions && moveIndex >= 0) {
        const position = gameState.analysis.positions[moveIndex];
        setCurrentEval(position?.rawEval || position?.evaluation?.score || 0);
      } else if (moveIndex === -1) {
        // Starting position
        setCurrentEval(0);
      }
      
      // Extract and set heuristics
      if (gameState.analysis?.positions && moveIndex >= 0) {
        const position = gameState.analysis.positions[moveIndex];
        const heuristics = extractHeuristics(position, aiContext, gameState.analysis);
        setCurrentHeuristics(heuristics);
      } else {
        setCurrentHeuristics({});
      }
      
      // Update analysis text based on move
      if (gameState.isAnalyzed && gameState.analysis) {
        if (moveIndex === -1) {
          setAnalysisText('Starting position. Use navigation controls to step through the moves.');
        } else {
          const move = gameState.moves[moveIndex];
          const moveNumber = Math.ceil((moveIndex + 1) / 2);
          const player = moveIndex % 2 === 0 ? 'White' : 'Black';
          
          // Determine if we're still in book based on lastBookMove
          const lastBookMove = gameState.analysis?.opening?.lastBookMove || 0;
          const isInBook = moveNumber <= lastBookMove;
          
          if (isInBook) {
            // We're in opening book
            const openingName = gameState.analysis?.opening?.name || 'Unknown Opening';
            const eco = gameState.analysis?.opening?.eco || '';
            
            setAnalysisText(`Move ${moveNumber}: ${player} plays ${move.san}

Opening Book Move:
This move is part of established opening theory.
${openingName}${eco ? ` (${eco})` : ''}

This position appears in the opening book with ${gameState.analysis?.opening?.bookDepth || lastBookMove} moves of established theory.`);
          } else {
            // Post-opening phase - AI analysis
            
            // Check if this is a key moment
            const isKeyMoment = aiContext !== null;
            const keyMomentText = isKeyMoment ? '\n\n🔑 KEY MOMENT: This position has been identified for deep strategic analysis.' : '';
            
            setAnalysisText(`Move ${moveNumber}: ${player} plays ${move.san}

AI Strategic Analysis:
This move takes the game beyond established opening theory. Advanced positional and tactical analysis would appear here, evaluating the strategic implications of this position.${keyMomentText}`);
          }
        }
      }
    }
  }, [gameState.positions, gameState.moves, gameState.isAnalyzed, gameState.analysis]);

  // Navigation functions
  const goToStart = useCallback(() => goToMove(-1), [goToMove]);
  const goToPrevious = useCallback(() => goToMove(gameState.currentMoveIndex - 1), [goToMove, gameState.currentMoveIndex]);
  const goToNext = useCallback(() => goToMove(gameState.currentMoveIndex + 1), [goToMove, gameState.currentMoveIndex]);
  const goToEnd = useCallback(() => goToMove(gameState.moves.length - 1), [goToMove, gameState.moves.length]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (!gameState.isAnalyzed) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNext();
          break;
        case 'Home':
          event.preventDefault();
          goToStart();
          break;
        case 'End':
          event.preventDefault();
          goToEnd();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameState.isAnalyzed, gameState.currentMoveIndex, goToPrevious, goToNext, goToStart, goToEnd]);

  // Handle analysis completion
  useEffect(() => {
    if (gameState.analysis && !gameState.isAnalyzed) {
      setGameState(prev => ({ ...prev, isAnalyzed: true }));
      setAnalysisText('Analysis complete! Use the navigation controls below to step through each move and see the detailed analysis.');
    }
  }, [gameState.analysis, gameState.isAnalyzed]);

  const handleAnalyze = async () => {
    if (!pgn.trim()) return;
    
    // Setup game first
    const success = setupGame(pgn);
    if (!success) {
      setAnalysisText('Error: Invalid PGN format. Please check your input and try again.');
      return;
    }

    setAnalysisText('Analyzing game... This may take a moment.');
    
    try {
      // Call the parent's analyze function with AI context flag
      const result = await onAnalyze(pgn, depth, includeAIContext);
      
      
      // Update with analysis results
      setGameState(prev => ({ 
        ...prev, 
        analysis: result,
        isAnalyzed: true 
      }));
      
      setAnalysisText('Analysis complete! Use the navigation controls to step through each move.');
      
    } catch (error) {
      setAnalysisText(`Analysis failed: ${error.message || 'Unknown error occurred'}`);
    }
  };

  const handleNewAnalysis = () => {
    // Reset everything
    chess.reset();
    setBoardPosition(chess.fen());
    setPgn('');
    setGameState({
      moves: [],
      currentMoveIndex: -1,
      analysis: null,
      isAnalyzed: false,
      pgn: ''
    });
    setAnalysisText('Enter a chess game in PGN format to begin analysis. The board will become interactive once analysis is complete.');
    setCurrentEval(0); // Reset eval bar to neutral position
    setCurrentAIContext(null); // Reset AI context
    setCurrentHeuristics({}); // Reset heuristics
  };

  const loadSample = () => {
    setPgn(samplePgn);
  };

  const toggleBoardOrientation = () => {
    setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
  };

  return (
    <div className="max-w-full mx-auto h-[calc(100vh-12rem)] px-4">
      <div className="flex gap-3 h-full">

        {/* Heuristics Panel - Left side */}
        <div className="hidden lg:block flex-shrink-0 w-1/4 h-full">
          <div className="h-full flex flex-col max-h-full overflow-hidden">
            <HeuristicsPanel heuristics={currentHeuristics} />
          </div>
        </div>

        {/* Chess Board - Center with min-width, flex-grow to take available space */}
        <div className="flex-grow flex-shrink min-w-[800px] max-w-[900px]">
          <div className="bg-white rounded-lg shadow-sm border p-4 h-full flex flex-col">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {gameState.isAnalyzed && gameState.analysis?.gameInfo?.opening && gameState.analysis?.gameInfo?.eco
                ? `${gameState.analysis.gameInfo.eco} - ${gameState.analysis.gameInfo.opening}`
                : 'Chess Analysis Board'
              }
            </h2>
            
            {/* Chess Board, Eval Bar, and Move List Layout */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 justify-between">
              {/* Chess Board - expanded to fill available space */}
              <div className="flex-shrink-0 mx-auto md:mx-0">
                <Chessboard
                  position={boardPosition}
                  boardOrientation={boardOrientation}
                  boardWidth={typeof window !== 'undefined'
                    ? Math.min(520, window.innerWidth * 0.36, window.innerHeight * 0.65)
                    : 520
                  }
                  arePiecesDraggable={false} // Disable dragging - this is for analysis only
                  customBoardStyle={{
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </div>
              
              {/* Eval Bar - matches board height */}
              {gameState.isAnalyzed && (
                <div className="flex-shrink-0" style={{
                  height: typeof window !== 'undefined'
                    ? Math.min(520, window.innerWidth * 0.36, window.innerHeight * 0.65)
                    : 520
                }}>
                  <EvalBar 
                    currentEval={currentEval}
                    boardOrientation={boardOrientation}
                    isMate={false} // TODO: detect mate positions
                    mateIn={0}
                  />
                </div>
              )}
              
              {/* Move List - right-justified and matches board height */}
              <div className="w-full md:w-44 lg:w-48 md:ml-auto flex-shrink-0">
                <MoveList
                  moves={gameState.moves}
                  currentMoveIndex={gameState.currentMoveIndex}
                  onMoveClick={goToMove}
                  isAnalyzed={gameState.isAnalyzed}
                  boardHeight={typeof window !== 'undefined'
                    ? Math.min(520, window.innerWidth * 0.36, window.innerHeight * 0.65)
                    : 520
                  }
                  keyMoments={gameState.analysis?.keyMoments || []}
                />
              </div>
            </div>

            {/* Game Navigation */}
            <GameNavigation
              currentMoveIndex={gameState.currentMoveIndex}
              totalMoves={gameState.moves.length}
              isAnalyzed={gameState.isAnalyzed}
              onGoToStart={goToStart}
              onGoToPrevious={goToPrevious}
              onGoToNext={goToNext}
              onGoToEnd={goToEnd}
              onNewAnalysis={handleNewAnalysis}
              onToggleBoardOrientation={toggleBoardOrientation}
              boardOrientation={boardOrientation}
            />
          </div>
        </div>

        {/* Right Side - Analysis Panel */}
        <div className="hidden lg:block flex-shrink-0 w-1/4 h-full">
          <div className="space-y-4 h-full flex flex-col max-h-full overflow-hidden">
            
            {/* PGN Input Section */}
            {!gameState.isAnalyzed && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Enter Game</h3>
                  <button
                    type="button"
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {showSettings && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <label className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">Analysis Depth:</span>
                      <select
                        value={depth}
                        onChange={(e) => setDepth(parseInt(e.target.value))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-chess-primary"
                      >
                        <option value={10}>Quick (10)</option>
                        <option value={15}>Balanced (15)</option>
                        <option value={20}>Deep (20)</option>
                        <option value={25}>Maximum (25)</option>
                      </select>
                    </label>
                  </div>
                )}

                <div className="space-y-3">
                  <textarea
                    value={pgn}
                    onChange={(e) => setPgn(e.target.value)}
                    placeholder="Paste your chess game in PGN format here..."
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none font-mono text-sm focus:outline-none focus:ring-2 focus:ring-chess-primary focus:border-transparent"
                  />
                  
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={loadSample}
                      className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Load Sample</span>
                    </button>

                    <button
                      onClick={handleAnalyze}
                      disabled={loading || !pgn.trim()}
                      className="flex items-center space-x-2 px-4 py-2 bg-chess-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4" />
                      <span>{loading ? 'Analyzing...' : 'Analyze'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Move Analysis Display */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <MoveAnalysisDisplay
                text={analysisText}
                currentMove={gameState.currentMoveIndex >= 0 ? gameState.moves[gameState.currentMoveIndex] : null}
                isAnalyzed={gameState.isAnalyzed}
                analysis={gameState.analysis}
                currentMoveIndex={gameState.currentMoveIndex}
                aiContext={currentAIContext}
                currentEval={currentEval}
              />
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default ChessAnalyzer;