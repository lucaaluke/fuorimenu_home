<script lang="ts">
  import PotLoader from './PotLoader.svelte';

  let { progress = 0, label = 'Caricamento scena', size = 132 } = $props<{
    progress?: number;
    label?: string;
    size?: number | string;
  }>();
</script>

<div class="scene-loading-progress" role="status" aria-live="polite">
  <PotLoader {progress} {label} {size} />
</div>

<style>
  .scene-loading-progress {
    position: absolute;
    z-index: 120;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    pointer-events: none;
  }
</style>
