// scripts/downloadWikiBooksAPI.js
const https = require('https');
const { Chess } = require('chess.js');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class WikiBooksAPIDownloader {
  constructor() {
    this.baseUrl = 'https://en.wikibooks.org/w/api.php';
    this.requestDelay = 1000; // 1 second between requests to be respectful
    this.downloadedPages = [];
  }

  /**
   * Make API request to WikiBooks
   */
  async makeAPIRequest(params) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}?${queryString}`;
    
    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`JSON parse error: ${error.message}`));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Get all pages in the Chess Opening Theory category using API
   */
  async getAllChessOpeningPages() {
    console.log('🔍 Discovering all Chess Opening Theory pages via API...');
    
    const allPages = [];
    let continueToken = null;
    
    do {
      const params = {
        action: 'query',
        format: 'json',
        list: 'categorymembers',
        cmtitle: 'Category:Book:Chess Opening Theory',
        cmlimit: 500, // Max allowed by API
        cmnamespace: 0 // Main namespace only
      };
      
      if (continueToken) {
        params.cmcontinue = continueToken;
      }
      
      try {
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        
        const response = await this.makeAPIRequest(params);
        
        if (response.query && response.query.categorymembers) {
          const pages = response.query.categorymembers
            .filter(page => page.title.startsWith('Chess Opening Theory/'))
            .map(page => ({
              pageid: page.pageid,
              title: page.title,
              url: `https://en.wikibooks.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
            }));
          
          allPages.push(...pages);
          console.log(`   Found batch of ${pages.length} pages (total: ${allPages.length})`);
        }
        
        // Check for continuation
        continueToken = response.continue ? response.continue.cmcontinue : null;
        
      } catch (error) {
        console.error('Error fetching category members:', error.message);
        break;
      }
      
    } while (continueToken);
    
    console.log(`✅ Discovered ${allPages.length} Chess Opening Theory pages`);
    return allPages;
  }

  /**
   * Download content for multiple pages using API
   */
  async downloadPagesContent(pages) {
    console.log(`📥 Downloading content for ${pages.length} pages...`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Process in batches of 50 for the API
    const batchSize = 50;
    
    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize);
      const titles = batch.map(page => page.title);
      
      try {
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        
        const params = {
          action: 'query',
          format: 'json',
          titles: titles.join('|'),
          prop: 'extracts',
          explaintext: '1',
          exsectionformat: 'plain'
        };
        
        const response = await this.makeAPIRequest(params);
        
        if (response.query && response.query.pages) {
          for (const [pageId, pageData] of Object.entries(response.query.pages)) {
            if (pageData.extract && pageData.title) {
              const parsed = this.parseChessOpeningPage(pageData);
              if (parsed) {
                results.push(parsed);
                successCount++;
              } else {
                errorCount++;
              }
            } else {
              console.log(`⚠️  No content for: ${pageData.title || 'Unknown'}`);
              errorCount++;
            }
          }
        }
        
        console.log(`   Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pages.length / batchSize)} (${successCount} success, ${errorCount} errors)`);
        
      } catch (error) {
        console.error(`❌ Error processing batch starting at ${i}:`, error.message);
        errorCount += batch.length;
      }
    }
    
    console.log(`🎉 Download complete! ${successCount} successful, ${errorCount} errors`);
    return results;
  }

  /**
   * Parse a WikiBooks chess opening page from API response
   */
  parseChessOpeningPage(pageData) {
    try {
      const title = pageData.title;
      const content = pageData.extract || '';
      
      // Extract move sequence from title
      const moveSequence = this.extractMoveSequenceFromTitle(title);
      
      // Calculate FEN position
      const fen = this.calculateFEN(moveSequence);
      if (!fen) {
        console.log(`Skipping ${title} - couldn't calculate FEN`);
        return null;
      }
      
      // Extract opening name
      const openingName = this.extractOpeningName(title, content);
      
      // Clean and extract theory text
      const theoryText = this.extractTheoryText(content);
      
      // Create URL
      const url = `https://en.wikibooks.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      
      return {
        pageId: pageData.pageid,
        title: title,
        url: url,
        moveSequence: moveSequence,
        fen: fen,
        epd: this.fenToEPD(fen),
        openingName: openingName,
        theoryText: theoryText,
        moveCount: moveSequence ? moveSequence.split(' ').filter(m => m.trim()).length : 0
      };
      
    } catch (error) {
      console.error(`Error parsing page ${pageData.title}:`, error.message);
      return null;
    }
  }

  /**
   * Extract move sequence from WikiBooks title
   */
  extractMoveSequenceFromTitle(title) {
    // Title format: "Chess Opening Theory/1. e4/1...e5/2. Nf3/2...Nc6"
    const pathMatch = title.match(/Chess Opening Theory\/(.*?)$/);
    if (!pathMatch) return '';
    
    const pathParts = pathMatch[1].split('/');
    const moves = [];
    
    for (const part of pathParts) {
      // Handle move notation like "1. e4", "1...e5", "2. Nf3"
      const moveMatch = part.match(/\d+\.(?:\.\.)?([a-zA-Z0-9+#=\-]+)/);
      if (moveMatch) {
        moves.push(moveMatch[1]);
      }
    }
    
    return moves.join(' ');
  }

  /**
   * Calculate FEN position from move sequence
   */
  calculateFEN(moveSequence) {
    if (!moveSequence || !moveSequence.trim()) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Starting position
    }
    
    try {
      const chess = new Chess();
      const moves = moveSequence.split(' ').filter(move => move.trim());
      
      for (const move of moves) {
        const result = chess.move(move);
        if (!result) {
          console.log(`Invalid move sequence: ${moveSequence} (failed at: ${move})`);
          return null;
        }
      }
      
      return chess.fen();
    } catch (error) {
      console.log(`Error calculating FEN for moves: ${moveSequence}`, error.message);
      return null;
    }
  }

  /**
   * Convert FEN to EPD (remove move counters)
   */
  fenToEPD(fen) {
    const parts = fen.split(' ');
    return parts.slice(0, 4).join(' ');
  }

  /**
   * Extract opening name from title and content
   */
  extractOpeningName(title, content) {
    // First try to extract from content - look for opening names
    const contentLines = content.split('\n');
    
    // Look for lines that might contain the opening name
    for (const line of contentLines.slice(0, 10)) { // Check first 10 lines
      if (line.includes('Opening') || line.includes('Defence') || line.includes('Defense') || 
          line.includes('Gambit') || line.includes('Attack') || line.includes('Variation')) {
        
        // Extract potential opening name
        const trimmed = line.trim();
        if (trimmed.length > 0 && trimmed.length < 100) {
          return trimmed;
        }
      }
    }
    
    // Fallback to parsing the title
    const pathMatch = title.match(/Chess Opening Theory\/(.*?)$/);
    if (pathMatch) {
      const pathParts = pathMatch[1].split('/');
      if (pathParts.length > 0) {
        // Take the first part and clean it up
        let name = pathParts[0].replace(/^1\._?/, '').trim();
        
        // Convert move notation to opening name if possible
        const moveToOpeningMap = {
          'e4': "King's Pawn Opening",
          'd4': "Queen's Pawn Opening", 
          'Nf3': "Réti Opening",
          'c4': "English Opening",
          'f4': "Bird's Opening",
          'b3': "Nimzowitsch-Larsen Attack"
        };
        
        return moveToOpeningMap[name] || name || 'Unknown Opening';
      }
    }
    
    return 'Unknown Opening';
  }

  /**
   * Extract and clean theory text
   */
  extractTheoryText(content) {
    if (!content) return '';
    
    // Split into paragraphs and filter out noise
    const paragraphs = content.split('\n')
      .map(line => line.trim())
      .filter(line => {
        // Filter out empty lines, headers, and navigation
        return line.length > 0 && 
               !line.startsWith('=') && 
               !line.includes('Retrieved from') &&
               !line.includes('Category:') &&
               !line.includes('ISBN') &&
               line.length > 20; // Minimum meaningful length
      });
    
    // Take the first few meaningful paragraphs (up to 500 characters)
    let theoryText = '';
    for (const paragraph of paragraphs) {
      if (theoryText.length + paragraph.length < 1000) {
        theoryText += paragraph + '\n\n';
      } else {
        break;
      }
    }
    
    return theoryText.trim();
  }

  /**
   * Save results to database
   */
  async saveToDatabase(results) {
    console.log(`💾 Saving ${results.length} positions to database...`);
    
    // Create table if it doesn't exist
    const { error: tableError } = await supabase.rpc('create_wikibooks_table');
    if (tableError && !tableError.message.includes('already exists')) {
      console.error('Error creating table:', tableError);
      return false;
    }
    
    // Insert in batches of 100
    const batchSize = 100;
    let saved = 0;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('wikibooks_positions')
        .upsert(batch.map(result => ({
          epd: result.epd,
          fen: result.fen,
          move_sequence: result.moveSequence,
          page_url: result.url,
          page_title: result.title,
          opening_name: result.openingName,
          theory_text: result.theoryText,
          in_book: true,
          move_count: result.moveCount
        })), {
          onConflict: 'epd',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`Error saving batch ${i}-${i + batchSize}:`, error);
      } else {
        saved += batch.length;
        console.log(`💾 Saved ${saved}/${results.length} positions`);
      }
    }
    
    console.log(`✅ Database save complete! ${saved} positions saved`);
    return true;
  }

  /**
   * Save to local file as backup
   */
  async saveToFile(results, filename = 'wikibooks_openings_api.json') {
    const fs = require('fs').promises;
    try {
      await fs.writeFile(filename, JSON.stringify(results, null, 2));
      console.log(`📁 Saved backup to ${filename}`);
    } catch (error) {
      console.error('Error saving to file:', error);
    }
  }

  /**
   * Main download function
   */
  async downloadAllOpeningTheory() {
    try {
      // Step 1: Get all page titles from the category
      const pages = await this.getAllChessOpeningPages();
      
      if (pages.length === 0) {
        throw new Error('No pages found in Chess Opening Theory category');
      }
      
      // Step 2: Download content for all pages
      const results = await this.downloadPagesContent(pages);
      
      // Step 3: Return results
      console.log(`🎉 API download complete!`);
      console.log(`📊 Statistics:`);
      console.log(`   - Total pages discovered: ${pages.length}`);
      console.log(`   - Successfully processed: ${results.length}`);
      console.log(`   - Unique openings: ${new Set(results.map(r => r.openingName)).size}`);
      console.log(`   - Average theory length: ${Math.round(results.reduce((sum, r) => sum + r.theoryText.length, 0) / results.length)} characters`);
      
      return results;
      
    } catch (error) {
      console.error('❌ API download failed:', error);
      throw error;
    }
  }
}

// Main execution function
async function main() {
  const downloader = new WikiBooksAPIDownloader();
  
  try {
    console.log('🚀 Starting WikiBooks API download...\n');
    
    // Download all opening theory via API
    const results = await downloader.downloadAllOpeningTheory();
    
    // Save backup to file
    await downloader.saveToFile(results);
    
    // Save to database
    await downloader.saveToDatabase(results);
    
    console.log('\n🎉 WikiBooks API download complete!');
    
  } catch (error) {
    console.error('❌ Download failed:', error);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = { WikiBooksAPIDownloader };

// Run if called directly
if (require.main === module) {
  main();
}