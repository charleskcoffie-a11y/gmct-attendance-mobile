# GMCT Attendance Mobile App

A Progressive Web App (PWA) for GMCT class leaders to mark attendance on their mobile devices.

## Features

✅ **Offline First** - Works without internet connection  
✅ **Auto-Sync** - Syncs attendance when back online  
✅ **Mobile Optimized** - Touch-friendly interface  
✅ **Installable** - Add to home screen like a native app  
✅ **Secure** - Class-based access codes  
✅ **Fast** - Lightweight and responsive

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Important:** Use the same Supabase credentials as your main GMCT management system.

### 3. Run Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3001`

### 4. Build for Production

```bash
npm run build
```

The production build will be in the `dist` folder.

## Installation on Mobile

### iOS (iPhone/iPad)

1. Open the app in Safari
2. Tap the Share button (box with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

### Android

1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen"
4. Tap "Add" to confirm

## Usage

### For Class Leaders

1. **Login**
   - Enter your class access code (e.g., "alpha" for Class 1)
   - Or use simple format: "class1", "class2", etc.

2. **Mark Attendance**
   - Select the date (defaults to today)
   - Tap status for each member:
     - **Present** - Member is present
     - **Absent** - Member is absent
     - **Sick** - Member is sick
     - **Travel** - Member is traveling

3. **Save**
   - Tap "Save Attendance" button at the bottom
   - Works offline! Data syncs automatically when back online

4. **Logout**
   - Tap "Logout" button in the header

### Offline Mode

- ✅ All member data is cached locally
- ✅ Attendance is saved to local database
- ✅ Auto-syncs when internet connection is restored
- ⚠️ First time use requires internet to download member list

## Database Schema

The app uses the same Supabase database as the main GMCT management system:

### Tables Used

- `app_settings` - For class access codes
- `members` - For class member information
- `attendance` - For attendance records

## Development

### Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Supabase** - Backend/database
- **Dexie** - IndexedDB wrapper for offline storage
- **Vite PWA Plugin** - Progressive Web App support

### Project Structure

```
src/
├── components/
│   ├── Login.tsx              # Login screen
│   ├── AttendanceMarking.tsx  # Main attendance interface
│   └── SyncManager.tsx        # Background sync handler
├── App.tsx                    # Main app component
├── main.tsx                   # Entry point
├── supabase.ts                # Supabase client & API
├── db.ts                      # Offline database (Dexie)
├── types.ts                   # TypeScript types
└── index.css                  # Global styles
```

## Deployment

### Option 1: Vercel

```bash
npm install -g vercel
vercel --prod
```

### Option 2: Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Option 3: GitHub Pages

Add to `vite.config.ts`:

```ts
export default defineConfig({
  base: '/gmct-attendance-mobile/',
  // ... rest of config
})
```

Then deploy:

```bash
npm run build
# Upload dist folder to GitHub Pages
```

## Troubleshooting

### App won't install

- Make sure you're using HTTPS (not HTTP)
- Clear browser cache and try again
- Check that manifest.json is being served correctly

### Data not syncing

- Check internet connection
- Open browser console for error messages
- Verify Supabase credentials are correct

### Members not loading

- Ensure you have internet connection on first use
- Check that class number matches your setup
- Verify access code is correct

## Support

For issues or questions, contact your system administrator.

## License

© 2026 GMCT. All rights reserved.
