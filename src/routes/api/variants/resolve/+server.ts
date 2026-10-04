export const prerender = false;
import { json } from '@sveltejs/kit';
import { resolveSku, ensureAllProductVariants } from '$lib/server/variants';

export async function POST({ request }) {
  try {
    const body = await request.json();
    if (body.initAll === true) {
      const res = await ensureAllProductVariants();
      return json({ success: true, ...res });
    }

    // SKU-first: { sku } alone is enough — it identifies product + color + size
    const { sku, productId, size, color } = body;
    if (sku) {
      const result = await resolveSku(String(sku));
      return json({ success: true, ...result });
    }

    // Legacy path: resolve (product, size, color) → variant id + sku
    if (!productId || size === undefined || !color) {
      return json({ error: 'Missing required parameters: sku, or productId+size+color' }, { status: 400 });
    }

    const result = await resolveSkuByAttrs(productId, size, color);
    return json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Variants API] Error:', err);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

async function resolveSkuByAttrs(productId: string, size: number | string, color: string | { name?: string }) {
  const colorName = typeof color === 'object' ? (color.name ?? '') : color;
  const { resolveVariantSku } = await import('$lib/server/variants');
  return resolveVariantSku(productId, size, colorName);
}
