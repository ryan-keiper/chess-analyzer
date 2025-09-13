import { Eye } from 'lucide-react';

const HeuristicsPanel = ({ heuristics = {} }) => {
  // Helper to render indicator light
  const Indicator = ({ label, active, color = 'blue' }) => {
    const colorClasses = {
      blue: {
        on: 'bg-blue-500 shadow-lg shadow-blue-500/50 animate-pulse',
        off: 'bg-gray-300'
      },
      green: {
        on: 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse',
        off: 'bg-gray-300'
      },
      yellow: {
        on: 'bg-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse',
        off: 'bg-gray-300'
      },
      orange: {
        on: 'bg-orange-500 shadow-lg shadow-orange-500/50 animate-pulse',
        off: 'bg-gray-300'
      },
      red: {
        on: 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse',
        off: 'bg-gray-300'
      },
      purple: {
        on: 'bg-purple-500 shadow-lg shadow-purple-500/50 animate-pulse',
        off: 'bg-gray-300'
      }
    };
    
    const classes = colorClasses[color] || colorClasses.blue;
    
    return (
      <div className="flex items-center gap-2 py-1">
        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
          active ? classes.on : classes.off
        }`}></div>
        <span className={`text-xs transition-colors ${
          active ? 'text-gray-800 font-medium' : 'text-gray-500'
        }`}>
          {label}
        </span>
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 h-full flex flex-col">
      <div className="flex items-center mb-3 flex-shrink-0">
        <Eye className="w-5 h-5 text-indigo-500 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">Heuristics Monitor</h2>
      </div>
      
      <div className="flex-1 min-h-0 pr-2" style={{ overflowY: 'scroll', maxHeight: 'calc(80vh - 200px)' }}>
        <div className="space-y-3">
          {/* Game Phase */}
          <div className="border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Game Phase</h3>
          <div className="space-y-1">
            <Indicator label="Opening" active={heuristics.phase === 'opening'} color="green" />
            <Indicator label="Middlegame" active={heuristics.phase === 'middlegame'} color="yellow" />
            <Indicator label="Endgame" active={heuristics.phase === 'endgame'} color="orange" />
          </div>
        </div>
        
        {/* Key Moments */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Key Moments</h3>
          <div className="space-y-1">
            <Indicator label="Opening Transition" active={heuristics.openingTransition} color="purple" />
            <Indicator label="Hidden Plan Detected" active={heuristics.hiddenPlan} color="purple" />
            <Indicator label="Pawn Structure Change" active={heuristics.pawnStructureChange} color="purple" />
            <Indicator label="Critical Decision" active={heuristics.criticalDecision} color="red" />
            <Indicator label="Prophylactic Move" active={heuristics.prophylactic} color="purple" />
            <Indicator label="Plan Sequence Active" active={heuristics.planSequence} color="purple" />
          </div>
        </div>
        
        {/* Pawn Structure */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Pawn Structure</h3>
          <div className="space-y-1">
            <Indicator label="Pawn Break" active={heuristics.pawnBreak} color="blue" />
            <Indicator label="Passed Pawn (White)" active={heuristics.passedPawnWhite} color="blue" />
            <Indicator label="Passed Pawn (Black)" active={heuristics.passedPawnBlack} color="blue" />
            <Indicator label="Isolated Pawns" active={heuristics.isolatedPawns} color="yellow" />
            <Indicator label="Doubled Pawns" active={heuristics.doubledPawns} color="yellow" />
            <Indicator label="Backward Pawns" active={heuristics.backwardPawns} color="yellow" />
            <Indicator label="Pawn Chain" active={heuristics.pawnChain} color="green" />
            <Indicator label="Center Tension" active={heuristics.centerTension} color="orange" />
            <Indicator label="Q-side Majority" active={heuristics.queensideMajority} color="blue" />
            <Indicator label="K-side Majority" active={heuristics.kingsideMajority} color="blue" />
          </div>
        </div>
        
        {/* King Safety */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">King Safety</h3>
          <div className="space-y-1">
            <Indicator label="White King Castled" active={heuristics.whiteKingCastled} color="green" />
            <Indicator label="White King Exposed" active={heuristics.whiteKingExposed} color="red" />
            <Indicator label="Black King Castled" active={heuristics.blackKingCastled} color="green" />
            <Indicator label="Black King Exposed" active={heuristics.blackKingExposed} color="red" />
          </div>
        </div>
        
        {/* Material & Tactics */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Material & Tactics</h3>
          <div className="space-y-1">
            <Indicator label="Material Imbalance" active={heuristics.materialImbalance} color="orange" />
            <Indicator label="Capture Made" active={heuristics.capture} color="yellow" />
            <Indicator label="Check Given" active={heuristics.check} color="red" />
            <Indicator label="Promotion" active={heuristics.promotion} color="purple" />
            <Indicator label="Piece Trade" active={heuristics.pieceTrade} color="blue" />
          </div>
        </div>
        
        {/* Positional Elements */}
        <div className="border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Positional Elements</h3>
          <div className="space-y-1">
            <Indicator label="White Space Advantage" active={heuristics.whiteSpaceAdvantage} color="green" />
            <Indicator label="Black Space Advantage" active={heuristics.blackSpaceAdvantage} color="green" />
            <Indicator label="White Center Control" active={heuristics.whiteCenterControl} color="blue" />
            <Indicator label="Black Center Control" active={heuristics.blackCenterControl} color="blue" />
            <Indicator label="Center Contested" active={heuristics.centerContested} color="yellow" />
            <Indicator label="Outpost Occupied" active={heuristics.outpost} color="green" />
            <Indicator label="Weak Square" active={heuristics.weakSquare} color="orange" />
            <Indicator label="Initiative Shift" active={heuristics.initiativeShift} color="purple" />
            <Indicator label="High Complexity" active={heuristics.highComplexity} color="red" />
          </div>
        </div>
        
        {/* Move Classification */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Move Quality</h3>
          <div className="space-y-1">
            <Indicator label="Book Move" active={heuristics.bookMove} color="green" />
            <Indicator label="Excellent Move" active={heuristics.excellentMove} color="green" />
            <Indicator label="Good Move" active={heuristics.goodMove} color="blue" />
            <Indicator label="Inaccuracy" active={heuristics.inaccuracy} color="yellow" />
            <Indicator label="Mistake" active={heuristics.mistake} color="orange" />
            <Indicator label="Blunder" active={heuristics.blunder} color="red" />
          </div>
        </div>
        </div>
      </div>
      
      <div className="mt-3 pt-2 border-t flex-shrink-0">
        <div className="text-xs text-gray-500">
          {Object.values(heuristics).filter(v => v === true || (typeof v === 'string' && v !== '')).length} active indicators
        </div>
      </div>
    </div>
  );
};

export default HeuristicsPanel;