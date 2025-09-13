const { spawn } = require('child_process');

class StockfishEngine {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.pendingAnalysis = new Map();
    this.currentFen = null;
    this.readyResolve = null;
    this.analysisCounter = 0; // Add counter to track analysis requests
    this.timeouts = new Set(); // Track active timeouts for cleanup
    this.isTestEnvironment = process.env.NODE_ENV === 'test'; // Detect test environment
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this._analysisQueue = Promise.resolve(); // Queue to serialize analysis requests
  }

  // Helper method for conditional logging
  log(...args) {
    if (this.isTestEnvironment || this.isDevelopment) {
      console.log(...args);
    }
  }

  // Helper method for conditional error logging
  logError(...args) {
    if (this.isTestEnvironment || this.isDevelopment) {
      console.error(...args);
    }
  }

  async initialize() {
    if (this.isReady) return;

    try {
      this.log('🐟 Initializing Stockfish engine...');

      // In production, this will be 'stockfish' if installed globally
      // or '/usr/bin/stockfish' in Docker
      this.engine = spawn(process.env.STOCKFISH_PATH || '/opt/homebrew/bin/stockfish');

      this.engine.stdin.setEncoding('utf8');
      this.engine.stdout.setEncoding('utf8');

      // Handle engine output
      this.engine.stdout.on('data', (data) => {
        this.log('📤 Stockfish output:', data.toString().trim());
        this.handleEngineOutput(data.toString());
      });

      this.engine.stderr.on('data', (data) => {
        this.logError('🚨 Stockfish error:', data.toString());
      });

      this.engine.on('close', (code) => {
        this.log(`🐟 Stockfish process exited with code ${code}`);
        this.isReady = false;
      });

      this.engine.on('error', (error) => {
        this.logError('🚨 Stockfish process error:', error);
        this.isReady = false;
      });

      // Initialize engine
      this.log('📥 Sending UCI command...');
      await this.sendCommand('uci');

      this.log('📥 Sending isready command...');
      await this.sendCommand('isready');

      this.isReady = true;
      this.log('✅ Stockfish engine initialized successfully');

    } catch (error) {
      this.logError('❌ Failed to initialize Stockfish:', error);
      throw new Error('Stockfish engine not available');
    }
  }

  handleEngineOutput(output) {
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      this.log(`🔍 Processing line: "${line}"`);

      if (line.startsWith('info depth')) {
        this.parseAnalysis(line);
      } else if (line === 'readyok') {
        this.log('✅ Received readyok');
        this.resolveReady();
      } else if (line === 'uciok') {
        this.log('✅ Received uciok');
      } else if (line.startsWith('bestmove')) {
        this.log('🎯 Received bestmove:', line);
        this.handleBestMove(line);
      }
    }
  }

  parseAnalysis(infoLine) {
    this.log(`📊 Parsing analysis: ${infoLine}`);

    // Parse Stockfish info line
    // Example: info depth 15 seldepth 20 multipv 1 score cp 25 nodes 50000 nps 2500000 time 20 pv e2e4 e7e5

    const parts = infoLine.split(' ');
    const analysis = {};

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part === 'depth') {
        analysis.depth = parseInt(parts[i + 1]);
      } else if (part === 'score') {
        const scoreType = parts[i + 1];
        const scoreValue = parseInt(parts[i + 2]);

        if (scoreType === 'cp') {
          analysis.score = scoreValue; // centipawns
        } else if (scoreType === 'mate') {
          analysis.score = scoreValue > 0 ? 10000 : -10000;
          analysis.mateIn = Math.abs(scoreValue);
        }
      } else if (part === 'pv') {
        analysis.bestLine = parts.slice(i + 1).join(' ');
        break;
      } else if (part === 'nodes') {
        analysis.nodes = parseInt(parts[i + 1]);
      } else if (part === 'time') {
        analysis.time = parseInt(parts[i + 1]);
      }
    }

    this.log('📈 Parsed analysis:', analysis);

    // Notify waiting analysis requests
    const fen = this.currentFen;
    if (fen && this.pendingAnalysis.has(fen)) {
      const { resolve, requiredDepth } = this.pendingAnalysis.get(fen);

      this.log(`🎯 Checking if depth ${analysis.depth} >= required ${requiredDepth}`);

      if (analysis.depth >= requiredDepth) {
        this.log(`✅ Analysis complete for depth ${analysis.depth}`);
        this.clearAnalysisTimeout(fen);
        resolve(analysis);
        this.pendingAnalysis.delete(fen);
      }
    }
  }

  handleBestMove(bestMoveLine) {
    // Handle final bestmove - this indicates analysis is complete
    const fen = this.currentFen;
    if (fen && this.pendingAnalysis.has(fen)) {
      const { resolve } = this.pendingAnalysis.get(fen);

      // Create a basic analysis if we haven't resolved yet
      const parts = bestMoveLine.split(' ');
      const bestMove = parts[1];

      const analysis = {
        depth: 15, // Default depth
        score: 0,  // Default score
        bestLine: bestMove,
        nodes: 0,
        time: 0
      };

      this.log(`🏁 Resolving with bestmove: ${bestMove}`);
      this.clearAnalysisTimeout(fen);
      resolve(analysis);
      this.pendingAnalysis.delete(fen);
    }
  }

  async sendCommand(command) {
    this.log(`📤 Sending command: "${command}"`);

    return new Promise((resolve) => {
      if (!this.engine || !this.engine.stdin.writable) {
        this.logError('❌ Engine stdin not writable');
        resolve();
        return;
      }

      this.engine.stdin.write(command + '\n');

      if (command === 'isready') {
        this.readyResolve = resolve;
      } else {
        resolve();
      }
    });
  }

  resolveReady() {
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
    }
  }

  async analyzePosition(fen, depth = 12, timeMs = 5000) { // Reduced default depth from 15 to 12, increased timeout from 1000 to 5000
    if (!this.isReady) {
      this.log('🔄 Engine not ready, initializing...');
      await this.initialize();
    }

    // Serialize analysis requests to avoid currentFen races
    this._analysisQueue = this._analysisQueue.then(() =>
      this._analyzePositionInternal(fen, depth, timeMs)
    );

    return this._analysisQueue;
  }

  async _analyzePositionInternal(fen, depth, timeMs) {
    this.analysisCounter++;
    const analysisId = this.analysisCounter;
    this.log(`🎯 Starting analysis #${analysisId} for FEN: ${fen} (depth: ${depth})`);

    return new Promise((resolve, reject) => {
      // Clear any existing analysis for this position
      if (this.pendingAnalysis.has(fen)) {
        this.log('⚠️ Clearing existing analysis for this position');
        this.pendingAnalysis.delete(fen);
      }

      // Register analysis FIRST (before timeout) to avoid race condition
      this.currentFen = fen;
      this.pendingAnalysis.set(fen, { resolve, reject, requiredDepth: depth, analysisId });

      // Setup timeout after registering analysis
      const timeoutMs = Math.max(timeMs, depth * 1000); // At least depth * 1000ms
      this.log(`⏰ Setting timeout for ${timeoutMs}ms for analysis #${analysisId} (depth ${depth})`);

      const timeoutCallback = () => {
        this.logError(`⏰ Analysis #${analysisId} timed out after ${timeoutMs}ms`);
        this.logError(`🐟 Engine state: ready=${this.isReady}, pending=${this.pendingAnalysis.size}`);

        // Get the analysis entry and use its stored reject function
        const entry = this.pendingAnalysis.get(fen);
        if (entry) {
          this.pendingAnalysis.delete(fen);
          this.clearAnalysisTimeout(fen);

          // Try to stop current analysis and reset engine state
          this.sendCommand('stop').catch(_err => {});

          // Use the stored reject function to ensure the promise settles
          entry.reject(new Error(`Analysis timeout after ${timeoutMs}ms for depth ${depth}`));
        }
      };

      const timeoutId = setTimeout(timeoutCallback, timeoutMs);

      // Track timeout for cleanup (handle case where setTimeout returns different types in tests)
      if (timeoutId && (typeof timeoutId === 'object' || typeof timeoutId === 'number')) {
        this.timeouts.add(timeoutId);
      }

      // Update the analysis entry with the timeout ID
      const entry = this.pendingAnalysis.get(fen);
      this.pendingAnalysis.set(fen, { ...entry, timeoutId });

      // Send commands to engine
      this.sendCommand(`position fen ${fen}`)
        .then(() => this.sendCommand(`go depth ${depth}`))
        .catch(error => {
          const pendingEntry = this.pendingAnalysis.get(fen);
          this.clearAnalysisTimeout(fen);
          this.pendingAnalysis.delete(fen);
          (pendingEntry?.reject || reject)(error);
        });
    });
  }

  clearAnalysisTimeout(fen) {
    const analysis = this.pendingAnalysis.get(fen);
    if (analysis && analysis.timeoutId) {
      clearTimeout(analysis.timeoutId);
      if (this.timeouts.has(analysis.timeoutId)) {
        this.timeouts.delete(analysis.timeoutId);
      }
    }
  }

  cleanup() {

    // Clear all active timeouts
    for (const timeoutId of this.timeouts) {
      try {
        clearTimeout(timeoutId);
      } catch (_error) {
        // Ignore errors when clearing timeouts (may happen in test environments)
      }
    }
    this.timeouts.clear();

    // Clear timeouts from pending analysis
    for (const [_fen, analysis] of this.pendingAnalysis) {
      if (analysis.timeoutId) {
        try {
          clearTimeout(analysis.timeoutId);
        } catch (_error) {
          // Ignore errors
        }
      }
    }

    if (this.engine) {
      this.engine.kill();
      this.isReady = false;
    }

    // Clear pending analysis
    this.pendingAnalysis.clear();

    // Reset analysis queue to prevent tests from interfering with each other
    this._analysisQueue = Promise.resolve();
  }
}

