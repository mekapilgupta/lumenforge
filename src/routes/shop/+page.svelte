<script lang="ts">
  console.log('[BOUNDARY] lx_bN8fQ.js / +page.svelte script loading start');
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { products as staticProducts, PASTEL_COLORS, getProductBySlug, PRODUCT_DEFAULTS } from '$lib/data/products';
  import { fetchProducts, fetchCategories, paiseToRupees, type ProductFilters } from '$lib/api/products';
  import type { SupabaseProduct, Category } from '$lib/types';
  import ProductCard from '$lib/components/product/ProductCard.svelte';

  // ─── State ────────────────────────────────────────────────────────────────
  let dbProducts = $state<SupabaseProduct[]>([]);
  let categories = $state<Category[]>([]);
  let loadingDB = $state(true);

  // Filter state
  let selectedCategory = $state('');
  let selectedColors = $state<string[]>([]);
  let selectedSizes = $state<string[]>([]);
  let selectedBadge = $state('');
  let searchQuery = $state('');
  let sortBy = $state('featured');
  let filtersOpen = $state(false);

  const allSizes = ['35', '36', '37', '38', '39', '40', '41', '42'];
  const allColors = Object.values(PASTEL_COLORS);
  const badges = ['Best Seller', 'Limited Edition', 'New Arrival', 'Sale'];

  // ─── Load from Supabase ───────────────────────────────────────────────────
  async function loadProducts() {
    console.log('[FUNCTION] Entering loadProducts');
    loadingDB = true;
    const filters: ProductFilters = {
      sort: sortBy as ProductFilters['sort'],
    };
    if (selectedCategory) filters.category_slug = selectedCategory;
    if (selectedBadge === 'Best Seller') filters.is_best_seller = true;
    if (selectedBadge === 'New Arrival') filters.is_new_arrival = true;
    if (selectedBadge === 'Limited Edition') filters.is_limited_edition = true;
    if (selectedBadge === 'Sale') filters.is_on_sale = true;
    if (searchQuery) filters.search = searchQuery;

    try {
      console.log('[FUNCTION] loadProducts calling fetchProducts');
      console.log('[TYPE CHECK] typeof fetchProducts:', typeof fetchProducts);
      console.log('[TYPE CHECK] typeof filters:', typeof filters, 'value:', JSON.stringify(filters));
      
      const all = await fetchProducts(filters);
      
      console.log('[TYPE CHECK] typeof fetchProducts return value (all):', typeof all, 'isArray:', Array.isArray(all));
      dbProducts = all;
      console.log('[FUNCTION] loadProducts products successfully loaded. Count:', all.length);
    } catch (err) {
      console.log('[ERROR] in loadProducts:', err);
      console.error('[API] loadProducts failed:', err);
    } finally {
      loadingDB = false;
      console.log('[FUNCTION] Exiting loadProducts');
    }
  }

  // Plain (non-reactive) flag so $effect doesn't re-run because of it
  let _ready = false;

  onMount(async () => {
    console.log('[FUNCTION] Entering shop page onMount');
    try {
      // Read URL params on client
      if (browser) {
        const params = $page.url.searchParams;
        console.log('[FETCH] Request (URL Search Params):', params.toString());
        selectedBadge = params.get('badge') ?? '';
        selectedCategory = params.get('category') ?? '';
        searchQuery = params.get('q') ?? '';
        // Read color from URL (e.g. ?color=SeaGreen from ShopByColor)
        const colorParam = params.get('color');
        console.log('[TYPE CHECK] typeof selectedBadge:', typeof selectedBadge, 'value:', selectedBadge);
        console.log('[TYPE CHECK] typeof selectedCategory:', typeof selectedCategory, 'value:', selectedCategory);
        console.log('[TYPE CHECK] typeof searchQuery:', typeof searchQuery, 'value:', searchQuery);
        
        if (colorParam) {
          console.log('[TYPE CHECK] typeof colorParam:', typeof colorParam, 'value:', colorParam);
          selectedColors = [colorParam];
        }
      }
      _ready = true;
      console.log('[FUNCTION] onMount: Loading initial categories and products');
      console.log('[TYPE CHECK] typeof fetchCategories:', typeof fetchCategories);
      console.log('[TYPE CHECK] typeof loadProducts:', typeof loadProducts);
      
      const [cats] = await Promise.all([fetchCategories(), loadProducts()]);
      
      console.log('[TYPE CHECK] typeof cats:', typeof cats, 'isArray:', Array.isArray(cats));
      categories = cats;
      console.log('[FUNCTION] onMount loaded categories count:', cats?.length ?? 0);
    } catch (err) {
      console.log('[ERROR] in shop page onMount:', err);
      console.error('[API] shop page onMount failed:', err);
    }
    console.log('[FUNCTION] Exiting shop page onMount');
  });

  // Re-load ONLY when the user changes a filter.
  // Do NOT read loadingDB here — that caused an infinite request loop.
  $effect(() => {
    // Explicitly reference each filter so they are tracked dependencies.
    // Reading them here (but NOT loadingDB) is the key fix.
    selectedCategory; selectedBadge; searchQuery; sortBy;
    console.log('[FUNCTION] Entering $effect (filters changed)', {
      selectedCategory,
      selectedBadge,
      searchQuery,
      sortBy
    });
    if (browser && _ready) {
      console.log('[FUNCTION] $effect triggering loadProducts');
      loadProducts();
    }
    console.log('[FUNCTION] Exiting $effect');
  });

  // ─── Client-side color/size filter (applied after DB fetch) ──────────────
  const filteredProducts = $derived.by(() => {
    console.log('[FUNCTION] Entering derived filteredProducts');
    console.log('[TYPE CHECK] typeof dbProducts:', typeof dbProducts, 'isArray:', Array.isArray(dbProducts));
    
    let list = [...dbProducts];
    if (selectedColors.length > 0) {
      console.log('[FUNCTION] Filtering products by selectedColors:', selectedColors);
      list = list.filter((p) =>
        (p.colors ?? []).some((c: { name: string }) => selectedColors.includes(c.name))
      );
    }
    if (selectedSizes.length > 0) {
      console.log('[FUNCTION] Filtering products by selectedSizes:', selectedSizes);
      list = list.filter((p) =>
        (p.sizes ?? []).some((s) => selectedSizes.includes(s))
      );
    }
    console.log('[FUNCTION] derived filteredProducts count:', list.length);
    console.log('[FUNCTION] Exiting derived filteredProducts');
    return list;
  });

  // Fallback: use static data while DB loads
  const displayProducts = $derived(
    loadingDB && dbProducts.length === 0 ? [] : filteredProducts
  );

  function clearFilters() {
    console.log('[FUNCTION] Entering clearFilters');
    selectedCategory = '';
    selectedColors = [];
    selectedSizes = [];
    selectedBadge = '';
    searchQuery = '';
    sortBy = 'featured';
    console.log('[FUNCTION] Exiting clearFilters');
  }

  const hasActiveFilters = $derived(
    selectedCategory !== '' || selectedColors.length > 0 ||
    selectedSizes.length > 0 || selectedBadge !== '' || searchQuery !== ''
  );

  function toggleColor(name: string) {
    console.log('[FUNCTION] Entering toggleColor with color name:', name);
    selectedColors = selectedColors.includes(name)
      ? selectedColors.filter((c) => c !== name)
      : [...selectedColors, name];
    console.log('[FUNCTION] Exiting toggleColor. New selectedColors:', selectedColors);
  }

  function toggleSize(s: string) {
    console.log('[FUNCTION] Entering toggleSize with size:', s);
    selectedSizes = selectedSizes.includes(s)
      ? selectedSizes.filter((x) => x !== s)
      : [...selectedSizes, s];
    console.log('[FUNCTION] Exiting toggleSize. New selectedSizes:', selectedSizes);
  }

  // Convert SupabaseProduct to ProductCard-compatible shape
  function toCardProduct(p: SupabaseProduct) {
    console.log('[FUNCTION] Entering toCardProduct');
    console.log('[TYPE CHECK] typeof p:', typeof p, 'slug:', p?.slug);
    
    try {
      const valOrFallback = (dbVal: string | null | undefined, fallback: string): string => {
        if (dbVal && dbVal.trim()) return dbVal.trim();
        return fallback;
      };

      const highlights = (Array.isArray(p.highlights) && p.highlights.filter(Boolean).length > 0)
        ? p.highlights.filter(Boolean)
        : PRODUCT_DEFAULTS.highlights;

      const cardObj = {
        id: p.id,
        slug: p.slug,
        name: p.name || '',
        tagline: p.tagline || '',
        price: Math.round(p.price / 100),
        originalPrice: p.original_price ? Math.round(p.original_price / 100) : undefined,
        images: (p.images ?? []).map((img: { url: string }) => img.url),
        colors: (p.colors ?? []) as { name: string; hex: string }[],
        sizes: (p.sizes ?? []).map(Number),
        availableSizes: (p.sizes ?? []).map(Number),
        badges: [
          ...(p.is_best_seller ? ['Best Seller' as const] : []),
          ...(p.is_limited_edition ? ['Limited Edition' as const] : []),
          ...(p.is_new_arrival ? ['New Arrival' as const] : []),
          ...(p.original_price ? ['Sale' as const] : []),
        ],
        rating: p.rating_avg ?? 0,
        reviewCount: p.rating_count ?? 0,
        description: valOrFallback(p.description, PRODUCT_DEFAULTS.description),
        highlights,
        details: valOrFallback(p.details, PRODUCT_DEFAULTS.details),
        materials: valOrFallback(p.materials, PRODUCT_DEFAULTS.materials),
        care: valOrFallback(p.care, PRODUCT_DEFAULTS.care),
        shipping: valOrFallback(p.shipping, PRODUCT_DEFAULTS.shipping),
      };
      
      console.log('[TYPE CHECK] typeof cardObj.colors:', typeof cardObj.colors, 'isArray:', Array.isArray(cardObj.colors));
      console.log('[TYPE CHECK] typeof cardObj.sizes:', typeof cardObj.sizes, 'isArray:', Array.isArray(cardObj.sizes));
      console.log('[FUNCTION] Exiting toCardProduct for slug:', p?.slug);
      return cardObj;
    } catch (err) {
      console.log('[ERROR] in toCardProduct:', err);
      throw err;
    }
  }
  console.log('[BOUNDARY] lx_bN8fQ.js / +page.svelte script loading end');
