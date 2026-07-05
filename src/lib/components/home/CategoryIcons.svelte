<script lang="ts">
  const categories = [
    { icon: '👡', label: 'All Slippers', href: '/shop' },
    { icon: '🌸', label: 'Pastels', href: '/shop?color=Berry' },
    { icon: '🔥', label: 'Sale', href: '/shop?badge=Sale' },
    { icon: '⭐', label: 'Best Sellers', href: '/shop?badge=Best+Seller' },
    { icon: '🆕', label: 'New Arrivals', href: '/shop?badge=New+Arrival' },
    { icon: '🖤', label: 'Black', href: '/shop?color=Black' },
    { icon: '🍑', label: 'Peach', href: '/shop?color=Peach' },
    { icon: '🌿', label: 'Sea Green', href: '/shop?color=SeaGreen' },
  ];
</script>

<section class="category-icons-section">
  <div class="category-icons-container">
    {#each categories as cat}
      <a href={cat.href} class="category-icon-item">
        <div class="category-icon-circle">
          <span class="category-icon-emoji">{cat.icon}</span>
        </div>
        <span class="category-icon-label">{cat.label}</span>
      </a>
    {/each}
  </div>
</section>

<style>
  .category-icons-section {
    padding: 24px 16px;
    background: white;
    border-bottom: 1px solid #f0e0e8;
  }
  
  .category-icons-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-around;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .category-icons-container::-webkit-scrollbar {
    display: none;
  }
  
  .category-icon-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    min-width: 70px;
    transition: transform 0.2s ease;
  }
  
  .category-icon-item:hover {
    transform: translateY(-2px);
  }
  
  .category-icon-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fff5f8 0%, #fde8f0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(244, 167, 195, 0.2);
    transition: box-shadow 0.2s ease;
  }
  
  .category-icon-item:hover .category-icon-circle {
    box-shadow: 0 4px 16px rgba(244, 167, 195, 0.35);
  }
  
  .category-icon-emoji {
    font-size: 1.5rem;
  }
  
  .category-icon-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-mid, #6b4c6e);
    text-align: center;
    white-space: nowrap;
  }
  
  @media (min-width: 768px) {
    .category-icons-section {
      padding: 32px 24px;
    }
    
    .category-icon-circle {
      width: 64px;
      height: 64px;
    }
    
    .category-icon-emoji {
      font-size: 1.75rem;
    }
    
    .category-icon-label {
      font-size: 0.8rem;
    }
  }
</style>