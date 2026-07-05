<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>{$page.status === 404 ? 'Page Not Found' : 'Something Went Wrong'} — French Toes</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center gap-6 py-20 px-4 text-center" style="background: var(--color-warm-white);">
  <!-- Decorative circles -->
  <div class="absolute top-0 left-0 w-64 h-64 rounded-full opacity-10 pointer-events-none" style="background: var(--color-blush-deep);" aria-hidden="true"></div>
  <div class="absolute bottom-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style="background: var(--color-lavender-deep);" aria-hidden="true"></div>

  <span class="text-7xl" role="img" aria-label="Flower">🌸</span>

  <div>
    <p class="font-semibold text-6xl font-display" style="color: var(--color-blush-deep);">{$page.status}</p>
    <h1 class="font-display text-3xl font-bold mt-2" style="color: var(--color-text-dark);">
      {$page.status === 404 ? 'Oops, this page wandered off!' : 'Something went wrong'}
    </h1>
    <p class="mt-3 text-base max-w-sm mx-auto" style="color: var(--color-text-mid);">
      {$page.status === 404
        ? "The page you're looking for has floated away like a blossom petal. But don't worry — our slippers are still here!"
        : $page.error?.message ?? 'An unexpected error occurred. Please try again.'}
    </p>
  </div>

  <div class="flex flex-col sm:flex-row gap-3">
    <a href="/" class="btn-primary px-8 py-3.5">Back to Home</a>
    <a href="/shop" class="btn-outline px-8 py-3.5">Browse Slippers</a>
  </div>
</div>