</script>

<svelte:head>
  <title>Shop All Slippers — French Toes</title>
  <meta name="description" content="Browse all French Toes premium women's slippers. Filter by collection, color, size & price. Free shipping on all orders." />
</svelte:head>

<div class="min-h-screen" style="background: var(--color-warm-white);">
  <!-- Page header -->
  <div class="py-10 px-4 text-center" style="background: var(--color-blush);">
    <span class="text-xs font-semibold uppercase tracking-widest" style="color: var(--color-blush-deep);">
      {selectedBadge || selectedCategory || 'All Styles'}
    </span>
    <h1 class="font-display text-3xl md:text-4xl font-bold mt-1" style="color: var(--color-text-dark);">
      {selectedBadge === 'Sale' ? 'Blossom Summer Sale' : selectedCategory ? categories.find(c => c.slug === selectedCategory)?.name ?? selectedCategory : 'Shop All Slippers'}
    </h1>
    <p class="text-sm mt-2" style="color: var(--color-text-mid);">
      {loadingDB ? 'Loading...' : `${filteredProducts.length} styles — breathable, premium & made for Indian summers`}
    </p>

    <!-- Search bar -->
    <div class="mt-4 max-w-sm mx-auto">
      <input
        type="search"
        placeholder="Search slippers..."
        bind:value={searchQuery}
        class="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
        style="border-color: var(--color-blush-deep); background: white; color: var(--color-text-dark);"
      />
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Top bar -->
    <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <div class="flex items-center gap-3 flex-wrap">
        <button
          onclick={() => filtersOpen = !filtersOpen}
          class="md:hidden flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium"
          style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
          aria-expanded={filtersOpen}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
          Filters {hasActiveFilters ? '•' : ''}
        </button>

        <!-- Active filter chips -->
        {#if hasActiveFilters}
          <div class="flex flex-wrap gap-2">
            {#if selectedBadge}
              <span class="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium" style="background: var(--color-lavender); color: var(--color-text-dark);">
                {selectedBadge}
                <button onclick={() => selectedBadge = ''} aria-label="Remove filter">✕</button>
              </span>
            {/if}
            {#if selectedCategory}
              <span class="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium" style="background: var(--color-blush); color: var(--color-text-dark);">
                {categories.find(c => c.slug === selectedCategory)?.name ?? selectedCategory}
                <button onclick={() => selectedCategory = ''} aria-label="Remove filter">✕</button>
              </span>
            {/if}
            <button onclick={clearFilters} class="text-xs underline" style="color: var(--color-blush-deep);">Clear all</button>
          </div>
        {/if}
      </div>

      <!-- Sort -->
      <select
        bind:value={sortBy}
        class="px-3 py-2 rounded-xl border text-sm outline-none"
        style="border-color: var(--color-blush); color: var(--color-text-dark); background: white;"
        aria-label="Sort products"
      >
        <option value="featured">Featured</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="rating">Top Rated</option>
        <option value="newest">Newest First</option>
      </select>
    </div>

    <div class="flex gap-8">
      <!-- Sidebar filters (desktop) -->
      <aside class="hidden md:block w-56 shrink-0" aria-label="Product filters">
        <div class="sticky top-24 flex flex-col gap-6">
          <!-- Categories -->
          {#if categories.length > 0}
            <div>
              <h3 class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Category</h3>
              <div class="flex flex-col gap-2">
                {#each categories as cat}
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="cat" value={cat.slug} checked={selectedCategory === cat.slug} onchange={() => selectedCategory = selectedCategory === cat.slug ? '' : cat.slug} class="accent-pink-400" />
                    <span class="text-sm" style="color: var(--color-text-mid);">{cat.name}</span>
                  </label>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Badges -->
          <div>
            <h3 class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Filter By</h3>
            <div class="flex flex-col gap-2">
              {#each badges as badge}
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedBadge === badge} onchange={() => selectedBadge = selectedBadge === badge ? '' : badge} class="accent-pink-400" />
                  <span class="text-sm" style="color: var(--color-text-mid);">{badge}</span>
                </label>
              {/each}
            </div>
          </div>

          <!-- Colors -->
          <div>
            <h3 class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Color</h3>
            <div class="flex flex-wrap gap-2">
              {#each allColors as color}
                <button
                  onclick={() => toggleColor(color.name)}
                  class="w-7 h-7 rounded-full transition-all hover:scale-110"
                  style="background: {color.hex}; box-shadow: {selectedColors.includes(color.name) ? '0 0 0 2px white, 0 0 0 4px var(--color-blush-deep)' : '0 1px 3px rgba(0,0,0,0.2)'};"
                  title={color.name}
                  aria-label="{color.name}{selectedColors.includes(color.name) ? ' (selected)' : ''}"
                  aria-pressed={selectedColors.includes(color.name)}
                ></button>
              {/each}
            </div>
          </div>

          <!-- Sizes -->
          <div>
            <h3 class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Size</h3>
            <div class="flex flex-wrap gap-2">
              {#each allSizes as size}
                <button
                  onclick={() => toggleSize(size)}
                  class="w-9 h-9 rounded-lg border text-xs font-semibold transition-all"
                  style="border-color: {selectedSizes.includes(size) ? 'var(--color-blush-deep)' : 'rgba(180,100,140,0.25)'}; background: {selectedSizes.includes(size) ? 'var(--color-blush)' : 'white'}; color: {selectedSizes.includes(size) ? 'var(--color-blush-deep)' : 'var(--color-text-mid)'};"
                  aria-pressed={selectedSizes.includes(size)}
                  aria-label="Size {size}"
                >{size}</button>
              {/each}
            </div>
          </div>

          {#if hasActiveFilters}
            <button onclick={clearFilters} class="text-sm underline text-left" style="color: var(--color-blush-deep);">Clear all filters</button>
          {/if}
        </div>
      </aside>

      <!-- Product grid -->
      <main class="flex-1 min-w-0">
        {#if loadingDB}
          <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {#each Array(8) as _}
              <div class="aspect-square rounded-2xl animate-pulse" style="background: var(--color-blush);"></div>
            {/each}
          </div>
        {:else if filteredProducts.length === 0}
          <div class="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <span class="text-5xl">🌸</span>
            <p class="font-display text-xl font-bold" style="color: var(--color-text-dark);">No styles match your filters</p>
            <p class="text-sm" style="color: var(--color-text-soft);">Try adjusting your selections or clear all filters.</p>
            <button onclick={clearFilters} class="btn-primary">Clear Filters</button>
          </div>
        {:else}
          <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {#each filteredProducts as product (product.id)}
              <ProductCard product={toCardProduct(product)} />
            {/each}
          </div>
        {/if}
      </main>
    </div>
  </div>

  <!-- Mobile filters drawer -->
  {#if filtersOpen}
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden border-0 cursor-default"
      onclick={() => filtersOpen = false}
      transition:fade={{ duration: 200 }}
      aria-label="Close filters backdrop"
    ></button>

    <!-- Drawer container -->
    <div
      class="fixed inset-y-0 right-0 max-w-xs w-full bg-white z-50 shadow-2xl p-6 flex flex-col md:hidden"
      transition:fly={{ x: 300, duration: 300 }}
      role="dialog"
      aria-modal="true"
      aria-label="Filter products"
    >
      <div class="flex items-center justify-between pb-4 border-b border-pink-100">
        <h2 class="font-display font-bold text-lg text-neutral-800">Filters</h2>
        <button
          onclick={() => filtersOpen = false}
          class="p-2 -mr-2 text-neutral-500 hover:text-neutral-800"
          aria-label="Close filters drawer"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto py-6 space-y-6">
        <!-- Categories -->
        {#if categories.length > 0}
          <div>
            <h3 class="font-semibold text-sm mb-3 text-neutral-800">Category</h3>
            <div class="flex flex-col gap-2">
              {#each categories as cat}
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mobile-cat"
                    value={cat.slug}
                    checked={selectedCategory === cat.slug}
                    onchange={() => { selectedCategory = selectedCategory === cat.slug ? '' : cat.slug; }}
                    class="accent-pink-400"
                  />
                  <span class="text-sm text-neutral-600">{cat.name}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Badges -->
        <div>
          <h3 class="font-semibold text-sm mb-3 text-neutral-800">Filter By</h3>
          <div class="flex flex-col gap-2">
            {#each badges as badge}
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBadge === badge}
                  onchange={() => { selectedBadge = selectedBadge === badge ? '' : badge; }}
                  class="accent-pink-400"
                />
                <span class="text-sm text-neutral-600">{badge}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- Colors -->
        <div>
          <h3 class="font-semibold text-sm mb-3 text-neutral-800">Color</h3>
          <div class="flex flex-wrap gap-2">
            {#each allColors as color}
              <button
                onclick={() => toggleColor(color.name)}
                class="w-8 h-8 rounded-full transition-all hover:scale-110"
                style="background: {color.hex}; box-shadow: {selectedColors.includes(color.name) ? '0 0 0 2px white, 0 0 0 4px var(--color-blush-deep)' : '0 1px 3px rgba(0,0,0,0.2)'};"
                title={color.name}
                aria-label="{color.name}{selectedColors.includes(color.name) ? ' (selected)' : ''}"
                aria-pressed={selectedColors.includes(color.name)}
              ></button>
            {/each}
          </div>
        </div>

        <!-- Sizes -->
        <div>
          <h3 class="font-semibold text-sm mb-3 text-neutral-800">Size</h3>
          <div class="flex flex-wrap gap-2">
            {#each allSizes as size}
              <button
                onclick={() => toggleSize(size)}
                class="w-10 h-10 rounded-lg border text-xs font-semibold transition-all"
                style="border-color: {selectedSizes.includes(size) ? 'var(--color-blush-deep)' : 'rgba(180,100,140,0.25)'}; background: {selectedSizes.includes(size) ? 'var(--color-blush)' : 'white'}; color: {selectedSizes.includes(size) ? 'var(--color-blush-deep)' : 'var(--color-text-mid)'};"
                aria-label="Size {size}"
                aria-pressed={selectedSizes.includes(size)}
              >{size}</button>
            {/each}
          </div>
        </div>
      </div>

      <div class="pt-4 border-t border-pink-100 flex gap-3">
        <button
          onclick={clearFilters}
          class="btn-outline flex-1 py-2.5 text-sm justify-center"
          disabled={!hasActiveFilters}
        >
          Reset
        </button>
        <button
          onclick={() => filtersOpen = false}
          class="btn-primary flex-1 py-2.5 text-sm justify-center"
        >
          Apply
        </button>
      </div>
    </div>
  {/if}
</div>