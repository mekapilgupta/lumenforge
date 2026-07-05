<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { PRODUCT_DEFAULTS } from '$lib/data/products';
  import { fetchProductBySlug, fetchRelatedProducts, fetchApprovedReviews, submitReview, checkVerifiedPurchase, paiseToRupees } from '$lib/api/products';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { wishlistStore } from '$lib/stores/wishlist.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import ColorSwatch from '$lib/components/product/ColorSwatch.svelte';
  import SizeSelector from '$lib/components/product/SizeSelector.svelte';
  import ProductCard from '$lib/components/product/ProductCard.svelte';
  import ProductModal from '$lib/components/product/ProductModal.svelte';
  import type { ColorVariant } from '$lib/types';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import SizeChartModal from '$lib/components/product/SizeChartModal.svelte';

  let isSizeChartOpen = $state(false);

  // Lightbox modal state
  let isLightboxOpen = $state(false);

  // Hover Zoom state
  let zoomStyle = $state('transform-origin: center; transform: scale(1);');

  function handleMouseMove(e: MouseEvent) {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    zoomStyle = `transform-origin: ${x}% ${y}%; transform: scale(1.5);`;
  }

  function handleMouseLeave() {
    zoomStyle = 'transform-origin: center; transform: scale(1);';
  }

  const slug = $derived($page.params.slug ?? '');

  // DB product (loaded on client)
  let dbProduct = $state<any>(null);
  let reviews = $state<any[]>([]);
  let relatedDB = $state<any[]>([]);
  let loadingDB = $state(true);
  let isVerifiedPurchase = $state(false);

  // Resolved product (DB only)
  const product = $derived(dbProduct);

  // Compute related (DB only)
  const relatedProducts = $derived(relatedDB);

  // UI state
  let selectedColor = $state<ColorVariant | null>(null);
  let selectedSize = $state<number | null>(null);
  let quantity = $state(1);
  let activeImage = $state(0);
  let activeTab = $state<'details' | 'materials' | 'care' | 'shipping'>('details');
  let adding = $state(false);
  let sizeError = $state(false);
  let showStickyBar = $state(false);

  // Review form
  let showReviewForm = $state(false);
  let reviewRating = $state(5);
  let reviewTitle = $state('');
  let reviewBody = $state('');
  let reviewSubmitting = $state(false);

  // Pincode checker state
  let pincode = $state('');
  let checkingPincode = $state(false);
  let pincodeChecked = $state(false);
  let serviceabilityResult = $state<{
    serviceable: boolean;
    cod: boolean;
    etd?: string;
    error?: string;
  } | null>(null);

  async function handleCheckPincode() {
    if (!/^\d{6}$/.test(pincode)) {
      serviceabilityResult = { serviceable: false, cod: false, error: 'Please enter a valid 6-digit pincode.' };
      pincodeChecked = true;
      return;
    }

    checkingPincode = true;
    pincodeChecked = false;
    serviceabilityResult = null;

    try {
      const res = await fetch(`/api/serviceability?pincode=${pincode}`);
      if (res.ok) {
        const data = await res.json();
        serviceabilityResult = data;
        if (data.serviceable) {
          localStorage.setItem('user_pincode', pincode);
        }
      } else {
        serviceabilityResult = { serviceable: false, cod: false, error: 'Unable to verify pincode. Please try again.' };
      }
    } catch (err) {
      serviceabilityResult = { serviceable: false, cod: false, error: 'Connection error. Please try again.' };
    } finally {
      checkingPincode = false;
      pincodeChecked = true;
    }
  }

  $effect(() => {
    if (product) {
      const colors = (product.colors ?? []) as ColorVariant[];
      selectedColor = colors[0] ?? null;
      selectedSize = null;
      activeImage = 0;
    }
  });

  onMount(async () => {
    // Sticky bar observer
    if (browser) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          showStickyBar = !entry.isIntersecting;
        },
        { threshold: 0 }
      );
      const ctaSection = document.getElementById('product-cta-section');
      if (ctaSection) observer.observe(ctaSection);
    }

    if (browser) {
      const savedPin = localStorage.getItem('user_pincode');
      if (savedPin && /^\d{6}$/.test(savedPin)) {
        pincode = savedPin;
        setTimeout(handleCheckPincode, 0);
      }
    }

    const dbProd = await fetchProductBySlug(slug);
    if (dbProd) {
      dbProduct = adaptDBProduct(dbProd);
      loadingDB = false;
      const [rels, revsFinal] = await Promise.all([
        fetchRelatedProducts(dbProd.id, dbProd.category_id, 4),
        fetchApprovedReviews(dbProd.id),
      ]);
      relatedDB = rels.map(adaptDBProduct);
      reviews = revsFinal;
      if (authStore.user) {
        isVerifiedPurchase = await checkVerifiedPurchase(authStore.user.id, dbProd.id);
      }
    } else {
      loadingDB = false;
    }
  });

  function adaptDBProduct(p: any) {
    const imgs: string[] = (p.images ?? []).map((img: any) => img.url ?? img);
    
    const valOrFallback = (dbVal: string | null | undefined, fallback: string): string => {
      if (dbVal && dbVal.trim()) return dbVal.trim();
      return fallback;
    };

    const highlights = (Array.isArray(p.highlights) && p.highlights.filter(Boolean).length > 0)
      ? p.highlights.filter(Boolean)
      : PRODUCT_DEFAULTS.highlights;

    return {
      id: p.id,
      slug: p.slug,
      name: p.name || '',
      tagline: p.tagline || '',
      price: Math.round((p.price ?? 0) / 100),
      originalPrice: p.original_price ? Math.round(p.original_price / 100) : undefined,
      images: imgs.length ? imgs : ['/placeholder.jpg'],
      colors: (p.colors ?? []) as ColorVariant[],
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
      stockStatus: p.stock_status,
      stockQuantity: p.stock_quantity,
      variants: p.variants,
      _dbId: p.id,
      _categoryId: p.category_id,
    };
  }

  const isWishlisted = $derived(product ? wishlistStore.has(product.id) : false);
  const salePercent = $derived(
    product?.originalPrice
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : null
  );

  function formatPrice(n: number) {
    return `₹${n.toLocaleString('en-IN')}`;
  }

  function addToCart() {
    if (!product || !selectedColor) return;
    if (!selectedSize) {
      sizeError = true;
      setTimeout(() => sizeError = false, 2000);
      uiStore.addToast('Please select a size', 'error');
      return;
    }
    adding = true;
    
    // Find matching variant from the DB variants list
    const matchedVariant = product.variants?.find((v: any) => 
      String(v.size) === String(selectedSize) && 
      String(v.color).toLowerCase() === selectedColor?.name?.toLowerCase()
    );
    const variantId = matchedVariant?.id || null;

    cartStore.addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      price: product.price,
      originalPrice: product.originalPrice,
      color: selectedColor,
      size: selectedSize,
      quantity,
      variantId
    });
    uiStore.addToast(`${product.name} added to cart 🛍️`, 'success');
    setTimeout(() => { adding = false; }, 1000);
  }

  function toggleWishlist() {
    if (!product) return;
    if (!authStore.user) {
      uiStore.addToast('Please sign in to add items to your wishlist 🌸', 'info');
      goto('/auth?redirect=' + $page.url.pathname);
      return;
    }
    wishlistStore.toggle(product.id);
    uiStore.addToast(
      isWishlisted ? 'Removed from wishlist' : `${product.name} added to wishlist`,
      isWishlisted ? 'info' : 'success'
    );
  }

  async function handleReviewSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!authStore.user || !dbProduct) return;
    reviewSubmitting = true;
    const { error } = await submitReview({
      productId: dbProduct._dbId,
      userId: authStore.user.id,
      orderId: null,
      rating: reviewRating,
      title: reviewTitle,
      body: reviewBody,
      isVerifiedPurchase,
    });
    reviewSubmitting = false;
    if (error) {
      uiStore.addToast('Failed to submit review: ' + error, 'error');
    } else {
      uiStore.addToast('Review submitted! It will appear after approval.', 'success');
      showReviewForm = false;
      reviewTitle = '';
      reviewBody = '';
    }
  }
