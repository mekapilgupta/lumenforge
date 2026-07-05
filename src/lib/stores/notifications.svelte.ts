// ─── Notifications Store — Svelte 5 Runes (Functional Closure) ────────────────
import { supabase } from '$lib/supabaseClient';
import type { Notification } from '$lib/types';

function createNotificationStore() {
  let items = $state<Notification[]>([]);
  let _userId = $state<string | null>(null);
  let _channel = $state<ReturnType<typeof supabase.channel> | null>(null);

  const unread = $derived(items.filter(n => !n.is_read).length);

  async function syncOnLogin(userId: string): Promise<void> {
    _userId = userId;
    await _load();
    // Subscribe to realtime new notifications
    _channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          items = [payload.new as Notification, ...items];
        }
      )
      .subscribe();
  }

  async function onLogout(): Promise<void> {
    _userId = null;
    items = [];
    if (_channel) {
      await supabase.removeChannel(_channel);
      _channel = null;
    }
  }

  async function markAllRead(): Promise<void> {
    if (!_userId || unread === 0) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', _userId)
      .eq('is_read', false);
    items = items.map(n => ({ ...n, is_read: true }));
  }

  async function markRead(id: string): Promise<void> {
    if (!_userId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    items = items.map(n => n.id === id ? { ...n, is_read: true } : n);
  }

  async function _load(): Promise<void> {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', _userId!)
      .order('created_at', { ascending: false })
      .limit(20);
    items = (data ?? []) as Notification[];
  }

  return {
    get items() { return items; },
    set items(v) { items = v; },
    get unread() { return unread; },
    syncOnLogin,
    onLogout,
    markAllRead,
    markRead
  };
}

let instance: ReturnType<typeof createNotificationStore>;
function getInstance() {
  if (!instance) {
    instance = createNotificationStore();
  }
  return instance;
}

export const notificationStore = {
  get items() { return getInstance().items; },
  set items(v) { getInstance().items = v; },
  get unread() { return getInstance().unread; },
  syncOnLogin(userId: string) { return getInstance().syncOnLogin(userId); },
  onLogout() { return getInstance().onLogout(); },
  markAllRead() { return getInstance().markAllRead(); },
  markRead(id: string) { return getInstance().markRead(id); }
};
