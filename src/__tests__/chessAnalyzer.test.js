// Set test environment variables before requiring modules
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

const {
  analyzeGame,
  getBlunderSeverity,
  calculateAccuracy,
  classifyMove,
  detectGamePhases,
  identifyCriticalMoments,
  calculateAccuracyMetrics,
  calculatePlayerAccuracy
} = require('../services/chessAnalyzer');

// Short PGN for faster testing
const shortPGN = `[Event "Quick Test"]
[White "Test White"]
[Black "Test Black"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 *`;

describe('Chess Analyzer', () => {
  test('should analyze a valid PGN game with enhanced structure', async () => {
    const result = await analyzeGame(shortPGN, 10);

    // Test main structure
    expect(result).toBeDefined();
    expect(result.gameInfo).toBeDefined();
    expect(result.positions).toBeInstanceOf(Array);
    expect(result.blunders).toBeInstanceOf(Array);
    expect(result.summary).toBeDefined();

    // Test enhanced structure
    expect(result.phases).toBeDefined();
    expect(result.criticalMoments).toBeInstanceOf(Array);
    expect(result.opening).toBeDefined();
    expect(result.strategicContext).toBeDefined();

    // Test game info
    expect(result.gameInfo.white).toBe('Test White');
    expect(result.gameInfo.black).toBe('Test Black');
    expect(result.gameInfo.opening).toBeDefined();
    expect(result.gameInfo.eco).toBeDefined();

    // Test enhanced summary
    expect(result.summary.playerAccuracy).toBeDefined();
    expect(result.summary.playerAccuracy.white).toBeGreaterThanOrEqual(0);
    expect(result.summary.playerAccuracy.black).toBeGreaterThanOrEqual(0);
    expect(result.summary.bookMoves).toBeGreaterThanOrEqual(0);
    expect(result.summary.accuracyByPhase).toBeDefined();

    // Test positions have enhanced data
    expect(result.positions.length).toBeGreaterThan(0);
    const firstPosition = result.positions[0];
    expect(firstPosition.moveNumber).toBeDefined();
    expect(firstPosition.color).toBeDefined();
    expect(firstPosition.classification).toBeDefined();
    expect(firstPosition.opening).toBeDefined();
  }, 15000); // 15 second timeout for analysis

  test('should reject invalid PGN', async () => {
    const invalidPGN = 'This is not a valid PGN';

    await expect(analyzeGame(invalidPGN)).rejects.toThrow();
  });

  test('should handle PGN with no moves', async () => {
    const emptyPGN = `[Event "Empty Game"]
[Result "*"]

*`;

    await expect(analyzeGame(emptyPGN)).rejects.toThrow('No moves found in PGN');
  });

  test('should classify blunder severity correctly', () => {
    expect(getBlunderSeverity(50)).toBe('inaccuracy');
    expect(getBlunderSeverity(150)).toBe('minor');
    expect(getBlunderSeverity(250)).toBe('major');
    expect(getBlunderSeverity(350)).toBe('critical');
  });

  test('should calculate legacy accuracy', () => {
    const mockPositions = [
      { evalChange: 10, classification: 'normal' },
      { evalChange: 25, classification: 'questionable' },
      { evalChange: 150, classification: 'mistake' },
      { evalChange: 5, classification: 'normal' }
    ];

    const accuracy = calculateAccuracy(mockPositions);
    expect(accuracy).toBeGreaterThan(0);
    expect(accuracy).toBeLessThanOrEqual(100);
  });

  test('should handle empty game', () => {
    const accuracy = calculateAccuracy([]);
    expect(accuracy).toBe(100);
  });
});

