const { Chess } = require('chess.js');
const { supabase } = require('./supabase');

/**
 * WikiBooks-based ECO Classifier - Uses WikiBooks positions table for comprehensive opening theory
 */
class ECOClassifier {
  constructor() {
    this.positionCache = new Map();
    this.wikibooksCache = new Map(); // Cache WikiBooks position lookups
    this.chessOpeningsCache = new Map(); // Cache chess_openings fallback lookups
    this.isLoaded = false;
  }

  async loadDatabase() {
    if (this.isLoaded) return;
    
    try {
      console.log('Initializing WikiBooks-based ECO classifier...');
      
      // Check WikiBooks positions table
      const { count: wikibooksCount, error: wikibooksError } = await supabase
        .from('wikibooks_positions')
        .select('*', { count: 'exact', head: true });
      
      if (wikibooksError) {
        throw new Error(`WikiBooks database connection failed: ${wikibooksError.message}`);
      }
      
      // Check chess_openings table as fallback
      const { count: openingsCount, error: openingsError } = await supabase
        .from('chess_openings')
        .select('*', { count: 'exact', head: true });
      
      if (openingsError) {
        throw new Error(`Chess openings database connection failed: ${openingsError.message}`);
      }
      
      console.log(`✅ WikiBooks ECO classifier ready with ${wikibooksCount} WikiBooks positions + ${openingsCount} chess openings fallback`);
      this.isLoaded = true;
      
    } catch (error) {
      console.error('Failed to initialize ECO classifier:', error.message);
      throw error;
    }
  }

  /**
   * Main classification function using WikiBooks positions table
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

      // Get hybrid classification from WikiBooks (depth) + chess_openings (names)
      const wikibooksResult = await this.classifyFromWikiBooks(moveArray);
      
      if (wikibooksResult && (wikibooksResult.opening_name || wikibooksResult.name)) {
        console.log(`Hybrid WikiBooks found: ${wikibooksResult.name} (${wikibooksResult.eco || 'no ECO'}) - book until move ${wikibooksResult.lastBookMove}`);
        return wikibooksResult;
      }

      // Fallback to chess_openings table if WikiBooks doesn't have the position
      console.log('WikiBooks classification failed, trying chess_openings fallback...');
      const fallbackResult = await this.classifyFromChessOpenings(moveArray);
      
      if (fallbackResult && fallbackResult.eco) {
        console.log(`Chess openings fallback found: ${fallbackResult.name} (book until move ${fallbackResult.lastBookMove})`);
        return fallbackResult;
      }

      return this.getDefaultClassification();

    } catch (error) {
      console.error('Error in WikiBooks classification:', error.message);
      return this.getDefaultClassification();
    }
  }

  /**
   * Hybrid classification: WikiBooks depth + chess_openings names
   * Gets the comprehensive book depth from WikiBooks while using the superior
   * opening names from chess_openings table for better descriptiveness
   */
  async classifyFromWikiBooks(moveArray) {
    let bestWikiBooksOpening = null;
    let bestChessOpeningName = null;
    let bestChessOpeningEco = null;
    let bestChessOpeningData = null;
    let lastBookMove = 0;
    const theoryTexts = []; // Collect theory texts for each book move
    const game = new Chess();
    
    console.log('Starting hybrid classification (WikiBooks depth + chess_openings names)...');
    
    // Check positions up to move 30 (WikiBooks has deeper theory)
    for (let i = 0; i < Math.min(moveArray.length, 30); i++) {
      try {
        const move = moveArray[i];
        game.move(move);
        
        const fen = game.fen();
        const epd = this.fenToEpd(fen);
        const moveNumber = Math.ceil((i + 1) / 2);
        
        // Parallel lookups for both tables
        const [wikibooksResult, chessOpeningsResult] = await Promise.all([
          this.queryWikiBooksPosition(epd),
          this.queryChessOpeningsPosition(epd)
        ]);
        
        // WikiBooks drives the book depth (primary source for "in book" determination)
        if (wikibooksResult && wikibooksResult.opening_name) {
          bestWikiBooksOpening = wikibooksResult;
          lastBookMove = moveNumber;
          
          // Collect theory text for this move
          if (wikibooksResult.theory_text) {
            theoryTexts.push({
              moveIndex: i, // Use actual move index (0-based) instead of chess move number
              moveNumber: moveNumber, // Keep for reference
              move: move.san || move,
              theory_text: wikibooksResult.theory_text,
              opening_name: wikibooksResult.opening_name
            });
          }
          
          console.log(`Move ${moveNumber}: WikiBooks found "${wikibooksResult.opening_name}"`);
        }
        
        // chess_openings provides superior naming (secondary source for descriptive names)
        if (chessOpeningsResult && chessOpeningsResult.eco) {
          bestChessOpeningName = chessOpeningsResult.name;
          bestChessOpeningEco = chessOpeningsResult.eco;
          bestChessOpeningData = chessOpeningsResult;
          console.log(`Move ${moveNumber}: chess_openings found "${chessOpeningsResult.name}" (${chessOpeningsResult.eco})`);
        }
        
      } catch (moveError) {
        console.warn(`Error processing move ${i + 1}:`, moveError.message);
        break;
      }
    }

    if (!bestWikiBooksOpening) return null;

    // Hybrid result: WikiBooks depth + chess_openings name quality
    const hybridResult = {
      eco: bestChessOpeningEco, // From chess_openings (better ECO classification)
      name: bestChessOpeningName || bestWikiBooksOpening.opening_name || bestWikiBooksOpening.page_title, // Prefer chess_openings name
      pgn: bestChessOpeningData?.pgn || bestWikiBooksOpening.move_sequence || '',
      uci: bestChessOpeningData?.uci || '',
      lastBookMove: lastBookMove, // From WikiBooks (deeper/more accurate book depth)
      totalMoves: moveArray.length,
      source: 'wikibooks_hybrid', // Indicate this is a hybrid result
      
      // Preserve WikiBooks educational content
      opening_name: bestWikiBooksOpening.opening_name,
      theory_text: bestWikiBooksOpening.theory_text, // Keep for backward compatibility
      theoryTexts: theoryTexts, // NEW: Array of theory texts for each book move
      
      // Indicate data sources used
      nameSource: bestChessOpeningName ? 'chess_openings' : 'wikibooks',
      depthSource: 'wikibooks'
    };

    console.log(`Hybrid result: "${hybridResult.name}" (${hybridResult.eco || 'no ECO'}) - book until move ${lastBookMove}, collected ${theoryTexts.length} theory texts`);
    
    return hybridResult;
  }

