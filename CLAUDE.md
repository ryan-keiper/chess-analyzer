# CLAUDE.md - Chess Analyzer SaaS Project Guide

## Project Overview
This is a chess analysis application that combines a comprehensive Polyglot opening book with AI-powered strategic analysis. The project uses a hybrid approach for efficient analysis while providing professional chess education.

## Architecture
- **Monorepo Structure**: Backend API and frontend in same repository
- **Backend**: Node.js + Express + Supabase (PostgreSQL)
- **Frontend**: React + Vite + Tailwind CSS  
- **Chess Engine**: Stockfish integration
- **Opening Book**: Polyglot binary format (24 months of Lichess data)
- **Payment**: Stripe integration
- **Authentication**: Supabase Auth

## Directory Structure
```
chess-analyzer-api/                 # Project root (this directory)
├── src/                           # Backend Node.js API
│   ├── server.js                  # Main Express server
│   ├── routes/                    # API route handlers
│   │   ├── chess.js              # Chess analysis endpoints
│   │   └── payment.js            # Stripe payment endpoints
│   ├── services/                  # Business logic services
│   │   ├── chessAnalyzer.js      # Core chess analysis logic
│   │   ├── polyglotBook.js       # Polyglot opening book reader (124M+ positions)
│   │   ├── ecoClassifier.js      # ECO opening classification
│   │   ├── stockfish.js          # Chess engine integration
│   │   ├── supabase.js           # Database client
│   │   └── stripe.js             # Payment processing
│   ├── middleware/                # Express middleware
│   │   ├── errorHandler.js       # Global error handling
│   │   └── validation.js         # Request validation
│   └── __tests__/                # Backend tests
├── chess-analyzer-frontend/       # React frontend application
│   ├── src/
│   │   ├── App.jsx               # Main React app
│   │   ├── components/           # React components
│   │   ├── contexts/             # React contexts (auth, etc.)
│   │   ├── services/             # Frontend API clients
│   │   └── utils/                # Frontend utilities
│   ├── package.json              # Frontend dependencies
│   └── vite.config.js            # Vite configuration
├── scripts/                      # Setup and utility scripts
│   ├── importOpenings.js         # Chess openings import
│   ├── populateOpeningHelpers.js # Populate opening helper columns
│   └── testPolyglotIntegration.js # Polyglot book integration test
├── supabase/migrations/          # Database schema migrations
├── data/                         # Static data files
├── package.json                  # Backend dependencies and scripts
└── docker-compose.yml            # Container orchestration
```

## Development Commands

### Backend (from project root)
- `npm run dev` - Start backend development server with nodemon
- `npm start` - Start production backend server
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode

### Frontend (from chess-analyzer-frontend/)
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Database & Setup
- `npm run populate-helpers` - Populate opening helper columns
- `npm run test-polyglot` - Test Polyglot book integration

## Code Conventions

### Backend (Node.js)
- **Style**: CommonJS modules (`require`/`module.exports`)
- **File Naming**: camelCase for files (`chessAnalyzer.js`)
- **Functions**: Descriptive names with JSDoc comments
- **Error Handling**: Centralized via `errorHandler.js` middleware
- **Database**: Supabase client in `services/supabase.js`
- **API Routes**: RESTful endpoints under `/api/` prefix
- **Environment**: dotenv for configuration

### Frontend (React)
- **Style**: ES6 modules (`import`/`export`)
- **File Naming**: PascalCase for components (`AnalysisResults.jsx`)
- **Components**: Functional components with hooks
- **Styling**: Tailwind CSS utility classes
- **State Management**: React Context for auth, local state for components
- **API Calls**: Axios client in `services/api.js`

### Database Schema
- **Tables**: `users`, `analyses`, `chess_openings`, `openings_prefix`, `subscriptions`
- **Migrations**: Numbered SQL files in `supabase/migrations/`
- **RLS**: Row Level Security enabled for user data
- **Enhanced Columns**: Polyglot keys and path hashes for fast lookups

## Key Services

### Chess Analysis Pipeline
1. **PGN Input** → Parse with chess.js
2. **Opening Detection** → Polyglot book lookup (`polyglotBook.js`)
3. **Opening Classification** → Enhanced ECO classifier (`ecoClassifier.js`)
4. **Position Analysis** → Stockfish evaluation + move classification
5. **Response Format** → Structured JSON with opening info + strategic insights

### Opening Book Strategy
- **Data Source**: 24 months of high-quality Lichess games (2200+ rated)
- **Book Format**: Polyglot binary format with 124.7M unique positions
- **Book Detection**: Position-based using correct Polyglot Zobrist keys
- **Coverage**: Complete - includes both White and Black positions
- **Transposition Support**: Handles move-order variations correctly
- **Book Depth**: Tracks how many moves deep games follow theory
- **Performance**: 76,000+ lookups per second

## Environment Setup

### Required Environment Variables
```bash
# Backend (.env)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key  
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
BOOK_BIN_PATH=/path/to/openings.bin
NODE_ENV=development
PORT=3001

# Frontend (chess-analyzer-frontend/.env)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

## Testing
- **Backend**: Jest with `npm test`
- **API Testing**: Integration tests in `src/__tests__/`
- **Frontend**: Manual testing via development server

## Deployment
- **Production**: Set NODE_ENV=production
- **Docker**: `docker-compose.yml` for containerized deployment
- **Database**: Supabase hosted PostgreSQL
- **Payments**: Stripe webhooks configured

## Application Features
- **User Management**: Authentication via Supabase Auth
- **Analysis Storage**: Save and retrieve past game analyses
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Security**: Helmet.js, CORS, request validation
- **Performance**: Redis caching, optimized analysis pipeline
- **Opening Book**: 1.9GB Polyglot format, memory-mapped for efficiency
- Always run the test suite before making a commit
- Use test driven development in all new features