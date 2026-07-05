<script lang="ts">
  import { onMount } from 'svelte';

  const reviews = [
    {
      name: 'Priya Sharma',
      city: 'Mumbai',
      rating: 5,
      text: 'I ordered the Indiano in Peach for my sister\'s wedding and couldn\'t stop receiving compliments! So comfortable for hours of standing.',
      initials: 'PS',
      color: 'var(--color-blush-deep)',
    },
    {
      name: 'Ananya Krishnan',
      city: 'Bangalore',
      rating: 5,
      text: 'The Milano in Lavender is absolutely gorgeous. Memory foam insole is a dream — wore it for 8 hours at a home event and my feet felt fine!',
      initials: 'AK',
      color: 'var(--color-lavender-deep)',
    },
    {
      name: 'Deepika Patel',
      city: 'Ahmedabad',
      rating: 5,
      text: 'Summer in Gujarat is brutal, but these slippers make it bearable. Breathable, quick-dry, perfect for the kitchen and beyond. Will buy all colors!',
      initials: 'DP',
      color: 'var(--color-mint-deep)',
    },
    {
      name: 'Sneha Mehta',
      city: 'Delhi',
      rating: 4,
      text: 'Gorgeous packaging, fast delivery, and the slippers are exactly as shown. The Loremano in Coral is my current summer obsession.',
      initials: 'SM',
      color: 'var(--color-coral-deep)',
    },
    {
      name: 'Kavya Reddy',
      city: 'Hyderabad',
      rating: 5,
      text: 'Bought the Chicago for my mom and she loves them! Anti-slip sole saved her on the wet bathroom floor. Quality is top-notch for the price.',
      initials: 'KR',
      color: 'var(--color-gold)',
    },
  ];

  // Duplicate for seamless infinite scroll
  const allReviews = [...reviews, ...reviews];

  let sectionRef: HTMLElement | undefined = $state();
  let isVisible = $state(false);

  onMount(() => {
    if (!sectionRef) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible = true;
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    observer.observe(sectionRef);
    
    return () => observer.disconnect();
  });
</script>

<section 
  bind:this={sectionRef}
  class="section overflow-hidden" 
  style="background: var(--color-blush);"
>
  <div class="max-w-7xl mx-auto">
    <!-- Heading -->
    <div class="text-center mb-10">
      <span class="text-xs font-semibold uppercase tracking-widest" style="color: var(--color-blush-deep);">Real Reviews</span>
      <h2 class="font-display text-3xl md:text-4xl font-bold mt-2" style="color: var(--color-text-dark);">
        Loved by Indian Women 💖
      </h2>
      <div class="flex items-center justify-center gap-2 mt-3">
        <div class="flex gap-0.5" aria-hidden="true">
          {#each Array(5) as _}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-gold)" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          {/each}
        </div>
        <span class="text-sm font-semibold" style="color: var(--color-text-dark);">4.9 · 1,200+ verified reviews</span>
      </div>
    </div>

    <!-- Auto-scrolling Reviews Carousel -->
    <div class="overflow-hidden">
      <div class="ft-reviews-track">
        {#each allReviews as review, i}
          <article
            class="ft-review-card shrink-0 w-72 md:w-80 rounded-2xl p-6 flex flex-col gap-4 product-card-animate"
            class:ft-visible={isVisible}
            style="background: white; box-shadow: 0 4px 20px rgba(180,100,140,0.12); animation-delay: {i * 0.05}s;"
            aria-label="Review by {review.name}"
          >
            <!-- Stars -->
            <div class="flex gap-0.5" aria-label="{review.rating} out of 5 stars">
              {#each Array(5) as _, si}
                <svg width="16" height="16" viewBox="0 0 24 24" fill={si < review.rating ? '#f0a500' : '#e5e7eb'} stroke="none" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              {/each}
            </div>

            <!-- Quote -->
            <blockquote class="text-sm leading-relaxed flex-1" style="color: var(--color-text-mid);">
              "{review.text}"
            </blockquote>

            <!-- Author -->
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style="background: {review.color};"
                aria-hidden="true"
              >
                {review.initials}
              </div>
              <div>
                <p class="text-sm font-semibold" style="color: var(--color-text-dark);">{review.name}</p>
                <p class="text-xs" style="color: var(--color-text-soft);">{review.city} · Verified Buyer</p>
              </div>
            </div>
          </article>
        {/each}
      </div>
    </div>
  </div>
</section>