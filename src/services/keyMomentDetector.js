// Chess.js not used directly - game state handled by main analyzer

/**
 * Service for detecting key moments in a chess game that warrant AI analysis
 * Identifies strategic inflection points, hidden plans, and critical decisions
 */

/**
 * Main function to detect all key moments in a game
 * @param {Array} positions - Array of analyzed positions from chessAnalyzer
 * @param {Object} gameInfo - Game metadata
 * @returns {Array} Array of key moments with types and context
 */
async function detectKeyMoments(positions, gameInfo) {
  const moments = [];

  // 1. Guaranteed structural moments
  moments.push(...detectStructuralMoments(positions, gameInfo));

  // 2. Hidden plan moments (like the g5 example)
  moments.push(...detectHiddenPlans(positions));

  // 3. Strategic inflection points
  moments.push(...detectStrategicInflections(positions));

  // 4. Prophylactic moments
  moments.push(...detectProphylacticMoments(positions));

  // 5. Critical decision points
  moments.push(...detectCriticalDecisions(positions));

  // 6. Plan execution sequences
  const sequences = detectPlanSequences(positions);
  moments.push(...sequences);

  // Remove duplicates and sort by move number
  const uniqueMoments = deduplicateMoments(moments);

  // Prioritize and limit to reasonable number (15-20 max)
  return prioritizeMoments(uniqueMoments, positions.length);
}

/**
 * Detect guaranteed structural moments (opening transition, endgame, etc.)
 */
function detectStructuralMoments(positions, gameInfo) {
  const moments = [];

  // Opening-to-middlegame transition
  const lastBookMove = gameInfo?.opening?.lastBookMove || 0;
  const transitionMove = findOpeningTransition(positions, lastBookMove);
  if (transitionMove) {
    moments.push({
      moveIndex: transitionMove.index,
      moveNumber: transitionMove.moveNumber,
      type: 'opening_transition',
      priority: 'high',
      description: 'Transition from opening to middlegame',
      reason: 'Players have left opening theory and must formulate independent plans'
    });
  }

  // Middlegame-to-endgame transition
  const endgameTransition = findEndgameTransition(positions);
  if (endgameTransition) {
    moments.push({
      moveIndex: endgameTransition.index,
      moveNumber: endgameTransition.moveNumber,
      type: 'endgame_transition',
      priority: 'high',
      description: 'Transition to endgame',
      reason: 'Simplified position requires different strategic priorities'
    });
  }

  return moments;
}

/**
 * Find opening-to-middlegame transition
 */
function findOpeningTransition(positions, lastBookMove) {
  // More nuanced than just "out of book"
  let transitionFound = false;
  let transitionIndex = -1;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const moveNumber = pos.moveNumber;

    // Check multiple criteria
    const outOfBook = moveNumber > lastBookMove && lastBookMove > 0;
    const developmentComplete = countDevelopedPieces(pos) >= 6;
    const centerDefined = isCenterDefined(pos);
    const moveCount = moveNumber >= 8;

    const criteria = [outOfBook, developmentComplete, centerDefined, moveCount];
    const metCriteria = criteria.filter(Boolean).length;

    if (metCriteria >= 3 && !transitionFound) {
      transitionFound = true;
      transitionIndex = i;
      break;
    }
  }

  if (transitionIndex >= 0) {
    return {
      index: transitionIndex,
      moveNumber: positions[transitionIndex].moveNumber
    };
  }

  return null;
}

/**
 * Find true endgame transition (not just early queen trade)
 */
function findEndgameTransition(positions) {
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];

    // Skip early game
    if (pos.moveNumber < 15) continue;

    // Count pieces from FEN
    const pieceCount = countPiecesFromFEN(pos.fen);
    const hasQueens = pos.fen.toLowerCase().includes('q');

    // Endgame criteria
    if (pieceCount <= 14 || (!hasQueens && pieceCount <= 18)) {
      return {
        index: i,
        moveNumber: pos.moveNumber
      };
    }
  }

  return null;
}

/**
 * Detect hidden plans - positions where best move represents different strategic idea
 */
function detectHiddenPlans(positions) {
  const moments = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];

    // Skip book moves
    if (pos.classification === 'book') continue;

    // Look for positions where a pawn break or aggressive move was best but not played
    if (couldDetectHiddenPlan(pos, positions[i - 1])) {
      moments.push({
        moveIndex: i,
        moveNumber: pos.moveNumber,
        type: 'hidden_plan',
        priority: 'high',
        description: 'Hidden strategic opportunity',
        reason: 'Position contained a non-obvious but powerful plan'
      });
    }
  }

  return moments;
}

/**
 * Simple heuristic for hidden plan detection
 * In real implementation, this would use engine analysis of top moves
 */
