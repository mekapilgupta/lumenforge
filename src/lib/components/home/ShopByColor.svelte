<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import ProductModal from '$lib/components/product/ProductModal.svelte';

  const vibes = [
    { name: 'Black', emoji: '🖤', hex: '#1a1a1a', tagline: 'Midnight elegance & classic style' },
    { name: 'Berry', emoji: '🫐', hex: '#b5416e', tagline: 'Juicy, bold pastels for statement looks' },
    { name: 'Beige', emoji: '🤎', hex: '#f5e0c0', tagline: 'Warm sandy neutrals for daily comfort' },
    { name: 'Peach', emoji: '🍑', hex: '#ffb38a', tagline: 'Soft, sun-kissed shades of summer' },
    { name: 'Sea Green', emoji: '🌿', hex: '#3aafa9', tagline: 'Cool, monsoon-proof breeze tones' },
    { name: 'Navy', emoji: '🌊', hex: '#000080', tagline: 'Deep oceanic rich styles' },
  ];

  let selectedVibe = $state('Black');

  let dbProducts = $state<any[]>([]);
  let loading = $state(true);

  // Lightbox modal states
  let isLightboxOpen = $state(false);
  let lightboxImages = $state<string[]>([]);
  let lightboxActiveIdx = $state(0);

  // Computed catalog based on DB fetch
  const catalogList = $derived.by(() => {
    console.log('[ShopByColor] Deriving catalogList. dbProducts length:', dbProducts.length);
    if (dbProducts.length > 0) {
      const grouped = groupProductsFromDB(dbProducts);
      console.log('[ShopByColor] Derived grouped products from DB. Length:', grouped.length);
      return grouped;
    }
    console.log('[ShopByColor] dbProducts is empty. Returning empty list.');
    return [];
  });

  // Filter products by vibe
  const filteredProducts = $derived.by(() => {
    const filtered = catalogList.filter(p => p.color.toLowerCase() === selectedVibe.toLowerCase());
    console.log(`[ShopByColor] Filtered products for vibe "${selectedVibe}". Count:`, filtered.length);
    return filtered;
  });

  onMount(async () => {
    console.log('[ShopByColor] Component mounted. Starting fetch from Supabase...');
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);
      if (error) {
        console.error('[ShopByColor] Supabase query error fetching products:', error);
      } else {
        console.log(`[ShopByColor] Supabase query returned ${data?.length ?? 0} active products.`);
        if (data && data.length > 0) {
          dbProducts = data;
        }
      }
    } catch (err) {
      console.error('[ShopByColor] Exception in onMount:', err);
    } finally {
      loading = false;
      console.log('[ShopByColor] Fetch complete. Loading state set to false.');
    }
  });

  function groupProductsFromDB(prods: any[]) {
    console.log('[ShopByColor] Grouping DB products. Raw prods count:', prods.length);
    return prods.map(p => {
      try {
        const modelTag = p.tags?.find((t: string) => t.startsWith('model-'));
        const seriesRaw = modelTag ? modelTag.replace('model-', '') : 'California';
        const series = seriesRaw.charAt(0).toUpperCase() + seriesRaw.slice(1).replace('-', ' ');
        
        const colorObj = p.colors?.[0] ?? { name: 'Default', hex: '#888' };
        const imagesList = (p.images ?? []).map((img: any) => img.url ?? img);
        
        const resolvedImage = imagesList[0] || p.thumbnail_url || '/placeholder.jpg';
        console.log(`[ShopByColor] Product ID "${p.id}" (${p.name}): Image path resolved to: "${resolvedImage}"`);
        
        return {
          id: p.id,
          series: series.startsWith('Miami') ? 'Miami' : series,
          name: p.name,
          color: colorObj.name,
          hex: colorObj.hex,
          image: resolvedImage,
          slug: p.slug,
          price: Math.round(p.price / 100),
          originalPrice: p.original_price ? Math.round(p.original_price / 100) : undefined,
          badges: [
            ...(p.is_best_seller ? ['Best Seller'] : []),
            ...(p.is_new_arrival ? ['New Arrival'] : []),
            ...(p.original_price ? ['Sale'] : [])
          ]
        };
      } catch (err) {
        console.error(`[ShopByColor] Error mapping product ID "${p?.id}":`, err);
        return null;
      }
    }).filter(Boolean);
  }

  // Quick Add function
  let addingId = $state<string | null>(null);
  function handleQuickAdd(card: any) {
    // Open size modal
    const productShape = {
      id: card.id,
      name: card.name,
      price: card.price,
      sizes: [36, 37, 38, 39, 40, 41, 42],
      availableSizes: [36, 37, 38, 39, 40, 41, 42],
      image: card.image,
      colorName: card.color
    };

    uiStore.openQuickSize(productShape, (selectedSize) => {
      addingId = card.id;
      cartStore.addItem({
        productId: card.id,
        slug: card.slug,
        name: card.name,
        image: card.image,
        price: card.price,
        originalPrice: card.originalPrice,
        color: { name: card.color, hex: card.hex },
        size: selectedSize,
        quantity: 1
      });
      uiStore.addToast(`${card.name} (Size ${selectedSize}) added to cart! 🛍️`, 'success');
      setTimeout(() => { addingId = null; }, 800);
    });
  }

  function openLightbox(card: any) {
    lightboxImages = filteredProducts.map(c => c.image);
    lightboxActiveIdx = filteredProducts.findIndex(c => c.id === card.id);
    if (lightboxActiveIdx === -1) lightboxActiveIdx = 0;
    isLightboxOpen = true;
  }

  function getCardVisualStyles(color: string) {
    const colLower = color.toLowerCase();
    
    if (colLower.includes('beige') || colLower.includes('white') || colLower.includes('nude') || colLower.includes('tan')) {
      return {
        bg: 'background: linear-gradient(135deg, #FAF6F0 0%, #F3ECE3 100%);',
        border: 'border-amber-100/40',
        text: 'text-[#5d4037]',
        glow: 'shadow-amber-100/30'
      };
    }
    
    if (colLower.includes('black')) {
      return {
        bg: 'background: linear-gradient(135deg, #444446 0%, #2c2c2e 100%);',
        border: 'border-zinc-800/80',
        text: 'text-zinc-300',
        glow: 'shadow-black/50',
        darkCard: true
      };
    }
    
    if (colLower.includes('navy')) {
      return {
        bg: 'background: linear-gradient(135deg, #2b394a 0%, #151e29 100%);',
        border: 'border-zinc-800/80',
        text: 'text-zinc-300',
        glow: 'shadow-black/50',
        darkCard: true
      };
    }
    
    if (colLower.includes('berry') || colLower.includes('pink')) {
      return {
        bg: 'background: linear-gradient(135deg, #FFF0F5 0%, #FADADD 100%);',
        border: 'border-pink-100/40',
        text: 'text-[#880e4f]',
        glow: 'shadow-pink-100/30'
      };
    }

    if (colLower.includes('peach')) {
      return {
        bg: 'background: linear-gradient(135deg, #FFF5EC 0%, #FFE5D9 100%);',
        border: 'border-orange-100/40',
        text: 'text-[#884f0e]',
        glow: 'shadow-orange-100/30'
      };
    }

    if (colLower.includes('lavender')) {
      return {
        bg: 'background: linear-gradient(135deg, #F6F0FA 0%, #E8DFF5 100%);',
        border: 'border-purple-100/40',
        text: 'text-[#5d0e88]',
        glow: 'shadow-purple-100/30'
      };
    }

    if (colLower.includes('mint') || colLower.includes('green') || colLower.includes('olive') || colLower.includes('seagreen')) {
      return {
        bg: 'background: linear-gradient(135deg, #F0FBF5 0%, #D8F3E5 100%);',
        border: 'border-teal-100/40',
        text: 'text-teal-900',
        glow: 'shadow-teal-100/20'
      };
    }

    if (colLower.includes('coral')) {
      return {
        bg: 'background: linear-gradient(135deg, #FFF2F0 0%, #FFD6D0 100%);',
        border: 'border-red-100/40',
        text: 'text-red-900',
        glow: 'shadow-red-100/20'
      };
    }

    if (colLower.includes('gold')) {
      return {
        bg: 'background: linear-gradient(135deg, #FAF6E8 0%, #F1E5C4 100%);',
        border: 'border-yellow-100/40',
        text: 'text-yellow-900',
        glow: 'shadow-yellow-100/20'
      };
    }
    
    return {
      bg: 'background: linear-gradient(135deg, #FDFBF7 0%, #F5EFEB 100%);',
      border: 'border-pink-100/40',
      text: 'text-pink-900',
      glow: 'shadow-pink-100/20'
    };
  }

  // Dynamic backgrounds mapped to specific color vibes
  const vibeBackgrounds: Record<string, { img: string; gradient: string }> = {
    'Black': {
      img: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&q=80',
      gradient: 'linear-gradient(rgba(255, 255, 255, 0.82), rgba(30, 30, 30, 0.88))'
    },
    'Berry': {
      img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&q=80',
      gradient: 'linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 230, 240, 0.9))'
    },
    'Beige': {
      img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
      gradient: 'linear-gradient(rgba(255, 255, 255, 0.82), rgba(253, 248, 243, 0.88))'
    },
    'Peach': {
      img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80',
      gradient: 'linear-gradient(rgba(255, 255, 255, 0.82), rgba(255, 230, 215, 0.88))'
    },
    'Sea Green': {
      img: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=1600&q=80',
      gradient: 'linear-gradient(rgba(255, 255, 255, 0.85), rgba(213, 240, 232, 0.9))'
    },
    'Navy': {
      img: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&q=80',
      gradient: 'linear-gradient(rgba(255, 255, 255, 0.82), rgba(15, 30, 50, 0.88))'
    }
  };
