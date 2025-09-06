# Chess Analyzer

An AI-powered chess analysis SaaS application that provides human-language explanations of chess games.

## Features

- 🧠 **Hybrid Analysis**: Polyglot opening book (124M+ positions) + AI strategic analysis
- ⚡ **Fast Performance**: <3 second analysis time with 76,000+ lookups/second
- 📚 **Professional Theory**: Complete opening coverage from 3.3M+ high-level games
- 🎯 **Smart Boundaries**: Auto-detect when players leave established theory
- 📊 **Detailed Insights**: Move-by-move analysis with opening theory and strategic evaluation

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Supabase (PostgreSQL)
- **Chess Engine**: Stockfish integration
- **Payment**: Stripe
- **Auth**: Supabase Auth
- **AI**: LLM integration for strategic analysis

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

## Performance Metrics

### Before Polyglot Integration
- ⏱️ **15+ seconds** analysis time
- 🌐 **15-20 API calls** per game to external services
- ⚠️ **Rate limiting** issues
- 📊 **Multiple API dependencies** for opening moves

### After Polyglot Integration  
- ⚡ **<3 seconds** analysis time
- 🚫 **Zero API calls** for opening detection
- ✅ **No rate limiting** - all lookups are local
- 🔧 **Optimized LLM usage** for strategic analysis only
- 📚 **Complete opening coverage** from 124M+ positions
- 🎯 **Accurate book depth** tracking

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