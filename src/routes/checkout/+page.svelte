<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_RAZORPAY_KEY_ID } from '$env/static/public';
  import type { Address } from '$lib/types';
  import { isValidIndianPhone, isValidPincode } from '$lib/utils/phone';

  // ─── State ────────────────────────────────────────────────────────────────
  let step = $state(1); // 1=address, 2=review, 3=success
  let loading = $state(false);
  let addresses = $state<Address[]>([]);
  let selectedAddressId = $state<string | null>(null);
  let showNewAddressForm = $state(false);
  let couponCode = $state('');
  let couponError = $state('');
  let couponDiscount = $state(0); // paise
  let appliedCoupon = $state<string | null>(null);
  let placedOrderNumber = $state('');
  let placedOrderId = $state('');
  let isNavigatingToSuccess = $state(false);

  // Payment method selection
  let paymentMethod = $state<'cod' | 'razorpay'>('cod');
  let razorpayLoading = $state(false);
  let razorpayScriptLoaded = $state(false);

  // Load Razorpay checkout script
  onMount(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => { razorpayScriptLoaded = true; };
    script.onerror = () => { console.error('Failed to load Razorpay checkout script'); };
    document.body.appendChild(script);
  });

  // New address form
  let newAddr = $state({
    label: 'Home',
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    is_default: false,
  });
  let addrErrors = $state<Record<string, string>>({});

  const INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
    'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
    'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
    'Uttar Pradesh','Uttarakhand','West Bengal',
  ];

  // ─── Price calculations (all in paise) ────────────────────────────────────
  const subtotalPaise = $derived(cartStore.subtotal * 100);
  const shippingPaise = 0;
  const codPaise = 0;
  const gstPaise = 0; // GST removed — prices include all taxes
  const prepaidDiscountPaise = $derived(
    paymentMethod === 'razorpay'
      ? Math.round((subtotalPaise - couponDiscount) * 0.05)
      : 0
  );
  const potentialSavingsPaise = $derived(Math.round((subtotalPaise - couponDiscount) * 0.05));
  const totalPaise = $derived(
    Math.max(0, subtotalPaise - couponDiscount - prepaidDiscountPaise + shippingPaise + codPaise + gstPaise)
  );

  function fmt(paise: number): string {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ─── Auth guard ───────────────────────────────────────────────────────────
  onMount(async () => {
    await authStore.init();
    if (!authStore.user) {
      goto('/auth?redirect=/checkout');
      return;
    }
    if (cartStore.items.length === 0) {
      goto('/shop');
      return;
    }
    await loadAddresses();
  });

  async function loadAddresses() {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', authStore.user!.id)
      .order('is_default', { ascending: false });
    if (data) {
      addresses = data as Address[];
      if (addresses.length > 0) {
        selectedAddressId = addresses.find(a => a.is_default)?.id ?? addresses[0].id;
      } else {
        showNewAddressForm = true;
      }
    }
  }

  // ─── Address form validation ───────────────────────────────────────────────
  function validateAddr(): boolean {
    const e: Record<string, string> = {};
    if (!newAddr.full_name.trim()) e.full_name = 'Full name is required';
    if (!isValidIndianPhone(newAddr.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number';
    if (!newAddr.address_line1.trim()) e.address_line1 = 'Address is required';
    if (!newAddr.city.trim()) e.city = 'City is required';
    if (!newAddr.state) e.state = 'State is required';
    if (!isValidPincode(newAddr.pincode)) e.pincode = 'Enter a valid 6-digit pincode';
    addrErrors = e;
    return Object.keys(e).length === 0;
  }

  async function saveNewAddress(): Promise<Address | null> {
    if (!validateAddr()) return null;
    const { data, error } = await supabase
      .from('addresses')
      .insert({ ...newAddr, user_id: authStore.user!.id })
      .select()
      .single();
    if (error) { uiStore.addToast('Could not save address: ' + error.message, 'error'); return null; }
    return data as Address;
  }

  async function handleAddressNext() {
    if (showNewAddressForm) {
      const saved = await saveNewAddress();
      if (!saved) return;
      addresses = [...addresses, saved];
      selectedAddressId = saved.id;
      showNewAddressForm = false;
    }
    if (!selectedAddressId) { uiStore.addToast('Please select a delivery address', 'error'); return; }
    
    // Check serviceability block
    if (serviceabilityResult && !serviceabilityResult.serviceable && !serviceabilityResult.error) {
      uiStore.addToast('We cannot deliver to the selected pincode. Please choose another address.', 'error');
      return;
    }

    step = 2;
  }

  // ─── Coupon validation ────────────────────────────────────────────────────
  async function applyCoupon() {
    couponError = '';
    if (!couponCode.trim()) return;
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .single();
    if (error || !data) { couponError = 'Invalid or expired coupon code'; return; }
    const c = data as any;
    if (c.valid_until && new Date(c.valid_until) < new Date()) { couponError = 'Coupon has expired'; return; }
    if (subtotalPaise < (c.min_order_value ?? 0)) {
      couponError = `Minimum order ${fmt(c.min_order_value)} required for this coupon`; return;
    }
    let disc = 0;
    if (c.discount_type === 'percentage') {
      disc = Math.round(subtotalPaise * c.discount_value / 100);
      if (c.max_discount_amount && disc > c.max_discount_amount) disc = c.max_discount_amount;
    } else {
      disc = c.discount_value;
    }
    couponDiscount = disc;
    appliedCoupon = c.code;
    uiStore.addToast(`Coupon applied! You saved ${fmt(disc)} 🎉`, 'success');
  }

  function removeCoupon() {
    couponDiscount = 0;
    appliedCoupon = null;
    couponCode = '';
  }

  // ─── Place order (COD) ────────────────────────────────────────────────────
  async function placeOrderCOD() {
    if (loading) return;
    loading = true;
    try {
      const itemsSnapshot = cartStore.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color.name
      }));
      const userId = authStore.user!.id;
      const shippingAddr = addresses.find(a => a.id === selectedAddressId)!;

      // Insert order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          status: 'confirmed',
          payment_method: 'cod',
          payment_status: 'pending',
          subtotal: subtotalPaise,
          discount_amount: couponDiscount,
          shipping_charges: shippingPaise,
          cod_charges: codPaise,
          gst_amount: gstPaise,
          total_amount: totalPaise,
          coupon_code: appliedCoupon,
          shipping_address_id: shippingAddr.id,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // Insert order items
      const items = cartStore.items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.name,
        variant_info: { size: String(item.size), color: item.color.name },
        unit_price: item.price * 100,
        quantity: item.quantity,
        total_price: item.price * item.quantity * 100,
        gst_amount: 0,
        product_image_url: item.image,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(items);
      if (itemsErr) throw itemsErr;

      isNavigatingToSuccess = true;
      // Clear cart and mark abandoned cart as recovered
      await cartStore.checkoutSuccess(order.id);
      uiStore.addToast('Order placed successfully! 🌸', 'success');
      goto(`/checkout/success?order_id=${order.id}`);

      // Push to Shiprocket (fire-and-forget to avoid blocking UI)
      console.log('[Checkout] Pushing COD order to Shiprocket...');
      fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/push-to-shiprocket`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ orderId: order.id })
      })
      .then(res => res.json())
      .then(shiprocketData => {
        if (shiprocketData.success) {
          console.log('[Checkout] Successfully pushed order to Shiprocket:', shiprocketData.shiprocket_order_id);
        } else {
          console.warn('[Checkout] Failed to push order to Shiprocket:', shiprocketData.error);
        }
      })
      .catch((err) => console.error('[Checkout] Shiprocket push error:', err));

      // Send order confirmation email (fire-and-forget)
      fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transactional',
          recipientEmail: authStore.user?.email ?? '',
          recipientName: authStore.profile?.full_name ?? 'Customer',
          payloadData: {
            orderId: order.order_number,
            amount: totalPaise / 100
          }
        })
      }).catch((err) => console.warn('Order confirmation email failed:', err));

      // Send admin notification email (fire-and-forget)
      fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'Checkout',
          details: {
            orderNumber: order.order_number,
            amount: totalPaise / 100,
            customerEmail: authStore.user?.email ?? '',
            customerName: authStore.profile?.full_name ?? 'Customer',
            items: itemsSnapshot
          }
        })
      }).catch((err) => console.warn('Admin checkout notification failed:', err));
    } catch (err: any) {
      uiStore.addToast('Failed to place order: ' + (err?.message ?? 'Unknown error'), 'error');
    } finally {
      loading = false;
    }
  }

  // ─── Place order via Razorpay ─────────────────────────────────────────────
  async function placeOrderRazorpay() {
    if (razorpayLoading || !razorpayScriptLoaded) {
      uiStore.addToast('Payment system loading, please wait...', 'info');
      return;
    }

    razorpayLoading = true;
    try {
      const itemsSnapshot = cartStore.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color.name
      }));
      const userId = authStore.user!.id;
      const receiptId = `ft_${Date.now()}`;
      const shippingAddr = addresses.find(a => a.id === selectedAddressId)!;

      // Step 1: Call Edge Function to create Razorpay order + pending DB row
      console.log('[Razorpay] Creating order via Edge Function...');
      const createRes = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/razorpay-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          amount: totalPaise,
          currency: 'INR',
          receiptId,
          userId,
          shippingAddressId: shippingAddr.id,
          billingAddressId: shippingAddr.id,
          couponCode: appliedCoupon,
          subtotal: subtotalPaise,
          discountAmount: couponDiscount + prepaidDiscountPaise,
          shippingCharges: shippingPaise,
          codCharges: codPaise, // 0 for Razorpay, 4900 for COD
          gstAmount: gstPaise,
          totalAmount: totalPaise,
          items: cartStore.items.map(item => ({
            product_id: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price * 100,
            variant_info: { size: String(item.size), color: item.color.name },
            product_image_url: item.image,
          })),
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error ?? 'Failed to create order');
      }

      console.log('[Razorpay] Order created:', createData.order.id);

      // Step 2: Open Razorpay checkout widget
      const options = {
        key: PUBLIC_RAZORPAY_KEY_ID,
        amount: createData.order.amount,
        currency: createData.order.currency,
        name: 'French Toes',
        description: `Order ${createData.order.receipt}`,
        order_id: createData.order.id,
        handler: async function (response: any) {
          console.log('[Razorpay] Payment completed:', response.razorpay_payment_id);

          // Step 3: Verify payment via Edge Function
          const verifyRes = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/razorpay-verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            isNavigatingToSuccess = true;
            // Clear cart and mark abandoned cart as recovered
            await cartStore.checkoutSuccess(createData.dbOrderId);
            uiStore.addToast('Payment successful! Order confirmed 🌸', 'success');
            goto(`/checkout/success?order_id=${createData.dbOrderId}`);

            // Push to Shiprocket (fire-and-forget to avoid blocking UI)
            console.log('[Checkout] Pushing Razorpay order to Shiprocket...');
            fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/push-to-shiprocket`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({ orderId: createData.dbOrderId })
            })
            .then(res => res.json())
            .then(shiprocketData => {
              if (shiprocketData.success) {
                console.log('[Checkout] Successfully pushed order to Shiprocket:', shiprocketData.shiprocket_order_id);
              } else {
                console.warn('[Checkout] Failed to push order to Shiprocket:', shiprocketData.error);
              }
            })
            .catch((err) => console.error('[Checkout] Shiprocket push error:', err));

            // Send order confirmation email (fire-and-forget)
            fetch('/api/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'transactional',
                recipientEmail: authStore.user?.email ?? '',
                recipientName: authStore.profile?.full_name ?? 'Customer',
                payloadData: {
                  orderId: createData.order.receipt,
                  amount: totalPaise / 100
                }
              })
            }).catch((err) => console.warn('Order confirmation email failed:', err));

            // Send admin notification email (fire-and-forget)
            fetch('/api/notify-admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                eventType: 'Checkout',
                details: {
                  orderNumber: createData.order.receipt,
                  amount: totalPaise / 100,
                  customerEmail: authStore.user?.email ?? '',
                  customerName: authStore.profile?.full_name ?? 'Customer',
                  items: itemsSnapshot
                }
              })
            }).catch((err) => console.warn('Admin checkout notification failed:', err));
          } else {
            uiStore.addToast('Payment verification failed. Please contact support.', 'error');
          }
        },
        prefill: {
          name: authStore.profile?.full_name ?? '',
          email: authStore.user?.email ?? '',
          contact: authStore.profile?.phone ?? '',
        },
        theme: {
          color: '#f4a7c3',
        },
        modal: {
          ondismiss: function () {
            console.log('[Razorpay] Checkout dismissed by user');
            razorpayLoading = false;
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('[Razorpay] Error:', err);
      uiStore.addToast('Payment initiation failed: ' + (err?.message ?? 'Unknown error'), 'error');
    } finally {
      razorpayLoading = false;
    }
  }

  // Unified placeOrder function that routes to the correct handler
  async function placeOrder() {
    if (paymentMethod === 'razorpay') {
      await placeOrderRazorpay();
    } else {
      await placeOrderCOD();
    }
  }

  const selectedAddr = $derived(addresses.find(a => a.id === selectedAddressId));

  // Serviceability State
  let serviceabilityLoading = $state(false);
  let serviceabilityResult = $state<{
    serviceable: boolean;
    cod: boolean;
    etd?: string;
    error?: string;
  } | null>(null);

  // Active pincode selector
  const activePincode = $derived(
    showNewAddressForm 
      ? (newAddr.pincode && newAddr.pincode.length === 6 && /^\d{6}$/.test(newAddr.pincode) ? newAddr.pincode : '')
      : (selectedAddr ? selectedAddr.pincode : '')
  );

  async function checkServiceability(pincode: string) {
    serviceabilityLoading = true;
    serviceabilityResult = null;
    try {
      const res = await fetch(`/api/serviceability?pincode=${pincode}`);
      if (!res.ok) throw new Error('Failed to fetch serviceability');
      const data = await res.json();
      serviceabilityResult = data;
    } catch (err: any) {
      console.error('[Checkout] Serviceability check error:', err);
      // Fallback gracefully to allow checkout in case of API failure
      serviceabilityResult = { serviceable: true, cod: true, error: 'Could not fetch estimated delivery date' };
    } finally {
      serviceabilityLoading = false;
    }
  }

  $effect(() => {
    if (activePincode) {
      checkServiceability(activePincode);
    } else {
      serviceabilityResult = null;
    }
  });

  $effect(() => {
    if (serviceabilityResult && !serviceabilityResult.cod && paymentMethod === 'cod') {
      paymentMethod = 'razorpay';
      uiStore.addToast('COD is not available for this pincode. Switched to online payment.', 'info');
    }
  });

  $effect(() => {
    if (cartStore.items.length === 0 && step < 3 && !isNavigatingToSuccess) {
      goto('/shop');
    }
  });


