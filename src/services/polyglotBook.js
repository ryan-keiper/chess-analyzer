const fs = require('fs');
const { Chess } = require('chess.js');
const path = require('path');
const { calculatePolyglotKey } = require('./polyglotZobrist');

/**
 * Polyglot Book Reader Service
 * Reads and queries Polyglot format opening books (.bin files)
 * Built from 24 months of high-quality Lichess games
 */
class PolyglotBook {
  constructor(bookPath = null) {
    this.bookPath = bookPath || process.env.BOOK_BIN_PATH || path.join(__dirname, '../../data/openings-merged.bin');
    this.fileDescriptor = null;
    this.fileSize = 0;
    this.recordSize = 16; // Each record is exactly 16 bytes
    this.cache = new Map(); // Cache for frequently accessed positions
    this.isInitialized = false;
  }

  /**
   * Initialize the book reader
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Check if file exists
      if (!fs.existsSync(this.bookPath)) {
        console.warn(`Polyglot book file not found at ${this.bookPath}`);
        this.isInitialized = false;
        return;
      }

      // Get file stats
      const stats = fs.statSync(this.bookPath);
      this.fileSize = stats.size;

      // Open file for reading
      this.fileDescriptor = fs.openSync(this.bookPath, 'r');

      const recordCount = Math.floor(this.fileSize / this.recordSize);
      console.log(`✅ Polyglot book initialized: ${recordCount} positions from ${this.bookPath}`);

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Polyglot book:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Close the book file
   */
  close() {
    if (this.fileDescriptor) {
      fs.closeSync(this.fileDescriptor);
      this.fileDescriptor = null;
    }
    this.isInitialized = false;
  }

  /**
   * Convert FEN to Polyglot Zobrist key
   * Uses the standard Polyglot Zobrist algorithm
   */
  fenToPolyglotKey(fen) {
    return calculatePolyglotKey(fen);
  }

  /**
   * Read a record from the book at given offset
   */
  readRecord(offset) {
    if (!this.isInitialized || !this.fileDescriptor) {
      return null;
    }

    const buffer = Buffer.alloc(this.recordSize);
    fs.readSync(this.fileDescriptor, buffer, 0, this.recordSize, offset);

    // Parse the 16-byte record (big-endian)
    const key = buffer.readBigUInt64BE(0);
    const move = buffer.readUInt16BE(8);
    const count = buffer.readUInt16BE(10);
    const n = buffer.readUInt16BE(12);
    const sum = buffer.readUInt16BE(14);

    return { key, move, count, n, sum };
  }

  /**
   * Decode Polyglot move encoding to UCI format
   */
  decodePolyglotMove(moveCode) {
    const fromSquare = moveCode & 0x3f;
    const toSquare = (moveCode >> 6) & 0x3f;
    const promotion = (moveCode >> 12) & 0x0f;

    const files = 'abcdefgh';
    const fromFile = files[fromSquare % 8];
    const fromRank = Math.floor(fromSquare / 8) + 1;
    const toFile = files[toSquare % 8];
    const toRank = Math.floor(toSquare / 8) + 1;

    let uci = `${fromFile}${fromRank}${toFile}${toRank}`;

    // Add promotion piece if present
    if (promotion > 0) {
      const promotionPieces = ['', 'n', 'b', 'r', 'q'];
      uci += promotionPieces[promotion] || '';
    }

    return uci;
  }

  /**
   * Binary search for a position key in the book
   */
  findPosition(targetKey) {
    if (!this.isInitialized) return [];

    const recordCount = Math.floor(this.fileSize / this.recordSize);
    let left = 0;
    let right = recordCount - 1;
    let foundIndex = -1;

    // Binary search for the first occurrence of the key
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const record = this.readRecord(mid * this.recordSize);

      if (!record) break;

      if (record.key === targetKey) {
        foundIndex = mid;
        // Continue searching left to find first occurrence
        right = mid - 1;
      } else if (record.key < targetKey) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    if (foundIndex === -1) return [];

    // Collect all moves for this position
    const moves = [];
    let currentIndex = foundIndex;

    while (currentIndex < recordCount) {
      const record = this.readRecord(currentIndex * this.recordSize);
      if (!record || record.key !== targetKey) break;

      const uci = this.decodePolyglotMove(record.move);
      const score = record.n > 0 ? record.sum / (2 * record.n) : null;

      moves.push({
        uci,
        count: record.count,
        n: record.n,
        sum: record.sum,
        score, // Win rate between 0 and 1
        weight: record.count // Popularity weight
      });

      currentIndex++;
    }

    // Sort by popularity (count) descending
    moves.sort((a, b) => b.count - a.count);

    return moves;
  }

  /**
   * Get book moves for a given FEN position
   */
  async getBookMoves(fen) {
    if (!this.isInitialized) {
      await this.initialize();
      if (!this.isInitialized) return [];
    }

    // Check cache first
    const cacheKey = fen;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const polyglotKey = this.fenToPolyglotKey(fen);
    const moves = this.findPosition(polyglotKey);

    // Cache the result
    this.cache.set(cacheKey, moves);

    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return moves;
  }

