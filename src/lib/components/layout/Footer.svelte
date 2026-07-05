<script lang="ts">
  import { onMount } from 'svelte';

  let email = $state('');
  let subscribed = $state(false);
  let badgesRef: HTMLDivElement | undefined = $state();
  let badgesVisible = $state(false);

  function handleSubscribe(e: SubmitEvent) {
    e.preventDefault();
    if (email) { subscribed = true; email = ''; }
  }

  const trustBadges = [
    { icon: '🔒', title: 'Secure Checkout', sub: '256-bit SSL Encryption' },
    { icon: '↩', title: 'Easy Returns', sub: '15-day hassle-free returns' },
    { icon: '🌞', title: 'Indian Summers', sub: 'Designed for our climate' },
    { icon: '🚚', title: 'Free Shipping', sub: 'On all orders' },
  ];

  onMount(() => {
    if (!badgesRef) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            badgesVisible = true;
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    
    observer.observe(badgesRef);
    
    return () => observer.disconnect();
  });
</script>

<footer style="background: var(--color-text-dark); color: white;">
  <!-- Trust badges strip -->
  <div class="border-b" style="border-color: rgba(255,255,255,0.1);">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div bind:this={badgesRef} class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {#each trustBadges as badge, i}
          <div 
            class="flex items-center gap-3 trust-badge-animate trust-badge-hover"
            class:ft-visible={badgesVisible}
            style="transition-delay: {i * 0.1}s;"
          >
            <span class="text-2xl" role="img" aria-hidden="true">{badge.icon}</span>
            <div>
              <p class="text-sm font-semibold">{badge.title}</p>
              <p class="text-xs opacity-60">{badge.sub}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Main footer content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
      <!-- Brand -->
      <div class="lg:col-span-1">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 shadow-sm">
            <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-full h-full object-contain" />
          </div>
          <span class="font-display text-xl font-semibold">French Toes</span>
        </div>
        <p class="text-sm opacity-70 leading-relaxed mb-2">
          Premium women's footwear crafted for Indian summers. Breathable, beautiful, and made to last — because your comfort deserves the best.
        </p>
        <p class="text-xs opacity-50 mb-3">
          Vertex International<br/>
          32 KM, Grand Trunk Rd, Kundli,<br/>
          Sonipat, Haryana 131028
        </p>
        <div class="flex gap-3">
          {#each [
            { href: '#', label: 'Instagram', path: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zm1.5-4.87h.01M7.5 20.5h9a6 6 0 0 0 6-6v-9a6 6 0 0 0-6-6h-9a6 6 0 0 0-6 6v9a6 6 0 0 0 6 6z' },
            { href: '#', label: 'Facebook', path: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' },
            { href: '#', label: 'Pinterest', path: 'M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z' },
          ] as social}
            <a
              href={social.href}
              class="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
              style="background: rgba(255,255,255,0.1);"
              aria-label={social.label}
            >
              <svg width="16" height="16" fill="none" stroke="white" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d={social.path}/>
              </svg>
            </a>
          {/each}
        </div>
      </div>

      <!-- Quick Links -->
      <div>
        <h3 class="font-semibold text-sm uppercase tracking-wider mb-4 opacity-80">Shop</h3>
        <ul class="space-y-2">
          {#each [
            { href: '/shop', label: 'All Footwear' },
            { href: '/shop?badge=Best+Seller', label: 'Best Sellers' },
            { href: '/shop?badge=New+Arrival', label: 'New Arrivals' },
            { href: '/shop?badge=Sale', label: 'Summer Sale 🌸' },
          ] as link}
            <li>
              <a href={link.href} class="text-sm opacity-70 hover:opacity-100 transition-opacity">{link.label}</a>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Help & Legal -->
      <div>
        <h3 class="font-semibold text-sm uppercase tracking-wider mb-4 opacity-80">Help & Policies</h3>
        <ul class="space-y-2">
          {#each [
            { href: '/contact', label: 'Contact Us' },
            { href: '/shipping', label: 'Shipping Policy' },
            { href: '/refund', label: 'Refund & Cancellation' },
            { href: '/privacy', label: 'Privacy Policy' },
            { href: '/terms', label: 'Terms of Service' },
          ] as link}
            <li>
              <a href={link.href} class="text-sm opacity-70 hover:opacity-100 transition-opacity">{link.label}</a>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Newsletter -->
      <div>
        <h3 class="font-display text-lg font-semibold mb-2">Join the Blossom Club</h3>
        <p class="text-sm opacity-70 mb-4">Get early access to new arrivals, exclusive offers & summer style tips.</p>
        {#if subscribed}
          <p class="text-sm font-semibold" style="color: var(--color-mint-deep);">
            🌸 Welcome to the club!
          </p>
        {:else}
          <form onsubmit={handleSubscribe} class="flex flex-col gap-2">
            <input
              bind:value={email}
              type="email"
              placeholder="your@email.com"
              required
              class="newsletter-input px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white;"
            />
            <button type="submit" class="btn-primary btn-shimmer text-sm py-2.5 justify-center">
              Subscribe
            </button>
          </form>
        {/if}
      </div>
    </div>
  </div>

  <!-- Bottom bar -->
  <div class="border-t" style="border-color: rgba(255,255,255,0.1);">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
      <p class="text-xs opacity-50">© 2026 French Toes — Vertex International. Made with 🌸 in India. All rights reserved.</p>
      <div class="flex items-center gap-3 opacity-60">
        <!-- Payment icons -->
        {#each ['UPI', 'VISA', 'MC', 'COD'] as icon}
          <span class="px-2 py-1 rounded text-xs font-bold border" style="border-color: rgba(255,255,255,0.3);">{icon}</span>
        {/each}
      </div>
    </div>
  </div>
</footer>