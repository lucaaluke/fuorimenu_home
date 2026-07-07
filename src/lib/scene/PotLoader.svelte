<script lang="ts">
  import { onMount } from 'svelte';
  import { clamp } from './math';
  import { loadGsap, type Gsap } from './gsap-loader';

  let {
    progress = 0,
    size = 132,
    label = 'Caricamento scena',
    showPercent = true
  } = $props<{
    progress?: number;
    size?: number | string;
    label?: string;
    showPercent?: boolean;
  }>();

  let waterRectEl: SVGRectElement;
  let waterWaveEl: SVGPathElement;
  let gsap: Gsap | undefined;
  let waterTween: { kill: () => void } | undefined;

  const waterX = 40;
  const waterWidth = 428;
  const waterTop = 52;
  const waterBottom = 397.778;
  const waterOverflow = 40;
  const waterMaxWaveY = waterTop + 18;
  const waterRange = waterBottom - waterMaxWaveY;
  const percent = $derived(Math.max(0, Math.min(100, Math.round(progress * 100))));
  const resolvedSize = $derived(typeof size === 'number' ? `${size}px` : size);
  const initialWaterGeometry = $derived(getWaterGeometry(progress));
  const isComplete = $derived(progress >= 0.995 || percent >= 100);

  function getWaterGeometry(value: number) {
    const level = clamp(value, 0, 1);
    const height = waterRange * level;

    return {
      y: waterBottom - height,
      height: height + waterOverflow,
      waveY: waterBottom - height
    };
  }

  export function setProgress(value: number) {
    if (!waterRectEl || !waterWaveEl) return;
    const nextGeometry = getWaterGeometry(value);

    waterTween?.kill();
    if (!gsap) {
      waterRectEl.setAttribute('y', nextGeometry.y.toString());
      waterRectEl.setAttribute('height', nextGeometry.height.toString());
      waterWaveEl?.setAttribute('transform', `translate(0 ${nextGeometry.waveY})`);
      return;
    }

    waterTween = gsap.timeline().to(
      waterRectEl,
      {
        attr: {
          y: nextGeometry.y,
          height: nextGeometry.height
        },
        duration: 0.46,
        ease: 'power2.out'
      },
      0
    ).to(
      waterWaveEl,
      {
        attr: {
          transform: `translate(0 ${nextGeometry.waveY})`
        },
      duration: 0.46,
      ease: 'power2.out'
      },
      0
    );
  }

  $effect(() => {
    setProgress(progress);
  });

  onMount(() => {
    let destroyed = false;

    void loadGsap().then((loadedGsap) => {
      if (destroyed) return;
      gsap = loadedGsap;
      setProgress(progress);
    });

    return () => {
      destroyed = true;
      waterTween?.kill();
    };
  });
</script>

<div
  class={`pot-loader${isComplete ? ' is-complete' : ''}`}
  style={`--pot-loader-size: ${resolvedSize}`}
  role="progressbar"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={percent}
  aria-valuetext={`${percent}°C`}
