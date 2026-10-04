<script lang="ts">
  const features = [
    {
      emoji: '🪶',
      badge: 'Feather-Light',
      title: 'Cloud-Soft Memory Cushion',
      desc: 'High-rebound memory foam insoles engineered to keep your feet pain-free for hours.',
      accent: '#d81b60',
      tag: 'Garba Ready'
    },
    {
      emoji: '💃',
      badge: 'Dance-Proof',
      title: 'Anti-Slip Grip Soles',
      desc: 'Diamond-tread high-density EVA soles. Safe on marble, polished dance floors & outdoors.',
      accent: '#e07020',
      tag: '9 Nights Certified'
    },
    {
      emoji: '👑',
      badge: 'Artisan Crafted',
      title: 'Festive Luxury Zari & Zardozi',
      desc: 'Handcrafted metallic straps, royal velvet finish & delicate shimmer to complement lehengas & sarees.',
      accent: '#9e6d1c',
      tag: 'Festive Edit'
    },
    {
      emoji: '🌿',
      badge: 'Skin Loving',
      title: 'Zero-Bite Soft Liners',
      desc: 'Ultra-smooth velvet-touch inner straps — no shoe bites, blisters, or band-aids ever.',
      accent: '#2e7d32',
      tag: '100% Comfort'
    },
    {
      emoji: '🎨',
      badge: 'Curated Palette',
      title: '18+ Festive Hues',
      desc: 'From royal maroon and antique gold to pastel berry & champagne for every festive outfit.',
      accent: '#7b1fa2',
      tag: 'Color Matched'
    },
    {
      emoji: '✨',
      badge: 'Limited Run',
      title: 'Exclusive Small-Batch Pairs',
      desc: 'Each edition produced in limited runs of 500 pairs — uniquely yours for celebrations.',
      accent: '#c2185b',
      tag: 'Collectible'
    },
  ];
</script>

<section class="py-16 px-4 sm:px-6 lg:px-8 bg-[#FDFBF7] relative overflow-hidden select-none" id="about">
  <!-- Subtle warm festive aura background effects -->
  <div class="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none" style="background: radial-gradient(circle, rgba(212,168,83,0.12), transparent);" aria-hidden="true"></div>
  <div class="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none" style="background: radial-gradient(circle, rgba(216,27,96,0.08), transparent);" aria-hidden="true"></div>

  <div class="max-w-7xl mx-auto relative z-10">
    <!-- Heading -->
    <div class="text-center mb-12">
      <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3" style="background: rgba(212,168,83,0.15); color: #9e6d1c; border: 1px solid rgba(212,168,83,0.35);">
        <span>🪔</span>
        <span>The French Toes Difference</span>
        <span>🪔</span>
      </div>
      <h2 class="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[#2d1b2e]">
        Why French Toes?
      </h2>
      <p class="mt-3 text-sm sm:text-base text-[#7a6270] max-w-xl mx-auto leading-relaxed">
        We obsess over every detail so your feet experience pure joy — through every garba night, Diwali evening & beyond.
      </p>
    </div>

    <!-- Festive Features Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each features as feat}
        <div
          class="relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-4 border border-[#f0e0e8] hover:border-[#d4a853]/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group"
          style="box-shadow: 0 4px 20px rgba(0,0,0,0.03);"
        >
          <!-- Top Tag & Icon Row -->
          <div class="flex items-center justify-between">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-transform duration-300 group-hover:scale-110"
              style="background: linear-gradient(135deg, rgba(253,248,243,1), rgba(245,230,220,0.8)); border: 1px solid rgba(212,168,83,0.3);"
            >
              <span>{feat.emoji}</span>
            </div>

            <!-- Festive Tag -->
            <span
              class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full text-white shadow-xs"
              style="background: {feat.accent};"
            >
              {feat.tag}
            </span>
          </div>

          <!-- Content -->
          <div class="mt-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#9e6d1c] block mb-1">
              {feat.badge}
            </span>
            <h3 class="font-display font-bold text-lg sm:text-xl text-[#2d1b2e] leading-snug group-hover:text-[#d81b60] transition-colors">
              {feat.title}
            </h3>
            <p class="text-xs sm:text-sm text-[#7a6270] mt-2 leading-relaxed">
              {feat.desc}
            </p>
          </div>

          <!-- Decorative bottom gold accent bar -->
          <div class="w-full h-1 rounded-full bg-gradient-to-r from-transparent via-[#d4a853]/30 to-transparent group-hover:via-[#d81b60]/50 transition-all"></div>
        </div>
      {/each}
    </div>
  </div>
</section>