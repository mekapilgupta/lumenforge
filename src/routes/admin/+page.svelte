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

  let actionCounts = $state<{
    cancellation: number;
    return: number;
    exchange: number;
    chat_message: number;
  }>({
    cancellation: 0,
    return: 0,
    exchange: 0,
    chat_message: 0
  });

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await Promise.all([loadStats(), loadRecentOrders(), loadTopProducts(), loadLowStock(), loadActionCounts()]);
    loading = false;
  });

  async function loadActionCounts() {
    try {
      const response = await fetch('/api/admin/actions');
      const result = await response.json();
      if (!response.ok) {
        console.warn('Failed to fetch action counts for dashboard:', result.error || response.statusText);
        return;
      }

      const actions = result.actions ?? [];
      const counts = {
        cancellation: 0,
        return: 0,
        exchange: 0,
        chat_message: 0
      };

      for (const item of actions) {
        if (item.seen_at === null) {
          if (['cancellation', 'payment_failure', 'cod_undelivered'].includes(item.type)) {
            counts.cancellation++;
          } else if (item.type === 'return') {
            counts.return++;
          } else if (item.type === 'exchange') {
            counts.exchange++;
          } else if (item.type === 'chat_message') {
            counts.chat_message++;
          }
        }
      }

      actionCounts = counts;
    } catch (e) {
      console.warn('Failed to fetch action counts:', e);
    }
  }

  async function loadStats() {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: allOrders } = await supabase
        .from('orders')
        .select('total_amount, created_at, status, user_id')
        .neq('status', 'cancelled');

      if (allOrders && allOrders.length > 0) {
        let todayRev = 0, todayCount = 0;
        let weekRev = 0, weekCount = 0;
        let monthRev = 0, monthCount = 0;
        let totalRev = 0;
        const customers = new Set<string>();

        for (const o of allOrders) {
          const amt = o.total_amount || 0;
          totalRev += amt;
          if (o.user_id) customers.add(o.user_id);
          const dt = o.created_at || '';
          if (dt >= startOfDay) {
            todayRev += amt;
            todayCount++;
          }
          if (dt >= startOfWeek) {
            weekRev += amt;
            weekCount++;
          }
          if (dt >= startOfMonth) {
            monthRev += amt;
            monthCount++;
          }
        }

        stats = {
          today_revenue: todayRev,
          today_orders: todayCount,
          week_revenue: weekRev,
          week_orders: weekCount,
          month_revenue: monthRev,
          month_orders: monthCount,
          avg_order_value: allOrders.length > 0 ? Math.round(totalRev / allOrders.length) : 0,
          unique_customers: customers.size || allOrders.length
        };
        return;
      }
    } catch (e) {
      console.warn('Failed to load live sales stats:', e);
    }

    stats = {
      today_revenue: 0,
      today_orders: 0,
      week_revenue: 0,
      week_orders: 0,
      month_revenue: 0,
      month_orders: 0,
      avg_order_value: 0,
      unique_customers: 0
    };
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
    try {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_name, quantity, total_price');

      if (orderItems && orderItems.length > 0) {
        const counts: Record<string, { name: string; sales_count: number }> = {};
        for (const item of orderItems) {
          const name = item.product_name || 'Product';
          if (!counts[name]) counts[name] = { name, sales_count: 0 };
          counts[name].sales_count += (item.quantity || 1);
        }
        topProducts = Object.values(counts).sort((a, b) => b.sales_count - a.sales_count).slice(0, 5);
        return;
      }
    } catch {}

    const { data: prods } = await supabase
      .from('products')
      .select('name, is_featured')
      .order('is_featured', { ascending: false })
      .limit(5);

    topProducts = (prods || []).map((p) => ({ name: p.name, sales_count: 0 }));
  }

  async function loadLowStock() {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, variants:product_variants(id, size, stock_quantity)');
      if (data) {
        lowStock = data
          .map((p) => {
            const total = (p.variants || []).reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0);
            return { id: p.id, name: p.name, stock_quantity: total };
          })
          .filter((p) => p.stock_quantity <= 15)
          .sort((a, b) => a.stock_quantity - b.stock_quantity)
          .slice(0, 10);
      } else {
        lowStock = [];
      }
    } catch {
      lowStock = [];
    }
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

  const totalPending = $derived(
    actionCounts.cancellation + actionCounts.return + actionCounts.exchange + actionCounts.chat_message
  );
</script>

<svelte:head><title>Admin Dashboard — French Toes</title></svelte:head>

  {#if loading}
  <div class="flex justify-center py-16"><div class="w-8 h-8 border-4 rounded-full animate-spin border-gray-200 border-t-indigo-600"></div></div>
{:else}
  <div class="flex flex-col gap-8">
    <h1 class="text-2xl font-bold text-white">Dashboard</h1>

    <!-- Action Required Banner -->
    {#if totalPending > 0}
      <div class="rounded-xl p-4 border flex items-center justify-between animate-fade-in" style="background: var(--bg-danger); border-color: var(--text-danger);">
        <div>
          <p class="font-semibold text-sm" style="color: var(--text-danger);">
            ⚡ Action Required
          </p>
          <p class="text-xs mt-0.5" style="color: var(--text-danger); opacity: 0.8;">
            {#if actionCounts.cancellation > 0}{actionCounts.cancellation} cancellation{actionCounts.cancellation > 1 ? 's' : ''}{/if}
            {#if actionCounts.return + actionCounts.exchange > 0}{actionCounts.cancellation > 0 ? ', ' : ''}{actionCounts.return + actionCounts.exchange} return{actionCounts.return + actionCounts.exchange > 1 ? 's' : ''}/exchange{actionCounts.return + actionCounts.exchange > 1 ? 's' : ''}{/if}
            {#if actionCounts.chat_message > 0}{(actionCounts.cancellation + actionCounts.return + actionCounts.exchange) > 0 ? ', ' : ''}{actionCounts.chat_message} message{actionCounts.chat_message > 1 ? 's' : ''}{/if}
            {' '}need attention
          </p>
        </div>
        <a href="/admin/actions" class="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90" style="background: var(--text-danger);">
          View Action Center →
        </a>
      </div>
    {/if}

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