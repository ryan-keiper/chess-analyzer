// Chess.js not directly used - positions handled by main analyzer

/**
 * Service for building comprehensive context packages for LLM analysis
 * Creates rich, structured data to enable insightful chess position analysis
 */

/**
 * Build context for a single key moment
 * @param {Object} moment - Key moment object from detector
 * @param {Array} positions - All positions in the game
 * @param {Object} gameInfo - Game metadata
 * @returns {Object} Complete context package for LLM
 */
async function buildContextForMoment(moment, positions, gameInfo) {
  // Handle plan sequences (multiple positions)
  if (moment.type === 'plan_sequence' && moment.moves) {
    return buildSequenceContext(moment, positions, gameInfo);
  }

  // Single position context
  const moveIndex = moment.moveIndex;
  const position = positions[moveIndex];
  const previousPosition = moveIndex > 0 ? positions[moveIndex - 1] : null;
  // Reserved for future lookahead analysis
  // const nextPosition = moveIndex < positions.length - 1 ? positions[moveIndex + 1] : null;

  return {
    // Meta information
    meta: {
      moveNumber: position.moveNumber,
      moveIndex: moveIndex,
      halfMove: moveIndex + 1,
      momentType: moment.type,
      priority: moment.priority,
      description: moment.description,
      reason: moment.reason
    },

    // Core position data
    position: buildPositionData(position),

    // Piece placement (prevents LLM hallucination)
    pieces: extractPiecesFromFEN(position.fen),

    // Pawn structure analysis
    pawnStructure: analyzePawnStructure(position.fen),

    // King safety
    kingSafety: analyzeKingSafety(position.fen),

    // Engine analysis
    engineAnalysis: buildEngineContext(position),

    // Historical context
    history: buildHistoricalContext(positions, moveIndex, gameInfo),

    // Strategic themes
    strategicThemes: identifyStrategicThemes(position, previousPosition),

    // Square control and piece activity
    boardControl: analyzeBoardControl(position.fen),

    // Material balance
    material: calculateMaterialBalance(position.fen),

    // Time management (if available)
    timeContext: buildTimeContext(position),

    // Opening context
    openingContext: buildOpeningContext(position, gameInfo)
  };
}

/**
 * Build context for a sequence of moves (plan execution)
 */
async function buildSequenceContext(moment, positions, gameInfo) {
  const sequencePositions = moment.moves.map(idx => positions[idx]);
  const startPos = positions[moment.moves[0]];
  const endPos = positions[moment.moves[moment.moves.length - 1]];

  return {
    // Meta information
    meta: {
      startMove: startPos.moveNumber,
      endMove: endPos.moveNumber,
      moveCount: moment.moves.length,
      momentType: moment.type,
      priority: moment.priority,
      description: moment.description,
      reason: moment.reason,
      sequenceType: 'plan_execution'
    },

    // Positions in sequence
    sequence: sequencePositions.map(pos => ({
      moveNumber: pos.moveNumber,
      move: pos.move,
      fen: pos.fen,
      evaluation: pos.evaluation,
      classification: pos.classification
    })),

    // Starting position
    startPosition: {
      position: buildPositionData(startPos),
      pieces: extractPiecesFromFEN(startPos.fen),
      pawnStructure: analyzePawnStructure(startPos.fen)
    },

    // Ending position
    endPosition: {
      position: buildPositionData(endPos),
      pieces: extractPiecesFromFEN(endPos.fen),
      pawnStructure: analyzePawnStructure(endPos.fen)
    },

    // What changed during the sequence
    planExecution: {
      pawnStructureChanges: comparePawnStructures(startPos.fen, endPos.fen),
      pieceActivityChanges: comparePieceActivity(startPos.fen, endPos.fen),
      evaluationTrend: analyzeEvalTrend(sequencePositions),
      territorialGains: analyzeTerritorialChanges(startPos.fen, endPos.fen)
    },

    // Strategic assessment
    strategicAssessment: assessPlanSuccess(sequencePositions),

    // Historical context
    history: buildHistoricalContext(positions, moment.moves[0], gameInfo)
  };
}

/**
 * Build core position data
 */
