import { BookOpen, Brain, Eye } from 'lucide-react';

const MoveAnalysisDisplay = ({ text, currentMove, isAnalyzed, analysis, currentMoveIndex }) => {
  // Determine if current move is in opening based on actual lastBookMove
  const lastBookMove = analysis?.opening?.lastBookMove || 0;
  // Convert half-move index to chess move number for comparison
  const currentChessMoveNumber = currentMoveIndex !== undefined ? Math.ceil((currentMoveIndex + 1) / 2) : 0;
  const isOpeningPhase = currentMoveIndex !== undefined && currentChessMoveNumber <= lastBookMove;
  
  const getPhaseIcon = () => {
    if (!currentMove) return <Eye className="w-4 h-4 text-gray-500" />;
    return isOpeningPhase 
      ? <BookOpen className="w-4 h-4 text-blue-500" />
      : <Brain className="w-4 h-4 text-purple-500" />;
  };

  const getPhaseLabel = () => {
    if (!currentMove) return 'Analysis';
    return isOpeningPhase ? 'Opening Theory' : 'Strategic Analysis';
  };

  const getPhaseColor = () => {
    if (!currentMove) return 'border-gray-200 bg-gray-50';
    return isOpeningPhase 
      ? 'border-blue-200 bg-blue-50'
      : 'border-purple-200 bg-purple-50';
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 transition-all duration-200 h-full flex flex-col ${getPhaseColor()}`}>
      <div className="flex items-center mb-3">
        {getPhaseIcon()}
        <h3 className="text-lg font-semibold text-gray-900 ml-2">{getPhaseLabel()}</h3>
        {currentMove && currentMoveIndex >= 0 && (
          <div className="ml-auto text-sm text-gray-500">
            Move {currentChessMoveNumber}
          </div>
        )}
      </div>
      
      {/* Analysis Source Status Lights */}
      {isAnalyzed && (
        <div className="flex items-center gap-4 mb-4 text-xs">
          {/* WikiBooks Opening Theory Light */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isOpeningPhase 
                ? 'bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse' 
                : 'bg-gray-300'
            }`}></div>
            <span className={`transition-colors ${isOpeningPhase ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
              WikiBooks Opening Theory
            </span>
          </div>
          
          {/* AI Strategic Analysis Light */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              !isOpeningPhase && currentMove && currentChessMoveNumber > lastBookMove
                ? 'bg-purple-500 shadow-lg shadow-purple-500/50 animate-pulse' 
                : 'bg-gray-300'
            }`}></div>
            <span className={`transition-colors ${
              !isOpeningPhase && currentMove && currentChessMoveNumber > lastBookMove ? 'text-purple-700 font-medium' : 'text-gray-500'
            }`}>
              AI Analysis
            </span>
          </div>
        </div>
      )}
      
      <div className="flex-1 min-h-0" style={{ overflowY: 'scroll', maxHeight: 'calc(80vh - 200px)' }}>
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
          {text}
        </div>
      </div>

      {/* Phase indicator at bottom */}
      {isAnalyzed && currentMove && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center text-xs text-gray-500">
            {isOpeningPhase ? (
              <>
                <BookOpen className="w-3 h-3 mr-1" />
                <span>WikiBooks opening theory</span>
              </>
            ) : (
              <>
                <Brain className="w-3 h-3 mr-1" />
                <span>AI-powered strategic analysis</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      {isAnalyzed && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            Use arrow keys to navigate
          </div>
        </div>
      )}
    </div>
  );
};

export default MoveAnalysisDisplay;