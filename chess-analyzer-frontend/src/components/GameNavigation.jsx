import { 
  SkipBack, 
  ChevronLeft, 
  ChevronRight, 
  SkipForward, 
  RotateCcw
} from 'lucide-react';

const GameNavigation = ({ 
  currentMoveIndex, 
  totalMoves, 
  isAnalyzed, 
  onGoToStart, 
  onGoToPrevious, 
  onGoToNext, 
  onGoToEnd,
  onNewAnalysis,
  onToggleBoardOrientation,
  boardOrientation 
}) => {
  
  const isAtStart = currentMoveIndex <= -1;
  const isAtEnd = currentMoveIndex >= totalMoves - 1;

  return (
    <div className="space-y-3">
      
      {/* Move Counter - always show */}
      <div className="text-center text-sm text-gray-600">
        <span className="font-medium">
          {!isAnalyzed ? 'Ready to analyze the game' : 
           currentMoveIndex === -1 ? 'Starting position' : `Move ${Math.ceil((currentMoveIndex + 1) / 2)} of ${Math.ceil(totalMoves / 2)}`}
        </span>
        <div className="text-xs text-gray-400 mt-1">
          {!isAnalyzed ? 'Enter a PGN above to begin' :
           currentMoveIndex === -1 
             ? 'Ready to analyze the game' 
             : `Position after ${currentMoveIndex % 2 === 0 ? 'White' : 'Black'}'s move`
          }
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center space-x-2">
        
        {/* Go to Start */}
        <button
          onClick={onGoToStart}
          disabled={!isAnalyzed || isAtStart}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-chess-primary"
          title="Go to start (Home key)"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Previous Move */}
        <button
          onClick={onGoToPrevious}
          disabled={!isAnalyzed || isAtStart}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-chess-primary"
          title="Previous move (← key)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Next Move */}
        <button
          onClick={onGoToNext}
          disabled={!isAnalyzed || isAtEnd}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-chess-primary"
          title="Next move (→ key)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Go to End */}
        <button
          onClick={onGoToEnd}
          disabled={!isAnalyzed || isAtEnd}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-chess-primary"
          title="Go to end (End key)"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Board Perspective Toggle */}
        <button
          onClick={onToggleBoardOrientation}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-chess-primary"
          title={`View from ${boardOrientation === 'white' ? 'Black' : 'White'}'s perspective`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Separator - always show but only visible when analyzed */}
        <div className={`w-px h-6 bg-gray-300 mx-2 ${!isAnalyzed ? 'opacity-50' : ''}`}></div>

        {/* New Analysis Button - only show after analysis */}
        {isAnalyzed && (
          <button
            onClick={onNewAnalysis}
            className="px-3 py-2 bg-chess-primary text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Start new analysis"
          >
            <span className="text-sm">New Analysis</span>
          </button>
        )}
      </div>

      {/* Progress Bar - always show */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-chess-primary h-2 rounded-full transition-all duration-200"
          style={{ 
            width: isAnalyzed && totalMoves > 0 
              ? `${Math.max(0, ((currentMoveIndex + 1) / totalMoves) * 100)}%`
              : '0%'
          }}
        ></div>
      </div>

      {/* Keyboard Shortcuts Hint - always show */}
      <div className="text-center text-xs text-gray-400">
        Use arrow keys: ← Previous | → Next | Home/End to jump
      </div>
      
    </div>
  );
};

export default GameNavigation;