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

  onMount(() => {
    authStore.init();
  });

  $effect(() => {
    if (data?.cart && authStore.user) {
      cartStore.initialize(data.cart);
    }
  });
</script>

<svelte:head>
  <meta name="theme-color" content="#f9d5e5" />
</svelte:head>

<!-- Cart drawer (global) -->
<CartDrawer isOpen={cartStore.isOpen} />

<!-- Toast notifications (global) -->
<ToastContainer />

<!-- Quick size selector modal (global) -->
<QuickSizeModal />

<!-- App shell -->
<div class="flex flex-col min-h-screen">
  <Header />
  <main class="flex-1">
    {@render children()}
  </main>
  <Footer />
</div>
