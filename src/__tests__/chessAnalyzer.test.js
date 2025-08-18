const { analyzeGame, getBlunderSeverity, calculateAccuracy } = require('../services/chessAnalyzer');

// Sample PGN with some blunders for testing
const samplePGN = `[Event "Test Game"]
[Site "Test"]
[Date "2024.01.01"]
[Round "1"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 
6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 
11. Rxe5 c6 12. d4 Bd6 13. Re1 Qh4 14. g3 Qh3 15. Bf4 1-0`;

describe('Chess Analyzer', () => {
  test('should analyze a valid PGN game', async () => {
    const result = await analyzeGame(samplePGN, 10);
    
    expect(result).toBeDefined();
    expect(result.gameInfo).toBeDefined();
    expect(result.positions).toBeInstanceOf(Array);
    expect(result.blunders).toBeInstanceOf(Array);
    expect(result.summary).toBeDefined();
    
    expect(result.gameInfo.white).toBe('Player1');
    expect(result.gameInfo.black).toBe('Player2');
    expect(result.gameInfo.result).toBe('1-0');
  }, 10000); // 10 second timeout for analysis

  test('should reject invalid PGN', async () => {
    const invalidPGN = 'This is not a valid PGN';
    
    await expect(analyzeGame(invalidPGN)).rejects.toThrow();
  });

  test('should classify blunder severity correctly', () => {
    expect(getBlunderSeverity(50)).toBe('inaccuracy');
    expect(getBlunderSeverity(150)).toBe('minor');
    expect(getBlunderSeverity(250)).toBe('major');
    expect(getBlunderSeverity(350)).toBe('critical');
  });

  test('should calculate accuracy', () => {
    const mockPositions = [
      { evalChange: 10 },
      { evalChange: 25 },
      { evalChange: 150 },
      { evalChange: 5 }
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
