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
   * Make API request to WikiBooks with proper User-Agent header
   */
  async makeAPIRequest(params) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}?${queryString}`;
    
    console.log(`🌐 Making API request: ${url}`);
    
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'ChessAnalyzer/1.0 Node.js'
        }
      };
      
      const request = https.get(url, options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          console.log(`📡 API Response Status: ${response.statusCode}`);
          console.log(`📡 Raw response (first 200 chars): ${data.substring(0, 200)}`);
          
          // Check if response is HTML (error page)
          if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
            reject(new Error(`API returned HTML instead of JSON. Status: ${response.statusCode}. Response: ${data.substring(0, 500)}`));
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            console.error(`❌ JSON parse error. Raw data: ${data.substring(0, 500)}`);
            reject(new Error(`JSON parse error: ${error.message}`));
          }
        });
      });
      
      request.on('error', (error) => {
        console.error(`❌ Request error: ${error.message}`);
        reject(error);
      });
      
      request.setTimeout(15000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Get all pages in the Chess Opening Theory category using API with multiple fallback strategies
   */
  async getAllChessOpeningPages() {
    console.log('🔍 Discovering all Chess Opening Theory pages via API...');
    
    // Try the correct category name first
    const categoryNames = [
      'Category:Book:Chess Opening Theory',  // This is the correct one!
      'Category:Chess Opening Theory',       // Your original attempt
      'Category:Chess/Opening theory',
      'Category:Chess openings'
    ];
    
    for (const categoryName of categoryNames) {
      console.log(`🔍 Trying category: ${categoryName}`);
      
      try {
        const pages = await this.getCategoryMembers(categoryName);
        if (pages.length > 0) {
          console.log(`✅ Found ${pages.length} pages in ${categoryName}`);
          return pages;
        }
      } catch (error) {
        console.log(`⚠️ Failed to get pages from ${categoryName}: ${error.message}`);
      }
    }
    
    // Fallback: Search for pages with "Chess Opening Theory" in title
    console.log('🔍 Fallback: Searching for pages by title pattern...');
    return await this.searchPagesByTitle();
  }

  /**
   * Get category members for a specific category
   */
  async getCategoryMembers(categoryName) {
    const allPages = [];
    let continueToken = null;
    
    do {
      const params = {
        action: 'query',
        format: 'json',
        list: 'categorymembers',
        cmtitle: categoryName,
        cmlimit: 500,
        cmnamespace: 0 // Main namespace only
      };
      
      if (continueToken) {
        params.cmcontinue = continueToken;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      
      const response = await this.makeAPIRequest(params);
      
      if (response.query && response.query.categorymembers) {
        const pages = response.query.categorymembers
          .filter(page => page.title.includes('Chess Opening Theory'))
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
      
    } while (continueToken);
    
    return allPages;
  }

  /**
   * Fallback: Search for pages by title pattern
   */
  async searchPagesByTitle() {
    console.log('🔍 Searching for Chess Opening Theory pages by title...');
    
    const allPages = [];
    let continueToken = null;
    
    do {
      const params = {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: 'intitle:"Chess Opening Theory"',
        srnamespace: 0,
        srlimit: 500
      };
      
      if (continueToken) {
        params.sroffset = continueToken;
      }
      
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      
      const response = await this.makeAPIRequest(params);
      
      if (response.query && response.query.search) {
        const pages = response.query.search
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
      continueToken = response.continue ? response.continue.sroffset : null;
      
    } while (continueToken && allPages.length < 3000); // Safety limit
    
    return allPages;
  }

  /**
   * Download content for multiple pages using individual API requests
   * (Required because batch requests only return full extract for one page)
   */
  async downloadPagesContent(pages) {
    console.log(`📥 Downloading content for ${pages.length} pages individually...`);
    console.log(`⏰ This will take approximately ${Math.ceil(pages.length * this.requestDelay / 1000 / 60)} minutes with rate limiting`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Process each page individually
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      try {
        console.log(`📄 Processing ${i + 1}/${pages.length}: ${page.title}`);
        
        // Rate limiting - wait before each request
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
        
        // Get individual page content
        const pageContent = await this.downloadSinglePage(page);
        
        if (pageContent) {
          const parsed = this.parseChessOpeningPage(pageContent);
          if (parsed) {
            results.push(parsed);
            successCount++;
            
            // Progress update every 10 pages
            if ((i + 1) % 10 === 0) {
              console.log(`   ✅ Progress: ${i + 1}/${pages.length} processed (${successCount} success, ${errorCount} errors)`);
            }
          } else {
            errorCount++;
            console.log(`   ⚠️ Failed to parse: ${page.title}`);
          }
        } else {
          errorCount++;
          console.log(`   ❌ No content retrieved: ${page.title}`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error processing ${page.title}:`, error.message);
      }
    }
    
    console.log(`🎉 Individual download complete! ${successCount} successful, ${errorCount} errors`);
    return results;
  }

  /**
   * Download content for a single page
   */
  async downloadSinglePage(page) {
    try {
      const params = {
        action: 'query',
        format: 'json',
        titles: page.title,
        prop: 'extracts',
        explaintext: '1',
        exsectionformat: 'plain'
      };
      
      const response = await this.makeAPIRequest(params);
      
      if (response.query && response.query.pages) {
        // Get the first (and only) page from the response
        const pageId = Object.keys(response.query.pages)[0];
        const pageData = response.query.pages[pageId];
        
        if (pageData && pageData.extract) {
          return {
            pageid: pageData.pageid || page.pageid,
            title: pageData.title || page.title,
            extract: pageData.extract
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.error(`Error downloading ${page.title}:`, error.message);
      return null;
    }
  }

  /**
   * Parse a WikiBooks chess opening page from API response
   * Enhanced to capture more data for your table structure
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
        pageId: pageData.pageid, // This will map to wikibooks_pageid
        title: title,
        url: url,
        moveSequence: moveSequence,
        fen: fen,
        epd: this.fenToEPD(fen),
        openingName: openingName,
        theoryText: theoryText,
        rawExtract: content, // Store the full raw extract for debugging
        moveCount: moveSequence ? moveSequence.split(' ').filter(m => m.trim()).length : 0
      };
      
    } catch (error) {
      console.error(`Error parsing page ${pageData.title}:`, error.message);
      return null;
    }
  }

  /**
   * Extract move sequence from WikiBooks title - FIXED version
   */
  extractMoveSequenceFromTitle(title) {
    // Title format: "Chess Opening Theory/1. d4/1...d5/2. e3/2...Nf6/3. c4/3...dxc4/4. Bxc4"
    const pathMatch = title.match(/Chess Opening Theory\/(.*?)$/);
    if (!pathMatch) return '';
    
    const pathParts = pathMatch[1].split('/');
    const moves = [];
    
    for (const part of pathParts) {
      const trimmed = part.trim();
      
      // Handle White moves: "1. d4", "2. e3", etc.
      const whiteMoveMatch = trimmed.match(/^\d+\.\s*([a-zA-Z0-9+#=\-O]+)$/);
      if (whiteMoveMatch) {
        moves.push(whiteMoveMatch[1]);
        continue;
      }
      
      // Handle Black moves: "1...d5", "2...Nf6", etc.
      const blackMoveMatch = trimmed.match(/^\d+\.{3}\s*([a-zA-Z0-9+#=\-O]+)$/);
      if (blackMoveMatch) {
        moves.push(blackMoveMatch[1]);
        continue;
      }
      
      // Handle standalone moves (fallback)
      if (trimmed.match(/^[a-zA-Z0-9+#=\-O]+$/)) {
        moves.push(trimmed);
      }
    }
    
    console.log(`🔍 Title: ${title}`);
    console.log(`🔍 Extracted moves: [${moves.join(', ')}]`);
    
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
   * FIXED: Save results to database with proper duplicate handling
   * Uses your enhanced table structure with all the new fields
   */
  async saveToDatabase(results) {
    console.log(`💾 Saving ${results.length} positions to database...`);
    
    let saved = 0;
    let duplicates = 0;
    let errors = 0;
    
    // Process each record individually to handle duplicates gracefully
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      try {
        // Map to your enhanced table structure
        const recordData = {
          epd: result.epd,
          fen: result.fen,
          wikibooks_pageid: result.pageId,
          page_title: result.title,
          page_url: result.url,
          move_sequence: result.moveSequence,
          opening_name: result.openingName,
          theory_text: result.theoryText,
          raw_extract: result.rawExtract || result.theoryText, // Store full extract
          in_book: true,
          data_source: 'wikibooks_api'
          // move_count, opening_category, content_length auto-calculated by triggers
        };
        
        // Try to insert the record
        const { error } = await supabase
          .from('wikibooks_positions')
          .insert(recordData);
        
        if (error) {
          // Check if it's a duplicate key error
          if (error.code === '23505' || error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
            duplicates++;
            console.log(`⚠️ Duplicate EPD found: ${result.epd.substring(0, 50)}... (${result.title})`);
            
            // Update existing record with potentially better info (longer theory text, etc.)
            const { error: updateError } = await supabase
              .from('wikibooks_positions')
              .update({
                wikibooks_pageid: recordData.wikibooks_pageid,
                page_url: recordData.page_url,
                page_title: recordData.page_title,
                opening_name: recordData.opening_name,
                theory_text: recordData.theory_text,
                raw_extract: recordData.raw_extract,
                data_source: recordData.data_source
              })
              .eq('epd', recordData.epd);
            
            if (!updateError) {
              console.log(`✅ Updated existing record for EPD: ${result.epd.substring(0, 50)}...`);
            }
          } else {
            errors++;
            console.error(`❌ Error saving record ${i + 1}:`, error.message);
          }
        } else {
          saved++;
        }
        
        // Progress update every 100 records
        if ((i + 1) % 100 === 0) {
          console.log(`💾 Progress: ${i + 1}/${results.length} processed (${saved} saved, ${duplicates} duplicates, ${errors} errors)`);
        }
        
      } catch (error) {
        errors++;
        console.error(`❌ Unexpected error saving record ${i + 1}:`, error.message);
      }
    }
    
    console.log(`✅ Database save complete!`);
    console.log(`📊 Final results:`);
    console.log(`   - Successfully saved: ${saved} new records`);
    console.log(`   - Duplicates found: ${duplicates} records`);
    console.log(`   - Errors: ${errors} records`);
    console.log(`   - Total processed: ${results.length} records`);
    
    return true;
  }

  /**
   * Alternative batch-based saving with duplicate handling
   */
  async saveToDatabaseBatch(results) {
    console.log(`💾 Saving ${results.length} positions to database using batch method...`);
    
    const batchSize = 50; // Smaller batches for better error handling
    let saved = 0;
    let duplicates = 0;
    let errors = 0;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      console.log(`💾 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(results.length / batchSize)}`);
      
      // Try batch insert first
      const batchData = batch.map(result => ({
        epd: result.epd,
        fen: result.fen,
        move_sequence: result.moveSequence,
        page_url: result.url,
        page_title: result.title,
        opening_name: result.openingName,
        theory_text: result.theoryText,
        in_book: true,
        move_count: result.moveCount
      }));
      
      const { error: batchError } = await supabase
        .from('wikibooks_positions')
        .insert(batchData);
      
      if (!batchError) {
        saved += batch.length;
        console.log(`✅ Batch saved successfully: ${batch.length} records`);
      } else {
        // Batch failed, process individually
        console.log(`⚠️ Batch failed, processing individually: ${batchError.message}`);
        
        for (const record of batchData) {
          try {
            const { error: singleError } = await supabase
              .from('wikibooks_positions')
              .insert(record);
            
            if (!singleError) {
              saved++;
            } else if (singleError.code === '23505' || singleError.message.includes('duplicate key')) {
              duplicates++;
            } else {
              errors++;
              console.error(`❌ Error saving individual record: ${singleError.message}`);
            }
          } catch (err) {
            errors++;
            console.error(`❌ Unexpected error: ${err.message}`);
          }
        }
      }
    }
    
    console.log(`✅ Batch save complete! ${saved} saved, ${duplicates} duplicates, ${errors} errors`);
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
   * Main download function with individual page requests
   */
  async downloadAllOpeningTheory() {
    try {
      console.log('🚀 Starting WikiBooks Chess Opening Theory download...\n');
      
      // Step 1: Get all page titles from the category
      console.log('📋 Step 1: Discovering all pages...');
      const pages = await this.getAllChessOpeningPages();
      
      if (pages.length === 0) {
        throw new Error('No pages found in Chess Opening Theory category');
      }
      
      console.log(`✅ Discovered ${pages.length} pages`);
      console.log(`⏰ Estimated download time: ${Math.ceil(pages.length * this.requestDelay / 1000 / 60)} minutes\n`);
      
      // Step 2: Download content for all pages individually
      console.log('📥 Step 2: Downloading individual page content...');
      const results = await this.downloadPagesContent(pages);
      
      // Step 3: Return results with statistics
      console.log(`\n🎉 Download complete!`);
      console.log(`📊 Statistics:`);
      console.log(`   - Total pages discovered: ${pages.length}`);
      console.log(`   - Successfully processed: ${results.length}`);
      console.log(`   - Success rate: ${Math.round((results.length / pages.length) * 100)}%`);
      console.log(`   - Unique openings: ${new Set(results.map(r => r.openingName)).size}`);
      console.log(`   - Average theory length: ${Math.round(results.reduce((sum, r) => sum + (r.theoryText?.length || 0), 0) / results.length)} characters`);
      
      // Check for potential transpositions
      const epds = results.map(r => r.epd);
      const uniqueEpds = new Set(epds);
      const transpositions = epds.length - uniqueEpds.size;
      console.log(`   - Potential transpositions: ${transpositions} positions`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Download failed:', error);
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
    
    // Save to database with improved duplicate handling
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