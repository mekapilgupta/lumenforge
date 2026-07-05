<script lang="ts">
  import type { CartItem } from '$lib/types';
  import { cartStore } from '$lib/stores/cart.svelte';

  let { item }: { item: CartItem } = $props();

  function formatPrice(n: number) {
    return `₹${n.toLocaleString('en-IN')}`;
  }
</script>

<div class="flex gap-3 py-4 border-b" style="border-color: var(--color-blush);">
  <!-- Image -->
  <a href="/product/{item.slug}" class="shrink-0">
    <div class="w-18 h-18 rounded-xl overflow-hidden bg-pink-50" style="width:72px;height:72px;">
      <img src={item.image} alt={item.name} class="w-full h-full object-cover" loading="lazy" />
    </div>
  </a>

  <!-- Details -->
  <div class="flex-1 min-w-0">
    <a href="/product/{item.slug}" class="block font-semibold text-sm leading-tight truncate hover:underline" style="color: var(--color-text-dark);">
      {item.name}
    </a>
    <div class="flex gap-2 mt-1 text-xs" style="color: var(--color-text-soft);">
      <span class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full border border-white shadow-sm inline-block" style="background:{item.color.hex};"></span>
        {item.color.name}
      </span>
      <span>·</span>
      <span>Size {item.size}</span>
    </div>

    <div class="flex items-center justify-between mt-2">
      <!-- Price -->
      <div>
        <span class="font-bold text-sm" style="color: var(--color-text-dark);">{formatPrice(item.price)}</span>
        {#if item.originalPrice}
          <span class="text-xs line-through ml-1" style="color: var(--color-text-soft);">{formatPrice(item.originalPrice)}</span>
        {/if}
      </div>

      <!-- Quantity controls -->
      <div class="flex items-center gap-1">
        <button
          onclick={() => cartStore.updateQty(item.id, item.quantity - 1)}
          class="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold transition-colors hover:bg-pink-50"
          style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
          aria-label="Decrease quantity"
        >−</button>
        <span class="w-6 text-center text-sm font-semibold" style="color: var(--color-text-dark);">{item.quantity}</span>
        <button
          onclick={() => cartStore.updateQty(item.id, item.quantity + 1)}
          class="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold transition-colors hover:bg-pink-50"
          style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
          aria-label="Increase quantity"
        >+</button>
      </div>
    </div>
  </div>

  <!-- Remove -->
  <button
    onclick={() => cartStore.removeItem(item.id)}
    class="shrink-0 p-1 rounded-full transition-colors hover:bg-red-50 self-start mt-1"
    aria-label="Remove {item.name} from cart"
    style="color: var(--color-text-soft);"
  >
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  </button>
</div>
