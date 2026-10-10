<script lang="ts">
  import { onMount } from 'svelte';
  import { wishlistStore } from '$lib/stores/wishlist.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { fetchProducts } from '$lib/api/products';
  import { PASTEL_COLORS } from '$lib/data/products';
  import type { SupabaseProduct } from '$lib/types';

  // Fallback products from client photoshoot if DB is empty
  const clientFallbackVariants = [
    {
      id: 'miami3-beige',
      name: 'The MIAMI 3 Comfort Slide — Beige',
      color: 'beige',
      price: 1399,
      originalPrice: 1999,
      rating: 4.9,
      reviewsCount: 1208,
      flag: 'Save 30%',
      image: '/images/products/miami3/beige/1.jpg',
      slug: 'miami-3'
    },
    {
      id: 'miami3-black',
      name: 'The MIAMI 3 Comfort Slide — Classic Black',
      color: 'black',
      price: 1399,
      originalPrice: 1999,
      rating: 4.9,
      reviewsCount: 940,
      flag: 'Bestseller',
      image: '/images/products/miami3/black/1.jpg',
      slug: 'miami-3'
    },
    {
      id: 'miami3-peach',
      name: 'The MIAMI 3 Comfort Slide — Soft Peach',
      color: 'peach',
      price: 1399,
      originalPrice: 1999,
      rating: 4.8,
      reviewsCount: 680,
      flag: 'Save 30%',
      image: '/images/products/miami3/peach/1.jpg',
      slug: 'miami-3'
    },
    {
      id: 'contour-flat-tan',
      name: 'The Contour Everyday Flat — Tan',
      color: 'tan',
      price: 1449,
      originalPrice: 1899,
      rating: 4.8,
      reviewsCount: 512,
      flag: 'New',
      image: '/images/client/Uewntitled.png',
      slug: 'miami-3'
    },
    {
      id: 'blush-bow-rose',
      name: 'The Blush Bow Slipper — Rose',
      color: 'rose',
      price: 1349,
      originalPrice: 1799,
      rating: 4.9,
      reviewsCount: 420,
      flag: 'Save 25%',
      image: '/images/client/qqUntitled.png',
      slug: 'miami-3'
    },
    {
      id: 'feather-soft-mule',
      name: 'The Feather-Soft Mule — Nude',
      color: 'nude',
      price: 1549,
      originalPrice: 1999,
      rating: 4.7,
      reviewsCount: 310,
      flag: 'Bestseller',
      image: '/images/client/Uncvlustitled.jpg',
      slug: 'miami-3'
    },
    {
      id: 'daily-comfort-slide',
      name: 'The Daily Comfort Slide — Sand',
      color: 'sand',
      price: 1299,
      originalPrice: 1699,
      rating: 4.8,
      reviewsCount: 280,
      flag: 'Save 25%',
      image: '/images/client/Unasaqtitled.jpg',
      slug: 'miami-3'
    },
    {
      id: 'soft-wedge-tan',
      name: 'The Soft Block Wedge — Tan',
      color: 'tan',
      price: 1649,
      originalPrice: 2199,
      rating: 4.8,
      reviewsCount: 195,
      flag: 'New',
      image: '/images/client/Udfdgntitled.png',
      slug: 'miami-3'
    }
  ];

  let dbProducts = $state<SupabaseProduct[]>([]);
  let loading = $state(true);

  function getNormalizedColors(raw: any): { name: string; hex: string; image?: string }[] {
    if (!raw) return [{ name: 'Default', hex: '#f4a7c3' }];
    let arr = raw;
    if (typeof arr === 'string') {
      try { arr = JSON.parse(arr); } catch { arr = [arr]; }
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      return [{ name: 'Default', hex: '#f4a7c3' }];
    }
    const seen = new Set<string>();
    const res: { name: string; hex: string; image?: string }[] = [];
    for (const c of arr) {
      let name = 'Default';
      let hex = '#f4a7c3';
      let image: string | undefined = undefined;

      if (typeof c === 'string') {
        name = c.trim();
        const pastel = (PASTEL_COLORS as any)[name.toLowerCase().replace(/\s+/g, '')] || (PASTEL_COLORS as any)[name.toLowerCase()];
        hex = pastel?.hex || '#f4a7c3';
      } else if (typeof c === 'object' && c !== null) {
        name = (c.name || 'Default').trim();
        hex = c.hex || (PASTEL_COLORS as any)[name.toLowerCase().replace(/\s+/g, '')]?.hex || '#f4a7c3';
        image = c.image || undefined;
      }

      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        res.push({ name, hex, image });
      }
    }
    return res.length > 0 ? res : [{ name: 'Default', hex: '#f4a7c3' }];
  }

  onMount(async () => {
    try {
      const prods = await fetchProducts({ sort: 'featured' });
      if (prods && prods.length > 0) {
        dbProducts = prods;
      }
    } catch (err) {
      console.log('[Home] Error loading dynamic products:', err);
    } finally {
      loading = false;
    }
  });

  // Variant expansion logic (same as shop page, showing up to 30 variants)
  const displayList = $derived.by(() => {
    if (dbProducts.length > 0) {
      let list: any[] = [];
      const seenVariantKeys = new Set<string>();

      for (const p of dbProducts) {
        const colors = getNormalizedColors(p.colors);
        const rawImages = Array.isArray(p.images) ? p.images : [];

        for (const color of colors) {
          const colorName = (color.name || 'default').toLowerCase().trim();
          const vKey = `${p.id}_${colorName}`;
          if (seenVariantKeys.has(vKey)) continue;
          seenVariantKeys.add(vKey);

          const colorSpecificImg = color.image 
            || rawImages.find((img: any) => typeof img === 'object' && img?.color && String(img.color).toLowerCase().trim() === colorName)?.url
            || (typeof rawImages[0] === 'string' ? rawImages[0] : rawImages[0]?.url)
            || p.thumbnail_url 
            || '/images/client/Uiintitled.png';

          const priceNum = Math.round(p.price / 100);
          const origNum = p.original_price ? Math.round(p.original_price / 100) : null;
          const flag = p.is_best_seller ? 'Bestseller' : p.is_new_arrival ? 'New' : origNum ? 'Sale' : '';

          const displayName = color.name && color.name !== 'Default' 
            ? `${p.name} — ${color.name}`
            : p.name;

          list.push({
            id: p.id,
            vKey: vKey,
            name: displayName,
            color: colorName,
            price: priceNum,
            originalPrice: origNum,
            rating: p.rating_avg || 4.8,
            reviewsCount: p.rating_count || 120,
            flag,
            image: colorSpecificImg,
            slug: p.slug
          });

          if (list.length >= 30) break;
        }
        if (list.length >= 30) break;
      }

      if (list.length > 0) return list;
    }
    return clientFallbackVariants.map(item => ({ ...item, vKey: item.id }));
  });

  async function toggleWish(p: { id: string; name: string }) {
    const isW = wishlistStore.has(p.id);
    await wishlistStore.toggle(p.id);
    uiStore.addToast(isW ? 'Removed from wishlist' : `${p.name} added to wishlist ❤️`, isW ? 'info' : 'success');
  }
