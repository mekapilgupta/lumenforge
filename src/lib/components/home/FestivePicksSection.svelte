<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchProducts } from '$lib/api/products';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

  // Tabs — fully driven by flags on products in DB
  const TABS = [
    { key: 'festive', label: '🪔 Festive Picks', filter: (p: any) => p.is_best_seller || p.is_featured },
    { key: 'new',     label: '🌸 New Arrivals',  filter: (p: any) => p.is_new_arrival },
    { key: 'all',     label: '✨ All Styles',    filter: () => true },
  ] as const;

  type TabKey = (typeof TABS)[number]['key'];

  let activeTab = $state<TabKey>('festive');
  let dbProducts = $state<any[]>([]);
  let loading = $state(true);

  const MAX_CARDS = 12; // never overflow the grid

  /** Flatten each product × each unique color into individual cards */
  function flattenToColorCards(products: any[], filterFn: (p: any) => boolean) {
    const result: any[] = [];
    for (const p of products) {
      if (!filterFn(p)) continue;
      const rawColors = Array.isArray(p.colors) ? p.colors : [];
      const rawImages = Array.isArray(p.images) ? p.images : [];
      const seen = new Set<string>();

      for (const rawCol of rawColors) {
        const colorObj = typeof rawCol === 'string'
          ? { name: rawCol, hex: '#d4a853', image: undefined }
          : { name: rawCol?.name || 'Default', hex: rawCol?.hex || '#d4a853', image: rawCol?.image };

        const colorKey = colorObj.name.toLowerCase().trim();
        if (seen.has(colorKey)) continue;
        seen.add(colorKey);

        const img = colorObj.image
          || rawImages.find((i: any) => typeof i === 'object' && String(i?.color || '').toLowerCase().trim() === colorKey)?.url
          || rawImages[0]?.url
          || p.thumbnail_url
          || '/placeholder.jpg';

        result.push({
          id: `${p.id}_${colorKey}`,
          productId: p.id,
          name: p.name,
          color: colorObj.name,
          hex: colorObj.hex,
          image: img,
          slug: p.slug,
          price: Math.round((p.price ?? 0) / 100),
          originalPrice: p.original_price ? Math.round(p.original_price / 100) : undefined,
          is_new_arrival: p.is_new_arrival,
          is_best_seller: p.is_best_seller,
          is_limited_edition: p.is_limited_edition,
          badges: [
            ...(p.is_best_seller ? ['Best Seller'] : []),
            ...(p.is_new_arrival ? ['New Arrival'] : []),
            ...(p.is_limited_edition ? ['Limited'] : []),
            ...(p.original_price ? ['Sale'] : []),
          ]
        });
      }
    }
    return result.slice(0, MAX_CARDS);
  }

  const activeCards = $derived.by(() =>
    flattenToColorCards(dbProducts, TABS.find(t => t.key === activeTab)?.filter ?? (() => true))
  );

  // If active tab is empty (e.g. no new arrivals yet), auto-fallback to "all"
  $effect(() => {
    if (!loading && activeCards.length === 0 && activeTab !== 'all') {
      activeTab = 'all';
    }
  });

  onMount(async () => {
    try {
      dbProducts = await fetchProducts();
    } catch (e) {
      console.error('[FestivePicks] fetch error:', e);
    } finally {
      loading = false;
    }
  });

  let addingId = $state<string | null>(null);

  function quickAdd(card: any) {
    uiStore.openQuickSize(
      { id: card.productId, name: card.name, price: card.price, sizes: [36,37,38,39,40,41,42], availableSizes: [36,37,38,39,40,41,42], image: card.image, colorName: card.color },
      (size) => {
        addingId = card.id;
        cartStore.addItem({
          productId: card.productId, slug: card.slug, name: card.name,
          image: card.image, price: card.price, originalPrice: card.originalPrice,
          color: { name: card.color, hex: card.hex }, size: Number(size) || 38, quantity: 1
        });
        uiStore.addToast(`${card.name} (${card.color} · Size ${size}) added! 🛍️`, 'success');
        setTimeout(() => { addingId = null; }, 800);
      }
    );
  }

  const festiveEmojis: Record<string, string> = {
    beige: '🌾', black: '🖤', navy: '🌊', berry: '🫐', pink: '🌸',
    peach: '🍑', lavender: '💜', mint: '🌿', gold: '🪙', coral: '🌺',
    'sea green': '🌊', white: '🤍', red: '❤️', maroon: '🍷', orange: '🧡',
  };
  function colorEmoji(name: string): string {
    const low = name.toLowerCase();
    return Object.entries(festiveEmojis).find(([k]) => low.includes(k))?.[1] ?? '✨';
  }

  function discPct(price: number, orig: number) {
    return Math.round((1 - price / orig) * 100);
  }
