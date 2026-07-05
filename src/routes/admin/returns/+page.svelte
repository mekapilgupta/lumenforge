<script lang="ts">
  import { onMount } from "svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import { uiStore } from "$lib/stores/ui.svelte";
  import { supabase } from "$lib/supabaseClient";
  import { formatDate } from "$lib/utils/helpers";

  let returns = $state<any[]>([]);
  let loading = $state(true);
  let activeStatus = $state("requested"); // default to requested (pending review) to highlight action items
  let search = $state("");

  let selectedReturn = $state<any>(null);
  let selectedOrder = $state<any>(null);
  let shippingAddress = $state<any>(null);
  let loadingAddress = $state(false);
  let actionLoading = $state(false);

  const STATUS_FILTERS = [
    { id: "all", label: "All Requests" },
    { id: "requested", label: "Pending Review ⏳" },
    { id: "approved_transit", label: "Approved / In Transit 🚚" },
    { id: "completed_resolved", label: "Resolved / Closed ✅" },
    { id: "rejected", label: "Rejected ❌" }
  ];

  const RETURN_STATUS_COLOR: Record<string, string> = {
    requested: "#ec4899",
    approved: "#3b82f6",
    pickup_scheduled: "#06b6d4",
    picked_up: "#8b5cf6",
    received: "#8b5cf6",
    refunded: "#22c55e",
    exchange_shipped: "#22c55e",
    rejected: "#ef4444",
    completed: "#6b7280"
  };

  const RETURN_STATUS_LABEL: Record<string, string> = {
    requested: "Pending Review",
    approved: "Approved",
    pickup_scheduled: "Pickup Scheduled",
    picked_up: "Picked Up",
    received: "Received by Warehouse",
    refunded: "Refunded",
    exchange_shipped: "Replacement Shipped",
    rejected: "Rejected",
    completed: "Completed"
  };

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await loadReturns();
    loading = false;
  });

  async function loadReturns() {
    const { data, error } = await supabase
      .from("order_returns")
      .select(
        "*, order:orders!order_id(id, order_number, total_amount, razorpay_payment_id, payment_status, status, shipping_address_id, profile:user_id(full_name, email, phone), items:order_items(*))"
      )
      .order("created_at", { ascending: false });

    if (error) {
      uiStore.addToast("Could not load returns: " + error.message, "error");
      return;
    }
    returns = data ?? [];
  }

  $effect(() => {
    activeStatus;
    if (typeof window !== "undefined" && !loading) {
      selectedReturn = null;
      selectedOrder = null;
      shippingAddress = null;
      loadReturns();
    }
  });

  const filteredReturns = $derived(
    returns.filter((r) => {
      // 1. Filter by tab status
      let matchesStatus = true;
      if (activeStatus === "requested") {
        matchesStatus = r.status === "requested";
      } else if (activeStatus === "approved_transit") {
        matchesStatus = ["approved", "pickup_scheduled", "picked_up", "received"].includes(r.status);
      } else if (activeStatus === "completed_resolved") {
        matchesStatus = ["refunded", "exchange_shipped", "completed"].includes(r.status);
      } else if (activeStatus === "rejected") {
        matchesStatus = r.status === "rejected";
      }

      if (!matchesStatus) return false;

      // 2. Filter by search query
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.order?.order_number?.toLowerCase().includes(q) ||
          r.order?.profile?.full_name?.toLowerCase().includes(q) ||
          r.order?.profile?.email?.toLowerCase().includes(q) ||
          r.reason_code?.toLowerCase().includes(q)
        );
      }

      return true;
    })
  );

  function fmt(paise: number) {
    return "₹" + ((paise ?? 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  async function openReturnDrawer(ret: any) {
    selectedReturn = ret;
    selectedOrder = ret.order ?? null;
    shippingAddress = null;

    if (selectedOrder?.shipping_address_id) {
      loadingAddress = true;
      const { data } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", selectedOrder.shipping_address_id)
        .single();
      shippingAddress = data ?? null;
      loadingAddress = false;
    }
  }

  function closeDrawer() {
    selectedReturn = null;
    selectedOrder = null;
    shippingAddress = null;
  }

  function getOriginalItem(order: any, orderItemId: string) {
    if (!order || !order.items) return null;
    return order.items.find((it: any) => it.id === orderItemId);
  }

  // --- ACTIONS ---

  async function approveReturn(ret: any) {
    if (!confirm(`Approve this ${ret.type} request and schedule a Shiprocket pickup?`)) return;
    actionLoading = true;
    const { error: updErr } = await supabase
      .from("order_returns")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", ret.id);
    if (updErr) {
      uiStore.addToast("Failed to approve: " + updErr.message, "error");
      actionLoading = false;
      return;
    }

    const { error: queueErr } = await supabase.from("automation_queue").insert({
      order_id: ret.order_id,
      action_type: "create_reverse_pickup",
      payload: { order_return_id: ret.id },
    });
    actionLoading = false;
    if (queueErr) {
      uiStore.addToast("Approved, but failed to queue reverse pickup: " + queueErr.message, "error");
      return;
    }
    uiStore.addToast("Request approved. Reverse pickup queued with Shiprocket.", "success");
    await loadReturns();
    if (selectedReturn?.id === ret.id) {
      selectedReturn = { ...selectedReturn, status: "approved" };
    }
  }

  async function rejectReturn(ret: any) {
    const note = prompt("Reason for rejecting this request (shown internally and to the customer):");
    if (note === null) return;
    actionLoading = true;
    const { error } = await supabase
      .from("order_returns")
      .update({
        status: "rejected",
        admin_notes: note,
        updated_at: new Date().toISOString()
      })
      .eq("id", ret.id);
    actionLoading = false;
    if (error) {
      uiStore.addToast("Failed to reject: " + error.message, "error");
      return;
    }
    uiStore.addToast("Request rejected.", "success");
    await loadReturns();
    closeDrawer();
  }

  async function processReturnRefund(ret: any) {
    const suggested = ((ret.requested_refund_amount ?? ret.order?.total_amount ?? 0) / 100).toFixed(0);
    const input = prompt(
      `Refund amount via Razorpay for prepaid Order ${ret.order?.order_number ?? ""} (in ₹, editable):`,
      suggested
    );
    if (input === null) return;
    const rupees = Number(input);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      uiStore.addToast("Enter a valid amount.", "error");
      return;
    }
    const paise = Math.round(rupees * 100);

    if (!ret.order?.razorpay_payment_id) {
      uiStore.addToast("This order has no Razorpay payment ID on file — cannot auto-refund.", "error");
      return;
    }

    actionLoading = true;
    await supabase
      .from("order_returns")
      .update({
        admin_refund_amount: paise,
        updated_at: new Date().toISOString()
      })
      .eq("id", ret.id);

    const { error } = await supabase.from("automation_queue").insert({
      order_id: ret.order_id,
      action_type: "process_refund",
      payload: {
        razorpay_payment_id: ret.order.razorpay_payment_id,
        amount: paise,
        order_return_id: ret.id,
      },
    });
    actionLoading = false;
    if (error) {
      uiStore.addToast("Failed to queue refund: " + error.message, "error");
      return;
    }
    uiStore.addToast(`Refund of ₹${rupees} queued via Razorpay.`, "success");
    await loadReturns();
    if (selectedReturn?.id === ret.id) {
      selectedReturn = { ...selectedReturn, admin_refund_amount: paise, status: "refunded" };
    }
  }

  async function markReturnManuallyRefunded(ret: any) {
    const note = prompt("Enter a manual reference or note for this refund (e.g. Bank Ref / UPI ID):");
    if (note === null) return;
    actionLoading = true;

    // Update return status to completed/refunded
    const { error: retErr } = await supabase
      .from("order_returns")
      .update({
        status: "refunded",
        admin_notes: note,
        admin_refund_amount: ret.requested_refund_amount ?? ret.order?.total_amount ?? 0,
        updated_at: new Date().toISOString()
      })
      .eq("id", ret.id);

    if (retErr) {
      uiStore.addToast("Failed to update return: " + retErr.message, "error");
      actionLoading = false;
      return;
    }

    // Update order status to returned and payment_status to refunded
    const amount = ret.requested_refund_amount ?? ret.order?.total_amount ?? 0;
    const { error: orderErr } = await supabase
      .from("orders")
      .update({
        status: "returned",
        payment_status: "refunded",
        refund_amount: amount,
        refund_completed_at: new Date().toISOString()
      })
      .eq("id", ret.order_id);

    if (orderErr) {
      console.warn("Return updated but order status update failed: " + orderErr.message);
    }

    // Insert log
    await supabase.from("order_logs").insert({
      order_id: ret.order_id,
      status: "returned",
      note: `System: Return marked manually refunded (COD/Manual). Ref: ${note}`
    });

    actionLoading = false;
    uiStore.addToast("Return marked as manually refunded successfully.", "success");
    await loadReturns();
    if (selectedReturn?.id === ret.id) {
      selectedReturn = { ...selectedReturn, status: "refunded", admin_notes: note, admin_refund_amount: amount };
    }
  }

  async function createReplacementOrder(ret: any) {
    if (!confirm(`Create a replacement order for ${ret.order?.order_number}? This clones the order details and triggers a replacement shipment.`)) return;
    actionLoading = true;

    const { data: original, error: origErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", ret.order_id)
      .single();

    if (origErr || !original) {
      uiStore.addToast("Could not load original order: " + (origErr?.message ?? "not found"), "error");
      actionLoading = false;
      return;
    }

    const clone: any = { ...original };
    delete clone.id;
    delete clone.created_at;
    delete clone.updated_at;
    clone.order_number = `${original.order_number}-EX`;
    clone.status = "confirmed";
    clone.payment_status = "paid"; // exchange items are prepaid
    clone.shiprocket_order_id = null;
    clone.shiprocket_status = null;
    clone.awb_code = null;
    clone.refund_amount = null;
    clone.refund_completed_at = null;
    clone.has_active_return = false;
    clone.delivered_at = null;
    clone.cancellation_status = null;
    clone.original_order_id = ret.order_id;

    const { data: newOrder, error: insertErr } = await supabase
      .from("orders")
      .insert(clone)
      .select()
      .single();

    if (insertErr || !newOrder) {
      uiStore.addToast("Failed to create replacement order: " + insertErr?.message, "error");
      actionLoading = false;
      return;
    }

    const originalItemIds = (ret.items ?? []).map((i: any) => i.order_item_id).filter(Boolean);
    if (originalItemIds.length > 0) {
      const { data: originalItems } = await supabase
        .from("order_items")
        .select("*")
        .in("id", originalItemIds);

      const newItems = (originalItems ?? []).map((it: any) => {
        const itemClone: any = { ...it };
        delete itemClone.id;
        itemClone.order_id = newOrder.id;
        const retItem = (ret.items ?? []).find((x: any) => x.order_item_id === it.id);
        if (retItem) itemClone.quantity = retItem.quantity;
        return itemClone;
      });

      if (newItems.length > 0) {
        await supabase.from("order_items").insert(newItems);
      }
    }

    await supabase
      .from("order_returns")
      .update({
        status: "exchange_shipped",
        replacement_order_id: newOrder.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", ret.id);

    const { error: queueErr } = await supabase.from("automation_queue").insert({
      order_id: newOrder.id,
      action_type: "create_exchange_shipment",
      payload: { replacement_order_id: newOrder.id },
    });

    actionLoading = false;
    if (queueErr) {
      uiStore.addToast("Replacement order created, but failed to queue replacement shipment: " + queueErr.message, "error");
      return;
    }
    uiStore.addToast(`Replacement order ${clone.order_number} created and queued.`, "success");
    await loadReturns();
    if (selectedReturn?.id === ret.id) {
      selectedReturn = { ...selectedReturn, status: "exchange_shipped", replacement_order_id: newOrder.id };
    }
  }
</script>

<svelte:head><title>Returns & Exchanges — Admin French Toes</title></svelte:head>

<div class="flex flex-col gap-6 relative">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <h1 class="text-2xl font-bold text-white">Returns & Exchanges</h1>
    <div class="relative">
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
      ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
      <input
        bind:value={search}
        type="search"
        placeholder="Search requests..."
        class="pl-9 pr-4 py-2 rounded-xl text-sm outline-none text-white placeholder-gray-500 w-64 focus:ring-1 focus:ring-indigo-500 font-sans"
        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);"
      />
    </div>
  </div>

  <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
    {#each STATUS_FILTERS as f}
      <button
        onclick={() => (activeStatus = f.id)}
        class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
        style="background: {activeStatus === f.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}; color: {activeStatus === f.id ? 'white' : 'rgba(255,255,255,0.6)'};"
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="flex justify-center py-16">
      <div class="w-8 h-8 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"></div>
    </div>
  {:else if filteredReturns.length === 0}
    <div class="text-center py-16 rounded-xl" style="background: rgba(255,255,255,0.05);">
      <p class="text-gray-400 text-sm">No return or exchange requests found</p>
    </div>
  {:else}
    <div class="rounded-xl overflow-hidden shadow-lg border" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);">
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left text-gray-300">
          <thead>
            <tr class="text-left select-none text-gray-400 border-b border-white/10" style="background: rgba(255,255,255,0.02);">
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Order #</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Customer</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Type</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Reason</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Requested</th>
              <th class="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each filteredReturns as ret (ret.id)}
              <tr
                class="hover:bg-white/5 transition-colors cursor-pointer select-none"
                onclick={() => openReturnDrawer(ret)}
              >
                <td class="px-5 py-4 font-mono text-xs text-indigo-400 font-semibold">
                  {ret.order?.order_number ?? "—"}
                </td>
                <td class="px-5 py-4">
                  <p class="text-gray-200 text-xs font-medium">{ret.order?.profile?.full_name ?? "—"}</p>
                  <p class="text-gray-500 text-[10px]">{ret.order?.profile?.email ?? "—"}</p>
                </td>
                <td class="px-5 py-4 text-xs">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider {ret.type === 'exchange' ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-800' : 'bg-pink-900/40 text-pink-300 border border-pink-800'}">
                    {ret.type}
                  </span>
                </td>
                <td class="px-5 py-4 text-xs max-w-xs truncate">{ret.reason_code}</td>
                <td class="px-5 py-4 text-xs text-gray-400">{formatDate(ret.created_at)}</td>
                <td class="px-5 py-4">
                  <span
                    class="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm inline-block"
                    style="background: {RETURN_STATUS_COLOR[ret.status] ?? '#6b7280'};"
                  >
                    {RETURN_STATUS_LABEL[ret.status] ?? ret.status}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- Sliding Detail Drawer -->
{#if selectedReturn}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
    onclick={closeDrawer}
    role="button"
    tabindex="0"
    aria-label="Close details"
  ></div>

  <div
    class="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#141523] border-l border-white/10 p-6 overflow-y-auto shadow-2xl z-50 transition-all flex flex-col gap-6"
    style="animation: slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;"
  >
    <div class="flex items-center justify-between border-b border-white/10 pb-4">
      <div>
        <span class="text-[10px] font-bold tracking-wider text-pink-400 uppercase font-mono">
          Return/Exchange Request
        </span>
        <h2 class="text-xl font-bold text-white mt-0.5">
          Order {selectedOrder?.order_number ?? "—"}
        </h2>
        <p class="text-xs text-gray-400 mt-0.5">
          Filed on {formatDate(selectedReturn.created_at)}
        </p>
      </div>
      <button
        onclick={closeDrawer}
        class="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        aria-label="Close drawer"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Overview Status Card -->
    <div class="flex justify-between items-center bg-white/5 rounded-xl p-4 border border-white/10">
      <div>
        <p class="text-[10px] text-gray-400 uppercase tracking-wider">Request Status</p>
        <span
          class="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm inline-block mt-1"
          style="background: {RETURN_STATUS_COLOR[selectedReturn.status] ?? '#6b7280'};"
        >
          {RETURN_STATUS_LABEL[selectedReturn.status] ?? selectedReturn.status}
        </span>
      </div>
      <div class="text-right">
        <p class="text-[10px] text-gray-400 uppercase tracking-wider">Refund Value (Suggested)</p>
        <p class="text-base font-bold text-white mt-0.5">
          {fmt(selectedReturn.requested_refund_amount)}
        </p>
      </div>
    </div>

    <!-- Items Requested list -->
    <div class="rounded-xl border border-white/10 overflow-hidden bg-white/5">
      <div class="px-4 py-2.5 border-b border-white/10 bg-white/5 text-xs font-semibold text-gray-300">
        Requested Items
      </div>
      <div class="p-3 divide-y divide-white/5">
        {#each selectedReturn.items as item}
          {@const orig = getOriginalItem(selectedOrder, item.order_item_id)}
          <div class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            {#if orig?.product_image_url}
              <div class="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-white/5">
                <img src={orig.product_image_url} alt={orig.product_name} class="w-full h-full object-cover" />
              </div>
            {/if}
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-white truncate">{item.product_name}</p>
              <p class="text-[10px] text-gray-400 mt-0.5">
                Qty: {item.quantity} · Price: {fmt(item.unit_price)}
                {#if orig?.variant_info}
                  {#if orig.variant_info.size} · Size: {orig.variant_info.size}{/if}
                  {#if orig.variant_info.color} · Color: {orig.variant_info.color}{/if}
                {/if}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-xs font-bold text-white">{fmt(item.unit_price * item.quantity)}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Action Center -->
    <div class="rounded-xl p-4 border border-white/10 space-y-3 bg-white/5">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Action Center
      </h3>
      <p class="text-xs text-gray-300">
        Reason: <span class="text-white font-medium">{selectedReturn.reason_code}</span>
      </p>
      {#if selectedReturn.customer_note}
        <p class="text-xs text-gray-400 bg-black/20 p-2.5 rounded-lg border border-white/5">
          <span class="text-[10px] text-gray-500 block font-semibold mb-0.5">CUSTOMER NOTE</span>
          "{selectedReturn.customer_note}"
        </p>
      {/if}

      {#if selectedReturn.admin_notes}
        <p class="text-xs text-gray-400 bg-pink-900/10 p-2.5 rounded-lg border border-pink-900/20">
          <span class="text-[10px] text-pink-400 block font-semibold mb-0.5">ADMIN RESOLUTION NOTE</span>
          "{selectedReturn.admin_notes}"
        </p>
      {/if}

      {#if selectedReturn.admin_refund_amount}
        <p class="text-xs text-gray-300">
          Refunded Amount: <span class="text-green-400 font-semibold">{fmt(selectedReturn.admin_refund_amount)}</span>
        </p>
      {/if}

      {#if selectedReturn.replacement_order_id}
        <p class="text-xs text-gray-300">
          Linked Replacement: <a href="/admin/orders" class="text-indigo-400 hover:underline">View Replacement order</a>
        </p>
      {/if}

      <!-- Operations -->
      <div class="flex flex-wrap gap-2 pt-1.5 border-t border-white/5">
        {#if selectedReturn.status === "requested"}
          <button
            onclick={() => approveReturn(selectedReturn)}
            disabled={actionLoading}
            class="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            Approve & Schedule Pickup
          </button>
          <button
            onclick={() => rejectReturn(selectedReturn)}
            disabled={actionLoading}
            class="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 cursor-pointer"
          >
            Reject Request
          </button>
        {/if}

        {#if ["approved", "pickup_scheduled", "picked_up", "received"].includes(selectedReturn.status)}
          {#if selectedReturn.type === "refund"}
            {#if selectedOrder?.razorpay_payment_id}
              <button
                onclick={() => processReturnRefund(selectedReturn)}
                disabled={actionLoading}
                class="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
              >
                Process Refund (Razorpay)
              </button>
            {/if}
            <button
              onclick={() => markReturnManuallyRefunded(selectedReturn)}
              disabled={actionLoading}
              class="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 cursor-pointer"
            >
              Mark Refunded (COD / Manual)
            </button>
          {/if}

          {#if selectedReturn.type === "exchange"}
            <button
              onclick={() => createReplacementOrder(selectedReturn)}
              disabled={actionLoading}
              class="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              Create Replacement Order
            </button>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Customer info -->
    <div class="rounded-xl p-4 bg-white/5 border border-white/10 space-y-2">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Customer Details
      </h3>
      <p class="text-sm font-medium text-white">
        {selectedOrder?.profile?.full_name ?? "—"}
      </p>
      <div class="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-1">
        <div>
          <span class="text-[9px] uppercase text-gray-500 block">Email</span>
          <span class="text-gray-300">{selectedOrder?.profile?.email ?? "—"}</span>
        </div>
        <div>
          <span class="text-[9px] uppercase text-gray-500 block">Phone</span>
          <span class="text-gray-300">{selectedOrder?.profile?.phone ?? "—"}</span>
        </div>
      </div>
    </div>

    <!-- Shipping source details -->
    <div class="rounded-xl p-4 bg-white/5 border border-white/10">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Pickup Address
      </h3>
      {#if loadingAddress}
        <div class="animate-pulse space-y-2">
          <div class="h-4 bg-white/10 rounded w-3/4"></div>
          <div class="h-3 bg-white/10 rounded w-1/2"></div>
        </div>
      {:else if shippingAddress}
        <p class="text-sm font-medium text-white">{shippingAddress.full_name}</p>
        <p class="text-xs text-gray-300 mt-1">{shippingAddress.address_line1}{shippingAddress.address_line2 ? ', ' + shippingAddress.address_line2 : ''}</p>
        <p class="text-xs text-gray-300">{shippingAddress.city}, {shippingAddress.state} – {shippingAddress.pincode}</p>
        <p class="text-xs text-gray-400 mt-1">📞 {shippingAddress.phone}</p>
      {:else}
        <p class="text-xs text-gray-500">Address could not be fetched</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes slide-in {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
</style>
