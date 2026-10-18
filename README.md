# GMCT Connect

A Progressive Web App (PWA) for GMCT members to track contributions and engagement.

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

### For Members and Class Leaders

1. **Login**
   - Enter your member number/ID as username (e.g., `123`)
   - First-time default password is `gmct2026`
   - Change your password after first login

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

### Member Self-Attendance

Run [`sql/2026-09-28_add_member_self_attendance.sql`](sql/2026-09-28_add_member_self_attendance.sql)
in the Supabase SQL Editor to install or update the self-attendance function.
The script can be rerun and preserves existing attendance records and configured
church location settings.

If marking attendance reports `column "is_active" does not exist` (or the same
error for `active`), rerun the corrected script above against the database used
by the app. The function supports either member status column name, giving
`active` precedence when both exist. This is a database-side repair; rebuilding
the app alone will not update the function.

Self-attendance requires an internet connection, a signed-in active member,
and location permission. It is available on Sundays in the configured church
timezone, within the configured attendance radius.

Self-marked attendance appears as **Present (protected)** in the class leader's
Sunday attendance list and edit screen. Leaders can mark other members normally,
but cannot change a self-marked member to Absent, Sick, or Travel. Database
triggers preserve these entries even if a leader submits an older, already-open
screen, and recalculate the class totals from the saved member statuses.

After updating this feature, rerun the entire SQL script above and deploy the
updated app. The SQL adds a self-attendance timestamp and protects identifiable
existing self-attendance entries in records still labelled `Member self-attendance`.
Older entries in leader-labelled records cannot reliably be distinguished from
leader-marked attendance; those members can confirm self-attendance again while
eligible to establish protection.

## Development

Run `npm run test:attendance` for self-attendance regression tests. These use an
isolated in-memory PostgreSQL database, not your live Supabase database, and cover
leader-first/self-first saves, stale leader submissions, protected statuses,
summary totals, schema compatibility, and member list status mapping.

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

Push to `main` to trigger the GitHub Pages deployment workflow. In GitHub
Actions, the build uses `/gmct-attendance-mobile/` for application assets and
PWA scope/start URL. Local and Netlify builds continue to use `/`.

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

### Can't log in

- Make sure username is your member number/ID (not class name)
- Use `gmct2026` for first-time login
- Check internet connection and try again

## Support

For issues or questions, contact your system administrator.

## License

© 2026 GMCT. All rights reserved.