function buildPositionData(position) {
  return {
    fen: position.fen,
    move: position.move,
    moveNumber: position.moveNumber,
    color: position.color === 'w' ? 'white' : 'black',
    evaluation: {
      score: position.evaluation?.score || 0,
      type: position.evaluation?.type || 'cp',
      depth: position.evaluation?.depth || 15
    },
    classification: position.classification,
    evalChange: position.evalChange,
    isCapture: position.isCapture,
    isCheck: position.isCheck,
    isPromotion: position.isPromotion
  };
}

/**
 * Extract pieces from FEN to prevent LLM hallucination
 */
function extractPiecesFromFEN(fen) {
  const pieces = [];
  const [board] = fen.split(' ');
  const rows = board.split('/');

  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const char of rows[rank]) {
      if (isNaN(char)) {
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase();
        const square = String.fromCharCode(97 + file) + (8 - rank);
        pieces.push({ color, type, square });
        file++;
      } else {
        file += parseInt(char);
      }
    }
  }

  return pieces;
}

/**
 * Analyze pawn structure
 */
function analyzePawnStructure(fen) {
  const pieces = extractPiecesFromFEN(fen);
  const whitePawns = pieces.filter(p => p.color === 'w' && p.type === 'p').map(p => p.square);
  const blackPawns = pieces.filter(p => p.color === 'b' && p.type === 'p').map(p => p.square);

  return {
    white: {
      pawns: whitePawns,
      islands: countPawnIslands(whitePawns),
      doubled: findDoubledPawns(whitePawns),
      isolated: findIsolatedPawns(whitePawns),
      passed: findPassedPawns(whitePawns, blackPawns, 'w'),
      backward: findBackwardPawns(whitePawns, blackPawns, 'w'),
      chains: findPawnChains(whitePawns)
    },
    black: {
      pawns: blackPawns,
      islands: countPawnIslands(blackPawns),
      doubled: findDoubledPawns(blackPawns),
      isolated: findIsolatedPawns(blackPawns),
      passed: findPassedPawns(blackPawns, whitePawns, 'b'),
      backward: findBackwardPawns(blackPawns, whitePawns, 'b'),
      chains: findPawnChains(blackPawns)
    },
    center: analyzeCenterPawns(whitePawns, blackPawns),
    tension: findPawnTension(whitePawns, blackPawns)
  };
}

/**
 * Analyze king safety
 */
function analyzeKingSafety(fen) {
  const pieces = extractPiecesFromFEN(fen);
  const whiteKing = pieces.find(p => p.color === 'w' && p.type === 'k');
  const blackKing = pieces.find(p => p.color === 'b' && p.type === 'k');

  return {
    white: {
      position: whiteKing?.square,
      castled: isKingCastled(whiteKing?.square, 'w'),
      pawnShield: evaluatePawnShield(whiteKing?.square, pieces, 'w'),
      openFiles: findOpenFilesNearKing(whiteKing?.square, pieces),
      attackers: countAttackersNearKing(whiteKing?.square, pieces, 'b')
    },
    black: {
      position: blackKing?.square,
      castled: isKingCastled(blackKing?.square, 'b'),
      pawnShield: evaluatePawnShield(blackKing?.square, pieces, 'b'),
      openFiles: findOpenFilesNearKing(blackKing?.square, pieces),
      attackers: countAttackersNearKing(blackKing?.square, pieces, 'w')
    }
  };
}

/**
 * Build engine analysis context
 */
function buildEngineContext(position) {
  // In real implementation, this would include top engine moves
  // For now, we'll structure what we have
  return {
    currentEval: {
      score: position.evaluation?.score || 0,
      type: position.evaluation?.type || 'cp'
    },
    moveQuality: position.classification,
    evalChange: position.evalChange,
    // These would be populated with actual engine analysis
    topMoves: [],
    threats: [],
    tactics: detectBasicTactics(position)
  };
}

/**
 * Build historical context
 */
