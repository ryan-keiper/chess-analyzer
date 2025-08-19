const { WikiBooksDetector } = require('../services/wikiBooksDetector');

// Mock Supabase client to avoid real database calls in tests
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        ilike: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      }))
    }))
  }))
}));

describe('WikiBooksDetector', () => {
  let detector;
  let mockSupabase;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create detector instance
    detector = new WikiBooksDetector();
    mockSupabase = detector.supabase;
    
    // Clear cache between tests
    detector.clearCache();
  });

  describe('Constructor and Setup', () => {
    test('should initialize with Supabase client and empty cache', () => {
      expect(detector.supabase).toBeDefined();
      expect(detector.cache).toBeInstanceOf(Map);
      expect(detector.cache.size).toBe(0);
    });
  });

  describe('FEN to EPD Conversion', () => {
    test('should convert FEN to EPD correctly', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const expectedEPD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
      
      expect(detector.fenToEPD(fen)).toBe(expectedEPD);
    });

    test('should handle FEN with different move counters', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const expectedEPD = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3';
      
      expect(detector.fenToEPD(fen)).toBe(expectedEPD);
    });

    test('should handle incomplete FEN strings', () => {
      const partialFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq';
      expect(() => detector.fenToEPD(partialFEN)).not.toThrow();
    });
  });

  describe('Position in Book Detection', () => {
    test('should return true when position is in book', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true });
      
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = await detector.isPositionInBook(fen);
      
      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('is_position_in_book', {
        position_epd: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
      });
    });

    test('should return false when position is not in book', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: false });
      
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const result = await detector.isPositionInBook(fen);
      
      expect(result).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database connection failed'));
      
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = await detector.isPositionInBook(fen);
      
      expect(result).toBe(false);
    });

    test('should return false when data is null', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null });
      
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = await detector.isPositionInBook(fen);
      
      expect(result).toBe(false);
    });
  });

  describe('Caching Functionality', () => {
    test('should cache position lookup results', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true });
      
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // First call - should hit database
      await detector.isPositionInBook(fen);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      const result = await detector.isPositionInBook(fen);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1); // No additional calls
      expect(result).toBe(true);
      expect(detector.cache.size).toBe(1);
    });

    test('should clear cache when requested', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true });
      
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      await detector.isPositionInBook(fen);
      
      expect(detector.cache.size).toBe(1);
      detector.clearCache();
      expect(detector.cache.size).toBe(0);
    });

    test('should provide cache statistics', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true });
      
      const fen1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      
      await detector.isPositionInBook(fen1);
      await detector.isPositionInBook(fen2);
      
      const stats = detector.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.positions).toHaveLength(2);
    });
  });

  describe('Position Theory Retrieval', () => {
    test('should return theory data when available', async () => {
      const mockTheory = {
        opening_name: 'Ruy Lopez',
        theory_text: 'The Spanish Opening aims to control the center...',
        move_sequence: '1.e4 e5 2.Nf3 Nc6 3.Bb5',
        page_url: 'https://en.wikibooks.org/wiki/Chess_Opening_Theory/1._e4/1...e5/2._Nf3/2...Nc6/3._Bb5'
      };
      
      mockSupabase.rpc.mockResolvedValue({ data: [mockTheory] });
      
      const fen = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
      const result = await detector.getPositionTheory(fen);
      
      expect(result).toEqual(mockTheory);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_position_theory', {
        position_epd: expect.any(String)
      });
    });

    test('should return null when no theory is available', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [] });
      
      const fen = 'some_random_position';
      const result = await detector.getPositionTheory(fen);
      
      expect(result).toBeNull();
    });

    test('should handle theory retrieval errors', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: new Error('Database error') });
      
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const result = await detector.getPositionTheory(fen);
      
      expect(result).toBeNull();
    });
  });

  describe('Book End Detection', () => {
    test('should find where players leave opening theory', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 8 }); // Left book at move 8
      
      const positions = [
        { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
        { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
        { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' }
      ];
      
      const bookEnd = await detector.findBookEnd(positions);
      
      expect(bookEnd).toBe(8);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('find_book_end', {
        epd_list: expect.any(Array)
      });
    });

    test('should handle empty positions array', async () => {
      const bookEnd = await detector.findBookEnd([]);
      expect(bookEnd).toBe(0);
    });

    test('should handle null positions', async () => {
      const bookEnd = await detector.findBookEnd(null);
      expect(bookEnd).toBe(0);
    });

    test('should fallback to individual position checking on RPC error', async () => {
      // RPC call fails
      mockSupabase.rpc.mockRejectedValue(new Error('RPC failed'));
      
      // Setup individual position checks to succeed then fail
      const mockIsPositionInBook = jest.spyOn(detector, 'isPositionInBook');
      mockIsPositionInBook
        .mockResolvedValueOnce(true)  // Position 1 in book
        .mockResolvedValueOnce(true)  // Position 2 in book  
        .mockResolvedValueOnce(false); // Position 3 not in book
      
      const positions = [
        { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
        { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
        { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' }
      ];
      
      const bookEnd = await detector.findBookEnd(positions);
      
      expect(bookEnd).toBe(3); // First out-of-book position
      expect(mockIsPositionInBook).toHaveBeenCalledTimes(3);
      
      mockIsPositionInBook.mockRestore();
    });
  });

  describe('Game Analysis with Book Detection', () => {
    test('should analyze game and split into book/strategic phases', async () => {
      // Mock book end at move 3
      const mockFindBookEnd = jest.spyOn(detector, 'findBookEnd');
      mockFindBookEnd.mockResolvedValue(3);
      
      // Mock theory for book positions
      const mockGetPositionTheory = jest.spyOn(detector, 'getPositionTheory');
      mockGetPositionTheory.mockResolvedValue({
        opening_name: 'King\'s Pawn Opening',
        theory_text: 'Basic opening move controlling the center'
      });
      
      const positions = [
        { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
        { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
        { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
        { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' }
      ];
      
      const result = await detector.analyzeGameWithBookDetection(positions);
      
      expect(result.bookEndMove).toBe(3);
      expect(result.totalMoves).toBe(4);
      expect(result.bookMoves).toBe(2);
      expect(result.openingPhase).toHaveLength(2);
      expect(result.strategicPhase).toHaveLength(2);
      
      // Check opening phase properties
      expect(result.openingPhase[0].inBook).toBe(true);
      expect(result.openingPhase[0].phase).toBe('opening');
      expect(result.openingPhase[0].theory).toBeDefined();
      
      // Check strategic phase properties  
      expect(result.strategicPhase[0].inBook).toBe(false);
      expect(result.strategicPhase[0].phase).toBe('strategic');
      expect(result.strategicPhase[0].theory).toBeNull();
      
      mockFindBookEnd.mockRestore();
      mockGetPositionTheory.mockRestore();
    });

    test('should handle games that are entirely in book', async () => {
      const mockFindBookEnd = jest.spyOn(detector, 'findBookEnd');
      mockFindBookEnd.mockResolvedValue(5); // Book ends after all moves
      
      const positions = [
        { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
        { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' }
      ];
      
      const result = await detector.analyzeGameWithBookDetection(positions);
      
      expect(result.openingPhase).toHaveLength(2);
      expect(result.strategicPhase).toHaveLength(0);
      expect(result.bookMoves).toBe(4);
      
      mockFindBookEnd.mockRestore();
    });
  });

  describe('Opening Search and Statistics', () => {
    test('should search openings by name', async () => {
      const mockSearchResults = [
        {
          opening_name: 'Ruy Lopez: Marshall Attack',
          move_sequence: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5',
          theory_text: 'Aggressive counterattack by Black...',
          page_url: 'https://en.wikibooks.org/wiki/...',
          move_count: 8
        }
      ];
      
      // Mock the query chain
      const mockQuery = {
        select: jest.fn(() => mockQuery),
        ilike: jest.fn(() => mockQuery),
        eq: jest.fn(() => mockQuery),
        order: jest.fn(() => mockQuery),
        limit: jest.fn(() => ({ data: mockSearchResults, error: null }))
      };
      
      mockSupabase.from.mockReturnValue(mockQuery);
      
      const results = await detector.searchOpenings('Ruy Lopez', 5);
      
      expect(results).toEqual(mockSearchResults);
      expect(mockSupabase.from).toHaveBeenCalledWith('wikibooks_positions');
      expect(mockQuery.ilike).toHaveBeenCalledWith('opening_name', '%Ruy Lopez%');
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    test('should get opening statistics', async () => {
      const mockStats = [
        { opening_name: 'Sicilian Defense', position_count: 1250 },
        { opening_name: 'French Defense', position_count: 890 }
      ];
      
      // Mock the query chain for opening statistics
      const mockQuery = {
        select: jest.fn(() => mockQuery),
        order: jest.fn(() => mockQuery),
        limit: jest.fn(() => ({ data: mockStats, error: null }))
      };
      
      mockSupabase.from.mockReturnValue(mockQuery);
      
      const stats = await detector.getOpeningStatistics();
      
      expect(stats).toEqual(mockStats);
      expect(mockSupabase.from).toHaveBeenCalledWith('opening_statistics');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.order).toHaveBeenCalledWith('position_count', { ascending: false });
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    test('should handle search errors gracefully', async () => {
      const mockQuery = {
        select: jest.fn(() => mockQuery),
        ilike: jest.fn(() => mockQuery),
        eq: jest.fn(() => mockQuery),
        order: jest.fn(() => mockQuery),
        limit: jest.fn(() => ({ data: null, error: new Error('Search failed') }))
      };
      
      mockSupabase.from.mockReturnValue(mockQuery);
      
      const results = await detector.searchOpenings('Test Opening');
      
      expect(results).toEqual([]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed FEN strings', () => {
      expect(() => detector.fenToEPD('')).not.toThrow();
      expect(() => detector.fenToEPD('invalid')).not.toThrow();
    });

    test('should handle network timeouts gracefully', async () => {
      mockSupabase.rpc.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );
      
      const result = await detector.isPositionInBook('test_fen');
      expect(result).toBe(false);
    });
  });
});