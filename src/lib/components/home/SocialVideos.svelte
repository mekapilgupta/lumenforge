<script lang="ts">
  const items = [
    {
      url: 'https://i.ibb.co/fVtb4Yzc/AQPg-Tg-Dz-XLd-C4w-Um-UJY0-Alg-Ml8-Pvj7-BThjau-Yir-SPap-Fwymiqakg-X5-JT7-Pho-WYCi-MC558-KDVLWg-MSd-Pfo-LPv.gif',
      caption: 'Dreamy Pastel Steps 🌸',
      tag: 'Blush Pink'
    },
    {
      url: 'https://i.ibb.co/5xYhJCzT/AQPq-Sm-Ao-ZBi-LDVw-CZk-J9c-Ut-MAPOGWa15-Kta-F8x-Ag-CZW1-K5s26u0bz-O0dr-Zt4cn0-MVGb-TQOv-VHUVs1g0-Fq-Qq4.gif',
      caption: 'Cushioned Walking ✨',
      tag: 'Beige Luxe'
    }
  ];
</script>

<section class="py-16 bg-[#FDFDFD] border-b border-[#f0e0e8]/20 overflow-hidden">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    
    <!-- Header -->
    <div class="text-center mb-10">
      <span class="text-xs font-semibold uppercase tracking-widest text-[var(--color-brand-magenta)]">Lush Life</span>
      <h2 class="font-display text-3xl md:text-4xl font-bold mt-2 text-[#2d1b2e]">French Toes in Motion</h2>
      <p class="text-sm text-[#9e7ca0] mt-2 font-light max-w-md mx-auto">
        Step into the breeze. See our buttery-soft pastels in action.
      </p>
    </div>

    <!-- Gif Grid -->
    <div class="grid grid-cols-2 gap-4 md:gap-6 max-w-3xl mx-auto">
      {#each items as item}
        <div class="relative w-full aspect-[9/16] rounded-3xl overflow-hidden shadow-md border border-pink-100/30 group bg-zinc-50 hover:shadow-xl hover:scale-[1.01] transition-all duration-300">
          <img
            src={item.url}
            alt={item.caption}
            class="w-full h-full object-cover"
            loading="lazy"
          />

          <!-- Glassy Header Badge -->
          <div class="absolute top-4 left-4 bg-white/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/50 text-[10px] font-bold uppercase tracking-wider text-[#2d1b2e]">
            ✨ {item.tag}
          </div>

          <!-- Bottom Text Overlay -->
          <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 flex flex-col justify-end">
            <span class="text-white text-xs font-semibold tracking-wide drop-shadow-sm">{item.caption}</span>
            <span class="text-[9px] text-white/70 uppercase tracking-widest mt-1 font-medium">@frenchtoes.in</span>
          </div>
        </div>
      {/each}
    </div>

  </div>
</section>
