<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  onMount(async () => {
    await authStore.init();
    if (authStore.user) goto('/account/profile');
    else goto('/auth?redirect=/account/profile');
  });
</script>

<div class="min-h-screen flex items-center justify-center">
  <div class="w-8 h-8 border-4 rounded-full animate-spin" style="border-color: var(--color-blush); border-top-color: var(--color-blush-deep);"></div>
</div>
