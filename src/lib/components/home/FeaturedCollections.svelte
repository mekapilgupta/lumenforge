<script lang="ts">
  import { LIFESTYLE_IMAGES } from '$lib/data/products';

  const collections = [
    {
      name: 'Blossom Classics',
      sub: 'Timeless pastels for everyday luxury',
      image: LIFESTYLE_IMAGES.collection1,
      href: '/shop?category=blossom-classics',
      accent: 'var(--color-blush)',
    },
    {
      name: 'Garden Party',
      sub: 'Floral, vibrant & celebration-ready',
      image: LIFESTYLE_IMAGES.collection2,
      href: '/shop?category=garden-party',
      accent: 'var(--color-lavender)',
    },
    {
      name: 'Beach Days',
      sub: 'Quick-dry, bold & built for sun',
      image: LIFESTYLE_IMAGES.collection3,
      href: '/shop?category=beach-days',
      accent: 'var(--color-mint)',
    },
    {
      name: 'Home Luxe',
      sub: 'Premium comfort for your sanctuary',
      image: LIFESTYLE_IMAGES.collection4,
      href: '/shop?category=home-luxe',
      accent: 'var(--color-peach)',
    },
  ];
</script>

<section class="section" style="background: var(--color-warm-white);">
  <div class="max-w-7xl mx-auto">
    <!-- Heading -->
    <div class="text-center mb-10">
      <span class="text-xs font-semibold uppercase tracking-widest" style="color: var(--color-blush-deep);">Shop by Mood</span>
      <h2 class="font-display text-3xl md:text-4xl font-bold mt-2" style="color: var(--color-text-dark);">Our Collections</h2>
      <p class="mt-3 text-base max-w-md mx-auto" style="color: var(--color-text-mid);">
        Four curated worlds of comfort — find your perfect summer vibe.
      </p>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {#each collections as col}
        <a
          href={col.href}
          class="group relative rounded-2xl overflow-hidden card-lift"
          style="aspect-ratio: 3/4;"
          aria-label="Shop {col.name}"
        >
          <!-- Image -->
          <div class="img-zoom absolute inset-0">
            <img
              src={col.image}
              alt={col.name}
              class="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          <!-- Overlay -->
          <div
            class="absolute inset-0 transition-opacity duration-300 group-hover:opacity-70"
            style="background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%);"
            aria-hidden="true"
          ></div>

          <!-- Label -->
          <div class="absolute bottom-0 left-0 right-0 p-4">
            <p class="text-xs font-semibold uppercase tracking-wider mb-1" style="color: {col.accent};">
              {col.sub}
            </p>
            <h3 class="font-display text-xl font-bold text-white leading-tight">{col.name}</h3>
            <span
              class="inline-flex items-center gap-1 text-xs font-semibold mt-2 transition-all duration-300 group-hover:gap-2"
              style="color: {col.accent};"
            >
              Shop Now
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </div>
        </a>
      {/each}
    </div>
  </div>
</section>
