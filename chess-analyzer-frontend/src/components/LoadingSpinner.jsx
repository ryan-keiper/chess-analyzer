import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-chess-primary" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Your Game</h3>
        <p className="text-gray-600">This may take a few seconds...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
