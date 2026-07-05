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
      form = emptyForm(); editId = null; showForm = false;
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
      <button onclick={() => { form = emptyForm(); editId = null; showForm = true; }} class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background: #4f46e5;">+ Add Product</button>
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
          { id: 'p-stock', label: 'Stock Qty', key: 'stock_quantity', type: 'number' },
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
      <div class="flex gap-3 mt-4">
        <button onclick={() => { showForm = false; editId = null; }} class="px-4 py-2.5 rounded-xl text-sm text-gray-300" style="background: rgba(255,255,255,0.1);">Cancel</button>
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
