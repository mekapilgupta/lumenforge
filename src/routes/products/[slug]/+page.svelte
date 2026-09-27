<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { wishlistStore } from '$lib/stores/wishlist.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { formatCurrency, getImageKitUrl } from '$lib/types/product';
  import type { CompleteProduct, DBProductVariant, DBProductImage } from '$lib/types/product';
  import SizeChartModal from '$lib/components/product/SizeChartModal.svelte';

  let { data } = $props<{
    data: {
      product: CompleteProduct;
      initialSelectedVariantId: string | null;
      initialColorSlug: string | null;
      relatedProducts?: any[];
    };
  }>();

  const product = $derived(data.product);
  const variants = $derived(product.variants || []);
  const relatedProducts = $derived(data.relatedProducts || []);

  // Active Variant State
  let selectedVariantId = $state<string>('');

  // Initialize and sync state if initialSelectedVariantId or variants change
  $effect(() => {
    if (data.initialSelectedVariantId) {
      selectedVariantId = data.initialSelectedVariantId;
    } else if (variants.length > 0 && !selectedVariantId) {
      selectedVariantId = variants[0].id;
    }
  });

  const activeVariant = $derived(
    variants.find((v: any) => v.id === selectedVariantId) || variants[0] || null
  );

  // Gallery Active Image Index
  let activeImageIndex = $state(0);

  // When variant switches, reset active image to 0 (or primary image)
  function switchVariant(variant: any) {
    if (!variant || variant.id === selectedVariantId) return;
    selectedVariantId = variant.id;
    activeImageIndex = 0;

    // Update URL query param client-side without full reload
    const colorSlug = variant.color_slug || encodeURIComponent(variant.color_name);
    const newUrl = `/products/${product.slug}?color=${colorSlug}`;
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true });
  }

  // Active Gallery Images for selected variant
  const activeImages = $derived.by<DBProductImage[]>(() => {
    if (!activeVariant || !activeVariant.images || activeVariant.images.length === 0) {
      return [];
    }
    return activeVariant.images;
  });

  const activeMainImage = $derived(activeImages[activeImageIndex] || activeImages[0] || null);

  // Selected Size State (Indian Footwear Sizes)
  const AVAILABLE_SIZES = [36, 37, 38, 39, 40, 41];
  let selectedSize = $state<number | null>(38);
  let isSizeChartOpen = $state(false);

  // Quantity State
  let quantity = $state(1);

  // Adding to cart animation
  let isAddingToCart = $state(false);

  // Zoom / Lightbox State
  let isLightboxOpen = $state(false);
  let zoomStyle = $state('transform-origin: center; transform: scale(1);');

  function handleMouseMove(e: MouseEvent) {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    zoomStyle = `transform-origin: ${x}% ${y}%; transform: scale(1.4);`;
  }

  function handleMouseLeave() {
    zoomStyle = 'transform-origin: center; transform: scale(1);';
  }

  // Active Tab
  let activeTab = $state<'details' | 'materials' | 'shipping'>('details');

  // Pincode Delivery Checker
  let pincode = $state('');
  let checkingPincode = $state(false);
  let pincodeResult = $state<{ serviceable?: boolean; cod?: boolean; etd?: string; error?: string } | null>(null);

  async function checkPincode() {
    if (!/^\d{6}$/.test(pincode)) {
      pincodeResult = { error: 'Please enter a valid 6-digit Indian PIN code.' };
      return;
    }
    checkingPincode = true;
    pincodeResult = null;
    try {
      const res = await fetch(`/api/serviceability?pincode=${pincode}`);
      if (res.ok) {
        const json = await res.json();
        pincodeResult = json;
      } else {
        pincodeResult = { serviceable: true, cod: true, etd: '3-5 business days' };
      }
    } catch {
      pincodeResult = { serviceable: true, cod: true, etd: '3-5 business days' };
    } finally {
      checkingPincode = false;
    }
  }

  // Computed Prices for current variant
  const currentPriceNumber = $derived(
    activeVariant?.price_override !== null && activeVariant?.price_override !== undefined && activeVariant?.price_override !== ''
      ? Number(activeVariant.price_override)
      : Number(product.base_price || 0)
  );

  const currentOriginalPriceNumber = $derived(
    activeVariant?.compare_at_price !== null && activeVariant?.compare_at_price !== undefined && activeVariant?.compare_at_price !== ''
      ? Number(activeVariant.compare_at_price)
      : (product.compare_at_price ? Number(product.compare_at_price) : null)
  );

  const isOutOfStock = $derived((activeVariant?.stock_quantity ?? 0) <= 0);

  // Add to Cart
  async function handleAddToCart() {
    if (isOutOfStock) {
      uiStore.addToast('This color variant is currently out of stock.', 'error');
      return;
    }
    if (!selectedSize) {
      uiStore.addToast('Please choose a size.', 'error');
      return;
    }

    isAddingToCart = true;

    try {
      const primaryImg = activeImages.find(img => img.is_primary) || activeImages[0];
      const imageUrl = primaryImg ? getImageKitUrl(primaryImg.image_url, 'w-300,q-80') : '';

      cartStore.addItem({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: imageUrl,
        price: currentPriceNumber,
        color: {
          name: activeVariant?.color_name || 'Default',
          hex: activeVariant?.color_hex || '#f4a7c3'
        },
        size: selectedSize,
        quantity: quantity,
        variantId: activeVariant?.id
      });

      uiStore.addToast(`Added ${product.name} (${activeVariant?.color_name}) to your cart!`, 'success');
      cartStore.open();
    } catch (e: any) {
      console.error('Add to cart error:', e);
      uiStore.addToast('Failed to add to cart', 'error');
    } finally {
      isAddingToCart = false;
    }
  }
