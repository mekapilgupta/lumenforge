<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';

  let actions = $state<any[]>([]);
  let loading = $state(true);
  let activeFilter = $state('all');
  let search = $state('');

  const FILTER_TABS = [
    { id: 'all', label: 'All Actions' },
    { id: 'cancellations', label: 'Cancellations 💔' },
    { id: 'returns_exchanges', label: 'Returns & Exchanges 🔄' },
    { id: 'payment_issues', label: 'Payment Issues ⚠️' },
    { id: 'messages', label: 'Messages 💬' }
  ];

  const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    cancellation: { label: 'Cancellation', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    return: { label: 'Return', bg: 'rgba(244, 167, 195, 0.15)', text: 'var(--color-blush-deep)' },
    exchange: { label: 'Exchange', bg: 'rgba(99, 102, 241, 0.15)', text: '#6366f1' },
    payment_failure: { label: 'Payment Failure', bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    cod_undelivered: { label: 'COD Undelivered', bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    chat_message: { label: 'Message', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' }
  };

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await loadActions();
    loading = false;
  });

  async function loadActions() {
    try {
      const response = await fetch('/api/admin/actions');
      const result = await response.json();
      if (!response.ok) {
        uiStore.addToast('Could not load actions: ' + (result.error || response.statusText), 'error');
        return;
      }
      actions = result.actions ?? [];
    } catch (err: any) {
      uiStore.addToast('Error fetching actions: ' + err.message, 'error');
    }
  }

  const filteredActions = $derived(
    actions.filter(a => {
      // Filter by tab
      let matchesTab = true;
      if (activeFilter === 'cancellations') {
        matchesTab = a.type === 'cancellation';
      } else if (activeFilter === 'returns_exchanges') {
        matchesTab = a.type === 'return' || a.type === 'exchange';
      } else if (activeFilter === 'payment_issues') {
        matchesTab = a.type === 'payment_failure' || a.type === 'cod_undelivered';
      } else if (activeFilter === 'messages') {
        matchesTab = a.type === 'chat_message';
      }

      if (!matchesTab) return false;

      // Filter by search
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          a.order?.order_number?.toLowerCase().includes(q) ||
          a.order?.profile?.full_name?.toLowerCase().includes(q) ||
          a.order?.profile?.email?.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q) ||
          a.status.toLowerCase().includes(q)
        );
      }

      return true;
    })
  );

  async function handleActionClick(action: any) {
    if (!action.seen_at) {
      try {
        const response = await fetch('/api/admin/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_id: action.id, seen: true })
        });
        if (!response.ok) {
          const result = await response.json();
          console.error('Failed to mark action as seen:', result.error);
        }
      } catch (err: any) {
        console.error('Error marking action as seen:', err.message);
      }
    }
    if (action.type === 'return' || action.type === 'exchange') {
      goto(`/admin/returns?id=${action.reference_id}`);
    } else {
      goto(`/admin/orders/${action.order_id}`);
    }
  }

  function formatAge(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function isOverdue(action: any) {
    if (!action.sla_deadline) return false;
    return new Date(action.sla_deadline).getTime() < Date.now();
  }
</script>

<svelte:head><title>Action Center — Admin French Toes</title></svelte:head>

<div class="flex flex-col gap-6 relative">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <h1 class="text-2xl font-bold text-white">Action Center</h1>
    <div class="relative">
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
      <input
        bind:value={search}
        type="search"
        placeholder="Search action items..."
        class="pl-9 pr-4 py-2 rounded-xl text-sm outline-none text-white placeholder-gray-500 w-64 focus:ring-1 focus:ring-indigo-500 font-sans"
        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);"
      />
    </div>
  </div>

  <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
    {#each FILTER_TABS as f}
      <button
        onclick={() => (activeFilter = f.id)}
        class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
        style="background: {activeFilter === f.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}; color: {activeFilter === f.id ? 'white' : 'rgba(255,255,255,0.6)'};"
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="flex justify-center py-16">
      <div class="w-8 h-8 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"></div>
    </div>
  {:else if filteredActions.length === 0}
    <div class="text-center py-16 rounded-xl" style="background: rgba(255,255,255,0.05);">
      <p class="text-gray-400 text-sm">No pending actions found in this view</p>
    </div>
  {:else}
    <div class="rounded-xl overflow-hidden shadow-lg border" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);">
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left text-gray-300">
          <thead>
            <tr class="text-left select-none text-gray-400 border-b border-white/10" style="background: rgba(255,255,255,0.02);">
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Order #</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Customer</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Type</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Priority</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Age</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each filteredActions as action (action.id)}
              <tr
                class="hover:bg-white/5 transition-colors cursor-pointer select-none {action.seen_at ? 'opacity-70' : 'font-bold'}"
                onclick={() => handleActionClick(action)}
              >
                <td class="px-5 py-4 font-mono text-xs text-indigo-400 font-semibold flex items-center gap-2">
                  {#if !action.seen_at}
                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                  {/if}
                  {action.order?.order_number ?? "—"}
                </td>
                <td class="px-5 py-4">
                  <p class="text-gray-200 text-xs font-medium">{action.order?.profile?.full_name ?? "—"}</p>
                  <p class="text-gray-500 text-[10px]">{action.order?.profile?.email ?? "—"}</p>
                </td>
                <td class="px-5 py-4 text-xs">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                    style="background: {TYPE_CONFIG[action.type]?.bg ?? 'rgba(255,255,255,0.05)'}; color: {TYPE_CONFIG[action.type]?.text ?? '#ffffff'}; border-color: {TYPE_CONFIG[action.type]?.text ?? 'transparent'};"
                  >
                    {TYPE_CONFIG[action.type]?.label ?? action.type}
                  </span>
                </td>
                <td class="px-5 py-4 text-xs">
                  <span class="px-2 py-0.5 rounded text-[10px] uppercase font-semibold {action.priority === 'urgent' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}">
                    {action.priority}
                  </span>
                </td>
                <td class="px-5 py-4 text-xs {isOverdue(action) ? 'text-red-400 font-bold' : 'text-gray-400'}">
                  {formatAge(action.created_at)}
                  {#if isOverdue(action)}
                    <span class="text-[9px] uppercase bg-red-950 text-red-400 px-1 py-0.5 rounded ml-1">Overdue</span>
                  {/if}
                </td>
                <td class="px-5 py-4 text-xs text-gray-300">
                  <span class="capitalize">{action.status.replace('_', ' ')}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>