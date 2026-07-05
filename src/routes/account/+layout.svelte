<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';

  let { children } = $props();

  onMount(async () => {
    // Wait for auth to initialize
    await authStore.init();
    if (!authStore.user) {
      goto(`/auth?redirect=${$page.url.pathname}`);
    }
  });

  const sidebarLinks = [
    { href: '/account/profile', label: 'My Profile', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    { href: '/account/orders', label: 'My Orders', icon: 'M9 12h6M9 16h6M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z' },
    { href: '/account/addresses', label: 'Addresses', icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
    { href: '/account/wishlist', label: 'Wishlist', icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
  ];

  function isActive(href: string) {
    return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
  }

  async function handleLogout() {
    await authStore.signOut();
    goto('/');
  }
</script>

<svelte:head>
  <title>My Account — French Toes</title>
</svelte:head>

<div class="min-h-screen py-8 px-4" style="background: var(--color-warm-white);">
  <div class="max-w-6xl mx-auto">
    <!-- Page title -->
    <div class="mb-8">
      <h1 class="font-display text-3xl font-bold" style="color: var(--color-text-dark);">My Account</h1>
      {#if authStore.profile?.full_name}
        <p class="mt-1 text-sm" style="color: var(--color-text-soft);">Welcome back, {authStore.profile.full_name}!</p>
      {/if}
    </div>

    <div class="flex flex-col md:flex-row gap-8">
      <!-- Sidebar -->
      <aside class="md:w-56 shrink-0">
        <nav class="rounded-2xl overflow-hidden border" style="background: white; border-color: var(--color-blush);">
          {#each sidebarLinks as link}
            <a
              href={link.href}
              class="flex items-center gap-3 px-4 py-3.5 text-sm font-medium border-b transition-colors"
              style="
                border-color: var(--color-blush);
                background: {isActive(link.href) ? 'var(--color-blush)' : 'transparent'};
                color: {isActive(link.href) ? 'var(--color-blush-deep)' : 'var(--color-text-mid)'};
              "
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d={link.icon}/>
              </svg>
              {link.label}
            </a>
          {/each}
          <button
            onclick={handleLogout}
            class="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-red-50"
            style="color: var(--color-coral-deep);"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign Out
          </button>
        </nav>
      </aside>

      <!-- Main content -->
      <main class="flex-1 min-w-0">
        {#if !authStore.loading && !authStore.user}
          <div class="text-center py-20">
            <p class="text-lg font-semibold" style="color: var(--color-text-dark);">Please sign in to view this page.</p>
            <a href="/auth" class="btn-primary mt-4 inline-flex">Sign In</a>
          </div>
        {:else}
          {@render children()}
        {/if}
      </main>
    </div>
  </div>
</div>
