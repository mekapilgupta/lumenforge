<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { uiStore } from '$lib/stores/ui.svelte';

  interface AdminNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    link_url?: string;
    reference_id?: string;
    is_read: boolean;
    is_reviewed: boolean;
    created_at: string;
  }

  let notifications = $state<AdminNotification[]>([]);
  let unreadCount = $state(0);
  let unreviewedCount = $state(0);
  let isOpen = $state(false);
  let loading = $state(true);
  let realtimeSub: any = null;
  let pushPermission = $state<NotificationPermission>('default');

  const TYPE_ICONS: Record<string, string> = {
    new_order: '🛍️',
    order_delivered: '🎉',
    return_requested: '🔄',
    exchange_requested: '👟',
    cancellation_requested: '💔',
    customer_message: '💬',
    low_stock: '⚠️',
    system_alert: '🔔',
  };

  onMount(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      pushPermission = Notification.permission;
    }
    await loadNotifications();
    subscribeRealtime();
  });

  onDestroy(() => {
    if (realtimeSub) supabase.removeChannel(realtimeSub);
  });

  async function loadNotifications() {
    try {
      const res = await fetch('/api/admin/notifications?limit=25');
      const data = await res.json();
      if (data.success) {
        notifications = data.notifications || [];
        unreadCount = data.unreadCount || 0;
        unreviewedCount = data.unreviewedCount || 0;
      }
    } catch (e) {
      console.warn('[Admin Bell] Failed to load notifications:', e);
    } finally {
      loading = false;
    }
  }

  function subscribeRealtime() {
    realtimeSub = supabase
      .channel('admin-realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
        },
        (payload) => {
          const newNotif = payload.new as AdminNotification;
          notifications = [newNotif, ...notifications];
          unreadCount += 1;
          unreviewedCount += 1;

          // Sound Chime
          playChime();

          // Desktop Web Notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(newNotif.title, {
              body: newNotif.message,
              icon: '/favicon.png',
            });
          }

          uiStore.addToast(`🔔 ${newNotif.title}`, 'info');
        }
      )
      .subscribe();
  }

  function playChime() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // audioContext not allowed without gesture
    }
  }

  async function requestPushPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      pushPermission = perm;
      if (perm === 'granted') {
        uiStore.addToast('Browser notifications enabled! 🔔', 'success');
      }
    }
  }

  async function handleClickNotification(n: AdminNotification) {
    isOpen = false;
    // Mark as reviewed
    if (!n.is_reviewed) {
      await markAsReviewed(n.id);
    }
    if (n.link_url) {
      goto(n.link_url);
    }
  }

  async function markAsReviewed(id: string) {
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_reviewed', id }),
      });
      notifications = notifications.map((n) => (n.id === id ? { ...n, is_read: true, is_reviewed: true } : n));
      unreadCount = Math.max(0, unreadCount - 1);
      unreviewedCount = Math.max(0, unreviewedCount - 1);
    } catch (e) {
      console.warn('Failed to mark reviewed:', e);
    }
  }

  async function markAllReviewed() {
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_reviewed' }),
      });
      notifications = notifications.map((n) => ({ ...n, is_read: true, is_reviewed: true }));
      unreadCount = 0;
      unreviewedCount = 0;
      uiStore.addToast('All notifications marked as reviewed ✅', 'success');
    } catch (e) {
      console.warn('Failed to mark all reviewed:', e);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
</script>

<div class="relative inline-block text-left">
  <!-- Bell Button -->
  <button
    type="button"
    onclick={() => { isOpen = !isOpen; if (isOpen && unreadCount > 0) fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_all_read' }) }); }}
    class="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer border border-white/10"
    aria-label="Notifications"
  >
    <span class="text-lg">🔔</span>
    {#if unreviewedCount > 0}
      <span class="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500 text-white min-w-[18px] text-center shadow animate-pulse">
        {unreviewedCount > 99 ? '99+' : unreviewedCount}
      </span>
    {/if}
  </button>

  <!-- Dropdown Overlay -->
  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="fixed inset-0 z-40" onclick={() => isOpen = false} role="button" tabindex="0" aria-label="Close notifications"></div>

    <div
      class="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#1a1b2e] border border-white/15 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
    >
      <!-- Header -->
      <div class="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-white">Notifications &amp; Alerts</span>
          {#if unreviewedCount > 0}
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/30 text-pink-300 border border-pink-500/40">
              {unreviewedCount} Action Needed
            </span>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          {#if unreviewedCount > 0}
            <button
              onclick={markAllReviewed}
              class="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
            >
              Mark all reviewed
            </button>
          {/if}
        </div>
      </div>

      <!-- Browser Push Permission Banner -->
      {#if pushPermission === 'default'}
        <div class="px-3.5 py-2 bg-indigo-950/40 border-b border-indigo-500/30 flex items-center justify-between gap-2 text-xs">
          <span class="text-indigo-200 text-[11px]">Enable desktop push notifications for new orders</span>
          <button
            onclick={requestPushPermission}
            class="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shrink-0 cursor-pointer"
          >
            Enable
          </button>
        </div>
      {/if}

      <!-- Notifications List -->
      <div class="overflow-y-auto divide-y divide-white/5 flex-1">
        {#if loading}
          <div class="py-8 text-center text-xs text-gray-500 animate-pulse">Loading alerts...</div>
        {:else if notifications.length === 0}
          <div class="py-12 text-center text-xs text-gray-400">
            <span class="text-2xl block mb-1">✨</span>
            All caught up! No unreviewed notifications.
          </div>
        {:else}
          {#each notifications as notif (notif.id)}
            <div
              class="p-3 hover:bg-white/5 transition-colors flex items-start gap-3 cursor-pointer group {notif.is_reviewed ? 'opacity-60 bg-transparent' : 'bg-pink-950/10'}"
              onclick={() => handleClickNotification(notif)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleClickNotification(notif)}
            >
              <span class="text-xl shrink-0 mt-0.5">{TYPE_ICONS[notif.type] || '🔔'}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1 mb-0.5">
                  <p class="text-xs font-bold text-white truncate">{notif.title}</p>
                  <span class="text-[10px] text-gray-500 shrink-0">{formatTime(notif.created_at)}</span>
                </div>
                <p class="text-xs text-gray-300 line-clamp-2 leading-relaxed">{notif.message}</p>
              </div>
              {#if !notif.is_reviewed}
                <button
                  type="button"
                  title="Mark as Reviewed"
                  onclick={(e) => { e.stopPropagation(); markAsReviewed(notif.id); }}
                  class="shrink-0 text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✓
                </button>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer Link to Full Action Center -->
      <div class="p-2.5 border-t border-white/10 text-center bg-white/5">
        <a
          href="/admin/actions"
          onclick={() => isOpen = false}
          class="text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors block"
        >
          Open Action Center →
        </a>
      </div>
    </div>
  {/if}
</div>