function buildHistoricalContext(positions, currentIndex, gameInfo) {
  const recentMoves = [];
  const lookback = Math.min(10, currentIndex);

  for (let i = Math.max(0, currentIndex - lookback); i <= currentIndex; i++) {
    recentMoves.push({
      moveNumber: positions[i].moveNumber,
      move: positions[i].move,
      classification: positions[i].classification,
      evalChange: positions[i].evalChange
    });
  }

  return {
    recentMoves: recentMoves,
    openingName: gameInfo?.opening?.name || 'Unknown',
    eco: gameInfo?.opening?.eco || '',
    lastBookMove: gameInfo?.opening?.lastBookMove || 0,
    gamePhase: determineGamePhase(positions[currentIndex]),
    movesPlayed: currentIndex + 1,
    totalGameMoves: positions.length
  };
}

/**
 * Identify strategic themes in the position
 */
function identifyStrategicThemes(position, _previousPosition) {
  const themes = [];

  // Space advantage
  const spaceControl = calculateSpaceControl(position.fen);
  if (Math.abs(spaceControl.white - spaceControl.black) > 5) {
    themes.push({
      theme: 'space_advantage',
      side: spaceControl.white > spaceControl.black ? 'white' : 'black',
      magnitude: Math.abs(spaceControl.white - spaceControl.black)
    });
  }

  // Piece activity
  const activity = assessPieceActivity(position.fen);
  themes.push({
    theme: 'piece_activity',
    assessment: activity
  });

  // Pawn majority
  const pawnStructure = analyzePawnStructure(position.fen);
  const queensideMajority = detectPawnMajority(pawnStructure, 'queenside');
  const kingsideMajority = detectPawnMajority(pawnStructure, 'kingside');

  if (queensideMajority) {
    themes.push({
      theme: 'pawn_majority',
      side: queensideMajority,
      flank: 'queenside'
    });
  }

  if (kingsideMajority) {
    themes.push({
      theme: 'pawn_majority',
      side: kingsideMajority,
      flank: 'kingside'
    });
  }

  // Attack patterns
  if (position.isCheck) {
    themes.push({
      theme: 'king_attack',
      active: true
    });
  }

  return themes;
}

/**
 * Analyze board control
 */
function analyzeBoardControl(fen) {
  const pieces = extractPiecesFromFEN(fen);

  return {
    centerControl: analyzeCenterControl(pieces),
    outposts: findOutposts(pieces),
    weakSquares: findWeakSquares(pieces),
    keySquares: identifyKeySquares(fen)
  };
}

/**
 * Calculate material balance
 */
function calculateMaterialBalance(fen) {
  const pieces = extractPiecesFromFEN(fen);
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  let whiteValue = 0;
  let blackValue = 0;
  const whitePieces = {};
  const blackPieces = {};

  for (const piece of pieces) {
    const value = values[piece.type];
    if (piece.color === 'w') {
      whiteValue += value;
      whitePieces[piece.type] = (whitePieces[piece.type] || 0) + 1;
    } else {
      blackValue += value;
      blackPieces[piece.type] = (blackPieces[piece.type] || 0) + 1;
    }
  }

  return {
    white: {
      total: whiteValue,
      pieces: whitePieces
    },
    black: {
      total: blackValue,
      pieces: blackPieces
    },
    difference: whiteValue - blackValue,
    phase: determineMaterialPhase(whiteValue + blackValue)
  };
}

/**
 * Build time context if available
 */
function buildTimeContext(_position) {
  // Placeholder - would use actual time data if available
  return {
    moveTime: null,
    totalTime: null,
    timeRemaining: null,
    timePressure: false
  };
}

/**
 * Build opening context
 */
function buildOpeningContext(position, gameInfo) {
  return {
    name: gameInfo?.opening?.name || 'Unknown',
    eco: gameInfo?.opening?.eco || '',
    inBook: position.classification === 'book',
    lastBookMove: gameInfo?.opening?.lastBookMove || 0,
    variation: gameInfo?.opening?.variation || '',
    theoreticalAssessment: position.classification === 'book' ? 'Following theory' : 'Out of book'
  };
}

/**
 * Helper functions for pawn structure analysis
 */

function countPawnIslands(pawns) {
  if (pawns.length === 0) return 0;

  const files = pawns.map(p => p[0]).sort();
  let islands = 1;

  for (let i = 1; i < files.length; i++) {
    if (files[i].charCodeAt(0) - files[i - 1].charCodeAt(0) > 1) {
      islands++;
    }
  }

  return islands;
}

