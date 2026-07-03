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
  import { loadGsapWithScrollTrigger, type Gsap } from '$lib/scene/gsap-loader';
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
  let officeAmbientAudioEl: HTMLAudioElement;
  let keysHoverAudioEl: HTMLAudioElement;
  let clickHoverAudioEl: HTMLAudioElement;
  let mapHoverAudioEl: HTMLAudioElement;
  let carloOfficeAudioEl: HTMLAudioElement;
  let isAmbientAudioStarted = false;
  let isCarloOfficeAudioActive = $state(false);
  let isCarloOfficeAudioStarting = false;
  let hasPlayedCarloOfficeAudio = false;
  let carloOfficeRevealProgress = $state(0);
  let carloOfficeMutedPageIndex = $state(0);
  let gsap: Gsap | undefined;
  let officeAmbientFadeFrame: number | undefined;
  let carloOfficeFadeFrame: number | undefined;
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
  const officeAmbientVolume = 0.32;
  const officeAmbientFadeInDuration = 1.2;
  const officeAmbientFadeOutDuration = 0.36;
  const carloOfficeAudioVolume = 1;
  const carloOfficeAudioFadeOutDuration = 0.36;
  const carloOfficeRevealDurationSeconds = 37.54;
  const carloOfficeSpeech =
    'Qui parliamo del 2018 che abbiamo sviluppato il dossier di candidatura. Nel 2019 Milano Cortina vince viene nominata organizzatrice delle Olimpiadi del 2026, quindi 7 anni prima. E poi nel 2021 io entro nello staff come direttore Food and Beverage. Ci sono 110-120 delegati delle federazioni internazionali, che sono i Presidenti dei vari Comitati Olimpici nel mondo, che si riuniscono, valutano il dossier che tu hai presentato e decidono tra le varie città candidate quale deve essere quella che vince, quindi tu devi essere molto esaustivo, molto attraente.';
  const carloOfficeEnterDistance = $derived(Math.max(130, viewportWidth * 0.16));
  const carloOfficeExitDistance = $derived(Math.max(170, viewportWidth * 0.2));
  const carloOfficeSpeechPages = $derived(getCarloOfficeSpeechPages());
  const carloOfficeSpeechPageCount = $derived(carloOfficeSpeechPages.length);
  const carloOfficeVisiblePageIndex = $derived(getCarloOfficeVisiblePageIndex());
  const carloOfficeSpeechInfo = $derived(getCarloOfficeCurrentSpeechPageInfo());

  function versionedAsset(path: string) {
    const normalized = path.startsWith('/') ? path : `/assets/${path}`;
    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}v=${assetVersion}`;
  }

  function chunkAsset(chunk: SceneChunk) {
    return versionedAsset(`office-figma/background/Slice ${chunk.frameIndex + 1}.png`);
  }

  function getCarloOfficeEnterCameraX() {
    return Math.min(Math.max(120 * sceneScale, maxScrollX * 0.008), viewportWidth * 0.18);
  }

  function getCarloOfficeExitCameraX() {
    const attaccapanniLogicalX = 26066 * 0.5;
    const foregroundSpeed = resolvedLayerSpeed.foreground || 1;
    const cameraAtAttaccapanni =
      (attaccapanniLogicalX * sceneScale - viewportWidth * 0.72) / foregroundSpeed;

    return clamp(cameraAtAttaccapanni, getCarloOfficeEnterCameraX() + viewportWidth * 0.5, maxScrollX);
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

  function applyCarloOfficeScrollResistance(nextValue: number, baseValue = targetCameraX) {
    const delta = nextValue - baseValue;
    if (delta <= 0 || !isCarloOfficeAudioUnfinished()) return nextValue;

    const exitCameraX = getCarloOfficeExitCameraX();
    const stickyStart = Math.max(getCarloOfficeEnterCameraX(), exitCameraX - viewportWidth * 0.72);
    const stickyEnd = exitCameraX + viewportWidth * 0.12;
    if (cameraX < stickyStart || cameraX > stickyEnd) return nextValue;

    const releaseProgress = clamp((cameraX - stickyStart) / Math.max(stickyEnd - stickyStart, 1), 0, 1);
    const factor = 0.66 - ease(releaseProgress) * 0.44;
    return baseValue + delta * factor;
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
    if (targetCameraX > cameraX && isCarloOfficeAudioUnfinished()) {
      targetCameraX = applyCarloOfficeScrollResistance(targetCameraX, cameraX);
    }

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
    void startAmbientAudio();
    const axisDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    scrollBy(axisDelta * 1.35);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    void startAmbientAudio();
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
    void startAmbientAudio();
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

  function getInteractiveHoverAudio(asset: InteractiveSceneAsset) {
    if (asset.id === '1_chiavi') return { audio: keysHoverAudioEl, volume: 0.58 };
    if (asset.id === '1_mappa') return { audio: mapHoverAudioEl, volume: 0.52 };
    if (asset.id === '1_cio' || asset.id === '2_computerint') {
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
    const translateX = 92 * sceneScale - cameraX * resolvedLayerSpeed.title;

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

    return clamp(ease(enter) * ease(exit), 0, 1);
  }

  function isCarloOfficeDialogueVisible() {
    return getCarloOfficePresence() > 0.16;
  }

  function getCarloOfficeBubbleWidth() {
    return Math.min(viewportWidth - 48, Math.max(320, Math.min(430, viewportWidth * 0.34)));
  }

  function getCarloOfficeBubbleCopyHeight() {
    if (viewportWidth <= 760) return 166;
    return Math.max(148, Math.min(176, viewportHeight * 0.18));
  }

  function getCarloOfficeBubbleMetaHeight() {
    return viewportWidth <= 760 ? 41 : 34;
  }

  function getCarloOfficeBubbleHeight() {
    return getCarloOfficeBubbleCopyHeight() + getCarloOfficeBubbleMetaHeight() - 2;
  }

  function getCarloOfficeStyle() {
    const presence = getCarloOfficePresence();
    const width = Math.max(250, Math.min(340, viewportWidth * 0.22));
    const characterHeight = width * (1340 / 522);
    const bubbleHeight = getCarloOfficeBubbleHeight();
    const gap = viewportWidth <= 760 ? 22 : 30;
    const topInset = (viewportWidth <= 760 ? 88 : 104) + 34;
    const characterTop = topInset + bubbleHeight + gap;
    const bottomOffset = characterTop + characterHeight - viewportHeight;
    const entryY = (1 - presence) * Math.max(360, Math.min(520, viewportHeight * 0.54));
    const bubbleWidth = getCarloOfficeBubbleWidth();
    const bubbleOffsetX = viewportWidth <= 760 ? 18 : 68;
    const arrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);

    return [
      `left: ${scenePx(viewportWidth <= 760 ? 26 : 78)}`,
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
    const pageCharacters = getCarloOfficeSpeechPageCharacters();
    const words = carloOfficeSpeech.trim().split(/\s+/).filter(Boolean);
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

  function getCarloOfficeVisiblePageIndex() {
    const pages = getCarloOfficeSpeechPages();
    if (isAudioMuted) return clamp(carloOfficeMutedPageIndex, 0, Math.max(pages.length - 1, 0));

    const normalizedSpeech = pages.join(' ');
    return getPageIndexForCharacterOffset(
      pages,
      normalizedSpeech.length * carloOfficeRevealProgress
    );
  }

  function setCarloOfficePage(pageIndex: number) {
    const pages = getCarloOfficeSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !carloOfficeAudioEl) {
      carloOfficeMutedPageIndex = nextPageIndex;
      return;
    }

    const pageStart = getPageStartCharacterIndex(pages, nextPageIndex);
    const normalizedSpeech = pages.join(' ');
    const progress = clamp(pageStart / Math.max(normalizedSpeech.length, 1), 0, 0.98);
    carloOfficeRevealProgress = progress;
    carloOfficeAudioEl.currentTime = progress * carloOfficeRevealDurationSeconds;
  }

  function advanceCarloOfficePage(event: Event) {
    event.stopPropagation();
    setCarloOfficePage(getCarloOfficeVisiblePageIndex() + 1);
  }

  function rewindCarloOfficePage(event: Event) {
    event.stopPropagation();
    setCarloOfficePage(getCarloOfficeVisiblePageIndex() - 1);
  }

  function getCarloOfficeCurrentSpeechPageInfo() {
    const pages = getCarloOfficeSpeechPages();
    const visiblePageIndex = getCarloOfficeVisiblePageIndex();
    if (isAudioMuted) {
      const speech = pages[visiblePageIndex] ?? '';
      return { highlightedSpeech: speech, speech };
    }

    const normalizedSpeech = pages.join(' ');
    const spokenLength = Math.ceil(normalizedSpeech.length * carloOfficeRevealProgress);
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

  function fadeCarloOfficeAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!carloOfficeAudioEl) return;
    if (carloOfficeFadeFrame) cancelAnimationFrame(carloOfficeFadeFrame);
    carloOfficeFadeFrame = undefined;

    if (gsap && duration > 0) {
      gsap.to(carloOfficeAudioEl, {
        volume: targetVolume,
        duration,
        ease: 'power2.out',
        overwrite: true,
        onComplete
      });
      return;
    }

    if (duration <= 0) {
      carloOfficeAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = carloOfficeAudioEl.volume;
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!carloOfficeAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      carloOfficeAudioEl.volume = initialVolume + (targetVolume - initialVolume) * progress;

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

  function fadeOfficeAmbientVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!officeAmbientAudioEl) return;
    if (officeAmbientFadeFrame) cancelAnimationFrame(officeAmbientFadeFrame);
    officeAmbientFadeFrame = undefined;

    if (gsap && duration > 0) {
      gsap.to(officeAmbientAudioEl, {
        volume: targetVolume,
        duration,
        ease: 'power2.out',
        overwrite: true,
        onComplete: () => {
          officeAmbientAudioEl.volume = targetVolume;
          onComplete?.();
        }
      });
      return;
    }

    if (duration <= 0) {
      officeAmbientAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = officeAmbientAudioEl.volume;
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!officeAmbientAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      officeAmbientAudioEl.volume = initialVolume + (targetVolume - initialVolume) * progress;

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
    return officeAmbientVolume * (isCarloOfficeAudioActive ? 0.28 : 1);
  }

  function setOfficeAmbientVolume(duration = 0.48) {
    if (!officeAmbientAudioEl || !isAmbientAudioStarted || isAudioMuted) return;
    fadeOfficeAmbientVolume(getOfficeAmbientTargetVolume(), duration);
  }

  async function startAmbientAudio() {
    if (isAudioMuted || isAmbientAudioStarted || !officeAmbientAudioEl) return;

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
      hasPlayedCarloOfficeAudio ||
      isCarloOfficeAudioStarting ||
      !carloOfficeAudioEl ||
      !isCarloOfficeDialogueVisible()
    ) {
      return;
    }

    isCarloOfficeAudioStarting = true;
    gsap?.killTweensOf(carloOfficeAudioEl);
    if (carloOfficeFadeFrame) cancelAnimationFrame(carloOfficeFadeFrame);
    carloOfficeFadeFrame = undefined;
    carloOfficeAudioEl.pause();
    carloOfficeAudioEl.currentTime =
      clamp(carloOfficeMutedPageIndex / Math.max(getCarloOfficeSpeechPages().length - 1, 1), 0, 0.98) *
      carloOfficeRevealDurationSeconds;
    carloOfficeAudioEl.volume = carloOfficeAudioVolume;
    carloOfficeRevealProgress = clamp(
      carloOfficeAudioEl.currentTime / carloOfficeRevealDurationSeconds,
      0,
      1
    );

    try {
      await carloOfficeAudioEl.play();
      hasPlayedCarloOfficeAudio = true;
      isCarloOfficeAudioActive = true;
      setOfficeAmbientVolume();
    } catch {
      isCarloOfficeAudioActive = false;
    } finally {
      isCarloOfficeAudioStarting = false;
    }
  }

  function stopCarloOfficeAudio(duration = carloOfficeAudioFadeOutDuration, resetReplay = false) {
    if (!carloOfficeAudioEl) {
      isCarloOfficeAudioActive = false;
      isCarloOfficeAudioStarting = false;
      return;
    }

    isCarloOfficeAudioStarting = false;
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

  $effect(() => {
    if (isAudioMuted) {
      stopAmbientAudio();
      stopCarloOfficeAudio();
      return;
    }

    void startAmbientAudio();
  });

  $effect(() => {
    const visible = isCarloOfficeDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startCarloOfficeAudio();
      return;
    }

    if (!visible && (isCarloOfficeAudioActive || isCarloOfficeAudioStarting)) {
      stopCarloOfficeAudio();
    }

    if (cameraX < getCarloOfficeEnterCameraX() - carloOfficeEnterDistance) {
      hasPlayedCarloOfficeAudio = false;
      carloOfficeRevealProgress = 0;
      carloOfficeMutedPageIndex = 0;
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
    void loadGsapWithScrollTrigger().then(({ gsap: loadedGsap, ScrollTrigger }) => {
      if (destroyed) return;
      gsap = loadedGsap;

      scrollTrigger = ScrollTrigger.create({
        anticipatePin: 1,
        end: () => `+=${Math.max(maxScrollX, window.innerHeight * 0.85, 1)}`,
        id: 'office-horizontal-scroll',
        invalidateOnRefresh: true,
        onRefresh: (self) => {
          setTargetCameraX(self.progress * maxScrollX, { bypassResistance: true });
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

      loadedGsap.ticker.add(tick);
      removeTicker = () => loadedGsap.ticker.remove(tick);
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
      gsap?.killTweensOf(officeAmbientAudioEl);
      gsap?.killTweensOf(carloOfficeAudioEl);
      if (officeAmbientFadeFrame) cancelAnimationFrame(officeAmbientFadeFrame);
      if (carloOfficeFadeFrame) cancelAnimationFrame(carloOfficeFadeFrame);
      officeAmbientFadeFrame = undefined;
      carloOfficeFadeFrame = undefined;
      officeAmbientAudioEl?.pause();
      carloOfficeAudioEl?.pause();
      isAmbientAudioStarted = false;
      isCarloOfficeAudioActive = false;
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
        {#if isInteractiveAsset(item)}
          <button
            class="office-asset office-middle-asset office-interactive-asset reveal-layer middle-layer"
            type="button"
            aria-label={item.ariaLabel}
            style={getForegroundStyle(item)}
            onpointerenter={() => playInteractiveHoverSound(item)}
            onfocus={() => playInteractiveHoverSound(item)}
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
            class="office-asset office-middle-asset reveal-layer middle-layer"
            src={versionedAsset(item.src)}
            alt=""
            draggable="false"
            style={getForegroundStyle(item)}
          />
        {/if}
      {/each}

      {#each officeForegroundAssets as item (item.id)}
        {#if isInteractiveAsset(item)}
          <button
            class="office-asset office-foreground-asset office-interactive-asset reveal-layer foreground-layer"
            type="button"
            aria-label={item.ariaLabel}
            style={getForegroundStyle(item)}
            onpointerenter={() => playInteractiveHoverSound(item)}
            onfocus={() => playInteractiveHoverSound(item)}
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
          <span class="speech-bubble-meta" aria-label="Food and Beverage Director - Carlo Zarri">
            <span class="speech-bubble-meta-label">
              <span>Food and Beverage Director - </span>
              <strong>Carlo Zarri</strong>
            </span>
          </span>
        </span>
        <img src="/images/carlo-zarri.png" alt="Carlo Zarri" draggable="false" />
      </div>
    </div>
  </div>
</section>

<audio bind:this={officeAmbientAudioEl} src="/sound/office_background.wav" preload="auto"></audio>
<audio bind:this={keysHoverAudioEl} src="/sound/chiavi.mp3" preload="auto"></audio>
<audio bind:this={clickHoverAudioEl} src="/sound/click.mp3" preload="auto"></audio>
<audio bind:this={mapHoverAudioEl} src="/sound/mappa.mp3" preload="auto"></audio>
<audio
  bind:this={carloOfficeAudioEl}
  src="/sound/carlozarriufficio1.mp3"
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

  .office-interactive-asset img {
    animation: officeMapIdle 2.6s cubic-bezier(0.45, 0, 0.2, 1) infinite;
  }

  .office-interactive-asset:hover img,
  .office-interactive-asset:focus-visible img {
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

  .office-chef-button {
    position: absolute;
    z-index: 8;
    display: block;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, pointer;
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
    text-align: left;
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
    overflow: hidden;
    white-space: nowrap;
    -webkit-clip-path: inset(100% 0 0 0);
    clip-path: inset(100% 0 0 0);
    will-change: clip-path;
  }

  .speech-bubble-meta-label {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
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
    --page-arrow-depth-y: 2px;
    --page-arrow-lift-y: 0px;
    --page-arrow-depth-opacity: 0;

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
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, pointer;
    transition:
      opacity 140ms ease,
      transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
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
    transition:
      opacity 140ms ease,
      transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
  }

  .speech-bubble-page-icon-depth {
    fill: currentColor;
    opacity: var(--page-arrow-depth-opacity);
    transform: translateY(var(--page-arrow-depth-y));
  }

  .speech-bubble-page-icon-face {
    fill: var(--color-surface-page);
    transform: translateY(var(--page-arrow-lift-y));
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
    --page-arrow-lift-y: calc(var(--page-arrow-depth-y) * -1);
    --page-arrow-depth-opacity: 1;

    outline: none;
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
    --page-arrow-lift-y: 0px;
    --page-arrow-depth-opacity: 0;
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
