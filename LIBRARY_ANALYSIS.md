chec# Espressonism Codebase Library Analysis

**Generated:** April 4, 2026  
**Project Type:** Next.js 14 + TypeScript + React 18 + Supabase

---

## Executive Summary

This analysis provides a comprehensive inventory of all production and development dependencies, external libraries, and built-in APIs used throughout the Espressonism codebase. The project is a modern full-stack React/Next.js application with minimal external dependencies, relying heavily on Next.js and React ecosystem tools.

---

## 1. Production Dependencies

### 1.1 Framework & Runtime

| Package | Version | Purpose | Usage |
|---------|---------|---------|-------|
| **next** | 14.2.5 | React meta-framework for production | Foundation for SSR, routing, API routes, image optimization |
| **react** | 18.3.1 | UI library | Component rendering, hooks (useState, useEffect, useMemo, useRef) |
| **react-dom** | 18.3.1 | React rendering for web | DOM manipulation, hydration |

### 1.2 Backend & Data

| Package | Version | Purpose | Usage |
|---------|---------|---------|-------|
| **@supabase/supabase-js** | ^2.101.1 | PostgreSQL BaaS client | Real-time database queries, authentication, orders/menu management |

**Key Supabase Usage:**
- Order management (CRUD operations)
- Menu items database
- Dashboard admin operations
- Today highlights management
- Today at bar features
- Real-time subscriptions

### 1.3 Utilities

| Package | Version | Purpose | Usage |
|---------|---------|---------|-------|
| **html-to-image** | ^1.11.13 | HTML-to-image conversion | Receipt/order screenshot generation |
| **@vercel/analytics** | ^2.0.1 | Analytics integration | Web vitals and performance monitoring |

---

## 2. Development Dependencies

| Package | Version | Purpose | Usage |
|---------|---------|---------|-------|
| **typescript** | 5.5.3 | Type checking & compilation | Type safety across codebase |
| **@types/node** | 20.14.10 | Node.js type definitions | Server-side code type hints |
| **@types/react** | 18.3.3 | React type definitions | Component and hook type safety |
| **@types/react-dom** | 18.3.0 | React DOM type definitions | DOM element type safety |
| **eslint** | 8.57.0 | Code linting | Code quality and consistency checks |
| **eslint-config-next** | 14.2.5 | Next.js ESLint config | Next.js best practices enforcement |

---

## 3. Built-in Next.js APIs & Modules Used

### 3.1 Next Components & Utilities

| Module | Usage |
|--------|-------|
| **next/image** | Image optimization (Gallery component, Order cards, Admin interface) |
| **next/link** | Client-side navigation |
| **next/navigation** | Router for client-side navigation (`useRouter` hook) |
| **next/script** | Script injection (likely for analytics/tracking) |

### 3.2 Next.js Features Leveraged

- **App Router** (Next.js 14) - File-based routing with `/app` directory
- **React Server Components (RSC)** - Implicit where `"use client"` not specified
- **Client Components** - Explicit `"use client"` directives in interactive pages
- **Static & Dynamic Pages** - Multi-route structure with dynamic rendering
- **Image Optimization** - Remote pattern configuration for Unsplash URLs

---

## 4. React Hooks & APIs

### Core Hooks Used

| Hook | Purpose |
|------|---------|
| `useState` | State management (modals, cart, orders, filters) |
| `useEffect` | Side effects, data fetching, subscriptions |
| `useRef` | DOM references, focus management, modal trapping |
| `useMemo` | Performance optimization (computed values, filtered data) |
| `useCallback` | (Implied in complex components) |

### React Features

- Functional components (ES6+ arrow functions)
- JSX/TSX syntax
- Component composition patterns
- Fragment usage

---

## 5. Browser & Web APIs

### Standard Web APIs (No External Library Required)

| API | Usage |
|-----|-------|
| **Fetch API** | HTTP requests to Supabase |
| **LocalStorage** | Order draft persistence (`espressonism-order-draft-v1` key) |
| **Geolocation API** | (Potentially for delivery features) |
| **Image API** | Dynamic image loading for menu items |
| **DOM APIs** | `querySelectorAll`, `querySelector`, element manipulation |
| **Window API** | `scrollTo`, `scrollY`, `location` |
| **Performance API** | `performance.now()` for smooth scroll animation |
| **FormData API** | Form processing in admin |
| **CSS Animations/Transitions** | Via CSS classes |
| **SVG API** | Inline SVG rendering (mobile menu button) |

---

## 6. Custom Internal Modules

### Utility Functions

| Module | Location | Purpose |
|--------|----------|---------|
| **smoothScroll** | [app/lib/smoothScroll.ts](app/lib/smoothScroll.ts) | Easing function (`easeInOutCubic`) for animated scroll-to-element navigation |
| **supabaseClient** | [supabaseClient.js](supabaseClient.js) | Supabase client initialization and environment variable handling |