</script>

<svelte:head>
  <title>Checkout — French Toes</title>
</svelte:head>

<div class="min-h-screen py-8 px-4" style="background: var(--color-warm-white);">
  <div class="max-w-4xl mx-auto">

    <!-- Logo + steps -->
    <div class="text-center mb-8">
      <a href="/" class="inline-flex items-center gap-2 mb-6" aria-label="French Toes Home">
        <img src="/images/logo-bird-brand.png" alt="French Toes Logo" class="w-7 h-7 object-contain" />
        <span class="font-display text-lg font-semibold" style="color: var(--color-text-dark);">French Toes</span>
      </a>
      {#if step < 3}
        <div class="flex items-center justify-center gap-0 mt-2" role="list" aria-label="Checkout steps">
          {#each [
            { num: 1, label: 'Delivery Address' },
            { num: 2, label: 'Review Order' },
          ] as s}
            <div class="flex items-center" role="listitem">
              <div class="flex items-center gap-1.5">
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style="
                    background: {step > s.num ? 'var(--color-mint-deep)' : step === s.num ? 'var(--color-blush-deep)' : 'rgba(0,0,0,0.1)'};
                    color: {step >= s.num ? 'white' : 'rgba(0,0,0,0.4)'};
                  "
                  aria-current={step === s.num ? 'step' : undefined}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <span class="text-xs font-medium hidden sm:block"
                  style="color: {step === s.num ? 'var(--color-text-dark)' : 'var(--color-text-soft)'};">
                  {s.label}
                </span>
              </div>
              {#if s.num < 2}
                <div class="w-8 sm:w-20 h-px mx-2" style="background: {step > s.num ? 'var(--color-mint-deep)' : 'rgba(0,0,0,0.1)'};" aria-hidden="true"></div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- ─── STEP 1: Delivery Address ──────────────────────────────────────── -->
    {#if step === 1}
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div class="lg:col-span-3">
          <h1 class="font-display text-2xl font-bold mb-6" style="color: var(--color-text-dark);">Delivery Address</h1>

          <!-- Saved addresses -->
          {#if addresses.length > 0 && !showNewAddressForm}
            <div class="flex flex-col gap-3 mb-4">
              {#each addresses as addr}
                <label
                  class="flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all"
                  style="border-color: {selectedAddressId === addr.id ? 'var(--color-blush-deep)' : 'var(--color-blush)'}; background: {selectedAddressId === addr.id ? 'var(--color-blush)' : 'white'};"
                >
                  <input type="radio" name="addr" value={addr.id} bind:group={selectedAddressId} class="mt-1 accent-[color:var(--color-blush-deep)]" />
                  <div class="flex-1">
                    <p class="font-semibold text-sm" style="color: var(--color-text-dark);">{addr.full_name} {addr.is_default ? '⭐' : ''}</p>
                    <p class="text-xs mt-0.5" style="color: var(--color-text-mid);">{addr.address_line1}{addr.address_line2 ? ', ' + addr.address_line2 : ''}</p>
                    <p class="text-xs" style="color: var(--color-text-mid);">{addr.city}, {addr.state} – {addr.pincode}</p>
                    <p class="text-xs mt-0.5" style="color: var(--color-text-soft);">📞 {addr.phone}</p>
                  </div>
                  <span class="text-xs px-2 py-0.5 rounded-full shrink-0" style="background: var(--color-blush); color: var(--color-blush-deep);">{addr.label ?? 'Home'}</span>
                </label>
              {/each}
            </div>
            <button
              onclick={() => { showNewAddressForm = true; selectedAddressId = null; }}
              class="flex items-center gap-2 text-sm font-semibold mb-6"
              style="color: var(--color-blush-deep);"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              Add new address
            </button>
          {/if}

          <!-- New address form -->
          {#if showNewAddressForm}
            <div class="rounded-2xl p-5 mb-4 border" style="border-color: var(--color-blush); background: white;">
              <h2 class="font-semibold text-base mb-4" style="color: var(--color-text-dark);">New Address</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label for="na-label" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Label</label>
                    <select id="na-label" bind:value={newAddr.label} class="w-full px-3 py-2.5 rounded-xl border text-sm" style="border-color: var(--color-blush); color: var(--color-text-dark);">
                      <option>Home</option><option>Work</option><option>Other</option>
                    </select>
                  </div>
                  <div class="flex items-end pb-2">
                    <label class="flex items-center gap-2 text-sm cursor-pointer" style="color: var(--color-text-mid);">
                      <input type="checkbox" bind:checked={newAddr.is_default} class="accent-[color:var(--color-blush-deep)]" />
                      Set as default
                    </label>
                  </div>
                </div>
                <div>
                  <label for="na-name" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Full Name *</label>
                  <input id="na-name" bind:value={newAddr.full_name} type="text" placeholder="Priya Sharma" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {addrErrors.full_name ? '#ef4444' : 'var(--color-blush)'}; color: var(--color-text-dark);" />
                  {#if addrErrors.full_name}<p class="text-xs text-red-500 mt-0.5">{addrErrors.full_name}</p>{/if}
                </div>
                <div>
                  <label for="na-phone" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Phone *</label>
                  <input id="na-phone" bind:value={newAddr.phone} type="tel" placeholder="9876543210" maxlength="10" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {addrErrors.phone ? '#ef4444' : 'var(--color-blush)'}; color: var(--color-text-dark);" />
                  {#if addrErrors.phone}<p class="text-xs text-red-500 mt-0.5">{addrErrors.phone}</p>{/if}
                </div>
                <div class="sm:col-span-2">
                  <label for="na-line1" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Address Line 1 *</label>
                  <input id="na-line1" bind:value={newAddr.address_line1} type="text" placeholder="House / Flat / Street No." class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {addrErrors.address_line1 ? '#ef4444' : 'var(--color-blush)'}; color: var(--color-text-dark);" />
                  {#if addrErrors.address_line1}<p class="text-xs text-red-500 mt-0.5">{addrErrors.address_line1}</p>{/if}
                </div>
                <div class="sm:col-span-2">
                  <label for="na-line2" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Address Line 2</label>
                  <input id="na-line2" bind:value={newAddr.address_line2} type="text" placeholder="Area / Landmark" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: var(--color-blush); color: var(--color-text-dark);" />
                </div>
                <div>
                  <label for="na-city" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">City *</label>
                  <input id="na-city" bind:value={newAddr.city} type="text" placeholder="Mumbai" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {addrErrors.city ? '#ef4444' : 'var(--color-blush)'}; color: var(--color-text-dark);" />
                  {#if addrErrors.city}<p class="text-xs text-red-500 mt-0.5">{addrErrors.city}</p>{/if}
                </div>
                <div>
                  <label for="na-pin" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Pincode *</label>
                  <input id="na-pin" bind:value={newAddr.pincode} type="text" maxlength="6" placeholder="400001" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {addrErrors.pincode ? '#ef4444' : 'var(--color-blush)'}; color: var(--color-text-dark);" />
                  {#if addrErrors.pincode}<p class="text-xs text-red-500 mt-0.5">{addrErrors.pincode}</p>{/if}
                </div>
                <div class="sm:col-span-2">
                  <label for="na-state" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">State *</label>
                  <select id="na-state" bind:value={newAddr.state} class="w-full px-3 py-2.5 rounded-xl border text-sm" style="border-color: {addrErrors.state ? '#ef4444' : 'var(--color-blush)'}; color: var(--color-text-dark);">
                    <option value="">Select State</option>
                    {#each INDIAN_STATES as s}<option value={s}>{s}</option>{/each}
                  </select>
                  {#if addrErrors.state}<p class="text-xs text-red-500 mt-0.5">{addrErrors.state}</p>{/if}
                </div>
              </div>
              {#if addresses.length > 0}
                <button onclick={() => { showNewAddressForm = false; selectedAddressId = addresses[0].id; }} class="mt-4 text-sm" style="color: var(--color-text-soft);">
                  ← Use saved address
                </button>
              {/if}
            </div>
          {/if}

          <!-- Serviceability / ETD status display -->
          {#if activePincode}
            <div class="mt-4 p-4 rounded-xl border text-sm transition-all mb-4" style="
              background: {serviceabilityLoading ? 'var(--color-cream)' : serviceabilityResult?.serviceable ? '#f0fdf4' : serviceabilityResult ? '#fef2f2' : 'white'};
              border-color: {serviceabilityLoading ? 'var(--color-blush)' : serviceabilityResult?.serviceable ? '#bbf7d0' : serviceabilityResult ? '#fecaca' : 'var(--color-blush)'};
            ">
              {#if serviceabilityLoading}
                <div class="flex items-center gap-2 text-xs" style="color: var(--color-text-mid);">
                  <span class="inline-block w-4 h-4 border-2 border-[color:var(--color-text-soft)] border-t-transparent rounded-full animate-spin"></span>
                  Calculating estimated delivery date...
                </div>
              {:else if serviceabilityResult}
                {#if serviceabilityResult.serviceable}
                  <div class="flex items-start gap-3">
                    <span class="text-xl">🚚</span>
                    <div>
                      <p class="font-semibold text-green-800 text-sm">Delivery Available</p>
                      <p class="text-xs text-green-700 mt-0.5">
                        Estimated delivery: <strong>{serviceabilityResult.etd}</strong>
                      </p>
                      {#if !serviceabilityResult.cod}
                        <p class="text-xs text-amber-700 mt-1 flex items-center gap-1 font-medium">
                          ⚠️ Cash on Delivery (COD) is not available for this pincode.
                        </p>
                      {/if}
                    </div>
                  </div>
                {:else}
                  <div class="flex items-start gap-3">
                    <span class="text-xl">⚠️</span>
                    <div>
                      <p class="font-semibold text-red-800 text-sm">Unserviceable Location</p>
                      <p class="text-xs text-red-700 mt-0.5">
                        Sorry, we currently do not ship to pincode {activePincode}.
                      </p>
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          {/if}

          <button
            onclick={handleAddressNext}
            class="btn-primary w-full justify-center py-3.5 mt-2"
          >
            Continue to Purchase →
          </button>
        </div>

        <!-- Order mini-summary -->
        <div class="lg:col-span-2">
          <div class="rounded-2xl p-5 sticky top-24 border" style="background: white; border-color: var(--color-blush);">
            <h2 class="font-display font-bold text-base mb-4" style="color: var(--color-text-dark);">Order ({cartStore.count} items)</h2>
            {#each cartStore.items as item (item.id)}
              <div class="flex items-center gap-3 py-3 border-b text-sm" style="border-color: var(--color-blush);">
                <div class="w-10 h-10 rounded-lg overflow-hidden shrink-0" style="background: var(--color-blush);">
                  <img src={item.image} alt={item.name} class="w-full h-full object-cover" loading="lazy" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="truncate font-medium text-xs" style="color: var(--color-text-dark);">{item.name}</p>
                  <p class="text-xs" style="color: var(--color-text-soft);">{item.color.name} · {item.size}</p>
                  <div class="flex items-center gap-1.5 mt-1">
                    <button
                      onclick={() => cartStore.updateQty(item.id, item.quantity - 1)}
                      class="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-colors hover:bg-pink-50"
                      style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
                      aria-label="Decrease quantity"
                    >−</button>
                    <span class="w-5 text-center text-xs font-semibold" style="color: var(--color-text-dark);">{item.quantity}</span>
                    <button
                      onclick={() => cartStore.updateQty(item.id, item.quantity + 1)}
                      class="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold transition-colors hover:bg-pink-50"
                      style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
                      aria-label="Increase quantity"
                    >+</button>
                    <button
                      onclick={() => cartStore.removeItem(item.id)}
                      class="p-0.5 rounded-full transition-colors hover:bg-red-50 ml-0.5"
                      aria-label="Remove {item.name} from cart"
                      style="color: var(--color-text-soft);"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <span class="text-xs font-semibold shrink-0" style="color: var(--color-text-dark);">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
              </div>
            {/each}
            <div class="pt-3 space-y-1.5 text-sm">
              <div class="flex justify-between"><span style="color: var(--color-text-mid);">Subtotal</span><span>{fmt(subtotalPaise)}</span></div>
              <div class="flex justify-between"><span style="color: var(--color-text-mid);">Shipping</span><span style="color: {shippingPaise === 0 ? 'var(--color-mint-deep)' : ''}">{shippingPaise === 0 ? 'FREE 🎉' : fmt(shippingPaise)}</span></div>
              <div class="border-t pt-2 mt-2 flex justify-between font-bold" style="border-color: var(--color-blush);">
                <span style="color: var(--color-text-dark);">Total</span>
                <span class="text-base" style="color: var(--color-text-dark);">{fmt(totalPaise)}</span>
              </div>
              <p class="text-xs mt-2 text-center" style="color: var(--color-text-soft);">Price includes all taxes</p>
            </div>
          </div>
        </div>
      </div>

    <!-- ─── STEP 2: Review Order ────────────────────────────────────────────── -->
    {:else if step === 2}
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div class="lg:col-span-3 flex flex-col gap-6">
          <h1 class="font-display text-2xl font-bold" style="color: var(--color-text-dark);">Review Your Order</h1>

          <!-- Delivery address summary -->
          {#if selectedAddr}
            <div class="rounded-2xl p-4 border" style="border-color: var(--color-blush); background: white;">
              <div class="flex justify-between items-start mb-2">
                <p class="font-semibold text-sm" style="color: var(--color-text-dark);">Delivering to</p>
                <button onclick={() => step = 1} class="text-xs" style="color: var(--color-blush-deep);">Change</button>
              </div>
              <p class="text-sm" style="color: var(--color-text-mid);">{selectedAddr.full_name} · 📞 {selectedAddr.phone}</p>
              <p class="text-sm" style="color: var(--color-text-mid);">{selectedAddr.address_line1}{selectedAddr.address_line2 ? ', ' + selectedAddr.address_line2 : ''}, {selectedAddr.city}, {selectedAddr.state} – {selectedAddr.pincode}</p>
              
              {#if serviceabilityResult?.serviceable && serviceabilityResult?.etd}
                <div class="mt-3 pt-3 border-t flex items-center gap-2 text-xs" style="border-color: var(--color-blush); color: var(--color-mint-deep);">
                  <span>🚚</span>
                  <span>Estimated Delivery: <strong>{serviceabilityResult.etd}</strong></span>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Items -->
          <div class="rounded-2xl overflow-hidden border" style="border-color: var(--color-blush);">
            <div class="px-4 py-3 border-b flex justify-between items-center" style="border-color: var(--color-blush); background: var(--color-blush);">
              <p class="font-semibold text-sm" style="color: var(--color-text-dark);">Order Items ({cartStore.count})</p>
              <a href="/cart" class="text-xs" style="color: var(--color-blush-deep);">Edit</a>
            </div>
            {#each cartStore.items as item (item.id)}
              <div class="flex items-center gap-4 p-4 border-b last:border-b-0" style="border-color: var(--color-blush);">
                <div class="w-14 h-14 rounded-xl overflow-hidden shrink-0" style="background: var(--color-blush);">
                  <img src={item.image} alt={item.name} class="w-full h-full object-cover" loading="lazy" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm truncate" style="color: var(--color-text-dark);">{item.name}</p>
                  <p class="text-xs mt-0.5" style="color: var(--color-text-soft);">
                    <span class="inline-block w-3 h-3 rounded-full mr-1 align-middle" style="background:{item.color.hex};"></span>
                    {item.color.name} · Size {item.size}
                  </p>
                  <div class="flex items-center gap-2 mt-2">
                    <div class="flex items-center gap-1">
                      <button
                        onclick={() => cartStore.updateQty(item.id, item.quantity - 1)}
                        class="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold transition-colors hover:bg-pink-50"
                        style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
                        aria-label="Decrease quantity"
                      >−</button>
                      <span class="w-6 text-center text-sm font-semibold" style="color: var(--color-text-dark);">{item.quantity}</span>
                      <button
                        onclick={() => cartStore.updateQty(item.id, item.quantity + 1)}
                        class="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold transition-colors hover:bg-pink-50"
                        style="border-color: var(--color-blush-deep); color: var(--color-blush-deep);"
                        aria-label="Increase quantity"
                      >+</button>
                    </div>
                    <button
                      onclick={() => cartStore.removeItem(item.id)}
                      class="p-1 rounded-full transition-colors hover:bg-red-50"
                      aria-label="Remove {item.name} from cart"
                      style="color: var(--color-text-soft);"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-sm font-bold" style="color: var(--color-text-dark);">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                  <p class="text-xs" style="color: var(--color-text-soft);">₹{item.price.toLocaleString('en-IN')} each</p>
                </div>
              </div>
            {/each}
          </div>

          <!-- Coupon -->
          <div class="rounded-2xl p-4 border" style="border-color: var(--color-blush); background: white;">
            <p class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Have a coupon? 🏷️</p>
            {#if appliedCoupon}
              <div class="flex items-center justify-between px-3 py-2 rounded-xl" style="background: var(--color-mint); color: var(--color-text-dark);">
                <span class="text-sm font-semibold">✓ {appliedCoupon} — saved {fmt(couponDiscount)}</span>
                <button onclick={removeCoupon} class="text-xs opacity-70 hover:opacity-100">Remove</button>
              </div>
            {:else}
              <div class="flex gap-2">
                <input
                  type="text"
                  bind:value={couponCode}
                  placeholder="Enter coupon code"
                  class="flex-1 px-3 py-2.5 rounded-xl border text-sm outline-none"
                  style="border-color: {couponError ? '#ef4444' : 'var(--color-blush)'}; color: var(--color-text-dark);"
                  onkeydown={(e) => e.key === 'Enter' && applyCoupon()}
                />
                <button onclick={applyCoupon} class="btn-outline px-4 py-2 text-sm">Apply</button>
              </div>
              {#if couponError}<p class="text-xs text-red-500 mt-1">{couponError}</p>{/if}
            {/if}
          </div>

          <!-- Payment method selection -->
          <div class="rounded-2xl p-4 border" style="border-color: var(--color-blush); background: white;">
            <p class="font-semibold text-sm mb-3" style="color: var(--color-text-dark);">Payment Method</p>
            <div class="flex flex-col gap-3">
              <!-- COD option -->
              {#if serviceabilityResult?.cod !== false}
                <label
                  class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  style="background: {paymentMethod === 'cod' ? 'var(--color-blush)' : 'white'}; border-color: {paymentMethod === 'cod' ? 'var(--color-blush-deep)' : 'var(--color-blush)'}; border-width: 2px; border-style: solid;"
                >
                  <input type="radio" name="payment" value="cod" bind:group={paymentMethod} class="accent-[color:var(--color-blush-deep)]" />
                  <span class="text-xl">💵</span>
                  <div>
                    <p class="font-semibold text-sm" style="color: var(--color-text-dark);">Cash on Delivery</p>
                    <p class="text-xs" style="color: var(--color-text-soft);">Pay when your order arrives</p>
                  </div>
                </label>
              {:else}
                <div
                  class="flex items-center gap-3 p-3 rounded-xl opacity-60 border-2 border-dashed border-gray-200 bg-gray-50 cursor-not-allowed"
                >
                  <span class="text-xl">💵</span>
                  <div>
                    <p class="font-semibold text-sm text-gray-500">Cash on Delivery (Unavailable)</p>
                    <p class="text-xs text-red-500 font-medium">Not available for pincode {activePincode}</p>
                  </div>
                </div>
              {/if}
              <!-- Razorpay option -->
              <label
                class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all relative overflow-hidden"
                style="background: {paymentMethod === 'razorpay' ? 'var(--color-blush)' : 'white'}; border-color: {paymentMethod === 'razorpay' ? 'var(--color-blush-deep)' : 'var(--color-blush)'}; border-width: 2px; border-style: solid;"
              >
                <input type="radio" name="payment" value="razorpay" bind:group={paymentMethod} class="accent-[color:var(--color-blush-deep)]" />
                <span class="text-xl">💳</span>
                <div class="flex-1">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <p class="font-semibold text-sm" style="color: var(--color-text-dark);">Online Payment (Razorpay)</p>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style="background: var(--color-mint-deep); color: white;">
                      ⚡ 5% EXTRA OFF
                    </span>
                  </div>
                  <p class="text-xs" style="color: var(--color-text-soft);">UPI, Cards, Net Banking, Wallets</p>
                </div>
              </label>

              <!-- Prepaid Switch Nudge -->
              {#if paymentMethod === 'cod'}
                <button
                  type="button"
                  onclick={() => { paymentMethod = 'razorpay'; }}
                  class="flex items-center gap-3 p-3.5 rounded-xl text-left border cursor-pointer transition-all hover:bg-green-50/50 anim-fade-up"
                  style="border-color: var(--color-mint-deep); background: #f0fdf4;"
                >
                  <span class="text-xl">🎉</span>
                  <div class="flex-1">
                    <p class="text-xs font-bold text-green-800">Switch to Online Payment & Save {fmt(potentialSavingsPaise)}!</p>
                    <p class="text-[10px] text-green-700 mt-0.5">Get an additional 5% off on your order instantly.</p>
                  </div>
                  <span class="text-xs font-semibold px-2.5 py-1 rounded-full text-white bg-green-600 hover:bg-green-700 shrink-0">
                    Apply 5% Off
                  </span>
                </button>
              {/if}
            </div>
          </div>

          <div class="space-y-4">
            <div class="p-3.5 rounded-xl text-xs leading-relaxed border text-amber-800 bg-amber-50 border-amber-200 shadow-sm">
              ⚠️ <strong>Testing Mode Notice:</strong> This website is currently in testing mode. All orders and products (including ₹10 items) are for verification and testing only. No real shipments or deliveries will be made.
            </div>

            <div class="flex gap-3">
              <button onclick={() => step = 1} class="btn-outline px-6 py-3">← Back</button>
              <button onclick={placeOrder} disabled={loading} class="btn-primary flex-1 justify-center py-3.5 text-base">
                {#if loading}
                  <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  Placing order...
                {:else}
                  🌸 Place Order — {fmt(totalPaise)}
                {/if}
              </button>
            </div>
          </div>
        </div>

        <!-- Price breakdown -->
        <div class="lg:col-span-2">
          <div class="rounded-2xl p-5 sticky top-24 border" style="background: white; border-color: var(--color-blush);">
            <h2 class="font-display font-bold text-base mb-4" style="color: var(--color-text-dark);">Price Details</h2>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span style="color: var(--color-text-mid);">Subtotal ({cartStore.count} items)</span><span>{fmt(subtotalPaise)}</span></div>
              {#if couponDiscount > 0}
                <div class="flex justify-between" style="color: var(--color-mint-deep);"><span>Coupon Discount</span><span>−{fmt(couponDiscount)}</span></div>
              {/if}
              {#if prepaidDiscountPaise > 0}
                <div class="flex justify-between" style="color: var(--color-mint-deep);"><span>Prepaid Discount (5% Off)</span><span>−{fmt(prepaidDiscountPaise)}</span></div>
              {/if}
              <div class="flex justify-between"><span style="color: var(--color-text-mid);">Shipping</span><span style="color: {shippingPaise === 0 ? 'var(--color-mint-deep)' : ''}">{shippingPaise === 0 ? 'FREE' : fmt(shippingPaise)}</span></div>
            </div>
            <div class="border-t pt-3 mt-3 flex justify-between font-bold" style="border-color: var(--color-blush);">
              <span style="color: var(--color-text-dark);">Total Amount</span>
              <span class="text-lg" style="color: var(--color-text-dark);">{fmt(totalPaise)}</span>
            </div>
            <p class="text-xs mt-3 p-2 rounded-lg text-center" style="background: var(--color-blush); color: var(--color-text-mid);">
              🔒 Your order is safe. Price includes all taxes.
            </p>
          </div>
        </div>
      </div>
    {/if}

  </div>
</div>
