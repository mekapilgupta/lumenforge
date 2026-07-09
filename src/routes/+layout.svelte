<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import Header from '$lib/components/layout/Header.svelte';
  import Footer from '$lib/components/layout/Footer.svelte';
  import CartDrawer from '$lib/components/cart/CartDrawer.svelte';
  import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
  import QuickSizeModal from '$lib/components/ui/QuickSizeModal.svelte';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { authStore } from '$lib/stores/auth.svelte';

  let { data, children } = $props();

  let passwordInput = $state('');
  let showError = $state(false);
  let isUnlockedState = $state(false);

  let isUnlocked = $derived(data?.isUnlocked || isUnlockedState);

  onMount(() => {
    authStore.init();
  });

  $effect(() => {
    if (data?.cart && authStore.user) {
      cartStore.initialize(data.cart);
    }
  });

  function handleUnlock(e: SubmitEvent) {
    e.preventDefault();
    if (passwordInput === 'godsavethekinng') {
      // Set cookie for 1 year
      document.cookie = "site_unlocked=true; path=/; max-age=31536000; SameSite=Lax";
      isUnlockedState = true;
      showError = false;
    } else {
      showError = true;
    }
  }
</script>

<svelte:head>
  <meta name="theme-color" content="#f9d5e5" />
</svelte:head>

{#if isUnlocked}
  <!-- Cart drawer (global) -->
  <CartDrawer isOpen={cartStore.isOpen} />

  <!-- Toast notifications (global) -->
  <ToastContainer />

  <!-- Quick size selector modal (global) -->
  <QuickSizeModal />

  <!-- App shell -->
  <div class="flex flex-col min-h-screen pb-14 sm:pb-10">
    <Header />
    <main class="flex-1">
      {@render children()}
    </main>
    <Footer />
  </div>

  <!-- Sitewide Sandbox Warning Banner -->
  <div class="fixed bottom-0 left-0 right-0 z-50 py-2.5 px-4 text-center font-semibold text-xs sm:text-sm shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex items-center justify-center gap-2 border-t backdrop-blur-md select-none"
       style="background-color: rgba(251, 191, 36, 0.95); border-color: rgba(217, 119, 6, 0.3); color: #78350f;">
    <span>⚠️ <strong>Sandbox Testing Mode:</strong> This store is currently for testing only. All products & orders (e.g. ₹10 pieces) are simulated. No actual shipments will be fulfilled. 🌸</span>
  </div>
{:else}
  <!-- Beautiful Lock Screen -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style="background: linear-gradient(135deg, #fde8f0 0%, #fdf0e8 50%, #f0e8fd 100%);">
    <!-- Decorative blurred blobs for depth -->
    <div class="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-pink-200/40 blur-3xl -z-10 animate-pulse"></div>
    <div class="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-200/40 blur-3xl -z-10 animate-pulse" style="animation-delay: 2s;"></div>

    <div class="w-full max-w-md p-8 md:p-10 rounded-3xl shadow-xl border border-white/60 bg-white/70 backdrop-blur-xl relative overflow-hidden transition-all duration-300 card-lift">
      <!-- Top aesthetic accent line -->
      <div class="absolute top-0 left-0 right-0 h-1.5" style="background: linear-gradient(90deg, var(--color-blush-deep), var(--color-brand-magenta), var(--color-lavender-deep));"></div>
      
      <div class="flex flex-col items-center text-center">
        <!-- Logo -->
        <div class="flex items-center gap-2 mb-6">
          <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-12 h-12 object-contain" />
          <span class="font-display text-2xl font-semibold" style="color: var(--color-text-dark);">
            French <span style="color: var(--color-brand-magenta);">Toes</span>
          </span>
        </div>

        <div class="w-16 h-16 rounded-full flex items-center justify-center mb-6" style="background-color: var(--color-blush); color: var(--color-brand-magenta);">
          <!-- Lock Icon SVG -->
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>

        <h2 class="text-2xl font-bold font-display mb-2" style="color: var(--color-text-dark);">Secret Access Only</h2>
        <p class="text-sm mb-6 max-w-xs" style="color: var(--color-text-mid);">
          This website is currently private. Please enter the password below to access the shop. 🌸
        </p>

        <form onsubmit={handleUnlock} class="w-full space-y-4">
          <div class="relative">
            <input
              type="password"
              placeholder="Enter password..."
              bind:value={passwordInput}
              class="w-full px-5 py-3.5 rounded-2xl border text-center text-base focus:outline-none transition-all duration-300 font-medium"
              style="
                border-color: {showError ? 'var(--text-danger)' : 'rgba(180, 100, 140, 0.2)'};
                background-color: rgba(255, 255, 255, 0.8);
                color: var(--color-text-dark);
              "
              onfocus={() => { showError = false; }}
            />
          </div>

          {#if showError}
            <p class="text-xs font-semibold text-red-500 animate-shake">
              Oops! That's not the secret password. Please try again. 🌸
            </p>
          {/if}

          <button
            type="submit"
            class="w-full py-3.5 rounded-2xl text-white font-semibold shadow-md transition-all duration-300 hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-2"
            style="
              background-color: var(--color-brand-magenta);
              box-shadow: 0 4px 14px rgba(216, 27, 96, 0.3);
            "
          >
            <span>Unlock Shop</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
  .animate-shake {
    animation: shake 0.2s ease-in-out 0s 2;
  }
</style>
