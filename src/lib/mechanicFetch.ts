import { supabase } from './supabase';

// fetch() for /api/mechanic/* — attaches the signed-in workshop's Supabase access
// token so the server can verify who is calling (it no longer trusts a
// client-supplied mechanicId). getSession() refreshes an expired token first.
export async function mechanicFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
