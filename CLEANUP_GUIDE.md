# Image Cleanup Guide

## 🔐 Security Features

### Admin Password Protection
The removal endpoint now requires admin password authentication:
- **Password**: `MySecurePass2024!RemoveImages`
- **Location**: Set in `.env` file and Vercel environment variables
- **Required**: Yes - prevents unauthorized deletions

### Security Controls
✅ **Password Required** - Must match `ADMIN_PASSWORD` environment variable  
✅ **Minimum Pattern Length** - Search pattern must be at least 2 characters  
✅ **Max Deletion Limit** - Maximum 1000 files per request to prevent accidents  
✅ **Confirmation Dialog** - Browser confirmation before deletion  

---

## 🏷️ File Naming Convention

### "CP" Prefix for All Uploads
All uploaded images now have a **"CP_"** prefix automatically added:

**Before:** `myimage.jpg`  
**After:** `CP_myimage.jpg`

**Benefits:**
- Easy identification of uploaded files
- Simple bulk cleanup using pattern "CP"
- Organized file management

**Example filenames:**
- `CP_product_photo_123.jpg`
- `CP_Thomas_Family_4a72a4b1.png`
- `CP_banner_image.jpg`

---

## 🗑️ How to Remove Images

### Method 1: Remove Thomas_Family Images

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Set Admin Password in Vercel:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add: `ADMIN_PASSWORD` = `MySecurePass2024!RemoveImages`
   - Redeploy

3. **Open Admin Panel:**
   ```
   https://your-project.vercel.app/remove-images.html
   ```

4. **Fill in the form:**
   - Search Pattern: `Thomas_Family`
   - Admin Password: `MySecurePass2024!RemoveImages`
   - Click "Remove Images"

### Method 2: Remove All CP Prefixed Images (Future Cleanup)

When you want to remove ALL uploaded images:

1. **Open Admin Panel:**
   ```
   https://your-project.vercel.app/remove-images.html
   ```

2. **Fill in the form:**
   - Search Pattern: `CP`
   - Admin Password: `MySecurePass2024!RemoveImages`
   - Click "Remove Images"

3. **This will remove:**
   - All images with "CP" in the filename
   - Perfect for bulk cleanup of all uploaded content

### Method 3: API Call (Advanced)

```bash
curl -X POST https://your-project.vercel.app/api/remove \
  -H "Content-Type: application/json" \
  -d '{
    "searchPattern": "Thomas_Family",
    "adminPassword": "MySecurePass2024!RemoveImages"
  }'
```

---

## ⚙️ Environment Variables

### Required in Vercel Dashboard

```env
SHOPIFY_SHOP=c0084a-2.myshopify.com
SHOPIFY_ADMIN_TOKEN=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
ADMIN_PASSWORD=MySecurePass2024!RemoveImages
```

### How to Set in Vercel:

1. Go to your project in Vercel Dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable above
4. Click **Save**
5. Redeploy your project

---

## 🛡️ Rate Limiting

### Upload Protection
- **Limit**: 50 uploads per hour per IP address
- **Purpose**: Prevent spam/attack uploads
- **Automatic**: No configuration needed

### Response Headers
Every upload includes:
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 35
```

### When Rate Limited
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "You have exceeded the maximum of 50 uploads per hour. Please try again in 45 minutes."
}
```

---

## 📊 Deletion Limits

| Limit Type | Value | Reason |
|------------|-------|--------|
| Min Search Pattern | 2 characters | Prevent accidental mass deletion |
| Max Files Per Request | 1000 files | Safety limit |
| Batch Size | 10 files | Shopify API limit |

---

## 🎯 Common Use Cases

### 1. Remove Attack Images (Thomas_Family)
```
Pattern: Thomas_Family
Result: Removes ~1000 spam images
```

### 2. Clean Up Test Uploads
```
Pattern: CP_test
Result: Removes all test images
```

### 3. Remove All Uploaded Content
```
Pattern: CP
Result: Removes ALL images with CP prefix
Warning: Use carefully!
```

### 4. Remove Specific Date Range
```
Pattern: CP_2024_11
Result: Removes November 2024 uploads (if dated)
```

---

## 🔒 Security Best Practices

1. **Keep Password Secret**
   - Don't commit to Git
   - Don't share publicly
   - Change if compromised

2. **Set in Vercel Only**
   - `.env` file is for local testing only
   - Production password goes in Vercel Dashboard
   - Different passwords for dev/prod recommended

3. **Monitor Deletion Logs**
   - Check Vercel function logs after deletions
   - Verify expected number of files removed
   - Watch for unauthorized attempts

4. **After Cleanup**
   - Consider removing `remove.js` endpoint
   - Or change `ADMIN_PASSWORD` to new value
   - Redeploy to apply changes

---

## 📝 Quick Commands

### Deploy to Production
```bash
cd "C:\Users\HP\Downloads\Compressed\Serverless Upload"
vercel --prod
```

### Test Locally
```bash
vercel dev
# Then open: http://localhost:3000/remove-images.html
```

### View Logs
```bash
vercel logs
```

---

## 🆘 Troubleshooting

### "Unauthorized" Error
- Check password matches exactly
- Verify `ADMIN_PASSWORD` is set in Vercel
- No extra spaces in password
- Redeploy after adding env variable

### "Search pattern too short"
- Pattern must be at least 2 characters
- Try more specific pattern

### "Too many files"
- Found more than 1000 matching files
- Use more specific search pattern
- Example: `CP_Thomas` instead of `CP`

### Files Not Deleting
- Check Vercel logs for errors
- Verify Shopify credentials are valid
- Check if files exist in Shopify admin
- Try smaller batch (more specific pattern)

---

## ✅ Deployment Checklist

- [ ] Updated code deployed to Vercel
- [ ] `ADMIN_PASSWORD` set in Vercel environment variables
- [ ] `SHOPIFY_SHOP` verified
- [ ] `SHOPIFY_ADMIN_TOKEN` verified
- [ ] Tested upload with CP prefix
- [ ] Admin panel accessible
- [ ] Ready to remove Thomas_Family images

---

**Last Updated**: November 1, 2025  
**Admin Password**: `MySecurePass2024!RemoveImages` (change in production!)
