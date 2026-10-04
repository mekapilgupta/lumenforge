<script lang="ts">
  const reviews = [
    {
      name: 'Pooja Mehta',
      city: 'Ahmedabad, Gujarat',
      rating: 5,
      occasion: '💃 Navratri Garba',
      product: 'Garba Cushion Flats in Blush Pink',
      comment: 'Wore these for 4 straight hours of Garba in United Way Ahmedabad! Zero shoe bites, zero heel pain. Literally felt like dancing on clouds.',
      verified: true
    },
    {
      name: 'Ananya Sharma',
      city: 'Jaipur, Rajasthan',
      rating: 5,
      occasion: '🪔 Diwali Puja & Party',
      product: 'Festive Zardozi Wedge in Gold',
      comment: 'The golden shimmer matched my Banarasi saree effortlessly. Got so many compliments from cousins. Best festive footwear purchase!',
      verified: true
    },
    {
      name: 'Sneha Patel',
      city: 'Mumbai, Maharashtra',
      rating: 5,
      occasion: '✨ Family Sangeet',
      product: 'Daily Comfort Slide in Berry',
      comment: 'Ordered for festive season prep. The memory foam insole is unbelievably soft. Prompt COD delivery and great packaging.',
      verified: true
    }
  ];
</script>

<section class="py-16 px-4 sm:px-6 lg:px-8 bg-[#FFFFFF] relative overflow-hidden select-none border-t border-[#f0e0e8]/50">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-12">
      <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2.5" style="background: rgba(212,168,83,0.15); color: #9e6d1c; border: 1px solid rgba(212,168,83,0.35);">
        <span>⭐</span>
        <span>Real Festive Stories</span>
        <span>⭐</span>
      </div>
      <h2 class="font-display text-3xl sm:text-4xl font-bold text-[#2d1b2e]">
        Loved by Thousands Across India
      </h2>
      <p class="text-xs sm:text-sm text-[#7a6270] mt-2 max-w-md mx-auto">
        Here's what our customers are saying about their festive celebrations with French Toes.
      </p>
    </div>

    <!-- 3 Reviews Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {#each reviews as rev}
        <div class="bg-[#FDFBF7] rounded-2xl p-6 sm:p-7 border border-[#f0e0e8] flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
          <div>
            <!-- Stars & Occasion -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex text-[#ffb347] text-sm">
                {#each Array(rev.rating) as _}
                  <span>★</span>
                {/each}
              </div>
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-[#d4a853]/40 text-[#9e6d1c]">
                {rev.occasion}
              </span>
            </div>

            <!-- Comment -->
            <p class="text-sm text-[#3d2b38] leading-relaxed italic mb-4">
              "{rev.comment}"
            </p>
          </div>

          <!-- Author Info -->
          <div class="pt-4 border-t border-[#f0e0e8]">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-[#2d1b2e]">{rev.name}</p>
                <p class="text-xs text-[#7a6270]">{rev.city}</p>
              </div>
              <div class="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <span>✓</span>
                <span>Verified</span>
              </div>
            </div>
            <p class="text-[11px] text-[#9e6d1c] font-medium mt-1">
              Purchased: {rev.product}
            </p>
          </div>
        </div>
      {/each}
    </div>

    <!-- Festive Guarantee Strip -->
    <div class="mt-12 bg-gradient-to-r from-[#2d1b2e] via-[#451e36] to-[#2d1b2e] rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-lg">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
          🪔
        </div>
        <div>
          <h4 class="font-bold text-base sm:text-lg text-[#ffd080]">Guaranteed Festive Delivery Across India</h4>
          <p class="text-xs sm:text-sm text-white/80">Order today with Free Express Shipping & Easy 5-Day Size Exchange.</p>
        </div>
      </div>
      <a href="/shop" class="shrink-0 px-6 py-2.5 rounded-full bg-[#ffd080] text-[#2d1b2e] font-extrabold text-xs uppercase tracking-wider hover:bg-white transition-colors shadow-md">
        Shop Now →
      </a>
    </div>

  </div>
</section>
