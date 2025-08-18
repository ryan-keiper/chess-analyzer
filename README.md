# Chess Analyzer API

A REST API that analyzes chess games and provides human-readable insights about blunders and strategic mistakes.

## Features

- 🔍 **PGN Game Analysis** - Upload chess games in PGN format
- ⚡ **Stockfish Integration** - Powered by the world's strongest chess engine
- 🎯 **Blunder Detection** - Identifies critical mistakes and missed opportunities
- 📊 **Detailed Metrics** - Move accuracy, evaluation changes, and position analysis
- 🚀 **Fast & Scalable** - Docker-ready with Redis caching

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/chess-analyzer-api.git
   cd chess-analyzer-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Install Stockfish** (if not using Docker)
   ```bash
   # macOS
   brew install stockfish
   
   # Ubuntu/Debian
   sudo apt-get install stockfish
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Using Docker

1. **Start with Docker Compose**
   ```bash
   docker-compose up --build
   ```

The API will be available at `http://localhost:3000`

## API Endpoints

### Analyze Game

Analyze a chess game from PGN format.

**POST** `/api/chess/analyze`

```json
{
  "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6...",
  "depth": 15
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "gameInfo": {
      "result": "1-0",
      "white": "Player1",
      "black": "Player2",
      "totalMoves": 42
    },
    "positions": [...],
    "blunders": [
      {
        "moveNumber": 12,
        "color": "b",
        "move": "Qh4??",
        "severity": "critical",
        "evalChange": 425,
        "description": "Black played Qh4??, losing 4.3 pawns of advantage"
      }
    ],
    "summary": {
      "totalBlunders": 3,
      "biggestBlunder": {...},
      "averageAccuracy": 87.5
    }
  }
}
```

### Test the API

```bash
# Test with sample PGN
curl -X POST http://localhost:3000/api/chess/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6"
  }'
```

## Next Steps

1. **Install dependencies**: `npm install`
2. **Test locally**: `npm run dev`
3. **Deploy**: Push to GitHub and connect to Railway/Render
4. **Add LLM integration** for natural language analysis

## License

MIT License
