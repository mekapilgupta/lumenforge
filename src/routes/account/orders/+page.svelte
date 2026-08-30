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
  let returnType = $state<'exchange' | 'return'>('exchange');
  let exchangeSize = $state('6');
  let returnReason = $state('Size too small / Need larger size');
  let returnComments = $state('');
  let returnImages = $state<string[]>([]);
  let uploadingImage = $state(false);
  let submittingReturn = $state(false);
  let bankUpiId = $state('');
  let bankAccountNo = $state('');
  let bankIfsc = $state('');
  let bankHolderName = $state('');

  const SIZE_OPTIONS = ['4', '5', '6', '7', '8', '36', '37', '38', '39', '40', '41', '42'];
  const EXCHANGE_REASONS = [
    'Size too small / Need larger size',
    'Size too large / Need smaller size',
    'Different color / variant preferred',
    'Defective / Damaged pair received',
  ];
  const RETURN_REASONS = [
    'Size issue & preferred replacement unavailable',
    'Defective or damaged product',
    'Quality not as expected',
    'Received wrong product',
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
    await authStore.init();
    if (authStore.user) {
      await loadOrders();
    }
    loading = false;
  });

  async function loadOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*), returns:order_returns!order_id(*), shipping_address:addresses!shipping_address_id(*)')
      .eq('user_id', authStore.user!.id)
      .order('created_at', { ascending: false });
    if (error) {
      uiStore.addToast('Could not load orders: ' + error.message, 'error');
      return;
    }
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

  function activeReturn(order: any) {
    return (order.returns ?? []).find((r: any) => r.status !== 'rejected') ??
      (order.returns ?? []).slice(-1)[0] ?? null;
  }

  function isEligibleForReturn(order: any) {
    if (order.status !== 'delivered') return { eligible: false, daysLeft: 0, expired: false };
    const deliveryTime = order.delivered_at ? new Date(order.delivered_at).getTime() : 0;
    if (!deliveryTime) return { eligible: true, daysLeft: 5, expired: false };
    const daysSince = Math.floor((Date.now() - deliveryTime) / (1000 * 60 * 60 * 24));
    if (daysSince <= 5) {
      return { eligible: true, daysLeft: Math.max(0, 5 - daysSince), expired: false };
    }
    return { eligible: false, daysLeft: 0, expired: true };
  }

  function openReturnDialog(order: any) {
    returnDialogOrder = order;
    returnType = 'exchange';
    exchangeSize = '6';
    returnReason = EXCHANGE_REASONS[0];
    returnComments = '';
    returnImages = [];
    bankUpiId = '';
    bankAccountNo = '';
    bankIfsc = '';
    bankHolderName = '';
  }

  function closeReturnDialog() {
    returnDialogOrder = null;
  }

  async function handleReturnImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;
    
    uploadingImage = true;
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.urls) {
        returnImages = [...returnImages, ...data.urls];
        uiStore.addToast('Photo uploaded successfully', 'success');
      } else {
        uiStore.addToast(data.error || 'Failed to upload photo', 'error');
      }
    } catch (err: any) {
      uiStore.addToast(err.message || 'Upload failed', 'error');
    } finally {
      uploadingImage = false;
    }
  }

  async function submitReturn() {
    if (!returnDialogOrder || submittingReturn) return;
    if (returnType === 'exchange' && !exchangeSize) {
      uiStore.addToast('Please select your desired exchange size', 'error');
      return;
    }
    if (!returnReason) {
      uiStore.addToast('Please select a reason', 'error');
      return;
    }
    if (returnType === 'return' && returnDialogOrder.payment_method === 'cod' && !bankUpiId.trim() && !bankAccountNo.trim()) {
      uiStore.addToast('Please provide your UPI ID or Bank Details for the COD cash balance refund', 'error');
      return;
    }

    submittingReturn = true;
    try {
      const res = await fetch('/api/returns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: returnDialogOrder.id,
          userId: authStore.user!.id,
          type: returnType,
          reason: returnReason,
          comments: returnComments,
          images: returnImages,
          exchangeSize: returnType === 'exchange' ? exchangeSize : null,
          bankDetails: {
            upiId: bankUpiId.trim(),
            accountNo: bankAccountNo.trim(),
            ifsc: bankIfsc.trim().toUpperCase(),
            holderName: bankHolderName.trim(),
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        uiStore.addToast(data.message, 'success');
        closeReturnDialog();
        await loadOrders();
      } else {
        uiStore.addToast(data.error || 'Failed to submit request', 'error');
      }
    } catch (err: any) {
      uiStore.addToast(err.message || 'Network error', 'error');
    } finally {
      submittingReturn = false;
    }
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
          <div class="flex items-center justify-between px-5 py-4 border-b flex-wrap gap-2" style="border-color: var(--color-blush); background: var(--color-blush);">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-sm font-bold" style="color: var(--color-blush-deep);">{order.order_number}</span>
              <span class="text-xs" style="color: var(--color-text-soft);">{formatDate(order.created_at)}</span>
              {#if order.awb_code}
                <span class="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-white border border-pink-200 text-gray-700">
                  <span>🚚</span>
                  <span>{order.courier_name || 'Courier'}: {order.awb_code}</span>
                </span>
              {/if}
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

          <!-- Return/Exchange entry point — strictly gated on delivered + 5-day window -->
          {#if order.status === 'delivered' && !ret}
            {@const elig = isEligibleForReturn(order)}
            <div class="px-5 pb-4">
              {#if elig.eligible}
                <button
                  onclick={() => openReturnDialog(order)}
                  class="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);"
                >
                  <span>🔄 Exchange / Return</span>
                  <span class="text-[10px] opacity-90">({elig.daysLeft}d left)</span>
                </button>
              {:else}
                <div class="w-full py-2 rounded-xl text-xs font-medium text-center bg-gray-50 text-gray-500 border border-gray-200">
                  🔒 Return &amp; Exchange Window Closed (5-day limit passed)
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Return/Exchange Modern Modal -->
{#if returnDialogOrder}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onclick={closeReturnDialog}
    role="dialog"
    aria-modal="true"
    aria-labelledby="return-list-modal-title"
  >
    <div
      class="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl transition-all border border-pink-100 flex flex-col p-6 max-h-[90vh] overflow-y-auto text-left"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between pb-3 border-b border-pink-100 mb-4">
        <div>
          <h3 id="return-list-modal-title" class="font-display font-bold text-xl text-gray-900">Exchange or Return 🌸</h3>
          <p class="text-xs text-gray-500 mt-0.5 font-mono">Order #{returnDialogOrder.order_number}</p>
        </div>
        <button onclick={closeReturnDialog} class="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">✕</button>
      </div>

      <!-- Type Selector Tabs -->
      <div class="grid grid-cols-2 p-1 rounded-2xl bg-pink-50 border border-pink-200 mb-5">
        <button
          type="button"
          onclick={() => { returnType = 'exchange'; returnReason = EXCHANGE_REASONS[0]; }}
          class="py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer {returnType === 'exchange' ? 'bg-white shadow-sm text-pink-700' : 'text-gray-600'}"
        >
          <span>🔄 Exchange Size</span>
          <span class="text-[9px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full font-semibold">Recommended</span>
        </button>
        <button
          type="button"
          onclick={() => { returnType = 'return'; returnReason = RETURN_REASONS[0]; }}
          class="py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer {returnType === 'return' ? 'bg-white shadow-sm text-pink-700' : 'text-gray-600'}"
        >
          <span>💸 Return &amp; Refund</span>
        </button>
      </div>

      <!-- Exchange Form -->
      {#if returnType === 'exchange'}
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-2">Select Your Preferred Replacement Size *</label>
            <div class="flex flex-wrap gap-2">
              {#each SIZE_OPTIONS as s}
                <button
                  type="button"
                  onclick={() => exchangeSize = s}
                  class="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer {exchangeSize === s ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-pink-50'}"
                >
                  Size {s}
                </button>
              {/each}
            </div>
          </div>

          <div>
            <label for="exchange-reason-select-list" class="block text-xs font-bold text-gray-700 mb-1.5">Reason for exchange *</label>
            <select
              id="exchange-reason-select-list"
              bind:value={returnReason}
              class="w-full px-3 py-2.5 rounded-xl border text-xs bg-white outline-none focus:border-pink-500 border-pink-200"
            >
              {#each EXCHANGE_REASONS as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
          </div>
        </div>
      {:else}
        <!-- Return Form -->
        <div class="space-y-4">
          <div>
            <label for="return-reason-select-list" class="block text-xs font-bold text-gray-700 mb-1.5">Reason for return *</label>
            <select
              id="return-reason-select-list"
              bind:value={returnReason}
              class="w-full px-3 py-2.5 rounded-xl border text-xs bg-white outline-none focus:border-pink-500 border-pink-200"
            >
              {#each RETURN_REASONS as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
          </div>

          <!-- COD Bank / UPI Payout Info -->
          {#if returnDialogOrder.payment_method === 'cod'}
            <div class="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
              <div class="flex items-center gap-1.5">
                <span class="text-sm">🏦</span>
                <p class="text-xs font-bold text-amber-900">Refund Destination (For Cash on Delivery Balance)</p>
              </div>
              <p class="text-[11px] text-amber-800">
                Your ₹50 advance will be refunded to original payment mode. Please enter your UPI ID or Bank details below for the remaining cash balance refund:
              </p>
              <div>
                <label for="bank-upi-input-list" class="block text-[11px] font-semibold text-gray-700 mb-1">UPI ID (e.g. yourname@okhdfcbank, yourname@paytm)</label>
                <input
                  id="bank-upi-input-list"
                  type="text"
                  bind:value={bankUpiId}
                  placeholder="e.g. mobile@upi or name@okaxis"
                  class="w-full px-3 py-2 rounded-xl border text-xs bg-white outline-none focus:border-pink-500 border-gray-300"
                />
              </div>
              <div class="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60">
                <div>
                  <label for="bank-acc-input-list" class="block text-[10px] font-semibold text-gray-700 mb-1">Or Bank Account Number</label>
                  <input
                    id="bank-acc-input-list"
                    type="text"
                    bind:value={bankAccountNo}
                    placeholder="Account No"
                    class="w-full px-2.5 py-1.5 rounded-xl border text-xs bg-white outline-none focus:border-pink-500 border-gray-300"
                  />
                </div>
                <div>
                  <label for="bank-ifsc-input-list" class="block text-[10px] font-semibold text-gray-700 mb-1">Bank IFSC Code</label>
                  <input
                    id="bank-ifsc-input-list"
                    type="text"
                    bind:value={bankIfsc}
                    placeholder="e.g. HDFC0001234"
                    class="w-full px-2.5 py-1.5 rounded-xl border text-xs bg-white outline-none uppercase focus:border-pink-500 border-gray-300 font-mono"
                  />
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Upload photo evidence -->
      <div class="mt-4 pt-3 border-t border-pink-100">
        <label class="block text-xs font-bold text-gray-700 mb-1.5">Add Photos of Product (Optional / Recommended)</label>
        <div class="flex items-center gap-3 flex-wrap">
          <label class="px-3.5 py-2 rounded-xl text-xs font-semibold border border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 cursor-pointer transition-colors shrink-0">
            {uploadingImage ? 'Uploading...' : '📷 Upload Photo'}
            <input type="file" accept="image/*" multiple onchange={handleReturnImageUpload} disabled={uploadingImage} class="hidden" />
          </label>
          {#each returnImages as img, idx}
            <div class="relative w-12 h-12 rounded-lg overflow-hidden border border-pink-200">
              <img src={img} alt="Evidence" class="w-full h-full object-cover" />
              <button
                type="button"
                onclick={() => returnImages = returnImages.filter((_, i) => i !== idx)}
                class="absolute top-0 right-0 bg-black/60 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-bl cursor-pointer"
              >✕</button>
            </div>
          {/each}
        </div>
      </div>

      <!-- Comments -->
      <div class="mt-3">
        <label for="return-comments-input-list" class="block text-xs font-bold text-gray-700 mb-1">Additional Comments (Optional)</label>
        <textarea
          id="return-comments-input-list"
          bind:value={returnComments}
          placeholder="Tell us what went wrong..."
          rows="2"
          class="w-full px-3 py-2 rounded-xl border text-xs outline-none resize-none focus:border-pink-500 border-pink-200"
        ></textarea>
      </div>

      <div class="flex gap-3 mt-5 pt-3 border-t border-pink-100">
        <button
          type="button"
          onclick={closeReturnDialog}
          class="flex-1 py-3 rounded-full text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={submitReturn}
          disabled={submittingReturn || uploadingImage}
          class="flex-1 py-3 rounded-full text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);"
        >
          {submittingReturn ? 'Submitting...' : returnType === 'exchange' ? 'Confirm Size Exchange' : 'Submit Return Request'}
        </button>
      </div>
    </div>
  </div>
{/if}