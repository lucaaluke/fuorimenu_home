<script lang="ts">
  import { onMount } from 'svelte';

  const sceneWidth = 8192;
  const sceneHeight = 1211;
  const assetWidth = 8192;
  const floorHeight = 225;
  const floorTileWidth = 224;
  const layerSpeed = {
    background: 0.55,
    middle: 0.85,
    title: 1.2,
    chef: 1.2,
    foreground: 1
  };
  const cursorCss = "url('/cursors/retrogusto-cursor.svg') 5 5, auto";
  const pointerCursorCss = "url('/cursors/retrogusto-cursor.svg') 5 5, pointer";
  const chefQuote =
    'Il 30 di gennaio era ancora un cantiere, quindi si entrava con l\'elmetto, col giubbotto catarifrangente e le scarpe antinfortunistiche.';

  let stageEl: HTMLElement;
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let cameraX = $state(0);
  let dragStartX = 0;
  let dragCameraX = 0;
  let isDragging = $state(false);
  let isChefBubbleOpen = $state(false);

  const sceneScale = $derived(viewportHeight ? viewportHeight / sceneHeight : 1);
  const worldWidth = $derived(Math.max(viewportWidth, sceneWidth * sceneScale));
  const maxScrollX = $derived(Math.max(0, worldWidth - viewportWidth));

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const px = (value: number) => `${value.toFixed(2)}px`;

  function syncViewport() {
    if (!stageEl) return;
    viewportWidth = stageEl.clientWidth;
    viewportHeight = stageEl.clientHeight;
    cameraX = clamp(cameraX, 0, maxScrollX);
  }

  function scrollBy(delta: number) {
    cameraX = clamp(cameraX + delta, 0, maxScrollX);
  }

  function getLayerStyle(factor: number, bottomOffset = 0) {
    return [
      `width: ${px(assetWidth * sceneScale)}`,
      `bottom: ${px(bottomOffset * sceneScale)}`,
      `transform: translate3d(${px(-cameraX * factor)}, 0, 0)`
    ].join(';');
  }

  function getTitleStyle() {
    return [
      `left: ${px(92 * sceneScale - cameraX * layerSpeed.title)}`,
      `top: ${px(viewportHeight / 2 - 132 * sceneScale)}`,
      `font-size: ${px(255 * sceneScale)}`
    ].join(';');
  }

  function getChefStyle() {
    return [
      `left: ${px(1100 * sceneScale - cameraX * layerSpeed.chef)}`,
      `bottom: ${px(viewportHeight / 20)}`,
      `width: ${px(250 * sceneScale)}`
    ].join(';');
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    scrollBy((event.deltaY + event.deltaX) * 1.05);
  }

  function onPointerDown(event: PointerEvent) {
    isDragging = true;
    dragStartX = event.clientX;
    dragCameraX = cameraX;
    stageEl.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging) return;
    cameraX = clamp(dragCameraX + (dragStartX - event.clientX) * 1.35, 0, maxScrollX);
  }

  function endDrag(event: PointerEvent) {
    isDragging = false;
    if (stageEl.hasPointerCapture(event.pointerId)) {
      stageEl.releasePointerCapture(event.pointerId);
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    scrollBy(event.key === 'ArrowLeft' ? -42 : 42);
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(syncViewport);
    resizeObserver.observe(stageEl);
    syncViewport();
    window.addEventListener('keydown', onKeydown);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeydown);
    };
  });
</script>

<section
  bind:this={stageEl}
  class="kitchen-stage"
  class:is-dragging={isDragging}
  style={`--kitchen-cursor: ${cursorCss}; --kitchen-pointer-cursor: ${pointerCursorCss};`}
  aria-label="Scena parallasse della cucina"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  <div class="parallax-layer background-layer" style={getLayerStyle(layerSpeed.background)}>
    <img src="/assets/cucina_background.svg" alt="" draggable="false" />
  </div>

  <div class="floor-layer" style={`height: ${px(floorHeight * sceneScale)}; background-size: ${px(floorTileWidth * sceneScale)} ${px(floorHeight * sceneScale)}; background-position-x: ${px(-cameraX)};`}></div>

  <div class="parallax-layer middle-layer" style={getLayerStyle(layerSpeed.middle)}>
    <img src="/assets/cucina_layer3a.svg" alt="" draggable="false" />
  </div>

  <h1 class="scene-title" style={getTitleStyle()}>Cucina</h1>

  <button
    class="chef-button"
    class:is-open={isChefBubbleOpen}
    style={getChefStyle()}
    type="button"
    aria-label="Apri testimonianza Carlo Zarri"
    onpointerdown={(event) => event.stopPropagation()}
    onclick={() => {
      isChefBubbleOpen = !isChefBubbleOpen;
    }}
  >
    <span class="speech-bubble" aria-hidden={!isChefBubbleOpen}>
      <strong>Carlo Zarri</strong>
      <span>{chefQuote}</span>
    </span>
    <img src="/assets/npc_CarloZarri_alt1.svg" alt="" draggable="false" />
  </button>

  <div class="parallax-layer foreground-layer" style={getLayerStyle(layerSpeed.foreground, -180)}>
    <img src="/assets/cucina_layer1a.svg" alt="" draggable="false" />
  </div>
</section>

<style>
  .kitchen-stage {
    position: relative;
    width: 100%;
    min-height: 100svh;
    overflow: hidden;
    background: var(--color-surface-page);
    cursor: var(--kitchen-cursor);
    user-select: none;
    touch-action: none;
  }

  .kitchen-stage:focus-visible {
    outline: none;
  }

  .kitchen-stage.is-dragging {
    cursor: var(--kitchen-cursor);
  }

  .parallax-layer,
  .floor-layer,
  .scene-title,
  .chef-button {
    position: absolute;
    left: 0;
    will-change: transform;
  }

  .parallax-layer {
    pointer-events: none;
  }

  .parallax-layer img {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
  }

  .background-layer {
    z-index: 1;
  }

  .floor-layer {
    z-index: 2;
    right: 0;
    bottom: 0;
    background-image: url('/assets/pavimento_tile.svg');
    background-repeat: repeat-x;
    pointer-events: none;
  }

  .middle-layer {
    z-index: 3;
  }

  .scene-title {
    z-index: 4;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-weight: 700;
    line-height: 0.86;
    pointer-events: none;
    transform: translate3d(0, -50%, 0);
    white-space: nowrap;
  }

  .chef-button {
    z-index: 5;
    display: block;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    cursor: var(--kitchen-pointer-cursor);
  }

  .chef-button img {
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
  }

  .speech-bubble {
    position: absolute;
    right: -330px;
    bottom: calc(100% - 90px);
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    width: min(500px, 62vw);
    padding: 18px 20px;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--dialogue-radius);
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: clamp(12px, 1.35vw, 18px);
    font-weight: 400;
    line-height: 1.4;
    text-align: left;
    opacity: 0;
    transform: translate3d(0, 10px, 0);
    transition: opacity 160ms ease, transform 180ms ease;
    pointer-events: none;
  }

  .speech-bubble strong {
    font-size: 0.86em;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .chef-button.is-open .speech-bubble {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

  .foreground-layer {
    z-index: 6;
  }

  @media (max-width: 760px) {
    .speech-bubble {
      right: -180px;
      width: min(360px, 74vw);
      padding: 14px 16px;
    }
  }
</style>
