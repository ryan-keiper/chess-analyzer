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

// Mock HTTPS module for Lichess API calls
jest.mock('https', () => ({
  get: jest.fn()
}));

describe('ECOClassifier', () => {
  let classifier;
  let mockSupabase;
  let mockHttps;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset modules to get fresh instances
    jest.resetModules();
    
    const { supabase } = require('../services/supabase');
    mockSupabase = supabase;
    
    const https = require('https');
    mockHttps = https;
    
    classifier = new ECOClassifier();
  });

  describe('Initialization', () => {
    test('should initialize with empty caches and loaded state false', () => {
      expect(classifier.positionCache).toBeInstanceOf(Map);
      expect(classifier.bookDepthCache).toBeInstanceOf(Map);
      expect(classifier.isLoaded).toBe(false);
      expect(classifier.positionCache.size).toBe(0);
      expect(classifier.bookDepthCache.size).toBe(0);
    });

    test('should load database successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          count: 'exact',
          head: true,
          then: jest.fn((callback) => callback({ count: 3541, error: null }))
        }))
      });

      await classifier.loadDatabase();
      
      expect(classifier.isLoaded).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('chess_openings');
    });

    test('should handle database connection failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          count: 'exact',
          head: true,
          then: jest.fn((callback) => callback({ count: null, error: { message: 'Connection failed' } }))
        }))
      });

      await expect(classifier.loadDatabase()).rejects.toThrow('Database connection failed');
      expect(classifier.isLoaded).toBe(false);
    });

    test('should not reload if already loaded', async () => {
      classifier.isLoaded = true;
      const spy = jest.spyOn(mockSupabase, 'from');
      
      await classifier.loadDatabase();
      
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('FEN to EPD Conversion', () => {
    test('should convert FEN to EPD correctly', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const expectedEPD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
      
      expect(classifier.fenToEpd(fen)).toBe(expectedEPD);
    });

    test('should handle FEN with en passant target', () => {
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
      const expectedEPD = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6';
      
      expect(classifier.fenToEpd(fen)).toBe(expectedEPD);
    });

    test('should handle malformed FEN', () => {
      expect(() => classifier.fenToEpd('invalid')).not.toThrow();
      expect(() => classifier.fenToEpd('')).not.toThrow();
    });
  });

  describe('Database Classification', () => {
    test('should classify opening from database', async () => {
      const mockOpening = {
        eco: 'C60',
        name: 'Ruy Lopez',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
        uci: 'e2e4 e7e5 g1f3 b8c6 f1b5'
      };

      const mockQuery = {
        select: jest.fn(() => mockQuery),
        eq: jest.fn(() => mockQuery),
        single: jest.fn(() => ({ data: mockOpening, error: null }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);
      classifier.isLoaded = true;

      const moveArray = [
        { san: 'e4', color: 'w' },
        { san: 'e5', color: 'b' },
        { san: 'Nf3', color: 'w' },
        { san: 'Nc6', color: 'b' },
        { san: 'Bb5', color: 'w' }
      ];

      const result = await classifier.classifyFromDatabase(moveArray);

      expect(result).toBeDefined();
      expect(result.eco).toBe('C60');
      expect(result.name).toBe('Ruy Lopez');
      expect(result.lastBookMove).toBeGreaterThan(0);
      expect(result.source).toBe('database');
    });

    test('should handle no opening found in database', async () => {
      const mockQuery = {
        select: jest.fn(() => mockQuery),
        eq: jest.fn(() => mockQuery),
        single: jest.fn(() => ({ data: null, error: { message: 'No rows found' } }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);
      classifier.isLoaded = true;

      const moveArray = [{ san: 'h4', color: 'w' }]; // Unusual opening

      const result = await classifier.classifyFromDatabase(moveArray);

      expect(result).toBeNull();
    });

    test('should use cache for repeated position lookups', async () => {
      const mockOpening = {
        eco: 'C60',
        name: 'Ruy Lopez',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
        uci: 'e2e4 e7e5 g1f3 b8c6 f1b5'
      };

      // First call - should hit database
      const mockQuery = {
        select: jest.fn(() => mockQuery),
        eq: jest.fn(() => mockQuery),
        single: jest.fn(() => ({ data: mockOpening, error: null }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);
      classifier.isLoaded = true;

      const moveArray = [{ san: 'e4', color: 'w' }];
      
      await classifier.classifyFromDatabase(moveArray);
      expect(mockQuery.single).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      await classifier.classifyFromDatabase(moveArray);
      expect(mockQuery.single).toHaveBeenCalledTimes(1); // No additional calls
      expect(classifier.positionCache.size).toBeGreaterThan(0);
    });
  });

  describe('Lichess Book Verification', () => {
    test('should verify book depth with Lichess successfully', async () => {
      const mockLichessResponse = {
        moves: [
          { san: 'Nc6', white: 5000, draws: 1000, black: 4000 },
          { san: 'Nf6', white: 3000, draws: 500, black: 2500 }
        ]
      };

      // Mock HTTPS request
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn()
      };

      const mockResponse = {
        on: jest.fn()
      };

      mockHttps.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        
        // Simulate data event
        setTimeout(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')[1];
          dataCallback(JSON.stringify(mockLichessResponse));
          
          // Simulate end event
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')[1];
          endCallback();
        }, 0);
        
        return mockRequest;
      });

      const result = await classifier.checkLichessBook('test_fen');

      expect(result.inBook).toBe(true);
      expect(result.popularity).toBe(10500); // Sum of all games
      expect(result.topMove).toBe('Nc6');
    });

    test('should handle Lichess API timeout', async () => {
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn((timeout, callback) => {
          setTimeout(callback, 0); // Immediate timeout
        }),
        destroy: jest.fn()
      };

      mockHttps.get.mockImplementation(() => {
        return mockRequest;
      });

      const result = await classifier.checkLichessBook('test_fen');

      expect(result.inBook).toBe(false);
      expect(result.popularity).toBe(0);
      expect(result.topMove).toBeNull();
    });

    test('should implement rate limiting for Lichess calls', async () => {
      const startTime = Date.now();
      classifier.lastApiCall = startTime;
      classifier.API_DELAY_MS = 100;

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn()
      };

      const mockResponse = {
        on: jest.fn()
      };

      mockHttps.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        
        setTimeout(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')[1];
          dataCallback(JSON.stringify({ moves: [] }));
          
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')[1];
          endCallback();
        }, 0);
        
        return mockRequest;
      });

      await classifier.checkLichessBook('test_fen');
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeGreaterThanOrEqual(100); // Should have waited at least 100ms
    });

    test('should cache Lichess results', async () => {
      const mockLichessResponse = { moves: [{ san: 'e5', white: 1000, draws: 100, black: 900 }] };

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn()
      };

      const mockResponse = {
        on: jest.fn()
      };

      mockHttps.get.mockImplementation((url, callback) => {
        callback(mockResponse);
        
        setTimeout(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')[1];
          dataCallback(JSON.stringify(mockLichessResponse));
          
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')[1];
          endCallback();
        }, 0);
        
        return mockRequest;
      });

      const fen = 'test_fen';
      
      // First call
      await classifier.checkLichessBook(fen);
      expect(mockHttps.get).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      const result = await classifier.checkLichessBook(fen);
      expect(mockHttps.get).toHaveBeenCalledTimes(1); // No additional HTTP calls
      expect(result.inBook).toBe(true);
      expect(classifier.bookDepthCache.size).toBe(1);
    });
  });

  describe('Main Classification Function', () => {
    test('should return default classification when not loaded', async () => {
      classifier.isLoaded = false;
      
      const result = await classifier.classify(['e4', 'e5']);
      
      expect(result.name).toBe('Unknown Opening');
      expect(result.eco).toBeNull();
      expect(result.source).toBe('default');
    });

    test('should handle string PGN input', async () => {
      classifier.isLoaded = true;
      
      const spy = jest.spyOn(classifier, 'classifyFromDatabase');
      spy.mockResolvedValue({
        eco: 'B00',
        name: 'King\'s Pawn Opening',
        pgn: '1. e4',
        uci: 'e2e4',
        lastBookMove: 1,
        totalMoves: 1,
        source: 'database'
      });

      const spyLichess = jest.spyOn(classifier, 'verifyBookDepthWithLichess');
      spyLichess.mockResolvedValue({
        actualLastMove: 1,
        source: 'database',
        lichessCallsUsed: 0
      });

      const pgn = '[Event "Test"]\n\n1. e4 *';
      const result = await classifier.classify(pgn);

      expect(result.eco).toBe('B00');
      expect(result.name).toBe('King\'s Pawn Opening');
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
      spyLichess.mockRestore();
    });

    test('should combine database and Lichess results', async () => {
      classifier.isLoaded = true;
      
      const databaseResult = {
        eco: 'C60',
        name: 'Ruy Lopez',
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
        uci: 'e2e4 e7e5 g1f3 b8c6 f1b5',
        lastBookMove: 3,
        totalMoves: 5,
        source: 'database'
      };

      const lichessResult = {
        actualLastMove: 5,
        source: 'database + lichess',
        lichessCallsUsed: 2
      };

      const spy1 = jest.spyOn(classifier, 'classifyFromDatabase');
      spy1.mockResolvedValue(databaseResult);

      const spy2 = jest.spyOn(classifier, 'verifyBookDepthWithLichess');
      spy2.mockResolvedValue(lichessResult);

      const moveArray = [
        { san: 'e4' }, { san: 'e5' }, { san: 'Nf3' }, 
        { san: 'Nc6' }, { san: 'Bb5' }
      ];

      const result = await classifier.classify(moveArray);

      expect(result.eco).toBe('C60');
      expect(result.lastBookMove).toBe(5); // Extended by Lichess
      expect(result.bookDepthSource).toBe('database + lichess');
      expect(result.bookExtended).toBe(true);

      spy1.mockRestore();
      spy2.mockRestore();
    });

    test('should handle empty move array', async () => {
      classifier.isLoaded = true;
      
      const result = await classifier.classify([]);
      
      expect(result.name).toBe('Unknown Opening');
      expect(result.eco).toBeNull();
    });
  });

  describe('Search and Statistics', () => {
    test('should search openings by name', async () => {
      const mockOpenings = [
        { eco: 'C60', name: 'Ruy Lopez', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5' },
        { eco: 'C61', name: 'Ruy Lopez: Bird\'s Defense', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nd4' }
      ];

      const mockQuery = {
        select: jest.fn(() => mockQuery),
        or: jest.fn(() => mockQuery),
        limit: jest.fn(() => ({ data: mockOpenings, error: null }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const results = await classifier.search('Ruy Lopez');

      expect(results).toEqual(mockOpenings);
      expect(mockSupabase.from).toHaveBeenCalledWith('chess_openings');
      expect(mockQuery.or).toHaveBeenCalledWith('name.ilike.%Ruy Lopez%,eco.ilike.%Ruy Lopez%');
    });

    test('should handle search errors', async () => {
      const mockQuery = {
        select: jest.fn(() => mockQuery),
        or: jest.fn(() => mockQuery),
        limit: jest.fn(() => ({ data: null, error: new Error('Search failed') }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const results = await classifier.search('test');

      expect(results).toEqual([]);
    });

    test('should get opening statistics', async () => {
      // Mock the count query
      const mockCountQuery = {
        select: jest.fn(() => ({
          count: 'exact',
          head: true,
          then: jest.fn((callback) => callback({ count: 3541, error: null }))
        }))
      };

      // Mock the volume query
      const mockVolumeQuery = {
        select: jest.fn(() => mockVolumeQuery),
        not: jest.fn(() => ({ 
          data: [
            { eco_volume: 'A' },
            { eco_volume: 'A' },
            { eco_volume: 'B' },
            { eco_volume: 'C' }
          ], 
          error: null 
        }))
      };

      mockSupabase.from
        .mockReturnValueOnce(mockCountQuery)
        .mockReturnValueOnce(mockVolumeQuery);

      const stats = await classifier.getStatistics();

      expect(stats.total).toBe(3541);
      expect(stats.byCategory).toEqual({ A: 2, B: 1, C: 1 });
    });

    test('should handle statistics errors', async () => {
      const mockQuery = {
        select: jest.fn(() => ({
          count: 'exact',
          head: true,
          then: jest.fn((callback) => callback({ count: null, error: new Error('Failed') }))
        }))
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const stats = await classifier.getStatistics();

      expect(stats.total).toBe(0);
      expect(stats.byCategory).toEqual({});
    });
  });

  describe('Cache Management', () => {
    test('should clear all caches', () => {
      // Add some cached data
      classifier.positionCache.set('test_epd', { eco: 'A00' });
      classifier.bookDepthCache.set('test_epd', { inBook: true });

      expect(classifier.positionCache.size).toBe(1);
      expect(classifier.bookDepthCache.size).toBe(1);

      classifier.clearCache();

      expect(classifier.positionCache.size).toBe(0);
      expect(classifier.bookDepthCache.size).toBe(0);
    });
  });

  describe('Default Classification', () => {
    test('should return proper default classification', () => {
      const defaultResult = classifier.getDefaultClassification();

      expect(defaultResult.eco).toBeNull();
      expect(defaultResult.name).toBe('Unknown Opening');
      expect(defaultResult.pgn).toBe('');
      expect(defaultResult.uci).toBe('');
      expect(defaultResult.lastBookMove).toBe(0);
      expect(defaultResult.totalMoves).toBe(0);
      expect(defaultResult.source).toBe('default');
    });
  });

  describe('Error Handling', () => {
    test('should handle classification errors gracefully', async () => {
      classifier.isLoaded = true;
      
      const spy = jest.spyOn(classifier, 'classifyFromDatabase');
      spy.mockRejectedValue(new Error('Database error'));

      const result = await classifier.classify(['e4']);

      expect(result.name).toBe('Unknown Opening');
      expect(result.source).toBe('default');

      spy.mockRestore();
    });

    test('should handle malformed move arrays', async () => {
      classifier.isLoaded = true;
      
      const spy = jest.spyOn(classifier, 'classifyFromDatabase');
      spy.mockResolvedValue(null);

      const result = await classifier.classify([null, undefined, '']);

      expect(result.name).toBe('Unknown Opening');

      spy.mockRestore();
    });
  });
});

describe('Module Exports and Singleton Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize ECO classifier singleton', async () => {
    const { supabase } = require('../services/supabase');
    
    supabase.from.mockReturnValue({
      select: jest.fn(() => ({
        count: 'exact',
        head: true,
        then: jest.fn((callback) => callback({ count: 3541, error: null }))
      }))
    });

    const classifier = await initializeECOClassifier();
    
    expect(classifier).toBeInstanceOf(ECOClassifier);
    expect(classifier.isLoaded).toBe(true);
  });

  test('should classify opening using singleton function', async () => {
    const { ecoClassifier } = require('../services/ecoClassifier');
    
    const spy = jest.spyOn(ecoClassifier, 'classify');
    spy.mockResolvedValue({
      eco: 'B00',
      name: 'King\'s Pawn Opening',
      source: 'database'
    });

    const result = await classifyOpening(['e4']);
    
    expect(spy).toHaveBeenCalledWith(['e4']);
    expect(result.eco).toBe('B00');

    spy.mockRestore();
  });

  test('should get statistics using singleton function', async () => {
    const { ecoClassifier } = require('../services/ecoClassifier');
    
    const spy = jest.spyOn(ecoClassifier, 'getStatistics');
    spy.mockResolvedValue({ total: 3541, byCategory: { A: 500 } });

    const result = await getECOStatistics();
    
    expect(spy).toHaveBeenCalled();
    expect(result.total).toBe(3541);

    spy.mockRestore();
  });

  test('should search openings using singleton function', async () => {
    const { ecoClassifier } = require('../services/ecoClassifier');
    
    const spy = jest.spyOn(ecoClassifier, 'search');
    spy.mockResolvedValue([{ eco: 'C60', name: 'Ruy Lopez' }]);

    const result = await searchOpenings('Ruy Lopez');
    
    expect(spy).toHaveBeenCalledWith('Ruy Lopez');
    expect(result).toHaveLength(1);

    spy.mockRestore();
  });
});