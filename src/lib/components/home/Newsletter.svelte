<script lang="ts">
  let email = $state('');
  let subscribed = $state(false);

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (email) { subscribed = true; email = ''; }
  }

  const topazTexture = 'https://cdn.pixabay.com/photo/2026/05/12/07/25/whitetopaz-art-deco-10275024_1280.jpg';
</script>

<section 
  class="section relative overflow-hidden py-20 border-b border-[#f0e0e8]/30" 
  style="background-image: linear-gradient(135deg, rgba(253, 243, 245, 0.88) 0%, rgba(255, 230, 240, 0.92) 100%), url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&q=80'); background-size: cover; background-position: center; background-blend-mode: overlay;"
>
  <!-- Interactive floating background sparkles -->
  <div class="absolute top-10 left-12 text-2xl opacity-20 animate-bounce" style="animation-duration: 4s;">✨</div>
  <div class="absolute bottom-12 right-16 text-3xl opacity-20 animate-bounce" style="animation-duration: 6s;">🌸</div>
  <div class="absolute top-1/2 right-12 text-xl opacity-15 animate-pulse" style="animation-duration: 3s;">✨</div>
  <div class="absolute bottom-6 left-20 text-2xl opacity-15 animate-pulse" style="animation-duration: 5s;">🌸</div>

  <div class="max-w-3xl mx-auto px-4 relative z-10">
    <div class="backdrop-blur-xl bg-white/70 border border-white/50 shadow-2xl shadow-pink-100/50 p-8 md:p-14 rounded-[2.5rem] text-center relative overflow-hidden group">
      
      <!-- Ambient light effect inside card -->
      <div class="absolute -inset-24 bg-gradient-to-r from-pink-200/20 to-orange-200/20 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-1000 pointer-events-none" aria-hidden="true"></div>

      <span class="text-xs font-bold uppercase tracking-widest text-[var(--color-brand-magenta)] mb-3 inline-block">The VIP Experience</span>
      
      <h2 class="font-display text-3xl md:text-5xl font-bold mb-4 text-[#2d1b2e] tracking-tight">
        Join the Blossom Club
      </h2>
      
      <p class="text-sm md:text-base mb-8 text-[#6b4c6e] max-w-lg mx-auto font-light leading-relaxed">
        Be the first to unlock early drops, secret coupon code alerts, and limited-edition summer styling tips. Handcrafted for you 🌸
      </p>

      {#if subscribed}
        <div class="py-4 px-6 bg-emerald-50 border border-emerald-100 rounded-2xl max-w-md mx-auto animate-fade">
          <p class="text-base font-bold text-emerald-800 flex items-center justify-center gap-2">
            ✨ Welcome to the Club, Lovely!
          </p>
          <p class="text-xs text-emerald-600 mt-1">Check your inbox for your exclusive welcome treats.</p>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto relative z-10">
          <input
            bind:value={email}
            type="email"
            placeholder="Enter your email address"
            required
            class="flex-1 px-5 py-4 rounded-2xl text-sm outline-none bg-white border border-pink-100 shadow-inner focus:border-[var(--color-brand-magenta)] focus:ring-2 focus:ring-pink-200/50 text-[#2d1b2e] placeholder:text-[#9e7ca0]/60 transition-all duration-300"
            aria-label="Email address"
          />
          <button type="submit" class="btn-primary px-8 py-4 shrink-0 shadow-lg shadow-pink-900/10 hover:shadow-pink-900/20 hover:scale-[1.02] transition-all duration-300">
            <span>Subscribe Now</span>
            <svg width="16" height="16" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </form>
      {/if}
    </div>
  </div>
</section>