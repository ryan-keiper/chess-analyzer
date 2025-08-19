# CLAUDE.md - Chess Analyzer SaaS Project Guide

## Project Overview
This is a chess analysis SaaS application that combines WikiBooks opening theory with AI-powered strategic analysis. The project uses a hybrid approach to reduce LLM costs by 83% while providing professional chess education.

## Architecture
- **Monorepo Structure**: Backend API and frontend in same repository
- **Backend**: Node.js + Express + Supabase (PostgreSQL)
- **Frontend**: React + Vite + Tailwind CSS  
- **Chess Engine**: Stockfish integration
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
│   │   ├── enhancedChessAnalyzer.js # WikiBooks + AI hybrid analyzer
│   │   ├── wikiBooksDetector.js  # Opening theory detection
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
│   ├── setupWikiBooks.js         # WikiBooks database setup
│   ├── importOpenings.js         # Chess openings import
│   └── testWikiBooksAPI.js       # WikiBooks integration test
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
- `npm run setup-wikibooks` - Setup WikiBooks integration
- `npm run test-wikibooks` - Test WikiBooks API integration

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
- **Tables**: `users`, `analyses`, `openings`, `wikibooks_positions`, `subscriptions`
- **Migrations**: Numbered SQL files in `supabase/migrations/`
- **RLS**: Row Level Security enabled for user data

## Key Services

### Chess Analysis Pipeline
1. **PGN Input** → Parse with chess.js
2. **Opening Detection** → WikiBooks classifier (`wikiBooksDetector.js`)
3. **Hybrid Analysis** → WikiBooks theory + LLM strategic analysis (`enhancedChessAnalyzer.js`)
4. **Response Format** → Structured JSON with theory + strategic insights

### Cost Optimization Strategy
- **Opening Phase**: Free WikiBooks explanations (moves 1-12 typically)
- **Strategic Phase**: LLM analysis only after theory ends
- **Smart Boundaries**: Auto-detect when players leave established theory
- **Result**: 83% cost reduction vs pure LLM approach

## Environment Setup

### Required Environment Variables
```bash
# Backend (.env)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key  
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
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

## Business Logic Notes
- **Freemium Model**: 3 free analyses/day, $9.99/month unlimited
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Security**: Helmet.js, CORS, request validation
- **Performance**: Redis caching, optimized analysis pipeline
- Always run the test suite before making a commit
- Use test driven development in all new features