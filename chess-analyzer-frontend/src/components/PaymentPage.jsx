import { useState } from 'react';
import { 
  Crown, 
  ArrowLeft, 
  Check, 
  CreditCard,
  Shield,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { redirectToCheckout } from '../services/stripe';

const PaymentPage = ({ onBack, planDetails, billingCycle = 'monthly' }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Default plan details if not provided
  const defaultPlan = {
    name: 'Pro',
    price: { monthly: 9.99, annual: 7.99 },
    features: [
      'Unlimited game analyses',
      'AI-powered explanations',
      'Deep analysis (depth 20+)',
      'Analysis history & search',
      'Export as PDF/PNG',
      'Share analyses publicly',
      'Opening book integration',
      'Priority processing',
      'Email support'
    ]
  };

  const plan = planDetails || defaultPlan;
  const price = plan.price[billingCycle];
  const annualSavings = billingCycle === 'annual' ? 
    Math.round(((plan.price.monthly * 12 - plan.price.annual * 12) / (plan.price.monthly * 12)) * 100) : 0;

  const handleUpgrade = async () => {
    if (!user) {
      setError('Please sign in to upgrade your account');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await redirectToCheckout(user.id, user.email, billingCycle);
    } catch (err) {
      setError(err.message || 'Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  disabled={loading}
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div className="flex items-center space-x-3">
                <div className="bg-chess-primary p-2 rounded-lg">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Chess Analyzer</h1>
                  <p className="text-sm text-gray-600">Upgrade to Pro</p>
                </div>
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
        <div className="max-w-2xl mx-auto">
          {/* Plan Summary Card */}
          <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Upgrade to {plan.name}
              </h2>
              <p className="text-gray-600">
                Unlock unlimited AI-powered chess analysis
              </p>
            </div>

            {/* Pricing Display */}
            <div className="text-center mb-8">
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">
                  ${price}
                </span>
                <span className="text-gray-500 text-lg">
                  /{billingCycle === 'monthly' ? 'month' : 'month*'}
                </span>
              </div>

              {billingCycle === 'annual' && (
                <div className="inline-flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  <span>💰</span>
                  <span>Save {annualSavings}% with annual billing</span>
                </div>
              )}
            </div>

            {/* Features List */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 mb-4 text-center">
                What's included:
              </h3>
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Payment Button */}
            <button
              onClick={handleUpgrade}
              disabled={loading || !user}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition flex items-center justify-center space-x-3 ${
                loading || !user
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-chess-primary text-white hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Continue to Payment</span>
                </>
              )}
            </button>

            {!user && (
              <p className="text-center text-sm text-gray-500 mt-3">
                Please sign in to upgrade your account
              </p>
            )}
          </div>

          {/* Security & Guarantee */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center">
              <Shield className="w-8 h-8 mx-auto mb-4 text-green-500" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Secure & Risk-Free
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• Payments secured by Stripe</p>
                <p>• Cancel anytime</p>
                <p>• Instant access after payment</p>
                <p>• 30-day money-back guarantee</p>
              </div>
            </div>
          </div>

          {/* Billing Note for Annual */}
          {billingCycle === 'annual' && (
            <div className="text-center mt-6">
              <p className="text-sm text-gray-500">
                * You'll be charged ${(plan.price.annual * 12).toFixed(2)} today for the first year,
                then ${(plan.price.annual * 12).toFixed(2)} annually.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PaymentPage;