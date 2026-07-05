<script lang="ts">
  interface StoryItem {
    title: string;
    image: string;
    href: string;
  }

  // Default stories data array provided by the user
  const defaultStories: StoryItem[] = [
    {
      title: "✨ WEDGES",
      image: "https://ik.imagekit.io/who7qvgvp/frenchtoes_virginia_black_2_ITtFmHwxm.jpg?updatedAt=1782557488154",
      href: "/shop?category=wedges"
    },
    {
      title: "✨ FLATS",
      image: "https://ik.imagekit.io/who7qvgvp/frenchtoes_phoenix_white_2_t5V55W0gA.jpg?updatedAt=1782557471480",
      href: "/shop?category=flats"
    },
    {
      title: "✨ DAILY COMFORT",
      image: "https://ik.imagekit.io/who7qvgvp/frenchtoes_phoenix_tan_2_vgejSsoo3.jpg?updatedAt=1782557468096",
      href: "/shop?category=daily-comfort"
    },
    {
      title: "Shop All",
      image: "https://ik.imagekit.io/who7qvgvp/frenchtoes_phoenix_black_2_d5qQ6B6bN.jpg?updatedAt=1782557464758",
      href: "/shop"
    },
    {
      title: "Discounts",
      image: "https://ik.imagekit.io/who7qvgvp/frenchtoes_phoenix_berry_2_OCJLuV17S.jpg?updatedAt=1782557461516",
      href: "/shop?badge=Sale"
    },
    {
      title: "Sale",
      image: "https://ik.imagekit.io/who7qvgvp/frenchtoes_virginia_black_2_ITtFmHwxm.jpg?updatedAt=1782557488154",
      href: "/shop?badge=Sale"
    }
  ];

  // Svelte 5 reactive props configuration with fallbacks
  interface Props {
    items?: StoryItem[];
  }

  let { items = defaultStories }: Props = $props();
</script>

<section class="stories-section py-6 bg-[#FDFBF7] border-b border-[#f0e0e8]/30 overflow-hidden select-none">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="stories-scroll-container">
      {#each items as item}
        <a href={item.href} class="story-item group">
          <div class="story-circle-container">
            <!-- Animated spinning gradient border (Instagram style) -->
            <div class="story-gradient-bg"></div>
            
            <!-- White space gap wrapper -->
            <div class="story-inner-gap">
              <img 
                src={item.image} 
                alt={item.title} 
                class="story-image" 
                loading="lazy"
              />
            </div>
          </div>
          
          <!-- Typography directly below the circle -->
          <span class="story-title">{item.title}</span>
        </a>
      {/each}
    </div>
  </div>
</section>

<style>
  /* Scroll container configuration with cross-browser scrollbar hiding */
  .stories-scroll-container {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE & Edge */
    -webkit-overflow-scrolling: touch; /* Momentum scrolling for iOS */
    padding: 6px 4px 10px 4px;
  }

  @media (min-width: 768px) {
    .stories-scroll-container {
      gap: 24px;
      justify-content: center; /* Center items on desktop */
    }
  }

  .stories-scroll-container::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }

  /* Story Item structure */
  .story-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
    cursor: pointer;
    outline: none;
  }

  /* Perfect circle container for the border and image */
  .story-circle-container {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
    box-shadow: 0 4px 10px rgba(216, 27, 96, 0.08);
  }

  @media (min-width: 768px) {
    .story-circle-container {
      width: 86px;
      height: 86px;
    }
  }

  .story-item:hover .story-circle-container {
    transform: scale(1.06);
    box-shadow: 0 6px 16px rgba(216, 27, 96, 0.16);
  }

  /* Custom spinning gradient animation */
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Conic gradient using custom brand-aligned colors */
  .story-gradient-bg {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      #d81b60 0%,   /* Brand Magenta */
      #ff2e93 25%,  /* Vivid Pink */
      #ff8a80 50%,  /* Soft Coral */
      #ffb347 75%,  /* Sunset Gold */
      #d81b60 100%  /* Brand Magenta */
    );
    animation: spin 3s linear infinite;
    transform-origin: center;
  }

  /* Interactive speed up on hover */
  .story-item:hover .story-gradient-bg {
    animation-duration: 1.5s;
  }

  /* White space gap (Instagram style spacing) */
  .story-inner-gap {
    position: absolute;
    inset: 3px; /* Controls border thickness */
    border-radius: 50%;
    background: #ffffff; /* White background gap */
    padding: 3px; /* Gap between white border and image */
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    z-index: 1;
  }

  /* Circular image */
  .story-image {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    transition: transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  }

  .story-item:hover .story-image {
    transform: scale(1.08);
  }

  /* Typography configuration */
  .story-title {
    margin-top: 8px;
    font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-text-dark, #2d1b2e);
    text-align: center;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    transition: color 0.2s ease;
  }

  @media (min-width: 768px) {
    .story-title {
      font-size: 0.78rem;
    }
  }

  .story-item:hover .story-title {
    color: var(--color-brand-magenta, #d81b60);
  }
</style>
