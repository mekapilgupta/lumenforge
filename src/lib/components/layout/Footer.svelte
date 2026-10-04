<script lang="ts">
  import { onMount } from 'svelte';

  let badgesRef: HTMLDivElement | undefined = $state();
  let badgesVisible = $state(false);

  const trustBadges = [
    { icon: '🔒', title: 'Secure Checkout', sub: '256-bit SSL Encryption' },
    { icon: '🔄', title: 'Easy Exchanges', sub: '5-day size exchange' },
    { icon: '🪔', title: 'Made for Celebrations', sub: 'Navratri · Diwali · Karva Chauth' },
    { icon: '🚚', title: 'Free Shipping', sub: 'On all orders across India' },
  ];

  const festiveCategories = [
    { emoji: '💃', label: 'Garba Pairs', href: '/shop?category=daily-comfort' },
    { emoji: '🪔', label: 'Diwali Picks', href: '/shop?badge=Best+Seller' },
    { emoji: '✨', label: 'Festive Wedges', href: '/shop?category=wedges' },
    { emoji: '🌸', label: 'New Arrivals', href: '/shop?badge=New+Arrival' },
    { emoji: '🏷️', label: 'Sale Styles', href: '/shop?badge=Sale' },
  ];

  onMount(() => {
    if (!badgesRef) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { badgesVisible = true; observer.unobserve(entry.target); }
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(badgesRef);
    return () => observer.disconnect();
  });
</script>