function findDoubledPawns(pawns) {
  const files = {};
  for (const pawn of pawns) {
    const file = pawn[0];
    files[file] = (files[file] || 0) + 1;
  }

  return Object.entries(files)
    .filter(([_file, count]) => count > 1)
    .map(([file]) => file);
}

function findIsolatedPawns(pawns) {
  const files = new Set(pawns.map(p => p[0]));
  const isolated = [];

  for (const file of files) {
    const fileCode = file.charCodeAt(0);
    const hasLeft = files.has(String.fromCharCode(fileCode - 1));
    const hasRight = files.has(String.fromCharCode(fileCode + 1));

    if (!hasLeft && !hasRight) {
      isolated.push(file);
    }
  }

  return isolated;
}

function findPassedPawns(ourPawns, theirPawns, color) {
  const passed = [];

  for (const pawn of ourPawns) {
    const file = pawn[0];
    const rank = parseInt(pawn[1]);

    // Check if any enemy pawns can stop this pawn
    const canBeStopped = theirPawns.some(enemyPawn => {
      const enemyFile = enemyPawn[0];
      const enemyRank = parseInt(enemyPawn[1]);

      // Check adjacent files and same file
      const fileDistance = Math.abs(enemyFile.charCodeAt(0) - file.charCodeAt(0));
      if (fileDistance > 1) return false;

      // Check if enemy pawn is in front
      if (color === 'w') {
        return enemyRank > rank;
      } else {
        return enemyRank < rank;
      }
    });

    if (!canBeStopped) {
      passed.push(pawn);
    }
  }

  return passed;
}

function findBackwardPawns(ourPawns, theirPawns, color) {
  // Simplified implementation
  const backward = [];

  for (const pawn of ourPawns) {
    const file = pawn[0];
    const rank = parseInt(pawn[1]);

    // Check if pawn is behind its neighbors
    const neighbors = ourPawns.filter(p => {
      const pFile = p[0];
      return Math.abs(pFile.charCodeAt(0) - file.charCodeAt(0)) === 1;
    });

    const isBehind = neighbors.some(n => {
      const nRank = parseInt(n[1]);
      return color === 'w' ? nRank > rank : nRank < rank;
    });

    if (isBehind) {
      backward.push(pawn);
    }
  }

  return backward;
}

function findPawnChains(pawns) {
  // Find connected pawn chains
  const chains = [];
  const visited = new Set();

  for (const pawn of pawns) {
    if (visited.has(pawn)) continue;

    const chain = [pawn];
    visited.add(pawn);

    // Find connected pawns
    for (const other of pawns) {
      if (visited.has(other)) continue;

      const file1 = pawn[0].charCodeAt(0);
      const file2 = other[0].charCodeAt(0);
      const rank1 = parseInt(pawn[1]);
      const rank2 = parseInt(other[1]);

      // Diagonal connection
      if (Math.abs(file1 - file2) === 1 && Math.abs(rank1 - rank2) === 1) {
        chain.push(other);
        visited.add(other);
      }
    }

    if (chain.length > 1) {
      chains.push(chain);
    }
  }

  return chains;
}

function analyzeCenterPawns(whitePawns, blackPawns) {
  const centerFiles = ['d', 'e'];
  const centerRanks = ['3', '4', '5', '6'];

  const whiteCenterPawns = whitePawns.filter(p =>
    centerFiles.includes(p[0]) && centerRanks.includes(p[1])
  );

  const blackCenterPawns = blackPawns.filter(p =>
    centerFiles.includes(p[0]) && centerRanks.includes(p[1])
  );

  return {
    white: whiteCenterPawns,
    black: blackCenterPawns,
    control: whiteCenterPawns.length - blackCenterPawns.length
  };
}

