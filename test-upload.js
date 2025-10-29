// test-upload.js
// Run this locally to test your Vercel endpoint before deploying to Shopify
// Usage: node test-upload.js

const fs = require('fs');
const path = require('path');

// CONFIGURE THESE:
const VERCEL_ENDPOINT = 'https://shopify-upload-954lic3xv-mostofa-tanim-aniks-projects.vercel.app/api/upload'; // Change this!
const TEST_IMAGE_PATH = './test-image.jpg'; // Path to a test image

async function testUpload() {
  console.log('🧪 Testing image upload...\n');

  // Check if test image exists
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.error('❌ Test image not found at:', TEST_IMAGE_PATH);
    console.log('Please create a test image or update TEST_IMAGE_PATH');
    return;
  }

  try {
    // Read the test image
    const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg'; // Adjust if needed
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    console.log('📤 Uploading test image...');
    console.log('Endpoint:', VERCEL_ENDPOINT);
    console.log('Image size:', (imageBuffer.length / 1024).toFixed(2), 'KB\n');

    const response = await fetch(VERCEL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: 'test-image.jpg',
        image: dataUrl
      })
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse response as JSON');
      console.error('Response:', responseText);
      return;
    }

    if (response.ok && data.success) {
      console.log('✅ Upload successful!\n');
      console.log('📋 Response:');
      console.log('   URL:', data.url);
      console.log('   File ID:', data.fileId);
      console.log('   Message:', data.message);
      console.log('\n🎉 Your upload endpoint is working correctly!');
      console.log('You can now add this URL to your Shopify block settings:');
      console.log('   ' + VERCEL_ENDPOINT);
    } else {
      console.error('❌ Upload failed');
      console.error('Status:', response.status);
      console.error('Error:', data.error || 'Unknown error');
      if (data.details) {
        console.error('Details:', JSON.stringify(data.details, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error during test:');
    console.error(error.message);
    
    if (error.cause) {
      console.error('Cause:', error.cause.message);
    }
  }
}

// Run the test
testUpload();