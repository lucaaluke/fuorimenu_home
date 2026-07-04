<script lang="ts">
  import { onMount } from 'svelte';
  import { clamp, ease, px } from '$lib/scene/math';
  import { loadGsapWithScrollTrigger } from '$lib/scene/gsap-loader';
  import { createViewportObserver } from '$lib/scene/viewport';
  import type { SceneChunk } from '$lib/scene/scene-asset.types';
  import SceneLoadingProgress from '$lib/scene/SceneLoadingProgress.svelte';
  import type { ParallaxPhaserGameHandle } from '$lib/scene/phaser/ParallaxPhaserGame';
  import {
    resolvedServiceSceneConfig,
    serviceBackgroundChunks,
    serviceBackgroundOffsetY,
    serviceFloorAssets,
    serviceForegroundAssets,
    serviceMiddleAssets
  } from './service-scene.config';

  const { assetVersion, layerSpeed, sceneHeight, sceneWidth } = resolvedServiceSceneConfig;
  const serviceBackgroundViewportOffsetY = 1;
  const serviceMiddleViewportOffsetY = 8;

  let stageEl: HTMLElement;
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let cameraX = $state(0);
  let targetCameraX = 0;
  let isDragging = $state(false);
  let isSceneLoaded = $state(false);
  let isPhaserReady = $state(false);
  let phaserLoadingProgress = $state(0);
  let prefersReducedMotion = $state(false);
  let servicePhaserContainerEl: HTMLElement;
  let servicePhaserGame: ParallaxPhaserGameHandle | undefined;
  let servicePhaserResizeTimer: number | undefined;
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
    floor: prefersReducedMotion ? 1 : layerSpeed.floor,
    foreground: prefersReducedMotion ? 1 : layerSpeed.foreground,
    title: prefersReducedMotion ? 1 : layerSpeed.title
  });
  const sceneScale = $derived(viewportHeight ? viewportHeight / sceneHeight : 1);
  const worldWidth = $derived(Math.max(viewportWidth, sceneWidth * sceneScale));
  const maxScrollX = $derived(Math.max(0, worldWidth - viewportWidth));
  const progress = $derived(maxScrollX > 0 ? clamp(cameraX / maxScrollX, 0, 1) : 0);
  const servicePhaserAssets = [...serviceFloorAssets, ...serviceMiddleAssets, ...serviceForegroundAssets];
  const scenePx = (value: number) => px(value, 2);
  const scrollSpaceStyle = $derived(
    `width: ${scenePx(worldWidth)}; height: ${scenePx(viewportHeight)}`
  );
  const worldStyle = $derived(
    `width: ${scenePx(viewportWidth)}; height: ${scenePx(viewportHeight)}`
  );

  function serviceChunkPath(chunk: SceneChunk) {
    return `servizio-figma/sfondo/Slice ${chunk.frameIndex + 1}.png`;
  }

  function syncViewport() {
    if (!stageEl) return;
    viewportWidth = Math.max(1, stageEl.clientWidth);
    viewportHeight = Math.max(1, stageEl.clientHeight);
    targetCameraX = clamp(targetCameraX, 0, maxScrollX);
    cameraX = clamp(cameraX, 0, maxScrollX);
    servicePhaserGame?.setCameraX(cameraX);
    scheduleServicePhaserResize();
    scrollTrigger?.refresh();
  }

  function scheduleServicePhaserResize() {
    if (!servicePhaserGame || !viewportWidth || !viewportHeight) return;
    if (servicePhaserResizeTimer) window.clearTimeout(servicePhaserResizeTimer);

    servicePhaserResizeTimer = window.setTimeout(() => {
      servicePhaserResizeTimer = undefined;
      servicePhaserGame?.resize(viewportWidth, viewportHeight);
      servicePhaserGame?.setCameraX(cameraX);
    }, 0);
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
    servicePhaserGame?.setCameraX(cameraX);
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
    void import('$lib/scene/phaser/ParallaxPhaserGame').then(({ createParallaxPhaserGame }) => {
      if (destroyed || !servicePhaserContainerEl) return;

      createParallaxPhaserGame({
        assetVersion,
        assets: servicePhaserAssets,
        chunks: serviceBackgroundChunks,
        chunkOffsetY: serviceBackgroundOffsetY,
        chunkViewportOffsetY: serviceBackgroundViewportOffsetY,
        container: servicePhaserContainerEl,
        getChunkPath: serviceChunkPath,
        getViewport: () => ({
          width: Math.max(1, viewportWidth || stageEl?.clientWidth || 1),
          height: Math.max(1, viewportHeight || stageEl?.clientHeight || 1)
        }),
        layerSpeed,
        onLoadingProgress: (progress) => {
          phaserLoadingProgress = progress;
        },
        onReady: () => {
          isPhaserReady = true;
        },
        sceneHeight,
        sceneWidth,
        viewportOffsetYByLayer: {
          middle: serviceMiddleViewportOffsetY
        }
      }).then((game) => {
        if (destroyed) {
          game?.destroy();
          return;
        }

        servicePhaserGame = game;
        servicePhaserGame?.setCameraX(cameraX);
        scheduleServicePhaserResize();
      });
    });
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
      if (servicePhaserResizeTimer) window.clearTimeout(servicePhaserResizeTimer);
      servicePhaserGame?.destroy();
      servicePhaserGame = undefined;
      servicePhaserResizeTimer = undefined;
    };
  });
</script>

<section
  bind:this={stageEl}
  class="service-stage"
  class:is-dragging={isDragging}
  class:is-loaded={isSceneLoaded && isPhaserReady}
  data-progress={progress.toFixed(3)}
  aria-label="Scena parallasse del servizio"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  <div bind:this={servicePhaserContainerEl} class="service-phaser-layer" aria-hidden="true"></div>
  {#if !isPhaserReady}
    <SceneLoadingProgress progress={phaserLoadingProgress} />
  {/if}

  <div class="service-scroll-space" style={scrollSpaceStyle}>
    <div class="service-world" style={worldStyle}>
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

  .service-phaser-layer {
    position: absolute;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .service-phaser-layer :global(canvas) {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
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

  .service-title {
    opacity: 0;
  }

  .service-stage.is-loaded .service-title {
    animation: serviceTitleIn 420ms cubic-bezier(0.22, 1, 0.36, 1) 220ms forwards;
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
    .service-stage.is-loaded .service-title {
      animation-duration: 1ms;
    }
  }
</style>
