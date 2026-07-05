<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let { 
    images, 
    activeImage = 0, 
    isOpen = false, 
    onClose 
  }: { 
    images: string[]; 
    activeImage: number; 
    isOpen: boolean; 
    onClose: () => void;
  } = $props();

  let activeIdx = $state(activeImage);

  // Sync activeIdx when activeImage prop changes
  $effect(() => {
    activeIdx = activeImage;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowRight') {
      next();
    } else if (e.key === 'ArrowLeft') {
      prev();
    }
  }

  function next() {
    activeIdx = (activeIdx + 1) % images.length;
  }

  function prev() {
    activeIdx = (activeIdx - 1 + images.length) % images.length;
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 py-6 px-4 md:py-10 select-none animate-fade"
    transition:fade={{ duration: 250 }}
    role="dialog"
    aria-modal="true"
    aria-label="Image lightbox viewer"
  >
    <!-- Top Action Row (Close) -->
    <div class="w-full max-w-7xl flex justify-between items-center text-white z-10 px-4">
      <span class="text-sm font-semibold tracking-wider text-white/60">
        {activeIdx + 1} / {images.length}
      </span>
      <button 
        onclick={onClose}
        class="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105 cursor-pointer focus:outline-none"
        aria-label="Close modal"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Main Image and Control Row -->
    <div class="flex-1 w-full max-w-7xl flex items-center justify-between gap-4 relative">
      <!-- Background Click-to-Close -->
      <button 
        class="absolute inset-0 w-full h-full cursor-zoom-out border-none outline-none bg-transparent" 
        onclick={onClose} 
        aria-label="Close image viewer"
        tabindex="-1"
      ></button>

      <!-- Left Control (Desktop) -->
      <button 
        onclick={(e) => { e.stopPropagation(); prev(); }}
        class="relative z-10 w-14 h-14 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105 cursor-pointer hidden md:flex"
        aria-label="Previous image"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
      </button>

      <!-- Center Image -->
      <div class="relative max-w-[85vw] max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center z-10">
        <img 
          src={images[activeIdx]} 
          alt="Product details zoom viewport" 
          class="w-full h-full object-contain max-h-[70vh] rounded-xl select-none"
        />
      </div>

      <!-- Right Control (Desktop) -->
      <button 
        onclick={(e) => { e.stopPropagation(); next(); }}
        class="relative z-10 w-14 h-14 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105 cursor-pointer hidden md:flex"
        aria-label="Next image"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>

    <!-- Mobile Navigation Controls (only on smaller screens) -->
    <div class="flex items-center gap-6 z-10 md:hidden pb-2">
      <button 
        onclick={(e) => { e.stopPropagation(); prev(); }}
        class="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
        aria-label="Previous image"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
      </button>
      <button 
        onclick={(e) => { e.stopPropagation(); next(); }}
        class="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
        aria-label="Next image"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>

    <!-- Bottom Thumbnail Navigation -->
    <div class="w-full max-w-7xl flex justify-center z-10 px-4 mt-2">
      <div class="flex gap-3 overflow-x-auto max-w-full pb-2 scrollbar-hide">
        {#each images as img, i}
          <button 
            onclick={() => activeIdx = i}
            class="w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all hover:scale-105 cursor-pointer"
            style="border-color: {activeIdx === i ? 'var(--color-brand-magenta)' : 'rgba(255,255,255,0.2)'};"
            aria-label="Select image {i + 1}"
            aria-pressed={activeIdx === i}
          >
            <img src={img} alt="Thumbnail thumbnail preview" class="w-full h-full object-cover" />
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Extra transitions and details */
  .animate-fade {
    animation: fadeIn 0.25s ease-out forwards;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
