const request = require('supertest');
const express = require('express');
const chessRoutes = require('../routes/chess');

// Mock the chess analyzer service
jest.mock('../services/chessAnalyzer', () => ({
  analyzeGame: jest.fn()
}));

// Mock the validation middleware and express-validator
jest.mock('express-validator', () => {
  const originalModule = jest.requireActual('express-validator');
  return {
    ...originalModule,
    body: jest.fn(() => ({
      notEmpty: jest.fn().mockReturnThis(),
      withMessage: jest.fn().mockReturnThis(),
      isString: jest.fn().mockReturnThis(),
      isLength: jest.fn().mockReturnThis(),
      custom: jest.fn().mockReturnThis(),
      optional: jest.fn().mockReturnThis(),
      isInt: jest.fn().mockReturnThis(),
      toInt: jest.fn().mockReturnThis()
    })),
    validationResult: jest.fn((_req) => {
      // Default to no errors
      return {
        isEmpty: () => true,
        array: () => []
      };
    })
  };
});

// Mock the validation middleware
jest.mock('../middleware/validation', () => ({
  validatePgn: []
}));

// Mock chess.js
jest.mock('chess.js', () => ({
  Chess: jest.fn(() => ({
    loadPgn: jest.fn(),
    history: jest.fn(() => []),
    fen: jest.fn(() => 'test_fen')
  }))
}));

