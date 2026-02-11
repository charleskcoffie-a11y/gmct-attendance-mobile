# Environment Variables & Security Setup Guide

## Overview

This guide explains how to configure environment variables for the GMCT Attendance Mobile App and deploy safely to Netlify while keeping credentials secure.

## Local Development Setup

### 1. Create `.env.local` file

Copy the `.env.example` file and rename it to `.env.local`:

```bash
cp .env.example .env.local
```

### 2. Get Your Supabase Credentials

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon/Public Key** → `VITE_SUPABASE_ANON_KEY`

### 3. Fill in `.env.local`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Verify It Works

```bash
npm run dev
```

If the app loads without errors, your environment variables are configured correctly.

---

## Security Best Practices

### ✅ What IS Safe to Expose

- **Supabase Anon Key** (public)
  - Limited by Row Level Security (RLS) policies
  - Only allows access granted by RLS rules
  - Designed to be in client-side code

### ❌ What Should NEVER Be Public

- **Service Role Key** (secret)
  - Full admin access to database
  - Only for backend servers
  - KEEP IN GITHUB SECRETS OR NETLIFY ONLY

- **Database Password**
- **Master Keys**
- **API Credentials**
- **Signing Keys**

### Verify Security with RLS

Your Supabase tables **must** have Row Level Security policies to prevent unauthorized access:

```sql
-- Example: Only class leaders can see their own class data
CREATE POLICY "class_leaders_own_data"
  ON attendance FOR SELECT
  USING (
    class_number = (
      SELECT class_number FROM class_leaders 
      WHERE id = auth.uid()
    )
  );
```

---

## Git Configuration

### 1. Verify `.gitignore` includes:

```gitignore
# Environment variables - NEVER commit these
.env
.env.local
.env.*.local
.env.production.local
```

### 2. Check current Git status:

```bash
git status
```

Make sure `.env.local` is NOT listed in tracked files.

### 3. If accidentally committed, remove it:

```bash
git rm --cached .env.local
git commit -m "Remove .env.local from tracking"
```

---

## Netlify Deployment

### 1. Connect GitHub Repository

1. Go to [netlify.com](https://netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Select **GitHub** as provider
4. Choose your repository and `Netlifyversioncontrol` branch

### 2. Configure Build Settings

Netlify should auto-detect:
- **Build command:** `npm run build`
- **Publish directory:** `dist`

If not, set them manually in Site settings.

### 3. Add Environment Variables

Go to **Site settings** → **Build & deploy** → **Environment**

Add these variables (Netlify will inject them during build):

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon Key |

⚠️ **Important:** These are only accessible during build time and at runtime in the browser (as intended).

### 4. Understanding Vite Environment Variables

Vite only includes variables prefixed with `VITE_` in the client bundle:

```typescript
// ✅ This WILL be exposed (safe anon key)
const url = import.meta.env.VITE_SUPABASE_URL

// ❌ This will NOT be exposed (backend use only)
const secret = import.meta.env.SECRET_API_KEY
```

---

## Deployment Workflow

### Local Development
```bash
1. .env.local (your machine only)
2. npm run dev
3. Test locally
4. git push
```

### GitHub
```bash
1. Push to Netlifyversioncontrol branch
2. .env.local is NOT committed (blocked by .gitignore)
3. Source code only in repository
```

### Netlify CI/CD
```bash
1. Automatically triggered by GitHub push
2. Uses Netlify environment variables
3. Builds with npm run build
4. Deploys to CDN
5. App is live
```

---

## Troubleshooting

### Problem: App shows "Unresolved VITE_SUPABASE_URL"

**Solution:** Missing environment variables in Netlify

```bash
# Check Netlify environment variables are set
# Settings → Build & deploy → Environment
# Redeploy if recently added
```

### Problem: Console shows 401 Unauthorized

**Solution:** Supabase RLS policies blocking access

```bash
# Check Supabase RLS policies
# Verify the anon key scope is correct
# Ensure your query matches policy conditions
```

### Problem: Cannot connect to Supabase locally

**Solution:** Check .env.local file

```bash
# Verify file exists
ls -la | grep .env

# Check it has correct format
cat .env.local

# Verify VITE_ prefix on variables
```

---

## Environment Variables Reference

### Development (.env.local)
```env
VITE_SUPABASE_URL=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev_anon_key_here
```

### Production (Netlify Dashboard)
```
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod_anon_key_here
```

---

## Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] No `.env` files are committed to Git
- [ ] Environment variables are set in Netlify Dashboard
- [ ] Supabase has RLS policies enabled
- [ ] Anon key is used in client code (not service role key)
- [ ] Service role key is kept secret
- [ ] HTTPS is enforced (via `netlify.toml`)
- [ ] Security headers are configured

---

## Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Supabase Security](https://supabase.com/docs/guides/auth)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
- [RLS Policies Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

## Questions?

Refer to the main README.md or Supabase documentation for more details.
