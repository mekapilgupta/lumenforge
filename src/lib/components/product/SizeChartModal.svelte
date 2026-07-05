<script lang="ts">
  import { fade, fly } from 'svelte/transition';

  let { isOpen, onClose }: { isOpen: boolean; onClose: () => void } = $props();

  const chartData = [
    { brand: '35', euro: '35', ukIndia: '2', cms: '21.5' },
    { brand: '36', euro: '36', ukIndia: '3', cms: '22' },
    { brand: '37', euro: '37', ukIndia: '4', cms: '22.5' },
    { brand: '38', euro: '38', ukIndia: '5', cms: '23' },
    { brand: '39', euro: '39', ukIndia: '6', cms: '23.5' },
    { brand: '40', euro: '40', ukIndia: '7', cms: '24' },
    { brand: '41', euro: '41', ukIndia: '8', cms: '24.5' },
    { brand: '42', euro: '42', ukIndia: '9', cms: '25' },
  ];
</script>

{#if isOpen}
  <!-- Size Chart Modal Backdrop -->
  <button
    class="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm w-full h-full border-0 outline-none cursor-default"
    transition:fade={{ duration: 200 }}
    onclick={onClose}
    aria-label="Close modal"
  ></button>

  <!-- Modal Center wrapper -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
    <!-- Modal Container -->
    <div
      class="w-full max-w-3xl bg-white rounded-2xl overflow-hidden shadow-2xl transition-all border border-pink-100 flex flex-col pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-chart-title"
      transition:fly={{ y: 50, duration: 250 }}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-pink-50 bg-[#fff5f8]/30">
        <h3 id="size-chart-title" class="font-display font-bold text-xl text-[#2d1b2e] flex items-center gap-2">
          Slipper Size Chart 📏
        </h3>
        <button
          onclick={onClose}
          class="w-8 h-8 rounded-full bg-pink-50 text-[#6b4c6e] flex items-center justify-center hover:bg-pink-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          ✕
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto max-h-[75vh] md:max-h-[65vh]">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <!-- Column 1: Size Table -->
          <div>
            <h4 class="font-display font-semibold text-lg text-[#2d1b2e] mb-2 flex items-center gap-1.5">
              <span>Sizing Table</span>
            </h4>
            <p class="text-xs text-[#9e7ca0] mb-4">
              * Note: French Toes slippers follow standard Brand/EURO sizing. Please refer to corresponding UK/India and CM measurements for the perfect fit.
            </p>

            <div class="rounded-xl overflow-hidden border border-pink-100 shadow-xs">
              <table class="w-full text-left text-sm border-collapse">
                <thead>
                  <tr class="bg-pink-50/40 text-[#6b4c6e]">
                    <th class="px-3.5 py-3 font-semibold border-b border-pink-100 text-center bg-[#fff8f6]/50">Brand Size</th>
                    <th class="px-3.5 py-3 font-semibold border-b border-pink-100 text-center">EURO Size</th>
                    <th class="px-3.5 py-3 font-semibold border-b border-pink-100 text-center">UK / India Size</th>
                    <th class="px-3.5 py-3 font-semibold border-b border-pink-100 text-center">Foot Length</th>
                  </tr>
                </thead>
                <tbody>
                  {#each chartData as row}
                    <tr class="hover:bg-pink-50/20 text-[#2d1b2e] transition-colors">
                      <td class="px-3.5 py-2.5 border-b border-pink-50 text-center font-bold bg-[#fff8f6]/30">{row.brand}</td>
                      <td class="px-3.5 py-2.5 border-b border-pink-50 text-center">{row.euro}</td>
                      <td class="px-3.5 py-2.5 border-b border-pink-50 text-center font-medium">{row.ukIndia}</td>
                      <td class="px-3.5 py-2.5 border-b border-pink-50 text-center font-mono text-xs font-semibold text-[#D81B60]">{row.cms} cm</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Column 2: How to Measure -->
          <div class="flex flex-col">
            <h4 class="font-display font-semibold text-lg text-[#2d1b2e] mb-3">How to measure?</h4>
            
            <div class="space-y-3.5 text-sm text-[#6b4c6e] mb-6">
              <div class="flex gap-3">
                <span class="w-5.5 h-5.5 rounded-full bg-pink-100 text-[#D81B60] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                <p>Step on a piece of paper on a flat floor, with your heel slightly touching a wall behind you.</p>
              </div>
              <div class="flex gap-3">
                <span class="w-5.5 h-5.5 rounded-full bg-pink-100 text-[#D81B60] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                <p>Use a pencil held vertically to draw a straight line at the back of your heel and another at your longest toe.</p>
              </div>
              <div class="flex gap-3">
                <span class="w-5.5 h-5.5 rounded-full bg-pink-100 text-[#D81B60] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                <p>Measure the distance between the two lines in CM and find your size on the left table.</p>
              </div>
            </div>

            <!-- Diagrams Section -->
            <div class="grid grid-cols-2 gap-4 mt-auto">
              <!-- Side View SVG -->
              <div class="border border-pink-100 bg-[#fff8f6]/10 p-2.5 rounded-xl flex flex-col items-center">
                <span class="text-[10px] font-bold text-[#9e7ca0] mb-2 uppercase tracking-wider">1. Heel & Toe lines</span>
                <div class="w-full flex items-center justify-center bg-white rounded-lg p-2 h-28 border border-pink-50/50">
                  <svg viewBox="0 0 200 100" class="w-full h-full" aria-hidden="true">
                    <defs>
                      <linearGradient id="pastel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fdf8f3" />
                        <stop offset="100%" stop-color="#fde8f0" />
                      </linearGradient>
                    </defs>
                    <!-- Wall / floor line -->
                    <line x1="10" y1="80" x2="190" y2="80" stroke="var(--color-text-soft)" stroke-width="1.5" stroke-linecap="round" />
                    <!-- Heel wall support line -->
                    <line x1="25" y1="15" x2="25" y2="80" stroke="var(--color-text-soft)" stroke-width="1" stroke-dasharray="3,3" />
                    
                    <!-- Foot Outline Side view -->
                    <path d="M 25 70 
                             Q 32 35, 55 35 
                             Q 75 35, 90 60 
                             Q 105 65, 125 65 
                             Q 145 65, 158 68 
                             Q 172 70, 175 75 
                             Q 177 78, 172 80 
                             L 25 80 Z" 
                          fill="url(#pastel-grad)" 
                          stroke="var(--color-text-mid)" 
                          stroke-width="1.5" 
                          stroke-linejoin="round" />
                    
                    <!-- Back Pencil -->
                    <g transform="translate(21, 20)">
                      <rect x="0" y="0" width="5" height="45" fill="#c9a0dc" rx="1" />
                      <polygon points="0,0 5,0 2.5,-5" fill="#fdd4a5" />
                      <polygon points="1.5,-5 3.5,-5 2.5,-7" fill="#2d1b2e" />
                    </g>
                    
                    <!-- Front Pencil -->
                    <g transform="translate(172, 25) rotate(5)">
                      <rect x="0" y="0" width="5" height="45" fill="#c9a0dc" rx="1" />
                      <polygon points="0,0 5,0 2.5,-5" fill="#fdd4a5" />
                      <polygon points="1.5,-5 3.5,-5 2.5,-7" fill="#2d1b2e" />
                    </g>
                    
                    <!-- Indicators -->
                    <line x1="25" y1="80" x2="25" y2="92" stroke="var(--color-brand-magenta)" stroke-width="1.2" />
                    <line x1="174" y1="80" x2="174" y2="92" stroke="var(--color-brand-magenta)" stroke-width="1.2" />
                    <line x1="25" y1="88" x2="174" y2="88" stroke="var(--color-brand-magenta)" stroke-width="1.2" stroke-dasharray="2,2" />
                    <circle cx="25" cy="88" r="2" fill="var(--color-brand-magenta)" />
                    <circle cx="174" cy="88" r="2" fill="var(--color-brand-magenta)" />
                  </svg>
                </div>
              </div>
              
              <!-- Bottom View SVG -->
              <div class="border border-pink-100 bg-[#fff8f6]/10 p-2.5 rounded-xl flex flex-col items-center">
                <span class="text-[10px] font-bold text-[#9e7ca0] mb-2 uppercase tracking-wider">2. Measure Foot Length</span>
                <div class="w-full flex items-center justify-center bg-white rounded-lg p-2 h-28 border border-pink-50/50">
                  <svg viewBox="0 0 200 100" class="w-full h-full" aria-hidden="true">
                    <!-- Foot Outline Bottom view -->
                    <path d="M 45 50
                             C 50 35, 70 32, 90 38
                             C 110 44, 130 30, 155 35
                             C 170 38, 180 43, 180 50
                             C 180 57, 170 62, 155 65
                             C 130 70, 110 56, 90 62
                             C 70 68, 50 65, 45 50 Z" 
                          fill="url(#pastel-grad)" 
                          stroke="var(--color-text-mid)" 
                          stroke-width="1.5" 
                          stroke-linejoin="round" />
                    
                    <!-- Toes -->
                    <!-- Big toe -->
                    <ellipse cx="34" cy="50" rx="8" ry="6.5" fill="#fdf8f3" stroke="var(--color-text-mid)" stroke-width="1.2" />
                    <!-- Other toes -->
                    <circle cx="39" cy="38" r="4.5" fill="#fdf8f3" stroke="var(--color-text-mid)" stroke-width="1.2" />
                    <circle cx="47" cy="28" r="4" fill="#fdf8f3" stroke="var(--color-text-mid)" stroke-width="1.2" />
                    <circle cx="59" cy="22" r="3.5" fill="#fdf8f3" stroke="var(--color-text-mid)" stroke-width="1.2" />
                    <circle cx="71" cy="20" r="3" fill="#fdf8f3" stroke="var(--color-text-mid)" stroke-width="1.2" />
                    
                    <!-- Measurement line -->
                    <line x1="20" y1="12" x2="20" y2="88" stroke="var(--color-text-soft)" stroke-width="1" stroke-dasharray="2,2" />
                    <line x1="180" y1="12" x2="180" y2="88" stroke="var(--color-text-soft)" stroke-width="1" stroke-dasharray="2,2" />
                    
                    <!-- Marching dashed line with arrows -->
                    <g class="measuring-line">
                      <line x1="20" y1="80" x2="180" y2="80" stroke="var(--color-brand-magenta)" stroke-width="1.5" stroke-dasharray="4,4" />
                      <circle cx="20" cy="80" r="2.5" fill="var(--color-brand-magenta)" />
                      <circle cx="180" cy="80" r="2.5" fill="var(--color-brand-magenta)" />
                    </g>
                    <text x="100" y="94" fill="var(--color-brand-magenta)" font-family="var(--font-body)" font-size="11" font-weight="700" text-anchor="middle">
                      CM
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-pink-50 bg-[#fff5f8]/30 flex justify-end">
        <button
          onclick={onClose}
          class="btn-primary py-2.5 px-8 text-sm font-semibold cursor-pointer"
          style="background: var(--color-brand-magenta); color: white;"
        >
          Got it, thanks!
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Subtle micro-animation for the marching measurement line */
  @keyframes march {
    to {
      stroke-dashoffset: -20;
    }
  }
  .measuring-line line {
    animation: march 4s linear infinite;
  }
</style>

