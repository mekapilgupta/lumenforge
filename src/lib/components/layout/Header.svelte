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
    uiStore.addToast('Signed out. See you soon!', 'info');
    goto('/');
  }

  let scrolled = $state(false);

  $effect(() => {
    const handler = () => { scrolled = window.scrollY > 20; };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  });

  let accountMenuOpen = $state(false);
  let notifOpen = $state(false);
  let catDropdownOpen = $state(false);
  let occDropdownOpen = $state(false);
  let mobileCatOpen = $state(false);
  let mobileOccOpen = $state(false);

  function openNotif() {
    notifOpen = !notifOpen;
    accountMenuOpen = false;
    if (notifOpen && notificationStore.unread > 0) {
      notificationStore.markAllRead();
    }
  }

  function isActive(href: string): boolean {
    const pathname = $page.url.pathname;
    const hrefPath = href.split('?')[0];
    return hrefPath === '/' ? pathname === '/' : pathname.startsWith(hrefPath);
  }
</script>

<!-- Top Announcement Bar (Monrow style — minimal, clean) -->
<div class="w-full bg-[#111111] text-white text-[11px] md:text-xs tracking-wider py-2 select-none z-40 transition-all duration-300">
  <div class="max-w-7xl mx-auto px-4 flex items-center justify-center gap-3 sm:gap-6 font-medium text-center text-[#e5e5e5]">
    <span>Free shipping on all orders across India</span>
    <span class="opacity-40" aria-hidden="true">•</span>
    <span>Extra 5% off on prepaid</span>
    <span class="opacity-40 hidden sm:inline" aria-hidden="true">•</span>
    <span class="hidden sm:inline">Easy 7-day exchanges</span>
  </div>
</div>

<header
  class="sticky top-0 left-0 right-0 z-30 transition-all duration-300 bg-white/95 backdrop-blur-md border-b"
  style="border-color: {scrolled ? 'var(--color-line, #E8E4E0)' : 'transparent'}; box-shadow: {scrolled ? '0 4px 20px rgba(0,0,0,0.05)' : 'none'};"
