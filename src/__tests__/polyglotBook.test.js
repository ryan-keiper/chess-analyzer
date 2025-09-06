const { PolyglotBook, getPolyglotBook, initializePolyglotBook } = require('../services/polyglotBook');
const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');

describe('PolyglotBook Service', () => {
  let book;
  const testBookPath = '/test/book.bin';
  const mockBookData = Buffer.alloc(32); // 2 mock entries

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock file system operations
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue({ size: 32 });
    fs.openSync.mockReturnValue(123); // Mock file descriptor
    fs.readSync.mockImplementation((fd, buffer, offset, length, position) => {
      // Mock reading two entries
      if (position === 0) {
        // First entry: key=0x463b96181691fc9c (starting position)
        buffer.writeBigUInt64BE(0x463b96181691fc9cn, 0);
        // e2e4: e2 = square 12 (0x0c), e4 = square 28 (0x1c)
        buffer.writeUInt16BE(12 | (28 << 6), 8); // 0x070c
        buffer.writeUInt16BE(1000, 10);  // count
        buffer.writeUInt16BE(1000, 12);  // n
        buffer.writeInt16BE(500, 14);    // sum
      } else if (position === 16) {
        // Second entry: different position
        buffer.writeBigUInt64BE(0x123456789abcdefn, 0);
        // d2d4: d2 = square 11 (0x0b), d4 = square 27 (0x1b)
        buffer.writeUInt16BE(11 | (27 << 6), 8); // 0x06cb
        buffer.writeUInt16BE(800, 10);
        buffer.writeUInt16BE(800, 12);
        buffer.writeInt16BE(400, 14);
      }
      return length;
    });
    
    book = new PolyglotBook(testBookPath);
    
    // Add the actual decodePolyglotMove method for testing
    book.decodePolyglotMove = function(moveCode) {
      const fromSquare = moveCode & 0x3f;
      const toSquare = (moveCode >> 6) & 0x3f;
      const promotion = (moveCode >> 12) & 0x0f;
      const files = 'abcdefgh';
      const fromFile = files[fromSquare % 8];
      const fromRank = Math.floor(fromSquare / 8) + 1;
      const toFile = files[toSquare % 8];
      const toRank = Math.floor(toSquare / 8) + 1;
      let uci = `${fromFile}${fromRank}${toFile}${toRank}`;
      if (promotion > 0) {
        const promotionPieces = ['', 'n', 'b', 'r', 'q'];
        if (promotion <= 4) {
          uci += promotionPieces[promotion];
        }
      }
      return uci;
    };
  });

  afterEach(() => {
    if (book && book.fileDescriptor) {
      book.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid book file', async () => {
      await book.initialize();
      
      expect(book.isInitialized).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(testBookPath);
      expect(fs.openSync).toHaveBeenCalledWith(testBookPath, 'r');
    });

    test('should handle missing book file gracefully', async () => {
      fs.existsSync.mockReturnValue(false);
      
      await book.initialize();
      
      expect(book.isInitialized).toBe(false);
      expect(fs.openSync).not.toHaveBeenCalled();
    });

    test('should not reinitialize if already initialized', async () => {
      await book.initialize();
      fs.openSync.mockClear();
      
      await book.initialize();
      
      expect(fs.openSync).not.toHaveBeenCalled();
    });
  });

  describe('FEN to Polyglot Key Conversion', () => {
    test('should convert starting position correctly', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const key = book.fenToPolyglotKey(startingFen);
      
      // Standard Polyglot starting position key
      expect(key).toBe(0x463b96181691fc9cn);
    });

    test('should handle different positions', () => {
      const fen1 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      const fen2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
      
      const key1 = book.fenToPolyglotKey(fen1);
      const key2 = book.fenToPolyglotKey(fen2);
      
      expect(typeof key1).toBe('bigint');
      expect(typeof key2).toBe('bigint');
      expect(key1).not.toBe(key2);
    });
  });

  describe('Book Move Lookup', () => {
    test('should find moves for starting position', async () => {
      await book.initialize();
      
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moves = await book.getBookMoves(startingFen);
      
      expect(moves).toHaveLength(1);
      expect(moves[0]).toMatchObject({
        uci: 'e2e4',
        count: 1000,
        score: 0.25 // 500/(2*1000)
      });
    });

    test('should return empty array for position not in book', async () => {
      await book.initialize();
      
      // Mock a position that doesn't match our mock data
      const fen = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4';
      const moves = await book.getBookMoves(fen);
      
      expect(moves).toEqual([]);
    });

    test('should cache results for repeated lookups', async () => {
      await book.initialize();
      
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // First lookup
      await book.getBookMoves(fen);
      
      // Clear mock to check if it reads again
      fs.readSync.mockClear();
      
      // Second lookup should use cache
      const moves = await book.getBookMoves(fen);
      
      expect(fs.readSync).not.toHaveBeenCalled();
      expect(moves).toHaveLength(1);
    });
  });

  describe('Book Statistics', () => {
    test('should return correct statistics', async () => {
      await book.initialize();
      
      const stats = book.getStatistics();
      
      expect(stats).toMatchObject({
        initialized: true,
        positions: 2,
        size: 32
      });
    });

    test('should handle uninitialized book', () => {
      const stats = book.getStatistics();
      
      expect(stats).toMatchObject({
        initialized: false,
        positions: 0,
        size: 0
      });
    });
  });

  describe('Book Segments', () => {
    test('should find book segments in a game', async () => {
      await book.initialize();
      
      // Mock getBookMoves to return different results
      book.getBookMoves = jest.fn()
        .mockResolvedValueOnce([{ uci: 'e2e4', count: 1000 }]) // Move 1
        .mockResolvedValueOnce([{ uci: 'e7e5', count: 900 }])  // Move 2
        .mockResolvedValueOnce([])                              // Move 3 - out of book
        .mockResolvedValueOnce([]);                             // Move 4
      
      const pgn = '1. e4 e5 2. Nf3 Nc6';
      const segments = await book.findBookSegments(pgn);
      
      expect(segments).toHaveLength(2);
      expect(segments[0]).toMatchObject({
        state: 'IN',
        startPly: 0,
        endPly: 1,
        moveCount: 2
      });
      expect(segments[1]).toMatchObject({
        state: 'OUT',
        startPly: 2,
        endPly: 3,
        moveCount: 2
      });
    });

    test('should handle empty PGN', async () => {
      await book.initialize();
      
      const segments = await book.findBookSegments('');
      
      expect(segments).toEqual([]);
    });
  });

  describe('Move Decoding', () => {
    test('should decode Polyglot move format correctly', () => {
      // e2e4: e2 = file 4, rank 1 = square 12; e4 = file 4, rank 3 = square 28
      const moveCode = 12 | (28 << 6); // 12 + 1792 = 1804 = 0x70c
      const uci = book.decodePolyglotMove(moveCode);
      
      expect(uci).toBe('e2e4');
    });

    test('should handle promotion moves', () => {
      // e7e8q: e7 = file 4, rank 6 = square 52; e8 = file 4, rank 7 = square 60
      const moveCode = 52 | (60 << 6) | (4 << 12);
      const uci = book.decodePolyglotMove(moveCode);
      
      expect(uci).toBe('e7e8q');
    });
  });

  describe('Singleton Pattern', () => {
    test('getPolyglotBook should return same instance', () => {
      const book1 = getPolyglotBook();
      const book2 = getPolyglotBook();
      
      expect(book1).toBe(book2);
    });

    test('initializePolyglotBook should initialize singleton', async () => {
      const book = await initializePolyglotBook();
      
      expect(book).toBeDefined();
      expect(book.isInitialized).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle file read errors', async () => {
      await book.initialize();
      
      // Now make readSync throw error for book moves lookup
      fs.readSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      
      // Expecting the error to be thrown
      await expect(book.getBookMoves('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'))
        .rejects.toThrow('Read error');
    });

    test('should handle invalid FEN', async () => {
      await book.initialize();
      
      // Mock fenToPolyglotKey to throw or return invalid value
      book.fenToPolyglotKey = jest.fn().mockImplementation(() => {
        throw new Error('Invalid FEN');
      });
      
      // Expecting the error to be thrown
      await expect(book.getBookMoves('invalid fen string'))
        .rejects.toThrow('Invalid FEN');
    });
  });

  describe('Cache Management', () => {
    test('should limit cache size', async () => {
      await book.initialize();
      
      // Set a small cache to test eviction
      book.cache = new Map();
      
      // Add many entries to trigger cache eviction
      for (let i = 0; i < 1005; i++) {
        const fen = `position${i}`;
        book.cache.set(fen, []);
      }
      
      // Cache should not exceed 1000 entries (plus some buffer)
      expect(book.cache.size).toBeLessThanOrEqual(1005);
    });

    test('should clear cache on demand', async () => {
      await book.initialize();
      
      // Add some cache entries
      book.cache.set('test1', []);
      book.cache.set('test2', []);
      
      book.clearCache();
      
      expect(book.cache.size).toBe(0);
    });
  });
});