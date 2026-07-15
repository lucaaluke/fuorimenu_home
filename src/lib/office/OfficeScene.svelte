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
  import { clamp, ease, px } from '$lib/scene/math';
  import {
    DRAG_SCROLL_FACTOR,
    SCENE_CAMERA_EASING,
    SCENE_REVEAL_DELAY_MS,
    TOUCH_SCROLL_DEAD_ZONE,
    TOUCH_SCROLL_FACTOR,
    TOUCH_SCROLL_INTERACTIVE_SELECTOR
  } from '$lib/scene/constants';
  import { loadGsapWithScrollTrigger, type Gsap } from '$lib/scene/gsap-loader';
  import type { InteractiveSceneAsset, SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';
  import SceneLoadingProgress from '$lib/scene/SceneLoadingProgress.svelte';
  import SceneProgressBar from '$lib/scene/SceneProgressBar.svelte';
  import { getSceneAssetStyle } from '$lib/scene/scene-utils';
  import { createViewportObserver } from '$lib/scene/viewport';
  import { triggerTapClickFeedback } from '$lib/scene/tap-click-feedback';
  import type { ParallaxPhaserGameHandle } from '$lib/scene/phaser/ParallaxPhaserGame';

  let { isAudioMuted = false, onProgressChange, onSceneRevealedChange } = $props<{
    isAudioMuted?: boolean;
    onProgressChange?: (progress: number) => void;
    onSceneRevealedChange?: (isRevealed: boolean) => void;
  }>();

  const { assetVersion, layerSpeed, sceneHeight, sceneWidth } = officeSceneConfig;

  let stageEl: HTMLElement;
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let cameraX = $state(0);
  let targetCameraX = 0;
  let isDragging = $state(false);
  let isSceneLoaded = $state(false);
  let isPhaserReady = $state(false);
  let isSceneRevealed = $state(false);
  let phaserLoadingProgress = $state(0);
  let hasPointerScenePosition = $state(false);
  let isTouchScrolling = false;
  let touchLastX = 0;
  let touchLastY = 0;
  let pointerSceneY = $state(0);
  let pointerSceneX = $state({
    background: 0,
    middle: 0,
    foreground: 0
  });
  let hoveredOfficeAssetId = $state<string | undefined>();
  let officeHoverClearTimer: ReturnType<typeof setTimeout> | undefined;
  let prefersReducedMotion = $state(false);
  let shouldResumeOfficeAudioFromMutedPage = false;
  let officeAmbientAudioEl: HTMLAudioElement;
  let keysHoverAudioEl: HTMLAudioElement;
  let clickHoverAudioEl: HTMLAudioElement;
  let cioHoverAudioEl: HTMLAudioElement;
  let mapHoverAudioEl: HTMLAudioElement;
  let carloOfficeAudioEl: HTMLAudioElement;
  let carloOffice2AudioEl: HTMLAudioElement;
  let elisabettaOfficeAudioEl: HTMLAudioElement;
  let faustoOfficeAudioEl: HTMLAudioElement;
  let isAmbientAudioStarted = false;
  let isCarloOfficeAudioActive = $state(false);
  let isCarloOfficeAudioStarting = false;
  let hasPlayedCarloOfficeAudio = false;
  let isCarloOffice2AudioActive = $state(false);
  let isCarloOffice2AudioStarting = false;
  let hasPlayedCarloOffice2Audio = false;
  let isElisabettaOfficeAudioActive = $state(false);
  let isElisabettaOfficeAudioStarting = false;
  let hasPlayedElisabettaOfficeAudio = false;
  let isFaustoOfficeAudioActive = $state(false);
  let isFaustoOfficeAudioStarting = false;
  let hasPlayedFaustoOfficeAudio = false;
  let carloOfficeRevealProgress = $state(0);
  let carloOfficeMutedPageIndex = $state(0);
  let carloOffice2RevealProgress = $state(0);
  let carloOffice2MutedPageIndex = $state(0);
  let elisabettaOfficeRevealProgress = $state(0);
  let elisabettaOfficeMutedPageIndex = $state(0);
  let faustoOfficeRevealProgress = $state(0);
  let faustoOfficeMutedPageIndex = $state(0);
  let gsap: Gsap | undefined;
  let officeAmbientFadeFrame: number | undefined;
  let carloOfficeFadeFrame: number | undefined;
  let carloOffice2FadeFrame: number | undefined;
  let elisabettaOfficeFadeFrame: number | undefined;
  let faustoOfficeFadeFrame: number | undefined;
  let officePhaserContainerEl: HTMLElement;
  let officePhaserGame: ParallaxPhaserGameHandle | undefined;
  let officePhaserResizeTimer: number | undefined;
  let sceneRevealTimer: ReturnType<typeof setTimeout> | undefined;
  let dragStartX = 0;
  let dragStartY = 0;
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
  const isSceneInteractive = $derived(isSceneRevealed);

  $effect(() => {
    onProgressChange?.(progress);
  });

  const scenePx = (value: number) => px(value, 2);
  const officeCoordinateAssets = [...officeMiddleAssets, ...officeForegroundAssets];
  const officePhaserAssets = [...officeFloorAssets, ...officeMiddleAssets, ...officeForegroundAssets];
  const officeProgressTicks = $derived(
    maxScrollX > 0
      ? [
          getElisabettaOfficeStartCameraX() / maxScrollX,
          getFaustoOfficeStartCameraX() / maxScrollX
        ]
      : []
  );
  const scrollSpaceStyle = $derived(
    `width: ${scenePx(worldWidth)}; height: ${scenePx(viewportHeight)}`
  );
  const worldStyle = $derived(
    `width: ${scenePx(viewportWidth)}; height: ${scenePx(viewportHeight)}`
  );
  const officeHandoffResistance = {
    maxFactor: 0.92,
    minFactor: 0.68,
    zoneBeforeDisappearPx: 350
  };
  const firstOfficeDialogueStartCameraX = 600;
  const finalOfficeDialogueEndOffsetPx = 600;
  const officeAmbientVolume = 0.32;
  const officeAmbientFadeInDuration = 1.2;
  const officeAmbientFadeOutDuration = 0.36;
  const officeDialogueAudioFadeInDuration = 0.18;
  const officeDialogueAudioHandoffFadeOutDuration = 0;
  const carloOfficeAudioVolume = 0.92;
  const carloOfficeAudioFadeOutDuration = 0.18;
  const carloOfficeRevealDurationSeconds = 37.54;
  const carloOfficeSpeech =
    'Qui parliamo del 2018 che abbiamo sviluppato il dossier di candidatura. Nel 2019 Milano Cortina vince viene nominata organizzatrice delle Olimpiadi del 2026, quindi 7 anni prima. E poi nel 2021 io entro nello staff come direttore Food and Beverage. Ci sono 110-120 delegati che sono i Presidenti dei vari Comitati Olimpici nel mondo, che si riuniscono, valutano il dossier che tu hai presentato e decidono tra le varie città candidate quale deve essere quella che vince, quindi tu devi essere molto esaustivo, molto attraente.';
  const carloOffice2AudioVolume = 0.92;
  const carloOffice2AudioFadeOutDuration = 0.18;
  const carloOffice2RevealDurationSeconds = 41.74;
  const carloOffice2StartCameraX = 3785;
  const carloOffice2EndCameraX = 6844;
  const carloOffice2Speech =
    "La complessità di questa Olimpiade era che, mentre a Torino era una città, Torino, qui avevi quattro regioni, 9 province e 13 siti di gara. C'era un villaggio olimpico a Predazzo, un villaggio olimpico a Livigno, un villaggio olimpico a Cortina, poi avevi tre cluster alberghieri che fungevano da villaggio olimpico. E quando io dovevo fare l'impostazione reale sul posto e vedere come erano fatti, per fare la visita dei 7 io ci ho impiegato quattro giorni. Per spiegarlo ad un americano facevo questo esempio: è come se tu hai le Olimpiadi a Washington, poi hai la gara di bob a New York e poi le gare di fondo a Charleston.";
  const elisabettaOfficeAudioVolume = 0.92;
  const elisabettaOfficeAudioFadeOutDuration = 0.18;
  const elisabettaOfficeRevealDurationSeconds = 47.57;
  const elisabettaOfficeStartCameraX = 7245;
  const elisabettaOfficeEndCameraX = 13000;
  const elisabettaOfficeSpeech =
    "Il lavoro solitamente si divide in tre fasi: c'è la fase di strategia, c'è il momento di planning, in cui si cercano i fornitori, e poi una fase di Games Time, dove invece si fanno solo operations. La nostra strategia è stata molto condizionata dal fatto che fossero le prime Olimpiadi del mondo così sparse sul territorio, Ci sono stati una serie di incontri preliminari con alcuni componenti di alcune federazioni e uno di questi è stato sicuramente lo Chef de mission, perché in questo meeting vengono i capi delegazione delle varie delegazioni internazionali. Al Games Time iniziano ad essere ogni tre giorni, ma prima ci sono almeno due o tre appuntamenti durante i quali si inizia a spiegare quale sarà il disegno e, mano a mano che si è pronti, si scende nei dettagli.";
  const faustoOfficeAudioVolume = 0.92;
  const faustoOfficeAudioFadeOutDuration = 0.18;
  const faustoOfficeRevealDurationSeconds = 20.56;
  const faustoOfficeSpeech =
    "Le aziende coinvolte la maggior parte erano degli sponsor, quindi abbiamo dovuto adeguare anche il menu agli sponsor. Quindi è un incastro di situazioni molto particolari. Il menù tenete conto che noi l'abbiamo cambiato e rivisto almeno una dozzina di volte, proprio perché c'erano sponsor che uscivano e sponsor che entravano.";
  const officeKeysHoverText =
    'I Giochi si estendevano su oltre 22.000 km², con sedi distribuite tra Milano, Cortina e altri cluster del Nord Italia, e uno spostamento Milano-Cortina poteva richiedere anche 4-5 ore.';
  const officeCioHoverText =
    'Dar da mangiare alle Olimpiadi è uno degli sforzi di Food and Beverage più grandi al mondo dopo la guerra';
  const officeMapHoverText =
    'Il villaggio di Milano aveva 1500-1600 ospiti, quello di Predazzo 700, Livigno 1100-1200.';
  const officeComputerHoverText =
    'Con 2.900 atleti e 116 eventi si iniziava anni prima partendo dalle esigenze delle federazioni per organizzare il menù';
  const carloOfficeEnterDistance = $derived(Math.max(130, viewportWidth * 0.16));
  const carloOfficeExitDistance = $derived(Math.max(170, viewportWidth * 0.2));
  const carloOffice2EnterDistance = $derived(Math.max(130, viewportWidth * 0.13));
  const carloOffice2ExitDistance = $derived(Math.max(170, viewportWidth * 0.16));
  const elisabettaOfficeEnterDistance = $derived(Math.max(130, viewportWidth * 0.13));
  const elisabettaOfficeExitDistance = $derived(Math.max(170, viewportWidth * 0.16));
  const faustoOfficeEnterDistance = $derived(Math.max(130, viewportWidth * 0.13));
  const faustoOfficeExitDistance = $derived(Math.max(170, viewportWidth * 0.16));
  const carloOfficeSpeechPages = $derived(getCarloOfficeSpeechPages());
  const carloOfficeSpeechPageCount = $derived(carloOfficeSpeechPages.length);
  const carloOfficeVisiblePageIndex = $derived(getCarloOfficeVisiblePageIndex());
  const carloOfficeSpeechInfo = $derived(getCarloOfficeCurrentSpeechPageInfo());
  const carloOffice2SpeechPages = $derived(getCarloOffice2SpeechPages());
  const carloOffice2SpeechPageCount = $derived(carloOffice2SpeechPages.length);
  const carloOffice2VisiblePageIndex = $derived(getCarloOffice2VisiblePageIndex());
  const carloOffice2SpeechInfo = $derived(getCarloOffice2CurrentSpeechPageInfo());
  const elisabettaOfficeSpeechPages = $derived(getElisabettaOfficeSpeechPages());
  const elisabettaOfficeSpeechPageCount = $derived(elisabettaOfficeSpeechPages.length);
  const elisabettaOfficeVisiblePageIndex = $derived(getElisabettaOfficeVisiblePageIndex());
  const elisabettaOfficeSpeechInfo = $derived(getElisabettaOfficeCurrentSpeechPageInfo());
  const faustoOfficeSpeechPages = $derived(getFaustoOfficeSpeechPages());
  const faustoOfficeSpeechPageCount = $derived(faustoOfficeSpeechPages.length);
  const faustoOfficeVisiblePageIndex = $derived(getFaustoOfficeVisiblePageIndex());
  const faustoOfficeSpeechInfo = $derived(getFaustoOfficeCurrentSpeechPageInfo());

  function versionedAsset(path: string) {
    const normalized = path.startsWith('/') ? path : `/assets/${path}`;
    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}v=${assetVersion}`;
  }

  function officeChunkPath(chunk: SceneChunk) {
    return `office/figma/background/Slice ${chunk.frameIndex + 1}.png`;
  }

  function getCarloOfficeEnterCameraX() {
    return clamp(firstOfficeDialogueStartCameraX, 0, maxScrollX);
  }

  function getCarloOfficeExitCameraX() {
    const attaccapanniLogicalX = 26066 * 0.5;
    const foregroundSpeed = resolvedLayerSpeed.foreground || 1;
    const cameraAtAttaccapanni =
      (attaccapanniLogicalX * sceneScale - viewportWidth * 0.72) / foregroundSpeed;

    return clamp(cameraAtAttaccapanni, getCarloOfficeEnterCameraX() + viewportWidth * 0.5, maxScrollX);
  }

  function getCarloOffice2StartCameraX() {
    return clamp(carloOffice2StartCameraX, 0, maxScrollX);
  }

  function getCarloOffice2EndCameraX() {
    return clamp(
      Math.max(carloOffice2EndCameraX, getCarloOffice2StartCameraX() + viewportWidth * 0.32),
      getCarloOffice2StartCameraX(),
      maxScrollX
    );
  }

  function getElisabettaOfficeStartCameraX() {
    return clamp(elisabettaOfficeStartCameraX, 0, maxScrollX);
  }

  function getElisabettaOfficeEndCameraX() {
    return clamp(
      Math.max(elisabettaOfficeEndCameraX, getElisabettaOfficeStartCameraX() + viewportWidth * 0.32),
      getElisabettaOfficeStartCameraX(),
      maxScrollX
    );
  }

  function getFaustoOfficeAnchorCameraX(options: {
    figmaX: number;
    layer: 'middle' | 'foreground';
    viewportFactor?: number;
  }) {
    const logicalX = options.figmaX * 0.5;
    const speed = resolvedLayerSpeed[options.layer] || 1;
    const viewportFactor = options.viewportFactor ?? 0.72;
    return (logicalX * sceneScale - viewportWidth * viewportFactor) / speed;
  }

  function getFaustoOfficeStartCameraX() {
    return clamp(13700, 0, maxScrollX);
  }

  function getFaustoOfficeEndCameraX() {
    const startCameraX = getFaustoOfficeStartCameraX();

    return clamp(
      maxScrollX - finalOfficeDialogueEndOffsetPx,
      startCameraX + viewportWidth * 0.32,
      maxScrollX
    );
  }

  function isCarloOfficeAudioUnfinished() {
    if (isCarloOfficeAudioStarting) return true;
    if (!isCarloOfficeAudioActive || !carloOfficeAudioEl || carloOfficeAudioEl.paused || carloOfficeAudioEl.ended) {
      return false;
    }

    const duration = Number.isFinite(carloOfficeAudioEl.duration)
      ? carloOfficeAudioEl.duration
      : carloOfficeRevealDurationSeconds;

    return carloOfficeAudioEl.currentTime < duration - 0.2;
  }

  function isCarloOffice2AudioUnfinished() {
    if (isCarloOffice2AudioStarting) return true;
    if (!isCarloOffice2AudioActive || !carloOffice2AudioEl || carloOffice2AudioEl.paused || carloOffice2AudioEl.ended) {
      return false;
    }

    const duration = Number.isFinite(carloOffice2AudioEl.duration)
      ? carloOffice2AudioEl.duration
      : carloOffice2RevealDurationSeconds;

    return carloOffice2AudioEl.currentTime < duration - 0.2;
  }

  function isElisabettaOfficeAudioUnfinished() {
    if (isElisabettaOfficeAudioStarting) return true;
    if (
      !isElisabettaOfficeAudioActive ||
      !elisabettaOfficeAudioEl ||
      elisabettaOfficeAudioEl.paused ||
      elisabettaOfficeAudioEl.ended
    ) {
      return false;
    }

    const duration = Number.isFinite(elisabettaOfficeAudioEl.duration)
      ? elisabettaOfficeAudioEl.duration
      : elisabettaOfficeRevealDurationSeconds;

    return elisabettaOfficeAudioEl.currentTime < duration - 0.2;
  }

  function isFaustoOfficeAudioUnfinished() {
    if (isFaustoOfficeAudioStarting) return true;
    if (!isFaustoOfficeAudioActive || !faustoOfficeAudioEl || faustoOfficeAudioEl.paused || faustoOfficeAudioEl.ended) {
      return false;
    }

    const duration = Number.isFinite(faustoOfficeAudioEl.duration)
      ? faustoOfficeAudioEl.duration
      : faustoOfficeRevealDurationSeconds;

    return faustoOfficeAudioEl.currentTime < duration - 0.2;
  }

  function applyCarloOfficeScrollResistance(nextValue: number, baseValue = targetCameraX) {
    const delta = nextValue - baseValue;
    const activeFausto = isFaustoOfficeAudioUnfinished();
    const activeElisabetta = isElisabettaOfficeAudioUnfinished();
    const activeCarlo2 = isCarloOffice2AudioUnfinished();
    if (delta <= 0 || (!isCarloOfficeAudioUnfinished() && !activeCarlo2 && !activeElisabetta && !activeFausto)) {
      return nextValue;
    }

    const applyOfficeHandoffResistance = (enterCameraX: number, exitCameraX: number) => {
      const stickyStart = Math.max(
        enterCameraX,
        exitCameraX - officeHandoffResistance.zoneBeforeDisappearPx
      );
      const stickyEnd = exitCameraX;
      if (cameraX < stickyStart || cameraX > stickyEnd) return nextValue;

      const releaseProgress = clamp((cameraX - stickyStart) / Math.max(stickyEnd - stickyStart, 1), 0, 1);
      const factor =
        officeHandoffResistance.maxFactor -
        ease(releaseProgress) *
          (officeHandoffResistance.maxFactor - officeHandoffResistance.minFactor);

      return baseValue + delta * factor;
    };

    if (activeFausto) {
      return applyOfficeHandoffResistance(getFaustoOfficeStartCameraX(), getFaustoOfficeEndCameraX());
    }

    if (activeElisabetta) {
      return applyOfficeHandoffResistance(getElisabettaOfficeStartCameraX(), getElisabettaOfficeEndCameraX());
    }

    if (activeCarlo2) {
      return applyOfficeHandoffResistance(getCarloOffice2StartCameraX(), getCarloOffice2EndCameraX());
    }

    return applyOfficeHandoffResistance(getCarloOfficeEnterCameraX(), getCarloOfficeExitCameraX());
  }

  function setTargetCameraX(value: number, options: { bypassResistance?: boolean } = {}) {
    const nextValue = options.bypassResistance ? value : applyCarloOfficeScrollResistance(value);
    targetCameraX = clamp(nextValue, 0, maxScrollX);
  }

  function syncViewport() {
    if (!stageEl) return;
    viewportWidth = stageEl.clientWidth;
    viewportHeight = stageEl.clientHeight;
    targetCameraX = clamp(targetCameraX, 0, maxScrollX);
    cameraX = clamp(cameraX, 0, maxScrollX);
    officePhaserGame?.setCameraX(cameraX);
    scheduleOfficePhaserResize();
    scrollTrigger?.refresh();
  }

  function scheduleOfficePhaserResize() {
    if (!officePhaserGame || !viewportWidth || !viewportHeight) return;
    if (officePhaserResizeTimer) window.clearTimeout(officePhaserResizeTimer);

    officePhaserResizeTimer = window.setTimeout(() => {
      officePhaserResizeTimer = undefined;
      officePhaserGame?.resize(viewportWidth, viewportHeight);
      officePhaserGame?.setCameraX(cameraX);
    }, 0);
  }

  function getScrollForCameraX(value: number) {
    if (!scrollTrigger) return value;
    const nextProgress = maxScrollX > 0 ? clamp(value / maxScrollX, 0, 1) : 0;
    return scrollTrigger.start + (scrollTrigger.end - scrollTrigger.start) * nextProgress;
  }

  function scrollBy(delta: number) {
    if (!isSceneInteractive) return;
    setTargetCameraX(targetCameraX + delta);
    scrollTrigger?.scroll(getScrollForCameraX(targetCameraX));
  }

  function updatePointerScenePosition(event: PointerEvent) {
    if (!stageEl || !sceneScale) return;

    const rect = stageEl.getBoundingClientRect();
    const localX = clamp(event.clientX - rect.left, 0, rect.width);
    const localY = clamp(event.clientY - rect.top, 0, rect.height);

    hasPointerScenePosition = true;
    pointerSceneY = localY / sceneScale;
    pointerSceneX = {
      background: (localX + cameraX * resolvedLayerSpeed.background) / sceneScale,
      middle: (localX + cameraX * resolvedLayerSpeed.middle) / sceneScale,
      foreground: (localX + cameraX * resolvedLayerSpeed.foreground) / sceneScale
    };
    setHoveredOfficeAssetId(getHoveredOfficeAssetId());
  }

  function getHoveredOfficeAssetId() {
    if (!hasPointerScenePosition) return undefined;

    const hoverPadding = 26;
    const interactiveAssets = officeCoordinateAssets.filter(isInteractiveAsset);

    for (const asset of interactiveAssets.slice().reverse()) {
      const layerX = pointerSceneX[asset.layer as keyof typeof pointerSceneX];
      if (layerX === undefined) continue;

      const withinX = layerX >= asset.x - hoverPadding && layerX <= asset.x + asset.width + hoverPadding;
      const withinY =
        pointerSceneY >= asset.y - hoverPadding && pointerSceneY <= asset.y + asset.height + hoverPadding;

      if (withinX && withinY) return asset.id;
    }

    return undefined;
  }

  function setHoveredOfficeAssetId(nextId: string | undefined) {
    if (officeHoverClearTimer) {
      clearTimeout(officeHoverClearTimer);
      officeHoverClearTimer = undefined;
    }

    if (nextId) {
      hoveredOfficeAssetId = nextId;
      return;
    }

    const clearDelay = hoveredOfficeAssetId === 'easteregg' ? 45 : 120;

    officeHoverClearTimer = setTimeout(() => {
      hoveredOfficeAssetId = undefined;
      officeHoverClearTimer = undefined;
    }, clearDelay);
  }

  function evaluateScene(delta: number) {
    if (!isSceneInteractive) {
      targetCameraX = 0;
      cameraX = 0;
      officePhaserGame?.setCameraX(0);
      return;
    }

    if (
      targetCameraX > cameraX &&
      (isCarloOfficeAudioUnfinished() ||
        isCarloOffice2AudioUnfinished() ||
        isElisabettaOfficeAudioUnfinished() ||
        isFaustoOfficeAudioUnfinished())
    ) {
      targetCameraX = applyCarloOfficeScrollResistance(targetCameraX, cameraX);
    }

    const distance = targetCameraX - cameraX;
    const frameScale = Math.min(
      delta / SCENE_CAMERA_EASING.frameDuration,
      SCENE_CAMERA_EASING.maxFrameScale
    );
    const amount = prefersReducedMotion
      ? 1
      : isDragging
        ? SCENE_CAMERA_EASING.dragAmount
        : SCENE_CAMERA_EASING.idleAmount;
    const stepAmount = 1 - Math.pow(1 - amount, frameScale);

    cameraX =
      Math.abs(distance) < SCENE_CAMERA_EASING.snapDistance
        ? targetCameraX
        : cameraX + distance * stepAmount;
    cameraX = clamp(cameraX, 0, maxScrollX);
    targetCameraX = clamp(targetCameraX, 0, maxScrollX);
    officePhaserGame?.setCameraX(cameraX);
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    if (!isSceneInteractive) return;
    void startAmbientAudio();
    const axisDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    scrollBy(axisDelta * 1.08);
  }

  function canStartTouchScroll(target: EventTarget | null) {
    return target instanceof Element && !target.closest(TOUCH_SCROLL_INTERACTIVE_SELECTOR);
  }

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1 || !canStartTouchScroll(event.target)) {
      isTouchScrolling = false;
      return;
    }

    const touch = event.touches[0];
    touchLastX = touch.clientX;
    touchLastY = touch.clientY;
    isTouchScrolling = isSceneInteractive;
    if (isSceneInteractive) void startAmbientAudio();
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1 || !canStartTouchScroll(event.target)) {
      isTouchScrolling = false;
      return;
    }
    if (!isSceneInteractive) return;

    const touch = event.touches[0];
    if (!isTouchScrolling) {
      touchLastX = touch.clientX;
      touchLastY = touch.clientY;
      isTouchScrolling = true;
      void startAmbientAudio();
      return;
    }

    const deltaX = touch.clientX - touchLastX;
    const deltaY = touch.clientY - touchLastY;
    touchLastX = touch.clientX;
    touchLastY = touch.clientY;

    const dominantDelta = Math.abs(deltaY) > Math.abs(deltaX) ? -deltaY : -deltaX;
    if (Math.abs(dominantDelta) < TOUCH_SCROLL_DEAD_ZONE) return;

    event.preventDefault();
    scrollBy(dominantDelta * TOUCH_SCROLL_FACTOR);
  }

  function onTouchEnd() {
    isTouchScrolling = false;
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    if (!isSceneInteractive) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    updatePointerScenePosition(event);
    void startAmbientAudio();
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragScrollStart = scrollTrigger?.scroll() ?? 0;
    stageEl.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    if (!isSceneInteractive) return;
    updatePointerScenePosition(event);
    if (!isDragging) return;
    const dragDeltaX = dragStartX - event.clientX;
    const dragDeltaY = dragStartY - event.clientY;
    const dominantDelta = Math.abs(dragDeltaY) > Math.abs(dragDeltaX) ? dragDeltaY : dragDeltaX;
    scrollTrigger?.scroll(dragScrollStart + dominantDelta * DRAG_SCROLL_FACTOR);
  }

  function onPointerLeave() {
    if (!isDragging) {
      hasPointerScenePosition = false;
      setHoveredOfficeAssetId(undefined);
    }
  }

  function endDrag(event?: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    if (event && stageEl.hasPointerCapture(event.pointerId)) {
      stageEl.releasePointerCapture(event.pointerId);
    }
  }

  function onKeydown(event: KeyboardEvent) {
    const isSceneScrollKey =
      event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End';
    if (!isSceneInteractive) {
      if (isSceneScrollKey) event.preventDefault();
      return;
    }

    void startAmbientAudio();
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollBy(viewportWidth * 0.33);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollBy(-viewportWidth * 0.33);
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

  function getInteractiveHoverAudio(asset: InteractiveSceneAsset) {
    if (asset.id === '1_chiavi') return { audio: keysHoverAudioEl, volume: 0.58 };
    if (asset.id === '1_mappa') return { audio: mapHoverAudioEl, volume: 0.52 };
    if (asset.id === '1_cio') return { audio: cioHoverAudioEl, volume: 0.55 };
    if (asset.id === '2_computerint') {
      return { audio: clickHoverAudioEl, volume: 0.5 };
    }

    return undefined;
  }

  function playInteractiveHoverSound(asset: InteractiveSceneAsset) {
    if (isAudioMuted) return;
    const cue = getInteractiveHoverAudio(asset);
    if (!cue?.audio) return;

    cue.audio.pause();
    cue.audio.currentTime = 0;
    cue.audio.volume = cue.volume;
    void cue.audio.play().catch(() => {});
  }

  function getTitleStyle() {
    const titleFontSize = Math.min(180 * sceneScale, Math.max(56, (viewportWidth - 48) / 4.55));
    const topbarGutter = viewportWidth <= 760 ? 24 : 80;
    const translateX = topbarGutter - cameraX * resolvedLayerSpeed.title;

    return [
      `left: ${scenePx(translateX)}`,
      `top: ${scenePx(viewportHeight / 2 - 132 * sceneScale)}`,
      `font-size: ${scenePx(titleFontSize)}`
    ].join(';');
  }

  function getCarloOfficePresence() {
    const enter = clamp(
      (cameraX - getCarloOfficeEnterCameraX()) / Math.max(carloOfficeEnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getCarloOfficeExitCameraX()) / Math.max(carloOfficeExitDistance, 1),
      0,
      1
    );

    const nextCueHandoff = 1 - clamp(
      (cameraX - (getCarloOffice2StartCameraX() - 90)) / 90,
      0,
      1
    );

    return clamp(ease(enter) * ease(exit) * nextCueHandoff, 0, 1);
  }

  function isCarloOfficeDialogueVisible() {
    return cameraX < getCarloOffice2StartCameraX() && getCarloOfficePresence() > 0.16;
  }

  function getCarloOffice2Presence() {
    const enter = clamp(
      (cameraX - getCarloOffice2StartCameraX()) / Math.max(carloOffice2EnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getCarloOffice2EndCameraX()) / Math.max(carloOffice2ExitDistance, 1),
      0,
      1
    );

    const nextCueHandoff = 1 - clamp(
      (cameraX - (getElisabettaOfficeStartCameraX() - 90)) / 90,
      0,
      1
    );

    return clamp(ease(enter) * ease(exit) * nextCueHandoff, 0, 1);
  }

  function isCarloOffice2DialogueVisible() {
    return cameraX < getElisabettaOfficeStartCameraX() && getCarloOffice2Presence() > 0.16;
  }

  function getElisabettaOfficePresence() {
    const enter = clamp(
      (cameraX - getElisabettaOfficeStartCameraX()) / Math.max(elisabettaOfficeEnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getElisabettaOfficeEndCameraX()) / Math.max(elisabettaOfficeExitDistance, 1),
      0,
      1
    );

    return clamp(ease(enter) * ease(exit), 0, 1);
  }

  function isElisabettaOfficeDialogueVisible() {
    return getElisabettaOfficePresence() > 0.16;
  }

  function getFaustoOfficePresence() {
    const enter = clamp(
      (cameraX - getFaustoOfficeStartCameraX()) / Math.max(faustoOfficeEnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getFaustoOfficeEndCameraX()) / Math.max(faustoOfficeExitDistance, 1),
      0,
      1
    );

    return clamp(ease(enter) * ease(exit), 0, 1);
  }

  function isFaustoOfficeDialogueVisible() {
    return getFaustoOfficePresence() > 0.16;
  }

  function getCarloOfficeBubbleWidth() {
    if (viewportWidth <= 760) return Math.min(330, Math.max(260, viewportWidth - 96));
    return 350;
  }

  function getCarloOfficeBubbleCopyHeight() {
    if (viewportWidth <= 760) return 142;
    return 172;
  }

  function getCarloOfficeBubbleMetaHeight() {
    return viewportWidth <= 760 ? 41 : 34;
  }

  function getCarloOfficeBubbleHeight() {
    return getCarloOfficeBubbleCopyHeight() + getCarloOfficeBubbleMetaHeight() - 2;
  }

  function getCarloOfficeStyle() {
    const presence = getCarloOfficePresence();
    return getOfficeTestimonialStyle({
      assetWidth: 1304,
      assetHeight: 2960,
      characterScale: viewportWidth <= 760 ? 1.1 : 1.16,
      presence
    });
  }

  function getCarloOffice2Style() {
    const presence = getCarloOffice2Presence();
    return getOfficeTestimonialStyle({
      assetWidth: 1304,
      assetHeight: 2960,
      characterScale: viewportWidth <= 760 ? 1.1 : 1.16,
      presence
    });
  }

  function getElisabettaOfficeStyle() {
    const presence = getElisabettaOfficePresence();
    return getOfficeTestimonialStyle({
      assetWidth: 1276,
      assetHeight: 2960,
      characterScale: viewportWidth <= 760 ? 1.08 : 1.14,
      presence
    });
  }

  function getFaustoOfficeStyle() {
    const presence = getFaustoOfficePresence();
    return getOfficeTestimonialStyle({
      assetWidth: 1276,
      assetHeight: 2960,
      characterScale: viewportWidth <= 760 ? 1.08 : 1.14,
      presence
    });
  }

  function getOfficeTestimonialStyle(options: {
    assetWidth: number;
    assetHeight: number;
    characterScale: number;
    presence: number;
  }) {
    const { assetWidth, assetHeight, characterScale, presence } = options;
    const kitchenMatchingWidth = Math.max(315, Math.min(370, viewportWidth * 0.245));
    const kitchenMatchingHeight = kitchenMatchingWidth * (565 / 185) * characterScale;
    const width = kitchenMatchingHeight / (assetHeight / assetWidth);
    const characterHeight = width * (assetHeight / assetWidth);
    const bubbleHeight = getCarloOfficeBubbleHeight();
    const gap = viewportWidth <= 760 ? 14 : 12;
    const characterLift = viewportWidth <= 760 ? 36 : 64;
    const topInset = (viewportWidth <= 760 ? 88 : 104) + 40;
    const characterTop = topInset + bubbleHeight + gap - characterLift;
    const bottomOffset = characterTop + characterHeight - viewportHeight;
    const entryY = (1 - presence) * Math.max(360, Math.min(520, viewportHeight * 0.54));
    const bubbleWidth = getCarloOfficeBubbleWidth();
    const bubbleLeft = viewportWidth <= 760 ? 24 : 80;
    const characterLeft = bubbleLeft + bubbleWidth / 2 - width / 2;
    const bubbleOffsetX = 0;
    const arrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);

    return [
      `left: ${scenePx(characterLeft)}`,
      `bottom: ${scenePx(-bottomOffset)}`,
      `width: ${scenePx(width)}`,
      `--chef-entry-y: ${scenePx(entryY)}`,
      `--chef-entry-opacity: ${presence.toFixed(3)}`,
      `--speech-bubble-width: ${scenePx(bubbleWidth)}`,
      `--speech-bubble-copy-height: ${scenePx(getCarloOfficeBubbleCopyHeight())}`,
      `--speech-bubble-meta-height: ${scenePx(getCarloOfficeBubbleMetaHeight())}`,
      `--speech-bubble-offset-x: ${scenePx(bubbleOffsetX)}`,
      `--speech-bubble-arrow-left: ${scenePx(arrowLeft)}`,
      `--speech-bubble-top: ${scenePx(topInset - characterTop)}`
    ].join(';');
  }

  function getCarloOfficeSpeechPageCharacters() {
    const isMobile = viewportWidth <= 760;
    const bubbleWidth = getCarloOfficeBubbleWidth();
    const fontSize = isMobile ? 13 : 15;
    const horizontalPadding = isMobile ? 36 : 40;
    const verticalPadding = isMobile ? 36 : 34;
    const pageControlsHeight = 34;
    const copyHeight = getCarloOfficeBubbleCopyHeight();
    const lineHeight = fontSize * 1.34;
    const textHeight = copyHeight - verticalPadding - pageControlsHeight - 8;
    const lines = Math.max(3, Math.floor(textHeight / lineHeight));
    const charactersPerLine = Math.max(18, Math.floor((bubbleWidth - horizontalPadding) / (fontSize * 0.56)));

    return Math.max(88, Math.floor(charactersPerLine * lines * 0.82));
  }

  function getCarloOfficeSpeechPages() {
    return getOfficeSpeechPages(carloOfficeSpeech);
  }

  function getCarloOffice2SpeechPages() {
    return getOfficeSpeechPages(carloOffice2Speech);
  }

  function getElisabettaOfficeSpeechPages() {
    return getOfficeSpeechPages(elisabettaOfficeSpeech);
  }

  function getFaustoOfficeSpeechPages() {
    return getOfficeSpeechPages(faustoOfficeSpeech);
  }

  function getOfficeSpeechPages(speech: string) {
    const pageCharacters = getCarloOfficeSpeechPageCharacters();
    const words = speech.trim().split(/\s+/).filter(Boolean);
    const pages: string[] = [];
    let page = '';

    words.forEach((word) => {
      if (!page) {
        page = word;
        return;
      }

      const candidate = `${page} ${word}`;
      if (candidate.length <= pageCharacters) {
        page = candidate;
        return;
      }

      pages.push(page);
      page = word;
    });

    if (page) pages.push(page);
    return pages.length ? pages : [''];
  }

  function getPageStartCharacterIndex(pages: string[], pageIndex: number) {
    if (pageIndex <= 0) return 0;
    return pages.slice(0, pageIndex).join(' ').length + 1;
  }

  function getPageIndexForCharacterOffset(pages: string[], characterOffset: number) {
    let pageStart = 0;

    for (let index = 0; index < pages.length; index += 1) {
      const pageEnd = pageStart + pages[index].length;
      if (characterOffset <= pageEnd || index === pages.length - 1) return index;
      pageStart = pageEnd + 1;
    }

    return 0;
  }

  function getAudioDuration(audio: HTMLAudioElement | undefined, fallbackDuration: number) {
    return audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration;
  }

  function getPageStartProgress(pages: string[], pageIndex: number) {
    const normalizedSpeech = pages.join(' ');
    const pageStart = getPageStartCharacterIndex(pages, pageIndex);
    return clamp(pageStart / Math.max(normalizedSpeech.length, 1), 0, 0.98);
  }

  function getOfficeResumeProgress(
    pages: string[],
    revealProgress: number,
    mutedPageIndex: number,
    forceMutedPage = false
  ) {
    if (!isAudioMuted && !forceMutedPage) return clamp(revealProgress, 0, 0.98);

    const visiblePageIndex = clamp(mutedPageIndex, 0, Math.max(pages.length - 1, 0));
    return getPageStartProgress(pages, visiblePageIndex);
  }

  function getCarloOfficeVisiblePageIndex() {
    return getOfficeVisiblePageIndex(
      getCarloOfficeSpeechPages(),
      carloOfficeRevealProgress,
      carloOfficeMutedPageIndex
    );
  }

  function getCarloOffice2VisiblePageIndex() {
    return getOfficeVisiblePageIndex(
      getCarloOffice2SpeechPages(),
      carloOffice2RevealProgress,
      carloOffice2MutedPageIndex
    );
  }

  function getElisabettaOfficeVisiblePageIndex() {
    return getOfficeVisiblePageIndex(
      getElisabettaOfficeSpeechPages(),
      elisabettaOfficeRevealProgress,
      elisabettaOfficeMutedPageIndex
    );
  }

  function getFaustoOfficeVisiblePageIndex() {
    return getOfficeVisiblePageIndex(
      getFaustoOfficeSpeechPages(),
      faustoOfficeRevealProgress,
      faustoOfficeMutedPageIndex
    );
  }

  function getOfficeVisiblePageIndex(pages: string[], revealProgress: number, mutedPageIndex: number) {
    if (isAudioMuted) return clamp(mutedPageIndex, 0, Math.max(pages.length - 1, 0));

    const normalizedSpeech = pages.join(' ');
    return getPageIndexForCharacterOffset(pages, normalizedSpeech.length * revealProgress);
  }

  function setCarloOfficePage(pageIndex: number) {
    const pages = getCarloOfficeSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !carloOfficeAudioEl) {
      carloOfficeMutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    carloOfficeRevealProgress = progress;
    carloOfficeAudioEl.currentTime = progress * getAudioDuration(carloOfficeAudioEl, carloOfficeRevealDurationSeconds);
  }

  function setCarloOffice2Page(pageIndex: number) {
    const pages = getCarloOffice2SpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !carloOffice2AudioEl) {
      carloOffice2MutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    carloOffice2RevealProgress = progress;
    carloOffice2AudioEl.currentTime =
      progress * getAudioDuration(carloOffice2AudioEl, carloOffice2RevealDurationSeconds);
  }

  function setElisabettaOfficePage(pageIndex: number) {
    const pages = getElisabettaOfficeSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !elisabettaOfficeAudioEl) {
      elisabettaOfficeMutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    elisabettaOfficeRevealProgress = progress;
    elisabettaOfficeAudioEl.currentTime =
      progress * getAudioDuration(elisabettaOfficeAudioEl, elisabettaOfficeRevealDurationSeconds);
  }

  function setFaustoOfficePage(pageIndex: number) {
    const pages = getFaustoOfficeSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !faustoOfficeAudioEl) {
      faustoOfficeMutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    faustoOfficeRevealProgress = progress;
    faustoOfficeAudioEl.currentTime = progress * getAudioDuration(faustoOfficeAudioEl, faustoOfficeRevealDurationSeconds);
  }

  function advanceCarloOfficePage(event: Event) {
    event.stopPropagation();
    setCarloOfficePage(getCarloOfficeVisiblePageIndex() + 1);
  }

  function rewindCarloOfficePage(event: Event) {
    event.stopPropagation();
    setCarloOfficePage(getCarloOfficeVisiblePageIndex() - 1);
  }

  function advanceCarloOffice2Page(event: Event) {
    event.stopPropagation();
    setCarloOffice2Page(getCarloOffice2VisiblePageIndex() + 1);
  }

  function rewindCarloOffice2Page(event: Event) {
    event.stopPropagation();
    setCarloOffice2Page(getCarloOffice2VisiblePageIndex() - 1);
  }

  function advanceElisabettaOfficePage(event: Event) {
    event.stopPropagation();
    setElisabettaOfficePage(getElisabettaOfficeVisiblePageIndex() + 1);
  }

  function rewindElisabettaOfficePage(event: Event) {
    event.stopPropagation();
    setElisabettaOfficePage(getElisabettaOfficeVisiblePageIndex() - 1);
  }

  function advanceFaustoOfficePage(event: Event) {
    event.stopPropagation();
    setFaustoOfficePage(getFaustoOfficeVisiblePageIndex() + 1);
  }

  function rewindFaustoOfficePage(event: Event) {
    event.stopPropagation();
    setFaustoOfficePage(getFaustoOfficeVisiblePageIndex() - 1);
  }

  function getCarloOfficeCurrentSpeechPageInfo() {
    return getOfficeCurrentSpeechPageInfo(
      getCarloOfficeSpeechPages(),
      getCarloOfficeVisiblePageIndex(),
      carloOfficeRevealProgress
    );
  }

  function getCarloOffice2CurrentSpeechPageInfo() {
    return getOfficeCurrentSpeechPageInfo(
      getCarloOffice2SpeechPages(),
      getCarloOffice2VisiblePageIndex(),
      carloOffice2RevealProgress
    );
  }

  function getElisabettaOfficeCurrentSpeechPageInfo() {
    return getOfficeCurrentSpeechPageInfo(
      getElisabettaOfficeSpeechPages(),
      getElisabettaOfficeVisiblePageIndex(),
      elisabettaOfficeRevealProgress
    );
  }

  function getFaustoOfficeCurrentSpeechPageInfo() {
    return getOfficeCurrentSpeechPageInfo(
      getFaustoOfficeSpeechPages(),
      getFaustoOfficeVisiblePageIndex(),
      faustoOfficeRevealProgress
    );
  }

  function getOfficeCurrentSpeechPageInfo(
    pages: string[],
    visiblePageIndex: number,
    revealProgress: number
  ) {
    if (isAudioMuted) {
      const speech = pages[visiblePageIndex] ?? '';
      return { highlightedSpeech: speech, speech };
    }

    const normalizedSpeech = pages.join(' ');
    const spokenLength = Math.ceil(normalizedSpeech.length * revealProgress);
    let pageStart = 0;

    for (const page of pages) {
      const pageEnd = pageStart + page.length;
      if (spokenLength <= pageEnd || page === pages[pages.length - 1]) {
        return {
          highlightedSpeech: page.slice(0, clamp(spokenLength - pageStart, 0, page.length)),
          speech: page
        };
      }

      pageStart = pageEnd + 1;
    }

    return { highlightedSpeech: '', speech: pages[visiblePageIndex] ?? '' };
  }

  function getCarloOfficePendingSpeech() {
    const { highlightedSpeech, speech } = getCarloOfficeCurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function getCarloOffice2PendingSpeech() {
    const { highlightedSpeech, speech } = getCarloOffice2CurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function getElisabettaOfficePendingSpeech() {
    const { highlightedSpeech, speech } = getElisabettaOfficeCurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function getFaustoOfficePendingSpeech() {
    const { highlightedSpeech, speech } = getFaustoOfficeCurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function syncCarloOfficeSpeechReveal() {
    if (!carloOfficeAudioEl) return;
    const duration = Number.isFinite(carloOfficeAudioEl.duration)
      ? carloOfficeAudioEl.duration
      : carloOfficeRevealDurationSeconds;
    const revealDuration = Math.max(duration || carloOfficeRevealDurationSeconds, 0.001);

    carloOfficeRevealProgress = clamp(carloOfficeAudioEl.currentTime / revealDuration, 0, 1);
    const pages = getCarloOfficeSpeechPages();
    const normalizedSpeech = pages.join(' ');
    carloOfficeMutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      carloOfficeRevealProgress * normalizedSpeech.length
    );
  }

  function syncCarloOffice2SpeechReveal() {
    if (!carloOffice2AudioEl) return;
    const duration = Number.isFinite(carloOffice2AudioEl.duration)
      ? carloOffice2AudioEl.duration
      : carloOffice2RevealDurationSeconds;
    const revealDuration = Math.max(duration || carloOffice2RevealDurationSeconds, 0.001);

    carloOffice2RevealProgress = clamp(carloOffice2AudioEl.currentTime / revealDuration, 0, 1);
    const pages = getCarloOffice2SpeechPages();
    const normalizedSpeech = pages.join(' ');
    carloOffice2MutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      carloOffice2RevealProgress * normalizedSpeech.length
    );
  }

  function syncElisabettaOfficeSpeechReveal() {
    if (!elisabettaOfficeAudioEl) return;
    const duration = Number.isFinite(elisabettaOfficeAudioEl.duration)
      ? elisabettaOfficeAudioEl.duration
      : elisabettaOfficeRevealDurationSeconds;
    const revealDuration = Math.max(duration || elisabettaOfficeRevealDurationSeconds, 0.001);

    elisabettaOfficeRevealProgress = clamp(elisabettaOfficeAudioEl.currentTime / revealDuration, 0, 1);
    const pages = getElisabettaOfficeSpeechPages();
    const normalizedSpeech = pages.join(' ');
    elisabettaOfficeMutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      elisabettaOfficeRevealProgress * normalizedSpeech.length
    );
  }


  function syncFaustoOfficeSpeechReveal() {
    if (!faustoOfficeAudioEl) return;
    const duration = Number.isFinite(faustoOfficeAudioEl.duration)
      ? faustoOfficeAudioEl.duration
      : faustoOfficeRevealDurationSeconds;
    const revealDuration = Math.max(duration || faustoOfficeRevealDurationSeconds, 0.001);

    faustoOfficeRevealProgress = clamp(faustoOfficeAudioEl.currentTime / revealDuration, 0, 1);
    const pages = getFaustoOfficeSpeechPages();
    const normalizedSpeech = pages.join(' ');
    faustoOfficeMutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      faustoOfficeRevealProgress * normalizedSpeech.length
    );
  }

  function fadeCarloOfficeAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!carloOfficeAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (carloOfficeFadeFrame) cancelAnimationFrame(carloOfficeFadeFrame);
    carloOfficeFadeFrame = undefined;

    if (duration <= 0) {
      carloOfficeAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(carloOfficeAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!carloOfficeAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      carloOfficeAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        carloOfficeFadeFrame = requestAnimationFrame(step);
        return;
      }

      carloOfficeAudioEl.volume = targetVolume;
      carloOfficeFadeFrame = undefined;
      onComplete?.();
    };

    carloOfficeFadeFrame = requestAnimationFrame(step);
  }

  function fadeCarloOffice2AudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!carloOffice2AudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (carloOffice2FadeFrame) cancelAnimationFrame(carloOffice2FadeFrame);
    carloOffice2FadeFrame = undefined;

    if (duration <= 0) {
      carloOffice2AudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(carloOffice2AudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!carloOffice2AudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      carloOffice2AudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        carloOffice2FadeFrame = requestAnimationFrame(step);
        return;
      }

      carloOffice2AudioEl.volume = targetVolume;
      carloOffice2FadeFrame = undefined;
      onComplete?.();
    };

    carloOffice2FadeFrame = requestAnimationFrame(step);
  }

  function fadeElisabettaOfficeAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!elisabettaOfficeAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (elisabettaOfficeFadeFrame) cancelAnimationFrame(elisabettaOfficeFadeFrame);
    elisabettaOfficeFadeFrame = undefined;

    if (duration <= 0) {
      elisabettaOfficeAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(elisabettaOfficeAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!elisabettaOfficeAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      elisabettaOfficeAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        elisabettaOfficeFadeFrame = requestAnimationFrame(step);
        return;
      }

      elisabettaOfficeAudioEl.volume = targetVolume;
      elisabettaOfficeFadeFrame = undefined;
      onComplete?.();
    };

    elisabettaOfficeFadeFrame = requestAnimationFrame(step);
  }

  function fadeFaustoOfficeAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!faustoOfficeAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (faustoOfficeFadeFrame) cancelAnimationFrame(faustoOfficeFadeFrame);
    faustoOfficeFadeFrame = undefined;

    if (duration <= 0) {
      faustoOfficeAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(faustoOfficeAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!faustoOfficeAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      faustoOfficeAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        faustoOfficeFadeFrame = requestAnimationFrame(step);
        return;
      }

      faustoOfficeAudioEl.volume = targetVolume;
      faustoOfficeFadeFrame = undefined;
      onComplete?.();
    };

    faustoOfficeFadeFrame = requestAnimationFrame(step);
  }

  function fadeOfficeAmbientVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!officeAmbientAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (officeAmbientFadeFrame) cancelAnimationFrame(officeAmbientFadeFrame);
    officeAmbientFadeFrame = undefined;

    if (duration <= 0) {
      officeAmbientAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(officeAmbientAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!officeAmbientAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      officeAmbientAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        officeAmbientFadeFrame = requestAnimationFrame(step);
        return;
      }

      officeAmbientAudioEl.volume = targetVolume;
      officeAmbientFadeFrame = undefined;
      onComplete?.();
    };

    officeAmbientFadeFrame = requestAnimationFrame(step);
  }

  function getOfficeAmbientTargetVolume() {
    return officeAmbientVolume * (
      isCarloOfficeAudioActive ||
      isCarloOffice2AudioActive ||
      isElisabettaOfficeAudioActive ||
      isFaustoOfficeAudioActive
        ? 0.28
        : 1
    );
  }

  function setOfficeAmbientVolume(duration = 0.48) {
    if (!officeAmbientAudioEl || !isAmbientAudioStarted || isAudioMuted) return;
    fadeOfficeAmbientVolume(getOfficeAmbientTargetVolume(), duration);
  }

  async function startAmbientAudio() {
    if (!isSceneRevealed || isAudioMuted || isAmbientAudioStarted || !officeAmbientAudioEl) return;

    officeAmbientAudioEl.loop = true;
    officeAmbientAudioEl.volume = 0;

    try {
      await officeAmbientAudioEl.play();
      isAmbientAudioStarted = true;
      fadeOfficeAmbientVolume(getOfficeAmbientTargetVolume(), officeAmbientFadeInDuration);
    } catch {
      isAmbientAudioStarted = false;
    }
  }

  function stopAmbientAudio(duration = officeAmbientFadeOutDuration) {
    if (!officeAmbientAudioEl) {
      isAmbientAudioStarted = false;
      return;
    }

    fadeOfficeAmbientVolume(0, duration, () => {
      officeAmbientAudioEl.pause();
      officeAmbientAudioEl.currentTime = 0;
      isAmbientAudioStarted = false;
    });
  }

  async function startCarloOfficeAudio() {
    if (
      isAudioMuted ||
      isCarloOfficeAudioActive ||
      (hasPlayedCarloOfficeAudio && carloOfficeRevealProgress >= 0.995) ||
      isCarloOfficeAudioStarting ||
      !carloOfficeAudioEl ||
      cameraX >= getCarloOffice2StartCameraX() ||
      !isCarloOfficeDialogueVisible()
    ) {
      return;
    }

    isCarloOfficeAudioStarting = true;
    stopAllOfficeDialogueAudio({ duration: officeDialogueAudioHandoffFadeOutDuration, except: 'carlo', resetReplay: true });
    gsap?.killTweensOf(carloOfficeAudioEl);
    if (carloOfficeFadeFrame) cancelAnimationFrame(carloOfficeFadeFrame);
    carloOfficeFadeFrame = undefined;
    carloOfficeAudioEl.pause();
    carloOfficeRevealProgress = getOfficeResumeProgress(
      getCarloOfficeSpeechPages(),
      carloOfficeRevealProgress,
      carloOfficeMutedPageIndex,
      shouldResumeOfficeAudioFromMutedPage
    );
    carloOfficeAudioEl.currentTime =
      carloOfficeRevealProgress * getAudioDuration(carloOfficeAudioEl, carloOfficeRevealDurationSeconds);
    carloOfficeAudioEl.volume = 0;
    shouldResumeOfficeAudioFromMutedPage = false;

    try {
      await carloOfficeAudioEl.play();
      if (!isCarloOfficeAudioStarting || isAudioMuted || !isCarloOfficeDialogueVisible()) {
        carloOfficeAudioEl.pause();
        return;
      }
      isCarloOfficeAudioActive = true;
      fadeCarloOfficeAudioVolume(carloOfficeAudioVolume, officeDialogueAudioFadeInDuration);
      setOfficeAmbientVolume();
    } catch {
      isCarloOfficeAudioActive = false;
    } finally {
      isCarloOfficeAudioStarting = false;
    }
  }

  async function startCarloOffice2Audio() {
    if (
      isAudioMuted ||
      isCarloOffice2AudioActive ||
      (hasPlayedCarloOffice2Audio && carloOffice2RevealProgress >= 0.995) ||
      isCarloOffice2AudioStarting ||
      !carloOffice2AudioEl ||
      cameraX >= getElisabettaOfficeStartCameraX() ||
      !isCarloOffice2DialogueVisible()
    ) {
      return;
    }

    isCarloOffice2AudioStarting = true;
    stopAllOfficeDialogueAudio({ duration: officeDialogueAudioHandoffFadeOutDuration, except: 'carlo2', resetReplay: true });
    gsap?.killTweensOf(carloOffice2AudioEl);
    if (carloOffice2FadeFrame) cancelAnimationFrame(carloOffice2FadeFrame);
    carloOffice2FadeFrame = undefined;
    carloOffice2AudioEl.pause();
    carloOffice2RevealProgress = getOfficeResumeProgress(
      getCarloOffice2SpeechPages(),
      carloOffice2RevealProgress,
      carloOffice2MutedPageIndex,
      shouldResumeOfficeAudioFromMutedPage
    );
    carloOffice2AudioEl.currentTime =
      carloOffice2RevealProgress * getAudioDuration(carloOffice2AudioEl, carloOffice2RevealDurationSeconds);
    carloOffice2AudioEl.volume = 0;
    shouldResumeOfficeAudioFromMutedPage = false;

    try {
      await carloOffice2AudioEl.play();
      if (!isCarloOffice2AudioStarting || isAudioMuted || !isCarloOffice2DialogueVisible()) {
        carloOffice2AudioEl.pause();
        return;
      }
      isCarloOffice2AudioActive = true;
      fadeCarloOffice2AudioVolume(carloOffice2AudioVolume, officeDialogueAudioFadeInDuration);
      setOfficeAmbientVolume();
    } catch {
      isCarloOffice2AudioActive = false;
    } finally {
      isCarloOffice2AudioStarting = false;
    }
  }

  async function startElisabettaOfficeAudio() {
    if (
      isAudioMuted ||
      isElisabettaOfficeAudioActive ||
      (hasPlayedElisabettaOfficeAudio && elisabettaOfficeRevealProgress >= 0.995) ||
      isElisabettaOfficeAudioStarting ||
      !elisabettaOfficeAudioEl ||
      !isElisabettaOfficeDialogueVisible()
    ) {
      return;
    }

    isElisabettaOfficeAudioStarting = true;
    stopAllOfficeDialogueAudio({ duration: officeDialogueAudioHandoffFadeOutDuration, except: 'elisabetta', resetReplay: true });
    gsap?.killTweensOf(elisabettaOfficeAudioEl);
    if (elisabettaOfficeFadeFrame) cancelAnimationFrame(elisabettaOfficeFadeFrame);
    elisabettaOfficeFadeFrame = undefined;
    elisabettaOfficeAudioEl.pause();
    elisabettaOfficeRevealProgress = getOfficeResumeProgress(
      getElisabettaOfficeSpeechPages(),
      elisabettaOfficeRevealProgress,
      elisabettaOfficeMutedPageIndex,
      shouldResumeOfficeAudioFromMutedPage
    );
    elisabettaOfficeAudioEl.currentTime =
      elisabettaOfficeRevealProgress *
      getAudioDuration(elisabettaOfficeAudioEl, elisabettaOfficeRevealDurationSeconds);
    elisabettaOfficeAudioEl.volume = 0;
    shouldResumeOfficeAudioFromMutedPage = false;

    try {
      await elisabettaOfficeAudioEl.play();
      if (!isElisabettaOfficeAudioStarting || isAudioMuted || !isElisabettaOfficeDialogueVisible()) {
        elisabettaOfficeAudioEl.pause();
        return;
      }
      isElisabettaOfficeAudioActive = true;
      fadeElisabettaOfficeAudioVolume(elisabettaOfficeAudioVolume, officeDialogueAudioFadeInDuration);
      setOfficeAmbientVolume();
    } catch {
      isElisabettaOfficeAudioActive = false;
    } finally {
      isElisabettaOfficeAudioStarting = false;
    }
  }

  async function startFaustoOfficeAudio() {
    if (
      isAudioMuted ||
      isFaustoOfficeAudioActive ||
      (hasPlayedFaustoOfficeAudio && faustoOfficeRevealProgress >= 0.995) ||
      isFaustoOfficeAudioStarting ||
      !faustoOfficeAudioEl ||
      !isFaustoOfficeDialogueVisible()
    ) {
      return;
    }

    isFaustoOfficeAudioStarting = true;
    stopAllOfficeDialogueAudio({ duration: officeDialogueAudioHandoffFadeOutDuration, except: 'fausto', resetReplay: true });
    gsap?.killTweensOf(faustoOfficeAudioEl);
    if (faustoOfficeFadeFrame) cancelAnimationFrame(faustoOfficeFadeFrame);
    faustoOfficeFadeFrame = undefined;
    faustoOfficeAudioEl.pause();
    faustoOfficeRevealProgress = getOfficeResumeProgress(
      getFaustoOfficeSpeechPages(),
      faustoOfficeRevealProgress,
      faustoOfficeMutedPageIndex,
      shouldResumeOfficeAudioFromMutedPage
    );
    faustoOfficeAudioEl.currentTime =
      faustoOfficeRevealProgress * getAudioDuration(faustoOfficeAudioEl, faustoOfficeRevealDurationSeconds);
    faustoOfficeAudioEl.volume = 0;
    shouldResumeOfficeAudioFromMutedPage = false;

    try {
      await faustoOfficeAudioEl.play();
      if (!isFaustoOfficeAudioStarting || isAudioMuted || !isFaustoOfficeDialogueVisible()) {
        faustoOfficeAudioEl.pause();
        return;
      }
      isFaustoOfficeAudioActive = true;
      fadeFaustoOfficeAudioVolume(faustoOfficeAudioVolume, officeDialogueAudioFadeInDuration);
      setOfficeAmbientVolume();
    } catch {
      isFaustoOfficeAudioActive = false;
    } finally {
      isFaustoOfficeAudioStarting = false;
    }
  }

  function stopCarloOfficeAudio(duration = carloOfficeAudioFadeOutDuration, resetReplay = false) {
    if (!carloOfficeAudioEl) {
      isCarloOfficeAudioActive = false;
      isCarloOfficeAudioStarting = false;
      return;
    }

    isCarloOfficeAudioStarting = false;
    syncCarloOfficeSpeechReveal();
    if (resetReplay) hasPlayedCarloOfficeAudio = false;
    if (carloOfficeAudioEl.paused || duration <= 0) {
      carloOfficeAudioEl.pause();
      isCarloOfficeAudioActive = false;
      setOfficeAmbientVolume();
      return;
    }

    fadeCarloOfficeAudioVolume(0, duration, () => {
      carloOfficeAudioEl.pause();
      carloOfficeAudioEl.volume = carloOfficeAudioVolume;
      isCarloOfficeAudioActive = false;
      setOfficeAmbientVolume();
    });
  }

  function stopCarloOffice2Audio(duration = carloOffice2AudioFadeOutDuration, resetReplay = false) {
    if (!carloOffice2AudioEl) {
      isCarloOffice2AudioActive = false;
      isCarloOffice2AudioStarting = false;
      return;
    }

    isCarloOffice2AudioStarting = false;
    syncCarloOffice2SpeechReveal();
    if (resetReplay) hasPlayedCarloOffice2Audio = false;
    if (carloOffice2AudioEl.paused || duration <= 0) {
      carloOffice2AudioEl.pause();
      isCarloOffice2AudioActive = false;
      setOfficeAmbientVolume();
      return;
    }

    fadeCarloOffice2AudioVolume(0, duration, () => {
      carloOffice2AudioEl.pause();
      carloOffice2AudioEl.volume = carloOffice2AudioVolume;
      isCarloOffice2AudioActive = false;
      setOfficeAmbientVolume();
    });
  }

  function stopElisabettaOfficeAudio(duration = elisabettaOfficeAudioFadeOutDuration, resetReplay = false) {
    if (!elisabettaOfficeAudioEl) {
      isElisabettaOfficeAudioActive = false;
      isElisabettaOfficeAudioStarting = false;
      return;
    }

    isElisabettaOfficeAudioStarting = false;
    syncElisabettaOfficeSpeechReveal();
    if (resetReplay) hasPlayedElisabettaOfficeAudio = false;
    if (elisabettaOfficeAudioEl.paused || duration <= 0) {
      elisabettaOfficeAudioEl.pause();
      isElisabettaOfficeAudioActive = false;
      setOfficeAmbientVolume();
      return;
    }

    fadeElisabettaOfficeAudioVolume(0, duration, () => {
      elisabettaOfficeAudioEl.pause();
      elisabettaOfficeAudioEl.volume = elisabettaOfficeAudioVolume;
      isElisabettaOfficeAudioActive = false;
      setOfficeAmbientVolume();
    });
  }

  function stopFaustoOfficeAudio(duration = faustoOfficeAudioFadeOutDuration, resetReplay = false) {
    if (!faustoOfficeAudioEl) {
      isFaustoOfficeAudioActive = false;
      isFaustoOfficeAudioStarting = false;
      return;
    }

    isFaustoOfficeAudioStarting = false;
    syncFaustoOfficeSpeechReveal();
    if (resetReplay) hasPlayedFaustoOfficeAudio = false;
    if (faustoOfficeAudioEl.paused || duration <= 0) {
      faustoOfficeAudioEl.pause();
      isFaustoOfficeAudioActive = false;
      setOfficeAmbientVolume();
      return;
    }

    fadeFaustoOfficeAudioVolume(0, duration, () => {
      faustoOfficeAudioEl.pause();
      faustoOfficeAudioEl.volume = faustoOfficeAudioVolume;
      isFaustoOfficeAudioActive = false;
      setOfficeAmbientVolume();
    });
  }

  function stopAllOfficeDialogueAudio(
    options: {
      duration?: number;
      except?: 'carlo' | 'carlo2' | 'elisabetta' | 'fausto';
      resetReplay?: boolean;
    } = {}
  ) {
    const duration = options.duration ?? 0.18;
    const resetReplay = options.resetReplay ?? true;

    if (options.except !== 'carlo') stopCarloOfficeAudio(duration, resetReplay);
    if (options.except !== 'carlo2') stopCarloOffice2Audio(duration, resetReplay);
    if (options.except !== 'elisabetta') stopElisabettaOfficeAudio(duration, resetReplay);
    if (options.except !== 'fausto') stopFaustoOfficeAudio(duration, resetReplay);
  }

  $effect(() => {
    if (isAudioMuted) {
      shouldResumeOfficeAudioFromMutedPage = true;
      stopAmbientAudio();
      stopAllOfficeDialogueAudio({ duration: officeDialogueAudioHandoffFadeOutDuration, resetReplay: true });
      return;
    }

    if (!isSceneRevealed) return;

    void startAmbientAudio();
    const hasVisibleDialogue =
      isCarloOfficeDialogueVisible() ||
      isCarloOffice2DialogueVisible() ||
      isElisabettaOfficeDialogueVisible() ||
      isFaustoOfficeDialogueVisible();
    if (!hasVisibleDialogue) shouldResumeOfficeAudioFromMutedPage = false;
  });

  $effect(() => {
    const visible = isCarloOfficeDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startCarloOfficeAudio();
      return;
    }

    if (!visible) {
      hasPlayedCarloOfficeAudio = false;
    }

    if (!visible && (isCarloOfficeAudioActive || isCarloOfficeAudioStarting)) {
      stopCarloOfficeAudio(carloOfficeAudioFadeOutDuration, true);
    }

    if (cameraX < getCarloOfficeEnterCameraX() - carloOfficeEnterDistance) {
      hasPlayedCarloOfficeAudio = false;
    }
  });

  $effect(() => {
    const visible = isCarloOffice2DialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startCarloOffice2Audio();
      return;
    }

    if (!visible) {
      hasPlayedCarloOffice2Audio = false;
    }

    if (!visible && (isCarloOffice2AudioActive || isCarloOffice2AudioStarting)) {
      stopCarloOffice2Audio(carloOffice2AudioFadeOutDuration, true);
    }

    if (cameraX < getCarloOffice2StartCameraX() - carloOffice2EnterDistance) {
      hasPlayedCarloOffice2Audio = false;
    }
  });

  $effect(() => {
    const visible = isElisabettaOfficeDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startElisabettaOfficeAudio();
      return;
    }

    if (!visible) {
      hasPlayedElisabettaOfficeAudio = false;
    }

    if (!visible && (isElisabettaOfficeAudioActive || isElisabettaOfficeAudioStarting)) {
      stopElisabettaOfficeAudio(elisabettaOfficeAudioFadeOutDuration, true);
    }

    if (cameraX < getElisabettaOfficeStartCameraX() - elisabettaOfficeEnterDistance) {
      hasPlayedElisabettaOfficeAudio = false;
    }
  });

  $effect(() => {
    const visible = isFaustoOfficeDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startFaustoOfficeAudio();
      return;
    }

    if (!visible) {
      hasPlayedFaustoOfficeAudio = false;
    }

    if (!visible && (isFaustoOfficeAudioActive || isFaustoOfficeAudioStarting)) {
      stopFaustoOfficeAudio(faustoOfficeAudioFadeOutDuration, true);
    }

    if (cameraX < getFaustoOfficeStartCameraX() - faustoOfficeEnterDistance) {
      hasPlayedFaustoOfficeAudio = false;
    }
  });

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
    stageEl.addEventListener('click', triggerTapClickFeedback, true);
    stageEl.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    stageEl.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    stageEl.addEventListener('touchend', onTouchEnd, true);
    stageEl.addEventListener('touchcancel', onTouchEnd, true);
    void import('$lib/scene/phaser/ParallaxPhaserGame').then(({ createParallaxPhaserGame }) => {
      if (destroyed || !officePhaserContainerEl) return;

      createParallaxPhaserGame({
        assetVersion,
        assets: officePhaserAssets,
        chunks: officeBackgroundChunks,
        chunkOffsetY: officeBackgroundOffsetY,
        container: officePhaserContainerEl,
        getChunkPath: officeChunkPath,
        getViewport: () => ({
          width: Math.max(1, viewportWidth || stageEl?.clientWidth || 1),
          height: Math.max(1, viewportHeight || stageEl?.clientHeight || 1)
        }),
        layerSpeed,
        onLoadingProgress: (progress) => {
          phaserLoadingProgress = progress;
        },
        onReady: () => {
          phaserLoadingProgress = 1;
          isPhaserReady = true;
        },
        sceneHeight,
        sceneWidth
      }).then((game) => {
        if (destroyed) {
          game?.destroy();
          return;
        }

        officePhaserGame = game;
        officePhaserGame?.setCameraX(cameraX);
        scheduleOfficePhaserResize();
      }).catch((error) => {
        console.error('Office scene failed to start Phaser', error);
        if (destroyed) return;
        phaserLoadingProgress = 1;
        isPhaserReady = true;
      });
    }).catch((error) => {
      console.error('Office scene failed to load Phaser module', error);
      if (destroyed) return;
      phaserLoadingProgress = 1;
      isPhaserReady = true;
    });
    void loadGsapWithScrollTrigger().then(({ gsap: loadedGsap, ScrollTrigger }) => {
      if (destroyed) return;
      gsap = loadedGsap;

      scrollTrigger = ScrollTrigger.create({
        anticipatePin: 1,
        end: () => `+=${Math.max(maxScrollX, window.innerHeight * 0.85, 1)}`,
        id: 'office-horizontal-scroll',
        invalidateOnRefresh: true,
        onRefresh: (self) => {
          if (!isSceneInteractive) {
            targetCameraX = 0;
            cameraX = 0;
            officePhaserGame?.setCameraX(0);
            if (self.scroll() !== self.start) self.scroll(self.start);
            return;
          }
          setTargetCameraX(self.progress * maxScrollX, { bypassResistance: true });
        },
        onUpdate: (self) => {
          if (!isSceneInteractive) {
            targetCameraX = 0;
            cameraX = 0;
            officePhaserGame?.setCameraX(0);
            if (self.scroll() !== self.start) self.scroll(self.start);
            return;
          }
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

      loadedGsap.ticker.add(tick);
      removeTicker = () => loadedGsap.ticker.remove(tick);
      ScrollTrigger.refresh();
    }).catch((error) => {
      console.error('Office scene failed to start scroll controller', error);
    });
    requestAnimationFrame(() => {
      isSceneLoaded = true;
    });

    return () => {
      destroyed = true;
      if (sceneRevealTimer) window.clearTimeout(sceneRevealTimer);
      reducedMotionQuery.removeEventListener('change', syncReducedMotion);
      window.removeEventListener('keydown', onKeydown);
      stageEl?.removeEventListener('click', triggerTapClickFeedback, true);
      stageEl?.removeEventListener('touchstart', onTouchStart, true);
      stageEl?.removeEventListener('touchmove', onTouchMove, true);
      stageEl?.removeEventListener('touchend', onTouchEnd, true);
      stageEl?.removeEventListener('touchcancel', onTouchEnd, true);
      stopResize();
      removeTicker();
      scrollTrigger?.kill();
      scrollTrigger = undefined;
      gsap?.killTweensOf(officeAmbientAudioEl);
      gsap?.killTweensOf(carloOfficeAudioEl);
      gsap?.killTweensOf(carloOffice2AudioEl);
      gsap?.killTweensOf(elisabettaOfficeAudioEl);
      gsap?.killTweensOf(faustoOfficeAudioEl);
      if (officeAmbientFadeFrame) cancelAnimationFrame(officeAmbientFadeFrame);
      if (carloOfficeFadeFrame) cancelAnimationFrame(carloOfficeFadeFrame);
      if (carloOffice2FadeFrame) cancelAnimationFrame(carloOffice2FadeFrame);
      if (elisabettaOfficeFadeFrame) cancelAnimationFrame(elisabettaOfficeFadeFrame);
      if (faustoOfficeFadeFrame) cancelAnimationFrame(faustoOfficeFadeFrame);
      if (officePhaserResizeTimer) window.clearTimeout(officePhaserResizeTimer);
      officePhaserGame?.destroy();
      officePhaserGame = undefined;
      officePhaserResizeTimer = undefined;
      officeAmbientFadeFrame = undefined;
      carloOfficeFadeFrame = undefined;
      carloOffice2FadeFrame = undefined;
      elisabettaOfficeFadeFrame = undefined;
      faustoOfficeFadeFrame = undefined;
      officeAmbientAudioEl?.pause();
      carloOfficeAudioEl?.pause();
      carloOffice2AudioEl?.pause();
      elisabettaOfficeAudioEl?.pause();
      faustoOfficeAudioEl?.pause();
      isAmbientAudioStarted = false;
      isCarloOfficeAudioActive = false;
      isCarloOffice2AudioActive = false;
      isElisabettaOfficeAudioActive = false;
      isFaustoOfficeAudioActive = false;
    };
  });

  $effect(() => {
    if (isSceneLoaded && isPhaserReady) {
      if (!isSceneRevealed && !sceneRevealTimer) {
        sceneRevealTimer = window.setTimeout(() => {
          isSceneRevealed = true;
          sceneRevealTimer = undefined;
        }, SCENE_REVEAL_DELAY_MS);
      }
      return;
    }

    if (sceneRevealTimer) {
      window.clearTimeout(sceneRevealTimer);
      sceneRevealTimer = undefined;
    }
    isSceneRevealed = false;
  });

  $effect(() => {
    onSceneRevealedChange?.(isSceneRevealed);
  });
</script>

<section
  bind:this={stageEl}
  class="office-stage"
  class:is-dragging={isDragging}
  class:is-loaded={isSceneRevealed}
  data-audio-muted={isAudioMuted}
  data-progress={progress.toFixed(3)}
  aria-label="Scena parallasse dell'ufficio"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerleave={onPointerLeave}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  <SceneProgressBar {progress} isVisible={isSceneRevealed} ticks={officeProgressTicks} />

  <div bind:this={officePhaserContainerEl} class="office-phaser-layer" aria-hidden="true"></div>
  {#if !isSceneRevealed}
    <SceneLoadingProgress progress={phaserLoadingProgress} />
  {/if}

  <div class="office-scroll-space" style={scrollSpaceStyle}>
    <div class="office-world" style={worldStyle}>
      {#each officeMiddleAssets as item (item.id)}
        {#if isInteractiveAsset(item)}
          <button
            class="office-asset office-middle-asset office-interactive-asset reveal-layer middle-layer"
            class:office-keys-asset={item.id === '1_chiavi'}
            class:office-cio-asset={item.id === '1_cio'}
            class:office-map-asset={item.id === '1_mappa'}
            class:office-computer-asset={item.id === '2_computerint'}
            class:is-tooltip-visible={hoveredOfficeAssetId === item.id}
            type="button"
            aria-label={item.ariaLabel}
            style={getForegroundStyle(item)}
            onpointerenter={() => playInteractiveHoverSound(item)}
            onfocus={() => playInteractiveHoverSound(item)}
            onpointerdown={(event) => event.stopPropagation()}
            onclick={(event) => event.stopPropagation()}
          >
            <img
              src={versionedAsset(item.src)}
              alt=""
              draggable="false"
            />
            {#if item.shineEffect}
              <span
                class="object-shine"
                style={`--shine-mask: url('${versionedAsset(item.src)}')`}
                aria-hidden="true"
              ></span>
            {/if}
            {#if item.id === '1_chiavi'}
              <span class="office-keys-tooltip" data-node-id="5686:9830">
                {officeKeysHoverText}
              </span>
            {/if}
            {#if item.id === '1_cio'}
              <span class="office-keys-tooltip office-cio-tooltip">
                {officeCioHoverText}
              </span>
            {/if}
            {#if item.id === '1_mappa'}
              <span class="office-keys-tooltip office-map-tooltip">
                {officeMapHoverText}
              </span>
            {/if}
            {#if item.id === '2_computerint'}
              <span class="office-keys-tooltip office-computer-tooltip">
                {officeComputerHoverText}
              </span>
            {/if}
          </button>
        {/if}
      {/each}

      {#each officeForegroundAssets as item (item.id)}
        {#if isInteractiveAsset(item)}
          <button
            class="office-asset office-foreground-asset office-interactive-asset reveal-layer foreground-layer"
            class:office-keys-asset={item.id === '1_chiavi'}
            class:office-cio-asset={item.id === '1_cio'}
            class:office-map-asset={item.id === '1_mappa'}
            class:office-computer-asset={item.id === '2_computerint'}
            class:office-easteregg-asset={item.id === 'easteregg'}
            class:is-tooltip-visible={hoveredOfficeAssetId === item.id}
            type="button"
            aria-label={item.ariaLabel}
            style={getForegroundStyle(item)}
            onpointerenter={() => playInteractiveHoverSound(item)}
            onfocus={() => playInteractiveHoverSound(item)}
            onpointerdown={(event) => event.stopPropagation()}
            onclick={(event) => event.stopPropagation()}
          >
            <img
              src={versionedAsset(item.src)}
              alt=""
              draggable="false"
            />
            {#if item.shineEffect}
              <span
                class="object-shine"
                style={`--shine-mask: url('${versionedAsset(item.src)}')`}
                aria-hidden="true"
              ></span>
            {/if}
            {#if item.id === '1_chiavi'}
              <span class="office-keys-tooltip" data-node-id="5686:9830">
                {officeKeysHoverText}
              </span>
            {/if}
            {#if item.id === '1_cio'}
              <span class="office-keys-tooltip office-cio-tooltip">
                {officeCioHoverText}
              </span>
            {/if}
            {#if item.id === '1_mappa'}
              <span class="office-keys-tooltip office-map-tooltip">
                {officeMapHoverText}
              </span>
            {/if}
            {#if item.id === '2_computerint'}
              <span class="office-keys-tooltip office-computer-tooltip">
                {officeComputerHoverText}
              </span>
            {/if}
            {#if item.id === 'easteregg'}
              <span class="office-easteregg-layout" data-node-id="5781:1538">
                <span class="office-easteregg-copy" data-node-id="5767:9845">
                  In questo sito stai osservando <strong>oltre 200 oggetti</strong> disegnati singolarmente
                </span>
              </span>
            {/if}
          </button>
        {/if}
      {/each}

      {#if isSceneRevealed}
        <h1 class="office-title" style={getTitleStyle()} aria-label="Ufficio">Ufficio</h1>
      {/if}

      <div
        class="office-chef-button"
        class:is-dialogue-visible={isCarloOfficeDialogueVisible()}
        data-testimonial="carlo"
        style={`${getCarloOfficeStyle()}; --reveal-delay: 390ms;`}
        role="button"
        tabindex="0"
        aria-label="Testimonianza Carlo Zarri ufficio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedCarloOfficeAudio = false;
          void startCarloOfficeAudio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedCarloOfficeAudio = false;
          void startCarloOfficeAudio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isCarloOfficeDialogueVisible()}>
          <span
            class="speech-bubble-copy has-page-controls"
            aria-label={carloOfficeSpeechInfo.speech}
          >
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{carloOfficeSpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getCarloOfficePendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{carloOfficeSpeechInfo.speech}</span>
            {/if}
            {#if carloOfficeSpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${carloOfficeVisiblePageIndex + 1} di ${carloOfficeSpeechPageCount} per Carlo Zarri`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Carlo Zarri"
                  disabled={carloOfficeVisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindCarloOfficePage}
                >
                  <svg
                    class="speech-bubble-page-icon"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {carloOfficeVisiblePageIndex + 1}/{carloOfficeSpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Carlo Zarri"
                  disabled={carloOfficeVisiblePageIndex >= carloOfficeSpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceCarloOfficePage}
                >
                  <svg
                    class="speech-bubble-page-icon"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Chief Executive Chef - Carlo Zarri">
            <span class="speech-bubble-meta-label">
              <span>Chief Executive Chef - </span>
              <strong>Carlo Zarri</strong>
            </span>
          </span>
        </span>
        <img
          class="scene-chef-image"
          src="/assets/interviews/hover/zarri.png"
          alt="Carlo Zarri"
          draggable="false"
        />
      </div>

      <div
        class="office-chef-button"
        class:is-dialogue-visible={isCarloOffice2DialogueVisible()}
        data-testimonial="carlo-2"
        style={`${getCarloOffice2Style()}; --reveal-delay: 410ms;`}
        role="button"
        tabindex="0"
        aria-label="Seconda testimonianza Carlo Zarri ufficio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedCarloOffice2Audio = false;
          void startCarloOffice2Audio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedCarloOffice2Audio = false;
          void startCarloOffice2Audio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isCarloOffice2DialogueVisible()}>
          <span
            class="speech-bubble-copy has-page-controls"
            aria-label={carloOffice2SpeechInfo.speech}
          >
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{carloOffice2SpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getCarloOffice2PendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{carloOffice2SpeechInfo.speech}</span>
            {/if}
            {#if carloOffice2SpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${carloOffice2VisiblePageIndex + 1} di ${carloOffice2SpeechPageCount} per Carlo Zarri`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Carlo Zarri"
                  disabled={carloOffice2VisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindCarloOffice2Page}
                >
                  <svg
                    class="speech-bubble-page-icon"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {carloOffice2VisiblePageIndex + 1}/{carloOffice2SpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Carlo Zarri"
                  disabled={carloOffice2VisiblePageIndex >= carloOffice2SpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceCarloOffice2Page}
                >
                  <svg
                    class="speech-bubble-page-icon"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Chief Executive Chef - Carlo Zarri">
            <span class="speech-bubble-meta-label">
              <span>Chief Executive Chef - </span>
              <strong>Carlo Zarri</strong>
            </span>
          </span>
        </span>
        <img
          class="scene-chef-image"
          src="/assets/interviews/hover/zarri.png"
          alt="Carlo Zarri"
          draggable="false"
        />
      </div>

      <div
        class="office-chef-button"
        class:is-dialogue-visible={isElisabettaOfficeDialogueVisible()}
        data-testimonial="elisabetta"
        style={`${getElisabettaOfficeStyle()}; --reveal-delay: 420ms;`}
        role="button"
        tabindex="0"
        aria-label="Testimonianza Elisabetta Salvadori ufficio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedElisabettaOfficeAudio = false;
          void startElisabettaOfficeAudio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedElisabettaOfficeAudio = false;
          void startElisabettaOfficeAudio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isElisabettaOfficeDialogueVisible()}>
          <span
            class="speech-bubble-copy has-page-controls"
            aria-label={elisabettaOfficeSpeechInfo.speech}
          >
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{elisabettaOfficeSpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getElisabettaOfficePendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{elisabettaOfficeSpeechInfo.speech}</span>
            {/if}
            {#if elisabettaOfficeSpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${elisabettaOfficeVisiblePageIndex + 1} di ${elisabettaOfficeSpeechPageCount} per Elisabetta Salvadori`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Elisabetta Salvadori"
                  disabled={elisabettaOfficeVisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindElisabettaOfficePage}
                >
                  <svg
                    class="speech-bubble-page-icon"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {elisabettaOfficeVisiblePageIndex + 1}/{elisabettaOfficeSpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Elisabetta Salvadori"
                  disabled={elisabettaOfficeVisiblePageIndex >= elisabettaOfficeSpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceElisabettaOfficePage}
                >
                  <svg
                    class="speech-bubble-page-icon"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Head Food and Beverage - Elisabetta Salvadori">
            <span class="speech-bubble-meta-label">
              <span>Head Food and Beverage - </span>
              <strong>Elisabetta Salvadori</strong>
            </span>
          </span>
        </span>
        <img
          class="scene-chef-image"
          src="/assets/interviews/hover/eli.png"
          alt="Elisabetta Salvadori"
          draggable="false"
        />
      </div>

      <div
        class="office-chef-button"
        class:is-dialogue-visible={isFaustoOfficeDialogueVisible()}
        data-testimonial="fausto"
        style={`${getFaustoOfficeStyle()}; --reveal-delay: 430ms;`}
        role="button"
        tabindex="0"
        aria-label="Testimonianza Fausto Meli ufficio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedFaustoOfficeAudio = false;
          void startFaustoOfficeAudio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedFaustoOfficeAudio = false;
          void startFaustoOfficeAudio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isFaustoOfficeDialogueVisible()}>
          <span
            class="speech-bubble-copy has-page-controls"
            aria-label={faustoOfficeSpeechInfo.speech}
          >
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{faustoOfficeSpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getFaustoOfficePendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{faustoOfficeSpeechInfo.speech}</span>
            {/if}
            {#if faustoOfficeSpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${faustoOfficeVisiblePageIndex + 1} di ${faustoOfficeSpeechPageCount} per Fausto Meli`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Fausto Meli"
                  disabled={faustoOfficeVisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindFaustoOfficePage}
                >
                  <svg
                    class="speech-bubble-page-icon"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {faustoOfficeVisiblePageIndex + 1}/{faustoOfficeSpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Fausto Meli"
                  disabled={faustoOfficeVisiblePageIndex >= faustoOfficeSpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceFaustoOfficePage}
                >
                  <svg
                    class="speech-bubble-page-icon"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Executive Chef - Fausto Meli">
            <span class="speech-bubble-meta-label">
              <span>Executive Chef - </span>
              <strong>Fausto Meli</strong>
            </span>
          </span>
        </span>
        <img
          class="scene-chef-image"
          src="/assets/interviews/hover/fausto.png"
          alt="Fausto Meli"
          draggable="false"
        />
      </div>
    </div>
  </div>
</section>

<audio bind:this={officeAmbientAudioEl} src="/assets/audio/office_background.wav" preload="auto"></audio>
<audio bind:this={keysHoverAudioEl} src="/assets/audio/chiavi.mp3" preload="auto"></audio>
<audio bind:this={clickHoverAudioEl} src="/assets/audio/click.mp3" preload="auto"></audio>
<audio bind:this={cioHoverAudioEl} src="/assets/audio/ciook.mp3" preload="auto"></audio>
<audio bind:this={mapHoverAudioEl} src="/assets/audio/mappa.mp3" preload="auto"></audio>
<audio
  bind:this={carloOfficeAudioEl}
  src="/assets/audio/carlozarriufficio1.mp3"
  preload="auto"
  onplay={() => {
    isCarloOfficeAudioActive = true;
    setOfficeAmbientVolume();
  }}
  ontimeupdate={syncCarloOfficeSpeechReveal}
  onended={() => {
    carloOfficeRevealProgress = 1;
    hasPlayedCarloOfficeAudio = true;
    isCarloOfficeAudioActive = false;
    setOfficeAmbientVolume();
  }}
></audio>
<audio
  bind:this={carloOffice2AudioEl}
  src="/assets/audio/carlozarri2ufficio.mp3"
  preload="auto"
  onplay={() => {
    isCarloOffice2AudioActive = true;
    setOfficeAmbientVolume();
  }}
  ontimeupdate={syncCarloOffice2SpeechReveal}
  onended={() => {
    carloOffice2RevealProgress = 1;
    hasPlayedCarloOffice2Audio = true;
    isCarloOffice2AudioActive = false;
    setOfficeAmbientVolume();
  }}
></audio>
<audio
  bind:this={elisabettaOfficeAudioEl}
  src="/assets/audio/elisabettaufficio.mp3"
  preload="auto"
  onplay={() => {
    isElisabettaOfficeAudioActive = true;
    setOfficeAmbientVolume();
  }}
  ontimeupdate={syncElisabettaOfficeSpeechReveal}
  onended={() => {
    elisabettaOfficeRevealProgress = 1;
    hasPlayedElisabettaOfficeAudio = true;
    isElisabettaOfficeAudioActive = false;
    setOfficeAmbientVolume();
  }}
></audio>
<audio
  bind:this={faustoOfficeAudioEl}
  src="/assets/audio/fausto_ufficio.mp3"
  preload="auto"
  onplay={() => {
    isFaustoOfficeAudioActive = true;
    setOfficeAmbientVolume();
  }}
  ontimeupdate={syncFaustoOfficeSpeechReveal}
  onended={() => {
    faustoOfficeRevealProgress = 1;
    hasPlayedFaustoOfficeAudio = true;
    isFaustoOfficeAudioActive = false;
    setOfficeAmbientVolume();
  }}
></audio>

<style>
  .office-stage {
    position: relative;
    width: 100%;
    height: var(--app-viewport-height);
    min-height: var(--app-viewport-height);
    overflow: hidden;
    background: var(--color-surface-page);
    cursor: url('/assets/ui/cursors/retrogusto-cursor.svg') 5 5, auto;
    scrollbar-width: none;
    user-select: none;
    overscroll-behavior: contain;
    touch-action: none;
  }

  .office-stage::-webkit-scrollbar {
    display: none;
  }

  .office-phaser-layer {
    position: absolute;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 260ms ease;
  }

  .office-stage.is-loaded .office-phaser-layer {
    opacity: 1;
    visibility: visible;
  }

  .office-phaser-layer :global(canvas) {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
  }

  .office-scroll-space {
    position: relative;
    min-width: 100%;
    min-height: var(--app-viewport-height);
  }

  .office-world {
    position: sticky;
    left: 0;
    top: 0;
    min-width: 100%;
    min-height: var(--app-viewport-height);
    overflow: hidden;
  }

  .office-stage.is-dragging {
    cursor: url('/assets/ui/cursors/retrogusto-cursor.svg') 5 5, auto;
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
    cursor: url('/assets/ui/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    pointer-events: auto;
    touch-action: none;
    z-index: 7;
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

  .office-interactive-asset img {
    animation: officeMapIdle 2.6s cubic-bezier(0.45, 0, 0.2, 1) infinite;
  }

  .office-cio-asset img,
  .office-computer-asset img {
    transform-origin: 50% 50%;
    animation: officeLunchboxBobIdle 2.24s ease-in-out infinite;
  }

  .office-interactive-asset:hover img,
  .office-interactive-asset:focus-visible img {
    animation: officeMapHoverLanding 860ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .office-cio-asset:hover img,
  .office-cio-asset:focus-visible img,
  .office-computer-asset:hover img,
  .office-computer-asset:focus-visible img {
    animation: officeLunchboxHoverShake 620ms cubic-bezier(0.2, 1, 0.28, 1) both;
  }

  .office-keys-asset img {
    transform-origin: 50% 16%;
    animation: officeKeysIdle 1.9s ease-in-out infinite;
  }

  .office-keys-asset:hover img,
  .office-keys-asset:focus-visible img {
    animation: officeKeysHoverJumpShake 620ms cubic-bezier(0.2, 1, 0.28, 1) both;
  }

  .office-easteregg-asset {
    z-index: 8;
  }

  .office-easteregg-asset img {
    transform-origin: 50% 100%;
    animation: none;
  }

  .office-easteregg-asset .object-shine {
    display: none;
  }

  .office-easteregg-asset:hover img,
  .office-easteregg-asset:focus-visible img,
  .office-easteregg-asset.is-tooltip-visible img {
    animation: officeEasterEggJump 420ms cubic-bezier(0.2, 1, 0.28, 1) both;
  }

  .office-easteregg-layout {
    position: absolute;
    z-index: 4;
    top: calc(100% + 8px);
    left: 50%;
    display: block;
    box-sizing: border-box;
    width: min(271px, calc(100vw - 48px));
    height: 168px;
    color: #2a4385;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: 16px;
    font-style: italic;
    font-weight: 400;
    line-height: 1.25;
    text-align: center;
    opacity: 0;
    visibility: hidden;
    transform: translate3d(-50%, 10px, 0);
    transition:
      opacity 110ms ease,
      transform 130ms cubic-bezier(0.16, 1, 0.3, 1),
      visibility 0s linear 110ms;
    pointer-events: none;
  }

  .office-easteregg-copy {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    border-radius: var(--radius-s);
    background: var(--color-surface-page);
    word-break: break-word;
  }

  .office-easteregg-copy strong {
    font-weight: 700;
  }

  .office-keys-tooltip {
    position: absolute;
    z-index: 4;
    left: 50%;
    bottom: calc(100% + 40px);
    display: block;
    box-sizing: border-box;
    width: min(492px, calc(100vw - 48px));
    padding: 14px 18px;
    border: 2px solid #199444;
    border-radius: var(--radius-s);
    background: var(--color-surface-page);
    color: var(--brand-500);
    font-family: "JetBrains Mono", var(--font-text);
    font-size: 16px;
    font-style: italic;
    font-weight: 400;
    line-height: 1.35;
    text-align: left;
    opacity: 0;
    visibility: hidden;
    transform: translate3d(-50%, 8px, 0);
    transition:
      opacity 150ms ease,
      transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
      visibility 0s linear 150ms;
    pointer-events: none;
  }

  .office-keys-tooltip::before,
  .office-keys-tooltip::after {
    position: absolute;
    left: 50%;
    width: 0;
    height: 0;
    content: '';
    transform: translateX(-50%);
  }

  .office-keys-tooltip::before {
    top: 100%;
    border-top: 14px solid #199444;
    border-right: 12px solid transparent;
    border-left: 12px solid transparent;
  }

  .office-keys-tooltip::after {
    top: calc(100% - 1px);
    border-top: 12px solid var(--color-surface-page);
    border-right: 11px solid transparent;
    border-left: 11px solid transparent;
  }

  .office-keys-asset .office-keys-tooltip {
    bottom: calc(100% + 18px);
  }

  .office-cio-tooltip {
    width: min(430px, calc(100vw - 48px));
  }

  .office-map-tooltip {
    bottom: calc(100% + 42px);
    width: min(460px, calc(100vw - 48px));
  }

  .office-computer-tooltip {
    bottom: calc(100% + 18px);
    width: min(520px, calc(100vw - 48px));
  }

  .office-keys-asset:hover .office-keys-tooltip,
  .office-keys-asset:focus-visible .office-keys-tooltip,
  .office-cio-asset:hover .office-cio-tooltip,
  .office-cio-asset:focus-visible .office-cio-tooltip,
  .office-map-asset:hover .office-map-tooltip,
  .office-map-asset:focus-visible .office-map-tooltip,
  .office-computer-asset:hover .office-computer-tooltip,
  .office-computer-asset:focus-visible .office-computer-tooltip {
    opacity: 1;
    visibility: visible;
    transform: translate3d(-50%, 0, 0);
    transition-delay: 0s;
  }

  .office-easteregg-asset:hover .office-easteregg-layout,
  .office-easteregg-asset:focus-visible .office-easteregg-layout,
  .office-easteregg-asset.is-tooltip-visible .office-easteregg-layout {
    opacity: 1;
    visibility: visible;
    transform: translate3d(-50%, 0, 0);
    transition-delay: 420ms, 420ms, 0s;
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

  .office-chef-button {
    position: absolute;
    z-index: 8;
    display: block;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: url('/assets/ui/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    opacity: var(--chef-entry-opacity, 0);
    pointer-events: auto;
    transform: translate3d(0, var(--chef-entry-y, 420px), 0);
    transform-origin: 50% 100%;
    transition:
      opacity 240ms ease,
      transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
  }

  .office-chef-button:focus-visible {
    outline: none;
  }

  .office-chef-button img {
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
  }

  .speech-bubble {
    position: absolute;
    z-index: 7;
    left: 50%;
    top: var(--speech-bubble-top, calc(var(--layout-topbar-height) + 40px));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: var(--speech-bubble-width, 350px);
    height: calc(var(--speech-bubble-copy-height, 132px) + var(--speech-bubble-meta-height, 34px) - 2px);
    color: var(--color-text-primary);
    font-family: var(--font-text);
    text-align: right;
    opacity: 0;
    transform: translate3d(calc(-50% + var(--speech-bubble-offset-x, 0px)), 18px, 0);
    transition:
      opacity 120ms ease,
      transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
  }

  .speech-bubble::before {
    position: absolute;
    z-index: 0;
    left: var(--speech-bubble-arrow-left, 50%);
    bottom: -9px;
    width: 18px;
    height: 18px;
    background: var(--color-border-primary);
    clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
    content: '';
    opacity: 0;
    scale: 0.72;
    transform: translateX(-50%);
    transform-origin: 50% 50%;
    transition:
      opacity 1ms linear 260ms,
      scale 240ms cubic-bezier(0.16, 1, 0.3, 1) 260ms;
  }

  .speech-bubble-copy {
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    flex: 0 0 var(--speech-bubble-copy-height, 132px);
    height: var(--speech-bubble-copy-height, 132px);
    padding: 34px 20px;
    border: 2px solid var(--color-border-primary);
    border-radius: 10px 10px 0 0;
    background: var(--color-surface-page);
    font-size: 15px;
    font-weight: 400;
    line-height: 1.34;
    overflow: hidden;
    white-space: pre-line;
    word-break: break-word;
    text-align: left;
    -webkit-clip-path: inset(100% 0 0 0);
    clip-path: inset(100% 0 0 0);
    will-change: clip-path;
  }

  .speech-bubble-copy.has-page-controls {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 8px;
    padding: 14px 20px 18px;
  }

  .speech-bubble-text {
    position: relative;
    display: block;
    width: 100%;
    text-align: left;
  }

  .speech-bubble-copy.has-page-controls .speech-bubble-text {
    flex: 1;
    display: grid;
    align-items: center;
    min-height: 0;
  }

  .speech-bubble-text-audio {
    color: color-mix(in srgb, var(--color-text-primary) 38%, var(--color-surface-page));
  }

  .speech-bubble-text-line {
    display: block;
  }

  .speech-bubble-text-progress {
    color: var(--color-text-primary);
    white-space: inherit;
  }

  .speech-bubble-text-pending {
    color: color-mix(in srgb, var(--color-text-primary) 38%, var(--color-surface-page));
    white-space: inherit;
  }

  .speech-bubble-meta {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    flex: 0 0 var(--speech-bubble-meta-height, 34px);
    height: var(--speech-bubble-meta-height, 34px);
    margin-top: -2px;
    padding: 0 clamp(13px, 1.2vw, 16px);
    border-radius: 0 0 var(--radius-s) var(--radius-s);
    background: var(--color-border-primary);
    color: var(--color-surface-page);
    font-family: var(--font-text);
    font-size: clamp(10px, 0.8vw, 12px);
    font-weight: 700;
    line-height: 1.5;
    text-align: left;
    overflow: hidden;
    white-space: nowrap;
    -webkit-clip-path: inset(100% 0 0 0);
    clip-path: inset(100% 0 0 0);
    will-change: clip-path;
  }

  .speech-bubble-meta-label {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
  }

  .speech-bubble-meta strong {
    margin-left: 4px;
    font-family: "Fasthand", cursive;
    font-size: clamp(15px, 1.25vw, 19px);
    font-weight: 400;
    line-height: 1.5;
  }

  .speech-bubble-page-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 24px;
    color: var(--color-text-primary);
    line-height: 1;
    pointer-events: auto;
  }

  .speech-bubble-page-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: currentColor;
    cursor: url('/assets/ui/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    transition:
      opacity 140ms ease,
      transform 120ms ease;
  }

  .speech-bubble-page-icon {
    display: block;
    width: 24px;
    height: 24px;
    overflow: visible;
  }

  .speech-bubble-page-icon-depth,
  .speech-bubble-page-icon-face {
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.6;
  }

  .speech-bubble-page-icon-depth {
    display: none;
  }

  .speech-bubble-page-icon-face {
    fill: var(--color-surface-page);
  }

  .speech-bubble-page-counter {
    min-width: 34px;
    color: currentColor;
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
  }

  .speech-bubble-page-button:hover,
  .speech-bubble-page-button:focus-visible {
    outline: none;
  }

  .speech-bubble-page-button:active:not(:disabled),
  :global(.speech-bubble-page-button.is-tap-click-feedback) {
    transform: scale(0.88);
  }

  .speech-bubble-page-button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .speech-bubble-page-button:disabled {
    cursor: default;
    opacity: 0.28;
  }

  .speech-bubble-page-button:disabled:hover,
  .speech-bubble-page-button:disabled:focus-visible {
    transform: none;
  }

  .office-chef-button.is-dialogue-visible .speech-bubble {
    opacity: 1;
    transform: translate3d(calc(-50% + var(--speech-bubble-offset-x, 0px)), 0, 0);
    transition-delay: 0ms;
  }

  .office-chef-button.is-dialogue-visible .speech-bubble::before {
    opacity: 1;
    scale: 1;
  }

  .office-chef-button.is-dialogue-visible .speech-bubble-copy {
    animation: dialogueRevealY 320ms cubic-bezier(0.16, 1, 0.3, 1) 20ms both;
  }

  .office-chef-button.is-dialogue-visible .speech-bubble-meta {
    animation: dialogueRevealY 240ms cubic-bezier(0.16, 1, 0.3, 1) 260ms both;
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

  @keyframes officeLunchboxBobIdle {
    0%,
    100% {
      transform: translate3d(0, 0, 0);
    }

    50% {
      transform: translate3d(0, -10px, 0);
    }
  }

  @keyframes officeLunchboxHoverShake {
    0% {
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
    }

    18% {
      transform: translate3d(-2px, -8px, 0) rotate(-5.6deg) scale(1.025);
    }

    32% {
      transform: translate3d(3px, -5px, 0) rotate(5.6deg) scale(1.018);
    }

    48% {
      transform: translate3d(-2px, -4px, 0) rotate(-4deg) scale(1.012);
    }

    66% {
      transform: translate3d(2px, -2px, 0) rotate(2.4deg) scale(1.006);
    }

    100% {
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
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

  @keyframes officeKeysIdle {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotate(-2.1deg);
    }

    50% {
      transform: translate3d(0, 0, 0) rotate(2.1deg);
    }
  }

  @keyframes officeKeysHoverJumpShake {
    0% {
      transform: translate3d(0, 0, 0) rotate(0deg);
    }

    18% {
      transform: translate3d(0, -9px, 0) rotate(-4.8deg);
    }

    30% {
      transform: translate3d(3px, -10px, 0) rotate(5.2deg);
    }

    42% {
      transform: translate3d(-3px, -9px, 0) rotate(-5.6deg);
    }

    54% {
      transform: translate3d(2px, -8px, 0) rotate(4.2deg);
    }

    68% {
      transform: translate3d(-1px, -5px, 0) rotate(-2.6deg);
    }

    82% {
      transform: translate3d(0, 1px, 0) rotate(1.2deg);
    }

    100% {
      transform: translate3d(0, 0, 0) rotate(0deg);
    }
  }

  @keyframes officeEasterEggJump {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }

    34% {
      transform: translate3d(0, -34px, 0) scale(1.02);
    }

    58% {
      transform: translate3d(0, 4px, 0) scale(0.985, 1.012);
    }

    78% {
      transform: translate3d(0, -3px, 0) scale(1.006);
    }

    100% {
      transform: translate3d(0, 0, 0) scale(1);
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

  @keyframes dialogueRevealY {
    from {
      -webkit-clip-path: inset(100% 0 0 0);
      clip-path: inset(100% 0 0 0);
    }

    to {
      -webkit-clip-path: inset(0 0 0 0);
      clip-path: inset(0 0 0 0);
    }
  }

  @media (max-width: 760px) {
    .office-chef-button > .scene-chef-image {
      visibility: hidden !important;
      opacity: 0 !important;
    }

    .speech-bubble {
      width: var(--speech-bubble-width, min(330px, calc(100vw - 96px)));
    }

    .speech-bubble-copy {
      flex-basis: var(--speech-bubble-copy-height, 166px);
      height: var(--speech-bubble-copy-height, 166px);
      padding: 18px;
      border-width: 2px;
      font-size: 13px;
    }

    .speech-bubble-copy.has-page-controls {
      gap: 8px;
      padding: 12px 18px 16px;
    }

    .speech-bubble-meta {
      flex-basis: var(--speech-bubble-meta-height, 41px);
      height: var(--speech-bubble-meta-height, 41px);
      margin-top: -2px;
      padding: 0 14px;
      font-size: 11px;
    }

    .speech-bubble-meta strong {
      font-size: 18px;
    }
  }

  @media (max-width: 900px), (hover: none) and (pointer: coarse), (orientation: portrait) and (max-width: 1250px) and (min-height: 1500px) {
    .office-chef-button > .scene-chef-image {
      visibility: hidden !important;
      opacity: 0 !important;
    }
  }

  @media (min-width: 390px) and (max-width: 430px) and (min-height: 820px) and (max-height: 920px) {
    .speech-bubble {
      --speech-bubble-width: 306px !important;
      --speech-bubble-copy-height: 152px !important;
      --speech-bubble-meta-height: 38px !important;

      width: var(--speech-bubble-width);
    }

    .speech-bubble-copy {
      flex-basis: var(--speech-bubble-copy-height);
      height: var(--speech-bubble-copy-height);
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.28;
    }

    .speech-bubble-copy.has-page-controls {
      gap: 7px;
      padding: 10px 16px 14px;
    }

    .speech-bubble-meta {
      flex-basis: var(--speech-bubble-meta-height);
      height: var(--speech-bubble-meta-height);
      padding: 0 12px;
      font-size: 10.5px;
    }

    .speech-bubble-meta strong {
      font-size: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .office-stage.is-loaded .reveal-layer,
    .office-stage.is-loaded .office-title {
      animation-duration: 1ms;
    }

    .office-interactive-asset img,
    .office-interactive-asset:hover img,
    .office-interactive-asset:focus-visible img,
    .office-chef-button,
    .office-chef-button.is-dialogue-visible .speech-bubble-copy,
    .office-chef-button.is-dialogue-visible .speech-bubble-meta,
    .object-shine,
    .object-shine::before {
      animation: none;
    }
  }
</style>
