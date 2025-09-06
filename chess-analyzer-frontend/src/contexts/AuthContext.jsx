import { useState, useEffect, createContext, useContext } from 'react';
import { supabase, USER_TIERS, fetchUserTier } from '../services/supabase';
import { 
  getCachedTier, 
  setCachedTier, 
  clearUserCache,
  validateTierFromDB 
} from '../services/userCache';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userTier, setUserTier] = useState(USER_TIERS.FREE);
  const [loading, setLoading] = useState(true);

  // Function to fetch and set user tier with caching
  const refreshUserTier = async (currentUser, forceRefresh = false) => {
    if (!currentUser) {
      setUserTier(USER_TIERS.FREE);
      return;
    }

    try {
      // Try cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cachedTier = getCachedTier(currentUser.id);
        if (cachedTier) {
          setUserTier(cachedTier);
          return;
        }
      }
      
      // Fetch from database with timeout protection
      const tierPromise = fetchUserTier(currentUser);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tier fetch timeout after 5 seconds')), 5000)
      );
      
      const tier = await Promise.race([tierPromise, timeoutPromise]);
      
      setUserTier(tier);
      
      // Cache the result
      setCachedTier(currentUser.id, tier.name);
      
    } catch (error) {
      console.error('🔄 AuthContext - Error fetching tier:', error);
      
      // Try cache as fallback
      const cachedTier = getCachedTier(currentUser.id);
      if (cachedTier) {
        setUserTier(cachedTier);
      } else {
        setUserTier(USER_TIERS.FREE);
      }
    }
  };

  // Validate tier from database (for critical operations)
  const validateUserTier = async (currentUser) => {
    if (!currentUser) return USER_TIERS.FREE;
    
    try {
      const realTier = await validateTierFromDB(currentUser, fetchUserTier);
      setUserTier(realTier);
      return realTier;
    } catch (error) {
      console.error('Tier validation failed:', error);
      return USER_TIERS.FREE;
    }
  };

  useEffect(() => {
    // Get initial session with timeout protection
    const getInitialSession = async () => {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout after 10 seconds')), 10000)
        );
        
        // Race the session call against timeout
        const sessionPromise = supabase.auth.getSession();
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (error) {
          console.error('🔄 AuthContext - Session error:', error);
          await supabase.auth.signOut();
          setUser(null);
          setUserTier(USER_TIERS.FREE);
          setLoading(false);
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        // Use cached tier for instant loading
        if (currentUser) {
          const cachedTier = getCachedTier(currentUser.id);
          if (cachedTier) {
            setUserTier(cachedTier);
          }
        }
        
        setLoading(false);
        
        // Fetch fresh tier in background (no await - don't block loading)
        if (currentUser) {
          refreshUserTier(currentUser, true);
        }
        
      } catch (error) {
        console.error('🔄 AuthContext - Session recovery failed:', error);
        
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error('🔄 AuthContext - Sign out also failed:', signOutError);
        }
        
        setUser(null);
        setUserTier(USER_TIERS.FREE);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (event === 'SIGNED_OUT') {
          // Clear cache on sign out
          if (currentUser) {
            clearUserCache(currentUser.id);
          }
          setUserTier(USER_TIERS.FREE);
        } else if (currentUser) {
          // Use cache first, then refresh in background
          const cachedTier = getCachedTier(currentUser.id);
          if (cachedTier) {
            setUserTier(cachedTier);
          }
          refreshUserTier(currentUser, true);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    // Clear cache before signing out
    if (user) {
      clearUserCache(user.id);
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return data;
  };

  const value = {
    user,
    userTier,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    refreshUserTier: (forceRefresh = false) => refreshUserTier(user, forceRefresh),
    validateUserTier: () => validateUserTier(user), // For critical operations
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};