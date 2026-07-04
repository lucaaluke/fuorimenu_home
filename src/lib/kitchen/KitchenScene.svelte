<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import {
    kitchenAssetVersion,
    kitchenAssets,
    kitchenConstructionChunks,
    kitchenConstructionFloorTopY,
    kitchenConstructionObjectAssets,
    kitchenConstructionSceneHeight,
    kitchenSceneConfig
  } from './kitchen-scene.config';
  import { createSceneController } from '$lib/scene/controller';
  import { loadGsap, type Gsap } from '$lib/scene/gsap-loader';
  import { clamp, px } from '$lib/scene/math';
  import { getSceneAssetStyle } from '$lib/scene/scene-utils';
  import type { InteractiveSceneAsset, SceneAsset } from '$lib/scene/scene-asset.types';
  import { createViewportObserver } from '$lib/scene/viewport';
  import type {
    KitchenControllerEvents,
    KitchenControllerState
	  } from '$lib/kitchen/kitchen-scroll-controller';
  import type { KitchenPhaserGameHandle } from '$lib/kitchen/phaser/KitchenPhaserGame';
  import { screenToFigmaY, tailAwareFigmaX } from '$lib/kitchen/phaser/coordinate-utils';

	  const {
	    cursorCss,
	    layerSpeed,
	    pointerCursorCss,
	    sceneHeight,
    sceneWidth,
    title
  } = kitchenSceneConfig;
  const showLegacyKitchenOverlays = false;
	  const titleLetters = title.split('');
  const initialKitchenState: KitchenControllerState = {
    cameraX: 0,
    targetCameraX: 0,
    progress: 0,
    activeChefId: undefined
  };
  const sceneController = createSceneController<KitchenControllerState, KitchenControllerEvents>(
    initialKitchenState
  );
  let { isAudioMuted = false } = $props<{ isAudioMuted?: boolean }>();
  const { bridge } = sceneController;
  const kitchenAsset = (name: string) => `/assets/${name}?v=${kitchenAssetVersion}`;
  let gsap: Gsap | undefined;
  const testimonialHandoffSticky = {
    maxFactor: 0.66,
    minFactor: 0.22,
    releaseAfterNext: 0.009,
    zoneBeforeNext: 0.064
  };
  const tailStartX = 23600;
  const carloSpeech =
    "C'erano grosse difficoltà su Santa Giulia. Il 30 di gennaio era ancora un cantiere, quindi si entrava con l'elmetto col giubbotto catarifrangente; la situazione era veramente drammatica.\nDa dicembre 2025 abbiamo cambiato completamente la strategia per quel sito, perché era un sito che si sapeva che avrebbe avuto delle grosse difficoltà, perché a volte si faceva anche fino a 11.000 spettatori per tre gare al giorno.";
  const kitchenAmbientFadeInDuration = 1.2;
  const kitchenAmbientFadeOutDuration = 0.42;
  const faustoSecondAudioPauseMs = 700;
  const faustoSecondAudioStartTime = 25.9;
  const faustoSecondSpeech =
    'Io avevo 8 chef, quindi uno per ogni sito, con cui avevo più contatti diretti. Ogni chef aveva questa sua brigata in base alla grandezza del luogo dove operava. Brunico aveva uno chef, due sous-chef e 15 ragazzi.';
  type KitchenTestimonialId = 'carlo' | 'paganini' | 'fausto';
  type KitchenTestimonial = {
    id: KitchenTestimonialId;
    ariaLabel: string;
    audioStartTime?: number;
    audioSrc?: string;
    dialogueVisibleThreshold?: number;
    enterProgress: number;
    exitProgress?: number;
    imageAspectRatio: number;
    imageAlt: string;
    imageSrc: string;
    metaLabel: string;
    name: string;
    revealDurationSeconds?: number;
    rolePrefix: string;
    revealSpeechWithAudio?: boolean;
    secondRevealDurationSeconds?: number;
    secondSpeech?: string;
    speech: string;
    widthMax?: number;
    widthMin?: number;
    widthVw?: number;
    bottomOffset?: number;
  };
  const kitchenTestimonials: KitchenTestimonial[] = [
    {
      id: 'carlo',
      ariaLabel: 'Testimonianza Carlo Zarri',
      audioSrc: '/sound/carlo.mp3',
      enterProgress: 0.02,
      exitProgress: 0.155,
      imageAspectRatio: 565 / 185,
      imageAlt: '',
      imageSrc: '/assets/npc_CarloZarri_alt1.svg',
      metaLabel: 'Chief Executive Chef - Carlo Zarri',
      name: 'Carlo Zarri',
      rolePrefix: 'Chief Executive Chef - ',
      revealSpeechWithAudio: true,
      speech: carloSpeech,
      widthMax: 370,
      widthMin: 315,
      widthVw: 0.245,
      bottomOffset: 820
    },
    {
      id: 'paganini',
      ariaLabel: 'Testimonianza Stefano Paganini',
      audioSrc: '/sound/stefano.mp3',
      enterProgress: 0.168,
      exitProgress: 0.235,
      imageAspectRatio: 519 / 283,
      imageAlt: '',
      imageSrc: '/images/stefano-paganini-figma.svg',
      metaLabel: 'Chef - Stefano Paganini',
      name: 'Stefano Paganini',
      rolePrefix: 'Chef - ',
      revealSpeechWithAudio: true,
      speech:
        "Da noi arrivavano ogni tre giorni due barra tre bancali di roba fresca e devi fare in maniera che non ti mancasse mai niente perché c'era sempre la paura, porca miseria se nevica, non possono arrivare con la roba quindi dobbiamo avere le robe in più. Lo standard qualitativo era molto alto perché erano tutti prodotti freschi, che non è scontato eh.",
      widthMax: 360,
      widthMin: 305,
      widthVw: 0.235,
      bottomOffset: 300
    },
    {
      id: 'fausto',
      ariaLabel: 'Testimonianza Fausto',
      audioStartTime: 17.8,
      audioSrc: '/sound/fausto.mp3',
      dialogueVisibleThreshold: 0.16,
      enterProgress: 0.248,
      exitProgress: 0.55,
      imageAspectRatio: 1394 / 574,
      imageAlt: '',
      imageSrc: '/images/fausto.svg',
      metaLabel: 'Chef - Fausto',
      name: 'Fausto',
      revealDurationSeconds: 12,
      rolePrefix: 'Chef - ',
      revealSpeechWithAudio: true,
      secondRevealDurationSeconds: 15,
      secondSpeech: faustoSecondSpeech,
      speech:
        "Sei istituti alberghieri, tra cui l'Istituto di Busto Arsizio, l'Istituto Lagrange di Milano, l'Istituto di Bormio, l'Istituto di Cortina e l'Istituto di Brunico ci hanno aiutato per effettuare tutte le tipologie di servizi.",
      widthMax: 360,
      widthMin: 305,
      widthVw: 0.235,
      bottomOffset: 600
    }
  ];
  const carloTestimonial = kitchenTestimonials[0];
  const paganiniTestimonial = kitchenTestimonials[1];
  const faustoTestimonial = kitchenTestimonials[2];
  const testimonialAudioState: Record<
    KitchenTestimonialId,
    {
      hasPlayed: boolean;
      hasUnlocked: boolean;
      isStarting: boolean;
      isStopping: boolean;
      unlockPromise?: Promise<void>;
      playbackToken: number;
    }
  > = {
    carlo: {
      hasPlayed: false,
      hasUnlocked: false,
      isStarting: false,
      isStopping: false,
      playbackToken: 0
    },
    paganini: {
      hasPlayed: false,
      hasUnlocked: false,
      isStarting: false,
      isStopping: false,
      playbackToken: 0
    },
    fausto: {
      hasPlayed: false,
      hasUnlocked: false,
      isStarting: false,
      isStopping: false,
      playbackToken: 0
    }
  };

	  let stageEl: HTMLElement;
  let phaserContainerEl = $state<HTMLElement>();
	  let viewportWidth = $state(0);
	  let viewportHeight = $state(0);
  let cameraX = $state(0);
  let narrativeProgress = $state(0);
  let activeChefId = $state<KitchenControllerState['activeChefId']>();
	  let kitchenController:
    | {
        scrollBy: (delta: number) => void;
        beginDrag: (clientX: number) => void;
        dragTo: (clientX: number) => void;
        endDrag: () => void;
        resize: () => void;
        destroy: () => void;
	      }
	    | undefined;
  let kitchenPhaserGame: KitchenPhaserGameHandle | undefined;
  let phaserResizeTimer: ReturnType<typeof setTimeout> | undefined;
  let phaserLoadingProgress = $state(0);
  let isPhaserReady = $state(false);
  let toolShedAudioEl: HTMLAudioElement;
  let standMixerAudioEl: HTMLAudioElement;
  let constructionAudioEl: HTMLAudioElement;
  let kitchenAmbientAudioEl: HTMLAudioElement;
  let carloAudioEl: HTMLAudioElement;
  let paganiniAudioEl: HTMLAudioElement;
  let faustoAudioEl: HTMLAudioElement;
  let fausto2AudioEl: HTMLAudioElement;
  let faustoSecondAudioTimer: ReturnType<typeof setTimeout> | undefined;
  let faustoSpeechPart = $state<1 | 2>(1);
  let hasPlayedToolShedHover = false;
  let hasPlayedStandMixerHover = false;
  let isAmbientAudioStarted = false;
  let activeTestimonialAudioId = $state<KitchenTestimonialId>();
  let dismissedTestimonialIds = $state<Record<KitchenTestimonialId, boolean>>({
    carlo: false,
    paganini: false,
    fausto: false
  });
  let testimonialRevealProgress = $state<Record<KitchenTestimonialId, number>>({
    carlo: 0,
    paganini: 0,
    fausto: 0
  });
  let mutedTestimonialPageIndex = $state<Record<KitchenTestimonialId, number>>({
    carlo: 0,
    paganini: 0,
    fausto: 0
  });
  let hasTrackedAudioMuted = false;
  let wasAudioMuted = false;
  let prefersReducedMotion = $state(false);
  let toolShedAudioContext: AudioContext | undefined;
  let toolShedAudioSource: MediaElementAudioSourceNode | undefined;
  const fallbackAudioFadeFrames = new WeakMap<HTMLAudioElement, number>();
  let isDragging = $state(false);
  let isSceneLoaded = $state(false);
  let hasPointerScenePosition = $state(false);
  let pointerSceneY = $state(0);
  let pointerSceneX = $state({
    background: 0,
    middle: 0,
    foreground: 0
  });

  const resolvedLayerSpeed = $derived({
    background: prefersReducedMotion ? 1 : layerSpeed.background,
    middle: prefersReducedMotion ? 1 : layerSpeed.middle,
    title: prefersReducedMotion ? 1 : layerSpeed.title,
    chef: prefersReducedMotion ? 1 : layerSpeed.chef,
    foreground: prefersReducedMotion ? 1 : layerSpeed.foreground
  });
  const sceneScale = $derived(viewportHeight ? viewportHeight / sceneHeight : 1);
  const worldWidth = $derived(Math.max(viewportWidth, sceneWidth * sceneScale));
  const maxScrollX = $derived(Math.max(0, worldWidth - viewportWidth));

  const scenePx = (value: number) => px(value, 2);
  const testimonialPinnedLeftInset = 80;
  const testimonialDialogueTopInset = $derived((viewportWidth <= 760 ? 88 : 104) + 40);
  const testimonialDialogueGap = 32;
  const coord = (value: number) => Math.round(value).toString();
  const coordDecimal = (value: number) => value.toFixed(3);
  let nearestSceneAsset = $state<{ id: string; distance: number }>();

	  function updatePointerScenePosition(event: PointerEvent) {
	    if (!stageEl || !sceneScale) return;

    const rect = stageEl.getBoundingClientRect();
    const localX = clamp(event.clientX - rect.left, 0, rect.width);
	    const localY = clamp(event.clientY - rect.top, 0, rect.height);

	    hasPointerScenePosition = true;
    pointerSceneY = screenToFigmaY(localY, sceneScale, viewportHeight, kitchenConstructionFloorTopY);
	    pointerSceneX = {
	      background: (localX + cameraX * resolvedLayerSpeed.background) / sceneScale,
	      middle: (localX + cameraX * resolvedLayerSpeed.middle) / sceneScale,
	      foreground: (localX + cameraX * resolvedLayerSpeed.foreground) / sceneScale
	    };
    nearestSceneAsset = getNearestSceneAsset();
	  }

	  function syncViewport() {
	    if (!stageEl) return;
	    viewportWidth = stageEl.clientWidth;
	    viewportHeight = stageEl.clientHeight;
	    cameraX = clamp(cameraX, 0, maxScrollX);
	    kitchenController?.resize();
    schedulePhaserResize();
	  }

  function schedulePhaserResize() {
    if (!kitchenPhaserGame || !viewportWidth || !viewportHeight) return;
    if (phaserResizeTimer) clearTimeout(phaserResizeTimer);

    phaserResizeTimer = setTimeout(() => {
      kitchenPhaserGame?.resize(viewportWidth, viewportHeight);
      phaserResizeTimer = undefined;
    }, 100);
  }

  function scrollBy(delta: number) {
    kitchenController?.scrollBy(applyTestimonialHandoffResistance(delta));
  }

  function getNextTestimonial(testimonial: KitchenTestimonial) {
    const index = kitchenTestimonials.findIndex((candidate) => candidate.id === testimonial.id);
    return index >= 0 ? kitchenTestimonials[index + 1] : undefined;
  }

  function isTestimonialAudioUnfinished(testimonial: KitchenTestimonial) {
    const audio = getTestimonialAudioEl(testimonial);
    const state = testimonialAudioState[testimonial.id];

    if (state.isStarting) return true;
    if (activeTestimonialAudioId !== testimonial.id || !audio || audio.paused || audio.ended) {
      return false;
    }

    return !Number.isFinite(audio.duration) || audio.currentTime < audio.duration - 0.2;
  }

  function applyTestimonialHandoffResistance(delta: number) {
    if (delta <= 0 || !activeTestimonialAudioId) return delta;

    const activeTestimonial = kitchenTestimonials.find(
      (testimonial) => testimonial.id === activeTestimonialAudioId
    );
    if (!activeTestimonial || !isTestimonialAudioUnfinished(activeTestimonial)) return delta;

    const nextTestimonial = getNextTestimonial(activeTestimonial);
    if (!nextTestimonial) return delta;

    const stickyStart = Math.max(
      activeTestimonial.enterProgress,
      nextTestimonial.enterProgress - testimonialHandoffSticky.zoneBeforeNext
    );
    const stickyEnd = nextTestimonial.enterProgress + testimonialHandoffSticky.releaseAfterNext;
    if (narrativeProgress < stickyStart || narrativeProgress > stickyEnd) return delta;

    const releaseProgress = clamp(
      (narrativeProgress - stickyStart) / Math.max(stickyEnd - stickyStart, 0.001),
      0,
      1
    );
    const factor =
      testimonialHandoffSticky.maxFactor -
      smoothProgress(releaseProgress) *
        (testimonialHandoffSticky.maxFactor - testimonialHandoffSticky.minFactor);

    return delta * factor;
  }

  function getTitleStyle() {
    return [
      `left: ${scenePx(92 * sceneScale - cameraX * resolvedLayerSpeed.title)}`,
      `top: ${scenePx(viewportHeight / 2 - 132 * sceneScale)}`,
      `font-size: ${scenePx(180 * sceneScale)}`
    ].join(';');
  }

  function getAssetClass(asset: SceneAsset) {
    return [
      'parallax-layer',
      'scene-asset',
      'reveal-layer',
      `${asset.layer}-layer`,
      `layer-${asset.layer}`,
      asset.isTail ? 'tail-layer' : '',
      asset.kind === 'interactive' ? 'interactive-asset' : '',
      asset.kind === 'interactive' ? `${asset.id}-layer` : ''
    ]
      .filter(Boolean)
      .join(' ');
  }

	  function getAssetStyle(asset: SceneAsset) {
    const style = [
      getSceneAssetStyle(asset, cameraX, sceneHeight, sceneScale, resolvedLayerSpeed, tailStartX)
    ];

    if (asset.opacity !== undefined) style.push(`opacity: ${asset.opacity}`);
    if (asset.zOffset !== undefined) style.push(`--scene-z-offset: ${asset.zOffset}`);

    return style.join(';');
	  }

  function getNearestSceneAsset() {
    if (!hasPointerScenePosition) return undefined;

    let nearest: { id: string; distance: number } | undefined;

    for (const asset of kitchenConstructionObjectAssets) {
      const x = tailAwareFigmaX(asset.x, asset.isTail, tailStartX) + asset.width / 2;
      const y = asset.y + asset.height / 2;
      const layerX = pointerSceneX[asset.layer as keyof typeof pointerSceneX];
      if (layerX === undefined) continue;

      const distance = Math.hypot(layerX - x, pointerSceneY - y);
      if (!nearest || distance < nearest.distance) {
        nearest = { id: asset.id, distance };
      }
    }

    return nearest;
  }

	  function getInteractiveAssetStyle(asset: InteractiveSceneAsset) {
    const style = [getAssetStyle(asset)];
    const placement = asset.hoverDialoguePlacement;
    if (!placement) return style.join(';');

    const prefix = asset.id;
    style.push(
      `--interactive-message-width: ${scenePx(placement.width * sceneScale)}`,
      `--interactive-message-padding: ${scenePx(placement.padding * sceneScale)}`,
      `--interactive-message-font-size: ${scenePx(placement.fontSize * sceneScale)}`,
      `--interactive-arrow-size: ${scenePx(placement.arrowSize * sceneScale)}`,
      `--interactive-message-gap: ${scenePx(34 * sceneScale)}`,
      `--${prefix}-message-left: ${scenePx(placement.left * sceneScale)}`,
      `--${prefix}-message-top: ${scenePx(placement.top * sceneScale)}`,
      `--${prefix}-message-width: ${scenePx(placement.width * sceneScale)}`,
      `--${prefix}-message-padding: ${scenePx(placement.padding * sceneScale)}`,
      `--${prefix}-message-font-size: ${scenePx(placement.fontSize * sceneScale)}`,
      `--${prefix}-arrow-left: ${scenePx((placement.arrowLeft ?? asset.width / 2) * sceneScale)}`,
      `--${prefix}-arrow-top: ${scenePx(placement.arrowTop * sceneScale)}`,
      `--${prefix}-arrow-size: ${scenePx(placement.arrowSize * sceneScale)}`,
      `--${prefix}-message-gap: ${scenePx(34 * sceneScale)}`
    );

    return style.join(';');
  }

  function getInteractivePartClass(asset: InteractiveSceneAsset, part: 'dialogue' | 'arrow' | 'panel' | 'copy') {
    return `${asset.id}-hover-${part} hover-${part}`;
  }

  function smoothProgress(value: number) {
    return value * value * (3 - 2 * value);
  }

  function getRawTestimonialPresence(testimonial: KitchenTestimonial) {
    const enter = clamp((narrativeProgress - testimonial.enterProgress) / 0.012, 0, 1);
    const exit =
      testimonial.exitProgress === undefined
        ? 1
        : 1 - clamp((narrativeProgress - testimonial.exitProgress) / 0.012, 0, 1);

    return clamp(smoothProgress(enter) * smoothProgress(exit), 0, 1);
  }

  function getTestimonialPresence(testimonial: KitchenTestimonial) {
    if (dismissedTestimonialIds[testimonial.id]) return 0;
    return getRawTestimonialPresence(testimonial);
  }

  function isTestimonialInDialogueRange(testimonial: KitchenTestimonial) {
    return getRawTestimonialPresence(testimonial) > (testimonial.dialogueVisibleThreshold ?? 0.94);
  }

  function isTestimonialDialogueVisible(testimonial: KitchenTestimonial) {
    return getTestimonialPresence(testimonial) > (testimonial.dialogueVisibleThreshold ?? 0.94);
  }

  function getTestimonialBubbleWidth() {
    if (viewportWidth <= 760) return Math.min(330, Math.max(260, viewportWidth - 96));
    return 350;
  }

  function getTestimonialBubbleCopyHeight() {
    if (viewportWidth <= 760) {
      return 106;
    }

    return 132;
  }

  function getTestimonialBubbleMetaHeight() {
    return viewportWidth <= 760 ? 41 : 34;
  }

  function getTestimonialBubbleHeight() {
    return getTestimonialBubbleCopyHeight() + getTestimonialBubbleMetaHeight() - 2;
  }

  function getTestimonialBubbleOffsetX(testimonial: KitchenTestimonial, chefWidth: number) {
    if (testimonial.id !== 'carlo') return 0;

    const topbarGutter = viewportWidth <= 760 ? 24 : 80;
    const bubbleWidth = getTestimonialBubbleWidth();
    const centeredBubbleLeft = testimonialPinnedLeftInset + chefWidth / 2 - bubbleWidth / 2;
    return topbarGutter - centeredBubbleLeft;
  }

  function getTestimonialVisualTopOffset(testimonial: KitchenTestimonial, chefHeight: number) {
    if (testimonial.id !== 'fausto') return 0;

    const translateY = clamp(viewportWidth * 0.08, 92, 145);
    return Math.min(0, (translateY - chefHeight * 0.22) * 0.45);
  }

  function getTestimonialStyle(testimonial: KitchenTestimonial) {
    const presence = getTestimonialPresence(testimonial);
    const entryY = (1 - presence) * Math.max(420, Math.min(560, viewportHeight * 0.58));
    const width = Math.max(
      testimonial.widthMin ?? 315,
      Math.min(testimonial.widthMax ?? 370, viewportWidth * (testimonial.widthVw ?? 0.245))
    );
    const chefHeight = width * testimonial.imageAspectRatio;
    const dialogueHeight = getTestimonialBubbleHeight();
    const visualTopOffset = getTestimonialVisualTopOffset(testimonial, chefHeight);
    const bubbleWidth = getTestimonialBubbleWidth();
    const bubbleOffsetX = getTestimonialBubbleOffsetX(testimonial, width);
    const bubbleArrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);
    const testimonialTop =
      testimonialDialogueTopInset + dialogueHeight + testimonialDialogueGap - visualTopOffset;
    const bottomOffset = testimonialTop + chefHeight - viewportHeight;
    const dialogueTop = testimonialDialogueTopInset - testimonialTop;

    return [
      `left: ${scenePx(testimonialPinnedLeftInset)}`,
      `bottom: ${scenePx(-bottomOffset)}`,
      `width: ${scenePx(width)}`,
      `--chef-entry-y: ${scenePx(entryY)}`,
      `--chef-entry-opacity: ${presence.toFixed(3)}`,
      `--speech-bubble-width: ${scenePx(bubbleWidth)}`,
      `--speech-bubble-copy-height: ${scenePx(getTestimonialBubbleCopyHeight())}`,
      `--speech-bubble-meta-height: ${scenePx(getTestimonialBubbleMetaHeight())}`,
      `--speech-bubble-offset-x: ${scenePx(bubbleOffsetX)}`,
      `--speech-bubble-arrow-left: ${scenePx(bubbleArrowLeft)}`,
      `--speech-bubble-top: ${scenePx(dialogueTop)}`
    ].join(';');
  }

  function getTestimonialSpeech(testimonial: KitchenTestimonial) {
    if (isAudioMuted && testimonial.id === 'fausto' && testimonial.secondSpeech) {
      return `${testimonial.speech} ${testimonial.secondSpeech}`;
    }

    return testimonial.id === 'fausto' && faustoSpeechPart === 2 && testimonial.secondSpeech
      ? testimonial.secondSpeech
      : testimonial.speech;
  }

  function getTestimonialSpeechPageCharacters() {
    const isMobile = viewportWidth <= 760;
    const bubbleWidth = getTestimonialBubbleWidth();
    const fontSize = isMobile ? 13 : 15;
    const horizontalPadding = isMobile ? 36 : 40;
    const copyHeight = getTestimonialBubbleCopyHeight();
    const lineHeight = fontSize * 1.34;
    const lines = Math.max(3, Math.floor(copyHeight / lineHeight) - 1);
    const charactersPerLine = Math.max(
      18,
      Math.floor((bubbleWidth - horizontalPadding) / (fontSize * 0.56))
    );

    return Math.max(90, Math.floor(charactersPerLine * lines * 0.82));
  }

  function paginateTestimonialSpeech(speech: string) {
    const pageCharacters = getTestimonialSpeechPageCharacters();
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

  function getTestimonialSpeechPages(testimonial: KitchenTestimonial) {
    return paginateTestimonialSpeech(getTestimonialSpeech(testimonial));
  }

  function getMutedResumeSpeech(testimonial: KitchenTestimonial) {
    if (testimonial.id === 'fausto' && testimonial.secondSpeech) {
      return `${testimonial.speech} ${testimonial.secondSpeech}`;
    }

    return testimonial.speech;
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

  function getMutedTestimonialPageIndex(testimonial: KitchenTestimonial) {
    const pages = getTestimonialSpeechPages(testimonial);
    return clamp(mutedTestimonialPageIndex[testimonial.id], 0, Math.max(pages.length - 1, 0));
  }

  function getMutedTestimonialResumeInfo(testimonial: KitchenTestimonial) {
    const pages = paginateTestimonialSpeech(getMutedResumeSpeech(testimonial));
    const pageIndex = clamp(mutedTestimonialPageIndex[testimonial.id], 0, Math.max(pages.length - 1, 0));
    const pageStart = getPageStartCharacterIndex(pages, pageIndex);

    if (testimonial.id === 'fausto' && testimonial.secondSpeech) {
      const firstSpeech = testimonial.speech.trim();
      const secondSpeech = testimonial.secondSpeech.trim();
      const pageMiddle = pageStart + (pages[pageIndex]?.length ?? 0) / 2;

      if (pageMiddle > firstSpeech.length) {
        return {
          part: 2 as const,
          progress: clamp(
            (pageStart - firstSpeech.length - 1) / Math.max(secondSpeech.length, 1),
            0,
            0.98
          )
        };
      }

      return {
        part: 1 as const,
        progress: clamp(pageStart / Math.max(firstSpeech.length, 1), 0, 0.98)
      };
    }

    const normalizedSpeech = pages.join(' ');
    return {
      part: 1 as const,
      progress: clamp(pageStart / Math.max(normalizedSpeech.length, 1), 0, 0.98)
    };
  }

  function syncMutedTestimonialPageIndexFromReveal(testimonial: KitchenTestimonial) {
    const pages = paginateTestimonialSpeech(getMutedResumeSpeech(testimonial));
    let characterOffset = 0;

    if (testimonial.id === 'fausto' && testimonial.secondSpeech) {
      const firstSpeech = testimonial.speech.trim();
      const secondSpeech = testimonial.secondSpeech.trim();
      characterOffset =
        faustoSpeechPart === 2
          ? firstSpeech.length + 1 + testimonialRevealProgress.fausto * secondSpeech.length
          : testimonialRevealProgress.fausto * firstSpeech.length;
    } else {
      const normalizedSpeech = pages.join(' ');
      characterOffset = testimonialRevealProgress[testimonial.id] * normalizedSpeech.length;
    }

    mutedTestimonialPageIndex[testimonial.id] = getPageIndexForCharacterOffset(
      pages,
      characterOffset
    );
  }

  function hasNextMutedTestimonialPage(testimonial: KitchenTestimonial) {
    return isAudioMuted && getMutedTestimonialPageIndex(testimonial) < getTestimonialSpeechPages(testimonial).length - 1;
  }

  function hasPreviousMutedTestimonialPage(testimonial: KitchenTestimonial) {
    return isAudioMuted && getMutedTestimonialPageIndex(testimonial) > 0;
  }

  function advanceMutedTestimonialPage(event: PointerEvent | MouseEvent, testimonial: KitchenTestimonial) {
    event.stopPropagation();
    const pages = getTestimonialSpeechPages(testimonial);
    mutedTestimonialPageIndex[testimonial.id] = clamp(
      mutedTestimonialPageIndex[testimonial.id] + 1,
      0,
      Math.max(pages.length - 1, 0)
    );
  }

  function rewindMutedTestimonialPage(event: PointerEvent | MouseEvent, testimonial: KitchenTestimonial) {
    event.stopPropagation();
    mutedTestimonialPageIndex[testimonial.id] = clamp(
      mutedTestimonialPageIndex[testimonial.id] - 1,
      0,
      Math.max(getTestimonialSpeechPages(testimonial).length - 1, 0)
    );
  }

  function getCurrentSpeechPageInfo(testimonial: KitchenTestimonial) {
    const pages = getTestimonialSpeechPages(testimonial);
    if (isAudioMuted) {
      const speech = pages[getMutedTestimonialPageIndex(testimonial)] ?? '';
      return { highlightedSpeech: speech, speech };
    }

    if (!testimonial.revealSpeechWithAudio) {
      const speech = pages[0] ?? '';
      return { highlightedSpeech: speech, speech };
    }

    const normalizedSpeech = pages.join(' ');
    const spokenLength = Math.ceil(
      normalizedSpeech.length * testimonialRevealProgress[testimonial.id]
    );
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

    const speech = pages[0] ?? '';
    return { highlightedSpeech: '', speech };
  }

  function getHighlightedSpeech(testimonial: KitchenTestimonial) {
    return getCurrentSpeechPageInfo(testimonial).highlightedSpeech;
  }

  function isSpeechHighlightedWithAudio(testimonial: KitchenTestimonial) {
    return !isAudioMuted && Boolean(testimonial.revealSpeechWithAudio);
  }

  function getVisibleSpeech(testimonial: KitchenTestimonial) {
    return getCurrentSpeechPageInfo(testimonial).speech;
  }

  function resetTestimonialSpeechReveal(testimonial: KitchenTestimonial) {
    testimonialRevealProgress[testimonial.id] = testimonial.revealSpeechWithAudio ? 0 : 1;
    mutedTestimonialPageIndex[testimonial.id] = 0;
  }

  function resetTestimonialReplay(testimonial: KitchenTestimonial) {
    testimonialAudioState[testimonial.id].hasPlayed = false;
    dismissedTestimonialIds[testimonial.id] = false;
    resetTestimonialSpeechReveal(testimonial);
    if (testimonial.id === 'fausto') {
      faustoSpeechPart = 1;
      clearFaustoSecondAudioTimer();
    }
  }

  function completeTestimonialSpeechReveal(testimonial: KitchenTestimonial) {
    testimonialRevealProgress[testimonial.id] = 1;
  }

  function finishTestimonialDialogue(testimonial: KitchenTestimonial) {
    completeTestimonialSpeechReveal(testimonial);
    dismissedTestimonialIds[testimonial.id] = true;
    if (activeTestimonialAudioId === testimonial.id) activeTestimonialAudioId = undefined;
  }

  function clearFaustoSecondAudioTimer() {
    if (!faustoSecondAudioTimer) return;
    clearTimeout(faustoSecondAudioTimer);
    faustoSecondAudioTimer = undefined;
  }

  function queueFaustoSecondAudio() {
    clearFaustoSecondAudioTimer();
    activeTestimonialAudioId = 'fausto';
    faustoSecondAudioTimer = setTimeout(() => {
      faustoSecondAudioTimer = undefined;
      void playFaustoSecondAudio();
    }, faustoSecondAudioPauseMs);
  }

  async function playFaustoSecondAudio(options: { resumeProgress?: number; forceReplay?: boolean } = {}) {
    if (isAudioMuted || dismissedTestimonialIds.fausto || !fausto2AudioEl) return;
    const state = testimonialAudioState.fausto;

    gsap?.killTweensOf(fausto2AudioEl);
    state.isStarting = true;
    state.isStopping = false;
    fausto2AudioEl.pause();
    fausto2AudioEl.currentTime =
      options.resumeProgress === undefined
        ? faustoSecondAudioStartTime
        : getAudioTimeForRevealProgress(faustoTestimonial, fausto2AudioEl, options.resumeProgress, {
            secondPart: true
          });
    fausto2AudioEl.muted = false;
    fausto2AudioEl.volume = 1;
    faustoSpeechPart = 2;
    testimonialRevealProgress.fausto = options.resumeProgress ?? 0;
    activeTestimonialAudioId = 'fausto';
    const playbackToken = ++state.playbackToken;

    try {
      await fausto2AudioEl.play();
      if (playbackToken === state.playbackToken) state.hasPlayed = true;
    } catch {
      if (activeTestimonialAudioId === 'fausto') activeTestimonialAudioId = undefined;
    } finally {
      state.isStarting = false;
    }
  }

  function finishFaustoFirstDialogue() {
    completeTestimonialSpeechReveal(faustoTestimonial);
    queueFaustoSecondAudio();
  }

  function finishFaustoSecondDialogue() {
    completeTestimonialSpeechReveal(faustoTestimonial);
    if (activeTestimonialAudioId === 'fausto') activeTestimonialAudioId = undefined;
  }

  function syncFaustoSecondSpeechReveal() {
    if (!fausto2AudioEl) return;

    const revealDuration = faustoTestimonial.secondRevealDurationSeconds ?? 1;
    testimonialRevealProgress.fausto = clamp(
      (fausto2AudioEl.currentTime - faustoSecondAudioStartTime) /
        Math.max(revealDuration, 0.001),
      0,
      1
    );
  }

  function syncTestimonialSpeechReveal(testimonial: KitchenTestimonial) {
    const audio = getTestimonialAudioEl(testimonial);
    if (!testimonial.revealSpeechWithAudio || !audio) return;

    const startTime = testimonial.audioStartTime ?? 0;
    const audioDuration =
      Number.isFinite(audio.duration) && audio.duration > startTime
        ? audio.duration - startTime
        : 1;
    const revealDuration = testimonial.revealDurationSeconds ?? audioDuration;
    testimonialRevealProgress[testimonial.id] = clamp(
      (audio.currentTime - startTime) / Math.max(revealDuration, 0.001),
      0,
      1
    );
  }

  function getAudioTimeForRevealProgress(
    testimonial: KitchenTestimonial,
    audio: HTMLAudioElement,
    revealProgress: number,
    options: { secondPart?: boolean } = {}
  ) {
    const startTime = options.secondPart
      ? faustoSecondAudioStartTime
      : (testimonial.audioStartTime ?? 0);
    const fallbackDuration = options.secondPart
      ? (testimonial.secondRevealDurationSeconds ?? 1)
      : (testimonial.revealDurationSeconds ?? 1);
    const audioDuration =
      Number.isFinite(audio.duration) && audio.duration > startTime
        ? audio.duration - startTime
        : fallbackDuration;
    const revealDuration =
      (options.secondPart ? testimonial.secondRevealDurationSeconds : testimonial.revealDurationSeconds) ??
      audioDuration;

    return startTime + clamp(revealProgress, 0, 0.98) * Math.max(revealDuration, 0.001);
  }

  function onWheel(event: WheelEvent) {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

    event.preventDefault();
    void startAmbientAudio();
    unlockRelevantTestimonialAudio();
    scrollBy(delta * 1.05);
  }

  function onPointerDown(event: PointerEvent) {
    updatePointerScenePosition(event);
    isDragging = true;
    void startAmbientAudio();
    unlockRelevantTestimonialAudio();
    kitchenController?.beginDrag(event.clientX);
    stageEl.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    updatePointerScenePosition(event);
    if (!isDragging) return;
    kitchenController?.dragTo(event.clientX);
    unlockRelevantTestimonialAudio();
  }

  function onPointerLeave() {
    if (!isDragging) hasPointerScenePosition = false;
  }

  function endDrag(event: PointerEvent) {
    isDragging = false;
    kitchenController?.endDrag();
    updatePointerScenePosition(event);
    if (stageEl.hasPointerCapture(event.pointerId)) {
      stageEl.releasePointerCapture(event.pointerId);
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    void startAmbientAudio();
    unlockRelevantTestimonialAudio();
    scrollBy(event.key === 'ArrowLeft' ? -42 : 42);
  }

  function boostToolShedAudio() {
    if (!toolShedAudioEl || toolShedAudioSource) return;

    toolShedAudioContext = new AudioContext();
    toolShedAudioSource = toolShedAudioContext.createMediaElementSource(toolShedAudioEl);
    const gain = toolShedAudioContext.createGain();
    gain.gain.value = 1.35;
    toolShedAudioSource.connect(gain);
    gain.connect(toolShedAudioContext.destination);
  }

  function playHoverSound(audio: HTMLAudioElement | undefined, volume = 0.78) {
    if (isAudioMuted || !audio) return;
    audio.pause();
    audio.currentTime = 0.35;
    audio.volume = volume;
    void audio.play().catch(() => {});
  }

  function getKitchenAmbientMix() {
    if (!viewportWidth) return 0;

    const standMixerCenterX = (6690 + 77) * sceneScale - cameraX * resolvedLayerSpeed.foreground;
    const fadeStartX = viewportWidth * 0.9;
    const fadeEndX = viewportWidth * 0.46;

    return clamp((fadeStartX - standMixerCenterX) / (fadeStartX - fadeEndX), 0, 1);
  }

  function getKitchenAmbientTargetVolumes() {
    const mix = getKitchenAmbientMix();
    const voiceDuck = activeTestimonialAudioId ? 0.18 : 1;

    return {
      construction: isAudioMuted ? 0 : 0.13 * (1 - mix) * voiceDuck,
      kitchen: isAudioMuted ? 0 : 0.26 * mix * voiceDuck
    };
  }

  function cancelFallbackAudioFade(audio: HTMLAudioElement | undefined) {
    if (!audio) return;
    const fallbackFrame = fallbackAudioFadeFrames.get(audio);
    if (fallbackFrame) cancelAnimationFrame(fallbackFrame);
    fallbackAudioFadeFrames.delete(audio);
  }

  function fadeAudioVolume(
    audio: HTMLAudioElement,
    volume: number,
    duration: number,
    onComplete?: () => void
  ) {
    cancelFallbackAudioFade(audio);

    if (gsap && duration > 0) {
      gsap.to(audio, {
        volume,
        duration,
        ease: 'power2.out',
        overwrite: true,
        onComplete
      });
      return;
    }

    if (duration <= 0) {
      audio.volume = volume;
      onComplete?.();
      return;
    }

    const initialVolume = audio.volume;
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      audio.volume = initialVolume + (volume - initialVolume) * progress;

      if (progress < 1) {
        fallbackAudioFadeFrames.set(audio, requestAnimationFrame(step));
        return;
      }

      audio.volume = volume;
      fallbackAudioFadeFrames.delete(audio);
      onComplete?.();
    };

    fallbackAudioFadeFrames.set(audio, requestAnimationFrame(step));
  }

  function setAmbientAudioVolumes(options: { duration?: number } = {}) {
    const targetVolumes = getKitchenAmbientTargetVolumes();
    const fadeDuration = options.duration ?? (activeTestimonialAudioId ? 0.36 : 0.72);

    if (constructionAudioEl) {
      fadeAudioVolume(constructionAudioEl, targetVolumes.construction, fadeDuration);
    }
    if (kitchenAmbientAudioEl) {
      fadeAudioVolume(kitchenAmbientAudioEl, targetVolumes.kitchen, fadeDuration);
    }
  }

  async function startAmbientAudio() {
    if (isAudioMuted || isAmbientAudioStarted || !constructionAudioEl || !kitchenAmbientAudioEl) {
      return;
    }

    constructionAudioEl.loop = true;
    kitchenAmbientAudioEl.loop = true;
    constructionAudioEl.volume = 0;
    kitchenAmbientAudioEl.volume = 0;

    try {
      await Promise.all([constructionAudioEl.play(), kitchenAmbientAudioEl.play()]);
      isAmbientAudioStarted = true;
      setAmbientAudioVolumes({ duration: kitchenAmbientFadeInDuration });
    } catch {
      isAmbientAudioStarted = false;
    }
  }

  function stopAmbientAudio(duration = kitchenAmbientFadeOutDuration) {
    const ambientAudioEls = [constructionAudioEl, kitchenAmbientAudioEl].filter(
      (audio): audio is HTMLAudioElement => Boolean(audio)
    );

    if (!ambientAudioEls.length) {
      isAmbientAudioStarted = false;
      return;
    }

    let pendingStops = ambientAudioEls.length;
    const completeStop = () => {
      pendingStops -= 1;
      if (pendingStops > 0) return;
      isAmbientAudioStarted = false;
    };

    ambientAudioEls.forEach((audio) => {
      fadeAudioVolume(audio, 0, duration, () => {
        audio.pause();
        completeStop();
      });
    });
  }

  $effect(() => {
    const muted = isAudioMuted;
    if (!hasTrackedAudioMuted) {
      wasAudioMuted = muted;
      hasTrackedAudioMuted = true;
    }

    if (!muted) {
      void startAmbientAudio();
      if (isAmbientAudioStarted) setAmbientAudioVolumes();
      if (wasAudioMuted) resumeVisibleTestimonialAudioFromMutedPage();
      wasAudioMuted = muted;
      return;
    }

    if (!wasAudioMuted) syncMutedTestimonialPagesFromAudio();
    toolShedAudioEl?.pause();
    standMixerAudioEl?.pause();
    pauseAllTestimonialAudioForMute();
    stopAmbientAudio();
    wasAudioMuted = muted;
  });

  $effect(() => {
    if (isAudioMuted) return;

    kitchenTestimonials.forEach((testimonial) => {
      const state = testimonialAudioState[testimonial.id];
      const audio = getTestimonialAudioEl(testimonial);
      const isInDialogueRange = isTestimonialInDialogueRange(testimonial);
      const isDialogueVisible = isTestimonialDialogueVisible(testimonial);

      if (isDialogueVisible) {
        if (!state.hasPlayed && !state.isStarting) void playTestimonialAudio(testimonial);
        return;
      }

      if (!isInDialogueRange && (state.hasPlayed || dismissedTestimonialIds[testimonial.id])) {
        resetTestimonialReplay(testimonial);
      }

      if (
        !state.isStopping &&
        (activeTestimonialAudioId === testimonial.id || state.isStarting || !audio?.paused)
      ) {
        stopTestimonialAudio(testimonial);
      }
    });
  });

  function playToolShedHoverSound() {
    if (hasPlayedToolShedHover) return;
    hasPlayedToolShedHover = true;
    boostToolShedAudio();
    void toolShedAudioContext?.resume();
    playHoverSound(toolShedAudioEl, 0.34);
  }

  function resetToolShedHoverSound() {
    hasPlayedToolShedHover = false;
  }

  function playStandMixerHoverSound() {
    if (hasPlayedStandMixerHover) return;
    hasPlayedStandMixerHover = true;
    playHoverSound(standMixerAudioEl, 0.24);
  }

  function resetStandMixerHoverSound() {
    hasPlayedStandMixerHover = false;
  }

  function playInteractiveHoverSound(asset: InteractiveSceneAsset) {
    if (asset.hoverSound === 'toolbox') {
      playToolShedHoverSound();
      return;
    }
    if (asset.hoverSound === 'mixer') playStandMixerHoverSound();
  }

  function resetInteractiveHoverSound(asset: InteractiveSceneAsset) {
    if (asset.hoverSound === 'toolbox') {
      resetToolShedHoverSound();
      return;
    }
    if (asset.hoverSound === 'mixer') resetStandMixerHoverSound();
  }

  function getTestimonialAudioEl(testimonial: KitchenTestimonial) {
    if (testimonial.id === 'carlo') return carloAudioEl;
    if (testimonial.id === 'paganini') return paganiniAudioEl;
    if (testimonial.id === 'fausto') return faustoAudioEl;
    return undefined;
  }

  function getActiveTestimonialAudioEl(testimonial: KitchenTestimonial) {
    if (testimonial.id === 'fausto' && fausto2AudioEl && !fausto2AudioEl.paused) {
      return fausto2AudioEl;
    }

    return getTestimonialAudioEl(testimonial);
  }

  function pauseAllTestimonialAudioForMute(duration = kitchenAmbientFadeOutDuration) {
    clearFaustoSecondAudioTimer();
    kitchenTestimonials.forEach((testimonial) => {
      const state = testimonialAudioState[testimonial.id];
      const audioElements = [getTestimonialAudioEl(testimonial)];
      if (testimonial.id === 'fausto') audioElements.push(fausto2AudioEl);

      state.playbackToken += 1;
      state.isStarting = false;
      state.isStopping = audioElements.some((audio) => audio && !audio.paused);

      audioElements.forEach((audio) => {
        if (!audio) return;
        gsap?.killTweensOf(audio);
        fadeAudioVolume(audio, 0, duration, () => {
          audio.pause();
          audio.volume = 1;
          state.isStopping = false;
        });
      });
    });

    activeTestimonialAudioId = undefined;
  }

  function syncMutedTestimonialPagesFromAudio() {
    kitchenTestimonials.forEach((testimonial) => {
      if (!isTestimonialDialogueVisible(testimonial)) return;
      if (testimonial.id === 'fausto' && faustoSpeechPart === 2) {
        syncFaustoSecondSpeechReveal();
      } else {
        syncTestimonialSpeechReveal(testimonial);
      }
      syncMutedTestimonialPageIndexFromReveal(testimonial);
    });
  }

  async function resumeFaustoSecondAudioFromMutedPage(resumeProgress: number) {
    const state = testimonialAudioState.fausto;
    if (!fausto2AudioEl) return;

    stopAllTestimonialAudio({ duration: 0, except: 'fausto', resetReplay: false });
    clearFaustoSecondAudioTimer();
    if (faustoAudioEl) {
      gsap?.killTweensOf(faustoAudioEl);
      faustoAudioEl.pause();
      faustoAudioEl.currentTime = faustoTestimonial.audioStartTime ?? 0;
      faustoAudioEl.volume = 1;
    }

    state.hasPlayed = false;
    dismissedTestimonialIds.fausto = false;
    await playFaustoSecondAudio({ resumeProgress, forceReplay: true });
  }

  function resumeVisibleTestimonialAudioFromMutedPage() {
    const testimonial = kitchenTestimonials.find(
      (candidate) => isTestimonialDialogueVisible(candidate) && !dismissedTestimonialIds[candidate.id]
    );
    if (!testimonial) return;

    const resumeInfo = getMutedTestimonialResumeInfo(testimonial);
    const state = testimonialAudioState[testimonial.id];
    state.hasPlayed = false;
    dismissedTestimonialIds[testimonial.id] = false;

    if (testimonial.id === 'fausto' && resumeInfo.part === 2) {
      void resumeFaustoSecondAudioFromMutedPage(resumeInfo.progress);
      return;
    }

    void playTestimonialAudio(testimonial, {
      resumeProgress: resumeInfo.progress,
      forceReplay: true
    });
  }

  function unlockRelevantTestimonialAudio() {
    kitchenTestimonials.forEach((testimonial) => {
      const unlockStart = testimonial.enterProgress - 0.04;
      const unlockEnd = (testimonial.exitProgress ?? testimonial.enterProgress + 0.06) + 0.03;
      if (narrativeProgress < unlockStart || narrativeProgress > unlockEnd) return;
      void unlockTestimonialAudio(testimonial);
    });
  }

  function unlockTestimonialAudio(testimonial: KitchenTestimonial) {
    const audio = getTestimonialAudioEl(testimonial);
    const state = testimonialAudioState[testimonial.id];

    if (
      isAudioMuted ||
      !testimonial.audioSrc ||
      state.hasUnlocked ||
      state.hasPlayed ||
      activeTestimonialAudioId === testimonial.id ||
      !audio
    ) {
      return Promise.resolve();
    }
    if (state.unlockPromise) return state.unlockPromise;

    state.unlockPromise = (async () => {
      const previousMuted = audio.muted;
      const previousVolume = audio.volume;

      try {
        audio.muted = true;
        audio.volume = 0;
        await audio.play();
        audio.pause();
        audio.currentTime = testimonial.audioStartTime ?? 0;

        if (testimonial.id === 'fausto' && fausto2AudioEl) {
          const previousSecondMuted = fausto2AudioEl.muted;
          const previousSecondVolume = fausto2AudioEl.volume;

          try {
            fausto2AudioEl.muted = true;
            fausto2AudioEl.volume = 0;
            await fausto2AudioEl.play();
            fausto2AudioEl.pause();
            fausto2AudioEl.currentTime = faustoSecondAudioStartTime;
          } finally {
            fausto2AudioEl.volume = previousSecondVolume;
            fausto2AudioEl.muted = previousSecondMuted;
          }
        }

        state.hasUnlocked = true;
      } catch {
        state.hasUnlocked = false;
      } finally {
        audio.volume = previousVolume;
        audio.muted = previousMuted;
        state.unlockPromise = undefined;
      }
    })();

    return state.unlockPromise;
  }

  async function playTestimonialAudio(
    testimonial: KitchenTestimonial,
    options: { resumeProgress?: number; forceReplay?: boolean } = {}
  ) {
    const audio = getTestimonialAudioEl(testimonial);
    const state = testimonialAudioState[testimonial.id];
    if (
      isAudioMuted ||
      !testimonial.audioSrc ||
      (!options.forceReplay && state.hasPlayed) ||
      state.isStarting ||
      !audio
    ) {
      return;
    }

    state.isStarting = true;
    if (state.unlockPromise) await state.unlockPromise;
    if (isAudioMuted || state.hasPlayed || !audio) {
      state.isStarting = false;
      return;
    }

    stopAllTestimonialAudio({ duration: 0, except: testimonial.id, resetReplay: false });
    if (testimonial.id === 'fausto') clearFaustoSecondAudioTimer();

    gsap?.killTweensOf(audio);
    state.isStopping = false;
    audio.pause();
    audio.currentTime =
      options.resumeProgress === undefined
        ? (testimonial.audioStartTime ?? 0)
        : getAudioTimeForRevealProgress(testimonial, audio, options.resumeProgress);
    if (testimonial.id === 'fausto' && fausto2AudioEl) {
      gsap?.killTweensOf(fausto2AudioEl);
      fausto2AudioEl.pause();
      fausto2AudioEl.currentTime = faustoSecondAudioStartTime;
      fausto2AudioEl.volume = 1;
    }
    audio.muted = false;
    audio.volume = 1;
    dismissedTestimonialIds[testimonial.id] = false;
    if (testimonial.id === 'fausto') faustoSpeechPart = 1;
    if (options.resumeProgress === undefined) {
      resetTestimonialSpeechReveal(testimonial);
    } else {
      testimonialRevealProgress[testimonial.id] = options.resumeProgress;
    }
    activeTestimonialAudioId = testimonial.id;
    const playbackToken = ++state.playbackToken;

    try {
      await audio.play();
      if (playbackToken === state.playbackToken) state.hasPlayed = true;
    } catch {
      if (activeTestimonialAudioId === testimonial.id) activeTestimonialAudioId = undefined;
    } finally {
      state.isStarting = false;
    }
  }

  function stopTestimonialAudio(
    testimonial: KitchenTestimonial,
    options: { duration?: number; resetReplay?: boolean } = {}
  ) {
    const audio = getActiveTestimonialAudioEl(testimonial);
    const state = testimonialAudioState[testimonial.id];
    if (!audio) return;

    const duration = options.duration ?? 0.46;
    const resetReplay = options.resetReplay ?? true;
    if (state.isStopping && duration > 0) return;

    state.playbackToken += 1;
    state.isStarting = false;
    state.isStopping = duration > 0 && !audio.paused;
    if (resetReplay) state.hasPlayed = false;

    gsap?.killTweensOf(audio);

    const afterStop = () => {
      audio.pause();
      audio.currentTime =
        testimonial.id === 'fausto' && audio === fausto2AudioEl
          ? faustoSecondAudioStartTime
          : (testimonial.audioStartTime ?? 0);
      audio.volume = 1;
      if (testimonial.id === 'fausto') {
        clearFaustoSecondAudioTimer();
        if (fausto2AudioEl && audio !== fausto2AudioEl) {
          gsap?.killTweensOf(fausto2AudioEl);
          fausto2AudioEl.pause();
          fausto2AudioEl.currentTime = faustoSecondAudioStartTime;
          fausto2AudioEl.volume = 1;
        }
      }
      state.isStopping = false;
      resetTestimonialSpeechReveal(testimonial);
      if (activeTestimonialAudioId === testimonial.id) activeTestimonialAudioId = undefined;
    };

    if (duration <= 0 || audio.paused) {
      afterStop();
      return;
    }

    if (!gsap) {
      afterStop();
      return;
    }

    gsap.to(audio, {
      volume: 0,
      duration,
      ease: 'power2.out',
      overwrite: true,
      onComplete: afterStop
    });
  }

  function stopAllTestimonialAudio(
    options: { duration?: number; except?: KitchenTestimonialId; resetReplay?: boolean } = {}
  ) {
    kitchenTestimonials.forEach((testimonial) => {
      if (testimonial.id === options.except) return;
      stopTestimonialAudio(testimonial, options);
    });
  }

  function onTestimonialPointerDown(event: PointerEvent, testimonial: KitchenTestimonial) {
    event.stopPropagation();
    if (!testimonial.audioSrc || isAudioMuted) return;
    testimonialAudioState[testimonial.id].hasPlayed = false;
    dismissedTestimonialIds[testimonial.id] = false;
    void playTestimonialAudio(testimonial);
  }

  function onTestimonialKeydown(event: KeyboardEvent, testimonial: KitchenTestimonial) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!testimonial.audioSrc || isAudioMuted) return;
    testimonialAudioState[testimonial.id].hasPlayed = false;
    dismissedTestimonialIds[testimonial.id] = false;
    void playTestimonialAudio(testimonial);
  }

  onMount(() => {
    let destroyed = false;
    const { resources } = sceneController;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncReducedMotion = () => {
      prefersReducedMotion = reducedMotionQuery.matches;
    };

    syncReducedMotion();
    reducedMotionQuery.addEventListener('change', syncReducedMotion);
    resources.add(() => reducedMotionQuery.removeEventListener('change', syncReducedMotion));
	    resources.add(bridge.subscribe((state) => {
	      cameraX = state.cameraX;
	      narrativeProgress = state.progress;
	      activeChefId = state.activeChefId;
      kitchenPhaserGame?.setCameraX(state.cameraX);
	    }));
	    resources.add(createViewportObserver(stageEl, syncViewport));

    if (browser && phaserContainerEl) {
      import('$lib/kitchen/phaser/KitchenPhaserGame').then(({ createKitchenPhaserGame }) => {
        if (destroyed || !phaserContainerEl) return;

        createKitchenPhaserGame({
          assetVersion: kitchenAssetVersion,
          assets: kitchenConstructionObjectAssets,
          chunks: kitchenConstructionChunks,
          container: phaserContainerEl,
          floorTopY: kitchenConstructionFloorTopY,
          getViewport: () => ({ width: viewportWidth, height: viewportHeight }),
          onLoadingProgress: (progress) => {
            phaserLoadingProgress = progress;
          },
          onReady: () => {
            isPhaserReady = true;
          },
          sceneHeight: kitchenConstructionSceneHeight
        }).then((game) => {
          if (destroyed) {
            game?.destroy();
            return;
          }

          kitchenPhaserGame = game;
          kitchenPhaserGame?.setCameraX(cameraX);
          schedulePhaserResize();
          resources.add(() => kitchenPhaserGame?.destroy());
        });
      });
    }

    void loadGsap().then((loadedGsap) => {
      if (destroyed) return;
      gsap = loadedGsap;
    });

    import('$lib/kitchen/kitchen-scroll-controller').then(({ mountKitchenScrollController }) => {
      if (destroyed) return;
      mountKitchenScrollController({
        bridge,
        config: kitchenSceneConfig,
        getViewport: () => ({ width: viewportWidth, height: viewportHeight }),
        stageEl
      }).then((controller) => {
        if (destroyed) {
          controller.destroy();
          return;
        }
        kitchenController = controller;
        resources.add(() => kitchenController?.destroy());
      });
    });

    resources.addFrame(() => {
      isSceneLoaded = true;
    });
    resources.addEventListener(window, 'keydown', onKeydown as EventListener);
    void startAmbientAudio();

	    return () => {
      if (phaserResizeTimer) clearTimeout(phaserResizeTimer);
      cancelFallbackAudioFade(constructionAudioEl);
      cancelFallbackAudioFade(kitchenAmbientAudioEl);
	      constructionAudioEl?.pause();
      kitchenAmbientAudioEl?.pause();
      stopAllTestimonialAudio({ duration: 0, resetReplay: false });
      void toolShedAudioContext?.close();
      destroyed = true;
      sceneController.destroy();
    };
  });
