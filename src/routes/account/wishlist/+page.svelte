<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { wishlistStore } from '$lib/stores/wishlist.svelte';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { WishlistRow, SupabaseProduct } from '$lib/types';

  let wishlist = $state<(WishlistRow & { product: SupabaseProduct })[]>([]);
  let loading = $state(true);
  let removing = $state<string | null>(null);

  onMount(async () => {
    await authStore.init();
    if (authStore.user) await loadWishlist();
    loading = false;
  });

  async function loadWishlist() {
    // Also refresh the store so it stays in sync with DB
    await wishlistStore.reload();
    const { data, error } = await supabase
      .from('wishlist')
      .select('*, product:product_id(*)')
      .eq('user_id', authStore.user!.id)
      .order('created_at', { ascending: false });
    if (error) { uiStore.addToast('Could not load wishlist: ' + error.message, 'error'); return; }
    wishlist = (data ?? []) as any;
  }

  async function removeFromWishlist(id: string, productId: string) {
    removing = id;
    const { error } = await supabase.from('wishlist').delete().eq('id', id).eq('user_id', authStore.user!.id);
    if (error) { uiStore.addToast('Failed to remove: ' + error.message, 'error'); removing = null; return; }
    wishlist = wishlist.filter(w => w.id !== id);
    // Sync the store so ProductCard hearts reflect the change
    await wishlistStore.reload();
    removing = null;
    uiStore.addToast('Removed from wishlist', 'info');
  }

  function moveToCart(item: WishlistRow & { product: SupabaseProduct }) {
    const p = item.product;
    const images = (p.images ?? []) as any[];
    const colors = (p.colors ?? []) as any[];

    // Open size modal
    const productShape = {
      id: p.id,
      name: p.name,
      price: Math.round(p.price / 100),
      sizes: p.sizes ?? ['36', '37', '38', '39', '40', '41', '42'],
      availableSizes: p.sizes ?? ['36', '37', '38', '39', '40', '41', '42'],
      image: images[0]?.url ?? images[0] ?? '',
      colorName: colors[0]?.name ?? 'Blossom'
    };

    uiStore.openQuickSize(productShape, (selectedSize) => {
      cartStore.addItem({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: images[0]?.url ?? images[0] ?? '',
        price: Math.round(p.price / 100),
        originalPrice: p.original_price ? Math.round(p.original_price / 100) : undefined,
        color: colors[0] ?? { name: 'Default', hex: '#f4a7c3' },
        size: selectedSize,
        quantity: 1,
      });
      uiStore.addToast(`${p.name} (Size ${selectedSize}) added to cart! 🛍️`, 'success');
    });
  }

  function fmt(paise: number) {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
</script>

<svelte:head><title>My Wishlist — French Toes</title></svelte:head>

<div class="flex flex-col gap-6">
  <h2 class="font-display text-2xl font-bold" style="color: var(--color-text-dark);">My Wishlist ❤️</h2>

  {#if loading}
    <div class="flex justify-center py-16"><div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color: var(--color-blush); border-top-color: var(--color-blush-deep);"></div></div>
  {:else if wishlist.length === 0}
    <div class="text-center py-16 rounded-2xl border" style="border-color: var(--color-blush); background: white;">
      <span class="text-4xl block mb-4">💝</span>
      <p class="font-semibold text-lg mb-2" style="color: var(--color-text-dark);">Your wishlist is empty</p>
      <p class="text-sm mb-4" style="color: var(--color-text-soft);">Save your favourite styles here for later.</p>
      <a href="/shop" class="btn-primary">Browse Products</a>
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {#each wishlist as item (item.id)}
        {@const p = item.product}
        {@const images = (p.images ?? []) as any[]}
        <div class="rounded-2xl overflow-hidden border group transition-all hover:-translate-y-1 hover:shadow-lg" style="border-color: var(--color-blush); background: white;">
          <!-- Image -->
          <a href="/product/{p.slug}" class="block relative overflow-hidden aspect-square" style="background: var(--color-blush);">
            {#if images.length > 0}
              <img
                src={images[0]?.url ?? images[0]}
                alt={p.name}
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            {:else}
              <div class="w-full h-full flex items-center justify-center text-3xl" aria-hidden="true">👡</div>
            {/if}
            <!-- Remove button -->
            <button
              onclick={(e) => { e.preventDefault(); removeFromWishlist(item.id, p.id); }}
              disabled={removing === item.id}
              class="absolute top-2 right-2 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm transition-opacity opacity-0 group-hover:opacity-100"
              aria-label="Remove from wishlist"
            >
              {#if removing === item.id}
                <div class="w-3 h-3 border-2 rounded-full animate-spin" style="border-color: var(--color-blush-deep); border-top-color: transparent;"></div>
              {:else}
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="color: #ef4444;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              {/if}
            </button>
          </a>

          <!-- Info -->
          <div class="p-3">
            <a href="/product/{p.slug}">
              <p class="font-semibold text-sm truncate" style="color: var(--color-text-dark);">{p.name}</p>
            </a>
            <div class="flex items-center gap-2 mt-1">
              <span class="font-bold text-sm" style="color: var(--color-blush-deep);">{fmt(p.price)}</span>
              {#if p.original_price}
                <span class="text-xs line-through" style="color: var(--color-text-soft);">{fmt(p.original_price)}</span>
              {/if}
            </div>
            <!-- Stock status -->
            {#if p.stock_status === 'out_of_stock'}
              <p class="text-xs mt-1" style="color: #ef4444;">Out of stock</p>
            {:else}
              <button
                onclick={() => moveToCart(item)}
                class="w-full mt-2 py-2 rounded-xl text-xs font-semibold transition-all"
                style="background: var(--color-blush); color: var(--color-blush-deep);"
              >
                Add to Cart 🛍️
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
