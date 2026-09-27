export const prerender = false;
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase';

export async function POST({ request }) {
  const imagekitPrivateKey = env.IMAGEKIT_PRIVATE_KEY || (typeof process !== 'undefined' ? process.env.IMAGEKIT_PRIVATE_KEY : undefined);
  if (!imagekitPrivateKey) {
    return json({ success: false, error: 'IMAGEKIT_PRIVATE_KEY is missing' }, { status: 500 });
  }

  try {
    const { imageId, imagekitFileId } = await request.json();

    if (!imageId) {
      return json({ success: false, error: 'imageId is required' }, { status: 400 });
    }

    // 1. Get image details first
    const { data: img, error: findErr } = await supabaseAdmin
      .from('product_images')
      .select('id, variant_id, imagekit_file_id, is_primary')
      .eq('id', imageId)
      .maybeSingle();

    if (findErr || !img) {
      return json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    const fileId = img.imagekit_file_id || imagekitFileId;

    // 2. Delete from ImageKit if fileId exists
    if (fileId) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${imagekitPrivateKey}:`).toString('base64');
        await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: { Authorization: authHeader }
        });
      } catch (ikErr) {
        console.warn('[ImageKit Delete Error]', ikErr);
      }
    }

    // 3. Delete from product_images table
    const { error: delErr } = await supabaseAdmin
      .from('product_images')
      .delete()
      .eq('id', imageId);

    if (delErr) {
      return json({ success: false, error: delErr.message }, { status: 500 });
    }

    // 4. If this was primary, designate the first remaining image as primary
    if (img.is_primary) {
      const { data: remaining } = await supabaseAdmin
        .from('product_images')
        .select('id')
        .eq('variant_id', img.variant_id)
        .order('position', { ascending: true })
        .limit(1);

      if (remaining && remaining.length > 0) {
        await supabaseAdmin
          .from('product_images')
          .update({ is_primary: true })
          .eq('id', remaining[0].id);
      }
    }

    return json({ success: true });
  } catch (err: any) {
    console.error('[Delete Image Exception]', err);
    return json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
