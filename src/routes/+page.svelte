<script lang="ts">
  import CategoryStories from '$lib/components/home/CategoryStories.svelte';
  import HeroSlider from '$lib/components/home/HeroSlider.svelte';
  import SaleBanner from '$lib/components/home/SaleBanner.svelte';
  import FestiveFeatureGrid from '$lib/components/home/FestiveFeatureGrid.svelte';
  import FestivePicksSection from '$lib/components/home/FestivePicksSection.svelte';
  import FestiveOccasionGuide from '$lib/components/home/FestiveOccasionGuide.svelte';
  import ShopByColor from '$lib/components/home/ShopByColor.svelte';
  import WhyFrenchToes from '$lib/components/home/WhyFrenchToes.svelte';
  import FestiveCustomerReviews from '$lib/components/home/FestiveCustomerReviews.svelte';
  // import CategorySlider from '$lib/components/home/CategorySlider.svelte';
  // import MarqueeStrip from '$lib/components/home/MarqueeStrip.svelte';
  // import BestSellers from '$lib/components/home/BestSellers.svelte';
  // import ProductCarousel from '$lib/components/home/ProductCarousel.svelte';
</script>

<svelte:head>
  <title>French Toes — Festive Footwear for Navratri, Diwali & Beyond</title>
  <meta name="description" content="Shop French Toes — premium women's slippers perfect for Navratri garba, Diwali celebrations & festive occasions. Free shipping. COD available." />
</svelte:head>

<!-- 1. Shop & Explore Top Bar (Neeman's style — below header, above slider) -->
<CategoryStories />

<!-- 2. Hero Section (Single festive banner) -->
<HeroSlider />

<!-- 3. Sale Banner marquee -->
<SaleBanner />

<!-- 4. 3-Column Festive Highlights Grid (using generated festive artwork) -->
<FestiveFeatureGrid />

<!-- 5. ⭐ Festive Picks — auto-updating, all color variants from DB -->
<FestivePicksSection />

<!-- 6. Interactive Festive Occasion Styling Guide -->
<FestiveOccasionGuide />

<!-- 7. Shop by Color / Vibe -->
<ShopByColor />

<!-- 8. Why French Toes features (Festive Cards) -->
<WhyFrenchToes />

<!-- 9. Real Festive Stories & Verified Reviews -->
<FestiveCustomerReviews />

<!-- 10. Festive CTA Strip -->
<section class="py-16 px-4 relative overflow-hidden" style="background-image: linear-gradient(135deg, rgba(120, 20, 20, 0.90) 0%, rgba(60, 10, 50, 0.93) 100%), url('/images/festive/hero_banner_diwali.jpg'); background-size: cover; background-position: center;">
  <!-- Decorative diya glow blobs -->
  <div class="absolute top-4 left-8 w-32 h-32 rounded-full blur-3xl pointer-events-none" style="background: radial-gradient(circle, rgba(255,180,30,0.35), transparent);" aria-hidden="true"></div>
  <div class="absolute bottom-4 right-8 w-40 h-40 rounded-full blur-3xl pointer-events-none" style="background: radial-gradient(circle, rgba(255,80,30,0.30), transparent);" aria-hidden="true"></div>
  <!-- Rangoli dot pattern -->
  <div class="absolute inset-0 opacity-[0.07] pointer-events-none" style="background-image: radial-gradient(circle, #ffb347 1.5px, transparent 1.5px); background-size: 28px 28px;" aria-hidden="true"></div>

  <div class="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left relative z-10">
    <div>
      <p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: #ffb347;">🪔 Navratri · Diwali · Festive Season</p>
      <h2 class="font-display text-3xl md:text-5xl font-bold text-white">Celebrate in Style</h2>
      <p class="mt-3 text-base md:text-lg" style="color: rgba(255,255,255,0.75);">Find your perfect garba pair, diwali pair & more. New festive styles every week.</p>
    </div>
    <a href="/shop" class="btn-primary btn-shimmer px-10 py-4 text-base shrink-0" style="background: linear-gradient(135deg, #d4a853, #e07020); box-shadow: 0 4px 20px rgba(212,168,83,0.45);">
      <span>Shop Festive Picks</span>
      <svg width="18" height="18" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </a>
  </div>
</section>