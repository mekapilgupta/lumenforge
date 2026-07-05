<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchBestSellerVariantCards, type VariantCard } from '$lib/api/products';
  import VariantCardComponent from './VariantCard.svelte';

  let trending = $state<VariantCard[]>([]);
  let loading = $state(true);

  onMount(async () => {
    trending = await fetchBestSellerVariantCards();
    loading = false;
  });

  // Duplicate for seamless scroll
  const scrollItems = $derived([...trending, ...trending]);
</script>

<section class="trending-section">
  <div class="trending-container">
    <!-- Header -->
    <div class="trending-header">
      <div class="trending-title">
        <span class="trending-icon">🔥</span>
        <h2>Trending Now</h2>
      </div>
      <a href="/shop?badge=Best+Seller" class="trending-link">
        View All
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    </div>

    <!-- Auto-scrolling carousel -->
    {#if loading}
      <div class="trending-skeleton">
        {#each Array(5) as _}
          <div class="skeleton-card">
            <div class="skeleton-image"></div>
            <div class="skeleton-text"></div>
          </div>
        {/each}
      </div>
    {:else if trending.length > 0}
      <div class="trending-scroll-wrapper">
        <div class="trending-track">
          {#each scrollItems as item}
            <div class="trending-card-wrapper">
              <VariantCardComponent variant={item} showSold={true} />
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="trending-empty">
        <p>Check back soon for trending styles! 🌸</p>
      </div>
    {/if}
  </div>
</section>

<style>
  .trending-section {
    padding: 32px 0;
    background: white;
    overflow: hidden;
  }
  
  .trending-container {
    max-width: 100%;
  }
  
  .trending-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    margin-bottom: 20px;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .trending-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .trending-icon {
    font-size: 1.5rem;
  }
  
  .trending-title h2 {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--color-text-dark, #2d1b2e);
    margin: 0;
  }
  
  .trending-link {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-blush-deep, #f4a7c3);
    text-decoration: none;
    transition: color 0.2s;
  }
  
  .trending-link:hover {
    color: var(--color-coral-deep, #ff7f6e);
  }
  
  .trending-scroll-wrapper {
    overflow: hidden;
  }
  
  .trending-track {
    display: flex;
    gap: 16px;
    width: max-content;
    animation: trendingScroll 45s linear infinite;
    padding: 0 16px;
  }
  
  .trending-track:hover {
    animation-play-state: paused;
  }
  
  .trending-card-wrapper {
    width: 200px;
    flex-shrink: 0;
  }
  
  @keyframes trendingScroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  
  .trending-skeleton {
    display: flex;
    gap: 16px;
    padding: 0 16px;
    overflow: hidden;
  }
  
  .skeleton-card {
    width: 200px;
    flex-shrink: 0;
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
  
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  .trending-empty {
    text-align: center;
    padding: 40px 20px;
    color: var(--color-text-mid, #6b4c6e);
  }
  
  @media (min-width: 768px) {
    .trending-section {
      padding: 48px 0;
    }
    
    .trending-title h2 {
      font-size: 1.6rem;
    }
    
    .trending-card-wrapper {
      width: 220px;
    }
  }
</style>