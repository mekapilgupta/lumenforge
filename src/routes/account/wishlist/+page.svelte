<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { wishlistStore } from '$lib/stores/wishlist.svelte';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchProducts } from '$lib/api/products';
  import type { WishlistRow, SupabaseProduct } from '$lib/types';
  import { mapDBProductToFrontend } from '$lib/api/products';

  interface WishlistItem {
    id: string; // row id or product id
    productId: string;
    product: SupabaseProduct;
  }

  let wishlist = $state<WishlistItem[]>([]);
  let loading = $state(true);
  let removing = $state<string | null>(null);

  onMount(async () => {
    await authStore.init();
    await loadWishlist();
    loading = false;
  });

  async function loadWishlist() {
    await wishlistStore.reload();
    
    if (authStore.user) {
      try {
        const { data, error } = await supabase
          .from('wishlist')
          .select(`
            *,
            product:product_id(
              id, slug, name, base_price, description, brand, category,
              variants:product_variants(*, images:product_images(*))
            )
          `)
          .eq('user_id', authStore.user.id)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          wishlist = data.map((row: any) => ({
            id: row.id,
            productId: row.product_id,
            product: row.product ? mapDBProductToFrontend(row.product) : null
          })).filter((r: any) => r.product) as WishlistItem[];
          return;
        }
      } catch (err) {
        console.warn('Wishlist load error:', err);
      }
    }

    // Guest mode or fallback from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ft_wishlist_ids');
      const ids: string[] = saved ? JSON.parse(saved) : [];
      if (ids.length > 0) {
        const allProds = await fetchProducts();
        wishlist = ids.map(id => {
          const [baseId, rawColor] = id.includes('__color_')
            ? id.split('__color_')
            : id.includes('?color=')
              ? id.split('?color=')
              : [id, null];

          const cleanColor = rawColor ? decodeURIComponent(rawColor).toLowerCase().trim() : null;
          const matched = allProds.find(p => p.id === baseId || p.slug === baseId);
          
          if (matched) {
            let colorName = cleanColor ? cleanColor.charAt(0).toUpperCase() + cleanColor.slice(1) : (matched.colors?.[0]?.name || 'Default');
            let colorImg = matched.thumbnail_url || '/placeholder.jpg';
            let colorHex = '#d9cdbd';

            if (cleanColor) {
              if (cleanColor.includes('peach')) {
                colorName = 'Peach';
                colorImg = '/images/products/miami3/peach/1.jpg';
                colorHex = '#f4a7c3';
              } else if (cleanColor.includes('beige')) {
                colorName = 'Beige';
                colorImg = '/images/products/miami3/beige/1.jpg';
                colorHex = '#d9cdbd';
              } else if (cleanColor.includes('black')) {
                colorName = 'Classic Black';
                colorImg = '/images/products/miami3/black/1.jpg';
                colorHex = '#1a1a1a';
              } else {
                const matchedColorObj = (matched.colors || []).find((c: any) => 
                  c.name?.toLowerCase().includes(cleanColor)
                );
                if (matchedColorObj) {
                  colorName = matchedColorObj.name;
                  colorImg = matchedColorObj.image || colorImg;
                  colorHex = matchedColorObj.hex || colorHex;
                }
              }
            }

            return {
              id: id,
              productId: matched.id,
              product: {
                ...matched,
                name: cleanColor && !matched.name.toLowerCase().includes(cleanColor) ? `${matched.name} — ${colorName}` : matched.name,
                thumbnail_url: colorImg,
                images: [{ url: colorImg, alt: matched.name }],
                colors: [{ name: colorName, hex: colorHex, image: colorImg }]
              }
            };
          }

          // Fallback if matching MIAMI 3 variants
          if (id.includes('miami3') || id.includes('miami-3') || cleanColor) {
            const isPeach = cleanColor ? cleanColor.includes('peach') : id.includes('peach');
            const isBeige = cleanColor ? cleanColor.includes('beige') : id.includes('beige');
            const colName = isPeach ? 'Peach' : isBeige ? 'Beige' : 'Classic Black';
            const colImg = isPeach ? '/images/products/miami3/peach/1.jpg' : isBeige ? '/images/products/miami3/beige/1.jpg' : '/images/products/miami3/black/1.jpg';
            const colHex = isPeach ? '#f4a7c3' : isBeige ? '#d9cdbd' : '#1a1a1a';
            return {
              id: id,
              productId: id,
              product: {
                id: id,
                slug: 'miami-3',
                name: `The MIAMI 3 Slide — ${colName}`,
                price: 139900,
                original_price: 199900,
                thumbnail_url: colImg,
                images: [{ url: colImg, alt: 'MIAMI 3' }],
                colors: [{ name: colName, hex: colHex, image: colImg }],
                sizes: [36, 37, 38, 39, 40, 41],
                category_name: 'Footwear',
                category_slug: 'footwear',
                description: 'Ultra-cushioned everyday comfort slipper'
              } as any
            };
          }
          return null;
        }).filter(Boolean) as WishlistItem[];
      } else {
        wishlist = [];
      }
    }
  }

  async function handleRemove(item: WishlistItem) {
    removing = item.id;
    await wishlistStore.remove(item.productId || item.id);
    wishlist = wishlist.filter(w => w.id !== item.id);
    removing = null;
    uiStore.addToast('Removed from wishlist', 'info');
  }

  async function handleClearAll() {
    if (!confirm('Are you sure you want to remove all items from your wishlist?')) return;
    for (const item of wishlist) {
      await wishlistStore.remove(item.productId || item.id);
    }
    wishlist = [];
    uiStore.addToast('Wishlist cleared', 'info');
  }

  function moveToCart(item: WishlistItem) {
    const p = item.product;
    const images = (p.images ?? []) as any[];
    const colors = (p.colors ?? []) as any[];

    const productShape = {
      id: p.id,
      name: p.name,
      price: Math.round(p.price / 100),
      sizes: p.sizes ?? ['36', '37', '38', '39', '40', '41'],
      availableSizes: p.sizes ?? ['36', '37', '38', '39', '40', '41'],
      image: images[0]?.url ?? images[0] ?? p.thumbnail_url ?? '',
      colorName: colors[0]?.name ?? 'Default'
    };

    uiStore.openQuickSize(productShape, (selectedSize) => {
      cartStore.addItem({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: images[0]?.url ?? images[0] ?? p.thumbnail_url ?? '',
        price: Math.round(p.price / 100),
        originalPrice: p.original_price ? Math.round(p.original_price / 100) : undefined,
        color: colors[0] ?? { name: 'Default', hex: '#d9cdbd' },
        size: Number(selectedSize) || 38,
        quantity: 1,
      });
      uiStore.addToast(`${p.name} (Size ${selectedSize}) added to bag! 🛍️`, 'success');
    });
  }

  function fmt(paise: number) {
    return '₹' + Math.round(paise / 100).toLocaleString('en-IN');
  }
