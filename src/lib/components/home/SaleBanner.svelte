<div class="py-2.5 gradient-festive flex flex-col gap-1.5" aria-label="Promotional banner" role="marquee">
  <!-- Main marquee (desktop) -->
  <div class="marquee-wrap sm:block hidden">
    <div class="marquee-track" style="animation-duration: 22s;">
      {#each Array(2) as _}
        <span class="inline-flex items-center gap-6 px-6 text-sm font-semibold" style="color: #4a1a0a; font-size: 0.9rem; font-weight: 700;">
          {#each [
            '🪔 Happy Navratri & Diwali!',
            '💃 Pick Your Perfect Garba Pair',
            '🚚 Free Shipping on All Orders',
            '🏷️ Flat 5% Off on Prepaid Orders',
            '💖 COD Available',
            '🌸 New Festive Styles Just Dropped',
            '✨ Limited Edition Festival Colours',
          ] as item}
            <span>{item}</span>
            <span aria-hidden="true" class="opacity-40">◆</span>
          {/each}
        </span>
      {/each}
    </div>
  </div>

  <!-- Mobile alternate line -->
  <div class="marquee-mobile-alt marquee-wrap py-1.5 block sm:hidden" style="background: rgba(212,168,83,0.2);">
    <div class="marquee-track" style="animation-duration: 26s; animation-direction: reverse;">
      {#each Array(2) as _}
        <span class="inline-flex items-center gap-4 px-4 text-xs font-semibold" style="color: #4a1a0a;">
          {#each [
            '🪔 Happy Navratri & Diwali!',
            '💃 Garba Pairs Available',
            '🚚 Free Shipping',
            '💖 COD Available',
          ] as item}
            <span>{item}</span>
            <span aria-hidden="true" class="opacity-40">◆</span>
          {/each}
        </span>
      {/each}
    </div>
  </div>
</div>

<style>
  .gradient-festive {
    background: linear-gradient(135deg, #f5e6b0 0%, #ffd080 40%, #f5c07a 70%, #f5e6b0 100%);
  }
</style>