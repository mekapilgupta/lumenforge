<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Address } from '$lib/types';
  import { isValidIndianPhone, isValidPincode } from '$lib/utils/phone';

  let addresses = $state<Address[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let editId = $state<string | null>(null);
  let saving = $state(false);
  let deleting = $state<string | null>(null);

  const emptyForm = () => ({ label: 'Home', full_name: '', phone: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', country: 'India', is_default: false });
  let form = $state(emptyForm());
  let errors = $state<Record<string, string>>({});

  const INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
    'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
    'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
    'Uttar Pradesh','Uttarakhand','West Bengal',
  ];

  onMount(async () => {
    await authStore.init();
    if (authStore.user) await loadAddresses();
    loading = false;
  });

  async function loadAddresses() {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', authStore.user!.id)
      .order('is_default', { ascending: false });
    addresses = (data ?? []) as Address[];
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'Required';
    if (!isValidIndianPhone(form.phone)) e.phone = 'Enter a valid 10-digit mobile number';
    if (!form.address_line1.trim()) e.address_line1 = 'Required';
    if (!form.city.trim()) e.city = 'Required';
    if (!form.state) e.state = 'Required';
    if (!isValidPincode(form.pincode)) e.pincode = 'Enter a valid 6-digit pincode';
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function saveAddress() {
    if (!validate()) return;
    saving = true;
    try {
      if (editId) {
        const { error } = await supabase
          .from('addresses')
          .update({ ...form })
          .eq('id', editId)
          .eq('user_id', authStore.user!.id);
        if (error) throw error;
        uiStore.addToast('Address updated!', 'success');
      } else {
        const { error } = await supabase
          .from('addresses')
          .insert({ ...form, user_id: authStore.user!.id });
        if (error) throw error;
        uiStore.addToast('Address added!', 'success');
      }
      form = emptyForm();
      editId = null;
      showForm = false;
      await loadAddresses();
    } catch (err: any) {
      uiStore.addToast('Error: ' + err.message, 'error');
    } finally {
      saving = false;
    }
  }

  async function deleteAddress(id: string) {
    deleting = id;
    const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', authStore.user!.id);
    deleting = null;
    if (error) { uiStore.addToast('Could not delete: ' + error.message, 'error'); return; }
    addresses = addresses.filter(a => a.id !== id);
    uiStore.addToast('Address removed', 'success');
  }

  async function setDefault(id: string) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', authStore.user!.id);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    await loadAddresses();
    uiStore.addToast('Default address updated ⭐', 'success');
  }

  function editAddress(addr: Address) {
    editId = addr.id;
    form = { label: addr.label ?? 'Home', full_name: addr.full_name, phone: addr.phone, address_line1: addr.address_line1, address_line2: addr.address_line2 ?? '', city: addr.city, state: addr.state, pincode: addr.pincode, country: addr.country, is_default: addr.is_default };
    showForm = true;
  }

  function cancelForm() {
    form = emptyForm();
    editId = null;
    errors = {};
    showForm = false;
  }
</script>

<svelte:head><title>My Addresses — French Toes</title></svelte:head>

<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <h2 class="font-display text-2xl font-bold" style="color: var(--color-text-dark);">My Addresses</h2>
    {#if !showForm}
      <button onclick={() => showForm = true} class="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Add New
      </button>
    {/if}
  </div>

  {#if loading}
    <div class="flex justify-center py-10"><div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color: var(--color-blush); border-top-color: var(--color-blush-deep);"></div></div>
  {:else}
    <!-- Address list -->
    {#if addresses.length === 0 && !showForm}
      <div class="text-center py-16 rounded-2xl border" style="border-color: var(--color-blush); background: white;">
        <span class="text-4xl block mb-4">📍</span>
        <p class="font-semibold text-lg mb-4" style="color: var(--color-text-dark);">No saved addresses</p>
        <button onclick={() => showForm = true} class="btn-primary">Add Your First Address</button>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {#each addresses as addr (addr.id)}
          <div class="rounded-2xl p-4 border relative" style="border-color: {addr.is_default ? 'var(--color-blush-deep)' : 'var(--color-blush)'}; background: white;">
            {#if addr.is_default}
              <span class="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-semibold" style="background: var(--color-blush); color: var(--color-blush-deep);">Default ⭐</span>
            {/if}
            <span class="text-xs px-2 py-0.5 rounded-full mb-2 inline-block" style="background: var(--color-blush); color: var(--color-text-mid);">{addr.label ?? 'Home'}</span>
            <p class="font-semibold text-sm" style="color: var(--color-text-dark);">{addr.full_name}</p>
            <p class="text-sm mt-0.5" style="color: var(--color-text-mid);">{addr.address_line1}{addr.address_line2 ? ', ' + addr.address_line2 : ''}</p>
            <p class="text-sm" style="color: var(--color-text-mid);">{addr.city}, {addr.state} – {addr.pincode}</p>
            <p class="text-xs mt-1" style="color: var(--color-text-soft);">📞 {addr.phone}</p>
            <div class="flex items-center gap-3 mt-3">
              <button onclick={() => editAddress(addr)} class="text-xs font-semibold" style="color: var(--color-blush-deep);">Edit</button>
              {#if !addr.is_default}
                <button onclick={() => setDefault(addr.id)} class="text-xs font-semibold" style="color: var(--color-text-mid);">Set Default</button>
              {/if}
              <button onclick={() => deleteAddress(addr.id)} disabled={deleting === addr.id} class="text-xs font-semibold" style="color: #ef4444;">
                {deleting === addr.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Add/Edit form -->
    {#if showForm}
      <div class="rounded-2xl p-5 border" style="border-color: var(--color-blush); background: white;">
        <h3 class="font-semibold text-base mb-4" style="color: var(--color-text-dark);">{editId ? 'Edit' : 'New'} Address</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="a-label" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Label</label>
            <select id="a-label" bind:value={form.label} class="w-full px-3 py-2.5 rounded-xl border text-sm" style="border-color: var(--color-blush);">
              <option>Home</option><option>Work</option><option>Other</option>
            </select>
          </div>
          <div class="flex items-end pb-1">
            <label class="flex items-center gap-2 text-sm cursor-pointer" style="color: var(--color-text-mid);">
              <input type="checkbox" bind:checked={form.is_default} class="accent-[color:var(--color-blush-deep)]" />
              Set as default address
            </label>
          </div>
          <div>
            <label for="a-name" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Full Name *</label>
            <input id="a-name" bind:value={form.full_name} type="text" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {errors.full_name ? '#ef4444' : 'var(--color-blush)'};" />
            {#if errors.full_name}<p class="text-xs text-red-500 mt-0.5">{errors.full_name}</p>{/if}
          </div>
          <div>
            <label for="a-phone" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Phone *</label>
            <input id="a-phone" bind:value={form.phone} type="tel" maxlength="10" placeholder="9876543210" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {errors.phone ? '#ef4444' : 'var(--color-blush)'};" />
            {#if errors.phone}<p class="text-xs text-red-500 mt-0.5">{errors.phone}</p>{/if}
          </div>
          <div class="sm:col-span-2">
            <label for="a-line1" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Address Line 1 *</label>
            <input id="a-line1" bind:value={form.address_line1} type="text" placeholder="House / Flat / Street" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {errors.address_line1 ? '#ef4444' : 'var(--color-blush)'};" />
            {#if errors.address_line1}<p class="text-xs text-red-500 mt-0.5">{errors.address_line1}</p>{/if}
          </div>
          <div class="sm:col-span-2">
            <label for="a-line2" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Address Line 2</label>
            <input id="a-line2" bind:value={form.address_line2} type="text" placeholder="Area / Landmark" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: var(--color-blush);" />
          </div>
          <div>
            <label for="a-city" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">City *</label>
            <input id="a-city" bind:value={form.city} type="text" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {errors.city ? '#ef4444' : 'var(--color-blush)'};" />
            {#if errors.city}<p class="text-xs text-red-500 mt-0.5">{errors.city}</p>{/if}
          </div>
          <div>
            <label for="a-pin" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">Pincode *</label>
            <input id="a-pin" bind:value={form.pincode} type="text" maxlength="6" class="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style="border-color: {errors.pincode ? '#ef4444' : 'var(--color-blush)'};" />
            {#if errors.pincode}<p class="text-xs text-red-500 mt-0.5">{errors.pincode}</p>{/if}
          </div>
          <div class="sm:col-span-2">
            <label for="a-state" class="block text-xs font-semibold mb-1" style="color: var(--color-text-mid);">State *</label>
            <select id="a-state" bind:value={form.state} class="w-full px-3 py-2.5 rounded-xl border text-sm" style="border-color: {errors.state ? '#ef4444' : 'var(--color-blush)'};">
              <option value="">Select State</option>
              {#each INDIAN_STATES as s}<option value={s}>{s}</option>{/each}
            </select>
            {#if errors.state}<p class="text-xs text-red-500 mt-0.5">{errors.state}</p>{/if}
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick={cancelForm} class="btn-outline px-5 py-2.5">Cancel</button>
          <button onclick={saveAddress} disabled={saving} class="btn-primary px-5 py-2.5">
            {saving ? 'Saving...' : editId ? 'Update Address' : 'Save Address'}
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>
