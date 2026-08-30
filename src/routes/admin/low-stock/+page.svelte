<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';

  let lowStockProducts = $state<any[]>([]);
  let loading = $state(true);
  let updatingId = $state<string | null>(null);

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await loadLowStock();
    loading = false;
  });

  async function loadLowStock() {
    const { data, error } = await supabase
      .from('products')
      .select('*, category:category_id(name)')
      .or('stock_status.eq.low_stock,stock_status.eq.out_of_stock,stock_quantity.lte.15')
      .order('stock_quantity', { ascending: true });

    if (error) {
      uiStore.addToast('Error fetching low stock: ' + error.message, 'error');
    } else {
      lowStockProducts = data ?? [];
    }
  }

  async function updateStock(id: string, newQtyStr: string) {
    const newQty = parseInt(newQtyStr);
    if (isNaN(newQty) || newQty < 0) return;
    updatingId = id;
    try {
      const stockStatus = newQty === 0 ? 'out_of_stock' : newQty <= 10 ? 'low_stock' : 'in_stock';
      const { error } = await supabase
        .from('products')
        .update({
          stock_quantity: newQty,
          stock_status: stockStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      uiStore.addToast('Stock level updated! 📦', 'success');
      await loadLowStock();
    } catch (err: any) {
      uiStore.addToast('Failed to update stock: ' + err.message, 'error');
    } finally {
      updatingId = null;
    }
  }

  function fmt(paise: number) {
    return '₹' + ((paise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
</script>

<svelte:head>
  <title>Low Stock Alerts — Admin French Toes</title>
</svelte:head>

<div class="flex flex-col gap-6 max-w-7xl mx-auto">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
    <div>
      <h1 class="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
        <span>⚠️ Low Stock & Inventory Alerts</span>
        <span class="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono font-semibold border border-red-500/30">
          {lowStockProducts.length} Items
        </span>
      </h1>
      <p class="text-xs text-gray-400 mt-1">
        Monitor inventory thresholds and restock running-out styles before they sell out.
      </p>
    </div>

    <button
      onclick={loadLowStock}
      class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 cursor-pointer"
    >
      🔄 Refresh Inventory
    </button>
  </div>

  {#if loading}
    <div class="flex justify-center py-20">
      <div class="w-10 h-10 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"></div>
    </div>
  {:else if lowStockProducts.length === 0}
    <div class="p-12 text-center rounded-2xl bg-white/5 border border-white/10 space-y-3">
      <p class="text-3xl">🎉</p>
      <p class="text-base font-bold text-white">All Stock Levels Healthy!</p>
      <p class="text-xs text-gray-400">No products are currently low or out of stock.</p>
    </div>
  {:else}
    <div class="rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-gray-300">
          <thead class="bg-white/5 border-b border-white/10 text-gray-400 font-semibold uppercase tracking-wider">
            <tr>
              <th class="py-3.5 px-4">Product</th>
              <th class="py-3.5 px-4">Category</th>
              <th class="py-3.5 px-4">Price</th>
              <th class="py-3.5 px-4">Current Stock</th>
              <th class="py-3.5 px-4">Quick Restock</th>
              <th class="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each lowStockProducts as p (p.id)}
              <tr class="hover:bg-white/5 transition-colors">
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-black/30 border border-white/10 overflow-hidden shrink-0">
                      {#if p.thumbnail_url || (Array.isArray(p.images) && p.images[0])}
                        <img src={p.thumbnail_url || (typeof p.images[0] === 'string' ? p.images[0] : p.images[0]?.url)} alt={p.name} class="w-full h-full object-cover" />
                      {/if}
                    </div>
                    <div>
                      <p class="font-bold text-white text-xs">{p.name}</p>
                      <p class="text-[10px] text-gray-400 font-mono">{p.sku || p.slug}</p>
                    </div>
                  </div>
                </td>

                <td class="py-3 px-4 text-gray-300">
                  {p.category?.name || '—'}
                </td>

                <td class="py-3 px-4 font-mono font-bold text-emerald-400">
                  {fmt(p.price)}
                </td>

                <td class="py-3 px-4">
                  <span class="font-mono font-bold px-2 py-0.5 rounded text-xs" style="background: {p.stock_quantity === 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}; color: {p.stock_quantity === 0 ? '#ef4444' : '#f59e0b'};">
                    {p.stock_quantity ?? 0} left
                  </span>
                </td>

                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={p.stock_quantity ?? 0}
                      onchange={(e) => updateStock(p.id, (e.target as HTMLInputElement).value)}
                      disabled={updatingId === p.id}
                      class="w-20 px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-white font-mono text-xs outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                    <span class="text-[11px] text-gray-400">units</span>
                  </div>
                </td>

                <td class="py-3 px-4 text-right">
                  <a
                    href="/admin/products"
                    class="px-3 py-1 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/50"
                  >
                    Edit Product →
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
