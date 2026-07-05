<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let showScrollIndicator = $state(true);
  let activeSlide = $state(0);
  let mobileSlide = $state(0);

  const mobileSlides = [
    {
      image: '/images/sales-banner-1.jpg',
      title: 'Effortless Elegance',
      subtitle: 'Premium hand-crafted sliders',
      link: '/shop?badge=Sale'
    },
    {
      image: '/images/sales-banner-2.jpg',
      title: 'Poolside Comfort',
      subtitle: 'Cloud-soft cushioned soles',
      link: '/shop?badge=New+Arrival'
    },
    {
      image: '/images/sales-banner-3.jpg',
      title: 'Everyday Chic',
      subtitle: 'Indian summer essentials',
      link: '/shop'
    }
  ];

  onMount(() => {
    const slideInterval = setInterval(() => {
      activeSlide = (activeSlide + 1) % 2;
      mobileSlide = (mobileSlide + 1) % mobileSlides.length;
    }, 4000);

    const handleScroll = () => {
      if (window.scrollY > 80) {
        showScrollIndicator = false;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearInterval(slideInterval);
      window.removeEventListener('scroll', handleScroll);
    };
  });

  const bannerImages = [
    'https://i.postimg.cc/Jh6Vg652/image.png',
    'https://i.postimg.cc/nhh35HSt/image.png'
  ];
</script>

<section class="relative min-h-[auto] lg:min-h-[85vh] flex items-center overflow-hidden py-6 lg:py-20 bg-[#FDFBF7]">
  <!-- Background soft mesh gradient overlay -->
  <div class="absolute inset-0 opacity-40 pointer-events-none" style="background: radial-gradient(circle at 80% 20%, rgba(249, 213, 229, 0.6) 0%, rgba(255, 218, 185, 0.4) 50%, transparent 100%);"></div>

  <!-- Giant floating gradient orb behind left text -->
  <div class="absolute -left-20 top-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-pink-200 to-orange-100 blur-3xl opacity-70 pointer-events-none z-0"></div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
      
      <!-- Mobile Image Slider (visible on mobile only, placed first in DOM order) -->
      <div class="block lg:hidden w-full mb-2" aria-label="Mobile promotional banner">
        <div class="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-md border border-pink-100/30">
          <!-- Slides wrapper -->
          <div class="flex h-full w-[300%] transition-transform duration-700 ease-out" style="transform: translateX(-{mobileSlide * 33.333}%);">
            {#each mobileSlides as slide}
              <div class="w-1/3 h-full relative">
                <a href={slide.link} class="block w-full h-full" aria-label="View collection: {slide.title}">
                  <img 
                    src={slide.image} 
                    alt={slide.title} 
                    class="w-full h-full object-cover"
                  />
                </a>
              </div>
            {/each}
          </div>

          <!-- Indicators -->
          <div class="absolute bottom-3 right-4 flex gap-1 z-20">
            {#each mobileSlides as _, idx}
              <button 
                onclick={() => mobileSlide = idx}
                class="w-1.5 h-1.5 rounded-full transition-all duration-300"
                style="background: {mobileSlide === idx ? 'var(--color-brand-magenta)' : 'rgba(255,255,255,0.5)'}; width: {mobileSlide === idx ? '10px' : '5px'};"
                aria-label="Go to slide {idx + 1}"
              ></button>
            {/each}
          </div>
        </div>
      </div>

      <!-- LEFT COLUMN: Typography & Content -->
      <div class="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
        <span class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-pink-100 text-[var(--color-brand-magenta)] mb-4 lg:mb-6 animate-pulse">
          ✨ Summer 2026 Collection
        </span>

        <h1 class="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[#2d1b2e] leading-[1.1] mb-4 lg:mb-6">
          " Parisian Chic " <br class="hidden lg:inline" />
          <span class="text-[var(--color-brand-magenta)] relative text-2xl md:text-3xl lg:text-4xl block mt-2">
            —the art of looking incredibly elegant
            <svg class="absolute -bottom-2 left-0 w-full h-2 text-pink-300" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0,5 Q50,10 100,5" fill="none" stroke="currentColor" stroke-width="3" />
            </svg>
          </span>
        </h1>

        <!-- Desktop paragraph -->
        <p class="hidden lg:block text-lg md:text-xl text-[#6b4c6e] max-w-xl mb-10 leading-relaxed font-light">
          Experience cloud-like comfort and breezy elegance designed for sun-kissed days. Our limited-edition pastels keep you cool through the Indian summer heat.
        </p>

        <!-- Mobile paragraph (Compact: 1-2 lines only) -->
        <p class="block lg:hidden text-sm text-[#6b4c6e] max-w-md mb-6 leading-relaxed font-light">
          Cloud-soft comfort & breezy pastels for the Indian summer heat.
        </p>

        <!-- CTA & Promo info -->
        <div class="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 w-full sm:w-auto mb-6 lg:mb-12">
          <a href="/shop?badge=Sale" class="w-full sm:w-auto btn-primary btn-shimmer text-sm lg:text-base px-8 lg:px-10 py-3.5 lg:py-4 shadow-lg shadow-pink-200 hover:shadow-xl hover:shadow-pink-300 transition-all text-center">
            Shop Summer Sale
          </a>
          <a href="/shop" class="w-full sm:w-auto btn-outline text-sm lg:text-base px-6 lg:px-8 py-3.5 lg:py-4 text-center hover:bg-pink-50 transition-colors">
            Explore All
          </a>
        </div>

        <!-- Overlapping User Banners Preview -->
        <div class="hidden md:flex items-center gap-6 mt-2 relative w-full">
          <div class="absolute -top-12 left-4 text-xs font-semibold uppercase tracking-wider text-[#9e7ca0] flex items-center gap-2">
            <span>✨ Seasonal Highlights</span>
            <span class="w-12 h-[1px] bg-pink-200"></span>
          </div>
          
          {#each bannerImages as banner, idx}
            <div 
              class="relative bg-white p-2.5 rounded-2xl shadow-md transition-all duration-500 hover:scale-105 hover:-rotate-1 shrink-0 overflow-hidden group border border-pink-50"
              style="
                width: 200px;
                transform: rotate({idx === 0 ? '-3deg' : '2deg'}) translateY({idx === 0 ? '0' : '8px'});
                z-index: {idx === 0 ? '10' : '5'};
              "
            >
              <div class="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
                <img 
                  src={banner} 
                  alt="Summer banner highlight" 
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  loading="lazy"
                />
              </div>
              <div class="pt-2 text-center">
                <span class="font-display text-xs text-[#2d1b2e] font-semibold">
                  {idx === 0 ? 'Dreamy Comfort' : 'Effortless Style'}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- RIGHT COLUMN: Elegant Arched Mask Sliding Carousel (desktop only) -->
      <div class="hidden lg:flex lg:col-span-5 justify-center items-center relative">
        <!-- Soft decorative background elements -->
        <div class="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-orange-100 blur-2xl opacity-60 pointer-events-none"></div>
        <div class="absolute -left-6 -top-6 w-32 h-32 rounded-full bg-pink-100 blur-xl opacity-60 pointer-events-none"></div>

        <!-- Masked sliding image carousel -->
        <div class="relative w-full max-w-[360px] aspect-[3/4] bg-white p-3 rounded-t-full rounded-b-2xl shadow-xl shadow-pink-100/50 border border-pink-100/30 overflow-hidden">
          <div class="w-full h-full rounded-t-full rounded-b-xl overflow-hidden relative">
            <!-- Slides wrapper -->
            <div class="flex h-full w-[200%] transition-transform duration-1000 ease-out" style="transform: translateX(-{activeSlide * 50}%);">
              <div class="w-1/2 h-full">
                <img 
                  src="https://i.postimg.cc/nhh35HSt/image.png"
                  alt="Summer Collection Highlight 1"
                  class="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
              <div class="w-1/2 h-full">
                <img 
                  src="https://i.postimg.cc/Jh6Vg652/image.png"
                  alt="Summer Collection Highlight 2"
                  class="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            </div>

            <!-- Overlay styling border -->
            <div class="absolute inset-0 rounded-t-full rounded-b-xl border border-white/20 pointer-events-none z-10"></div>
            
            <!-- Slide Indicators -->
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              <button 
                onclick={() => activeSlide = 0}
                class="w-2 h-2 rounded-full transition-all duration-300" 
                style="background: {activeSlide === 0 ? 'var(--color-brand-magenta)' : 'rgba(255,255,255,0.6)'}; width: {activeSlide === 0 ? '16px' : '8px'};"
                aria-label="Go to slide 1"
              ></button>
              <button 
                onclick={() => activeSlide = 1}
                class="w-2 h-2 rounded-full transition-all duration-300" 
                style="background: {activeSlide === 1 ? 'var(--color-brand-magenta)' : 'rgba(255,255,255,0.6)'}; width: {activeSlide === 1 ? '16px' : '8px'};"
                aria-label="Go to slide 2"
              ></button>
            </div>
          </div>
          
          <!-- Floating tag badge -->
          <div class="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-md border border-pink-50 hidden md:flex items-center gap-2 z-20">
            <span class="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping"></span>
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#2d1b2e]">SLIDING VIBE</span>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Scroll Down Indicator -->
  {#if showScrollIndicator}
    <div 
      class="scroll-indicator absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-70 cursor-pointer pointer-events-none"
      transition:fade={{ duration: 300 }}
    >
      <span class="text-[10px] font-bold uppercase tracking-widest text-[#9e7ca0]">Scroll</span>
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="text-[var(--color-brand-magenta)]">
        <path d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
      </svg>
    </div>
  {/if}
</section>

<style>
  /* Custom micro-animations */
  @keyframes underlineSweep {
    0% { width: 0; }
    100% { width: 100%; }
  }
</style>
