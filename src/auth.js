import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON } from '../config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export function getSupabase() { return supabase; }

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
