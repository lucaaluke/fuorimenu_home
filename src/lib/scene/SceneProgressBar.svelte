<script lang="ts">
  import { clamp, fixed } from '$lib/scene/math';

  let { progress = 0, isVisible = true, ticks = [0.185185, 0.396825, 0.608466, 0.820106] } = $props<{
    progress?: number;
    isVisible?: boolean;
    ticks?: number[];
  }>();
  const normalizedProgress = $derived(clamp(Number.isFinite(progress) ? progress : 0, 0, 1));
  const progressStyle = $derived(`--scene-progress:${fixed(normalizedProgress, 4)};`);
  const normalizedTicks = $derived(
    ticks.filter((tick: number) => Number.isFinite(tick)).map((tick: number) => clamp(tick, 0, 1))
  );
</script>

<div
  class="scene-progress-bar"
  class:is-visible={isVisible}
  style={progressStyle}
  role="progressbar"
  aria-label="Avanzamento sezione"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(normalizedProgress * 100)}
  data-node-id="5218:11854"
>
  <div class="scene-progress-track">
    <span class="scene-progress-fill" aria-hidden="true"></span>
    {#each normalizedTicks as tick}
      <span class="scene-progress-tick" style={`--tick-x:${fixed(tick * 100, 4)}%;`} aria-hidden="true"></span>
    {/each}
  </div>
</div>

<style>
  .scene-progress-bar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 80;
    height: 15px;
    pointer-events: none;
  }

  .scene-progress-track {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
    background: #f7f3ea;
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 1900ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .scene-progress-bar.is-visible .scene-progress-track {
    transform: scaleX(1);
  }

  .scene-progress-track::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    border: 2px solid #2a4385;
    pointer-events: none;
  }

  .scene-progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 1;
    width: max(40px, calc(var(--scene-progress) * 100%));
    background: #2a4385;
  }

  .scene-progress-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--tick-x);
    z-index: 2;
    width: 2px;
    background: #2a4385;
    transform: translateX(-1px);
  }
</style>
