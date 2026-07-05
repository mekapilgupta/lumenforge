<script lang="ts">
  import { cartStore } from '$lib/stores/cart.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';

  function fmt(n: number) {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  const subtotal = $derived(cartStore.subtotal);
  const shipping = 0;
  const total = $derived(subtotal + shipping);

  function handleCheckout() {
    if (!authStore.user) {
      goto('/auth?redirect=/checkout');
    } else {
      goto('/checkout');
    }
  }
</script>

<svelte:head>
  <title>Your Cart — French Toes</title>
</svelte:head>

<div class="min-h-screen py-8 px-4" style="background: var(--color-warm-white);">
  <div class="max-w-5xl mx-auto">
    <h1 class="font-display text-3xl font-bold mb-8" style="color: var(--color-text-dark);">
      Your Cart {#if cartStore.count > 0}<span class="text-lg font-normal" style="color: var(--color-text-soft);">({cartStore.count} items)</span>{/if}
    </h1>

    {#if cartStore.items.length === 0}
      <div class="text-center py-24 flex flex-col items-center gap-4">
        <span class="text-6xl">🛍️</span>
        <h2 class="font-display text-2xl font-bold" style="color: var(--color-text-dark);">Your cart is empty</h2>
        <p class="text-base" style="color: var(--color-text-soft);">Looks like you haven't added anything yet.</p>
        <a href="/shop" class="btn-primary px-8 py-3.5 mt-2">Explore Collection</a>
      </div>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <!-- Cart items -->
        <div class="lg:col-span-3">
          <div class="rounded-2xl overflow-hidden border" style="border-color: var(--color-blush);">
            {#each cartStore.items as item (item.id)}
              <div class="flex items-center gap-4 p-4 border-b last:border-b-0 bg-white" style="border-color: var(--color-blush);">
                <a href="/product/{item.slug}" class="w-20 h-20 rounded-xl overflow-hidden shrink-0" style="background: var(--color-blush);">
                  <img src={item.image} alt={item.name} class="w-full h-full object-cover" loading="lazy" />
                </a>
                <div class="flex-1 min-w-0">
                  <a href="/product/{item.slug}">
                    <p class="font-semibold text-sm" style="color: var(--color-text-dark);">{item.name}</p>
                  </a>
                  <p class="text-xs mt-0.5" style="color: var(--color-text-soft);">
                    <span class="inline-block w-3 h-3 rounded-full mr-1 align-middle" style="background:{item.color.hex};"></span>
                    {item.color.name} · Size {item.size}
                  </p>
                  <p class="text-sm font-bold mt-1" style="color: var(--color-blush-deep);">{fmt(item.price)}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    onclick={() => cartStore.updateQty(item.id, item.quantity - 1)}
                    class="w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold"
                    style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
                    aria-label="Decrease quantity"
                  >−</button>
                  <span class="w-6 text-center font-semibold text-sm" style="color: var(--color-text-dark);">{item.quantity}</span>
                  <button
                    onclick={() => cartStore.updateQty(item.id, item.quantity + 1)}
                    class="w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold"
                    style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
                    aria-label="Increase quantity"
                  >+</button>
                </div>
                <div class="text-right shrink-0 ml-2">
                  <p class="font-bold text-sm" style="color: var(--color-text-dark);">{fmt(item.price * item.quantity)}</p>
                  <button
                    onclick={() => cartStore.removeItem(item.id)}
                    class="mt-1 text-xs transition-opacity hover:opacity-60"
                    style="color: var(--color-text-soft);"
                    aria-label="Remove {item.name}"
                  >Remove</button>
                </div>
              </div>
            {/each}
          </div>

          <a href="/shop" class="inline-flex items-center gap-2 mt-4 text-sm font-medium" style="color: var(--color-blush-deep);">
            ← Continue Shopping
          </a>
        </div>

        <!-- Order summary -->
        <div class="lg:col-span-2">
          <div class="rounded-2xl p-6 sticky top-24 border" style="background: white; border-color: var(--color-blush);">
            <h2 class="font-display font-bold text-lg mb-5" style="color: var(--color-text-dark);">Order Summary</h2>

            <div class="space-y-3 text-sm mb-5">
              <div class="flex justify-between">
                <span style="color: var(--color-text-mid);">Subtotal ({cartStore.count} items)</span>
                <span style="color: var(--color-text-dark);">{fmt(subtotal)}</span>
              </div>
              <div class="flex justify-between">
                <span style="color: var(--color-text-mid);">Shipping</span>
                <span style="color: {shipping === 0 ? 'var(--color-mint-deep)' : 'var(--color-text-dark)'};">
                  {shipping === 0 ? 'FREE 🎉' : fmt(shipping)}
                </span>
              </div>
              {#if shipping > 0}
                <p class="text-xs p-2 rounded-lg" style="background: var(--color-blush); color: var(--color-text-mid);">
                  Add {fmt(999 - subtotal)} more for free shipping
                </p>
              {/if}
            </div>

            <div class="border-t pt-4 mb-6" style="border-color: var(--color-blush);">
              <div class="flex justify-between font-bold text-lg">
                <span style="color: var(--color-text-dark);">Total</span>
                <span style="color: var(--color-text-dark);">{fmt(total)}</span>
              </div>
              <p class="text-xs mt-1" style="color: var(--color-text-soft);">Price includes all taxes</p>
            </div>

            <button onclick={handleCheckout} class="btn-primary w-full justify-center py-3.5 text-base">
              Proceed to Checkout →
            </button>

            <p class="text-xs text-center mt-3" style="color: var(--color-text-soft);">
              🔒 Cash on Delivery · No advance payment needed
            </p>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