</script>

<section 
  class="py-16 relative overflow-hidden border-b border-[#f0e0e8]/30 transition-all duration-750 ease-in-out"
  style="background-image: {vibeBackgrounds[selectedVibe]?.gradient || 'linear-gradient(rgba(255, 251, 247, 0.93), rgba(255, 251, 247, 0.96))'}, url('{vibeBackgrounds[selectedVibe]?.img || ''}'); background-size: cover; background-blend-mode: overlay; background-position: center;"
>
  <!-- Background soft mesh glow -->
  <div class="absolute -right-32 top-1/3 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-orange-100 to-pink-50 blur-3xl opacity-60 pointer-events-none" aria-hidden="true"></div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
    
    <!-- Title -->
    <div class="text-center mb-10">
      <span class="text-xs font-semibold uppercase tracking-widest text-[var(--color-brand-magenta)]">Visual Vibes</span>
      <h2 class="font-display text-3xl md:text-4xl font-bold mt-2 text-[#2d1b2e]">Shop by Vibe</h2>
      {#each vibes as vibe}
        {#if vibe.name === selectedVibe}
          <p class="text-xs text-[#9e7ca0] mt-2 tracking-wide font-medium italic animate-fade">
            ✨ "{vibe.tagline}"
          </p>
        {/if}
      {/each}
    </div>

    <!-- Vibe Color Pills -->
    <div class="flex flex-wrap gap-2 md:gap-3 justify-center mb-12 select-none">
      {#each vibes as vibe}
        <button
          onclick={() => selectedVibe = vibe.name}
          class="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider transition-all duration-300 border shadow-sm cursor-pointer hover:scale-105 focus:outline-none"
          style="
            background: {selectedVibe === vibe.name ? vibe.hex : 'rgba(255,255,255,0.7)'};
            color: {selectedVibe === vibe.name ? 'white' : 'var(--color-text-dark)'};
            border-color: {selectedVibe === vibe.name ? vibe.hex : 'rgba(216, 27, 96, 0.15)'};
            text-shadow: {selectedVibe === vibe.name ? '0 1px 4px rgba(0,0,0,0.3)' : 'none'};
          "
          aria-pressed={selectedVibe === vibe.name}
        >
          <span class="text-base leading-none shrink-0" aria-hidden="true">{vibe.emoji}</span>
          <span>{vibe.name}</span>
        </button>
      {/each}
    </div>

    <!-- Inline Filtered Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each filteredProducts as card (card.id)}
        {@const cardStyle = getCardVisualStyles(card.color)}
        <div 
          class="group rounded-3xl p-4 border transition-all duration-500 hover:scale-[1.03] flex flex-col relative overflow-hidden select-none hover:shadow-2xl"
          class:bg-zinc-900={cardStyle.darkCard}
          class:text-white={cardStyle.darkCard}
          style="{cardStyle.bg} border-color: {cardStyle.darkCard ? 'rgba(255,255,255,0.08)' : 'rgba(216, 27, 96, 0.08)'};"
        >
          <!-- Shiny Animated Glitter Overlay on Hover -->
          <div class="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.8)_0%,transparent_50%)] pointer-events-none" aria-hidden="true"></div>

          <!-- Product Image Block (takes 80% visual height) -->
          <div 
            class="relative w-full aspect-square rounded-2xl overflow-hidden mb-4 bg-black/5 flex items-center justify-center cursor-zoom-in border border-black/5"
            onclick={() => openLightbox(card)}
            role="button"
            tabindex="0"
            onkeydown={(e) => { if (e.key === 'Enter') openLightbox(card); }}
            aria-label="Inspect color details"
          >
            <img 
              src={card.image} 
              alt={card.name} 
              class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            
            <!-- Sale / Discount Badges -->
            <div class="absolute top-3 left-3 flex flex-col gap-1 z-10 pointer-events-none">
              {#each card.badges as badge}
                <span 
                  class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white shadow-sm"
                  style="background-color: {badge === 'Sale' ? 'var(--color-brand-magenta)' : badge === 'Best Seller' ? 'var(--color-gold)' : 'var(--color-mint-deep)'};"
                >
                  {badge}
                </span>
              {/each}
            </div>

            <!-- Frosted Quick Add button on Hover -->
            <div 
              class="absolute bottom-3 left-3 right-3 transition-all duration-300 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 z-10"
              onclick={(e) => { e.stopPropagation(); }}
              onkeydown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
              role="button"
              tabindex="0"
            >
              <button 
                onclick={() => handleQuickAdd(card)}
                class="w-full py-3 bg-[var(--color-brand-magenta)] text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-[#b0134b] transition-all hover:scale-[1.01] cursor-pointer"
              >
                {addingId === card.id ? '✓ Added' : '+ Add to Bag'}
              </button>
            </div>
          </div>

          <!-- Card text info -->
          <div class="flex flex-col gap-1.5 mt-auto">
            <div class="flex items-start justify-between gap-2">
              <a 
                href="/product/{card.slug}" 
                class="font-display text-lg font-extrabold tracking-tight hover:text-[var(--color-brand-magenta)] transition-colors truncate"
                style="color: {cardStyle.darkCard ? 'white' : 'var(--color-text-dark)'};"
              >
                {card.name}
              </a>
              
              <!-- Color pill display -->
              <span 
                class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-black/10 select-none shrink-0"
                style="background-color: {card.hex}; color: {cardStyle.darkCard ? 'white' : '#2d1b2e'}; text-shadow: 0 0 4px rgba(255,255,255,0.4);"
              >
                {card.color}
              </span>
            </div>

            <div class="flex items-baseline justify-between mt-1">
              <div class="flex items-center gap-2">
                <span class="text-lg font-black" class:glow-price-drop={card.originalPrice} style="color: {cardStyle.darkCard ? 'white' : 'var(--color-text-dark)'};">₹{card.price}</span>
                {#if card.originalPrice}
                  <span class="text-sm line-through font-light opacity-60">₹{card.originalPrice}</span>
                {/if}
              </div>
              
              {#if card.originalPrice}
                <span class="text-[10px] font-bold text-[var(--color-brand-magenta)]">
                  Save {Math.round((1 - card.price / card.originalPrice) * 100)}%
                </span>
              {/if}
            </div>
          </div>

        </div>
      {:else}
        <div class="col-span-full text-center py-12 text-[#9e7ca0] text-sm font-light">
          No premium styles found matching the '{selectedVibe}' vibe right now.
        </div>
      {/each}
    </div>

  </div>
</section>

<!-- Lightbox Fullscreen Modal -->
<ProductModal 
  images={lightboxImages} 
  activeImage={lightboxActiveIdx} 
  isOpen={isLightboxOpen} 
  onClose={() => isLightboxOpen = false} 
/>

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