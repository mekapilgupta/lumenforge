<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchAllVariantCards, type VariantCard } from '$lib/api/products';
  import VariantCardComponent from './VariantCard.svelte';

  let allVariants = $state<VariantCard[]>([]);
  let loading = $state(true);
  let showCount = $state(12);

  onMount(async () => {
    allVariants = await fetchAllVariantCards();
    loading = false;
  });

  const displayVariants = $derived(allVariants.slice(0, showCount));
  const hasMore = $derived(showCount < allVariants.length);

  function loadMore() {
    showCount += 12;
  }
</script>

<section class="just-for-you-section">
  <div class="jfy-container">
    <!-- Header -->
    <div class="jfy-header">
      <div class="jfy-title">
        <span class="jfy-icon">💝</span>
        <h2>Just For You</h2>
      </div>
      <p class="jfy-subtitle">Discover styles picked for Indian summers</p>
    </div>

    <!-- Grid -->
    {#if loading}
      <div class="jfy-grid">
        {#each Array(8) as _}
          <div class="jfy-skeleton">
            <div class="skeleton-image"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text short"></div>
          </div>
        {/each}
      </div>
    {:else if allVariants.length > 0}
      <div class="jfy-grid">
        {#each displayVariants as variant}
          <VariantCardComponent {variant} showSold={true} />
        {/each}
      </div>
      
      {#if hasMore}
        <div class="jfy-load-more">
          <button onclick={loadMore} class="load-more-btn">
            Load More Styles
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      {/if}
    {:else}
      <div class="jfy-empty">
        <p>Styles coming soon! Stay tuned 🌸</p>
      </div>
    {/if}
  </div>
</section>

<style>
  .just-for-you-section {
    padding: 40px 16px;
    background: var(--color-cream, #fdf8f3);
  }
  
  .jfy-container {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .jfy-header {
    text-align: center;
    margin-bottom: 24px;
  }
  
  .jfy-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .jfy-icon {
    font-size: 1.5rem;
  }
  
  .jfy-title h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-dark, #2d1b2e);
    margin: 0;
  }
  
  .jfy-subtitle {
    font-size: 0.9rem;
    color: var(--color-text-mid, #6b4c6e);
    margin: 8px 0 0;
  }
  
  .jfy-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  @media (min-width: 640px) {
    .jfy-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
  }
  
  @media (min-width: 1024px) {
    .jfy-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  
  @media (min-width: 1280px) {
    .jfy-grid {
      grid-template-columns: repeat(6, 1fr);
    }
  }
  
  .jfy-skeleton {
    background: white;
    border-radius: 12px;
    overflow: hidden;
  }
  
  .skeleton-image {
    aspect-ratio: 1;
    background: linear-gradient(90deg, #f0e0e8 25%, #f8e8f0 50%, #f0e0e8 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  
  .skeleton-text {
    height: 12px;
    margin: 12px;
    background: #f0e0e8;
    border-radius: 4px;
  }
  
  .skeleton-text.short {
    width: 60%;
    margin-top: 8px;
  }
  
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  .jfy-load-more {
    text-align: center;
    margin-top: 32px;
  }
  
  .load-more-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 32px;
    background: white;
    border: 2px solid var(--color-blush-deep, #f4a7c3);
    border-radius: 999px;
    color: var(--color-blush-deep, #f4a7c3);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .load-more-btn:hover {
    background: var(--color-blush-deep, #f4a7c3);
    color: white;
  }
  
  .jfy-empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--color-text-mid, #6b4c6e);
  }
  
  @media (min-width: 768px) {
    .just-for-you-section {
      padding: 56px 24px;
    }
    
    .jfy-title h2 {
      font-size: 1.8rem;
    }
  }
</style>