  /**
   * Check if a position is in the book
   */
  async isInBook(fen) {
    const moves = await this.getBookMoves(fen);
    return moves.length > 0;
  }

  /**
   * Find the last move where the game was still in book
   * Returns the move index (0-based) where players left book
   */
  async getLastBookIndex(pgn) {
    if (!this.isInitialized) {
      await this.initialize();
      if (!this.isInitialized) return 0;
    }

    const game = new Chess();

    try {
      if (typeof pgn === 'string') {
        game.loadPgn(pgn);
      }

      const moves = game.history({ verbose: true });
      game.reset();

      let lastBookIndex = -1;

      for (let i = 0; i < moves.length; i++) {
        const currentFen = game.fen();
        const bookMoves = await this.getBookMoves(currentFen);

        // Check if the played move is in the book moves
        const playedMove = moves[i];
        game.move(playedMove);

        const playedUci = this.moveToUci(playedMove);
        const isBookMove = bookMoves.some(m => m.uci === playedUci);

        if (isBookMove) {
          lastBookIndex = i;
        } else {
          // Player left book at this move
          break;
        }
      }

      return lastBookIndex;

    } catch (error) {
      console.error('Error finding last book move:', error.message);
      return -1;
    }
  }

  /**
   * Convert a chess.js move object to UCI notation
   */
  moveToUci(move) {
    if (typeof move === 'string') return move;
    return move.from + move.to + (move.promotion || '');
  }

  /**
   * Check if a UCI move matches a book move (handles reversed format)
   */
  matchesBookMove(playedUci, bookUci) {
    // Direct match
    if (playedUci === bookUci) return true;

    // Try reversed format (e2e4 vs e4e2)
    const reversed = playedUci.substring(2, 4) + playedUci.substring(0, 2) + (playedUci.substring(4) || '');
    return reversed === bookUci;
  }

  /**
   * Get statistics about the book
   */
  getStatistics() {
    if (!this.isInitialized) {
      return {
        initialized: false,
        path: this.bookPath,
        size: 0,
        positions: 0
      };
    }

    return {
      initialized: true,
      path: this.bookPath,
      size: this.fileSize,
      positions: Math.floor(this.fileSize / this.recordSize),
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear the position cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Find book segments in a game (IN/OUT of book tracking)
   * Note: Book typically only contains positions where White is to move
   */
  async findBookSegments(pgn, minCountThreshold = 10) {
    if (!this.isInitialized) {
      await this.initialize();
      if (!this.isInitialized) return [];
    }

    const game = new Chess();

    try {
      if (typeof pgn === 'string') {
        game.loadPgn(pgn);
      }

      const moves = game.history({ verbose: true });
      game.reset();

      const segments = [];
      let currentState = 'OUT';
      let segmentStart = 0;
      // let lastKnownBookPly = -1; // Reserved for tracking deep book depth

      for (let i = 0; i < moves.length; i++) {
        const currentFen = game.fen();
        // const isWhiteTurn = game.turn() === 'w'; // Reserved for color-specific analysis

        // Check book for both colors (book may have some Black positions too)
        let isInBook = false;
        const bookMoves = await this.getBookMoves(currentFen);

        if (bookMoves.length > 0) {
          const playedMove = moves[i];
          const playedUci = this.moveToUci(playedMove);

          // Check if played move is a book move with sufficient data
          const bookMove = bookMoves.find(m => m.uci === playedUci);
          if (bookMove && bookMove.count >= minCountThreshold) {
            isInBook = true;
            // lastKnownBookPly = i; // Track for future use
          }
        }

        const newState = isInBook ? 'IN' : 'OUT';

        // State transition detected
        if (newState !== currentState) {
          // Save the previous segment
          if (i > 0) {
            segments.push({
              state: currentState,
              startPly: segmentStart,
              endPly: i - 1,
              moveCount: i - segmentStart
            });
          }

          // Start new segment
          currentState = newState;
          segmentStart = i;
        }

        game.move(moves[i]);
      }

      // Save the final segment
      if (moves.length > 0) {
        segments.push({
          state: currentState,
          startPly: segmentStart,
          endPly: moves.length - 1,
          moveCount: moves.length - segmentStart
        });
      }

      return segments;

    } catch (error) {
      console.error('Error finding book segments:', error.message);
      return [];
    }
  }
}

// Create singleton instance
let bookInstance = null;

/**
 * Get or create the singleton book instance
 */
function getPolyglotBook() {
  if (!bookInstance) {
    bookInstance = new PolyglotBook();
  }
  return bookInstance;
}

/**
 * Initialize the book service
 */
async function initializePolyglotBook() {
  const book = getPolyglotBook();
  await book.initialize();
  return book;
}

module.exports = {
  PolyglotBook,
  getPolyglotBook,
  initializePolyglotBook
};