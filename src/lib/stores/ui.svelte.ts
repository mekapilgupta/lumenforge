// ─── UI Store — Svelte 5 Runes (Functional Closure) ───────────────────────────
import type { Toast, ToastType } from '$lib/types';

function createUIStore() {
  let toasts = $state<Toast[]>([]);
  let mobileMenuOpen = $state(false);
  let searchOpen = $state(false);
  let quickSizeProduct = $state<any>(null);
  let quickSizeCallback = $state<((size: number) => void) | null>(null);

  function addToast(message: string, type: ToastType = 'success', duration = 3000) {
    const id = crypto.randomUUID();
    toasts = [...toasts, { id, message, type }];
    setTimeout(() => removeToast(id), duration);
  }

  function removeToast(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
  }

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  function toggleSearch() {
    searchOpen = !searchOpen;
  }

  function openQuickSize(product: any, callback: (size: number) => void) {
    quickSizeProduct = product;
    quickSizeCallback = callback;
  }

  function closeQuickSize() {
    quickSizeProduct = null;
    quickSizeCallback = null;
  }

  return {
    get toasts() { return toasts; },
    set toasts(v) { toasts = v; },
    get mobileMenuOpen() { return mobileMenuOpen; },
    set mobileMenuOpen(v) { mobileMenuOpen = v; },
    get searchOpen() { return searchOpen; },
    set searchOpen(v) { searchOpen = v; },
    get quickSizeProduct() { return quickSizeProduct; },
    set quickSizeProduct(v) { quickSizeProduct = v; },
    get quickSizeCallback() { return quickSizeCallback; },
    set quickSizeCallback(v) { quickSizeCallback = v; },
    addToast,
    removeToast,
    toggleMobileMenu,
    closeMobileMenu,
    toggleSearch,
    openQuickSize,
    closeQuickSize
  };
}

let instance: ReturnType<typeof createUIStore>;
function getInstance() {
  if (!instance) {
    instance = createUIStore();
  }
  return instance;
}

export const uiStore = {
  get toasts() { return getInstance().toasts; },
  set toasts(v) { getInstance().toasts = v; },
  get mobileMenuOpen() { return getInstance().mobileMenuOpen; },
  set mobileMenuOpen(v) { getInstance().mobileMenuOpen = v; },
  get searchOpen() { return getInstance().searchOpen; },
  set searchOpen(v) { getInstance().searchOpen = v; },
  get quickSizeProduct() { return getInstance().quickSizeProduct; },
  set quickSizeProduct(v) { getInstance().quickSizeProduct = v; },
  get quickSizeCallback() { return getInstance().quickSizeCallback; },
  set quickSizeCallback(v) { getInstance().quickSizeCallback = v; },
  addToast(message: string, type?: any, duration?: number) { return getInstance().addToast(message, type, duration); },
  removeToast(id: string) { return getInstance().removeToast(id); },
  toggleMobileMenu() { return getInstance().toggleMobileMenu(); },
  closeMobileMenu() { return getInstance().closeMobileMenu(); },
  toggleSearch() { return getInstance().toggleSearch(); },
  openQuickSize(product: any, callback: (size: number) => void) { return getInstance().openQuickSize(product, callback); },
  closeQuickSize() { return getInstance().closeQuickSize(); }
};