function couldDetectHiddenPlan(position, _previousPosition) {
  // Check for missed pawn breaks
  const isPawnBreakAvailable = position.evalChange > 50 && position.move.includes('x');

  // Check for eval drops that suggest missed opportunity
  const evalDrop = position.evalChange > 75;

  // Check for positions after quiet moves where eval suggests dynamic play
  const wasQuietMove = !position.isCapture && !position.isCheck;
  const positionDynamic = Math.abs(position.evaluation?.score) < 200;

  return (isPawnBreakAvailable || evalDrop) && wasQuietMove && positionDynamic;
}

/**
 * Detect strategic inflection points (pawn structure changes, piece trades)
 */
function detectStrategicInflections(positions) {
  const moments = [];

  for (let i = 1; i < positions.length; i++) {
    const pos = positions[i];
    const prev = positions[i - 1];

    // Skip book moves
    if (pos.classification === 'book') continue;

    // Pawn structure changes
    if (isPawnStructureChange(pos, prev)) {
      moments.push({
        moveIndex: i,
        moveNumber: pos.moveNumber,
        type: 'pawn_structure_change',
        priority: 'medium',
        description: 'Pawn structure transformation',
        reason: 'Permanent change to position character'
      });
    }

    // Major piece trades
    if (isMajorPieceTrade(pos)) {
      moments.push({
        moveIndex: i,
        moveNumber: pos.moveNumber,
        type: 'piece_trade',
        priority: 'medium',
        description: 'Major piece exchange',
        reason: 'Simplification changes strategic landscape'
      });
    }

    // Central breaks
    if (isCentralBreak(pos)) {
      moments.push({
        moveIndex: i,
        moveNumber: pos.moveNumber,
        type: 'central_break',
        priority: 'high',
        description: 'Central pawn break',
        reason: 'Opening the center transforms the position'
      });
    }
  }

  return moments;
}

/**
 * Detect prophylactic moments where preventing opponent's plan is critical
 */
function detectProphylacticMoments(positions) {
  const moments = [];

  for (let i = 1; i < positions.length - 1; i++) {
    // const prev = positions[i - 1]; // Reserved for future use
    const current = positions[i];
    const next = positions[i + 1];

    // Skip book moves
    if (current.classification === 'book') continue;

    // Look for defensive moves that maintain equality
    const wasDefensive = isDefensiveMove(current);
    const maintainedBalance = Math.abs(current.evaluation?.score) < 50;
    const preventedThreat = next.evalChange < 30; // Opponent couldn't improve much

    if (wasDefensive && maintainedBalance && preventedThreat) {
      moments.push({
        moveIndex: i,
        moveNumber: current.moveNumber,
        type: 'prophylactic',
        priority: 'medium',
        description: 'Critical defensive move',
        reason: 'Prevented opponent\'s threatening plan'
      });
    }
  }

  return moments;
}

/**
 * Detect critical decision points (complex positions, multiple viable plans)
 */
function detectCriticalDecisions(positions) {
  const moments = [];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];

    // Skip book moves and early game
    if (pos.classification === 'book' || pos.moveNumber < 10) continue;

    // Large eval swings indicate critical moments
    if (pos.evalChange >= 150) {
      moments.push({
        moveIndex: i,
        moveNumber: pos.moveNumber,
        type: 'critical_decision',
        priority: 'critical',
        description: pos.evalChange >= 300 ? 'Game-deciding moment' : 'Critical turning point',
        reason: `Major evaluation shift of ${(pos.evalChange / 100).toFixed(1)} pawns`
      });
    }

    // Positions with high complexity (would need engine analysis in real implementation)
    if (isHighComplexityPosition(pos)) {
      moments.push({
        moveIndex: i,
        moveNumber: pos.moveNumber,
        type: 'complex_position',
        priority: 'high',
        description: 'High complexity position',
        reason: 'Multiple competing plans available'
      });
    }
  }

  return moments;
}

/**
 * Detect multi-move plan sequences that should be analyzed together
 */
function detectPlanSequences(positions) {
  const sequences = [];
  let currentSequence = null;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];

    // Skip book moves
    if (pos.classification === 'book') continue;

    // Detect start of sequences (simplified for now)
    if (isSequenceStart(pos, positions[i - 1])) {
      if (currentSequence) {
        // Close previous sequence
        sequences.push(currentSequence);
      }

      currentSequence = {
        startIndex: i,
        moveNumber: pos.moveNumber,
        type: 'plan_sequence',
        priority: 'medium',
        description: 'Multi-move strategic plan',
        moves: [i],
        reason: detectSequenceType(pos)
      };
    } else if (currentSequence && isSequenceContinuation(pos, positions[currentSequence.moves[currentSequence.moves.length - 1]])) {
      currentSequence.moves.push(i);

      // Limit sequence length
      if (currentSequence.moves.length >= 5) {
        sequences.push(currentSequence);
        currentSequence = null;
      }
    } else if (currentSequence) {
      // End current sequence
      sequences.push(currentSequence);
      currentSequence = null;
    }
  }

  // Don't forget last sequence
  if (currentSequence) {
    sequences.push(currentSequence);
  }

  return sequences;
}

