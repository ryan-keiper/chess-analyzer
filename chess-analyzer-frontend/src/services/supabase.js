import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// Only throw error in production if credentials are missing
if (import.meta.env.PROD && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.error('Warning: Missing Supabase environment variables in production build');
}

// ✅ ADD EXPLICIT CONFIGURATION FOR SESSION HANDLING
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// User tier management
export const USER_TIERS = {
  FREE: {
    name: 'Free',
    dailyLimit: 3,
    features: ['basic_analysis'],
    price: 0
  },
  PRO: {
    name: 'Pro',
    dailyLimit: -1, // unlimited
    features: ['basic_analysis', 'ai_explanations', 'export', 'sharing'],
    price: 999 // $9.99 in cents
  }
};

export const fetchUserTier = async (user) => {
  if (!user) return USER_TIERS.FREE;
  
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user tier:', error);
      return USER_TIERS.FREE;
    }
    
    const tier = USER_TIERS[data.tier] || USER_TIERS.FREE;
    return tier;
  } catch (error) {
    console.error('Error in fetchUserTier:', error);
    return USER_TIERS.FREE;
  }
};

// ❌ OLD: Keep this for backwards compatibility but it's not accurate
export const getUserTier = (user) => {
  if (!user) return USER_TIERS.FREE;
  return USER_TIERS[user.user_metadata?.tier || 'FREE'];
};

export const canAnalyze = async (user) => {
  if (!user) return false;
  
  const tier = await fetchUserTier(user); // Use fetchUserTier instead
  if (tier.dailyLimit === -1) return true; // unlimited
  
  // Check daily usage from database
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('action', 'analysis')
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lt('created_at', `${today}T23:59:59.999Z`);
  
  if (error) {
    console.error('Error checking usage:', error);
    return false;
  }
  
  return data.length < tier.dailyLimit;
};

export const logUsage = async (user, action, metadata = {}) => {
  if (!user) return;
  
  const { error } = await supabase
    .from('usage_logs')
    .insert({
      user_id: user.id,
      action,
      metadata,
      created_at: new Date().toISOString()
    });
    
  if (error) {
    console.error('Error logging usage:', error);
  }
};