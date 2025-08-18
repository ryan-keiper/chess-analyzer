// scripts/importOpenings.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importOpenings() {
  try {
    console.log('📚 Reading openings data...');
    
    // Fix: Use path.join to handle relative paths properly
    const dataPath = path.join(__dirname, '..', 'data', 'complete-openings.json');
    const openingsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`Found ${openingsData.length} openings to import`);
    
    // Rest of the script stays the same...
    const formattedOpenings = openingsData.map(opening => ({
      eco_volume: opening['eco-volume'],
      eco: opening.eco,
      name: opening.name,
      pgn: opening.pgn,
      uci: opening.uci,
      epd: opening.epd
    }));
    
    console.log('🚀 Importing to database...');
    
    const batchSize = 1000;
    let imported = 0;
    
    for (let i = 0; i < formattedOpenings.length; i += batchSize) {
      const batch = formattedOpenings.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('chess_openings')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error importing batch ${Math.floor(i/batchSize) + 1}:`, error);
        throw error;
      }
      
      imported += batch.length;
      console.log(`✅ Imported ${imported}/${formattedOpenings.length} openings`);
    }
    
    console.log('🎉 Successfully imported all openings!');
    
    // Verify the import
    const { count, error: countError } = await supabase
      .from('chess_openings')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting openings:', countError);
    } else {
      console.log(`📊 Total openings in database: ${count}`);
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importOpenings();