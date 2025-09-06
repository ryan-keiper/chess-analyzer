-- Migration: Enhance chess_openings table for Polyglot integration
-- Adds helper columns for position-based and move-order based lookups

-- Add helper columns to chess_openings table
ALTER TABLE chess_openings
  ADD COLUMN IF NOT EXISTS ply_depth INT,
  ADD COLUMN IF NOT EXISTS terminal_fen TEXT,
  ADD COLUMN IF NOT EXISTS terminal_polykey TEXT,
  ADD COLUMN IF NOT EXISTS path_hash TEXT;

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_openings_ply_depth ON chess_openings(ply_depth);
CREATE INDEX IF NOT EXISTS idx_openings_polykey ON chess_openings(terminal_polykey);
CREATE INDEX IF NOT EXISTS idx_openings_path_hash ON chess_openings(path_hash);

-- Function to calculate ply depth from UCI string
CREATE OR REPLACE FUNCTION calculate_ply_depth(uci_moves TEXT)
RETURNS INT AS $$
BEGIN
  IF uci_moves IS NULL OR uci_moves = '' THEN
    RETURN 0;
  END IF;
  
  -- Count moves by splitting on spaces
  RETURN array_length(string_to_array(trim(uci_moves), ' '), 1);
END;
$$ LANGUAGE plpgsql;

-- Function to convert EPD to normalized FEN
CREATE OR REPLACE FUNCTION epd_to_fen(epd TEXT)
RETURNS TEXT AS $$
BEGIN
  -- EPD is already in the format we need (position + turn + castling + en passant)
  -- Just ensure it's normalized
  RETURN trim(epd);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate SHA-1 hash of UCI moves
CREATE OR REPLACE FUNCTION calculate_path_hash(uci_moves TEXT)
RETURNS TEXT AS $$
BEGIN
  IF uci_moves IS NULL OR uci_moves = '' THEN
    RETURN encode(sha256(''::bytea), 'hex');
  END IF;
  
  -- Use SHA-256 (PostgreSQL doesn't have SHA-1 built-in, SHA-256 is fine)
  RETURN encode(sha256(trim(uci_moves)::bytea), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Update existing rows with calculated values
UPDATE chess_openings
SET
  ply_depth = calculate_ply_depth(uci),
  terminal_fen = epd_to_fen(epd),
  path_hash = calculate_path_hash(uci)
WHERE ply_depth IS NULL;

-- Note: terminal_polykey will be populated by the Node.js script
-- since Polyglot key calculation requires specific Zobrist tables

-- Add trigger to auto-calculate fields on insert/update
CREATE OR REPLACE FUNCTION update_chess_openings_helpers()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ply_depth = calculate_ply_depth(NEW.uci);
  NEW.terminal_fen = epd_to_fen(NEW.epd);
  NEW.path_hash = calculate_path_hash(NEW.uci);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chess_openings_helpers
  BEFORE INSERT OR UPDATE ON chess_openings
  FOR EACH ROW
  EXECUTE FUNCTION update_chess_openings_helpers();

-- Add comment explaining the purpose of new columns
COMMENT ON COLUMN chess_openings.ply_depth IS 'Number of half-moves in the UCI sequence';
COMMENT ON COLUMN chess_openings.terminal_fen IS 'Normalized FEN of the terminal position';
COMMENT ON COLUMN chess_openings.terminal_polykey IS 'Polyglot Zobrist key (hex) for fast position lookups';
COMMENT ON COLUMN chess_openings.path_hash IS 'SHA hash of UCI moves for prefix matching';

-- Verify the migration
DO $$
DECLARE
  enhanced_count INT;
BEGIN
  SELECT COUNT(*) INTO enhanced_count
  FROM chess_openings
  WHERE ply_depth IS NOT NULL;
  
  RAISE NOTICE 'Enhanced % rows in chess_openings table', enhanced_count;
END $$;