<script lang="ts">
  const occasions = [
    {
      id: 'garba',
      emoji: '💃',
      title: 'Garba & Dandiya Nights',
      tagline: 'Dance 9 nights with zero shoe-bites & cloud comfort',
      image: '/images/festive/hero_banner_garba.jpg',
      badge: 'Bestseller for Garba',
      features: ['Anti-Slip Diamond Grip', 'High-Rebound Foam', 'Featherweight 180g'],
      outfitMatch: 'Chaniya Cholis & Navratri Ghagras',
      link: '/shop?category=flats',
      btnText: 'Shop Garba Flats'
    },
    {
      id: 'diwali',
      emoji: '🪔',
      title: 'Diwali Puja & Parties',
      tagline: 'Regal golden tones & plush velvet for celebrations',
      image: '/images/festive/hero_banner_diwali.jpg',
      badge: 'Festive Signature',
      features: ['Zari & Zardozi Detailing', 'Velvet-Touch Upper', 'Padded Arch Support'],
      outfitMatch: 'Silk Sarees, Anarkalis & Lehengas',
      link: '/shop?badge=Best+Seller',
      btnText: 'Shop Diwali Pairs'
    },
    {
      id: 'wedges',
      emoji: '✨',
      title: 'Weddings & Receptions',
      tagline: 'Sophisticated height with all-day effortless balance',
      image: '/images/festive/story_wedges.jpg',
      badge: 'Statement Height',
      features: ['2.5" Ergonomic Wedge', 'Even Weight Distribution', 'Metallic Shimmer Finish'],
      outfitMatch: 'Heavy Embroidered Festive Wear',
      link: '/shop?category=wedges',
      btnText: 'Shop Festive Wedges'
    },
    {
      id: 'daily',
      emoji: '🌸',
      title: 'Festive Prep & Pooja at Home',
      tagline: 'Slip on, slip off ease for rangoli, pooja & hosting',
      image: '/images/festive/story_daily_comfort.jpg',
      badge: 'Everyday Luxury',
      features: ['Soft Tubular Cushioning', 'Quick Clean Fabric', 'Ultra-Flexible Sole'],
      outfitMatch: 'Daily Kurtis, Co-ords & Suits',
      link: '/shop?category=daily-comfort',
      btnText: 'Shop Daily Comfort'
    }
  ];

  let activeOccasionIdx = $state(0);
  const activeOccasion = $derived(occasions[activeOccasionIdx]);
</script>

<!-- Interactive Festive Occasion Style Guide -->
<section class="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#FFFFFF] to-[#FDFBF7] relative select-none">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-10">
      <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2.5" style="background: rgba(216,27,96,0.1); color: #d81b60; border: 1px solid rgba(216,27,96,0.25);">
        <span>✨</span>
        <span>Festive Styling Guide</span>
        <span>✨</span>
      </div>
      <h2 class="font-display text-3xl sm:text-4xl font-bold text-[#2d1b2e]">
        Match Your Festive Occasion
      </h2>
      <p class="text-xs sm:text-sm text-[#7a6270] mt-2 max-w-md mx-auto">
        Switch tabs to see the perfect pair designed for your outfit and celebration.
      </p>
    </div>

    <!-- Occasion Selector Tabs -->
    <div class="flex items-center justify-start sm:justify-center gap-2 sm:gap-3 overflow-x-auto pb-4 mb-8 scrollbar-none">
      {#each occasions as occ, idx}
        <button
          onclick={() => activeOccasionIdx = idx}
          class="shrink-0 flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer border"
          style="
            background: {activeOccasionIdx === idx ? '#2d1b2e' : '#FFFFFF'};
            color: {activeOccasionIdx === idx ? '#ffd080' : '#4a3b48'};
            border-color: {activeOccasionIdx === idx ? '#2d1b2e' : 'rgba(212,168,83,0.3)'};
            box-shadow: {activeOccasionIdx === idx ? '0 4px 14px rgba(45,27,46,0.25)' : 'none'};
          "
        >
          <span class="text-base">{occ.emoji}</span>
          <span>{occ.title}</span>
        </button>
      {/each}
    </div>

    <!-- Active Occasion Showcase Card -->
    <div class="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-[#f0e0e8] shadow-xl overflow-hidden">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        <!-- Left: Image Showcase -->
        <div class="lg:col-span-6 relative aspect-[4/3] sm:aspect-[16/10] rounded-2xl overflow-hidden shadow-lg border border-[#f0e0e8]/50">
          <img
            src={activeOccasion.image}
            alt={activeOccasion.title}
            class="w-full h-full object-cover object-center transition-transform duration-700 hover:scale-105"
          />
          <div class="absolute top-4 left-4">
            <span class="px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#d81b60] text-white shadow-md">
              {activeOccasion.badge}
            </span>
          </div>
        </div>

        <!-- Right: Details & Action -->
        <div class="lg:col-span-6 flex flex-col gap-5">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-2xl">{activeOccasion.emoji}</span>
              <span class="text-xs font-bold uppercase tracking-wider text-[#9e6d1c]">Perfect Pairing</span>
            </div>
            <h3 class="font-display text-2xl sm:text-3xl font-bold text-[#2d1b2e]">
              {activeOccasion.title}
            </h3>
            <p class="text-sm sm:text-base text-[#7a6270] mt-2 leading-relaxed">
              {activeOccasion.tagline}
            </p>
          </div>

          <!-- Outfit match pill -->
          <div class="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#d4a853]/30">
            <p class="text-xs font-semibold text-[#9e6d1c] uppercase tracking-wide">👗 Best Styled With:</p>
            <p class="text-sm font-bold text-[#2d1b2e] mt-0.5">{activeOccasion.outfitMatch}</p>
          </div>

          <!-- Feature Bullets -->
          <div class="space-y-2">
            {#each activeOccasion.features as feat}
              <div class="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-[#4a3b48]">
                <div class="w-5 h-5 rounded-full bg-[#d4a853]/15 flex items-center justify-center text-[#9e6d1c] shrink-0 text-xs">
                  ✓
                </div>
                <span>{feat}</span>
              </div>
            {/each}
          </div>

          <!-- CTA Button -->
          <div class="pt-2">
            <a
              href={activeOccasion.link}
              class="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold text-white transition-all shadow-md hover:shadow-lg hover:scale-105"
              style="background: linear-gradient(135deg, #d81b60 0%, #c2185b 100%);"
            >
              <span>{activeOccasion.btnText}</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
          </div>

        </div>

      </div>
    </div>

  </div>
</section>
