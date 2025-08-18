const { Chess } = require('chess.js');
const { supabase } = require('./supabase');
const https = require('https');

/**
 * Hybrid ECO Classifier - Database for classification, Lichess for book depth verification
 */
class ECOClassifier {
  constructor() {
    this.positionCache = new Map();
    this.bookDepthCache = new Map(); // Cache Lichess book depth checks
    this.isLoaded = false;
    this.lastApiCall = 0;
    this.API_DELAY_MS = 1000; // 1 second between Lichess calls
  }

  async loadDatabase() {
    if (this.isLoaded) return;
    
    try {
      console.log('Initializing hybrid ECO classifier...');
      
      const { count, error } = await supabase
        .from('chess_openings')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }
      
      console.log(`✅ Hybrid ECO classifier ready with ${count} openings + Lichess verification`);
      this.isLoaded = true;
      
    } catch (error) {
      console.error('Failed to initialize ECO classifier:', error.message);
      throw error;
    }
  }

  /**
   * Main classification function with hybrid approach
   */
  async classify(moves) {
    if (!this.isLoaded) {
      console.warn('ECO classifier not initialized. Call loadDatabase() first.');
      return this.getDefaultClassification();
    }

    try {
      let moveArray;
      if (typeof moves === 'string') {
        const game = new Chess();
        game.loadPgn(moves);
        moveArray = game.history({ verbose: true });
      } else {
        moveArray = moves;
      }

      if (moveArray.length === 0) {
        return this.getDefaultClassification();
      }

      // Step 1: Get opening classification from our database (fast)
      const databaseResult = await this.classifyFromDatabase(moveArray);
      
      if (!databaseResult || !databaseResult.eco) {
        return this.getDefaultClassification();
      }

      // Step 2: Verify and extend book depth with Lichess (accurate)
      console.log(`Database found: ${databaseResult.name} (book until move ${databaseResult.lastBookMove})`);
      const extendedBookDepth = await this.verifyBookDepthWithLichess(moveArray, databaseResult.lastBookMove);
      
      // Combine database classification with Lichess book depth
      return {
        ...databaseResult,
        lastBookMove: extendedBookDepth.actualLastMove,
        bookDepthSource: extendedBookDepth.source,
        bookExtended: extendedBookDepth.actualLastMove > databaseResult.lastBookMove
      };

    } catch (error) {
      console.error('Error in hybrid classification:', error.message);
      return this.getDefaultClassification();
    }
  }

  /**
   * Step 1: Get opening classification from database
   */
  async classifyFromDatabase(moveArray) {
    let bestOpening = null;
    let lastBookMove = 0;
    const game = new Chess();
    
    // Check positions up to move 25
    for (let i = 0; i < Math.min(moveArray.length, 25); i++) {
      try {
        const move = moveArray[i];
        game.move(move);
        
        const fen = game.fen();
        const epd = this.fenToEpd(fen);
        
        // Check cache first
        if (this.positionCache.has(epd)) {
          const cachedOpening = this.positionCache.get(epd);
          if (cachedOpening) {
            bestOpening = cachedOpening;
            lastBookMove = Math.ceil((i + 1) / 2);
          }
          continue;
        }
        
        // Query database
        const { data: opening, error } = await supabase
          .from('chess_openings')
          .select('*')
          .eq('epd', epd)
          .single();
        
        if (opening && !error) {
          bestOpening = opening;
          lastBookMove = Math.ceil((i + 1) / 2);
          this.positionCache.set(epd, opening);
        } else {
          this.positionCache.set(epd, null);
        }
        
      } catch (moveError) {
        console.warn(`Error processing move ${i + 1}:`, moveError.message);
        break;
      }
    }

    if (!bestOpening) return null;

    return {
      eco: bestOpening.eco,
      name: bestOpening.name,
      pgn: bestOpening.pgn,
      uci: bestOpening.uci,
      lastBookMove: lastBookMove,
      totalMoves: moveArray.length,
      source: 'database'
    };
  }

  /**
   * Step 2: Verify and extend book depth using Lichess Masters database
   */
  async verifyBookDepthWithLichess(moveArray, databaseLastMove) {
    try {
      console.log(`Verifying book depth beyond move ${databaseLastMove} with Lichess...`);
      
      const game = new Chess();
      let actualLastMove = databaseLastMove;
      let lichessCallsUsed = 0;
      const maxLichessCalls = 5; // Limit to prevent too many API calls
      
      // Start checking from our database's last book move
      for (let i = 0; i < moveArray.length && i < 30; i++) { // Check up to move 30 max
        const move = moveArray[i];
        game.move(move);
        
        const moveNumber = Math.ceil((i + 1) / 2);
        
        // Only check Lichess for moves beyond our database's book knowledge
        if (moveNumber > databaseLastMove && lichessCallsUsed < maxLichessCalls) {
          const fen = game.fen();
          const lichessResult = await this.checkLichessBook(fen);
          lichessCallsUsed++;
          
          if (lichessResult.inBook && lichessResult.popularity > 100) { // Minimum popularity threshold
            actualLastMove = moveNumber;
            console.log(`Lichess confirms move ${moveNumber} still in book (${lichessResult.popularity} games)`);
          } else {
            console.log(`Lichess confirms book ends at move ${moveNumber - 1}`);
            break;
          }
        }
      }
      
      return {
        actualLastMove: actualLastMove,
        source: actualLastMove > databaseLastMove ? 'database + lichess' : 'database',
        lichessCallsUsed: lichessCallsUsed
      };
      
    } catch (error) {
      console.warn('Error verifying book depth with Lichess:', error.message);
      return {
        actualLastMove: databaseLastMove,
        source: 'database (lichess failed)',
        lichessCallsUsed: 0
      };
    }
  }

  /**
   * Check if a position is still in Lichess Masters book
   */
  async checkLichessBook(fen) {
    // Check cache first
    const epd = this.fenToEpd(fen);
    if (this.bookDepthCache.has(epd)) {
      return this.bookDepthCache.get(epd);
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.API_DELAY_MS) {
      const delay = this.API_DELAY_MS - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastApiCall = Date.now();

    try {
      const url = `https://explorer.lichess.ovh/master?fen=${encodeURIComponent(fen)}`;
      
      const data = await new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
          let data = '';
          
          response.on('data', (chunk) => {
            data += chunk;
          });
          
          response.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (parseError) {
              reject(new Error(`Failed to parse JSON: ${parseError.message}`));
            }
          });
        });
        
        request.on('error', (error) => {
          reject(error);
        });
        
        request.setTimeout(5000, () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });
      });
      
      const result = {
        inBook: data.moves && data.moves.length > 0,
        popularity: data.moves ? data.moves.reduce((sum, move) => sum + move.white + move.draws + move.black, 0) : 0,
        topMove: data.moves && data.moves.length > 0 ? data.moves[0].san : null
      };

      // Cache the result
      this.bookDepthCache.set(epd, result);
      
      return result;
      
    } catch (error) {
      console.warn(`Lichess book check failed: ${error.message}`);
      
      const fallback = { inBook: false, popularity: 0, topMove: null };
      this.bookDepthCache.set(epd, fallback);
      return fallback;
    }
  }

  /**
   * Convert FEN to EPD
   */
  fenToEpd(fen) {
    const parts = fen.split(' ');
    return parts.slice(0, 4).join(' ');
  }

  /**
   * Search openings by name or ECO code
   */
  async search(query) {
    try {
      const { data: openings, error } = await supabase
        .from('chess_openings')
        .select('eco, name, pgn')
        .or(`name.ilike.%${query}%,eco.ilike.%${query}%`)
        .limit(20);
      
      return error ? [] : openings;
    } catch (error) {
      console.warn('Error searching openings:', error.message);
      return [];
    }
  }

  /**
   * Get opening statistics
   */
  async getStatistics() {
    try {
      const { count, error: countError } = await supabase
        .from('chess_openings')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        return { total: 0, byCategory: {} };
      }

      const { data: volumeCounts, error: volumeError } = await supabase
        .from('chess_openings')
        .select('eco_volume')
        .not('eco_volume', 'is', null);

      if (volumeError) {
        return { total: count, byCategory: {} };
      }

      const byCategory = volumeCounts.reduce((acc, row) => {
        const volume = row.eco_volume;
        acc[volume] = (acc[volume] || 0) + 1;
        return acc;
      }, {});

      return { total: count, byCategory: byCategory };
    } catch (error) {
      return { total: 0, byCategory: {} };
    }
  }

  /**
   * Get default classification
   */
  getDefaultClassification() {
    return {
      eco: null,
      name: 'Unknown Opening',
      pgn: '',
      uci: '',
      lastBookMove: 0,
      totalMoves: 0,
      source: 'default'
    };
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.positionCache.clear();
    this.bookDepthCache.clear();
    console.log('All caches cleared');
  }
}

// Singleton instance
const ecoClassifier = new ECOClassifier();

async function initializeECOClassifier() {
  await ecoClassifier.loadDatabase();
  return ecoClassifier;
}

async function classifyOpening(moves) {
  return await ecoClassifier.classify(moves);
}

async function getECOStatistics() {
  return await ecoClassifier.getStatistics();
}

async function searchOpenings(query) {
  return await ecoClassifier.search(query);
}

module.exports = {
  ECOClassifier,
  initializeECOClassifier,
  classifyOpening,
  getECOStatistics,
  searchOpenings,
  ecoClassifier
};