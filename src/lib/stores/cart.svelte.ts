// ─── Cart Store — Svelte 5 Runes (Functional Closure) ───────────────────────────
import type { CartItem, ColorVariant } from '$lib/types';
import { supabase } from '$lib/supabaseClient';
import { uiStore } from '$lib/stores/ui.svelte';
import { canonicalizeSize } from '$lib/sizes';

export const MAX_QTY_PER_ITEM = 5;

/** Canonical size key — every variant line is distinct per (product, variant, size) */
function sizeKey(size: number | string | null | undefined): string {
  if (size === null || size === undefined || size === '') return '38';
  return canonicalizeSize(size);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guard against composite display ids like "<uuid>_BEIGE" — keep only the uuid part */
function sanitizeProductId(id: string): string {
  if (!id) return id;
  if (UUID_RE.test(id)) return id;
  const head = id.split('_')[0];
  if (UUID_RE.test(head)) return head;
  return id;
}

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

  function _loadLocalMeta(): Record<string, { size: number; color: ColorVariant }> {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('ft_cart_meta');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  function _saveLocalMeta(key: string, meta: { size: number; color: ColorVariant }) {
    if (typeof window === 'undefined') return;
    try {
      const current = _loadLocalMeta();
      current[key] = meta;
      localStorage.setItem('ft_cart_meta', JSON.stringify(current));
    } catch (e) {
      console.error('Error saving local cart meta:', e);
    }
  }

  function _deleteLocalMeta(keys: string[]) {
    if (typeof window === 'undefined') return;
    try {
      const current = _loadLocalMeta();
      let changed = false;
      for (const k of keys) {
        if (k && k in current) { delete current[k]; changed = true; }
      }
      if (changed) localStorage.setItem('ft_cart_meta', JSON.stringify(current));
    } catch (e) {
      console.error('Error cleaning local cart meta:', e);
    }
  }

  // ─── Known Image Cache ───────────────────────────────────────────────────
  const _knownImagesMem: Record<string, string> = {};

  function _saveKnownImage(productId: string, colorName: string | undefined, imageUrl: string | undefined) {
    if (!imageUrl || imageUrl === '/placeholder.jpg') return;
    const cleanPid = sanitizeProductId(productId);
    _knownImagesMem[cleanPid] = imageUrl;
    if (colorName) {
      _knownImagesMem[`${cleanPid}_${colorName.toLowerCase().trim()}`] = imageUrl;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('ft_known_images') || '{}');
        stored[cleanPid] = imageUrl;
        if (colorName) stored[`${cleanPid}_${colorName.toLowerCase().trim()}`] = imageUrl;
        localStorage.setItem('ft_known_images', JSON.stringify(stored));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }

  function _getKnownImage(productId: string, colorName: string | undefined): string {
    const cleanPid = sanitizeProductId(productId);
    if (colorName && _knownImagesMem[`${cleanPid}_${colorName.toLowerCase().trim()}`]) {
      return _knownImagesMem[`${cleanPid}_${colorName.toLowerCase().trim()}`];
    }
    if (_knownImagesMem[cleanPid]) {
      return _knownImagesMem[cleanPid];
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('ft_known_images') || '{}');
        if (colorName && stored[`${cleanPid}_${colorName.toLowerCase().trim()}`]) {
          return stored[`${cleanPid}_${colorName.toLowerCase().trim()}`];
        }
        if (stored[cleanPid]) return stored[cleanPid];
      } catch (e) {
        // Ignore
      }
    }
    return '';
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
            const rowSize = sizeKey(item.size);
            // SKU-first: resolve variant + canonical sku from product+size+color
            let variantId: string | null = item.variantId ?? null;
            let itemSku: string | null = item.sku ?? null;
            if (!itemSku || !variantId) {
              try {
                const res = await fetch('/api/variants/resolve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ productId: item.productId, size: rowSize, color: item.color.name, ...(itemSku ? { sku: itemSku } : {}) })
                });
                if (res.ok) {
                  const data = await res.json();
                  itemSku = data.sku ?? itemSku;
                  variantId = data.variantId ?? variantId;
                }
              } catch (e) {
                console.warn('[Cart] Variant resolution failed during merge:', e);
              }
            }

            // SKU identity for the merged row
            const mergeSku = itemSku || `${item.productId}-${item.color.name}-${rowSize}`.toLowerCase().replace(/[^a-z0-9-]/gi, '-');

            // Find existing row by (product_id, variant_id, size) or (sku)
            let mergeQuery = supabase
              .from('cart')
              .select('id, quantity')
              .eq('user_id', userId)
              .eq('product_id', item.productId)
              .eq('size', rowSize);

            if (variantId) {
              mergeQuery = mergeQuery.eq('variant_id', variantId);
            } else {
              mergeQuery = mergeQuery.is('variant_id', null);
            }

            let { data: existingRows } = await mergeQuery;

            if ((!existingRows || existingRows.length === 0) && mergeSku) {
              const { data: skuRows } = await supabase
                .from('cart')
                .select('id, quantity')
                .eq('user_id', userId)
                .eq('sku', mergeSku);
              if (skuRows && skuRows.length > 0) {
                existingRows = skuRows;
              }
            }

            if (existingRows && existingRows.length > 0) {
              const newQty = Math.min(existingRows[0].quantity + item.quantity, MAX_QTY_PER_ITEM);
              await supabase
                .from('cart')
                .update({ quantity: newQty, sku: mergeSku })
                .eq('id', existingRows[0].id);
            } else {
              const { error: insertError } = await supabase
                .from('cart')
                .insert({
                  user_id: userId,
                  product_id: item.productId,
                  variant_id: variantId,
                  sku: mergeSku,
                  size: rowSize,
                  quantity: Math.min(item.quantity, MAX_QTY_PER_ITEM)
                });
              if (insertError && insertError.code === '23505') {
                const { data: retryRows } = await supabase
                  .from('cart')
                  .select('id, quantity')
                  .eq('user_id', userId)
                  .eq('product_id', item.productId)
                  .eq('size', rowSize);
                if (retryRows && retryRows.length > 0) {
                  const newQty = Math.min(retryRows[0].quantity + item.quantity, MAX_QTY_PER_ITEM);
                  await supabase.from('cart').update({ quantity: newQty }).eq('id', retryRows[0].id);
                }
              }
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
          .select(`
            *,
            product:product_id(id, slug, name, base_price, description, brand, category, variants:product_variants(*, images:product_images(*))),
            variant:variant_id(*, images:product_images(*))
          `)
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

      const matchedColor: ColorVariant = {
        // Show the admin-defined color name verbatim; fall back through variant columns
        name: v?.color_name || v?.color || 'Default',
        hex: v?.color_hex || '#f4a7c3'
      };

      // Determine product image directly from variant images or cached image
      let imgUrl = '';
      if (v?.images && Array.isArray(v.images) && v.images.length > 0) {
        const primary = v.images.find((img: any) => img.is_primary) || v.images[0];
        imgUrl = primary?.image_url || primary?.url || '';
      }
      if (!imgUrl && v?.image_url) {
        imgUrl = v.image_url;
      }
      // If variant has no direct images, check product's color variants
      if (!imgUrl && p?.variants && Array.isArray(p.variants) && p.variants.length > 0) {
        const colorName = matchedColor.name.toLowerCase().trim();
        const matchedVar = (colorName ? p.variants.find((pv: any) => (pv.color_name || pv.color || '').toLowerCase().trim() === colorName) : null)
          || p.variants.find((pv: any) => pv.is_default)
          || p.variants[0];
        if (matchedVar?.images && Array.isArray(matchedVar.images) && matchedVar.images.length > 0) {
          const primary = matchedVar.images.find((img: any) => img.is_primary) || matchedVar.images[0];
          imgUrl = primary?.image_url || primary?.url || '';
        }
      }
      // Fallback to exact image passed when item was added
      if (!imgUrl) {
        imgUrl = _getKnownImage(p.id, matchedColor.name);
      }
      if (!imgUrl) {
        imgUrl = '/images/festive/story_wedges.jpg';
      }

      // Row size is authoritative (stored per cart row); fall back to variant size
      const rowSize = Number(sizeKey(row.size ?? v?.size ?? 38));

      // Price in rupees: variant price_override wins over base price
      const basePriceNum = Number(p.base_price || 0);
      const variantPrice = v?.price_override !== null && v?.price_override !== undefined && v?.price_override !== ''
        ? Number(v.price_override)
        : basePriceNum;

      return {
        id: row.id,
        productId: p.id,
        variantId: row.variant_id ?? null,
        sku: row.sku || v?.sku || undefined,
        slug: p.slug,
        name: p.name,
        image: imgUrl,
        price: variantPrice,
        originalPrice: undefined,
        color: matchedColor,
        size: isNaN(rowSize) ? 38 : rowSize,
        quantity: Math.min(row.quantity || 1, MAX_QTY_PER_ITEM),
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
    sku?: string | null;
  }) {
    const { slug, name, image, price, originalPrice, color, size, quantity = 1 } = params;
    // Guard: some callers pass composite display ids ("<uuid>_ColorName") — keep the uuid part
    const productId = sanitizeProductId(params.productId);
    _saveKnownImage(productId, color?.name, image);

    // Per-variant identity: same product but different color/size = different line
    const isSameLine = (item: CartItem) =>
      item.productId === productId &&
      item.color.name.toLowerCase() === color.name.toLowerCase() &&
      sizeKey(item.size) === sizeKey(size);

    // Check existing quantity for this variant line
    const existing = items.find(isSameLine);
    const existingQty = existing ? existing.quantity : 0;

    if (existingQty >= MAX_QTY_PER_ITEM) {
      uiStore.addToast(`Maximum limit of ${MAX_QTY_PER_ITEM} pairs per item reached.`, 'info');
      return;
    }

    const qtyToAdd = Math.max(1, Math.min(quantity, MAX_QTY_PER_ITEM - existingQty));

    if (!_userId) {
      // Local storage mode for anonymous users
      const localItems = _loadLocalCart();
      const existingIndex = localItems.findIndex(isSameLine);

      if (existingIndex > -1) {
        localItems[existingIndex].quantity = Math.min(localItems[existingIndex].quantity + qtyToAdd, MAX_QTY_PER_ITEM);
        localItems[existingIndex].variantId = params.variantId ?? localItems[existingIndex].variantId ?? null;
        localItems[existingIndex].image = image || localItems[existingIndex].image;
        localItems[existingIndex].price = price;
      } else {
        const id = `anon-${productId}-${color.name.toLowerCase()}-${sizeKey(size)}`;
        localItems.push({
          id,
          productId,
          slug,
          name,
          image,
          price,
          originalPrice,
          color,
          size: Number(sizeKey(size)),
          quantity: qtyToAdd,
          variantId: params.variantId ?? null,
          sku: params.sku ?? undefined
        });
      }

      items = localItems;
      _saveLocalCart(localItems);
      return;
    }

    // Authenticated Database mode — one row per (user, sku); SKU is the global identity
    try {
      await _runWithRetry(async () => {
        let sku = params.sku ?? null;
        let variantId = params.variantId ?? null;
        const normalizedSize = sizeKey(size);

        // Ensure we always resolve the exact size-specific 8-digit SKU
        if (!sku || sku.length !== 8 || isNaN(Number(sku)) || !variantId) {
          try {
            const res = await fetch('/api/variants/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId, size: normalizedSize, color: color.name })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.sku) sku = data.sku;
              if (data.variantId) variantId = data.variantId;
            }
          } catch (e) {
            console.warn('[Cart] Variant resolution failed, continuing without variant:', e);
          }
        }

        // SKU identity: deterministic fallback keeps distinct lines even without a variant row
        const lineSku = sku || `${productId}-${color.name}-${normalizedSize}`.toLowerCase().replace(/[^a-z0-9-]/gi, '-');

        // Look for an existing row for THIS product + variant + size
        let query = supabase
          .from('cart')
          .select('id, quantity')
          .eq('user_id', _userId!)
          .eq('product_id', productId)
          .eq('size', normalizedSize);

        if (variantId) {
          query = query.eq('variant_id', variantId);
        } else {
          query = query.is('variant_id', null);
        }

        let { data: existingRows } = await query;

        // Also check by lineSku as secondary check
        if ((!existingRows || existingRows.length === 0) && lineSku) {
          const { data: skuRows } = await supabase
            .from('cart')
            .select('id, quantity')
            .eq('user_id', _userId!)
            .eq('sku', lineSku);
          if (skuRows && skuRows.length > 0) {
            existingRows = skuRows;
          }
        }

        if (existingRows && existingRows.length > 0) {
          // Update quantity (capped at MAX_QTY_PER_ITEM)
          const newQty = Math.min(existingRows[0].quantity + qtyToAdd, MAX_QTY_PER_ITEM);
          const { error: updateError } = await supabase
            .from('cart')
            .update({ quantity: newQty, sku: lineSku })
            .eq('id', existingRows[0].id);

          if (updateError) throw updateError;
        } else {
          // Insert a NEW distinct row carrying size + variant
          const { error: insertError } = await supabase
            .from('cart')
            .insert({
              user_id: _userId!,
              product_id: productId,
              variant_id: variantId,
              sku: lineSku,
              size: normalizedSize,
              quantity: qtyToAdd
            });

          if (insertError) {
            if (insertError.code === '23505') {
              const { data: retryRows } = await supabase
                .from('cart')
                .select('id, quantity')
                .eq('user_id', _userId!)
                .eq('product_id', productId)
                .eq('size', normalizedSize);
              if (retryRows && retryRows.length > 0) {
                const newQty = Math.min(retryRows[0].quantity + qtyToAdd, MAX_QTY_PER_ITEM);
                await supabase.from('cart').update({ quantity: newQty }).eq('id', retryRows[0].id);
              }
            } else {
              throw insertError;
            }
          }
        }
      });

      // Reload latest state from Supabase
      await loadFromSupabase(_userId);

      // Background abandoned cart sync (non-blocking)
      syncAbandonedCart().catch(() => {});
    } catch (e) {
      console.error('Error adding item to cart:', e);
      uiStore.addToast('Could not add to cart. Please try again.', 'error');
    }
  }

  async function removeItem(id: string) {
    // Optimistic local UI update immediately
    const previousItems = [...items];
    items = items.filter((item) => item.id !== id);
    _deleteLocalMeta([id]);

    if (!_userId) {
      _saveLocalCart(items);
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

      // Background abandoned cart sync
      syncAbandonedCart().catch(() => {});
    } catch (e) {
      console.error('Error removing cart item:', e);
      items = previousItems;
      await loadFromSupabase(_userId);
    }
  }

  async function updateQty(id: string, quantity: number) {
    if (quantity > MAX_QTY_PER_ITEM) {
      uiStore.addToast(`Maximum limit of ${MAX_QTY_PER_ITEM} pairs per item.`, 'info');
      quantity = MAX_QTY_PER_ITEM;
    }

    if (quantity < 1) {
      await removeItem(id);
      return;
    }

    // Optimistic local UI update immediately
    const previousItems = [...items];
    items = items.map((item) => (item.id === id ? { ...item, quantity } : item));

    if (!_userId) {
      _saveLocalCart(items);
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

      // Background abandoned cart sync
      syncAbandonedCart().catch(() => {});
    } catch (e) {
      console.error('Error updating cart quantity:', e);
      items = previousItems;
      await loadFromSupabase(_userId);
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
        
        // Update abandoned_carts to recovered via server endpoint
        try {
          await fetch('/api/cart/abandoned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: _userId,
              status: 'recovered',
              recovered: true,
              recoveredOrderId: orderId
            })
          });
        } catch (recoveryError) {
          // Non-blocking
        }
      });
      items = [];
    } catch (e) {
      console.error('Error clearing cart on checkout success:', e);
    }
  }

  // ─── Abandoned Cart Synchronization ───────────────────────────────────────

  async function syncAbandonedCart() {
    if (!_userId) return;

    try {
      // Fetch current cart items from the database to ensure we have the most fresh state
      const { data: cartRows, error: cartError } = await supabase
        .from('cart')
        .select('*, product:product_id(id, name, base_price), variant:variant_id(id, price_override)')
        .eq('user_id', _userId!);

      if (cartError || !cartRows) return;

      const cartItems = cartRows.map((row: any) => {
        // Variant price_override wins; else base price. Stored in rupees.
        const price = row.variant?.price_override !== null && row.variant?.price_override !== undefined && row.variant?.price_override !== ''
          ? Number(row.variant.price_override)
          : Number(row.product?.base_price ?? 0);
        return {
          product_id: row.product_id,
          variant_id: row.variant_id,
          sku: row.sku ?? row.variant?.sku ?? null,
          quantity: row.quantity,
          size: row.size ?? null,
          product_name: row.product?.name ?? 'Unknown',
          price: price
        };
      });

      const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Call server endpoint (uses supabaseAdmin to avoid client RLS 403 errors)
      await fetch('/api/cart/abandoned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: _userId,
          cartItems,
          totalAmount,
          status: 'pending'
        })
      });
    } catch (e) {
      // Silently catch background sync notes
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
