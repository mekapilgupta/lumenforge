<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Standalone and reusable slide list containing the requested banner images
  const slides = [
    {
      image: 'https://ik.imagekit.io/who7qvgvp/banners/1782513212(1).png',
      alt: 'French Toes Summer Sale - Premium Women\'s Slippers',
      link: '/shop?badge=Sale'
    },
    {
      image: 'https://ik.imagekit.io/who7qvgvp/banners/1782560916(1).png',
      alt: 'Cloud-Soft Cushioned Comfort - Pastel Dreams Collection',
      link: '/shop?badge=New+Arrival'
    },
    {
      image: 'https://ik.imagekit.io/who7qvgvp/banners/1782560899(1).png',
      alt: 'Everyday Chic Slipper Essentials - Crafted for Indian Summers',
      link: '/shop'
    }
  ];

  // Svelte 5 reactive states
  let activeIdx = $state(0);
  let isHovering = $state(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  // Swipe detection coordinate storage
  let touchStartX = 0;
  let touchEndX = 0;

  function nextSlide() {
    activeIdx = (activeIdx + 1) % slides.length;
  }

  function prevSlide() {
    activeIdx = (activeIdx - 1 + slides.length) % slides.length;
  }

  function setSlide(idx: number) {
    activeIdx = idx;
    resetAutoplay();
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(() => {
      if (!isHovering) {
        nextSlide();
      }
    }, 5000);
  }

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function resetAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  // Keyboard navigation handler
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      nextSlide();
      resetAutoplay();
    } else if (e.key === 'ArrowLeft') {
      prevSlide();
      resetAutoplay();
    }
  }

  // Touch handlers for mobile swipe guestures
  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
  }

  // Touch end handler
  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
  }

  function handleSwipeGesture() {
    const swipeThreshold = 50; // Minimum swipe distance in pixels
    if (touchStartX - touchEndX > swipeThreshold) {
      // Swiped Left -> Next Slide
      nextSlide();
      resetAutoplay();
    } else if (touchEndX - touchStartX > swipeThreshold) {
      // Swiped Right -> Previous Slide
      prevSlide();
      resetAutoplay();
    }
  }

  onMount(() => {
    startAutoplay();
  });

  onDestroy(() => {
    stopAutoplay();
  });
</script>

<!-- Outer Slider Container with hover triggers and keyboard events -->
<div
  class="relative w-full aspect-[1664/928] sm:aspect-auto sm:h-[380px] md:h-[500px] lg:h-[600px] xl:h-[750px] overflow-hidden group select-none bg-neutral-100"
  onmouseenter={() => isHovering = true}
  onmouseleave={() => isHovering = false}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  role="region"
  aria-label="Promotional Hero Slider"
  tabindex="0"
  onkeydown={handleKeyDown}
>
  <!-- Slides Wrapper -->
  {#each slides as slide, idx}
    <div
      class="absolute inset-0 transition-all duration-1000 ease-in-out transform {activeIdx === idx ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-[1.02] z-0 pointer-events-none'}"
      aria-hidden={activeIdx !== idx}
    >
      <a href={slide.link} class="block w-full h-full cursor-pointer relative" tabindex={activeIdx === idx ? 0 : -1}>
        <!-- Hero Banner Image -->
        <img
          src={slide.image}
          alt={slide.alt}
          class="w-full h-full object-cover object-center transition-transform duration-[6000ms] ease-out {activeIdx === idx ? 'scale-[1.01]' : 'scale-100'}"
          loading={idx === 0 ? 'eager' : 'lazy'}
        />
        <!-- Subtle shadow overlay at bottom for organic transition to sale banner -->
        <div class="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/5 to-transparent pointer-events-none"></div>
      </a>
    </div>
  {/each}

  <!-- Navigation Arrows (Hidden on Mobile, Hover State for Desktop) -->
  <button
    onclick={() => { prevSlide(); resetAutoplay(); }}
    class="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 z-20 hover:scale-105 active:scale-95 hidden lg:flex opacity-0 group-hover:opacity-100 bg-white/40 hover:bg-white/75 text-neutral-800 backdrop-blur-md border border-white/40 shadow-sm"
    aria-label="Previous Slide"
    tabindex="0"
  >
    <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 19l-7-7 7-7"/>
    </svg>
  </button>
  
  <button
    onclick={() => { nextSlide(); resetAutoplay(); }}
    class="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 z-20 hover:scale-105 active:scale-95 hidden lg:flex opacity-0 group-hover:opacity-100 bg-white/40 hover:bg-white/75 text-neutral-800 backdrop-blur-md border border-white/40 shadow-sm"
    aria-label="Next Slide"
    tabindex="0"
  >
    <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5l7 7-7 7"/>
    </svg>
  </button>

  <!-- Modern Pill-style Bottom Dot Indicators -->
  <div class="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-20" role="tablist" aria-label="Slide Selection">
    <div class="bg-black/10 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/30 flex gap-2">
      {#each slides as _, idx}
        <button
          role="tab"
          aria-selected={activeIdx === idx}
          aria-label="Go to Slide {idx + 1}"
          onclick={() => setSlide(idx)}
          class="h-2 rounded-full transition-all duration-300 cursor-pointer"
          style="
            width: {activeIdx === idx ? '24px' : '8px'};
            background-color: {activeIdx === idx ? 'var(--color-brand-magenta, #D81B60)' : 'rgba(255, 255, 255, 0.65)'};
          "
        ></button>
      {/each}
    </div>
  </div>
</div>