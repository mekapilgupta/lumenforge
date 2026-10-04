<script lang="ts">
  const items: { label: string; href: string }[] = [
    { label: '🪔 Navratri Picks', href: '/shop?category=flats' },
    { label: '💃 Garba Pairs', href: '/shop?category=flats' },
    { label: '🌸 Diwali Footwear', href: '/shop?badge=Best+Seller' },
    { label: '⭐ Best Sellers', href: '/shop?badge=Best+Seller' },
    { label: '🆕 New Arrivals', href: '/shop?badge=New+Arrival' },
    { label: '🇮🇳 Made for India', href: '/shop' },
    { label: '✨ Limited Edition', href: '/shop?badge=Limited+Edition' },
    { label: '💖 10,000+ Happy Women', href: '/shop' },
  ];
</script>

<div class="ft-marquee-strip" aria-label="Product categories and highlights" role="marquee">
  <div class="ft-marquee-track">
    {#each Array(2) as _}
      {#each items as item}
        <a href={item.href} class="marquee-link">{item.label}</a>
        <span class="dot" aria-hidden="true">◆</span>
      {/each}
    {/each}
  </div>
</div>
