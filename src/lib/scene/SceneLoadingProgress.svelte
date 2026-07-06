<script lang="ts">
  let { progress = 0, label = 'Caricamento scena' } = $props<{
    progress?: number;
    label?: string;
  }>();

  const percent = $derived(Math.max(0, Math.min(100, Math.round(progress * 100))));
</script>

<div class="scene-loading-progress" role="status" aria-live="polite" aria-label={label}>
  {percent}%
</div>

<style>
  .scene-loading-progress {
    position: absolute;
    z-index: 120;
    top: 50%;
    left: 50%;
    padding: 4px 6px;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
    transform: translate(-50%, -50%);
    user-select: none;
  }
</style>
