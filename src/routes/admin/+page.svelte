<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { formatDate } from '$lib/utils/helpers';

  let stats = $state<any>(null);
  let recentOrders = $state<any[]>([]);
  let topProducts = $state<any[]>([]);
  let lowStock = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await Promise.all([loadStats(), loadRecentOrders(), loadTopProducts(), loadLowStock()]);
    loading = false;
  });

  async function loadStats() {
    const { data } = await supabase.from('sales_analytics').select('*').single();
    stats = data;
  }

  async function loadRecentOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, profile:user_id(full_name, email, phone)')
      .order('created_at', { ascending: false })
      .limit(10);
    recentOrders = data ?? [];
  }

  async function loadTopProducts() {
    const { data } = await supabase.from('top_products').select('*').limit(5);
    topProducts = data ?? [];
  }

  async function loadLowStock() {
    const { data } = await supabase.from('low_stock_products').select('*').limit(10);
    lowStock = data ?? [];
  }

  function fmt(paise: number) {
    return '₹' + ((paise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  const STATUS_COLOR: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
    packed: '#06b6d4', shipped: '#06b6d4', out_for_delivery: '#f97316',
    delivered: '#22c55e', cancelled: '#ef4444', refunded: '#6b7280',
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
    packed: 'Packed', shipped: 'Shipped', out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
  };
</script>

<svelte:head><title>Admin Dashboard — French Toes</title></svelte:head>

{#if loading}
  <div class="flex justify-center py-16"><div class="w-8 h-8 border-4 rounded-full animate-spin border-gray-200 border-t-indigo-600"></div></div>
{:else}
  <div class="flex flex-col gap-8">
    <h1 class="text-2xl font-bold text-white">Dashboard</h1>

    <!-- KPI cards -->
    {#if stats}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {#each [
          { label: "Today's Revenue", value: fmt(stats.today_revenue ?? 0), icon: '💰', sub: `${stats.today_orders ?? 0} orders` },
          { label: 'This Week', value: fmt(stats.week_revenue ?? 0), icon: '📅', sub: `${stats.week_orders ?? 0} orders` },
          { label: 'This Month', value: fmt(stats.month_revenue ?? 0), icon: '📈', sub: `${stats.month_orders ?? 0} orders` },
          { label: 'Avg Order Value', value: fmt(stats.avg_order_value ?? 0), icon: '🎯', sub: `${stats.unique_customers ?? 0} customers` },
        ] as card}
          <div class="rounded-xl p-5" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-400">{card.label}</span>
              <span class="text-xl">{card.icon}</span>
            </div>
            <p class="text-2xl font-bold text-white">{card.value}</p>
            <p class="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        {/each}
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Orders -->
      <div class="lg:col-span-2 rounded-xl overflow-hidden" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
        <div class="flex items-center justify-between px-5 py-4 border-b" style="border-color: rgba(255,255,255,0.1);">
          <h2 class="font-semibold text-white">Recent Orders</h2>
          <a href="/admin/orders" class="text-xs text-indigo-400 hover:text-indigo-300">View all →</a>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <th class="px-5 py-3 text-xs font-semibold text-gray-400">Order #</th>
                <th class="px-5 py-3 text-xs font-semibold text-gray-400 hidden sm:table-cell">Customer</th>
                <th class="px-5 py-3 text-xs font-semibold text-gray-400">Amount</th>
                <th class="px-5 py-3 text-xs font-semibold text-gray-400">Status</th>
                <th class="px-5 py-3 text-xs font-semibold text-gray-400 hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {#each recentOrders as order (order.id)}
                <tr class="border-b hover:bg-white/5 transition-colors" style="border-color: rgba(255,255,255,0.05);">
                  <td class="px-5 py-3">
                    <a href="/admin/orders/{order.id}" class="font-mono text-xs text-indigo-400 hover:text-indigo-300">{order.order_number}</a>
                  </td>
                  <td class="px-5 py-3 hidden sm:table-cell text-gray-300 text-xs">{order.profile?.full_name ?? order.profile?.email ?? 'Guest'}</td>
                  <td class="px-5 py-3 font-semibold text-white">{fmt(order.total_amount)}</td>
                  <td class="px-5 py-3">
                    <span class="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style="background: {STATUS_COLOR[order.status] ?? '#6b7280'};">
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-gray-400 text-xs hidden md:table-cell">{formatDate(order.created_at)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right column -->
      <div class="flex flex-col gap-4">
        <!-- Low stock alert -->
        {#if lowStock.length > 0}
          <div class="rounded-xl overflow-hidden" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,100,100,0.3);">
            <div class="px-4 py-3 border-b flex items-center gap-2" style="border-color: rgba(255,255,255,0.1); background: rgba(239,68,68,0.1);">
              <span>⚠️</span>
              <h2 class="font-semibold text-red-400 text-sm">Low Stock Alert</h2>
            </div>
            <div class="p-3 flex flex-col gap-2">
              {#each lowStock as p}
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-300 truncate">{p.name}</span>
                  <span class="text-red-400 font-semibold shrink-0 ml-2">{p.stock_quantity} left</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Top products -->
        {#if topProducts.length > 0}
          <div class="rounded-xl overflow-hidden" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <div class="px-4 py-3 border-b" style="border-color: rgba(255,255,255,0.1);">
              <h2 class="font-semibold text-white text-sm">Top Products 🏆</h2>
            </div>
            <div class="p-3 flex flex-col gap-2">
              {#each topProducts as p, i}
                <div class="flex items-center gap-2 text-sm">
                  <span class="text-gray-500 w-4 shrink-0">#{i + 1}</span>
                  <span class="text-gray-300 flex-1 truncate">{p.name}</span>
                  <span class="text-gray-400 shrink-0">{p.sales_count} sold</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
