export const prerender = false;
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const imagekitPrivateKey = env.IMAGEKIT_PRIVATE_KEY || (typeof process !== 'undefined' ? process.env.IMAGEKIT_PRIVATE_KEY : undefined);
const API_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

export async function POST({ request }) {
  if (!imagekitPrivateKey) {
    return json({ success: false, error: 'IMAGEKIT_PRIVATE_KEY is not configured on server' }, { status: 500 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    const authHeader = 'Basic ' + Buffer.from(`${imagekitPrivateKey}:`).toString('base64');

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const files = formData.getAll('file') as (File | string)[];
      const folder = (formData.get('folder') as string) || '/products';
      const customFileName = formData.get('fileName') as string | null;

      if (!files || files.length === 0) {
        return json({ success: false, error: 'No files provided in request' }, { status: 400 });
      }

      const results = [];

      for (let i = 0; i < files.length; i++) {
        const fileItem = files[i];
        const ikFormData = new FormData();

        let fileName = customFileName || `frenchtoes_${Date.now()}_${i}`;

        if (typeof fileItem === 'object' && fileItem instanceof File) {
          fileName = customFileName || fileItem.name || `frenchtoes_${Date.now()}_${i}.jpg`;
          ikFormData.append('file', fileItem, fileName);
        } else if (typeof fileItem === 'string') {
          ikFormData.append('file', fileItem);
        }

        ikFormData.append('fileName', fileName);
        ikFormData.append('useUniqueFileName', 'true');
        ikFormData.append('folder', folder);

        const res = await fetch(API_UPLOAD_URL, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
          },
          body: ikFormData,
        });

        const data = await res.json();

        if (res.ok && data.url) {
          results.push({
            success: true,
            url: data.url,
            fileId: data.fileId,
            name: data.name,
            thumbnailUrl: data.thumbnailUrl || data.url,
            size: data.size,
            height: data.height,
            width: data.width,
          });
        } else {
          console.error('[ImageKit Upload Error]', data);
          results.push({
            success: false,
            error: data.message || 'ImageKit upload failed',
            name: fileName,
          });
        }
      }

      // If single file uploaded, return direct object plus results array
      if (results.length === 1) {
        if (!results[0].success) {
          return json({ success: false, error: results[0].error }, { status: 400 });
        }
        return json({
          success: true,
          ...results[0],
          results,
        });
      }

      return json({
        success: results.some(r => r.success),
        results,
      });
    }

    // Handle JSON payload (base64 string or image URL)
    const body = await request.json();
    const { file, fileName = `ft_${Date.now()}.jpg`, folder = '/products' } = body;

    if (!file) {
      return json({ success: false, error: 'Missing "file" (base64 or URL) in request body' }, { status: 400 });
    }

    const ikFormData = new FormData();
    ikFormData.append('file', file);
    ikFormData.append('fileName', fileName);
    ikFormData.append('useUniqueFileName', 'true');
    ikFormData.append('folder', folder);

    const res = await fetch(API_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: ikFormData,
    });

    const data = await res.json();

    if (!res.ok || !data.url) {
      return json({ success: false, error: data.message || 'ImageKit upload failed' }, { status: 400 });
    }

    return json({
      success: true,
      url: data.url,
      fileId: data.fileId,
      name: data.name,
      thumbnailUrl: data.thumbnailUrl || data.url,
    });
  } catch (err: any) {
    console.error('[ImageKit Upload Exception]', err);
    return json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