</script>

<svelte:head>
  <title>{product.name} — French Toes Luxury Footwear</title>
  <meta name="description" content={product.description || `${product.name} by French Toes. Handcrafted comfort in luxury colors.`} />
  {#if activeMainImage}
    <meta property="og:image" content={getImageKitUrl(activeMainImage.image_url, 'w-1200,q-90')} />
  {/if}
</svelte:head>

<div class="min-h-screen bg-[#faf8f5] text-stone-900 pb-24">
  <!-- Breadcrumbs -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
    <nav class="flex items-center gap-2 text-xs text-stone-500">
      <a href="/" class="hover:text-stone-900 transition-colors">Home</a>
      <span>/</span>
      <a href="/shop" class="hover:text-stone-900 transition-colors">{product.category || 'Footwear'}</a>
      <span>/</span>
      <span class="text-stone-900 font-semibold truncate">{product.name}</span>
    </nav>
  </div>

  <!-- Product Main Section -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
      
      <!-- ===================================================================== -->
      <!-- LEFT: IMAGE GALLERY -->
      <!-- ===================================================================== -->
      <div class="lg:col-span-7 space-y-4">
        <!-- Main Image with Zoom -->
        <div
          role="button"
          tabindex="0"
          onclick={() => isLightboxOpen = true}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') isLightboxOpen = true; }}
          onmousemove={handleMouseMove}
          onmouseleave={handleMouseLeave}
          class="relative aspect-[4/4.5] sm:aspect-square bg-stone-100 rounded-3xl overflow-hidden border border-stone-200/80 shadow-sm cursor-zoom-in group select-none"
        >
          {#if activeMainImage}
            <img
              src={getImageKitUrl(activeMainImage.image_url, 'w-900,q-85')}
              alt={activeMainImage.alt_text || product.name}
              class="w-full h-full object-cover transition-transform duration-200 ease-out"
              style={zoomStyle}
            />
          {:else}
            <!-- Missing Image Placeholder -->
            <div class="w-full h-full flex flex-col items-center justify-center p-8 text-stone-400 bg-stone-50">
              <svg width="64" height="64" class="opacity-40 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              <p class="text-sm font-medium">No preview photo for {activeVariant?.color_name || 'this color'}</p>
            </div>
          {/if}

          <!-- Floating Badges -->
          <div class="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
            {#if isOutOfStock}
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-stone-900 text-white uppercase tracking-wider shadow">
                Out of Stock
              </span>
            {:else if (activeVariant?.stock_quantity ?? 0) <= 5}
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-600 text-white uppercase tracking-wider shadow animate-pulse">
                Only {activeVariant?.stock_quantity} left
              </span>
            {/if}
          </div>

          <!-- Zoom hint button -->
          <div class="absolute bottom-4 right-4 p-2.5 rounded-full bg-white/80 backdrop-blur-md text-stone-700 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </div>
        </div>

        <!-- Thumbnails Row -->
        {#if activeImages.length > 1}
          <div class="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {#each activeImages as img, idx (img.id || idx)}
              <button
                type="button"
                onclick={() => activeImageIndex = idx}
                class="w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all shrink-0 bg-stone-100 {
                  activeImageIndex === idx 
                    ? 'border-stone-900 ring-2 ring-stone-900/20 scale-105 shadow-md' 
                    : 'border-transparent opacity-60 hover:opacity-100'
                }"
              >
                <img
                  src={getImageKitUrl(img.image_url, 'w-150,q-75')}
                  alt="Thumbnail {idx + 1}"
                  class="w-full h-full object-cover"
                />
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- ===================================================================== -->
      <!-- RIGHT: PRODUCT DETAILS & VARIANT SELECTION -->
      <!-- ===================================================================== -->
      <div class="lg:col-span-5 space-y-8">
        <!-- Title & Brand -->
        <div class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-widest text-[#d4708a]">{product.brand || 'French Toes'}</p>
          <h1 class="text-3xl sm:text-4xl font-serif font-bold text-stone-900 tracking-tight leading-tight">
            {product.name}
          </h1>

          <!-- Price & Stock Status -->
          <div class="flex items-baseline gap-3.5 flex-wrap pt-1">
            <span class="text-3xl font-bold font-mono text-stone-900">
              {formatCurrency(currentPriceNumber)}
            </span>
            {#if currentOriginalPriceNumber && currentOriginalPriceNumber > currentPriceNumber}
              <span class="text-lg font-mono text-stone-400 line-through">
                {formatCurrency(currentOriginalPriceNumber)}
              </span>
              <span class="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md bg-pink-100 text-[#d4708a] border border-pink-200">
                {Math.round(((currentOriginalPriceNumber - currentPriceNumber) / currentOriginalPriceNumber) * 100)}% OFF
              </span>
            {/if}
            <span class="text-xs text-stone-500 font-medium self-center">Inclusive of all taxes</span>
          </div>
        </div>

        <!-- Color Swatches Switcher (Variant Selector) -->
        <div class="space-y-3 pt-4 border-t border-stone-200">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-stone-700">
              Color: <span class="text-stone-900 font-semibold">{activeVariant?.color_name || 'Selected Color'}</span>
            </span>
            <span class="text-xs font-mono text-stone-400">SKU: {activeVariant?.sku}</span>
          </div>

          <!-- Color Swatch Circles -->
          <div class="flex items-center gap-3.5 flex-wrap">
            {#each variants as variant (variant.id)}
              {@const isSelected = variant.id === selectedVariantId}
              {@const isVarOutOfStock = (variant.stock_quantity ?? 0) <= 0}
              <button
                type="button"
                onclick={() => switchVariant(variant)}
                title="{variant.color_name} {isVarOutOfStock ? '(Out of stock)' : ''}"
                class="group relative p-1 rounded-full border-2 transition-all {
                  isSelected
                    ? 'border-stone-900 scale-110 shadow-sm'
                    : 'border-transparent hover:border-stone-300'
                }"
              >
                <span
                  class="block w-8 h-8 rounded-full border border-black/10 shadow-inner relative {isVarOutOfStock ? 'opacity-40' : ''}"
                  style="background-color: {variant.color_hex || '#000'};"
                >
                  {#if isVarOutOfStock}
                    <!-- Diagonal Strikethrough for Out of Stock -->
                    <span class="absolute inset-0 flex items-center justify-center">
                      <span class="w-full h-0.5 bg-red-500 rotate-45 transform"></span>
                    </span>
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Size Selector -->
        <div class="space-y-3 pt-4 border-t border-stone-200">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-stone-700">
              Select Size (India / EU)
            </span>
            <button
              type="button"
              onclick={() => isSizeChartOpen = true}
              class="text-xs text-[#d4708a] hover:underline font-semibold flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 3H3v18h18V3zM9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
              Size Guide
            </button>
          </div>

          <div class="grid grid-cols-6 gap-2">
            {#each AVAILABLE_SIZES as sz}
              <button
                type="button"
                onclick={() => selectedSize = sz}
                class="py-3 rounded-xl text-sm font-mono font-bold transition-all border {
                  selectedSize === sz
                    ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                }"
              >
                {sz}
              </button>
            {/each}
          </div>
        </div>

        <!-- Quantity & Add to Cart CTA -->
        <div class="space-y-4 pt-4 border-t border-stone-200">
          <div class="flex items-center gap-4">
            <!-- Quantity Counter -->
            <div class="flex items-center border border-stone-300 rounded-xl bg-white p-1">
              <button
                type="button"
                disabled={quantity <= 1 || isOutOfStock}
                onclick={() => quantity = Math.max(1, quantity - 1)}
                class="w-10 h-10 flex items-center justify-center text-stone-700 hover:bg-stone-100 rounded-lg disabled:opacity-30 transition-colors"
              >
                -
              </button>
              <span class="w-10 text-center font-mono font-bold text-sm text-stone-900">{quantity}</span>
              <button
                type="button"
                disabled={quantity >= 5 || isOutOfStock}
                onclick={() => quantity = Math.min(5, quantity + 1)}
                class="w-10 h-10 flex items-center justify-center text-stone-700 hover:bg-stone-100 rounded-lg disabled:opacity-30 transition-colors"
              >
                +
              </button>
            </div>

            <!-- Add to Cart Main Button -->
            <button
              type="button"
              disabled={isOutOfStock || isAddingToCart}
              onclick={handleAddToCart}
              class="flex-1 py-4 px-6 rounded-2xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 {
                isOutOfStock
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  : 'bg-stone-900 hover:bg-black text-white hover:scale-[1.01]'
              }"
            >
              {#if isAddingToCart}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Adding to Cart...</span>
              {:else if isOutOfStock}
                <span>Out of Stock in this Color</span>
              {:else}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                <span>Add to Cart — {formatCurrency(currentPriceNumber * quantity)}</span>
              {/if}
            </button>
          </div>
        </div>

        <!-- Pincode Delivery Estimator -->
        <div class="p-4 rounded-2xl bg-stone-100/70 border border-stone-200/80 space-y-3">
          <div class="flex items-center gap-2 text-xs font-bold text-stone-800 uppercase tracking-wider">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            Check Delivery & COD Availability
          </div>
          <div class="flex gap-2">
            <input
              type="text"
              maxlength="6"
              bind:value={pincode}
              placeholder="Enter 6-digit PIN code"
              class="flex-1 bg-white border border-stone-300 rounded-xl px-4 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
            <button
              type="button"
              disabled={checkingPincode}
              onclick={checkPincode}
              class="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
            >
              {checkingPincode ? 'Checking...' : 'Check'}
            </button>
          </div>
          {#if pincodeResult}
            <div class="text-xs pt-1">
              {#if pincodeResult.error}
                <p class="text-red-600">{pincodeResult.error}</p>
              {:else if pincodeResult.serviceable}
                <p class="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Delivery available in {pincodeResult.etd || '3-5 days'} • Cash on Delivery available
                </p>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Product Accordions / Tabs -->
        <div class="space-y-2 pt-4 border-t border-stone-200">
          <!-- Details Accordion -->
          <details open class="group border border-stone-200 rounded-2xl overflow-hidden bg-white">
            <summary class="flex items-center justify-between p-4 text-xs font-bold uppercase tracking-wider text-stone-900 cursor-pointer select-none">
              <span>Product Description & Features</span>
              <span class="group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div class="px-4 pb-4 text-xs text-stone-600 leading-relaxed whitespace-pre-line border-t border-stone-100 pt-3">
              {product.description || 'Thoughtfully handcrafted with premium vegan materials for cloud-like all-day comfort.'}
            </div>
          </details>

          <!-- Shipping & Returns Accordion -->
          <details class="group border border-stone-200 rounded-2xl overflow-hidden bg-white">
            <summary class="flex items-center justify-between p-4 text-xs font-bold uppercase tracking-wider text-stone-900 cursor-pointer select-none">
              <span>Free Shipping & Easy 5-Day Size Exchange</span>
              <span class="group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div class="px-4 pb-4 text-xs text-stone-600 leading-relaxed border-t border-stone-100 pt-3 space-y-1.5">
              <p>• Free express shipping across India on all orders.</p>
              <p>• Hassle-free 5-day doorstep size exchange guarantee.</p>
              <p>• Cash on delivery & online UPI payments accepted.</p>
            </div>
          </details>
        </div>

      </div>
    </div>
  </div>

  <!-- Size Chart Modal -->
  <SizeChartModal isOpen={isSizeChartOpen} onClose={() => isSizeChartOpen = false} />

  <!-- Lightbox Modal -->
  {#if isLightboxOpen && activeMainImage}
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={() => isLightboxOpen = false}
      onkeydown={(e) => { if (e.key === 'Escape') isLightboxOpen = false; }}
      class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md cursor-zoom-out"
    >
      <button
        type="button"
        onclick={() => isLightboxOpen = false}
        aria-label="Close image lightbox"
        class="absolute top-6 right-6 text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <img
        src={getImageKitUrl(activeMainImage.image_url, 'w-1400,q-95')}
        alt={activeMainImage.alt_text || product.name}
        class="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
      />
    </div>
  {/if}
</div>
