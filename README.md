# Espressonism

Espressonism is a Next.js + Supabase coffee ordering platform with a polished customer ordering flow and a real-time barista operations dashboard.

The app includes:
- Branded landing page and storytelling sections
- Live menu pulled from Supabase
- Cart, modifiers, checkout, and payment selection
- Real-time order tracking for customers
- PIN-gated barista board with lane-based status actions
- Sales summary (today, week, month)
- Receipt rendering and export
- Browser-based order draft and order history recovery

## Live Routes

- `/` - marketing/landing page
- `/order` - customer ordering and tracking
- `/admin` - barista dashboard

## Core Features

### Customer Experience (`/order`)

- Menu categories with quick-add and customizable drink options
- Line-item modifiers:
  - Size: `regular`, `large`
  - Milk: `whole`, `oat`, `almond`
- Cart and checkout validation:
  - Name and contact required
  - Delivery address required when `order_type = delivery`
  - GCash reference must be exactly 13 digits when `payment_method = gcash`
- Multi-step flow:
  - Cart
  - Payment details
  - Tracking / receipt
- Real-time order status updates via Supabase Realtime subscriptions
- Receipt view + image export (using `html-to-image`)
- Local persistence:
  - Draft cart/checkout state
  - Recent order history for quick reopen/continue

### Barista Dashboard (`/admin`)

- PIN login using `NEXT_PUBLIC_ADMIN_PIN` (fallback: `barista123`)
- Session-only remember-me behavior via `sessionStorage`
- Kanban lanes:
  - New Orders (`received`)
  - Preparing (`preparing` and `brewing` grouped visually)
  - Ready (`ready`)
- Action progression:
  - `received -> brewing`
  - `brewing/preparing -> ready`
  - `ready -> completed`
- Real-time sync of inserts/updates/deletes from the `orders` table
- Completed orders list and revenue summary (today/week/month)

### Data Layer (Supabase)

- `menu_items` table for product catalog
- `orders` table for active orders
- `orders_archive` table for archived pickup orders
- Trigger-based pickup order archiving when status becomes `completed` or `cancelled`
- Generated local timezone helper column (`created_at_gmt8`)
- RLS policies and grants for read/insert/update access behavior

## Tech Stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Supabase JavaScript client v2
- Custom CSS styling
- `html-to-image` for receipt image export

## Repository Structure

```text
app/
  page.tsx               # Landing page
  admin/page.tsx         # Barista dashboard
  order/page.tsx         # Customer order flow
  components/            # Shared UI and order components
  globals.css            # Global styles
schema.sql               # Supabase schema + policies + trigger logic
supabaseClient.js        # Supabase client initialization
next.config.mjs          # Next config (incl. remote image host rules)
```

## Environment Variables

Use `.env.example` as the template.

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, required by webhook status updates)
- `TELEGRAM_BOT_TOKEN` (server-only)
- `TELEGRAM_CHAT_ID` (server-only)

Optional:
- `NEXT_PUBLIC_ADMIN_PIN`

Note: Keep `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` without the `NEXT_PUBLIC_` prefix.

Fallback aliases supported by `supabaseClient.js`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_ANON_KEY`

## Local Development Setup

1. Install dependencies.

```bash
npm install
```

2. Create local env file.

```powershell
Copy-Item .env.example .env.local
```

3. Fill `.env.local` with your Supabase values.

4. Create a Supabase project and run `schema.sql` in the SQL Editor.

5. Start local dev server.

```bash
npm run dev
```

6. Open the app:
- `http://localhost:3000/`
- `http://localhost:3000/order`
- `http://localhost:3000/admin`

## NPM Scripts

- `npm run dev` - start development server
- `npm run lint` - run lint checks
- `npm run build` - production build
- `npm run start` - run production server

## Database Overview

### `menu_items`

- UUID primary key
- `name`, `description`, `base_price`, `image_url`
- Seed data included in `schema.sql`

### `orders`

- UUID primary key
- Customer details, item JSON, total, status, order type, payment details, timestamps
- Key constraints:
  - Status allowed: `received`, `brewing`, `ready`, `completed`, `cancelled`
  - Order type allowed: `pickup`, `delivery`
  - Payment method allowed: `cash`, `gcash`
  - Delivery address required for delivery
  - GCash reference required and must match 13-digit pattern for GCash payments

### `orders_archive`

- Mirror of order fields with `archived_at`
- Trigger copies qualifying pickup orders from `orders` then removes from active table

## Realtime Behavior

- Customer tracker subscribes to updates for the current order ID
- Admin board subscribes to table-level insert/update/delete events
- This provides near-live synchronization between customer tracking and barista actions

## Deployment Guide (Vercel)

This section is the exact flow for deploying `kailaxy/espressonism`.

### 1. Push source code to GitHub

Make sure your latest local commit is pushed to the GitHub repository branch you want Vercel to deploy.

### 2. Import the repository in Vercel

1. Sign in to Vercel.
2. Click `Add New` -> `Project`.
3. Import `kailaxy/espressonism`.

### 3. Configure build settings

- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Install Command: `npm install`
- Output setting: default Next.js output

### 4. Add environment variables in Vercel

In Project Settings -> Environment Variables, set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `NEXT_PUBLIC_ADMIN_PIN` (recommended)

`SUPABASE_SERVICE_ROLE_KEY` is required by the webhook route for Telegram status updates and must remain server-only (do not use `NEXT_PUBLIC_`).

Add these for at least `Production`. If you use Preview deployments, add them for `Preview` as well.

### 5. Confirm Supabase schema is applied

Run `schema.sql` in your target Supabase project before production testing.

### 6. Deploy

Trigger deployment from Vercel (initial deploy or by pushing commits to the connected branch).

### 7. Validate production

1. Open `/` and verify landing page assets load.
2. Place an order at `/order`.
3. Log into `/admin` and move the order across statuses.
4. Confirm customer tracking updates in real time.
5. Confirm completed/cancelled pickup behavior and dashboard totals.

### 8. Optional domain setup

Project Settings -> Domains -> add custom domain and apply DNS records.

## Post-Deployment Checklist

- Correct env vars in Vercel (Production/Preview)
- `schema.sql` applied to the correct Supabase project
- Realtime enabled and receiving events
- RLS and grants active as expected
- Admin PIN changed from default

## Troubleshooting

### Dashboard cannot update order status

- Reapply `schema.sql` and verify update policy/grant for `orders.status`
- Confirm the deployed app points to the intended Supabase project

### Customer tracker does not move statuses

- Verify order row exists in `orders`
- Verify Supabase Realtime is enabled for the table/project

### Vercel build fails

- Check that required env vars are present in Vercel
- Ensure lockfile/dependencies are in sync locally before pushing

## Security Notes

- Admin PIN is client-side convenience and not full authentication.
- For stronger production security, migrate admin access to server-backed auth (for example, Supabase Auth + role checks).

## License

Private/internal project unless a separate license file is added.
