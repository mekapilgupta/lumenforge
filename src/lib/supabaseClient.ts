// ─── French Toes — Supabase Client ───────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (name, acquireTimeout, fn) => {
      try {
        if (typeof window !== 'undefined' && window.navigator?.locks?.request) {
          return await window.navigator.locks.request(name, { timeout: 10000 }, fn);
        }
      } catch (e) {
        // Fallback directly on lock timeout or navigator incompatibility
      }
      return await fn();
    }
  }
});
