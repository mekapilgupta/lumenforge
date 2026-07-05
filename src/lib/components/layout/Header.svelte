<script lang="ts">
  import { cartStore } from '$lib/stores/cart.svelte';
  import { wishlistStore } from '$lib/stores/wishlist.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { notificationStore } from '$lib/stores/notifications.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { formatDate } from '$lib/utils/helpers';

  async function handleLogout() {
    await authStore.signOut();
    uiStore.addToast('Signed out. See you soon! 🌸', 'info');
    goto('/');
  }

  let scrolled = $state(false);

  $effect(() => {
    const handler = () => { scrolled = window.scrollY > 20; };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  });

  const navLinks = [
    { href: '/', label: '🏠 Home' },
    { href: '/shop', label: '🛍️ Shop All' },
    { href: '/shop?badge=Best+Seller', label: '⭐ Best Sellers' },
    { href: '/shop?badge=New+Arrival', label: '🆕 New Arrivals' },
    { href: '/shop?badge=Sale', label: '🌸 Sale' },
  ];

  // Extended mobile menu links
  const mobileExtraLinks = [
    { href: '/shop?color=Black', label: '🖤 Shop Black' },
    { href: '/shop?color=Berry', label: '🫐 Shop Berry' },
    { href: '/shop?color=Beige', label: '🤎 Shop Beige' },
    { href: '/shop?color=Peach', label: '🍑 Shop Peach' },
    { href: '/shop?color=SeaGreen', label: '🌿 Shop Sea Green' },
  ];

  let accountMenuOpen = $state(false);
  let notifOpen = $state(false);

  function openNotif() {
    notifOpen = !notifOpen;
    accountMenuOpen = false;
    if (notifOpen && notificationStore.unread > 0) {
      notificationStore.markAllRead();
    }
  }

  function isActive(href: string): boolean {
    // Use pathname only — url.search is not available during prerendering
    const pathname = $page.url.pathname;
    const hrefPath = href.split('?')[0];
    return hrefPath === '/' ? pathname === '/' : pathname.startsWith(hrefPath);
  }
</script>

<header
  class="fixed top-0 left-0 right-0 z-30 transition-all duration-300 navbar-entrance"
  class:shadow-sm={scrolled}
  style="
    background: {scrolled ? 'rgba(255, 255, 255, 0.7)' : 'rgba(253, 248, 243, 0.4)'};
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid {scrolled ? 'rgba(255, 255, 255, 0.3)' : 'transparent'};
  "
