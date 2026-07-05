<div class="py-2.5 gradient-blush-peach flex flex-col gap-1.5" aria-label="Promotional banner" role="marquee">
  <!-- Main marquee (faster speed, desktop only) -->
  <div class="marquee-wrap sm:block hidden">
    <div class="marquee-track" style="animation-duration: 20s;">
      {#each Array(2) as _}
        <span class="inline-flex items-center gap-6 px-6 text-sm font-semibold animate-pulse-slow" style="color: var(--color-text-dark); font-size: 0.9rem; font-weight: 600;">
          {#each [
            '🏷️ Flat 5% Off on Prepaid Orders',
            '💖 COD Available',
            '🚚 Free Shipping on All Orders',
            '🌸 Blossom Summer Sale — Up to 40% Off',
            '✨ Limited Edition Styles',
            '🌺 New Pastel Colors Just Dropped',
          ] as item}
            <span>{item}</span>
            <span aria-hidden="true" class="opacity-40">◆</span>
          {/each}
        </span>
      {/each}
    </div>
  </div>
  
  <!-- Mobile alternate line (mobile only) -->
  <div class="marquee-mobile-alt marquee-wrap py-1.5 block sm:hidden" style="background: rgba(232,100,122,0.15);">
    <div class="marquee-track" style="animation-duration: 25s; animation-direction: reverse;">
      {#each Array(2) as _}
        <span class="inline-flex items-center gap-4 px-4 text-xs font-semibold" style="color: var(--color-text-dark);">
          {#each [
            '🏷️ 5% Off on Prepaid Orders',
            '💖 COD Available',
            '🚚 Free Shipping on All Orders',
            '✨ New Pastel Colors Just Dropped',
          ] as item}
            <span>{item}</span>
            <span aria-hidden="true" class="opacity-40">◆</span>
          {/each}
        </span>
      {/each}
    </div>
  </div>
</div>