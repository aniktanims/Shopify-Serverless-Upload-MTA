# Shopify Photo Upload Solution

A serverless solution for uploading customer photos to Shopify using Vercel functions and the Shopify Files API.

## Overview

This project provides a complete photo upload system for Shopify stores, allowing customers to upload custom images that are stored in Shopify Files and included in their orders.

## Features

- ✅ Serverless photo upload via Vercel
- ✅ Automatic storage in Shopify Files API
- ✅ Order integration with custom properties
- ✅ Progress indicators and error handling
- ✅ Mobile-responsive upload interface
- ✅ Secure file handling with size limits

## Project Structure

```
shopify-photo-upload/
├── api/
│   └── upload.js          # Vercel serverless function
├── package.json           # Project dependencies
├── vercel.json           # Vercel configuration
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Prerequisites

- Shopify store with admin access
- Vercel account
- Node.js installed locally

## Quick Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd shopify-photo-upload
npm install -g vercel
```

### 2. Configure Environment Variables

Create a `.env.local` file (never commit this):

```env
SHOPIFY_SHOP=your-shop.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_your_admin_token_here
```

### 3. Deploy to Vercel

```bash
vercel
```

Follow the prompts to create your project, then add environment variables:

```bash
vercel env add SHOPIFY_SHOP
vercel env add SHOPIFY_ADMIN_TOKEN
```

Deploy to production:
```bash
vercel --prod
```

### 4. Get Your Upload Endpoint

After deployment, your endpoint will be:
```
https://your-project-name.vercel.app/api/upload
```

## Shopify Configuration

### 1. Create Custom App

1. Go to Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps" → "Create an app"
3. Add these Admin API scopes:
   - `write_files` (required)
   - `read_products` (optional, for validation)
4. Install the app and copy the Admin API access token

### 2. Update Theme Code

1. Go to Online Store → Themes → Edit code
2. Find your photo upload section/template
3. Update the upload endpoint URL to your Vercel endpoint
4. Ensure the form handles file uploads and custom properties

### 3. Test the Integration

1. Upload a test image on your product page
2. Add to cart and complete a test order
3. Verify the image appears in:
   - Cart drawer/sidebar
   - Order details in Shopify admin
   - Order confirmation emails

## API Reference

### POST /api/upload

Uploads an image file to Shopify Files API.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file` (image file)

**Response:**
```json
{
  "success": true,
  "file": {
    "url": "https://cdn.shopify.com/s/files/...",
    "filename": "customer-upload.jpg",
    "size": 123456
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## File Requirements

- **Formats:** JPG, PNG, GIF, WebP
- **Max Size:** 20MB (configurable)
- **Storage:** Automatic cleanup after 30 days (Shopify default)

## Security Considerations

- Files are stored securely in Shopify's CDN
- Admin tokens should never be exposed client-side
- Use environment variables for all sensitive data
- Implement proper CORS policies if needed

## Troubleshooting

### Upload Fails
- Check Vercel function logs: `vercel logs`
- Verify environment variables are set
- Ensure admin token has correct permissions
- Check file size limits

### Images Not Showing in Orders
- Verify the upload endpoint URL in your theme
- Check that line item properties are being set correctly
- Ensure order confirmation emails include custom properties

### CORS Issues
- Add your Shopify domain to Vercel's allowed origins
- Check that the function returns proper CORS headers

## Cost Optimization

### Vercel Free Tier
- 100GB bandwidth/month
- 100,000 function invocations/month
- 100GB-hours execution time

### Shopify Files
- Included in all Shopify plans
- No additional storage costs

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run locally
vercel dev
```

### Environment Variables for Development

```env
SHOPIFY_SHOP=your-development-shop.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_your_dev_token
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Please use responsibly and follow Shopify's terms of service.

## Support

For issues or questions:
1. Check Vercel function logs
2. Review Shopify Files API documentation
3. Test with different file types and sizes
4. Verify network connectivity

## Roadmap

- [ ] Image compression/optimization
- [ ] Multiple file uploads
- [ ] Image cropping interface
- [ ] Customer photo galleries
- [ ] Email notifications with images
- [ ] Admin dashboard for uploaded images