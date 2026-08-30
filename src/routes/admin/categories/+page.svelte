<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Category } from '$lib/types';

  let categories = $state<any[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let editId = $state<string | null>(null);
  let saving = $state(false);
  let deletingId = $state<string | null>(null);
  let uploadingImage = $state(false);

  const emptyForm = () => ({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    is_active: true,
  });
  let form = $state(emptyForm());

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await loadCategories();
    loading = false;
  });

  async function loadCategories() {
    const { data: catData, error } = await supabase
      .from('categories')
      .select('*, products:products(count)')
      .order('name');

    if (error) {
      uiStore.addToast('Failed to load categories: ' + error.message, 'error');
    } else {
      categories = (catData ?? []) as any[];
    }
  }

  function startEdit(c: any) {
    editId = c.id;
    form = {
      name: c.name,
      slug: c.slug,
      description: c.description ?? '',
      image_url: c.image_url ?? '',
      is_active: c.is_active,
    };
    showForm = true;
  }

  function autoSlug() {
    if (!editId && form.name) {
      form.slug = form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }
  }

  async function handleCategoryImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    uploadingImage = true;

    const formData = new FormData();
    formData.append('file', target.files[0]);
    formData.append('folder', '/categories');

    try {
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');

      form.image_url = data.url;
      uiStore.addToast('Category image uploaded to ImageKit! 📸', 'success');
    } catch (err: any) {
      uiStore.addToast('Upload failed: ' + err.message, 'error');
    } finally {
      uploadingImage = false;
      target.value = '';
    }
  }

  async function saveCategory() {
    if (!form.name.trim() || !form.slug.trim()) {
      uiStore.addToast('Name and slug are required', 'error');
      return;
    }
    saving = true;
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
      };

      if (editId) {
        const { error } = await supabase.from('categories').update(payload).eq('id', editId);
        if (error) throw error;
        uiStore.addToast('Category updated successfully! 🌸', 'success');
      } else {
        const { error } = await supabase.from('categories').insert(payload);
        if (error) throw error;
        uiStore.addToast('Category created! 🚀', 'success');
      }
      form = emptyForm();
      editId = null;
      showForm = false;
      await loadCategories();
    } catch (err: any) {
      uiStore.addToast('Error saving category: ' + err.message, 'error');
    } finally {
      saving = false;
    }
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? Products in this category will be unassigned.`)) {
      return;
    }
    deletingId = id;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      uiStore.addToast(`Category "${name}" deleted 🗑️`, 'success');
      categories = categories.filter(c => c.id !== id);
      if (editId === id) {
        showForm = false;
        editId = null;
      }
    } catch (err: any) {
      uiStore.addToast('Error deleting category: ' + err.message, 'error');
    } finally {
      deletingId = null;
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const { error } = await supabase.from('categories').update({ is_active: !isActive }).eq('id', id);
    if (error) {
      uiStore.addToast('Failed to toggle status: ' + error.message, 'error');
    } else {
      categories = categories.map(c => c.id === id ? { ...c, is_active: !isActive } : c);
      uiStore.addToast(!isActive ? 'Category activated' : 'Category deactivated', 'success');
    }
  }
</script>

<svelte:head>
  <title>Categories Manager — Admin French Toes</title>
</svelte:head>

<div class="flex flex-col gap-6 max-w-7xl mx-auto">
  <!-- Header Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
    <div>
      <h1 class="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
        <span>📂 Product Categories</span>
        <span class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-semibold border border-indigo-500/30">
          {categories.length} Categories
        </span>
      </h1>
      <p class="text-xs text-gray-400 mt-1">
        Manage shop navigation categories, banner images, and descriptions.
      </p>
    </div>

    <div>
      {#if !showForm}
        <button
          onclick={() => { form = emptyForm(); editId = null; showForm = true; }}
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-500/20 cursor-pointer"
        >
          <span>＋ Add Category</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Create / Edit Form -->
  {#if showForm}
    <div class="rounded-2xl p-6 bg-[#161726] border border-indigo-500/30 shadow-2xl space-y-5">
      <div class="flex items-center justify-between border-b border-white/10 pb-4">
        <h2 class="font-bold text-white text-base">
          {editId ? '✏️ Edit Category' : '✨ New Category'}
        </h2>
        <button
          onclick={() => { showForm = false; editId = null; }}
          class="w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
        >✕</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="c-name" class="block text-xs font-semibold mb-1 text-gray-300">Category Name *</label>
          <input
            id="c-name"
            bind:value={form.name}
            oninput={autoSlug}
            type="text"
            placeholder="e.g. Flats, Heels, Wedges"
            class="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/15 focus:border-indigo-500 outline-none"
          />
        </div>

        <div>
          <label for="c-slug" class="block text-xs font-semibold mb-1 text-gray-300">URL Slug *</label>
          <input
            id="c-slug"
            bind:value={form.slug}
            type="text"
            placeholder="flats"
            class="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono text-indigo-300 bg-white/5 border border-white/15 focus:border-indigo-500 outline-none"
          />
        </div>

        <div class="sm:col-span-2">
          <label for="c-desc" class="block text-xs font-semibold mb-1 text-gray-300">Description</label>
          <textarea
            id="c-desc"
            bind:value={form.description}
            rows="2"
            placeholder="Brief description for SEO and category headers..."
            class="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/15 focus:border-indigo-500 outline-none resize-none"
          ></textarea>
        </div>

        <!-- ImageKit Category Image Upload -->
        <div class="sm:col-span-2 space-y-2">
          <label class="block text-xs font-semibold text-gray-300">Category Banner / Icon</label>
          <div class="flex items-center gap-4">
            {#if form.image_url}
              <div class="w-16 h-16 rounded-xl bg-black/40 border border-white/20 overflow-hidden shrink-0">
                <img src={form.image_url} alt="Category preview" class="w-full h-full object-cover" />
              </div>
            {/if}
            <div class="flex-1 flex flex-col gap-2">
              <div class="flex gap-2">
                <input
                  type="text"
                  placeholder="https://ik.imagekit.io/..."
                  bind:value={form.image_url}
                  class="flex-1 px-3 py-2 rounded-xl text-xs font-mono text-white bg-white/5 border border-white/15 outline-none"
                />
                <label class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer shrink-0">
                  {uploadingImage ? 'Uploading...' : '📸 Upload to ImageKit'}
                  <input type="file" accept="image/*" onchange={handleCategoryImageUpload} disabled={uploadingImage} class="hidden" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="sm:col-span-2">
          <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" bind:checked={form.is_active} class="accent-indigo-500" />
            <span class="font-medium text-white">Active / Visible in navigation</span>
          </label>
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 border-t border-white/10">
        <div>
          {#if editId}
            <button
              type="button"
              onclick={() => deleteCategory(editId!, form.name)}
              disabled={deletingId === editId}
              class="px-4 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/30 border border-red-800/40 cursor-pointer"
            >
              🗑️ Delete Category
            </button>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            onclick={() => { showForm = false; editId = null; }}
            class="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 bg-white/10 hover:bg-white/15 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={saveCategory}
            disabled={saving}
            class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-md cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Category Cards Grid -->
  {#if loading}
    <div class="flex justify-center py-20">
      <div class="w-10 h-10 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"></div>
    </div>
  {:else if categories.length === 0}
    <div class="p-12 text-center rounded-2xl bg-white/5 border border-white/10 space-y-2">
      <p class="text-3xl">📂</p>
      <p class="text-base font-bold text-white">No categories created yet</p>
      <p class="text-xs text-gray-400">Click "+ Add Category" to organize your products.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each categories as cat (cat.id)}
        <div class="rounded-2xl p-5 bg-white/5 border border-white/10 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4">
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                {#if cat.image_url}
                  <img src={cat.image_url} alt={cat.name} class="w-10 h-10 rounded-xl object-cover border border-white/10" />
                {:else}
                  <div class="w-10 h-10 rounded-xl bg-indigo-900/40 border border-indigo-700/40 flex items-center justify-center text-base">
                    👠
                  </div>
                {/if}
                <div>
                  <p class="font-bold text-white text-sm">{cat.name}</p>
                  <p class="text-xs font-mono text-indigo-300">/{cat.slug}</p>
                </div>
              </div>

              <button
                onclick={() => toggleActive(cat.id, cat.is_active)}
                class="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer"
                style="background: {cat.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color: {cat.is_active ? '#22c55e' : '#ef4444'}; border: 1px solid {cat.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};"
              >
                {cat.is_active ? '● Active' : '○ Inactive'}
              </button>
            </div>

            {#if cat.description}
              <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed">{cat.description}</p>
            {/if}
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
            <span class="text-gray-400 font-mono text-[11px]">
              {cat.products?.[0]?.count ?? 0} Product(s)
            </span>
            <div class="flex items-center gap-2">
              <button
                onclick={() => startEdit(cat)}
                class="px-3 py-1 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-700/40 cursor-pointer"
              >
                Edit →
              </button>
              <button
                onclick={() => deleteCategory(cat.id, cat.name)}
                disabled={deletingId === cat.id}
                class="p-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 cursor-pointer"
                title="Delete Category"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
