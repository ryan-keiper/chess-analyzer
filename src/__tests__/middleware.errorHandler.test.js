const { errorHandler } = require('../middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res)
    };
    next = jest.fn();
    
    // Reset environment
    delete process.env.NODE_ENV;
    
    // Mock console.error to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Error Handling', () => {
    test('should handle generic server errors with 500 status', () => {
      const error = new Error('Something went wrong');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
      expect(console.error).toHaveBeenCalledWith('Error:', error);
    });

    test('should not call next() as it handles the error', () => {
      const error = new Error('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Validation Errors', () => {
    test('should handle ValidationError with 400 status', () => {
      const error = new Error('Field validation failed');
      error.name = 'ValidationError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed'
      });
    });

    test('should handle validation errors from different sources', () => {
      const validationErrors = [
        { name: 'ValidationError', message: 'Required field missing' },
        { name: 'ValidationError', message: 'Invalid format' }
      ];

      validationErrors.forEach(error => {
        jest.clearAllMocks();
        errorHandler(error, req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Validation failed'
        });
      });
    });
  });

  describe('Chess.js Errors', () => {
    test('should handle Invalid PGN errors with 400 status', () => {
      const error = new Error('Invalid PGN format detected');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid chess game format'
      });
    });

    test('should handle various PGN error messages', () => {
      const pgnErrors = [
        'Invalid PGN: malformed header',
        'PGN parsing failed: Invalid PGN structure',
        'Chess.js: Invalid PGN notation'
      ];

      pgnErrors.forEach(errorMessage => {
        jest.clearAllMocks();
        const error = new Error(errorMessage);
        
        errorHandler(error, req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Invalid chess game format'
        });
      });
    });

    test('should be case sensitive for PGN error detection', () => {
      const error = new Error('invalid pgn format'); // lowercase
      
      errorHandler(error, req, res, next);
      
      // Should not match, fallback to generic error
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('Stockfish Engine Errors', () => {
    test('should handle Stockfish errors with 503 status', () => {
      const error = new Error('Stockfish engine crashed');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Chess engine temporarily unavailable'
      });
    });

    test('should handle various Stockfish error messages', () => {
      const stockfishErrors = [
        'Stockfish initialization failed',
        'Connection to Stockfish lost',
        'Stockfish timeout error',
        'Unable to start Stockfish process'
      ];

      stockfishErrors.forEach(errorMessage => {
        jest.clearAllMocks();
        const error = new Error(errorMessage);
        
        errorHandler(error, req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Chess engine temporarily unavailable'
        });
      });
    });
  });

  describe('Rate Limiting Errors', () => {
    test('should handle rate limiting errors with 429 status', () => {
      const error = new Error('Too many requests');
      error.status = 429;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many requests'
      });
    });

    test('should prioritize status property over message content', () => {
      const error = new Error('Invalid PGN format'); // Would normally be 400
      error.status = 429; // But has rate limit status
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many requests'
      });
    });
  });

  describe('Development vs Production Behavior', () => {
    test('should include stack trace and details in development', () => {
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      errorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        stack: error.stack,
        details: 'Test error'
      });
    });

    test('should not include stack trace in production', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      errorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should not include stack trace when NODE_ENV is not set', () => {
      // NODE_ENV undefined (default case)
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      errorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should include debug info in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const error = new Error('Test error');
      
      errorHandler(error, req, res, next);
      
      // Should not include debug info in test (only development)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('Error Priority and Precedence', () => {
    test('should prioritize rate limiting over other error types', () => {
      const error = new Error('Invalid PGN with Stockfish error');
      error.status = 429;
      error.name = 'ValidationError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many requests'
      });
    });

    test('should prioritize validation errors over content-based errors', () => {
      const error = new Error('Invalid PGN format');
      error.name = 'ValidationError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed'
      });
    });

    test('should handle multiple error indicators in message', () => {
      const error = new Error('Invalid PGN caused Stockfish to crash');
      
      errorHandler(error, req, res, next);
      
      // Should match the first pattern (Invalid PGN)
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid chess game format'
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle errors without message property', () => {
      const error = {};
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should handle null error', () => {
      const error = null;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should handle undefined error', () => {
      const error = undefined;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should handle errors with empty message', () => {
      const error = new Error('');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should handle errors with null message', () => {
      const error = { message: null };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should handle non-standard error objects', () => {
      const error = {
        customProperty: 'value',
        toString: () => 'Custom error'
      };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('Response Object Handling', () => {
    test('should handle response object without status method', () => {
      const brokenRes = {
        json: jest.fn()
      };
      
      expect(() => {
        errorHandler(new Error('test'), req, brokenRes, next);
      }).toThrow();
    });

    test('should handle response object without json method', () => {
      const brokenRes = {
        status: jest.fn(() => brokenRes)
      };
      
      expect(() => {
        errorHandler(new Error('test'), req, brokenRes, next);
      }).toThrow();
    });

    test('should handle method chaining correctly', () => {
      const error = new Error('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.status().json).toEqual(res.json);
    });
  });

  describe('Console Logging', () => {
    test('should log all errors to console', () => {
      const error = new Error('Test error for logging');
      
      errorHandler(error, req, res, next);
      
      expect(console.error).toHaveBeenCalledWith('Error:', error);
    });

    test('should log errors even when they are handled specially', () => {
      const errors = [
        { error: new Error('Invalid PGN'), type: 'PGN' },
        { error: new Error('Stockfish failed'), type: 'Stockfish' },
        { error: Object.assign(new Error('Rate limited'), { status: 429 }), type: 'Rate limit' }
      ];

      errors.forEach(({ error, type }) => {
        jest.clearAllMocks();
        errorHandler(error, req, res, next);
        
        expect(console.error).toHaveBeenCalledWith('Error:', error);
      });
    });
  });

  describe('Real-world Error Scenarios', () => {
    test('should handle axios network errors', () => {
      const error = new Error('Network Error');
      error.code = 'ECONNREFUSED';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should handle database connection errors', () => {
      const error = new Error('Connection to database failed');
      error.name = 'ConnectionError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should handle timeout errors', () => {
      const error = new Error('Request timeout');
      error.code = 'ETIMEDOUT';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    test('should handle JSON parsing errors', () => {
      const error = new SyntaxError('Unexpected token in JSON');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });
});