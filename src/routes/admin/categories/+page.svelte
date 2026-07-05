<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Category } from '$lib/types';

  let categories = $state<Category[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let editId = $state<string | null>(null);
  let saving = $state(false);

  const emptyForm = () => ({ name: '', slug: '', description: '', is_active: true });
  let form = $state(emptyForm());

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await loadCategories();
    loading = false;
  });

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    categories = (data ?? []) as Category[];
  }

  function startEdit(c: Category) {
    editId = c.id;
    form = { name: c.name, slug: c.slug, description: c.description ?? '', is_active: c.is_active };
    showForm = true;
  }

  async function saveCategory() {
    if (!form.name || !form.slug) { uiStore.addToast('Name and slug are required', 'error'); return; }
    saving = true;
    try {
      if (editId) {
        const { error } = await supabase.from('categories').update({ ...form }).eq('id', editId);
        if (error) throw error;
        uiStore.addToast('Category updated!', 'success');
      } else {
        const { error } = await supabase.from('categories').insert({ ...form });
        if (error) throw error;
        uiStore.addToast('Category created!', 'success');
      }
      form = emptyForm(); editId = null; showForm = false;
      await loadCategories();
    } catch (err: any) {
      uiStore.addToast('Error: ' + err.message, 'error');
    } finally {
      saving = false;
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await supabase.from('categories').update({ is_active: !isActive }).eq('id', id);
    categories = categories.map(c => c.id === id ? { ...c, is_active: !isActive } : c);
    uiStore.addToast(!isActive ? 'Category activated' : 'Category deactivated', 'success');
  }
</script>

<svelte:head><title>Categories — Admin French Toes</title></svelte:head>

<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-white">Categories</h1>
    {#if !showForm}
      <button onclick={() => { form = emptyForm(); editId = null; showForm = true; }} class="px-4 py-2 rounded-xl text-sm font-semibold text-white" style="background: #4f46e5;">+ Add Category</button>
    {/if}
  </div>

  {#if showForm}
    <div class="rounded-xl p-5" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
      <h2 class="font-semibold text-white mb-4">{editId ? 'Edit' : 'New'} Category</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="c-name" class="block text-xs font-semibold mb-1 text-gray-400">Name *</label>
          <input id="c-name" bind:value={form.name} type="text" class="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);" />
        </div>
        <div>
          <label for="c-slug" class="block text-xs font-semibold mb-1 text-gray-400">Slug *</label>
          <input id="c-slug" bind:value={form.slug} type="text" class="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);" />
        </div>
        <div class="sm:col-span-2">
          <label for="c-desc" class="block text-xs font-semibold mb-1 text-gray-400">Description</label>
          <input id="c-desc" bind:value={form.description} type="text" class="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);" />
        </div>
        <div>
          <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" bind:checked={form.is_active} class="accent-indigo-500" />
            Active
          </label>
        </div>
      </div>
      <div class="flex gap-3 mt-4">
        <button onclick={() => { showForm = false; editId = null; }} class="px-4 py-2.5 rounded-xl text-sm text-gray-300" style="background: rgba(255,255,255,0.1);">Cancel</button>
        <button onclick={saveCategory} disabled={saving} class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style="background: #4f46e5;">
          {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center py-10"><div class="w-8 h-8 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"></div></div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each categories as cat (cat.id)}
        <div class="rounded-xl p-4" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
          <div class="flex items-start justify-between mb-2">
            <div>
              <p class="font-semibold text-white">{cat.name}</p>
              <p class="text-xs text-gray-500 font-mono">{cat.slug}</p>
            </div>
            <button onclick={() => toggleActive(cat.id, cat.is_active)} class="px-2 py-0.5 rounded-full text-xs font-semibold" style="background: {cat.is_active ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color: {cat.is_active ? '#22c55e' : '#ef4444'};">
              {cat.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
          {#if cat.description}
            <p class="text-xs text-gray-400 mb-3">{cat.description}</p>
          {/if}
          <button onclick={() => startEdit(cat)} class="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">Edit →</button>
        </div>
      {/each}
    </div>
  {/if}
</div>
