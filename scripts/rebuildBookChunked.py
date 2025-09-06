#!/usr/bin/env python3
"""
Memory-efficient Polyglot book builder using chunked processing.
Processes shards individually and merges at the end.
"""

import sys
import os
from pathlib import Path
import struct
import subprocess
import io
import tempfile
import heapq
from collections import defaultdict

try:
    import chess
    import chess.pgn
    import chess.polyglot
except ImportError:
    print("Error: python-chess is required. Install with: pip3 install python-chess")
    sys.exit(1)

def process_game(game, position_stats, max_ply=60):
    """Process a single game and update position statistics."""
    board = game.board()
    moves = list(game.mainline_moves())
    
    if len(moves) == 0:
        return
    
    for i, move in enumerate(moves[:max_ply]):
        key = chess.polyglot.zobrist_hash(board)
        
        move_int = 0
        move_int |= move.from_square
        move_int |= (move.to_square << 6)
        
        if move.promotion:
            promotion_map = {
                chess.KNIGHT: 1,
                chess.BISHOP: 2,
                chess.ROOK: 3,
                chess.QUEEN: 4
            }
            move_int |= (promotion_map.get(move.promotion, 0) << 12)
        
        position_stats[key][move_int] += 1
        board.push(move)

def process_single_shard(shard_path, output_bin, max_ply=60):
    """Process a single shard and write its own .bin file."""
    print(f"Processing {shard_path.name}...")
    
    position_stats = defaultdict(lambda: defaultdict(int))
    count = 0
    errors = 0
    
    # Open and process the zst file
    proc = subprocess.Popen(['zstd', '-dc', str(shard_path)], 
                          stdout=subprocess.PIPE, 
                          stderr=subprocess.DEVNULL,
                          universal_newlines=True,
                          encoding='utf-8',
                          errors='ignore')
    
    try:
        while True:
            try:
                game = chess.pgn.read_game(proc.stdout)
                if game is None:
                    break
                
                process_game(game, position_stats, max_ply)
                count += 1
                
                if count % 5000 == 0:
                    print(f"  {count} games...")
                    
            except Exception:
                errors += 1
                continue
    finally:
        proc.stdout.close()
        proc.wait()
    
    print(f"  {count} games, {len(position_stats)} positions")
    
    # Write this shard's book
    entries = []
    for key, moves in position_stats.items():
        for move_int, cnt in moves.items():
            entries.append((key, move_int, cnt))
    
    entries.sort()
    
    with open(output_bin, 'wb') as f:
        for key, move_int, cnt in entries:
            entry = struct.pack('>QHHHh', key, move_int, min(cnt, 65535), 
                              min(cnt, 65535), min(cnt, 32767))
            f.write(entry)
    
    print(f"  Wrote {len(entries)} entries to {output_bin}")
    return len(entries)

def merge_books(book_files, output_file):
    """Merge multiple .bin files using a heap-based merge."""
    print(f"\nMerging {len(book_files)} books...")
    
    # Open all book files
    open_files = []
    readers = []
    
    for book_file in book_files:
        f = open(book_file, 'rb')
        open_files.append(f)
        
        # Read first entry from each file
        entry = f.read(16)
        if entry:
            key, move, count, n, sum_val = struct.unpack('>QHHHh', entry)
            # heap item: (key, move, count, n, sum, file_index)
            heapq.heappush(readers, (key, move, count, n, sum_val, len(readers) - 1))
    
    # Merge using heap
    current_key = None
    current_move = None
    current_count = 0
    current_n = 0
    current_sum = 0
    entries_written = 0
    
    with open(output_file, 'wb') as out:
        while readers:
            key, move, count, n, sum_val, file_idx = heapq.heappop(readers)
            
            if current_key == key and current_move == move:
                # Combine with current entry
                current_count = min(current_count + count, 65535)
                current_n = min(current_n + n, 65535)
                current_sum = min(max(current_sum + sum_val, -32768), 32767)
            else:
                # Write previous entry if exists
                if current_key is not None:
                    entry = struct.pack('>QHHHh', current_key, current_move, 
                                      current_count, current_n, current_sum)
                    out.write(entry)
                    entries_written += 1
                    
                    if entries_written % 1000000 == 0:
                        print(f"  Merged {entries_written} entries...")
                
                # Start new entry
                current_key = key
                current_move = move
                current_count = count
                current_n = n
                current_sum = sum_val
            
            # Read next entry from the same file
            entry = open_files[file_idx].read(16)
            if entry:
                key, move, count, n, sum_val = struct.unpack('>QHHHh', entry)
                heapq.heappush(readers, (key, move, count, n, sum_val, file_idx))
        
        # Write final entry
        if current_key is not None:
            entry = struct.pack('>QHHHh', current_key, current_move, 
                              current_count, current_n, current_sum)
            out.write(entry)
            entries_written += 1
    
    # Close all files
    for f in open_files:
        f.close()
    
    print(f"  Total entries merged: {entries_written}")
    return entries_written

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 rebuildBookChunked.py <filtered_dir> [output.bin]")
        sys.exit(1)
    
    filtered_dir = Path(sys.argv[1])
    output_file = sys.argv[2] if len(sys.argv) > 2 else "openings.bin"
    
    # Find all shards
    shards = sorted(filtered_dir.glob("*.pgn.zst"))
    if not shards:
        print(f"Error: No .pgn.zst files found in {filtered_dir}")
        sys.exit(1)
    
    print(f"Found {len(shards)} shards")
    print("-" * 50)
    
    # Create temp directory for intermediate books
    with tempfile.TemporaryDirectory(prefix="polyglot_") as tmpdir:
        tmpdir = Path(tmpdir)
        print(f"Using temp directory: {tmpdir}")
        
        # Process each shard into its own book
        temp_books = []
        for i, shard in enumerate(shards, 1):
            print(f"\n[{i}/{len(shards)}] {shard.name}")
            temp_book = tmpdir / f"{shard.stem}.bin"
            entries = process_single_shard(shard, temp_book)
            if entries > 0:
                temp_books.append(temp_book)
        
        # Merge all temporary books
        print("\n" + "=" * 50)
        print("Merging all books into final output...")
        total_entries = merge_books(temp_books, output_file)
    
    # Report final stats
    size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print("\n✅ Book creation complete!")
    print(f"   File: {output_file}")
    print(f"   Size: {size_mb:.2f} MB")
    print(f"   Entries: {total_entries}")
    
    # Quick verification
    print("\nVerifying 1.e4 e5 2.Nf3 position...")
    board = chess.Board()
    board.push_san("e4")
    board.push_san("e5")
    board.push_san("Nf3")
    target_key = chess.polyglot.zobrist_hash(board)
    
    with open(output_file, 'rb') as f:
        # Binary search for verification
        f.seek(0, 2)
        file_size = f.tell()
        num_entries = file_size // 16
        
        left, right = 0, num_entries - 1
        found = False
        
        while left <= right:
            mid = (left + right) // 2
            f.seek(mid * 16)
            entry = f.read(16)
            key = struct.unpack('>Q', entry[:8])[0]
            
            if key == target_key:
                found = True
                break
            elif key < target_key:
                left = mid + 1
            else:
                right = mid - 1
        
        if found:
            print("✅ Position after 1.e4 e5 2.Nf3 found in book!")
        else:
            print("❌ Position after 1.e4 e5 2.Nf3 NOT found")

if __name__ == "__main__":
    main()