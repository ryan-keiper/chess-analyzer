require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const paymentRoutes = require('./routes/payment');
const chessRoutes = require('./routes/chess');
const { errorHandler } = require('./middleware/errorHandler');
const { initializeECOClassifier } = require('./services/ecoClassifier');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourfrontend.com']
    : ['http://localhost:3000', 'http://localhost:5173']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Routes - MOVED PAYMENT ROUTES HERE!
app.use('/api/chess', chessRoutes);
app.use('/api/payment', paymentRoutes);

// 404 handler - MOVED TO AFTER ALL ROUTES
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

async function startServer() {
  // Initialize ECO classifier
  await initializeECOClassifier();

  app.listen(PORT, () => {
    console.log(`Chess Analyzer API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(console.error);