function findPawnTension(whitePawns, blackPawns) {
  const tensions = [];

  for (const wPawn of whitePawns) {
    for (const bPawn of blackPawns) {
      const wFile = wPawn[0].charCodeAt(0);
      const bFile = bPawn[0].charCodeAt(0);
      const wRank = parseInt(wPawn[1]);
      const bRank = parseInt(bPawn[1]);

      // Pawns face each other diagonally
      if (Math.abs(wFile - bFile) === 1 && bRank - wRank === 1) {
        tensions.push({
          white: wPawn,
          black: bPawn,
          type: 'capture_possible'
        });
      }
    }
  }

  return tensions;
}

/**
 * Additional helper functions
 */

function isKingCastled(kingSquare, color) {
  if (!kingSquare) return false;

  // Check if king is on castled position
  if (color === 'w') {
    return kingSquare === 'g1' || kingSquare === 'c1';
  } else {
    return kingSquare === 'g8' || kingSquare === 'c8';
  }
}

function evaluatePawnShield(kingSquare, pieces, color) {
  if (!kingSquare) return 'none';

  const kingFile = kingSquare[0].charCodeAt(0);
  const kingRank = parseInt(kingSquare[1]);

  const shieldPawns = pieces.filter(p => {
    if (p.type !== 'p' || p.color !== color) return false;

    const pawnFile = p.square[0].charCodeAt(0);
    const pawnRank = parseInt(p.square[1]);

    // Pawns in front of king
    const fileDiff = Math.abs(pawnFile - kingFile);
    const rankDiff = color === 'w' ? pawnRank - kingRank : kingRank - pawnRank;

    return fileDiff <= 1 && rankDiff === 1;
  });

  if (shieldPawns.length >= 2) return 'intact';
  if (shieldPawns.length === 1) return 'partial';
  return 'compromised';
}

function findOpenFilesNearKing(kingSquare, pieces) {
  if (!kingSquare) return [];

  const kingFile = kingSquare[0].charCodeAt(0);
  const openFiles = [];

  for (let i = -1; i <= 1; i++) {
    const file = String.fromCharCode(kingFile + i);
    if (file < 'a' || file > 'h') continue;

    const hasPawn = pieces.some(p => p.type === 'p' && p.square[0] === file);
    if (!hasPawn) {
      openFiles.push(file);
    }
  }

  return openFiles;
}

function countAttackersNearKing(kingSquare, pieces, attackerColor) {
  if (!kingSquare) return 0;

  // Simplified - counts enemy pieces that could potentially attack
  const kingFile = kingSquare[0].charCodeAt(0);
  const kingRank = parseInt(kingSquare[1]);

  return pieces.filter(p => {
    if (p.color !== attackerColor) return false;
    if (p.type === 'p' || p.type === 'k') return false;

    const pieceFile = p.square[0].charCodeAt(0);
    const pieceRank = parseInt(p.square[1]);

    // Within 3 squares
    return Math.abs(pieceFile - kingFile) <= 3 && Math.abs(pieceRank - kingRank) <= 3;
  }).length;
}

function detectBasicTactics(position) {
  const tactics = [];

  if (position.isCheck) {
    tactics.push('check');
  }

  if (position.isCapture) {
    tactics.push('capture');
  }

  if (position.isPromotion) {
    tactics.push('promotion');
  }

  // Would need more analysis for pins, forks, etc.

  return tactics;
}

function determineGamePhase(position) {
  const moveNumber = position.moveNumber;

  if (moveNumber <= 10) return 'opening';
  if (moveNumber <= 25) return 'middlegame';
  if (moveNumber <= 40) return 'late_middlegame';
  return 'endgame';
}

function calculateSpaceControl(fen) {
  // Simplified space calculation
  const pieces = extractPiecesFromFEN(fen);

  let whiteControl = 0;
  let blackControl = 0;

  for (const piece of pieces) {
    const rank = parseInt(piece.square[1]);

    if (piece.color === 'w') {
      whiteControl += rank; // Higher rank = more space
    } else {
      blackControl += (9 - rank); // Lower rank = more space for black
    }
  }

  return { white: whiteControl, black: blackControl };
}

