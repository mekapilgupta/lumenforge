<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { SupabaseProduct, Category } from '$lib/types';

  let products = $state<SupabaseProduct[]>([]);
  let categories = $state<Category[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let editId = $state<string | null>(null);
  let saving = $state(false);
  let toggling = $state<string | null>(null);

  const emptyForm = () => ({
    name: '', slug: '', tagline: '', description: '', price: '', original_price: '',
    category_id: '', sizes: '', stock_quantity: '50', low_stock_threshold: '10',
    gst_percent: '5', is_featured: false, is_best_seller: false, is_new_arrival: false,
    is_limited_edition: false, is_active: true,
  });
  let form = $state(emptyForm());

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await Promise.all([loadProducts(), loadCategories()]);
    loading = false;
  });

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*, category:category_id(name)').order('created_at', { ascending: false });
    products = (data ?? []) as any;
  }

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
    categories = (data ?? []) as Category[];
  }

  let variants = $state<any[]>([]);
  let loadingVariants = $state(false);
  let showVariantForm = $state(false);
  let newVariant = $state({
    sku: '', size: '', color: '', price_adjustment: '0', stock_quantity: '20', is_active: true
  });

  function startEdit(p: any) {
    editId = p.id;
    form = {
      name: p.name, slug: p.slug, tagline: p.tagline ?? '', description: p.description ?? '',
      price: String(p.price / 100), original_price: p.original_price ? String(p.original_price / 100) : '',
      category_id: p.category_id ?? '', sizes: (p.sizes ?? []).join(', '),
      stock_quantity: String(p.stock_quantity), low_stock_threshold: String(p.low_stock_threshold),
      gst_percent: String(p.gst_percent ?? 5), is_featured: p.is_featured, is_best_seller: p.is_best_seller,
      is_new_arrival: p.is_new_arrival, is_limited_edition: p.is_limited_edition, is_active: p.is_active,
    };
    showForm = true;
    loadVariants(p.id);
  }

  async function loadVariants(productId: string) {
    loadingVariants = true;
    const { data } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    variants = data ?? [];
    loadingVariants = false;
  }

  async function saveVariant() {
    if (!editId) return;
    if (!newVariant.sku) { uiStore.addToast('Variant SKU is required', 'error'); return; }
    
    const payload = {
      product_id: editId,
      sku: newVariant.sku.trim(),
      size: newVariant.size.trim() || null,
      color: newVariant.color.trim() || null,
      price_adjustment: Math.round((parseFloat(newVariant.price_adjustment) || 0) * 100),
      stock_quantity: parseInt(newVariant.stock_quantity) || 0,
      is_active: newVariant.is_active
    };

    const { error } = await supabase.from('product_variants').insert(payload);
    if (error) {
      uiStore.addToast('Failed to add variant: ' + error.message, 'error');
      return;
    }

    uiStore.addToast('Variant created successfully!', 'success');
    newVariant = { sku: '', size: '', color: '', price_adjustment: '0', stock_quantity: '20', is_active: true };
    showVariantForm = false;
    await loadVariants(editId);
  }

  async function updateVariantStock(variantId: string, newStockStr: string) {
    const newStock = parseInt(newStockStr);
    if (isNaN(newStock) || newStock < 0) return;
    const { error } = await supabase
      .from('product_variants')
      .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
      .eq('id', variantId);

    if (error) {
      uiStore.addToast('Stock update failed: ' + error.message, 'error');
      return;
    }
    uiStore.addToast('Variant stock updated', 'success');
    if (editId) await loadVariants(editId);
  }

  async function updateVariantPriceAdjustment(variantId: string, newPriceAdjStr: string) {
    const newPriceAdj = Math.round((parseFloat(newPriceAdjStr) || 0) * 100);
    const { error } = await supabase
      .from('product_variants')
      .update({ price_adjustment: newPriceAdj, updated_at: new Date().toISOString() })
      .eq('id', variantId);

    if (error) {
      uiStore.addToast('Price adjustment update failed: ' + error.message, 'error');
      return;
    }
    uiStore.addToast('Variant price adjustment updated', 'success');
    if (editId) await loadVariants(editId);
  }

  async function deleteVariant(variantId: string) {
    if (!confirm('Are you sure you want to delete this variant?')) return;
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', variantId);

    if (error) {
      uiStore.addToast('Variant deletion failed: ' + error.message, 'error');
      return;
    }
    uiStore.addToast('Variant deleted', 'success');
    if (editId) await loadVariants(editId);
  }

  async function toggleVariantActive(variantId: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('product_variants')
      .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
      .eq('id', variantId);

    if (error) {
      uiStore.addToast('Status toggle failed: ' + error.message, 'error');
      return;
    }
    uiStore.addToast(!currentStatus ? 'Variant activated' : 'Variant deactivated', 'success');
    if (editId) await loadVariants(editId);
  }

  async function saveProduct() {
    if (!form.name || !form.slug || !form.price) { uiStore.addToast('Name, slug, and price are required', 'error'); return; }
    saving = true;
    const payload: any = {
      name: form.name, slug: form.slug, tagline: form.tagline || null, description: form.description || null,
      price: Math.round(parseFloat(form.price) * 100),
      original_price: form.original_price ? Math.round(parseFloat(form.original_price) * 100) : null,
      category_id: form.category_id || null,
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
      stock_quantity: parseInt(form.stock_quantity) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
      gst_percent: parseFloat(form.gst_percent) || 5,
      is_featured: form.is_featured, is_best_seller: form.is_best_seller,
      is_new_arrival: form.is_new_arrival, is_limited_edition: form.is_limited_edition,
      is_active: form.is_active,
    };
    try {
      if (editId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editId);
        if (error) throw error;
        uiStore.addToast('Product updated!', 'success');
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        uiStore.addToast('Product created!', 'success');
      }
      form = emptyForm(); editId = null; showForm = false; variants = [];
      await loadProducts();
    } catch (err: any) {
      uiStore.addToast('Error: ' + err.message, 'error');
    } finally {
      saving = false;
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    toggling = id;
    await supabase.from('products').update({ is_active: !isActive }).eq('id', id);
    products = products.map(p => p.id === id ? { ...p, is_active: !isActive } as any : p);
    toggling = null;
    uiStore.addToast(!isActive ? 'Product activated' : 'Product deactivated', 'success');
  }

  function fmt(paise: number) {
    return '₹' + ((paise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
</script>

<svelte:head><title>Products — Admin French Toes</title></svelte:head>

<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-white">Products</h1>
    {#if !showForm}
      <button onclick={() => { form = emptyForm(); editId = null; variants = []; showForm = true; }} class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background: #4f46e5;">+ Add Product</button>
    {/if}
  </div>

  {#if showForm}
    <div class="rounded-xl p-5" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
      <h2 class="font-semibold text-white mb-4">{editId ? 'Edit' : 'New'} Product</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {#each [
          { id: 'p-name', label: 'Name *', key: 'name', type: 'text' },
          { id: 'p-slug', label: 'Slug *', key: 'slug', type: 'text' },
          { id: 'p-price', label: 'Price (₹) *', key: 'price', type: 'number' },
          { id: 'p-orig', label: 'Original Price (₹)', key: 'original_price', type: 'number' },
          { id: 'p-stock', label: 'Base Stock Qty', key: 'stock_quantity', type: 'number' },
          { id: 'p-low', label: 'Low Stock Threshold', key: 'low_stock_threshold', type: 'number' },
          { id: 'p-gst', label: 'GST %', key: 'gst_percent', type: 'number' },
          { id: 'p-sizes', label: 'Sizes (comma-sep)', key: 'sizes', type: 'text' },
        ] as f}
          <div>
            <label for={f.id} class="block text-xs font-semibold mb-1 text-gray-400">{f.label}</label>
            <input id={f.id} bind:value={(form as any)[f.key]} type={f.type} class="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);" />
          </div>
        {/each}
        <div>
          <label for="p-cat" class="block text-xs font-semibold mb-1 text-gray-400">Category</label>
          <select id="p-cat" bind:value={form.category_id} class="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">
            <option value="">No category</option>
            {#each categories as c}<option value={c.id}>{c.name}</option>{/each}
          </select>
        </div>
        <div class="sm:col-span-2">
          <label for="p-desc" class="block text-xs font-semibold mb-1 text-gray-400">Description</label>
          <textarea id="p-desc" bind:value={form.description} rows="3" class="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none resize-none" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);"></textarea>
        </div>
        <div class="sm:col-span-2 flex flex-wrap gap-4">
          {#each [
            { key: 'is_featured', label: 'Featured' },
            { key: 'is_best_seller', label: 'Best Seller' },
            { key: 'is_new_arrival', label: 'New Arrival' },
            { key: 'is_limited_edition', label: 'Limited Edition' },
            { key: 'is_active', label: 'Active' },
          ] as flag}
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" bind:checked={(form as any)[flag.key]} class="accent-indigo-500" />
              {flag.label}
            </label>
          {/each}
        </div>
      </div>

      <!-- Variants Management Section (if editing an existing product) -->
      {#if editId}
        <div class="mt-8 pt-6 border-t border-white/10">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-bold text-white">Product Variants</h3>
              <p class="text-xs text-gray-400">Manage individual size, color, stock, and price adjustments.</p>
            </div>
            <button
              onclick={() => showVariantForm = !showVariantForm}
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              {showVariantForm ? 'Cancel' : '+ Add Variant'}
            </button>
          </div>

          {#if showVariantForm}
            <div class="p-4 rounded-xl bg-white/5 border border-white/10 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label for="v-sku" class="block text-[11px] font-semibold text-gray-400 mb-1">SKU *</label>
                <input id="v-sku" bind:value={newVariant.sku} placeholder="e.g. FT-PASTEL-38-PNK" class="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div>
                <label for="v-size" class="block text-[11px] font-semibold text-gray-400 mb-1">Size</label>
                <input id="v-size" bind:value={newVariant.size} placeholder="e.g. UK 6" class="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div>
                <label for="v-color" class="block text-[11px] font-semibold text-gray-400 mb-1">Color</label>
                <input id="v-color" bind:value={newVariant.color} placeholder="e.g. Pastel Pink" class="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div>
                <label for="v-price-adj" class="block text-[11px] font-semibold text-gray-400 mb-1">Price Adjustment (₹)</label>
                <input id="v-price-adj" bind:value={newVariant.price_adjustment} type="number" placeholder="0" class="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div>
                <label for="v-stock" class="block text-[11px] font-semibold text-gray-400 mb-1">Stock Qty</label>
                <input id="v-stock" bind:value={newVariant.stock_quantity} type="number" placeholder="20" class="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div class="flex items-end pb-1">
                <button
                  onclick={saveVariant}
                  class="w-full py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500"
                >
                  Save Variant
                </button>
              </div>
            </div>
          {/if}

          {#if loadingVariants}
            <p class="text-xs text-gray-400 py-2">Loading variants...</p>
          {:else if variants.length === 0}
            <p class="text-xs text-gray-500 py-2 italic">No variants configured for this product yet.</p>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-gray-300">
                <thead>
                  <tr class="border-b border-white/10 text-gray-400">
                    <th class="py-2 px-3">SKU</th>
                    <th class="py-2 px-3">Size / Color</th>
                    <th class="py-2 px-3">Price Adj. (₹)</th>
                    <th class="py-2 px-3">Stock Qty</th>
                    <th class="py-2 px-3">Status</th>
                    <th class="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  {#each variants as v (v.id)}
                    <tr>
                      <td class="py-2 px-3 font-mono text-gray-300">{v.sku}</td>
                      <td class="py-2 px-3 text-white">{v.size || '—'} / {v.color || '—'}</td>
                      <td class="py-2 px-3">
                        <input
                          type="number"
                          value={v.price_adjustment ? v.price_adjustment / 100 : 0}
                          onchange={(e) => updateVariantPriceAdjustment(v.id, (e.target as HTMLInputElement).value)}
                          class="w-20 px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white text-xs outline-none"
                        />
                      </td>
                      <td class="py-2 px-3">
                        <input
                          type="number"
                          value={v.stock_quantity}
                          onchange={(e) => updateVariantStock(v.id, (e.target as HTMLInputElement).value)}
                          class="w-16 px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white text-xs outline-none"
                        />
                      </td>
                      <td class="py-2 px-3">
                        <button
                          onclick={() => toggleVariantActive(v.id, v.is_active)}
                          class="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer"
                          style="background: {v.is_active ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color: {v.is_active ? '#22c55e' : '#ef4444'};"
                        >
                          {v.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td class="py-2 px-3">
                        <button
                          onclick={() => deleteVariant(v.id)}
                          class="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}

      <div class="flex gap-3 mt-6">
        <button onclick={() => { showForm = false; editId = null; variants = []; }} class="px-4 py-2.5 rounded-xl text-sm text-gray-300" style="background: rgba(255,255,255,0.1);">Cancel</button>
        <button onclick={saveProduct} disabled={saving} class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style="background: #4f46e5;">
          {saving ? 'Saving...' : editId ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center py-10"><div class="w-8 h-8 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"></div></div>
  {:else}
    <div class="rounded-xl overflow-hidden" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
              <th class="px-4 py-3 text-xs font-semibold text-gray-400">Product</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-400 hidden sm:table-cell">Category</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-400">Price</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-400 hidden md:table-cell">Stock</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-400">Status</th>
              <th class="px-4 py-3 text-xs font-semibold text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each products as p (p.id)}
              <tr class="border-b hover:bg-white/5 transition-colors" style="border-color: rgba(255,255,255,0.05);">
                <td class="px-4 py-3">
                  <p class="text-gray-200 font-medium text-xs">{p.name}</p>
                  <p class="text-gray-500 text-xs">{p.sku ?? p.slug}</p>
                </td>
                <td class="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{(p as any).category?.name ?? '—'}</td>
                <td class="px-4 py-3 text-white font-semibold text-xs">{fmt(p.price)}</td>
                <td class="px-4 py-3 hidden md:table-cell">
                  <span class="text-xs" style="color: {p.stock_status === 'out_of_stock' ? '#ef4444' : p.stock_status === 'low_stock' ? '#f59e0b' : '#22c55e'};">
                    {p.stock_quantity} ({p.stock_status?.replace('_', ' ')})
                  </span>
                </td>
                <td class="px-4 py-3">
                  <button onclick={() => toggleActive(p.id, p.is_active)} disabled={toggling === p.id} class="px-2 py-0.5 rounded-full text-xs font-semibold" style="background: {p.is_active ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color: {p.is_active ? '#22c55e' : '#ef4444'};">
                    {p.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td class="px-4 py-3">
                  <button onclick={() => startEdit(p)} class="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">Edit</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
