<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { findSizeOption, canonicalizeSize } from '$lib/sizes';

  const product = $derived(uiStore.quickSizeProduct);

  let selectedSize = $state<number | null>(null);

  // Compute available sizes
  const sizes = $derived.by(() => {
    if (!product) return [];
    if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
      return product.sizes.map(Number);
    }
    // Default standard sizes
    return [36, 37, 38, 39, 40, 41, 42];
  });

  const availableSizes = $derived.by(() => {
    if (!product) return [];
    if (product.availableSizes && Array.isArray(product.availableSizes) && product.availableSizes.length > 0) {
      return product.availableSizes.map(Number);
    }
    return sizes;
  });

  function isSizeInStock(size: number): boolean {
    const opt = findSizeOption(size);
    return availableSizes.some(x => {
      const optX = findSizeOption(x);
      if (opt && optX) return opt.euro === optX.euro;
      return Number(x) === Number(size);
    });
  }

  function handleSelect(size: number) {
    selectedSize = size;
  }

  function handleConfirm() {
    if (selectedSize === null) {
      uiStore.addToast('Please select a size', 'error');
      return;
    }
    if (uiStore.quickSizeCallback) {
      uiStore.quickSizeCallback(selectedSize);
    }
    handleClose();
  }

  function handleClose() {
    uiStore.closeQuickSize();
    selectedSize = null;
  }
</script>

{#if product}
  <!-- Modal Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
    transition:fade={{ duration: 250 }}
    onclick={handleClose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="quick-size-title"
  >
    <!-- Modal Content -->
    <div
      class="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl transition-all border border-pink-100 max-h-[85vh] sm:max-h-[none] flex flex-col"
      transition:fly={{ y: 150, duration: 300 }}
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-pink-50 shrink-0">
        <h3 id="quick-size-title" class="font-display font-bold text-lg text-[#2d1b2e]">Select Size</h3>
        <button
          onclick={handleClose}
          class="w-8 h-8 rounded-full bg-pink-50 text-[#6b4c6e] flex items-center justify-center hover:bg-pink-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 overflow-y-auto flex-1">
        <!-- Product Details Row -->
        <div class="flex gap-4 mb-6">
          <div class="w-20 h-20 rounded-xl overflow-hidden bg-pink-50/50 border border-pink-100/50 shrink-0">
            <img
              src={product.image || product.images?.[0] || '/placeholder.jpg'}
              alt={product.name}
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex flex-col justify-center min-w-0">
            <h4 class="font-semibold text-sm text-[#2d1b2e] truncate">{product.name}</h4>
            <p class="text-xs text-[#9e7ca0] mt-0.5">{product.colorName || (product.colors?.[0]?.name) || 'Blossom'}</p>
            <p class="text-sm font-bold text-[#D81B60] mt-1">
              ₹{(product.price).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <!-- Size grid selection -->
        <div class="mb-6">
          <p class="text-xs font-semibold text-[#6b4c6e] uppercase tracking-wider mb-3">Available Sizes (UK / EU Mapped)</p>
          <div class="grid grid-cols-4 gap-2.5">
            {#each sizes as size}
              {@const opt = findSizeOption(size)}
              {@const inStock = isSizeInStock(size)}
              {@const isSelected = selectedSize !== null && (selectedSize === size || (opt && findSizeOption(selectedSize)?.euro === opt.euro))}
              <button
                onclick={() => inStock && handleSelect(size)}
                disabled={!inStock}
                class="py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all relative overflow-hidden flex flex-col items-center justify-center cursor-pointer"
                style="
                  border-color: {isSelected ? 'var(--color-brand-magenta)' : !inStock ? '#f3f4f6' : '#f0d0db'};
                  background: {isSelected ? 'var(--color-blush)' : !inStock ? '#f9fafb' : 'white'};
                  color: {isSelected ? 'var(--color-brand-magenta)' : !inStock ? '#9ca3af' : 'var(--color-text-dark)'};
                  cursor: {inStock ? 'pointer' : 'not-allowed'};
                "
              >
                {#if opt}
                  <span class="font-bold text-xs">UK {opt.ukIndia}</span>
                  <span class="text-[10px] opacity-70">EU {opt.euro}</span>
                {:else}
                  <span class="font-bold text-xs">{size}</span>
                {/if}

                {#if !inStock}
                  <span class="absolute inset-0 bg-red-500/5 flex items-center justify-center pointer-events-none">
                    <span class="w-full h-0.5 bg-gray-300 rotate-45 transform"></span>
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Action Button footer -->
      <div class="p-6 border-t border-pink-50 bg-[#fff5f8]/30 shrink-0">
        <button
          onclick={handleConfirm}
          class="btn-primary w-full py-3.5 text-sm font-semibold transition-all duration-200"
          style="background: var(--color-brand-magenta); color: white;"
        >
          Confirm & Add to Bag 🛍️
        </button>
      </div>
    </div>
  </div>
{/if}
