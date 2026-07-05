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
      style: 'background: linear-gradient(135deg, #FF2E93 0%, #FF8A80 100%); box-shadow: 0 4px 15px rgba(255, 46, 147, 0.3); border-color: rgba(255, 46, 147, 0.4);'
    },
    {
      id: 'flats-cat-id',
      slug: 'flats',
      name: 'Flats',
      emoji: '🥿',
      style: 'background: linear-gradient(135deg, #0284C7 0%, #7DD3FC 100%); box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3); border-color: rgba(2, 132, 199, 0.4);'
    },
    {
      id: 'daily-comfort-cat-id',
      slug: 'daily-comfort',
      name: 'Daily Comfort',
      emoji: '☁️',
      style: 'background: linear-gradient(135deg, #7E57C2 0%, #512DA8 100%); box-shadow: 0 4px 15px rgba(81, 45, 168, 0.3); border-color: rgba(81, 45, 168, 0.4);'
    }
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
      <span class="text-xs font-semibold uppercase tracking-widest text-[var(--color-brand-magenta)]">Lively Trends</span>
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
