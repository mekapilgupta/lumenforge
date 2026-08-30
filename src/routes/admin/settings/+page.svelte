<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

  let syncingAll = $state(false);
  let pingStatus = $state<{
    shiprocket?: boolean;
    imagekit?: boolean;
    razorpay?: boolean;
  }>({});

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
  });

  async function triggerFullShiprocketSync() {
    syncingAll = true;
    try {
      const res = await fetch('/api/shiprocket/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncAll: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      uiStore.addToast(`Shiprocket sync complete! Processed ${data.processed ?? 0} active orders. 🚀`, 'success');
    } catch (err: any) {
      uiStore.addToast('Sync error: ' + err.message, 'error');
    } finally {
      syncingAll = false;
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    uiStore.addToast(`${label} copied to clipboard! 📋`, 'success');
  }
</script>

<svelte:head>
  <title>Integrations & Settings — Admin French Toes</title>
</svelte:head>

<div class="flex flex-col gap-6 max-w-7xl mx-auto">
  <!-- Header Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
    <div>
      <h1 class="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
        <span>⚙️ Integrations & Store Settings</span>
      </h1>
      <p class="text-xs text-gray-400 mt-1">
        Monitor connected services, API webhooks, payment gateways, and logistics sync.
      </p>
    </div>

    <button
      onclick={triggerFullShiprocketSync}
      disabled={syncingAll}
      class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
    >
      <span>{syncingAll ? 'Syncing...' : '🔄 Sync All Shiprocket Orders'}</span>
    </button>
  </div>

  <!-- Integrations Status Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <!-- Shiprocket Card -->
    <div class="rounded-2xl p-5 bg-white/5 border border-white/10 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="text-2xl">🚚</span>
          <div>
            <h3 class="text-sm font-bold text-white">Shiprocket Logistics</h3>
            <p class="text-[11px] text-gray-400">Order fulfillment & Courier tracking</p>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Connected
        </span>
      </div>
      <p class="text-xs text-gray-300">
        Automatic order dispatch, tracking sync, courier allocation (Xpressbees, Delhivery, BlueDart), and real-time status callbacks.
      </p>
      <div class="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
        <span class="text-gray-400">Pickup Location:</span>
        <span class="font-mono text-white font-semibold">Primary</span>
      </div>
    </div>

    <!-- ImageKit Card -->
    <div class="rounded-2xl p-5 bg-white/5 border border-white/10 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="text-2xl">📸</span>
          <div>
            <h3 class="text-sm font-bold text-white">ImageKit CDN</h3>
            <p class="text-[11px] text-gray-400">High-speed image optimization</p>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Connected
        </span>
      </div>
      <p class="text-xs text-gray-300">
        Automatic compression, WebP format delivery, responsive sizing, and instant product gallery uploads.
      </p>
      <div class="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
        <span class="text-gray-400">Endpoint:</span>
        <span class="font-mono text-white font-semibold truncate max-w-[150px]">ik.imagekit.io/who7qvgvp</span>
      </div>
    </div>

    <!-- Razorpay Card -->
    <div class="rounded-2xl p-5 bg-white/5 border border-white/10 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="text-2xl">💳</span>
          <div>
            <h3 class="text-sm font-bold text-white">Razorpay Payments</h3>
            <p class="text-[11px] text-gray-400">UPI, Cards, Netbanking</p>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Live
        </span>
      </div>
      <p class="text-xs text-gray-300">
        Checkout payment processing with instant signature verification and automatic refund disbursement.
      </p>
      <div class="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
        <span class="text-gray-400">Gateway Mode:</span>
        <span class="font-mono text-emerald-400 font-bold">Production Live</span>
      </div>
    </div>
  </div>

  <!-- Webhook Endpoints Box -->
  <div class="rounded-2xl p-6 bg-white/5 border border-white/10 space-y-4">
    <div>
      <h3 class="text-sm font-bold text-white">📡 Webhook Endpoints for Third-Party Services</h3>
      <p class="text-xs text-gray-400 mt-0.5">
        Configure these endpoints in your Shiprocket and Razorpay dashboards to receive real-time updates.
      </p>
    </div>

    <div class="space-y-3">
      <div class="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold text-white">Shiprocket Courier Tracking Webhook</p>
          <p class="text-[11px] font-mono text-indigo-300 select-all mt-0.5">
            https://frenchtoes.in/api/webhooks/logistics?secret=FrenchToes_Secure_Logistics_Token_2026
          </p>
        </div>
        <button
          onclick={() => copyText('https://frenchtoes.in/api/webhooks/logistics?secret=FrenchToes_Secure_Logistics_Token_2026', 'Shiprocket Webhook URL')}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer shrink-0"
        >
          Copy URL
        </button>
      </div>

      <div class="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold text-white">Razorpay Payment Webhook</p>
          <p class="text-[11px] font-mono text-indigo-300 select-all mt-0.5">
            https://mmmtpheheqxdojbssapb.supabase.co/functions/v1/razorpay-verify
          </p>
        </div>
        <button
          onclick={() => copyText('https://mmmtpheheqxdojbssapb.supabase.co/functions/v1/razorpay-verify', 'Razorpay Webhook URL')}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer shrink-0"
        >
          Copy URL
        </button>
      </div>
    </div>
  </div>
</div>
