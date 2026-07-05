<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { canCancel } from '$lib/orders';
  import type { Order, OrderLog } from '$lib/types';
  import { orderStatusLabel, orderStatusColor, formatDateTime } from '$lib/utils/helpers';
  
  let order = $state<Order | null>(null);
  let logs = $state<OrderLog[]>([]);
  let timelineEntries = $state<any[]>([]); // merged logs + messages
  let loading = $state(true);
  let cancelling = $state(false);
  let realtimeSub: any = null;

  let showCancelModal = $state(false);
  let cancelReason = $state('');
  let cancelDescription = $state('');

  const CANCEL_REASONS = [
    'Ordered by mistake',
    'Incorrect size selected',
    'Incorrect color selected',
    'Delivery is taking too long',
    'Found a better price elsewhere',
    'Other (please specify below)',
  ];

  const ORDER_STEPS = ['pending','confirmed','processing','packed','shipped','out_for_delivery','delivered'] as const;

  onMount(async () => {
    await authStore.init();
    if (authStore.user) {
      await loadOrder();
      subscribeRealtime();
    }
    loading = false;
  });

  onDestroy(() => {
    if (realtimeSub) supabase.removeChannel(realtimeSub);
  });

  async function loadOrder() {
    const orderId = ($page.params as Record<string, string>)['id'];
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*), shipping_address:addresses!shipping_address_id(*)')
      .eq('id', orderId)
      .eq('user_id', authStore.user!.id)
      .single();
    if (error || !data) { uiStore.addToast('Order not found', 'error'); return; }
    order = data as Order;

    // Load logs
    const { data: logData } = await supabase
      .from('order_logs')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    logs = (logData ?? []) as OrderLog[];

    // Load chat messages from order_messages table
    const { data: msgData } = await supabase
      .from('order_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    // Merge logs + messages by timestamp for unified timeline
    const entries: any[] = [];
    for (const log of (logData ?? [])) {
      // Skip old Customer:/Admin: prefixed log entries that were used for chat
      // (they'll have equivalent entries in order_messages if migrated, but
      // for backwards compat we still show them if order_messages is empty)
      entries.push({ ...log, entryType: 'log' });
    }
    for (const msg of (msgData ?? [])) {
      entries.push({ ...msg, entryType: msg.sender_type === 'customer' ? 'customer_msg' : 'admin_msg' });
    }
    // Sort by created_at ascending
    entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    timelineEntries = entries;
  }

  function subscribeRealtime() {
    const orderId = ($page.params as Record<string, string>)['id'];
    realtimeSub = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        if (order && payload.new) {
          order = { ...order, ...(payload.new as Partial<Order>) };
          uiStore.addToast(`Order status updated to: ${orderStatusLabel((payload.new as any).status)} 📦`, 'info');
          loadOrder(); // reload logs too
        }
      })
      .subscribe();
  }

  async function cancelOrder() {
    if (!order || cancelling) return;
    if (!cancelReason) {
      uiStore.addToast('Please select a cancellation reason', 'error');
      return;
    }
    let fullReason = cancelReason;
    if (cancelReason.includes('Other') && cancelDescription.trim()) {
      fullReason = `Other: ${cancelDescription.trim()}`;
    } else if (cancelDescription.trim()) {
      fullReason = `${cancelReason} (${cancelDescription.trim()})`;
    }

    cancelling = true;
    showCancelModal = false;

    const cancelResult = canCancel({
      id: order.id,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      cancellation_status: order.cancellation_status,
      razorpay_payment_id: order.razorpay_payment_id,
      user_id: order.user_id,
      total_amount: order.total_amount,
    });

    if (!cancelResult.allowed) {
      cancelling = false;
      uiStore.addToast(cancelResult.reason ?? 'Cannot cancel this order at this stage.', 'error');
      return;
    }

    if (!cancelResult.requiresApproval) {
      // Auto-approve: Confirmed or Pending — restock and cancel immediately
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          if (item.variant_id) {
            const { data: pv } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', item.variant_id)
              .single();
            if (pv) {
              await supabase
                .from('product_variants')
                .update({ stock_quantity: pv.stock_quantity + item.quantity })
                .eq('id', item.variant_id);
            }
          }
        }
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_status: 'approved',
          cancellation_reason: fullReason,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('user_id', authStore.user!.id);

      if (error) {
        cancelling = false;
        uiStore.addToast('Could not cancel order: ' + error.message, 'error');
        return;
      }

      // Insert log
      await supabase
        .from('order_logs')
        .insert({
          order_id: order.id,
          status: 'cancelled',
          note: `Cancelled by customer: ${fullReason}`,
          created_by: authStore.user!.id,
        });

      cancelling = false;
      await loadOrder();
      uiStore.addToast('Order cancelled successfully.', 'success');
    } else {
      // Requires admin approval (Processing)
      const { error } = await supabase
        .from('orders')
        .update({
          cancellation_status: 'pending',
          cancellation_reason: fullReason,
        })
        .eq('id', order.id)
        .eq('user_id', authStore.user!.id);

      if (error) {
        cancelling = false;
        uiStore.addToast('Could not request cancellation: ' + error.message, 'error');
        return;
      }

      // Insert a row in order_logs for the cancellation request
      await supabase
        .from('order_logs')
        .insert({
          order_id: order.id,
          status: order.status,
          note: `Cancellation requested: ${fullReason}`,
          created_by: authStore.user!.id,
        });

      cancelling = false;

      // The trigger trg_cancellation_admin_action will auto-insert into admin_actions
      await loadOrder();
      uiStore.addToast('Cancellation request submitted for admin approval', 'success');
    }
  }

  async function sendMessage() {
    if (!newMessageText.trim() || !order) return;
    sendingMessage = true;
    const msg = newMessageText.trim();
    
    // Insert into order_messages (new table, triggers chat_message admin_action)
    const { error } = await supabase
      .from('order_messages')
      .insert({
        order_id: order.id,
        sender_type: 'customer',
        message: msg,
      });
      
    if (error) {
      sendingMessage = false;
      uiStore.addToast('Failed to send message: ' + error.message, 'error');
      return;
    }
    
    newMessageText = '';
    sendingMessage = false;
    
    // Send email to admin
    fetch('/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_message',
        recipientEmail: 'kapilgupta@duck.com',
        recipientName: 'Admin',
        payloadData: {
          orderNumber: order.order_number,
          senderName: authStore.profile?.full_name || authStore.user?.email || 'Customer',
          messageText: msg
        }
      })
    }).catch(err => console.warn('Notification email failed:', err));
    
    await loadOrder();
    uiStore.addToast('Message sent', 'success');
  }

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

  function formatPaymentDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const currentStepIndex = $derived(
    order ? ORDER_STEPS.indexOf(order.status as any) : -1
  );

  const showCancelButton = $derived(
    order && 
    canCancel({
      id: order.id,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      cancellation_status: order.cancellation_status,
      razorpay_payment_id: order.razorpay_payment_id,
      user_id: order.user_id,
      total_amount: order.total_amount,
    }).allowed &&
    order.cancellation_status !== 'pending' &&
    order.cancellation_status !== 'approved'
  );

  let newMessageText = $state('');
  let sendingMessage = $state(false);