function assessPieceActivity(fen) {
  const pieces = extractPiecesFromFEN(fen);

  // Count developed pieces
  const whiteDeveloped = pieces.filter(p =>
    p.color === 'w' && p.type !== 'p' && p.type !== 'k' &&
    (p.square[1] !== '1' || (p.type === 'r' && (p.square === 'a1' || p.square === 'h1')))
  ).length;

  const blackDeveloped = pieces.filter(p =>
    p.color === 'b' && p.type !== 'p' && p.type !== 'k' &&
    (p.square[1] !== '8' || (p.type === 'r' && (p.square === 'a8' || p.square === 'h8')))
  ).length;

  return {
    white: whiteDeveloped,
    black: blackDeveloped,
    advantage: whiteDeveloped > blackDeveloped ? 'white' : blackDeveloped > whiteDeveloped ? 'black' : 'equal'
  };
}

function detectPawnMajority(pawnStructure, flank) {
  const files = flank === 'queenside' ? ['a', 'b', 'c', 'd'] : ['e', 'f', 'g', 'h'];

  const whitePawns = pawnStructure.white.pawns.filter(p => files.includes(p[0])).length;
  const blackPawns = pawnStructure.black.pawns.filter(p => files.includes(p[0])).length;

  if (whitePawns > blackPawns + 1) return 'white';
  if (blackPawns > whitePawns + 1) return 'black';
  return null;
}

function analyzeCenterControl(pieces) {
  const centerSquares = ['d4', 'd5', 'e4', 'e5'];
  const extendedCenter = ['c3', 'c4', 'c5', 'c6', 'd3', 'd6', 'e3', 'e6', 'f3', 'f4', 'f5', 'f6'];

  let whiteControl = 0;
  let blackControl = 0;

  // Count pieces controlling center
  for (const square of centerSquares) {
    // Simplified - would need actual control calculation
    const hasPiece = pieces.find(p => p.square === square);
    if (hasPiece) {
      if (hasPiece.color === 'w') whiteControl += 2;
      else blackControl += 2;
    }
  }

  for (const square of extendedCenter) {
    const hasPiece = pieces.find(p => p.square === square);
    if (hasPiece) {
      if (hasPiece.color === 'w') whiteControl += 1;
      else blackControl += 1;
    }
  }

  return {
    white: whiteControl,
    black: blackControl,
    assessment: whiteControl > blackControl ? 'white_controls' : blackControl > whiteControl ? 'black_controls' : 'contested'
  };
}

function findOutposts(pieces) {
  // Find squares where knights would be strong
  const outposts = [];

  // Common outpost squares
  const knightOutposts = ['c5', 'd5', 'e5', 'f5', 'c4', 'd4', 'e4', 'f4'];

  for (const square of knightOutposts) {
    const piece = pieces.find(p => p.square === square);
    if (piece && piece.type === 'n') {
      outposts.push({
        square: square,
        piece: piece.color === 'w' ? 'white_knight' : 'black_knight'
      });
    }
  }

  return outposts;
}

function findWeakSquares(pieces) {
  // Simplified - would need proper weak square detection
  const weakSquares = [];

  // Check for holes in pawn structure
  const pawns = pieces.filter(p => p.type === 'p');

  // Common weak squares
  const checkSquares = ['d5', 'd4', 'e5', 'e4', 'f5', 'f4'];

  for (const square of checkSquares) {
    const file = square[0];
    const rank = parseInt(square[1]);

    // Check if square is defended by pawns
    const defended = pawns.some(p => {
      const pFile = p.square[0];
      const pRank = parseInt(p.square[1]);

      // Can pawn defend this square?
      const fileDiff = Math.abs(pFile.charCodeAt(0) - file.charCodeAt(0));
      const rankDiff = p.color === 'w' ? rank - pRank : pRank - rank;

      return fileDiff === 1 && rankDiff === 1;
    });

    if (!defended) {
      weakSquares.push(square);
    }
  }

  return weakSquares;
}

