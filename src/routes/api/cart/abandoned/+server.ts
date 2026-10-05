import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '$lib/server/supabase';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function POST({ request }) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const body = await request.json().catch(() => ({}));
    const { userId, cartItems = [], totalAmount = 0, recovered = false, recoveredOrderId = null } = body;

    if (!userId) {
      return json({ error: 'Missing userId' }, { status: 400 });
    }

    const db = authHeader.startsWith('Bearer ')
      ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false }
        })
      : supabaseAdmin;

    // Check if an abandoned cart row already exists for this user
    const { data: existing, error: findError } = await db
      .from('abandoned_carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (findError) {
      console.warn('[Abandoned Cart API] Find note:', findError.message);
    }

    const payload: Record<string, any> = {
      user_id: userId,
      cart_items: cartItems,
      total_amount: Math.round(Number(totalAmount) || 0),
      recovered: !!recovered
    };

    if (recoveredOrderId) {
      payload.recovered_order_id = recoveredOrderId;
    }

    if (existing?.id) {
      const { error: updateError } = await db
        .from('abandoned_carts')
        .update(payload)
        .eq('id', existing.id);

      if (updateError) {
        console.warn('[Abandoned Cart API] Update note:', updateError.message);
      }
    } else {
      const { error: insertError } = await db
        .from('abandoned_carts')
        .insert(payload);

      if (insertError) {
        console.warn('[Abandoned Cart API] Insert note:', insertError.message);
      }
    }

    return json({ success: true });
  } catch (err: any) {
    console.warn('[Abandoned Cart API] Handled error:', err?.message || err);
    return json({ success: true, message: 'Sync noted' });
  }
}
