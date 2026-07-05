<script lang="ts">
  const features = [
    {
      icon: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
      title: 'Breathable Fabric',
      desc: 'Engineered mesh & quick-dry materials keep your feet cool even in 45°C heat.',
      bg: 'var(--color-blush)',
      accent: 'var(--color-blush-deep)',
    },
    {
      icon: `<polyline points="20 6 9 17 4 12"/>`,
      title: 'Durable Anti-Slip Sole',
      desc: 'High-density EVA with grip texture — safe on wet floors, tiles & marble.',
      bg: 'var(--color-mint)',
      accent: 'var(--color-mint-deep)',
    },
    {
      icon: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
      title: 'All-Day Comfort',
      desc: 'Memory foam insoles and soft padded straps for zero-fatigue comfort all day.',
      bg: 'var(--color-lavender)',
      accent: 'var(--color-lavender-deep)',
    },
    {
      icon: `<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>`,
      title: 'Indian Summer Ready',
      desc: 'Designed specifically for India\'s climate: lightweight, airy, easy to clean.',
      bg: 'var(--color-peach)',
      accent: 'var(--color-peach-deep)',
    },
    {
      icon: `<circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125..."/>`,
      title: 'Handpicked Colors',
      desc: '18 blossom pastels this season — from Blush Pink to Lavender to Mint.',
      bg: 'var(--color-gold-light)',
      accent: 'var(--color-gold)',
    },
    {
      icon: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
      title: 'Limited Editions',
      desc: 'Only 500 pairs per color — exclusive, collectible summer slippers.',
      bg: 'var(--color-coral)',
      accent: 'var(--color-coral-deep)',
    },
  ];
</script>

<section class="section relative overflow-hidden" id="about" style="background-image: linear-gradient(rgba(253, 248, 243, 0.94), rgba(253, 248, 243, 0.94)), url('https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=1600&q=80'); background-size: cover; background-blend-mode: overlay; background-position: center;">
  <div class="max-w-7xl mx-auto">
    <!-- Heading -->
    <div class="text-center mb-10">
      <span class="text-xs font-semibold uppercase tracking-widest" style="color: var(--color-blush-deep);">Why Choose Us</span>
      <h2 class="font-display text-3xl md:text-4xl font-bold mt-2" style="color: var(--color-text-dark);">Why French Toes?</h2>
      <p class="mt-3 text-base max-w-lg mx-auto" style="color: var(--color-text-mid);">
        We obsess over every detail so your feet experience pure joy, all summer long.
      </p>
    </div>

    <!-- Features Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each features as feat}
        <div
          class="rounded-2xl p-6 flex flex-col gap-3 transition-transform duration-200 hover:-translate-y-1"
          style="background: {feat.bg};"
        >
          <div
            class="w-12 h-12 rounded-xl flex items-center justify-center"
            style="background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
          >
            <svg width="22" height="22" fill="none" stroke={feat.accent} stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              {@html feat.icon}
            </svg>
          </div>
          <div>
            <h3 class="font-display font-bold text-lg leading-tight" style="color: var(--color-text-dark);">{feat.title}</h3>
            <p class="text-sm mt-1 leading-relaxed" style="color: var(--color-text-mid);">{feat.desc}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>