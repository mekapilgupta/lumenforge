<script lang="ts">
  let {
    sizes,
    available,
    selected,
    onSelect,
  }: {
    sizes: number[];
    available: number[];
    selected: number | null;
    onSelect: (s: number) => void;
  } = $props();

  function isAvailable(s: number): boolean {
    return available.includes(s);
  }
</script>

<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Size selection">
  {#each sizes as size}
    {@const avail = isAvailable(size)}
    {@const isSelected = selected === size}
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label="Size {size}{!avail ? ' — out of stock' : ''}"
      disabled={!avail}
      onclick={() => avail && onSelect(size)}
      class="relative min-w-[44px] h-11 px-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200"
      style="
        border-color: {isSelected ? 'var(--color-blush-deep)' : avail ? 'rgba(180,100,140,0.25)' : 'rgba(0,0,0,0.1)'};
        background: {isSelected ? 'var(--color-blush)' : avail ? 'white' : 'rgba(0,0,0,0.03)'};
        color: {isSelected ? 'var(--color-blush-deep)' : avail ? 'var(--color-text-dark)' : 'rgba(0,0,0,0.3)'};
        cursor: {avail ? 'pointer' : 'not-allowed'};
        box-shadow: {isSelected ? '0 0 0 3px rgba(244,167,195,0.3)' : 'none'};
      "
    >
      {size}
      {#if !avail}
        <!-- Strikethrough line for OOS -->
        <span
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <span
            class="absolute w-full h-px rotate-45"
            style="background: rgba(0,0,0,0.2); top: 50%; left: 0;"
          ></span>
        </span>
      {/if}
    </button>
  {/each}
</div>

<p class="text-xs mt-2" style="color: var(--color-text-soft);">
  Indian size guide: 35 = UK 2, 36 = UK 3, 37 = UK 4, 38 = UK 5, 39 = UK 6, 40 = UK 7, 41 = UK 8, 42 = UK 9
</p>