</script>

<section class="py-16 md:py-24 bg-[#F9F6F2] border-b border-[#E8E4E0]">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">Our Collection</p>
        <h2 class="font-serif text-3xl sm:text-4xl text-[#1A1A1A] font-normal tracking-tight">Featured Footwear</h2>
        <p class="text-xs sm:text-sm text-[#6B6B6B] mt-1">Cushioned, lightweight &amp; made for everyday comfort.</p>
      </div>
      <a href="/shop" class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] hover:text-[#D4A5A5] border-b border-[#1A1A1A] pb-0.5 self-start sm:self-auto transition-colors">
        View all styles &rarr;
      </a>
    </div>

    <!-- Product Grid: Clean, Simple, Direct Link to Product Page (No Swatches, No Quick Add) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
      {#each displayList as p (p.vKey)}
        <div class="bg-white rounded-2xl overflow-hidden border border-[#E8E4E0] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group relative">
          <!-- Image Container -->
          <div class="relative aspect-[4/5] bg-[#F9F6F2] overflow-hidden">
            <!-- Flags -->
            {#if p.flag}
              <span class="absolute top-2.5 left-2.5 z-10 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full {p.flag.includes('Save') || p.flag === 'Sale' ? 'bg-[#2E8B7A] text-white' : 'bg-[#1A1A1A] text-white'}">
                {p.flag}
              </span>
            {/if}

            <!-- Product Image Link -->
            <a href="/products/{p.slug}{p.color ? `?color=${encodeURIComponent(p.color.toLowerCase())}` : ''}" class="block w-full h-full">
              <img
                src={p.image}
                alt={p.name}
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </a>
          </div>

          <!-- Body -->
          <div class="p-3.5 sm:p-5 flex-1 flex flex-col justify-between space-y-2">
            <div>
              <a href="/products/{p.slug}{p.color ? `?color=${encodeURIComponent(p.color.toLowerCase())}` : ''}" class="block">
                <h3 class="text-xs sm:text-sm font-semibold text-[#1A1A1A] group-hover:text-[#D4A5A5] transition-colors line-clamp-1">
                  {p.name}
                </h3>
              </a>
              <div class="flex items-center gap-1.5 mt-1 text-[11px] sm:text-xs text-[#6B6B6B]">
                <span class="flex items-center text-[#F5A623]">
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/></svg>
                </span>
                <span>{p.rating} ({p.reviewsCount})</span>
              </div>
            </div>

            <div class="pt-2 border-t border-[#F0ECE8] flex items-baseline gap-2">
              <span class="text-xs sm:text-sm md:text-base font-bold text-[#1A1A1A]">₹{p.price.toLocaleString('en-IN')}</span>
              {#if p.originalPrice}
                <span class="text-[11px] sm:text-xs text-[#9A9A9A] line-through">₹{p.originalPrice.toLocaleString('en-IN')}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>