</script>

<svelte:head>
  {#if product}
    <title>{product.name} — French Toes Premium Slippers</title>
    <meta name="description" content="{product.tagline}. {(product.description ?? '').slice(0, 120)}..." />
  {:else}
    <title>Product Not Found — French Toes</title>
  {/if}
</svelte:head>

{#if !product && !loadingDB}
  <div class="min-h-screen flex flex-col items-center justify-center gap-6 py-20 text-center px-4" style="background: var(--color-warm-white);">
    <span class="text-6xl">🌸</span>
    <h1 class="font-display text-3xl font-bold" style="color: var(--color-text-dark);">Oops, this slipper flew away!</h1>
    <p class="text-base" style="color: var(--color-text-mid);">We couldn't find this product.</p>
    <a href="/shop" class="btn-primary">Browse All Slippers</a>
  </div>
{:else if product}
  <div class="min-h-screen" style="background: var(--color-warm-white);">
    <!-- Breadcrumb -->
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-center gap-2 text-xs" style="color: var(--color-text-soft);" aria-label="Breadcrumb">
      <a href="/" class="hover:underline transition-colors">Home</a>
      <span>›</span>
      <a href="/shop" class="hover:underline transition-colors">Shop</a>
      <span>›</span>
      <span style="color: var(--color-text-dark);">{product.name}</span>
    </nav>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">

        <!-- LEFT: Image Gallery -->
        <div class="flex flex-col gap-4">
          <div 
            class="relative rounded-2xl overflow-hidden aspect-square img-zoom cursor-zoom-in bg-[#F5F5F5] border border-pink-50/50"
            onmousemove={handleMouseMove}
            onmouseleave={handleMouseLeave}
            onclick={() => isLightboxOpen = true}
            role="button"
            tabindex="0"
            aria-label="Inspect product texture zoom lightbox"
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') isLightboxOpen = true; }}
          >
            <img
              src={product.images[activeImage]}
              alt="{product.name} in {selectedColor?.name ?? 'selected color'}"
              class="w-full h-full object-cover transition-opacity duration-300"
              style="{zoomStyle} transition: transform 0.08s ease-out, transform-origin 0.08s ease-out;"
              loading="eager"
            />
            <!-- Badges -->
            <div class="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
              {#each product.badges as badge}
                <span class="text-xs font-bold px-3 py-1 rounded-full text-white shadow badge-pulse"
                  style="background: {badge === 'Best Seller' ? 'var(--color-gold)' : badge === 'Limited Edition' ? 'var(--color-lavender-deep)' : badge === 'Sale' ? 'var(--color-coral-deep)' : 'var(--color-mint-deep)'};">
                  {badge}
                </span>
              {/each}
            </div>
            <!-- Wishlist -->
            <button 
              onclick={(e) => { e.stopPropagation(); toggleWishlist(); }} 
              class="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 active:scale-95 glass cursor-pointer z-10" 
              aria-label="{isWishlisted ? 'Remove from' : 'Add to'} wishlist" 
              aria-pressed={isWishlisted}
            >
              <svg width="18" height="18" fill={isWishlisted ? 'var(--color-coral-deep)' : 'none'} stroke={isWishlisted ? 'var(--color-coral-deep)' : 'var(--color-text-soft)'} stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" class={isWishlisted ? 'heart-burst' : ''}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>
          
          <!-- Thumbnails -->
          <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {#each product.images as img, i}
              <button 
                onclick={() => activeImage = i} 
                class="w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 hover:scale-105 cursor-pointer" 
                style="border-color: {activeImage === i ? 'var(--color-brand-magenta)' : 'transparent'};" 
                aria-label="View image {i + 1}" 
                aria-pressed={activeImage === i}
              >
                <img src={img} alt="Product view {i + 1}" class="w-full h-full object-cover" loading="lazy" />
              </button>
            {/each}
          </div>
        </div>

        <!-- Lightbox Fullscreen Modal -->
        <ProductModal 
          images={product.images} 
          activeImage={activeImage} 
          isOpen={isLightboxOpen} 
          onClose={() => isLightboxOpen = false} 
        />

        <!-- RIGHT: Product Info -->
        <div class="flex flex-col gap-6">
          <div>
            <h1 class="font-display text-3xl md:text-4xl lg:text-5xl font-bold" style="color: var(--color-text-dark);">{product.name}</h1>
            <p class="text-base md:text-lg mt-2" style="color: var(--color-text-mid);">{product.tagline}</p>
            <div class="flex items-center gap-3 mt-4">
              <div class="flex gap-0.5" aria-hidden="true">
                {#each Array(5) as _, i}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={i < Math.round(product.rating) ? 'var(--color-gold)' : 'none'} stroke="var(--color-gold)" stroke-width="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                {/each}
              </div>
              <a href="#reviews" class="text-sm font-medium hover:underline" style="color: var(--color-blush-deep);">{product.rating} · {product.reviewCount} reviews</a>
            </div>
          </div>

          <!-- Price -->
          <div class="flex items-center gap-3 flex-wrap">
            <span class="font-bold text-3xl md:text-4xl" style="color: var(--color-text-dark);">{formatPrice(product.price)}</span>
            {#if product.originalPrice}
              <span class="text-xl line-through" style="color: var(--color-text-soft);">{formatPrice(product.originalPrice)}</span>
              {#if salePercent}
                <span class="text-sm font-bold px-3 py-1 rounded-full" style="background: var(--color-coral); color: var(--color-coral-deep);">Save {salePercent}%</span>
              {/if}
            {/if}
            <span class="shining-badge text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-xs border" style="background: var(--color-mint); color: var(--color-mint-deep); border-color: rgba(16, 185, 129, 0.2);">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24" class="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
              C.O.D. Available
            </span>
          </div>

          <!-- Stock status -->
          {#if product.stockStatus === 'out_of_stock'}
            <p class="text-sm font-semibold px-3 py-1.5 rounded-lg inline-block" style="background: #fde8e8; color: var(--color-coral-deep);">Out of Stock</p>
          {:else if product.stockStatus === 'low_stock'}
            <p class="text-sm font-semibold px-3 py-1.5 rounded-lg inline-block badge-pulse" style="background: var(--color-peach); color: var(--color-peach-deep);">Only a few left!</p>
          {/if}

          <!-- Highlights -->
          <ul class="flex flex-col gap-2.5" aria-label="Product highlights">
            {#each product.highlights as hl}
              <li class="flex items-start gap-2.5 text-sm" style="color: var(--color-text-mid);">
                <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background: var(--color-mint);">
                  <svg width="10" height="10" fill="none" stroke="var(--color-mint-deep)" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                {hl}
              </li>
            {/each}
          </ul>

          <!-- Color Selector -->
          {#if selectedColor && (product.colors?.length ?? 0) > 0}
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="text-sm font-semibold" style="color: var(--color-text-dark);">Color:</span>
                <span class="text-sm font-medium" style="color: var(--color-blush-deep);">{selectedColor.name}</span>
              </div>
              <ColorSwatch
                colors={product.colors}
                selected={selectedColor}
                onSelect={(c) => { selectedColor = c; }}
              />
            </div>
          {/if}

          <!-- Size Selector -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold" style="color: var(--color-text-dark);">Size:</span>
                <button
                  type="button"
                  onclick={() => isSizeChartOpen = true}
                  class="text-xs font-semibold hover:underline"
                  style="color: var(--color-brand-magenta);"
                >
                  📏 Size Chart
                </button>
              </div>
              {#if sizeError}
                <span class="text-xs font-semibold badge-pulse" style="color: var(--color-coral-deep);">Please select a size</span>
              {/if}
            </div>
            <SizeSelector
              sizes={product.sizes}
              available={product.availableSizes ?? product.sizes}
              selected={selectedSize}
              onSelect={(s) => selectedSize = s}
            />
          </div>

          <!-- Quantity -->
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold" style="color: var(--color-text-dark);">Qty:</span>
            <div class="flex items-center gap-2">
              <button onclick={() => quantity = Math.max(1, quantity - 1)} class="w-9 h-9 rounded-full border flex items-center justify-center font-bold transition-all hover:bg-pink-50 active:scale-95" style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);">−</button>
              <span class="w-8 text-center font-semibold">{quantity}</span>
              <button onclick={() => quantity = quantity + 1} class="w-9 h-9 rounded-full border flex items-center justify-center font-bold transition-all hover:bg-pink-50 active:scale-95" style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);">+</button>
            </div>
          </div>

          <!-- CTA Buttons -->
          <div id="product-cta-section" class="flex gap-3">
            <button
              onclick={addToCart}
              disabled={product.stockStatus === 'out_of_stock'}
              class="btn-primary flex-1 justify-center py-4 text-base"
              class:pulse-glow={adding}
            >
              <span>{adding ? '✓ Added to Bag!' : 'Add to Bag'}</span>
            </button>
            <button
              onclick={() => { addToCart(); if (selectedSize) cartStore.open(); }}
              disabled={product.stockStatus === 'out_of_stock'}
              class="btn-outline px-6 py-4"
            >
              Buy Now
            </button>
          </div>

          <!-- Pincode Checker -->
          <div class="border rounded-2xl p-4 flex flex-col gap-3 transition-all" style="background: rgba(244, 167, 195, 0.05); border-color: rgba(244, 167, 195, 0.25);">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold flex items-center gap-1.5" style="color: var(--color-text-dark);">
                🚚 Delivery & Services
              </span>
            </div>
            
            <div class="flex gap-2">
              <div class="relative flex-1">
                <input
                  type="text"
                  maxlength="6"
                  placeholder="Enter 6-digit Pincode"
                  bind:value={pincode}
                  onkeydown={(e) => { if (e.key === 'Enter') handleCheckPincode(); }}
                  class="w-full pl-3 pr-8 py-2.5 rounded-xl border text-sm outline-none bg-white transition-all focus:border-[var(--color-blush-deep)]"
                  style="border-color: rgba(180, 100, 140, 0.25); color: var(--color-text-dark);"
                  aria-label="Pincode to check delivery date"
                />
                {#if pincode}
                  <button 
                    onclick={() => { pincode = ''; pincodeChecked = false; serviceabilityResult = null; }}
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                    aria-label="Clear pincode"
                  >
                    ✕
                  </button>
                {/if}
              </div>
              <button
                onclick={handleCheckPincode}
                disabled={checkingPincode}
                class="btn-primary py-2.5 px-5 text-sm font-bold shrink-0 cursor-pointer transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                {checkingPincode ? 'Checking...' : 'Check'}
              </button>
            </div>

            {#if checkingPincode}
              <p class="text-xs text-gray-500 animate-pulse">Checking courier availability for {pincode}...</p>
            {:else if pincodeChecked && serviceabilityResult}
              <div class="flex flex-col gap-1.5 text-xs anim-fade">
                {#if serviceabilityResult.serviceable}
                  <div class="flex items-start gap-1.5 animate-fade-in" style="color: var(--color-mint-deep);">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" class="mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <div>
                      <p class="font-bold">Deliverable to {pincode}</p>
                      {#if serviceabilityResult.etd}
                        <p class="mt-0.5 text-neutral-600" style="color: var(--color-text-dark);">Estimated Delivery by <strong class="text-sm font-bold" style="color: var(--color-brand-magenta);">{serviceabilityResult.etd}</strong></p>
                      {/if}
                    </div>
                  </div>
                  
                  {#if serviceabilityResult.cod}
                    <div class="flex items-center gap-1.5 animate-fade-in" style="color: var(--color-mint-deep);">
                      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      <p class="font-medium">Cash on Delivery (COD) is available</p>
                    </div>
                  {:else}
                    <div class="flex items-start gap-1.5 text-amber-600 animate-fade-in">
                      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>
                      <p class="font-medium">Prepaid only (COD not available for this pincode)</p>
                    </div>
                  {/if}
                {:else if serviceabilityResult.error}
                  <div class="flex items-center gap-1.5 text-red-500 font-medium animate-fade-in">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p>{serviceabilityResult.error}</p>
                  </div>
                {:else}
                  <div class="flex items-start gap-1.5 text-red-500 font-medium animate-fade-in">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    <p>Sorry, we do not ship to pincode {pincode}.</p>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Tabs -->
          <div>
            <div class="flex gap-1 border-b" style="border-color: var(--color-border);">
              {#each [['details', 'Details'], ['materials', 'Materials'], ['care', 'Care'], ['shipping', 'Shipping']] as [tab, label]}
                <button
                  onclick={() => activeTab = tab as typeof activeTab}
                  class="px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px"
                  style="border-color: {activeTab === tab ? 'var(--color-blush-deep)' : 'transparent'}; color: {activeTab === tab ? 'var(--color-blush-deep)' : 'var(--color-text-soft)'};"
                >
                  {label}
                </button>
              {/each}
            </div>
            <div class="pt-5 text-sm leading-relaxed anim-fade whitespace-pre-line" style="color: var(--color-text-mid);">
              {#if activeTab === 'details'}{product.details}
              {:else if activeTab === 'materials'}{product.materials}
              {:else if activeTab === 'care'}{product.care}
              {:else}{product.shipping}
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Related Products -->
      {#if relatedProducts.length > 0}
        <section class="mt-16">
          <h2 class="font-display text-2xl font-bold mb-6" style="color: var(--color-text-dark);">You May Also Like</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            {#each relatedProducts.slice(0, 4) as rel (rel.id ?? rel.slug)}
              <ProductCard product={rel} />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Reviews -->
      <section id="reviews" class="mt-16">
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-display text-2xl font-bold" style="color: var(--color-text-dark);">Customer Reviews</h2>
          {#if authStore.user && !showReviewForm}
            <button onclick={() => showReviewForm = true} class="btn-outline text-sm px-4 py-2">Write a Review</button>
          {:else if !authStore.user}
            <a href="/auth" class="text-sm underline" style="color: var(--color-blush-deep);">Sign in to review</a>
          {/if}
        </div>

        <!-- Review form -->
        {#if showReviewForm && authStore.user}
          <div class="rounded-2xl p-6 mb-6 border anim-fade-up" style="background: var(--color-cream); border-color: var(--color-blush);">
            <h3 class="font-semibold mb-4" style="color: var(--color-text-dark);">Write Your Review</h3>
            <form onsubmit={handleReviewSubmit} class="flex flex-col gap-4">
              <!-- Stars -->
              <div class="flex gap-2">
                {#each Array(5) as _, i}
                  <button type="button" onclick={() => reviewRating = i + 1} class="text-2xl transition-transform hover:scale-110" aria-label="Rate {i + 1} stars">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={i < reviewRating ? 'var(--color-gold)' : 'none'} stroke="var(--color-gold)" stroke-width="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                {/each}
              </div>
              <input bind:value={reviewTitle} type="text" placeholder="Review title" required class="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors focus:border-[var(--color-blush-deep)]" style="border-color: var(--color-blush);" />
              <textarea bind:value={reviewBody} placeholder="Share your experience..." required rows="4" class="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none transition-colors focus:border-[var(--color-blush-deep)]" style="border-color: var(--color-blush);"></textarea>
              {#if isVerifiedPurchase}
                <p class="text-xs" style="color: var(--color-mint-deep);">✓ Verified Purchase</p>
              {/if}
              <div class="flex gap-3">
                <button type="submit" disabled={reviewSubmitting} class="btn-primary px-6 py-2.5 text-sm">
                  <span>{reviewSubmitting ? 'Submitting...' : 'Submit Review'}</span>
                </button>
                <button type="button" onclick={() => showReviewForm = false} class="btn-outline px-6 py-2.5 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        {/if}

        <!-- Review list -->
        {#if reviews.length > 0}
          <div class="flex flex-col gap-4">
            {#each reviews as review (review.id)}
              <article class="rounded-2xl p-5 border transition-all hover:shadow-md" style="background: var(--color-surface); border-color: var(--color-border);">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="flex gap-0.5 mb-1" aria-label="{review.rating} stars">
                      {#each Array(5) as _, i}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={i < review.rating ? 'var(--color-gold)' : 'none'} stroke="var(--color-gold)" stroke-width="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      {/each}
                    </div>
                    {#if review.title}
                      <p class="font-semibold text-sm" style="color: var(--color-text-dark);">{review.title}</p>
                    {/if}
                  </div>
                  <span class="text-xs shrink-0" style="color: var(--color-text-soft);">{new Date(review.created_at).toLocaleDateString('en-IN')}</span>
                </div>
                {#if review.body}
                  <p class="text-sm mt-2 leading-relaxed" style="color: var(--color-text-mid);">{review.body}</p>
                {/if}
                <p class="text-xs mt-2 font-medium" style="color: var(--color-text-soft);">
                  {review.profiles?.full_name ?? 'Anonymous'}
                  {#if review.is_verified_purchase}
                    <span class="ml-2 px-1.5 py-0.5 rounded text-xs" style="background: var(--color-mint); color: var(--color-mint-deep);">Verified</span>
                  {/if}
                </p>
              </article>
            {/each}
          </div>
        {:else}
          <p class="text-sm py-8 text-center" style="color: var(--color-text-soft);">No reviews yet. Be the first to review!</p>
        {/if}
      </section>
    </div>
  </div>

  <!-- Size Chart Modal -->
  <SizeChartModal isOpen={isSizeChartOpen} onClose={() => isSizeChartOpen = false} />

  <!-- Sticky Bottom Bar (Mobile) -->
  {#if showStickyBar && product}
    <div class="sticky-bottom-bar visible md:hidden glass">
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="flex items-center gap-3">
          <img src={product.images[0]} alt="" class="w-12 h-12 rounded-lg object-cover" />
          <div>
            <p class="text-sm font-semibold truncate" style="color: var(--color-text-dark);">{product.name}</p>
            <p class="text-sm font-bold" style="color: var(--color-blush-deep);">{formatPrice(product.price)}</p>
          </div>
        </div>
        <button
          onclick={addToCart}
          disabled={product.stockStatus === 'out_of_stock'}
          class="btn-primary px-6 py-2.5 text-sm shrink-0"
        >
          <span>{adding ? '✓ Added' : 'Add to Bag'}</span>
        </button>
      </div>
    </div>
  {/if}
{/if}

<style>
  @keyframes sweep {
    0% { left: -100%; }
    50% { left: 150%; }
    100% { left: 150%; }
  }
  .shining-badge {
    position: relative;
    overflow: hidden;
  }
  .shining-badge::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 60%;
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.7) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    transform: skewX(-20deg);
    animation: sweep 4.5s infinite ease-in-out;
  }
</style>