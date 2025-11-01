// api/remove.js
// API endpoint to remove images with specific filenames from Shopify

const config = {
  api: {
    bodyParser: true,
  },
  maxDuration: 60,
};

async function handler(req, res) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };

  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const shop = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    if (!shop || !token) {
      console.error('Missing environment variables');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error',
        details: 'Missing SHOPIFY_SHOP or SHOPIFY_ADMIN_TOKEN' 
      });
    }

    const { searchPattern, adminPassword } = req.body || {};

    // Admin password check - REQUIRED
    const requiredPassword = process.env.ADMIN_PASSWORD;
    
    if (!requiredPassword) {
      console.error('ADMIN_PASSWORD not set in environment variables');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error',
        message: 'Admin password not configured. Please set ADMIN_PASSWORD in environment variables.' 
      });
    }
    
    if (!adminPassword) {
      console.warn('Removal attempt without password');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized',
        message: 'Admin password is required' 
      });
    }
    
    if (adminPassword !== requiredPassword) {
      console.warn('Unauthorized removal attempt with wrong password');
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized',
        message: 'Invalid admin password' 
      });
    }

    if (!searchPattern) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing searchPattern',
        message: 'Please provide a searchPattern to search for files to remove' 
      });
    }
    
    // Additional security: Prevent accidental mass deletion
    if (searchPattern.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search pattern too short',
        message: 'Search pattern must be at least 2 characters to prevent accidental mass deletion' 
      });
    }

    console.log(`Starting removal process for pattern: ${searchPattern}`);

    // Step 1: Query all files
    const filesQuery = `
      query getFiles($query: String, $first: Int!, $after: String) {
        files(query: $query, first: $first, after: $after) {
          edges {
            node {
              id
              alt
              ... on MediaImage {
                id
                alt
                image {
                  url
                }
              }
              ... on GenericFile {
                id
                alt
                url
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    let allFiles = [];
    let hasNextPage = true;
    let cursor = null;
    const pageSize = 50;

    // Fetch all files (paginated)
    while (hasNextPage) {
      const variables = {
        query: null, // We'll filter client-side for more flexibility
        first: pageSize,
        after: cursor
      };

      const response = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query: filesQuery, variables }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch files',
          details: data.errors 
        });
      }

      const edges = data.data?.files?.edges || [];
      allFiles = allFiles.concat(edges);

      hasNextPage = data.data?.files?.pageInfo?.hasNextPage || false;
      cursor = data.data?.files?.pageInfo?.endCursor || null;

      console.log(`Fetched ${edges.length} files, total: ${allFiles.length}, hasNextPage: ${hasNextPage}`);
    }

    console.log(`Total files fetched: ${allFiles.length}`);

    // Step 2: Filter files by pattern (case-insensitive)
    const pattern = searchPattern.toLowerCase();
    const matchingFiles = allFiles.filter(edge => {
      const alt = edge.node?.alt || '';
      return alt.toLowerCase().includes(pattern);
    });

    console.log(`Found ${matchingFiles.length} files matching pattern: ${searchPattern}`);

    if (matchingFiles.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No files found matching pattern: ${searchPattern}`,
        filesRemoved: 0,
        details: []
      });
    }
    
    // Additional security: Limit max deletions per request to prevent accidents
    const MAX_DELETE_PER_REQUEST = 1000;
    if (matchingFiles.length > MAX_DELETE_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: `Found ${matchingFiles.length} files, but maximum ${MAX_DELETE_PER_REQUEST} files can be deleted per request. Please use a more specific search pattern.`,
        totalMatched: matchingFiles.length
      });
    }

    // Step 3: Delete matching files
    const fileDeleteMutation = `
      mutation fileDelete($fileIds: [ID!]!) {
        fileDelete(fileIds: $fileIds) {
          deletedFileIds
          userErrors {
            field
            message
          }
        }
      }
    `;

    const deletedFiles = [];
    const errors = [];
    
    // Delete in batches of 10 (Shopify limit)
    const batchSize = 10;
    for (let i = 0; i < matchingFiles.length; i += batchSize) {
      const batch = matchingFiles.slice(i, i + batchSize);
      const fileIds = batch.map(edge => edge.node.id);

      try {
        const deleteResponse = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
          },
          body: JSON.stringify({ 
            query: fileDeleteMutation, 
            variables: { fileIds } 
          }),
        });

        const deleteData = await deleteResponse.json();

        if (deleteData.errors) {
          console.error('Delete mutation errors:', deleteData.errors);
          errors.push({ batch: i / batchSize + 1, error: deleteData.errors });
        } else if (deleteData.data?.fileDelete?.userErrors?.length > 0) {
          console.error('Delete user errors:', deleteData.data.fileDelete.userErrors);
          errors.push({ batch: i / batchSize + 1, error: deleteData.data.fileDelete.userErrors });
        } else {
          const deleted = deleteData.data?.fileDelete?.deletedFileIds || [];
          deletedFiles.push(...deleted);
          console.log(`Batch ${i / batchSize + 1}: Deleted ${deleted.length} files`);
        }
      } catch (error) {
        console.error(`Error deleting batch ${i / batchSize + 1}:`, error);
        errors.push({ batch: i / batchSize + 1, error: error.message });
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < matchingFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Removal complete. Deleted ${deletedFiles.length} files, ${errors.length} errors`);

    return res.status(200).json({
      success: true,
      message: `Successfully removed ${deletedFiles.length} files matching pattern: ${searchPattern}`,
      filesRemoved: deletedFiles.length,
      totalMatched: matchingFiles.length,
      details: matchingFiles.map(edge => ({
        id: edge.node.id,
        alt: edge.node.alt,
        deleted: deletedFiles.includes(edge.node.id)
      })),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Remove error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

module.exports = handler;
module.exports.config = config;
