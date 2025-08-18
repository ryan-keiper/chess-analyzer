import React, { useState } from 'react';
import Header from './Header';
import PgnInput from './PgnInput';
import AnalysisResults from './AnalysisResults';
import LoadingSpinner from './LoadingSpinner';
import { analyzeGame } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { canAnalyze, logUsage } from '../services/supabase';

function Dashboard({ onNavigateToPage }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const handleAnalyze = async (pgn, depth) => {
    // Check if user can analyze
    const canUserAnalyze = await canAnalyze(user);
    if (!canUserAnalyze) {
      setError('Daily analysis limit reached. Upgrade to Pro for unlimited analyses!');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const result = await analyzeGame(pgn, depth);
      setAnalysis(result.analysis);
      
      // Log usage
      await logUsage(user, 'analysis', { 
        moveCount: result.analysis.gameInfo.totalMoves,
        depth 
      });
      
    } catch (err) {
      setError(err.message || 'Failed to analyze game');
      console.error('Analysis error:', err);
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
        <div className="max-w-4xl mx-auto space-y-8">
          <PgnInput onAnalyze={handleAnalyze} loading={loading} />
          
          {loading && <LoadingSpinner />}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
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
            </div>
          )}
          
          {analysis && <AnalysisResults analysis={analysis} />}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;