const { Chess } = require('chess.js');
const crypto = require('crypto');
const { supabase } = require('./supabase');
const { getPolyglotBook } = require('./polyglotBook');

/**
 * Enhanced ECO Classifier - Uses Polyglot book for depth and chess_openings for naming
 */
class ECOClassifier {
  constructor() {
    this.positionCache = new Map();
    this.openingsCache = new Map();
    this.isLoaded = false;
    this.polyglotBook = null;
  }

  async loadDatabase() {
    if (this.isLoaded) return;
    
    try {
      console.log('Initializing enhanced ECO classifier...');
      
      // Initialize Polyglot book
      this.polyglotBook = getPolyglotBook();
      await this.polyglotBook.initialize();
      
      // Check chess_openings table
      const { count: openingsCount, error: openingsError } = await supabase
        .from('chess_openings')
        .select('*', { count: 'exact', head: true });
      
      if (openingsError) {
        throw new Error(`Chess openings database connection failed: ${openingsError.message}`);
      }
      
      const bookStats = this.polyglotBook.getStatistics();
      console.log(`✅ Enhanced ECO classifier ready with ${bookStats.positions} book positions + ${openingsCount} chess openings`);
      this.isLoaded = true;
      
    } catch (error) {
      console.error('Failed to initialize ECO classifier:', error.message);
      throw error;
    }
  }

  /**
   * Main classification function using Polyglot book + chess_openings
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

      // Use dual approach: Polyglot for book depth + chess_openings for naming
      const result = await this.classifyWithPolyglot(moveArray);
      
      if (result && result.name) {
        console.log(`Opening found: ${result.name} (${result.eco || 'no ECO'}) - book until move ${result.lastBookMove}`);
        return result;
      }

      return this.getDefaultClassification();

    } catch (error) {
      console.error('Error in opening classification:', error.message);
      return this.getDefaultClassification();
    }
  }

  /**
   * Enhanced classification using Polyglot book for depth + chess_openings for naming
   */
  async classifyWithPolyglot(moveArray) {
    let bestOpeningName = null;
    let bestOpeningEco = null;
    let bestOpeningData = null;
    let lastBookMove = 0;
    const game = new Chess();
    
    console.log('Starting classification with Polyglot book...');
    
    // Track book moves using Polyglot
    // Note: The book typically only contains positions where White is to move
    let stillInBook = true;
    
    for (let i = 0; i < Math.min(moveArray.length, 60); i++) {
      try {
        const move = moveArray[i];
        const currentFen = game.fen();
        const isWhiteTurn = game.turn() === 'w';
        
        // Check if this position is in the Polyglot book
        // Only check when it's White's turn (book limitation)
        let bookMoves = [];
        if (isWhiteTurn) {
          bookMoves = await this.polyglotBook.getBookMoves(currentFen);
        }
        
        // Make the move
        game.move(move);
        
        // Track book depth
        if (stillInBook && isWhiteTurn) {
          if (bookMoves.length > 0) {
            // Check if the played move was a book move
            const playedUci = this.moveToUci(move);
            const isBookMove = bookMoves.some(m => m.uci === playedUci);
            
            if (isBookMove) {
              // Update lastBookMove (full move number)
              lastBookMove = Math.floor(i / 2) + 1;
            } else {
              // Position was in book but move wasn't - player left book
              stillInBook = false;
            }
          } else {
            // Position not in book
            stillInBook = false;
          }
        }
        
      } catch (moveError) {
        console.warn(`Error processing move ${i + 1}:`, moveError.message);
        break;
      }
    }
    
    // Now find the best opening name using chess_openings table
    // Try two approaches: position-based and move-order based
    
    // Reset game for position lookups
    game.reset();
    const uciMoves = [];
    
    for (let i = 0; i < moveArray.length; i++) {
      const move = moveArray[i];
      game.move(move);
      uciMoves.push(this.moveToUci(move));
      
      const fen = game.fen();
      const epd = this.fenToEpd(fen);
      
      // Look up position in chess_openings
      const openingResult = await this.queryChessOpeningsPosition(epd);
      
      if (openingResult && openingResult.eco) {
        bestOpeningName = openingResult.name;
        bestOpeningEco = openingResult.eco;
        bestOpeningData = openingResult;
      }
    }
    
    // If no position match, try prefix-based lookup
    if (!bestOpeningName && uciMoves.length > 0) {
      const prefixResult = await this.queryByPrefix(uciMoves);
      if (prefixResult) {
        bestOpeningName = prefixResult.name;
        bestOpeningEco = prefixResult.eco;
        bestOpeningData = prefixResult;
      }
    }
    
    if (!bestOpeningName) return null;
    
    return {
      eco: bestOpeningEco,
      name: bestOpeningName,
      pgn: bestOpeningData?.pgn || '',
      uci: bestOpeningData?.uci || '',
      lastBookMove: lastBookMove,
      totalMoves: moveArray.length,
      source: 'polyglot',
      bookDepth: lastBookMove,
      theoryTexts: [] // No theory texts in new approach
    };
  }

  /**
   * Convert a chess.js move object to UCI notation
   */
  moveToUci(move) {
    if (typeof move === 'string') return move;
    return move.from + move.to + (move.promotion || '');
  }

  /**
   * Query opening by move prefix using the prefix table
   */
  async queryByPrefix(uciMoves) {
    try {
      const uciString = uciMoves.join(' ');
      const prefixHash = crypto.createHash('sha256').update(uciString).digest('hex');
      
      const { data, error } = await supabase
        .from('openings_prefix')
        .select('line_id, prefix_plies')
        .eq('prefix_hash', prefixHash)
        .order('prefix_plies', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) return null;
      
      // Get the full opening details
      const { data: opening, error: openingError } = await supabase
        .from('chess_openings')
        .select('*')
        .eq('id', data.line_id)
        .single();
      
      return openingError ? null : opening;
    } catch (error) {
      console.warn('Error querying by prefix:', error.message);
      return null;
    }
  }

  /**
   * Query chess_openings table for a specific position
   */
  async queryChessOpeningsPosition(epd) {
    // Check cache first
    if (this.openingsCache.has(epd)) {
      return this.openingsCache.get(epd);
    }
    
    try {
      const { data: opening, error } = await supabase
        .from('chess_openings')
        .select('*')
        .eq('epd', epd)
        .single();
      
      const result = (opening && !error && opening.eco) ? opening : null;
      this.openingsCache.set(epd, result);
      return result;
    } catch (error) {
      this.openingsCache.set(epd, null);
      return null;
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
      source: 'default',
      theoryTexts: []
    };
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.positionCache.clear();
    this.openingsCache.clear();
    if (this.polyglotBook) {
      this.polyglotBook.clearCache();
    }
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