### Components Architecture

**Components Barrel Export:** [app/components/index.ts](app/components/index.ts)

**Major Components:**

| Component | File | Purpose |
|-----------|------|---------|
| **Navbar** | UI.tsx | Navigation header |
| **Hero** | Sections.tsx | Landing hero section |
| **Gallery** | Content.tsx | Coffee gallery display |
| **Section** | Sections.tsx | Generic section wrapper |
| **LoyaltyCard** | Sections.tsx | Loyalty program passport card |
| **FeatureGrid** | Sections.tsx | Feature showcase grid |
| **VisitSection** | Sections.tsx | Visit/location section |
| **CategoryTabs** | Order.tsx | Menu category filtering |
| **MenuGrid** | Order.tsx | Menu items display |
| **ModifierModal** | Order.tsx | Size/milk customization |
| **CartModal** | Order.tsx | Shopping cart overlay |
| **OrderTimeline** | Order.tsx | Order status tracker |
| **ReceiptView** | Order.tsx | Order confirmation/receipt |
| **MobileMenuButton** | UI.tsx | Hamburger menu toggle |

---

## 7. Configuration & Environment

### Environment Variables

Consumed from `.env.local` or `.env`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
VITE_SUPABASE_URL (fallback)
VITE_SUPABASE_PUBLISHABLE_KEY (fallback)
VITE_SUPABASE_ANON_KEY (fallback)
```

### Configuration Files

| File | Configuration |
|------|---------------|
| **next.config.mjs** | Image remotePatterns (Unsplash), ReactStrictMode |
| **tsconfig.json** | TypeScript compilation settings |
| **package.json** | Scripts (dev, build, start, lint) |

---

## 8. Build & Deployment Pipeline

### Build Chain

1. **TypeScript Compiler** - Type checking
2. **Next.js Build System** - Bundling, optimization
3. **ESLint** - Code quality verification
4. **Next.js Image Optimizer** - Runtime image optimization

### Scripts

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # Run ESLint checks
```

---

## 9. Data Types & Type System

### Key TypeScript Interfaces

**Order Domain:**
- `MenuItem` - Menu item database schema
- `DashboardOrder` - Admin order view model
- `OrderStatus` - Status enum type ("received", "brewing", "ready", "completed", "cancelled")
- `CartLine` - Shopping cart line item
- `OrderType` - "pickup" | "delivery"
- `PaymentMethod` - "cash" | "gcash"
- `SizeOption` - "regular" | "large"
- `MilkOption` - "whole" | "oat" | "almond"

**Gallery & Content:**
- `GalleryItem` - Title, note, image
- `Testimonial` - Quote content
- `LoyaltyProgram` - Loyalty card configuration

**Admin:**
- `AdminTab` - "orders" | "menu" | "highlights" | "today-bar" | "sales"
- `MenuCategory` - "espresso" | "signature" | "bites"

---

## 10. Database Access Pattern

### Supabase Integration

**JavaScript Module Pattern:**
```javascript
// supabaseClient.js - Not compiled TypeScript
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(url, key);
```

**Usage Pattern:**
```typescript
// @ts-ignore - Supabase client in JS module
import { supabase } from "../../supabaseClient";

// Queries
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('status', 'value');

// Subscriptions
const subscription = supabase
  .channel('orders')
  .on('postgres_changes', { ... }, callback)
  .subscribe();
```

---

## 11. Performance & Optimization

### Optimization Techniques Observed

| Technique | Location | Benefit |
|-----------|----------|---------|
| Image lazy loading | next/image | Only loads visible images |
| Image optimization | next.config.mjs | Remote Unsplash optimization |
| Smooth scroll easing | lib/smoothScroll.ts | Cubic easing function reduces jank |
| useMemo | Order.tsx, Admin page | Prevents expensive recalculations |
| content-visibility CSS | (CSS reference) | Skips off-screen rendering |
| Static image frames | Order cards | Prevents layout shift |
| LocalStorage caching | Order draft | Offline persistence |

---

## 12. Accessibility

### Features Observed

- ARIA labels and roles (loyalty card stamps, modals, menu)
- Semantic HTML (article, figcaption, section, header)
- SVG with aria-hidden for decorative icons
- Focus management in modals
- Keyboard navigation support

---

## 13. Security Considerations

### Public/Anon Access

