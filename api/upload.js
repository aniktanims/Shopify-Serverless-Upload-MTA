// api/upload.js
// Place this file in your Vercel project at: /api/upload.js

const FormData = require('form-data');

const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

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

    const { filename, image, fileId } = req.body || {};

    // If fileId is provided, this is a status check request
    if (fileId) {
      console.log('Status check request for fileId:', fileId);
      
      // Query the file status
      const fileQuery = `
        query getFile($id: ID!) {
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

      try {
        const queryRes = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
          },
          body: JSON.stringify({ query: fileQuery, variables: { id: fileId } }),
        });

        const queryText = await queryRes.text();
        let queryData;
        try { queryData = JSON.parse(queryText); } catch (err) { 
          console.error('file status query response not JSON', { status: queryRes.status, text: queryText }); 
          return res.status(500).json({ success: false, error: 'Failed to check file status' }); 
        }
        
        if (queryData.errors) { 
          console.error('file status query errors', queryData); 
          return res.status(500).json({ success: false, error: 'Failed to check file status', details: queryData.errors }); 
        }

        const fileNode = queryData.data?.node;
        if (!fileNode) {
          return res.status(404).json({ success: false, error: 'File not found' });
        }

        console.log('File status check result:', { id: fileNode.id, status: fileNode.status });

        if (fileNode.status !== 'READY') {
          return res.status(202).json({
            success: true,
            message: 'File still processing. Please wait and try again.',
            status: fileNode.status,
            fileId: fileNode.id,
            ready: false
          });
        }

        // File is ready, extract URL
        let fileUrl = null;
        if (fileNode.__typename === 'MediaImage' && fileNode.image && fileNode.image.url) {
          fileUrl = fileNode.image.url;
        }

        if (!fileUrl) {
          return res.status(500).json({ success: false, error: 'File ready but no URL available' });
        }

        console.log('File ready with URL:', fileUrl);
        return res.status(200).json({ success: true, url: fileUrl, fileId: fileNode.id, message: 'File ready' });
        
      } catch (err) {
        console.error('file status check error', err && err.message ? err.message : err);
        return res.status(500).json({ success: false, error: 'Failed to check file status' });
      }
    }

    // Original upload logic continues below
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

      // Check if the media is ready
      if (createdFile.status !== 'READY') {
        console.log('Media not ready yet, status:', createdFile.status);
        return res.status(202).json({
          success: true,
          message: 'File uploaded successfully but still processing. Please wait a few seconds and try again.',
          status: createdFile.status,
          fileId: createdFile.id,
          ready: false
        });
      }

      // Extract URL based on file type
      let fileUrl = null;
      if (createdFile.__typename === 'GenericFile' && createdFile.url) {
        fileUrl = createdFile.url;
      } else if (createdFile.__typename === 'MediaImage' && createdFile.image && createdFile.image.url) {
        fileUrl = createdFile.image.url;
      } else if (createdFile.__typename === 'Video' && createdFile.sources && createdFile.sources.length > 0) {
        fileUrl = createdFile.sources[0].url;
      } else if (createdFile.__typename === 'Model3d' && createdFile.sources && createdFile.sources.length > 0) {
        fileUrl = createdFile.sources[0].url;
      }

      console.log('Extracted fileUrl:', fileUrl);
      console.log('createdFile.id:', createdFile.id);

      if (!fileUrl) {
        console.error('No URL found in created file', createdFile);
        return res.status(500).json({ success: false, error: 'File created but no URL available', details: 'File was created in Shopify but URL is not accessible yet' });
      }

      console.log('Upload successful:', { url: fileUrl });
      return res.status(200).json({ success: true, url: fileUrl, fileId: createdFile.id, message: 'File uploaded successfully' });
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