<script lang="ts">
  interface HomeCategory {
    id: string;
    slug: string;
    name: string;
    emoji: string;
    style: string;
    badge?: string;
  }

  const categories: HomeCategory[] = [
    {
      id: 'wedges-cat-id',
      slug: 'wedges',
      name: 'Wedges',
      emoji: '👡',
      style: 'background: linear-gradient(135deg, #c0392b 0%, #e07020 100%); box-shadow: 0 4px 15px rgba(192,57,43,0.35); border-color: rgba(192,57,43,0.4);'
    },
    {
      id: 'flats-cat-id',
      slug: 'flats',
      name: 'Garba Flats',
      emoji: '💃',
      style: 'background: linear-gradient(135deg, #7b1fa2 0%, #e040fb 100%); box-shadow: 0 4px 15px rgba(123,31,162,0.35); border-color: rgba(123,31,162,0.4);'
    },
    {
      id: 'daily-comfort-cat-id',
      slug: 'daily-comfort',
      name: 'Daily Comfort',
      emoji: '☁️',
      style: 'background: linear-gradient(135deg, #d4a853 0%, #b5621a 100%); box-shadow: 0 4px 15px rgba(212,168,83,0.4); border-color: rgba(212,168,83,0.5);'
    },
    {
      id: 'bestseller-cat-id',
      slug: 'best-seller',
      name: 'Best Sellers',
      emoji: '⭐',
      badge: 'Best+Seller',
      style: 'background: linear-gradient(135deg, #1b5e20 0%, #43a047 100%); box-shadow: 0 4px 15px rgba(27,94,32,0.3); border-color: rgba(27,94,32,0.4);'
    },
    {
      id: 'new-arrival-cat-id',
      slug: 'new-arrival',
      name: 'New Arrivals',
      emoji: '🆕',
      badge: 'New+Arrival',
      style: 'background: linear-gradient(135deg, #01579b 0%, #29b6f6 100%); box-shadow: 0 4px 15px rgba(1,87,155,0.3); border-color: rgba(1,87,155,0.4);'
    },
  ];

  // Duplicate for infinite scrolling loop
  const scrollCategories = [...categories, ...categories, ...categories];

  function getCategoryHref(slug: string, badge?: string) {
    if (badge) {
      return `/shop?badge=${encodeURIComponent(badge)}`;
    }
    return `/shop?category=${encodeURIComponent(slug)}`;
  }
</script>

<section class="py-10 bg-[#FDFBF7] border-b border-[#f0e0e8]/30 overflow-hidden relative">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Title Section -->
    <div class="text-center md:text-left mb-6">
      <span class="text-xs font-semibold uppercase tracking-widest text-[var(--color-brand-magenta)]">Festive Collections</span>
      <h2 class="font-display text-3xl font-bold mt-1 text-[#2d1b2e]">Shop by Category</h2>
    </div>
  </div>

  <!-- Infinite Self-scrolling Row (Marquee) -->
  <div class="ft-marquee-container relative w-full overflow-hidden py-4">
    <div class="ft-marquee-scroll-track flex gap-4 w-max hover:play-paused">
      {#each scrollCategories as cat, idx}
        <a 
          href={getCategoryHref(cat.slug, cat.badge)} 
          class="inline-flex items-center gap-3 px-6 py-3.5 rounded-full text-white text-sm md:text-base font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 border border-white/20 select-none group"
          style={cat.style}
        >
          <span class="text-lg md:text-xl group-hover:animate-bounce shrink-0">{cat.emoji}</span>
          <span class="font-sans leading-none">{cat.name}</span>
        </a>
      {/each}
    </div>
  </div>
</section>

<style>
  @keyframes marqueeScrollHorizontal {
    0% { transform: translateX(0); }
    100% { transform: translateX(-33.333%); }
  }

  .ft-marquee-scroll-track {
    animation: marqueeScrollHorizontal 32s linear infinite;
  }

  .hover\:play-paused:hover {
    animation-play-state: paused;
  }
</style>
