const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Admin client (bypasses RLS — for server-side operations)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Create a user-scoped client from JWT (respects RLS)
function createUserClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

module.exports = { supabaseAdmin, createUserClient };
