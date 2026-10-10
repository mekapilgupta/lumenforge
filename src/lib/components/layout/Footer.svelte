<script lang="ts">
  const trustBadges = [
    {
      title: 'Free Shipping',
      sub: 'All orders across India',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M2 7h11v9H2zM13 10h4.5l3.5 3.5V16h-8"/><circle cx="6.5" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/></svg>`
    },
    {
      title: '7-Day Exchanges',
      sub: 'Doorstep size exchange',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`
    },
    {
      title: 'Secure Checkout',
      sub: 'Prepaid & COD available',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>`
    },
    {
      title: 'Vegan Materials',
      sub: 'Kinder, skin-friendly craft',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 20c0-8 6-14 16-15 1 10-5 16-13 16H4Z"/><path d="M4 20c3-4 6-6 10-8"/></svg>`
    },
  ];

  let email = $state('');
  let subscribed = $state(false);

  function handleNewsletter(e: SubmitEvent) {
    e.preventDefault();
    if (email) {
      subscribed = true;
      email = '';
    }
  }
</script>

<footer class="bg-[#F9F6F2] text-[#1A1A1A] border-t border-[#E8E4E0] pt-12 pb-8">
  <!-- ── 1. Value / Trust Strip ── -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 border-b border-[#E8E4E0]">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
      {#each trustBadges as badge}
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#E8E4E0] flex items-center justify-center shrink-0 text-[#1A1A1A]">
            {@html badge.icon}
          </div>
          <div>
            <h4 class="text-xs sm:text-sm font-semibold tracking-wide text-[#1A1A1A]">{badge.title}</h4>
            <p class="text-[11px] sm:text-xs text-[#6B6B6B] mt-0.5">{badge.sub}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- ── 2. Main Footer Columns ── -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">

      <!-- Brand / Editorial Blurb -->
      <div class="lg:col-span-2 pr-0 lg:pr-8">
        <a href="/" class="flex items-center gap-2 mb-4" aria-label="French Toes Home">
          <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-7 h-7 object-contain" />
          <span class="font-serif text-2xl tracking-tight text-[#1A1A1A]">
            French <span class="italic text-[#D4A5A5]">Toes</span>
          </span>
        </a>
        <p class="text-sm text-[#6B6B6B] leading-relaxed mb-6 max-w-sm">
          French Toes creates premium women's slippers and flats that feel as good as they look. Soft, lightweight, and made for everyday elegance.
        </p>

        <!-- Newsletter form inside footer -->
        <div class="mb-6 max-w-sm">
          <p class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] mb-2">Get 5% off your first order</p>
          {#if subscribed}
            <p class="text-xs text-[#2E8B7A] font-medium bg-[#EBF7F4] py-2 px-3 rounded">Thank you! Use code <b>WELCOME5</b> at checkout.</p>
          {:else}
            <form onsubmit={handleNewsletter} class="flex gap-2">
              <input
                type="email"
                bind:value={email}
                placeholder="Enter email..."
                required
                class="flex-1 px-3 py-2 text-xs bg-white border border-[#E8E4E0] rounded-md focus:outline-none focus:border-[#1A1A1A]"
              />
              <button
                type="submit"
                class="px-4 py-2 text-xs font-semibold bg-[#1A1A1A] text-white rounded-md hover:bg-black transition-colors"
              >
                Join
              </button>
            </form>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <a
            href="https://www.instagram.com/frenchtoes.in/"
            target="_blank"
            rel="noopener noreferrer"
            class="w-8 h-8 rounded-full border border-[#E8E4E0] bg-white flex items-center justify-center text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            aria-label="Instagram"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>
          </a>
          <a
            href="https://www.facebook.com/p/french-toes-61589116049975/"
            target="_blank"
            rel="noopener noreferrer"
            class="w-8 h-8 rounded-full border border-[#E8E4E0] bg-white flex items-center justify-center text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            aria-label="Facebook"
          >
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.2c0-.9.3-1.5 1.6-1.5H16.5V5c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V11H8v3h2.1v7h3.4Z"/></svg>
          </a>
        </div>
      </div>

      <!-- Shop Links -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] mb-4">Shop</h3>
        <ul class="space-y-2.5 text-xs text-[#6B6B6B]">
          <li><a href="/shop" class="hover:text-[#1A1A1A] transition-colors">All Footwear</a></li>
          <li><a href="/shop?badge=Best+Seller" class="hover:text-[#1A1A1A] transition-colors">Best Sellers</a></li>
          <li><a href="/shop?badge=New+Arrival" class="hover:text-[#1A1A1A] transition-colors">New Arrivals</a></li>
          <li><a href="/shop?category=daily-comfort" class="hover:text-[#1A1A1A] transition-colors">Daily Comfort</a></li>
          <li><a href="/shop?category=flats" class="hover:text-[#1A1A1A] transition-colors">Elegant Flats</a></li>
          <li><a href="/shop?category=wedges" class="hover:text-[#1A1A1A] transition-colors">Soft Wedges</a></li>
          <li><a href="/shop?category=slippers" class="hover:text-[#1A1A1A] transition-colors">Slides &amp; Slippers</a></li>
        </ul>
      </div>

      <!-- Help & Policies -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] mb-4">Help &amp; Policies</h3>
        <ul class="space-y-2.5 text-xs text-[#6B6B6B]">
          <li><a href="/account/orders" class="hover:text-[#1A1A1A] transition-colors">Track Your Order</a></li>
          <li><a href="/shipping" class="hover:text-[#1A1A1A] transition-colors">Shipping &amp; Delivery</a></li>
          <li><a href="/refund" class="hover:text-[#1A1A1A] transition-colors">Exchanges &amp; Returns</a></li>
          <li><a href="/contact" class="hover:text-[#1A1A1A] transition-colors">Contact Customer Care</a></li>
          <li><a href="/privacy" class="hover:text-[#1A1A1A] transition-colors">Privacy Policy</a></li>
          <li><a href="/terms" class="hover:text-[#1A1A1A] transition-colors">Terms of Service</a></li>
        </ul>
      </div>

      <!-- About & Location -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] mb-4">About French Toes</h3>
        <ul class="space-y-2.5 text-xs text-[#6B6B6B]">
          <li><a href="/about" class="hover:text-[#1A1A1A] transition-colors">Our Comfort Promise</a></li>
          <li><a href="/about" class="hover:text-[#1A1A1A] transition-colors">Craftsmanship &amp; Sole</a></li>
          <li><a href="/about" class="hover:text-[#1A1A1A] transition-colors">Designed for Indian Feet</a></li>
        </ul>
        <div class="mt-4 pt-4 border-t border-[#E8E4E0] text-[11px] text-[#9A9A9A] leading-relaxed">
          <p class="font-medium text-[#6B6B6B]">Vertex International</p>
          <p>Kundli, Sonipat, Haryana 131028</p>
        </div>
      </div>

    </div>
  </div>

  <!-- ── 3. Bottom Legal & Payment Badges ── -->
  <div class="border-t border-[#E8E4E0] pt-6 mt-4">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
      <p class="text-[11px] text-[#9A9A9A]">
        © 2026 French Toes — Vertex International. All rights reserved.
      </p>

      <div class="flex items-center gap-2 text-[10px] font-semibold text-[#6B6B6B]">
        <span class="px-2 py-0.5 rounded border border-[#E8E4E0] bg-white">UPI</span>
        <span class="px-2 py-0.5 rounded border border-[#E8E4E0] bg-white">VISA</span>
        <span class="px-2 py-0.5 rounded border border-[#E8E4E0] bg-white">MASTERCARD</span>
        <span class="px-2 py-0.5 rounded border border-[#E8E4E0] bg-white">RUPAY</span>
        <span class="px-2 py-0.5 rounded border border-[#E8E4E0] bg-white">COD</span>
      </div>
    </div>
  </div>
</footer>