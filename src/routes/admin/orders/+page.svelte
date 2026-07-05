<script lang="ts">
  import { onMount } from "svelte";
  import { authStore } from "$lib/stores/auth.svelte";
  import { uiStore } from "$lib/stores/ui.svelte";
  import { supabase } from "$lib/supabaseClient";
  import { formatDate } from "$lib/utils/helpers";

  let orders = $state<any[]>([]);
  let returns = $state<any[]>([]);
  let loading = $state(true);
  let activeStatus = $state("all");
  let search = $state("");

  let selectedOrder = $state<any>(null);
  let selectedReturn = $state<any>(null);
  let shippingAddress = $state<any>(null);
  let loadingAddress = $state(false);
  let actionLoading = $state(false);

  const STATUS_FILTERS = [
    { id: "all", label: "All" },
    { id: "cancellation_pending", label: "Cancellation Requests 💔" },
    { id: "returns_exchanges", label: "Returns & Exchanges ↩️" },
    { id: "pending", label: "Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "processing", label: "Processing" },
    { id: "packed", label: "Packed" },
    { id: "shipped", label: "Shipped" },
    { id: "out_for_delivery", label: "Out for Delivery" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
    { id: "refund_requested", label: "Refund Requested" },
    { id: "refunded", label: "Refunded" },
    { id: "returned", label: "Returned" },
  ];

  const STATUS_COLOR: Record<string, string> = {
    pending: "#f59e0b",
    confirmed: "#3b82f6",
    processing: "#8b5cf6",
    packed: "#06b6d4",
    shipped: "#06b6d4",
    out_for_delivery: "#f97316",
    delivered: "#22c55e",
    cancelled: "#ef4444",
    refund_requested: "#ec4899",
    refunded: "#6b7280",
    returned: "#374151",
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    processing: "Processing",
    packed: "Packed",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refund_requested: "Refund Requested",
    refunded: "Refunded",
    returned: "Returned",
  };
  const PAYMENT_STATUS_COLOR: Record<string, string> = {
    paid: "bg-green-900/40 text-green-300 border-green-800",
    pending: "bg-yellow-900/40 text-yellow-300 border-yellow-800",
    refunded: "bg-gray-800 text-gray-400 border-gray-700",
    failed: "bg-red-900/40 text-red-300 border-red-800",
  };
  const RETURN_STATUS_COLOR: Record<string, string> = {
    requested: "#ec4899",
    approved: "#3b82f6",
    pickup_scheduled: "#06b6d4",
    picked_up: "#06b6d4",
    received: "#8b5cf6",
    refunded: "#22c55e",
    exchange_shipped: "#22c55e",
    rejected: "#ef4444",
    completed: "#6b7280",
  };

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await loadOrders();
    loading = false;
  });

  async function loadOrders() {
    if (activeStatus === "returns_exchanges") {
      const { data, error } = await supabase
        .from("order_returns")
        .select(
          "*, order:orders!order_id(id, order_number, total_amount, razorpay_payment_id, payment_status, status, shipping_address_id, profile:user_id(full_name, email, phone))",
        )
        .order("created_at", { ascending: false });
      if (error) {
        uiStore.addToast("Could not load returns: " + error.message, "error");
        return;
      }
      returns = data ?? [];
      return;
    }

    let query = supabase
      .from("orders_complete")
      .select("*")
      .order("created_at", { ascending: false });
    if (activeStatus === "cancellation_pending")
      query = query.eq("cancellation_status", "pending");
    else if (activeStatus !== "all") query = query.eq("status", activeStatus);

    const { data } = await query;
    orders = data ?? [];
  }

  $effect(() => {
    activeStatus;
    if (typeof window !== "undefined" && !loading) {
      selectedOrder = null;
      selectedReturn = null;
      loadOrders();
    }
  });

  const filteredOrders = $derived(
    search
      ? orders.filter(
          (o) =>
            o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
            o.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
            o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
            o.customer_phone?.includes(search),
        )
      : orders,
  );

  const filteredReturns = $derived(
    search
      ? returns.filter(
          (r) =>
            r.order?.order_number
              ?.toLowerCase()
              .includes(search.toLowerCase()) ||
            r.order?.profile?.email
              ?.toLowerCase()
              .includes(search.toLowerCase()) ||
            r.order?.profile?.full_name
              ?.toLowerCase()
              .includes(search.toLowerCase()),
        )
      : returns,
  );

  function fmt(paise: number) {
    return (
      "₹" +
      ((paise ?? 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })
    );
  }

  async function openDrawer(order: any) {
    selectedOrder = order;
    selectedReturn = null;
    shippingAddress = null;
    if (order.shipping_address_id) {
      loadingAddress = true;
      const { data } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", order.shipping_address_id)
        .single();
      shippingAddress = data ?? null;
      loadingAddress = false;
    }
    if (order.has_active_return) {
      const { data } = await supabase
        .from("order_returns")
        .select("*")
        .eq("order_id", order.id)
        .not("status", "in", '("rejected","refunded","completed")')
        .maybeSingle();
      selectedReturn = data ?? null;
    }
  }

  function openReturnDrawer(ret: any) {
    selectedReturn = ret;
    selectedOrder = ret.order ?? null;
  }

  function closeDrawer() {
    selectedOrder = null;
    selectedReturn = null;
    shippingAddress = null;
  }

  async function cancelOrder(order: any) {
    if (
      !confirm(
        `Cancel Order ${order.order_number}? This will queue Razorpay refund and Shiprocket cancellation automatically.`,
      )
    )
      return;
    actionLoading = true;
    const updateData: any = { status: "cancelled" };
    if (order.cancellation_status === "pending")
      updateData.cancellation_status = "approved";
    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order.id);
    actionLoading = false;
    if (error) {
      uiStore.addToast("Cancellation failed: " + error.message, "error");
      return;
    }
    uiStore.addToast(
      "Order cancelled. Refund and shipment cancellation queued automatically.",
      "success",
    );
    await loadOrders();
    if (selectedOrder?.id === order.id)
      selectedOrder = orders.find((o) => o.id === order.id) || null;
  }

  // --- Returns & Exchanges actions ---

  async function approveReturn(ret: any) {
    if (
      !confirm(
        `Approve this ${ret.type} request and schedule a Shiprocket pickup?`,
      )
    )
      return;
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
      uiStore.addToast(
        "Approved, but failed to queue pickup: " + queueErr.message,
        "error",
      );
      return;
    }
    uiStore.addToast("Approved. Reverse pickup has been queued.", "success");
    await loadOrders();
    if (selectedReturn?.id === ret.id)
      selectedReturn = { ...ret, status: "approved" };
  }

  async function rejectReturn(ret: any) {
    const note = prompt(
      "Reason for rejecting this request (shown internally, and optionally to the customer):",
    );
    if (note === null) return;
    actionLoading = true;
    const { error } = await supabase
      .from("order_returns")
      .update({
        status: "rejected",
        admin_notes: note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ret.id);
    actionLoading = false;
    if (error) {
      uiStore.addToast("Failed to reject: " + error.message, "error");
      return;
    }
    uiStore.addToast("Request rejected.", "success");
    await loadOrders();
    closeDrawer();
  }

  async function processReturnRefund(ret: any) {
    const suggested = (
      (ret.requested_refund_amount ?? ret.order?.total_amount ?? 0) / 100
    ).toFixed(0);
    const input = prompt(
      `Refund amount for ${ret.order?.order_number ?? ""} (in ₹, editable):`,
      suggested,
    );
    if (input === null) return;
    const rupees = Number(input);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      uiStore.addToast("Enter a valid amount.", "error");
      return;
    }
    const paise = Math.round(rupees * 100);

    if (!ret.order?.razorpay_payment_id) {
      uiStore.addToast(
        "This order has no Razorpay payment ID on file — cannot auto-refund.",
        "error",
      );
      return;
    }

    actionLoading = true;
    await supabase
      .from("order_returns")
      .update({
        admin_refund_amount: paise,
        updated_at: new Date().toISOString(),
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
    uiStore.addToast(`Refund of ₹${rupees} queued.`, "success");
    await loadOrders();
  }

  // Clones the ENTIRE original order row (so we never have to guess every
  // column name), then overrides only what must differ for the replacement.
  // Verify the overridden field names below match your actual orders schema
  // before first live use.
  async function createReplacementOrder(ret: any) {
    if (
      !confirm(
        `Create a replacement order for ${ret.order?.order_number}? This clones the order and its returned items, and queues a new shipment.`,
      )
    )
      return;
    actionLoading = true;

    const { data: original, error: origErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", ret.order_id)
      .single();
    if (origErr || !original) {
      uiStore.addToast(
        "Could not load original order: " + (origErr?.message ?? "not found"),
        "error",
      );
      actionLoading = false;
      return;
    }

    const clone: any = { ...original };
    delete clone.id;
    delete clone.created_at;
    delete clone.updated_at;
    clone.order_number = `${original.order_number}-EX`;
    clone.status = "confirmed";
    clone.payment_status = "paid"; // already paid on the original order — no new payment collected
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
      uiStore.addToast(
        "Failed to create replacement order: " + insertErr?.message,
        "error",
      );
      actionLoading = false;
      return;
    }

    const originalItemIds = (ret.items ?? [])
      .map((i: any) => i.order_item_id)
      .filter(Boolean);
    if (originalItemIds.length > 0) {
      const { data: originalItems } = await supabase
        .from("order_items")
        .select("*")
        .in("id", originalItemIds);
      const newItems = (originalItems ?? []).map((it: any) => {
        const itemClone: any = { ...it };
        delete itemClone.id;
        itemClone.order_id = newOrder.id;
        const retItem = (ret.items ?? []).find(
          (x: any) => x.order_item_id === it.id,
        );
        if (retItem) itemClone.quantity = retItem.quantity;
        return itemClone;
      });
      if (newItems.length > 0)
        await supabase.from("order_items").insert(newItems);
    }

    await supabase
      .from("order_returns")
      .update({
        status: "exchange_shipped",
        replacement_order_id: newOrder.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ret.id);
    const { error: queueErr } = await supabase.from("automation_queue").insert({
      order_id: newOrder.id,
      action_type: "create_exchange_shipment",
      payload: { replacement_order_id: newOrder.id },
    });

    actionLoading = false;
    if (queueErr) {
      uiStore.addToast(
        "Replacement order created, but failed to queue shipment: " +
          queueErr.message,
        "error",
      );
      return;
    }
    uiStore.addToast(
      `Replacement order ${clone.order_number} created and linked.`,
      "success",
    );
    await loadOrders();
  }
</script>

<svelte:head><title>Orders — Admin French Toes</title></svelte:head>

<div class="flex flex-col gap-6 relative">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <h1 class="text-2xl font-bold text-white">Orders Management</h1>
    <div class="relative">
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        viewBox="0 0 24 24"
        ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg
      >
      <input
        bind:value={search}
        type="search"
        placeholder="Search orders..."
        class="pl-9 pr-4 py-2 rounded-xl text-sm outline-none text-white placeholder-gray-500 w-64 focus:ring-1 focus:ring-indigo-500"
        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);"
      />
    </div>
  </div>

  <div
    class="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10"
  >
    {#each STATUS_FILTERS as f}
      <button
        onclick={() => (activeStatus = f.id)}
        class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
        style="background: {activeStatus === f.id
          ? 'rgba(255,255,255,0.3)'
          : 'rgba(255,255,255,0.1)'}; color: {activeStatus === f.id
          ? 'white'
          : 'rgba(255,255,255,0.6)'};"
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="flex justify-center py-16">
      <div
        class="w-8 h-8 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"
      ></div>
    </div>
  {:else if activeStatus === "returns_exchanges"}
    <!-- Returns & Exchanges table -->
    {#if filteredReturns.length === 0}
      <div
        class="text-center py-16 rounded-xl"
        style="background: rgba(255,255,255,0.05);"
      >
        <p class="text-gray-400">No return or exchange requests</p>
      </div>
    {:else}
      <div
        class="rounded-xl overflow-hidden animate-fade-in"
        style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead>
              <tr
                class="text-left select-none text-gray-400 border-b border-white/10"
              >
                <th
                  class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                  >Order #</th
                >
                <th
                  class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                  >Customer</th
                >
                <th
                  class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                  >Type</th
                >
                <th
                  class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                  >Reason</th
                >
                <th
                  class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                  >Requested</th
                >
                <th
                  class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                  >Status</th
                >
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              {#each filteredReturns as ret (ret.id)}
                <tr
                  class="hover:bg-white/5 transition-colors cursor-pointer select-none"
                  onclick={() => openReturnDrawer(ret)}
                >
                  <td
                    class="px-5 py-4 font-mono text-xs text-indigo-400 font-semibold"
                    >{ret.order?.order_number ?? "—"}</td
                  >
                  <td class="px-5 py-4">
                    <p class="text-gray-200 text-xs font-medium">
                      {ret.order?.profile?.full_name ?? "—"}
                    </p>
                    <p class="text-gray-500 text-[10px]">
                      {ret.order?.profile?.email ?? "—"}
                    </p>
                  </td>
                  <td class="px-5 py-4 text-xs text-gray-300 capitalize"
                    >{ret.type}</td
                  >
                  <td class="px-5 py-4 text-xs text-gray-300"
                    >{ret.reason_code}</td
                  >
                  <td class="px-5 py-4 text-xs text-gray-400"
                    >{formatDate(ret.created_at)}</td
                  >
                  <td class="px-5 py-4">
                    <span
                      class="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm"
                      style="background: {RETURN_STATUS_COLOR[ret.status] ??
                        '#6b7280'};"
                    >
                      {ret.status}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {:else if filteredOrders.length === 0}
    <div
      class="text-center py-16 rounded-xl animate-fade-in"
      style="background: rgba(255,255,255,0.05);"
    >
      <p class="text-gray-400">No orders found</p>
    </div>
  {:else}
    <div
      class="rounded-xl overflow-hidden animate-fade-in"
      style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead>
            <tr
              class="text-left select-none text-gray-400 border-b border-white/10"
            >
              <th
                class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                >Order #</th
              >
              <th
                class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                >Date</th
              >
              <th
                class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                >Customer</th
              >
              <th
                class="px-5 py-3 text-xs font-semibold tracking-wider uppercase text-right"
                >Amount</th
              >
              <th
                class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                >Order Status</th
              >
              <th
                class="px-5 py-3 text-xs font-semibold tracking-wider uppercase"
                >Payment Status</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each filteredOrders as order (order.id)}
              {@const hasCancelRequest =
                order.cancellation_status === "pending"}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <tr
                class="hover:bg-white/5 transition-colors cursor-pointer select-none"
                style="background: {hasCancelRequest
                  ? 'rgba(239, 68, 68, 0.08)'
                  : order.has_active_return
                    ? 'rgba(236, 72, 153, 0.08)'
                    : ''};"
                onclick={() => openDrawer(order)}
              >
                <td
                  class="px-5 py-4 font-mono text-xs text-indigo-400 font-semibold"
                >
                  <div class="flex items-center gap-1.5">
                    {#if hasCancelRequest}<span
                        class="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"
                        title="Cancellation Requested"
                      ></span>{/if}
                    {#if order.has_active_return}<span
                        class="w-2 h-2 rounded-full bg-pink-500 animate-pulse inline-block"
                        title="Return/Exchange Active"
                      ></span>{/if}
                    {order.order_number}
                  </div>
                </td>
                <td class="px-5 py-4 text-xs text-gray-300"
                  >{formatDate(order.created_at)}</td
                >
                <td class="px-5 py-4">
                  <p class="text-gray-200 text-xs font-medium">
                    {order.customer_name ?? "—"}
                  </p>
                  <p class="text-gray-500 text-[10px]">
                    {order.customer_email ?? "—"}
                  </p>
                </td>
                <td class="px-5 py-4 font-bold text-white text-xs text-right"
                  >{fmt(order.total_amount)}</td
                >
                <td class="px-5 py-4">
                  <div class="flex flex-col gap-1 items-start">
                    <span
                      class="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm"
                      style="background: {STATUS_COLOR[order.status] ??
                        '#6b7280'};"
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                    {#if hasCancelRequest}<span
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-900/40 text-red-300 border border-red-800"
                        >Cancel Requested</span
                      >{/if}
                    {#if order.has_active_return}<span
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-900/40 text-pink-300 border border-pink-800"
                        >Return/Exchange</span
                      >{/if}
                  </div>
                </td>
                <td class="px-5 py-4">
                  <span
                    class="px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider {PAYMENT_STATUS_COLOR[
                      order.payment_status
                    ] ?? 'bg-white/5 border-white/10 text-white'}"
                  >
                    {order.payment_status}
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
{#if selectedOrder}
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
    <div
      class="flex items-center justify-between border-b border-white/10 pb-4"
    >
      <div>
        <span
          class="text-[10px] font-bold tracking-wider text-indigo-400 uppercase font-mono"
          >Order Details</span
        >
        <h2 class="text-xl font-bold text-white mt-0.5">
          {selectedOrder.order_number}
        </h2>
        <p class="text-xs text-gray-400 mt-0.5">
          Placed on {formatDate(selectedOrder.created_at)}
        </p>
      </div>
      <button
        onclick={closeDrawer}
        class="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        aria-label="Close drawer"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          /></svg
        >
      </button>
    </div>

    <div
      class="flex justify-between items-center bg-white/5 rounded-xl p-4 border border-white/10"
    >
      <div>
        <p class="text-[10px] text-gray-400 uppercase tracking-wider">
          Current Status
        </p>
        <span
          class="px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm inline-block mt-1"
          style="background: {STATUS_COLOR[selectedOrder.status] ?? '#6b7280'};"
        >
          {STATUS_LABEL[selectedOrder.status] ?? selectedOrder.status}
        </span>
      </div>
      <div class="text-right">
        <p class="text-[10px] text-gray-400 uppercase tracking-wider">
          Total Amount
        </p>
        <p class="text-base font-bold text-white mt-0.5">
          {fmt(selectedOrder.total_amount)}
        </p>
      </div>
    </div>

    <!-- Return / Exchange section -->
    {#if selectedReturn}
      <div
        class="rounded-xl p-4 border space-y-3"
        style="background: rgba(236,72,153,0.06); border-color: rgba(236,72,153,0.3);"
      >
        <div class="flex items-center justify-between">
          <h3
            class="text-xs font-semibold uppercase tracking-wider"
            style="color: #f472b6;"
          >
            {selectedReturn.type === "exchange" ? "Exchange" : "Return"} Request
          </h3>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
            style="background: {RETURN_STATUS_COLOR[selectedReturn.status] ??
              '#6b7280'};"
          >
            {selectedReturn.status}
          </span>
        </div>
        <p class="text-xs text-gray-300">
          Reason: <span class="text-white">{selectedReturn.reason_code}</span>
        </p>
        {#if selectedReturn.customer_note}<p class="text-xs text-gray-400">
            Note: {selectedReturn.customer_note}
          </p>{/if}
        <div class="text-xs text-gray-400">
          Items: {(selectedReturn.items ?? [])
            .map((i: any) => `${i.product_name} ×${i.quantity}`)
            .join(", ")}
        </div>
        {#if selectedReturn.admin_refund_amount}
          <p class="text-xs text-gray-300">
            Refund amount: <span class="text-white font-semibold"
              >{fmt(selectedReturn.admin_refund_amount)}</span
            >
          </p>
        {/if}

        <div class="flex flex-wrap gap-2 pt-1">
          {#if selectedReturn.status === "requested"}
            <button
              onclick={() => approveReturn(selectedReturn)}
              disabled={actionLoading}
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
              >Approve & Schedule Pickup</button
            >
            <button
              onclick={() => rejectReturn(selectedReturn)}
              disabled={actionLoading}
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
              >Reject</button
            >
          {/if}
          {#if selectedReturn.type === "refund" && ["approved", "pickup_scheduled", "picked_up", "received"].includes(selectedReturn.status)}
            <button
              onclick={() => processReturnRefund(selectedReturn)}
              disabled={actionLoading}
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >Process Refund</button
            >
          {/if}
          {#if selectedReturn.type === "exchange" && ["approved", "pickup_scheduled", "picked_up", "received"].includes(selectedReturn.status)}
            <button
              onclick={() => createReplacementOrder(selectedReturn)}
              disabled={actionLoading}
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >Create Replacement Order</button
            >
          {/if}
        </div>
      </div>
    {/if}

    <div class="rounded-xl p-4 bg-white/5 border border-white/10 space-y-2">
      <h3
        class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
      >
        Customer Profile
      </h3>
      <p class="text-sm font-medium text-white">
        {selectedOrder.customer_name ?? selectedOrder.profile?.full_name ?? "—"}
      </p>
      <div class="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-1">
        <div>
          <span class="text-[9px] uppercase text-gray-500 block">Email</span>
          <span class="text-gray-300">
            {selectedOrder.customer_email ?? selectedOrder.profile?.email ?? "—"}
          </span>
        </div>
        <div>
          <span class="text-[9px] uppercase text-gray-500 block">Phone</span>
          <span class="text-gray-300">
            {selectedOrder.customer_phone ?? selectedOrder.profile?.phone ?? "—"}
          </span>
        </div>
      </div>
    </div>

    <div class="rounded-xl p-4 bg-white/5 border border-white/10">
      <h3
        class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3"
      >
        Delivery Address
      </h3>
      {#if loadingAddress}
        <div class="animate-pulse space-y-2">
          <div class="h-4 bg-white/10 rounded w-3/4"></div>
          <div class="h-3 bg-white/10 rounded w-1/2"></div>
          <div class="h-3 bg-white/10 rounded w-2/3"></div>
        </div>
      {:else if shippingAddress}
        <p class="text-sm font-medium text-white">
          {shippingAddress.full_name}
        </p>
        <p class="text-xs text-gray-300 mt-1">
          {shippingAddress.address_line1}
        </p>
        {#if shippingAddress.address_line2}<p class="text-xs text-gray-300">
            {shippingAddress.address_line2}
          </p>{/if}
        <p class="text-xs text-gray-300">
          {shippingAddress.city}, {shippingAddress.state} – {shippingAddress.pincode}
        </p>
        <p class="text-xs text-gray-400 mt-2">📞 {shippingAddress.phone}</p>
      {:else}
        <p class="text-xs text-gray-500">No address details available</p>
      {/if}
    </div>

    {#if selectedOrder.items}
      <div
        class="rounded-xl overflow-hidden bg-white/5 border border-white/10 flex flex-col"
      >
        <div class="px-4 py-2.5 border-b border-white/10 bg-white/5">
          <h3
            class="text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >
            Purchased Items
          </h3>
        </div>
        <div class="divide-y divide-white/5 max-h-48 overflow-y-auto">
          {#each selectedOrder.items || [] as item}
            <div class="p-3 flex items-center gap-3">
              {#if item.image}<img
                  src={item.image}
                  alt={item.product_name}
                  class="w-10 h-10 object-cover rounded-lg bg-gray-800 shrink-0"
                />{/if}
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-white truncate">
                  {item.product_name}
                </p>
                <p class="text-[10px] text-gray-500">
                  SKU: {item.sku || "N/A"}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-xs font-bold text-white">{fmt(item.total)}</p>
                <p class="text-[10px] text-gray-500">
                  {item.quantity} × {fmt(item.unit_price)}
                </p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="rounded-xl p-4 bg-white/5 border border-white/10 space-y-3">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Integrations & Payments
      </h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div>
          <p class="text-[9px] uppercase text-gray-500">Payment Method</p>
          <p class="text-white font-medium capitalize mt-0.5">
            {selectedOrder.payment_method || "—"}
          </p>
        </div>
        <div>
          <p class="text-[9px] uppercase text-gray-500">Payment Status</p>
          <p class="text-white font-medium capitalize mt-0.5">
            {selectedOrder.payment_status || "—"}
          </p>
        </div>
        {#if selectedOrder.razorpay_order_id}<div class="col-span-2">
            <p class="text-[9px] uppercase text-gray-500">Razorpay Order ID</p>
            <p class="font-mono text-indigo-300 break-all select-all mt-0.5">
              {selectedOrder.razorpay_order_id}
            </p>
          </div>{/if}
        {#if selectedOrder.razorpay_payment_id}<div class="col-span-2">
            <p class="text-[9px] uppercase text-gray-500">
              Razorpay Payment ID
            </p>
            <p class="font-mono text-indigo-300 break-all select-all mt-0.5">
              {selectedOrder.razorpay_payment_id}
            </p>
          </div>{/if}
        {#if selectedOrder.shiprocket_order_id}<div class="col-span-2">
            <p class="text-[9px] uppercase text-gray-500">
              Shiprocket Order ID
            </p>
            <p class="font-mono text-indigo-300 break-all select-all mt-0.5">
              {selectedOrder.shiprocket_order_id}
            </p>
          </div>{/if}
        {#if selectedOrder.shiprocket_status}<div class="col-span-2">
            <p class="text-[9px] uppercase text-gray-500">
              Live Shiprocket Status
            </p>
            <p class="text-white mt-0.5">{selectedOrder.shiprocket_status}</p>
          </div>{/if}
      </div>
    </div>

    <div class="mt-auto pt-6 border-t border-white/10 flex gap-3">
      <a
        href="/admin/orders/{selectedOrder.id}"
        class="flex-1 py-2.5 px-4 text-center rounded-xl text-xs font-semibold text-white border border-white/10 hover:bg-white/5 transition-all"
        >Full Details Page →</a
      >
      {#if selectedOrder.status === "pending" || selectedOrder.status === "confirmed"}
        <button
          onclick={() => cancelOrder(selectedOrder)}
          disabled={actionLoading}
          class="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {actionLoading ? "Cancelling..." : "Cancel Order"}
        </button>
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
