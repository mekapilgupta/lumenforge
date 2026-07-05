// ─── Wishlist Store — Svelte 5 Runes (Functional Closure) ─────────────────────
import { supabase } from '$lib/supabaseClient';

function createWishlistStore() {
  let _ids = $state<string[]>([]);
  let _userId = $state<string | null>(null);

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ft_wishlist_ids');
    if (saved) {
      try { _ids = JSON.parse(saved); } catch { _ids = []; }
    }
  }

  const count = $derived(_ids.length);

  function has(productId: string): boolean {
    return _ids.includes(productId);
  }

  async function toggle(productId: string): Promise<void> {
    const isIn = has(productId);
    if (_userId) {
      if (isIn) {
        await supabase.from('wishlist').delete().eq('user_id', _userId).eq('product_id', productId);
        _ids = _ids.filter(id => id !== productId);
      } else {
        await supabase.from('wishlist').insert({ user_id: _userId, product_id: productId });
        _ids = [..._ids, productId];
      }
    } else {
      // Guest mode — localStorage only
      if (isIn) {
        _ids = _ids.filter(id => id !== productId);
      } else {
        _ids = [..._ids, productId];
      }
      localStorage.setItem('ft_wishlist_ids', JSON.stringify(_ids));
    }
  }

  async function syncOnLogin(userId: string): Promise<void> {
    _userId = userId;
    const guestIds = [..._ids];
    if (guestIds.length > 0) {
      for (const productId of guestIds) {
        await supabase
          .from('wishlist')
          .upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id' });
      }
      localStorage.removeItem('ft_wishlist_ids');
    }
    await _loadFromSupabase();
  }

  async function onLogout(): Promise<void> {
    _userId = null;
    _ids = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ft_wishlist_ids');
    }
  }

  async function reload(): Promise<void> {
    if (_userId) await _loadFromSupabase();
  }

  async function _loadFromSupabase(): Promise<void> {
    const { data } = await supabase
      .from('wishlist')
      .select('product_id')
      .eq('user_id', _userId!);
    _ids = (data ?? []).map((r: any) => r.product_id as string);
  }

  return {
    get count() { return count; },
    has,
    toggle,
    syncOnLogin,
    onLogout,
    reload
  };
}

let instance: ReturnType<typeof createWishlistStore>;
function getInstance() {
  if (!instance) {
    instance = createWishlistStore();
  }
  return instance;
}

export const wishlistStore = {
  get count() { return getInstance().count; },
  has(productId: string) { return getInstance().has(productId); },
  toggle(productId: string) { return getInstance().toggle(productId); },
  syncOnLogin(userId: string) { return getInstance().syncOnLogin(userId); },
  onLogout() { return getInstance().onLogout(); },
  reload() { return getInstance().reload(); }
};
