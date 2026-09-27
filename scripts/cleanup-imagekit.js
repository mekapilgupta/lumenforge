/**
 * Clean up all files in ImageKit under `/products/`
 * Usage: node scripts/cleanup-imagekit.js
 */
import 'dotenv/config';

const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
if (!IMAGEKIT_PRIVATE_KEY) {
  console.error('Error: IMAGEKIT_PRIVATE_KEY is not defined in environment or .env');
  process.exit(1);
}

const authHeader = 'Basic ' + Buffer.from(`${IMAGEKIT_PRIVATE_KEY}:`).toString('base64');

async function cleanupImageKitProducts() {
  console.log('🚀 Starting ImageKit /products/ folder cleanup...');
  let totalDeleted = 0;
  let hasMore = true;
  let skip = 0;

  while (hasMore) {
    console.log(`Fetching files from ImageKit (skip: ${skip}, path: /products/)...`);
    const listRes = await fetch(`https://api.imagekit.io/v1/files?path=%2Fproducts%2F&limit=100&skip=${skip}`, {
      headers: { Authorization: authHeader }
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error('Failed to list files from ImageKit:', listRes.status, errText);
      break;
    }

    const files = await listRes.json();
    if (!Array.isArray(files) || files.length === 0) {
      console.log('No more files found in /products/.');
      hasMore = false;
      break;
    }

    const fileIds = files.map(f => f.fileId).filter(Boolean);
    console.log(`Found ${fileIds.length} files. Deleting batch...`);

    const delRes = await fetch('https://api.imagekit.io/v1/files/batch/deleteByFileIds', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileIds })
    });

    if (delRes.ok) {
      const delResult = await delRes.json();
      console.log(`Successfully deleted batch of ${fileIds.length} files.`, delResult);
      totalDeleted += fileIds.length;
    } else {
      console.error('Batch deletion failed:', await delRes.text());
      // Fallback: delete one-by-one
      for (const fId of fileIds) {
        await fetch(`https://api.imagekit.io/v1/files/${fId}`, {
          method: 'DELETE',
          headers: { Authorization: authHeader }
        });
      }
      totalDeleted += fileIds.length;
    }

    // Since we deleted files, skip might not need to increase if list shifts, but if some failed, increase skip
    if (files.length < 100) {
      hasMore = false;
    }
  }

  // Also attempt to delete the root /products folder if empty
  try {
    console.log('Attempting to delete /products folder structure...');
    await fetch('https://api.imagekit.io/v1/folder/', {
      method: 'DELETE',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ folderPath: '/products' })
    });
  } catch (e) {
    console.warn('Folder deletion warning:', e.message);
  }

  console.log(`✨ Cleanup complete! Total ImageKit product files deleted: ${totalDeleted}`);
}

cleanupImageKitProducts().catch(err => {
  console.error('Cleanup script error:', err);
  process.exit(1);
});
