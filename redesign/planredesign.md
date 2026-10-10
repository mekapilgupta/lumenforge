# French Toes — Redesign Plan & Notes

**Status:** proposal / awaiting approval. Nothing in the existing SvelteKit app was modified.
**Scope:** visual + structural makeover of the storefront (header → footer), plus a design system, plus a full strip-out of the Navratri/Diwali festive theme.
**Goal:** a year-round, "quiet luxury" women's slippers & flats brand in the spirit of Monrow — soft neutrals, serif headlines, lifestyle photography, product-first grids, generous whitespace.

---

## 1. Ground rules (agreed up front)

1. **Do not disturb anything that already exists.** No existing file was edited, moved or deleted.
2. Everything lives in this new, self-contained folder: **`redesign/`**.
3. Merge into the SvelteKit app **only after explicit approval**.
4. Deliver both a **design** and a **fast-loading layout** — the preview is plain static HTML/CSS/JS with zero runtime dependencies.
5. Free footwear/lifestyle imagery sourced from Pexels/Unsplash, committed locally so nothing hotlinks.

### Why a static folder rather than Svelte components

The brief asked for a design to approve plus fast loading. Building it as static HTML/CSS means:

- the current festive site keeps working untouched while we iterate;
- the reviewer sees the real thing (no build step, no half-migrated components);
- the tokens, section markup and CSS map cleanly onto Svelte components later (§10);
- it doubles as the **performance ceiling** — any Svelte implementation can be measured against it.

---

## 2. How to view it

```bash
# from the repo root
python -m http.server 4321 --bind 127.0.0.1 --directory redesign
# then open http://127.0.0.1:4321/index.html
```

A plain static server is needed (not "open the file") because the page references relative CSS/JS/images.

The existing dev server is untouched; nothing here needs `npm install` or a build.

---

## 3. What was removed (festive → never-again list)

Every item below exists in the current site and is **absent** from `redesign/`:

| Removed | Where it lived |
|---|---|
| Magenta/pink scrolling marquee ("Happy Navratri & Diwali", "Pick Your Garba Pair", diya + star emoji) | `Header.svelte` |
| Emoji-heavy nav incl. a permanent "🪔 Festive Sale" top-level item | `Header.svelte` |
| Pink "Sign In" pill | `Header.svelte` |
| Full-bleed Garba/dancer hero + "Navratri Festive Picks" badge | `HeroSlider.svelte` |
| Circular festive category icons with HOT/NEW/FESTIVE badges | home page |
| "Curated for the Season of Lights", "Garba Night Edit", "Diwali Luxe", "Festive Flash Deals", "Step Into the Celebrations" | home page |
| Gold diya/star overlays, torana SVG, gold geometric borders | home + `Footer.svelte` |
| Maroon/burgundy footer gradient (`#1a0a0a → #2d1005 → #1a0a20`) and "Premium women's footwear crafted for Indian celebrations… Navratri to Diwali" | `Footer.svelte` |
| "Festive Style Guide" footer links | `Footer.svelte` |
| Bright magenta `#D81B60` and gold `#d4a853` design tokens | `app.css` |

Word list now banned from all permanent site copy: *Navratri, Diwali, Garba, Dandiya, festive, celebration, diya, season of lights.*

---

## 4. New design system

Implemented in [assets/css/styles.css](assets/css/styles.css) as CSS custom properties. **These are the same tokens to port into Tailwind v4 `@theme` at merge time.**

### Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | default surface |
| `--cream` | `#F9F6F2` | alternating sections, hero background |
| `--beige` | `#F5F0EB` | third-level surface (brand story) |
| `--bar` | `#111111` | announcement bar |
| `--ink` | `#1A1A1A` | headlines, primary buttons |
| `--ink-soft` | `#3D3D3D` | nav links, body emphasis |
| `--muted` | `#6B6B6B` | body copy |
| `--muted-light` | `#9A9A9A` | meta text, struck-through prices |
| `--blush` | `#E8A0A0` | accent, italic headline word |
| `--blush-deep` | `#D4A5A5` | accent hover, eyebrow rules, feature icons |
| `--blush-tint` | `#FBF3F2` | icon chips, avatar backgrounds |
| `--sale` | `#2E8B7A` | discounts + "verified" only (soft teal, never red) |
| `--star` | `#F5A623` | ratings |
| `--line` | `#E8E4E0` | borders, dividers |

