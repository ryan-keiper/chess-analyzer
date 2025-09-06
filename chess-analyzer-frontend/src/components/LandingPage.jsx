import { useState } from 'react';
import { Crown, Zap, Target, Users, ChevronRight, Play, Star, CheckCircle } from 'lucide-react';
import AuthModal from './AuthModal';

const LandingPage = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'

  const handleGetStarted = () => {
    setAuthMode('signup');
    setShowAuthModal(true);
  };

  const handleSignIn = () => {
    setAuthMode('signin');
    setShowAuthModal(true);
  };

  const testimonials = [
    {
      name: "Alexandra Chen",
      rating: "1850 USCF",
      text: "Finally, analysis that explains WHY my moves were bad, not just THAT they were bad. My rating jumped 200 points in 3 months!",
      avatar: "👩‍💼"
    },
    {
      name: "Michael Rodriguez", 
      rating: "Chess Coach",
      text: "I use this with all my students. The natural language explanations save me hours of explanation time.",
      avatar: "👨‍🏫"
    },
    {
      name: "Sarah Johnson",
      rating: "Chess.com 1600",
      text: "Other engines just show numbers. This actually teaches you chess concepts. Game-changer!",
      avatar: "👩‍🎓"
    }
  ];

  const features = [
    {
      icon: <Target className="w-6 h-6 text-chess-primary" />,
      title: "Human-Language Analysis",
      description: "Get strategic explanations in plain English, not just engine evaluations"
    },
    {
      icon: <Zap className="w-6 h-6 text-chess-primary" />,
      title: "Powered by Stockfish",
      description: "World's strongest chess engine provides the foundation for our analysis"
    },
    {
      icon: <Users className="w-6 h-6 text-chess-primary" />,
      title: "Share Your Games",
      description: "Share beautiful analysis with friends, coaches, or study groups"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-chess-primary p-2 rounded-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Chess Analyzer</h1>
                <p className="text-sm text-gray-600">AI-powered game analysis</p>
              </div>
            </div>
            
            <button
              onClick={handleSignIn}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Finally, Chess Analysis That 
            <span className="text-chess-primary"> Actually Teaches</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Stop getting cold numbers from chess engines. Get strategic explanations in human language 
            that help you understand your mistakes and improve your game.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button
              onClick={handleGetStarted}
              className="flex items-center justify-center space-x-2 bg-chess-primary text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
            >
              <Play className="w-5 h-5" />
              <span>Analyze Your First Game Free</span>
            </button>
            
            <button className="flex items-center justify-center space-x-2 border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 transition">
              <span>Watch Demo</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-sm text-gray-500">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
            No credit card required • 3 free analyses daily
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Beyond Basic Engine Analysis
            </h2>
            <p className="text-lg text-gray-600">
              See what makes Chess Analyzer different from every other analysis tool
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6">
                <div className="mb-4 flex justify-center">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Loved by Chess Players Everywhere
            </h2>
            <p className="text-lg text-gray-600">
              See how Chess Analyzer is helping players improve faster
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-lg border p-6">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">{testimonial.avatar}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-sm text-gray-600">{testimonial.rating}</p>
                  </div>
                  <div className="ml-auto flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 italic">"{testimonial.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-chess-primary py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Understand Your Chess Games?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of players improving their game with AI-powered analysis
          </p>
          <button
            onClick={handleGetStarted}
            className="bg-white text-chess-primary px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition"
          >
            Start Analyzing Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="bg-chess-primary p-2 rounded-lg">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold">Chess Analyzer</span>
          </div>
          <p className="text-gray-400">
            © 2024 Chess Analyzer. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSwitchMode={(mode) => setAuthMode(mode)}
        />
      )}
    </div>
  );
};

export default LandingPage;
