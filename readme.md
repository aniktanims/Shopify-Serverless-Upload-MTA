# Photo Upload Solution - Deployment Guide

## Overview
This solution uploads customer photos to Shopify Files API via a Vercel serverless function, ensuring images are properly stored and accessible in orders.

## Step 1: Set Up Vercel Project

### 1.1 Create Project Structure
```
your-project/
├── api/
│   └── upload.js          # Serverless function
├── package.json
├── vercel.json
├── .gitignore
└── .env.local            # Local development only
```

### 1.2 Install Vercel CLI
```bash
npm install -g vercel
```

### 1.3 Create Files

Create `package.json`:
```json
{
  "name": "shopify-image-upload",
  "version": "1.0.0",
  "description": "Shopify image upload serverless function"
}
```

Create `vercel.json`:
```json
{
  "functions": {
    "api/upload.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

Create `.gitignore`:
```
.env.local
.env*.local
node_modules
.vercel
```

Create `api/upload.js` - Copy the code from the "Vercel Serverless Function" artifact.

## Step 2: Deploy to Vercel

### 2.1 Initialize and Deploy
```bash
# Navigate to your project directory
cd your-project

# Login to Vercel (if not already logged in)
vercel login

# Deploy
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name? **shopify-image-upload** (or your choice)
- Directory? **./** (press Enter)
- Override settings? **N**

### 2.2 Set Environment Variables

After deployment, add your environment variables:

```bash
vercel env add SHOPIFY_SHOP
```
Enter: `c0084a-2.myshopify.com`

```bash
vercel env add SHOPIFY_ADMIN_TOKEN
```
Enter: `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`

Select environments:
- Production: **Yes**
- Preview: **Yes**
- Development: **Yes**

### 2.3 Deploy Again (to use environment variables)
```bash
vercel --prod
```

### 2.4 Get Your Endpoint URL
After deployment, Vercel will show your URL:
```
https://your-project-name.vercel.app
```

Your upload endpoint will be:
```
https://your-project-name.vercel.app/api/upload
```

## Step 3: Update Shopify Theme

### 3.1 Copy the Updated Liquid Template
1. Go to Shopify Admin → Online Store → Themes
2. Click "..." on your active theme → Edit code
3. Find your custom section file (e.g., `sections/ai_gen_block_57f968a.liquid`)
4. Replace the entire content with the code from the "Updated Photo Upload Block" artifact

### 3.2 Configure the Block Settings
1. Go to your product page in the theme editor
2. Find the "Photo Upload" block
3. In the block settings, find "Upload Endpoint URL"
4. Enter your Vercel endpoint: `https://your-project-name.vercel.app/api/upload`
5. Save

## Step 4: Test the Implementation

### 4.1 Test Upload
1. Visit your product page
2. Upload a test image
3. Click "Add to Cart"
4. Check that:
   - Upload progress shows
   - Success message appears
   - Cart updates with the product

### 4.2 Verify in Shopify Admin
1. Go to Shopify Admin → Content → Files
2. Look for your uploaded image
3. Create a test order
4. Check that the order shows the image URL in line item properties

## Step 5: Verify Image Storage

### Check Order Details
After a customer places an order:
1. Go to Orders in Shopify Admin
2. Open the order
3. Click on the line item
4. You should see:
   - **Custom Photo**: `https://cdn.shopify.com/s/files/...` (the uploaded image URL)
   - **Filename**: Original filename
   - **Size**: Selected puzzle size
   - **Description**: Customer notes (if provided)

## Troubleshooting

### Issue: "Upload endpoint not configured"
**Solution**: Make sure you've added your Vercel endpoint URL in the block settings.

### Issue: "Failed to upload image"
**Solution**: 
1. Check Vercel logs: `vercel logs`
2. Verify environment variables are set correctly
3. Ensure your Shopify admin token has `write_files` permission

### Issue: Images not showing in orders
**Solution**: The image URL is stored in the "Custom Photo" property. Check your order confirmation email template includes line item properties.

## Security Best Practices

1. **Never commit** your `.env.local` file or admin token to git
2. **Use Vercel environment variables** for production
3. **Rotate your admin token** periodically
4. **Monitor Vercel logs** for suspicious activity

## Shopify Admin Token Permissions

Your token needs these permissions:
- ✅ `write_files` - To upload images
- ✅ `read_products` - Optional, for validation

To update permissions:
1. Shopify Admin → Settings → Apps and sales channels
2. Develop apps → Your app
3. Configuration → Admin API access scopes
4. Add required scopes
5. Save and reinstall the app

## Cost Considerations

### Vercel (Free Tier includes):
- 100 GB bandwidth/month
- 100,000 function invocations/month
- 100 GB-hours execution time

### Shopify Files:
- Included in your Shopify plan
- No additional cost for file storage

## Support

If you encounter issues:
1. Check Vercel logs: `vercel logs --follow`
2. Check browser console for errors
3. Verify the endpoint URL is correct in Shopify
4. Test the endpoint directly with a tool like Postman

## Next Steps

Consider adding:
- Image compression/optimization before upload
- Multiple image uploads
- Image cropping tool
- Email notifications with uploaded images
- Customer photo gallery

---

**Your Setup Summary:**
- Shop: `c0084a-2.myshopify.com`
- Vercel Project: Deploy to get your URL
- Endpoint: `https://[your-project].vercel.app/api/upload`