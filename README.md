# Chess Analyzer

Chess Analyzer is an AI-powered SaaS that helps players understand their games in a way existing tools don’t.  
Instead of just showing which moves were good or bad, it explains *why* — surfacing the strategic ideas and plans behind each decision, much like a coach would.

I also built Chess Analyzer as a full-stack solo project to demonstrate AI-native software engineering.  
It shows how I can take a complex idea from whiteboard to live SaaS fast, combining modern tooling, clean architecture, and AI-assisted workflows.

---

## Demo

🎥 [Watch the Loom Walkthrough](https://www.loom.com/share/c828c0328442406d821f57dd4a5a7302)
📂 [View the Code on GitHub](https://github.com/ryan-keiper/chess-analyzer)

---

## Current Status

- ✅ Opening book + Stockfish integration fully working  
- ✅ Key move detection live  
- 🚧 LLM narrative analysis scaffolded (placeholders currently shown in UI)  
- ✅ Full-stack architecture in place: React + Vite + Tailwind, Node + Express, Supabase/Postgres, Stripe, Dockerized Stockfish  

---

## Features

### For Players
- Human-readable, coach-style insights (*coming soon*)  
- Instant recognition of 124M+ opening book positions  
- Move-by-move centipawn evaluations and key moment detection  

### For Techies
- **Frontend**: React + Vite + Tailwind  
- **Backend**: Node.js + Express + Supabase (Postgres)  
- **Engine**: Stockfish in Docker  
- **Payments**: Stripe integration  
- **Auth**: Supabase Auth  

## Project Structure

```
chess-analyzer-api/                    # Project root (monorepo)
├── chess-analyzer-frontend/           # React application
├── src/                              # Node.js backend API
├── scripts/                          # Utility scripts (book rebuild)
├── supabase/migrations/              # Database schemas and migrations
├── data/                             # Polyglot opening book (openings.bin)
├── .env                              # Environment variables
├── package.json                      # Main project dependencies
└── docker-compose.yml                # Container orchestration
```

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Stripe account

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/chess-analyzer.git
cd chess-analyzer
```

2. Install dependencies
```bash
# Backend dependencies (from project root)
npm install

# Frontend dependencies  
cd chess-analyzer-frontend && npm install
cd ..
```

3. Environment setup
```bash
# Copy example environment files
cp .env.example .env
cp chess-analyzer-frontend/.env.example chess-analyzer-frontend/.env
```

4. Start development servers
```bash
# Backend API (from project root)
npm run dev

# Frontend (in separate terminal)
cd chess-analyzer-frontend && npm run dev
```

## Environment Variables

### Backend (.env)
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
BOOK_BIN_PATH=/path/to/openings.bin
NODE_ENV=development
PORT=3001
```

### Frontend (chess-analyzer-frontend/.env)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

## Architecture

### Polyglot Opening Book Strategy
- **Opening Phase**: Use Polyglot book with 124.7M positions for instant move validation
- **Strategic Phase**: Use LLM analysis for post-book decisions
- **Smart Boundaries**: Auto-detect when players leave established theory
- **Complete Coverage**: Both White and Black positions included

### Technical Advantages
- **Zero API calls** for opening detection
- **Local lookups** eliminate rate limiting
- **Binary search** for O(log n) position lookups
- **Memory efficient** caching system

### Analysis Response Format
```javascript
{
  gameInfo: {
    opening: "Ruy Lopez: Marshall Attack",
    eco: "C89",
    analysisType: "polyglot_enhanced"
  },
  summary: {
    bookMoves: 12,
    strategicMoves: 33,
    openingTheory: "The Marshall...",
    analysisScope: {
      bookPhase: "Moves 1-12",
      strategicPhase: "Moves 13-45"
    }
  },
  positions: [
    {
      moveNumber: 3,
      inBook: true,
      phase: "opening",
      bookInfo: {
        opening_name: "Ruy Lopez",
        eco: "C60",
        inBook: true,
        moveCount: 65535
      }
    },
    {
      moveNumber: 15,
      inBook: false,
      phase: "strategic",
      evaluation: -0.3,
      classification: "good"
    }
  ],
  llmContext: {
    keyPositions: [],
    narrative: {
      opening: "Ruy Lopez theory followed perfectly...",
      transition: "Left theory at move 13...",
      keyMoments: []
    }
  }
}
```

## Development Scripts

```bash
# Start backend API
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Frontend development (from chess-analyzer-frontend directory)
cd chess-analyzer-frontend && npm run dev
```

## Database Schema

The application uses Supabase (PostgreSQL) with the following key tables:

- **users**: User authentication and subscription management
- **analyses**: Stored game analyses and results  
- **chess_openings**: Chess opening database (3,541+ openings)
- **openings_prefix**: Prefix hashes for fast opening lookup
- **subscriptions**: Stripe subscription tracking

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout

### Chess Analysis
- `POST /analyze` - Analyze chess game from PGN
- `GET /analyses` - Get user's analysis history
- `GET /analyses/:id` - Get specific analysis

### Subscription Management
- `POST /create-checkout-session` - Create Stripe checkout
- `POST /webhook` - Handle Stripe webhooks
- `GET /subscription-status` - Check user subscription

## Deployment

### Environment Setup
1. Create Supabase project and configure database
2. Set up Stripe account and configure webhooks
3. Deploy to your preferred platform (Vercel, Railway, etc.)

### Required Environment Variables
Ensure all environment variables from the examples above are configured in your deployment environment.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For support, create an issue in this repository.