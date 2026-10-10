<script lang="ts">
  const reviews = [
    {
      quote: "I wore these for a nine-hour work day including two commutes. Zero soreness — that has genuinely never happened with flats before.",
      name: 'Ananya S.',
      city: 'Bengaluru',
      initials: 'AS'
    },
    {
      quote: "Finally a pair that doesn't cut across the toes. The width is so comfortable and the colour goes with everything in my wardrobe.",
      name: 'Meera K.',
      city: 'Pune',
      initials: 'MK'
    },
    {
      quote: "Packed these for a week of travel and wore them every single day. Light enough to carry a second pair without thinking about it.",
      name: 'Ritika D.',
      city: 'Mumbai',
      initials: 'RD'
    }
  ];
</script>

<section class="py-16 md:py-24 bg-[#F9F6F2]">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-xl mx-auto mb-12 sm:mb-16">
      <p class="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">Real wear, real words</p>
      <h2 class="font-serif text-3xl sm:text-4xl text-[#1A1A1A] font-normal tracking-tight">Loved for how they feel</h2>
      <p class="text-xs sm:text-sm text-[#6B6B6B] mt-2">Verified reviews from women who wear French Toes every day.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
      {#each reviews as r}
        <article class="bg-white p-8 rounded-2xl border border-[#E8E4E0] shadow-sm flex flex-col justify-between space-y-6">
          <div class="space-y-4">
            <div class="flex items-center gap-1 text-[#F5A623]">
              {#each Array(5) as _}
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/></svg>
              {/each}
            </div>
            <p class="text-xs sm:text-sm text-[#3D3D3D] leading-relaxed italic">
              "{r.quote}"
            </p>
          </div>

          <div class="pt-4 border-t border-[#F0ECE8] flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-[#FBF3F2] text-[#D4A5A5] font-semibold text-xs flex items-center justify-center">
                {r.initials}
              </div>
              <div>
                <p class="text-xs font-semibold text-[#1A1A1A]">{r.name}</p>
                <p class="text-[11px] text-[#9A9A9A]">{r.city}</p>
              </div>
            </div>
            <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2E8B7A] bg-[#EBF7F4] px-2 py-0.5 rounded-full">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></svg>
              Verified
            </span>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>
