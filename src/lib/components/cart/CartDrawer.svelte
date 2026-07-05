<script lang="ts">
  import { cartStore } from "$lib/stores/cart.svelte";
  import CartItem from "./CartItem.svelte";
  import { goto } from "$app/navigation";

  let { isOpen = false } = $props<{ isOpen?: boolean }>();

  function formatPrice(n: number) {
    return `₹${n.toLocaleString("en-IN")}`;
  }

  function handleCheckout() {
    cartStore.close();
    goto("/checkout");
  }

  $effect(() => {
    console.log("[CART DRAWER] $effect fired. isOpen:", isOpen);
    console.log("[CART DRAWER] items count:", cartStore.items?.length ?? "N/A");
  });

  $effect(() => {
    if (isOpen) {
      console.log(
        "[CART DRAWER] isOpen is TRUE — drawer block should be rendering now",
      );
    } else {
      console.log("[CART DRAWER] isOpen is FALSE — drawer block hidden");
    }
  });
</script>

<!-- Always-present sentinel to confirm component is mounted -->
<div
  style="display:none"
  data-cart-drawer-mounted="true"
  aria-hidden="true"
></div>

{#if isOpen}
  {@const _ = console.log(
    "[CART DRAWER] {#if} block IS rendering. isOpen:",
    isOpen,
  )}

  <!-- Overlay -->
  <div
    onclick={() => cartStore.close()}
    onkeydown={(e) => e.key === "Escape" && cartStore.close()}
    role="presentation"
    aria-hidden="true"
    style="
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 40;
      cursor: pointer;
    "
  ></div>

  <!-- Drawer panel -->
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Shopping cart"
    style="
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: 100%;
      max-width: 28rem;
      z-index: 50;
      display: flex;
      flex-direction: column;
      background: white;
      box-shadow: -10px 0 40px rgba(0,0,0,0.15);
    "
  >
    <!-- Header -->
    <div
      style="display:flex; align-items:center; justify-content:space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid #f0e0e8;"
    >
      <div>
        <h2
          style="font-size:1.25rem; font-weight:600; color: var(--color-text-dark); font-family: var(--font-display, inherit);"
        >
          Your Bag
        </h2>
        <p
          style="font-size:0.75rem; margin-top:0.25rem; color: var(--color-text-soft);"
        >
          {cartStore.count}
          {cartStore.count === 1 ? "item" : "items"}
        </p>
      </div>
      <button
        onclick={() => cartStore.close()}
        aria-label="Close cart"
        style="
          padding: 0.625rem;
          border-radius: 9999px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--color-text-mid);
          display: flex;
          align-items: center;
          justify-content: center;
        "
      >
        <svg
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Free shipping banner -->
    <div
      style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, var(--color-mint), var(--color-mint-deep));"
    >
      <p
        style="font-size:0.875rem; font-weight:600; text-align:center; color:white;"
      >
        🎉 FREE shipping on all orders!
      </p>
    </div>

    <!-- Items list -->
    <div style="flex: 1; overflow-y: auto;">
      {#if cartStore.items.length === 0}
        <div
          style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:1.25rem; padding: 4rem 1.5rem;"
        >
          <div
            style="width:6rem; height:6rem; border-radius:9999px; display:flex; align-items:center; justify-content:center; background: var(--color-blush);"
          >
            <svg
              width="40"
              height="40"
              fill="none"
              stroke="var(--color-blush-deep)"
              stroke-width="1.5"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div style="text-align:center;">
            <p
              style="font-size:1.125rem; font-weight:600; color: var(--color-text-dark);"
            >
              Your bag is empty
            </p>
            <p
              style="font-size:0.875rem; margin-top:0.375rem; color: var(--color-text-soft);"
            >
              Discover our blossom collection
            </p>
          </div>
          <a
            href="/shop"
            onclick={() => cartStore.close()}
            class="btn-primary"
            style="font-size:0.875rem; padding: 0.75rem 2rem;"
          >
            Shop Now
          </a>
        </div>
      {:else}
        <div
          style="padding: 1rem 1.5rem; display:flex; flex-direction:column; gap:1rem;"
        >
          {#each cartStore.items as item (item.id)}
            <CartItem {item} />
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    {#if cartStore.items.length > 0}
      <div style="padding: 1.25rem 1.5rem; border-top: 1px solid #f0e0e8;">
        <div
          style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.375rem;"
        >
          <span
            style="font-size:0.875rem; font-weight:500; color: var(--color-text-mid);"
            >Subtotal</span
          >
          <span
            style="font-size:1.25rem; font-weight:700; color: var(--color-text-dark);"
            >{formatPrice(cartStore.subtotal)}</span
          >
        </div>
        <p
          style="font-size:0.75rem; margin-bottom:1rem; color: var(--color-text-soft);"
        >
          Price includes all taxes
        </p>

        <button
          onclick={handleCheckout}
          class="btn-primary"
          style="width:100%; justify-content:center; font-size:1rem; padding:1rem; display:flex; align-items:center; gap:0.5rem;"
        >
          <span>Proceed to Checkout</span>
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="white"
            stroke-width="2.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onclick={() => cartStore.close()}
          style="width:100%; text-align:center; font-size:0.875rem; margin-top:0.75rem; padding:0.625rem; background:transparent; border:none; cursor:pointer; color: var(--color-text-soft);"
        >
          Continue Shopping
        </button>
      </div>
    {/if}
  </div>
{/if}