</script>

<svelte:head><title>Order Details — French Toes</title></svelte:head>

{#if loading}
  <div class="flex justify-center py-16">
    <div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color: var(--color-blush); border-top-color: var(--color-blush-deep);"></div>
  </div>
{:else if !order}
  <div class="text-center py-16">
    <p class="font-semibold text-lg mb-4" style="color: var(--color-text-dark);">Order not found</p>
    <a href="/account/orders" class="btn-primary">Back to Orders</a>
  </div>
{:else}
  <div class="flex flex-col gap-6">

    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <a href="/account/orders" class="text-sm mb-1 block" style="color: var(--color-text-soft);">← My Orders</a>
        <h2 class="font-display text-2xl font-bold" style="color: var(--color-text-dark);">{order.order_number}</h2>
        <p class="text-sm" style="color: var(--color-text-soft);">{formatDateTime(order.created_at)}</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="px-4 py-1.5 rounded-full text-sm font-semibold text-white" style="background: {orderStatusColor(order.status)};">
          {orderStatusLabel(order.status)}
        </span>
        {#if showCancelButton}
          <button onclick={() => showCancelModal = true} disabled={cancelling} class="px-4 py-1.5 rounded-full text-sm font-semibold border hover:bg-red-50 transition-colors" style="border-color: #ef4444; color: #ef4444;">
            {cancelling ? 'Requesting...' : 'Cancel Order'}
          </button>
        {/if}
      </div>
    </div>

    {#if order.cancellation_status === 'pending'}
      <div class="rounded-2xl p-4 border flex items-center justify-between animate-fade-in" style="background: var(--color-bg-accent); border-color: var(--color-blush); color: var(--color-brown);">
        <div>
          <h4 class="font-bold text-sm" style="color: var(--color-coral);">Cancellation Requested 💔</h4>
          <p class="text-xs mt-0.5" style="color: var(--color-brown-light);">We are reviewing your request to cancel this order. Our team will update you shortly.</p>
          {#if order.cancellation_reason}
            <p class="text-xs mt-1 font-semibold italic" style="color: var(--color-nude);">Reason: "{order.cancellation_reason}"</p>
          {/if}
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-semibold shrink-0" style="background: var(--color-blush); color: white;">Pending Approval</span>
      </div>
    {:else if order.cancellation_status === 'rejected'}
      <div class="rounded-2xl p-4 border flex items-center justify-between animate-fade-in" style="background: #faf5f0; border-color: var(--color-gold); color: var(--color-brown);">
        <div>
          <h4 class="font-bold text-sm" style="color: var(--color-gold);">Cancellation Request Update ⚠️</h4>
          <p class="text-xs mt-0.5" style="color: var(--color-brown-light);">Your cancellation request was not approved as the order has already moved forward in processing. We apologize for any inconvenience.</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-semibold shrink-0" style="background: var(--color-gold); color: white;">Resumed</span>
      </div>
    {/if}

    <!-- Order Timeline -->
    {#if order.status !== 'cancelled' && order.status !== 'refunded'}
      <div class="rounded-2xl p-5 border" style="border-color: var(--color-blush); background: white;">
        <h3 class="font-semibold text-base mb-5" style="color: var(--color-text-dark);">Order Progress</h3>
        <div class="flex items-center justify-between overflow-x-auto gap-0">
          {#each ORDER_STEPS as step, i}
            {@const done = currentStepIndex >= i}
            {@const current = currentStepIndex === i}
            <div class="flex flex-col items-center flex-1 min-w-0">
              <div class="flex items-center w-full">
                {#if i > 0}
                  <div class="flex-1 h-0.5" style="background: {done ? orderStatusColor(order.status) : '#e5e7eb'};"></div>
                {/if}
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all {current ? 'ring-2 ring-offset-2' : ''}"
                  style="background: {done ? orderStatusColor(order.status) : '#f3f4f6'}; color: {done ? 'white' : '#9ca3af'}; ring-color: {orderStatusColor(order.status)};"
                >
                  {done ? '✓' : i + 1}
                </div>
                {#if i < ORDER_STEPS.length - 1}
                  <div class="flex-1 h-0.5" style="background: {currentStepIndex > i ? orderStatusColor(order.status) : '#e5e7eb'};"></div>
                {/if}
              </div>
              <p class="text-xs text-center mt-1 leading-tight" style="color: {done ? 'var(--color-text-dark)' : 'var(--color-text-soft)'}; max-width: 60px; word-break: break-word;">
                {orderStatusLabel(step)}
              </p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Items + Address -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Items -->
      <div class="lg:col-span-2 rounded-2xl border overflow-hidden" style="border-color: var(--color-blush);">
        <div class="px-5 py-4 border-b" style="border-color: var(--color-blush); background: var(--color-blush);">
          <h3 class="font-semibold text-sm" style="color: var(--color-text-dark);">Order Items</h3>
        </div>
        {#if order.items}
          {#each order.items as item (item.id)}
            <div class="flex items-center gap-4 p-4 border-b last:border-b-0" style="border-color: var(--color-blush); background: white;">
              {#if item.product_image_url}
                <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0" style="background: var(--color-blush);">
                  <img src={item.product_image_url} alt={item.product_name} class="w-full h-full object-cover" loading="lazy" />
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm" style="color: var(--color-text-dark);">{item.product_name}</p>
                {#if item.variant_info}
                  <p class="text-xs mt-0.5" style="color: var(--color-text-soft);">
                    {#if item.variant_info.color}Color: {item.variant_info.color}{/if}
                    {#if item.variant_info.size} · Size: {item.variant_info.size}{/if}
                  </p>
                {/if}
                <p class="text-xs" style="color: var(--color-text-soft);">Qty: {item.quantity}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="font-bold text-sm" style="color: var(--color-text-dark);">{fmt(item.total_price)}</p>
                <p class="text-xs" style="color: var(--color-text-soft);">{fmt(item.unit_price)} each</p>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Right column -->
      <div class="flex flex-col gap-4">
        <!-- Shipping address -->
        {#if order.shipping_address}
          {@const addr = order.shipping_address as any}
          <div class="rounded-2xl p-4 border" style="border-color: var(--color-blush); background: white;">
            <h3 class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Delivery Address</h3>
            <p class="text-sm font-medium" style="color: var(--color-text-dark);">{addr.full_name}</p>
            <p class="text-sm" style="color: var(--color-text-mid);">{addr.address_line1}{addr.address_line2 ? ', ' + addr.address_line2 : ''}</p>
            <p class="text-sm" style="color: var(--color-text-mid);">{addr.city}, {addr.state} – {addr.pincode}</p>
            <p class="text-sm mt-1" style="color: var(--color-text-soft);">📞 {addr.phone}</p>
          </div>
        {/if}

        <!-- Price breakdown -->
        <div class="rounded-2xl p-4 border" style="border-color: var(--color-blush); background: white;">
          <h3 class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Price Details</h3>
          <div class="space-y-1.5 text-sm">
            <div class="flex justify-between"><span style="color: var(--color-text-mid);">Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            {#if order.discount_amount > 0}
              <div class="flex justify-between" style="color: var(--color-mint-deep);"><span>Discount</span><span>−{fmt(order.discount_amount)}</span></div>
            {/if}
            <div class="flex justify-between"><span style="color: var(--color-text-mid);">Shipping</span><span style="color: {order.shipping_charges === 0 ? 'var(--color-mint-deep)' : ''}">{order.shipping_charges === 0 ? 'FREE' : fmt(order.shipping_charges)}</span></div>
            <div class="flex justify-between"><span style="color: var(--color-text-mid);">COD Charge</span><span>{fmt(order.cod_charges)}</span></div>
            <div class="flex justify-between"><span style="color: var(--color-text-mid);">GST (5%)</span><span>{fmt(order.gst_amount)}</span></div>
            <div class="border-t pt-2 flex justify-between font-bold" style="border-color: var(--color-blush);">
              <span style="color: var(--color-text-dark);">Total</span>
              <span style="color: var(--color-text-dark);">{fmt(order.total_amount)}</span>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t text-sm" style="border-color: var(--color-blush);">
            <span style="color: var(--color-text-soft);">Payment: </span>
            <span class="font-medium" style="color: var(--color-text-dark);">{paymentLabel(order.payment_method)}</span>
          </div>
        </div>

        <!-- Razorpay payment details -->
        {#if order.payment_method === 'razorpay' || order.razorpay_payment_id}
          <div class="rounded-2xl p-4 border" style="border-color: var(--color-blush); background: white;">
            <h3 class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Payment Details</h3>
            <div class="space-y-2 text-sm">
              {#if order.razorpay_order_id}
                <div>
                  <p class="text-xs" style="color: var(--color-text-soft);">Razorpay Order ID</p>
                  <p class="font-mono text-xs" style="color: var(--color-text-dark);">{order.razorpay_order_id}</p>
                </div>
              {/if}
              {#if order.razorpay_payment_id}
                <div>
                  <p class="text-xs" style="color: var(--color-text-soft);">Payment ID</p>
                  <p class="font-mono text-xs" style="color: var(--color-text-dark);">{order.razorpay_payment_id}</p>
                </div>
              {/if}
              {#if order.payment_gateway_response}
                {@const gateway = order.payment_gateway_response as any}
                {#if gateway.method}
                  <div>
                    <p class="text-xs" style="color: var(--color-text-soft);">Payment Method</p>
                    <p class="font-medium text-xs" style="color: var(--color-text-dark);">
                      {gateway.method === 'upi' ? 'UPI' :
                       gateway.method === 'card' ? 'Credit/Debit Card' :
                       gateway.method === 'netbanking' ? 'Net Banking' :
                       gateway.method === 'wallet' ? 'Wallet' :
                       gateway.method.toUpperCase()}
                    </p>
                  </div>
                {/if}
                {#if gateway.bank}
                  <div>
                    <p class="text-xs" style="color: var(--color-text-soft);">Bank</p>
                    <p class="text-xs" style="color: var(--color-text-dark);">{gateway.bank}</p>
                  </div>
                {/if}
                {#if gateway.email}
                  <div>
                    <p class="text-xs" style="color: var(--color-text-soft);">Email</p>
                    <p class="text-xs" style="color: var(--color-text-dark);">{gateway.email}</p>
                  </div>
                {/if}
                {#if gateway.contact}
                  <div>
                    <p class="text-xs" style="color: var(--color-text-soft);">Phone</p>
                    <p class="text-xs" style="color: var(--color-text-dark);">{gateway.contact}</p>
                  </div>
                {/if}
              {/if}
              {#if order.payment_completed_at}
                <div>
                  <p class="text-xs" style="color: var(--color-text-soft);">Payment Completed</p>
                  <p class="text-xs" style="color: var(--color-text-dark);">{formatPaymentDate(order.payment_completed_at)}</p>
                </div>
              {/if}
              {#if order.payment_status}
                <div>
                  <p class="text-xs" style="color: var(--color-text-soft);">Payment Status</p>
                  <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style="background: {order.payment_status === 'paid' ? 'var(--color-mint)' : 'var(--color-blush)'}; color: {order.payment_status === 'paid' ? 'var(--color-mint-deep)' : 'var(--color-text-mid)'};">
                    {order.payment_status === 'paid' ? '✓ Paid' : order.payment_status}
                  </span>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Tracking info -->
        {#if order.tracking_id}
          <div class="rounded-2xl p-4 border" style="border-color: var(--color-blush); background: white;">
            <h3 class="font-semibold text-sm mb-2" style="color: var(--color-text-dark);">Tracking</h3>
            <p class="font-mono text-sm" style="color: var(--color-blush-deep);">{order.tracking_id}</p>
            {#if order.tracking_url}
              <a href={order.tracking_url} target="_blank" rel="noopener" class="text-xs mt-1 block" style="color: var(--color-blush-deep);">Track shipment →</a>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Order Timeline & Messages (merged) -->
    {#if timelineEntries.length > 0}
      <div class="rounded-2xl p-5 border" style="border-color: var(--color-blush); background: white;">
        <h3 class="font-semibold text-base mb-5" style="color: var(--color-text-dark);">Order Timeline & Messages</h3>
        <div class="relative pl-6 space-y-5">
          <div class="absolute left-2 top-0 bottom-0 w-px" style="background: var(--color-blush);"></div>
          {#each timelineEntries as entry (entry.id)}
            {@const isCustomerMsg = entry.entryType === 'customer_msg'}
            {@const isAdminMsg = entry.entryType === 'admin_msg'}
            {@const isLogEntry = entry.entryType === 'log'}
            <div class="relative">
              <div 
                class="absolute -left-4 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center text-[8px]" 
                style="border-color: {isCustomerMsg ? 'var(--color-peach)' : isAdminMsg ? 'var(--color-blush)' : orderStatusColor(entry.status)};"
              >
                {isCustomerMsg ? '👤' : isAdminMsg ? '💬' : '✓'}
              </div>
              
              {#if isCustomerMsg}
                <div class="ml-2 rounded-2xl p-3 max-w-lg border" style="background-color: var(--color-bg-secondary); border-color: rgba(212, 165, 116, 0.2);">
                  <p class="text-xs font-bold" style="color: var(--color-nude);">You (Customer)</p>
                  <p class="text-sm mt-0.5" style="color: var(--color-brown);">{entry.message}</p>
                  <p class="text-[10px] text-gray-400 mt-1">{formatDateTime(entry.created_at)}</p>
                </div>
              {:else if isAdminMsg}
                <div class="ml-2 rounded-2xl p-3 max-w-lg border" style="background-color: var(--color-bg-accent); border-color: var(--color-blush);">
                  <p class="text-xs font-bold" style="color: var(--color-coral);">French Toes Support</p>
                  <p class="text-sm mt-0.5" style="color: var(--color-brown);">{entry.message}</p>
                  <p class="text-[10px] text-gray-400 mt-1">{formatDateTime(entry.created_at)}</p>
                </div>
              {:else if isLogEntry}
                {#if entry.note?.startsWith('Customer: ') || entry.note?.startsWith('Admin: ') || entry.note?.startsWith('Support: ')}
                  <!-- Legacy chat entries from order_logs — suppress since order_messages now handles chat -->
                  <!-- Skip rendering -->
                {:else}
                  <div class="ml-2">
                    <p class="font-semibold text-sm" style="color: var(--color-text-dark);">{orderStatusLabel(entry.status)}</p>
                    {#if entry.note}<p class="text-xs mt-0.5" style="color: var(--color-text-mid);">{entry.note}</p>{/if}
                    <p class="text-xs mt-0.5" style="color: var(--color-text-soft);">{formatDateTime(entry.created_at)}</p>
                  </div>
                {/if}
              {:else}
                <div class="ml-2">
                  <p class="font-semibold text-sm" style="color: var(--color-text-dark);">{orderStatusLabel(entry.status)}</p>
                  {#if entry.note}<p class="text-xs mt-0.5" style="color: var(--color-text-mid);">{entry.note}</p>{/if}
                  <p class="text-xs mt-0.5" style="color: var(--color-text-soft);">{formatDateTime(entry.created_at)}</p>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Support Chat Box -->
        <div class="mt-6 pt-5 border-t border-dashed" style="border-color: var(--color-blush);">
          <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Message support regarding this order</h4>
          <div class="flex gap-2">
            <input 
              type="text" 
              bind:value={newMessageText} 
              placeholder="Ask a question or reply..." 
              class="flex-1 px-4 py-2 rounded-xl text-sm border bg-white outline-none focus:border-[#ff7f6e] transition-all"
              style="border-color: var(--color-blush); color: var(--color-brown);"
              onkeydown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={sendingMessage}
            />
            <button 
              onclick={sendMessage} 
              disabled={sendingMessage || !newMessageText.trim()}
              class="px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              style="background: linear-gradient(135deg, var(--color-peach), var(--color-coral));"
            >
              {sendingMessage ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Cancel Order Reason Modal -->
    {#if showCancelModal}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
        onclick={() => showCancelModal = false}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
      >
        <div
          class="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl transition-all border border-pink-100 flex flex-col p-6"
          onclick={(e) => e.stopPropagation()}
        >
          <h3 id="cancel-modal-title" class="font-display font-bold text-xl text-[#2d1b2e] mb-4">Cancel Order? 💔</h3>
          
          <p class="text-sm text-[#9e7ca0] mb-4">Please let us know why you are cancelling your order. This helps us improve our slippers!</p>
          
          <div class="flex flex-col gap-3 mb-5">
            <label for="cancel-reason-select" class="block text-xs font-semibold text-[#6b4c6e]">Reason for cancellation *</label>
            <select
              id="cancel-reason-select"
              bind:value={cancelReason}
              class="w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none focus:border-[#D81B60]"
              style="border-color: var(--color-blush); color: var(--color-text-dark);"
            >
              <option value="">Select a reason</option>
              {#each CANCEL_REASONS as reason}
                <option value={reason}>{reason}</option>
              {/each}
            </select>
            
            <label for="cancel-desc-input" class="block text-xs font-semibold text-[#6b4c6e] mt-1">Additional details (optional)</label>
            <textarea
              id="cancel-desc-input"
              bind:value={cancelDescription}
              placeholder="E.g. want to order size 38 instead"
              rows="3"
              class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none focus:border-[#D81B60]"
              style="border-color: var(--color-blush); color: var(--color-text-dark);"
            ></textarea>
          </div>
          
          <div class="flex gap-3 mt-2">
            <button
              onclick={() => showCancelModal = false}
              class="flex-1 py-3 rounded-full text-xs font-semibold border text-[#6b4c6e]"
              style="border-color: var(--color-blush);"
            >
              Keep Order
            </button>
            <button
              onclick={cancelOrder}
              disabled={!cancelReason}
              class="flex-1 py-3 rounded-full text-xs font-semibold text-white"
              style="background: #ef4444; cursor: {cancelReason ? 'pointer' : 'not-allowed'}; opacity: {cancelReason ? 1 : 0.6};"
            >
              Confirm Cancel
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
