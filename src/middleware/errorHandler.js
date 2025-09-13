const errorHandler = (err, req, res, _next) => {
  console.error('Error:', err);

  // Default error
  let status = 500;
  let message = 'Internal server error';

  // Handle null/undefined errors
  if (!err) {
    return res.status(status).json({ error: message });
  }

  // Rate limiting (check first as it uses status property)
  if (err.status === 429) {
    status = 429;
    message = 'Too many requests';
  }
  // Validation errors
  else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
  }
  // Chess.js errors
  else if (err.message && err.message.includes('Invalid PGN')) {
    status = 400;
    message = 'Invalid chess game format';
  }
  // Stockfish errors
  else if (err.message && err.message.includes('Stockfish')) {
    status = 503;
    message = 'Chess engine temporarily unavailable';
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
