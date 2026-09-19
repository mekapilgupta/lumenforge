<script lang="ts">
  import { findSizeOption } from '$lib/sizes';

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
    return available.some(x => {
      const optA = findSizeOption(x);
      const optB = findSizeOption(s);
      if (optA && optB) return optA.euro === optB.euro;
      return Number(x) === Number(s);
    });
  }
</script>

<div class="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Size selection">
  {#each sizes as size}
    {@const opt = findSizeOption(size)}
    {@const avail = isAvailable(size)}
    {@const isSelected = selected !== null && (selected === size || (opt && findSizeOption(selected)?.euro === opt.euro))}
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label="{opt ? `UK ${opt.ukIndia} (EU ${opt.euro})` : `Size ${size}`}{!avail ? ' — Out of stock' : ''}"
      disabled={!avail}
      onclick={() => avail && onSelect(size)}
      class="relative min-w-[54px] h-12 px-3 rounded-xl border-2 text-xs font-semibold transition-all duration-200 flex flex-col items-center justify-center cursor-pointer group"
      style="
        border-color: {isSelected ? 'var(--color-blush-deep)' : avail ? 'rgba(180,100,140,0.25)' : 'rgba(0,0,0,0.1)'};
        background: {isSelected ? 'var(--color-blush)' : avail ? 'white' : 'rgba(0,0,0,0.03)'};
        color: {isSelected ? 'var(--color-blush-deep)' : avail ? 'var(--color-text-dark)' : 'rgba(0,0,0,0.3)'};
        cursor: {avail ? 'pointer' : 'not-allowed'};
        box-shadow: {isSelected ? '0 0 0 3px rgba(244,167,195,0.3)' : 'none'};
      "
    >
      {#if opt}
        <span class="font-bold text-xs leading-none">UK {opt.ukIndia}</span>
        <span class="text-[10px] opacity-70 leading-none mt-1">EU {opt.euro}</span>
      {:else}
        <span class="font-bold text-xs">{size}</span>
      {/if}

      {#if !avail}
        <!-- Strikethrough line for OOS -->
        <span
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <span
            class="absolute w-full h-0.5 bg-red-400/40 rotate-45"
            style="top: 50%; left: 0;"
          ></span>
        </span>
      {/if}
    </button>
  {/each}
</div>

<p class="text-xs mt-2.5 flex items-center gap-1.5" style="color: var(--color-text-soft);">
  <span>💡</span>
  <span>Fit Guide: Standard UK/India sizing. <strong>UK 4 = EU 37</strong> (22.5 cm).</span>
</p>
