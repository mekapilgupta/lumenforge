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

  let activeReturn = $state<any>(null);
  let showReturnModal = $state(false);
  let exchangeSize = $state('6');
  let returnReason = $state('Size too small / Need larger size');
  let returnComments = $state('');
  let returnImages = $state<string[]>([]);
  let uploadingImage = $state(false);
  let submittingReturn = $state(false);

  const SIZE_OPTIONS = ['4', '5', '6', '7', '8', '36', '37', '38', '39', '40', '41', '42'];
  const EXCHANGE_REASONS = [
    'Size too small / Need larger size',
    'Size too large / Need smaller size',
    'Different color / variant preferred',
    'Defective / Damaged pair received',
  ];

  let razorpayScriptLoaded = $state(false);
  let payingBalance = $state(false);

  onMount(async () => {
    // Load Razorpay checkout script dynamically
    if (typeof window !== 'undefined' && !(window as any).Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => { razorpayScriptLoaded = true; };
      document.body.appendChild(script);
    } else {
      razorpayScriptLoaded = true;
    }

    await authStore.init();
    if (authStore.user) {
      await loadOrder();
      subscribeRealtime();
    }
    loading = false;
  });

  async function payRemainingBalance() {
    if (!order || payingBalance) return;
    payingBalance = true;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const res = await fetch('/api/payments/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action: 'create', orderId: order.id, sessionToken: token })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate balance payment');
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'French Toes',
        description: `Remaining Balance for Order #${order.order_number}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: authStore.profile?.full_name || '',
          email: authStore.user?.email || '',
          contact: authStore.profile?.phone || ''
        },
        theme: {
          color: '#ec4899'
        },
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/payments/balance', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify({
                action: 'verify',
                orderId: order.id,
                sessionToken: token,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              uiStore.addToast(verifyData.message || 'Remaining balance paid successfully! 🌸', 'success');
              await loadOrder();
            } else {
              throw new Error(verifyData.error || 'Payment verification failed');
            }
          } catch (e: any) {
            uiStore.addToast(e?.message || 'Payment verification failed', 'error');
          } finally {
            payingBalance = false;
          }
        },
        modal: {
          ondismiss: function () {
            payingBalance = false;
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        uiStore.addToast(resp?.error?.description || 'Payment failed. Please try again.', 'error');
        payingBalance = false;
      });
      rzp.open();
    } catch (err: any) {
      uiStore.addToast(err?.message || 'Failed to start payment', 'error');
      payingBalance = false;
    }
  }

  function isCodOrder(o: any): boolean {
    if (!o) return false;
    if (o.payment_method === 'cod') return true;
    if (o.payment_status === 'partial_paid' || o.payment_status === 'paid_advance') return true;
    if (o.advance_amount && o.advance_amount > 0 && o.advance_amount < o.total_amount) return true;
    if (o.cod_balance_due && o.cod_balance_due > 0) return true;
    const gwAmount = (o.payment_gateway_response as any)?.amount;
    if (typeof gwAmount === 'number' && gwAmount > 0 && gwAmount < (o.total_amount || 0)) return true;
    const desc = (o.payment_gateway_response as any)?.description;
    if (typeof desc === 'string' && (desc.toLowerCase().includes('cod advance') || desc.toLowerCase().includes('advance confirmation'))) return true;
    return false;
  }

  function getAdvAmount(o: any): number {
    if (!o) return 0;
    if (o.advance_amount && o.advance_amount > 0 && o.advance_amount < o.total_amount) return o.advance_amount;
    const gwAmount = (o.payment_gateway_response as any)?.amount;
    if (typeof gwAmount === 'number' && gwAmount > 0 && gwAmount < (o.total_amount || 0)) return gwAmount;
    return 500;
  }

  function getCodDue(o: any): number {
    if (!o) return 0;
    if (o.cod_balance_due != null && o.cod_balance_due > 0) return o.cod_balance_due;
    const adv = getAdvAmount(o);
    return Math.max(0, (o.total_amount || 0) - adv);
  }

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

    if (data) {
      if (isCodOrder(data) && (data.payment_method !== 'cod' || data.payment_status === 'paid')) {
        const adv = getAdvAmount(data);
        const due = getCodDue(data);
        data.payment_method = 'cod';
        data.payment_status = 'partial_paid';
        data.advance_amount = adv;
        data.cod_balance_due = due;
        // Background update
        supabase.from('orders').update({
          payment_method: 'cod',
          payment_status: 'partial_paid',
          advance_amount: adv,
          cod_balance_due: due
        }).eq('id', orderId).then(() => {});
      }
    }

    order = data as Order;

    // Load active return/exchange request if exists
    const { data: retData } = await supabase
      .from('order_returns')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    activeReturn = retData || null;

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
    if (realtimeSub) {
      supabase.removeChannel(realtimeSub);
      realtimeSub = null;
    }
    realtimeSub = supabase
      .channel(`cust-order-${orderId}-${Date.now()}`)
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

  const isDelivered = $derived(order?.status === 'delivered');
  const deliveryTimestamp = $derived(
    order?.delivered_at
      ? new Date(order.delivered_at).getTime()
      : (order?.updated_at ? new Date(order.updated_at).getTime() : (order?.created_at ? new Date(order.created_at).getTime() : 0))
  );
  const daysSinceDelivery = $derived(
    deliveryTimestamp ? Math.floor((Date.now() - deliveryTimestamp) / (1000 * 60 * 60 * 24)) : 0
  );
  const RETURN_WINDOW_DAYS = 5;
  const isReturnWindowOpen = $derived(isDelivered && daysSinceDelivery <= RETURN_WINDOW_DAYS);
  const returnDaysLeft = $derived(Math.max(1, RETURN_WINDOW_DAYS - daysSinceDelivery));

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

  async function submitReturnRequest() {
    if (!order || submittingReturn) return;
    if (!exchangeSize) {
      uiStore.addToast('Please select your desired exchange size', 'error');
      return;
    }
    if (!returnReason) {
      uiStore.addToast('Please select a reason', 'error');
      return;
    }

    submittingReturn = true;
    try {
      let session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session;
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/returns/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: order.id,
          userId: authStore.user!.id,
          sessionToken: session?.access_token || '',
          type: 'exchange',
          reason: returnReason,
          comments: returnComments,
          images: returnImages,
          exchangeSize: exchangeSize,
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        uiStore.addToast(data.message, 'success');
        showReturnModal = false;
        await loadOrder();
      } else {
        uiStore.addToast(data.error || 'Failed to submit request', 'error');
      }
    } catch (err: any) {
      uiStore.addToast(err.message || 'Network error', 'error');
    } finally {
      submittingReturn = false;
    }
  }

  async function handleReturnImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;
    
    uploadingImage = true;
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i]);
      }
      formData.append('folder', '/returns');
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      const uploadedUrls = data.urls || (data.url ? [data.url] : []);
      if (data.success && uploadedUrls.length > 0) {
        returnImages = [...returnImages, ...uploadedUrls];
        uiStore.addToast('Photo uploaded successfully', 'success');
      } else {
        uiStore.addToast(data.error || 'Failed to upload photo', 'error');
      }
    } catch (err: any) {
      uiStore.addToast(err.message || 'Upload failed', 'error');
    } finally {
      uploadingImage = false;
      target.value = '';
    }
  }

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
      <div class="flex items-center gap-3 flex-wrap">
        <span class="px-4 py-1.5 rounded-full text-sm font-semibold text-white" style="background: {orderStatusColor(order.status)};">
          {orderStatusLabel(order.status)}
        </span>

        <!-- Size Exchange Button (5-Day Window) -->
        {#if isReturnWindowOpen && !activeReturn}
          <button
            onclick={() => showReturnModal = true}
            class="px-4 py-1.5 rounded-full text-sm font-semibold text-white transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
            style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);"
          >
            <span>🔄 Request Size Exchange</span>
            <span class="text-[10px] opacity-90">({returnDaysLeft}d left)</span>
          </button>
        {:else if isDelivered && !activeReturn && daysSinceDelivery > RETURN_WINDOW_DAYS}
          <span class="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-medium border border-gray-200">
            🔒 Exchange Window Closed ({RETURN_WINDOW_DAYS}-day limit passed)
          </span>
        {/if}

        {#if showCancelButton}
          <button onclick={() => showCancelModal = true} disabled={cancelling} class="px-4 py-1.5 rounded-full text-sm font-semibold border hover:bg-red-50 transition-colors" style="border-color: #ef4444; color: #ef4444;">
            {cancelling ? 'Requesting...' : 'Cancel Order'}
          </button>
        {/if}
      </div>
    </div>

    <!-- Active Return / Exchange Card -->
    {#if activeReturn}
      <div class="rounded-2xl p-5 border shadow-sm animate-fade-in bg-gradient-to-r from-pink-50 via-rose-50 to-white" style="border-color: #f4a7c3;">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">{activeReturn.type === 'exchange' ? '🔄' : '💸'}</span>
            <h3 class="font-bold text-base text-pink-900">
              {activeReturn.type === 'exchange' ? `Exchange Requested (Replacement Size: ${activeReturn.exchange_size || 'N/A'})` : 'Return & Refund Requested'}
            </h3>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-pink-200/80 text-pink-800 border border-pink-300">
            {activeReturn.status.replace('_', ' ')}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs mt-3 pt-3 border-t border-pink-200/60">
          <div>
            <span class="text-gray-500 block">Reason:</span>
            <span class="font-semibold text-gray-800">{activeReturn.reason}</span>
          </div>
          {#if activeReturn.shiprocket_return_awb}
            <div>
              <span class="text-gray-500 block">Reverse Pickup AWB (Shiprocket):</span>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="font-mono font-bold text-pink-700 bg-white px-2 py-0.5 rounded border border-pink-200">
                  {activeReturn.shiprocket_return_awb}
                </span>
                <a
                  href={`https://shiprocket.co/tracking/${activeReturn.shiprocket_return_awb}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-indigo-600 hover:underline font-semibold"
                >
                  Track →
                </a>
              </div>
            </div>
          {/if}
          {#if activeReturn.shiprocket_exchange_order_id}
            <div>
              <span class="text-gray-500 block">Exchange Replacement Dispatch:</span>
              <span class="font-bold text-emerald-700">Order ID: {activeReturn.shiprocket_exchange_order_id}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

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

        <!-- COD Advance Notice & Pay Balance Online Action Card -->
        {#if isCodOrder(order)}
          {@const adv = getAdvAmount(order)}
          {@const due = getCodDue(order)}
          <div class="rounded-2xl p-5 border shadow-sm" style="border-color: #fbcfe8; background: linear-gradient(135deg, #fff5f7 0%, #ffffff 100%);">
            <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span class="text-xs font-bold uppercase tracking-wider text-pink-700 bg-pink-100/90 px-2.5 py-0.5 rounded-full border border-pink-200">
                🛡️ Cash on Delivery (Advance Deposit)
              </span>
              {#if due > 0 && order.payment_status !== 'paid'}
                <span class="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  ₹{(due/100).toFixed(0)} Due on Delivery
                </span>
              {:else}
                <span class="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                  ✓ 100% Paid
                </span>
              {/if}
            </div>

            <p class="text-xs text-gray-700 leading-relaxed">
              Advance deposit paid: <strong class="text-pink-900">{fmt(adv)}</strong>.
              {#if due > 0 && order.payment_status !== 'paid'}
                Remaining collectable amount: <strong class="text-emerald-800">{fmt(due)}</strong> (payable to courier upon delivery).
              {:else}
                Your order is fully paid. No cash will be collected on delivery!
              {/if}
            </p>

            <!-- Leftover COD online payment collection hidden for now per request -->
            <!--
            {#if due > 0 && order.payment_status !== 'paid' && order.status !== 'cancelled' && order.status !== 'delivered'}
              <div class="mt-4 pt-3 border-t border-pink-100">
                <button
                  onclick={payRemainingBalance}
                  disabled={payingBalance}
                  class="w-full py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);"
                >
                  {#if payingBalance}
                    <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Opening Payment...</span>
                  {:else}
                    <span>⚡ Pay Remaining {fmt(due)} Online Now</span>
                  {/if}
                </button>
                <p class="text-[10px] text-gray-500 text-center mt-1.5 font-medium">
                  Instant confirmation · Switch to 100% contactless prepaid delivery
                </p>
              </div>
            {/if}
            -->
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
              <span style="color: var(--color-text-dark);">Total Order Value</span>
              <span style="color: var(--color-text-dark);">{fmt(order.total_amount)}</span>
            </div>
            {#if isCodOrder(order)}
              {@const adv = getAdvAmount(order)}
              {@const due = getCodDue(order)}
              <div class="mt-2 pt-2 border-t text-xs space-y-1" style="border-color: var(--color-blush);">
                <div class="flex justify-between text-pink-900 font-semibold">
                  <span>Advance Paid Online:</span>
                  <span>{fmt(adv)}</span>
                </div>
                <div class="flex justify-between text-emerald-700 font-bold">
                  <span>Balance Payable on Delivery:</span>
                  <span>{due > 0 && order.payment_status !== 'paid' ? fmt(due) : '₹0 (Paid in Full)'}</span>
                </div>
              </div>
            {/if}
          </div>
          <div class="mt-3 pt-2 border-t text-sm flex justify-between items-center" style="border-color: var(--color-blush);">
            <span style="color: var(--color-text-soft);">Payment Method: </span>
            <span class="font-medium" style="color: var(--color-text-dark);">
              {isCodOrder(order) ? `Cash on Delivery (₹${((getAdvAmount(order))/100).toFixed(0)} Adv)` : paymentLabel(order.payment_method)}
            </span>
          </div>
        </div>

        <!-- Razorpay payment details -->
        {#if order.payment_method === 'razorpay' || order.razorpay_payment_id || order.advance_amount || isCodOrder(order)}
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
                  <p class="text-xs" style="color: var(--color-text-soft);">Online Payment ID</p>
                  <p class="font-mono text-xs" style="color: var(--color-text-dark);">{order.razorpay_payment_id}</p>
                </div>
              {/if}
              {#if order.payment_gateway_response}
                {@const gateway = order.payment_gateway_response as any}
                {#if gateway.method}
                  <div>
                    <p class="text-xs" style="color: var(--color-text-soft);">Gateway Method</p>
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
              <div>
                <p class="text-xs" style="color: var(--color-text-soft);">Payment Status</p>
                {#if order.payment_status === 'paid' && !isCodOrder(order)}
                  <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    ✓ Paid in Full
                  </span>
                {:else if isCodOrder(order) && getCodDue(order) > 0 && order.payment_status !== 'paid'}
                  <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-800">
                    🛡️ Advance Paid (₹{(getCodDue(order)/100).toFixed(0)} Due)
                  </span>
                {:else}
                  <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    ✓ Paid in Full
                  </span>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Shipment & Delivery Tracking -->
        {#if order.awb_code || order.tracking_id || order.shiprocket_order_id}
          <div class="rounded-2xl p-4 border animate-fade-in" style="border-color: #f4a7c3; background: #fffdf9;">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-sm" style="color: var(--color-text-dark);">🚚 Shipment &amp; Tracking</h3>
              {#if order.shiprocket_status}
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase" style="background: rgba(244, 167, 195, 0.2); color: #b84a62; border: 1px solid rgba(244, 167, 195, 0.4);">
                  {order.shiprocket_status}
                </span>
              {/if}
            </div>

            <div class="space-y-2.5 text-xs">
              {#if order.courier_name}
                <div class="flex justify-between items-center">
                  <span style="color: var(--color-text-soft);">Courier Partner:</span>
                  <span class="font-semibold text-sm" style="color: var(--color-text-dark);">{order.courier_name}</span>
                </div>
              {/if}

              {#if order.awb_code || order.tracking_id}
                {@const awb = order.awb_code || order.tracking_id}
                <div class="flex justify-between items-center">
                  <span style="color: var(--color-text-soft);">Tracking Number (AWB):</span>
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-xs px-2 py-0.5 rounded" style="background: #faf5f0; border: 1px solid #e0d0c5; color: var(--color-text-dark);">
                      {awb}
                    </span>
                  </div>
                </div>
              {/if}

              {#if order.estimated_delivery_date}
                <div class="flex justify-between items-center">
                  <span style="color: var(--color-text-soft);">Estimated Delivery:</span>
                  <span class="font-medium" style="color: #2e7d32;">{order.estimated_delivery_date}</span>
                </div>
              {/if}

              {#if order.tracking_url || order.awb_code}
                <div class="pt-2 border-t mt-2" style="border-color: rgba(244, 167, 195, 0.3);">
                  <a
                    href={order.tracking_url || `https://shiprocket.co/tracking/${order.awb_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold text-white transition-transform active:scale-95 shadow-sm"
                    style="background: linear-gradient(135deg, #ff7f6e 0%, #f4a7c3 100%);"
                  >
                    <span>Track Live on Courier Partner</span>
                    <span>→</span>
                  </a>
                </div>
              {/if}
            </div>
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

    <!-- Size Exchange Modal -->
    {#if showReturnModal}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onclick={() => showReturnModal = false}
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-modal-title"
      >
        <div
          class="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl transition-all border border-pink-100 flex flex-col p-6 max-h-[90vh] overflow-y-auto"
          onclick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between pb-3 border-b border-pink-100 mb-4">
            <div>
              <h3 id="return-modal-title" class="font-display font-bold text-xl text-gray-900">Request Size Exchange 🌸</h3>
              <p class="text-xs text-gray-500 mt-0.5">5-day exchange guarantee. Reverse pickup & replacement are 100% free.</p>
            </div>
            <button onclick={() => showReturnModal = false} class="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">✕</button>
          </div>

          <!-- Exchange Form -->
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
              <label for="exchange-reason-select" class="block text-xs font-bold text-gray-700 mb-1.5">Reason for size exchange *</label>
              <select
                id="exchange-reason-select"
                bind:value={returnReason}
                class="w-full px-3 py-2.5 rounded-xl border text-xs bg-white outline-none focus:border-pink-500 border-pink-200"
              >
                {#each EXCHANGE_REASONS as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
          </div>

          <!-- Upload photo evidence -->
          <div class="mt-4 pt-3 border-t border-pink-100">
            <label class="block text-xs font-bold text-gray-700 mb-1.5">Add Photos of Footwear (Optional / Recommended)</label>
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
            <label for="return-comments-input" class="block text-xs font-bold text-gray-700 mb-1">Additional Comments (Optional)</label>
            <textarea
              id="return-comments-input"
              bind:value={returnComments}
              placeholder="Tell us about the sizing issue..."
              rows="2"
              class="w-full px-3 py-2 rounded-xl border text-xs outline-none resize-none focus:border-pink-500 border-pink-200"
            ></textarea>
          </div>

          <div class="flex gap-3 mt-5 pt-3 border-t border-pink-100">
            <button
              type="button"
              onclick={() => showReturnModal = false}
              class="flex-1 py-3 rounded-full text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={submitReturnRequest}
              disabled={submittingReturn || uploadingImage}
              class="flex-1 py-3 rounded-full text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              style="background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);"
            >
              {submittingReturn ? 'Submitting...' : 'Confirm Size Exchange'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

