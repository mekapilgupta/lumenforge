<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { SupabaseProduct, Category, ColorVariant } from '$lib/types';

  let products = $state<any[]>([]);
  let categories = $state<Category[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let editId = $state<string | null>(null);
  let saving = $state(false);
  let deletingId = $state<string | null>(null);
  let toggling = $state<string | null>(null);
  let duplicatingId = $state<string | null>(null);

  // Filter & Search states
  let searchQuery = $state('');
  let selectedCategory = $state('');
  let selectedStatus = $state<'all' | 'active' | 'inactive'>('all');
  let selectedStock = $state<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  let selectedBadge = $state<'all' | 'featured' | 'bestseller' | 'new' | 'limited'>('all');
  let sortBy = $state<'newest' | 'price_asc' | 'price_desc' | 'stock_asc' | 'name_asc'>('newest');

  // Form State
  interface ProductImage {
    url: string;
    alt: string;
    order: number;
  }

  const STANDARD_SIZES = ['4', '5', '6', '7', '8', '36', '37', '38', '39', '40', '41', '42'];

  const emptyForm = () => ({
    name: '',
    slug: '',
    sku: '',
    tagline: '',
    description: '',
    price: '',
    original_price: '',
    category_id: '',
    sizes: ['4', '5', '6', '7', '8'],
    colors: [{ name: 'Default', hex: '#f4a7c3' }] as ColorVariant[],
    images: [] as ProductImage[],
    thumbnail_url: '',
    stock_quantity: '100',
    low_stock_threshold: '10',
    gst_percent: '5',
    is_featured: false,
    is_best_seller: false,
    is_new_arrival: false,
    is_limited_edition: false,
    is_active: true,
  });

  let form = $state(emptyForm());

  // Image upload states
  let uploadingImages = $state(false);
  let directImageUrl = $state('');
  let imageUploadError = $state('');

  // Color management states
  let newColorName = $state('');
  let newColorHex = $state('#f4a7c3');
  let customSizeInput = $state('');

  // Variants state
  let variants = $state<any[]>([]);
  let loadingVariants = $state(false);
  let showVariantForm = $state(false);
  let newVariant = $state({
    sku: '',
    size: '',
    color: '',
    price_adjustment: '0',
    stock_quantity: '20',
    is_active: true,
  });

  onMount(async () => {
    await authStore.init();
    if (!authStore.user || !authStore.isAdmin) return;
    await Promise.all([loadProducts(), loadCategories()]);
    loading = false;
  });

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*, category:category_id(name)')
      .order('created_at', { ascending: false });
    if (error) {
      uiStore.addToast('Error loading products: ' + error.message, 'error');
    } else {
      products = (data ?? []) as any[];
    }
  }

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    categories = (data ?? []) as Category[];
  }

  // ─── ImageKit Upload & Management ──────────────────────────────────────────

  async function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    uploadingImages = true;
    imageUploadError = '';

    const formData = new FormData();
    for (let i = 0; i < target.files.length; i++) {
      formData.append('file', target.files[i]);
    }
    formData.append('folder', '/products');

    try {
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload images to ImageKit');
      }

      const uploadedList = data.results || (data.url ? [data] : []);
      for (const item of uploadedList) {
        if (item.url) {
          const nextOrder = form.images.length + 1;
          const newImg: ProductImage = {
            url: item.url,
            alt: form.name ? `${form.name} view ${nextOrder}` : `Product view ${nextOrder}`,
            order: nextOrder,
          };
          form.images = [...form.images, newImg];
          if (!form.thumbnail_url) {
            form.thumbnail_url = item.url;
          }
        }
      }
      uiStore.addToast(`Successfully uploaded ${uploadedList.length} image(s) to ImageKit! 📸`, 'success');
    } catch (err: any) {
      imageUploadError = err.message || 'Image upload failed';
      uiStore.addToast('Upload error: ' + imageUploadError, 'error');
    } finally {
      uploadingImages = false;
      target.value = '';
    }
  }

  function addDirectImageUrl() {
    const url = directImageUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      uiStore.addToast('Please enter a valid URL (starting with https://)', 'error');
      return;
    }
    const nextOrder = form.images.length + 1;
    const newImg: ProductImage = {
      url,
      alt: form.name ? `${form.name} view ${nextOrder}` : `Product view ${nextOrder}`,
      order: nextOrder,
    };
    form.images = [...form.images, newImg];
    if (!form.thumbnail_url) {
      form.thumbnail_url = url;
    }
    directImageUrl = '';
    uiStore.addToast('Image URL added to gallery', 'success');
  }

  function setAsThumbnail(url: string) {
    form.thumbnail_url = url;
    uiStore.addToast('Thumbnail set as primary preview 🌟', 'info');
  }

  function removeImage(index: number) {
    const removedUrl = form.images[index].url;
    form.images = form.images.filter((_, i) => i !== index);
    form.images = form.images.map((img, i) => ({ ...img, order: i + 1 }));
    if (form.thumbnail_url === removedUrl) {
      form.thumbnail_url = form.images[0]?.url || '';
    }
  }

  function moveImage(index: number, direction: 'left' | 'right') {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= form.images.length) return;
    const reordered = [...form.images];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    form.images = reordered.map((img, i) => ({ ...img, order: i + 1 }));
  }

  // ─── Colors & Sizes Helpers ────────────────────────────────────────────────

  function addColor() {
    const name = newColorName.trim();
    if (!name) {
      uiStore.addToast('Please enter a color name', 'error');
      return;
    }
    if (form.colors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      uiStore.addToast('Color already exists in this product', 'error');
      return;
    }
    form.colors = [...form.colors, { name, hex: newColorHex }];
    newColorName = '';
    uiStore.addToast(`Added color: ${name}`, 'success');
  }

  function removeColor(name: string) {
    if (form.colors.length <= 1) {
      uiStore.addToast('At least one color is required', 'info');
      return;
    }
    form.colors = form.colors.filter(c => c.name !== name);
  }

  function toggleSize(s: string) {
    if (form.sizes.includes(s)) {
      if (form.sizes.length <= 1) {
        uiStore.addToast('At least one size is required', 'info');
        return;
      }
      form.sizes = form.sizes.filter(x => x !== s);
    } else {
      form.sizes = [...form.sizes, s];
    }
  }

  function addCustomSize() {
    const s = customSizeInput.trim();
    if (!s) return;
    if (form.sizes.includes(s)) {
      uiStore.addToast('Size already exists', 'error');
      return;
    }
    form.sizes = [...form.sizes, s];
    customSizeInput = '';
  }

  function autoFillSlug() {
    if (!editId && form.name) {
      form.slug = form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      if (!form.sku) {
        const initials = form.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
        form.sku = `FT-${initials || 'PROD'}`;
      }
    }
  }

  // ─── CRUD Handlers ─────────────────────────────────────────────────────────

  function openCreateModal() {
    form = emptyForm();
    editId = null;
    variants = [];
    showForm = true;
  }

  function startEdit(p: any) {
    editId = p.id;
    const rawImages = Array.isArray(p.images) ? p.images : [];
    const formattedImages: ProductImage[] = rawImages.map((img: any, idx: number) => ({
      url: typeof img === 'string' ? img : img?.url || '',
      alt: typeof img === 'string' ? `${p.name} ${idx + 1}` : img?.alt || `${p.name} ${idx + 1}`,
      order: typeof img === 'string' ? idx + 1 : img?.order || idx + 1,
    }));

    form = {
      name: p.name,
      slug: p.slug,
      sku: p.sku ?? '',
      tagline: p.tagline ?? '',
      description: p.description ?? '',
      price: String(p.price / 100),
      original_price: p.original_price ? String(p.original_price / 100) : '',
      category_id: p.category_id ?? '',
      sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes.map(String) : ['4', '5', '6', '7', '8'],
      colors: Array.isArray(p.colors) && p.colors.length > 0 ? p.colors : [{ name: 'Default', hex: '#f4a7c3' }],
      images: formattedImages,
      thumbnail_url: p.thumbnail_url || (formattedImages[0]?.url ?? ''),
      stock_quantity: String(p.stock_quantity ?? 100),
      low_stock_threshold: String(p.low_stock_threshold ?? 10),
      gst_percent: String(p.gst_percent ?? 5),
      is_featured: Boolean(p.is_featured),
      is_best_seller: Boolean(p.is_best_seller),
      is_new_arrival: Boolean(p.is_new_arrival),
      is_limited_edition: Boolean(p.is_limited_edition),
      is_active: Boolean(p.is_active),
    };
    showForm = true;
    loadVariants(p.id);
  }

  async function cloneProduct(p: any) {
    if (duplicatingId) return;
    duplicatingId = p.id;
    try {
      const clonedSlug = `${p.slug}-copy-${Date.now().toString().slice(-4)}`;
      const clonedSku = p.sku ? `${p.sku}-CP` : `FT-${Date.now().toString().slice(-6)}`;
      
      const payload: any = {
        name: `${p.name} (Copy)`,
        slug: clonedSlug,
        sku: clonedSku,
        tagline: p.tagline,
        description: p.description,
        price: p.price,
        original_price: p.original_price,
        category_id: p.category_id,
        sizes: p.sizes,
        colors: p.colors,
        images: p.images,
        thumbnail_url: p.thumbnail_url,
        stock_quantity: p.stock_quantity,
        low_stock_threshold: p.low_stock_threshold,
        gst_percent: p.gst_percent,
        is_featured: false,
        is_best_seller: false,
        is_new_arrival: true,
        is_limited_edition: false,
        is_active: true,
      };

      const { data: newProd, error } = await supabase.from('products').insert(payload).select().single();
      if (error) throw error;

      uiStore.addToast(`Product cloned as "${newProd.name}"! 📋`, 'success');
      await loadProducts();
    } catch (err: any) {
      uiStore.addToast('Failed to clone product: ' + err.message, 'error');
    } finally {
      duplicatingId = null;
    }
  }

  async function deleteProduct(id: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete "${name}"?\nThis action cannot be undone.`)) {
      return;
    }
    deletingId = id;
    try {
      await supabase.from('product_variants').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;

      uiStore.addToast(`Product "${name}" deleted successfully 🗑️`, 'success');
      products = products.filter(p => p.id !== id);
      if (editId === id) {
        showForm = false;
        editId = null;
      }
    } catch (err: any) {
      uiStore.addToast('Error deleting product: ' + err.message, 'error');
    } finally {
      deletingId = null;
    }
  }

  async function saveProduct() {
    if (!form.name.trim() || !form.slug.trim() || !form.price) {
      uiStore.addToast('Product name, slug, and price are required', 'error');
      return;
    }

    const pricePaise = Math.round(parseFloat(form.price) * 100);
    const originalPricePaise = form.original_price ? Math.round(parseFloat(form.original_price) * 100) : null;

    if (isNaN(pricePaise) || pricePaise <= 0) {
      uiStore.addToast('Please enter a valid price', 'error');
      return;
    }

    saving = true;

    const formattedImages = form.images.map((img, i) => ({
      url: img.url,
      alt: img.alt || `${form.name} view ${i + 1}`,
      order: i + 1,
    }));

    const thumbnail = form.thumbnail_url || (formattedImages[0]?.url ?? null);

    const payload: any = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      sku: form.sku.trim() || null,
      tagline: form.tagline.trim() || null,
      description: form.description.trim() || null,
      price: pricePaise,
      original_price: originalPricePaise,
      category_id: form.category_id || null,
      sizes: form.sizes,
      colors: form.colors,
      images: formattedImages,
      thumbnail_url: thumbnail,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 10,
      gst_percent: parseFloat(form.gst_percent) || 5,
      is_featured: form.is_featured,
      is_best_seller: form.is_best_seller,
      is_new_arrival: form.is_new_arrival,
      is_limited_edition: form.is_limited_edition,
      is_active: form.is_active,
    };

    try {
      if (editId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editId);
        if (error) throw error;
        uiStore.addToast('Product updated successfully! 🌸', 'success');
      } else {
        const { data: newProd, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        uiStore.addToast('Product created successfully! 🚀', 'success');
        editId = newProd.id;
      }

      await loadProducts();
      showForm = false;
      editId = null;
    } catch (err: any) {
      uiStore.addToast('Error saving product: ' + err.message, 'error');
    } finally {
      saving = false;
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    toggling = id;
    const { error } = await supabase.from('products').update({ is_active: !isActive }).eq('id', id);
    if (error) {
      uiStore.addToast('Failed to toggle status: ' + error.message, 'error');
    } else {
      products = products.map(p => p.id === id ? { ...p, is_active: !isActive } as any : p);
      uiStore.addToast(!isActive ? 'Product published / active ✅' : 'Product set to inactive ⏸️', 'success');
    }
    toggling = null;
  }

  // ─── Variants Management ───────────────────────────────────────────────────

  async function loadVariants(productId: string) {
    loadingVariants = true;
    const { data } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('size', { ascending: true });
    variants = data ?? [];
    loadingVariants = false;
  }

  async function autoGenerateVariants() {
    if (!editId) {
      uiStore.addToast('Please save the product first before generating variants', 'info');
      return;
    }
    loadingVariants = true;
    try {
      const generated: any[] = [];
      const baseSku = form.sku || `FT-${form.slug.substring(0, 6).toUpperCase()}`;

      for (const color of form.colors) {
        const colorCode = color.name.substring(0, 3).toUpperCase();
        for (const size of form.sizes) {
          const sku = `${baseSku}-${colorCode}-${size}`;
          generated.push({
            product_id: editId,
            sku,
            size: String(size),
            color: color.name,
            price_adjustment: 0,
            stock_quantity: parseInt(form.stock_quantity) || 100,
            is_active: true,
          });
        }
      }

      const { error } = await supabase.from('product_variants').upsert(generated, { onConflict: 'product_id,sku' });
      if (error) throw error;

      uiStore.addToast(`Generated ${generated.length} product variants! ⚡`, 'success');
      await loadVariants(editId);
    } catch (err: any) {
      uiStore.addToast('Variant generation failed: ' + err.message, 'error');
    } finally {
      loadingVariants = false;
    }
  }

  async function saveVariant() {
    if (!editId) return;
    if (!newVariant.sku.trim()) {
      uiStore.addToast('Variant SKU is required', 'error');
      return;
    }

    const payload = {
      product_id: editId,
      sku: newVariant.sku.trim(),
      size: newVariant.size.trim() || null,
      color: newVariant.color.trim() || null,
      price_adjustment: Math.round((parseFloat(newVariant.price_adjustment) || 0) * 100),
      stock_quantity: parseInt(newVariant.stock_quantity) || 0,
      is_active: newVariant.is_active,
    };

    const { error } = await supabase.from('product_variants').insert(payload);
    if (error) {
      uiStore.addToast('Failed to add variant: ' + error.message, 'error');
      return;
    }

    uiStore.addToast('Variant created!', 'success');
    newVariant = { sku: '', size: '', color: '', price_adjustment: '0', stock_quantity: '20', is_active: true };
    showVariantForm = false;
    await loadVariants(editId);
  }

  async function updateVariantStock(variantId: string, newStockStr: string) {
    const newStock = parseInt(newStockStr);
    if (isNaN(newStock) || newStock < 0) return;
    await supabase.from('product_variants').update({ stock_quantity: newStock, updated_at: new Date().toISOString() }).eq('id', variantId);
    uiStore.addToast('Variant stock updated', 'success');
    if (editId) await loadVariants(editId);
  }

  async function updateVariantPriceAdjustment(variantId: string, newPriceAdjStr: string) {
    const newPriceAdj = Math.round((parseFloat(newPriceAdjStr) || 0) * 100);
    await supabase.from('product_variants').update({ price_adjustment: newPriceAdj, updated_at: new Date().toISOString() }).eq('id', variantId);
    uiStore.addToast('Variant price updated', 'success');
    if (editId) await loadVariants(editId);
  }

  async function deleteVariant(variantId: string) {
    if (!confirm('Delete this variant?')) return;
    await supabase.from('product_variants').delete().eq('id', variantId);
    uiStore.addToast('Variant removed', 'info');
    if (editId) await loadVariants(editId);
  }

  async function toggleVariantActive(variantId: string, currentStatus: boolean) {
    await supabase.from('product_variants').update({ is_active: !currentStatus }).eq('id', variantId);
    if (editId) await loadVariants(editId);
  }

  // ─── Filtered Products Computed ───────────────────────────────────────────

  const filteredProducts = $derived.by(() => {
    let result = products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    if (selectedCategory) {
      result = result.filter(p => p.category_id === selectedCategory);
    }

    if (selectedStatus === 'active') {
      result = result.filter(p => p.is_active);
    } else if (selectedStatus === 'inactive') {
      result = result.filter(p => !p.is_active);
    }

    if (selectedStock !== 'all') {
      result = result.filter(p => p.stock_status === selectedStock);
    }

    if (selectedBadge === 'featured') result = result.filter(p => p.is_featured);
    else if (selectedBadge === 'bestseller') result = result.filter(p => p.is_best_seller);
    else if (selectedBadge === 'new') result = result.filter(p => p.is_new_arrival);
    else if (selectedBadge === 'limited') result = result.filter(p => p.is_limited_edition);

    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
      if (sortBy === 'stock_asc') return (a.stock_quantity || 0) - (b.stock_quantity || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });
  });

  function fmt(paise: number) {
    return '₹' + ((paise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
</script>

<svelte:head>
  <title>Products Manager — Admin French Toes</title>
</svelte:head>

<div class="flex flex-col gap-6 max-w-7xl mx-auto">
  <!-- Header Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
    <div>
      <h1 class="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
        <span>👠 Product Catalog</span>
        <span class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-semibold border border-indigo-500/30">
          {products.length} Total
        </span>
      </h1>
      <p class="text-xs text-gray-400 mt-1">
        Manage products, ImageKit uploads, colors, sizes, stock levels, and Shiprocket SKUs.
      </p>
    </div>

    <div class="flex items-center gap-3">
      {#if !showForm}
        <button
          onclick={openCreateModal}
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <span>＋ Add New Product</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Product Create / Edit Modal Form -->
  {#if showForm}
    <div class="rounded-2xl p-6 bg-[#161726] border border-indigo-500/30 shadow-2xl space-y-6">
      <div class="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <span>{editId ? '✏️ Edit Product' : '✨ New Product'}</span>
            {#if form.name}<span class="text-sm font-normal text-gray-400">({form.name})</span>{/if}
          </h2>
          <p class="text-xs text-gray-400 mt-0.5">Fill in product information and upload images directly to ImageKit.</p>
        </div>
        <button
          onclick={() => { showForm = false; editId = null; }}
          class="w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
        >✕</button>
      </div>

      <!-- Section 1: Basic Information -->
      <div class="space-y-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-400">1. Basic Details</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="sm:col-span-2">
            <label for="p-name" class="block text-xs font-semibold text-gray-300 mb-1">Product Title *</label>
            <input
              id="p-name"
              bind:value={form.name}
              oninput={autoFillSlug}
              type="text"
              placeholder="e.g. Miami 1 - SeaGreen"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/15 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label for="p-slug" class="block text-xs font-semibold text-gray-300 mb-1">URL Slug *</label>
            <input
              id="p-slug"
              bind:value={form.slug}
              type="text"
              placeholder="miami-1-seagreen"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono text-indigo-300 bg-white/5 border border-white/15 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label for="p-sku" class="block text-xs font-semibold text-gray-300 mb-1">Base SKU (Shiprocket)</label>
            <input
              id="p-sku"
              bind:value={form.sku}
              type="text"
              placeholder="FT-MIA-SGR"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono text-amber-300 bg-white/5 border border-white/15 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label for="p-cat" class="block text-xs font-semibold text-gray-300 mb-1">Category</label>
            <select
              id="p-cat"
              bind:value={form.category_id}
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-[#1a1b2e] border border-white/15 focus:border-indigo-500 outline-none"
            >
              <option value="">No Category</option>
              {#each categories as c}
                <option value={c.id}>{c.name}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="p-price" class="block text-xs font-semibold text-gray-300 mb-1">Selling Price (₹) *</label>
            <input
              id="p-price"
              bind:value={form.price}
              type="number"
              min="1"
              placeholder="799"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold text-emerald-400 bg-white/5 border border-white/15 focus:border-indigo-500 outline-none font-mono"
            />
          </div>

          <div>
            <label for="p-orig" class="block text-xs font-semibold text-gray-300 mb-1">MRP / Strikethrough Price (₹)</label>
            <input
              id="p-orig"
              bind:value={form.original_price}
              type="number"
              placeholder="1299"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5 border border-white/15 focus:border-indigo-500 outline-none font-mono"
            />
          </div>

          <div>
            <label for="p-stock" class="block text-xs font-semibold text-gray-300 mb-1">Stock Quantity</label>
            <input
              id="p-stock"
              bind:value={form.stock_quantity}
              type="number"
              placeholder="100"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/15 focus:border-indigo-500 outline-none font-mono"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="p-tagline" class="block text-xs font-semibold text-gray-300 mb-1">Tagline / Short Hook</label>
            <input
              id="p-tagline"
              bind:value={form.tagline}
              type="text"
              placeholder="Soft cloud comfort with anti-slip grip"
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/15 focus:border-indigo-500 outline-none"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="p-desc" class="block text-xs font-semibold text-gray-300 mb-1">Full Description</label>
            <textarea
              id="p-desc"
              bind:value={form.description}
              rows="3"
              placeholder="Enter comprehensive product features, materials, and sizing tips..."
              class="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/15 focus:border-indigo-500 outline-none resize-none"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Section 2: ImageKit Image Management -->
      <div class="space-y-4 pt-4 border-t border-white/10">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-pink-400">2. Product Images (ImageKit Hosted)</h3>
            <p class="text-xs text-gray-400 mt-0.5">Upload photos directly or add hosted URLs. Drag or reorder freely.</p>
          </div>
          <span class="text-xs font-mono text-gray-400">{form.images.length} Image(s) in Gallery</span>
        </div>

        <!-- Upload Box -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- File Dropzone -->
          <div class="border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/20 rounded-2xl p-5 text-center flex flex-col items-center justify-center transition-all">
            {#if uploadingImages}
              <div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p class="text-xs font-bold text-indigo-300">Uploading to ImageKit & Compressing...</p>
            {:else}
              <span class="text-2xl mb-1">📸</span>
              <p class="text-xs font-bold text-white">Upload Images to ImageKit</p>
              <p class="text-[11px] text-gray-400 mt-0.5 mb-3">PNG, JPG, WEBP (Multiple allowed)</p>
              <label class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer transition-colors shadow-md">
                <span>Select Files</span>
                <input type="file" multiple accept="image/*" onchange={handleFileUpload} class="hidden" />
              </label>
            {/if}
          </div>

          <!-- URL Input -->
          <div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-center gap-3">
            <p class="text-xs font-bold text-white">Or Add by Direct ImageKit / CDN URL</p>
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="https://ik.imagekit.io/who7qvgvp/..."
                bind:value={directImageUrl}
                onkeydown={(e) => { if (e.key === 'Enter') addDirectImageUrl(); }}
                class="flex-1 px-3 py-2 rounded-xl text-xs font-mono text-white bg-white/5 border border-white/15 outline-none focus:border-pink-500"
              />
              <button
                type="button"
                onclick={addDirectImageUrl}
                class="px-3 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
            <p class="text-[10px] text-gray-500">Supports direct ImageKit CDN links or external high-res product photos.</p>
          </div>
        </div>

        <!-- Image Gallery Previews -->
        {#if form.images.length > 0}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
            {#each form.images as img, idx (img.url + idx)}
              {@const isThumb = form.thumbnail_url === img.url}
              <div class="relative group bg-white/5 rounded-xl border {isThumb ? 'border-amber-400 shadow-md shadow-amber-500/20' : 'border-white/10'} overflow-hidden flex flex-col">
                <div class="aspect-square w-full bg-black/40 overflow-hidden relative">
                  <img src={img.url} alt={img.alt} class="w-full h-full object-cover" />
                  {#if isThumb}
                    <span class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400 text-black shadow">
                      ★ Primary
                    </span>
                  {/if}
                </div>
                
                <div class="p-2 bg-[#121320] flex flex-col gap-1 text-[11px]">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] text-gray-400 font-mono">#{img.order}</span>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        onclick={() => moveImage(idx, 'left')}
                        disabled={idx === 0}
                        class="px-1 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-[10px]"
                        title="Move Left"
                      >←</button>
                      <button
                        type="button"
                        onclick={() => moveImage(idx, 'right')}
                        disabled={idx === form.images.length - 1}
                        class="px-1 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-[10px]"
                        title="Move Right"
                      >→</button>
                    </div>
                  </div>

                  <div class="flex gap-1 mt-1">
                    {#if !isThumb}
                      <button
                        type="button"
                        onclick={() => setAsThumbnail(img.url)}
                        class="flex-1 py-1 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                      >
                        Set Main
                      </button>
                    {/if}
                    <button
                      type="button"
                      onclick={() => removeImage(idx)}
                      class="px-2 py-1 rounded text-[10px] font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                      title="Delete Image"
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

      <!-- Section 3: Colors & Sizes Selection -->
      <div class="space-y-4 pt-4 border-t border-white/10">
        <h3 class="text-xs font-bold uppercase tracking-wider text-emerald-400">3. Colors & Sizes</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Color Swatches -->
          <div class="space-y-3">
            <label class="block text-xs font-semibold text-gray-300">Color Variants</label>
            <div class="flex flex-wrap gap-2">
              {#each form.colors as color}
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white">
                  <span class="w-3.5 h-3.5 rounded-full border border-white/30 shadow" style="background: {color.hex};"></span>
                  <span class="font-medium">{color.name}</span>
                  {#if form.colors.length > 1}
                    <button
                      type="button"
                      onclick={() => removeColor(color.name)}
                      class="ml-1 text-gray-400 hover:text-red-400 cursor-pointer"
                    >×</button>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Add Color Input -->
            <div class="flex items-center gap-2 pt-1">
              <input type="color" bind:value={newColorHex} class="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
              <input
                type="text"
                placeholder="Color name (e.g. Berry)"
                bind:value={newColorName}
                onkeydown={(e) => { if (e.key === 'Enter') addColor(); }}
                class="flex-1 px-3 py-1.5 rounded-xl text-xs text-white bg-white/5 border border-white/15 outline-none"
              />
              <button
                type="button"
                onclick={addColor}
                class="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500"
              >
                + Add Color
              </button>
            </div>
          </div>

          <!-- Sizes Chips -->
          <div class="space-y-3">
            <label class="block text-xs font-semibold text-gray-300">Available Sizes (IND/UK)</label>
            <div class="flex flex-wrap gap-1.5">
              {#each STANDARD_SIZES as s}
                {@const isSelected = form.sizes.includes(s)}
                <button
                  type="button"
                  onclick={() => toggleSize(s)}
                  class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer {isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/25'}"
                >
                  Size {s}
                </button>
              {/each}
            </div>

            <div class="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Custom size (e.g. 9 or 43)"
                bind:value={customSizeInput}
                onkeydown={(e) => { if (e.key === 'Enter') addCustomSize(); }}
                class="flex-1 px-3 py-1.5 rounded-xl text-xs text-white bg-white/5 border border-white/15 outline-none"
              />
              <button
                type="button"
                onclick={addCustomSize}
                class="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500"
              >
                + Add Custom
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 4: Merchandising Flags -->
      <div class="space-y-3 pt-4 border-t border-white/10">
        <h3 class="text-xs font-bold uppercase tracking-wider text-amber-400">4. Merchandising Badges & Visibility</h3>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <label class="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
            <input type="checkbox" bind:checked={form.is_active} class="accent-indigo-500" />
            <span class="text-xs font-medium text-white">Active / Published</span>
          </label>
          <label class="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
            <input type="checkbox" bind:checked={form.is_featured} class="accent-amber-500" />
            <span class="text-xs font-medium text-white">⭐ Featured</span>
          </label>
          <label class="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
            <input type="checkbox" bind:checked={form.is_best_seller} class="accent-pink-500" />
            <span class="text-xs font-medium text-white">🔥 Best Seller</span>
          </label>
          <label class="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
            <input type="checkbox" bind:checked={form.is_new_arrival} class="accent-emerald-500" />
            <span class="text-xs font-medium text-white">✨ New Arrival</span>
          </label>
          <label class="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
            <input type="checkbox" bind:checked={form.is_limited_edition} class="accent-purple-500" />
            <span class="text-xs font-medium text-white">💎 Limited Edition</span>
          </label>
        </div>
      </div>

      <!-- Section 5: Variants Table (When Editing) -->
      {#if editId}
        <div class="space-y-4 pt-4 border-t border-white/10">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-indigo-400">5. Individual SKU Variants</h3>
              <p class="text-xs text-gray-400 mt-0.5">Manage exact inventory quantities and Shiprocket SKU identifiers.</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={autoGenerateVariants}
                disabled={loadingVariants}
                class="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-200 bg-indigo-900/50 hover:bg-indigo-800/60 border border-indigo-700/50 cursor-pointer"
              >
                ⚡ Auto-Generate All Variants
              </button>
              <button
                type="button"
                onclick={() => showVariantForm = !showVariantForm}
                class="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
              >
                {showVariantForm ? 'Cancel' : '＋ Add Variant'}
              </button>
            </div>
          </div>

          {#if showVariantForm}
            <div class="p-4 rounded-xl bg-white/5 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label for="v-sku" class="block text-[11px] font-semibold text-gray-400 mb-1">Variant SKU *</label>
                <input id="v-sku" bind:value={newVariant.sku} placeholder="e.g. FT-MIA-SGR-6" class="w-full px-3 py-2 rounded-lg text-xs font-mono text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div>
                <label for="v-size" class="block text-[11px] font-semibold text-gray-400 mb-1">Size</label>
                <input id="v-size" bind:value={newVariant.size} placeholder="6" class="w-full px-3 py-2 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div>
                <label for="v-color" class="block text-[11px] font-semibold text-gray-400 mb-1">Color</label>
                <input id="v-color" bind:value={newVariant.color} placeholder="SeaGreen" class="w-full px-3 py-2 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div>
                <label for="v-price-adj" class="block text-[11px] font-semibold text-gray-400 mb-1">Price Adjustment (₹)</label>
                <input id="v-price-adj" bind:value={newVariant.price_adjustment} type="number" placeholder="0" class="w-full px-3 py-2 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div>
                <label for="v-stock" class="block text-[11px] font-semibold text-gray-400 mb-1">Stock Qty</label>
                <input id="v-stock" bind:value={newVariant.stock_quantity} type="number" placeholder="20" class="w-full px-3 py-2 rounded-lg text-xs text-white bg-white/10 border border-white/20 outline-none" />
              </div>
              <div class="flex items-end">
                <button
                  type="button"
                  onclick={saveVariant}
                  class="w-full py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
                >
                  Save Variant
                </button>
              </div>
            </div>
          {/if}

          {#if loadingVariants}
            <p class="text-xs text-gray-400 py-2">Loading variants...</p>
          {:else if variants.length === 0}
            <p class="text-xs text-gray-500 py-2 italic">No variants created yet. Click "Auto-Generate All Variants" above.</p>
          {:else}
            <div class="overflow-x-auto rounded-xl border border-white/10">
              <table class="w-full text-left text-xs text-gray-300">
                <thead class="bg-white/5 border-b border-white/10 text-gray-400">
                  <tr>
                    <th class="py-2.5 px-3">SKU</th>
                    <th class="py-2.5 px-3">Size</th>
                    <th class="py-2.5 px-3">Color</th>
                    <th class="py-2.5 px-3">Price Adj. (₹)</th>
                    <th class="py-2.5 px-3">Stock</th>
                    <th class="py-2.5 px-3">Status</th>
                    <th class="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5 bg-[#141524]">
                  {#each variants as v (v.id)}
                    <tr>
                      <td class="py-2 px-3 font-mono text-indigo-300">{v.sku}</td>
                      <td class="py-2 px-3 font-bold text-white">Size {v.size || '—'}</td>
                      <td class="py-2 px-3 text-gray-300">{v.color || '—'}</td>
                      <td class="py-2 px-3">
                        <input
                          type="number"
                          value={v.price_adjustment ? v.price_adjustment / 100 : 0}
                          onchange={(e) => updateVariantPriceAdjustment(v.id, (e.target as HTMLInputElement).value)}
                          class="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-xs outline-none font-mono"
                        />
                      </td>
                      <td class="py-2 px-3">
                        <input
                          type="number"
                          value={v.stock_quantity}
                          onchange={(e) => updateVariantStock(v.id, (e.target as HTMLInputElement).value)}
                          class="w-16 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-xs outline-none font-mono"
                        />
                      </td>
                      <td class="py-2 px-3">
                        <button
                          type="button"
                          onclick={() => toggleVariantActive(v.id, v.is_active)}
                          class="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer"
                          style="background: {v.is_active ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color: {v.is_active ? '#22c55e' : '#ef4444'};"
                        >
                          {v.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td class="py-2 px-3 text-right">
                        <button
                          type="button"
                          onclick={() => deleteVariant(v.id)}
                          class="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Form Actions Footer -->
      <div class="flex items-center justify-between pt-4 border-t border-white/10">
        <div>
          {#if editId}
            <button
              type="button"
              onclick={() => deleteProduct(editId!, form.name)}
              disabled={deletingId === editId}
              class="px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/30 border border-red-800/40 cursor-pointer"
            >
              {deletingId === editId ? 'Deleting...' : '🗑️ Delete Product'}
            </button>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            onclick={() => { showForm = false; editId = null; }}
            class="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-300 bg-white/10 hover:bg-white/15 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={saveProduct}
            disabled={saving}
            class="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-500/25 cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : editId ? 'Save Changes' : 'Publish Product 🚀'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Filters & Search Toolbar -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
    <div class="lg:col-span-2">
      <input
        type="text"
        placeholder="🔍 Search by product name, slug, or SKU..."
        bind:value={searchQuery}
        class="w-full px-3.5 py-2.5 rounded-xl text-xs text-white bg-white/5 border border-white/15 focus:border-indigo-500 outline-none"
      />
    </div>

    <div>
      <select
        bind:value={selectedCategory}
        class="w-full px-3 py-2.5 rounded-xl text-xs text-white bg-[#1a1b2e] border border-white/15 outline-none"
      >
        <option value="">All Categories</option>
        {#each categories as c}
          <option value={c.id}>{c.name}</option>
        {/each}
      </select>
    </div>

    <div>
      <select
        bind:value={selectedStatus}
        class="w-full px-3 py-2.5 rounded-xl text-xs text-white bg-[#1a1b2e] border border-white/15 outline-none"
      >
        <option value="all">All Status</option>
        <option value="active">Active / Published</option>
        <option value="inactive">Inactive / Draft</option>
      </select>
    </div>

    <div>
      <select
        bind:value={selectedStock}
        class="w-full px-3 py-2.5 rounded-xl text-xs text-white bg-[#1a1b2e] border border-white/15 outline-none"
      >
        <option value="all">All Stock Status</option>
        <option value="in_stock">In Stock</option>
        <option value="low_stock">Low Stock</option>
        <option value="out_of_stock">Out of Stock</option>
      </select>
    </div>

    <div>
      <select
        bind:value={sortBy}
        class="w-full px-3 py-2.5 rounded-xl text-xs text-white bg-[#1a1b2e] border border-white/15 outline-none"
      >
        <option value="newest">Sort: Newest</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="stock_asc">Stock: Low to High</option>
        <option value="name_asc">Name: A to Z</option>
      </select>
    </div>
  </div>

  <!-- Products List Table -->
  {#if loading}
    <div class="flex justify-center py-20">
      <div class="w-10 h-10 border-4 rounded-full animate-spin border-gray-600 border-t-indigo-500"></div>
    </div>
  {:else if filteredProducts.length === 0}
    <div class="p-12 text-center rounded-2xl bg-white/5 border border-white/10 space-y-3">
      <p class="text-3xl">🔍</p>
      <p class="text-base font-bold text-white">No products found</p>
      <p class="text-xs text-gray-400">Try adjusting your search query or filters.</p>
    </div>
  {:else}
    <div class="rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-gray-300">
          <thead class="bg-white/5 border-b border-white/10 text-gray-400 font-semibold uppercase tracking-wider">
            <tr>
              <th class="py-3.5 px-4">Product Info</th>
              <th class="py-3.5 px-4">Category</th>
              <th class="py-3.5 px-4">Price</th>
              <th class="py-3.5 px-4">Sizes & Colors</th>
              <th class="py-3.5 px-4">Stock</th>
              <th class="py-3.5 px-4">Status</th>
              <th class="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each filteredProducts as p (p.id)}
              <tr class="hover:bg-white/5 transition-colors">
                <!-- Product Details & Thumb -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-black/30 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {#if p.thumbnail_url || (Array.isArray(p.images) && p.images[0])}
                        <img
                          src={p.thumbnail_url || (typeof p.images?.[0] === 'string' ? p.images[0] : p.images?.[0]?.url)}
                          alt={p.name}
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      {:else}
                        <span class="text-xs text-gray-500">No img</span>
                      {/if}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <button class="font-bold text-white truncate text-xs hover:underline cursor-pointer text-left" onclick={() => startEdit(p)}>
                          {p.name}
                        </button>
                        {#if p.is_featured}<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">Featured</span>{/if}
                        {#if p.is_best_seller}<span class="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30">Hot</span>{/if}
                      </div>
                      <p class="text-[11px] text-gray-400 font-mono mt-0.5">{p.sku || p.slug}</p>
                    </div>
                  </div>
                </td>

                <!-- Category -->
                <td class="py-3 px-4 text-gray-300">
                  {p.category?.name || '—'}
                </td>

                <!-- Price -->
                <td class="py-3 px-4">
                  <span class="font-bold text-emerald-400 font-mono text-sm">{fmt(p.price)}</span>
                  {#if p.original_price}
                    <span class="text-[10px] line-through text-gray-500 ml-1">{fmt(p.original_price)}</span>
                  {/if}
                </td>

                <!-- Sizes & Colors -->
                <td class="py-3 px-4">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-1 flex-wrap">
                      {#each (p.colors || []) as c}
                        <span class="w-2.5 h-2.5 rounded-full border border-white/30" style="background: {c.hex};" title={c.name}></span>
                      {/each}
                      <span class="text-[10px] text-gray-400 ml-1">{(p.colors || []).length} color(s)</span>
                    </div>
                    <p class="text-[10px] text-indigo-300 font-mono">
                      Sizes: {(p.sizes || []).join(', ') || '—'}
                    </p>
                  </div>
                </td>

                <!-- Stock -->
                <td class="py-3 px-4">
                  <span class="font-mono font-semibold" style="color: {p.stock_status === 'out_of_stock' ? '#ef4444' : p.stock_status === 'low_stock' ? '#f59e0b' : '#22c55e'};">
                    {p.stock_quantity ?? 0}
                  </span>
                  <span class="text-[10px] text-gray-500 block uppercase">
                    {p.stock_status ? p.stock_status.replace('_', ' ') : 'in stock'}
                  </span>
                </td>

                <!-- Status Button -->
                <td class="py-3 px-4">
                  <button
                    onclick={() => toggleActive(p.id, p.is_active)}
                    disabled={toggling === p.id}
                    class="px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all disabled:opacity-50"
                    style="background: {p.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color: {p.is_active ? '#22c55e' : '#ef4444'}; border: 1px solid {p.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};"
                  >
                    {p.is_active ? '● Active' : '○ Inactive'}
                  </button>
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      onclick={() => startEdit(p)}
                      class="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/50 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onclick={() => cloneProduct(p)}
                      disabled={duplicatingId === p.id}
                      class="px-2 py-1 rounded-lg text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                      title="Duplicate / Clone Product"
                    >
                      📋
                    </button>
                    <button
                      onclick={() => deleteProduct(p.id, p.name)}
                      disabled={deletingId === p.id}
                      class="px-2 py-1 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 border border-red-800/40 cursor-pointer"
                      title="Delete Product"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
