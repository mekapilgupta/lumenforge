export const prerender = false;
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase';

const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

/** Slugify helper to enforce clean URL-safe slugs */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export async function POST({ request }) {
  const imagekitPrivateKey = env.IMAGEKIT_PRIVATE_KEY || (typeof process !== 'undefined' ? process.env.IMAGEKIT_PRIVATE_KEY : undefined);
  if (!imagekitPrivateKey) {
    return json({ success: false, error: 'IMAGEKIT_PRIVATE_KEY is not configured on the server.' }, { status: 500 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return json({ success: false, error: 'Content-Type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productId = (formData.get('product_id') || formData.get('productId')) as string | null;
    const variantId = (formData.get('variant_id') || formData.get('variantId')) as string | null;
    const rawColorSlug = (formData.get('color_slug') || formData.get('color-slug') || formData.get('colorSlug')) as string | null;
    const rawProductSlug = (formData.get('product_slug') || formData.get('product-slug') || formData.get('productSlug')) as string | null;
    const altText = (formData.get('alt_text') || formData.get('altText') || '') as string;

    if (!file || typeof file === 'string') {
      return json({ success: false, error: 'A valid image file is required.' }, { status: 400 });
    }
    if (!productId || !variantId) {
      return json({ success: false, error: 'product_id and variant_id are required.' }, { status: 400 });
    }

    const colorSlug = slugify(rawColorSlug || 'default');
    const productSlug = slugify(rawProductSlug || 'product');

    // 1. Check existing images for this variant to determine sequence number and primary status
    const { data: existingImages, error: fetchErr } = await supabaseAdmin
      .from('product_images')
      .select('id, position, is_primary')
      .eq('variant_id', variantId)
      .order('position', { ascending: true });

    if (fetchErr) {
      console.warn('[Upload Endpoint] Existing images fetch note:', fetchErr.message);
    }

    const count = existingImages?.length ?? 0;
    const sequenceNumber = String(count + 1).padStart(2, '0');

    // 2. Extract file extension
    let ext = 'jpg';
    if (file.name && file.name.includes('.')) {
      const parts = file.name.split('.');
      ext = parts[parts.length - 1].toLowerCase();
    } else if (file.type) {
      const mimeExt = file.type.split('/')[1]?.toLowerCase();
      if (mimeExt) ext = mimeExt === 'jpeg' ? 'jpg' : mimeExt;
    }

    // 3. Format exact naming convention & folder path
    // Folder: /products/{product-slug}/{color-slug}/
    // File name: {product-slug}-{color-slug}-{sequence}.{ext}
    const fileName = `${productSlug}-${colorSlug}-${sequenceNumber}.${ext}`;
    const folderPath = `/products/${productSlug}/${colorSlug}/`;

    // 4. Tags: product:{product_id}, variant:{variant_id}, color:{color-slug}, slug:{product-slug}
    const tags = [
      `product:${productId}`,
      `variant:${variantId}`,
      `color:${colorSlug}`,
      `slug:${productSlug}`
    ];

    // 5. Upload to ImageKit REST API
    const ikFormData = new FormData();
    ikFormData.append('file', file, fileName);
    ikFormData.append('fileName', fileName);
    ikFormData.append('folder', folderPath);
    ikFormData.append('tags', tags.join(','));
    ikFormData.append('useUniqueFileName', 'false');

    const authHeader = 'Basic ' + Buffer.from(`${imagekitPrivateKey}:`).toString('base64');

    const ikRes = await fetch(IMAGEKIT_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: ikFormData,
    });

    const ikData = await ikRes.json();

    if (!ikRes.ok || !ikData.url || !ikData.fileId) {
      console.error('[ImageKit Upload Error]', ikData);
      return json({
        success: false,
        error: ikData.message || 'ImageKit upload failed'
      }, { status: ikRes.status || 500 });
    }

    // 6. Check if primary image exists
    const hasPrimary = existingImages?.some(img => img.is_primary) ?? false;
    const isPrimary = !hasPrimary; // Auto mark first image as primary if none exists yet

    // 7. Insert row into product_images table (try security definer RPC first to avoid RLS 42501 error)
    let newImageRecord: any = null;

    const { data: rpcImage, error: rpcErr } = await supabaseAdmin.rpc('insert_product_image_sec', {
      p_variant_id: variantId,
      p_imagekit_file_id: ikData.fileId,
      p_image_url: ikData.url,
      p_file_name: ikData.name || fileName,
      p_alt_text: altText || `${productSlug} ${colorSlug} image ${sequenceNumber}`,
      p_position: count,
      p_is_primary: isPrimary
    });

    if (!rpcErr && rpcImage) {
      newImageRecord = rpcImage;
    } else {
      // Fallback: direct insert
      console.warn('[Upload Endpoint] RPC insert fallback to direct table insert:', rpcErr?.message);
      const { data: directImage, error: insertErr } = await supabaseAdmin
        .from('product_images')
        .insert({
          variant_id: variantId,
          imagekit_file_id: ikData.fileId,
          image_url: ikData.url,
          file_name: ikData.name || fileName,
          alt_text: altText || `${productSlug} ${colorSlug} image ${sequenceNumber}`,
          position: count,
          is_primary: isPrimary
        })
        .select('*')
        .single();

      if (insertErr) {
        console.error('[Upload Endpoint] Database insert failed:', insertErr);
        return json({
          success: false,
          error: 'Failed to record image in database: ' + insertErr.message,
          fileId: ikData.fileId,
          imageUrl: ikData.url
        }, { status: 500 });
      }
      newImageRecord = directImage;
    }

    return json({
      success: true,
      image: newImageRecord,
      fileId: ikData.fileId,
      url: ikData.url,
      fileName: newImageRecord.file_name,
      position: newImageRecord.position,
      isPrimary: newImageRecord.is_primary
    });

  } catch (err: any) {
    console.error('[Upload Endpoint Exception]', err);
    return json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
