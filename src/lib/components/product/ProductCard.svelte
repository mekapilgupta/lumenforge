<script lang="ts">
  console.log('[BOUNDARY] ProductCard.svelte script loading start');
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { Product } from '$lib/types';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { wishlistStore } from '$lib/stores/wishlist.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { authStore } from '$lib/stores/auth.svelte';

  let { product }: { product: Product } = $props();

  console.log('[BOUNDARY] ProductCard: rendering product:', product?.slug);
  console.log('[TYPE CHECK] typeof product:', typeof product);
  if (product) {
    console.log('[TYPE CHECK] typeof product.colors:', typeof product.colors, 'isArray:', Array.isArray(product.colors));
    console.log('[TYPE CHECK] typeof product.sizes:', typeof product.sizes, 'isArray:', Array.isArray(product.sizes));
  }

  let hovering = $state(false);
  let adding = $state(false);
  let cardRef: HTMLDivElement | undefined = $state();
  let isVisible = $state(false);

  const isWishlisted = $derived.by(() => {
    try {
      return wishlistStore.has(product.id);
    } catch (err) {
      console.log('[ERROR] in derived isWishlisted:', err);
      return false;
    }
  });
  
  const salePercent = $derived.by(() => {
    try {
      return product.originalPrice
        ? Math.round((1 - product.price / product.originalPrice) * 100)
        : null;
    } catch (err) {
      console.log('[ERROR] in derived salePercent:', err);
      return null;
    }
  });

  // Check if product has a secondary image
  const hasSecondaryImage = $derived.by(() => {
    try {
      return product.images.length > 1;
    } catch (err) {
      console.log('[ERROR] in derived hasSecondaryImage:', err);
      return false;
    }
  });
  
  const secondaryImage = $derived.by(() => {
    try {
      return product.images[1] || null;
    } catch (err) {
      console.log('[ERROR] in derived secondaryImage:', err);
      return null;
    }
  });

  function formatPrice(n: number) {
    console.log('[FUNCTION] Entering formatPrice with value:', n);
    console.log('[TYPE CHECK] typeof n:', typeof n);
    try {
      const formatted = `₹${n.toLocaleString('en-IN')}`;
      console.log('[FUNCTION] Exiting formatPrice. Result:', formatted);
      return formatted;
    } catch (err) {
      console.log('[ERROR] in formatPrice:', err);
      return `₹${n}`;
    }
  }

  function toggleWishlist(e: MouseEvent) {
    console.log('[FUNCTION] Entering toggleWishlist event');
    try {
      e.preventDefault();
      e.stopPropagation();
      console.log('[TYPE CHECK] typeof authStore.user:', typeof authStore.user);
      if (!authStore.user) {
        uiStore.addToast('Please sign in to add items to your wishlist 🌸', 'info');
        goto('/auth?redirect=' + $page.url.pathname);
        return;
      }
      const wasWishlisted = isWishlisted;
      console.log('[FUNCTION] toggleWishlist: toggling product ID:', product.id);
      wishlistStore.toggle(product.id);
      uiStore.addToast(
        wasWishlisted ? `Removed from wishlist` : `${product.name} added to wishlist 🌸`,
        wasWishlisted ? 'info' : 'success'
      );
    } catch (err) {
      console.log('[ERROR] in toggleWishlist:', err);
    }
    console.log('[FUNCTION] Exiting toggleWishlist');
  }

  async function quickAdd(e: MouseEvent) {
    console.log('[FUNCTION] Entering quickAdd event');
    try {
      e.preventDefault();
      e.stopPropagation();
      
      // Open size modal
      const productShape = {
        id: product.id,
        name: product.name,
        price: product.price,
        sizes: product.sizes,
        availableSizes: product.availableSizes ?? product.sizes,
        image: product.images[0],
        colorName: product.colors[0]?.name ?? 'Blossom'
      };

      console.log('[FUNCTION] quickAdd: opening size modal with productShape:', productShape);
      console.log('[TYPE CHECK] typeof uiStore.openQuickSize:', typeof uiStore.openQuickSize);
      uiStore.openQuickSize(productShape, (selectedSize) => {
        console.log('[FUNCTION] quickAdd callback received selectedSize:', selectedSize);
        adding = true;
        console.log('[FUNCTION] quickAdd: adding item to cartStore');
        cartStore.addItem({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: product.images[0],
          price: product.price,
          originalPrice: product.originalPrice,
          color: product.colors[0] ?? { name: 'Default', hex: '#f4a7c3' },
          size: selectedSize,
          quantity: 1,
        });
        uiStore.addToast(`${product.name} (Size ${selectedSize}) added to cart 🛍️`, 'success');
        setTimeout(() => { adding = false; }, 800);
      });
    } catch (err) {
      console.log('[ERROR] in quickAdd:', err);
    }
    console.log('[FUNCTION] Exiting quickAdd');
  }

  // IntersectionObserver for entrance animation
  onMount(() => {
    console.log('[FUNCTION] Entering ProductCard onMount');
    if (!cardRef) {
      console.log('[FUNCTION] ProductCard onMount cardRef not available');
      return;
    }
    
    let timer: number;
    let observer: IntersectionObserver;
    
    try {
      timer = setTimeout(() => {
        isVisible = true;
      }, 1000) as unknown as number;

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              isVisible = true;
              clearTimeout(timer);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.01 }
      );
      
      observer.observe(cardRef);
    } catch (err) {
      console.log('[ERROR] in ProductCard onMount setup:', err);
    }
    
    console.log('[FUNCTION] Exiting ProductCard onMount');
    return () => {
      try {
        clearTimeout(timer);
        if (observer) observer.disconnect();
      } catch (err) {
        console.log('[ERROR] in ProductCard onMount cleanup:', err);
      }
    };
  });

  // Badge class helper
  function getBadgeClass(badge: string): string {
    console.log('[FUNCTION] Entering getBadgeClass with:', badge);
    try {
      switch (badge) {
        case 'Sale': return 'ft-badge--sale';
        case 'New Arrival': return 'ft-badge--new';
        case 'Best Seller': return 'ft-badge--bestseller';
        case 'Limited Edition': return 'ft-badge--limited';
        default: return '';
      }
    } catch (err) {
      console.log('[ERROR] in getBadgeClass:', err);
      return '';
    }
  }

  function getCardVisualStyles(colorName?: string) {
    console.log('[FUNCTION] Entering getCardVisualStyles with colorName:', colorName);
    try {
      const color = colorName ?? '';
      const colLower = color.toLowerCase();
      
      if (colLower.includes('beige') || colLower.includes('white') || colLower.includes('nude') || colLower.includes('tan')) {
        return {
          bg: 'background: linear-gradient(135deg, #FAF6F0 0%, #F3ECE3 100%);',
          border: 'rgba(216, 27, 96, 0.08)',
          darkCard: false
        };
      }
      
      if (colLower.includes('black')) {
        return {
          bg: 'background: linear-gradient(135deg, #444446 0%, #2c2c2e 100%);',
          border: 'rgba(255,255,255,0.15)',
          darkCard: true
        };
      }
      
      if (colLower.includes('navy')) {
        return {
          bg: 'background: linear-gradient(135deg, #2b394a 0%, #151e29 100%);',
          border: 'rgba(255,255,255,0.15)',
          darkCard: true
        };
      }
      
      if (colLower.includes('berry') || colLower.includes('pink')) {
        return {
          bg: 'background: linear-gradient(135deg, #FFF0F5 0%, #FADADD 100%);',
          border: 'rgba(216, 27, 96, 0.08)',
          darkCard: false
        };
      }
      
      if (colLower.includes('peach')) {
        return {
          bg: 'background: linear-gradient(135deg, #FFF5EC 0%, #FFE5D9 100%);',
          border: 'rgba(216, 27, 96, 0.08)',
          darkCard: false
        };
      }

      if (colLower.includes('lavender')) {
        return {
          bg: 'background: linear-gradient(135deg, #F6F0FA 0%, #E8DFF5 100%);',
          border: 'rgba(216, 27, 96, 0.08)',
          darkCard: false
        };
      }

      if (colLower.includes('mint') || colLower.includes('green') || colLower.includes('olive') || colLower.includes('seagreen')) {
        return {
          bg: 'background: linear-gradient(135deg, #F0FBF5 0%, #D8F3E5 100%);',
          border: 'rgba(216, 27, 96, 0.08)',
          darkCard: false
        };
      }

      if (colLower.includes('coral')) {
        return {
          bg: 'background: linear-gradient(135deg, #FFF2F0 0%, #FFD6D0 100%);',
          border: 'rgba(216, 27, 96, 0.08)',
          darkCard: false
        };
      }

      if (colLower.includes('gold')) {
        return {
          bg: 'background: linear-gradient(135deg, #FAF6E8 0%, #F1E5C4 100%);',
          border: 'rgba(216, 27, 96, 0.08)',
          darkCard: false
        };
      }
      
      return {
        bg: 'background: linear-gradient(135deg, #FDFBF7 0%, #F5EFEB 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    } catch (err) {
      console.log('[ERROR] in getCardVisualStyles:', err);
      return {
        bg: 'background: linear-gradient(135deg, #FDFBF7 0%, #F5EFEB 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    }
  }
  console.log('[BOUNDARY] ProductCard.svelte script loading end');
</script>

<div
  bind:this={cardRef}
  class="group relative rounded-2xl overflow-hidden card-lift product-card-animate lush-card lush-card-pattern"
  class:ft-visible={isVisible}
  class:product-card-hover-swap={hasSecondaryImage}
  class:dark-card={getCardVisualStyles(product.colors[0]?.name).darkCard}
  style="{getCardVisualStyles(product.colors[0]?.name).bg} border: 1px solid {getCardVisualStyles(product.colors[0]?.name).darkCard ? 'rgba(255,255,255,0.08)' : 'rgba(216, 27, 96, 0.08)'}; box-shadow: 0 2px 12px rgba(180,100,140,0.08);"
  onmouseenter={() => hovering = true}
  onmouseleave={() => hovering = false}
  role="article"
  aria-label="{product.name} slipper"
>
  <!-- Shiny Animated Glitter Overlay on Hover -->
  <div class="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.8)_0%,transparent_50%)] pointer-events-none" aria-hidden="true"></div>
  <a href="/product/{product.slug}" class="block" tabindex="-1" aria-hidden="true">
    <!-- Image -->
    <div class="img-zoom relative aspect-square overflow-hidden" style="background: var(--color-blush);">
      <img
        src={product.images[0]}
        alt="{product.name} — {product.tagline}"
        class="w-full h-full object-cover product-img-primary"
        loading="lazy"
      />
      
      <!-- Secondary image (shown on hover if available) -->
      {#if hasSecondaryImage && secondaryImage}
        <img
          src={secondaryImage}
          alt="{product.name} alternate view"
          class="product-img-secondary"
          loading="lazy"
        />
      {/if}

      <!-- Badges with color-coded styling -->
      <div class="absolute top-3 left-3 flex flex-col gap-1">
        {#each product.badges as badge}
          <span class="ft-badge {getBadgeClass(badge)}">
            {badge === 'Sale' && salePercent ? `-${salePercent}%` : badge}
          </span>
        {/each}
      </div>

      <!-- Quick Add button (hover) - only show if no secondary image swap -->
      {#if !hasSecondaryImage}
        <div
          class="absolute bottom-0 left-0 right-0 p-3 transition-all duration-300"
          style="
            transform: translateY({hovering ? '0' : '100%'});
            opacity: {hovering ? 1 : 0};
          "
        >
          <button
            onclick={quickAdd}
            class="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            class:pulse-glow={adding}
            style="background: var(--color-text-dark); color: white;"
            aria-label="Quick add {product.name} to cart"
          >
            {adding ? '✓ Added!' : '+ Quick Add'}
          </button>
        </div>
      {:else}
        <!-- Quick Add with frosted background for image-swap cards -->
        <div class="ft-quick-add">
          <button
            onclick={quickAdd}
            class="w-full py-2 rounded-lg text-sm font-semibold transition-all duration-200"
            class:pulse-glow={adding}
            style="background: transparent; color: inherit;"
            aria-label="Quick add {product.name} to cart"
          >
            {adding ? '✓ Added!' : 'Quick Add →'}
          </button>
        </div>
      {/if}
    </div>
  </a>

  <!-- Wishlist button -->
  <button
    onclick={toggleWishlist}
    class="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-sm z-10"
    style="background: white;"
    aria-label="{isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
    aria-pressed={isWishlisted}
  >
    <svg
      width="15" height="15"
      fill={isWishlisted ? 'var(--color-coral-deep)' : 'none'}
      stroke={isWishlisted ? 'var(--color-coral-deep)' : 'var(--color-text-soft)'}
      stroke-width="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  </button>

  <!-- Product info -->
  <a href="/product/{product.slug}" class="block p-3 pb-4">
    <!-- Color swatches preview -->
    <div class="ft-swatches">
      {#each product.colors.slice(0, 5) as color}
        <span
          class="ft-swatch"
          style="background: {color.hex};"
          title={color.name}
          aria-label="Color: {color.name}"
        ></span>
      {/each}
      {#if product.colors.length > 5}
        <span class="text-xs self-center" style="color: var(--color-text-soft);">+{product.colors.length - 5}</span>
      {/if}
    </div>

    <h3 class="font-display font-semibold text-base leading-tight mt-2" style="color: {getCardVisualStyles(product.colors[0]?.name).darkCard ? 'white' : 'var(--color-text-dark)'};">
      {product.name}
    </h3>
    <p class="text-xs mt-0.5 truncate" style="color: {getCardVisualStyles(product.colors[0]?.name).darkCard ? 'rgba(255,255,255,0.7)' : 'var(--color-text-soft)'};">{product.tagline}</p>

    <!-- Rating -->
    <div class="flex items-center gap-1 mt-1.5">
      <div class="flex gap-0.5" aria-hidden="true">
        {#each Array(5) as _, i}
          <svg width="11" height="11" viewBox="0 0 24 24" fill={i < Math.round(product.rating) ? 'var(--color-gold)' : 'none'} stroke="var(--color-gold)" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        {/each}
      </div>
      <span class="text-xs" style="color: {getCardVisualStyles(product.colors[0]?.name).darkCard ? 'rgba(255,255,255,0.6)' : 'var(--color-text-soft)'};">{product.rating} ({product.reviewCount})</span>
    </div>

    <!-- Price -->
    <div class="flex items-center gap-2 mt-2">
      <span class="font-bold text-base" class:glow-price-drop={product.originalPrice} style="color: {getCardVisualStyles(product.colors[0]?.name).darkCard ? 'white' : 'var(--color-text-dark)'};">{formatPrice(product.price)}</span>
      {#if product.originalPrice}
        <span class="text-sm line-through" style="color: {getCardVisualStyles(product.colors[0]?.name).darkCard ? 'rgba(255,255,255,0.5)' : 'var(--color-text-soft)'};">{formatPrice(product.originalPrice)}</span>
      {/if}
    </div>
  </a>
</div>

<style>
  :global(.glow-price-drop) {
    font-family: 'Outfit', sans-serif;
    color: var(--color-brand-magenta, #d81b60) !important;
    text-shadow: 0 0 8px rgba(216, 27, 96, 0.4);
    animation: priceGlow 2s infinite ease-in-out alternate;
  }
  @keyframes priceGlow {
    from { text-shadow: 0 0 4px rgba(216, 27, 96, 0.2); }
    to { text-shadow: 0 0 12px rgba(216, 27, 96, 0.7), 0 0 20px rgba(216, 27, 96, 0.3); }
  }
</style>