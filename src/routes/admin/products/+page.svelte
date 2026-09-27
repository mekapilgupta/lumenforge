<script lang="ts">
  import { onMount } from 'svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { formatCurrency, getImageKitUrl } from '$lib/types/product';
  import type { CompleteProduct, ProductStatus } from '$lib/types/product';

  let products = $state<CompleteProduct[]>([]);
  let loading = $state(true);

  // Search & Filters
  let searchQuery = $state('');
  let selectedStatus = $state<'all' | ProductStatus>('all');
  let selectedCategory = $state('all');
  let sortBy = $state<'newest' | 'price_asc' | 'price_desc' | 'name_asc'>('newest');

  // Deleting state
  let deletingId = $state<string | null>(null);

  onMount(async () => {
    await fetchProducts();
  });

  async function fetchProducts() {
    loading = true;
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(
            *,
            images:product_images(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading products:', error);
        uiStore.addToast('Failed to fetch products: ' + error.message, 'error');
        products = [];
      } else {
        // Sort variants and images
        products = (data || []).map((p: any) => ({
          ...p,
          variants: (p.variants || [])
            .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            .map((v: any) => ({
              ...v,
              images: (v.images || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            }))
        }));
      }
    } catch (e: any) {
      console.error('Error loading products:', e);
      uiStore.addToast(e.message || 'Error loading products', 'error');
    } finally {
      loading = false;
    }
  }

  // Quick Status Toggle (Publish / Draft / Archive)
  async function updateProductStatus(id: string, newStatus: ProductStatus) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      products = products.map(p => p.id === id ? { ...p, status: newStatus } : p);
      uiStore.addToast(`Product status updated to ${newStatus}.`, 'success');
    } catch (e: any) {
      uiStore.addToast('Failed to update status: ' + e.message, 'error');
    }
  }

  // Delete Product with cascade
  async function deleteProduct(id: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    deletingId = id;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      products = products.filter(p => p.id !== id);
      uiStore.addToast(`Deleted "${name}".`, 'info');
    } catch (e: any) {
      uiStore.addToast('Failed to delete product: ' + e.message, 'error');
    } finally {
      deletingId = null;
    }
  }

  // Categories list
  const categories = $derived.by(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  });

  // Filtered & Sorted products
  const filteredProducts = $derived.by(() => {
    let list = [...products];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        p.variants?.some(v => v.sku.toLowerCase().includes(q) || v.color_name.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (selectedStatus !== 'all') {
      list = list.filter(p => p.status === selectedStatus);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category === selectedCategory);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'price_asc') return (a.base_price || 0) - (b.base_price || 0);
      if (sortBy === 'price_desc') return (b.base_price || 0) - (a.base_price || 0);
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  });

  // Get primary thumbnail image for a product
  function getProductThumbnail(product: CompleteProduct): string {
    const defaultVariant = product.variants?.find(v => v.is_default) || product.variants?.[0];
    if (defaultVariant?.images && defaultVariant.images.length > 0) {
      const primaryImg = defaultVariant.images.find(img => img.is_primary) || defaultVariant.images[0];
      return getImageKitUrl(primaryImg.image_url, 'w-150,q-80');
    }
    // Fallback if other variants have images
    for (const v of product.variants || []) {
      if (v.images && v.images.length > 0) {
        return getImageKitUrl(v.images[0].image_url, 'w-150,q-80');
      }
    }
    return '';
  }

  // Calculate total inventory
  function getTotalStock(product: CompleteProduct): number {
    return (product.variants || []).reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
  }
</script>

<svelte:head>
  <title>Products Management — French Toes Admin</title>
</svelte:head>

