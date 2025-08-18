const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let status = 500;
  let message = 'Internal server error';

  // Validation errors
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
  }

  // Chess.js errors
  if (err.message && err.message.includes('Invalid PGN')) {
    status = 400;
    message = 'Invalid chess game format';
  }

  // Stockfish errors
  if (err.message && err.message.includes('Stockfish')) {
    status = 503;
    message = 'Chess engine temporarily unavailable';
  }

  // Rate limiting
  if (err.status === 429) {
    status = 429;
    message = 'Too many requests';
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.message 
    })
  });
};

module.exports = { errorHandler };
