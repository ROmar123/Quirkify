# Quirkify — Brand & Visual System

This is the **canonical visual reference** for the rewrite. The user wants the same app layout and look and feel as the current site. Rebuild against this note — not the current code, which gets deleted.

The current visuals aren't perfect, so small refinements during the rebuild are fine, but the overall look, palette, typography, motion, and layout patterns must match.

---

## Logo

- Source file: `public/logo.png` — **preserve verbatim through the delete**
- Also preserve: `public/icons/`, `public/manifest.json`, `public/placeholder-product.png`, `public/sw.js`

---

## Fonts

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700&display=swap');
```

- `--font-sans: "Inter", "Nunito", ui-sans-serif, system-ui, sans-serif;`
- `--font-display: "Nunito", sans-serif;` — used on headlines, product names, banner titles. Slight negative letter-spacing (`-0.02em`) on display text.

---

## Color palette (`@theme` tokens)

| Token | Hex | Usage |
|---|---|---|
| `--color-quirky` | `#A855F7` | Primary purple — buttons, accents |
| `--color-pink` | `#F472B6` | Pink in primary gradient |
| `--color-yellow` | `#FBBF24` | Stars, highlights |
| `--color-green` | `#4ADE80` | Success, "added" confirmation |
| `--color-blue` | `#60A5FA` | Info accents |
| `--color-orange` | `#FB923C` | Campaign banners |
| `--color-hot` | `#F43F5E` | Sale, hot |
| `--color-cyber` | `#A3E635` | Live/cyber accent |
| `--color-bg` | `#FAFAFA` | Page background |
| `--color-surface` | `#FFFFFF` | Cards |
| `--color-text` | `#0F0F0F` | Body text |
| `--color-muted` | `#6B7280` | Secondary text |
| `--color-border` | `#E5E7EB` | Default borders |

## Foreground/background scale (`:root`)

```
--fg:  #0F0F0F   --fg1: #111827   --fg2: #374151   --fg3: #6B7280   --fg4: #9CA3AF   --fg5: #D1D5DB
--bg:           #FAFAFA
--bg-surface:   #FFFFFF
--bg-soft:      #F9FAFB
--bg-lavender:  #FDF4FF
--bg-lavender-2:#F5F3FF
--bg-dark:      #0F0F0F
--border:        #E5E7EB
--border-soft:   #F3F4F6
--border-purple: #E9D5FF
```

## Gradients (the brand identity)

```css
--gradient-primary: linear-gradient(135deg, #F472B6 0%, #A855F7 100%);   /* pink → purple, the signature */
--gradient-deep:    linear-gradient(135deg, #1e1b4b 0%, #4c1d95 55%, #db2777 100%);   /* hero/profile banner */
--gradient-soft:    linear-gradient(135deg, #fdf4ff 0%, #f0e7ff 100%);   /* subtle backgrounds */
--gradient-warm:    linear-gradient(135deg, #fb923c 0%, #f43f5e 100%);   /* campaign banners */
--gradient-cool:    linear-gradient(135deg, #60a5fa 0%, #a855f7 100%);
--gradient-success: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%);
```

## Rarity gradients (collectibles UX)

```css
--rarity-unique-grad:    linear-gradient(135deg, #F59E0B, #EF4444);   /* gold → red */
--rarity-superrare-grad: linear-gradient(135deg, #F472B6, #A855F7);   /* pink → purple */
--rarity-rare-grad:      linear-gradient(135deg, #A855F7, #6366F1);   /* purple → indigo */
--rarity-limited-grad:   linear-gradient(135deg, #60A5FA, #A855F7);   /* blue → purple */
--rarity-common-grad:    linear-gradient(135deg, #E0D2FF, #C4B5FD);   /* lavender (text: #4C1D95) */
```

---

## Radii

```
--radius-sm: 8px    --radius-md: 12px   --radius-lg: 16px
--radius-xl: 20px   --radius-2xl: 24px  --radius-full: 9999px
```

Cards use `rounded-2xl` (24px), product cards specifically `border-radius: 20px` (the `card-product` class). Buttons and pills are `rounded-full`. Hero/empty states use `rounded-3xl`.

## Shadows

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04);
--shadow-xl: 0 16px 40px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06);

--shadow-quirky-sm: 0 4px 16px rgba(168,85,247,0.15);
--shadow-quirky-md: 0 8px 32px rgba(168,85,247,0.20);
--shadow-quirky-lg: 0 16px 48px rgba(168,85,247,0.25);
```

The "quirky" shadow tier (purple-tinted) is for elevated brand surfaces like the primary CTA hover state.

---

## Component classes (rebuild verbatim)

### Buttons

```css
.btn-primary {
  @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-white text-sm transition-all duration-200 select-none;
  background: var(--gradient-primary);
  box-shadow: 0 2px 8px rgba(168,85,247,0.30);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(168,85,247,0.40); }
.btn-primary:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(168,85,247,0.30); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

