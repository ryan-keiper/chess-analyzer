# Chess Analyzer Frontend

A modern React web application for analyzing chess games with AI-powered insights.

## Features

- 🎨 **Clean, Modern UI** - Built with React and Tailwind CSS
- 📋 **PGN Input** - Paste games from any chess platform
- 🔍 **Real-time Analysis** - Powered by Stockfish engine
- 📊 **Visual Results** - Blunder detection with severity levels
- ⚙️ **Configurable** - Adjust analysis depth and settings
- 📱 **Responsive** - Works on desktop and mobile

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:5173
```

Make sure your Chess Analyzer API is running on port 3000!

## Development

```bash
# Run linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## API Integration

The frontend connects to your Chess Analyzer API running on `localhost:3000`. The Vite proxy automatically forwards API requests during development.

For production deployment, update `VITE_API_URL` in your environment variables.

## Deployment

Deploy to Vercel, Netlify, or any static hosting service:

```bash
npm run build
# Upload the 'dist' folder to your hosting service
```
