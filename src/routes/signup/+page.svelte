<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/auth', { replaceState: true });
  });
</script>

<svelte:head>
  <title>Create Account — French Toes</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center">
  <p class="text-sm" style="color: var(--color-text-soft);">Redirecting to sign up...</p>
</div>