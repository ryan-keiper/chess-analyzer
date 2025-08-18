# Chess Analyzer

An AI-powered chess analysis SaaS application that provides human-language explanations of chess games.

## Features

- 🧠 **Hybrid Analysis**: WikiBooks opening theory + AI strategic analysis
- ⚡ **Fast Performance**: <3 second analysis time
- 📚 **Professional Theory**: 1,977 WikiBooks pages of opening knowledge
- 💰 **Cost Effective**: 83% reduction in AI costs through smart boundaries
- 🔄 **Freemium Model**: 3 free analyses/day, $9.99/month Pro tier

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Supabase (PostgreSQL)
- **Chess Engine**: Stockfish integration
- **Payment**: Stripe
- **Auth**: Supabase Auth
- **AI**: Tiered LLM approach (GPT-5 Nano/Mini/Sonnet 4)

## Project Structure

```
chess-analyzer-api/                    # Project root (monorepo)
├── chess-analyzer-frontend/           # React application
├── src/                              # Node.js backend API
├── scripts/                          # Setup and utility scripts
├── supabase/migrations/              # Database schemas and migrations
├── data/                             # Static data and seeds
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

4. Database setup
```bash
# Setup WikiBooks integration
npm run setup-wikibooks
```

5. Start development servers
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

### WikiBooks Integration Strategy
- **Opening Phase**: Use WikiBooks theory explanations (free)
- **Strategic Phase**: Use LLM analysis for post-book decisions
- **Smart Boundaries**: Auto-detect when players leave established theory

### Cost Optimization
- Traditional approach: $0.90 per game
- WikiBooks hybrid: $0.15 per game (83% reduction)
- Pro tier economics: 40% profit margin

### Analysis Response Format
```javascript
{
  gameInfo: {
    opening: "Ruy Lopez: Marshall Attack",
    openingUrl: "https://en.wikibooks.org/wiki/...",
    analysisType: "enhanced_wikibooks"
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
      theory: {
        opening_name: "Ruy Lopez",
        theory_text: "The Spanish Opening aims to..."
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

# Start frontend development server
npm run dev:frontend

# Start both frontend and backend concurrently
npm run dev:all

# Install all dependencies (root + frontend)
npm run install:all

# Setup WikiBooks database
npm run setup-wikibooks

# Test WikiBooks integration
npm run test-wikibooks
```

## Database Schema

The application uses Supabase (PostgreSQL) with the following key tables:

- **users**: User authentication and subscription management
- **analyses**: Stored game analyses and results  
- **openings**: Chess opening database (3,541+ openings)
- **wikibooks_positions**: WikiBooks theory positions and explanations
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

### Before WikiBooks Integration
- ⏱️ **15+ seconds** analysis time
- 🌐 **15-20 API calls** per game to Lichess
- ⚠️ **Rate limiting** issues
- 💰 **High LLM costs** for opening moves

### After WikiBooks Integration  
- ⚡ **<3 seconds** analysis time
- 🚫 **Zero API calls** for opening detection
- ✅ **No rate limiting**
- 💰 **83% cost reduction** on LLM usage
- 📚 **Professional opening explanations**

## Business Model

**Freemium SaaS Model:**
- **Free Tier**: 3 analyses per day
- **Pro Tier**: $9.99/month unlimited analyses
- **Target Economics**: 40% profit margin with WikiBooks optimization

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