Never used: bright magenta, gold, maroon, festive red.

### Typography

- Headlines / prices-in-serif accents: **Playfair Display** (400, 500, 400-italic).
- Body / UI: **Inter** (400, 500, 600).
- Loaded via Google Fonts with `preconnect` + `display=swap`, with a Georgia/system fallback stack so the page still reads well if fonts fail.
- Display scale uses `clamp()`: `--h-display` ≈ 2.4rem → 4.1rem; `--h-section` ≈ 1.75rem → 2.6rem.

### Spacing, layout, shape

- 8px base unit, exposed as `--s1 … --s12` (8 → 96px).
- Section padding: `--s10` (80px) desktop, `--s8` (64px) mobile — inside the briefed 64–96px range.
- Grid/card gap: 24–32px (`--s3` / `--s4`).
- Content max-width 1360px (`--max`), gutter 24px → 20px on mobile.
- Radius: 14px cards, 6px buttons, pills for badges.
- Shadow: `0 4px 20px rgba(0,0,0,.06)` only; a slightly stronger `--shadow-lift` exists for hover.
- Motion: single `--ease` cubic-bezier; every transition respects `prefers-reduced-motion`.

### Components

Buttons (`--primary` black, `--blush`, `--ghost`, `--quiet`, `--block`), icon buttons with count badges, product cards (image, flags, wishlist heart, quick-add, name, rating, price, swatches), feature cards, category cards, occasion cards, review cards, stat cards, newsletter form, footer columns, FAQ-free help links.

---

## 5. Page structure (top → bottom)

1. **Announcement bar** — flat `#111111`, one row: free shipping · extra 5% prepaid · easy 7-day returns. Static (no marquee), non-seasonal.
2. **Header** — logo left; nav centred: Best Sellers · New Arrivals · **Shop by Category ⌄** · **Shop by Occasion ⌄** · Our Comfort Promise · Support. Right: search, wishlist (badge), sign-in, bag (badge). White, generous spacing, sticky with a soft shadow + hairline border once scrolled.
3. **Hero** — split layout on cream. Eyebrow "Year-round comfort, everyday elegance", serif H1 **"Fashion Loves *Comfort*"** (italic accent in blush), the briefed sub-line, CTAs **Shop Best Sellers** + **New Arrivals**, then a rating/customer proof row. A floating product chip ("The Everyday Flat · Cushioned footbed · 180g per pair") anchors the image.
4. **Value strip** — four trust items: free shipping, 7-day exchanges, secure prepaid checkout, vegan-friendly materials.
5. **Shop & Explore** — six evergreen category cards: Daily Comfort, Elegant Flats, Soft Wedges, Best Sellers, New Arrivals, All Footwear.
6. **Best sellers** — 4-up product grid on cream, with `SAVE 30%` / `BESTSELLER` / `SAVE 25%` flags, ratings + counts, teal sale pricing, colour swatches.
7. **What makes French Toes magic** — four comfort pillars: Cushiony Footbed, Feather-Light, Flexible Sole, Thoughtful Fit.
8. **The sole story / "Softness you can see"** — image-and-copy split covering construction, anti-slip grip, breathable lining, vegan-friendly upper.
9. **Designed for Indian feet — "Comfort science, not guesswork"** — brand-story split (4,000 feet measured, 12-hour wear testing, arch support) on beige, followed by a four-card stat row (50,000+ customers · 4.8/5 · 180g · 7-day).
10. **Shop by occasion** — three lifestyle cards: Everyday & Work, Weekend & Travel, Evening & Occasions.
11. **New arrivals** — second 4-up product grid, `NEW` flags.
12. **Reviews** — three verified customer reviews with city attribution.
13. **Newsletter** — black band, "Get 5% off your first pair". Front-end only; submit is intercepted and explains it's a preview.
14. **Footer** — light cream, four columns: brand blurb + socials, Shop, Help & Policies, About. Bottom row: copyright, legal links, minimal payment badges (UPI/Visa/Mastercard/RuPay/COD).

