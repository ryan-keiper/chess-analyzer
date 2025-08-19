const { 
  ECOClassifier, 
  initializeECOClassifier, 
  classifyOpening, 
  getECOStatistics, 
  searchOpenings 
} = require('../services/ecoClassifier');

// Mock chess.js
jest.mock('chess.js', () => {
  const mockGame = {
    loadPgn: jest.fn(),
    history: jest.fn(() => [
      { san: 'e4', color: 'w' },
      { san: 'e5', color: 'b' },
      { san: 'Nf3', color: 'w' }
    ]),
    fen: jest.fn(() => 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'),
    move: jest.fn(() => true),
    reset: jest.fn()
  };
  
  return {
    Chess: jest.fn(() => mockGame)
  };
});

// Mock Supabase client
jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: null }))
        })),
        ilike: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null }))
          }))
        })),
        or: jest.fn(() => ({
          limit: jest.fn(() => ({ data: [], error: null }))
        })),
        not: jest.fn(() => ({ data: [], error: null })),
        count: 'exact',
        head: true
      }))
    }))
  }
}));

describe('ECOClassifier - WikiBooks Implementation', () => {
  let classifier;
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { supabase } = require('../services/supabase');
    mockSupabase = supabase;
    
    classifier = new ECOClassifier();
  });

  describe('Initialization', () => {
    test('should initialize with empty caches and loaded state false', () => {
      expect(classifier.positionCache).toBeInstanceOf(Map);
      expect(classifier.wikibooksCache).toBeInstanceOf(Map);
      expect(classifier.chessOpeningsCache).toBeInstanceOf(Map);
      expect(classifier.isLoaded).toBe(false);
      expect(classifier.positionCache.size).toBe(0);
      expect(classifier.wikibooksCache.size).toBe(0);
      expect(classifier.chessOpeningsCache.size).toBe(0);
    });

    test('should load both WikiBooks and chess_openings databases successfully', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn(() => Promise.resolve({ count: 2000, error: null }))
        })
        .mockReturnValueOnce({
          select: jest.fn(() => Promise.resolve({ count: 3541, error: null }))
        });

      await classifier.loadDatabase();
      
      expect(classifier.isLoaded).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('wikibooks_positions');
      expect(mockSupabase.from).toHaveBeenCalledWith('chess_openings');
    });

    test('should handle WikiBooks database connection failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => Promise.resolve({ count: null, error: { message: 'Connection failed' } }))
      });

      await expect(classifier.loadDatabase()).rejects.toThrow('WikiBooks database connection failed');
      expect(classifier.isLoaded).toBe(false);
    });
  });

  describe('WikiBooks Classification', () => {
    beforeEach(() => {
      classifier.isLoaded = true;
    });

    test('should classify opening using hybrid approach (WikiBooks + chess_openings)', async () => {
      const mockWikiBooksData = {
        opening_name: 'Italian Game',
        page_title: 'Italian Game: Two Knights Defense',
        theory_text: 'The Italian Game is one of the oldest openings...',
        epd: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
      };

      const mockChessOpeningsData = {
        eco: 'C50',
        name: 'Italian Game: Hungarian Defense, General',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Be7',
        uci: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8e7'
      };

      // Mock parallel queries - WikiBooks provides depth, chess_openings provides naming
      const spy1 = jest.spyOn(classifier, 'queryWikiBooksPosition');
      spy1.mockResolvedValue(mockWikiBooksData);

      const spy2 = jest.spyOn(classifier, 'queryChessOpeningsPosition');
      spy2.mockResolvedValue(mockChessOpeningsData);

      const moveArray = [
        { san: 'e4', color: 'w' },
        { san: 'e5', color: 'b' },
        { san: 'Nf3', color: 'w' }
      ];

      const result = await classifier.classifyFromWikiBooks(moveArray);

      expect(result).toBeDefined();
      expect(result.name).toBe('Italian Game: Hungarian Defense, General'); // From chess_openings (better name)
      expect(result.eco).toBe('C50'); // From chess_openings
      expect(result.lastBookMove).toBe(2); // From WikiBooks (depth authority)
      expect(result.source).toBe('wikibooks_hybrid');
      expect(result.theory_text).toBe('The Italian Game is one of the oldest openings...'); // From WikiBooks
      expect(result.nameSource).toBe('chess_openings');
      expect(result.depthSource).toBe('wikibooks');
    });

    test('should fallback to chess_openings table when WikiBooks fails', async () => {
      const mockChessOpeningData = {
        eco: 'C60',
        name: 'Spanish Opening',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
        uci: 'e2e4 e7e5 g1f3 b8c6 f1b5',
        epd: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'
      };

      // Mock chess_openings returns data
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: mockChessOpeningData, error: null }))
          }))
        }))
      });

      const moveArray = [
        { san: 'e4', color: 'w' },
        { san: 'e5', color: 'b' },
        { san: 'Nf3', color: 'w' }
      ];

      const result = await classifier.classifyFromChessOpenings(moveArray);

      expect(result).toBeDefined();
      expect(result.eco).toBe('C60');
      expect(result.name).toBe('Spanish Opening');
      expect(result.source).toBe('chess_openings_fallback');
    });

    test('should handle no opening found in either table', async () => {
      // Both WikiBooks and chess_openings return null
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      });

      const moveArray = [{ san: 'h4', color: 'w' }]; // Unusual opening

      const wikibooksResult = await classifier.classifyFromWikiBooks(moveArray);
      const chessOpeningsResult = await classifier.classifyFromChessOpenings(moveArray);

      expect(wikibooksResult).toBeNull();
      expect(chessOpeningsResult).toBeNull();
    });
  });

  describe('Main Classification Function', () => {
    beforeEach(() => {
      classifier.isLoaded = true;
    });

    test('should use WikiBooks name when chess_openings has no match', async () => {
      const mockWikiBooksData = {
        opening_name: 'Obscure Italian Variation',
        page_title: 'Italian Game: Obscure Line',
        theory_text: 'This is a less common variation...'
      };

      // WikiBooks has data, chess_openings doesn't
      const spy1 = jest.spyOn(classifier, 'queryWikiBooksPosition');
      spy1.mockResolvedValue(mockWikiBooksData);

      const spy2 = jest.spyOn(classifier, 'queryChessOpeningsPosition');
      spy2.mockResolvedValue(null); // No chess_openings match

      const moveArray = [
        { san: 'e4', color: 'w' },
        { san: 'e5', color: 'b' },
        { san: 'Nf3', color: 'w' }
      ];

      const result = await classifier.classifyFromWikiBooks(moveArray);

      expect(result).toBeDefined();
      expect(result.name).toBe('Obscure Italian Variation'); // Falls back to WikiBooks name
      expect(result.eco).toBeNull(); // No ECO since chess_openings had no match
      expect(result.lastBookMove).toBe(2); // From WikiBooks
      expect(result.source).toBe('wikibooks_hybrid');
      expect(result.nameSource).toBe('wikibooks'); // Indicates name came from WikiBooks
      expect(result.depthSource).toBe('wikibooks');
    });

    test('should prioritize hybrid WikiBooks over pure chess_openings fallback', async () => {
      const spy1 = jest.spyOn(classifier, 'classifyFromWikiBooks');
      spy1.mockResolvedValue({
        name: 'Italian Game: Hungarian Defense, General',
        eco: 'C50',
        opening_name: 'Italian Game',
        lastBookMove: 2,
        source: 'wikibooks_hybrid'
      });

      const spy2 = jest.spyOn(classifier, 'classifyFromChessOpenings');

      const moveArray = [
        { san: 'e4', color: 'w' },
        { san: 'e5', color: 'b' },
        { san: 'Nf3', color: 'w' }
      ];

      const result = await classifier.classify(moveArray);

      expect(spy1).toHaveBeenCalled();
      expect(spy2).not.toHaveBeenCalled(); // Should not fallback since WikiBooks found result
      expect(result.name).toBe('Italian Game: Hungarian Defense, General');
      expect(result.source).toBe('wikibooks_hybrid');
    });

    test('should return default classification when both methods fail', async () => {
      const spy1 = jest.spyOn(classifier, 'classifyFromWikiBooks');
      spy1.mockResolvedValue(null);

      const spy2 = jest.spyOn(classifier, 'classifyFromChessOpenings');
      spy2.mockResolvedValue(null);

      const moveArray = [{ san: 'h4', color: 'w' }];

      const result = await classifier.classify(moveArray);

      expect(result).toBeDefined();
      expect(result.name).toBe('Unknown Opening');
      expect(result.eco).toBeNull();
      expect(result.source).toBe('default');
    });

    test('should handle string PGN input', async () => {
      const spy = jest.spyOn(classifier, 'classifyFromWikiBooks');
      spy.mockResolvedValue({
        name: 'Italian Game',
        opening_name: 'Italian Game',
        lastBookMove: 2,
        source: 'wikibooks'
      });

      const pgnString = '1. e4 e5 2. Nf3';
      const result = await classifier.classify(pgnString);

      expect(result).toBeDefined();
      expect(result.name).toBe('Italian Game');
    });
  });

  describe('Cache Management', () => {
    test('should clear all caches', () => {
      // Add some cached data
      classifier.positionCache.set('test_epd', { eco: 'A00' });
      classifier.wikibooksCache.set('test_epd', { opening_name: 'Test Opening' });
      classifier.chessOpeningsCache.set('test_epd', { eco: 'B00' });

      expect(classifier.positionCache.size).toBe(1);
      expect(classifier.wikibooksCache.size).toBe(1);
      expect(classifier.chessOpeningsCache.size).toBe(1);

      classifier.clearCache();

      expect(classifier.positionCache.size).toBe(0);
      expect(classifier.wikibooksCache.size).toBe(0);
      expect(classifier.chessOpeningsCache.size).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    test('should convert FEN to EPD correctly', () => {
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
      const expectedEpd = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -';
      
      const result = classifier.fenToEpd(fen);
      
      expect(result).toBe(expectedEpd);
    });

    test('should get default classification', () => {
      const defaultClassification = classifier.getDefaultClassification();
      
      expect(defaultClassification.eco).toBeNull();
      expect(defaultClassification.name).toBe('Unknown Opening');
      expect(defaultClassification.lastBookMove).toBe(0);
      expect(defaultClassification.source).toBe('default');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      classifier.isLoaded = true;
    });

    test('should handle classification errors gracefully', async () => {
      const spy = jest.spyOn(classifier, 'classifyFromWikiBooks');
      spy.mockRejectedValue(new Error('Database error'));

      const result = await classifier.classify(['e4']);

      expect(result).toBeDefined();
      expect(result.name).toBe('Unknown Opening');
      expect(result.source).toBe('default');
    });

    test('should handle empty move arrays', async () => {
      const result = await classifier.classify([]);

      expect(result).toBeDefined();
      expect(result.name).toBe('Unknown Opening');
      expect(result.source).toBe('default');
    });
  });
});

// Test module exports
describe('Module Exports', () => {
  test('should export all required functions', () => {
    expect(typeof initializeECOClassifier).toBe('function');
    expect(typeof classifyOpening).toBe('function');
    expect(typeof getECOStatistics).toBe('function');
    expect(typeof searchOpenings).toBe('function');
  });
});