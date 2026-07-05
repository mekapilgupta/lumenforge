<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';

  let { children } = $props();

  // Action counts for badges
  let pendingCounts = $state<{
    orders: number;
    returns: number;
    actions: number;
  }>({
    orders: 0,
    returns: 0,
    actions: 0
  });
  let badgePollInterval: any = null;

  onMount(async () => {
    await authStore.init();
    if (!authStore.user) {
      goto(`/auth?redirect=${$page.url.pathname}`);
      return;
    }
    if (!authStore.isAdmin) {
      uiStore.addToast('Access denied. Admin only.', 'error');
      goto('/');
      return;
    }
    await loadBadgeCounts();
    // Poll every 30s
    badgePollInterval = setInterval(loadBadgeCounts, 30000);
  });

  onDestroy(() => {
    if (badgePollInterval) clearInterval(badgePollInterval);
  });

  async function loadBadgeCounts() {
    try {
      const response = await fetch('/api/admin/actions');
      const result = await response.json();
      if (!response.ok) {
        console.warn('Failed to fetch pending actions counts:', result.error || response.statusText);
        return;
      }

      const actions = result.actions ?? [];
      let ordersCount = 0;
      let returnsCount = 0;
      let actionsCount = actions.length;

      for (const item of actions) {
        if (['cancellation', 'payment_failure', 'cod_undelivered'].includes(item.type)) {
          ordersCount++;
        } else if (['return', 'exchange'].includes(item.type)) {
          returnsCount++;
        }
      }

      pendingCounts = {
        orders: ordersCount,
        returns: returnsCount,
        actions: actionsCount
      };
    } catch (e) {
      console.warn('Failed to fetch badge counts:', e);
    }
  }

  const sidebarLinks = [
    { href: '/admin', label: 'Dashboard', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
    { href: '/admin/actions', label: 'Action Center', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9' },
    { href: '/admin/orders', label: 'Orders', icon: 'M9 12h6M9 16h6M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z' },
    { href: '/admin/returns', label: 'Returns & Exchanges', icon: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3' },
    { href: '/admin/products', label: 'Products', icon: 'M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
    { href: '/admin/categories', label: 'Categories', icon: 'M3 6h18M3 12h18M3 18h18' },
    { href: '/admin/low-stock', label: 'Low Stock', icon: 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' },
    { href: '/admin/settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
  ];

  function isActive(href: string) {
    return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
  }
</script>

<svelte:head>
  <title>Admin — French Toes</title>
</svelte:head>

<div class="min-h-screen flex" style="background: #13141f;">
  <!-- Sidebar -->
  <aside class="w-56 shrink-0 hidden md:flex flex-col border-r min-h-screen" style="background: var(--color-text-dark); border-color: rgba(255,255,255,0.08);">
    <!-- Logo -->
    <div class="px-5 py-5 border-b" style="border-color: rgba(255,255,255,0.1);">
      <a href="/" class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-white flex items-center justify-center p-1 shadow-sm">
          <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-full h-full object-contain" />
        </div>
        <span class="font-display text-base font-semibold text-white">Admin</span>
      </a>
    </div>

    <!-- Nav links -->
    <nav class="flex-1 py-4 flex flex-col gap-1 px-3">
      {#each sidebarLinks as link}
        {@const count = link.href === '/admin/actions' ? pendingCounts.actions :
                        link.href === '/admin/orders' ? pendingCounts.orders :
                        link.href === '/admin/returns' ? pendingCounts.returns : 0}
        <a
          href={link.href}
          class="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style="
            background: {isActive(link.href) ? 'rgba(244,167,195,0.15)' : 'transparent'};
            color: {isActive(link.href) ? 'var(--color-blush-deep)' : 'rgba(255,255,255,0.65)'};
          "
        >
          <div class="flex items-center gap-3">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d={link.icon}/>
            </svg>
            {link.label}
          </div>
          {#if count > 0}
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse text-center"
              style="background-color: var(--bg-danger); color: var(--text-danger); box-shadow: 0 0 8px var(--bg-danger); min-width: 1.25rem;"
            >
              {count}
            </span>
          {/if}
        </a>
      {/each}
    </nav>

    <!-- Bottom: back to store -->
    <div class="px-3 py-4 border-t" style="border-color: rgba(255,255,255,0.1);">
      <a href="/" class="flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style="color: rgba(255,255,255,0.5);">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        Back to store
      </a>
    </div>
  </aside>

  <!-- Main content -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Top bar -->
    <header class="flex items-center justify-between px-6 py-4 border-b" style="border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);">
      <h1 class="font-display text-xl font-bold text-white">French Toes Admin</h1>
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background: var(--color-blush-deep);">
          {authStore.initials}
        </div>
        <span class="text-sm font-medium hidden md:block text-gray-400">
          {authStore.profile?.full_name ?? authStore.user?.email ?? 'Admin'}
        </span>
      </div>
    </header>

    <!-- Page content -->
    <main class="flex-1 p-6">
      {#if !authStore.loading && (!authStore.user || !authStore.isAdmin)}
        <div class="text-center py-20">
          <p class="text-lg font-semibold" style="color: var(--color-text-dark);">Access denied. Admin only.</p>
          <a href="/" class="btn-primary mt-4 inline-flex">Go Home</a>
        </div>
      {:else}
        {@render children()}
      {/if}
    </main>
  </div>
</div>
