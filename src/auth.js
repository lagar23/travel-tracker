import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON } from '../config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export function getSupabase() { return supabase; }

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session ?? null;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
