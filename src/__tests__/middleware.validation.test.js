const { validatePgn } = require('../middleware/validation');
const { validationResult } = require('express-validator');

// Mock chess.js
jest.mock('chess.js', () => {
  const mockChess = {
    loadPgn: jest.fn(),
    history: jest.fn(() => [])
  };
  
  return {
    Chess: jest.fn(() => mockChess)
  };
});

describe('Validation Middleware', () => {
  let req, res, next;
  let mockChess;

  beforeEach(() => {
    req = {
      body: {}
    };
    res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res)
    };
    next = jest.fn();

    // Get the mocked Chess instance
    const { Chess } = require('chess.js');
    mockChess = new Chess();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console.log to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('PGN Validation', () => {
    test('should validate correct PGN successfully', async () => {
      const validPgn = `[Event "Test Game"]
[Site "Test"]
[Date "2024.01.01"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0`;

      req.body.pgn = validPgn;
      req.body.depth = 15;

      // Mock successful PGN loading
      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);

      // Run all validation middleware
      for (const middleware of validatePgn) {
        await middleware(req, res, next);
      }

      // Check that validation passed (no errors thrown)
      expect(mockChess.loadPgn).toHaveBeenCalledWith(validPgn);
      expect(mockChess.history).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Validating PGN...');
      expect(console.log).toHaveBeenCalledWith('PGN validation successful!');
    });

    test('should reject empty PGN', async () => {
      req.body.pgn = '';

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      // Should have validation error for empty PGN
      expect(validationError).not.toBeNull();
      expect(mockChess.loadPgn).not.toHaveBeenCalled();
    });

    test('should reject missing PGN field', async () => {
      // req.body.pgn is undefined
      req.body.depth = 15;

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
      expect(mockChess.loadPgn).not.toHaveBeenCalled();
    });

    test('should reject non-string PGN', async () => {
      req.body.pgn = 12345; // Number instead of string

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
    });

    test('should reject PGN that is too large', async () => {
      // Create a PGN larger than 50KB
      const largePgn = '[Event "Large Game"]\n' + 'a'.repeat(51000);
      req.body.pgn = largePgn;

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
      expect(mockChess.loadPgn).not.toHaveBeenCalled();
    });

    test('should reject malformed PGN that chess.js cannot parse', async () => {
      const malformedPgn = 'This is not a valid PGN format';
      req.body.pgn = malformedPgn;

      // Mock chess.js to throw error
      mockChess.loadPgn.mockImplementation(() => {
        throw new Error('Invalid PGN format');
      });

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
      expect(mockChess.loadPgn).toHaveBeenCalledWith(malformedPgn);
      expect(console.error).toHaveBeenCalledWith('PGN validation error:', 'Invalid PGN format');
    });

    test('should reject PGN with no valid moves', async () => {
      const pgnWithoutMoves = `[Event "No Moves Game"]
[Result "*"]

*`; // No actual moves

      req.body.pgn = pgnWithoutMoves;

      // Mock successful loading but empty history
      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue([]); // No moves

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
      expect(mockChess.loadPgn).toHaveBeenCalledWith(pgnWithoutMoves);
      expect(mockChess.history).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('PGN validation error:', 'PGN contains no valid moves');
    });

    test('should reject games that are too long', async () => {
      const normalPgn = '[Event "Long Game"]\n\n1. e4 e5 *';
      req.body.pgn = normalPgn;

      // Mock a game with too many moves
      const tooManyMoves = new Array(501).fill('e4'); // 501 moves (over limit)
      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(tooManyMoves);

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
      expect(console.error).toHaveBeenCalledWith('PGN validation error:', 'Game too long (max 500 moves)');
    });

    test('should handle chess.js throwing different error types', async () => {
      const testPgn = 'invalid pgn';
      req.body.pgn = testPgn;

      const errorTypes = [
        new Error('Invalid move format'),
        new SyntaxError('Unexpected token'),
        new TypeError('Cannot read property'),
        'String error message'
      ];

      for (const error of errorTypes) {
        jest.clearAllMocks();
        mockChess.loadPgn.mockImplementation(() => {
          throw error;
        });

        let validationError = null;
        try {
          for (const middleware of validatePgn) {
            await middleware(req, res, next);
          }
        } catch (err) {
          validationError = err;
        }

        expect(validationError).not.toBeNull();
        expect(validationError.message).toContain('PGN validation failed:');
      }
    });
  });

  describe('Depth Validation', () => {
    test('should accept valid depth values', async () => {
      const validPgn = '[Event "Test"]\n\n1. e4 e5 *';
      req.body.pgn = validPgn;

      const validDepths = [5, 10, 15, 20, 25];

      for (const depth of validDepths) {
        jest.clearAllMocks();
        req.body.depth = depth;

        // Mock successful PGN validation
        mockChess.loadPgn.mockImplementation(() => {});
        mockChess.history.mockReturnValue(['e4', 'e5']);

        let validationError = null;
        try {
          for (const middleware of validatePgn) {
            await middleware(req, res, next);
          }
        } catch (error) {
          validationError = error;
        }

        expect(validationError).toBeNull();
      }
    });

    test('should reject depth below minimum', async () => {
      const validPgn = '[Event "Test"]\n\n1. e4 e5 *';
      req.body.pgn = validPgn;
      req.body.depth = 4; // Below minimum of 5

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
    });

    test('should reject depth above maximum', async () => {
      const validPgn = '[Event "Test"]\n\n1. e4 e5 *';
      req.body.pgn = validPgn;
      req.body.depth = 26; // Above maximum of 25

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
    });

    test('should reject non-integer depth values', async () => {
      const validPgn = '[Event "Test"]\n\n1. e4 e5 *';
      req.body.pgn = validPgn;

      const invalidDepths = [
        'string_depth',
        15.5, // Float
        null,
        undefined,
        {},
        []
      ];

      for (const depth of invalidDepths) {
        jest.clearAllMocks();
        req.body.depth = depth;

        let validationError = null;
        try {
          for (const middleware of validatePgn) {
            await middleware(req, res, next);
          }
        } catch (error) {
          validationError = error;
        }

        expect(validationError).not.toBeNull();
      }
    });

    test('should allow missing depth (optional field)', async () => {
      const validPgn = '[Event "Test"]\n\n1. e4 e5 *';
      req.body.pgn = validPgn;
      // req.body.depth is undefined (optional)

      // Mock successful PGN validation
      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(['e4', 'e5']);

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeNull();
    });

    test('should convert valid string depth to integer', async () => {
      const validPgn = '[Event "Test"]\n\n1. e4 e5 *';
      req.body.pgn = validPgn;
      req.body.depth = '15'; // String that should be converted

      // Mock successful PGN validation
      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(['e4', 'e5']);

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeNull();
      expect(typeof req.body.depth).toBe('number');
      expect(req.body.depth).toBe(15);
    });
  });

  describe('Real-world PGN Examples', () => {
    test('should validate complete game with headers', async () => {
      const completePgn = `[Event "World Championship"]
[Site "New York"]
[Date "1886.03.15"]
[Round "20"]
[White "Steinitz, Wilhelm"]
[Black "Zukertort, Johannes"]
[Result "1-0"]
[ECO "D53"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. Nf3 O-O 6. e3 Nbd7 7. Rc1 c6 8. Bd3 dxc4 9. Bxc4 Nd5 10. Bxe7 Qxe7 11. O-O Nxc3 12. Rxc3 e5 13. dxe5 Nxe5 14. Nxe5 Qxe5 15. f4 Qe7 16. Qc2 Rd8 17. Rd3 Rxd3 18. Qxd3 Be6 19. Bxe6 Qxe6 20. Qd4 Rd8 21. Qxa7 Rd2 22. Rf2 Rxf2 23. Kxf2 Qc4 24. Qxb7 Qc2+ 25. Kf3 Qc3 26. a4 Qc1 27. Qb4 Qf1+ 28. Kg3 Qe1+ 29. Kh3 Qe2 30. Qb8+ Qf8 31. Qb4 Qe7 32. Qc4 Qe1 33. Qc5 Qe2 34. b4 Qe1 35. Qc4 Qe2 36. a5 Qe1 37. Qc5 Qe2 38. h4 Qe1 39. Kh2 Qe2 40. b5 cxb5 41. a6 Qf2 42. a7 Qxf4+ 43. Kg1 Qd2 44. a8=Q+ Kh7 45. Qcc7 Qd1+ 46. Kf2 Qd2+ 47. Kf3 Qd1+ 48. Ke4 Re8+ 49. Kf5 1-0`;

      req.body.pgn = completePgn;

      // Mock chess.js to handle this game
      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(new Array(98).fill('move')); // 49 moves = 98 half-moves

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeNull();
      expect(mockChess.loadPgn).toHaveBeenCalledWith(completePgn);
    });

    test('should validate game with variations and comments', async () => {
      const pgnWithVariations = `[Event "Test with variations"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 {The Spanish Opening} a6 (3...f5 {Schliemann Defense} 4. Nc3 fxe4 5. Nxe4) 4. Ba4 Nf6 5. O-O Be7 *`;

      req.body.pgn = pgnWithVariations;

      // Mock chess.js to handle this (might strip variations)
      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7']);

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeNull();
    });

    test('should handle PGN with special characters', async () => {
      const pgnWithSpecialChars = `[Event "Tëst Gàme"]
[White "Müller"]
[Black "González"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 *`;

      req.body.pgn = pgnWithSpecialChars;

      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(['e4', 'e5', 'Nf3', 'Nc6']);

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle chess.js module loading errors', async () => {
      const validPgn = '[Event "Test"]\n\n1. e4 e5 *';
      req.body.pgn = validPgn;

      // Mock Chess constructor to throw
      const { Chess } = require('chess.js');
      Chess.mockImplementation(() => {
        throw new Error('Chess.js module not found');
      });

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).not.toBeNull();
    });

    test('should handle very short valid games', async () => {
      const shortGame = `[Event "Fool's Mate"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1`;

      req.body.pgn = shortGame;

      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(['f3', 'e5', 'g4', 'Qh4#']);

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeNull();
    });

    test('should handle games with only one move', async () => {
      const oneMovePgn = `[Event "One Move"]
[Result "*"]

1. e4 *`;

      req.body.pgn = oneMovePgn;

      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(['e4']);

      let validationError = null;
      try {
        for (const middleware of validatePgn) {
          await middleware(req, res, next);
        }
      } catch (error) {
        validationError = error;
      }

      expect(validationError).toBeNull();
    });

    test('should handle concurrent validation calls', async () => {
      const pgn = '[Event "Concurrent"]\n\n1. e4 e5 *';
      
      mockChess.loadPgn.mockImplementation(() => {});
      mockChess.history.mockReturnValue(['e4', 'e5']);

      const promises = Array(5).fill().map(async () => {
        const testReq = { body: { pgn, depth: 15 } };
        
        try {
          for (const middleware of validatePgn) {
            await middleware(testReq, res, next);
          }
          return null; // Success
        } catch (error) {
          return error; // Failure
        }
      });

      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result).toBeNull();
      });
    });
  });
});