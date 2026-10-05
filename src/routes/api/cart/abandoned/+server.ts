export const prerender = false;
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { userId, cartItems = [], totalAmount = 0, status = 'pending', recovered = false, recoveredOrderId = null } = body;

    if (!userId) {
      return json({ error: 'Missing userId' }, { status: 400 });
    }

    // Check if an abandoned cart row already exists for this user
    const { data: existing, error: findError } = await supabaseAdmin
      .from('abandoned_carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (findError) {
      console.warn('[Abandoned Cart API] Find error:', findError.message);
    }

    const payload: any = {
      user_id: userId,
      cart_items: cartItems,
      total_amount: totalAmount,
      status: status,
      recovered: recovered,
      last_updated: new Date().toISOString()
    };

    if (recoveredOrderId) {
      payload.recovered_order_id = recoveredOrderId;
    }

    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from('abandoned_carts')
        .update(payload)
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('abandoned_carts')
        .insert(payload);

      if (insertError) throw insertError;
    }

    return json({ success: true });
  } catch (err: any) {
    console.warn('[Abandoned Cart API] Sync note:', err?.message || err);
    return json({ success: false, error: err?.message || 'Failed to sync abandoned cart' }, { status: 500 });
  }
}
