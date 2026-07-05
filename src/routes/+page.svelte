<script lang="ts">
  import HeroSlider from '$lib/components/home/HeroSlider.svelte';
  import SaleBanner from '$lib/components/home/SaleBanner.svelte';
  import CategoryStories from '$lib/components/home/CategoryStories.svelte';
  import CategorySlider from '$lib/components/home/CategorySlider.svelte';
  import MarqueeStrip from '$lib/components/home/MarqueeStrip.svelte';
  import BestSellers from '$lib/components/home/BestSellers.svelte';
  import ProductCarousel from '$lib/components/home/ProductCarousel.svelte';
  import SocialVideos from '$lib/components/home/SocialVideos.svelte';
  import ShopByColor from '$lib/components/home/ShopByColor.svelte';
  import WhyFrenchToes from '$lib/components/home/WhyFrenchToes.svelte';
  import Testimonials from '$lib/components/home/Testimonials.svelte';
  import Newsletter from '$lib/components/home/Newsletter.svelte';
</script>

<svelte:head>
  <title>French Toes — Premium Women's Slippers for Indian Summers</title>
  <meta name="description" content="Shop French Toes — premium, breathable, limited-edition women's slippers in blossom pastels. Perfect for Indian summers. Free shipping on all orders." />
</svelte:head>

<!-- Hero Section -->
<HeroSlider />

<!-- Sale Banner marquee -->
<SaleBanner />

<!-- Instagram Style Category Stories -->
<CategoryStories />

<!-- Shop by Category Slider -->
<CategorySlider />



<!-- Category Marquee Strip -->
<MarqueeStrip />

<!-- Best Sellers / New Arrivals grid with tabs -->
<BestSellers />

<!-- Auto-scrolling Product Carousel -->
<ProductCarousel />

<!-- Videos Showcase -->
<SocialVideos />

<!-- Shop by Color -->
<ShopByColor />

<!-- Why French Toes features -->
<WhyFrenchToes />

<!-- Summer Sale promo strip -->
<section class="py-16 px-4 relative overflow-hidden" style="background-image: linear-gradient(135deg, rgba(62, 56, 60, 0.9) 0%, rgba(31, 29, 30, 0.92) 100%), url('https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1600&q=80'); background-size: cover; background-position: center;">
  <!-- Background pattern -->
  <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle, var(--color-blush-deep) 1px, transparent 1px); background-size: 30px 30px;"></div>
  
  <div class="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left relative z-10">
    <div class="anim-fade-up">
      <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--color-blush-deep);">Limited Time Offer</p>
      <h2 class="font-display text-3xl md:text-5xl font-bold text-white">Blossom Summer Sale</h2>
      <p class="mt-3 text-base md:text-lg" style="color: rgba(255,255,255,0.75);">Up to 40% off on selected styles. Ends June 30, 2026.</p>
    </div>
    <a href="/shop?badge=Sale" class="btn-primary btn-shimmer px-10 py-4 text-base shrink-0 anim-fade-up">
      <span>Shop the Sale</span>
      <svg width="18" height="18" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </a>
  </div>
</section>

<!-- Testimonials -->
<Testimonials />

<!-- Newsletter -->
<Newsletter />