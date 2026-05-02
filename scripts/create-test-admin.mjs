/**
 * Run once to create a test admin account.
 * Usage:
 *   SUPABASE_URL=https://mvoigokzsaybwiogjpvr.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key> \
 *   node scripts/create-test-admin.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mvoigokzsaybwiogjpvr.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = 'claude-test-admin@quirkify.co.za';
const TEST_PASSWORD = 'QuirkifyTest2025!';

async function main() {
  console.log('Creating test admin account...');

  // Create the auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('User already exists — updating role...');
    } else {
      console.error('Auth error:', authError.message);
      process.exit(1);
    }
  }

  const userId = authData?.user?.id;

  if (userId) {
    // Upsert the profile with admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: TEST_EMAIL,
        role: 'admin',
        display_name: 'Claude Test Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile error:', profileError.message);
    } else {
      console.log('Profile set to admin.');
    }
  }

  console.log('\n--- DONE ---');
  console.log('Email:   ', TEST_EMAIL);
  console.log('Password:', TEST_PASSWORD);
  console.log('Login at: https://quirkify-recover.vercel.app/auth');
}

main();