.btn-secondary {
  @apply inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm border transition-all duration-200 select-none;
  color: #6d28d9; border-color: #ddd6fe; background: white;
}
.btn-secondary:hover { background: #faf5ff; border-color: #a78bfa; transform: translateY(-1px); }

.btn-ghost {
  @apply inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-150 select-none;
  color: #6b7280;
}
.btn-ghost:hover { background: #f3f4f6; color: #111827; }
```

### Cards

```css
.card {
  @apply bg-white rounded-2xl border transition-all duration-200;
  border-color: #e5e7eb;
  box-shadow: var(--shadow-sm);
}
.card:hover { box-shadow: var(--shadow-md); border-color: #d1d5db; }

.card-product {
  @apply bg-white overflow-hidden transition-all duration-300;
  border-radius: 20px;
  border: 1px solid #f0e7ff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.card-product:hover {
  box-shadow: 0 12px 32px rgba(168,85,247,0.12);
  transform: translateY(-4px);
  border-color: #e0d2ff;
}

.admin-card {
  @apply bg-white rounded-2xl border p-5;
  border-color: #e5e7eb;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  transition: box-shadow 0.2s;
}
.admin-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
```

### Badges

```css
.badge { @apply inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium; }
.badge-primary { background: #faf5ff; color: #7c3aed; border: 1px solid #e9d5ff; }
.badge-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
.badge-warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
.badge-danger  { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

.badge-rarity-unique    { background: var(--rarity-unique-grad);    color: #fff; font-weight: 700; }
.badge-rarity-superrare { background: var(--rarity-superrare-grad); color: #fff; font-weight: 700; }
.badge-rarity-rare      { background: var(--rarity-rare-grad);      color: #fff; font-weight: 700; }
.badge-rarity-limited   { background: var(--rarity-limited-grad);   color: #fff; font-weight: 700; }
.badge-rarity-common    { background: var(--rarity-common-grad);    color: #4C1D95; font-weight: 700; }
```

### Inputs

```css
.input {
  @apply w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 focus:outline-none;
  background: #f9fafb; border: 1.5px solid #e5e7eb; color: #111827;
}
.input:focus { background: white; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.12); }
.input::placeholder { color: #9ca3af; }
.input-error { border-color: #fca5a5; background: #fef2f2; }
.input-error:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.10); }
```

### Filter pills (storefront filters)

```css
.filter-pill {
  @apply inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer select-none;
  background: white; border: 1.5px solid #e5e7eb; color: #4b5563;
}
.filter-pill:hover { border-color: #c4b5fd; color: #7c3aed; background: #faf5ff; }
.filter-pill.active {
  background: var(--gradient-primary);
  border-color: transparent; color: white;
  box-shadow: 0 4px 12px rgba(168,85,247,0.30);
}
```

### Gradient text

```css
.gradient-text { background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.gradient-text-deep { background: var(--gradient-deep); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.gradient-text-warm { background: var(--gradient-warm); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
```

### Hero / page background

```css
.hero-bg {
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(168,85,247,0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 40%, rgba(244,114,182,0.08) 0%, transparent 50%),
    #FAFAFA;
}
```

### Glass surface

```css
.glass {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
}
```

### Noise overlay

```css
.noise::after {
  content: ''; position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none; border-radius: inherit;
}
```

### Stat chips

```css
.stat-chip {
  display: flex; flex-direction: column; gap: 2px;
  padding: 12px 16px; background: white;
  border: 1px solid #f0e7ff; border-radius: 16px;
  box-shadow: 0 1px 4px rgba(168,85,247,0.08);
}
.stat-chip-label { font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; }
.stat-chip-value { font-size: 22px; font-weight: 800; color: #111827; line-height: 1.1; letter-spacing: -0.02em; }
```

### Progress bar

```css
.progress-bar { height: 6px; border-radius: 9999px; background: #f3f4f6; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 9999px; background: var(--gradient-primary); transition: width 0.8s cubic-bezier(0.16,1,0.3,1); }
```

### Section label

```css
.section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #9ca3af; }
```

### Toasts

```css
.toast { @apply flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium; box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
.toast-success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.toast-error   { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.toast-info    { background: #faf5ff; color: #6d28d9; border: 1px solid #e9d5ff; }
```

### Skeleton (loading)

```css
.skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: 12px;
}
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
```

### Live indicator

```css
.live-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #ef4444;
  box-shadow: 0 0 0 0 rgba(239,68,68,0.4);
  animation: live-pulse 1.5s ease-out infinite;
}
@keyframes live-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
  70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
```

---

## Animations (keyframes)

```css
@keyframes marquee     { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
@keyframes pulse-glow  { 0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 0 0 rgba(168,85,247,0); } 50% { opacity:0.9; transform:scale(1.03); box-shadow:0 0 16px 4px rgba(168,85,247,0.25); } }
@keyframes float       { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
@keyframes count-up    { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes slide-in-up { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
@keyframes fade-in     { from { opacity:0; } to { opacity:1; } }
@keyframes fadeInUp    { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
```

Class wrappers: `.animate-marquee` (30s linear infinite), `.animate-pulse-glow` (2.4s ease-in-out infinite), `.animate-float` (3s ease-in-out infinite), `.animate-count-up`, `.animate-slide-in-up`, `.animate-fade-in`, `.fade-in-up` (0.4s cubic-bezier(0.16,1,0.3,1)).

## Motion (react `motion/`) timings

- Standard ease: `[0.16, 1, 0.3, 1]` (the "quirky" easing used app-wide)
- Standard durations: 0.4s for cards, 0.45s for product cards, 0.55s for hero
- Stagger: `delay: Math.min(idx * 0.05, 0.4)` for grid entries
- Tap feedback: `whileTap={{ scale: 0.85 }}` on icon buttons, `0.9` on larger buttons
- Hover lift: `transform: translateY(-1px)` on buttons, `translateY(-4px)` on product cards

---

## Layout patterns to keep

### Storefront page (`StoreFront.tsx`)

Vertical sequence inside `max-w-7xl mx-auto px-4 pt-6 pb-24`:
1. **Hero** — `gradient-deep` background with three radial decorative blobs, "Quirkify Store" pill, headline with gradient on accent word, sublead, stats pills (products / on-sale / live), two CTAs ("Shop Now" white pill + "Live Auctions" glass pill), trust pills column on desktop right.
2. **Campaign banners** — orange→red gradient blocks with megaphone watermark, headline + subline + CTA pill.
3. **New Arrivals strip** — horizontal scroll, 40px-wide square cards with discount % badges.
4. **Active campaign banner** — same orange/red treatment with discount % chip on the right.
5. **Search + filter pills** — search input with icon, condition filters row (All / On Sale / New / Pre-owned), category filters row.
6. **Product grid** — 2 cols mobile / 2 sm / 3 md / 4 xl, gap-3.5. `card-product` class, aspect-[3/4] image area, hover-reveal add-to-cart button (move to always-visible on mobile during the rebuild — that's the one polish allowed), badges top-left (rarity, discount %, low stock), wishlist heart top-right.
7. **Mystery Packs** — horizontal scroll, teal gradient strip on top of each card.
8. **AI Recommendations ("Picked for You")** — only renders after 3 product views; 4-col grid.
9. **Trust strip** — 3-column with icons (Shield/Sparkles/Truck) and sublines, gradient strip above.

### Profile / public profile

- Banner: 44-height `gradient-deep` rounded-2xl with `noise` overlay, large `Sparkles` watermark at 5% opacity.
- Avatar: 96px rounded-2xl, white border, overlapping the banner bottom by 40px.
- Name + Level chip + location row beside avatar.
- Sidebar (lg:col-span-1): About card, Stats grid (2x2), Badges card. All `bg-white rounded-2xl border-gray-100 shadow-sm p-5`.
- Main (lg:col-span-2): Public Collection card with 2/3-col grid of `aspect-square` items.

### Product card details (the signature element)

- Outer: `card-product` class
- Image: `aspect-[3/4]`, `object-cover`, `group-hover:scale-105` over 500ms
- Badges (top-left, stacked, gap-1): rarity gradient pill (font 9px, font-bold, rounded-full), discount % red pill, low-stock amber pill
- Wishlist (top-right): 32px circle, white/85 backdrop-blur, opacity-0 → group-hover:opacity-100
- Sold-out overlay: full white/75 backdrop-blur with centered "Sold Out" pill
- Info section: 14px padding, name (13px font-semibold line-clamp-2), condition (10px uppercase tracking-widest, font-semibold, gray-400), price + add-to-cart button row separated by `border-t border-gray-50`
- Price: `tabular-nums` (`stat-number` class), discounted shows strikethrough above + red final, full-price shows `gradient-text`

### Empty states

`text-center py-20 rounded-3xl border border-gray-100 bg-white`, with a 56px rounded-2xl icon container (`bg-gray-50`), then headline + subline + optional CTA. Or for filter empty: `border-2 border-dashed border-gray-100`.

### Admin dashboard

Cards use `admin-card` class (white, rounded-2xl, gray border, soft shadow, p-5).

---

## Accessibility / details

- Focus ring: `2px solid #a855f7`, `outline-offset: 2px`, `border-radius: 6px`
- Tap highlight: disabled (`-webkit-tap-highlight-color: transparent`)
- Tabular numerals on prices, stats, countdowns (`font-feature-settings: "tnum"`)
- Mobile safe-area: `.pb-safe` uses `max(24px, env(safe-area-inset-bottom))`
- Scrollbar: 4px thin, `#D1D5DB` thumb on transparent track
- Smooth scroll behavior on `html`

---

## Iconography

`lucide-react`. Set in current use: `Sparkles, Zap, Package, ShoppingBag, Search, X, Shield, Truck, Heart, Star, ChevronRight, Megaphone, MapPin, Twitter, Instagram, AlertCircle, ArrowLeft`. Keep this library.

---

## What to refine during the rebuild (the "even that isn't perfect" list)

These small imperfections in the current app may be polished without changing the look and feel:
- Product card "add to cart" button is hover-reveal only — make it always visible on mobile (still hover-reveal on desktop).
- Storefront hero has three decorative blobs — consider reducing to two for less visual noise. Keep the same gradient.
- Filter pills overflow horizontally on mobile — that's fine, just ensure scroll padding so the first/last pill isn't clipped.

Everything else in this document is binding for the rebuild.