// Singleton instance
const stockfishEngine = new StockfishEngine();

/**
 * Gets Stockfish evaluation for a position
 * @param {string} fen - Position in FEN notation
 * @param {number} depth - Analysis depth
 * @returns {Object} Evaluation data
 */
async function getStockfishEvaluation(fen, depth = 15) {
  try {
    // For MVP, we'll use a mock evaluation
    // This will be replaced with real Stockfish analysis
    // return getMockEvaluation(fen);

    // Use real Stockfish analysis:
    const result = await stockfishEngine.analyzePosition(fen, depth);

    // Stockfish returns evaluation from the perspective of the side to move
    // We need to convert it to always be from White's perspective
    const fenParts = fen.split(' ');
    const sideToMove = fenParts[1]; // 'w' or 'b'

    if (sideToMove === 'b' && result.score !== undefined) {
      // If it's Black's turn, negate the score to get White's perspective
      result.score = -result.score;
    }

    return result;

  } catch (_error) {
    // Fallback to mock evaluation
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      console.log('🔄 Falling back to mock evaluation');
    }
    return getMockEvaluation(fen);
  }
}

/**
 * Mock evaluation for development/testing
 */
function getMockEvaluation(fen) {

  // Simple mock that varies based on FEN hash
  const hash = fen.split(' ')[0].length % 200 - 100;
  const variation = (Math.random() - 0.5) * 50;

  return {
    score: Math.round(hash + variation),
    depth: 15,
    bestLine: 'e2e4 e7e5 g1f3',
    nodes: 50000,
    time: 100
  };
}

// Test function to diagnose issues
async function testStockfish() {
  try {
    // Test basic initialization
    await stockfishEngine.initialize();

    // Test simple position
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    await stockfishEngine.analyzePosition(startingFen, 10, 3000);

    stockfishEngine.cleanup();

  } catch (error) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      console.error('❌ Test failed:', error);
    }
    stockfishEngine.cleanup();
    throw error;
  }
}

// Cleanup on process exit (only in production, not in tests)
if (process.env.NODE_ENV !== 'test') {
  process.on('exit', () => {
    stockfishEngine.cleanup();
  });

  process.on('SIGINT', () => {
    stockfishEngine.cleanup();
    process.exit(0);
  });
}

module.exports = {
  getStockfishEvaluation,
  stockfishEngine,
  testStockfish
};