<div class="space-y-6 pb-12">
  <!-- Top Bar: Title & Create Action -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-white tracking-tight">Products Catalogue</h1>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
          {products.length} {products.length === 1 ? 'Product' : 'Products'}
        </span>
      </div>
      <p class="text-xs text-gray-400 mt-1">Manage products, color variants, ImageKit media, and stock levels.</p>
    </div>

    <a
      href="/admin/products/new"
      class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white font-bold text-sm shadow-lg transition-all"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
      + Add New Product
    </a>
  </div>

  <!-- Search, Filters, and Sorting Controls -->
  <div class="bg-[#1a1b29] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
    <!-- Search Bar -->
    <div class="relative w-full md:w-96">
      <svg class="absolute left-3.5 top-3 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search title, SKU, color, or slug..."
        class="w-full bg-[#13141f] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
      />
    </div>

    <!-- Filter Dropdowns -->
    <div class="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
      <!-- Status Filter -->
      <select
        bind:value={selectedStatus}
        class="bg-[#13141f] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-pink-500"
      >
        <option value="all">All Statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
        <option value="archived">Archived</option>
      </select>

      <!-- Category Filter -->
      {#if categories.length > 0}
        <select
          bind:value={selectedCategory}
          class="bg-[#13141f] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-pink-500"
        >
          <option value="all">All Categories</option>
          {#each categories as cat}
            <option value={cat}>{cat}</option>
          {/each}
        </select>
      {/if}

      <!-- Sort By -->
      <select
        bind:value={sortBy}
        class="bg-[#13141f] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-pink-500"
      >
        <option value="newest">Sort: Newest</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="name_asc">Alphabetical</option>
      </select>
    </div>
  </div>

  <!-- Products List / Table -->
  {#if loading}
    <div class="bg-[#1a1b29] border border-white/10 rounded-2xl p-16 text-center shadow-xl">
      <div class="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-sm font-semibold text-gray-300">Loading products catalogue...</p>
    </div>
  {:else if filteredProducts.length === 0}
    <div class="bg-[#1a1b29] border border-white/10 rounded-2xl p-16 text-center shadow-xl space-y-4">
      <div class="w-16 h-16 rounded-full bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
      </div>
      <div>
        <h3 class="text-base font-bold text-white">No products found</h3>
        <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
          {searchQuery || selectedStatus !== 'all' || selectedCategory !== 'all' 
            ? 'Try changing your search keywords or filter criteria.' 
            : 'Get started by creating your first product with color variants and images.'}
        </p>
      </div>
      <div>
        <a
          href="/admin/products/new"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-lg transition-colors"
        >
          + Create Product Wizard
        </a>
      </div>
    </div>
  {:else}
    <div class="bg-[#1a1b29] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-white/10 text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-[#13141f]/60">
              <th class="py-3.5 px-4">Product</th>
              <th class="py-3.5 px-4">Category & Brand</th>
              <th class="py-3.5 px-4">Color Variants</th>
              <th class="py-3.5 px-4">Base Price</th>
              <th class="py-3.5 px-4">Stock</th>
              <th class="py-3.5 px-4">Status</th>
              <th class="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-sm">
            {#each filteredProducts as product (product.id)}
              {@const thumbnail = getProductThumbnail(product)}
              {@const totalStock = getTotalStock(product)}
              <tr class="hover:bg-white/[0.02] transition-colors">
                <!-- Product Image & Name -->
                <td class="py-4 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-[#13141f] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {#if thumbnail}
                        <img src={thumbnail} alt={product.name} class="w-full h-full object-cover" />
                      {:else}
                        <svg width="20" height="20" class="text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      {/if}
                    </div>
                    <div>
                      <a href="/admin/products/{product.id}/edit" class="font-bold text-white hover:text-pink-400 transition-colors">
                        {product.name}
                      </a>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[11px] font-mono text-gray-400">/{product.slug}</span>
                        <a
                          href="/products/{product.slug}"
                          target="_blank"
                          title="Open storefront product page"
                          class="text-gray-500 hover:text-pink-300 transition-colors"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Category & Brand -->
                <td class="py-4 px-4 text-xs">
                  <p class="font-medium text-gray-200">{product.category || 'Footwear'}</p>
                  <p class="text-gray-500">{product.brand || 'French Toes'}</p>
                </td>

                <!-- Variants & Swatches -->
                <td class="py-4 px-4">
                  <div class="space-y-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      {#each (product.variants || []).slice(0, 5) as v}
                        <span
                          class="w-4 h-4 rounded-full border border-white/20 inline-block shadow-sm"
                          style="background-color: {v.color_hex || '#000'};"
                          title="{v.color_name} ({v.images?.length || 0} images)"
                        ></span>
                      {/each}
                      {#if (product.variants || []).length > 5}
                        <span class="text-[10px] text-gray-400 font-bold">+{product.variants.length - 5}</span>
                      {/if}
                    </div>
                    <span class="text-[11px] text-gray-400 block">
                      {product.variants?.length || 0} {product.variants?.length === 1 ? 'color' : 'colors'}
                    </span>
                  </div>
                </td>

                <!-- Price Column -->
                <td class="py-4 px-4 text-xs font-mono">
                  <span class="font-bold text-white block">{formatCurrency(product.base_price)}</span>
                  {#if product.compare_at_price && Number(product.compare_at_price) > Number(product.base_price)}
                    <span class="text-[11px] text-gray-400 line-through block">{formatCurrency(product.compare_at_price)}</span>
                  {/if}
                </td>

                <!-- Total Stock -->
                <td class="py-4 px-4 text-xs">
                  <span class="font-mono font-semibold {totalStock > 0 ? 'text-gray-200' : 'text-red-400'}">
                    {totalStock} units
                  </span>
                </td>

                <!-- Status Pill -->
                <td class="py-4 px-4">
                  {#if product.status === 'published'}
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Published
                    </span>
                  {:else if product.status === 'draft'}
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Draft
                    </span>
                  {:else}
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30 inline-flex items-center gap-1">
                      Archived
                    </span>
                  {/if}
                </td>

                <!-- Actions -->
                <td class="py-4 px-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <a
                      href="/admin/products/{product.id}/edit"
                      class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium border border-white/10 transition-colors"
                    >
                      Edit
                    </a>

                    {#if product.status === 'published'}
                      <button
                        type="button"
                        onclick={() => updateProductStatus(product.id, 'archived')}
                        class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-300 text-xs transition-colors border border-white/10"
                        title="Archive Product"
                      >
                        Archive
                      </button>
                    {:else if product.status === 'archived'}
                      <button
                        type="button"
                        onclick={() => updateProductStatus(product.id, 'published')}
                        class="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs transition-colors border border-emerald-500/20"
                        title="Publish Product"
                      >
                        Publish
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={() => updateProductStatus(product.id, 'published')}
                        class="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs transition-colors border border-emerald-500/20"
                        title="Publish Draft"
                      >
                        Publish
                      </button>
                    {/if}

                    <button
                      type="button"
                      disabled={deletingId === product.id}
                      onclick={() => deleteProduct(product.id, product.name)}
                      class="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors disabled:opacity-30"
                      title="Delete Product"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
