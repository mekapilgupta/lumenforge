<script lang="ts">
  const categories = [
    {
      title: 'Daily Comfort',
      meta: '48 styles',
      href: '/shop',
      image: '/images/client/Unasaqtitled.jpg',
      alt: 'Daily comfort footwear'
    },
    {
      title: 'Elegant Flats',
      meta: '32 styles',
      href: '/shop',
      image: '/images/client/Uewntitled.png',
      alt: 'Pointed and soft leather flats'
    },
    {
      title: 'Soft Wedges',
      meta: '18 styles',
      href: '/shop',
      image: '/images/client/Udfdgntitled.png',
      alt: 'Comfort soft block wedges'
    },
    {
      title: 'Best Sellers',
      meta: 'Most loved pairs',
      href: '/shop',
      image: '/images/client/Uncvlustitled.jpg',
      alt: 'Customer favorite footwear'
    },
    {
      title: 'New Arrivals',
      meta: 'Fresh this season',
      href: '/shop',
      image: '/images/client/qqUntitled.png',
      alt: 'Freshly launched styles'
    }
  ];
</script>

<section class="py-16 md:py-24 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-xl mx-auto mb-12 sm:mb-16">
      <p class="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">Shop &amp; Explore</p>
      <h2 class="font-serif text-3xl sm:text-4xl text-[#1A1A1A] font-normal tracking-tight">Find your everyday pair</h2>
      <p class="text-xs sm:text-sm text-[#6B6B6B] mt-2">Six collections, one promise — footwear you can live in all day.</p>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
      {#each categories as cat}
        <a href={cat.href} class="group flex flex-col text-center">
          <div class="w-full aspect-[4/5] rounded-xl overflow-hidden bg-[#F9F6F2] mb-3 border border-[#E8E4E0] shadow-sm relative">
            <img
              src={cat.image}
              alt={cat.alt}
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
          <h3 class="text-xs sm:text-sm font-semibold text-[#1A1A1A] group-hover:text-[#D4A5A5] transition-colors">{cat.title}</h3>
          <p class="text-[11px] text-[#9A9A9A] mt-0.5">{cat.meta}</p>
        </a>
      {/each}

      <!-- 6th Tile: Bold Black "SHOP ALL" -->
      <a href="/shop" class="group flex flex-col text-center">
        <div class="w-full aspect-[4/5] rounded-xl overflow-hidden bg-[#111111] mb-3 border border-[#111111] shadow-sm relative flex flex-col items-center justify-center p-4 transition-transform group-hover:scale-[1.03] group-hover:bg-black duration-300">
          <span class="text-white font-serif text-lg sm:text-xl font-bold tracking-wider uppercase mb-1">
            SHOP ALL
          </span>
          <span class="text-[10px] text-[#E8A0A0] uppercase tracking-widest font-semibold flex items-center gap-1">
            <span>Explore</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </span>
        </div>
        <h3 class="text-xs sm:text-sm font-bold text-[#111111] group-hover:text-[#D4A5A5] transition-colors">All Footwear</h3>
        <p class="text-[11px] text-[#9A9A9A] mt-0.5">Explore entire catalog</p>
      </a>
    </div>
  </div>
</section>
