const express = require('express');
const { body, validationResult } = require('express-validator');
const { Chess } = require('chess.js');

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

      const { pgn, depth = 15 } = req.body;
      
      console.log('Analyzing game with original analyzer...');
      
      // REVERTED: Use original analyzeGame function
      const analysis = await analyzeGame(pgn, depth);
      
      res.json({
        success: true,
        analysis,
        metadata: {
          analyzedAt: new Date().toISOString(),
          depth: depth,
          movesAnalyzed: analysis.positions.length,
          bookMoves: analysis.summary.bookMoves || 0,
          strategicMoves: analysis.positions.length - (analysis.summary.bookMoves || 0),
          analysisType: 'original'
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