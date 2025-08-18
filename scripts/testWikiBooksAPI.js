// scripts/testWikiBooksAPI.js
const https = require('https');

/**
 * Test script to demonstrate WikiBooks API access
 */

// Test 1: Get all Chess Opening Theory pages from category
async function testGetAllPages() {
  console.log('🔍 Test 1: Getting all Chess Opening Theory pages...\n');
  
  const url = 'https://en.wikibooks.org/w/api.php?' + new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'categorymembers',
    cmtitle: 'Category:Book:Chess Opening Theory',
    cmlimit: 10, // Just first 10 for demo
    cmnamespace: 0
  });
  
  try {
    const response = await makeRequest(url);
    const data = JSON.parse(response);
    
    if (data.query && data.query.categorymembers) {
      const pages = data.query.categorymembers.filter(page => 
        page.title.startsWith('Chess Opening Theory/')
      );
      
      console.log(`Found ${pages.length} Chess Opening Theory pages:`);
      pages.forEach((page, i) => {
        console.log(`  ${i + 1}. ${page.title}`);
      });
      
      console.log(`\n📊 Total pages in category: ${data.query.categorymembers.length}`);
      if (data.continue) {
        console.log('   (More pages available with continuation token)');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test 2: Get content for a specific page (your example)
async function testGetPageContent() {
  console.log('\n🔍 Test 2: Getting content for "Chess Opening Theory/1. e4"...\n');
  
  const url = 'https://en.wikibooks.org/w/api.php?' + new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: 'Chess Opening Theory/1. e4',
    prop: 'extracts',
    explaintext: '1'
  });
  
  try {
    const response = await makeRequest(url);
    const data = JSON.parse(response);
    
    if (data.query && data.query.pages) {
      const pageId = Object.keys(data.query.pages)[0];
      const page = data.query.pages[pageId];
      
      console.log(`Page: ${page.title}`);
      console.log(`Extract length: ${page.extract ? page.extract.length : 0} characters`);
      console.log(`\nFirst 300 characters:`);
      console.log(`"${page.extract ? page.extract.substring(0, 300) : 'No content'}..."`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test 3: Individual downloads (more reliable than batch)
async function testIndividualDownload() {
  console.log('\n🔍 Test 3: Individual downloading (reliable method)...\n');
  
  // Test with a few specific pages
  const titles = [
    'Chess Opening Theory/1. e4',
    'Chess Opening Theory/1. e4/1...e5',
    'Chess Opening Theory/1. e4/1...e5/2. Nf3',
    'Chess Opening Theory/1. d4'
  ];
  
  console.log(`Downloading ${titles.length} pages individually:`);
  
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    
    const url = 'https://en.wikibooks.org/w/api.php?' + new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: title,
      prop: 'extracts',
      explaintext: '1'
    });
    
    try {
      const response = await makeRequest(url);
      const data = JSON.parse(response);
      
      if (data.query && data.query.pages) {
        const pageId = Object.keys(data.query.pages)[0];
        const page = data.query.pages[pageId];
        
        console.log(`\n  📄 ${page.title}`);
        console.log(`     Content: ${page.extract ? page.extract.length : 0} chars`);
        
        if (page.extract && page.extract.length > 0) {
          console.log(`     ✅ Success`);
          
          // Extract move sequence from title
          const moveMatch = page.title.match(/Chess Opening Theory\/(.*?)$/);
          if (moveMatch) {
            console.log(`     Moves: ${moveMatch[1]}`);
          }
        } else {
          console.log(`     ❌ No content`);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error downloading ${title}:`, error.message);
    }
  }
}

// Test 4: Show what the parsed data would look like
async function testDataParsing() {
  console.log('\n🔍 Test 4: Demonstrating data parsing...\n');
  
  const testPage = {
    title: 'Chess Opening Theory/1. e4/1...e5/2. Nf3/2...Nc6',
    extract: `This is the Italian Game opening. White develops the knight to f3, attacking the black e5 pawn. Black responds with Nc6, defending the pawn and developing a piece. This opening leads to open, tactical games with quick development and central control.`
  };
  
  // Parse move sequence
  const moveMatch = testPage.title.match(/Chess Opening Theory\/(.*?)$/);
  const pathParts = moveMatch ? moveMatch[1].split('/') : [];
  const moves = [];
  
  for (const part of pathParts) {
    const moveMatch = part.match(/\d+\.(?:\.\.)?([a-zA-Z0-9+#=\-]+)/);
    if (moveMatch) {
      moves.push(moveMatch[1]);
    }
  }
  
  const moveSequence = moves.join(' ');
  
  console.log('📋 Parsed data structure:');
  console.log(`  Title: ${testPage.title}`);
  console.log(`  Move sequence: "${moveSequence}"`);
  console.log(`  Opening name: Italian Game`);
  console.log(`  Theory text: "${testPage.extract.substring(0, 100)}..."`);
  console.log(`  URL: https://en.wikibooks.org/wiki/${encodeURIComponent(testPage.title.replace(/ /g, '_'))}`);
  
  // Calculate FEN (would require chess.js in real implementation)
  console.log(`  FEN: [Would be calculated from moves: ${moveSequence}]`);
}

// Utility function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve(data);
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

// Main execution
async function main() {
  console.log('🧪 WikiBooks API Test Suite\n');
  console.log('This demonstrates how to systematically download WikiBooks chess opening theory.\n');
  
  await testGetAllPages();
  await testGetPageContent();
  await testIndividualDownload();
  await testDataParsing();
  
  console.log('\n✅ All tests complete!');
  console.log('\nKey advantages of API approach:');
  console.log('  ✅ Reliable - official API, not fragile scraping');
  console.log('  ✅ Complete - gets ALL pages in category systematically');
  console.log('  ✅ Efficient - batch downloads up to 50 pages per request');
  console.log('  ✅ Clean data - structured JSON response');
  console.log('  ✅ Respectful - built-in rate limiting');
}

if (require.main === module) {
  main();
}