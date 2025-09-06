import { useState } from 'react';
import { 
  Crown, 
  Check, 
  X, 
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getUserTier } from '../services/supabase';

const PricingPage = ({ onBack, onUpgrade }) => {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const { user } = useAuth();
  const userTier = getUserTier(user);
  const isLoggedIn = !!user;

  const plans = {
    free: {
      name: 'Free',
      price: { monthly: 0, annual: 0 },
      description: 'Perfect for trying out chess analysis',
      popular: false,
      cta: isLoggedIn ? 'Current Plan' : 'Get Started Free',
      features: [
        '3 game analyses per day',
        'Basic blunder detection', 
        'Move accuracy calculation',
        'Standard analysis depth (10)',
        'Community support'
      ],
      limitations: [
        'No AI explanations',
        'No analysis history',
        'No export options',
        'No sharing features',
        'No priority processing'
      ]
    },
    pro: {
      name: 'Pro',
      price: { monthly: 9.99, annual: 7.99 },
      description: 'Unlimited analysis with AI insights',
      popular: true,
      cta: userTier.name === 'Pro' ? 'Current Plan' : 'Upgrade to Pro',
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
      ],
      limitations: []
    }
  };

  const handlePlanSelect = (planKey) => {
    if (planKey === 'free' && !isLoggedIn) {
      window.location.href = '/';
    } else if (planKey === 'pro') {
      // Navigate to PaymentPage with plan details
      if (onUpgrade) {
        onUpgrade(plans.pro, billingCycle);
      }
    }
  };

  const getAnnualSavings = (plan) => {
    if (plan.price.monthly === 0) return 0;
    const monthlyCost = plan.price.monthly * 12;
    const annualCost = plan.price.annual * 12;
    const savings = monthlyCost - annualCost;
    const percentage = Math.round((savings / monthlyCost) * 100);
    return percentage;
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
                  <p className="text-sm text-gray-600">Choose your plan</p>
                </div>
              </div>
            </div>
            
            {isLoggedIn ? (
              <div className="text-sm text-gray-600">
                Logged in as {user.email}
              </div>
            ) : (
              <button 
                onClick={() => window.location.href = '/'}
                className="text-chess-primary hover:underline"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Choose Your Chess Analysis Plan
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Start free, upgrade when you're ready for unlimited AI-powered analysis
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center mb-12">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Billed monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition relative ${
                billingCycle === 'annual'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Billed yearly (Save 20% or more)
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="flex justify-center items-start gap-8 mb-12">
          {Object.entries(plans).map(([key, plan]) => (
            <div
              key={key}
              className={`w-80 bg-white rounded-xl p-6 transition flex flex-col ${
                userTier.name === plan.name && plan.name === 'Free'
                  ? 'border-4 border-gray-400 shadow-lg'
                  : userTier.name === plan.name && plan.name === 'Pro'
                  ? 'border-4 border-blue-500 shadow-lg'
                  : plan.popular
                  ? 'border-2 border-chess-primary shadow-lg'
                  : 'border-2 border-gray-200 hover:border-gray-300'
              } relative`}
            >
              {/* Current Plan Badge */}
              {userTier.name === plan.name && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className={`text-white px-3 py-1 rounded-full text-sm font-medium ${
                    plan.name === 'Free' ? 'bg-gray-500' : 'bg-blue-500'
                  }`}>
                    Your plan
                  </div>
                </div>
              )}

              {/* Most Popular Badge
              {plan.popular && userTier.name !== plan.name && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-chess-primary text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )} */}

              {/* Plan Header */}
              <div className="text-center mb-6 mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">
                    ${plan.price[billingCycle]}
                  </span>
                  {plan.price.monthly > 0 && (
                    <span className="text-gray-500 text-sm">
                      /{billingCycle === 'monthly' ? 'month' : 'month*'}
                    </span>
                  )}
                </div>

                {billingCycle === 'annual' && plan.price.monthly > 0 && (
                  <div className="text-sm text-green-600 font-medium mb-4">
                    Save {getAnnualSavings(plan)}% with annual billing
                  </div>
                )}

                <button
                  onClick={() => handlePlanSelect(key)}
                  disabled={userTier.name === plan.name}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition ${
                    userTier.name === plan.name
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-chess-primary text-white hover:bg-blue-700'
                      : 'border-2 border-chess-primary text-chess-primary hover:bg-chess-primary hover:text-white'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>

              {/* Features List */}
              <div className="flex-1">
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 text-sm mb-3">What's included:</h4>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {plan.limitations.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-3">Not included:</h4>
                    <ul className="space-y-2">
                      {plan.limitations.slice(0, 5).map((limitation, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <X className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-500 text-sm">{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I upgrade or downgrade anytime?
              </h3>
              <p className="text-gray-700">
                Yes! You can upgrade to Pro anytime, and changes take effect immediately. 
                Downgrades take effect at the end of your current billing period.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">
                How do I get PGN from Chess.com or Lichess?
              </h3>
              <p className="text-gray-700">
                After any game, look for a "Download" or "Export" button. Choose PGN format 
                and copy-paste it into our analyzer. You can also find PGN in your game archive 
                on most chess platforms.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">
                What makes your analysis different?
              </h3>
              <p className="text-gray-700">
                Unlike other engines that just show numbers, we provide human-language 
                explanations of your mistakes and the strategic ideas you missed. Our AI explains 
                the "why" behind each move, not just the evaluation.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">
                Is my game data private?
              </h3>
              <p className="text-gray-700">
                Absolutely! Your analyses are private by default. Only you can see them unless 
                you choose to share them publicly using our Pro sharing feature.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-700">
                Yes, you can cancel your Pro subscription at any time. You'll continue to have 
                Pro access until the end of your current billing period, then automatically 
                return to the Free plan.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to Improve Your Chess?
          </h2>
          <p className="text-gray-600 mb-6">
            Join thousands of players analyzing their games with AI
          </p>
          
          {!isLoggedIn ? (
            <button
              onClick={() => window.location.href = '/'}
              className="bg-chess-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Get Started Free
            </button>
          ) : userTier.name === 'Free' ? (
            <button
              onClick={() => handlePlanSelect('pro')}
              className="bg-chess-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Upgrade to Pro Now
            </button>
          ) : (
            <div className="text-green-600 font-medium">
              You're all set with Pro! 🎉
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PricingPage;