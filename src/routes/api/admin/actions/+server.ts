import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabaseUrl = env.PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL || publicEnv.PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.MYSUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.MYSUPABASE_SERVICE_ROLE_KEY || PUBLIC_SUPABASE_ANON_KEY;

// Base admin client (used if service role key is available)
const supabaseAdmin = createClient(supabaseUrl!, supabaseKey!);

/**
 * GET handler to fetch all pending/unresolved actions.
 * Verifies credentials and queries the database using either the user's authenticated context or the service-role client.
 */
export const GET: RequestHandler = async ({ request, cookies }) => {
  try {
    let token = '';
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const sessionCookie = cookies.get('sb-session');
      if (sessionCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(sessionCookie));
          token = parsed.access_token;
        } catch {
          // Ignore parse error
        }
      }
    }

    if (!token) {
      console.warn('[Admin Actions API] No credentials provided');
      return json({ error: 'No credentials provided' }, { status: 401 });
    }

    // Create an authenticated client under the caller's context
    const authenticatedClient = createClient(supabaseUrl!, PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // 1. Get user details from auth using the authenticated client
    const { data: { user }, error: authErr } = await authenticatedClient.auth.getUser();
    if (authErr || !user) {
      console.warn('[Admin Actions API] Invalid session:', authErr?.message);
      return json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // 2. Fetch user profile under their authenticated context (satisfies RLS auth.uid() = id)
    const { data: profile, error: profErr } = await authenticatedClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || profile.role !== 'admin') {
      console.warn('[Admin Actions API] Access denied for user profile:', profile, 'Error:', profErr?.message);
      return json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    // 3. Query admin actions bypassing RLS using service role client if loaded,
    //    or using the authenticated admin client (which matches is_admin() RLS policy).
    const activeClient = (supabaseKey !== PUBLIC_SUPABASE_ANON_KEY) ? supabaseAdmin : authenticatedClient;

    const { data: actions, error: actionsErr } = await activeClient
      .from('admin_actions')
      .select('*, order:orders(id, order_number, profile:user_id(full_name, email))')
      .neq('status', 'resolved')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (actionsErr) {
      console.error('[Admin Actions API] Failed to query actions:', actionsErr.message);
      return json({ error: 'Failed to query actions: ' + actionsErr.message }, { status: 500 });
    }

    return json({ success: true, actions: actions ?? [] });
  } catch (err: any) {
    console.error('[Admin Actions API] Internal Error:', err.message);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
};

/**
 * POST handler to mark actions as seen or resolved.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    let token = '';
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const sessionCookie = cookies.get('sb-session');
      if (sessionCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(sessionCookie));
          token = parsed.access_token;
        } catch {}
      }
    }

    if (!token) {
      return json({ error: 'No credentials provided' }, { status: 401 });
    }

    const authenticatedClient = createClient(supabaseUrl!, PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: { user }, error: authErr } = await authenticatedClient.auth.getUser();
    if (authErr || !user) {
      return json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: profile } = await authenticatedClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action_id, seen, status } = body;

    if (!action_id) {
      return json({ error: 'action_id is required' }, { status: 400 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (seen) {
      updateData.seen_at = new Date().toISOString();
    }
    if (status) {
      updateData.status = status;
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    const activeClient = (supabaseKey !== PUBLIC_SUPABASE_ANON_KEY) ? supabaseAdmin : authenticatedClient;

    const { error: updateErr } = await activeClient
      .from('admin_actions')
      .update(updateData)
      .eq('id', action_id);

    if (updateErr) {
      return json({ error: 'Failed to update action: ' + updateErr.message }, { status: 500 });
    }

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
};
