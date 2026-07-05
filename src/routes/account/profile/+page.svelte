<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { isValidIndianPhone } from '$lib/utils/phone';

  let saving = $state(false);
  let editMode = $state(false);
  let form = $state({ full_name: '', phone: '', preferred_language: 'en', marketing_consent: false, whatsapp_updates: false });
  let errors = $state<Record<string, string>>({});

  // Computed stats from orders table (not relying on stale profile columns)
  let totalOrders = $state(0);
  let totalSpent = $state(0); // paise
  let lastOrderAt = $state<string | null>(null);

  onMount(async () => {
    if (authStore.profile) syncForm();
    if (authStore.user) await loadStats();
  });

  $effect(() => {
    if (authStore.profile) syncForm();
  });

  async function loadStats() {
    // Fetch order count and total spent
    const { data: orderStats, error: statsError } = await supabase
      .from('orders')
      .select('total_amount, status, created_at')
      .eq('user_id', authStore.user!.id);

    if (!statsError && orderStats) {
      totalOrders = orderStats.length;
      totalSpent = orderStats
        .filter(o => o.status !== 'cancelled' && o.status !== 'refunded')
        .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
      // Find last order date
      const sorted = [...orderStats].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      lastOrderAt = sorted.length > 0 ? sorted[0].created_at : null;
    }
  }

  function syncForm() {
    const p = authStore.profile!;
    form = {
      full_name: p.full_name ?? '',
      phone: p.phone ?? '',
      preferred_language: p.preferred_language ?? 'en',
      marketing_consent: p.marketing_consent,
      whatsapp_updates: p.whatsapp_updates,
    };
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'Name is required';
    if (form.phone && !isValidIndianPhone(form.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number';
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function saveProfile() {
    if (!validate()) return;
    saving = true;
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        phone: form.phone || null,
        preferred_language: form.preferred_language,
        marketing_consent: form.marketing_consent,
        whatsapp_updates: form.whatsapp_updates,
      })
      .eq('id', authStore.user!.id);
    saving = false;
    if (error) { uiStore.addToast('Failed to save: ' + error.message, 'error'); return; }
    // Refresh profile
    const { data } = await supabase.from('profiles').select('*').eq('id', authStore.user!.id).single();
    if (data) authStore.profile = data as any;
    editMode = false;
    uiStore.addToast('Profile updated! ✨', 'success');
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function formatPrice(paise: number) {
    return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
</script>

<svelte:head><title>My Profile — French Toes</title></svelte:head>

{#if authStore.profile}
  {@const p = authStore.profile}
  <div class="flex flex-col gap-6">

    <!-- Profile card -->
    <div class="rounded-2xl p-6 border" style="background: white; border-color: var(--color-blush);">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0" style="background: var(--color-blush); color: var(--color-blush-deep);">
            {authStore.initials}
          </div>
          <div>
            <h2 class="font-display text-xl font-bold" style="color: var(--color-text-dark);">{p.full_name ?? 'No name set'}</h2>
            <p class="text-sm" style="color: var(--color-text-soft);">{p.email}</p>
            <p class="text-xs mt-0.5" style="color: var(--color-text-soft);">Member since {formatDate(p.created_at)}</p>
          </div>
        </div>
        <button onclick={() => editMode = !editMode} class="btn-outline px-4 py-2 text-sm">
          {editMode ? 'Cancel' : '✏️ Edit'}
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4 mt-4">
        <div class="text-center p-3 rounded-xl" style="background: var(--color-blush);">
          <p class="font-bold text-lg" style="color: var(--color-blush-deep);">{totalOrders}</p>
          <p class="text-xs mt-0.5" style="color: var(--color-text-mid);">Total Orders</p>
        </div>
        <div class="text-center p-3 rounded-xl" style="background: var(--color-blush);">
          <p class="font-bold text-lg" style="color: var(--color-blush-deep);">{formatPrice(totalSpent)}</p>
          <p class="text-xs mt-0.5" style="color: var(--color-text-mid);">Total Spent</p>
        </div>
        <div class="text-center p-3 rounded-xl" style="background: var(--color-blush);">
          <p class="font-bold text-lg" style="color: var(--color-blush-deep);">{Math.floor(totalSpent / 10000)} pts</p>
          <p class="text-xs mt-0.5" style="color: var(--color-text-mid);">Loyalty Points</p>
        </div>
      </div>
    </div>

    <!-- Edit form -->
    {#if editMode}
      <div class="rounded-2xl p-6 border" style="background: white; border-color: var(--color-blush);">
        <h3 class="font-display text-lg font-bold mb-4" style="color: var(--color-text-dark);">Edit Profile</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="p-name" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Full Name *</label>
            <input id="p-name" bind:value={form.full_name} type="text" class="w-full px-4 py-3 rounded-xl border text-sm outline-none" style="border-color: {errors.full_name ? '#ef4444' : 'var(--color-blush)'};" />
            {#if errors.full_name}<p class="text-xs text-red-500 mt-0.5">{errors.full_name}</p>{/if}
          </div>
          <div>
            <label for="p-phone" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Phone</label>
            <input id="p-phone" bind:value={form.phone} type="tel" maxlength="10" placeholder="9876543210" class="w-full px-4 py-3 rounded-xl border text-sm outline-none" style="border-color: {errors.phone ? '#ef4444' : 'var(--color-blush)'};" />
            {#if errors.phone}<p class="text-xs text-red-500 mt-0.5">{errors.phone}</p>{/if}
          </div>
          <div>
            <label for="p-lang" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Preferred Language</label>
            <select id="p-lang" bind:value={form.preferred_language} class="w-full px-4 py-3 rounded-xl border text-sm" style="border-color: var(--color-blush);">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
            </select>
          </div>
          <div class="flex flex-col gap-2 justify-center">
            <label class="flex items-center gap-2 text-sm cursor-pointer" style="color: var(--color-text-mid);">
              <input type="checkbox" bind:checked={form.marketing_consent} class="accent-[color:var(--color-blush-deep)]" />
              Email marketing updates
            </label>
            <label class="flex items-center gap-2 text-sm cursor-pointer" style="color: var(--color-text-mid);">
              <input type="checkbox" bind:checked={form.whatsapp_updates} class="accent-[color:var(--color-blush-deep)]" />
              WhatsApp order updates
            </label>
          </div>
        </div>
        <button onclick={saveProfile} disabled={saving} class="btn-primary mt-4 px-8 py-3">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    {/if}

    <!-- Account info -->
    <div class="rounded-2xl p-6 border" style="background: white; border-color: var(--color-blush);">
      <h3 class="font-semibold text-base mb-4" style="color: var(--color-text-dark);">Account Details</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {#each [
          { label: 'Email', value: p.email ?? '—' },
          { label: 'Phone', value: p.phone ?? '—' },
          { label: 'Role', value: p.role === 'admin' ? '👑 Admin' : '🛍️ Customer' },
          { label: 'Last Order', value: lastOrderAt ? formatDate(lastOrderAt) : '—' },
        ] as row}
          <div>
            <p class="text-xs font-semibold mb-0.5" style="color: var(--color-text-soft);">{row.label}</p>
            <p style="color: var(--color-text-dark);">{row.value}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Quick links -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {#each [
        { href: '/account/orders', icon: '📦', label: 'My Orders' },
        { href: '/account/addresses', icon: '📍', label: 'Addresses' },
        { href: '/account/wishlist', icon: '❤️', label: 'Wishlist' },
        { href: '/shop', icon: '🛍️', label: 'Shop Now' },
      ] as link}
        <a href={link.href} class="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md text-sm font-medium" style="border-color: var(--color-blush); background: white; color: var(--color-text-dark);">
          <span class="text-2xl">{link.icon}</span>
          {link.label}
        </a>
      {/each}
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center py-20">
    <div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color: var(--color-blush); border-top-color: var(--color-blush-deep);"></div>
  </div>
{/if}