### Copy used (from the brief's copy bank)

- Hero: "Fashion Loves Comfort" / "Designed for the modern woman who refuses to choose between style and ease."
- CTA: "Shop Best Sellers".
- Features: Cushiony Footbed · Feather-Light · Flexible Sole · Thoughtful Fit.
- Footer blurb: "French Toes creates premium women's slippers and flats that feel as good as they look. Soft, stylish, and made for everyday elegance."

Prices/products are illustrative demo content (matches the current `RAZORPAY_APPROVAL` single-product demo state where `products = []`).

---

## 6. Image sourcing

All images are **downloaded locally** into [assets/img/](assets/img/) — nothing hotlinks, so there are no third-party requests and no licence surprises at runtime. Sources: Pexels (`images.pexels.com`) and Unsplash. The logo is a copy of the existing `static/images/logo-bird-brand.png`.

| File | Used for | Source |
|---|---|---|
| `hero-lifestyle.jpg` | hero | Pexels 8463089 |
| `life-black.jpg` | (spare) | Unsplash INE0dVLh3v4 |
| `life-stone.jpg` | brand story ("designed for Indian feet") | Unsplash 4fDga6d0RSk |
| `cat-table.jpg` | Daily Comfort | Pexels 7320698 |
| `p-ballet-black.jpg` | Elegant Flats | Pexels 26861949 |
| `cat-heels.jpg` | Soft Wedges | Pexels 26796157 |
| `p-flat-trio.jpg` | Best Sellers | Pexels 26861954 |
| `p-flat-black.jpg` | New Arrivals | Pexels 39457488 |
| `cat-sandals.jpg` | All Footwear | Pexels 8989536 |
| `p-flat-black2.jpg` | The Everyday Flat | Pexels 27127377 |
| `p-flat-white.jpg` | The Soft Mule | Pexels 28954916 |
| `p-wedge-tan.jpg` | The Soft Wedge | Pexels 36581188 |
| `p-flat-blush.jpg` | The Rose Ballet | Pexels 5168531 |
| `p-flat-blush2.jpg` | The Blush Bow | Pexels 5168562 |
| `p-flat-pink.jpg` | The Soft Loafer | Pexels 26861953 |
| `hero-wide.jpg` | The Featherweight Flat | Pexels 8463089 (wide crop) |
| `p-onmodel-black.jpg` | The Contour Flat | Pexels 37359481 |
| `cat-closeup.jpg` | sole story | Pexels 10181448 |
| `occ-trench.jpg` / `occ-street.jpg` / `occ-warm.jpg` | occasion cards | Pexels 14330771 / 15019949 / 11159996 |

**Every image is used exactly once** (only the logo repeats, in header and footer) — verified programmatically. Each `<img>` carries real `width`/`height` so the browser reserves space and CLS stays at zero.

Nine downloaded candidates were deliberately **not** used because they were off-brief: leopard-print flats, a bright multicolour woven sandal, beaded "ethnic" close-ups, a bridal/veil-flavoured white slipper shot, newspaper-and-fur textures and a sparkly occasion pair. They remain on disk if a different mix is wanted.

### Image direction notes for a future shoot

> Quiet luxury, soft natural light, modern Indian woman 25–40, refined interiors (wooden doors, stone walls, minimal furniture), neutral/cream/beige palette, focus on the feet and the product, clean white product shots with consistent angle, sole/cushion close-ups for feature sections. Avoid: Garba/folk-dance photography, heavy jewellery, stage lighting, confetti, diyas, watermarks and low-res test images.

Real gaps to shoot: a genuine **cushioned-slipper** hero product on white, a **sole/cushion close-up**, and an on-model shot of a soft **home slipper** (the stock set skews towards flats).

---

## 7. Performance & accessibility decisions

