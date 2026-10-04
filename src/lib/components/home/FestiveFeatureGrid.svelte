<script lang="ts">
  const featureCards = [
    {
      badge: '💃 GARBA NIGHT EDIT',
      badgeColor: '#e07020',
      title: 'Dance All Night',
      subtitle: 'Cloud-cushioned soles crafted for 9 nights of non-stop Dandiya & Garba.',
      image: '/images/festive/hero_banner_garba.jpg',
      link: '/shop?category=flats',
      btnText: 'Shop Garba Flats'
    },
    {
      badge: '🪔 DIWALI LUXE',
      badgeColor: '#d4a853',
      title: 'Royal Festive Radiance',
      subtitle: 'Rich zardozi, shimmering gold & plush velvet comfort for grand celebrations.',
      image: '/images/festive/hero_banner_diwali.jpg',
      link: '/shop?badge=Best+Seller',
      btnText: 'Explore Diwali Edit'
    },
    {
      badge: '✨ LIMITED OFFER',
      badgeColor: '#d81b60',
      title: 'Festive Flash Deals',
      subtitle: 'Special festive pricing + Free Express Shipping across India.',
      image: '/images/festive/story_festive_sale.jpg',
      link: '/shop?badge=Sale',
      btnText: 'Claim Festive Offer'
    }
  ];
</script>

<!-- 3-Column Festive Highlight Grid -->
<section class="py-12 px-4 sm:px-6 lg:px-8 bg-[#FDFBF7] relative overflow-hidden select-none">
  <!-- Subtle decorative rangoli watermark -->
  <div class="absolute -top-12 -right-12 w-64 h-64 rounded-full opacity-[0.04] pointer-events-none" style="background: radial-gradient(circle, #ffb347 10%, transparent 70%);"></div>

  <div class="max-w-7xl mx-auto">
    <!-- Section Header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2" style="background: rgba(212,168,83,0.12); color: #9e6d1c; border: 1px solid rgba(212,168,83,0.3);">
        <span>🪔</span>
        <span>Festive Highlights · 2026</span>
        <span>🪔</span>
      </div>
      <h2 class="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-[#2d1b2e]">
        Curated for the Season of Lights
      </h2>
      <p class="text-xs sm:text-sm text-[#7a6270] mt-1.5 max-w-lg mx-auto">
        Handpicked comfort pairs designed to elevate every traditional outfit.
      </p>
    </div>

    <!-- 3-Column Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {#each featureCards as card}
        <a
          href={card.link}
          class="group relative h-[360px] sm:h-[420px] md:h-[400px] lg:h-[440px] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-500 flex flex-col justify-end p-6 border border-[#f0e0e8]/60 hover:-translate-y-1 block"
        >
          <!-- Background Image with smooth zoom on hover -->
          <img
            src={card.image}
            alt={card.title}
            class="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />

          <!-- Gradient Overlay for clear text legibility -->
          <div
            class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-opacity duration-300"
          ></div>

          <!-- Content overlay -->
          <div class="relative z-10 flex flex-col">
            <!-- Badge -->
            <div class="mb-2.5">
              <span
                class="inline-block text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full text-white shadow-sm"
                style="background: {card.badgeColor}; letter-spacing: 0.08em;"
              >
                {card.badge}
              </span>
            </div>

            <!-- Title -->
            <h3 class="font-display text-xl sm:text-2xl font-bold text-white mb-1.5 leading-snug group-hover:text-[#ffd080] transition-colors">
              {card.title}
            </h3>

            <!-- Subtitle -->
            <p class="text-xs sm:text-sm text-white/80 line-clamp-2 mb-4 leading-relaxed">
              {card.subtitle}
            </p>

            <!-- Action Button / Link -->
            <div class="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white group-hover:text-[#ffd080] transition-all">
              <span>{card.btnText}</span>
              <svg class="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </a>
      {/each}
    </div>
  </div>
</section>
