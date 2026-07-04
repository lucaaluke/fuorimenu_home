<script lang="ts">
  import { onMount } from 'svelte';
  import { clamp, ease, px } from '$lib/scene/math';
  import { loadGsapWithScrollTrigger } from '$lib/scene/gsap-loader';
  import { createViewportObserver } from '$lib/scene/viewport';
  import type { SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';
  import { getSceneAssetStyle } from '$lib/scene/scene-utils';
  import {
    resolvedServiceSceneConfig,
    serviceBackgroundChunks,
    serviceBackgroundOffsetY,
    serviceForegroundAssets,
    serviceMiddleAssets
  } from './service-scene.config';

  const { assetVersion, layerSpeed, sceneHeight, sceneWidth } = resolvedServiceSceneConfig;

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
    foreground: prefersReducedMotion ? 1 : layerSpeed.foreground,
    title: prefersReducedMotion ? 1 : layerSpeed.title
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
    return versionedAsset(`servizio-figma/sfondo/Slice ${chunk.frameIndex + 1}.png`);
  }

  function syncViewport() {
    if (!stageEl) return;
    viewportWidth = Math.max(1, stageEl.clientWidth);
    viewportHeight = Math.max(1, stageEl.clientHeight);
    targetCameraX = clamp(targetCameraX, 0, maxScrollX);
    cameraX = clamp(cameraX, 0, maxScrollX);
    scrollTrigger?.refresh();
  }

  function setTargetCameraX(value: number) {
    targetCameraX = clamp(value, 0, maxScrollX);
  }

  function scrollBy(delta: number) {
    setTargetCameraX(targetCameraX + delta);
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
    const bottom = viewportHeight - (chunkHeight + serviceBackgroundOffsetY) * sceneScale;

    return [
      `width: ${scenePx(chunk.figmaWidth * sceneScale + 1)}`,
      `height: ${scenePx(chunkHeight * sceneScale)}`,
      `bottom: ${scenePx(bottom)}`,
      `transform: translate3d(${scenePx(translateX)}, 0, 0)`
    ].join(';');
  }

  function getLayerAssetStyle(asset: SceneAsset) {
    return getSceneAssetStyle(asset, cameraX, sceneHeight, sceneScale, resolvedLayerSpeed);
  }

  function getTitleStyle() {
    const titleFontSize = Math.min(180 * sceneScale, Math.max(56, (viewportWidth - 48) / 3.9));
    const topbarGutter = viewportWidth <= 760 ? 24 : 80;
    const translateX = topbarGutter - cameraX * resolvedLayerSpeed.title;

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
        id: 'service-horizontal-scroll',
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
  class="service-stage"
  class:is-dragging={isDragging}
  class:is-loaded={isSceneLoaded}
  data-progress={progress.toFixed(3)}
  aria-label="Scena parallasse del servizio"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  <div class="service-scroll-space" style={scrollSpaceStyle}>
    <div class="service-world" style={worldStyle}>
      {#each serviceBackgroundChunks as chunk (chunk.assetKey)}
        <img
          class="service-asset service-chunk reveal-layer background-layer"
          src={chunkAsset(chunk)}
          alt=""
          draggable="false"
          style={getChunkStyle(chunk)}
        />
      {/each}

      {#each serviceMiddleAssets as item (item.id)}
        <img
          class="service-asset service-middle-asset reveal-layer middle-layer"
          src={versionedAsset(item.src)}
          alt=""
          draggable="false"
          style={getLayerAssetStyle(item)}
        />
      {/each}

      {#each serviceForegroundAssets as item (item.id)}
        <img
          class="service-asset service-foreground-asset reveal-layer foreground-layer"
          src={versionedAsset(item.src)}
          alt=""
          draggable="false"
          style={getLayerAssetStyle(item)}
        />
      {/each}

      <h1 class="service-title" style={getTitleStyle()} aria-label="Servizio">Servizio</h1>
    </div>
  </div>
</section>

<style>
  .service-stage {
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

  .service-stage::-webkit-scrollbar {
    display: none;
  }

  .service-scroll-space {
    position: relative;
    min-width: 100%;
    min-height: 100svh;
  }

  .service-world {
    position: sticky;
    left: 0;
    top: 0;
    min-width: 100%;
    min-height: 100svh;
    overflow: hidden;
  }

  .service-asset {
    position: absolute;
    left: 0;
    display: block;
    object-fit: fill;
    pointer-events: none;
    transform-origin: center center;
    user-select: none;
    will-change: transform;
    z-index: var(--scene-layer-z, 0);
  }

  .service-title {
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
  .service-title {
    opacity: 0;
  }

  .service-stage.is-loaded .reveal-layer {
    opacity: 1;
    animation: serviceLayerIn 1ms step-end var(--reveal-delay, 0ms) forwards;
  }

  .service-stage.is-loaded .service-title {
    animation: serviceTitleIn 420ms cubic-bezier(0.22, 1, 0.36, 1) 220ms forwards;
  }

  .background-layer {
    --reveal-delay: 40ms;
    --scene-layer-z: 2;
  }

  .middle-layer {
    --reveal-delay: 60ms;
    --scene-layer-z: 4;
  }

  .foreground-layer {
    --reveal-delay: 80ms;
    --scene-layer-z: 5;
  }

  @keyframes serviceLayerIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes serviceTitleIn {
    from {
      opacity: 0;
      transform: translate3d(0, -50%, 0) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translate3d(0, -50%, 0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .service-stage.is-loaded .reveal-layer,
    .service-stage.is-loaded .service-title {
      animation-duration: 1ms;
    }
  }
</style>
