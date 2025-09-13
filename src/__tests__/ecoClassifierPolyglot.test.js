const {
  ECOClassifier,
  initializeECOClassifier,
  classifyOpening
} = require('../services/ecoClassifier');

// Mock dependencies
jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              name: 'Test Opening',
              eco: 'A00',
              pgn: '1. e4',
              uci: 'e2e4'
            },
            error: null
          }))
        })),
        not: jest.fn(() => ({
          data: [],
          error: null,
          count: jest.fn(() => ({ data: [], error: null, count: 100 }))
        }))
      }))
    }))
  }
}));

jest.mock('../services/polyglotBook', () => {
  const mockBook = {
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: true,
    getBookMoves: jest.fn().mockResolvedValue([
      { uci: 'e2e4', count: 1000 },
      { uci: 'd2d4', count: 800 }
    ]),
    getStatistics: jest.fn().mockReturnValue({
      initialized: true,
      positions: 1000000,
      size: 100000000
    }),
    close: jest.fn()
  };

  return {
    PolyglotBook: jest.fn().mockImplementation(() => mockBook),
    getPolyglotBook: jest.fn(() => mockBook),
    initializePolyglotBook: jest.fn().mockResolvedValue(mockBook)
  };
});

jest.mock('chess.js', () => ({
  Chess: jest.fn().mockImplementation(() => ({
    loadPgn: jest.fn(),
    history: jest.fn(() => [
      { san: 'e4', from: 'e2', to: 'e4' },
      { san: 'e5', from: 'e7', to: 'e5' }
    ]),
    fen: jest.fn(() => 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'),
    move: jest.fn(),
    reset: jest.fn(),
    turn: jest.fn(() => 'w')
  }))
}));

describe('ECO Classifier with Polyglot Integration', () => {
  let classifier;
  let mockPolyglotBook;

  beforeEach(async () => {
    jest.clearAllMocks();
    classifier = new ECOClassifier();

    // Mock the polyglot book
    const { PolyglotBook } = require('../services/polyglotBook');
    mockPolyglotBook = new PolyglotBook();
    classifier.polyglotBook = mockPolyglotBook;
  });

  describe('Initialization', () => {
    test('should initialize with Polyglot book', async () => {
      await classifier.loadDatabase();

      expect(classifier.isLoaded).toBe(true);
      expect(mockPolyglotBook.initialize).toHaveBeenCalled();
    });

    test('should report correct statistics', async () => {
      await classifier.loadDatabase();

      // Check that polyglot book was initialized
      expect(classifier.polyglotBook).toBeDefined();
      expect(classifier.polyglotBook.getStatistics).toBeDefined();

      const bookStats = classifier.polyglotBook.getStatistics();
      expect(bookStats.positions).toBe(1000000);
    });
  });

  describe('Opening Classification', () => {
    beforeEach(async () => {
      await classifier.loadDatabase();
    });

    test('should classify opening with book depth', async () => {
      const pgn = '1. e4 e5';
      const result = await classifier.classify(pgn);

      expect(result).toMatchObject({
        name: expect.any(String),
        eco: expect.any(String),
        source: 'polyglot',
        bookDepth: expect.any(Number)
      });
    });

    test('should track book depth correctly for white moves', async () => {
      // Mock book responses for different positions
      mockPolyglotBook.getBookMoves
        .mockResolvedValueOnce([{ uci: 'e2e4', count: 1000 }]) // Starting position
        .mockResolvedValueOnce([]) // After 1...e5 (Black position)
        .mockResolvedValueOnce([{ uci: 'g1f3', count: 500 }]); // After 1...e5 (White to move)

      const pgn = '1. e4 e5 2. Nf3';
      const result = await classifier.classify(pgn);

      expect(result.bookDepth).toBeGreaterThan(0);
      expect(result.lastBookMove).toBeGreaterThan(0);
    });

    test('should handle transpositions', async () => {
      const pgn1 = '1. e4 e5 2. Nf3 Nc6 3. Bc4';
      const pgn2 = '1. e4 e5 2. Bc4 Nc6 3. Nf3';

      const result1 = await classifier.classify(pgn1);
      const result2 = await classifier.classify(pgn2);

      // Both should identify as Italian Game (or similar)
      expect(result1.name).toBeTruthy();
      expect(result2.name).toBeTruthy();
    });

    test('should handle empty PGN', async () => {
      // For empty PGN, the classifier should return data from the starting position
      const result = await classifier.classify('');

      expect(result).toBeDefined();
      expect(result.eco).toBeDefined();
      expect(result.name).toBeDefined();
    });

    test('should handle invalid PGN gracefully', async () => {
      const result = await classifier.classify('invalid pgn data');

      expect(result).toBeDefined();
      expect(result.eco).toBeDefined();
      expect(result.name).toBeDefined();
    });
  });

  describe('Book Move Detection', () => {
    beforeEach(async () => {
      await classifier.loadDatabase();
    });

    test('should detect when position is in book', async () => {
      mockPolyglotBook.getBookMoves.mockResolvedValueOnce([
        { uci: 'e2e4', count: 1000 }
      ]);

      const pgn = '1. e4';
      const result = await classifier.classify(pgn);

      expect(result.bookDepth).toBeGreaterThan(0);
    });

    test('should detect when position leaves book', async () => {
      mockPolyglotBook.getBookMoves
        .mockResolvedValueOnce([{ uci: 'e2e4', count: 1000 }])
        .mockResolvedValueOnce([]) // Out of book
        .mockResolvedValueOnce([]);

      const pgn = '1. e4 e5 2. Qh5'; // Scholar's mate attempt, likely not in book
      const result = await classifier.classify(pgn);

      expect(result).toBeDefined();
    });
  });

  describe('Move Format Handling', () => {
    test('should convert chess.js moves to UCI format', () => {
      const move = { from: 'e2', to: 'e4', promotion: null };
      const uci = classifier.moveToUci(move);

      expect(uci).toBe('e2e4');
    });

    test('should handle promotion moves', () => {
      const move = { from: 'e7', to: 'e8', promotion: 'q' };
      const uci = classifier.moveToUci(move);

      expect(uci).toBe('e7e8q');
    });

    test('should handle string moves', () => {
      const uci = classifier.moveToUci('e2e4');

      expect(uci).toBe('e2e4');
    });
  });

  describe('Database Queries', () => {
    test('should query chess_openings by EPD', async () => {
      await classifier.loadDatabase();

      const epd = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq';
      const result = await classifier.queryChessOpeningsPosition(epd);

      expect(result).toBeDefined();
    });

    test('should use cache for repeated queries', async () => {
      await classifier.loadDatabase();

      const epd = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq';

      // First query
      await classifier.queryChessOpeningsPosition(epd);

      // Mock supabase to check if it's called again
      const { supabase } = require('../services/supabase');
      supabase.from.mockClear();

      // Second query should use cache
      await classifier.queryChessOpeningsPosition(epd);

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('FEN/EPD Conversion', () => {
    test('should convert FEN to EPD correctly', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const epd = classifier.fenToEpd(fen);

      expect(epd).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
    });
  });

  describe('Module Exports', () => {
    test('should export initialization function', async () => {
      const result = await initializeECOClassifier();

      expect(result).toBeDefined();
    });

    test('should export classification function', async () => {
      await initializeECOClassifier();
      const result = await classifyOpening('1. e4');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('eco');
    });
  });

  describe('Error Handling', () => {
    test('should handle Polyglot book initialization failure', async () => {
      mockPolyglotBook.initialize.mockRejectedValueOnce(new Error('Book init failed'));

      await expect(classifier.loadDatabase()).rejects.toThrow();
    });

    test('should handle database query failures gracefully', async () => {
      const { supabase } = require('../services/supabase');

      // Mock database error during classification (not during loadDatabase)
      await classifier.loadDatabase();

      // Now mock the database to fail
      supabase.from.mockImplementationOnce(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: new Error('Database error')
            }))
          }))
        }))
      }));

      const result = await classifier.classify('1. e4');

      // Should still return a result even if database fails
      expect(result).toBeDefined();
      expect(result.name).toBeDefined();
    });
  });
});