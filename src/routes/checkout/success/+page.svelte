<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Order } from '$lib/types';

  let order = $state<Order | null>(null);
  let loading = $state(true);

  onMount(async () => {
    await authStore.init();
    await loadOrder();
    loading = false;
  });

  async function loadOrder() {
    const orderId = $page.url.searchParams.get('order_id');
    if (!orderId) {
      uiStore.addToast('Invalid order link', 'error');
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*), shipping_address:addresses!shipping_address_id(*)')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      uiStore.addToast('Order not found', 'error');
      return;
    }

    order = data as Order;
  }

  function fmt(paise: number): string {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
</script>

<svelte:head>
  <title>Order Placed Successfully — French Toes</title>
</svelte:head>

<div class="min-h-screen py-12 px-4 animate-fade-in" style="background: var(--color-warm-white);">
  <div class="max-w-2xl mx-auto">

    <!-- Logo -->
    <div class="text-center mb-8">
      <a href="/" class="inline-flex items-center gap-2 mb-6" aria-label="French Toes Home">
        <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-7 h-7 object-contain" />
        <span class="font-display text-lg font-semibold" style="color: var(--color-text-dark);">French Toes</span>
      </a>
    </div>

    {#if loading}
      <div class="flex justify-center py-16">
        <div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color: var(--color-blush); border-top-color: var(--color-blush-deep);"></div>
      </div>
    {:else if !order}
      <div class="text-center py-16 bg-white rounded-2xl border" style="border-color: var(--color-blush);">
        <span class="text-4xl block mb-4">⚠️</span>
        <p class="font-semibold text-lg mb-2" style="color: var(--color-text-dark);">Order details could not be loaded</p>
        <p class="text-sm mb-6 text-gray-500">Please check the link or check your profile orders list.</p>
        <a href="/account/orders" class="btn-primary max-w-xs mx-auto justify-center">Go to My Orders</a>
      </div>
    {:else}
      <div class="text-center">
        <!-- Success Icon -->
        <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-4" style="background: #ecfdf5; border-color: #a7f3d0;">
          <svg class="w-10 h-10 animate-scale-in" fill="none" stroke="#10b981" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <h1 class="font-display text-3xl font-bold mb-2 text-gray-900" style="color: var(--color-text-dark);">Thank you for your order! 🌸</h1>
        <p class="mb-8 text-sm sm:text-base text-gray-600 max-w-lg mx-auto" style="color: var(--color-text-mid);">
          We're preparing your sweet new pair of French Toes. Your order is confirmed and we'll send you updates as it makes its way to you.
        </p>

        <!-- Ordered Items list -->
        {#if order.items && order.items.length > 0}
          <div class="rounded-2xl border text-left mb-6 overflow-hidden shadow-sm" style="background: white; border-color: var(--color-blush);">
            <div class="px-5 py-3.5 border-b" style="background: var(--color-blush); border-color: var(--color-blush-deep);">
              <h3 class="font-semibold text-sm text-gray-800">Items Ordered</h3>
            </div>
            <div class="divide-y divide-pink-100/30">
              {#each order.items as item}
                <div class="flex items-center gap-4 p-4">
                  {#if item.product_image_url}
                    <div class="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-pink-100" style="background: var(--color-blush);">
                      <img src={item.product_image_url} alt={item.product_name} class="w-full h-full object-cover" />
                    </div>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold truncate" style="color: var(--color-text-dark);">{item.product_name}</p>
                    <div class="flex flex-wrap items-center gap-x-2 mt-0.5 text-xs text-gray-500">
                      <span>Qty: {item.quantity}</span>
                      {#if item.variant_info}
                        {#if item.variant_info.size}
                          <span class="text-gray-300">•</span>
                          <span>Size: {item.variant_info.size}</span>
                        {/if}
                        {#if item.variant_info.color}
                          <span class="text-gray-300">•</span>
                          <span>Color: {item.variant_info.color}</span>
                        {/if}
                      {/if}
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-sm font-bold" style="color: var(--color-text-dark);">₹{(item.total_price / 100).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Order Info Summary Card -->
        <div class="rounded-2xl p-6 text-left mb-8 border shadow-sm bg-white" style="border-color: var(--color-blush);">
          <h3 class="font-semibold text-sm mb-4 border-b pb-2 text-gray-800" style="border-color: rgba(0, 0, 0, 0.05);">Order Information</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <p class="font-semibold" style="color: var(--color-text-dark);">Order Number</p>
              <p class="font-mono text-sm font-bold text-pink-600">{order.order_number}</p>
            </div>
            <div>
              <p class="font-semibold" style="color: var(--color-text-dark);">Payment Method</p>
              <p style="color: var(--color-text-mid);">
                {order.payment_method === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Razorpay)'}
              </p>
            </div>
            <div>
              <p class="font-semibold" style="color: var(--color-text-dark);">Delivering to</p>
              {#if order.shipping_address}
                {@const addr = order.shipping_address}
                <p style="color: var(--color-text-mid);">{addr.full_name}</p>
                <p class="text-xs text-gray-500 mt-0.5 font-normal">
                  {addr.address_line1}{addr.address_line2 ? ', ' + addr.address_line2 : ''}, {addr.city}, {addr.state} – {addr.pincode}
                </p>
              {/if}
            </div>
            <div>
              <p class="font-semibold" style="color: var(--color-text-dark);">Estimated Delivery</p>
              <p style="color: var(--color-text-mid); font-weight: 500;">
                {order.estimated_delivery_date || '5–7 business days'}
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/account/orders" class="btn-primary px-8 py-3.5 justify-center">View My Orders</a>
          <a href="/shop" class="btn-outline px-8 py-3.5 justify-center">Continue Shopping</a>
        </div>
      </div>
    {/if}

  </div>
</div>
