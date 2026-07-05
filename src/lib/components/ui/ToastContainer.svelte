<script lang="ts">
  import { fly } from 'svelte/transition';
  import { uiStore } from '$lib/stores/ui.svelte';
  import type { Toast } from '$lib/types';

  const icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  const bgColors: Record<string, string> = {
    success: 'var(--color-mint)',
    error: '#fde8e8',
    info: 'var(--color-lavender)',
  };
</script>

<div
  class="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-[100] flex flex-col gap-2 pointer-events-none w-[max-content] max-w-[90vw]"
  aria-live="polite"
  aria-label="Notifications"
>
  {#each uiStore.toasts as toast (toast.id)}
    <div
      class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg pointer-events-auto w-full max-w-[90vw] sm:w-72 toast-{toast.type}"
      style="background: {bgColors[toast.type]};"
      transition:fly={{ x: 60, duration: 250 }}
      role="alert"
    >
      <span
        class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style="background: {toast.type === 'success' ? 'var(--color-mint-deep)' : toast.type === 'error' ? 'var(--color-coral-deep)' : 'var(--color-lavender-deep)'};"
        aria-hidden="true"
      >
        {icons[toast.type]}
      </span>
      <p class="text-sm font-medium flex-1 break-words whitespace-normal" style="color: var(--color-text-dark);">{toast.message}</p>
      <button
        onclick={() => uiStore.removeToast(toast.id)}
        class="shrink-0 transition-opacity hover:opacity-60"
        aria-label="Dismiss notification"
        style="color: var(--color-text-soft);"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {/each}
</div>
