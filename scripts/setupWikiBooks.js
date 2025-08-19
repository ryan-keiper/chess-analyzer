// scripts/setupWikiBooks.js
require('dotenv').config();

const { WikiBooksAPIDownloader } = require('./downloadWikiBooksAPI');
const { WikiBooksDetector } = require('../src/services/wikiBooksDetector');
const { analyzeGame } = require('../src/services/chessAnalyzer');

async function setupWikiBooks() {
  console.log('🚀 Starting WikiBooks Chess Opening Setup...\n');

  try {
    // Step 1: Download WikiBooks data via API
    console.log('📥 Step 1: Downloading WikiBooks chess opening theory via API...');
    const downloader = new WikiBooksAPIDownloader();
    
    // Download all pages from the category
    const results = await downloader.downloadAllOpeningTheory();
    
    if (results.length === 0) {
      throw new Error('No opening theory downloaded');
    }

    console.log(`✅ Downloaded ${results.length} opening positions\n`);

    // Step 2: Save to database with improved duplicate handling
    console.log('💾 Step 2: Saving to database with duplicate detection...');
    await downloader.saveToDatabase(results);
    console.log('✅ Database save complete\n');

    // Step 3: Test the system
    console.log('🧪 Step 3: Testing the system...');
    await testSystem();
    
    console.log('\n🎉 WikiBooks setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run more comprehensive download with: node scripts/downloadWikiBooks.js');
    console.log('2. Integrate with your existing chess analysis routes');
    console.log('3. Update your frontend to handle book/strategic phase separation');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

async function testSystem() {
  const detector = new WikiBooksDetector();

  // Test 1: Check starting position
  console.log('   Testing starting position...');
  const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  try {
    const isInBook = await detector.isPositionInBook(startingFen);
    console.log(`   Starting position in book: ${isInBook ? '✅' : '❌'}`);

    // Test 2: Get theory for starting position
    console.log('   Getting theory for starting position...');
    const theory = await detector.getPositionTheory(startingFen);
    if (theory) {
      console.log(`   Theory found: ${theory.opening_name}`);
    } else {
      console.log('   ⚠️  No theory found for starting position');
    }
  } catch (error) {
    console.log(`   ❌ Error testing starting position: ${error.message}`);
  }

  // Test 3: Analyze a simple game (with error handling)
  console.log('   Testing game analysis...');
  const testPgn = `[Event "Test Game"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7`;

  try {
    const analysis = await analyzeGame(testPgn);
    console.log(`   ✅ Analysis complete:`);
    console.log(`      Opening: ${analysis.opening || 'Unknown'}`);
    console.log(`      Positions analyzed: ${analysis.positions?.length || 0}`);
    console.log(`      Game phases detected: ${analysis.phases ? Object.keys(analysis.phases).join(', ') : 'None'}`);
  } catch (error) {
    console.log(`   ❌ Analysis failed: ${error.message}`);
  }

  // Test 4: Search openings (with error handling)
  console.log('   Testing opening search...');
  try {
    const searchResults = await detector.searchOpenings('Ruy Lopez', 5);
    console.log(`   Found ${searchResults.length} Ruy Lopez variations`);
  } catch (error) {
    console.log(`   ❌ Search failed: ${error.message}`);
  }

  // Test 5: Get opening statistics (with error handling)
  console.log('   Getting opening statistics...');
  try {
    const stats = await detector.getOpeningStatistics();
    console.log(`   Database contains ${stats.length} different openings`);
    if (stats.length > 0) {
      console.log(`   Most popular: ${stats[0].opening_name} (${stats[0].position_count} positions)`);
    }
  } catch (error) {
    console.log(`   ❌ Statistics failed: ${error.message}`);
  }
}

// Package.json script helper
async function quickTest() {
  console.log('🧪 Quick WikiBooks Test...\n');
  
  try {
    const detector = new WikiBooksDetector();
    
    // Test if the system is working
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const isWorking = await detector.isPositionInBook(startingFen);
    
    if (isWorking) {
      console.log('✅ WikiBooks system is working!');
      
      const stats = await detector.getOpeningStatistics();
      console.log(`📊 Database contains ${stats.length} openings`);
      
      if (stats.length > 0) {
        console.log('\n🔝 Top 5 openings by position count:');
        stats.slice(0, 5).forEach((opening, i) => {
          console.log(`   ${i + 1}. ${opening.opening_name}: ${opening.position_count} positions`);
        });
      }
    } else {
      console.log('❌ WikiBooks system not set up. Run: npm run setup-wikibooks');
      process.exit(1);
    }
  } catch (error) {
    console.log(`❌ WikiBooks test failed: ${error.message}`);
    console.log('💡 Try running: npm run setup-wikibooks');
    process.exit(1);
  }
}

// Enhanced function to check for duplicate analysis using your table structure
async function analyzeDuplicates() {
  console.log('🔍 Analyzing potential transpositions in database...\n');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Find duplicate EPDs using your enhanced table
    const { data: duplicates, error } = await supabase
      .from('wikibooks_positions')
      .select('epd, opening_name, page_title, move_sequence, opening_category, content_length, wikibooks_pageid')
      .order('epd');
    
    if (error) {
      throw error;
    }
    
    // Group by EPD to find duplicates
    const epdGroups = {};
    duplicates.forEach(record => {
      if (!epdGroups[record.epd]) {
        epdGroups[record.epd] = [];
      }
      epdGroups[record.epd].push(record);
    });
    
    // Find actual duplicates
    const actualDuplicates = Object.entries(epdGroups)
      .filter(([epd, records]) => records.length > 1);
    
    console.log(`📊 Transposition Analysis Results:`);
    console.log(`   Total positions: ${duplicates.length}`);
    console.log(`   Unique EPDs: ${Object.keys(epdGroups).length}`);
    console.log(`   Transpositions found: ${actualDuplicates.length}`);
    
    // Analyze by opening category
    const categoryStats = {};
    actualDuplicates.forEach(([epd, records]) => {
      records.forEach(record => {
        const category = record.opening_category || 'unknown';
        if (!categoryStats[category]) {
          categoryStats[category] = 0;
        }
        categoryStats[category]++;
      });
    });
    
    console.log('\n📊 Transpositions by opening category:');
    Object.entries(categoryStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} transposed positions`);
      });
    
    if (actualDuplicates.length > 0) {
      console.log('\n🔄 Top 10 transpositions:');
      actualDuplicates.slice(0, 10).forEach(([epd, records], i) => {
        console.log(`\n${i + 1}. EPD: ${epd.substring(0, 50)}...`);
        console.log(`   Reached by ${records.length} different move sequences:`);
        records.forEach(record => {
          console.log(`   - ${record.move_sequence} (${record.opening_name}) [PageID: ${record.wikibooks_pageid}]`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Duplicate analysis failed:', error.message);
  }
}

// Enhanced resumable download function
async function resumeDownload() {
  console.log('🔄 Resuming WikiBooks download...\n');
  
  try {
    const downloader = new WikiBooksAPIDownloader();
    
    // Get current database state
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: existing, error } = await supabase
      .from('wikibooks_positions')
      .select('page_title');
    
    if (error) {
      console.error('❌ Error checking existing records:', error);
      return;
    }
    
    const existingTitles = new Set(existing.map(record => record.page_title));
    console.log(`📊 Found ${existingTitles.size} existing records in database`);
    
    // Discover all pages
    const allPages = await downloader.getAllChessOpeningPages();
    console.log(`📊 Found ${allPages.length} total pages on WikiBooks`);
    
    // Filter out already downloaded pages
    const newPages = allPages.filter(page => !existingTitles.has(page.title));
    console.log(`📊 ${newPages.length} new pages to download`);
    
    if (newPages.length === 0) {
      console.log('✅ All pages already downloaded!');
      return;
    }
    
    // Download only new pages
    const results = await downloader.downloadPagesContent(newPages);
    
    if (results.length > 0) {
      console.log(`💾 Saving ${results.length} new positions...`);
      await downloader.saveToDatabase(results);
      console.log('✅ Resume download complete!');
    }
    
  } catch (error) {
    console.error('❌ Resume download failed:', error);
  }
}

// Export functions for different use cases
module.exports = {
  setupWikiBooks,
  testSystem,
  quickTest,
  analyzeDuplicates,
  resumeDownload
};

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'setup':
      setupWikiBooks();
      break;
    case 'test':
      quickTest();
      break;
    case 'duplicates':
      analyzeDuplicates();
      break;
    case 'resume':
      resumeDownload();
      break;
    default:
      console.log('Usage:');
      console.log('  node scripts/setupWikiBooks.js setup      - Full setup with download');
      console.log('  node scripts/setupWikiBooks.js test       - Quick test of existing setup');
      console.log('  node scripts/setupWikiBooks.js duplicates - Analyze transpositions');
      console.log('  node scripts/setupWikiBooks.js resume     - Resume incomplete download');
  }
}