import { useState } from 'react';
import { Upload, Settings, Play } from 'lucide-react';

const PgnInput = ({ onAnalyze, loading }) => {
  const [pgn, setPgn] = useState('');
  const [depth, setDepth] = useState(15);
  const [showSettings, setShowSettings] = useState(false);

  const samplePgn = `[Event "Sample Game"]
[Site "Chess.com"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 
6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 
11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4?? 14. g3 Qh3 15. Bf4 1-0`;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pgn.trim()) return;
    onAnalyze(pgn, depth);
  };

  const loadSample = () => {
    setPgn(samplePgn);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Analyze Your Game</h2>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Analysis Depth:</span>
              <select
                value={depth}
                onChange={(e) => setDepth(parseInt(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-chess-primary"
              >
                <option value={10}>Quick (10)</option>
                <option value={15}>Balanced (15)</option>
                <option value={20}>Deep (20)</option>
                <option value={25}>Maximum (25)</option>
              </select>
            </label>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="pgn" className="block text-sm font-medium text-gray-700 mb-2">
            PGN (Portable Game Notation)
          </label>
          <textarea
            id="pgn"
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder="Paste your chess game in PGN format here..."
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg resize-none font-mono text-sm focus:outline-none focus:ring-2 focus:ring-chess-primary focus:border-transparent"
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={loadSample}
            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            <span>Load Sample Game</span>
          </button>

          <button
            type="submit"
            disabled={loading || !pgn.trim()}
            className="flex items-center space-x-2 px-6 py-2 bg-chess-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            <span>{loading ? 'Analyzing...' : 'Analyze Game'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default PgnInput;
