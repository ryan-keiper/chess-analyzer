// src/services/wikiBooksDetector.js
const { createClient } = require('@supabase/supabase-js');

class WikiBooksDetector {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.cache = new Map(); // In-memory cache for frequently accessed positions
  }

  /**
   * Convert FEN to EPD (remove move counters for consistent lookup)
   */
  fenToEPD(fen) {
    const parts = fen.split(' ');
    return parts.slice(0, 4).join(' ');
  }

  /**
   * Check if a single position is in WikiBooks theory
   */
  async isPositionInBook(fen) {
    const epd = this.fenToEPD(fen);
    
    // Check cache first
    if (this.cache.has(epd)) {
      return this.cache.get(epd);
    }

    try {
      const { data } = await this.supabase.rpc('is_position_in_book', {
        position_epd: epd
      });

      // Cache the result
      this.cache.set(epd, data);
      
      return data || false;
    } catch (error) {
      console.error('Error checking position in book:', error);
      return false;
    }
  }

  /**
   * Get theory information for a position
   */
  async getPositionTheory(fen) {
    const epd = this.fenToEPD(fen);

    try {
      const { data, error } = await this.supabase.rpc('get_position_theory', {
        position_epd: epd
      });

      if (error) throw error;
      
      return data[0] || null;
    } catch (error) {
      console.error('Error getting position theory:', error);
      return null;
    }
  }

  /**
   * Find where a game leaves opening theory
   * Returns the move number (1-based) where players left book
   */
  async findBookEnd(positions) {
    if (!positions || positions.length === 0) {
      return 0;
    }

    // Convert positions to EPDs
    const epds = positions.map(pos => this.fenToEPD(pos.fen || pos.position));

    try {
      const { data, error } = await this.supabase.rpc('find_book_end', {
        epd_list: epds
      });

      if (error) throw error;
      
      return data || positions.length + 1;
    } catch (error) {
      console.error('Error finding book end:', error);
      
      // Fallback: check positions one by one
      for (let i = 0; i < positions.length; i++) {
        const inBook = await this.isPositionInBook(positions[i].fen || positions[i].position);
        if (!inBook) {
          return i + 1; // Return 1-based index
        }
      }
      
      return positions.length + 1; // All positions were in book
    }
  }

  /**
   * Enhanced analysis that includes book detection
   */
  async analyzeGameWithBookDetection(positions) {
    console.log('🔍 Analyzing game with WikiBooks book detection...');
    
    const bookEndMove = await this.findBookEnd(positions);
    const results = {
      bookEndMove: bookEndMove,
      totalMoves: positions.length,
      bookMoves: Math.max(0, bookEndMove - 1),
      openingPhase: [],
      strategicPhase: []
    };

    console.log(`📚 Book theory followed until move ${bookEndMove}`);

    // Split positions into book and post-book phases
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const moveNumber = i + 1;
      
      if (moveNumber < bookEndMove) {
        // This move is in book - get theory
        const theory = await this.getPositionTheory(position.fen || position.position);
        
        results.openingPhase.push({
          ...position,
          moveNumber: moveNumber,
          inBook: true,
          theory: theory,
          phase: 'opening'
        });
      } else {
        // This move is out of book - needs AI analysis
        results.strategicPhase.push({
          ...position,
          moveNumber: moveNumber,
          inBook: false,
          theory: null,
          phase: 'strategic'
        });
      }
    }

    // Get opening information from the last book position
    if (results.openingPhase.length > 0) {
      const lastBookPosition = results.openingPhase[results.openingPhase.length - 1];
      results.openingInfo = {
        name: lastBookPosition.theory?.opening_name || 'Unknown Opening',
        moveCount: results.bookMoves,
        lastBookMove: lastBookPosition.move || '',
        theoryText: lastBookPosition.theory?.theory_text || '',
        wikiUrl: lastBookPosition.theory?.page_url || ''
      };
    }

    return results;
  }

  /**
   * Get opening statistics from the database
   */
  async getOpeningStatistics() {
    try {
      const { data, error } = await this.supabase
        .from('opening_statistics')
        .select('*')
        .order('position_count', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting opening statistics:', error);
      return [];
    }
  }

  /**
   * Search for opening lines by name
   */
  async searchOpenings(searchTerm, limit = 20) {
    try {
      const { data, error } = await this.supabase
        .from('wikibooks_positions')
        .select('opening_name, move_sequence, theory_text, page_url, move_count')
        .ilike('opening_name', `%${searchTerm}%`)
        .eq('in_book', true)
        .order('move_count')
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error searching openings:', error);
      return [];
    }
  }

  /**
   * Clear the position cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Position cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      positions: Array.from(this.cache.keys()).slice(0, 5) // First 5 for debugging
    };
  }
}

module.exports = { WikiBooksDetector };