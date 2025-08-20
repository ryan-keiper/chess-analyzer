import { ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

const MoveList = ({ moves, currentMoveIndex, onMoveClick, isAnalyzed, boardHeight = 450 }) => {
  const scrollContainerRef = useRef(null);
  
  // Auto-scroll to current move
  useEffect(() => {
    if (currentMoveIndex >= 0 && scrollContainerRef.current) {
      const currentButton = scrollContainerRef.current.querySelector(`[data-move-index="${currentMoveIndex}"]`);
      if (currentButton) {
        currentButton.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentMoveIndex]);
  if (!isAnalyzed || !moves || moves.length === 0) {
    return (
      <div 
        className="bg-gray-50 rounded-lg p-3 overflow-y-auto border"
        style={{ height: `${boardHeight}px` }}
      >
        <div className="text-xs font-medium text-gray-700 mb-3 flex items-center border-b border-gray-200 pb-2">
          <ChevronRight className="w-3 h-3 mr-1" />
          Game Moves
          <span className="ml-auto text-gray-500">Click to navigate</span>
        </div>
        <div className="flex items-center justify-center text-gray-400 text-sm h-32">
          Moves will appear here after analysis
        </div>
      </div>
    );
  }

  // Group moves into pairs (White, Black)
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;
    const whiteMove = moves[i];
    const blackMove = moves[i + 1];
    
    movePairs.push({
      moveNumber,
      white: whiteMove ? { move: whiteMove, index: i } : null,
      black: blackMove ? { move: blackMove, index: i + 1 } : null,
    });
  }

  const handleMoveClick = (moveIndex) => {
    onMoveClick(moveIndex);
  };

  return (
    <div 
      ref={scrollContainerRef} 
      className="bg-gray-50 rounded-lg p-3 overflow-y-auto border"
      style={{ height: `${boardHeight}px` }}
    >
      <div className="text-xs font-medium text-gray-700 mb-3 flex items-center border-b border-gray-200 pb-2">
        <ChevronRight className="w-3 h-3 mr-1" />
        Game Moves
        <span className="ml-auto text-gray-500">Click to navigate</span>
      </div>
      
      <div className="space-y-0.5 text-sm">
        {movePairs.map((pair) => (
          <div key={pair.moveNumber} className="flex items-center">
            {/* Move number */}
            <div className="w-7 text-gray-500 text-right mr-3 font-mono text-xs">
              {pair.moveNumber}.
            </div>
            
            {/* White move */}
            <div className="flex-1 mr-1">
              {pair.white && (
                <button
                  data-move-index={pair.white.index}
                  onClick={() => handleMoveClick(pair.white.index)}
                  className={`px-2 py-1.5 rounded text-left font-mono hover:bg-blue-100 transition-all duration-150 w-full text-sm focus:outline-none ${
                    currentMoveIndex === pair.white.index
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-800 hover:text-blue-700 hover:shadow-sm'
                  }`}
                >
                  {pair.white.move.san}
                </button>
              )}
            </div>
            
            {/* Black move */}
            <div className="flex-1">
              {pair.black && (
                <button
                  data-move-index={pair.black.index}
                  onClick={() => handleMoveClick(pair.black.index)}
                  className={`px-2 py-1.5 rounded text-left font-mono hover:bg-blue-100 transition-all duration-150 w-full text-sm focus:outline-none ${
                    currentMoveIndex === pair.black.index
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-800 hover:text-blue-700 hover:shadow-sm'
                  }`}
                >
                  {pair.black.move.san}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MoveList;