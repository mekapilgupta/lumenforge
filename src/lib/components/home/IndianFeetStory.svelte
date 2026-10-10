<script lang="ts">
  const stats = [
    { num: '50,000+', label: 'Happy customers' },
    { num: '4.8 / 5', label: 'Average rating' },
    { num: '180g', label: 'Average pair weight' },
    { num: '7-Day', label: 'Doorstep exchanges' },
  ];
</script>

<section class="py-16 md:py-24 bg-[#F5F0EB] border-b border-[#E8E4E0]">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">

      <!-- Left Media (Client Lifestyle/Zen Craft) -->
      <div class="lg:col-span-6 order-2 lg:order-1">
        <div class="rounded-2xl overflow-hidden shadow-xl bg-white border border-[#E8E4E0] aspect-[4/5] relative">
          <img
            src="/images/client/zenUntitled.png"
            alt="French Toes comfort footwear worn in relaxed daily lifestyle"
            class="w-full h-full object-cover"
            loading="lazy"
            onerror={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/client/summerUntitled.png';
            }}
          />
        </div>
      </div>

      <!-- Right Editorial -->
      <div class="lg:col-span-6 order-1 lg:order-2 space-y-6">
        <p class="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#6B6B6B]">Designed for Indian feet</p>
        <h2 class="font-serif text-3xl sm:text-4xl text-[#1A1A1A] font-normal tracking-tight">Comfort science, not guesswork</h2>
        <p class="text-sm text-[#6B6B6B] leading-relaxed">
          We measured over 4,000 Indian women's feet to build lasts that fit properly — wider at the ball of the foot, gentler at the heel, kinder across the instep. Then we tested the pairs for 12-hour wear so you don't have to find out the hard way.
        </p>

        <ul class="space-y-4 pt-2">
          <li class="flex items-start gap-3">
            <span class="w-5 h-5 rounded-full bg-white text-[#1A1A1A] border border-[#E8E4E0] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></svg>
            </span>
            <span class="text-xs sm:text-sm text-[#3D3D3D]">
              <b class="text-[#1A1A1A] font-semibold">Wider, kinder last</b> — ergonomic comfort designed for real Indian sizing.
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-5 h-5 rounded-full bg-white text-[#1A1A1A] border border-[#E8E4E0] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></svg>
            </span>
            <span class="text-xs sm:text-sm text-[#3D3D3D]">
              <b class="text-[#1A1A1A] font-semibold">12-hour wear tested</b> — validated during active workdays and daily commute.
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-5 h-5 rounded-full bg-white text-[#1A1A1A] border border-[#E8E4E0] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></svg>
            </span>
            <span class="text-xs sm:text-sm text-[#3D3D3D]">
              <b class="text-[#1A1A1A] font-semibold">All-day arch support</b> — targeted pressure relief where it matters most.
            </span>
          </li>
        </ul>
      </div>

    </div>

    <!-- 4 Stats Row -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-16 pt-12 border-t border-[#E8E4E0]">
      {#each stats as s}
        <div class="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-[#E8E4E0] text-center">
          <div class="font-serif text-2xl sm:text-3xl font-semibold text-[#1A1A1A]">{s.num}</div>
          <div class="text-[11px] sm:text-xs text-[#6B6B6B] uppercase tracking-wider mt-1">{s.label}</div>
        </div>
      {/each}
    </div>
  </div>
</section>
