<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { authStore } from '$lib/stores/auth.svelte';

  onMount(async () => {
    // Check if there is a PKCE 'code' in query parameters
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (err) {
        console.error('Error exchanging code for session:', err);
      }
    }

    // Wait for authStore to be populated (either via hash fragment parser or code exchange)
    let checkInterval = setInterval(() => {
      if (authStore.user) {
        clearInterval(checkInterval);
        goto('/account');
      }
    }, 100);

    // Timeout fallback after 6 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (authStore.user) {
        goto('/account');
      } else {
        // Redirect back to auth with a message if not authenticated
        goto('/auth');
      }
    }, 6000);
  });
</script>

<svelte:head>
  <title>Verifying Session — French Toes</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center" style="background: var(--color-cream);">
  <div class="text-center p-8 bg-white rounded-3xl shadow-lg border max-w-sm w-full mx-4" style="border-color: var(--color-blush); box-shadow: 0 8px 40px rgba(180,100,140,0.12);">
    <div class="w-12 h-12 border-4 border-solid rounded-full animate-spin mx-auto mb-4" style="border-color: var(--color-brand-magenta); border-top-color: transparent;"></div>
    <h2 class="text-lg font-bold" style="color: var(--color-text-dark);">Securely Signing In</h2>
    <p class="text-xs mt-2" style="color: var(--color-text-soft);">
      Please wait while we verify your session and set up your slippers dashboard... 🌸
    </p>
  </div>
</div>