>
  <!-- Top Announcement Marquee -->
  <div
    class="w-full text-white text-xs font-semibold overflow-hidden transition-all duration-300 select-none flex items-center justify-center relative z-40"
    class:h-0={scrolled}
    class:opacity-0={scrolled}
    class:py-0={scrolled}
    style="background-color: var(--color-brand-magenta); height: {scrolled ? '0px' : '36px'};"
  >
    <div class="marquee-wrap w-full flex items-center h-full">
      <div class="marquee-track flex items-center gap-12 font-medium tracking-wide">
        <span>🚚 FREE SHIPPING ON ALL ORDERS 🚚</span>
        <span class="opacity-50">|</span>
        <span>🏷️ 5% OFF ON PREPAID ORDERS 🏷️</span>
        <span class="opacity-50">|</span>
        <span>💖 CASH ON DELIVERY AVAILABLE 💖</span>
        <span class="opacity-50">|</span>
        <span>🚚 FREE SHIPPING ON ALL ORDERS 🚚</span>
        <span class="opacity-50">|</span>
        <span>🏷️ 5% OFF ON PREPAID ORDERS 🏷️</span>
        <span class="opacity-50">|</span>
        <span>💖 CASH ON DELIVERY AVAILABLE 💖</span>
      </div>
    </div>
  </div>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16 md:h-18">

      <!-- Logo -->
      <a href="/" class="flex items-center gap-2 group" aria-label="French Toes Home" style="transition: transform 0.3s ease;">
        <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-8 h-8 object-contain group-hover:scale-110 transition-transform" />
        <span class="font-display text-xl font-semibold group-hover:scale-[1.04] transition-transform inline-block" style="color: var(--color-text-dark);">
          French <span style="color: var(--color-brand-magenta);">Toes</span>
        </span>
      </a>

      <!-- Desktop Nav -->
      <nav class="hidden md:flex items-center gap-4 lg:gap-8" aria-label="Main navigation">
        {#each navLinks as link}
          <a
            href={link.href}
            class="text-sm font-bold transition-colors duration-200 relative group nav-link-sweep"
            style="color: {isActive(link.href) ? 'var(--color-brand-magenta)' : 'var(--color-text-mid)'};"
          >
            {link.label}
            {#if isActive(link.href)}
              <span
                class="absolute -bottom-1 left-0 h-0.5 rounded-full"
                style="background: var(--color-brand-magenta); width: 100%;"
                aria-hidden="true"
              ></span>
            {/if}
          </a>
        {/each}
      </nav>

      <!-- Right Icons -->
      <div class="flex items-center gap-1 sm:gap-2.5 shrink-0">
        <!-- Search -->
        <button
          onclick={() => uiStore.toggleSearch()}
          class="p-1 sm:p-2 rounded-full transition-colors hover:bg-pink-50"
          aria-label="Search"
          style="color: var(--color-text-mid);"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>

        <!-- Wishlist -->
        <a
          href="/account/wishlist"
          class="relative p-1 sm:p-2 rounded-full transition-colors hover:bg-pink-50 icon-bounce"
          aria-label="Wishlist ({wishlistStore.count} items)"
          style="color: var(--color-text-mid);"
        >
          <svg width="20" height="20" fill={wishlistStore.count > 0 ? 'var(--color-blush-deep)' : 'none'} stroke="var(--color-blush-deep)" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {#if wishlistStore.count > 0}
            <span class="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-xs rounded-full flex items-center justify-center font-bold" style="background: var(--color-blush-deep); font-size: 10px;">
              {wishlistStore.count}
            </span>
          {/if}
        </a>

        <!-- Notifications Bell (logged-in only) -->
        {#if authStore.user}
          <div class="relative">
            <button
              onclick={openNotif}
              class="relative p-2 rounded-full transition-colors hover:bg-pink-50"
              aria-label="Notifications ({notificationStore.unread} unread)"
              style="color: var(--color-text-mid);"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {#if notificationStore.unread > 0}
                <span class="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-xs rounded-full flex items-center justify-center font-bold" style="background: var(--color-coral); font-size: 10px;">
                  {notificationStore.unread > 9 ? '9+' : notificationStore.unread}
                </span>
              {/if}
            </button>

            {#if notifOpen}
              <!-- Backdrop -->
              <button class="fixed inset-0 z-40" onclick={() => notifOpen = false} aria-label="Close notifications" tabindex="-1"></button>
              <!-- Dropdown -->
              <div class="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-xl border z-50 overflow-hidden" style="background: white; border-color: var(--color-blush);">
                <div class="px-4 py-3 border-b flex items-center justify-between" style="border-color: var(--color-blush);">
                  <h3 class="font-semibold text-sm" style="color: var(--color-text-dark);">Notifications</h3>
                  {#if notificationStore.items.length > 0}
                    <a href="/account/orders" onclick={() => notifOpen = false} class="text-xs" style="color: var(--color-blush-deep);">View Orders</a>
                  {/if}
                </div>
                <div class="max-h-80 overflow-y-auto">
                  {#if notificationStore.items.length === 0}
                    <div class="px-4 py-8 text-center">
                      <span class="text-2xl block mb-2">🔔</span>
                      <p class="text-sm" style="color: var(--color-text-soft);">No notifications yet</p>
                    </div>
                  {:else}
                    {#each notificationStore.items as notif (notif.id)}
                      <div
                        class="px-4 py-3 border-b last:border-0 transition-colors"
                        style="border-color: var(--color-blush); background: {notif.is_read ? 'white' : 'var(--color-cream)'};" 
                      >
                        <div class="flex items-start gap-2">
                          <span class="text-lg shrink-0" aria-hidden="true">
                            {notif.type === 'order_confirmed' ? '✅' : notif.type === 'order_shipped' ? '🚚' : notif.type === 'order_delivered' ? '🎉' : notif.type === 'order_cancelled' ? '❌' : '🔔'}
                          </span>
                          <div class="flex-1 min-w-0">
                            <p class="text-xs font-semibold truncate" style="color: var(--color-text-dark);">{notif.title}</p>
                            <p class="text-xs mt-0.5" style="color: var(--color-text-soft);">{notif.message}</p>
                            <p class="text-xs mt-1" style="color: var(--color-text-soft)">{formatDate(notif.created_at)}</p>
                          </div>
                          {#if !notif.is_read}
                            <span class="w-2 h-2 rounded-full shrink-0 mt-1" style="background: var(--color-blush-deep);" aria-hidden="true"></span>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Cart -->
        <button
          onclick={() => {
            console.log('[HEADER] Bag clicked. Current cartStore.isOpen:', cartStore.isOpen);
            cartStore.open();
            console.log('[HEADER] After cartStore.open(). New cartStore.isOpen:', cartStore.isOpen);
            accountMenuOpen = false;
            notifOpen = false;
          }}
          class="relative p-2 rounded-full transition-colors hover:bg-pink-50 icon-bounce"
          aria-label="Shopping cart ({cartStore.count} items)"
          style="color: var(--color-text-mid);"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          {#if cartStore.count > 0}
            <span class="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-xs rounded-full flex items-center justify-center font-bold pulse-glow" style="background: var(--color-blush-deep); font-size: 10px;">
              {cartStore.count}
            </span>
          {/if}
        </button>

        <!-- Account / Login -->
        {#if authStore.user}
          <div class="relative">
            <button
              onclick={() => { accountMenuOpen = !accountMenuOpen; notifOpen = false; }}
              class="flex items-center gap-1 p-0.5 rounded-full transition-colors hover:bg-pink-50"
              aria-label="Account menu"
              aria-expanded={accountMenuOpen}
            >
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style="background: var(--color-blush-deep);"
              >
                {authStore.initials}
              </div>
            </button>
            {#if accountMenuOpen}
              <div
                class="absolute right-0 top-full mt-2 w-52 rounded-2xl shadow-xl border py-1 z-50"
                style="background: white; border-color: var(--color-blush);"
              >
                <div class="px-4 py-3 border-b" style="border-color: var(--color-blush);">
                  <p class="text-sm font-semibold truncate" style="color: var(--color-text-dark);">{authStore.profile?.full_name ?? authStore.user.email}</p>
                  <p class="text-xs mt-0.5 truncate" style="color: var(--color-text-soft);">{authStore.user.email}</p>
                </div>
                {#each [
                  { href: '/account/profile', label: 'My Profile' },
                  { href: '/account/orders', label: 'My Orders' },
                  { href: '/account/addresses', label: 'Addresses' },
                  { href: '/account/wishlist', label: 'Wishlist' },
                  ...(authStore.isAdmin ? [{ href: '/admin', label: 'Admin Panel' }] : []),
                ] as link}
                  <a
                    href={link.href}
                    onclick={() => accountMenuOpen = false}
                    class="block px-4 py-2.5 text-sm transition-colors hover:bg-pink-50"
                    style="color: var(--color-text-mid);"
                  >
                    {link.label}
                  </a>
                {/each}
                <div class="border-t mt-1" style="border-color: var(--color-blush);"></div>
                <button
                  onclick={() => { accountMenuOpen = false; handleLogout(); }}
                  class="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-pink-50"
                  style="color: var(--color-coral-deep);"
                >
                  Sign Out
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <a
            href="/auth"
            class="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:opacity-90"
            style="background: var(--color-blush-deep); color: white;"
          >
            Sign In
          </a>
        {/if}

        <!-- Mobile Menu Toggle -->
        <button
          class="md:hidden p-1.5 sm:p-2 rounded-full transition-colors hover:bg-pink-50 shrink-0"
          onclick={() => uiStore.toggleMobileMenu()}
          aria-label="Open menu"
          aria-expanded={uiStore.mobileMenuOpen}
          style="color: var(--color-text-mid);"
        >
          {#if uiStore.mobileMenuOpen}
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          {:else}
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Mobile Menu Drawer (Extended AliExpress-style) -->
  {#if uiStore.mobileMenuOpen}
    <div
      class="md:hidden absolute top-full left-0 right-0 shadow-xl border-t max-h-[80vh] overflow-y-auto"
      style="background: var(--color-warm-white); border-color: var(--color-blush);"
    >
      <nav class="flex flex-col py-4 px-6 gap-1" aria-label="Mobile navigation">
        <!-- Main Links -->
        <div class="pb-3 border-b" style="border-color: var(--color-blush);">
          {#each navLinks as link}
            <a
              href={link.href}
              onclick={() => uiStore.closeMobileMenu()}
              class="block py-3 px-4 rounded-xl font-medium transition-colors text-sm"
              style="color: {isActive(link.href) ? 'var(--color-blush-deep)' : 'var(--color-text-mid)'}; background: {isActive(link.href) ? 'var(--color-blush)' : 'transparent'};"
            >
              {link.label}
            </a>
          {/each}
        </div>

        <!-- Shop by Color -->
        <div class="py-3 border-b" style="border-color: var(--color-blush);">
          <p class="text-xs font-semibold uppercase tracking-wider px-4 mb-2" style="color: var(--color-text-soft);">Shop by Color</p>
          {#each mobileExtraLinks as link}
            <a
              href={link.href}
              onclick={() => uiStore.closeMobileMenu()}
              class="block py-2.5 px-4 rounded-xl font-medium transition-colors text-sm"
              style="color: var(--color-text-mid);"
            >
              {link.label}
            </a>
          {/each}
        </div>

        <!-- Account Links -->
        <div class="py-3">
          <p class="text-xs font-semibold uppercase tracking-wider px-4 mb-2" style="color: var(--color-text-soft);">My Account</p>
          {#if authStore.user}
            <a href="/account/orders" onclick={() => uiStore.closeMobileMenu()} class="block py-2.5 px-4 rounded-xl text-sm" style="color: var(--color-text-mid);">📦 Track Order</a>
            <a href="/account/wishlist" onclick={() => uiStore.closeMobileMenu()} class="block py-2.5 px-4 rounded-xl text-sm" style="color: var(--color-text-mid);">💝 Wishlist</a>
            <a href="/account/profile" onclick={() => uiStore.closeMobileMenu()} class="block py-2.5 px-4 rounded-xl text-sm" style="color: var(--color-text-mid);">👤 My Profile</a>
          {:else}
            <a href="/auth" onclick={() => uiStore.closeMobileMenu()} class="block py-2.5 px-4 rounded-xl text-sm font-semibold" style="color: var(--color-blush-deep);">🔐 Sign In / Register</a>
          {/if}
          <a href="/contact" onclick={() => uiStore.closeMobileMenu()} class="block py-2.5 px-4 rounded-xl text-sm" style="color: var(--color-text-mid);">📞 Contact Us</a>
          <a href="/about" onclick={() => uiStore.closeMobileMenu()} class="block py-2.5 px-4 rounded-xl text-sm font-medium" style="color: var(--color-text-mid);">ℹ️ About Us</a>
          <a href="/refund" onclick={() => uiStore.closeMobileMenu()} class="block py-2.5 px-4 rounded-xl text-sm font-medium" style="color: var(--color-text-mid);">🔄 Return & Refund Policy</a>
        </div>
      </nav>
    </div>
  {/if}
</header>

<!-- Header spacer -->
<div class="transition-all duration-300" class:h-16={scrolled} class:h-[100px]={!scrolled} class:md:h-[72px]={scrolled} class:md:h-[108px]={!scrolled}></div>
