export const prerender = false;
import { json } from '@sveltejs/kit';
import { resolveVariantId, ensureAllProductVariants } from '$lib/server/variants';

export async function POST({ request }) {
  try {
    const body = await request.json();
    if (body.initAll === true) {
      const res = await ensureAllProductVariants();
      return json({ success: true, ...res });
    }

    const { productId, size, color } = body;
    if (!productId || size === undefined || !color) {
      return json({ error: 'Missing required parameters: productId, size, color' }, { status: 400 });
    }

    const variantId = await resolveVariantId(productId, size, typeof color === 'object' ? color.name : color);
    return json({ success: true, variantId });
  } catch (err: any) {
    console.error('[Variants API] Error:', err);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