</script>

<section class="fp-section relative overflow-hidden" id="festive-picks">
  <!-- Rangoli background watermark -->
  <div class="rangoli-bg" aria-hidden="true">
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      {#each [160,120,80,40] as r, i}
        <circle cx="200" cy="200" r={r} fill="none" stroke-width="1.2"
          stroke={i % 2 === 0 ? 'rgba(212,168,83,0.18)' : 'rgba(192,57,43,0.12)'}/>
      {/each}
      {#each Array(16) as _, i}
        {@const angle = (i * 22.5) * Math.PI / 180}
        <line
          x1={200 + Math.cos(angle) * 42}
          y1={200 + Math.sin(angle) * 42}
          x2={200 + Math.cos(angle) * 158}
          y2={200 + Math.sin(angle) * 158}
          stroke="rgba(212,168,83,0.10)" stroke-width="1"/>
        <circle
          cx={200 + Math.cos(angle) * 155}
          cy={200 + Math.sin(angle) * 155}
          r="4" fill="rgba(212,168,83,0.18)"/>
      {/each}
    </svg>
  </div>

  <!-- Ambient glow blobs -->
  <div class="blob-tl" aria-hidden="true"></div>
  <div class="blob-br" aria-hidden="true"></div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

    <!-- Header -->
    <div class="text-center mb-8">
      <div class="festive-label">🪔 Navratri · Diwali · Festive Season 🪔</div>
      <h2 class="fp-title">Step Into the Celebrations</h2>
      <p class="fp-subtitle">Handpicked styles that shine brightest this festive season. New drops added regularly.</p>
    </div>

    <!-- Tabs -->
    <div class="tab-row" role="tablist">
      {#each TABS as tab}
        <button
          role="tab"
          aria-selected={activeTab === tab.key}
          onclick={() => activeTab = tab.key}
          class="fp-tab"
          class:fp-tab--active={activeTab === tab.key}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Loading skeleton -->
    {#if loading}
      <div class="card-grid">
        {#each Array(8) as _}
          <div class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line"></div>
          </div>
        {/each}
      </div>

    <!-- Empty state -->
    {:else if activeCards.length === 0}
      <div class="empty-state">
        <span class="text-4xl">🪔</span>
        <p>New festive styles arriving soon. Check back shortly!</p>
      </div>

    <!-- Product Grid -->
    {:else}
      <div class="card-grid">
        {#each activeCards as card (card.id)}
          <article class="fp-card group">
            <!-- Shimmer glitter on hover -->
            <div class="card-shimmer" aria-hidden="true"></div>

            <!-- Image + Badges -->
            <a href="/product/{card.slug}" class="card-img-wrap">
              <img src={card.image} alt="{card.name} – {card.color}" class="card-img" loading="lazy" />

              <!-- Badges -->
              <div class="badges">
                {#each card.badges as badge}
                  <span class="badge badge--{badge.toLowerCase().replace(' ', '-')}">{badge}</span>
                {/each}
              </div>

              <!-- Quick Add overlay -->
              <div class="quick-add-wrap">
                <button
                  onclick={(e) => { e.preventDefault(); e.stopPropagation(); quickAdd(card); }}
                  class="quick-add-btn"
                  aria-label="Quick add {card.name} to bag"
                >
                  {addingId === card.id ? '✓ Added!' : '+ Add to Bag'}
                </button>
              </div>
            </a>

            <!-- Info -->
            <div class="card-info">
              <div class="card-name-row">
                <a href="/product/{card.slug}" class="card-name">{card.name}</a>
                <span class="color-pill" style="background: {card.hex};" title={card.color}>
                  {colorEmoji(card.color)}
                </span>
              </div>
              <p class="color-label">{card.color}</p>
              <div class="price-row">
                <span class="price" class:price--sale={!!card.originalPrice}>₹{card.price}</span>
                {#if card.originalPrice}
                  <span class="price-orig">₹{card.originalPrice}</span>
                  <span class="price-save">-{discPct(card.price, card.originalPrice)}%</span>
                {/if}
              </div>
            </div>
          </article>
        {/each}
      </div>

      <!-- View All CTA -->
      <div class="view-all-row">
        <a href="/shop" class="view-all-btn">
          Browse All Styles
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    {/if}

  </div>
</section>

<style>
  .fp-section {
    padding: 5rem 0;
    background: linear-gradient(180deg, #fdf8f0 0%, #fef5e4 50%, #fdf8f0 100%);
    border-bottom: 1px solid rgba(212,168,83,0.2);
  }

  /* Rangoli watermark */
  .rangoli-bg {
    position: absolute;
    right: -80px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
    pointer-events: none;
    user-select: none;
  }

  /* Ambient glows */
  .blob-tl {
    position: absolute; top: -60px; left: -60px;
    width: 320px; height: 320px; border-radius: 50%;
    background: radial-gradient(circle, rgba(212,168,83,0.12), transparent 70%);
    pointer-events: none;
  }
  .blob-br {
    position: absolute; bottom: -60px; right: -60px;
    width: 280px; height: 280px; border-radius: 50%;
    background: radial-gradient(circle, rgba(192,57,43,0.10), transparent 70%);
    pointer-events: none;
  }

  /* Header */
  .festive-label {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #b5621a;
    background: linear-gradient(135deg, #fff3cd, #ffe4a0);
    border: 1px solid rgba(212,168,83,0.4);
    border-radius: 9999px;
    padding: 0.3rem 1.1rem;
    margin-bottom: 0.75rem;
  }
  .fp-title {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.8rem);
    font-weight: 800;
    color: #2d1b2e;
    margin: 0 0 0.5rem;
    line-height: 1.15;
  }
  .fp-subtitle {
    font-size: 0.92rem;
    color: #9e7ca0;
    max-width: 36rem;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* Tabs */
  .tab-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    margin-bottom: 2.5rem;
    margin-top: 1.5rem;
  }
  .fp-tab {
    padding: 0.55rem 1.4rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    border: 1.5px solid rgba(212,168,83,0.4);
    background: white;
    color: #9e7ca0;
    cursor: pointer;
    transition: all 0.25s ease;
  }
  .fp-tab:hover { background: #fff8e6; color: #b5621a; border-color: #d4a853; }
  .fp-tab--active {
    background: linear-gradient(135deg, #d4a853, #e07020);
    color: white;
    border-color: transparent;
    box-shadow: 0 4px 14px rgba(212,168,83,0.35);
  }

  /* Grid */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  @media (min-width: 640px)  { .card-grid { grid-template-columns: repeat(3, 1fr); gap: 1.25rem; } }
  @media (min-width: 1024px) { .card-grid { grid-template-columns: repeat(4, 1fr); gap: 1.5rem; } }

  /* Card */
  .fp-card {
    background: white;
    border-radius: 1.25rem;
    overflow: hidden;
    border: 1px solid rgba(212,168,83,0.15);
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    position: relative;
  }
  .fp-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 16px 40px rgba(212,168,83,0.2);
  }
  .card-shimmer {
    position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.85) 0%, transparent 55%);
    opacity: 0; transition: opacity 0.4s;
    z-index: 1;
  }
  .fp-card:hover .card-shimmer { opacity: 0.08; }

  /* Image */
  .card-img-wrap {
    position: relative;
    display: block;
    overflow: hidden;
    aspect-ratio: 1;
    background: #fdf8f0;
  }
  .card-img {
    width: 100%; height: 100%;
    object-fit: cover;
    transition: transform 0.6s ease;
  }
  .fp-card:hover .card-img { transform: scale(1.06); }

  /* Badges */
  .badges {
    position: absolute; top: 0.6rem; left: 0.6rem;
    display: flex; flex-direction: column; gap: 0.25rem;
    z-index: 2; pointer-events: none;
  }
  .badge {
    font-size: 0.6rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.06em; padding: 0.2rem 0.5rem;
    border-radius: 0.3rem; color: white; line-height: 1.4;
  }
  .badge--best-seller { background: #d4a853; }
  .badge--new-arrival { background: #2e7d32; }
  .badge--limited    { background: #7b1fa2; }
  .badge--sale       { background: #c0392b; }

  /* Quick Add */
  .quick-add-wrap {
    position: absolute; bottom: 0.6rem; left: 0.5rem; right: 0.5rem;
    z-index: 3; opacity: 0; transform: translateY(8px);
    transition: all 0.25s ease;
  }
  .fp-card:hover .quick-add-wrap { opacity: 1; transform: translateY(0); }
  .quick-add-btn {
    width: 100%; padding: 0.6rem;
    background: linear-gradient(135deg, #d4a853, #e07020);
    color: white; font-size: 0.72rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.08em;
    border: none; border-radius: 0.75rem; cursor: pointer;
    transition: filter 0.2s;
  }
  .quick-add-btn:hover { filter: brightness(1.1); }

  /* Info */
  .card-info { padding: 0.8rem 0.9rem 0.9rem; display: flex; flex-direction: column; gap: 0.25rem; }

  .card-name-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
  .card-name {
    font-family: var(--font-display); font-weight: 700;
    font-size: 0.95rem; color: #2d1b2e; text-decoration: none;
    line-height: 1.3; flex: 1; min-width: 0; overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .card-name:hover { color: #d4a853; }

  .color-pill {
    width: 22px; height: 22px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.8);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; flex-shrink: 0;
  }
  .color-label { font-size: 0.7rem; color: #9e7ca0; font-weight: 500; }

  .price-row { display: flex; align-items: baseline; gap: 0.4rem; margin-top: 0.15rem; }
  .price { font-size: 1rem; font-weight: 800; color: #2d1b2e; }
  .price--sale { color: #c0392b; }
  .price-orig { font-size: 0.78rem; text-decoration: line-through; color: #aaa; }
  .price-save { font-size: 0.68rem; font-weight: 700; color: #2e7d32; background: #e8f5e9; padding: 0.1rem 0.35rem; border-radius: 0.3rem; }

  /* Loading skeletons */
  .skeleton-card { background: white; border-radius: 1.25rem; overflow: hidden; border: 1px solid rgba(212,168,83,0.1); }
  .skeleton-img { width: 100%; aspect-ratio: 1; background: linear-gradient(90deg, #f5f0e8 25%, #ede8df 50%, #f5f0e8 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
  .skeleton-line { height: 12px; margin: 0.6rem 0.9rem; border-radius: 6px; background: linear-gradient(90deg, #f5f0e8 25%, #ede8df 50%, #f5f0e8 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
  .skeleton-line.short { width: 55%; height: 10px; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* Empty state */
  .empty-state {
    text-align: center; padding: 4rem 1rem; color: #9e7ca0;
    display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
    font-size: 0.9rem;
  }

  /* View All */
  .view-all-row { text-align: center; margin-top: 2.5rem; }
  .view-all-btn {
    display: inline-flex; align-items: center; gap: 0.5rem;
    padding: 0.8rem 2.2rem; border-radius: 9999px; font-size: 0.88rem; font-weight: 700;
    text-decoration: none; transition: all 0.25s;
    background: linear-gradient(135deg, #d4a853, #e07020);
    color: white;
    box-shadow: 0 4px 16px rgba(212,168,83,0.3);
  }
  .view-all-btn:hover { filter: brightness(1.08); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(212,168,83,0.4); }
</style>
