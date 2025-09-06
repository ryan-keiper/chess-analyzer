import { AlertTriangle, TrendingDown, Trophy, Target, BookOpen, Clock, Zap, Eye, HelpCircle } from 'lucide-react';

const AnalysisResults = ({ analysis }) => {
  if (!analysis) return null;

  // Helper function for opening type explanation
  const getOpeningTypeExplanation = (type) => {
    const explanations = {
      'A': 'Flank Openings (1.b3, 1.c4, etc.)',
      'B': 'Semi-Open Games (1.e4 c5, 1.e4 c6, etc.)', 
      'C': 'Open Games (1.e4 e5)',
      'D': 'Queen\'s Gambit & Closed Games',
      'E': 'Indian Systems & King\'s Indian'
    };
    return explanations[type] || 'Unknown';
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '💥';
      case 'major': return '⚠️';
      case 'minor': return '⚡';
      default: return '📝';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'blunder-critical';
      case 'major': return 'blunder-major';
      case 'minor': return 'blunder-minor';
      default: return 'blunder-inaccuracy';
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Overview with Opening */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Game Overview</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{analysis.gameInfo.white}</div>
            <div className="text-sm text-gray-500">White</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">vs</div>
            <div className="text-sm text-gray-500">Result: {analysis.gameInfo.result}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{analysis.gameInfo.black}</div>
            <div className="text-sm text-gray-500">Black</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{analysis.gameInfo.totalMoves}</div>
            <div className="text-sm text-gray-500">Moves</div>
          </div>
        </div>

        {/* Opening Information */}
        {analysis.gameInfo.opening && analysis.gameInfo.opening !== 'Unknown Opening' && (
          <div className="border-t pt-4">
            <div className="flex items-center mb-2">
              <BookOpen className="w-4 h-4 text-blue-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">Opening</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-semibold text-gray-900">{analysis.gameInfo.opening}</span>
              {analysis.gameInfo.eco && (
                <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                  {analysis.gameInfo.eco}
                </span>
              )}
            </div>
            {analysis.opening?.lastBookMove && (
              <div className="text-sm text-gray-600 mt-1">
                Theory followed until move {analysis.opening.lastBookMove}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ENHANCED: Player Accuracy Summary - Now Prominent! */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <Target className="w-5 h-5 text-blue-500 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Player Performance</h2>
          <div className="ml-2 group relative">
            <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute left-0 top-6 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 w-48">
              Book moves count as 100% accurate. Accuracy decreases based on centipawn loss for non-book moves.
            </div>
          </div>
        </div>
        
        {/* Player Accuracy Cards - PROMINENT DISPLAY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200">
            <div className="text-4xl font-bold text-blue-700 mb-2">
              {analysis.summary.playerAccuracy?.white || analysis.strategicContext.playerStyles.white.accuracy}%
            </div>
            <div className="text-lg font-semibold text-blue-600 mb-1">⚪ White Accuracy</div>
            <div className="text-sm text-blue-500">
              {analysis.strategicContext.playerStyles.white.bookKnowledge} book moves • {analysis.strategicContext.playerStyles.white.aggression} aggressive moves
            </div>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200">
            <div className="text-4xl font-bold text-gray-700 mb-2">
              {analysis.summary.playerAccuracy?.black || analysis.strategicContext.playerStyles.black.accuracy}%
            </div>
            <div className="text-lg font-semibold text-gray-600 mb-1">⚫ Black Accuracy</div>
            <div className="text-sm text-gray-500">
              {analysis.strategicContext.playerStyles.black.bookKnowledge} book moves • {analysis.strategicContext.playerStyles.black.aggression} aggressive moves
            </div>
          </div>
        </div>
        
        {/* Game Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{analysis.summary.totalBlunders}</div>
            <div className="text-sm text-gray-500">Blunders</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {analysis.summary.playerAccuracy?.combined || Math.round(analysis.summary.averageAccuracy) || 0}%
            </div>
            <div className="text-sm text-gray-500">Combined</div>
            <div className="text-xs text-gray-400">Both players</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{analysis.summary.bookMoves || 0}</div>
            <div className="text-sm text-gray-500">Book Moves</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{analysis.summary.excellentMoves || 0}</div>
            <div className="text-sm text-gray-500">Excellent</div>
          </div>
        </div>

        {/* Move Classification Breakdown */}
        {analysis.summary.totalMistakes !== undefined && (
          <div className="border-t pt-4 mt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Move Quality Breakdown</div>
            <div className="flex flex-wrap gap-2">
              {analysis.summary.bookMoves > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                  📚 {analysis.summary.bookMoves} Book
                </span>
              )}
              {analysis.summary.excellentMoves > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                  ✨ {analysis.summary.excellentMoves} Excellent
                </span>
              )}
              {analysis.summary.totalInaccuracies > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded-full">
                  📝 {analysis.summary.totalInaccuracies} Inaccuracies
                </span>
              )}
              {analysis.summary.totalMistakes > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-red-600 bg-red-100 rounded-full">
                  ⚠️ {analysis.summary.totalMistakes} Mistakes
                </span>
              )}
              {analysis.summary.totalBlunders > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                  💥 {analysis.summary.totalBlunders} Blunders
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game Phases */}
      {analysis.phases && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <Clock className="w-5 h-5 text-purple-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Game Phases</h2>
            <div className="ml-2 group relative">
              <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 top-6 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 w-48">
                Opening ends when players leave book theory. Middlegame and endgame detected by move count and complexity.
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-700">Opening</div>
              <div className="text-sm text-blue-600">
                Moves {analysis.phases.opening.start}-{analysis.phases.opening.end}
              </div>
              {analysis.summary.accuracyByPhase?.opening && (
                <div className="text-xs text-blue-500 mt-1">
                  {analysis.summary.accuracyByPhase.opening.toFixed(1)}% accuracy
                </div>
              )}
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-700">Middlegame</div>
              <div className="text-sm text-green-600">
                Moves {analysis.phases.middlegame.start}-{analysis.phases.middlegame.end || '?'}
              </div>
              {analysis.summary.accuracyByPhase?.middlegame && (
                <div className="text-xs text-green-500 mt-1">
                  {analysis.summary.accuracyByPhase.middlegame.toFixed(1)}% accuracy
                </div>
              )}
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-700">Endgame</div>
              <div className="text-sm text-purple-600">
                {analysis.phases.endgame?.start ? `Move ${analysis.phases.endgame.start}+` : 'Not reached'}
              </div>
              {analysis.summary.accuracyByPhase?.endgame && (
                <div className="text-xs text-purple-500 mt-1">
                  {analysis.summary.accuracyByPhase.endgame.toFixed(1)}% accuracy
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Critical Moments */}
      {analysis.criticalMoments && analysis.criticalMoments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <Zap className="w-5 h-5 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Critical Moments</h2>
            <div className="ml-2 group relative">
              <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
              <div className="absolute left-0 top-6 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 w-48">
                Key turning points in the game. Book moves are never flagged as critical moments.
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {analysis.criticalMoments.slice(0, 5).map((moment, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {moment.type === 'blunder' ? '💥' : moment.type === 'missed_opportunity' ? '😔' : '📍'}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900">
                      Move {moment.moveNumber}: {moment.move}
                    </div>
                    <div className="text-sm text-gray-600">{moment.description}</div>
                  </div>
                </div>
                {moment.severity && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    moment.severity === 'critical' ? 'text-red-700 bg-red-100' :
                    moment.severity === 'major' ? 'text-orange-700 bg-orange-100' :
                    'text-yellow-700 bg-yellow-100'
                  }`}>
                    {moment.severity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traditional Blunders List */}
      {analysis.blunders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Key Mistakes</h2>
          </div>
          
          <div className="space-y-3">
            {analysis.blunders.map((blunder, index) => (
              <div 
                key={index} 
                className={`p-4 border-l-4 rounded-lg ${getSeverityColor(blunder.severity)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getSeverityIcon(blunder.severity)}</span>
                    <span className="font-semibold">
                      Move {blunder.moveNumber}: {blunder.move}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-white/50">
                      {blunder.severity}
                    </span>
                  </div>
                  <span className="font-mono text-sm">
                    -{(blunder.evalChange / 100).toFixed(1)} pawns
                  </span>
                </div>
                <p className="text-sm">{blunder.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategic Context Preview */}
      {analysis.strategicContext && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border p-6">
          <div className="flex items-center mb-4">
            <Eye className="w-5 h-5 text-indigo-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Strategic Overview</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-indigo-700">{analysis.strategicContext.gameType}</div>
              <div className="text-sm text-indigo-600">Opening Type</div>
              <div className="text-xs text-indigo-500 mt-1">{getOpeningTypeExplanation(analysis.strategicContext.gameType)}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-700">{analysis.strategicContext.complexity}</div>
              <div className="text-sm text-indigo-600">Complexity</div>
              <div className="text-xs text-indigo-500 mt-1">Critical moments</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-700">{analysis.positions?.length || 0}</div>
              <div className="text-sm text-indigo-600">Positions</div>
              <div className="text-xs text-indigo-500 mt-1">Analyzed</div>
            </div>
            <div>
              <div className="text-lg font-bold text-indigo-700">
                {analysis.strategicContext.keyMoments?.length || 0}
              </div>
              <div className="text-sm text-indigo-600">Key Moments</div>
              <div className="text-xs text-indigo-500 mt-1">Identified</div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white/50 rounded-lg">
            <div className="text-sm text-gray-700">
              <strong>Analysis Quality:</strong> This analysis uses professional-grade opening classification 
              with accurate book depth detection. Book moves count as 100% accurate, reflecting their theoretical perfection.
            </div>
          </div>
        </div>
      )}

      {/* Future: AI-Powered Analysis */}
      <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <TrendingDown className="w-8 h-8 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Coming Soon: AI Analysis</h3>
        <p className="text-gray-600">
          Natural language explanations of your strategic decisions, opening choices, and tactical opportunities
        </p>
      </div>
    </div>
  );
};

export default AnalysisResults;