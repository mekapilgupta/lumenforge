<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { formatDateTime } from '$lib/utils/helpers';
  import type { Order, OrderLog } from '$lib/types';

  let order = $state<any>(null);
  let logs = $state<OrderLog[]>([]);
  let timelineEntries = $state<any[]>([]);
  let loading = $state(true);
  let updating = $state(false);
  let adminNote = $state('');
  let savingNote = $state(false);
  
  // Modals state
  let cancelReason = $state('');
  let showCancelModal = $state(false);

  let showStatusModal = $state(false);
  let targetStatus = $state('');
  let statusComment = $state('');
  let notifyCustomer = $state(true);

  let showApproveCancelModal = $state(false);
  let showRejectCancelModal = $state(false);
  let cancelActionComment = $state('');

  // Support Timeline Chat
  let adminMessage = $state('');
  let sendingMessage = $state(false);

  const STATUS_FLOW: Record<string, { next: string; label: string }[]> = {
    pending: [{ next: 'confirmed', label: '✓ Confirm Order' }, { next: 'cancelled', label: '✗ Cancel' }],
    confirmed: [{ next: 'processing', label: '⚙️ Start Processing' }, { next: 'cancelled', label: '✗ Cancel' }],
    processing: [{ next: 'packed', label: '📦 Mark Packed' }],
    packed: [{ next: 'shipped', label: '🚚 Mark Shipped' }],
    shipped: [{ next: 'out_for_delivery', label: '🏃 Out for Delivery' }, { next: 'returned', label: '↩ Mark Returned' }],
    out_for_delivery: [{ next: 'delivered', label: '✅ Mark Delivered' }],
    delivered: [{ next: 'refund_requested', label: '💸 Refund Requested' }, { next: 'returned', label: '↩ Mark Returned' }],
    refund_requested: [{ next: 'refunded', label: '💰 Refunded' }],
    returned: [],
    cancelled: [],
    refunded: [],
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#3b82f6', processing: '#8b5cf6',
    packed: '#06b6d4', shipped: '#06b6d4', out_for_delivery: '#f97316',
    delivered: '#22c55e', cancelled: '#ef4444', refund_requested: '#ec4899', refunded: '#6b7280', returned: '#374151',
  };
  
  const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
    packed: 'Packed', shipped: 'Shipped', out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered', cancelled: 'Cancelled', refund_requested: 'Refund Requested', refunded: 'Refunded', returned: 'Returned',
  };

  const STATUS_TEMPLATES: Record<string, string[]> = {
    confirmed: [
      "Order confirmed! We are preparing your slippers.",
      "Order verified. Processing will start shortly."
    ],
    processing: [
      "We have started manufacturing/processing your order."
    ],
    packed: [
      "Your French Toes slippers have been packed and are ready for pickup."
    ],
    shipped: [
      "Shipped via Shiprocket. Tracking URL: https://shiprocket.co/tracking/",
      "Your order is shipped! Tracking ID: "
    ],
    out_for_delivery: [
      "Your package is out for delivery! Our rider will contact you shortly."
    ],
    delivered: [
      "Order delivered successfully! Thank you for shopping with us.",
      "Delivered. Enjoy your new pastel slippers!"
    ],
    returned: [
      "Product returned to warehouse.",
      "Returned. Shiprocket tracking updated."
    ],
    refund_requested: [
      "Refund request registered. Under review."
    ],
    refunded: [
      "Refund processed via Razorpay. Refund ID: pay_",
      "Refunded. The amount will reflect in your account within 5-7 days."
    ]
  };

  onMount(async () => {
    await authStore.init();
    if (authStore.user && authStore.isAdmin) {
      await loadOrder();
    }
    loading = false;
  });

  async function markChatActionsResolved(orderId: string, msgData: any[]) {
    const unreadCustomerMsgs = msgData.filter(
      (m: any) => m.sender_type === 'customer' && !m.read_by_admin_at
    );
    if (unreadCustomerMsgs.length > 0) {
      await supabase
        .from('order_messages')
        .update({ read_by_admin_at: new Date().toISOString() })
        .in('id', unreadCustomerMsgs.map((m: any) => m.id));

      await supabase
        .from('admin_actions')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('type', 'chat_message')
        .eq('status', 'pending');
    }
  }

  async function loadOrder() {
    const orderId = ($page.params as Record<string, string>)['id'];
    const { data } = await supabase
      .from('orders')
      .select('*, profile:user_id(full_name, email, phone), items:order_items(*), shipping_address:addresses!shipping_address_id(*)')
      .eq('id', orderId)
      .single();
    order = data;
    adminNote = data?.admin_notes ?? '';

    const [{ data: logData }, { data: msgData }] = await Promise.all([
      supabase
        .from('order_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
      supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
    ]);

    logs = (logData ?? []) as OrderLog[];

    // Merge into timeline entries for rendering
    const entries: any[] = [];
    for (const log of (logData ?? [])) {
      entries.push({ ...log, entryType: 'log' });
    }
    for (const msg of (msgData ?? [])) {
      entries.push({ ...msg, entryType: msg.sender_type === 'customer' ? 'customer_msg' : 'admin_msg' });
    }
    entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    timelineEntries = entries;

    // Mark chat actions as seen/resolved
    if (!loading && msgData && msgData.length > 0) {
      markChatActionsResolved(orderId, msgData);
    }
  }

  function openStatusModal(newStatus: string) {
    if (newStatus === 'cancelled') {
      showCancelModal = true;
      return;
    }
    targetStatus = newStatus;
    showStatusModal = true;
    
    // Auto-select first template if available
    const templates = STATUS_TEMPLATES[newStatus] || [];
    statusComment = templates.length > 0 ? templates[0] : '';
  }

  async function submitStatusUpdate() {
    if (updating || !targetStatus) return;
    updating = true;
    showStatusModal = false;

    // 1. Update order status
    const updateData: any = { status: targetStatus };
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id);

    if (error) {
      updating = false;
      uiStore.addToast('Update failed: ' + error.message, 'error');
      return;
    }

    // 2. Fetch the newly created log entry (inserted by trigger)
    const { data: recentLogs } = await supabase
      .from('order_logs')
      .select('id')
      .eq('order_id', order.id)
      .eq('status', targetStatus)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      const logId = recentLogs[0].id;
      const customNote = statusComment.trim() 
        ? `Status changed from ${STATUS_LABEL[order.status]} to ${STATUS_LABEL[targetStatus]}. Comments: ${statusComment.trim()}`
        : `Status changed from ${STATUS_LABEL[order.status]} to ${STATUS_LABEL[targetStatus]}`;
        
      await supabase
        .from('order_logs')
        .update({ note: customNote })
        .eq('id', logId);
    }

    // 3. Send email to customer if requested
    if (notifyCustomer && order.profile?.email) {
      fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'status_update',
          recipientEmail: order.profile.email,
          recipientName: order.profile.full_name || 'Customer',
          payloadData: {
            orderNumber: order.order_number,
            newStatusLabel: STATUS_LABEL[targetStatus],
            comment: statusComment
          }
        })
      }).catch(err => console.warn('Customer notification email failed:', err));
    }

    updating = false;
    await loadOrder();
    uiStore.addToast(`Order status updated to ${STATUS_LABEL[targetStatus]}`, 'success');
  }

  async function confirmCancel() {
    if (!cancelReason.trim()) { uiStore.addToast('Please enter a cancellation reason', 'error'); return; }
    updating = true;
    showCancelModal = false;
    const currentCancelReason = cancelReason;

    // 1. Restock items
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

    // 2. Update order status
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', cancellation_reason: cancelReason })
      .eq('id', order.id);
    updating = false;
    if (error) { uiStore.addToast('Cancel failed: ' + error.message, 'error'); return; }

    // Notify admin
    fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'Cancellation',
        details: {
          orderNumber: order.order_number,
          cancelledBy: `Admin (${authStore.profile?.full_name || authStore.user?.email || 'Admin'})`,
          reason: currentCancelReason
        }
      })
    }).catch(err => console.warn('Admin order cancellation notification failed:', err));

    await loadOrder();
    cancelReason = '';
    uiStore.addToast('Order cancelled', 'success');
  }

  async function approveCancellation() {
    if (updating) return;
    updating = true;
    showApproveCancelModal = false;

    // 1. Restock items
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

    // 2. Find matching cancellation admin action before resolving
    const { data: matchingActions } = await supabase
      .from('admin_actions')
      .select('id')
      .eq('order_id', order.id)
      .eq('type', 'cancellation')
      .eq('status', 'pending')
      .limit(1);
    const adminActionId = matchingActions && matchingActions.length > 0 ? matchingActions[0].id : null;

    // 3. Write to manual_action_log
    if (adminActionId) {
      await supabase
        .from('manual_action_log')
        .insert({
          admin_action_id: adminActionId,
          admin_id: authStore.user!.id,
          action_type: 'cancellation_approval',
          input_data: {
            order_id: order.id,
            order_number: order.order_number,
            comment: cancelActionComment || 'Approved by support.',
            restocked_items: order.items?.map((it: any) => ({
              variant_id: it.variant_id,
              sku: it.product_sku,
              quantity: it.quantity
            })) ?? []
          }
        });
    }

    // 4. Update order
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled', 
        cancellation_status: 'approved',
        cancellation_reason: cancelActionComment || order.cancellation_reason
      })
      .eq('id', order.id);

    if (error) {
      updating = false;
      uiStore.addToast('Failed to approve cancellation: ' + error.message, 'error');
      return;
    }

    // 5. Fetch/update log note
    const { data: recentLogs } = await supabase
      .from('order_logs')
      .select('id')
      .eq('order_id', order.id)
      .eq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      await supabase
        .from('order_logs')
        .update({ 
          note: `Cancellation approved. Comments: ${cancelActionComment || 'Approved by support.'}` 
        })
        .eq('id', recentLogs[0].id);
    }

    // 6. Resolve matching admin_actions
    await supabase
      .from('admin_actions')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('order_id', order.id)
      .eq('type', 'cancellation')
      .eq('status', 'pending');

    // 7. Email customer
    if (order.profile?.email) {
      fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cancellation_response',
          recipientEmail: order.profile.email,
          recipientName: order.profile.full_name || 'Customer',
          payloadData: {
            orderNumber: order.order_number,
            approved: true,
            comment: cancelActionComment || 'Your order was successfully cancelled.'
          }
        })
      }).catch(err => console.warn('Cancellation approval email failed:', err));
    }

    updating = false;
    cancelActionComment = '';
    await loadOrder();
    uiStore.addToast('Cancellation request approved', 'success');
  }

  async function rejectCancellation() {
    if (updating) return;
    updating = true;
    showRejectCancelModal = false;

    // 1. Update order cancellation_status to rejected
    const { error } = await supabase
      .from('orders')
      .update({ cancellation_status: 'rejected' })
      .eq('id', order.id);

    if (error) {
      updating = false;
      uiStore.addToast('Failed to reject cancellation: ' + error.message, 'error');
      return;
    }

    // 2. Insert custom log for rejection
    await supabase
      .from('order_logs')
      .insert({
        order_id: order.id,
        status: order.status,
        note: `Cancellation request rejected. Comments: ${cancelActionComment || 'Your order is being processed.'}`,
        created_by: authStore.user!.id
      });

    // 3. Resolve matching admin_actions
    await supabase
      .from('admin_actions')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('order_id', order.id)
      .eq('type', 'cancellation')
      .eq('status', 'pending');

    // 4. Email customer
    if (order.profile?.email) {
      fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cancellation_response',
          recipientEmail: order.profile.email,
          recipientName: order.profile.full_name || 'Customer',
          payloadData: {
            orderNumber: order.order_number,
            approved: false,
            comment: cancelActionComment || 'We are unable to cancel this order as it has entered dispatch processing.'
          }
        })
      }).catch(err => console.warn('Cancellation rejection email failed:', err));
    }

    updating = false;
    cancelActionComment = '';
    await loadOrder();
    uiStore.addToast('Cancellation request rejected', 'success');
  }

  async function saveAdminNote() {
    savingNote = true;
    await supabase.from('orders').update({ admin_notes: adminNote }).eq('id', order.id);
    savingNote = false;
    uiStore.addToast('Note saved', 'success');
  }

  async function sendAdminMessage() {
    if (!adminMessage.trim() || !order) return;
    sendingMessage = true;
    const msg = adminMessage.trim();

    // Insert into order_messages (new chat table)
    const { error } = await supabase
      .from('order_messages')
      .insert({
        order_id: order.id,
        sender_type: 'admin',
        message: msg,
      });

    if (error) {
      sendingMessage = false;
      uiStore.addToast('Failed to send message: ' + error.message, 'error');
      return;
    }

    adminMessage = '';
    sendingMessage = false;

    // Send email to customer
    if (order.profile?.email) {
      fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_message',
          recipientEmail: order.profile.email,
          recipientName: order.profile.full_name || 'Customer',
          payloadData: {
            orderNumber: order.order_number,
            senderName: 'French Toes Support',
            messageText: msg
          }
        })
      }).catch(err => console.warn('Notification email failed:', err));
    }

    await loadOrder();
    uiStore.addToast('Message sent to customer', 'success');
  }

  function fmt(paise: number) {
    return '₹' + ((paise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
</script>

<svelte:head><title>Order Detail — Admin French Toes</title></svelte:head>

<!-- Cancel Modal -->
{#if showCancelModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div class="rounded-2xl p-6 w-full max-w-md" style="background: #1e2030; border: 1px solid rgba(255,255,255,0.2);">
      <h2 class="font-bold text-white text-lg mb-4">Cancel Order?</h2>
      <p class="text-gray-400 text-sm mb-3">Please provide a reason for cancellation:</p>
      <textarea
        bind:value={cancelReason}
        rows="3"
        class="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);"
        placeholder="e.g. Stock unavailable or customer request"
      ></textarea>
      <div class="flex gap-3 mt-4">
        <button onclick={() => showCancelModal = false} class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 bg-white/5">Keep Order</button>
        <button onclick={confirmCancel} class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500">Confirm Cancel</button>
      </div>
    </div>
  </div>
{/if}

<!-- Status Comments & Templates Modal -->
{#if showStatusModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div class="rounded-2xl p-6 w-full max-w-lg" style="background: #1e2030; border: 1px solid rgba(255,255,255,0.2);">
      <h2 class="font-bold text-white text-lg mb-2">Update Order Status to: {STATUS_LABEL[targetStatus]}</h2>
      <p class="text-gray-400 text-xs mb-4">Add comments or tracking details that will be visible to the customer on their timeline.</p>
      
      <!-- Quick templates -->
      {#if (STATUS_TEMPLATES[targetStatus] ?? []).length > 0}
        <div class="mb-4">
          <span class="text-xs font-semibold text-gray-400 block mb-2">Quick Templates:</span>
          <div class="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
            {#each (STATUS_TEMPLATES[targetStatus] ?? []) as temp}
              <button 
                onclick={() => statusComment = temp}
                class="text-left text-xs text-indigo-300 hover:bg-white/5 p-2 rounded-lg border border-white/5 transition-colors"
              >
                {temp}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="flex flex-col gap-1 mb-4">
        <label for="status-comment-input" class="text-xs font-semibold text-gray-400">Comments / Notes</label>
        <textarea
          id="status-comment-input"
          bind:value={statusComment}
          rows="3"
          class="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
          style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);"
          placeholder="Enter custom message..."
        ></textarea>
      </div>

      <div class="flex items-center gap-2 mb-5">
        <input 
          type="checkbox" 
          id="notify-customer-check" 
          bind:checked={notifyCustomer}
          class="accent-indigo-500 h-4 w-4"
        />
        <label for="notify-customer-check" class="text-xs text-gray-300 select-none">Send status update email to customer</label>
      </div>

      <div class="flex gap-3">
        <button onclick={() => showStatusModal = false} class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 bg-white/5">Cancel</button>
        <button onclick={submitStatusUpdate} disabled={updating} class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
          Confirm Update
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Approve Cancel Request Modal -->
{#if showApproveCancelModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div class="rounded-2xl p-6 w-full max-w-md" style="background: #1e2030; border: 1px solid rgba(255,255,255,0.2);">
      <h2 class="font-bold text-white text-lg mb-2">Approve Order Cancellation?</h2>
      <p class="text-gray-400 text-xs mb-4">This will cancel the order and send a confirmation email. Stock will be restored automatically.</p>

      <div class="flex flex-col gap-1 mb-5">
        <label for="cancel-approve-comment" class="text-xs font-semibold text-gray-400">Cancellation Note to Customer (optional)</label>
        <textarea
          id="cancel-approve-comment"
          bind:value={cancelActionComment}
          rows="3"
          class="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
          style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);"
          placeholder="e.g. Refund processed to original payment method."
        ></textarea>
      </div>

      <div class="flex gap-3">
        <button onclick={() => showApproveCancelModal = false} class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 bg-white/5">Keep Active</button>
        <button onclick={approveCancellation} disabled={updating} class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500">
          Confirm Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Reject Cancel Request Modal -->
{#if showRejectCancelModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div class="rounded-2xl p-6 w-full max-w-md" style="background: #1e2030; border: 1px solid rgba(255,255,255,0.2);">
      <h2 class="font-bold text-white text-lg mb-2">Reject Order Cancellation Request?</h2>
      <p class="text-gray-400 text-xs mb-4">This will resume the order. Customer will be notified via email.</p>

      <div class="flex flex-col gap-1 mb-5">
        <label for="cancel-reject-comment" class="text-xs font-semibold text-gray-400">Reason for Rejection * (visible to customer)</label>
        <textarea
          id="cancel-reject-comment"
          bind:value={cancelActionComment}
          rows="3"
          class="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
          style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);"
          placeholder="e.g. Order has already been shipped. It cannot be cancelled now."
        ></textarea>
      </div>

      <div class="flex gap-3">
        <button onclick={() => showRejectCancelModal = false} class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 bg-white/5">Cancel</button>
        <button onclick={rejectCancellation} disabled={updating || !cancelActionComment.trim()} class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">
          Reject Request
        </button>
      </div>
    </div>
  </div>
{/if}

{#if loading}
  <div class="flex justify-center py-16"><div class="w-8 h-8 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"></div></div>
{:else if !order}
  <div class="text-center py-16 text-gray-400">
    <p class="mb-4">Order not found</p>
    <a href="/admin/orders" class="text-indigo-400">← Back to Orders</a>
  </div>
{:else}
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-start justify-between flex-wrap gap-3">
      <div>
        <a href="/admin/orders" class="text-gray-400 text-sm mb-1 block hover:text-gray-300">← Orders</a>
        <h1 class="text-2xl font-bold text-white">{order.order_number}</h1>
        <p class="text-gray-400 text-sm">{formatDateTime(order.created_at)}</p>
      </div>
      <span class="px-4 py-2 rounded-full text-sm font-semibold text-white" style="background: {STATUS_COLOR[order.status] ?? '#6b7280'};">
        {STATUS_LABEL[order.status] ?? order.status}
      </span>
    </div>

    <!-- Cancellation Request Management Panel -->
    {#if order.cancellation_status === 'pending'}
      <div class="rounded-2xl p-5 border flex flex-col md:flex-row md:items-center justify-between gap-4" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: white;">
        <div>
          <span class="px-2 py-0.5 rounded bg-red-500 text-[10px] font-bold tracking-wider uppercase text-white mb-2 inline-block">Action Required</span>
          <h2 class="text-lg font-bold text-red-200">Customer Requested Cancellation 💔</h2>
          <p class="text-xs text-gray-300 mt-1">Reason: <span class="font-semibold italic text-white">"{order.cancellation_reason || 'No reason provided'}"</span></p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <button 
            onclick={() => { showRejectCancelModal = true; cancelActionComment = ''; }} 
            disabled={updating}
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-xs font-semibold rounded-xl transition-colors border border-gray-600"
          >
            Reject Request
          </button>
          <button 
            onclick={() => { showApproveCancelModal = true; cancelActionComment = ''; }} 
            disabled={updating}
            class="px-4 py-2 bg-red-600 hover:bg-red-500 text-xs font-semibold rounded-xl transition-colors text-white"
          >
            Approve & Cancel Order
          </button>
        </div>
      </div>
    {/if}

    <!-- Status update buttons -->
    {#if (STATUS_FLOW[order.status] ?? []).length > 0}
      <div class="rounded-xl p-4 flex flex-wrap gap-3" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
        <span class="text-gray-400 text-sm self-center">Update Status:</span>
        {#each (STATUS_FLOW[order.status] ?? []) as step}
          <button
            onclick={() => openStatusModal(step.next)}
            disabled={updating}
            class="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style="background: {step.next === 'cancelled' ? '#ef4444' : '#4f46e5'};"
          >
            {step.label}
          </button>
        {/each}
      </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: Items + Logs -->
      <div class="lg:col-span-2 flex flex-col gap-4">

        <!-- Order items -->
        <div class="rounded-xl overflow-hidden" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
          <div class="px-5 py-3 border-b" style="border-color: rgba(255,255,255,0.1);">
            <h2 class="font-semibold text-white text-sm">Order Items</h2>
          </div>
          {#each order.items ?? [] as item (item.id)}
            <div class="flex items-center gap-4 p-4 border-b last:border-b-0" style="border-color: rgba(255,255,255,0.05);">
              {#if item.product_image_url}
                <div class="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-700">
                  <img src={item.product_image_url} alt={item.product_name} class="w-full h-full object-cover" loading="lazy" />
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm text-white truncate">{item.product_name}</p>
                {#if item.variant_info}
                  <p class="text-xs text-gray-400 mt-0.5">
                    {#if item.variant_info.color}Color: {item.variant_info.color}{/if}
                    {#if item.variant_info.size} · Size: {item.variant_info.size}{/if}
                  </p>
                {/if}
                <p class="text-xs text-gray-500">SKU: {item.product_sku ?? '—'} · Qty: {item.quantity}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="font-bold text-white text-sm">{fmt(item.total_price)}</p>
                <p class="text-xs text-gray-500">{fmt(item.unit_price)} each</p>
              </div>
            </div>
          {/each}
        </div>

        <!-- Order Timeline & Support Chat (merged timelineEntries) -->
        {#if timelineEntries.length > 0}
          <div class="rounded-xl p-5" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <h2 class="font-semibold text-white text-sm mb-4">Timeline & Chat Logs</h2>
            <div class="relative pl-6 space-y-4">
              <div class="absolute left-2 top-0 bottom-0 w-px bg-gray-700"></div>
              {#each timelineEntries as entry (entry.id)}
                {@const isCustomerMsg = entry.entryType === 'customer_msg'}
                {@const isAdminMsg = entry.entryType === 'admin_msg'}
                <div class="relative">
                  <div 
                    class="absolute -left-4 w-4 h-4 rounded-full border-2 bg-gray-800 flex items-center justify-center text-[8px]" 
                    style="border-color: {isCustomerMsg ? '#f59e0b' : isAdminMsg ? '#ec4899' : STATUS_COLOR[entry.status] ?? '#6b7280'};"
                  >
                    {isCustomerMsg ? '👤' : isAdminMsg ? '💬' : '✓'}
                  </div>
                  
                  {#if isCustomerMsg}
                    <div class="ml-2 rounded-xl p-3 max-w-lg" style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2);">
                      <p class="text-xs font-bold text-amber-400">Customer Message</p>
                      <p class="text-sm mt-0.5 text-white">{entry.message}</p>
                      <p class="text-[10px] text-gray-500 mt-1">{formatDateTime(entry.created_at)}</p>
                    </div>
                  {:else if isAdminMsg}
                    <div class="ml-2 rounded-xl p-3 max-w-lg" style="background-color: rgba(236, 72, 153, 0.1); border: 1px solid rgba(236, 72, 153, 0.2);">
                      <p class="text-xs font-bold text-pink-400">Support Representative (You)</p>
                      <p class="text-sm mt-0.5 text-white">{entry.message}</p>
                      <p class="text-[10px] text-gray-500 mt-1">{formatDateTime(entry.created_at)}</p>
                    </div>
                  {:else}
                    <!-- Legacy log entries -->
                    <div class="ml-2">
                      <p class="font-semibold text-sm text-white">{STATUS_LABEL[entry.status] ?? entry.status}</p>
                      {#if entry.note}<p class="text-xs text-gray-400 mt-0.5">{entry.note}</p>{/if}
                      <p class="text-xs text-gray-600 mt-0.5">{formatDateTime(entry.created_at)}</p>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Send Message to Customer Box -->
            <div class="mt-5 pt-4 border-t" style="border-color: rgba(255,255,255,0.1);">
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Send Message to Customer</h3>
              <div class="flex gap-2">
                <input 
                  type="text" 
                  bind:value={adminMessage} 
                  placeholder="Type a message to the customer..." 
                  class="flex-1 px-4 py-2 rounded-xl text-sm border bg-white/5 outline-none focus:border-indigo-500 border-white/10 text-white"
                  onkeydown={(e) => e.key === 'Enter' && sendAdminMessage()}
                  disabled={sendingMessage}
                />
                <button 
                  onclick={sendAdminMessage} 
                  disabled={sendingMessage || !adminMessage.trim()}
                  class="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {sendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>
        {:else if logs.length > 0}
          <!-- Fallback: legacy display for backward compat -->
          <div class="rounded-xl p-5" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <h2 class="font-semibold text-white text-sm mb-4">Timeline & Chat Logs</h2>
            <div class="relative pl-6 space-y-4">
              <div class="absolute left-2 top-0 bottom-0 w-px bg-gray-700"></div>
              {#each logs as log (log.id)}
                <div class="relative">
                  <div 
                    class="absolute -left-4 w-4 h-4 rounded-full border-2 bg-gray-800 flex items-center justify-center text-[8px]" 
                    style="border-color: {STATUS_COLOR[log.status] ?? '#6b7280'};"
                  >
                    ✓
                  </div>
                  <div class="ml-2">
                    <p class="font-semibold text-sm text-white">{STATUS_LABEL[log.status] ?? log.status}</p>
                    {#if log.note}<p class="text-xs text-gray-400 mt-0.5">{log.note}</p>{/if}
                    <p class="text-xs text-gray-600 mt-0.5">{formatDateTime(log.created_at)}</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Admin notes -->
        <div class="rounded-xl p-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
          <h2 class="font-semibold text-white text-sm mb-3">Admin Notes (Internal)</h2>
          <textarea
            bind:value={adminNote}
            rows="3"
            class="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none mb-2"
            style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);"
            placeholder="Internal notes for this order..."
          ></textarea>
          <button onclick={saveAdminNote} disabled={savingNote} class="px-4 py-2 rounded-xl text-xs font-semibold text-white" style="background: rgba(255,255,255,0.2);">
            {savingNote ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>

      <!-- Right: Customer + Address + Pricing -->
      <div class="flex flex-col gap-4">
        <!-- Customer info -->
        <div class="rounded-xl p-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
          <h2 class="font-semibold text-white text-sm mb-3">Customer</h2>
          <p class="text-gray-200 text-sm">{order.profile?.full_name ?? '—'}</p>
          <p class="text-gray-400 text-xs mt-0.5">{order.profile?.email ?? '—'}</p>
          <p class="text-gray-400 text-xs mt-0.5">📞 {order.profile?.phone ?? '—'}</p>
        </div>

        <!-- Shipping address -->
        {#if order.shipping_address}
          {@const addr = order.shipping_address}
          <div class="rounded-xl p-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <h2 class="font-semibold text-white text-sm mb-3">Shipping Address</h2>
            <p class="text-gray-200 text-sm">{addr.full_name}</p>
            <p class="text-gray-400 text-xs mt-0.5">{addr.address_line1}{addr.address_line2 ? ', ' + addr.address_line2 : ''}</p>
            <p class="text-gray-400 text-xs">{addr.city}, {addr.state} – {addr.pincode}</p>
            <p class="text-gray-500 text-xs mt-0.5">📞 {addr.phone}</p>
          </div>
        {/if}

        <!-- Pricing -->
        <div class="rounded-xl p-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
          <h2 class="font-semibold text-white text-sm mb-3">Price Details</h2>
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between text-gray-400"><span>Subtotal</span><span class="text-gray-200">{fmt(order.subtotal)}</span></div>
            {#if order.discount_amount > 0}
              <div class="flex justify-between text-green-400"><span>Discount</span><span>−{fmt(order.discount_amount)}</span></div>
            {/if}
            <div class="flex justify-between text-gray-400"><span>Shipping</span><span class="text-gray-200">{order.shipping_charges === 0 ? 'FREE' : fmt(order.shipping_charges)}</span></div>
            <div class="flex justify-between text-gray-400"><span>COD</span><span class="text-gray-200">{fmt(order.cod_charges)}</span></div>
            <div class="flex justify-between text-gray-400"><span>GST</span><span class="text-gray-200">{fmt(order.gst_amount)}</span></div>
            <div class="border-t pt-1.5 flex justify-between font-bold" style="border-color: rgba(255,255,255,0.1);">
              <span class="text-white">Total</span>
              <span class="text-white">{fmt(order.total_amount)}</span>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t text-xs text-gray-500" style="border-color: rgba(255,255,255,0.1);">
            Payment: <span class="text-gray-300">Cash on Delivery</span>
          </div>
        </div>

        <!-- Customer notes -->
        {#if order.customer_notes}
          <div class="rounded-xl p-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <h2 class="font-semibold text-white text-sm mb-2">Customer Notes</h2>
            <p class="text-gray-400 text-xs">{order.customer_notes}</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}