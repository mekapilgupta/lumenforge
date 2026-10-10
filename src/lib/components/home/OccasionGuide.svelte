<script lang="ts">
  const occasions = [
    {
      title: 'Everyday & Work',
      desc: 'Quiet, polished pairs that survive a full day on your feet.',
      image: '/images/brand/occ-trench.jpg',
      href: '/shop?occasion=work'
    },
    {
      title: 'Weekend & Travel',
      desc: 'Feather-light, packable and endlessly easy.',
      image: '/images/brand/occ-street.jpg',
      href: '/shop?occasion=weekend'
    },
    {
      title: 'Evening & Occasions',
      desc: 'Dressed-up comfort for dinners and celebrations.',
      image: '/images/brand/occ-warm.jpg',
      href: '/shop?occasion=evening'
    }
  ];
</script>

<section class="py-16 md:py-24 bg-white border-b border-[#E8E4E0]" id="occasions">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-xl mx-auto mb-12 sm:mb-16">
      <p class="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">Shop by occasion</p>
      <h2 class="font-serif text-3xl sm:text-4xl text-[#1A1A1A] font-normal tracking-tight">Made for the way you actually live</h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
      {#each occasions as occ}
        <a href={occ.href} class="group block bg-[#F9F6F2] rounded-2xl overflow-hidden border border-[#E8E4E0] shadow-sm hover:shadow-xl transition-all duration-500">
          <div class="aspect-[4/5] overflow-hidden bg-white relative">
            <img
              src={occ.image}
              alt={occ.title}
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              loading="lazy"
            />
          </div>
          <div class="p-6 sm:p-8 space-y-2">
            <h3 class="font-serif text-xl text-[#1A1A1A] font-normal group-hover:text-[#D4A5A5] transition-colors">{occ.title}</h3>
            <p class="text-xs text-[#6B6B6B] leading-relaxed">{occ.desc}</p>
            <div class="pt-2 flex items-center gap-1.5 text-xs font-semibold text-[#1A1A1A] group-hover:underline">
              <span>Shop the edit</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </div>
          </div>
        </a>
      {/each}
    </div>
  </div>
</section>
