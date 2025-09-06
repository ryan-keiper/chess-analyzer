import { useState, useRef, useEffect } from 'react';
import { Crown, Zap, Settings, LogOut, CreditCard, BarChart3 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Header = ({ onNavigateToPage }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { user, userTier, signOut } = useAuth(); // ✅ Get userTier from AuthContext

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setDropdownOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getUserInitials = (email) => {
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-chess-primary p-2 rounded-lg">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Chess Analyzer</h1>
              <p className="text-gray-600">AI-powered game analysis with human insights</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Stockfish Badge */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Zap className="w-4 h-4" />
              <span>Powered by Stockfish</span>
            </div>

            {/* User Tier Badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              userTier.name === 'Pro' 
                ? 'bg-purple-100 text-purple-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {userTier.name} Plan
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="w-8 h-8 bg-chess-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {getUserInitials(user?.email)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-32">
                    {user?.email}
                  </div>
                  <div className="text-xs text-gray-500">
                    {userTier.dailyLimit === -1 ? 'Unlimited' : `${userTier.dailyLimit}/day`}
                  </div>
                </div>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  {/* User Info Section */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {user?.email}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {userTier.name} Plan • Joined {new Date(user?.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Usage Stats */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-xs font-medium text-gray-700 mb-2">Today's Usage</div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Analyses</span>
                      <span className="font-medium">
                        {userTier.dailyLimit === -1 ? '∞' : `0/${userTier.dailyLimit}`}
                      </span>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                      <BarChart3 className="w-4 h-4" />
                      <span>Analysis History</span>
                    </button>
                    
                    <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                      <Settings className="w-4 h-4" />
                      <span>Account Settings</span>
                    </button>

                    {userTier.name === 'Free' && (
                      <button 
                        onClick={() => onNavigateToPage?.('pricing')}
                        className="w-full px-4 py-2 text-left text-sm text-purple-700 hover:bg-purple-50 flex items-center space-x-3"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Upgrade to Pro</span>
                      </button>
                    )}
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-gray-100 py-1">
                    <button 
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;