</script>

<svelte:head>
  <title>My Wishlist — French Toes</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
  <div class="flex items-center justify-between border-b border-[#E8E4E0] pb-4">
    <div>
      <h1 class="font-serif text-2xl sm:text-3xl font-normal text-[#1A1A1A]">My Wishlist</h1>
      <p class="text-xs text-[#6B6B6B] mt-1">{wishlist.length} saved item{wishlist.length === 1 ? '' : 's'}</p>
    </div>
    <div class="flex items-center gap-4">
      {#if wishlist.length > 0}
        <button
          onclick={handleClearAll}
          class="text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors uppercase tracking-wider"
        >
          Clear All
        </button>
      {/if}
      <a href="/shop" class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] hover:underline">
        Continue Shopping &rarr;
      </a>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if wishlist.length === 0}
    <div class="text-center py-20 rounded-2xl border border-[#E8E4E0] bg-[#F9F6F2] p-8 max-w-md mx-auto">
      <div class="w-16 h-16 rounded-full bg-white flex items-center justify-center text-2xl mx-auto mb-4 shadow-sm">
        <svg width="24" height="24" fill="none" stroke="#D4A5A5" stroke-width="2" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7c0 4.9-7 9.3-7 9.3Z"/></svg>
      </div>
      <h2 class="font-serif text-xl font-normal text-[#1A1A1A] mb-2">Your wishlist is empty</h2>
      <p class="text-xs text-[#6B6B6B] mb-6">Explore our comfortable collections and tap the heart icon on any pair to save it here.</p>
      <a href="/shop" class="btn-primary inline-flex px-8 py-3 text-xs uppercase tracking-wider font-semibold">
        Explore Collection
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {#each wishlist as item (item.id)}
        {@const p = item.product}
        {@const rawImages = (p.images ?? []) as any[]}
        {@const imgUrl = rawImages[0]?.url ?? rawImages[0] ?? p.thumbnail_url ?? '/placeholder.jpg'}
        {@const prodColor = (p.colors?.[0]?.name || 'beige').toLowerCase()}
        {@const prodHref = `/products/${p.slug}?color=${encodeURIComponent(prodColor)}`}
        <div class="bg-white rounded-2xl overflow-hidden border border-[#E8E4E0] shadow-sm hover:shadow-lg transition-all flex flex-col group relative">
          <!-- Image -->
          <div class="relative aspect-[4/5] bg-[#F9F6F2] overflow-hidden">
            <a href={prodHref} class="block w-full h-full">
              <img
                src={imgUrl}
                alt={p.name}
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </a>

            <!-- Remove Button -->
            <button
              onclick={() => handleRemove(item)}
              disabled={removing === item.id}
              class="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 text-gray-400 hover:text-red-600 shadow-md flex items-center justify-center transition-colors cursor-pointer"
              title="Remove from wishlist"
              aria-label="Remove {p.name} from wishlist"
            >
              {#if removing === item.id}
                <div class="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              {:else}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              {/if}
            </button>
          </div>

          <!-- Body -->
          <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
            <div>
              <a href={prodHref} class="block">
                <h3 class="text-xs sm:text-sm font-semibold text-[#1A1A1A] hover:text-[#D4A5A5] transition-colors line-clamp-1">
                  {p.name}
                </h3>
              </a>
              <div class="flex items-baseline gap-2 mt-1">
                <span class="text-sm sm:text-base font-bold text-[#1A1A1A]">{fmt(p.price)}</span>
                {#if p.original_price}
                  <span class="text-xs text-[#9A9A9A] line-through">{fmt(p.original_price)}</span>
                {/if}
              </div>
            </div>

            <div class="flex flex-col gap-2 pt-2 border-t border-[#F0ECE8]">
              <button
                onclick={() => moveToCart(item)}
                class="w-full py-2.5 rounded-lg bg-[#1A1A1A] text-white text-xs font-semibold tracking-wider uppercase hover:bg-black transition-all"
              >
                + Move to Bag
              </button>
              <button
                onclick={() => handleRemove(item)}
                class="w-full py-1.5 text-[11px] text-gray-500 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