- **Zero runtime dependencies.** No framework, no icon font, no CSS library. `main.js` is ~4 KB and fully optional.
- **Single stylesheet**, one small script, both loaded with a `?v=` cache-busting query.
- **Icons are one inline `<symbol>` sprite** referenced with `<use>`, so the whole icon set costs zero extra requests.
- **Hero** is `preload`ed with `fetchpriority="high"`; **everything below the fold** is `loading="lazy" decoding="async"`.
- Explicit `width`/`height` on every image prevents layout shift.
- Total image payload ≈ 2.6 MB across 21 files (largest single file ~300 KB); the initial viewport only needs the hero.
- Progressive enhancement: with JS disabled the page is complete — the drawer is only engaged below 980px, and the reveal animation falls back to visible.
- Accessibility: skip link, `aria-label`s on all icon buttons, `aria-pressed` on wishlist toggles, `aria-expanded` on the menu and the accordion, `role="img"` + label on star ratings, visible `:focus-visible` rings, and a `prefers-reduced-motion` branch.

### Two real bugs found and fixed during review

1. **Horizontal overflow on phones.** The `<nav>` wrapper stayed a zero-width flex item and still consumed a 40px gap, while five header icon buttons could not shrink — the page measured 493px wide at a 390px viewport.
2. **`backdrop-filter` on the header** turned the fixed mobile drawer into a *header-anchored* box: it was squashed to 62px tall and pushed the document to 710px wide. The blur is now desktop-only, with a solid white header on small screens.

Re-verified after the fixes at 360 / 390 / 480 / 768 / 1024 / 1200 / 1440 px: `scrollWidth == clientWidth` at every width (**no horizontal scrolling**), and the drawer measures 335 × full-viewport when open, fully off-screen when closed.

---

## 8. Responsive behaviour

| Breakpoint | Change |
|---|---|
| ≥ 1181px | full inline nav, 4-up product grids, 6-up category row, 4-up feature and stat rows |
| ≤ 1180px | tighter nav gap, 3-up categories, 2-up products/features/stats, 2-column footer |
| ≤ 980px | nav becomes an off-canvas right drawer with a scrim + accordion sub-menus; hero stacks (image first); splits stack; occasions and reviews go single column; newsletter stacks; value strip 2-up; **header loses its blur** |
| ≤ 720px | compact 62px header (account button hidden, smaller logo, tagline hidden), single-column products/features/stats/footer, 2-up categories, full-width hero CTAs, stacked newsletter form |

---

## 9. Verification performed

- Rendered and visually reviewed at 1440px (full page, section by section) and at 390px inside a 390px iframe viewport.
- Programmatic checks: no broken images (22/22 load, 0 failures), no duplicate content images, no horizontal overflow at seven widths, drawer open/closed geometry, focus moves into the drawer on open, `body` scroll locks while open.
- Confirmed `git status` shows **only additions under `redesign/`** — no existing file touched.

---

## 10. Merge plan (only after approval)

1. **Tokens** — lift §4 colour/type/spacing variables into `app.css` (`@theme` for Tailwind v4) and delete `--color-brand-magenta` / the gold tokens.
2. **Fonts** — swap `app.html` font links to Playfair Display + Inter.
3. **Components** — port the sections in priority order: `Header` → `Hero` → `ProductCard` → `CategoryRow` → `FeatureGrid` → `Footer`; each maps 1:1 to a section here.
4. **Delete, don't patch** — remove the festive components (`CategoryStories`, `SaleBanner`, `FestiveFeatureGrid`, `FestivePicksSection`, `FestiveOccasionGuide`, `ShopByColor`, `FestiveCustomerReviews`) rather than rewiring them, and drop the festive CTA block from `+page.svelte`.
5. **Images** — move `redesign/assets/img/*` into `static/images/` under a `brand/` prefix, then delete the old festive imagery.
6. **Products** — reintroduce real catalogue data (the demo has `products = []`); the card markup already accommodates rating counts, sale pricing, swatches and flags.
7. **Re-verify** — Lighthouse, then a final pass at 360 / 768 / 1440 to confirm parity with this preview.

---

## 11. Open questions for you

- Confirm the **blush accent (`#E8A0A0`) vs. the existing pink logo leaf** — should the logo mark be recoloured to match, or left as-is?
- Do you want the **mobile drawer** to stay right-side (current) or move to a full-screen panel?
- Is **`Our Comfort Promise`** the right name for the brand-story destination, or does that live under "About" with the nav entry freed for something else?
- Real **product/catalogue ties**: the current demo has no products, so all names and prices here are placeholders for layout purposes only.
