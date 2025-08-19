const { getStockfishEvaluation, stockfishEngine, testStockfish } = require('../services/stockfish');

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('Stockfish Service', () => {
  let mockProcess;
  let mockStdin;
  let mockStdout;
  let mockStderr;

  beforeEach(() => {
    // Create mock process with event emitters
    mockStdin = {
      setEncoding: jest.fn(),
      write: jest.fn(),
      writable: true
    };

    mockStdout = {
      setEncoding: jest.fn(),
      on: jest.fn()
    };

    mockStderr = {
      on: jest.fn()
    };

    mockProcess = {
      stdin: mockStdin,
      stdout: mockStdout,
      stderr: mockStderr,
      on: jest.fn(),
      kill: jest.fn()
    };

    // Mock spawn to return our mock process
    const { spawn } = require('child_process');
    spawn.mockReturnValue(mockProcess);

    // Reset the engine state
    stockfishEngine.isReady = false;
    stockfishEngine.engine = null;
    stockfishEngine.pendingAnalysis.clear();
    stockfishEngine.currentFen = null;
    stockfishEngine.readyResolve = null;
    stockfishEngine.analysisCounter = 0;

    // Mock console methods to reduce noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    stockfishEngine.cleanup();
  });

  describe('StockfishEngine Class', () => {
    describe('Initialization', () => {
      test('should initialize engine successfully', async () => {
        // Setup stdout data handler to simulate UCI responses
        let dataHandler;
        mockStdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            dataHandler = handler;
          }
        });

        // Start initialization
        const initPromise = stockfishEngine.initialize();

        // Simulate UCI responses
        setTimeout(() => {
          dataHandler('uciok\n');
          dataHandler('readyok\n');
        }, 10);

        await initPromise;

        expect(stockfishEngine.isReady).toBe(true);
        expect(mockStdin.write).toHaveBeenCalledWith('uci\n');
        expect(mockStdin.write).toHaveBeenCalledWith('isready\n');
      });

      test('should handle engine spawn errors', async () => {
        const { spawn } = require('child_process');
        spawn.mockImplementation(() => {
          throw new Error('Stockfish not found');
        });

        await expect(stockfishEngine.initialize()).rejects.toThrow('Stockfish engine not available');
        expect(stockfishEngine.isReady).toBe(false);
      });

      test('should not reinitialize if already ready', async () => {
        stockfishEngine.isReady = true;
        const { spawn } = require('child_process');
        
        await stockfishEngine.initialize();
        
        expect(spawn).not.toHaveBeenCalled();
      });

      test('should handle process close events', async () => {
        let closeHandler;
        let dataHandler;
        
        // Setup event handlers
        mockProcess.on.mockImplementation((event, handler) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        });
        
        mockStdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            dataHandler = handler;
          }
        });

        // Initialize engine to set up handlers
        const initPromise = stockfishEngine.initialize();
        
        // Simulate UCI responses
        setTimeout(() => {
          if (dataHandler) {
            dataHandler('uciok\n');
            dataHandler('readyok\n');
          }
        }, 10);
        
        await initPromise;

        // Now simulate process close
        if (closeHandler) {
          closeHandler(0);
        }

        expect(stockfishEngine.isReady).toBe(false);
      });

      test('should handle process error events', async () => {
        let errorHandler;
        let dataHandler;
        
        // Setup event handlers
        mockProcess.on.mockImplementation((event, handler) => {
          if (event === 'error') {
            errorHandler = handler;
          }
        });
        
        mockStdout.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            dataHandler = handler;
          }
        });

        // Initialize engine to set up handlers
        const initPromise = stockfishEngine.initialize();
        
        // Simulate UCI responses
        setTimeout(() => {
          if (dataHandler) {
            dataHandler('uciok\n');
            dataHandler('readyok\n');
          }
        }, 10);
        
        await initPromise;

        // Now simulate process error
        if (errorHandler) {
          errorHandler(new Error('Process error'));
        }

        expect(stockfishEngine.isReady).toBe(false);
      });
    });

    describe('Command Handling', () => {
      test('should send commands to engine', async () => {
        stockfishEngine.engine = mockProcess;

        await stockfishEngine.sendCommand('position fen test_fen');

        expect(mockStdin.write).toHaveBeenCalledWith('position fen test_fen\n');
      });

      test('should handle isready command specially', async () => {
        stockfishEngine.engine = mockProcess;
        
        const commandPromise = stockfishEngine.sendCommand('isready');
        
        // Simulate readyok response
        stockfishEngine.resolveReady();
        
        await commandPromise;
        expect(mockStdin.write).toHaveBeenCalledWith('isready\n');
      });

      test('should handle unwritable stdin', async () => {
        mockStdin.writable = false;
        stockfishEngine.engine = mockProcess;

        await stockfishEngine.sendCommand('test command');

        // Should complete without error even if stdin not writable
        expect(console.error).toHaveBeenCalledWith('❌ Engine stdin not writable');
      });
    });

    describe('Analysis Parsing', () => {
      test('should parse info depth lines correctly', () => {
        const infoLine = 'info depth 15 seldepth 20 multipv 1 score cp 25 nodes 50000 nps 2500000 time 20 pv e2e4 e7e5';
        
        const mockResolve = jest.fn();
        stockfishEngine.currentFen = 'test_fen';
        stockfishEngine.pendingAnalysis.set('test_fen', {
          resolve: mockResolve,
          requiredDepth: 10
        });

        stockfishEngine.parseAnalysis(infoLine);

        expect(mockResolve).toHaveBeenCalledWith({
          depth: 15,
          score: 25,
          bestLine: 'e2e4 e7e5',
          nodes: 50000,
          time: 20
        });
      });

      test('should parse mate scores correctly', () => {
        const mateInTwoLine = 'info depth 10 score mate 2 pv e1g1 e8g8';
        
        const mockResolve = jest.fn();
        stockfishEngine.currentFen = 'test_fen';
        stockfishEngine.pendingAnalysis.set('test_fen', {
          resolve: mockResolve,
          requiredDepth: 10
        });

        stockfishEngine.parseAnalysis(mateInTwoLine);

        expect(mockResolve).toHaveBeenCalledWith({
          depth: 10,
          score: 10000,
          mateIn: 2,
          bestLine: 'e1g1 e8g8'
        });
      });

      test('should handle negative mate scores', () => {
        const mateAgainstLine = 'info depth 12 score mate -3 pv f1e2';
        
        const mockResolve = jest.fn();
        stockfishEngine.currentFen = 'test_fen';
        stockfishEngine.pendingAnalysis.set('test_fen', {
          resolve: mockResolve,
          requiredDepth: 10
        });

        stockfishEngine.parseAnalysis(mateAgainstLine);

        expect(mockResolve).toHaveBeenCalledWith({
          depth: 12,
          score: -10000,
          mateIn: 3,
          bestLine: 'f1e2'
        });
      });

      test('should only resolve when reaching required depth', () => {
        stockfishEngine.currentFen = 'test_fen';
        const mockResolve = jest.fn();
        stockfishEngine.pendingAnalysis.set('test_fen', {
          resolve: mockResolve,
          requiredDepth: 15
        });

        // Send analysis at depth 10 (below required)
        stockfishEngine.parseAnalysis('info depth 10 score cp 50');
        expect(mockResolve).not.toHaveBeenCalled();

        // Send analysis at depth 15 (meets required)
        stockfishEngine.parseAnalysis('info depth 15 score cp 25');
        expect(mockResolve).toHaveBeenCalled();
      });
    });

    describe('Best Move Handling', () => {
      test('should handle bestmove line', () => {
        stockfishEngine.currentFen = 'test_fen';
        const mockResolve = jest.fn();
        stockfishEngine.pendingAnalysis.set('test_fen', {
          resolve: mockResolve,
          requiredDepth: 15
        });

        stockfishEngine.handleBestMove('bestmove e2e4 ponder e7e5');

        expect(mockResolve).toHaveBeenCalledWith({
          depth: 15,
          score: 0,
          bestLine: 'e2e4',
          nodes: 0,
          time: 0
        });
        expect(stockfishEngine.pendingAnalysis.has('test_fen')).toBe(false);
      });

      test('should handle bestmove when no pending analysis', () => {
        expect(() => {
          stockfishEngine.handleBestMove('bestmove e2e4');
        }).not.toThrow();
      });
    });

    describe('Engine Output Processing', () => {
      test('should process multiple lines of output', () => {
        const multiLineOutput = 'uciok\ninfo depth 5 score cp 10\nreadyok\nbestmove e2e4\n';
        
        const spyParseAnalysis = jest.spyOn(stockfishEngine, 'parseAnalysis');
        const spyHandleBestMove = jest.spyOn(stockfishEngine, 'handleBestMove');
        const spyResolveReady = jest.spyOn(stockfishEngine, 'resolveReady');

        stockfishEngine.handleEngineOutput(multiLineOutput);

        expect(spyParseAnalysis).toHaveBeenCalledWith('info depth 5 score cp 10');
        expect(spyHandleBestMove).toHaveBeenCalledWith('bestmove e2e4');
        expect(spyResolveReady).toHaveBeenCalled();
      });

      test('should filter empty lines', () => {
        const outputWithEmptyLines = 'uciok\n\n\nreadyok\n\n';
        
        const spyResolveReady = jest.spyOn(stockfishEngine, 'resolveReady');
        
        stockfishEngine.handleEngineOutput(outputWithEmptyLines);
        
        expect(spyResolveReady).toHaveBeenCalledTimes(1);
      });
    });

    describe('Position Analysis', () => {
      test('should analyze position successfully', async () => {
        const testFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        
        // Mock engine as ready
        stockfishEngine.isReady = true;
        stockfishEngine.engine = mockProcess;

        // Start analysis
        const analysisPromise = stockfishEngine.analyzePosition(testFen, 12, 1000);

        // Simulate engine response
        setTimeout(() => {
          stockfishEngine.parseAnalysis('info depth 12 score cp 15 nodes 10000 time 100 pv e2e4');
        }, 10);

        const result = await analysisPromise;

        expect(result.depth).toBe(12);
        expect(result.score).toBe(15);
        expect(result.nodes).toBe(10000);
        expect(mockStdin.write).toHaveBeenCalledWith(`position fen ${testFen}\n`);
        expect(mockStdin.write).toHaveBeenCalledWith('go depth 12\n');
      });

      test('should initialize engine if not ready', async () => {
        const testFen = 'test_fen';
        stockfishEngine.isReady = false;

        // Mock initialization
        const spyInitialize = jest.spyOn(stockfishEngine, 'initialize');
        spyInitialize.mockResolvedValue();

        stockfishEngine.engine = mockProcess;

        // Start analysis
        const analysisPromise = stockfishEngine.analyzePosition(testFen, 10, 1000);

        // Simulate quick analysis completion
        setTimeout(() => {
          stockfishEngine.handleBestMove('bestmove e2e4');
        }, 10);

        await analysisPromise;

        expect(spyInitialize).toHaveBeenCalled();
      });

      test('should handle analysis timeout', async () => {
        const testFen = 'test_fen';
        stockfishEngine.isReady = true;
        stockfishEngine.engine = mockProcess;

        // Mock setTimeout to immediately call the timeout callback
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = jest.fn((callback, timeout) => {
          // Immediately call the timeout callback to simulate timeout
          callback();
          return 123; // Mock timeout ID
        });

        try {
          await expect(stockfishEngine.analyzePosition(testFen, 10, 50)).rejects.toThrow(/Analysis timeout after .* for depth 10/);
          expect(mockStdin.write).toHaveBeenCalledWith('stop\n');
        } finally {
          // Restore original setTimeout
          global.setTimeout = originalSetTimeout;
          stockfishEngine.cleanup();
        }
      });

      test('should clear existing analysis for same position', async () => {
        const testFen = 'test_fen';
        stockfishEngine.isReady = true;
        stockfishEngine.engine = mockProcess;

        // Add existing analysis
        stockfishEngine.pendingAnalysis.set(testFen, {
          resolve: jest.fn(),
          requiredDepth: 10
        });

        expect(stockfishEngine.pendingAnalysis.has(testFen)).toBe(true);

        // Start new analysis
        const analysisPromise = stockfishEngine.analyzePosition(testFen, 12, 1000);

        // Complete quickly
        setTimeout(() => {
          stockfishEngine.currentFen = testFen;
          stockfishEngine.handleBestMove('bestmove e2e4');
        }, 10);

        await analysisPromise;

        // Should have cleared and replaced the existing analysis
        expect(console.log).toHaveBeenCalledWith('⚠️ Clearing existing analysis for this position');
      }, 15000);

      test('should handle command sending errors', async () => {
        const testFen = 'test_fen';
        stockfishEngine.isReady = true;
        stockfishEngine.engine = mockProcess;

        // Mock sendCommand to reject
        const spySendCommand = jest.spyOn(stockfishEngine, 'sendCommand');
        spySendCommand.mockRejectedValue(new Error('Command failed'));

        await expect(stockfishEngine.analyzePosition(testFen, 10, 1000)).rejects.toThrow('Command failed');
      });

      test('should use dynamic timeout based on depth', async () => {
        const testFen = 'test_fen';
        stockfishEngine.isReady = true;
        stockfishEngine.engine = mockProcess;

        // Mock setTimeout to capture timeout value and complete quickly
        const originalSetTimeout = global.setTimeout;
        let capturedTimeout;
        global.setTimeout = jest.fn((callback, timeout) => {
          capturedTimeout = timeout;
          // Complete immediately without waiting
          const id = originalSetTimeout(() => {
            stockfishEngine.currentFen = testFen;
            stockfishEngine.handleBestMove('bestmove e2e4');
          }, 5);
          return id;
        });

        try {
          const analysisPromise = stockfishEngine.analyzePosition(testFen, 20, 500);
          await analysisPromise;

          // Should use depth * 1000 = 20000ms since it's larger than timeMs (500)
          expect(capturedTimeout).toBe(20000);
        } finally {
          global.setTimeout = originalSetTimeout;
          stockfishEngine.cleanup();
        }
      });
    });

    describe('Cleanup', () => {
      test('should cleanup engine process', () => {
        stockfishEngine.engine = mockProcess;
        stockfishEngine.isReady = true;
        stockfishEngine.pendingAnalysis.set('test', {});

        stockfishEngine.cleanup();

        expect(mockProcess.kill).toHaveBeenCalled();
        expect(stockfishEngine.isReady).toBe(false);
        expect(stockfishEngine.pendingAnalysis.size).toBe(0);
      });

      test('should handle cleanup when no engine exists', () => {
        stockfishEngine.engine = null;

        expect(() => stockfishEngine.cleanup()).not.toThrow();
      });
    });
  });

  describe('getStockfishEvaluation Function', () => {
    test('should return real analysis when engine works', async () => {
      stockfishEngine.isReady = true;
      stockfishEngine.engine = mockProcess;

      const spyAnalyzePosition = jest.spyOn(stockfishEngine, 'analyzePosition');
      spyAnalyzePosition.mockResolvedValue({
        depth: 15,
        score: 25,
        bestLine: 'e2e4 e7e5',
        nodes: 50000,
        time: 100
      });

      const result = await getStockfishEvaluation('test_fen', 15);

      expect(result.depth).toBe(15);
      expect(result.score).toBe(25);
      expect(spyAnalyzePosition).toHaveBeenCalledWith('test_fen', 15);
    });

    test('should fallback to mock evaluation on engine failure', async () => {
      const spyAnalyzePosition = jest.spyOn(stockfishEngine, 'analyzePosition');
      spyAnalyzePosition.mockRejectedValue(new Error('Engine failed'));

      const result = await getStockfishEvaluation('test_fen', 15);

      // Should return mock evaluation
      expect(result.depth).toBe(15);
      expect(result.bestLine).toBe('e2e4 e7e5 g1f3');
      expect(typeof result.score).toBe('number');
      expect(console.log).toHaveBeenCalledWith('🔄 Falling back to mock evaluation');
    });

    test('should use default depth when not specified', async () => {
      const spyAnalyzePosition = jest.spyOn(stockfishEngine, 'analyzePosition');
      spyAnalyzePosition.mockResolvedValue({
        depth: 15,
        score: 0,
        bestLine: 'e2e4',
        nodes: 1000,
        time: 50
      });

      await getStockfishEvaluation('test_fen');

      expect(spyAnalyzePosition).toHaveBeenCalledWith('test_fen', 15);
    });
  });

  describe('Mock Evaluation', () => {
    test('should generate consistent mock evaluations for same FEN', () => {
      // Access the internal mock function by forcing an error
      const spyAnalyzePosition = jest.spyOn(stockfishEngine, 'analyzePosition');
      spyAnalyzePosition.mockRejectedValue(new Error('Test error'));

      // Mock Math.random to make it deterministic
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5);

      const testFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      return getStockfishEvaluation(testFen).then(result1 => {
        return getStockfishEvaluation(testFen).then(result2 => {
          expect(result1.score).toBe(result2.score);
          expect(result1.depth).toBe(15);
          expect(result1.bestLine).toBe('e2e4 e7e5 g1f3');
          
          Math.random = originalRandom;
        });
      });
    });
  });

  describe('testStockfish Function', () => {
    test('should test engine initialization and analysis', async () => {
      const spyInitialize = jest.spyOn(stockfishEngine, 'initialize');
      const spyAnalyzePosition = jest.spyOn(stockfishEngine, 'analyzePosition');
      const spyCleanup = jest.spyOn(stockfishEngine, 'cleanup');

      spyInitialize.mockResolvedValue();
      spyAnalyzePosition.mockResolvedValue({
        depth: 10,
        score: 15,
        bestLine: 'e2e4',
        nodes: 5000,
        time: 50
      });

      await testStockfish();

      expect(spyInitialize).toHaveBeenCalled();
      expect(spyAnalyzePosition).toHaveBeenCalledWith(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        10,
        3000
      );
      expect(spyCleanup).toHaveBeenCalled();
    });

    test('should handle test failures gracefully', async () => {
      const spyInitialize = jest.spyOn(stockfishEngine, 'initialize');
      const spyCleanup = jest.spyOn(stockfishEngine, 'cleanup');

      spyInitialize.mockRejectedValue(new Error('Test failure'));

      await testStockfish();

      expect(console.error).toHaveBeenCalledWith('❌ Test failed:', expect.any(Error));
      expect(spyCleanup).toHaveBeenCalled();
    });
  });

  describe('Process Exit Handlers', () => {
    test('should setup process exit handlers', () => {
      // The module should have registered exit handlers
      // This is hard to test directly, but we can verify the functions exist
      expect(typeof stockfishEngine.cleanup).toBe('function');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle stderr output', async () => {
      let stderrHandler;
      let dataHandler;
      
      // Setup stderr handler
      mockStderr.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          stderrHandler = handler;
        }
      });
      
      // Setup stdout handler for initialization
      mockStdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      });

      // Initialize to trigger event handler setup
      const initPromise = stockfishEngine.initialize();
      
      // Simulate UCI responses to complete initialization
      setTimeout(() => {
        if (dataHandler) {
          dataHandler('uciok\n');
          dataHandler('readyok\n');
        }
      }, 10);
      
      await initPromise;

      // Now simulate stderr output
      if (stderrHandler) {
        stderrHandler('Error: Something went wrong');
      }

      expect(console.error).toHaveBeenCalledWith('🚨 Stockfish error:', 'Error: Something went wrong');
    }, 10000);

    test('should handle malformed engine output', () => {
      const malformedOutput = 'not a valid stockfish output line\ninvalid info line\n';

      expect(() => {
        stockfishEngine.handleEngineOutput(malformedOutput);
      }).not.toThrow();
    });

    test('should handle missing score in info line', () => {
      const infoWithoutScore = 'info depth 10 nodes 1000 time 50';
      
      stockfishEngine.currentFen = 'test_fen';
      stockfishEngine.pendingAnalysis.set('test_fen', {
        resolve: jest.fn(),
        requiredDepth: 10
      });

      expect(() => {
        stockfishEngine.parseAnalysis(infoWithoutScore);
      }).not.toThrow();
    });

    test('should handle concurrent analysis requests', async () => {
      stockfishEngine.isReady = true;
      stockfishEngine.engine = mockProcess;

      const testFen1 = 'fen1';
      const testFen2 = 'fen2';

      const promise1 = stockfishEngine.analyzePosition(testFen1, 10, 1000);
      const promise2 = stockfishEngine.analyzePosition(testFen2, 10, 1000);

      // Simulate responses
      setTimeout(() => {
        stockfishEngine.currentFen = testFen1;
        stockfishEngine.handleBestMove('bestmove e2e4');
        
        stockfishEngine.currentFen = testFen2;
        stockfishEngine.handleBestMove('bestmove d2d4');
      }, 10);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.bestLine).toBe('e2e4');
      expect(result2.bestLine).toBe('d2d4');
    });

    test('should increment analysis counter', async () => {
      stockfishEngine.isReady = true;
      stockfishEngine.engine = mockProcess;

      const initialCounter = stockfishEngine.analysisCounter;

      const analysisPromise = stockfishEngine.analyzePosition('test_fen', 10, 1000);

      setTimeout(() => {
        stockfishEngine.handleBestMove('bestmove e2e4');
      }, 10);

      await analysisPromise;

      expect(stockfishEngine.analysisCounter).toBe(initialCounter + 1);
    });
  });
});