describe('Enhanced Chess Analyzer Functions', () => {
  test('should classify moves correctly', () => {
    // Test book move classification
    const bookMove = classifyMove({ evalChange: 50 }, { inBook: true });
    expect(bookMove).toBe('book');

    // Test non-book move classifications
    expect(classifyMove({ evalChange: 5 })).toBe('normal');
    expect(classifyMove({ evalChange: 25 })).toBe('normal'); // Below 50 threshold
    expect(classifyMove({ evalChange: 75 })).toBe('questionable'); // >= 50
    expect(classifyMove({ evalChange: 150 })).toBe('inaccuracy'); // >= 100
    expect(classifyMove({ evalChange: 250 })).toBe('mistake'); // >= 200
    expect(classifyMove({ evalChange: 350 })).toBe('blunder'); // >= 300
    expect(classifyMove({ evalChange: -30 })).toBe('good'); // <= -20
    expect(classifyMove({ evalChange: -75 })).toBe('excellent'); // <= -50
  });

  test('should detect game phases', () => {
    const mockPositions = [
      { moveNumber: 1, classification: 'book' },
      { moveNumber: 2, classification: 'book' },
      { moveNumber: 3, classification: 'book' },
      { moveNumber: 4, classification: 'normal' },
      { moveNumber: 15, classification: 'normal' },
      { moveNumber: 25, classification: 'normal' }
    ];

    const phases = detectGamePhases(mockPositions);

    expect(phases.opening).toBeDefined();
    expect(phases.middlegame).toBeDefined();
    expect(phases.endgame).toBeDefined();
    expect(phases.opening.end).toBe(3); // Last book move
    expect(phases.middlegame.start).toBe(4);
  });

  test('should calculate player accuracy correctly', () => {
    const mockPositions = [
      { color: 'w', evalChange: 10, classification: 'book' },
      { color: 'b', evalChange: 25, classification: 'normal' },
      { color: 'w', evalChange: 150, classification: 'mistake' },
      { color: 'b', evalChange: 5, classification: 'excellent' }
    ];

    const whiteAccuracy = calculatePlayerAccuracy(mockPositions, 'w');
    const blackAccuracy = calculatePlayerAccuracy(mockPositions, 'b');

    expect(whiteAccuracy).toBeGreaterThan(0);
    expect(whiteAccuracy).toBeLessThanOrEqual(100);
    expect(blackAccuracy).toBeGreaterThan(0);
    expect(blackAccuracy).toBeLessThanOrEqual(100);

    // Book moves should boost accuracy
    expect(whiteAccuracy).toBeGreaterThan(50); // Has one book move
  });

  test('should calculate accuracy metrics by phase', () => {
    const mockPositions = [
      { moveNumber: 1, evalChange: 5, classification: 'book' },
      { moveNumber: 2, evalChange: 10, classification: 'normal' },
      { moveNumber: 15, evalChange: 50, classification: 'questionable' },
      { moveNumber: 25, evalChange: 200, classification: 'mistake' }
    ];

    const metrics = calculateAccuracyMetrics(mockPositions);

    expect(metrics.overall).toBeGreaterThan(0);
    expect(metrics.overall).toBeLessThanOrEqual(100);
    expect(metrics.opening).toBeGreaterThan(0);
    expect(metrics.middlegame).toBeGreaterThan(0);
  });

  test('should identify critical moments', () => {
    const mockPositions = [
      { moveNumber: 1, classification: 'book', move: 'e4', evalChange: 5 },
      { moveNumber: 2, classification: 'normal', move: 'e5', evalChange: 10 },
      { moveNumber: 3, classification: 'mistake', move: 'Ke2', evalChange: 200 },
      { moveNumber: 4, classification: 'normal', move: 'Nc6', evalChange: 15 }
    ];

    const criticalMoments = identifyCriticalMoments(mockPositions);

    expect(criticalMoments).toBeInstanceOf(Array);
    // Should find the blunder but not the book move
    const blunderMoment = criticalMoments.find(m => m.type === 'blunder');
    expect(blunderMoment).toBeDefined();
    expect(blunderMoment.moveNumber).toBe(3);
  });

  test('should handle edge cases', () => {
    // Empty positions array
    expect(calculateAccuracy([])).toBe(100);
    expect(calculatePlayerAccuracy([], 'w')).toBe(100);
    expect(detectGamePhases([])).toBeDefined();
    expect(identifyCriticalMoments([])).toEqual([]);

    // Single position
    const singlePosition = [{ moveNumber: 1, evalChange: 10, classification: 'normal', color: 'w' }];
    expect(calculatePlayerAccuracy(singlePosition, 'w')).toBe(100);
    expect(detectGamePhases(singlePosition)).toBeDefined();
  });

  // Cleanup Stockfish engine after all tests to prevent hanging
  afterAll(async () => {
    const { stockfishEngine } = require('../services/stockfish');
    if (stockfishEngine) {
      stockfishEngine.cleanup();
    }
  });
});
