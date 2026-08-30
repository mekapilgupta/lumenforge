export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/shiprocket';

export async function GET({ url }) {
  try {
    const unreviewedOnly = url.searchParams.get('unreviewed') === 'true';
    const limit = Number(url.searchParams.get('limit') || '50');

    let query = supabaseAdmin
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreviewedOnly) {
      query = query.eq('is_reviewed', false);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist yet, return empty list gracefully
      return json({
        success: true,
        notifications: [],
        unreadCount: 0,
        unreviewedCount: 0,
        needsTableCreation: true,
      });
    }

    const unreadCount = (data || []).filter((n: any) => !n.is_read).length;
    const unreviewedCount = (data || []).filter((n: any) => !n.is_reviewed).length;

    return json({
      success: true,
      notifications: data || [],
      unreadCount,
      unreviewedCount,
    });
  } catch (err: any) {
    return json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { action, id } = body;

    if (action === 'mark_read' && id) {
      await supabaseAdmin
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', id);
      return json({ success: true });
    }

    if (action === 'mark_reviewed' && id) {
      await supabaseAdmin
        .from('admin_notifications')
        .update({
          is_read: true,
          is_reviewed: true,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      return json({ success: true });
    }

    if (action === 'mark_all_read') {
      await supabaseAdmin
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      return json({ success: true });
    }

    if (action === 'mark_all_reviewed') {
      await supabaseAdmin
        .from('admin_notifications')
        .update({
          is_read: true,
          is_reviewed: true,
          reviewed_at: new Date().toISOString(),
        })
        .eq('is_reviewed', false);
      return json({ success: true });
    }

    return json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return json({ success: false, error: err.message }, { status: 500 });
  }
}
