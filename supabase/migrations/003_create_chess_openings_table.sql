-- Create migration file: db/migrations/003_create_chess_openings_table.sql

CREATE TABLE chess_openings (
  id SERIAL PRIMARY KEY,
  eco_volume TEXT NOT NULL,
  eco TEXT NOT NULL,
  name TEXT NOT NULL,
  pgn TEXT NOT NULL,
  uci TEXT NOT NULL,
  epd TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_chess_openings_eco ON chess_openings(eco);
CREATE INDEX idx_chess_openings_epd ON chess_openings(epd);
CREATE INDEX idx_chess_openings_name ON chess_openings(name);

-- Add some constraints
ALTER TABLE chess_openings ADD CONSTRAINT unique_eco_epd UNIQUE(eco, epd);

-- Add RLS (Row Level Security) if needed
ALTER TABLE chess_openings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to openings
CREATE POLICY "Allow public read access" ON chess_openings
  FOR SELECT USING (true);