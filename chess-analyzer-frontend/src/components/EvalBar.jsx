import { useEffect, useState } from 'react';

const EvalBar = ({ currentEval = 0, boardOrientation = 'white', isMate = false, mateIn = 0 }) => {
  const [whitePercentage, setWhitePercentage] = useState(50);
  
  useEffect(() => {
    // Calculate percentage based on eval
    let percentage = 50; // Default to equal position
    
    if (isMate) {
      // If it's mate, full bar for winning side
      percentage = mateIn > 0 ? 100 : 0;
    } else {
      // Convert centipawns to pawns
      const evalInPawns = currentEval / 100;
      
      // Lichess-style scaling:
      // -5.5 to +5.5 maps to roughly 5% to 95%
      // Beyond ±5.5, asymptotically approach 0% or 100%
      
      if (Math.abs(evalInPawns) <= 5.5) {
        // Linear scaling within -5.5 to +5.5 range
        // Maps to 5% - 95% to always show some of both colors
        const scaledEval = evalInPawns / 5.5; // -1 to +1
        percentage = 50 + (scaledEval * 45); // 5% to 95%
      } else {
        // Beyond ±5.5, asymptotically approach boundaries
        // Use tanh for smooth curve
        const sign = evalInPawns > 0 ? 1 : -1;
        const excess = Math.abs(evalInPawns) - 5.5;
        const asymptotic = Math.tanh(excess / 2) * 5; // 0 to 5% additional
        percentage = 50 + (sign * 45) + (sign * asymptotic);
      }
      
      // Clamp between 2% and 98% to always show both colors (unless mate)
      percentage = Math.max(2, Math.min(98, percentage));
    }
    
    // If viewing from black's perspective, invert the percentage
    // This makes the bar visually flip when changing perspective
    const finalPercentage = boardOrientation === 'white' ? percentage : 100 - percentage;
    setWhitePercentage(finalPercentage);
  }, [currentEval, isMate, mateIn, boardOrientation]);
  
  // Determine which color is on top based on board orientation
  const topColor = boardOrientation === 'white' ? 'black' : 'white';
  const bottomColor = boardOrientation === 'white' ? 'white' : 'black';
  
  // Calculate tick positions (in percentages from bottom)
  // Ticks at: -5.5, -3, -1.5, 0, +1.5, +3, +5.5 (in pawns)
  const tickPositions = [
    { eval: -5.5, pos: 5 },
    { eval: -3, pos: 50 - (3/5.5 * 45) },
    { eval: -1.5, pos: 50 - (1.5/5.5 * 45) },
    { eval: 0, pos: 50 },
    { eval: 1.5, pos: 50 + (1.5/5.5 * 45) },
    { eval: 3, pos: 50 + (3/5.5 * 45) },
    { eval: 5.5, pos: 95 }
  ];
  
  return (
    <div className="relative h-full w-4 bg-gray-200 rounded-lg shadow-inner overflow-hidden">
      {/* Eval bar fill - colors swap based on board orientation */}
      <div className="absolute inset-0 flex flex-col">
        {/* Top color (Black or White depending on orientation) */}
        <div 
          className={`transition-all duration-300 ${
            topColor === 'black' ? 'bg-gray-800' : 'bg-gray-100'
          }`}
          style={{ height: `${100 - whitePercentage}%` }}
        />
        
        {/* Bottom color (White or Black depending on orientation) */}
        <div 
          className={`transition-all duration-300 ${
            bottomColor === 'white' ? 'bg-gray-100' : 'bg-gray-800'
          }`}
          style={{ height: `${whitePercentage}%` }}
        />
      </div>
      
      {/* Tick marks */}
      <div className="absolute inset-0 pointer-events-none">
        {tickPositions.map((tick, index) => (
          <div
            key={index}
            className="absolute w-full h-px bg-gray-400 opacity-40"
            style={{ 
              bottom: `${tick.pos}%`,
              transform: 'translateY(0.5px)'
            }}
          />
        ))}
      </div>
      
      {/* Center line (0 eval) - slightly thicker */}
      <div 
        className="absolute w-full h-0.5 bg-gray-500 opacity-60"
        style={{ 
          bottom: '50%',
          transform: 'translateY(50%)'
        }}
      />
      
      {/* Mate indicator */}
      {isMate && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`text-xs font-bold transform -rotate-90 ${
            mateIn > 0 ? 'text-gray-800' : 'text-gray-200'
          }`}>
            M{Math.abs(mateIn)}
          </div>
        </div>
      )}
      
      {/* Current eval display (hover tooltip) */}
      <div className="absolute inset-0 group">
        <div className="opacity-0 group-hover:opacity-100 absolute -right-12 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded transition-opacity pointer-events-none z-10 whitespace-nowrap">
          {isMate 
            ? `Mate in ${Math.abs(mateIn)}`
            : currentEval > 0 
              ? `+${(currentEval / 100).toFixed(1)}`
              : (currentEval / 100).toFixed(1)
          }
        </div>
      </div>
    </div>
  );
};

export default EvalBar;