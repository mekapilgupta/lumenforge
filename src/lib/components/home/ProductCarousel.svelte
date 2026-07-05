<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import CarouselProductCard from '$lib/components/product/CarouselProductCard.svelte';

  interface ColorItem {
    id: string;
    name: string;
    hex: string;
    image: string;
    slug: string;
    price: number;
    originalPrice?: number;
    badges: string[];
  }

  interface GroupedProduct {
    modelName: string;
    colors: ColorItem[];
  }

  let dbProducts = $state<any[]>([]);
  let loading = $state(true);
  let carouselRef = $state<HTMLDivElement | null>(null);

  // Grouped products derived from DB only
  const groupedProducts = $derived.by<GroupedProduct[]>(() => {
    console.log('[ProductCarousel] Deriving groupedProducts. dbProducts length:', dbProducts.length);
    if (dbProducts.length > 0) {
      const grouped = groupDBProducts(dbProducts);
      console.log('[ProductCarousel] Grouped DB products output length:', grouped.length);
      return grouped;
    } else {
      console.log('[ProductCarousel] dbProducts is empty. Returning empty array.');
      return [];
    }
  });

  onMount(async () => {
    console.log('[ProductCarousel] Component mounted. Starting fetch from Supabase...');
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);
      if (error) {
        console.error('[ProductCarousel] Supabase query error:', error);
      } else {
        console.log(`[ProductCarousel] Supabase query returned ${data?.length ?? 0} active products.`);
        if (data) {
          dbProducts = data;
        }
      }
    } catch (err) {
      console.error('[ProductCarousel] Exception in onMount:', err);
    } finally {
      loading = false;
      console.log('[ProductCarousel] Fetch complete. Loading state set to false.');
    }
  });

  // Database grouping logic
  function groupDBProducts(prods: any[]): GroupedProduct[] {
    console.log('[ProductCarousel] Grouping DB products. Raw prods count:', prods.length);
    const groups = new Map<string, GroupedProduct>();

    prods.forEach(p => {
      try {
        const modelTag = p.tags?.find((t: string) => t.startsWith('model-'));
        if (!modelTag) {
          console.warn(`[ProductCarousel] Product ID "${p.id}" (${p.name}) does not have a "model-" tag. Skipping.`);
          return;
        }

        const modelKey = modelTag.replace('model-', '');
        const modelName = p.name.split(' - ')[0];
        
        const colorObj = p.colors?.[0] ?? { name: 'Default', hex: '#888' };
        const priceInINR = Math.round(p.price / 100);
        const originalPriceInINR = p.original_price ? Math.round(p.original_price / 100) : undefined;
        const imagesList = (p.images ?? []).map((img: any) => img.url ?? img);
        
        const resolvedImage = imagesList[0] || p.thumbnail_url || '/placeholder.jpg';
        console.log(`[ProductCarousel] Product ID "${p.id}" (${p.name}): Image resolved to: "${resolvedImage}"`);
        
        const colorItem: ColorItem = {
          id: p.id,
          name: colorObj.name,
          hex: colorObj.hex,
          image: resolvedImage,
          slug: p.slug,
          price: priceInINR,
          originalPrice: originalPriceInINR,
          badges: [
            ...(p.is_best_seller ? ['Best Seller'] : []),
            ...(p.is_new_arrival ? ['New Arrival'] : []),
            ...(p.is_limited_edition ? ['Limited Edition'] : []),
            ...(p.original_price ? ['Sale'] : [])
          ]
        };

        if (!groups.has(modelKey)) {
          groups.set(modelKey, {
            modelName,
            colors: [colorItem]
          });
        } else {
          groups.get(modelKey)!.colors.push(colorItem);
        }
      } catch (err) {
        console.error(`[ProductCarousel] Error grouping product ID "${p?.id}":`, err);
      }
    });

    return Array.from(groups.values());
  }



  // Slider controls
  function scroll(direction: 'left' | 'right') {
    if (!carouselRef) return;
    const scrollAmount = 340; // width of card + gap
    carouselRef.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }

  // Quick Add function
  let addingId = $state<string | null>(null);
  function handleQuickAdd(colorItem: ColorItem, modelName: string) {
    // Open size modal
    const productShape = {
      id: colorItem.id,
      name: `${modelName} (${colorItem.name})`,
      price: colorItem.price,
      sizes: [36, 37, 38, 39, 40, 41, 42],
      availableSizes: [36, 37, 38, 39, 40, 41, 42],
      image: colorItem.image,
      colorName: colorItem.name
    };

    uiStore.openQuickSize(productShape, (selectedSize) => {
      addingId = colorItem.id;
      cartStore.addItem({
        productId: colorItem.id,
        slug: colorItem.slug,
        name: `${modelName} (${colorItem.name})`,
        image: colorItem.image,
        price: colorItem.price,
        originalPrice: colorItem.originalPrice,
        color: { name: colorItem.name, hex: colorItem.hex },
        size: selectedSize,
        quantity: 1
      });
      uiStore.addToast(`${modelName} (${colorItem.name} - Size ${selectedSize}) added to bag! 🛍️`, 'success');
      setTimeout(() => { addingId = null; }, 800);
    });
  }
</script>

<section class="py-16 bg-[#FAFAFA] border-b border-[#f0d0db]/20 overflow-hidden relative">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
    
    <!-- Header with Arrows -->
    <div class="flex items-end justify-between mb-10">
      <div>
        <span class="text-xs font-semibold uppercase tracking-widest text-[var(--color-brand-magenta)]">New Drops</span>
        <h2 class="font-display text-3xl md:text-4xl font-bold mt-2 text-[#2d1b2e]">New Arrivals</h2>
      </div>

      <!-- Arrow Buttons (Desktop only) -->
      <div class="hidden md:flex items-center gap-3">
        <button 
          onclick={() => scroll('left')}
          class="w-12 h-12 rounded-full border border-pink-100 flex items-center justify-center bg-white shadow-sm hover:bg-pink-50 hover:text-[var(--color-brand-magenta)] transition-all hover:scale-105 cursor-pointer"
          aria-label="Scroll left"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <button 
          onclick={() => scroll('right')}
          class="w-12 h-12 rounded-full border border-pink-100 flex items-center justify-center bg-white shadow-sm hover:bg-pink-50 hover:text-[var(--color-brand-magenta)] transition-all hover:scale-105 cursor-pointer"
          aria-label="Scroll right"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>

    <!-- Scrollable Row -->
    <div 
      bind:this={carouselRef}
      class="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory scroll-smooth"
      style="-webkit-overflow-scrolling: touch;"
    >
      {#each groupedProducts as product (product.modelName)}
        {#if product.colors.length > 0}
          <CarouselProductCard 
            product={product} 
            colors={product.colors} 
            handleQuickAdd={handleQuickAdd} 
            addingId={addingId} 
          />
        {/if}
      {/each}
    </div>

  </div>
</section>