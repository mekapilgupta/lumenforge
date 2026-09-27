import { createClient } from '@supabase/supabase-js';
import { env as dynamicPrivate } from '$env/dynamic/private';
import { env as dynamicPublic } from '$env/dynamic/public';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabaseUrl = 
  dynamicPrivate.PUBLIC_SUPABASE_URL || 
  dynamicPublic.PUBLIC_SUPABASE_URL || 
  PUBLIC_SUPABASE_URL || 
  (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_URL : undefined) || '';

const supabaseKey = 
  dynamicPrivate.SUPABASE_SERVICE_ROLE_KEY || 
  dynamicPrivate.MYSUPABASE_SERVICE_ROLE_KEY || 
  (typeof process !== 'undefined' ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MYSUPABASE_SERVICE_ROLE_KEY) : undefined) || 
  dynamicPublic.PUBLIC_SUPABASE_ANON_KEY || 
  PUBLIC_SUPABASE_ANON_KEY || 
  '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
