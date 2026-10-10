<script lang="ts">
  import Hero from '$lib/components/home/Hero.svelte';
  import CategoryShowcase from '$lib/components/home/CategoryShowcase.svelte';
  import BestSellersSection from '$lib/components/home/BestSellersSection.svelte';
  import ComfortFeatures from '$lib/components/home/ComfortFeatures.svelte';
  import SoleStory from '$lib/components/home/SoleStory.svelte';
  import IndianFeetStory from '$lib/components/home/IndianFeetStory.svelte';
  import OccasionGuide from '$lib/components/home/OccasionGuide.svelte';
  import CustomerReviews from '$lib/components/home/CustomerReviews.svelte';
</script>

<svelte:head>
  <title>French Toes — Fashion Loves Comfort | Premium Women's Slippers &amp; Flats</title>
  <meta name="description" content="French Toes creates premium women's slippers and flats that feel as good as they look. Soft, lightweight, and made for everyday elegance." />
</svelte:head>

<!-- 1. Editorial Split Hero -->
<Hero />

<!-- 2. Visual Category Row -->
<CategoryShowcase />

<!-- 3. Most Loved / Best Sellers (with MIAMI3 photoshoot showcase & quick add) -->
<BestSellersSection />

<!-- 4. Comfort Pillars (Dual-density memory foam, feather-light, flexible TPR sole, thoughtful fit) -->
<ComfortFeatures />

<!-- 5. The Sole Story (Anti-slip grip & vegan craft) -->
<SoleStory />

<!-- 6. Designed for Indian Feet (4,000+ measured, 12-hr wear test, brand stats) -->
<IndianFeetStory />

<!-- 7. Shop by Occasion (Work, Weekend, Evening) -->
<OccasionGuide />

<!-- 8. Verified Customer Reviews -->
<CustomerReviews />