<script lang="ts">
  import { onMount } from 'svelte';
  import {
    officeBackgroundOffsetY,
    officeBackgroundChunks,
    officeFloorAssets,
    officeForegroundAssets,
    officeMiddleAssets,
    officeSceneConfig
  } from './office-scene.config';
  import { clamp, px } from '$lib/scene/math';
  import { loadGsapWithScrollTrigger } from '$lib/scene/gsap-loader';
  import type { InteractiveSceneAsset, SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';
  import { getSceneAssetStyle } from '$lib/scene/scene-utils';
  import { createViewportObserver } from '$lib/scene/viewport';

  let { isAudioMuted = false } = $props<{ isAudioMuted?: boolean }>();

  const { assetVersion, layerSpeed, sceneHeight, sceneWidth } = officeSceneConfig;

  let stageEl: HTMLElement;
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let cameraX = $state(0);
  let targetCameraX = 0;
  let isDragging = $state(false);
  let isSceneLoaded = $state(false);
  let prefersReducedMotion = $state(false);
  let dragStartX = 0;
  let dragScrollStart = 0;
  let scrollTrigger:
    | {
        end: number;
        kill: () => void;
        refresh: () => void;
        scroll: (value?: number) => number;
        start: number;
      }
    | undefined;

  const resolvedLayerSpeed = $derived({
    background: prefersReducedMotion ? 1 : layerSpeed.background,
    middle: prefersReducedMotion ? 1 : layerSpeed.middle,
    title: prefersReducedMotion ? 1 : layerSpeed.title,
    floor: prefersReducedMotion ? 1 : layerSpeed.floor,
    foreground: prefersReducedMotion ? 1 : layerSpeed.foreground
  });
  const sceneScale = $derived(viewportHeight ? viewportHeight / sceneHeight : 1);
  const worldWidth = $derived(Math.max(viewportWidth, sceneWidth * sceneScale));
  const maxScrollX = $derived(Math.max(0, worldWidth - viewportWidth));
  const progress = $derived(maxScrollX > 0 ? clamp(cameraX / maxScrollX, 0, 1) : 0);
  const scenePx = (value: number) => px(value, 2);
  const scrollSpaceStyle = $derived(
    `width: ${scenePx(worldWidth)}; height: ${scenePx(viewportHeight)}`
  );
  const worldStyle = $derived(
    `width: ${scenePx(viewportWidth)}; height: ${scenePx(viewportHeight)}`
  );

  function versionedAsset(path: string) {
    const normalized = path.startsWith('/') ? path : `/assets/${path}`;
    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}v=${assetVersion}`;
  }

  function chunkAsset(chunk: SceneChunk) {
    return versionedAsset(`office-figma/background/Slice ${chunk.frameIndex + 1}.png`);
  }

  function setTargetCameraX(value: number) {
    targetCameraX = clamp(value, 0, maxScrollX);
  }

  function syncViewport() {
    if (!stageEl) return;
    viewportWidth = stageEl.clientWidth;
    viewportHeight = stageEl.clientHeight;
    targetCameraX = clamp(targetCameraX, 0, maxScrollX);
    cameraX = clamp(cameraX, 0, maxScrollX);
    scrollTrigger?.refresh();
  }

  function getScrollForCameraX(value: number) {
    if (!scrollTrigger) return value;
    const nextProgress = maxScrollX > 0 ? clamp(value / maxScrollX, 0, 1) : 0;
    return scrollTrigger.start + (scrollTrigger.end - scrollTrigger.start) * nextProgress;
  }

  function scrollBy(delta: number) {
    setTargetCameraX(targetCameraX + delta);
    scrollTrigger?.scroll(getScrollForCameraX(targetCameraX));
  }

  function evaluateScene(delta: number) {
    const distance = targetCameraX - cameraX;
    const frameScale = Math.min(delta / 16.667, 2.4);
    const amount = prefersReducedMotion ? 1 : isDragging ? 0.28 : 0.14;
    const stepAmount = 1 - Math.pow(1 - amount, frameScale);

    cameraX = Math.abs(distance) < 0.08 ? targetCameraX : cameraX + distance * stepAmount;
    cameraX = clamp(cameraX, 0, maxScrollX);
    targetCameraX = clamp(targetCameraX, 0, maxScrollX);
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const axisDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    scrollBy(axisDelta * 1.35);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    isDragging = true;
    dragStartX = event.clientX;
    dragScrollStart = scrollTrigger?.scroll() ?? 0;
    stageEl.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging) return;
    scrollTrigger?.scroll(dragScrollStart + (dragStartX - event.clientX) * 1.95);
  }

  function endDrag(event?: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    if (event && stageEl.hasPointerCapture(event.pointerId)) {
      stageEl.releasePointerCapture(event.pointerId);
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollBy(viewportWidth * 0.42);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollBy(-viewportWidth * 0.42);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setTargetCameraX(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setTargetCameraX(maxScrollX);
    }
  }

  function getChunkStyle(chunk: SceneChunk) {
    const chunkHeight = chunk.figmaHeight ?? sceneHeight;
    const translateX = chunk.figmaX * sceneScale - cameraX * resolvedLayerSpeed.background;
    const bottom = viewportHeight - (chunkHeight + officeBackgroundOffsetY) * sceneScale;

    return [
      `width: ${scenePx(chunk.figmaWidth * sceneScale + 1)}`,
      `height: ${scenePx(chunkHeight * sceneScale)}`,
      `bottom: ${scenePx(bottom)}`,
      `transform: translate3d(${scenePx(translateX)}, 0, 0)`
    ].join(';');
  }

  function getFloorStyle(asset: SceneAsset) {
    const speed = resolvedLayerSpeed.floor;
    const overlapX = asset.overlapX === undefined ? 0 : Math.ceil(asset.overlapX * sceneScale);
    const translateX = asset.x * sceneScale - cameraX * speed;

    return [
      `width: ${scenePx(asset.width * sceneScale + overlapX)}`,
      `height: ${scenePx(asset.height * sceneScale)}`,
      'bottom: 0',
      `transform: translate3d(${scenePx(translateX)}, 0, 0)`,
      asset.zOffset !== undefined ? `--scene-z-offset: ${asset.zOffset}` : ''
    ]
      .filter(Boolean)
      .join(';');
  }

  function getForegroundStyle(asset: SceneAsset) {
    return getSceneAssetStyle(asset, cameraX, sceneHeight, sceneScale, resolvedLayerSpeed);
  }

  function isInteractiveAsset(asset: SceneAsset): asset is InteractiveSceneAsset {
    return asset.kind === 'interactive';
  }

  function getTitleStyle() {
    const titleFontSize = Math.min(180 * sceneScale, Math.max(56, (viewportWidth - 48) / 4.55));
    const translateX = 92 * sceneScale - cameraX * resolvedLayerSpeed.title;

    return [
      `left: ${scenePx(translateX)}`,
      `top: ${scenePx(viewportHeight / 2 - 132 * sceneScale)}`,
      `font-size: ${scenePx(titleFontSize)}`
    ].join(';');
  }

  onMount(() => {
    let destroyed = false;
    let removeTicker = () => {};
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncReducedMotion = () => {
      prefersReducedMotion = reducedMotionQuery.matches;
    };
    const stopResize = createViewportObserver(stageEl, syncViewport);

    syncReducedMotion();
    reducedMotionQuery.addEventListener('change', syncReducedMotion);
    window.addEventListener('keydown', onKeydown);
    void loadGsapWithScrollTrigger().then(({ gsap, ScrollTrigger }) => {
      if (destroyed) return;

      scrollTrigger = ScrollTrigger.create({
        anticipatePin: 1,
        end: () => `+=${Math.max(maxScrollX, window.innerHeight * 0.85, 1)}`,
        id: 'office-horizontal-scroll',
        invalidateOnRefresh: true,
        onRefresh: (self) => {
          setTargetCameraX(self.progress * maxScrollX);
        },
        onUpdate: (self) => {
          setTargetCameraX(self.progress * maxScrollX);
        },
        pin: stageEl,
        scrub: true,
        start: 'top top',
        trigger: stageEl
      });

      const tick = (_time: number, delta: number) => {
        evaluateScene(delta);
      };

      gsap.ticker.add(tick);
      removeTicker = () => gsap.ticker.remove(tick);
      ScrollTrigger.refresh();
    });
    requestAnimationFrame(() => {
      isSceneLoaded = true;
    });

    return () => {
      destroyed = true;
      reducedMotionQuery.removeEventListener('change', syncReducedMotion);
      window.removeEventListener('keydown', onKeydown);
      stopResize();
      removeTicker();
      scrollTrigger?.kill();
      scrollTrigger = undefined;
    };
  });
</script>

<section
  bind:this={stageEl}
  class="office-stage"
  class:is-dragging={isDragging}
  class:is-loaded={isSceneLoaded}
  data-audio-muted={isAudioMuted}
  data-progress={progress.toFixed(3)}
  aria-label="Scena parallasse dell'ufficio"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  <div class="office-scroll-space" style={scrollSpaceStyle}>
    <div class="office-world" style={worldStyle}>
      {#each officeBackgroundChunks as chunk (chunk.assetKey)}
        <img
          class="office-asset office-chunk reveal-layer background-layer"
          src={chunkAsset(chunk)}
          alt=""
          draggable="false"
          style={getChunkStyle(chunk)}
        />
      {/each}

      {#each officeFloorAssets as item (item.id)}
        <img
          class="office-asset office-floor reveal-layer floor-layer"
          src={versionedAsset(item.src)}
          alt=""
          draggable="false"
          style={getFloorStyle(item)}
        />
      {/each}

      {#each officeMiddleAssets as item (item.id)}
        <img
          class="office-asset office-middle-asset reveal-layer middle-layer"
          src={versionedAsset(item.src)}
          alt=""
          draggable="false"
          style={getForegroundStyle(item)}
        />
      {/each}

      {#each officeForegroundAssets as item (item.id)}
        {#if isInteractiveAsset(item)}
          <button
            class="office-asset office-foreground-asset office-interactive-asset office-map-layer reveal-layer foreground-layer"
            type="button"
            aria-label={item.ariaLabel}
            style={getForegroundStyle(item)}
            onpointerdown={(event) => event.stopPropagation()}
            onclick={(event) => event.stopPropagation()}
          >
            <img src={versionedAsset(item.src)} alt="" draggable="false" />
            {#if item.shineEffect}
              <span
                class="object-shine"
                style={`--shine-mask: url('${versionedAsset(item.src)}')`}
                aria-hidden="true"
              ></span>
            {/if}
          </button>
        {:else}
          <img
            class="office-asset office-foreground-asset reveal-layer foreground-layer"
            src={versionedAsset(item.src)}
            alt=""
            draggable="false"
            style={getForegroundStyle(item)}
          />
        {/if}
      {/each}

      <h1 class="office-title" style={getTitleStyle()} aria-label="Ufficio">Ufficio</h1>
    </div>
  </div>
</section>

<style>
  .office-stage {
    position: relative;
    width: 100%;
    height: 100svh;
    min-height: 100svh;
    overflow: hidden;
    background: var(--color-surface-page);
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, auto;
    scrollbar-width: none;
    user-select: none;
    overscroll-behavior: contain;
    touch-action: none;
  }

  .office-stage::-webkit-scrollbar {
    display: none;
  }

  .office-scroll-space {
    position: relative;
    min-width: 100%;
    min-height: 100svh;
  }

  .office-world {
    position: sticky;
    left: 0;
    top: 0;
    min-width: 100%;
    min-height: 100svh;
    overflow: hidden;
  }

  .office-stage.is-dragging {
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, auto;
  }

  .office-asset {
    position: absolute;
    left: 0;
    display: block;
    object-fit: fill;
    pointer-events: none;
    transform-origin: center center;
    user-select: none;
    will-change: transform;
    z-index: calc(var(--scene-layer-z, 0) + var(--scene-z-offset, 0));
  }

  .office-interactive-asset {
    padding: 0;
    border: 0;
    background: transparent;
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, pointer;
    pointer-events: auto;
    touch-action: none;
  }

  .office-interactive-asset:focus-visible {
    outline: none;
  }

  .office-interactive-asset img {
    position: relative;
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
    transform-origin: 52% 100%;
    will-change: transform;
  }

  .office-map-layer img {
    animation: officeMapIdle 2.6s cubic-bezier(0.45, 0, 0.2, 1) infinite;
  }

  .office-map-layer:hover img,
  .office-map-layer:focus-visible img {
    animation: officeMapHoverLanding 860ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .object-shine {
    position: absolute;
    z-index: 2;
    inset: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    -webkit-mask-image: var(--shine-mask);
    mask-image: var(--shine-mask);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    transform-origin: 50% 50%;
    animation: officeObjectLightSweepOpacity 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    will-change: opacity;
  }

  .object-shine::before {
    position: absolute;
    top: -34%;
    left: 38%;
    width: 24%;
    height: 168%;
    background:
      linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.18),
        #ffffff,
        rgba(255, 255, 255, 0.24),
        transparent 50%
      );
    content: '';
    transform: translate3d(-430%, -34%, 0) rotate(35deg);
    transform-origin: 50% 50%;
    animation: officeObjectLightSweepBeam 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    will-change: transform;
  }

  .office-title {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 6;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-weight: 700;
    line-height: 1.2;
    pointer-events: none;
    transform: translateY(-50%);
    transform-origin: center center;
    white-space: nowrap;
    will-change: transform;
  }

  .reveal-layer,
  .office-title {
    opacity: 0;
  }

  .office-stage.is-loaded .reveal-layer,
  .office-stage.is-loaded .office-title {
    opacity: 1;
  }

  .office-stage.is-loaded .reveal-layer {
    animation: officeLayerIn 1ms step-end var(--reveal-delay, 0ms) forwards;
  }

  .office-stage.is-loaded .office-title {
    animation: officeTitleIn 420ms cubic-bezier(0.22, 1, 0.36, 1) 220ms forwards;
  }

  .background-layer {
    --reveal-delay: 40ms;
    --scene-layer-z: 2;
  }

  .floor-layer {
    --reveal-delay: 40ms;
    --scene-layer-z: 3;
  }

  .middle-layer {
    --reveal-delay: 60ms;
    --scene-layer-z: 4;
  }

  .foreground-layer {
    --reveal-delay: 80ms;
    --scene-layer-z: 5;
  }

  @keyframes officeLayerIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes officeTitleIn {
    from {
      opacity: 0;
      transform: translate3d(0, -50%, 0) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translate3d(0, -50%, 0) scale(1);
    }
  }

  @keyframes officeMapIdle {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotate(0deg);
    }

    42% {
      transform: translate3d(0, -5px, 0) rotate(-0.45deg);
    }

    68% {
      transform: translate3d(0, 2px, 0) rotate(0.28deg);
    }
  }

  @keyframes officeMapHoverLanding {
    0% {
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
    }

    42% {
      transform: translate3d(0, -14px, 0) rotate(-1.6deg) scale(1.035);
    }

    68% {
      transform: translate3d(0, 4px, 0) rotate(0.65deg) scale(0.994);
    }

    100% {
      transform: translate3d(0, -6px, 0) rotate(-0.35deg) scale(1.018);
    }
  }

  @keyframes officeObjectLightSweepOpacity {
    0%,
    52% {
      opacity: 0;
    }

    63% {
      opacity: 0.78;
    }

    90%,
    100% {
      opacity: 0;
    }
  }

  @keyframes officeObjectLightSweepBeam {
    0%,
    52% {
      transform: translate3d(-430%, -34%, 0) rotate(35deg);
    }

    90%,
    100% {
      transform: translate3d(430%, 24%, 0) rotate(35deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .office-stage.is-loaded .reveal-layer,
    .office-stage.is-loaded .office-title {
      animation-duration: 1ms;
    }

    .office-map-layer img,
    .office-map-layer:hover img,
    .office-map-layer:focus-visible img,
    .object-shine,
    .object-shine::before {
      animation: none;
    }
  }
</style>
