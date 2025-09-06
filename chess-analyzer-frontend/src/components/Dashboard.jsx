import { useState } from 'react';
import Header from './Header';
import ChessAnalyzer from './ChessAnalyzer';
import LoadingSpinner from './LoadingSpinner';
import { analyzeGame } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { canAnalyze, logUsage } from '../services/supabase';

function Dashboard({ onNavigateToPage }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const handleAnalyze = async (pgn, depth) => {
    // Check if user can analyze
    const canUserAnalyze = await canAnalyze(user);
    if (!canUserAnalyze) {
      setError('Daily analysis limit reached. Upgrade to Pro for unlimited analyses!');
      throw new Error('Daily analysis limit reached. Upgrade to Pro for unlimited analyses!');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await analyzeGame(pgn, depth);
      
      // Log usage
      await logUsage(user, 'analysis', { 
        moveCount: result.analysis.gameInfo.totalMoves,
        depth 
      });
      
      return result.analysis; // Return the analysis for the ChessAnalyzer component
      
    } catch (err) {
      const errorMessage = err.message || 'Failed to analyze game';
      setError(errorMessage);
      console.error('Analysis error:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    onNavigateToPage?.('pricing');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigateToPage={onNavigateToPage} />
      
      <main className="container mx-auto px-4 py-8">
          <ChessAnalyzer onAnalyze={handleAnalyze} loading={loading} />
          
          {loading && (
            <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 shadow-xl">
                <LoadingSpinner />
                <div className="text-center mt-4 text-gray-700">
                  Analyzing your chess game...
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-40 max-w-md">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Analysis Failed</h3>
              <p className="text-red-600">{error}</p>
              {error.includes('limit reached') && (
                <button 
                  onClick={handleUpgrade}
                  className="mt-2 bg-chess-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                >
                  Upgrade to Pro
                </button>
              )}
              <button 
                onClick={() => setError(null)}
                className="mt-2 ml-2 text-gray-600 hover:text-gray-800 text-sm underline"
              >
                Dismiss
              </button>
            </div>
          )}
      </main>
    </div>
  );
}

export default Dashboard;