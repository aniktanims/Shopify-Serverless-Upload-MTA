#!/usr/bin/env node

// Script to check what files would be deployed to Vercel
// Run with: node check-deployment-files.js

const fs = require('fs');
const path = require('path');

function shouldIgnoreFile(filePath, ignorePatterns) {
  const relativePath = path.relative(process.cwd(), filePath);

  for (const pattern of ignorePatterns) {
    // Simple pattern matching (you could use a proper glob library for more complex patterns)
    if (pattern.startsWith('*')) {
      const extension = pattern.substring(1);
      if (relativePath.endsWith(extension)) {
        return true;
      }
    } else if (pattern.endsWith('/')) {
      // Directory pattern
      if (relativePath.startsWith(pattern) || relativePath.includes('/' + pattern)) {
        return true;
      }
    } else if (relativePath === pattern || relativePath.includes('/' + pattern)) {
      return true;
    }
  }

  return false;
}

function checkDeploymentFiles() {
  const vercelignorePath = path.join(process.cwd(), '.vercelignore');

  if (!fs.existsSync(vercelignorePath)) {
    console.log('❌ No .vercelignore file found!');
    return;
  }

  const ignoreContent = fs.readFileSync(vercelignorePath, 'utf8');
  const ignorePatterns = ignoreContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  console.log('🔍 Checking deployment files...\n');

  const included = [];
  const excluded = [];

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (shouldIgnoreFile(fullPath, ignorePatterns)) {
        excluded.push(path.relative(process.cwd(), fullPath) + (stat.isDirectory() ? '/' : ''));
      } else {
        included.push(path.relative(process.cwd(), fullPath) + (stat.isDirectory() ? '/' : ''));
      }

      if (stat.isDirectory() && !shouldIgnoreFile(fullPath, ignorePatterns)) {
        scanDirectory(fullPath);
      }
    }
  }

  scanDirectory(process.cwd());

  console.log('✅ Files that WILL be deployed to Vercel:');
  included.forEach(file => console.log('  📁 ' + file));

  console.log('\n❌ Files that will be EXCLUDED from deployment:');
  excluded.slice(0, 20).forEach(file => console.log('  🚫 ' + file));

  if (excluded.length > 20) {
    console.log(`  ... and ${excluded.length - 20} more files`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Included: ${included.length} files/directories`);
  console.log(`  Excluded: ${excluded.length} files/directories`);
  console.log(`  Total: ${included.length + excluded.length} items`);
}

if (require.main === module) {
  checkDeploymentFiles();
}