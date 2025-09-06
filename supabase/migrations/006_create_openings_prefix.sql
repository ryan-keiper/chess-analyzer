-- Migration: Create openings_prefix table for move-order based lookups
-- This table maps each opening line to all of its prefixes for longest-prefix matching

-- Create the prefix table
CREATE TABLE IF NOT EXISTS openings_prefix (
  line_id INT REFERENCES chess_openings(id) ON DELETE CASCADE,
  prefix_plies INT NOT NULL,                -- Number of moves in this prefix (1..ply_depth)
  prefix_uci TEXT NOT NULL,                 -- First k UCI moves (space-separated)
  prefix_hash TEXT NOT NULL,                -- SHA hash of prefix_uci for fast lookup
  PRIMARY KEY (line_id, prefix_plies)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_openings_prefix_hash ON openings_prefix(prefix_hash);
CREATE INDEX IF NOT EXISTS idx_openings_prefix_plies ON openings_prefix(prefix_plies);
CREATE INDEX IF NOT EXISTS idx_openings_prefix_line_id ON openings_prefix(line_id);

-- Function to populate prefix table for a single opening line
CREATE OR REPLACE FUNCTION populate_opening_prefixes(opening_id INT)
RETURNS INT AS $$
DECLARE
  opening_record RECORD;
  uci_moves TEXT[];
  prefix_moves TEXT;
  i INT;
  inserted_count INT := 0;
BEGIN
  -- Get the opening record
  SELECT id, uci, ply_depth 
  INTO opening_record
  FROM chess_openings 
  WHERE id = opening_id;
  
  IF NOT FOUND OR opening_record.uci IS NULL OR opening_record.uci = '' THEN
    RETURN 0;
  END IF;
  
  -- Split UCI moves into array
  uci_moves := string_to_array(trim(opening_record.uci), ' ');
  
  -- Delete existing prefixes for this line
  DELETE FROM openings_prefix WHERE line_id = opening_id;
  
  -- Generate prefixes from 1 to ply_depth
  FOR i IN 1..array_length(uci_moves, 1) LOOP
    -- Build prefix of first i moves
    prefix_moves := array_to_string(uci_moves[1:i], ' ');
    
    -- Insert prefix
    INSERT INTO openings_prefix (line_id, prefix_plies, prefix_uci, prefix_hash)
    VALUES (
      opening_id,
      i,
      prefix_moves,
      encode(sha256(prefix_moves::bytea), 'hex')
    );
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to populate all prefixes (batch operation)
CREATE OR REPLACE FUNCTION populate_all_opening_prefixes()
RETURNS TABLE(total_lines INT, total_prefixes INT) AS $$
DECLARE
  line_count INT := 0;
  prefix_count INT := 0;
  opening_record RECORD;
BEGIN
  -- Clear existing prefixes
  TRUNCATE TABLE openings_prefix;
  
  -- Process each opening line
  FOR opening_record IN 
    SELECT id FROM chess_openings WHERE uci IS NOT NULL AND uci != ''
  LOOP
    prefix_count := prefix_count + populate_opening_prefixes(opening_record.id);
    line_count := line_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT line_count, prefix_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate prefixes when an opening is inserted or updated
CREATE OR REPLACE FUNCTION trigger_populate_opening_prefixes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if UCI moves have changed
  IF NEW.uci IS DISTINCT FROM OLD.uci THEN
    PERFORM populate_opening_prefixes(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_populate_prefixes
  AFTER INSERT OR UPDATE ON chess_openings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_populate_opening_prefixes();

-- Enable RLS on the new table
ALTER TABLE openings_prefix ENABLE ROW LEVEL SECURITY;

-- RLS policies (read-only for authenticated users)
CREATE POLICY "Allow public read access" ON openings_prefix
  FOR SELECT USING (true);

-- Add comments
COMMENT ON TABLE openings_prefix IS 'Prefix decomposition of opening lines for move-order based lookups';
COMMENT ON COLUMN openings_prefix.line_id IS 'Reference to the chess_openings line';
COMMENT ON COLUMN openings_prefix.prefix_plies IS 'Number of moves in this prefix';
COMMENT ON COLUMN openings_prefix.prefix_uci IS 'UCI moves for this prefix';
COMMENT ON COLUMN openings_prefix.prefix_hash IS 'SHA hash for fast prefix matching';

-- Initial population (this will be run by the setup script)
-- SELECT * FROM populate_all_opening_prefixes();

-- Verify the table structure
DO $$
BEGIN
  RAISE NOTICE 'Openings prefix table created successfully';
  RAISE NOTICE 'Run SELECT * FROM populate_all_opening_prefixes() to populate the table';
END $$;