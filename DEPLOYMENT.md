# SEISMO PH — Vercel Deployment Guide

This guide walks you through deploying SEISMO PH to Vercel step by step.

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free tier works)
- The GitHub repository: `https://github.com/Rowelkali/seismoph`
- Your Supabase database connection string (already set up)

## Step 1: Import the project to Vercel

1. Go to **[vercel.com](https://vercel.com)** → log in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Find `Rowelkali/seismoph` in the repository list → click **"Import"**

## Step 2: Configure the project

On the "Configure Project" page:

### Framework Preset
- Vercel should auto-detect **Next.js** — if not, select it manually

### Root Directory
- Leave as `./` (default)

### Build & Output Settings
- **Build Command:** `bun run build` (or `npm run build`)
- **Output Directory:** leave default (`.next`)
- **Install Command:** `bun install` (or `npm install`)

### Environment Variables
**This is critical.** Add these environment variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.otnkqsmoggtorgvazcip:Kalilinux%40101@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` |

> **Note:** The `DATABASE_URL` must include `?pgbouncer=true&connection_limit=1` at the end for Supabase's connection pooler to work with Prisma.

## Step 3: Deploy

1. Click **"Deploy"**
2. Wait 2–5 minutes for the build to complete
3. Vercel will give you a URL like `seismoph-xxx.vercel.app`
4. Click the URL to view your live site!

## Step 4: Set up a custom domain (optional)

1. In your Vercel dashboard → **Settings** → **Domains**
2. Add your domain (e.g. `seismoph.ph`)
3. Follow the DNS configuration instructions (add a CNAME record)
4. Vercel automatically provisions SSL certificates

## Step 5: Verify the deployment

After deployment, check these:

- [ ] The homepage loads with the 3D map
- [ ] The sidebar shows recent earthquakes (from Supabase)
- [ ] The TopBar shows "LIVE" and "PHIVOLCS: HEALTHY"
- [ ] Clicking an earthquake opens the detail panel
- [ ] The map shows earthquake markers
- [ ] `/api/health` returns `{"status":"alive"}`
- [ ] `/api/health/ready` returns `{"status":"ready"}`

## How the realtime data works on Vercel

SEISMO PH uses an **embedded poller** that runs inside the Next.js server. On Vercel:

- The `/api/earthquakes/recent` endpoint checks if the PHIVOLCS source data is stale (>90s old)
- If stale, it fetches new bulletins from `earthquake.phivolcs.dost.gov.ph` before responding
- The frontend auto-refreshes every 30 seconds via React Query
- This means data stays fresh without a separate WebSocket service

> **Note:** Vercel's serverless functions have a 10–60 second timeout (depending on plan).
> The PHIVOLCS poll takes ~3–5 seconds, so it fits within the limit.

## Troubleshooting

### Build fails with Prisma error
- Ensure `DATABASE_URL` is set in Vercel environment variables
- Ensure it includes `?pgbouncer=true&connection_limit=1`

### "Can't reach database server"
- Check that the `DATABASE_URL` is correct
- Ensure the password special characters are URL-encoded (`@` → `%40`)

### Map doesn't load
- Check the browser console for errors
- Vercel should serve MapLibre GL JS correctly — no special config needed

### No earthquake data
- Visit `https://your-app.vercel.app/api/health/ready` — it should return `{"status":"ready"}`
- If it returns 503, the database connection failed — check `DATABASE_URL`

### WebSocket doesn't connect
- This is expected on Vercel (serverless doesn't support long-running WebSockets)
- The platform still works — the 30s auto-refetch keeps data fresh
- For instant push notifications, deploy the realtime service separately on Railway/Fly.io

## Post-deployment checklist

- [ ] Set up uptime monitoring (UptimeRobot — free)
- [ ] Set up error tracking (Sentry — free tier)
- [ ] Email DOST-PHIVOLCS (`phivolcs@phivolcs.dost.gov.ph`) about your deployment
- [ ] Test on mobile devices
- [ ] Set up a custom domain
- [ ] Configure Vercel analytics (optional)

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | Supabase PostgreSQL connection string |
| `NODE_TLS_REJECT_UNAUTHORIZED` | ✅ Yes | Set to `0` to accept PHIVOLCS TLS cert |
| `PHIVOLCS_API_URL` | ❌ No | For future official API access |
| `PHIVOLCS_API_KEY` | ❌ No | For future official API access |
| `LOG_LEVEL` | ❌ No | `info` (default), `debug`, `warn`, `error` |
| `RT_POLL_INTERVAL_MS` | ❌ No | `120000` (default, 2 minutes) |