  /**
   * Query WikiBooks positions table for a specific position
   */
  async queryWikiBooksPosition(epd) {
    // Check cache first
    if (this.wikibooksCache.has(epd)) {
      return this.wikibooksCache.get(epd);
    }
    
    try {
      const { data: position, error } = await supabase
        .from('wikibooks_positions')
        .select('*')
        .eq('epd', epd)
        .single();
      
      const result = (position && !error && position.opening_name) ? position : null;
      this.wikibooksCache.set(epd, result);
      return result;
    } catch (error) {
      this.wikibooksCache.set(epd, null);
      return null;
    }
  }

  /**
   * Query chess_openings table for a specific position
   */
  async queryChessOpeningsPosition(epd) {
    // Check cache first
    if (this.chessOpeningsCache.has(epd)) {
      return this.chessOpeningsCache.get(epd);
    }
    
    try {
      const { data: opening, error } = await supabase
        .from('chess_openings')
        .select('*')
        .eq('epd', epd)
        .single();
      
      const result = (opening && !error && opening.eco) ? opening : null;
      this.chessOpeningsCache.set(epd, result);
      return result;
    } catch (error) {
      this.chessOpeningsCache.set(epd, null);
      return null;
    }
  }

  /**
   * Fallback: Get opening classification from chess_openings table
   */
  async classifyFromChessOpenings(moveArray) {
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
        if (this.chessOpeningsCache.has(epd)) {
          const cachedOpening = this.chessOpeningsCache.get(epd);
          if (cachedOpening) {
            bestOpening = cachedOpening;
            lastBookMove = Math.ceil((i + 1) / 2);
          }
          continue;
        }
        
        // Query chess_openings table
        const { data: opening, error } = await supabase
          .from('chess_openings')
          .select('*')
          .eq('epd', epd)
          .single();
        
        if (opening && !error && opening.eco) {
          bestOpening = opening;
          lastBookMove = Math.ceil((i + 1) / 2);
          this.chessOpeningsCache.set(epd, opening);
        } else {
          this.chessOpeningsCache.set(epd, null);
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
      source: 'chess_openings_fallback',
      theoryTexts: [] // No theory texts available from chess_openings table
    };
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
    this.wikibooksCache.clear();
    this.chessOpeningsCache.clear();
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