function identifyKeySquares(fen) {
  // Identify strategically important squares
  const pieces = extractPiecesFromFEN(fen);
  const keySquares = [];

  // Center squares are always key
  keySquares.push(...['d4', 'd5', 'e4', 'e5']);

  // Squares near kings
  const kings = pieces.filter(p => p.type === 'k');
  for (const king of kings) {
    const file = king.square[0].charCodeAt(0);
    const rank = parseInt(king.square[1]);

    // Squares around king
    for (let f = -1; f <= 1; f++) {
      for (let r = -1; r <= 1; r++) {
        if (f === 0 && r === 0) continue;

        const newFile = String.fromCharCode(file + f);
        const newRank = rank + r;

        if (newFile >= 'a' && newFile <= 'h' && newRank >= 1 && newRank <= 8) {
          const square = newFile + newRank;
          if (!keySquares.includes(square)) {
            keySquares.push(square);
          }
        }
      }
    }
  }

  return keySquares;
}

function determineMaterialPhase(totalMaterial) {
  if (totalMaterial > 60) return 'opening';
  if (totalMaterial > 40) return 'middlegame';
  if (totalMaterial > 20) return 'endgame';
  return 'late_endgame';
}

/**
 * Functions for sequence analysis
 */

function comparePawnStructures(startFen, endFen) {
  const startPawns = extractPiecesFromFEN(startFen).filter(p => p.type === 'p');
  const endPawns = extractPiecesFromFEN(endFen).filter(p => p.type === 'p');

  const changes = {
    captured: [],
    advanced: [],
    newWeaknesses: [],
    newStrengths: []
  };

  // Find captured pawns
  for (const pawn of startPawns) {
    if (!endPawns.find(p => p.square === pawn.square && p.color === pawn.color)) {
      changes.captured.push(pawn);
    }
  }

  // Find advanced pawns
  for (const endPawn of endPawns) {
    const startPawn = startPawns.find(p => p.color === endPawn.color && p.square[0] === endPawn.square[0]);
    if (startPawn) {
      const startRank = parseInt(startPawn.square[1]);
      const endRank = parseInt(endPawn.square[1]);

      if (endPawn.color === 'w' ? endRank > startRank : endRank < startRank) {
        changes.advanced.push({
          from: startPawn.square,
          to: endPawn.square
        });
      }
    }
  }

  return changes;
}

function comparePieceActivity(startFen, endFen) {
  const startActivity = assessPieceActivity(startFen);
  const endActivity = assessPieceActivity(endFen);

  return {
    whiteChange: endActivity.white - startActivity.white,
    blackChange: endActivity.black - startActivity.black,
    improvement: endActivity.advantage
  };
}

function analyzeEvalTrend(positions) {
  if (positions.length === 0) return 'stable';

  const evals = positions.map(p => p.evaluation?.score || 0);
  const start = evals[0];
  const end = evals[evals.length - 1];
  const change = end - start;

  if (Math.abs(change) < 30) return 'stable';
  if (change > 100) return 'white_improving';
  if (change < -100) return 'black_improving';
  if (change > 0) return 'slight_white_advantage';
  return 'slight_black_advantage';
}

function analyzeTerritorialChanges(startFen, endFen) {
  const startSpace = calculateSpaceControl(startFen);
  const endSpace = calculateSpaceControl(endFen);

  return {
    whiteGain: endSpace.white - startSpace.white,
    blackGain: endSpace.black - startSpace.black
  };
}

function assessPlanSuccess(positions) {
  // Assess whether the plan execution was successful
  const evalTrend = analyzeEvalTrend(positions);
  const startEval = positions[0].evaluation?.score || 0;
  const endEval = positions[positions.length - 1].evaluation?.score || 0;
  const evalChange = endEval - startEval;

  // Determine who executed the plan
  const planExecutor = positions[0].color;

  let assessment = 'neutral';
  if (planExecutor === 'w') {
    if (evalChange > 50) assessment = 'successful';
    else if (evalChange < -50) assessment = 'backfired';
    else assessment = 'inconclusive';
  } else {
    if (evalChange < -50) assessment = 'successful';
    else if (evalChange > 50) assessment = 'backfired';
    else assessment = 'inconclusive';
  }

  return {
    executor: planExecutor === 'w' ? 'white' : 'black',
    evalChange: evalChange,
    trend: evalTrend,
    assessment: assessment
  };
}

module.exports = {
  buildContextForMoment,
  buildSequenceContext,
  // Export helpers for testing
  extractPiecesFromFEN,
  analyzePawnStructure,
  analyzeKingSafety,
  calculateMaterialBalance
};