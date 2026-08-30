export const prerender = false;
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/shiprocket';

/**
 * GET handler to fetch all pending/unresolved actions.
 * Queries directly via supabaseAdmin service-role client to prevent token expiration crashes during layout polling.
 */
export const GET: RequestHandler = async () => {
  try {
    const { data: actions, error: actionsErr } = await supabaseAdmin
      .from('admin_actions')
      .select('*, order:orders(id, order_number, profile:user_id(full_name, email))')
      .neq('status', 'resolved')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (actionsErr) {
      console.warn('[Admin Actions API] Failed to query actions:', actionsErr.message);
      return json({ success: true, actions: [] });
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
export const POST: RequestHandler = async ({ request }) => {
  try {
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

    const { error: updateErr } = await supabaseAdmin
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
