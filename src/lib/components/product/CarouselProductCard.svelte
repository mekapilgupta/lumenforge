<script lang="ts">
  import { fade } from 'svelte/transition';

  interface ColorItem {
    id: string;
    name: string;
    hex: string;
    image: string;
    slug: string;
    price: number;
    originalPrice?: number;
    badges: string[];
  }

  interface GroupedProduct {
    modelName: string;
    colors: ColorItem[];
  }

  let { 
    product, 
    colors, 
    handleQuickAdd, 
    addingId 
  }: { 
    product: GroupedProduct; 
    colors: ColorItem[]; 
    handleQuickAdd: (color: ColorItem, name: string) => void;
    addingId: string | null;
  } = $props();

  let activeColorIndex = $state(0);
  const activeColor = $derived(colors[activeColorIndex] || colors[0]);
  let hovering = $state(false);

  // Discount percentage helper
  const discountPercent = $derived(
    activeColor.originalPrice
      ? Math.round((1 - activeColor.price / activeColor.originalPrice) * 100)
      : null
  );

  function getCardVisualStyles(color: string) {
    const colLower = color.toLowerCase();
    
    if (colLower.includes('beige') || colLower.includes('white') || colLower.includes('nude') || colLower.includes('tan')) {
      return {
        bg: 'background: linear-gradient(135deg, #FAF6F0 0%, #F3ECE3 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    }
    
    if (colLower.includes('black')) {
      return {
        bg: 'background: linear-gradient(135deg, #444446 0%, #2c2c2e 100%);',
        border: 'rgba(255,255,255,0.15)',
        darkCard: true
      };
    }
    
    if (colLower.includes('navy')) {
      return {
        bg: 'background: linear-gradient(135deg, #2b394a 0%, #151e29 100%);',
        border: 'rgba(255,255,255,0.15)',
        darkCard: true
      };
    }
    
    if (colLower.includes('berry') || colLower.includes('pink')) {
      return {
        bg: 'background: linear-gradient(135deg, #FFF0F5 0%, #FADADD 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    }
    
    if (colLower.includes('peach')) {
      return {
        bg: 'background: linear-gradient(135deg, #FFF5EC 0%, #FFE5D9 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    }

    if (colLower.includes('lavender')) {
      return {
        bg: 'background: linear-gradient(135deg, #F6F0FA 0%, #E8DFF5 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    }

    if (colLower.includes('mint') || colLower.includes('green') || colLower.includes('olive') || colLower.includes('seagreen')) {
      return {
        bg: 'background: linear-gradient(135deg, #F0FBF5 0%, #D8F3E5 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    }

    if (colLower.includes('coral')) {
      return {
        bg: 'background: linear-gradient(135deg, #FFF2F0 0%, #FFD6D0 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    }

    if (colLower.includes('gold')) {
      return {
        bg: 'background: linear-gradient(135deg, #FAF6E8 0%, #F1E5C4 100%);',
        border: 'rgba(216, 27, 96, 0.08)',
        darkCard: false
      };
    }
    
    return {
      bg: 'background: linear-gradient(135deg, #FDFBF7 0%, #F5EFEB 100%);',
      border: 'rgba(216, 27, 96, 0.08)',
      darkCard: false
    };
  }
</script>

<div 
  class="w-[280px] md:w-[310px] shrink-0 snap-start flex flex-col group relative select-none rounded-2xl p-3 border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 lush-card lush-card-pattern"
  class:dark-card={getCardVisualStyles(activeColor.name).darkCard}
  style="{getCardVisualStyles(activeColor.name).bg} border-color: {getCardVisualStyles(activeColor.name).darkCard ? 'rgba(255,255,255,0.08)' : 'rgba(216, 27, 96, 0.08)'};"
  onmouseenter={() => hovering = true}
  onmouseleave={() => hovering = false}
  role="article"
  aria-label="{product.modelName} slipper color variant select"
>
  <!-- Shiny Animated Glitter Overlay on Hover -->
  <div class="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.8)_0%,transparent_50%)] pointer-events-none" aria-hidden="true"></div>

  <!-- Image Container (approx 80% of card height visually) -->
  <a href="/product/{activeColor.slug}" class="block relative w-full h-[320px] rounded-xl overflow-hidden bg-[#F5F5F5] flex items-center justify-center border border-black/5" tabindex="-1">
    <img 
      src={activeColor.image} 
      alt="{product.modelName} in {activeColor.name}" 
      class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
      loading="lazy"
    />
    
    <!-- Badges -->
    <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
      {#each activeColor.badges.slice(0, 2) as badge}
        <span 
          class="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md text-white shadow-sm"
          style="background-color: {
            badge === 'Sale' ? 'var(--color-brand-magenta)' : 
            badge === 'Best Seller' ? 'var(--color-gold)' : 
            badge === 'New Arrival' ? 'var(--color-mint-deep)' : 
            'var(--color-lavender-deep)'
          };"
        >
          {badge === 'Sale' && discountPercent ? `-${discountPercent}%` : badge}
        </span>
      {/each}
    </div>

    <!-- Smooth overlay grid -->
    <div class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

    <!-- Quick Add overlay on hover -->
    <div 
      class="absolute bottom-4 left-3 right-3 transition-all duration-300 z-10"
      style="
        opacity: {hovering ? 1 : 0};
        transform: translateY({hovering ? '0px' : '8px'});
      "
      onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }}
      role="button"
      tabindex="0"
    >
      <button 
        onclick={() => handleQuickAdd(activeColor, product.modelName)}
        class="w-full py-3 bg-[var(--color-brand-magenta)] text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-[#b0134b] transition-all hover:scale-[1.02] shadow-lg shadow-pink-900/10 cursor-pointer"
      >
        {#if addingId === activeColor.id}
          ✓ Added to Bag
        {:else}
          + Quick Add
        {/if}
      </button>
    </div>
  </a>

  <!-- Info Details Section -->
  <div class="pt-3 pb-1 flex flex-col gap-1.5">
    <div class="flex items-start justify-between gap-2">
      <!-- Model Name -->
      <a 
        href="/product/{activeColor.slug}" 
        class="font-display text-base font-bold hover:text-[var(--color-brand-magenta)] transition-colors truncate"
        style="color: {getCardVisualStyles(activeColor.name).darkCard ? 'white' : '#2d1b2e'};"
      >
        {product.modelName}
      </a>
      
      <!-- Price -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-sm font-bold" class:glow-price-drop={activeColor.originalPrice} class:text-white={getCardVisualStyles(activeColor.name).darkCard} class:text-[#2d1b2e]={!getCardVisualStyles(activeColor.name).darkCard}>₹{activeColor.price}</span>
        {#if activeColor.originalPrice}
          <span class="text-xs line-through font-light" style="color: {getCardVisualStyles(activeColor.name).darkCard ? 'rgba(255,255,255,0.5)' : '#9e7ca0'};">₹{activeColor.originalPrice}</span>
        {/if}
      </div>
    </div>

    <!-- Color swatches and selected color label -->
    <div class="flex items-center justify-between mt-1">
      <span class="text-[11px] font-medium leading-none" style="color: {getCardVisualStyles(activeColor.name).darkCard ? 'rgba(255,255,255,0.7)' : '#9e7ca0'};">
        Color: <strong class="font-semibold" style="color: {getCardVisualStyles(activeColor.name).darkCard ? 'white' : '#6b4c6e'};">{activeColor.name}</strong>
      </span>
      
      <!-- Swatch circles -->
      <div class="flex items-center gap-1.5" role="radiogroup" aria-label="Available colors">
        {#each colors as col, idx}
          <button 
            onclick={() => activeColorIndex = idx}
            onmouseenter={() => activeColorIndex = idx}
            class="w-5.5 h-5.5 rounded-full border transition-all flex items-center justify-center focus:outline-none cursor-pointer"
            style="
              border-color: {activeColorIndex === idx ? 'var(--color-brand-magenta)' : 'transparent'};
              border-width: 2px;
            "
            role="radio"
            aria-checked={activeColorIndex === idx}
            aria-label={col.name}
          >
            <span 
              class="w-3.5 h-3.5 rounded-full shadow-inner border border-black/5" 
              style="background-color: {col.hex};"
            ></span>
          </button>
        {/each}
      </div>
    </div>

  </div>
</div>

<style>
  :global(.glow-price-drop) {
    font-family: 'Outfit', sans-serif;
    color: var(--color-brand-magenta, #d81b60) !important;
    text-shadow: 0 0 8px rgba(216, 27, 96, 0.4);
    animation: priceGlow 2s infinite ease-in-out alternate;
  }
  @keyframes priceGlow {
    from { text-shadow: 0 0 4px rgba(216, 27, 96, 0.2); }
    to { text-shadow: 0 0 12px rgba(216, 27, 96, 0.7), 0 0 20px rgba(216, 27, 96, 0.3); }
  }
</style>
