<script lang="ts">
  interface StoryItem {
    title: string;
    image: string;
    href: string;
    badge?: string;
    badgeColor?: string;
  }

  // Default stories data array matching Neeman's explore bar with festive graphics
  const defaultStories: StoryItem[] = [
    {
      title: "Festive Picks",
      image: "/images/festive/hero_banner_navratri.jpg",
      href: "/shop?badge=Best+Seller",
      badge: "HOT",
      badgeColor: "#d81b60"
    },
    {
      title: "Garba Ready",
      image: "/images/festive/story_garba_flats.jpg",
      href: "/shop?category=flats",
      badge: "NEW",
      badgeColor: "#e07020"
    },
    {
      title: "Diwali Luxe",
      image: "/images/festive/hero_banner_diwali.jpg",
      href: "/shop?badge=Sale",
      badge: "FESTIVE",
      badgeColor: "#9e6d1c"
    },
    {
      title: "Wedges",
      image: "/images/festive/story_wedges.jpg",
      href: "/shop?category=wedges"
    },
    {
      title: "Flats",
      image: "/images/festive/story_garba_flats.jpg",
      href: "/shop?category=flats"
    },
    {
      title: "Daily Comfort",
      image: "/images/festive/story_daily_comfort.jpg",
      href: "/shop?category=daily-comfort"
    },
    {
      title: "All Footwear",
      image: "/images/festive/story_shop_all.jpg",
      href: "/shop"
    },
    {
      title: "Festive Offers",
      image: "/images/festive/story_festive_sale.jpg",
      href: "/shop?badge=Sale",
      badge: "20% OFF",
      badgeColor: "#d81b60"
    }
  ];

  interface Props {
    items?: StoryItem[];
  }

  let { items = defaultStories }: Props = $props();
</script>

<section class="explore-bar-section py-4 sm:py-5 bg-[#FFFFFF] border-b border-[#f0e0e8]/50 overflow-hidden select-none shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center lg:items-center gap-3 lg:gap-6">
    
    <!-- Left label (Neeman's style) -->
    <div class="shrink-0 flex items-center gap-2 self-start lg:self-center">
      <span class="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[#7a6270]">
        Shop & Explore
      </span>
      <span class="w-1.5 h-1.5 rounded-full bg-[#d81b60] animate-pulse"></span>
    </div>

    <!-- Scrollable category icons -->
    <div class="stories-scroll-container w-full">
      {#each items as item}
        <a href={item.href} class="story-item group">
          <div class="story-circle-container">
            <!-- Subtle gradient border ring -->
            <div class="story-gradient-bg"></div>
            
            <!-- White space gap wrapper -->
            <div class="story-inner-gap">
              <img 
                src={item.image} 
                alt={item.title} 
                class="story-image" 
                loading="eager"
              />
            </div>

            <!-- Optional overlay pill badge (NEW, EXCLUSIVE, etc.) -->
            {#if item.badge}
              <div class="story-badge-pill" style="background: {item.badgeColor || '#d81b60'};">
                {item.badge}
              </div>
            {/if}
          </div>
          
          <!-- Typography directly below the circle -->
          <span class="story-title">{item.title}</span>
        </a>
      {/each}
    </div>
  </div>
</section>

<style>
  .stories-scroll-container {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    padding: 6px 4px 6px 4px;
    align-items: flex-start;
  }

  @media (min-width: 1024px) {
    .stories-scroll-container {
      gap: 22px;
      justify-content: flex-start;
    }
  }

  .stories-scroll-container::-webkit-scrollbar {
    display: none;
  }

  .story-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
    cursor: pointer;
    outline: none;
  }

  .story-circle-container {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @media (min-width: 768px) {
    .story-circle-container {
      width: 72px;
      height: 72px;
    }
  }

  .story-item:hover .story-circle-container {
    transform: translateY(-2px) scale(1.05);
  }

  .story-gradient-bg {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, #d81b60 0%, #ff8a80 50%, #ffb347 100%);
    box-shadow: 0 2px 8px rgba(216, 27, 96, 0.15);
  }

  .story-inner-gap {
    position: absolute;
    inset: 2.5px;
    border-radius: 50%;
    background: #ffffff;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    z-index: 1;
  }

  .story-image {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }

  .story-item:hover .story-image {
    transform: scale(1.08);
  }

  .story-badge-pill {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    color: #ffffff;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 999px;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    border: 1.5px solid #ffffff;
  }

  .story-title {
    margin-top: 6px;
    font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
    font-size: 0.70rem;
    font-weight: 600;
    color: #3d2b38;
    text-align: center;
    white-space: nowrap;
    letter-spacing: 0.02em;
    transition: color 0.2s ease;
  }

  @media (min-width: 768px) {
    .story-title {
      font-size: 0.75rem;
    }
  }

  .story-item:hover .story-title {
    color: #d81b60;
  }
</style>
