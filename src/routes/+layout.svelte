<script lang="ts">
	import { onMount } from 'svelte';
	import '$lib/tokens.css';
	import favicon from '$lib/assets/favicon.svg';
	import { syncAppViewportHeightCssVar } from '$lib/scene/browser-compat';

	let { children } = $props();

	onMount(() => syncAppViewportHeightCssVar());
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
