<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Order } from '$lib/types';
  import { orderStatusLabel, orderStatusColor, formatDate } from '$lib/utils/helpers';

  let orders = $state<Order[]>([]);
  let loading = $state(true);
  let activeFilter = $state('all');

  // --- Return/Exchange dialog state ---
  let returnDialogOrder = $state<any>(null);
  let returnType = $state<'refund' | 'exchange'>('refund');
  let selectedItems = $state<Record<string, number>>({}); // order_item_id -> qty
  let reasonCode = $state('changed_mind');
  let customerNote = $state('');
  let submittingReturn = $state(false);

  let availableVariants = $state<any[]>([]);
  let loadingVariants = $state(false);
  let selectedVariantId = $state<string>('');
  let exchangePriceDiff = $state(0); // in paise
  let productBasePrice = $state(0);
  let activeExchangeProductId = $state<string>('');

  $effect(() => {
    if (returnType === 'exchange') {
      const selectedItemIds = Object.keys(selectedItems);
      if (selectedItemIds.length > 0 && returnDialogOrder) {
        const firstItem = returnDialogOrder.items.find((it: any) => it.id === selectedItemIds[0]);
        if (firstItem && firstItem.product_id !== activeExchangeProductId) {
          activeExchangeProductId = firstItem.product_id;
          loadVariantsForExchange(firstItem.product_id);
        }
      } else {
        activeExchangeProductId = '';
        availableVariants = [];
        selectedVariantId = '';
        exchangePriceDiff = 0;
      }
    } else {
      activeExchangeProductId = '';
      availableVariants = [];
      selectedVariantId = '';
      exchangePriceDiff = 0;
    }
  });

  async function loadVariantsForExchange(productId: string) {
    loadingVariants = true;
    const [pRes, vRes] = await Promise.all([
      supabase.from('products').select('price').eq('id', productId).single(),
      supabase.from('product_variants').select('*').eq('product_id', productId).gt('stock_quantity', 0)
    ]);
    loadingVariants = false;
    
    if (pRes.error || vRes.error) {
      console.error('Error loading product/variants:', pRes.error?.message || vRes.error?.message);
      return;
    }
    
    productBasePrice = pRes.data?.price ?? 0;
    availableVariants = vRes.data ?? [];
    if (availableVariants.length > 0) {
      selectedVariantId = availableVariants[0].id;
      calculatePriceDiff();
    } else {
      selectedVariantId = '';
      exchangePriceDiff = 0;
    }
  }

  function calculatePriceDiff() {
    if (!selectedVariantId || !returnDialogOrder) {
      exchangePriceDiff = 0;
      return;
    }
    const selectedItemIds = Object.keys(selectedItems);
    if (selectedItemIds.length === 0) {
      exchangePriceDiff = 0;
      return;
    }
    const firstItem = returnDialogOrder.items.find((it: any) => it.id === selectedItemIds[0]);
    if (!firstItem) {
      exchangePriceDiff = 0;
      return;
    }

    const variant = availableVariants.find(v => v.id === selectedVariantId);
    if (!variant) {
      exchangePriceDiff = 0;
      return;
    }

    const newPrice = productBasePrice + (variant.price_adjustment ?? 0);
    const oldPrice = firstItem.unit_price;
    exchangePriceDiff = newPrice - oldPrice;
  }

  const REASONS = [
    { id: 'damaged', label: 'Item arrived damaged' },
    { id: 'wrong_item', label: 'Wrong item received' },
    { id: 'size_issue', label: "Size / fit issue" },
    { id: 'quality_issue', label: 'Not as described / quality issue' },
    { id: 'changed_mind', label: 'Changed my mind' },
    { id: 'other', label: 'Other' },
  ];

  const RETURN_STATUS_LABEL: Record<string, string> = {
    requested: 'Requested — Pending Review',
    approved: 'Approved — Preparing Pickup',
    pickup_scheduled: 'Pickup Scheduled',
    picked_up: 'Picked Up',
    received: 'Received — Processing',
    refunded: 'Refund Completed',
    exchange_shipped: 'Replacement Shipped',
    rejected: 'Request Rejected',
    completed: 'Completed',
  };

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'processing', label: 'Processing' },
    { id: 'shipped', label: 'Shipped' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  onMount(async () => {
    console.log('[My Orders Page] onMount starting...');
    await authStore.init();
    console.log('[My Orders Page] authStore initialized. user:', authStore.user);
    if (authStore.user) {
      await loadOrders();
    } else {
      console.warn('[My Orders Page] No authenticated user found after authStore.init()!');
    }
    loading = false;
    console.log('[My Orders Page] loading set to false. orders count:', orders.length);
  });

  async function loadOrders() {
    console.log('[My Orders Page] loadOrders: fetching orders for user:', authStore.user!.id);
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*), returns:order_returns!order_id(*), shipping_address:addresses!shipping_address_id(*)')
      .eq('user_id', authStore.user!.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[My Orders Page] loadOrders error:', error);
      uiStore.addToast('Could not load orders: ' + error.message, 'error');
      return;
    }
    console.log('[My Orders Page] loadOrders success. data:', data);
    orders = (data ?? []) as Order[];
  }

  const filtered = $derived(
    activeFilter === 'all' ? orders : orders.filter(o => o.status === activeFilter)
  );

  function fmt(paise: number) {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function paymentLabel(method: string | null) {
    if (!method) return '—';
    switch (method) {
      case 'cod': return 'Cash on Delivery';
      case 'razorpay': return 'Online Payment (Razorpay)';
      case 'phonepe': return 'PhonePe';
      case 'paytm': return 'Paytm';
      case 'upi': return 'UPI';
      default: return method.toUpperCase();
    }
  }

  // Most recent non-rejected return thread for an order (there's only ever
  // one active thread per order, enforced by a DB constraint).
  function activeReturn(order: any) {
    return (order.returns ?? []).find((r: any) => r.status !== 'rejected') ??
      (order.returns ?? []).slice(-1)[0] ?? null;
  }

  function openReturnDialog(order: any) {
    returnDialogOrder = order;
    returnType = 'refund';
    selectedItems = {};
    reasonCode = 'changed_mind';
    customerNote = '';
    availableVariants = [];
    selectedVariantId = '';
    exchangePriceDiff = 0;
  }

  function closeReturnDialog() {
    returnDialogOrder = null;
  }

  function toggleItem(item: any, checked: boolean) {
    const next = { ...selectedItems };
    if (checked) next[item.id] = 1;
    else delete next[item.id];
    selectedItems = next;
    if (returnType === 'exchange') {
      calculatePriceDiff();
    }
  }

  function setQty(itemId: string, qty: number, max: number) {
    selectedItems = { ...selectedItems, [itemId]: Math.max(1, Math.min(qty, max)) };
    if (returnType === 'exchange') {
      calculatePriceDiff();
    }
  }

  async function submitReturn() {
    if (!returnDialogOrder) return;
    const itemIds = Object.keys(selectedItems);
    if (itemIds.length === 0) {
      uiStore.addToast('Select at least one item.', 'error');
      return;
    }

    const items = returnDialogOrder.items
      .filter((it: any) => selectedItems[it.id])
      .map((it: any) => ({
        order_item_id: it.id,
        product_name: it.product_name,
        sku: it.sku ?? null,
        quantity: selectedItems[it.id],
        unit_price: it.unit_price,
      }));

    const requestedRefundAmount = items.reduce((sum: number, it: any) => sum + it.unit_price * it.quantity, 0);
    const priceDiffRupees = returnType === 'exchange' ? (exchangePriceDiff / 100) : 0;
    const requestedVariantId = returnType === 'exchange' ? selectedVariantId : null;

    submittingReturn = true;
    const { error } = await supabase.from('order_returns').insert({
      order_id: returnDialogOrder.id,
      customer_id: authStore.user!.id,
      type: returnType,
      items,
      reason_code: reasonCode,
      customer_note: customerNote || null,
      requested_refund_amount: requestedRefundAmount,
      requested_variant_id: requestedVariantId,
      price_difference: priceDiffRupees
    });
    submittingReturn = false;

    if (error) {
      uiStore.addToast('Could not submit request: ' + error.message, 'error');
      return;
    }

    uiStore.addToast('Your request has been submitted. We\'ll review it shortly.', 'success');
    closeReturnDialog();
    await loadOrders();
  }
</script>

<svelte:head><title>My Orders — French Toes</title></svelte:head>

<div class="flex flex-col gap-6">
  <h2 class="font-display text-2xl font-bold" style="color: var(--color-text-dark);">My Orders</h2>

  <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
    {#each FILTERS as f}
      <button
        onclick={() => activeFilter = f.id}
        class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
        style="background: {activeFilter === f.id ? 'var(--color-blush-deep)' : 'var(--color-blush)'}; color: {activeFilter === f.id ? 'white' : 'var(--color-text-mid)'};"
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="flex justify-center py-16">
      <div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color: var(--color-blush); border-top-color: var(--color-blush-deep);"></div>
    </div>
  {:else if filtered.length === 0}
    <div class="text-center py-16 rounded-2xl border" style="border-color: var(--color-blush); background: white;">
      <span class="text-4xl block mb-4">📦</span>
      <p class="font-semibold text-lg mb-2" style="color: var(--color-text-dark);">No orders found</p>
      <p class="text-sm mb-4" style="color: var(--color-text-soft);">
        {activeFilter === 'all' ? "You haven't placed any orders yet." : `No ${orderStatusLabel(activeFilter)} orders.`}
      </p>
      {#if activeFilter === 'all'}
        <a href="/shop" class="btn-primary">Start Shopping</a>
      {/if}
    </div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each filtered as order (order.id)}
        {@const ret = activeReturn(order)}
        {@const refund = order.payment_gateway_response?.refund}
        <div class="rounded-2xl border overflow-hidden" style="border-color: var(--color-blush); background: white;">
          <div class="flex items-center justify-between px-5 py-4 border-b" style="border-color: var(--color-blush); background: var(--color-blush);">
            <div>
              <span class="font-mono text-sm font-bold" style="color: var(--color-blush-deep);">{order.order_number}</span>
              <span class="text-xs ml-2" style="color: var(--color-text-soft);">{formatDate(order.created_at)}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 rounded-full text-xs font-semibold text-white" style="background: {orderStatusColor(order.status)};">
                {orderStatusLabel(order.status)}
              </span>
              <a href="/account/orders/{order.id}" class="text-xs font-semibold" style="color: var(--color-blush-deep);">View →</a>
            </div>
          </div>

          <div class="p-5 flex flex-col gap-4">
            {#if order.items && order.items.length > 0}
              <div class="divide-y divide-pink-100/30">
                {#each order.items as item, idx}
                  <div class="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                    {#if item.product_image_url}
                      <div class="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-pink-100/30" style="background: var(--color-blush);">
                        <img src={item.product_image_url} alt={item.product_name} class="w-full h-full object-cover" loading="lazy" />
                      </div>
                    {/if}
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold truncate" style="color: var(--color-text-dark);">{item.product_name}</p>
                      
                      <!-- Variant Attributes & Qty -->
                      <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs" style="color: var(--color-text-soft);">
                        <span class="font-medium bg-gray-50 px-2 py-0.5 rounded border border-gray-100/80">Qty: {item.quantity}</span>
                        {#if item.variant_info}
                          {#if item.variant_info.size}
                            <span class="text-gray-300">•</span>
                            <span class="bg-pink-50/50 text-pink-700 font-medium px-2 py-0.5 rounded border border-pink-100/30">Size: {item.variant_info.size}</span>
                          {/if}
                          {#if item.variant_info.color}
                            <span class="text-gray-300">•</span>
                            <span class="bg-pink-50/50 text-pink-700 font-medium px-2 py-0.5 rounded border border-pink-100/30">Color: {item.variant_info.color}</span>
                          {/if}
                        {/if}
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-sm font-bold" style="color: var(--color-text-dark);">{fmt(item.total_price)}</p>
                      {#if item.quantity > 1}
                        <p class="text-[10px]" style="color: var(--color-text-soft);">{fmt(item.unit_price)} each</p>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Delivery Address Snapshot -->
            {#if order.shipping_address}
              {@const addr = order.shipping_address}
              <div class="pt-3.5 border-t border-dashed flex items-start gap-2.5 text-xs" style="border-color: var(--color-blush); color: var(--color-text-mid);">
                <span class="text-sm">📍</span>
                <div class="flex-1">
                  <p class="font-semibold" style="color: var(--color-text-dark);">Delivery Address</p>
                  <p class="mt-0.5 text-gray-500">
                    {addr.full_name} · {addr.address_line1}{addr.address_line2 ? ', ' + addr.address_line2 : ''}, {addr.city}, {addr.state} – {addr.pincode}
                  </p>
                </div>
              </div>
            {/if}
          </div>

          <!-- Return/Exchange status banner -->
          {#if ret}
            <div class="mx-4 mb-3 px-3 py-2 rounded-xl text-xs font-semibold" style="background: #fdf2f8; color: #9d174d; border: 1px solid #fbcfe8;">
              {ret.type === 'exchange' ? 'Exchange' : 'Return'} {RETURN_STATUS_LABEL[ret.status] ?? ret.status}
            </div>
          {/if}

          <!-- Payment & Refund details, once a refund has actually gone through -->
          {#if refund}
            <div class="mx-4 mb-3 p-3 rounded-xl text-xs" style="background: #f8fafc; border: 1px solid #e2e8f0;">
              <p class="font-semibold mb-1" style="color: var(--color-text-dark);">Payment & Refund</p>
              <div class="grid grid-cols-2 gap-1" style="color: var(--color-text-soft);">
                <span>Refund ID:</span><span class="font-mono">{refund.id ?? '—'}</span>
                <span>Payment ID:</span><span class="font-mono">{order.razorpay_payment_id ?? '—'}</span>
                <span>Amount:</span><span>{fmt(refund.amount ?? order.refund_amount ?? 0)}</span>
                <span>Completed:</span><span>{order.refund_completed_at ? formatDate(order.refund_completed_at) : '—'}</span>
              </div>
            </div>
          {/if}

          <div class="flex items-center justify-between px-5 py-3 border-t" style="border-color: var(--color-blush);">
            <div class="text-sm">
              <span style="color: var(--color-text-soft);">Payment: </span>
              <span class="font-medium" style="color: var(--color-text-dark);">{paymentLabel(order.payment_method)}</span>
              {#if order.razorpay_payment_id}
                <span class="text-xs ml-1" style="color: var(--color-text-soft);">({order.razorpay_payment_id})</span>
              {/if}
            </div>
            <div class="text-right">
              <span class="text-sm" style="color: var(--color-text-soft);">Total: </span>
              <span class="font-bold" style="color: var(--color-text-dark);">{fmt(order.total_amount)}</span>
            </div>
          </div>

          <!-- Return/Exchange entry point — gated strictly on delivered + no active thread -->
          {#if order.status === 'delivered' && !ret}
            <div class="px-5 pb-4">
              <button
                onclick={() => openReturnDialog(order)}
                class="w-full py-2 rounded-xl text-xs font-semibold border transition-all"
                style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
              >
                Request Return or Exchange
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Return/Exchange dialog -->
{#if returnDialogOrder}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 bg-black/50 z-40" onclick={closeReturnDialog} role="button" tabindex="0" aria-label="Close"></div>
  <div class="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white rounded-2xl p-6 z-50 shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col gap-4">
    <h3 class="font-display text-lg font-bold" style="color: var(--color-text-dark);">Request Return or Exchange</h3>
    <p class="text-xs" style="color: var(--color-text-soft);">Order {returnDialogOrder.order_number}</p>

    <div class="flex flex-col gap-2">
      <p class="text-xs font-semibold" style="color: var(--color-text-dark);">Select item(s)</p>
      {#each returnDialogOrder.items as item}
        <label class="flex items-center gap-3 p-2 rounded-lg border" style="border-color: var(--color-blush);">
          <input type="checkbox" checked={!!selectedItems[item.id]} onchange={(e) => toggleItem(item, e.currentTarget.checked)} />
          <span class="flex-1 text-xs" style="color: var(--color-text-dark);">{item.product_name}</span>
          {#if selectedItems[item.id]}
            <input
              type="number" min="1" max={item.quantity}
              value={selectedItems[item.id]}
              oninput={(e) => setQty(item.id, Number(e.currentTarget.value), item.quantity)}
              class="w-14 text-xs border rounded px-1 py-0.5"
              style="border-color: var(--color-blush);"
            />
            <span class="text-[10px]" style="color: var(--color-text-soft);">/ {item.quantity}</span>
          {/if}
        </label>
      {/each}
    </div>

    <div class="flex gap-3">
      <label class="flex items-center gap-1.5 text-xs">
        <input type="radio" name="return_type" value="refund" checked={returnType === 'refund'} onchange={() => returnType = 'refund'} />
        Refund
      </label>
      <label class="flex items-center gap-1.5 text-xs">
        <input type="radio" name="return_type" value="exchange" checked={returnType === 'exchange'} onchange={() => returnType = 'exchange'} />
        Exchange for replacement
      </label>
    </div>

    {#if returnType === 'exchange'}
      <div class="flex flex-col gap-2 p-3 bg-pink-50/20 rounded-xl border border-pink-100/30">
        <p class="text-xs font-semibold text-gray-700">Choose Replacement Variant</p>
        {#if loadingVariants}
          <p class="text-xs text-gray-500 animate-pulse">Loading available options...</p>
        {:else if availableVariants.length === 0}
          <p class="text-xs text-red-500 font-medium">Sorry, no other variants of this product have stock currently.</p>
        {:else}
          <select 
            bind:value={selectedVariantId} 
            onchange={calculatePriceDiff}
            class="text-xs border rounded-lg px-2 py-1.5 bg-white outline-none"
            style="border-color: var(--color-blush); color: var(--color-text-dark);"
          >
            {#each availableVariants as v}
              <option value={v.id}>
                Size: {v.size} / Color: {v.color} 
                ({v.stock_quantity} left) 
                {#if (productBasePrice + (v.price_adjustment ?? 0)) !== productBasePrice}
                  — ₹{((productBasePrice + (v.price_adjustment ?? 0)) / 100).toFixed(0)}
                {/if}
              </option>
            {/each}
          </select>
          
          <div class="flex justify-between items-center mt-2 text-xs">
            <span class="text-gray-600">Price difference:</span>
            <span class="font-bold {exchangePriceDiff > 0 ? 'text-red-500' : exchangePriceDiff < 0 ? 'text-green-600' : 'text-gray-700'}">
              {exchangePriceDiff > 0 ? `You pay ₹${(exchangePriceDiff / 100).toFixed(0)}` : 
               exchangePriceDiff < 0 ? `Refund ₹${(Math.abs(exchangePriceDiff) / 100).toFixed(0)}` : 
               'No difference'}
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <div class="flex flex-col gap-1">
      <label class="text-xs font-semibold" style="color: var(--color-text-dark);" for="reason">Reason</label>
      <select id="reason" bind:value={reasonCode} class="text-xs border rounded-lg px-2 py-1.5" style="border-color: var(--color-blush);">
        {#each REASONS as r}
          <option value={r.id}>{r.label}</option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-xs font-semibold" style="color: var(--color-text-dark);" for="note">Additional notes (optional)</label>
      <textarea id="note" bind:value={customerNote} rows="2" class="text-xs border rounded-lg px-2 py-1.5" style="border-color: var(--color-blush);"></textarea>
    </div>

    <div class="flex gap-3 mt-2">
      <button onclick={closeReturnDialog} class="flex-1 py-2 rounded-xl text-xs font-semibold border" style="border-color: var(--color-blush);">Cancel</button>
      <button onclick={submitReturn} disabled={submittingReturn} class="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style="background: var(--color-blush-deep);">
        {submittingReturn ? 'Submitting...' : 'Submit Request'}
      </button>
    </div>
  </div>
{/if}