</script>

<section
  bind:this={stageEl}
  class="kitchen-stage"
  class:is-dragging={isDragging}
  class:is-loaded={isSceneLoaded}
  style={`--kitchen-cursor: ${cursorCss}; --kitchen-pointer-cursor: ${pointerCursorCss};`}
  data-active-chef={activeChefId ?? ''}
  data-narrative-progress={narrativeProgress.toFixed(3)}
  aria-label="Scena parallasse della cucina"
  onwheel={onWheel} 
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerleave={onPointerLeave}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  <aside class="scene-coordinate-indicator" aria-label="Coordinate scena per posizionamento asset">
    <div class="coordinate-indicator-title">coordinate scena</div>
    <dl>
      <div>
        <dt>y</dt>
        <dd>{hasPointerScenePosition ? coord(pointerSceneY) : '...'}</dd>
      </div>
      <div>
        <dt>x bg</dt>
        <dd>{hasPointerScenePosition ? coord(pointerSceneX.background) : '...'}</dd>
      </div>
      <div>
        <dt>x mid</dt>
        <dd>{hasPointerScenePosition ? coord(pointerSceneX.middle) : '...'}</dd>
      </div>
      <div>
        <dt>x fg</dt>
        <dd>{hasPointerScenePosition ? coord(pointerSceneX.foreground) : '...'}</dd>
      </div>
      <div>
        <dt>camera</dt>
        <dd>{coord(cameraX)}</dd>
      </div>
	      <div>
	        <dt>scale</dt>
	        <dd>{coordDecimal(sceneScale)}</dd>
	      </div>
      <div>
        <dt>near</dt>
        <dd>{nearestSceneAsset ? nearestSceneAsset.id : '...'}</dd>
      </div>
      <div>
        <dt>dist</dt>
        <dd>{nearestSceneAsset ? coord(nearestSceneAsset.distance) : '...'}</dd>
      </div>
	    </dl>
		  </aside>

  {#if browser}
    <div bind:this={phaserContainerEl} class="kitchen-phaser-layer" aria-hidden="true">
      {#if !isPhaserReady}
        <div class="kitchen-phaser-loader">
          {Math.round(phaserLoadingProgress * 100)}%
        </div>
      {/if}
    </div>
  {/if}
		
  {#if showLegacyKitchenOverlays}
	  {#each kitchenAssets as asset (asset.id)}
	    {#if asset.kind === 'interactive'}
      <button
        class={getAssetClass(asset)}
        data-node-id={asset.nodeId}
        style={getInteractiveAssetStyle(asset)}
        type="button"
        tabindex={asset.ariaLabel ? 0 : -1}
        aria-label={asset.ariaLabel}
        aria-hidden={asset.ariaLabel ? undefined : 'true'}
        onpointerenter={() => playInteractiveHoverSound(asset)}
        onpointerleave={() => resetInteractiveHoverSound(asset)}
        onpointerdown={(event) => event.stopPropagation()}
      >
        <img src={kitchenAsset(asset.src)} alt="" width="100%" height="100%" draggable="false" />
        {#if asset.shineEffect}
          <span
            class="object-shine"
            style={`--shine-mask: url('${kitchenAsset(asset.src)}')`}
            aria-hidden="true"
          ></span>
        {/if}
        {#if asset.hoverDialogue}
          <span
            class={getInteractivePartClass(asset, 'dialogue')}
            aria-hidden="true"
            data-node-id={asset.hoverDialogueNodeId}
          >
            <span class={getInteractivePartClass(asset, 'arrow')} aria-hidden="true"></span>
            <span class={getInteractivePartClass(asset, 'panel')}>
              <span class={getInteractivePartClass(asset, 'copy')}>{asset.hoverDialogue}</span>
            </span>
          </span>
        {/if}
      </button>
	    {/if}
	  {/each}

  <h1 class="scene-title" style={getTitleStyle()} aria-label="Cucina">
    {#each titleLetters as letter, index}
      <span style={`--letter-delay: ${280 + index * 70}ms`} aria-hidden="true">{letter}</span>
    {/each}
  </h1>

  {#each kitchenTestimonials as testimonial (testimonial.id)}
    {@const isDialogueVisible = isTestimonialDialogueVisible(testimonial)}
    <div
      class="chef-button"
      class:is-dialogue-visible={isDialogueVisible}
      data-testimonial={testimonial.id}
      style={`${getTestimonialStyle(testimonial)}; --reveal-delay: 390ms;`}
      role="button"
      tabindex="0"
      aria-label={testimonial.ariaLabel}
      onpointerdown={(event) => onTestimonialPointerDown(event, testimonial)}
      onkeydown={(event) => onTestimonialKeydown(event, testimonial)}
    >
      <span class="speech-bubble" aria-hidden={!isDialogueVisible} data-node-id="3772:1119">
        <span class="speech-bubble-copy" aria-label={getVisibleSpeech(testimonial)}>
          {#if isSpeechHighlightedWithAudio(testimonial)}
            <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
              <span class="speech-bubble-text-base">{getVisibleSpeech(testimonial)}</span>
              <span class="speech-bubble-text-progress">{getHighlightedSpeech(testimonial)}</span>
            </span>
          {:else}
            <span class="speech-bubble-text">{getVisibleSpeech(testimonial)}</span>
          {/if}
        </span>
        <span class="speech-bubble-meta" aria-label={testimonial.metaLabel}>
          <span class="speech-bubble-meta-label">
            <span>{testimonial.rolePrefix}</span>
            <strong>{testimonial.name}</strong>
          </span>
          {#if isAudioMuted && getTestimonialSpeechPages(testimonial).length > 1}
            <span class="speech-bubble-page-controls" aria-label="Navigazione testo">
              <button
                class="speech-bubble-page-button"
                type="button"
                aria-label={`Indietro nel testo di ${testimonial.name}`}
                disabled={!hasPreviousMutedTestimonialPage(testimonial)}
                onpointerdown={(event) => rewindMutedTestimonialPage(event, testimonial)}
                onclick={(event) => event.stopPropagation()}
              >
                ind
              </button>
              <button
                class="speech-bubble-page-button"
                type="button"
                aria-label={`Avanti nel testo di ${testimonial.name}`}
                disabled={!hasNextMutedTestimonialPage(testimonial)}
                onpointerdown={(event) => advanceMutedTestimonialPage(event, testimonial)}
                onclick={(event) => event.stopPropagation()}
              >
                av
              </button>
            </span>
          {/if}
        </span>
      </span>
      <img src={testimonial.imageSrc} alt={testimonial.imageAlt} draggable="false" />
    </div>
  {/each}
  {/if}
</section>

<audio bind:this={toolShedAudioEl} src="/sound/toolbox.mp3" preload="auto"></audio>
<audio bind:this={standMixerAudioEl} src="/sound/mixer.mp3" preload="auto"></audio>
<audio bind:this={constructionAudioEl} src="/sound/cantieresuoni.mp3" preload="auto"></audio>
<audio bind:this={kitchenAmbientAudioEl} src="/sound/cucinasuoni.mp3" preload="auto"></audio>
<audio
  bind:this={carloAudioEl}
  src="/sound/carlo.mp3"
  preload="auto"
  onplay={() => {
    if (!carloAudioEl?.muted) activeTestimonialAudioId = 'carlo';
  }}
  ontimeupdate={() => syncTestimonialSpeechReveal(carloTestimonial)}
  onpause={() => {
    if (activeTestimonialAudioId === 'carlo') activeTestimonialAudioId = undefined;
  }}
  onended={() => {
    finishTestimonialDialogue(carloTestimonial);
  }}
></audio>
<audio
  bind:this={paganiniAudioEl}
  src="/sound/stefano.mp3"
  preload="auto"
  onplay={() => {
    if (!paganiniAudioEl?.muted) activeTestimonialAudioId = 'paganini';
  }}
  ontimeupdate={() => syncTestimonialSpeechReveal(paganiniTestimonial)}
  onpause={() => {
    if (activeTestimonialAudioId === 'paganini') activeTestimonialAudioId = undefined;
  }}
  onended={() => {
    finishTestimonialDialogue(paganiniTestimonial);
  }}
></audio>
<audio
  bind:this={faustoAudioEl}
  src="/sound/fausto.mp3"
  preload="auto"
  onplay={() => {
    if (!faustoAudioEl?.muted) activeTestimonialAudioId = 'fausto';
  }}
  ontimeupdate={() => syncTestimonialSpeechReveal(faustoTestimonial)}
  onpause={() => {
    if (activeTestimonialAudioId === 'fausto') activeTestimonialAudioId = undefined;
  }}
  onended={() => {
    finishFaustoFirstDialogue();
  }}
></audio>
<audio
  bind:this={fausto2AudioEl}
  src="/sound/fausto2.mp3"
  preload="auto"
  onplay={() => {
    if (!fausto2AudioEl?.muted) activeTestimonialAudioId = 'fausto';
  }}
  ontimeupdate={syncFaustoSecondSpeechReveal}
  onpause={() => {
    if (activeTestimonialAudioId === 'fausto') activeTestimonialAudioId = undefined;
  }}
  onended={() => {
    finishFaustoSecondDialogue();
  }}
></audio>

<style>
  .kitchen-stage {
    position: relative;
    width: 100%;
    height: 100svh;
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

  .kitchen-phaser-layer {
    position: absolute;
    z-index: 0;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: auto;
  }

  .kitchen-phaser-layer :global(canvas) {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }

  .kitchen-phaser-loader {
    position: absolute;
    top: var(--layout-page-gutter);
    left: var(--layout-page-gutter);
    padding: 8px 10px;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--radius-s);
    background: rgb(248 243 233 / 0.9);
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
  }
	
	  .scene-coordinate-indicator {
    position: fixed;
    z-index: 130;
    top: calc(var(--layout-page-gutter) + 82px);
    right: var(--layout-page-gutter);
    min-width: 154px;
    padding: 10px 12px 11px;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--radius-s);
    background: rgb(248 243 233 / 0.9);
    color: var(--color-text-primary);
    box-shadow: 0 8px 18px rgb(var(--shadow-brand-rgb) / 0.12);
    font-family: var(--font-text);
    pointer-events: none;
    user-select: none;
  }

  .coordinate-indicator-title {
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .scene-coordinate-indicator dl {
    display: grid;
    gap: 4px;
    margin: 0;
  }

  .scene-coordinate-indicator div {
    display: grid;
    grid-template-columns: 54px 1fr;
    align-items: baseline;
    gap: 8px;
  }

  .scene-coordinate-indicator dt,
  .scene-coordinate-indicator dd {
    margin: 0;
    font-size: 12px;
    line-height: 1.1;
  }

  .scene-coordinate-indicator dt {
    font-weight: 600;
    opacity: 0.68;
  }

  .scene-coordinate-indicator dd {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    text-align: right;
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
    z-index: calc(var(--scene-layer-z, 0) + var(--scene-z-offset, 0));
    transform-origin: center center;
  }

  .scene-asset {
    display: block;
    object-fit: fill;
    user-select: none;
  }

  .reveal-layer {
    opacity: 0;
    transform-origin: 50% 50%;
    will-change: opacity;
  }

  .kitchen-stage.is-loaded .reveal-layer {
    animation: layerPopIn 1ms step-end var(--reveal-delay, 0ms) forwards;
  }

  .parallax-layer img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
  }

  .tail-layer {
    object-fit: fill;
  }

  .tail-layer img {
    height: 100%;
    object-fit: fill;
  }

  .background-layer {
    --reveal-delay: 40ms;
    --scene-layer-z: 1;
  }

  .floor-layer {
    z-index: 2;
    right: 0;
    bottom: 0;
    background-image: url('/assets/pavimento_tile.svg');
    background-repeat: repeat-x;
    transform-origin: 50% 50%;
    pointer-events: none;
  }

  .middle-layer {
    --reveal-delay: 280ms;
    --scene-layer-z: 3;
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

  .scene-title span {
    display: inline-block;
    opacity: 0;
    transform: scale(0.82);
    transform-origin: 50% 50%;
  }

  .kitchen-stage.is-loaded .scene-title span {
    animation: titleLetterIn 360ms cubic-bezier(0.22, 1, 0.36, 1) var(--letter-delay, 0ms) forwards;
  }

  .chef-button {
    z-index: 10;
    display: block;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    cursor: var(--kitchen-pointer-cursor);
    opacity: var(--chef-entry-opacity, 0);
    transform: translate3d(0, var(--chef-entry-y, 0), 0);
    transition:
      opacity 180ms ease,
      transform 360ms cubic-bezier(0.18, 1.05, 0.28, 1);
  }

  .chef-button img {
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
  }

  .chef-button[data-testimonial='fausto'] img {
    width: auto;
    max-width: 100%;
    max-height: clamp(720px, 58vw, 900px);
    margin-inline: auto;
    object-fit: contain;
    transform: translate3d(0, clamp(92px, 8vw, 145px), 0) scale(1.22);
    transform-origin: 50% 100%;
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
    flex: 1;
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
    white-space: pre-line;
    overflow: hidden;
    word-break: break-word;
    -webkit-clip-path: inset(100% 0 0 0);
    clip-path: inset(100% 0 0 0);
    will-change: clip-path;
  }

  .speech-bubble-text {
    position: relative;
    display: block;
    width: 100%;
  }

  .speech-bubble-text-audio {
    color: color-mix(in srgb, var(--color-text-primary) 38%, var(--color-surface-page));
  }

  .speech-bubble-text-base {
    display: block;
  }

  .speech-bubble-text-progress {
    position: absolute;
    inset: 0;
    display: block;
    color: var(--color-text-primary);
    white-space: inherit;
    pointer-events: none;
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
    white-space: nowrap;
    overflow: hidden;
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

  .speech-bubble-page-controls {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    pointer-events: auto;
  }

  .speech-bubble-page-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 20px;
    padding: 0 5px;
    border: 1px solid var(--color-surface-page);
    border-radius: 4px;
    background: transparent;
    color: var(--color-surface-page);
    font-family: var(--font-text);
    font-size: 9px;
    font-weight: 800;
    line-height: 1;
    cursor: var(--kitchen-pointer-cursor);
  }

  .speech-bubble-page-button:hover,
  .speech-bubble-page-button:focus-visible {
    background: var(--color-surface-page);
    color: var(--color-border-primary);
    outline: none;
  }

  .speech-bubble-page-button:disabled {
    opacity: 0.38;
    cursor: default;
  }

  .speech-bubble-meta strong {
    margin-left: 4px;
    font-family: "Fasthand", cursive;
    font-size: clamp(15px, 1.25vw, 19px);
    font-weight: 400;
    line-height: 1.5;
  }

  .chef-button.is-dialogue-visible .speech-bubble {
    opacity: 1;
    transform: translate3d(calc(-50% + var(--speech-bubble-offset-x, 0px)), 0, 0);
    transition-delay: 0ms;
  }

  .chef-button.is-dialogue-visible .speech-bubble::before {
    opacity: 1;
    scale: 1;
  }

  .chef-button.is-dialogue-visible .speech-bubble-copy {
    animation: dialogueRevealY 320ms cubic-bezier(0.16, 1, 0.3, 1) 20ms both;
  }

  .chef-button.is-dialogue-visible .speech-bubble-meta {
    animation: dialogueRevealY 240ms cubic-bezier(0.16, 1, 0.3, 1) 260ms both;
  }

  .foreground-layer {
    --reveal-delay: 470ms;
    --scene-layer-z: 6;
  }

  .interactive-asset {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    overflow: visible;
    pointer-events: auto;
  }

  .tool-shed-layer {
    overflow: visible;
    pointer-events: auto;
  }

  .stand-mixer-layer {
    pointer-events: auto;
  }

  .coffee-machine-layer,
  .orange-detail-machine-layer,
  .alarm-clock-layer,
  .stove-top-layer {
    pointer-events: auto;
  }

  .stand-mixer-layer img {
    position: relative;
    z-index: 1;
    display: block;
    width: 100%;
    height: auto;
    transform-origin: 56% 100%;
    animation: standMixerIdle 2.4s cubic-bezier(0.45, 0, 0.2, 1) infinite;
    will-change: transform;
  }

  .coffee-machine-layer img,
  .orange-detail-machine-layer img,
  .alarm-clock-layer img,
  .stove-top-layer img {
    position: relative;
    z-index: 1;
    display: block;
    width: 100%;
    height: auto;
    transform-origin: 52% 100%;
    animation: coffeeMachineIdle 1.65s cubic-bezier(0.45, 0, 0.2, 1) infinite;
    will-change: transform;
  }

  .stand-mixer-layer:hover img,
  .stand-mixer-layer:focus-visible img {
    animation: standMixerHoverLanding 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .coffee-machine-layer:hover img,
  .coffee-machine-layer:focus-visible img,
  .orange-detail-machine-layer:hover img,
  .orange-detail-machine-layer:focus-visible img,
  .alarm-clock-layer:hover img,
  .alarm-clock-layer:focus-visible img,
  .stove-top-layer:hover img,
  .stove-top-layer:focus-visible img {
    animation: coffeeMachineHoverLanding 860ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .stand-mixer-hover-dialogue {
    position: absolute;
    inset: 0;
    z-index: 3;
    opacity: 0;
    transition: opacity 120ms ease;
    pointer-events: none;
  }

  .coffee-machine-hover-dialogue,
  .orange-detail-machine-hover-dialogue,
  .alarm-clock-hover-dialogue,
  .stove-top-hover-dialogue {
    position: absolute;
    inset: 0;
    z-index: 3;
    opacity: 0;
    transition: opacity 120ms ease;
    pointer-events: none;
  }

  .stand-mixer-hover-panel {
    position: absolute;
    z-index: 2;
    left: var(--stand-mixer-message-left);
    top: var(--stand-mixer-message-top);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--stand-mixer-message-width);
    padding: var(--stand-mixer-message-padding);
    border: 2px solid var(--color-interactive-hover);
    border-radius: var(--radius-s);
    background: #f7f3ea;
    color: var(--color-text-primary);
    -webkit-clip-path: inset(0 0 0 0);
    clip-path: inset(0 0 0 0);
    will-change: clip-path;
  }

  .coffee-machine-hover-panel {
    position: absolute;
    z-index: 2;
    left: var(--coffee-machine-message-left);
    top: var(--coffee-machine-message-top);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--coffee-machine-message-width);
    padding: var(--coffee-machine-message-padding);
    border: 2px solid var(--color-interactive-hover);
    border-radius: var(--radius-s);
    background: #f7f3ea;
    color: var(--color-text-primary);
    -webkit-clip-path: inset(0 0 0 0);
    clip-path: inset(0 0 0 0);
    will-change: clip-path;
  }

  .orange-detail-machine-hover-panel {
    position: absolute;
    z-index: 2;
    left: var(--orange-detail-machine-message-left);
    top: var(--orange-detail-machine-message-top);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--orange-detail-machine-message-width);
    padding: var(--orange-detail-machine-message-padding);
    border: 2px solid var(--color-interactive-hover);
    border-radius: var(--radius-s);
    background: #f7f3ea;
    color: var(--color-text-primary);
    -webkit-clip-path: inset(0 0 0 0);
    clip-path: inset(0 0 0 0);
    will-change: clip-path;
  }

  .alarm-clock-hover-panel {
    position: absolute;
    z-index: 2;
    left: var(--alarm-clock-message-left);
    top: var(--alarm-clock-message-top);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--alarm-clock-message-width);
    padding: var(--alarm-clock-message-padding);
    border: 2px solid var(--color-interactive-hover);
    border-radius: var(--radius-s);
    background: #f7f3ea;
    color: var(--color-text-primary);
    -webkit-clip-path: inset(0 0 0 0);
    clip-path: inset(0 0 0 0);
    will-change: clip-path;
  }

  .stove-top-hover-panel {
    position: absolute;
    z-index: 2;
    left: var(--stove-top-message-left);
    top: var(--stove-top-message-top);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--stove-top-message-width);
    padding: var(--stove-top-message-padding);
    border: 2px solid var(--color-interactive-hover);
    border-radius: var(--radius-s);
    background: #f7f3ea;
    color: var(--color-text-primary);
    -webkit-clip-path: inset(0 0 0 0);
    clip-path: inset(0 0 0 0);
    will-change: clip-path;
  }

  .stand-mixer-hover-arrow {
    position: absolute;
    z-index: 1;
    left: var(--stand-mixer-arrow-left);
    top: var(--stand-mixer-arrow-top);
    width: var(--stand-mixer-arrow-size);
    height: var(--stand-mixer-arrow-size);
    background: var(--color-interactive-hover);
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .coffee-machine-hover-arrow {
    position: absolute;
    z-index: 1;
    left: var(--coffee-machine-arrow-left);
    top: var(--coffee-machine-arrow-top);
    width: var(--coffee-machine-arrow-size);
    height: var(--coffee-machine-arrow-size);
    background: var(--color-interactive-hover);
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .orange-detail-machine-hover-arrow {
    position: absolute;
    z-index: 1;
    left: var(--orange-detail-machine-arrow-left);
    top: var(--orange-detail-machine-arrow-top);
    width: var(--orange-detail-machine-arrow-size);
    height: var(--orange-detail-machine-arrow-size);
    background: var(--color-interactive-hover);
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .alarm-clock-hover-arrow {
    position: absolute;
    z-index: 1;
    left: var(--alarm-clock-arrow-left);
    top: var(--alarm-clock-arrow-top);
    width: var(--alarm-clock-arrow-size);
    height: var(--alarm-clock-arrow-size);
    background: var(--color-interactive-hover);
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .stove-top-hover-arrow {
    position: absolute;
    z-index: 1;
    left: var(--stove-top-arrow-left);
    top: var(--stove-top-arrow-top);
    width: var(--stove-top-arrow-size);
    height: var(--stove-top-arrow-size);
    background: var(--color-interactive-hover);
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .stand-mixer-hover-copy {
    position: relative;
    z-index: 1;
    width: 100%;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: var(--stand-mixer-message-font-size);
    font-style: italic;
    font-weight: 300;
    line-height: normal;
    letter-spacing: 0;
    text-align: left;
    word-break: break-word;
  }

  .coffee-machine-hover-copy {
    position: relative;
    z-index: 1;
    width: 100%;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: var(--coffee-machine-message-font-size);
    font-style: italic;
    font-weight: 300;
    line-height: normal;
    letter-spacing: 0;
    text-align: left;
    word-break: break-word;
  }

  .orange-detail-machine-hover-copy {
    position: relative;
    z-index: 1;
    width: 100%;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: var(--orange-detail-machine-message-font-size);
    font-style: italic;
    font-weight: 300;
    line-height: normal;
    letter-spacing: 0;
    text-align: left;
    word-break: break-word;
  }

  .alarm-clock-hover-copy {
    position: relative;
    z-index: 1;
    width: 100%;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: var(--alarm-clock-message-font-size);
    font-style: italic;
    font-weight: 300;
    line-height: normal;
    letter-spacing: 0;
    text-align: left;
    word-break: break-word;
  }

  .stove-top-hover-copy {
    position: relative;
    z-index: 1;
    width: 100%;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: var(--stove-top-message-font-size);
    font-style: italic;
    font-weight: 300;
    line-height: normal;
    letter-spacing: 0;
    text-align: left;
    word-break: break-word;
  }

  .stand-mixer-layer:hover .stand-mixer-hover-dialogue,
  .stand-mixer-layer:focus-visible .stand-mixer-hover-dialogue {
    opacity: 1;
  }

  .coffee-machine-layer:hover .coffee-machine-hover-dialogue,
  .coffee-machine-layer:focus-visible .coffee-machine-hover-dialogue,
  .orange-detail-machine-layer:hover .orange-detail-machine-hover-dialogue,
  .orange-detail-machine-layer:focus-visible .orange-detail-machine-hover-dialogue,
  .alarm-clock-layer:hover .alarm-clock-hover-dialogue,
  .alarm-clock-layer:focus-visible .alarm-clock-hover-dialogue,
  .stove-top-layer:hover .stove-top-hover-dialogue,
  .stove-top-layer:focus-visible .stove-top-hover-dialogue {
    opacity: 1;
  }

  .stand-mixer-layer:hover .stand-mixer-hover-panel,
  .stand-mixer-layer:focus-visible .stand-mixer-hover-panel {
    animation: dialogueRevealX 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .coffee-machine-layer:hover .coffee-machine-hover-panel,
  .coffee-machine-layer:focus-visible .coffee-machine-hover-panel,
  .orange-detail-machine-layer:hover .orange-detail-machine-hover-panel,
  .orange-detail-machine-layer:focus-visible .orange-detail-machine-hover-panel,
  .alarm-clock-layer:hover .alarm-clock-hover-panel,
  .alarm-clock-layer:focus-visible .alarm-clock-hover-panel,
  .stove-top-layer:hover .stove-top-hover-panel,
  .stove-top-layer:focus-visible .stove-top-hover-panel {
    animation: dialogueRevealX 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .tool-shed-layer:focus-visible,
  .stand-mixer-layer:focus-visible,
  .coffee-machine-layer:focus-visible,
  .orange-detail-machine-layer:focus-visible,
  .alarm-clock-layer:focus-visible,
  .stove-top-layer:focus-visible {
    outline: none;
  }

  .tool-shed-layer img {
    position: relative;
    z-index: 1;
    transform-origin: 50% 100%;
    will-change: transform;
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
    animation: objectLightSweepOpacityTool 1.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    will-change: opacity;
  }

  .stand-mixer-layer .object-shine {
    animation-name: objectLightSweepOpacityMixer;
    animation-duration: 2.4s;
  }

  .coffee-machine-layer .object-shine,
  .orange-detail-machine-layer .object-shine,
  .alarm-clock-layer .object-shine,
  .stove-top-layer .object-shine {
    animation-name: objectLightSweepOpacityCoffee;
    animation-duration: 2.7s;
  }

  .object-shine::before {
    position: absolute;
    top: -34%;
    left: 46%;
    width: 18%;
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
    animation: objectLightSweepBeamTool 1.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    will-change: transform;
  }

  .stand-mixer-layer .object-shine::before {
    animation-name: objectLightSweepBeamMixer;
    animation-duration: 2.4s;
  }

  .coffee-machine-layer .object-shine::before,
  .orange-detail-machine-layer .object-shine::before,
  .alarm-clock-layer .object-shine::before,
  .stove-top-layer .object-shine::before {
    left: 38%;
    width: 24%;
    animation-name: objectLightSweepBeamCoffee;
    animation-duration: 2.7s;
  }

  .tool-shed-layer:hover img,
  .tool-shed-layer:focus-visible img {
    animation: toolShedHeavyLanding 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .tool-shed-hover-dialogue {
    position: absolute;
    inset: 0;
    z-index: 3;
    opacity: 0;
    transition: opacity 120ms ease;
    pointer-events: none;
  }

  .tool-shed-hover-panel {
    position: absolute;
    z-index: 2;
    left: var(--tool-shed-message-left);
    top: var(--tool-shed-message-top);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--tool-shed-message-width);
    padding: var(--tool-shed-message-padding);
    border: 2px solid var(--color-interactive-hover);
    border-radius: var(--radius-s);
    background: #f7f3ea;
    color: var(--color-text-primary);
    -webkit-clip-path: inset(0 0 0 0);
    clip-path: inset(0 0 0 0);
    will-change: clip-path;
  }

  .tool-shed-hover-arrow {
    position: absolute;
    z-index: 1;
    left: var(--tool-shed-message-left);
    top: var(--tool-shed-arrow-top);
    width: var(--tool-shed-arrow-size);
    height: var(--tool-shed-arrow-size);
    background: var(--color-interactive-hover);
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .tool-shed-hover-copy {
    position: relative;
    z-index: 1;
    width: 100%;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: var(--tool-shed-message-font-size);
    font-style: italic;
    font-weight: 300;
    line-height: normal;
    letter-spacing: 0;
    text-align: left;
    word-break: break-word;
  }

  .hover-dialogue {
    opacity: 0;
    transform: translate3d(0, 18px, 0);
    transition:
      opacity 120ms ease,
      transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
    will-change: opacity, transform;
  }

  .hover-panel {
    left: 50%;
    top: auto;
    bottom: calc(100% + var(--interactive-message-gap, 34px));
    width: var(--interactive-message-width);
    padding: var(--interactive-message-padding);
    transform: translateX(-50%);
    -webkit-clip-path: inset(100% 0 0 0);
    clip-path: inset(100% 0 0 0);
  }

  .hover-arrow {
    left: 50%;
    top: auto;
    bottom: calc(100% + var(--interactive-message-gap, 34px) - var(--interactive-arrow-size, 18px));
    width: calc(var(--interactive-arrow-size, 18px) * 1.45);
    height: var(--interactive-arrow-size, 18px);
    clip-path: polygon(50% 100%, 0 0, 100% 0);
    opacity: 0;
    scale: 0.72;
    transform: translateX(-50%);
    transform-origin: 50% 50%;
    transition:
      opacity 1ms linear 80ms,
      scale 220ms cubic-bezier(0.22, 1, 0.36, 1) 80ms;
    will-change: opacity, scale;
  }

  .hover-copy {
    font-size: var(--interactive-message-font-size);
  }

  .tool-shed-layer:hover .tool-shed-hover-dialogue,
  .tool-shed-layer:focus-visible .tool-shed-hover-dialogue {
    opacity: 1;
  }

  .tool-shed-layer:hover .tool-shed-hover-panel,
  .tool-shed-layer:focus-visible .tool-shed-hover-panel {
    animation: dialogueRevealX 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .interactive-asset:hover .hover-dialogue,
  .interactive-asset:focus-visible .hover-dialogue {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

  .interactive-asset:hover .hover-arrow,
  .interactive-asset:focus-visible .hover-arrow {
    opacity: 1;
    scale: 1;
  }

  .interactive-asset:hover .hover-panel,
  .interactive-asset:focus-visible .hover-panel {
    animation: dialogueRevealY 320ms cubic-bezier(0.16, 1, 0.3, 1) 20ms both;
  }

  @keyframes layerPopIn {
    0% {
      opacity: 0;
    }

    100% {
      opacity: 1;
    }
  }

  @keyframes dialogueRevealX {
    from {
      -webkit-clip-path: inset(0 100% 0 0);
      clip-path: inset(0 100% 0 0);
    }

    to {
      -webkit-clip-path: inset(0 0 0 0);
      clip-path: inset(0 0 0 0);
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

  @keyframes objectLightSweepOpacityTool {
    0%,
    52% {
      opacity: 0;
    }

    63% {
      opacity: 0.8;
    }

    90% {
      opacity: 0;
    }

    100% {
      opacity: 0;
    }
  }

  @keyframes objectLightSweepBeamTool {
    0%,
    52% {
      transform: translate3d(-430%, -34%, 0) rotate(35deg);
    }

    90%,
    100% {
      transform: translate3d(430%, 34%, 0) rotate(35deg);
    }
  }

  @keyframes objectLightSweepOpacityMixer {
    0%,
    58% {
      opacity: 0;
    }

    66% {
      opacity: 0.8;
    }

    78% {
      opacity: 0;
    }

    100% {
      opacity: 0;
    }
  }

  @keyframes objectLightSweepBeamMixer {
    0%,
    58% {
      transform: translate3d(-430%, -34%, 0) rotate(35deg);
    }

    78%,
    100% {
      transform: translate3d(430%, 34%, 0) rotate(35deg);
    }
  }

  @keyframes objectLightSweepOpacityCoffee {
    0%,
    54% {
      opacity: 0;
    }

    64% {
      opacity: 0.78;
    }

    82% {
      opacity: 0;
    }

    100% {
      opacity: 0;
    }
  }

  @keyframes objectLightSweepBeamCoffee {
    0%,
    54% {
      transform: translate3d(-430%, -34%, 0) rotate(35deg);
    }

    82%,
    100% {
      transform: translate3d(430%, 34%, 0) rotate(35deg);
    }
  }

  @keyframes toolShedHeavyLanding {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }

    10% {
      transform: translate3d(0, 0, 0) scale(1.035, 0.965);
    }

    24% {
      transform: translate3d(0, -18px, 0) scale(0.975, 1.025);
    }

    42% {
      transform: translate3d(1px, -34px, 0) scale(0.985, 1.015);
    }

    56% {
      transform: translate3d(-1px, -14px, 0) scale(1);
    }

    66% {
      transform: translate3d(0, 0, 0) scale(1.11, 0.86);
    }

    73% {
      transform: translate3d(0, -7px, 0) scale(0.965, 1.045);
    }

    81% {
      transform: translate3d(0, 0, 0) scale(1.055, 0.935);
    }

    89% {
      transform: translate3d(0, -2px, 0) scale(0.99, 1.01);
    }

    100% {
      transform: translate3d(0, 0, 0) scale(1);
    }
  }

  @keyframes standMixerIdle {
    0%,
    42%,
    100% {
      transform: translate3d(0, 0, 0) rotate(0deg);
    }

    52% {
      transform: translate3d(0, -3px, 0) rotate(-1.6deg);
    }

    64% {
      transform: translate3d(0, 0, 0) rotate(0.9deg);
    }

    78% {
      transform: translate3d(0, -0.8px, 0) rotate(-0.5deg);
    }
  }

  @keyframes coffeeMachineIdle {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
    }

    28% {
      transform: translate3d(0, -13px, 0) rotate(-3.6deg) scale(1.018);
    }

    46% {
      transform: translate3d(0, 2px, 0) rotate(1.5deg) scale(1.012, 0.985);
    }

    62% {
      transform: translate3d(0, -6px, 0) rotate(-1.9deg) scale(1.008);
    }

    78% {
      transform: translate3d(0, 0, 0) rotate(0.9deg) scale(1);
    }
  }

  @keyframes coffeeMachineHoverLanding {
    0% {
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
    }

    12% {
      transform: translate3d(0, 0, 0) rotate(5deg) scale(1.08, 0.88);
    }

    28% {
      transform: translate3d(0, -38px, 0) rotate(-12deg) scale(0.94, 1.12);
    }

    44% {
      transform: translate3d(4px, -54px, 0) rotate(-16deg) scale(0.96, 1.08);
    }

    58% {
      transform: translate3d(-2px, -18px, 0) rotate(-7deg) scale(1);
    }

    68% {
      transform: translate3d(0, 0, 0) rotate(4deg) scale(1.18, 0.78);
    }

    78% {
      transform: translate3d(0, -14px, 0) rotate(-5deg) scale(0.96, 1.1);
    }

    88% {
      transform: translate3d(0, 0, 0) rotate(2deg) scale(1.08, 0.88);
    }

    100% {
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
    }
  }

  @keyframes standMixerHoverLanding {
    0% {
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
    }

    12% {
      transform: translate3d(0, 0, 0) rotate(2.5deg) scale(1.025, 0.975);
    }

    28% {
      transform: translate3d(0, -14px, 0) rotate(-6deg) scale(0.985, 1.018);
    }

    43% {
      transform: translate3d(1px, -24px, 0) rotate(-9deg) scale(0.99, 1.012);
    }

    57% {
      transform: translate3d(0, -9px, 0) rotate(-4deg) scale(1);
    }

    67% {
      transform: translate3d(0, 0, 0) rotate(1.8deg) scale(1.075, 0.91);
    }

    76% {
      transform: translate3d(0, -5px, 0) rotate(-2.2deg) scale(0.985, 1.025);
    }

    84% {
      transform: translate3d(0, 0, 0) rotate(0.9deg) scale(1.035, 0.955);
    }

    92% {
      transform: translate3d(0, -1.5px, 0) rotate(-0.45deg) scale(0.996, 1.006);
    }

    100% {
      transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
    }
  }

  @keyframes titleLetterIn {
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
  }

  @media (max-width: 760px) {
    .scene-coordinate-indicator {
      top: calc(var(--layout-page-gutter-mobile) + 74px);
      right: var(--layout-page-gutter-mobile);
      min-width: 132px;
      padding: 8px 9px;
    }

    .coordinate-indicator-title {
      font-size: 9px;
    }

    .scene-coordinate-indicator div {
      grid-template-columns: 48px 1fr;
      gap: 6px;
    }

    .scene-coordinate-indicator dt,
    .scene-coordinate-indicator dd {
      font-size: 11px;
    }

    .speech-bubble {
      left: 50%;
      top: var(--speech-bubble-top, calc(var(--layout-topbar-height-mobile) + 40px));
      width: var(--speech-bubble-width, min(330px, calc(100vw - 96px)));
      transform: translate3d(calc(-50% + var(--speech-bubble-offset-x, 0px)), 18px, 0);
    }

    .speech-bubble::before {
      left: var(--speech-bubble-arrow-left, 50%);
      top: auto;
      bottom: -9px;
      width: 18px;
      height: 18px;
    }

    .chef-button.is-dialogue-visible .speech-bubble {
      transform: translate3d(calc(-50% + var(--speech-bubble-offset-x, 0px)), 0, 0);
    }

    .speech-bubble-copy {
      flex-basis: var(--speech-bubble-copy-height, 106px);
      height: var(--speech-bubble-copy-height, 106px);
      padding: 18px 18px;
      border-width: 2px;
      font-size: 13px;
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
    .reveal-layer {
      opacity: 1;
      animation: none;
    }

    .tool-shed-layer:hover img,
    .tool-shed-layer:focus-visible img,
    .stand-mixer-layer img,
    .stand-mixer-layer:hover img,
    .stand-mixer-layer:focus-visible img,
    .coffee-machine-layer img,
    .coffee-machine-layer:hover img,
    .coffee-machine-layer:focus-visible img,
    .orange-detail-machine-layer img,
    .orange-detail-machine-layer:hover img,
    .orange-detail-machine-layer:focus-visible img,
    .alarm-clock-layer img,
    .alarm-clock-layer:hover img,
    .alarm-clock-layer:focus-visible img,
    .stove-top-layer img,
    .stove-top-layer:hover img,
    .stove-top-layer:focus-visible img,
    .scene-title span {
      opacity: 1;
      transform: none;
      animation: none;
    }

    .speech-bubble,
    .speech-bubble::before,
    .speech-bubble-copy,
    .speech-bubble-meta,
    .chef-button,
    .object-shine,
    .tool-shed-hover-dialogue,
    .tool-shed-hover-panel,
    .tool-shed-hover-arrow,
    .stand-mixer-hover-dialogue,
    .stand-mixer-hover-panel,
    .stand-mixer-hover-arrow,
    .coffee-machine-hover-dialogue,
    .coffee-machine-hover-panel,
    .coffee-machine-hover-arrow,
    .orange-detail-machine-hover-dialogue,
    .orange-detail-machine-hover-panel,
    .orange-detail-machine-hover-arrow,
    .alarm-clock-hover-dialogue,
    .alarm-clock-hover-panel,
    .alarm-clock-hover-arrow,
    .stove-top-hover-dialogue,
    .stove-top-hover-panel,
    .stove-top-hover-arrow {
      transition: none;
      animation: none;
    }

    .chef-button.is-dialogue-visible .speech-bubble-copy,
    .chef-button.is-dialogue-visible .speech-bubble-meta,
    .tool-shed-layer:hover .tool-shed-hover-panel,
    .tool-shed-layer:focus-visible .tool-shed-hover-panel,
    .stand-mixer-layer:hover .stand-mixer-hover-panel,
    .stand-mixer-layer:focus-visible .stand-mixer-hover-panel,
    .coffee-machine-layer:hover .coffee-machine-hover-panel,
    .coffee-machine-layer:focus-visible .coffee-machine-hover-panel,
    .orange-detail-machine-layer:hover .orange-detail-machine-hover-panel,
    .orange-detail-machine-layer:focus-visible .orange-detail-machine-hover-panel,
    .alarm-clock-layer:hover .alarm-clock-hover-panel,
    .alarm-clock-layer:focus-visible .alarm-clock-hover-panel,
    .stove-top-layer:hover .stove-top-hover-panel,
    .stove-top-layer:focus-visible .stove-top-hover-panel {
      -webkit-clip-path: inset(0 0 0 0);
      clip-path: inset(0 0 0 0);
    }
  }
</style>
