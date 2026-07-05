<script lang="ts">
  import type { ColorVariant } from '$lib/types';

  let {
    colors,
    selected,
    onSelect,
    size = 'md',
  }: {
    colors: ColorVariant[];
    selected: ColorVariant;
    onSelect: (c: ColorVariant) => void;
    size?: 'sm' | 'md' | 'lg';
  } = $props();

  const dim = { sm: 20, md: 28, lg: 36 };
  const px = $derived(dim[size]);
</script>

<div class="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Color selection">
  {#each colors as color}
    <button
      type="button"
      role="radio"
      aria-checked={selected.name === color.name}
      aria-label="{color.name} color"
      title={color.name}
      onclick={() => onSelect(color)}
      class="rounded-full border-2 transition-all duration-200 hover:scale-110 focus-visible:outline-2"
      style="
        width: {px}px;
        height: {px}px;
        background: {color.hex};
        border-color: {selected.name === color.name ? 'var(--color-blush-deep)' : 'transparent'};
        box-shadow: {selected.name === color.name
          ? '0 0 0 2px white, 0 0 0 4px var(--color-blush-deep)'
          : '0 1px 3px rgba(0,0,0,0.15)'};
      "
    ></button>
  {/each}
</div>
