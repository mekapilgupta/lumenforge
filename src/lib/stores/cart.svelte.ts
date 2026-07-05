// ─── Cart Store — Svelte 5 Runes (Functional Closure) ───────────────────────
import type { CartItem, ColorVariant } from '$lib/types';
import { supabase } from '$lib/supabaseClient';

function createCartStore() {
  let items = $state<CartItem[]>([]);
  let isOpen = $state(false);
  let _userId = $state<string | null>(null);

  // Initialize
  if (typeof window !== 'undefined') {
    items = _loadLocalCart();
  }

  // ─── Local Storage Helpers ──────────────────────────────────────────────────

  function _loadLocalCart(): CartItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('ft_cart');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading local cart:', e);
      return [];
    }
  }

  function _saveLocalCart(newItems: CartItem[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('ft_cart', JSON.stringify(newItems));
    } catch (e) {
      console.error('Error saving local cart:', e);
    }
  }

  // ─── JWT Expiration Auto-Retry Wrapper ─────────────────────────────────────

  async function _runWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // Check if error represents a JWT expired or Postgres PGRST303 error
      if (error && (error.code === 'PGRST303' || error.message?.includes('JWT expired'))) {
        console.warn('Supabase JWT expired. Attempting to refresh session...');
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (session && !sessionError) {
            console.info('Session successfully refreshed.');
            if (typeof document !== 'undefined') {
              const cookieVal = JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                user_id: session.user.id
              });
              document.cookie = `sb-session=${encodeURIComponent(cookieVal)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
            }
            // Retry the operation
            return await operation();
          } else {
            console.error('Failed to refresh session, logging out user:', sessionError);
            const { authStore } = await import('$lib/stores/auth.svelte');
            await authStore.signOut();
            throw new Error('Session expired and could not be refreshed. Logged out.');
          }
        } catch (e) {
          console.error('Error during token refresh:', e);
          const { authStore } = await import('$lib/stores/auth.svelte');
          await authStore.signOut();
          throw e;
        }
      }
      throw error;
    }
  }

  // ─── Initializer & Loaders ────────────────────────────────────────────────
  
  function initialize(dbCartRows: any[]) {
    items = _mapDbRowsToItems(dbCartRows);
  }

  async function syncOnLogin(userId: string) {
    _userId = userId;
    
    // Load existing items from DB first
    await loadFromSupabase(userId);
    
    // Merge guest cart items from localStorage if present
    const localItems = _loadLocalCart();
    if (localItems.length > 0) {
      console.info('Merging guest cart items with database cart...', localItems);
      for (const item of localItems) {
        try {
          await _runWithRetry(async () => {
            // Resolve variant ID if not present
            let variantId: string | null = null;
            const { data: variants, error: variantError } = await supabase
              .from('product_variants')
              .select('id')
              .eq('product_id', item.productId)
              .eq('color', item.color.name)
              .eq('size', String(item.size))
              .eq('is_active', true)
              .limit(1);
            
            if (!variantError && variants && variants.length > 0) {
              variantId = variants[0].id;
            }
            
            // Add or update row in database
            let query = supabase
              .from('cart')
              .select('id, quantity')
              .eq('user_id', userId)
              .eq('product_id', item.productId);

            if (variantId) {
              query = query.eq('variant_id', variantId);
            } else {
              query = query.is('variant_id', null);
            }

            const { data: existingRows, error: findError } = await query;
            if (findError) throw findError;

            if (existingRows && existingRows.length > 0) {
              const newQty = existingRows[0].quantity + item.quantity;
              const { error: updateError } = await supabase
                .from('cart')
                .update({ quantity: newQty })
                .eq('id', existingRows[0].id);
              if (updateError) throw updateError;
            } else {
              const { error: insertError } = await supabase
                .from('cart')
                .insert({
                  user_id: userId,
                  product_id: item.productId,
                  variant_id: variantId,
                  quantity: item.quantity
                });
              if (insertError) throw insertError;
            }
          });
        } catch (e) {
          console.error(`Failed to merge item ${item.name} to DB:`, e);
        }
      }
      
      // Clear guest cart
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ft_cart');
      }
      
      // Reload final merged cart from Supabase
      await loadFromSupabase(userId);
    }
  }

  async function onLogout() {
    _userId = null;
    items = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ft_cart');
    }
  }

  async function loadFromSupabase(userId: string) {
    _userId = userId;
    try {
      const data = await _runWithRetry(async () => {
        const { data, error } = await supabase
          .from('cart')
          .select('*, product:product_id(id, slug, name, price, images, colors, sizes), variant:variant_id(*)')
          .eq('user_id', userId);
        if (error) throw error;
        return data;
      });
      items = _mapDbRowsToItems(data ?? []);
    } catch (error) {
      console.error('Error loading cart from Supabase:', error);
    }
  }

  function _mapDbRowsToItems(rows: any[]): CartItem[] {
    return rows.map((row: any) => {
      const p = row.product;
      if (!p) return null;

      const v = row.variant;
      const images = (v?.images && v.images.length > 0) 
        ? v.images.map((img: any) => img.url ?? img) 
        : (p.images ?? []).map((img: any) => img.url ?? img);
      
      const colors = (p.colors ?? []) as ColorVariant[];
      const colorName = v?.color;
      const matchedColor = colors.find((c) => c.name.toLowerCase() === colorName?.toLowerCase()) 
        || colors[0] 
        || { name: colorName || 'Default', hex: '#f4a7c3' };

      const size = v?.size ? parseInt(v.size) : (parseInt((p.sizes ?? ['38'])[0]) || 38);
      
      // Calculate unit price in rupees: (product base price + variant adjustment) / 100
      const basePricePaise = p.price ?? 0;
      const adjustmentPaise = v?.price_adjustment ?? 0;
      const priceRupees = Math.round((basePricePaise + adjustmentPaise) / 100);
      const originalPriceRupees = p.original_price ? Math.round(p.original_price / 100) : undefined;

      // Unique ID for frontend rendering and removal (match DB ID)
      return {
        id: row.id,
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: images[0] ?? '',
        price: priceRupees,
        originalPrice: originalPriceRupees,
        color: matchedColor,
        size: size,
        quantity: row.quantity,
      };
    }).filter(Boolean) as CartItem[];
  }

  // ─── Getters (Derived) ───────────────────────────────────────────────────

  const count = $derived(items.reduce((sum, item) => sum + item.quantity, 0));
  const subtotal = $derived(items.reduce((sum, item) => sum + item.price * item.quantity, 0));

  // ─── Mutations ────────────────────────────────────────────────────────────

  async function addItem(params: {
    productId: string;
    slug: string;
    name: string;
    image: string;
    price: number;
    originalPrice?: number;
    color: ColorVariant;
    size: number;
    quantity?: number;
    variantId?: string | null;
  }) {
    const { productId, slug, name, image, price, originalPrice, color, size, quantity = 1 } = params;

    if (!_userId) {
      // Local storage mode for anonymous users
      const localItems = _loadLocalCart();
      const existingIndex = localItems.findIndex(
        (item) => item.productId === productId && item.color.name === color.name && item.size === size
      );
      
      if (existingIndex > -1) {
        localItems[existingIndex].quantity += quantity;
      } else {
        const id = `anon-${productId}-${color.name}-${size}`;
        localItems.push({
          id,
          productId,
          slug,
          name,
          image,
          price,
          originalPrice,
          color,
          size,
          quantity
        });
      }
      
      items = localItems;
      _saveLocalCart(localItems);
      return;
    }

    // Authenticated Database mode
    try {
      await _runWithRetry(async () => {
        let variantId = params.variantId;

        // Resolve variantId if not explicitly passed
        if (variantId === undefined) {
          const { data: variants, error: variantError } = await supabase
            .from('product_variants')
            .select('id')
            .eq('product_id', productId)
            .eq('color', color.name)
            .eq('size', String(size))
            .eq('is_active', true)
            .limit(1);
          
          if (variantError) throw variantError;
          variantId = variants?.[0]?.id || null;
        }

        // Query existing cart row
        let query = supabase
          .from('cart')
          .select('id, quantity')
          .eq('user_id', _userId!)
          .eq('product_id', productId);

        if (variantId) {
          query = query.eq('variant_id', variantId);
        } else {
          query = query.is('variant_id', null);
        }

        const { data: existingRows, error: findError } = await query;
        if (findError) throw findError;

        if (existingRows && existingRows.length > 0) {
          // Update quantity
          const newQty = existingRows[0].quantity + quantity;
          const { error: updateError } = await supabase
            .from('cart')
            .update({ quantity: newQty })
            .eq('id', existingRows[0].id);
          
          if (updateError) throw updateError;
        } else {
          // Insert new row
          const { error: insertError } = await supabase
            .from('cart')
            .insert({
              user_id: _userId!,
              product_id: productId,
              variant_id: variantId || null,
              quantity: quantity
            });

          if (insertError) throw insertError;
        }
      });

      // Sync abandoned cart
      await syncAbandonedCart();

      // Reload latest state from Supabase
      await loadFromSupabase(_userId);
    } catch (e) {
      console.error('Error adding item to cart:', e);
    }
  }

  async function removeItem(id: string) {
    if (!_userId) {
      const localItems = _loadLocalCart();
      const filtered = localItems.filter((item) => item.id !== id);
      items = filtered;
      _saveLocalCart(filtered);
      return;
    }

    try {
      await _runWithRetry(async () => {
        const { error } = await supabase
          .from('cart')
          .delete()
          .eq('id', id)
          .eq('user_id', _userId!);
        if (error) throw error;
      });

      // Sync abandoned cart
      await syncAbandonedCart();

      // Reload latest state
      await loadFromSupabase(_userId);
    } catch (e) {
      console.error('Error removing cart item:', e);
    }
  }

  async function updateQty(id: string, quantity: number) {
    if (!_userId) {
      if (quantity < 1) {
        await removeItem(id);
        return;
      }
      const localItems = _loadLocalCart();
      const item = localItems.find((item) => item.id === id);
      if (item) {
        item.quantity = quantity;
      }
      items = localItems;
      _saveLocalCart(localItems);
      return;
    }

    if (quantity < 1) {
      await removeItem(id);
      return;
    }

    try {
      await _runWithRetry(async () => {
        const { error } = await supabase
          .from('cart')
          .update({ quantity })
          .eq('id', id)
          .eq('user_id', _userId!);
        if (error) throw error;
      });

      // Sync abandoned cart
      await syncAbandonedCart();

      // Reload latest state
      await loadFromSupabase(_userId);
    } catch (e) {
      console.error('Error updating cart quantity:', e);
    }
  }

  async function clear() {
    if (!_userId) {
      items = [];
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ft_cart');
      }
      return;
    }

    try {
      await _runWithRetry(async () => {
        const { error } = await supabase
          .from('cart')
          .delete()
          .eq('user_id', _userId!);
        if (error) throw error;
      });

      items = [];
      // Sync abandoned cart (will clear the abandoned cart row or update to empty)
      await syncAbandonedCart();
    } catch (e) {
      console.error('Error clearing cart:', e);
    }
  }

  // ─── Checkout success ─────────────────────────────────────────────────────

  async function checkoutSuccess(orderId: string) {
    if (!_userId) return;

    try {
      await _runWithRetry(async () => {
        // Delete rows from cart
        const { error: deleteError } = await supabase.from('cart').delete().eq('user_id', _userId!);
        if (deleteError) throw deleteError;
        
        // Update abandoned_carts to recovered
        const { error: recoveryError } = await supabase
          .from('abandoned_carts')
          .update({
            status: 'recovered',
            recovered: true,
            recovered_order_id: orderId,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', _userId!);

        if (recoveryError) throw recoveryError;
      });
      items = [];
    } catch (e) {
      console.error('Error updating abandoned cart to recovered:', e);
    }
  }

  // ─── Abandoned Cart Synchronization ───────────────────────────────────────

  async function syncAbandonedCart() {
    if (!_userId) return;

    try {
      await _runWithRetry(async () => {
        // Fetch the updated cart items from the database to ensure we have the most fresh state
        const { data: cartRows, error: cartError } = await supabase
          .from('cart')
          .select('*, product:product_id(id, name, price), variant:variant_id(id, price_adjustment)')
          .eq('user_id', _userId!);

        if (cartError || !cartRows) {
          throw cartError || new Error('Failed to fetch cart rows for sync');
        }

        if (cartRows.length === 0) {
          // If the cart is empty, update the abandoned cart row to indicate empty cart
          await supabase.from('abandoned_carts').upsert({
            user_id: _userId!,
            cart_items: [],
            total_amount: 0,
            status: 'pending',
            last_updated: new Date().toISOString()
          }, { onConflict: 'user_id' });
          return;
        }

        const cartItems = cartRows.map((row: any) => {
          const basePrice = row.product?.price ?? 0;
          const adjustment = row.variant?.price_adjustment ?? 0;
          const price = basePrice + adjustment;
          return {
            product_id: row.product_id,
            variant_id: row.variant_id,
            quantity: row.quantity,
            product_name: row.product?.name ?? 'Unknown',
            price: price
          };
        });

        const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const { error } = await supabase.from('abandoned_carts').upsert({
          user_id: _userId!,
          cart_items: cartItems,
          total_amount: totalAmount,
          status: 'pending',
          last_updated: new Date().toISOString()
        }, { onConflict: 'user_id' });

        if (error) throw error;
      });
    } catch (e) {
      console.error('Error syncing abandoned cart:', e);
    }
  }

  // ─── UI Utilities ─────────────────────────────────────────────────────────

  function open() { isOpen = true; }
  function close() { isOpen = false; }

  return {
    get items() { return items; },
    set items(v) { items = v; },
    get isOpen() { return isOpen; },
    set isOpen(v) { isOpen = v; },
    get count() { return count; },
    get subtotal() { return subtotal; },
    initialize,
    syncOnLogin,
    onLogout,
    loadFromSupabase,
    addItem,
    removeItem,
    updateQty,
    clear,
    checkoutSuccess,
    syncAbandonedCart,
    open,
    close
  };
}

let instance: ReturnType<typeof createCartStore>;
function getInstance() {
  if (!instance) {
    instance = createCartStore();
  }
  return instance;
}

export const cartStore = {
  get items() { return getInstance().items; },
  set items(v) { getInstance().items = v; },
  get isOpen() { return getInstance().isOpen; },
  set isOpen(v) { getInstance().isOpen = v; },
  get count() { return getInstance().count; },
  get subtotal() { return getInstance().subtotal; },
  initialize(rows: any[]) { getInstance().initialize(rows); },
  syncOnLogin(userId: string) { return getInstance().syncOnLogin(userId); },
  onLogout() { return getInstance().onLogout(); },
  loadFromSupabase(userId: string) { return getInstance().loadFromSupabase(userId); },
  addItem(params: Parameters<ReturnType<typeof createCartStore>['addItem']>[0]) { return getInstance().addItem(params); },
  removeItem(id: string) { return getInstance().removeItem(id); },
  updateQty(id: string, quantity: number) { return getInstance().updateQty(id, quantity); },
  clear() { return getInstance().clear(); },
  checkoutSuccess(orderId: string) { return getInstance().checkoutSuccess(orderId); },
  syncAbandonedCart() { return getInstance().syncAbandonedCart(); },
  open() { getInstance().open(); },
  close() { getInstance().close(); }
};