/**
 * Helper functions for position analysis
 */

function countDevelopedPieces(position) {
  // Simplified - would need actual position analysis
  return position.moveNumber * 0.8; // Rough approximation
}

function isCenterDefined(position) {
  // Check if central pawns have been exchanged or locked
  return position.moveNumber >= 6;
}

function countPiecesFromFEN(fen) {
  const piecePart = fen.split(' ')[0];
  return (piecePart.match(/[rnbqkpRNBQKP]/g) || []).length;
}

function isPawnStructureChange(pos, _prev) {
  return pos.move.includes('x') && pos.pieceType === 'p';
}

function isMajorPieceTrade(pos) {
  return pos.isCapture && (pos.pieceType === 'q' || pos.pieceType === 'r');
}

function isCentralBreak(pos) {
  // Check for d4, d5, e4, e5 pawn moves
  const centralPawnMoves = ['d4', 'd5', 'e4', 'e5'];
  return pos.pieceType === 'p' && centralPawnMoves.some(m => pos.move.includes(m));
}

function isDefensiveMove(pos) {
  // Simplified heuristic
  return pos.move.includes('g6') || pos.move.includes('h6') ||
         pos.move.includes('a6') || pos.move.includes('h3') ||
         pos.move.includes('g3') || pos.move.includes('a3');
}

function isHighComplexityPosition(pos) {
  // Would need engine analysis - using simple heuristic for now
  const middlegame = pos.moveNumber >= 12 && pos.moveNumber <= 30;
  const balanced = Math.abs(pos.evaluation?.score || 0) < 100;
  return middlegame && balanced && !pos.classification;
}

function isSequenceStart(pos, prev) {
  if (!prev) return false;

  // Look for start of pawn storms, piece maneuvers, etc.
  const pawnStorm = pos.pieceType === 'p' && (pos.move.includes('g') || pos.move.includes('h'));
  const pieceManeuver = pos.pieceType === 'n' && !pos.isCapture;

  return pawnStorm || pieceManeuver;
}

function isSequenceContinuation(pos, prevInSequence) {
  // Same piece type or same side of board
  return pos.pieceType === prevInSequence.pieceType ||
         (pos.move[0] === prevInSequence.move[0]); // Same file
}

function detectSequenceType(pos) {
  if (pos.move.includes('g') || pos.move.includes('h')) {
    return 'Kingside pawn storm';
  }
  if (pos.move.includes('a') || pos.move.includes('b')) {
    return 'Queenside expansion';
  }
  if (pos.pieceType === 'n') {
    return 'Knight maneuver';
  }
  return 'Strategic plan execution';
}

/**
 * Remove duplicate moments at same position
 */
function deduplicateMoments(moments) {
  const seen = new Map();

  for (const moment of moments) {
    const key = moment.moveIndex || moment.startIndex;
    if (!seen.has(key) || getPriorityValue(moment) > getPriorityValue(seen.get(key))) {
      seen.set(key, moment);
    }
  }

  return Array.from(seen.values());
}

/**
 * Prioritize moments and limit to reasonable number
 */
function prioritizeMoments(moments, gameLength) {
  // Sort by priority and move number
  moments.sort((a, b) => {
    const priorityDiff = getPriorityValue(b) - getPriorityValue(a);
    if (priorityDiff !== 0) return priorityDiff;
    return (a.moveNumber || 0) - (b.moveNumber || 0);
  });

  // Dynamic limit based on game length
  const maxMoments = Math.min(15, Math.ceil(gameLength / 5));

  // Ensure good coverage across game
  const selected = [];
  const coverage = new Set();

  // First pass: take all critical moments
  for (const moment of moments) {
    if (moment.priority === 'critical') {
      selected.push(moment);
      coverage.add(Math.floor(moment.moveNumber / 10));
    }
  }

  // Second pass: ensure coverage
  for (const moment of moments) {
    if (selected.length >= maxMoments) break;

    const bucket = Math.floor(moment.moveNumber / 10);
    if (!coverage.has(bucket) || moment.priority === 'high') {
      selected.push(moment);
      coverage.add(bucket);
    }
  }

  // Sort by move number for display
  selected.sort((a, b) => (a.moveNumber || 0) - (b.moveNumber || 0));

  return selected;
}

function getPriorityValue(moment) {
  const priorities = {
    'critical': 4,
    'high': 3,
    'medium': 2,
    'low': 1
  };
  return priorities[moment.priority] || 0;
}

module.exports = {
  detectKeyMoments,
  // Export individual detectors for testing
  detectStructuralMoments,
  detectHiddenPlans,
  detectStrategicInflections,
  detectProphylacticMoments,
  detectCriticalDecisions,
  detectPlanSequences
};