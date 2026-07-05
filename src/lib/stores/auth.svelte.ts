// ─── Auth Store — Svelte 5 Runes (Functional Closure) ───────────────────────────
import type { User } from '@supabase/supabase-js';
import { supabase } from '$lib/supabaseClient';
import type { Profile } from '$lib/types';
import { cartStore } from '$lib/stores/cart.svelte';
import { wishlistStore } from '$lib/stores/wishlist.svelte';
import { notificationStore } from '$lib/stores/notifications.svelte';
import { authLogger } from '$lib/authLogger';

function createAuthStore() {
  let user = $state<User | null>(null);
  let profile = $state<Profile | null>(null);
  let loading = $state(true);
  let _initialized = false;

  const isAdmin = $derived(profile?.role === 'admin');

  const initials = $derived.by(() => {
    const name = profile?.full_name ?? user?.email ?? '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  async function init() {
    if (_initialized) return;
    _initialized = true;

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
    if (user) {
      if (typeof document !== 'undefined' && session) {
        const cookieVal = JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user_id: session.user.id
        });
        document.cookie = `sb-session=${encodeURIComponent(cookieVal)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
      }
      await _fetchProfile(user.id);
      // Sync store state for restored sessions (onAuthStateChange skips this since prev was never null)
      await Promise.all([
        cartStore.syncOnLogin(user.id).catch((e) => console.warn('Cart sync failed:', e)),
        wishlistStore.syncOnLogin(user.id).catch((e) => console.warn('Wishlist sync failed:', e)),
        notificationStore.syncOnLogin(user.id).catch((e) => console.warn('Notification sync failed:', e)),
      ]);
    }
    loading = false;

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      const prev = user;
      user = session?.user ?? null;

      // Update cookie for server-side layouts
      if (typeof document !== 'undefined') {
        if (session) {
          const cookieVal = JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user_id: session.user.id
          });
          document.cookie = `sb-session=${encodeURIComponent(cookieVal)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
        } else {
          document.cookie = 'sb-session=; path=/; max-age=0; SameSite=Lax; Secure';
        }
      }

      setTimeout(async () => {
        if (user) {
          await _fetchProfile(user.id);
          if (!prev) {
            // Fire-and-forget syncs — they can fail without blocking auth
            cartStore.syncOnLogin(user.id).catch((e) => console.warn('Cart sync failed:', e));
            wishlistStore.syncOnLogin(user.id).catch((e) => console.warn('Wishlist sync failed:', e));
            notificationStore.syncOnLogin(user.id).catch((e) => console.warn('Notification sync failed:', e));
          }
        } else {
          profile = null;
          if (prev) {
            await cartStore.onLogout();
            await wishlistStore.onLogout();
            await notificationStore.onLogout();
          }
        }
      }, 0);
    });
  }

  async function _fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    profile = data ?? null;
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName?: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName ?? '' }
      }
    });
    return { error: error?.message ?? null };
  }

  async function signInWithOtp(email: string): Promise<{ error: string | null }> {
    authLogger.info('signInWithOtp called', { email });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) {
      authLogger.error('signInWithOtp failed', { 
        message: error.message, 
        status: error.status,
        errorName: error.name,
        fullError: error
      });
    }
    return { error: error?.message ?? null };
  }

  async function verifyOtp(email: string, token: string): Promise<{ error: string | null }> {
    authLogger.info('verifyOtp called', { email, hasToken: !!token });
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) {
      authLogger.error('verifyOtp failed', { 
        message: error.message,
        status: error.status,
        errorName: error.name,
        fullError: error
      });
      return { error: error.message };
    }
    authLogger.info('verifyOtp succeeded, session started', { userId: data.user?.id });

    // Detect user signup (created_at and last_sign_in_at are identical or very close)
    if (data.user) {
      const isNewUser = !data.user.last_sign_in_at || 
                        Math.abs(new Date(data.user.created_at).getTime() - new Date(data.user.last_sign_in_at).getTime()) < 10000;
      if (isNewUser) {
        authLogger.info('New user signup detected, sending admin notification...', { email: data.user.email });
        fetch('/api/notify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'Signup',
            details: {
              email: data.user.email,
              userId: data.user.id
            }
          })
        }).catch(err => console.warn('Admin signup notification failed:', err));
      }
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    user = null;
    profile = null;
    if (typeof document !== 'undefined') {
      document.cookie = 'sb-session=; path=/; max-age=0; SameSite=Lax; Secure';
    }
  }

  return {
    get user() { return user; },
    set user(v) { user = v; },
    get profile() { return profile; },
    set profile(v) { profile = v; },
    get loading() { return loading; },
    set loading(v) { loading = v; },
    init,
    signIn,
    signUp,
    signInWithOtp,
    verifyOtp,
    signOut,
    get isAdmin() { return isAdmin; },
    get initials() { return initials; }
  };
}

let instance: ReturnType<typeof createAuthStore>;
function getInstance() {
  if (!instance) {
    instance = createAuthStore();
  }
  return instance;
}

export const authStore = {
  get user() { return getInstance().user; },
  set user(v) { getInstance().user = v; },
  get profile() { return getInstance().profile; },
  set profile(v) { getInstance().profile = v; },
  get loading() { return getInstance().loading; },
  set loading(v) { getInstance().loading = v; },
  init() { return getInstance().init(); },
  signIn(email: string, password: string) { return getInstance().signIn(email, password); },
  signUp(email: string, password: string, fullName?: string) { return getInstance().signUp(email, password, fullName); },
  signInWithOtp(email: string) { return getInstance().signInWithOtp(email); },
  verifyOtp(email: string, token: string) { return getInstance().verifyOtp(email, token); },
  signOut() { return getInstance().signOut(); },
  get isAdmin() { return getInstance().isAdmin; },
  get initials() { return getInstance().initials; }
};