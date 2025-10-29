// api/upload.js
// Place this file in your Vercel project at: /api/upload.js

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS headers - MUST be set for all responses including errors
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
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
      console.error('Missing environment variables:', { 
        hasShop: !!shop, 
        hasToken: !!token 
      });
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error - missing credentials',
        details: 'Environment variables not configured. Please set SHOPIFY_SHOP and SHOPIFY_ADMIN_TOKEN in Vercel dashboard.'
      });
    }

    const { filename, image } = req.body;

    if (!filename || !image) {
      return res.status(400).json({ success: false, error: 'Missing filename or image data' });
    }

    // Validate base64 image data
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ success: false, error: 'Invalid image format' });
    }

    // Extract base64 data and content type
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid base64 format' });
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    console.log('Processing upload:', { 
      filename, 
      contentType, 
      size: buffer.length,
      shop: shop 
    });

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
          resource: "FILE",
          fileSize: buffer.length.toString()
        }
      ]
    };

    const stagedResponse = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: stagedUploadMutation,
        variables: stagedUploadVariables,
      }),
    });

    const stagedData = await stagedResponse.json();

    if (stagedData.errors || stagedData.data?.stagedUploadsCreate?.userErrors?.length > 0) {
      console.error('Staged upload error:', stagedData);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create staged upload',
        details: stagedData.errors || stagedData.data.stagedUploadsCreate.userErrors
      });
    }

    const stagedTarget = stagedData.data.stagedUploadsCreate.stagedTargets[0];
    
    // Step 2: Upload file to staged URL
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // Add parameters first
    stagedTarget.parameters.forEach(param => {
      formData.append(param.name, param.value);
    });
    
    // Add file last
    formData.append('file', buffer, {
      filename: filename,
      contentType: contentType
    });

    const uploadResponse = await fetch(stagedTarget.url, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload to S3 failed:', uploadResponse.status, errorText);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to upload file to storage',
        details: errorText
      });
    }

    // Step 3: Create file in Shopify
    const fileCreateMutation = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            ... on GenericFile {
              id
              url
              alt
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const fileCreateVariables = {
      files: [
        {
          alt: filename,
          contentType: "FILE",
          originalSource: stagedTarget.resourceUrl
        }
      ]
    };

    const fileResponse = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: fileCreateMutation,
        variables: fileCreateVariables,
      }),
    });

    const fileData = await fileResponse.json();

    if (fileData.errors || fileData.data?.fileCreate?.userErrors?.length > 0) {
      console.error('File create error:', fileData);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create file in Shopify',
        details: fileData.errors || fileData.data.fileCreate.userErrors
      });
    }

    const createdFile = fileData.data.fileCreate.files[0];

    console.log('Upload successful:', { url: createdFile.url });

    return res.status(200).json({
      success: true,
      url: createdFile.url,
      fileId: createdFile.id,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
}