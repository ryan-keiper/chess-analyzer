const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Note: Service role, not anon key

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables. Please check your backend .env file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase };