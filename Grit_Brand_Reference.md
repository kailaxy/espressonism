# Brand Reference: Grit Coffee

**Previous Brand Name:** Espressonism
**New Brand Name:** Grit Coffee

This document serves as the absolute source of truth for the Grit Coffee rebrand. Use these guidelines when refactoring UI components, updating CSS, or generating new features.

---

## 1. Brand Identity & Strategy
- **Vision:** To become an anchor for local connection, where specialty coffee sparks stories, friendships, and shared purpose.
- **Personality:** Calm & Grounded, Fast & Reliable, Quietly Encouraging.
- **Key Identifiers:** Real and relatable, community impact-driven, and highly personal.

## 2. Visual Identity & Color Strategy (The "Combined" Approach)
We are shifting away from dark browns into a modern, crisp, app-like palette. Please update our `:root` CSS variables and component styles to reflect this hierarchy:

- **App Backgrounds (`--color-background`):** Soft Slate (`#F4F5F8`) or Pure White (`#FFFFFF`). We want a very clean, high-contrast look.
- **Surfaces/Cards (`--color-paper`):** Pure White (`#FFFFFF`).
- **Primary Elements & CTAs (`--brand-accent`, `--color-primary`, `--color-cta`):** Kyoto Dust (`#5B5F8D`). Used for main buttons, icons, and active states.
- **Typography (`--brand-brown`, `--color-text`):** Charcoal Brew (`#484149`). Used for all headings and body text.
- **Micro-Accents (`--brand-cream`, `--color-secondary`):** Vanilla Foam (`#F1DCBA`). Used *only* sparingly for tiny details (like a "New" badge, a star icon, or subtle hover effects) to retain brand warmth.

## 3. Asset Locations & Typography

### A. Typography: Neue Montreal
- **Location:** The local font files are located in `Espressonism\asset\fonts`.
- **Implementation:** DO NOT use Google Fonts for the primary font. Please configure Next.js `next/font/local` to load "Neue Montreal" and apply it globally to the app.

### B. Logos & Iconography
- **Location:** All brand imagery, including the primary logos and the "Bull Icon," are located in `Espressonism\asset\logo`.
- **Implementation:** When replacing the old "Espressonism" text/logos in the Header, Navigation, or Login screens, point the `next/image` source to this directory. The Bull Icon should be used as the primary logo mark for mobile or constrained spaces.

---

## 4. Implementation Rules for Copilot
1. **Global Rebrand:** Replace all text instances of "Espressonism" with "Grit Coffee" across the codebase (metadata, alt tags, titles, UI copy).
2. **CSS Variables:** Please update the `:root` variables in our global CSS file to match the hex codes in Section 2.
3. **Tailwind Constraint:** DO NOT use Tailwind CSS. Rely entirely on standard custom CSS and the defined CSS variables.
4. **No Emojis:** Rely on clean SVGs or the official brand assets for iconography to maintain a premium, reliable aesthetic.