# Espressonism

Espressonism is a coffee ordering web app built with Next.js and Supabase.

It includes:
- A branded landing page for customers
- A customer ordering flow with real-time status updates
- A barista kanban dashboard with status actions and sales summary
- Receipt export to image
- Local order history recovery for customers who close the page

## Features

### Customer Experience
- Browse menu categories and add drinks to cart
- Multi-step checkout with payment and order-type validation
- Real-time order tracking (`received -> brewing -> ready -> completed`)
- Receipt view with "Save Receipt as Image"
- Local Order History (continue tracking or reopen receipt)

### Barista Dashboard
- PIN-gated dashboard login (`NEXT_PUBLIC_ADMIN_PIN` or fallback)
- Kanban lanes: New Orders, Preparing, Ready
- Action buttons to advance order status
- Realtime sync for inserts/updates/deletes
- Bottom sales summary drawer with:
  - Today sales
  - This week sales
  - This month sales
- Optional Remember Me in browser session (sessionStorage)

### Data + Backend
- Supabase Postgres `orders` and `menu_items`
- RLS policies for menu/order reads and controlled updates
- Pickup order archiving to `orders_archive` for completed/cancelled
- Generated GMT+8 timestamp helpers (`created_at_gmt8`)

## Tech Stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Supabase JS client
- CSS (custom, coffee-themed)
- html-to-image (receipt export)

## Project Structure

- `app/page.tsx`: Landing page
- `app/order/page.tsx`: Customer ordering flow
- `app/admin/page.tsx`: Barista dashboard
- `app/components/*`: Shared UI components
- `app/globals.css`: Global styling
- `schema.sql`: Supabase schema, policies, triggers, archive logic
- `supabaseClient.js`: Supabase client setup

## Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm
- Supabase project
- GitHub account
- Vercel account (for deployment)

## Environment Variables

Create `.env.local` from `.env.example`.

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Optional:
- `NEXT_PUBLIC_ADMIN_PIN` (default fallback in code is `barista123`)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

(Windows PowerShell)

```powershell
Copy-Item .env.example .env.local
```

3. Fill `.env.local` with your Supabase values.

4. Open Supabase SQL Editor and run `schema.sql`.

5. Start dev server:

```bash
npm run dev
```

6. Open:
- `http://localhost:3000/`
- `http://localhost:3000/order`
- `http://localhost:3000/admin`

## NPM Scripts

- `npm run dev`: Start development server
- `npm run lint`: Run lint checks
- `npm run build`: Production build
- `npm run start`: Run production server

## Database Notes

- Active workflow statuses: `received`, `brewing`, `ready`, `completed`, `cancelled`
- Pickup orders with status `completed` or `cancelled` are moved to `orders_archive`
- Realtime status updates are consumed by customer tracker and barista board
- `created_at` is stored as `timestamptz` (UTC internally); `created_at_gmt8` is generated for Asia/Manila display convenience

## Deploying to Vercel (Step-by-Step)

### 1) Push code to GitHub
Push your latest code to this repository.

### 2) Import project in Vercel
1. Go to Vercel dashboard
2. Click **Add New -> Project**
3. Import `kailaxy/espressonism`

### 3) Configure project settings
- Framework preset: **Next.js**
- Build command: `npm run build` (default)
- Output: default Next.js output

### 4) Add Environment Variables in Vercel
In Project Settings -> Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_ADMIN_PIN` (optional but recommended)

Use the same values as local `.env.local`.

### 5) Deploy
Click **Deploy**.

### 6) Apply/verify Supabase schema
If not already applied, run `schema.sql` in Supabase SQL Editor for the target project.

### 7) Validate production behavior
Check:
- Landing page loads
- `/order` can place orders
- `/admin` login works
- Status updates move lanes and sync to `/order`
- Sales drawer totals update as completed orders appear

### 8) (Optional) Add custom domain
In Vercel Project -> Settings -> Domains, add your domain and follow DNS instructions.

## Post-Deploy Checklist

- Env vars are set in Vercel (Production, Preview as needed)
- Supabase URL/key point to correct environment
- RLS policies and grants were applied from `schema.sql`
- Realtime is enabled and updates are observed in dashboard/tracker
- Admin PIN is changed from default

## Troubleshooting

### Orders not updating from dashboard
- Re-run `schema.sql` and verify update policy/grant on `orders.status`
- Confirm Supabase env vars are correct

### Receipt/order history missing after refresh
- Check browser local/session storage settings
- Ensure no strict privacy mode is wiping storage

### Build passes locally but fails on Vercel
- Re-check env vars in Vercel
- Ensure `NEXT_PUBLIC_SUPABASE_*` variables are present in the deployment environment

## Security Notes

- Current admin PIN gate is client-side convenience, not enterprise auth.
- For production hardening, replace with server-side auth (Supabase Auth, NextAuth, or middleware-protected routes).

## License

This project is currently private and intended for internal/team use.
