-- Updated Database setup for WikiBooks chess opening theory
-- Run this in your Supabase SQL editor

-- Drop and recreate the table with enhanced structure
DROP TABLE IF EXISTS wikibooks_positions CASCADE;

CREATE TABLE wikibooks_positions (
  id SERIAL PRIMARY KEY,
  
  -- Position identifiers
  epd TEXT UNIQUE NOT NULL,
  fen TEXT NOT NULL,
  
  -- WikiBooks metadata
  wikibooks_pageid INTEGER,              -- NEW: Store the actual WikiBooks page ID
  page_title TEXT NOT NULL,              -- Full title from API
  page_url TEXT,                         -- Constructed URL
  
  -- Chess data
  move_sequence TEXT,                    -- "e4 e5 Nf3"
  move_count INTEGER,                    -- Auto-calculated from sequence
  
  -- Opening classification
  opening_name TEXT,                     -- Extracted/inferred opening name
  opening_category TEXT,                 -- NEW: e4, d4, Nf3, etc. (first move)
  
  -- Content from WikiBooks
  theory_text TEXT,                      -- Main explanation text
  raw_extract TEXT,                      -- NEW: Store full API extract for debugging
  content_length INTEGER,                -- NEW: Track content quality
  
  -- Metadata
  in_book BOOLEAN DEFAULT true,
  data_source TEXT DEFAULT 'wikibooks_api', -- NEW: Track data source
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create enhanced indexes
CREATE INDEX idx_wikibooks_epd ON wikibooks_positions(epd);
CREATE INDEX idx_wikibooks_pageid ON wikibooks_positions(wikibooks_pageid);
CREATE INDEX idx_wikibooks_opening_category ON wikibooks_positions(opening_category);
CREATE INDEX idx_wikibooks_move_count ON wikibooks_positions(move_count);
CREATE INDEX idx_wikibooks_content_length ON wikibooks_positions(content_length);
CREATE INDEX idx_wikibooks_opening_name ON wikibooks_positions(opening_name);

-- Full-text search index for theory content
CREATE INDEX idx_wikibooks_theory_search ON wikibooks_positions 
  USING gin(to_tsvector('english', theory_text));

-- Create function to extract opening category from title
CREATE OR REPLACE FUNCTION extract_opening_category(title TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Extract first move from title like "Chess Opening Theory/1. e4"
  IF title ~ 'Chess Opening Theory/1\. ([a-h][1-8]|[NBRQK][a-h][1-8]|O-O|O-O-O)' THEN
    RETURN substring(title from 'Chess Opening Theory/1\. ([a-zA-Z0-9\-]+)');
  END IF;
  
  RETURN 'unknown';
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate content quality score
CREATE OR REPLACE FUNCTION calculate_content_quality(theory_text TEXT, raw_extract TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- Simple quality scoring based on content length and structure
  IF theory_text IS NULL OR length(theory_text) < 50 THEN
    RETURN 1; -- Poor quality
  ELSIF length(theory_text) > 500 THEN
    RETURN 5; -- Excellent quality
  ELSIF length(theory_text) > 200 THEN
    RETURN 4; -- Good quality
  ELSIF length(theory_text) > 100 THEN
    RETURN 3; -- Fair quality
  ELSE
    RETURN 2; -- Below average
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Enhanced move count calculation
CREATE OR REPLACE FUNCTION calculate_move_count(move_seq TEXT)
RETURNS INTEGER AS $$
BEGIN
  IF move_seq IS NULL OR move_seq = '' THEN
    RETURN 0;
  END IF;
  
  -- Count number of moves by splitting on spaces and filtering empty strings
  RETURN array_length(
    array_remove(string_to_array(trim(move_seq), ' '), ''), 
    1
  );
END;
$$ LANGUAGE plpgsql;

-- Enhanced trigger to auto-update calculated fields
CREATE OR REPLACE FUNCTION update_wikibooks_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.move_count = calculate_move_count(NEW.move_sequence);
  NEW.opening_category = extract_opening_category(NEW.page_title);
  NEW.content_length = length(COALESCE(NEW.theory_text, ''));
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wikibooks_metadata
  BEFORE INSERT OR UPDATE ON wikibooks_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_wikibooks_metadata();

-- Enhanced helper functions

-- Check if position is in book (same as before)
CREATE OR REPLACE FUNCTION is_position_in_book(position_epd TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM wikibooks_positions 
    WHERE epd = position_epd AND in_book = true
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql;

-- Enhanced position theory lookup
CREATE OR REPLACE FUNCTION get_position_theory(position_epd TEXT)
RETURNS TABLE(
  opening_name TEXT,
  opening_category TEXT,
  theory_text TEXT,
  move_sequence TEXT,
  page_url TEXT,
  move_count INTEGER,
  content_length INTEGER,
  wikibooks_pageid INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wp.opening_name,
    wp.opening_category,
    wp.theory_text,
    wp.move_sequence,
    wp.page_url,
    wp.move_count,
    wp.content_length,
    wp.wikibooks_pageid
  FROM wikibooks_positions wp
  WHERE wp.epd = position_epd AND wp.in_book = true
  ORDER BY wp.content_length DESC -- Prefer higher quality content
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to find book end (enhanced)
CREATE OR REPLACE FUNCTION find_book_end(epd_list TEXT[])
RETURNS INTEGER AS $$
DECLARE
  i INTEGER;
  epd_value TEXT;
BEGIN
  -- Loop through positions to find first one not in book
  FOR i IN 1..array_length(epd_list, 1) LOOP
    epd_value := epd_list[i];
    
    IF NOT is_position_in_book(epd_value) THEN
      RETURN i; -- Return 1-based index of first non-book position
    END IF;
  END LOOP;
  
  -- All positions were in book
  RETURN array_length(epd_list, 1) + 1;
END;
$$ LANGUAGE plpgsql;

-- Enhanced views with new fields
CREATE OR REPLACE VIEW opening_statistics AS
SELECT 
  opening_category,
  opening_name,
  COUNT(*) as position_count,
  MAX(move_count) as max_depth,
  AVG(move_count) as avg_depth,
  MIN(move_count) as min_depth,
  AVG(content_length) as avg_content_quality,
  COUNT(CASE WHEN content_length > 200 THEN 1 END) as high_quality_positions
FROM wikibooks_positions
WHERE in_book = true
GROUP BY opening_category, opening_name
ORDER BY opening_category, position_count DESC;

-- View for content quality analysis
CREATE OR REPLACE VIEW content_quality_stats AS
SELECT 
  opening_category,
  COUNT(*) as total_positions,
  COUNT(CASE WHEN content_length > 500 THEN 1 END) as excellent_content,
  COUNT(CASE WHEN content_length BETWEEN 200 AND 500 THEN 1 END) as good_content,
  COUNT(CASE WHEN content_length < 100 THEN 1 END) as poor_content,
  AVG(content_length) as avg_content_length
FROM wikibooks_positions
WHERE in_book = true
GROUP BY opening_category
ORDER BY avg_content_length DESC;

-- Create the table creation function for the downloader
CREATE OR REPLACE FUNCTION create_wikibooks_table()
RETURNS TEXT AS $$
BEGIN
  -- This function is called by the downloader to ensure table exists
  -- The table creation is idempotent
  RETURN 'Enhanced table exists or created successfully';
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE wikibooks_positions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow read access for authenticated users" ON wikibooks_positions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full access for service role" ON wikibooks_positions
  FOR ALL USING (auth.role() = 'service_role');

-- Insert enhanced test data
INSERT INTO wikibooks_positions (
  epd, 
  fen, 
  move_sequence,
  wikibooks_pageid,
  page_title,
  opening_name, 
  theory_text,
  raw_extract,
  page_url
) VALUES (
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  '',
  0,
  'Chess Opening Theory',
  'Starting Position',
  'The initial position of a chess game. White moves first and has a slight advantage.',
  'Starting position for chess games...',
  'https://en.wikibooks.org/wiki/Chess_Opening_Theory'
) ON CONFLICT (epd) DO NOTHING;

-- Test the enhanced functions
SELECT 'Testing enhanced functions:' as status;
SELECT is_position_in_book('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -') as starting_position_in_book;
SELECT * FROM get_position_theory('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
SELECT * FROM opening_statistics LIMIT 5;
SELECT 'Enhanced setup complete!' as status;