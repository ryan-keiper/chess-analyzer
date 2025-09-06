-- Migration: Remove WikiBooks tables and dependencies
-- This migration removes all WikiBooks-related database objects

-- Drop views that depend on wikibooks_positions
DROP VIEW IF EXISTS opening_statistics CASCADE;
DROP VIEW IF EXISTS content_quality_stats CASCADE;

-- Drop functions that reference wikibooks_positions
DROP FUNCTION IF EXISTS is_position_in_book(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_position_theory(TEXT) CASCADE;
DROP FUNCTION IF EXISTS find_book_end(TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS extract_opening_category(TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_content_quality(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_move_count(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_wikibooks_metadata() CASCADE;
DROP FUNCTION IF EXISTS create_wikibooks_table() CASCADE;

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_update_wikibooks_metadata ON wikibooks_positions CASCADE;

-- Drop the main WikiBooks table
DROP TABLE IF EXISTS wikibooks_positions CASCADE;

-- Log the removal
DO $$
BEGIN
  RAISE NOTICE 'WikiBooks tables and dependencies have been removed';
  RAISE NOTICE 'The system now uses Polyglot book format for opening detection';
END $$;