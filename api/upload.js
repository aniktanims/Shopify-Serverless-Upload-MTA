// api/upload.js
// Place this file in your Vercel project at: /api/upload.js

const FormData = require('form-data');

const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
  maxDuration: 30,
};

// Polling function to wait for MediaImage processing
async function pollForMediaReady(shop, token, fileId, maxWaitMs = 15000, pollIntervalMs = 1000) {
  const startTime = Date.now();
  const endTime = startTime + maxWaitMs;

  const statusQuery = `
    query getFileStatus($id: ID!) {
      node(id: $id) {
        __typename
        ... on MediaImage {
          id
          status
          image {
            url
          }
        }
      }
    }
  `;

  while (Date.now() < endTime) {
    try {
      console.log(`Polling for media status, fileId: ${fileId}, time elapsed: ${Date.now() - startTime}ms`);

      const statusRes = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({
          query: statusQuery,
          variables: { id: fileId }
        }),
      });

      const statusText = await statusRes.text();
      const statusData = JSON.parse(statusText);

      if (statusData.errors) {
        console.error('Status check query errors:', statusData.errors);
        throw new Error('Failed to check media status');
      }

      const media = statusData.data?.node;
      if (!media) {
        console.error('Media not found for status check:', statusData);
        throw new Error('Media not found');
      }

      console.log(`Media status: ${media.status}`);

      if (media.status === 'READY') {
        if (media.image && media.image.url) {
          console.log('Media ready with URL:', media.image.url);
          return { success: true, url: media.image.url, fileId: media.id };
        } else {
          console.error('Media marked as READY but no URL available:', media);
          throw new Error('Media ready but no URL available');
        }
      }

      if (media.status === 'FAILED') {
        console.error('Media processing failed:', media);
        throw new Error('Media processing failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

    } catch (error) {
      console.error('Error during polling:', error);
      throw error;
    }
  }

  // Timeout reached
  console.error(`Polling timeout reached after ${maxWaitMs}ms for fileId: ${fileId}`);
  throw new Error(`Media processing timeout: Shopify did not complete processing within ${maxWaitMs / 1000} seconds. The image may still be processing in the background.`);
}

