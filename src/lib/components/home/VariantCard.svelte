<script lang="ts">
  import { onMount } from 'svelte';
  import type { VariantCard } from '$lib/api/products';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

  let { variant, showSold = true }: { variant: VariantCard; showSold?: boolean } = $props();

  let hovering = $state(false);
  let adding = $state(false);
  let cardRef: HTMLDivElement | undefined = $state();
  let isVisible = $state(false);

  // Calculate discount percentage
  const discountPercent = $derived(
    variant.originalPrice
      ? Math.round((1 - variant.price / variant.originalPrice) * 100)
      : null
  );

  // Format price from paise to rupees
  function formatPrice(paise: number): string {
    return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
  }

  // Generate fake "sold" count for social proof (seeded by variant id for consistency)
  const soldCount = $derived(
    Math.floor((parseInt(variant.id.slice(0, 8), 16) % 400) + 50)
  );

  // Quick add to cart
  async function quickAdd(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    // Open size modal
    const productShape = {
      id: variant.productId,
      name: variant.name,
      price: Math.round(variant.price / 100),
      sizes: [36, 37, 38, 39, 40, 41, 42],
      availableSizes: [36, 37, 38, 39, 40, 41, 42],
      image: variant.image,
      colorName: variant.colorName
    };

    uiStore.openQuickSize(productShape, (selectedSize) => {
      adding = true;
      cartStore.addItem({
        productId: variant.productId,
        slug: variant.slug,
        name: variant.name,
        image: variant.image,
        price: Math.round(variant.price / 100),
        originalPrice: variant.originalPrice ? Math.round(variant.originalPrice / 100) : undefined,
        color: { name: variant.colorName, hex: '#888' },
        size: selectedSize,
        quantity: 1,
      });
      uiStore.addToast(`${variant.name} (${variant.colorName} - Size ${selectedSize}) added to cart 🛍️`, 'success');
      setTimeout(() => { adding = false; }, 800);
    });
  }

  // IntersectionObserver for entrance animation
  onMount(() => {
    if (!cardRef) return;
    
    const timer = setTimeout(() => {
      isVisible = true;
    }, 1000);

    const observer = new IntersectionObserver(
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
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  });

  // Badge class helper
  function getBadgeClass(badge: string): string {
    switch (badge) {
      case 'Sale': return 'ft-badge--sale';
      case 'New Arrival': return 'ft-badge--new';
      case 'Best Seller': return 'ft-badge--bestseller';
      case 'Limited Edition': return 'ft-badge--limited';
      default: return '';
    }
  }

  function getCardVisualStyles(color: string) {
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
  }
</script>

<div
  bind:this={cardRef}
  class="variant-card product-card-animate lush-card group"
  class:ft-visible={isVisible}
  class:hover-swap={!!variant.hoverImage}
  class:dark-card={getCardVisualStyles(variant.colorName).darkCard}
  style="{getCardVisualStyles(variant.colorName).bg} border-color: {getCardVisualStyles(variant.colorName).border};"
  onmouseenter={() => hovering = true}
  onmouseleave={() => hovering = false}
  role="article"
  aria-label="{variant.name} in {variant.colorName}"
>
  <!-- Shiny Animated Glitter Overlay on Hover -->
  <div class="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.8)_0%,transparent_50%)] pointer-events-none" aria-hidden="true"></div>

  <a href="/product/{variant.slug}?color={encodeURIComponent(variant.colorName)}" class="variant-card-link">
    <!-- Image container -->
    <div class="variant-card-image">
      <img
        src={variant.image}
        alt="{variant.name} in {variant.colorName}"
        class="variant-img-primary"
        loading="lazy"
      />
      
      {#if variant.hoverImage}
        <img
          src={variant.hoverImage}
          alt="{variant.name} alternate view"
          class="variant-img-secondary"
          loading="lazy"
        />
      {/if}

      <!-- Badges -->
      <div class="variant-badges">
        {#each variant.badges.slice(0, 2) as badge}
          <span class="ft-badge {getBadgeClass(badge)}">
            {badge === 'Sale' && discountPercent ? `-${discountPercent}%` : badge}
          </span>
        {/each}
      </div>

      <!-- Quick Add overlay -->
      <div class="variant-quick-add" class:visible={hovering}>
        <button
          onclick={quickAdd}
          class="quick-add-btn"
          class:pulse-glow={adding}
          aria-label="Quick add {variant.name} to cart"
        >
          {adding ? '✓ Added!' : '+ Quick Add'}
        </button>
      </div>
    </div>

    <!-- Info -->
    <div class="variant-card-info">
      <h3 class="variant-name">{variant.name}</h3>
      <p class="variant-color">{variant.colorName}</p>
      
      <!-- Rating -->
      <div class="variant-rating">
        <div class="stars" aria-hidden="true">
          {#each Array(5) as _, i}
            <svg width="10" height="10" viewBox="0 0 24 24" fill={i < Math.round(variant.rating) ? '#f0a500' : '#e5e7eb'} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          {/each}
        </div>
        <span class="rating-count">({variant.reviewCount})</span>
      </div>

      <!-- Price -->
      <div class="variant-price">
        <span class="current-price" class:glow-price-drop={variant.originalPrice}>{formatPrice(variant.price)}</span>
        {#if variant.originalPrice}
          <span class="original-price">{formatPrice(variant.originalPrice)}</span>
        {/if}
      </div>

      <!-- Social proof -->
      {#if showSold}
        <p class="variant-sold">🔥 {soldCount} sold</p>
      {/if}
    </div>
  </a>
</div>

<style>
  .variant-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border: 1px solid transparent;
  }
  
  .variant-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(180,100,140,0.15);
  }
  
  /* Dark Mode Overrides for Cards */
  .variant-card.dark-card {
    color: white;
  }
  .variant-card.dark-card .variant-name {
    color: white;
  }
  .variant-card.dark-card .variant-color {
    color: rgba(255,255,255,0.7);
  }
  .variant-card.dark-card .current-price {
    color: white;
  }
  .variant-card.dark-card .original-price {
    color: rgba(255,255,255,0.5);
  }

  .variant-card-link {
    display: block;
    text-decoration: none;
    color: inherit;
  }
  
  .variant-card-image {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background: var(--color-blush, #f9d5e5);
  }
  
  .variant-img-primary {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.4s ease, transform 0.5s ease;
  }
  
  .variant-img-secondary {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.4s ease;
  }
  
  .variant-card.hover-swap:hover .variant-img-primary {
    opacity: 0;
    transform: scale(1.04);
  }
  
  .variant-card.hover-swap:hover .variant-img-secondary {
    opacity: 1;
  }
  
  .variant-badges {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .variant-quick-add {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(4px);
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }
  
  .variant-quick-add.visible {
    transform: translateY(0);
  }
  
  .quick-add-btn {
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: 8px;
    background: var(--color-text-dark, #2d1b2e);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .quick-add-btn:hover {
    background: var(--color-blush-deep, #f4a7c3);
  }
  
  .variant-card-info {
    padding: 10px 12px 14px;
  }
  
  .variant-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-dark, #2d1b2e);
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .variant-color {
    font-size: 0.75rem;
    color: var(--color-text-soft, #9e7ca0);
    margin: 0 0 6px;
  }
  
  .variant-rating {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
  }
  
  .stars {
    display: flex;
    gap: 1px;
  }
  
  .rating-count {
    font-size: 0.65rem;
    color: var(--color-text-soft, #9e7ca0);
  }
  
  .variant-price {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 4px;
  }
  
  .current-price {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text-dark, #2d1b2e);
  }
  
  .original-price {
    font-size: 0.75rem;
    color: var(--color-text-soft, #9e7ca0);
    text-decoration: line-through;
  }
  
  .variant-sold {
    font-size: 0.7rem;
    color: #e8647a;
    margin: 0;
    font-weight: 500;
  }

  .glow-price-drop {
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