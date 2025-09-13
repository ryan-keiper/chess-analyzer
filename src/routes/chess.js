const express = require('express');
const { validationResult } = require('express-validator');

// REVERTED: Back to original analyzer
const { analyzeGame } = require('../services/chessAnalyzer');
const { validatePgn } = require('../middleware/validation');

const router = express.Router();

// Analyze a chess game from PGN
router.post('/analyze',
  validatePgn,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid input',
          details: errors.array()
        });
      }

      const { pgn, depth = 15, includeAIContext = false } = req.body;

      console.log('Analyzing game with original analyzer...');
      if (includeAIContext) {
        console.log('AI context requested - will detect key moments');
      }

      // REVERTED: Use original analyzeGame function with AI context support
      const analysis = await analyzeGame(pgn, depth, includeAIContext);

      res.json({
        success: true,
        analysis,
        metadata: {
          analyzedAt: new Date().toISOString(),
          depth: depth,
          movesAnalyzed: analysis.positions.length,
          bookMoves: analysis.summary.bookMoves || 0,
          strategicMoves: analysis.positions.length - (analysis.summary.bookMoves || 0),
          analysisType: 'original',
          keyMomentsFound: analysis.keyMoments ? analysis.keyMoments.length : 0,
          aiContextsBuilt: analysis.aiContexts ? analysis.aiContexts.length : 0
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get engine info
router.get('/engine-info', async (req, res, next) => {
  try {
    // This will be expanded when we add Stockfish integration
    res.json({
      engine: 'Stockfish',
      version: '16.0',
      status: 'available'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;