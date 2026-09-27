<script lang="ts">
  import { page } from '$app/stores';
  import ProductWizard from '$lib/components/admin/ProductWizard.svelte';

  const productId = $derived($page.params.id);
</script>

<svelte:head>
  <title>Edit Product — French Toes Admin</title>
</svelte:head>

{#if productId}
  <ProductWizard {productId} />
{/if}
