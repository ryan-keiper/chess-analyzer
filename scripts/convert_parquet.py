# scripts/convert_parquet.py
import pandas as pd
import json

# Read parquet file
print("Reading Parquet file...")
df = pd.read_parquet('data/openings.parquet')

print(f"Found {len(df)} openings")

# Remove the image column and keep useful columns
useful_columns = ['eco-volume', 'eco', 'name', 'pgn', 'uci', 'epd']
df_clean = df[useful_columns].copy()

# Convert to JSON-serializable format
openings = df_clean.to_dict('records')

# Save as JSON with proper Unicode handling
print("Converting to JSON with Unicode support...")
with open('data/complete-openings.json', 'w', encoding='utf-8') as f:
    json.dump(openings, f, indent=2, ensure_ascii=False)  # Key change here!

print(f"✅ Successfully converted {len(openings)} openings to JSON")

# Test Unicode characters
unicode_examples = [opening for opening in openings if any(ord(char) > 127 for char in opening['name'])]
print(f"\nFound {len(unicode_examples)} openings with special characters:")
for opening in unicode_examples[:3]:
    print(f"  {opening['eco']} - {opening['name']}")