>
  <svg class="pot-loader-svg" viewBox="0 0 508 634" aria-hidden="true">
    <defs>
      <clipPath id="pot-loader-inner-clip" clipPathUnits="userSpaceOnUse">
        <path
          d="M225 103V78.5619C225 73.8292 229.892 70 235.938 70H271.062C277.108 70 282 73.8292 282 78.5619V103C350.819 107.404 431.227 129.76 431.227 129.76C436.5 131.501 440.434 132.542 440.434 135.973V155.959C440.434 159.39 436.312 162.172 431.227 162.172H422.701V375.836C422.701 387.905 415.158 397.778 405.938 397.778H101.767C92.5472 397.778 85.0039 387.905 85.0039 375.836V162.171H74.9427C69.8581 162.171 65.7363 159.39 65.7363 155.958V138C65.7363 134.569 68.5001 132 74.9427 129.76C74.9427 129.76 155.925 107.898 224.5 103.512L225 103Z"
        />
      </clipPath>
    </defs>

    <g class="pot-loader-complete-fill" data-layer="complete-fill">
      <path
        d="M224.5 103.512C155.925 107.898 74.9427 129.76 74.9427 129.76C68.5001 132 65.7363 134.569 65.7363 138V155.958C65.7363 159.39 69.8581 162.171 74.9427 162.171H431.227C436.312 162.171 440.434 159.39 440.434 155.959V135.973C440.434 132.542 436.5 131.501 431.227 129.76C431.227 129.76 351.075 107.898 282.5 103.512H224.5Z"
      />
      <path
        d="M225 103V78.5619C225 73.8292 229.892 70 235.938 70H271.062C277.108 70 282 73.8292 282 78.5619V103C350.819 107.404 431.227 129.76 431.227 129.76C436.5 131.501 440.434 132.542 440.434 135.973V155.959C440.434 159.39 436.312 162.172 431.227 162.172H422.701V375.836C422.701 387.905 415.158 397.778 405.938 397.778H101.767C92.5472 397.778 85.0039 387.905 85.0039 375.836V162.171H74.9427C69.8581 162.171 65.7363 159.39 65.7363 155.958V138C65.7363 134.569 68.5001 132 74.9427 129.76C74.9427 129.76 155.925 107.898 224.5 103.512L225 103Z"
      />
    </g>

    <g class="pot-loader-handles" data-layer="handles">
      <path
        d="M83 188C61.723 188 42.9717 188 42.9717 188C22.9572 188 22.9515 230 83 230"
        pathLength="1"
      />
      <path
        d="M425 187C446.277 187 465.028 187 465.028 187C485.043 187 485.049 229 425 229"
        pathLength="1"
      />
    </g>

    <g class="pot-loader-water-clip" clip-path="url(#pot-loader-inner-clip)" data-layer="water">
      <rect
        bind:this={waterRectEl}
        class="pot-loader-water-fill"
        x={waterX}
        y={initialWaterGeometry.y}
        width={waterWidth}
        height={initialWaterGeometry.height}
      />
      <path
        bind:this={waterWaveEl}
        class="pot-loader-water-fill"
        transform={`translate(0 ${initialWaterGeometry.waveY})`}
        d="M80 0C105 8 127 -4 144 -12C169 -25 193 -13 205 -7C226 4 248 -5 264 -13C292 -27 318 -15 333 -7C350 2 370 4 386 -2C402 -8 417 -3 428 5V54H80V0Z"
      />
    </g>

    <g class="pot-loader-outline" data-layer="pot-outline">
      <path
        d="M282 103V78.5619C282 73.8292 277.108 70 271.062 70H235.883H235.938C229.892 70 225 73.8292 225 78.5619V103"
      />
      <path
        d="M224.5 103.512C155.925 107.898 74.9427 129.76 74.9427 129.76C68.5001 132 65.7363 134.569 65.7363 138V155.958C65.7363 159.39 69.8581 162.171 74.9427 162.171H83.5"
      />
      <path
        d="M423.5 162.172H431.227C436.312 162.172 440.434 159.39 440.434 155.959V135.973C440.434 132.542 436.5 131.501 431.227 129.76C431.227 129.76 351.075 107.898 282.5 103.512"
      />
      <path
        d="M85.0039 162V375.836C85.0039 387.905 92.5472 397.778 101.767 397.778H405.938C415.158 397.778 422.701 387.905 422.701 375.836V162"
      />
    </g>

    <g class="pot-loader-complete-cap" data-layer="complete-cap">
      <path
        d="M225 103V78.5619C225 73.8292 229.892 70 235.938 70H271.062C277.108 70 282 73.8292 282 78.5619V103H225Z"
      />
      <path
        d="M224.5 103.512C155.925 107.898 74.9427 129.76 74.9427 129.76C68.5001 132 65.7363 134.569 65.7363 138V155.958C65.7363 159.39 69.8581 162.171 74.9427 162.171H431.227C436.312 162.171 440.434 159.39 440.434 155.959V135.973C440.434 132.542 436.5 131.501 431.227 129.76C431.227 129.76 351.075 107.898 282.5 103.512H224.5Z"
      />
    </g>
  </svg>

  {#if showPercent}
    <span class="pot-loader-percent" aria-hidden="true">{percent}°C</span>
  {/if}
</div>

<style>
  .pot-loader {
    display: inline-grid;
    justify-items: center;
    width: var(--pot-loader-size);
    color: var(--brand-500);
    pointer-events: none;
    user-select: none;
  }

  .pot-loader-svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .pot-loader-outline,
  .pot-loader-handles {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 12;
  }

  .pot-loader-handles {
    stroke-linejoin: miter;
  }

  .pot-loader-water-fill {
    fill: currentColor;
  }

  .pot-loader-complete-fill {
    color: var(--brand-500);
    fill: currentColor;
    opacity: 0;
    transition: opacity 0.2s ease-out;
  }

  .pot-loader-complete-cap {
    color: var(--brand-500);
    fill: currentColor;
    opacity: 0;
    transition: opacity 0.2s ease-out;
  }

  .pot-loader.is-complete .pot-loader-complete-fill,
  .pot-loader.is-complete .pot-loader-complete-cap {
    opacity: 1;
  }

  .pot-loader-percent {
    margin-top: -32px;
    color: currentColor;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: 24px;
    font-weight: 400;
    line-height: 1;
    text-align: center;
  }

</style>