>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16 md:h-20">

      <!-- Logo (Serif Luxury Monrow Aesthetic) -->
      <a href="/" class="flex items-center gap-2.5 group" aria-label="French Toes Home">
        <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-7 h-7 md:w-8 md:h-8 object-contain transition-transform group-hover:scale-105" />
        <span class="font-serif text-xl md:text-2xl font-normal tracking-tight text-[#1A1A1A]">
          French <span class="font-serif italic font-normal text-[#D4A5A5]">Toes</span>
        </span>
      </a>

      <!-- Desktop Nav -->
      <nav class="hidden lg:flex items-center gap-7 xl:gap-9" aria-label="Main navigation">
        <a
          href="/shop?badge=Best+Seller"
          class="text-sm font-medium tracking-wide text-[#3D3D3D] hover:text-[#1A1A1A] transition-colors relative py-2 group"
        >
          Best Sellers
          <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#1A1A1A] transition-all duration-300 group-hover:w-full"></span>
        </a>

        <a
          href="/shop?badge=New+Arrival"
          class="text-sm font-medium tracking-wide text-[#3D3D3D] hover:text-[#1A1A1A] transition-colors relative py-2 group"
        >
          New Arrivals
          <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#1A1A1A] transition-all duration-300 group-hover:w-full"></span>
        </a>

        <!-- Category Dropdown -->
        <div
          class="relative"
          role="navigation"
          aria-label="Category menu"
          onmouseenter={() => catDropdownOpen = true}
          onmouseleave={() => catDropdownOpen = false}
        >
          <a
            href="/shop"
            class="flex items-center gap-1 text-sm font-medium tracking-wide text-[#3D3D3D] hover:text-[#1A1A1A] transition-colors py-2"
          >
            Shop by Category
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" class="transition-transform" class:rotate-180={catDropdownOpen}><path d="m2 4.5 4 4 4-4"/></svg>
          </a>

          {#if catDropdownOpen}
            <div class="absolute left-0 top-full pt-1 w-56 z-50">
              <div class="bg-white rounded-xl shadow-xl border border-[#E8E4E0] py-2 overflow-hidden">
                <a href="/shop?category=daily-comfort" class="block px-4 py-2 text-sm text-[#3D3D3D] hover:bg-[#F9F6F2] hover:text-[#1A1A1A]">Daily Comfort</a>
                <a href="/shop?category=flats" class="block px-4 py-2 text-sm text-[#3D3D3D] hover:bg-[#F9F6F2] hover:text-[#1A1A1A]">Elegant Flats</a>
                <a href="/shop?category=wedges" class="flex items-center justify-between px-4 py-2 text-sm text-[#3D3D3D] hover:bg-[#F9F6F2] hover:text-[#1A1A1A]">
                  <span>Soft Wedges</span>
                  <span class="text-[9px] font-bold bg-[#FBF3F2] text-[#D4A5A5] px-1.5 py-0.5 rounded">NEW</span>
                </a>
                <a href="/shop?category=slippers" class="block px-4 py-2 text-sm text-[#3D3D3D] hover:bg-[#F9F6F2] hover:text-[#1A1A1A]">Slides &amp; Slippers</a>
                <div class="border-t border-[#E8E4E0] my-1"></div>
                <a href="/shop" class="block px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] hover:bg-[#F9F6F2]">View All Footwear &rarr;</a>
              </div>
            </div>
          {/if}
        </div>

        <!-- Occasion Dropdown -->
        <div
          class="relative"
          role="navigation"
          aria-label="Occasion menu"
          onmouseenter={() => occDropdownOpen = true}
          onmouseleave={() => occDropdownOpen = false}
        >
          <a
            href="/#occasions"
            class="flex items-center gap-1 text-sm font-medium tracking-wide text-[#3D3D3D] hover:text-[#1A1A1A] transition-colors py-2"
          >
            Shop by Occasion
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" class="transition-transform" class:rotate-180={occDropdownOpen}><path d="m2 4.5 4 4 4-4"/></svg>
          </a>

          {#if occDropdownOpen}
            <div class="absolute left-0 top-full pt-1 w-52 z-50">
              <div class="bg-white rounded-xl shadow-xl border border-[#E8E4E0] py-2 overflow-hidden">
                <a href="/shop?occasion=work" class="block px-4 py-2 text-sm text-[#3D3D3D] hover:bg-[#F9F6F2] hover:text-[#1A1A1A]">Everyday &amp; Work</a>
                <a href="/shop?occasion=weekend" class="block px-4 py-2 text-sm text-[#3D3D3D] hover:bg-[#F9F6F2] hover:text-[#1A1A1A]">Weekend &amp; Travel</a>
                <a href="/shop?occasion=evening" class="block px-4 py-2 text-sm text-[#3D3D3D] hover:bg-[#F9F6F2] hover:text-[#1A1A1A]">Evening &amp; Outings</a>
              </div>
            </div>
          {/if}
        </div>

        <a
          href="/about"
          class="text-sm font-medium tracking-wide text-[#3D3D3D] hover:text-[#1A1A1A] transition-colors relative py-2 group"
        >
          Our Comfort Promise
          <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#1A1A1A] transition-all duration-300 group-hover:w-full"></span>
        </a>

        <a
          href="/contact"
          class="text-sm font-medium tracking-wide text-[#3D3D3D] hover:text-[#1A1A1A] transition-colors relative py-2 group"
        >
          Support
          <span class="absolute bottom-0 left-0 w-0 h-0.5 bg-[#1A1A1A] transition-all duration-300 group-hover:w-full"></span>
        </a>
      </nav>

      <!-- Right Action Icons -->
      <div class="flex items-center gap-1 sm:gap-2 shrink-0">
        <!-- Search -->
        <button
          onclick={() => uiStore.toggleSearch()}
          class="p-2 rounded-full text-[#1A1A1A] hover:bg-[#F9F6F2] transition-colors"
          aria-label="Search footwear"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
        </button>

        <!-- Wishlist -->
        <a
          href="/account/wishlist"
          class="relative p-2 rounded-full text-[#1A1A1A] hover:bg-[#F9F6F2] transition-colors"
          aria-label="Wishlist ({wishlistStore.count} items)"
        >
          <svg width="20" height="20" fill={wishlistStore.count > 0 ? '#D4A5A5' : 'none'} stroke={wishlistStore.count > 0 ? '#D4A5A5' : 'currentColor'} stroke-width="1.7" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7c0 4.9-7 9.3-7 9.3Z"/>
          </svg>
          {#if wishlistStore.count > 0}
            <span class="absolute 1 top-1 right-1 w-4 h-4 bg-[#D4A5A5] text-white text-[9px] rounded-full flex items-center justify-center font-semibold">
              {wishlistStore.count}
            </span>
          {/if}
        </a>

        <!-- Notifications Bell (logged in only) -->
        {#if authStore.user}
          <div class="relative">
            <button
              onclick={openNotif}
              class="relative p-2 rounded-full text-[#1A1A1A] hover:bg-[#F9F6F2] transition-colors"
              aria-label="Notifications"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {#if notificationStore.unread > 0}
                <span class="absolute top-1 right-1 w-4 h-4 bg-[#D4A5A5] text-white text-[9px] rounded-full flex items-center justify-center font-semibold">
                  {notificationStore.unread > 9 ? '9+' : notificationStore.unread}
                </span>
              {/if}
            </button>

            {#if notifOpen}
              <button class="fixed inset-0 z-40" onclick={() => notifOpen = false} aria-label="Close notifications" tabindex="-1"></button>
              <div class="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl border border-[#E8E4E0] bg-white z-50 overflow-hidden">
                <div class="px-4 py-3 border-b border-[#E8E4E0] flex items-center justify-between">
                  <h3 class="font-semibold text-xs uppercase tracking-wider text-[#1A1A1A]">Notifications</h3>
                  {#if notificationStore.items.length > 0}
                    <a href="/account/orders" onclick={() => notifOpen = false} class="text-xs text-[#D4A5A5] hover:underline">View Orders</a>
                  {/if}
                </div>
                <div class="max-h-80 overflow-y-auto">
                  {#if notificationStore.items.length === 0}
                    <div class="px-4 py-8 text-center text-sm text-[#6B6B6B]">
                      No notifications yet
                    </div>
                  {:else}
                    {#each notificationStore.items as notif (notif.id)}
                      <div class="px-4 py-3 border-b border-[#F0ECE8] last:border-0 hover:bg-[#F9F6F2] transition-colors {notif.is_read ? 'bg-white' : 'bg-[#FBF3F2]'}">
                        <p class="text-xs font-semibold text-[#1A1A1A]">{notif.title}</p>
                        <p class="text-xs text-[#6B6B6B] mt-0.5">{notif.message}</p>
                        <p class="text-[10px] text-[#9A9A9A] mt-1">{formatDate(notif.created_at)}</p>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Bag / Cart -->
        <button
          onclick={() => {
            cartStore.open();
            accountMenuOpen = false;
            notifOpen = false;
          }}
          class="relative p-2 rounded-full text-[#1A1A1A] hover:bg-[#F9F6F2] transition-colors"
          aria-label="Shopping bag ({cartStore.count} items)"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>
          </svg>
          {#if cartStore.count > 0}
            <span class="absolute top-1 right-1 w-4 h-4 bg-[#1A1A1A] text-white text-[9px] rounded-full flex items-center justify-center font-semibold">
              {cartStore.count}
            </span>
          {/if}
        </button>

        <!-- Account / Sign In -->
        {#if authStore.user}
          <div class="relative">
            <button
              onclick={() => { accountMenuOpen = !accountMenuOpen; notifOpen = false; }}
              class="flex items-center gap-1.5 p-1 rounded-full text-[#1A1A1A] hover:bg-[#F9F6F2] transition-colors"
              aria-label="Account menu"
              aria-expanded={accountMenuOpen}
            >
              <div class="w-8 h-8 rounded-full bg-[#1A1A1A] text-white text-xs font-medium flex items-center justify-center">
                {authStore.initials}
              </div>
            </button>
            {#if accountMenuOpen}
              <button class="fixed inset-0 z-40" onclick={() => accountMenuOpen = false} aria-label="Close account menu" tabindex="-1"></button>
              <div class="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-2xl border border-[#E8E4E0] bg-white py-1 z-50">
                <div class="px-4 py-3 border-b border-[#E8E4E0]">
                  <p class="text-xs font-semibold text-[#1A1A1A] truncate">{authStore.profile?.full_name ?? authStore.user.email}</p>
                  <p class="text-[11px] text-[#6B6B6B] truncate">{authStore.user.email}</p>
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
                    class="block px-4 py-2 text-xs text-[#3D3D3D] hover:bg-[#F9F6F2] hover:text-[#1A1A1A]"
                  >
                    {link.label}
                  </a>
                {/each}
                <div class="border-t border-[#E8E4E0] my-1"></div>
                <button
                  onclick={() => { accountMenuOpen = false; handleLogout(); }}
                  class="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <a
            href="/auth"
            class="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium tracking-wide text-[#1A1A1A] border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M5 21c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>
            <span>Sign In</span>
          </a>
        {/if}

        <!-- Mobile Menu Toggle Button -->
        <button
          class="lg:hidden p-2 rounded-full text-[#1A1A1A] hover:bg-[#F9F6F2]"
          onclick={() => uiStore.toggleMobileMenu()}
          aria-label="Toggle navigation menu"
          aria-expanded={uiStore.mobileMenuOpen}
        >
          {#if uiStore.mobileMenuOpen}
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          {:else}
            <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          {/if}
        </button>

      </div>

    </div>
  </div>

  <!-- Mobile Drawer Menu (Clean Monrow Drawer) -->
  {#if uiStore.mobileMenuOpen}
    <div class="lg:hidden border-t border-[#E8E4E0] bg-[#FFFFFF] shadow-2xl max-h-[80vh] overflow-y-auto">
      <div class="px-6 py-6 space-y-6">
        <!-- Main Links -->
        <div class="space-y-3">
          <a
            href="/shop?badge=Best+Seller"
            onclick={() => uiStore.closeMobileMenu()}
            class="block text-base font-medium text-[#1A1A1A]"
          >
            Best Sellers
          </a>
          <a
            href="/shop?badge=New+Arrival"
            onclick={() => uiStore.closeMobileMenu()}
            class="block text-base font-medium text-[#1A1A1A]"
          >
            New Arrivals
          </a>

          <!-- Accordion Categories -->
          <div class="pt-2 border-t border-[#F0ECE8]">
            <button
              type="button"
              onclick={() => mobileCatOpen = !mobileCatOpen}
              class="flex items-center justify-between w-full text-base font-medium text-[#1A1A1A] py-1"
            >
              <span>Shop by Category</span>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" class="transition-transform" class:rotate-180={mobileCatOpen}><path d="m2 4.5 4 4 4-4"/></svg>
            </button>
            {#if mobileCatOpen}
              <div class="pl-4 pt-2 space-y-2 text-sm text-[#6B6B6B]">
                <a href="/shop?category=daily-comfort" onclick={() => uiStore.closeMobileMenu()} class="block py-1 hover:text-[#1A1A1A]">Daily Comfort</a>
                <a href="/shop?category=flats" onclick={() => uiStore.closeMobileMenu()} class="block py-1 hover:text-[#1A1A1A]">Elegant Flats</a>
                <a href="/shop?category=wedges" onclick={() => uiStore.closeMobileMenu()} class="block py-1 hover:text-[#1A1A1A]">Soft Wedges</a>
                <a href="/shop?category=slippers" onclick={() => uiStore.closeMobileMenu()} class="block py-1 hover:text-[#1A1A1A]">Slides &amp; Slippers</a>
                <a href="/shop" onclick={() => uiStore.closeMobileMenu()} class="block py-1 font-semibold text-[#1A1A1A]">All Footwear &rarr;</a>
              </div>
            {/if}
          </div>

          <!-- Accordion Occasions -->
          <div class="pt-2 border-t border-[#F0ECE8]">
            <button
              type="button"
              onclick={() => mobileOccOpen = !mobileOccOpen}
              class="flex items-center justify-between w-full text-base font-medium text-[#1A1A1A] py-1"
            >
              <span>Shop by Occasion</span>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" class="transition-transform" class:rotate-180={mobileOccOpen}><path d="m2 4.5 4 4 4-4"/></svg>
            </button>
            {#if mobileOccOpen}
              <div class="pl-4 pt-2 space-y-2 text-sm text-[#6B6B6B]">
                <a href="/shop?occasion=work" onclick={() => uiStore.closeMobileMenu()} class="block py-1 hover:text-[#1A1A1A]">Everyday &amp; Work</a>
                <a href="/shop?occasion=weekend" onclick={() => uiStore.closeMobileMenu()} class="block py-1 hover:text-[#1A1A1A]">Weekend &amp; Travel</a>
                <a href="/shop?occasion=evening" onclick={() => uiStore.closeMobileMenu()} class="block py-1 hover:text-[#1A1A1A]">Evening &amp; Outings</a>
              </div>
            {/if}
          </div>

          <a
            href="/about"
            onclick={() => uiStore.closeMobileMenu()}
            class="block text-base font-medium text-[#1A1A1A] pt-2 border-t border-[#F0ECE8]"
          >
            Our Comfort Promise
          </a>
          <a
            href="/contact"
            onclick={() => uiStore.closeMobileMenu()}
            class="block text-base font-medium text-[#1A1A1A]"
          >
            Support &amp; Contact
          </a>
        </div>

        <!-- Account Section in Mobile -->
        <div class="pt-4 border-t border-[#E8E4E0] space-y-2">
          {#if authStore.user}
            <div class="mb-3">
              <p class="text-xs font-semibold text-[#1A1A1A]">{authStore.profile?.full_name ?? authStore.user.email}</p>
              <p class="text-[11px] text-[#6B6B6B]">{authStore.user.email}</p>
            </div>
            <a href="/account/orders" onclick={() => uiStore.closeMobileMenu()} class="block text-sm text-[#3D3D3D]">📦 My Orders</a>
            <a href="/account/wishlist" onclick={() => uiStore.closeMobileMenu()} class="block text-sm text-[#3D3D3D]">💝 Wishlist</a>
            <a href="/account/profile" onclick={() => uiStore.closeMobileMenu()} class="block text-sm text-[#3D3D3D]">👤 Profile &amp; Addresses</a>
            <button onclick={() => { uiStore.closeMobileMenu(); handleLogout(); }} class="block text-sm text-red-600 pt-2">Sign Out</button>
          {:else}
            <a
              href="/auth"
              onclick={() => uiStore.closeMobileMenu()}
              class="flex items-center justify-center w-full py-3 rounded-md bg-[#1A1A1A] text-white text-sm font-medium tracking-wide"
            >
              Sign In / Register
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</header>