<footer class="ft-footer">
  <!-- ── Rajasthani/Gujarati Arch Border (SVG Torana) ── -->
  <div class="torana-border" aria-hidden="true">
    <svg viewBox="0 0 1440 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Arch chain pattern — inspired by toran/bandhanwar -->
      <defs>
        <linearGradient id="toran-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="#d4a853"/>
          <stop offset="25%"  stop-color="#e07020"/>
          <stop offset="50%"  stop-color="#c0392b"/>
          <stop offset="75%"  stop-color="#e07020"/>
          <stop offset="100%" stop-color="#d4a853"/>
        </linearGradient>
      </defs>
      <!-- Top bar -->
      <rect x="0" y="0" width="1440" height="6" fill="url(#toran-grad)"/>
      <!-- Hanging arches (toran pendants) -->
      {#each Array(24) as _, i}
        {@const cx = i * 60 + 30}
        <ellipse cx={cx} cy="6" rx="22" ry="14" fill="none" stroke="url(#toran-grad)" stroke-width="2.5"/>
        <!-- Diamond gem at bottom of each arch -->
        <polygon points="{cx},{34} {cx-5},{44} {cx},{52} {cx+5},{44}" fill="#d4a853" opacity="0.9"/>
        <!-- Small circle accent -->
        <circle cx={cx} cy="6" r="4" fill="#c0392b"/>
      {/each}
      <!-- Marigold flowers between arches -->
      {#each Array(23) as _, i}
        {@const fx = i * 60 + 60}
        <circle cx={fx} cy="6" r="5" fill="#e07020" opacity="0.7"/>
        <circle cx={fx} cy="6" r="2.5" fill="#ffb347"/>
      {/each}
    </svg>
  </div>

  <!-- ── Trust Badges ── -->
  <div class="trust-strip">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div bind:this={badgesRef} class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {#each trustBadges as badge, i}
          <div
            class="trust-badge-animate trust-badge-hover flex items-center gap-3"
            class:ft-visible={badgesVisible}
            style="transition-delay: {i * 0.1}s;"
          >
            <span class="text-2xl" role="img" aria-hidden="true">{badge.icon}</span>
            <div>
              <p class="text-sm font-semibold text-white">{badge.title}</p>
              <p class="text-xs" style="color: rgba(255,200,120,0.7);">{badge.sub}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- ── Festive Banner ── -->
  <div class="festive-band">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
      <div class="text-center md:text-left">
        <p class="text-xs font-bold uppercase tracking-widest mb-1" style="color: #ffb347;">🪔 Celebrate the Season</p>
        <h2 class="font-display text-2xl md:text-3xl font-bold text-white">Navratri · Diwali · Festive Picks</h2>
        <p class="text-sm mt-1" style="color: rgba(255,255,255,0.65);">Step into every celebration with French Toes</p>
      </div>
      <div class="flex flex-wrap gap-2 justify-center">
        {#each festiveCategories as cat}
          <a
            href={cat.href}
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105"
            style="background: rgba(255,255,255,0.1); color: #ffe5b0; border: 1px solid rgba(212,168,83,0.4); text-decoration: none;"
          >
            <span>{cat.emoji}</span><span>{cat.label}</span>
          </a>
        {/each}
      </div>
    </div>
  </div>

  <!-- ── Main Footer Content ── -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

      <!-- Brand -->
      <div class="lg:col-span-1">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-9 h-9 rounded-full bg-white flex items-center justify-center p-1 shadow-sm">
            <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-full h-full object-contain" />
          </div>
          <span class="font-display text-xl font-semibold text-white">French Toes</span>
        </div>
        <p class="text-sm leading-relaxed mb-2" style="color: rgba(255,255,255,0.6);">
          Premium women's footwear crafted for Indian celebrations. From Navratri garba nights to Diwali diyas — step into every occasion beautifully.
        </p>
        <p class="text-xs mb-4" style="color: rgba(255,255,255,0.35);">
          Vertex International<br/>
          32 KM, Grand Trunk Rd, Kundli,<br/>
          Sonipat, Haryana 131028
        </p>
        <!-- Diya row decoration -->
        <div class="flex gap-1 mb-4" aria-hidden="true">
          {#each ['🪔','🌸','🪔','🌸','🪔'] as d}
            <span class="text-lg">{d}</span>
          {/each}
        </div>
        <div class="flex gap-3">
          {#each [
            { href: 'https://www.instagram.com/frenchtoes.in/', label: 'Instagram', path: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zm1.5-4.87h.01M7.5 20.5h9a6 6 0 0 0 6-6v-9a6 6 0 0 0-6-6h-9a6 6 0 0 0-6 6v9a6 6 0 0 0 6 6z' },
            { href: 'https://www.facebook.com/p/french-toes-61589116049975/', label: 'Facebook', path: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' },
          ] as social}
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              class="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
              style="background: rgba(212,168,83,0.2); border: 1px solid rgba(212,168,83,0.3);"
              aria-label={social.label}
            >
              <svg width="16" height="16" fill="none" stroke="#d4a853" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d={social.path}/>
              </svg>
            </a>
          {/each}
        </div>
      </div>

      <!-- Shop Links -->
      <div>
        <h3 class="text-sm font-bold uppercase tracking-wider mb-4" style="color: #d4a853;">🛍️ Shop</h3>
        <ul class="space-y-2.5">
          {#each [
            { href: '/shop', label: 'All Footwear' },
            { href: '/shop?badge=Best+Seller', label: 'Best Sellers' },
            { href: '/shop?badge=New+Arrival', label: 'New Arrivals' },
            { href: '/shop?category=wedges', label: 'Wedges' },
            { href: '/shop?category=flats', label: 'Flats' },
            { href: '/shop?badge=Sale', label: 'Festive Sale 🎉' },
          ] as link}
            <li>
              <a href={link.href} class="footer-link text-sm">{link.label}</a>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Help & Legal -->
      <div>
        <h3 class="text-sm font-bold uppercase tracking-wider mb-4" style="color: #d4a853;">📋 Help & Policies</h3>
        <ul class="space-y-2.5">
          {#each [
            { href: '/contact', label: 'Contact Us' },
            { href: '/shipping', label: 'Shipping Policy' },
            { href: '/refund', label: 'Exchange & Cancellation' },
            { href: '/privacy', label: 'Privacy Policy' },
            { href: '/terms', label: 'Terms of Service' },
          ] as link}
            <li>
              <a href={link.href} class="footer-link text-sm">{link.label}</a>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Festive Guide Column -->
      <div>
        <h3 class="text-sm font-bold uppercase tracking-wider mb-4" style="color: #d4a853;">🪔 Festive Style Guide</h3>
        <ul class="space-y-3">
          {#each [
            { emoji: '💃', title: 'Best Garba Pairs', desc: 'Comfy flats & wedges for long garba nights', href: '/shop?category=flats' },
            { emoji: '🪔', title: 'Diwali Footwear', desc: 'Gold & jewel tones for Diwali puja & parties', href: '/shop?badge=Best+Seller' },
            { emoji: '🌸', title: 'Gift a Pair', desc: 'Perfect festive gifting for her', href: '/shop' },
          ] as item}
            <li>
              <a href={item.href} class="flex gap-2 group" style="text-decoration: none;">
                <span class="text-xl shrink-0">{item.emoji}</span>
                <div>
                  <p class="text-sm font-semibold text-white group-hover:text-[#d4a853] transition-colors">{item.title}</p>
                  <p class="text-xs" style="color: rgba(255,255,255,0.45);">{item.desc}</p>
                </div>
              </a>
            </li>
          {/each}
        </ul>
      </div>

    </div>
  </div>

  <!-- ── Bottom Toran Bar ── -->
  <div class="border-t" style="border-color: rgba(212,168,83,0.2);">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
      <p class="text-xs" style="color: rgba(255,255,255,0.35);">
        © 2026 French Toes — Vertex International. Made with 🪔 in India. All rights reserved.
      </p>
      <div class="flex items-center gap-3" style="opacity: 0.6;">
        {#each ['UPI', 'VISA', 'MC', 'COD'] as icon}
          <span class="px-2 py-1 rounded text-xs font-bold border" style="border-color: rgba(212,168,83,0.4); color: rgba(255,255,255,0.7);">{icon}</span>
        {/each}
      </div>
    </div>
  </div>
</footer>

<style>
  .ft-footer {
    background: linear-gradient(180deg, #1a0a0a 0%, #2d1005 40%, #1a0a20 100%);
    color: white;
    position: relative;
    overflow: hidden;
  }

  /* Subtle mandala watermark */
  .ft-footer::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 700px;
    height: 700px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212,168,83,0.04) 0%, rgba(192,57,43,0.03) 40%, transparent 70%);
    pointer-events: none;
  }

  /* Toran border SVG wrapper */
  .torana-border {
    width: 100%;
    line-height: 0;
    height: 56px;
    overflow: hidden;
  }
  .torana-border svg {
    width: 100%;
    height: 56px;
    display: block;
  }

  .trust-strip {
    border-bottom: 1px solid rgba(212,168,83,0.15);
    background: rgba(0,0,0,0.2);
  }

  .festive-band {
    background: linear-gradient(135deg, rgba(120,20,10,0.6) 0%, rgba(80,10,60,0.6) 100%);
    border-top: 1px solid rgba(212,168,83,0.2);
    border-bottom: 1px solid rgba(212,168,83,0.2);
  }

  .footer-link {
    color: rgba(255,255,255,0.55);
    text-decoration: none;
    transition: color 0.2s;
    display: inline-block;
  }
  .footer-link:hover {
    color: #d4a853;
  }

  /* Trust badge animations (reuse existing global classes) */
  :global(.trust-badge-animate) {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.5s ease, transform 0.5s ease;
  }
  :global(.trust-badge-animate.ft-visible) {
    opacity: 1;
    transform: translateY(0);
  }
  :global(.trust-badge-hover:hover) {
    transform: translateY(-2px);
  }
</style>