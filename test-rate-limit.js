#!/usr/bin/env node

/**
 * Rate Limit Test Script
 * Tests the upload rate limiting functionality
 * Usage: node test-rate-limit.js [number_of_uploads]
 */

const https = require('https');
const http = require('http');

// Configuration
const API_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/upload`
  : process.env.API_URL
  ? process.env.API_URL
  : 'http://localhost:3000/api/upload'; // For local testing

const DEFAULT_UPLOAD_COUNT = 55; // Test beyond the 50 limit
const DELAY_BETWEEN_REQUESTS = 100; // ms

// Test image data (1x1 pixel JPEG in base64)
const TEST_IMAGE_DATA = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

function makeUploadRequest(filename) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      filename: filename,
      image: TEST_IMAGE_DATA
    });

    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      // Capture rate limit headers
      const rateLimitHeaders = {
        limit: res.headers['x-ratelimit-limit'],
        remaining: res.headers['x-ratelimit-remaining']
      };

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const responseData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: rateLimitHeaders,
            data: responseData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: rateLimitHeaders,
            data: { error: 'Invalid JSON response', raw: data }
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function runRateLimitTest(uploadCount) {
  console.log('🛡️  Rate Limit Test Starting...');
  console.log(`📊 Testing ${uploadCount} uploads to: ${API_URL}`);
  console.log(`⏱️  Rate limit: 50 uploads per hour per IP\n`);

  let successful = 0;
  let rateLimited = 0;
  let errors = 0;
  let lastRemaining = null;

  for (let i = 1; i <= uploadCount; i++) {
    const filename = `rate_limit_test_${Date.now()}_${i}.jpg`;

    try {
      const result = await makeUploadRequest(filename);

      // Update counters
      if (result.data.success) {
        successful++;
        console.log(`✅ ${i}/${uploadCount} - SUCCESS - Remaining: ${result.headers.remaining || 'N/A'}`);
      } else if (result.data.error === 'Rate limit exceeded') {
        rateLimited++;
        console.log(`🚫 ${i}/${uploadCount} - RATE LIMITED - Reset in ${result.data.resetIn || 'N/A'} minutes`);
      } else {
        errors++;
        console.log(`❌ ${i}/${uploadCount} - ERROR: ${result.data.error || 'Unknown error'}`);
      }

      // Show rate limit info
      if (result.headers.limit && result.headers.remaining !== undefined) {
        lastRemaining = result.headers.remaining;
      }

    } catch (error) {
      errors++;
      console.log(`💥 ${i}/${uploadCount} - NETWORK ERROR: ${error.message}`);
    }

    // Progress indicator
    if (i % 10 === 0 && i < uploadCount) {
      console.log(`\n📈 Progress: ${i}/${uploadCount} completed\n`);
    }

    // Delay between requests (except for last one)
    if (i < uploadCount) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }

  // Final results
  console.log('\n' + '='.repeat(50));
  console.log('🎯 FINAL RESULTS');
  console.log('='.repeat(50));
  console.log(`📊 Total attempts: ${uploadCount}`);
  console.log(`✅ Successful uploads: ${successful}`);
  console.log(`🚫 Rate limited: ${rateLimited}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📈 Success rate: ${((successful / uploadCount) * 100).toFixed(1)}%`);

  if (rateLimited > 0) {
    console.log('\n🎉 SUCCESS: Rate limiting is working!');
    console.log(`   Blocked ${rateLimited} requests after ${successful} successful uploads.`);
  } else if (uploadCount <= 50) {
    console.log('\n⚠️  PARTIAL: Rate limit not triggered yet.');
    console.log('   Try running with more than 50 uploads to test the limit.');
  } else {
    console.log('\n❌ FAILURE: No rate limiting detected!');
    console.log('   Check if the rate limiting code is deployed and working.');
  }

  if (lastRemaining !== null) {
    console.log(`\n📊 Final rate limit status: ${lastRemaining} remaining`);
  }

  console.log('\n💡 Tips:');
  console.log('   • Rate limit resets every hour');
  console.log('   • Each IP address has its own limit');
  console.log('   • Use different IP addresses to test further');
  console.log('   • Check Vercel logs for detailed rate limit activity');
}

// Main execution
const uploadCount = parseInt(process.argv[2]) || DEFAULT_UPLOAD_COUNT;

if (uploadCount < 1 || uploadCount > 200) {
  console.error('❌ Invalid upload count. Please specify a number between 1 and 200.');
  console.log('Usage: node test-rate-limit.js [number_of_uploads]');
  console.log('Example: node test-rate-limit.js 55');
  process.exit(1);
}

// Check if we're testing locally
if (API_URL.includes('localhost') && !process.env.FORCE_LOCAL) {
  console.log('⚠️  LOCAL TESTING DETECTED');
  console.log('   Make sure your local server is running:');
  console.log('   $ vercel dev');
  console.log('   OR set your Vercel URL:');
  console.log('   $ export VERCEL_URL=your-project.vercel.app');
  console.log('   OR set custom API URL:');
  console.log('   $ export API_URL=https://your-project.vercel.app/api/upload');
  console.log('   OR run with: $ FORCE_LOCAL=1 node test-rate-limit.js');
  console.log('');
}

runRateLimitTest(uploadCount).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
