const { body } = require('express-validator');
const { Chess } = require('chess.js');

const validatePgn = [
  body('pgn')
    .notEmpty()
    .withMessage('PGN is required')
    .isString()
    .withMessage('PGN must be a string')
    .isLength({ max: 50000 })
    .withMessage('PGN too large (max 50KB)')
    .custom((value) => {
      // Validate PGN format
      const chess = new Chess();
      
      try {
        console.log('Validating PGN...');
        
        // Try to load the PGN
        chess.loadPgn(value);
        
        // Check if it actually worked by looking at the history
        const history = chess.history();
        console.log('Move count after loadPgn:', history.length);
        
        if (history.length === 0) {
          throw new Error('PGN contains no valid moves');
        }
        
        // Reasonable game length check
        if (history.length > 500) {
          throw new Error('Game too long (max 500 moves)');
        }
        
        console.log('PGN validation successful!');
        return true;
        
      } catch (error) {
        console.error('PGN validation error:', error.message);
        throw new Error(`PGN validation failed: ${error.message}`);
      }
    }),
    
  body('depth')
    .optional()
    .isInt({ min: 5, max: 25 })
    .withMessage('Depth must be between 5 and 25')
    .toInt()
];

module.exports = {
  validatePgn
};