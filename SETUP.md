# 🚀 GMCT Attendance Mobile - Setup Instructions

## Quick Start

### 1. Navigate to Project Directory

```bash
cd c:\Users\charlesc\Documents\APP\gmct-attendance-mobile
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
copy .env.example .env
```

Then edit `.env` and add your Supabase credentials (same as main GMCT app):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Generate PWA Icons (Optional but Recommended)

The app comes with SVG placeholders. For production, generate proper PNG icons:

1. Create a 512x512 PNG logo
2. Visit https://realfavicongenerator.net/
3. Upload your logo
4. Download the generated icons
5. Replace files in `/public` folder:
   - `pwa-192x192.png`
   - `pwa-512x512.png`
   - `apple-touch-icon.png`
   - `favicon.ico`

### 5. Start Development Server

```bash
npm run dev
```

The app will open at http://localhost:3001

### 6. Test the App

1. **Login**: Use a class access code (e.g., "alpha", "beta", or "class1", "class2")
2. **Mark Attendance**: Select statuses for members
3. **Test Offline**: 
   - Open DevTools (F12)
   - Go to Network tab
   - Set to "Offline"
   - Mark attendance - should save locally
   - Set back to "Online"
   - Should auto-sync

### 7. Build for Production

```bash
npm run build
```

Output will be in `dist/` folder.

## Deployment Options

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Add environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

Add environment variables in Netlify dashboard.

### Self-Hosted

1. Build the app: `npm run build`
2. Upload `dist/` folder to your web server
3. Configure your server for SPA routing (redirect all to index.html)
4. Ensure HTTPS is enabled (required for PWA)

## Mobile Installation Instructions

### For Class Leaders (iOS)

1. Open Safari and go to your deployed app URL
2. Tap the Share button (box with up arrow)
3. Scroll and tap "Add to Home Screen"
4. Tap "Add"
5. App icon will appear on home screen

### For Class Leaders (Android)

1. Open Chrome and go to your deployed app URL
2. Tap the menu (3 dots in top right)
3. Tap "Add to Home Screen"
4. Tap "Add"
5. App icon will appear on home screen

## Troubleshooting

### Dependencies Won't Install

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Build Errors

Check that:
- Node.js version is 16 or higher: `node --version`
- All files were created properly
- Environment variables are set correctly

### PWA Won't Install

- Ensure you're using HTTPS (not HTTP)
- Clear browser cache
- Check browser console for errors
- Verify manifest.json is accessible

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure environment variables
3. ✅ Test locally
4. ✅ Generate proper icons
5. ✅ Deploy to hosting
6. ✅ Share URL with class leaders
7. ✅ Instruct them to install on phones

## Support

Need help? Check:
- [README.md](README.md) for detailed documentation
- Browser console (F12) for error messages
- Supabase dashboard for database issues

---

Created for GMCT Church Management System