async function handler(req, res) {
  // CORS headers - MUST be set for all responses including errors
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  // Set CORS headers for ALL responses
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Get shop and token from environment variables
    const shop = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    // Check environment variables FIRST
    if (!shop || !token) {
      console.error('Missing environment variables:', { hasShop: !!shop, hasToken: !!token });
      return res.status(500).json({ success: false, error: 'Server configuration error - missing credentials', details: 'Environment variables not configured. Please set SHOPIFY_SHOP and SHOPIFY_ADMIN_TOKEN in Vercel dashboard.' });
    }

    const { filename, image } = req.body || {};

    if (!filename || !image) {
      return res.status(400).json({ success: false, error: 'Missing filename or image data' });
    }

    // Validate base64 image data
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ success: false, error: 'Invalid image format' });
    }

    // Extract base64 data and content type
    const matches = image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid base64 format' });
    }

    const contentType = matches[1];
    const base64Data = matches[2];

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    console.log('Processing upload:', { filename, contentType, size: buffer.length, shop: shop });

    // Step 1: Create staged upload
    const stagedUploadMutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const stagedUploadVariables = {
      input: [
        {
          filename: filename,
          mimeType: contentType,
          resource: 'IMAGE',
          fileSize: buffer.length.toString(),
        },
      ],
    };

    // Call Shopify GraphQL to get staged upload target
    let stagedData;
    try {
      const stagedRes = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query: stagedUploadMutation, variables: stagedUploadVariables }),
      });

      const stagedText = await stagedRes.text();
      try {
        stagedData = JSON.parse(stagedText);
      } catch (err) {
        console.error('staged upload JSON parse failed', { status: stagedRes.status, text: stagedText });
        return res.status(500).json({ success: false, error: 'Failed to create staged upload', details: 'staged upload response not JSON' });
      }

      if (stagedData.errors || stagedData.data?.stagedUploadsCreate?.userErrors?.length) {
        console.error('staged upload returned errors', stagedData);
        return res.status(500).json({ success: false, error: 'Failed to create staged upload', details: stagedData.errors || stagedData.data.stagedUploadsCreate.userErrors });
      }
    } catch (err) {
      console.error('stagedUploadsCreate fetch failed', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: 'Failed to create staged upload', details: 'network error during stagedUploadsCreate' });
    }

    const stagedTarget = stagedData.data.stagedUploadsCreate.stagedTargets && stagedData.data.stagedUploadsCreate.stagedTargets[0];
    if (!stagedTarget || !stagedTarget.url) {
      console.error('No staged target in response', stagedData);
      return res.status(500).json({ success: false, error: 'Failed to create staged upload', details: 'no staged target returned' });
    }

    // Step 2: Upload file to staged URL
    const headers = {};
    (stagedTarget.parameters || []).forEach(p => {
      headers[p.name] = p.value;
    });

    // Log headers (mask sensitive values)
    try {
      const headerKeys = Object.keys(headers);
      console.log('Outgoing PUT headers:', headerKeys);
    } catch (err) {
      console.warn('Could not list PUT headers', err && err.message ? err.message : err);
    }

    try {
      const uploadRes = await fetch(stagedTarget.url, { method: 'PUT', body: buffer, headers });
      if (!uploadRes.ok) {
        const t = await uploadRes.text();
        console.error('PUT upload to staged target failed', uploadRes.status, t);
        return res.status(500).json({ success: false, error: 'Failed to upload file to storage', details: t, status: uploadRes.status });
      }
    } catch (err) {
      console.error('network error uploading to staged target (PUT)', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: 'Failed to upload file to storage', details: 'network error during upload to staged target' });
    }

    // Step 3: Create file in Shopify using staged resource URL
    const fileCreateMutation = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            __typename
            ... on GenericFile {
              id
              url
              alt
            }
            ... on MediaImage {
              id
              status
              image {
                url
              }
              alt
            }
            ... on Video {
              id
              sources {
                url
              }
            }
            ... on Model3d {
              id
              sources {
                url
              }
            }
          }
          userErrors { field message }
        }
      }
    `;

    const fileCreateVariables = { files: [{ alt: filename, contentType: 'IMAGE', originalSource: stagedTarget.resourceUrl }] };

    console.log('stagedTarget.resourceUrl:', stagedTarget.resourceUrl);
    console.log('fileCreateVariables:', fileCreateVariables);

    try {
      const fileRes = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query: fileCreateMutation, variables: fileCreateVariables }) });
      const fileText = await fileRes.text();
      let fileData;
      try { fileData = JSON.parse(fileText); } catch (err) { console.error('fileCreate response not JSON', { status: fileRes.status, text: fileText }); return res.status(500).json({ success: false, error: 'Failed to create file in Shopify', details: 'fileCreate response not JSON' }); }
      if (fileData.errors || fileData.data?.fileCreate?.userErrors?.length) { console.error('fileCreate errors', fileData); return res.status(500).json({ success: false, error: 'Failed to create file in Shopify', details: fileData.errors || fileData.data.fileCreate.userErrors }); }
      const createdFile = fileData.data.fileCreate.files && fileData.data.fileCreate.files[0];
      if (!createdFile) { console.error('fileCreate returned no file', fileData); return res.status(500).json({ success: false, error: 'Failed to create file in Shopify', details: 'no file returned' }); }

      console.log('fileCreate full response:', JSON.stringify(fileData, null, 2));
      console.log('createdFile object:', createdFile);
      console.log('createdFile.__typename:', createdFile.__typename);
      console.log('createdFile.status:', createdFile.status);

      // Handle different file types
      if (createdFile.__typename === 'GenericFile') {
        if (createdFile.url) {
          console.log('GenericFile upload successful:', { url: createdFile.url });
          return res.status(200).json({ success: true, url: createdFile.url, fileId: createdFile.id, message: 'File uploaded successfully' });
        } else {
          console.error('GenericFile created but no URL available', createdFile);
          return res.status(500).json({ success: false, error: 'File created but no URL available', details: 'GenericFile was created but URL is not available' });
        }
      }

      // For MediaImage, poll until ready or timeout
      if (createdFile.__typename === 'MediaImage') {
        try {
          console.log('MediaImage created, starting polling for readiness...');
          const pollResult = await pollForMediaReady(shop, token, createdFile.id);

          console.log('Polling successful, returning URL:', pollResult.url);
          return res.status(200).json({
            success: true,
            url: pollResult.url,
            fileId: pollResult.fileId,
            message: 'Image uploaded and processed successfully'
          });

        } catch (pollError) {
          console.error('Polling failed:', pollError.message);
          return res.status(500).json({
            success: false,
            error: 'Image processing timeout',
            details: pollError.message,
            fileId: createdFile.id,
            status: createdFile.status
          });
        }
      }

      // Handle other media types (Video, Model3d)
      let fileUrl = null;
      if (createdFile.__typename === 'Video' && createdFile.sources && createdFile.sources.length > 0) {
        fileUrl = createdFile.sources[0].url;
      } else if (createdFile.__typename === 'Model3d' && createdFile.sources && createdFile.sources.length > 0) {
        fileUrl = createdFile.sources[0].url;
      }

      if (fileUrl) {
        console.log('Upload successful:', { url: fileUrl });
        return res.status(200).json({ success: true, url: fileUrl, fileId: createdFile.id, message: 'File uploaded successfully' });
      } else {
        console.error('No URL found in created file', createdFile);
        return res.status(500).json({ success: false, error: 'File created but no URL available', details: 'File was created in Shopify but URL is not accessible' });
      }

    } catch (err) {
      console.error('fileCreate network error', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: 'Failed to create file in Shopify', details: 'network error during fileCreate' });
    }
  } catch (error) {
    console.error('Upload error:', error && error.stack ? error.stack : error);
    return res.status(500).json({ success: false, error: 'Internal server error', message: error && error.message ? error.message : String(error) });
  }
}

module.exports = handler;
module.exports.config = config;