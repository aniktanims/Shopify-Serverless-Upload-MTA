# Security & Image Management Updates

## 🔒 Rate Limiting (Anti-Attack Protection)

### What's New
- **IP-based rate limiting** prevents abuse and attacks
- **50 uploads per hour** per IP address
- Automatic reset after 1 hour
- Memory-efficient with auto-cleanup

### How It Works
The upload endpoint (`/api/upload`) now tracks each IP address and blocks requests after 50 uploads within a 1-hour window. Attackers attempting to upload thousands of images will be automatically blocked.

### Rate Limit Response
When rate limit is exceeded, users receive:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "You have exceeded the maximum of 50 uploads per hour. Please try again in X minutes.",
  "resetIn": 45
}
```

### Rate Limit Headers
Every upload response includes:
- `X-RateLimit-Limit`: Maximum uploads allowed (50)
- `X-RateLimit-Remaining`: Remaining uploads in current window

### Configuration
Edit `api/upload.js` to adjust limits:
```javascript
const RATE_LIMIT = 50; // Max uploads per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
```

---

## 🗑️ Bulk Image Removal

### New Endpoint: `/api/remove`

Remove all images matching a specific pattern from your Shopify store.

### Setup

1. **Set Admin Password** in Vercel Environment Variables:
   ```
   ADMIN_PASSWORD=your-super-secret-password
   ```

2. **Deploy to Vercel**

3. **Access the Admin Panel**:
   - Open `remove-images.html` in your browser
   - Or make API calls directly

### Using the HTML Admin Panel

1. Open `remove-images.html` in your browser
2. Enter the search pattern (e.g., "Thomas_Family")
3. Enter your admin password
4. Click "Remove Images"
5. Confirm the deletion

### API Usage

**Endpoint:** `POST /api/remove`

**Request Body:**
```json
{
  "searchPattern": "Thomas_Family",
  "adminPassword": "your-admin-password"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Successfully removed 125 files matching pattern: Thomas_Family",
  "filesRemoved": 125,
  "totalMatched": 125,
  "details": [
    {
      "id": "gid://shopify/MediaImage/123456",
      "alt": "Thomas_Family_4a72a4b1-de29-445c-b7dd-97918c89b1ab",
      "deleted": true
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid admin password"
}
```

### Features

- ✅ **Pattern Matching**: Case-insensitive search in filenames
- ✅ **Batch Processing**: Handles large deletions efficiently
- ✅ **Paginated Fetch**: Retrieves all files from Shopify
- ✅ **Admin Protection**: Requires password authentication
- ✅ **Detailed Reporting**: Shows all deleted files
- ✅ **Error Handling**: Graceful error recovery

### Example: Remove "Thomas_Family" Images

Using curl:
```bash
curl -X POST https://your-project.vercel.app/api/remove \
  -H "Content-Type: application/json" \
  -d '{
    "searchPattern": "Thomas_Family",
    "adminPassword": "your-admin-password"
  }'
```

Using JavaScript:
```javascript
const response = await fetch('/api/remove', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    searchPattern: 'Thomas_Family',
    adminPassword: 'your-admin-password'
  })
});

const result = await response.json();
console.log(result);
```

---

## 🚀 Deployment Instructions

### 1. Update Environment Variables in Vercel

Go to your Vercel project settings and add:

```
SHOPIFY_SHOP=your-shop.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxx
ADMIN_PASSWORD=your-super-secret-password
```

### 2. Deploy Updated Code

```bash
git add .
git commit -m "Add rate limiting and bulk image removal"
git push
```

Vercel will automatically deploy the changes.

### 3. Test Rate Limiting

Try uploading more than 50 images from the same IP - you should get rate limited.

### 4. Remove Unwanted Images

1. Open `https://your-project.vercel.app/remove-images.html`
2. Enter "Thomas_Family" as the search pattern
3. Enter your admin password
4. Confirm and delete

---

## ⚠️ Important Security Notes

1. **Keep ADMIN_PASSWORD Secret**: Never commit it to Git or share publicly
2. **Use Strong Password**: Minimum 20 characters, random
3. **HTTPS Only**: Always use HTTPS in production
4. **Monitor Logs**: Check Vercel logs for suspicious activity
5. **Backup Before Deletion**: Removed images cannot be recovered

---

## 📊 Monitoring

### Check Rate Limit Status

The upload response headers show rate limit info:
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 35
```

### View Logs

Check Vercel logs for:
- Rate limit violations: `Rate limit exceeded for IP: xxx.xxx.xxx.xxx`
- Unauthorized removal attempts: `Unauthorized removal attempt`
- Upload activity: `Request from IP: xxx.xxx.xxx.xxx`

---

## 🛠️ Troubleshooting

### Rate Limiting Not Working

**Issue**: Users can upload more than 50 images

**Solution**: 
- Ensure you deployed the latest `api/upload.js`
- Check Vercel logs for errors
- Verify the code includes the rate limiting logic

### Cannot Remove Images

**Issue**: "Invalid admin password" error

**Solution**:
- Check ADMIN_PASSWORD is set in Vercel environment variables
- Redeploy after adding environment variables
- Try the default password if you haven't changed it

### "No files found" When Removing

**Issue**: Images exist but aren't being found

**Solution**:
- Check the exact filename in Shopify admin
- Pattern matching is case-insensitive but must match part of the filename
- Try a shorter search pattern (e.g., "Thomas" instead of "Thomas_Family_4a72a4b1")

---

## 📝 Technical Details

### Rate Limit Implementation

- **Storage**: In-memory Map (resets on serverless function cold start)
- **Cleanup**: Automatic cleanup every 5 minutes
- **IP Detection**: Uses `x-forwarded-for`, `x-real-ip`, or connection info
- **Production Note**: For persistent rate limiting across deployments, consider Redis

### Removal Process

1. Fetch all files from Shopify (paginated)
2. Filter files by search pattern
3. Delete in batches of 10 (Shopify limit)
4. Return detailed results

### API Limits

- **Shopify GraphQL**: 50 requests per second
- **Batch Delete**: 10 files per request
- **Function Timeout**: 60 seconds for removal, 30 for upload

---

## 🎯 Next Steps

1. **Set a strong ADMIN_PASSWORD** in Vercel
2. **Test the rate limiting** by uploading multiple images
3. **Remove the Thomas_Family images** using the admin panel
4. **Monitor Vercel logs** for any suspicious activity
5. **Consider adding email notifications** for security events

---

## 📧 Support

If you encounter issues:
1. Check Vercel function logs
2. Verify all environment variables are set
3. Test with a simple pattern first
4. Check Shopify API rate limits

---

**Last Updated**: November 1, 2025
