<script lang="ts">
  // Monrow-style Luxury Split Hero
</script>

<section class="bg-[#F9F6F2] py-12 md:py-20 lg:py-24 border-b border-[#E8E4E0] overflow-hidden">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">

      <!-- Left Editorial Copy -->
      <div class="lg:col-span-6 space-y-6 text-center lg:text-left">
        <p class="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#6B6B6B]">
          Year-round comfort, everyday elegance
        </p>

        <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-[#1A1A1A] leading-[1.1] tracking-tight">
          Fashion Loves <em class="italic font-normal text-[#D4A5A5]">Comfort</em>
        </h1>

        <p class="text-sm sm:text-base text-[#6B6B6B] leading-relaxed max-w-lg mx-auto lg:mx-0">
          Designed for the modern woman who refuses to choose between style and ease. Cushioned, feather-light and quietly beautiful — from morning errands to evening plans.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
          <a
            href="/shop?badge=Best+Seller"
            class="w-full sm:w-auto px-8 py-3.5 rounded-md bg-[#1A1A1A] text-white text-xs font-semibold tracking-wider uppercase hover:bg-black transition-all text-center"
          >
            Shop Best Sellers
          </a>
          <a
            href="/shop?badge=New+Arrival"
            class="w-full sm:w-auto px-8 py-3.5 rounded-md bg-transparent border border-[#1A1A1A] text-[#1A1A1A] text-xs font-semibold tracking-wider uppercase hover:bg-white transition-all text-center"
          >
            New Arrivals
          </a>
        </div>

        <!-- Social Proof Bar -->
        <div class="pt-6 border-t border-[#E8E4E0] flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs text-[#6B6B6B]">
          <div class="flex items-center gap-1 text-[#F5A623]">
            {#each Array(5) as _}
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/></svg>
            {/each}
          </div>
          <span><b class="text-[#1A1A1A] font-semibold">4.8/5</b> from 12,400+ reviews</span>
          <span class="hidden sm:inline opacity-40">•</span>
          <span><b class="text-[#1A1A1A] font-semibold">50,000+</b> happy feet</span>
        </div>
      </div>

      <!-- Right Visual Feature (Client exotic photoshoot Uiintitled.png) -->
      <div class="lg:col-span-6 relative">
        <div class="relative mx-auto max-w-md lg:max-w-none rounded-2xl overflow-hidden shadow-2xl bg-white aspect-[4/5] group">
          <img
            src="/images/client/Uiintitled.png"
            alt="French Toes luxury comfort footwear in soft natural light"
            class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
            loading="eager"
          />
          <!-- Luxury Floating Product Chip -->
          <div class="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto bg-white/95 backdrop-blur-md px-5 py-3 rounded-xl border border-[#E8E4E0] shadow-lg flex items-center gap-4">
            <div class="w-10 h-10 rounded-lg overflow-hidden bg-[#F9F6F2] shrink-0">
              <img src="/images/client/Uncvlustitled.jpg" alt="" class="w-full h-full object-cover" onerror={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
            </div>
            <div>
              <p class="text-xs font-semibold text-[#1A1A1A]">Everyday Luxury Comfort</p>
              <p class="text-[11px] text-[#6B6B6B]">Dual-density foam footbed · 180g ultra-light</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</section>
