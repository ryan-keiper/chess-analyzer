import { useState, useEffect } from 'react';
import { 
  Crown, 
  CheckCircle, 
  Sparkles, 
  ArrowRight,
  Settings,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { handlePaymentSuccess } from '../services/stripe';

const PaymentSuccessPage = ({ onNavigateToPage }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const { user, refreshUserTier } = useAuth();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Get session ID from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        
        if (!sessionId) {
          console.error('No session_id found in URL');
          setError('No payment session found');
          return;
        }

        const result = await handlePaymentSuccess(sessionId);
        
        setPaymentData(result);
        
        // ✅ Refresh user tier after successful payment
        await refreshUserTier(user);
        
      } catch (err) {
        console.error('Error in verifyPayment:', err);
        setError(err.message || 'Failed to verify payment');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [user, refreshUserTier]);

  const handleStartAnalyzing = () => {
    onNavigateToPage?.('dashboard');
  };

  const handleManageSubscription = () => {
    // This would redirect to Stripe customer portal
    onNavigateToPage?.('account');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div>🔥 PaymentSuccessPage LOADING (you should see this!)</div>
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-chess-primary" />
          <p className="text-gray-600">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-chess-primary p-2 rounded-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Chess Analyzer</h1>
                <p className="text-sm text-gray-600">Payment verification</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-white rounded-lg shadow-sm border p-8">
              <div className="text-red-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Payment Verification Failed
              </h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => onNavigateToPage?.('pricing')}
                className="bg-chess-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Return to Pricing
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-chess-primary p-2 rounded-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Chess Analyzer</h1>
                <p className="text-sm text-gray-600">Welcome to Pro!</p>
              </div>
            </div>
            
            {user && (
              <div className="text-sm text-gray-600">
                Logged in as {user.email}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Message */}
          <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
            <div className="mb-6">
              <div className="relative">
                <CheckCircle className="w-20 h-20 mx-auto text-green-500 mb-4" />
                <Sparkles className="w-6 h-6 absolute top-0 right-1/2 translate-x-8 text-yellow-400" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to Chess Analyzer Pro! 🎉
              </h1>
              <p className="text-lg text-gray-600">
                Your payment was successful. You now have unlimited access to AI-powered chess analysis.
              </p>
            </div>

            {/* Payment Details */}
            {paymentData && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Payment Details</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Plan: Chess Analyzer Pro</p>
                  <p>Amount: ${(paymentData.amount / 100).toFixed(2)}</p>
                  <p>Payment ID: {paymentData.paymentId}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleStartAnalyzing}
                className="flex items-center justify-center space-x-2 bg-chess-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                <Sparkles className="w-5 h-5" />
                <span>Start Analyzing Games</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleManageSubscription}
                className="flex items-center justify-center space-x-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                <Settings className="w-5 h-5" />
                <span>Manage Subscription</span>
              </button>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              What's next?
            </h2>
            <div className="grid md:grid-cols-3 gap-4 text-left">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="bg-chess-primary p-2 rounded-lg w-fit mb-3">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Upload a game</h3>
                <p className="text-sm text-gray-600">
                  Copy a PGN from Chess.com or Lichess and get instant AI analysis
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="bg-green-500 p-2 rounded-lg w-fit mb-3">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Review insights</h3>
                <p className="text-sm text-gray-600">
                  Get human-language explanations of your mistakes and improvements
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="bg-purple-500 p-2 rounded-lg w-fit mb-3">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Track progress</h3>
                <p className="text-sm text-gray-600">
                  Save your analyses and watch your chess understanding improve
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentSuccessPage;