<script lang="ts">
  import PotLoader from './PotLoader.svelte';

  let { progress = 0, label = 'Caricamento scena', size = 174 } = $props<{
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
    top: 50%;
    left: 50%;
    color: var(--color-text-primary);
    pointer-events: none;
    transform: translate(-50%, -50%);
  }
</style>
