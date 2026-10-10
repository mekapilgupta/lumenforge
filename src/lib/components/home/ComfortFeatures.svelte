<script lang="ts">
  const features = [
    {
      title: 'Cushiony Footbed',
      desc: 'Dual-density memory foam that softens every step, so day-long wear never feels like a compromise.',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 15c2.5-1.6 4.5 1.6 7 0s4.5 1.6 7 0 4-1.2 4-1.2"/><path d="M3 10c2.5-1.6 4.5 1.6 7 0s4.5 1.6 7 0 4-1.2 4-1.2"/></svg>`
    },
    {
      title: 'Feather-Light',
      desc: "Most pairs weigh under 200g. You'll forget you're wearing them — in the best possible way.",
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4c-9 1-13 6-13 13"/><path d="M7 17h9c3 0 5-2 5-5V4"/><path d="M11 9h5"/></svg>`
    },
    {
      title: 'Flexible Sole',
      desc: 'Bend-and-twist TPR soles that move naturally with your foot instead of fighting against it.',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16c4 0 5-4 9-4s5 4 9 4"/><path d="M3 11c4 0 5-4 9-4s5 4 9 4" opacity=".45"/></svg>`
    },
    {
      title: 'Thoughtful Fit',
      desc: 'Built on a wider, kinder last designed for Indian feet — plus a strap that actually stays put.',
      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21c-3 0-5-2-5-5V8a5 5 0 0 1 10 0v8c0 3 2 5 5 5"/><path d="M2 8h10"/></svg>`
    }
  ];
</script>

<section class="py-16 md:py-24 bg-white border-b border-[#E8E4E0]">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-xl mx-auto mb-12 sm:mb-16">
      <p class="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#6B6B6B] mb-2">Comfort, engineered</p>
      <h2 class="font-serif text-3xl sm:text-4xl text-[#1A1A1A] font-normal tracking-tight">What makes French Toes magic</h2>
      <p class="text-xs sm:text-sm text-[#6B6B6B] mt-2">Four details we refuse to compromise on — in every single pair.</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
      {#each features as feat}
        <div class="p-6 sm:p-8 rounded-2xl bg-[#F9F6F2] border border-[#E8E4E0] hover:border-[#D4A5A5] transition-all hover:shadow-md flex flex-col items-center text-center">
          <div class="w-14 h-14 rounded-full bg-white border border-[#E8E4E0] flex items-center justify-center text-[#1A1A1A] mb-5 shrink-0 shadow-sm">
            {@html feat.icon}
          </div>
          <h3 class="font-serif text-lg text-[#1A1A1A] font-normal mb-2">{feat.title}</h3>
          <p class="text-xs text-[#6B6B6B] leading-relaxed">{feat.desc}</p>
        </div>
      {/each}
    </div>
  </div>
</section>
