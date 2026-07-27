import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config/env.js';
import { supa } from './client.js';

export async function authSignUp({ email, password, name }) {
  if (!supa) throw new Error('supabase_not_configured');
  const { data, error } = await supa.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || '' },
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function authSignIn({ email, password }) {
  if (!supa) throw new Error('supabase_not_configured');
  // IMPORTANT: use a fresh, isolated client for password sign-in. Calling
  // signInWithPassword on the shared service-role client would replace its
  // session with the user's (role: authenticated), breaking all service-role
  // DB writes (they'd start failing RLS). A throwaway client avoids that.
  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return {
    token: data.session?.access_token || null,
    refreshToken: data.session?.refresh_token || null,
    user: {
      id: data.user?.id,
      email: data.user?.email,
      name: data.user?.user_metadata?.name || '',
    },
  };
}

export async function authGetUser(token) {
  if (!supa || !token) return null;
  const { data, error } = await supa.auth.getUser(token);
  if (error) return null;
  return data.user || null;
}