- Supabase uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` - read-only client access
- Database policies enforce row-level security (Supabase RLS)
- Only public data exposed to frontend

### Build-Time Security

- Environment variables scoped correctly (NEXT_PUBLIC_* for client)
- No hardcoded secrets
- TypeScript prevents type-based vulnerabilities

---

## 14. Missing/Minimal Dependencies

### Notably Absent (Using Native Solutions Instead)

- **No UI component library** (Material-UI, shadcn/ui, etc.) - Custom CSS
- **No CSS framework** - Custom globals.css
- **No form library** (react-hook-form, Formik) - Native HTML forms
- **No HTTP client** - Using Fetch API + Supabase client
- **No state management library** - Using React hooks + Supabase subscriptions
- **No animation library** - Using CSS + native scroll API
- **No date library** - Using native Date object
- **No routing library** - Using Next.js built-in router

---

## 15. Development Workflow

### Code Quality Tools

1. **TypeScript** - Strict type checking
2. **ESLint** - Linting with Next.js config
3. **Next.js Hot Module Replacement** - Fast refresh during dev

### Testing Infrastructure

- **Not configured** - No test framework (Jest, Vitest, etc.)
- **Manual testing** required during development

---

## 16. Browser Compatibility

### Supported Environments

- Modern browsers supporting:
  - ES2020+ JavaScript
  - CSS Grid/Flexbox
  - Fetch API
  - LocalStorage
  - SVG
  - Modern React features

### Next.js Polyfill Support

- Automatic polyfills via Next.js for targeted browser support

---

## 17. Performance Metrics

### Bundle Analysis

**Rough Size Estimates:**
- `next` - ~600KB (framework)
- `react` + `react-dom` - ~200KB combined
- `@supabase/supabase-js` - ~100KB
- Custom code - ~50KB (components + utilities)
- **Estimated prod bundle:** ~200KB (after tree-shake + minify)

---

## 18. Summary: Dependency Graph

```
┌─────────────────────────────────────────┐
│         Espressonism App                │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │    React 18.3.1                  │  │
│  │  (UI Components & Hooks)         │  │
│  └──────────────────────────────────┘  │
│           ▲                             │
│           │                             │
│  ┌────────┴─────────────────────────┐  │
│  │  Next.js 14.2.5                  │  │
│  │ (Routing, SSR, Image Opt, etc)   │  │
│  └────────┬─────────────────────────┘  │
│           │                             │
│      ┌────┴────────────────────────┐   │
│      │                             │   │
│  ┌───▼────────┐          ┌────────▼─┐ │
│  │ Supabase   │          │ Vercel   │ │
│  │ 2.101.1    │          │ Analytics│ │
│  │ (DB)       │          │ 2.0.1    │ │
│  └────────────┘          └──────────┘ │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ Utilities                        │  │
│  │ • html-to-image (1.11.13)        │  │
│  │ • Custom smoothScroll.ts         │  │
│  │ • supabaseClient.js              │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘

TypeScript 5.5.3 (Type Layer) + ESLint + Web APIs
```

---

## 19. Recommendations for Library Maintenance

### Current Health

✅ **Strengths:**
- Minimal dependency footprint reduces maintenance burden
- Using latest stable versions (Next.js 14, React 18)
- No deprecated libraries
- All packages up-to-date as of early 2025

⚠️ **Alerts:**
- TypeScript 5.5.3 may have newer 5.6+ patch versions
- Monitor `@supabase/supabase-js` for breaking changes in major updates
- ESLint 8.x will eventually reach EOL

### Future Considerations

1. **Testing Library** - Consider adding Jest/Vitest + React Testing Library
2. **E2E Testing** - Playwright or Cypress for user workflow testing
3. **Monitoring** - Enhanced error tracking (Sentry)
4. **Observability** - Request logging, performance tracing
5. **Form Validation** - Consider `zod` or `yup` for complex admin forms

---

## Appendix A: File Dependency Map

```
app/
├── page.tsx
│   ├─ next/link
│   ├─ next/image
│   ├─ react (hooks)
│   ├─ next/navigation
│   ├─ next/script
│   ├─ lib/smoothScroll.ts
│   ├─ supabaseClient.js
│   └─ components/*
├── admin/page.tsx
│   ├─ next/image (aliased as NextImage)
│   ├─ react (hooks)
│   └─ supabaseClient.js
├── order/page.tsx
│   ├─ react
│   ├─ lib/smoothScroll.ts
│   ├─ supabaseClient.js
│   └─ components/*
└── components/
    ├── Content.tsx - next/image
    ├── Order.tsx - next/image, react
    ├── UI.tsx - react
    ├── Sections.tsx - (react types)
    └── Layout.tsx

lib/
└── smoothScroll.ts - (native APIs)

supabaseClient.js
└─ @supabase/supabase-js

next.config.mjs - (Next.js config)
tsconfig.json - (TS config)
package.json - (dependencies)
```

---

**End of Analysis**  
For questions about specific library usage, refer to source files or run `npm ls` for dependency tree visualization.