describe('Chess Routes', () => {
  let app;
  let mockAnalyzeGame;
  let mockValidationResult;

  // Define shared test data at top level
  const validPgn = `[Event "Test Game"]
[Site "Test"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0`;

  const mockAnalysisResult = {
    gameInfo: {
      white: 'Player1',
      black: 'Player2',
      result: '1-0',
      opening: 'Ruy Lopez',
      eco: 'C60',
      totalMoves: 5
    },
    positions: [
      {
        moveNumber: 1,
        color: 'w',
        move: 'e4',
        classification: 'normal',
        opening: { inBook: true }
      },
      {
        moveNumber: 1,
        color: 'b',
        move: 'e5',
        classification: 'book',
        opening: { inBook: true }
      },
      {
        moveNumber: 2,
        color: 'w',
        move: 'Nf3',
        classification: 'book',
        opening: { inBook: true }
      }
    ],
    blunders: [],
    summary: {
      totalBlunders: 0,
      bookMoves: 3,
      playerAccuracy: {
        white: 95,
        black: 92,
        combined: 93
      },
      averageAccuracy: 93,
      accuracyByPhase: {
        overall: 93,
        opening: 100,
        middlegame: 85
      }
    },
    phases: {
      opening: { start: 1, end: 3 },
      middlegame: { start: 4, end: null },
      endgame: { start: null, end: null }
    },
    criticalMoments: [],
    opening: {
      name: 'Ruy Lopez',
      eco: 'C60',
      lastBookMove: 3
    },
    strategicContext: {
      gameType: 'C',
      complexity: 2,
      playerStyles: {
        white: { accuracy: 95, aggression: 1 },
        black: { accuracy: 92, aggression: 0 }
      }
    }
  };

  beforeEach(() => {
    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/chess', chessRoutes);

    // Add error handler
    app.use((error, _req, res, _next) => {
      res.status(500).json({ error: error.message });
    });

    // Get mocked functions
    const { analyzeGame } = require('../services/chessAnalyzer');
    const { validationResult } = require('express-validator');
    mockAnalyzeGame = analyzeGame;
    mockValidationResult = validationResult;

    // Reset all mocks
    jest.clearAllMocks();

    // Reset validation to default (no errors)
    mockValidationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });
  });

  describe('POST /api/chess/analyze', () => {

    test('should analyze valid PGN successfully', async () => {
      mockAnalyzeGame.mockResolvedValue(mockAnalysisResult);

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn, depth: 15 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analysis).toBeDefined();
      expect(response.body.analysis.gameInfo.white).toBe('Player1');
      expect(response.body.analysis.gameInfo.black).toBe('Player2');

      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.depth).toBe(15);
      expect(response.body.metadata.movesAnalyzed).toBe(3);
      expect(response.body.metadata.bookMoves).toBe(3);
      expect(response.body.metadata.strategicMoves).toBe(0);
      expect(response.body.metadata.analysisType).toBe('original');
      expect(response.body.metadata.analyzedAt).toBeDefined();

      expect(mockAnalyzeGame).toHaveBeenCalledWith(validPgn, 15, false);
    });

    test('should use default depth when not provided', async () => {
      mockAnalyzeGame.mockResolvedValue(mockAnalysisResult);

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.depth).toBe(15); // Default depth
      expect(mockAnalyzeGame).toHaveBeenCalledWith(validPgn, 15, false);
    });

    test('should handle custom depth parameter', async () => {
      mockAnalyzeGame.mockResolvedValue(mockAnalysisResult);

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn, depth: 20 })
        .expect(200);

      expect(response.body.metadata.depth).toBe(20);
      expect(mockAnalyzeGame).toHaveBeenCalledWith(validPgn, 20, false);
    });

    test('should handle analysis with no book moves', async () => {
      const analysisWithoutBookMoves = {
        ...mockAnalysisResult,
        summary: {
          ...mockAnalysisResult.summary,
          bookMoves: 0
        }
      };

      mockAnalyzeGame.mockResolvedValue(analysisWithoutBookMoves);

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn })
        .expect(200);

      expect(response.body.metadata.bookMoves).toBe(0);
      expect(response.body.metadata.strategicMoves).toBe(3); // All moves are strategic
    });

    test('should handle analysis service errors', async () => {
      mockAnalyzeGame.mockRejectedValue(new Error('Analysis failed'));

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn })
        .expect(500);

      expect(response.body.error).toBe('Analysis failed');
    });

    test('should validate required PGN field', async () => {
      // Mock validation to return errors for missing PGN
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: 'PGN is required' }]
      });

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ depth: 15 }) // Missing PGN
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toEqual([{ msg: 'PGN is required' }]);
      expect(mockAnalyzeGame).not.toHaveBeenCalled();
    });

    test('should handle malformed JSON', async () => {
      // This test sends malformed JSON that causes Express JSON parsing error (500)
      const response = await request(app)
        .post('/api/chess/analyze')
        .set('Content-Type', 'application/json')
        .send('{invalid json')
        .expect(500);

      expect(response.body).toBeDefined();
      expect(response.body.error).toBeDefined();
      expect(response.status).toBe(500);
      expect(mockAnalyzeGame).not.toHaveBeenCalled();
    });

    test('should handle very large PGN files', async () => {
      // Create a large PGN with many moves
      const largePgn = `[Event "Long Game"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7 14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5 Nxe4 18. Bxe7 Qxe7 19. exd6 Qf6 20. Nbd2 Nxd6 21. Nc4 Nxc4 22. Bxc4 Nb6 23. Ne5 Rae8 24. Bxf7+ Rxf7 25. Nxf7 Rxe1+ 26. Qxe1 Kxf7 27. Qe3 Qg5 28. Qxg5 hxg5 29. b3 Ke6 30. a3 Kd6 31. axb4 cxb4 32. Ra5 Nd5 33. f3 Bc8 34. Kf2 Bf5 35. Ra7 g6 36. Ra6+ Kc5 37. Ke1 Nf4 38. g3 Nxh3 39. Kd2 Nf2 40. Ra5+ Kb6 41. Ra8 g4 42. fxg4 Bxg4 43. Rc8 Bf3 44. b5 g5 45. Rc6+ Ka5 46. Rc7 Nd3 47. Ra7+ Kb6 48. Ra6+ Kc5 49. Ra5+ Kd6 50. Ra6+ Ke7 *`;

      const largeAnalysisResult = {
        ...mockAnalysisResult,
        positions: new Array(100).fill(mockAnalysisResult.positions[0]) // 100 moves
      };

      mockAnalyzeGame.mockResolvedValue(largeAnalysisResult);

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: largePgn })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata.movesAnalyzed).toBe(100);
    });

    test('should handle analysis with blunders and mistakes', async () => {
      const analysisWithBlunders = {
        ...mockAnalysisResult,
        blunders: [
          {
            moveNumber: 5,
            move: 'Qh5',
            severity: 'critical',
            evalChange: 350,
            description: 'White played Qh5, losing 3.5 pawns of advantage'
          }
        ],
        summary: {
          ...mockAnalysisResult.summary,
          totalBlunders: 1,
          biggestBlunder: {
            moveNumber: 5,
            move: 'Qh5',
            severity: 'critical'
          }
        }
      };

      mockAnalyzeGame.mockResolvedValue(analysisWithBlunders);

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn })
        .expect(200);

      expect(response.body.analysis.blunders).toHaveLength(1);
      expect(response.body.analysis.blunders[0].severity).toBe('critical');
      expect(response.body.analysis.summary.totalBlunders).toBe(1);
    });

    test('should handle empty analysis result', async () => {
      const emptyAnalysis = {
        gameInfo: { white: 'Unknown', black: 'Unknown', result: '*' },
        positions: [],
        blunders: [],
        summary: { bookMoves: 0, playerAccuracy: { combined: 0 } }
      };

      mockAnalyzeGame.mockResolvedValue(emptyAnalysis);

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn })
        .expect(200);

      expect(response.body.metadata.movesAnalyzed).toBe(0);
      expect(response.body.metadata.bookMoves).toBe(0);
      expect(response.body.metadata.strategicMoves).toBe(0);
    });
  });

  describe('GET /api/chess/engine-info', () => {
    test('should return engine information', async () => {
      const response = await request(app)
        .get('/api/chess/engine-info')
        .expect(200);

      expect(response.body.engine).toBe('Stockfish');
      expect(response.body.version).toBe('16.0');
      expect(response.body.status).toBe('available');
    });

    test('should handle engine info errors', async () => {
      // Mock the route to throw an error
      const originalRoute = chessRoutes.stack.find(layer =>
        layer.route && layer.route.path === '/engine-info'
      );

      if (originalRoute) {
        const originalHandler = originalRoute.route.stack[0].handle;
        originalRoute.route.stack[0].handle = async (req, res, next) => {
          next(new Error('Engine unavailable'));
        };

        await request(app)
          .get('/api/chess/engine-info')
          .expect(500);

        // Restore original handler
        originalRoute.route.stack[0].handle = originalHandler;
      }
    });
  });

  describe('Request Validation', () => {
    test('should validate PGN format through middleware', async () => {
      // Mock validation to return PGN format error
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: 'Invalid PGN format' }]
      });

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: 'invalid pgn' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(response.body.details).toEqual([{ msg: 'Invalid PGN format' }]);
      expect(mockAnalyzeGame).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle analysis timeout', async () => {
      // Mock a long-running analysis
      mockAnalyzeGame.mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 100))
          .then(() => mockAnalysisResult)
      );

      const response = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn })
        .expect(200);

      expect(response.body.success).toBe(true);
    }, 10000); // 10 second timeout

    test('should handle concurrent analysis requests', async () => {
      mockAnalyzeGame.mockResolvedValue(mockAnalysisResult);

      const requests = Array(5).fill().map(() =>
        request(app)
          .post('/api/chess/analyze')
          .send({ pgn: validPgn })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockAnalyzeGame).toHaveBeenCalledTimes(5);
    });

    test('should handle invalid depth values', async () => {
      mockAnalyzeGame.mockResolvedValue(mockAnalysisResult);

      // Test negative depth
      const response1 = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn, depth: -5 })
        .expect(200); // Should still work, analyzer will handle it

      expect(response1.body).toBeDefined();
      expect(response1.body.analysis).toBeDefined();
      expect(mockAnalyzeGame).toHaveBeenCalledWith(validPgn, -5, false);

      // Test very large depth
      const response2 = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn, depth: 999 })
        .expect(200);

      expect(response2.body).toBeDefined();
      expect(response2.body.analysis).toBeDefined();
      expect(mockAnalyzeGame).toHaveBeenCalledWith(validPgn, 999, false);

      // Test non-numeric depth
      const response3 = await request(app)
        .post('/api/chess/analyze')
        .send({ pgn: validPgn, depth: 'invalid' })
        .expect(200); // Will use default

      expect(response3.body).toBeDefined();
      expect(response3.body.analysis).toBeDefined();

      expect(mockAnalyzeGame).toHaveBeenCalledTimes(3);
    });

    test('should handle missing request body', async () => {
      // Mock validation to return error for missing body
      mockValidationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: 'PGN is required' }]
      });

      const response = await request(app)
        .post('/api/chess/analyze')
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
      expect(mockAnalyzeGame).not.toHaveBeenCalled();
    });
  });
});