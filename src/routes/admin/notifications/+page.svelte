<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

  interface AdminNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    link_url?: string;
    reference_id?: string;
    is_read: boolean;
    is_reviewed: boolean;
    created_at: string;
  }

  let notifications = $state<AdminNotification[]>([]);
  let loading = $state(true);
  let activeTab = $state<'all' | 'unreviewed' | 'orders' | 'returns' | 'stock' | 'system'>('unreviewed');

  const TYPE_ICONS: Record<string, string> = {
    new_order: '🛍️',
    order_delivered: '🎉',
    return_requested: '🔄',
    exchange_requested: '👟',
    cancellation_requested: '💔',
    customer_message: '💬',
    low_stock: '⚠️',
    system_alert: '🔔',
  };

  onMount(async () => {
    await authStore.init();
    if (authStore.user && authStore.isAdmin) {
      await loadNotifications();
    }
  });

  async function loadNotifications() {
    loading = true;
    try {
      const res = await fetch('/api/admin/notifications?limit=100');
      const data = await res.json();
      if (data.success) {
        notifications = data.notifications || [];
      }
    } catch (e) {
      uiStore.addToast('Failed to load notifications', 'error');
    } finally {
      loading = false;
    }
  }

  const filtered = $derived.by(() => {
    if (activeTab === 'unreviewed') {
      return notifications.filter((n) => !n.is_reviewed);
    }
    if (activeTab === 'orders') {
      return notifications.filter((n) => ['new_order', 'order_delivered'].includes(n.type));
    }
    if (activeTab === 'returns') {
      return notifications.filter((n) => ['return_requested', 'exchange_requested', 'cancellation_requested'].includes(n.type));
    }
    if (activeTab === 'stock') {
      return notifications.filter((n) => n.type === 'low_stock');
    }
    if (activeTab === 'system') {
      return notifications.filter((n) => ['system_alert', 'customer_message'].includes(n.type));
    }
    return notifications;
  });

  const unreviewedCount = $derived(notifications.filter((n) => !n.is_reviewed).length);

  async function markAsReviewed(id: string) {
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_reviewed', id }),
      });
      notifications = notifications.map((n) => (n.id === id ? { ...n, is_read: true, is_reviewed: true } : n));
      uiStore.addToast('Marked as reviewed', 'success');
    } catch {
      uiStore.addToast('Action failed', 'error');
    }
  }

  async function markAllReviewed() {
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_reviewed' }),
      });
      notifications = notifications.map((n) => ({ ...n, is_read: true, is_reviewed: true }));
      uiStore.addToast('All notifications marked as reviewed ✅', 'success');
    } catch {
      uiStore.addToast('Action failed', 'error');
    }
  }

  function handleCardClick(n: AdminNotification) {
    if (!n.is_reviewed) {
      markAsReviewed(n.id);
    }
    if (n.link_url) {
      goto(n.link_url);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<svelte:head>
  <title>Action &amp; Notification Center — French Toes Admin</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold text-white tracking-tight">Admin Action &amp; Notifications Hub</h1>
        {#if unreviewedCount > 0}
          <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/40 animate-pulse">
            {unreviewedCount} Action Required
          </span>
        {/if}
      </div>
      <p class="text-xs text-gray-400 mt-1">
        All store events from A to Z. Items remain active until explicitly marked as reviewed.
      </p>
    </div>

    <div class="flex items-center gap-2">
      {#if unreviewedCount > 0}
        <button
          onclick={markAllReviewed}
          class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow transition-colors cursor-pointer"
        >
          ✓ Mark All as Reviewed
        </button>
      {/if}
      <button
        onclick={loadNotifications}
        class="px-3 py-2 rounded-xl text-xs font-semibold border border-white/10 text-gray-300 hover:bg-white/5 transition-colors cursor-pointer"
      >
        🔄 Refresh
      </button>
    </div>
  </div>

  <!-- Filter Tabs -->
  <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide border-b border-white/10">
    <button
      onclick={() => activeTab = 'unreviewed'}
      class="px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 {activeTab === 'unreviewed' ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-transparent text-gray-400 hover:text-gray-200'}"
    >
      Action Required ({unreviewedCount})
    </button>
    <button
      onclick={() => activeTab = 'all'}
      class="px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 {activeTab === 'all' ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-transparent text-gray-400 hover:text-gray-200'}"
    >
      All Alerts ({notifications.length})
    </button>
    <button
      onclick={() => activeTab = 'orders'}
      class="px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 {activeTab === 'orders' ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-transparent text-gray-400 hover:text-gray-200'}"
    >
      🛍️ Orders &amp; Deliveries
    </button>
    <button
      onclick={() => activeTab = 'returns'}
      class="px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 {activeTab === 'returns' ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-transparent text-gray-400 hover:text-gray-200'}"
    >
      🔄 Returns &amp; Exchanges
    </button>
    <button
      onclick={() => activeTab = 'stock'}
      class="px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 {activeTab === 'stock' ? 'border-pink-500 text-pink-400 bg-pink-500/10' : 'border-transparent text-gray-400 hover:text-gray-200'}"
    >
      ⚠️ Stock Alerts
    </button>
  </div>

  <!-- Notification Cards -->
  {#if loading}
    <div class="py-16 text-center text-xs text-gray-500 animate-pulse">Loading notifications...</div>
  {:else if filtered.length === 0}
    <div class="py-16 rounded-2xl border border-white/10 bg-white/5 text-center text-gray-400">
      <span class="text-3xl block mb-2">🎉</span>
      <p class="text-sm font-semibold text-white">All Clear!</p>
      <p class="text-xs text-gray-400 mt-1">No alerts matching this filter.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-3">
      {#each filtered as n (n.id)}
        <div
          class="p-4 rounded-2xl border transition-all flex items-start gap-4 cursor-pointer group {n.is_reviewed ? 'bg-white/[0.02] border-white/5 opacity-70' : 'bg-white/5 border-pink-500/30 hover:border-pink-500 shadow-lg'}"
          onclick={() => handleCardClick(n)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleCardClick(n)}
        >
          <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
            {TYPE_ICONS[n.type] || '🔔'}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <h3 class="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">
                {n.title}
              </h3>
              <span class="text-xs font-mono text-gray-500 shrink-0">{formatDate(n.created_at)}</span>
            </div>
            <p class="text-xs text-gray-300 leading-relaxed mb-2">{n.message}</p>

            <div class="flex items-center gap-2">
              {#if n.link_url}
                <span class="text-[11px] font-bold text-pink-400 group-hover:underline">
                  Take Action →
                </span>
              {/if}
              {#if n.is_reviewed}
                <span class="text-[10px] text-gray-500 font-semibold ml-auto">✓ Reviewed</span>
              {:else}
                <button
                  type="button"
                  onclick={(e) => { e.stopPropagation(); markAsReviewed(n.id); }}
                  class="text-[11px] font-bold text-indigo-300 bg-indigo-900/40 hover:bg-indigo-900/80 px-2.5 py-1 rounded-lg border border-indigo-500/40 transition-colors ml-auto cursor-pointer"
                >
                  ✓ Mark as Reviewed
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
