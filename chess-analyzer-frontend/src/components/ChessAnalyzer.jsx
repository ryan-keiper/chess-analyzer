import { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Upload, Play, Settings, RotateCcw } from 'lucide-react';
import MoveAnalysisDisplay from './MoveAnalysisDisplay';
import GameNavigation from './GameNavigation';
import MoveList from './MoveList';

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

  const samplePgn = `[Event "Sample Game"]
[Site "Chess.com"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 
6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 
11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4?? 14. g3 Qh3 15. Bf4 1-0`;

  // Helper function to format moves as notation (1. e4 e5 2. Nf3 Nc6 etc.)
  const formatMovesAsNotation = (moves) => {
    let notation = '';
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = moves[i];
      const blackMove = moves[i + 1];
      
      notation += `${moveNumber}. ${whiteMove.san}`;
      if (blackMove) {
        notation += ` ${blackMove.san}`;
      }
      if (i + 2 < moves.length) {
        notation += ' ';
      }
    }
    return notation;
  };

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
      console.error('Error parsing PGN:', error);
      return false;
    }
  }, []);

  // Navigate to specific move
  const goToMove = useCallback((moveIndex) => {
    if (gameState.positions && moveIndex >= -1 && moveIndex < gameState.moves.length) {
      const positionIndex = moveIndex + 1; // positions array includes starting position at index 0
      setBoardPosition(gameState.positions[positionIndex]);
      setGameState(prev => ({ ...prev, currentMoveIndex: moveIndex }));
      
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
            console.log(`Move ${moveIndex + 1} is OUT OF BOOK (lastBookMove: ${lastBookMove})`);
            setAnalysisText(`Move ${moveNumber}: ${player} plays ${move.san}

AI Strategic Analysis:
This move takes the game beyond established opening theory. Advanced positional and tactical analysis would appear here, evaluating the strategic implications of this position.`);
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
      // Call the parent's analyze function
      const result = await onAnalyze(pgn, depth);
      
      console.log('Analysis result:', result);
      console.log('Opening data:', result.opening);
      console.log('LastBookMove:', result.opening?.lastBookMove);
      console.log('Book depth:', result.opening?.bookDepth);
      
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
  };

  const loadSample = () => {
    setPgn(samplePgn);
  };

  const toggleBoardOrientation = () => {
    setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-12rem)]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        
        {/* Chess Board - Takes up 2 columns on large screens */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border p-6 h-full flex flex-col">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {gameState.isAnalyzed && gameState.analysis?.gameInfo?.opening && gameState.analysis?.gameInfo?.eco
                ? `${gameState.analysis.gameInfo.eco} - ${gameState.analysis.gameInfo.opening}`
                : 'Chess Analysis Board'
              }
            </h2>
            
            {/* Chess Board and Move List Layout */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 justify-between">
              {/* Chess Board - expanded to fill available space */}
              <div className="flex-shrink-0 mx-auto md:mx-0">
                <Chessboard
                  position={boardPosition}
                  boardOrientation={boardOrientation}
                  boardWidth={typeof window !== 'undefined' 
                    ? Math.min(550, window.innerWidth * 0.4, window.innerHeight * 0.65)
                    : 550
                  }
                  arePiecesDraggable={false} // Disable dragging - this is for analysis only
                  customBoardStyle={{
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </div>
              
              {/* Move List - right-justified and matches board height */}
              <div className="w-full md:w-48 lg:w-52 md:ml-auto flex-shrink-0">
                <MoveList
                  moves={gameState.moves}
                  currentMoveIndex={gameState.currentMoveIndex}
                  onMoveClick={goToMove}
                  isAnalyzed={gameState.isAnalyzed}
                  boardHeight={typeof window !== 'undefined' 
                    ? Math.min(550, window.innerWidth * 0.4, window.innerHeight * 0.65)
                    : 550
                  }
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
        <div className="lg:col-span-1 h-full">
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
              />
            </div>
            
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default ChessAnalyzer;