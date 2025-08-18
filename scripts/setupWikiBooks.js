// scripts/setupWikiBooks.js
require('dotenv').config();

const { WikiBooksAPIDownloader } = require('./downloadWikiBooksAPI');
const { WikiBooksDetector } = require('../src/services/wikiBooksDetector');
const { EnhancedChessAnalyzer } = require('../src/services/enhancedChessAnalyzer');

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

    // Step 2: Save to database
    console.log('💾 Step 2: Saving to database...');
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
  const analyzer = new EnhancedChessAnalyzer();

  // Test 1: Check starting position
  console.log('   Testing starting position...');
  const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
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

  // Test 3: Analyze a simple game
  console.log('   Testing game analysis...');
  const testPgn = `[Event "Test Game"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7`;

  try {
    const analysis = await analyzer.analyzeGame(testPgn);
    console.log(`   ✅ Analysis complete:`);
    console.log(`      Opening: ${analysis.gameInfo.opening}`);
    console.log(`      Book moves: ${analysis.summary.bookMoves}`);
    console.log(`      Strategic moves: ${analysis.summary.strategicMoves}`);
    console.log(`      Analysis scope: ${analysis.summary.analysisScope.bookPhase}`);
  } catch (error) {
    console.log(`   ❌ Analysis failed: ${error.message}`);
  }

  // Test 4: Search openings
  console.log('   Testing opening search...');
  const searchResults = await detector.searchOpenings('Ruy Lopez', 5);
  console.log(`   Found ${searchResults.length} Ruy Lopez variations`);

  // Test 5: Get opening statistics
  console.log('   Getting opening statistics...');
  const stats = await detector.getOpeningStatistics();
  console.log(`   Database contains ${stats.length} different openings`);
  if (stats.length > 0) {
    console.log(`   Most popular: ${stats[0].opening_name} (${stats[0].position_count} positions)`);
  }
}

// Package.json script helper
async function quickTest() {
  console.log('🧪 Quick WikiBooks Test...\n');
  
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
}

// Export functions for different use cases
module.exports = {
  setupWikiBooks,
  testSystem,
  quickTest
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
    default:
      console.log('Usage:');
      console.log('  node scripts/setupWikiBooks.js setup  - Full setup with download');
      console.log('  node scripts/setupWikiBooks.js test   - Quick test of existing setup');
  }
}