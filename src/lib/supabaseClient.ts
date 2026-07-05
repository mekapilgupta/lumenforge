// ─── French Toes — Supabase Client ───────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

console.log('[SUPABASE] Client init: Starting supabase client initialization with URL:', PUBLIC_SUPABASE_URL);
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
console.log('[SUPABASE] Client init:', supabase);
