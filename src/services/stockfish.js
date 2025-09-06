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
    this._analysisQueue = Promise.resolve(); // Queue to serialize analysis requests
  }

  async initialize() {
    if (this.isReady) return;

    try {
      console.log('🐟 Initializing Stockfish engine...');
      
      // In production, this will be 'stockfish' if installed globally
      // or '/usr/bin/stockfish' in Docker
      this.engine = spawn(process.env.STOCKFISH_PATH || '/opt/homebrew/bin/stockfish');
      
      this.engine.stdin.setEncoding('utf8');
      this.engine.stdout.setEncoding('utf8');
      
      // Handle engine output
      this.engine.stdout.on('data', (data) => {
        console.log('📤 Stockfish output:', data.toString().trim());
        this.handleEngineOutput(data.toString());
      });
      
      this.engine.stderr.on('data', (data) => {
        console.error('🚨 Stockfish error:', data.toString());
      });

      this.engine.on('close', (code) => {
        console.log(`🐟 Stockfish process exited with code ${code}`);
        this.isReady = false;
      });

      this.engine.on('error', (error) => {
        console.error('🚨 Stockfish process error:', error);
        this.isReady = false;
      });
      
      // Initialize engine
      console.log('📥 Sending UCI command...');
      await this.sendCommand('uci');
      
      console.log('📥 Sending isready command...');
      await this.sendCommand('isready');
      
      this.isReady = true;
      console.log('✅ Stockfish engine initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Stockfish:', error);
      throw new Error('Stockfish engine not available');
    }
  }

  handleEngineOutput(output) {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      console.log(`🔍 Processing line: "${line}"`);
      
      if (line.startsWith('info depth')) {
        this.parseAnalysis(line);
      } else if (line === 'readyok') {
        console.log('✅ Received readyok');
        this.resolveReady();
      } else if (line === 'uciok') {
        console.log('✅ Received uciok');
      } else if (line.startsWith('bestmove')) {
        console.log('🎯 Received bestmove:', line);
        this.handleBestMove(line);
      }
    }
  }

  parseAnalysis(infoLine) {
    console.log(`📊 Parsing analysis: ${infoLine}`);
    
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
    
    console.log(`📈 Parsed analysis:`, analysis);
    
    // Notify waiting analysis requests
    const fen = this.currentFen;
    if (fen && this.pendingAnalysis.has(fen)) {
      const { resolve, requiredDepth } = this.pendingAnalysis.get(fen);
      
      console.log(`🎯 Checking if depth ${analysis.depth} >= required ${requiredDepth}`);
      
      if (analysis.depth >= requiredDepth) {
        console.log(`✅ Analysis complete for depth ${analysis.depth}`);
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
      
      console.log(`🏁 Resolving with bestmove: ${bestMove}`);
      this.clearAnalysisTimeout(fen);
      resolve(analysis);
      this.pendingAnalysis.delete(fen);
    }
  }

  async sendCommand(command) {
    console.log(`📤 Sending command: "${command}"`);
    
    return new Promise((resolve) => {
      if (!this.engine || !this.engine.stdin.writable) {
        console.error('❌ Engine stdin not writable');
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
      console.log('🔄 Engine not ready, initializing...');
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
    console.log(`🎯 Starting analysis #${analysisId} for FEN: ${fen} (depth: ${depth})`);

    return new Promise((resolve, reject) => {
      // Clear any existing analysis for this position
      if (this.pendingAnalysis.has(fen)) {
        console.log('⚠️ Clearing existing analysis for this position');
        this.pendingAnalysis.delete(fen);
      }
      
      // Register analysis FIRST (before timeout) to avoid race condition
      this.currentFen = fen;
      this.pendingAnalysis.set(fen, { resolve, reject, requiredDepth: depth, analysisId });
      
      // Setup timeout after registering analysis
      const timeoutMs = Math.max(timeMs, depth * 1000); // At least depth * 1000ms
      console.log(`⏰ Setting timeout for ${timeoutMs}ms for analysis #${analysisId} (depth ${depth})`);
      
      const timeoutCallback = () => {
        console.error(`⏰ Analysis #${analysisId} timed out after ${timeoutMs}ms`);
        console.error(`🐟 Engine state: ready=${this.isReady}, pending=${this.pendingAnalysis.size}`);
        
        // Get the analysis entry and use its stored reject function
        const entry = this.pendingAnalysis.get(fen);
        if (entry) {
          this.pendingAnalysis.delete(fen);
          this.clearAnalysisTimeout(fen);
          
          // Try to stop current analysis and reset engine state
          this.sendCommand('stop').catch(err => console.error('Error sending stop:', err));
          
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
          console.error(`❌ Error sending commands for analysis #${analysisId}:`, error);
          const entry = this.pendingAnalysis.get(fen);
          this.clearAnalysisTimeout(fen);
          this.pendingAnalysis.delete(fen);
          (entry?.reject || reject)(error);
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
    // Only log in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      console.log('🧹 Cleaning up Stockfish engine...');
    }
    
    // Clear all active timeouts
    for (const timeoutId of this.timeouts) {
      try {
        clearTimeout(timeoutId);
      } catch (error) {
        // Ignore errors when clearing timeouts (may happen in test environments)
      }
    }
    this.timeouts.clear();
    
    // Clear timeouts from pending analysis
    for (const [fen, analysis] of this.pendingAnalysis) {
      if (analysis.timeoutId) {
        try {
          clearTimeout(analysis.timeoutId);
        } catch (error) {
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
    console.log(`🎯 Requesting Stockfish evaluation for: ${fen}`);
    
    // For MVP, we'll use a mock evaluation
    // This will be replaced with real Stockfish analysis
    // return getMockEvaluation(fen);
    
    // Use real Stockfish analysis:
    const result = await stockfishEngine.analyzePosition(fen, depth);
    console.log(`✅ Stockfish evaluation complete:`, result);
    return result;
    
  } catch (error) {
    console.error('❌ Stockfish evaluation failed:', error);
    
    // Fallback to mock evaluation
    console.log('🔄 Falling back to mock evaluation');
    return getMockEvaluation(fen);
  }
}

/**
 * Mock evaluation for development/testing
 */
function getMockEvaluation(fen) {
  console.log('🎭 Using mock evaluation for:', fen);
  
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
  console.log('🧪 Testing Stockfish engine...');
  
  try {
    // Test basic initialization
    await stockfishEngine.initialize();
    console.log('✅ Initialization test passed');
    
    // Test simple position
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const result = await stockfishEngine.analyzePosition(startingFen, 10, 3000);
    console.log('✅ Analysis test passed:', result);
    
    stockfishEngine.cleanup();
    console.log('✅ All tests passed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    stockfishEngine.cleanup();
  }
}

// Cleanup on process exit (only in production, not in tests)
if (process.env.NODE_ENV !== 'test') {
  process.on('exit', () => {
    stockfishEngine.cleanup();
  });

  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, cleaning up...');
    stockfishEngine.cleanup();
    process.exit(0);
  });
}

module.exports = {
  getStockfishEvaluation,
  stockfishEngine,
  testStockfish
};