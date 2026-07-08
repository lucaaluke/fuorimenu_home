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
  import { getCompatibleAudioContextConstructor } from '$lib/scene/browser-compat';
  import { loadGsap, type Gsap } from '$lib/scene/gsap-loader';
  import { triggerTapClickFeedback } from '$lib/scene/tap-click-feedback';
  import { clamp, px } from '$lib/scene/math';
  import SceneLoadingProgress from '$lib/scene/SceneLoadingProgress.svelte';
  import SceneProgressBar from '$lib/scene/SceneProgressBar.svelte';
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
  const touchScrollInteractiveSelector = 'a, button, input, textarea, select, [role="button"]';
  const kitchenReturnCameraStorageKey = 'kitchen-return-camera-x';
  const touchScrollDeadZone = 3;
  const touchScrollFactor = 1.54;
  const showLegacyKitchenOverlays = false;
  const phaserObjectScrollFactor = {
    middle: 1.25,
    foreground: 1.5
  } as const;
  const kitchenSTooltipAssets = kitchenConstructionObjectAssets.filter((asset) => {
    const fileName = asset.src.split('/').at(-1) ?? '';
    return (
      asset.id === 'easteregg' ||
      (fileName.includes('S_') && asset.id !== '2-S-fornelli-b' && asset.id !== 'S-kit-pulizie-b')
    );
  });
  const kitchenSTooltipTextById: Record<string, string> = {
    'S-cassetta-attrezzi':
      'Non è una cucina professionale, è un capannone allestito da cucina dove a volte fa caldissimo e a volte fa freddissimo.',
    'S-cono': 'È stato un impianto consegnato 5 giorni prima.',
    'S-planetaria':
      "Se non c'era il bollino del CIO, o dei responsabili Food and Beverage al checkpoint, non poteva entrare nulla.",
    'S-macchinetta-caffe':
      "Una sfida è stata trovare l'armonia nel fondere due realtà, quindi una brigata già esistente con un'altra brigata che andava ad affiancarsi.",
    'S-kit-pulizie-a':
      'La figura dello chef deve controllare che tutto vada come deve andare, che ci sia tutto e soprattutto avere anche la capacità di risolvere i problemi.',
    'S-sveglia':
      '700 pasti al giorno da fare, da preparare con una disponibilità oraria che andava dalle 5 del mattino a 00:00.',
    '2-S-fornelli-a':
      'Si devono gestire bene i tempi di preparazione e i tempi del servizio per non accavallare le cose.'
  };
  const kitchenSTooltipSoundFileById = {
    cone: '/sound/conook.mp3',
    cleaningKit: '/sound/spruzzinook.mp3',
    coffeeCup: '/sound/tazzinaok.mp3',
    alarmClock: '/sound/svegliaok.mp3',
    stove: '/sound/fornellook.mp3',
    standMixer: '/sound/mixer.mp3',
    toolbox: '/sound/toolbox.mp3'
  } as const;
  const kitchenSTooltipSoundById: Record<string, keyof typeof kitchenSTooltipSoundFileById> = {
    'S-cono': 'cone',
    'S-kit-pulizie-a': 'cleaningKit',
    'S-macchinetta-caffe': 'coffeeCup',
    'S-sveglia': 'alarmClock',
    '2-S-fornelli-a': 'stove',
    'S-planetaria': 'standMixer',
    'S-cassetta-attrezzi': 'toolbox'
  };
  const initialKitchenState: KitchenControllerState = {
    cameraX: 0,
    targetCameraX: 0,
    progress: 0,
    activeChefId: undefined
  };
  const sceneController = createSceneController<KitchenControllerState, KitchenControllerEvents>(
    initialKitchenState
  );
  let { isAudioMuted = false, initialCameraX, onProgressChange, onSceneRevealedChange } = $props<{
    isAudioMuted?: boolean;
    initialCameraX?: number;
    onProgressChange?: (progress: number) => void;
    onSceneRevealedChange?: (isRevealed: boolean) => void;
  }>();
  const { bridge } = sceneController;
  const kitchenAsset = (name: string) => `/assets/${name}?v=${kitchenAssetVersion}`;
  let gsap: Gsap | undefined;
  const testimonialHandoffSticky = {
    maxFactor: 0.92,
    minFactor: 0.68,
    zoneBeforeDisappearPx: 350
  };
  const tailStartX = 23600;
  const carloSpeech =
    "C'erano grosse difficoltà su Santa Giulia. Il 30 di gennaio era ancora un cantiere, quindi si entrava con l'elmetto col giubbotto catarifrangente; la situazione era veramente drammatica.\nDa dicembre 2025 abbiamo cambiato completamente la strategia per quel sito, perché era un sito che si sapeva che avrebbe avuto delle grosse difficoltà, perché a volte si faceva anche fino a 11.000 spettatori per tre gare al giorno.";
  const kitchenAmbientFadeInDuration = 1.2;
  const kitchenAmbientFadeOutDuration = 0.42;
  const kitchenAmbientSwitchCameraX = 5000;
  const kitchenAmbientCrossfadeDistance = 480;
  const constructionAmbientVolume = 1.38;
  const kitchenBackgroundAmbientVolume = 0.46;
  const testimonialAudioVolume = 0.92;
  const testimonialAudioFadeInDuration = 0.18;
  const testimonialAudioFadeOutDuration = 0.18;
  const testimonialAudioHandoffFadeOutDuration = 0.16;
  const kitchenDialogueCameraRanges = {
    carlo: { enter: 600, dialogueStart: 600, exit: 4700 },
    paganini: { enter: 4900, dialogueStart: 4900, exit: 8100 },
    fausto: { enter: 9850, dialogueStart: 9850, exit: 13000 },
    fausto2: { enter: 13000, dialogueStart: 13000, exit: 15300 },
    marco: { enter: 15500, dialogueStart: 15500, exit: 18400 }
  } as const;
  const paganiniTrailerVideo = {
    cameraX: 9450,
    y: 360,
    width: 1040,
    height: 585,
    src: '/assets/kitchen/objects/video-paganini-trailer_v2.mp4'
  } as const;
  const faustoSpeech =
    "Sei istituti alberghieri, tra cui l'Istituto di Busto Arsizio, l'Istituto Lagrange di Milano, l'Istituto di Bormio, l'Istituto di Cortina e l'Istituto di Brunico ci hanno aiutato per effettuare tutte le tipologie di servizi. Io avevo 8 chef, quindi uno per ogni sito, con cui avevo più contatti diretti. Ogni chef aveva questa sua brigata in base alla grandezza del luogo dove operava. Brunico aveva uno chef, due sous-chef e 15 ragazzi. La grande difficoltà che ho trovato io personalmente, è che, lavorando per un'azienda americana, loro hanno uno stile completamente diverso. Non posso dire che loro siano più bravi, non lo dirò mai. Posso dire che loro sono più pignoli? Sì. Per i primi 3-4 mesi entrare nella loro fase di lavoro non è stato semplice.";
  const faustoSecondSpeech =
    "Gli operatori normali lavoravano le 8 ore, 40 ore settimanali. I ragazzi in stage delle scuole invece lavoravano solo nelle ore di servizio, le ore di punta diciamo. Per quanto riguarda gli chef (e me) la sveglia era alle 06:30 e si andava a dormire intorno all'1:00. Perché poi capitava di spostarsi: sei a Santa Giulia, ma visto che sei a Milano fai un salto a Rho, hai ancora mezz'oretta di tempo e vai ad Assago perché comunque il controllo deve essere fatto. L'orologio è la prima cosa che guardi al mattino ed è l'ultima cosa che guardi quando vai a dormire.";
  const marcoSpeech =
    "Noi quello che facevamo durante il giorno era sì quello per il primo servizio che andava in cronologia di orario, però nei tempi morti, diciamo, o comunque in cui non c'era il servizio, si preparavano le basi per i giorni successivi. Quindi uno staff lavorava per l'altro e viceversa: io lasciavo pronto il lavoro per quelli della sera, quelli della sera lasciavano pronte le basi per quelli della mattina. I lavori che richiedevano lunghe cotture o grandi volumi potevano essere già prodotti e messi in frigorifero, pronti all'uso. Un prodotto che è stato trattato in questo modo, in 15 minuti, non si fa altro che aprire la busta da sottovuoto e rigenerarlo in un forno, a secondo del tipo di consistenza e cottura che deve avere un prodotto. E questo dà una resa perfetta che si usa in ristorazione professionale. Si faceva una stima statistica di quanti produrne. Oggi abbiamo 500 persone, 150 stinchi freschi basteranno. Si tende ad avere sempre di più e non di meno. Con quello che rimaneva si dava comunque la possibilità di poter mantenere un prodotto integro, fresco, da poter utilizzare al servizio successivo.";
  type KitchenTestimonialId = 'carlo' | 'paganini' | 'fausto' | 'fausto2' | 'marco';
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
      dialogueVisibleThreshold: 0.16,
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
      dialogueVisibleThreshold: 0.16,
      imageAspectRatio: 519 / 315,
      imageAlt: '',
      imageSrc: '/images/stefano-paganini-figma.svg',
      metaLabel: 'Executive Chef - Stefano Paganini',
      name: 'Stefano Paganini',
      rolePrefix: 'Executive Chef - ',
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
      ariaLabel: 'Prima testimonianza Fausto Meli',
      audioSrc: '/sound/faustocucina1.mp3',
      dialogueVisibleThreshold: 0.16,
      enterProgress: 0.248,
      exitProgress: 0.44,
      imageAspectRatio: 1394 / 574,
      imageAlt: '',
      imageSrc: '/images/fausto.svg',
      metaLabel: 'Executive Chef - Fausto Meli',
      name: 'Fausto Meli',
      rolePrefix: 'Executive Chef - ',
      revealSpeechWithAudio: true,
      speech: faustoSpeech,
      widthMax: 360,
      widthMin: 305,
      widthVw: 0.235,
      bottomOffset: 600
    },
    {
      id: 'fausto2',
      ariaLabel: 'Seconda testimonianza Fausto Meli',
      audioSrc: '/sound/fausto2ok.mp3',
      dialogueVisibleThreshold: 0.16,
      enterProgress: 0.47,
      exitProgress: 0.55,
      imageAspectRatio: 1394 / 574,
      imageAlt: '',
      imageSrc: '/images/fausto.svg',
      metaLabel: 'Executive Chef - Fausto Meli',
      name: 'Fausto Meli',
      rolePrefix: 'Executive Chef - ',
      revealSpeechWithAudio: true,
      speech: faustoSecondSpeech,
      widthMax: 360,
      widthMin: 305,
      widthVw: 0.235,
      bottomOffset: 600
    },
    {
      id: 'marco',
      ariaLabel: 'Testimonianza Marco Frassante',
      audioSrc: '/sound/marcofrassantecucina.mp3',
      dialogueVisibleThreshold: 0.16,
      enterProgress: 0.57,
      exitProgress: 1,
      imageAspectRatio: 2960 / 1276,
      imageAlt: '',
      imageSrc: '/assets/interviews-hover/marco.png',
      metaLabel: 'Executive Chef - Marco Frassante',
      name: 'Marco Frassante',
      rolePrefix: 'Executive Chef - ',
      revealSpeechWithAudio: true,
      speech: marcoSpeech,
      widthMax: 360,
      widthMin: 305,
      widthVw: 0.235,
      bottomOffset: 600
    }
  ];
  const carloTestimonial = kitchenTestimonials[0];
  const paganiniTestimonial = kitchenTestimonials[1];
  const faustoTestimonial = kitchenTestimonials[2];
  const fausto2Testimonial = kitchenTestimonials[3];
  const marcoTestimonial = kitchenTestimonials[4];
  const kitchenProgressTicks = $derived(getKitchenProgressTicks());
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
    },
    fausto2: {
      hasPlayed: false,
      hasUnlocked: false,
      isStarting: false,
      isStopping: false,
      playbackToken: 0
    },
    marco: {
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
  let hoveredKitchenSTooltipId = $state<string>();

  $effect(() => {
    onProgressChange?.(narrativeProgress);
  });

	  let kitchenController:
    | {
        scrollBy: (delta: number) => void;
        beginDrag: (clientX: number) => void;
        dragTo: (clientX: number) => void;
        endDrag: () => void;
        resize: () => void;
        scrollTo: (cameraX: number) => void;
        destroy: () => void;
	      }
	    | undefined;
  let kitchenPhaserGame: KitchenPhaserGameHandle | undefined;
  let phaserResizeTimer: ReturnType<typeof setTimeout> | undefined;
  let phaserLoadingProgress = $state(0);
  let isPhaserReady = $state(false);
  let hasAppliedInitialCameraX = $state(false);
  let pointerLocalX = $state(0);
  let pointerLocalY = $state(0);
  let toolShedAudioEl: HTMLAudioElement;
  let standMixerAudioEl: HTMLAudioElement;
  let coneHoverAudioEl: HTMLAudioElement;
  let cleaningKitHoverAudioEl: HTMLAudioElement;
  let coffeeCupHoverAudioEl: HTMLAudioElement;
  let alarmClockHoverAudioEl: HTMLAudioElement;
  let stoveHoverAudioEl: HTMLAudioElement;
  let constructionAudioEl: HTMLAudioElement;
  let kitchenAmbientAudioEl: HTMLAudioElement;
  let carloAudioEl: HTMLAudioElement;
  let paganiniAudioEl: HTMLAudioElement;
  let faustoAudioEl: HTMLAudioElement;
  let fausto2AudioEl: HTMLAudioElement;
  let marcoAudioEl: HTMLAudioElement;
  let paganiniTrailerVideoEl = $state<HTMLVideoElement>();
  let isPaganiniTrailerPlaying = $state(false);
  let isPaganiniTrailerControlFaded = $state(false);
  let isPaganiniTrailerCtaVisible = $state(false);
  let paganiniTrailerControlFadeTimer: ReturnType<typeof setTimeout> | undefined;
  let paganiniTrailerCtaTimer: ReturnType<typeof setTimeout> | undefined;
  let hasPlayedToolShedHover = false;
  let hasPlayedStandMixerHover = false;
  let standMixerFadeOutTimer: ReturnType<typeof setTimeout> | undefined;
  let isAmbientAudioStarted = false;
  let previousKitchenAmbientMix = -1;
  let previousKitchenAmbientDucked = false;
  let activeTestimonialAudioId = $state<KitchenTestimonialId>();
  let dismissedTestimonialIds = $state<Record<KitchenTestimonialId, boolean>>({
    carlo: false,
    paganini: false,
    fausto: false,
    fausto2: false,
    marco: false
  });
  let testimonialRevealProgress = $state<Record<KitchenTestimonialId, number>>({
    carlo: 0,
    paganini: 0,
    fausto: 0,
    fausto2: 0,
    marco: 0
  });
  let mutedTestimonialPageIndex = $state<Record<KitchenTestimonialId, number>>({
    carlo: 0,
    paganini: 0,
    fausto: 0,
    fausto2: 0,
    marco: 0
  });
  let hasTrackedAudioMuted = false;
  let wasAudioMuted = false;
  let prefersReducedMotion = $state(false);
  let toolShedAudioContext: AudioContext | undefined;
  let toolShedAudioSource: MediaElementAudioSourceNode | undefined;
  const fallbackAudioFadeFrames = new WeakMap<HTMLAudioElement, number>();
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let dragAxis: 'x' | 'y' | undefined;
  let isTouchScrolling = false;
  let touchLastX = 0;
  let touchLastY = 0;
  let isSceneLoaded = $state(false);
  let isSceneRevealed = $state(false);
  let isMobileLoadingIntroEnabled = $state(false);
  let isMobileLoadingIntroFinished = $state(true);
  let mobileLoadingIntroTimer: ReturnType<typeof setTimeout> | undefined;
  let sceneRevealTimer: ReturnType<typeof setTimeout> | undefined;
  const mobileLoadingIntroDurationMs = 1000;
  const sceneRevealDelayMs = 560;
  const isSceneInteractive = $derived(isSceneRevealed);
  let hasPointerScenePosition = $state(false);
  let isPointerOverTestimonialHitbox = $state(false);
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

	  function updatePointerScenePosition(event: PointerEvent) {
	    if (!stageEl || !sceneScale) return;

    const rect = stageEl.getBoundingClientRect();
    const localX = clamp(event.clientX - rect.left, 0, rect.width);
	    const localY = clamp(event.clientY - rect.top, 0, rect.height);

    pointerLocalX = localX;
    pointerLocalY = localY;
	    hasPointerScenePosition = true;
    pointerSceneY = screenToFigmaY(localY, sceneScale, viewportHeight, kitchenConstructionFloorTopY);
	    pointerSceneX = {
	      background: (localX + cameraX * resolvedLayerSpeed.background) / sceneScale,
	      middle: (localX + cameraX * resolvedLayerSpeed.middle) / sceneScale,
	      foreground: (localX + cameraX * resolvedLayerSpeed.foreground) / sceneScale
    };
    isPointerOverTestimonialHitbox = isPointerInsideVisibleTestimonial(event);
    kitchenPhaserGame?.setObjectHoverSuppressed(isPointerOverTestimonialHitbox);
    setHoveredKitchenSTooltipId(getHoveredKitchenSTooltipId());
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
    if (!isSceneInteractive) return;
    kitchenController?.scrollBy(delta);
  }

  function isInteractiveSceneEventTarget(target: EventTarget | null) {
    return target instanceof Element && target.closest(touchScrollInteractiveSelector) !== null;
  }

  function isTextInputEventTarget(target: EventTarget | null) {
    return target instanceof Element && target.closest('input, textarea, select') !== null;
  }

  function getNextTestimonial(testimonial: KitchenTestimonial) {
    const index = kitchenTestimonials.findIndex((candidate) => candidate.id === testimonial.id);
    return index >= 0 ? kitchenTestimonials[index + 1] : undefined;
  }

  function cameraXToProgress(value: number) {
    if (maxScrollX <= 0) return 0;
    return clamp(value / maxScrollX, 0, 1);
  }

  function getKitchenProgressTicks() {
    if (maxScrollX <= 0) return [];

    return [
      cameraXToProgress(kitchenDialogueCameraRanges.paganini.dialogueStart),
      cameraXToProgress(kitchenDialogueCameraRanges.fausto.dialogueStart),
      cameraXToProgress(kitchenDialogueCameraRanges.fausto2.dialogueStart),
      cameraXToProgress(kitchenDialogueCameraRanges.marco.dialogueStart)
    ];
  }

  function getTestimonialCameraRange(testimonial: KitchenTestimonial) {
    return kitchenDialogueCameraRanges[testimonial.id];
  }

  function getTestimonialEnterProgress(testimonial: KitchenTestimonial) {
    const range = getTestimonialCameraRange(testimonial);
    if (!range) return testimonial.enterProgress;

    return cameraXToProgress(range.enter);
  }

  function getTestimonialExitProgress(testimonial: KitchenTestimonial) {
    const range = getTestimonialCameraRange(testimonial);
    if (!range) return testimonial.exitProgress;

    return cameraXToProgress(Math.max(range.exit, range.enter + viewportWidth * 0.32));
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

  function getActiveUnfinishedTestimonial() {
    const activeTestimonial = kitchenTestimonials.find(
      (testimonial) => testimonial.id === activeTestimonialAudioId
    );
    if (activeTestimonial && isTestimonialAudioUnfinished(activeTestimonial)) {
      return activeTestimonial;
    }

    return kitchenTestimonials.find((testimonial) => isTestimonialAudioUnfinished(testimonial));
  }

  function getTestimonialExitCameraX(testimonial: KitchenTestimonial) {
    const range = getTestimonialCameraRange(testimonial);
    if (!range) return undefined;

    return clamp(Math.max(range.exit, range.enter + viewportWidth * 0.32), 0, maxScrollX);
  }

  function applyTestimonialScrollResistance(nextValue: number, baseValue: number) {
    const delta = nextValue - baseValue;
    if (delta <= 0 || maxScrollX <= 0) return nextValue;

    const activeTestimonial = getActiveUnfinishedTestimonial();
    if (!activeTestimonial) return nextValue;

    const range = getTestimonialCameraRange(activeTestimonial);
    const exitCameraX = getTestimonialExitCameraX(activeTestimonial);
    if (!range || exitCameraX === undefined) return nextValue;

    const enterCameraX = clamp(range.enter, 0, maxScrollX);
    const stickyStart = Math.max(
      enterCameraX,
      exitCameraX - testimonialHandoffSticky.zoneBeforeDisappearPx
    );
    const stickyEnd = exitCameraX;
    if (cameraX < stickyStart || cameraX > stickyEnd) return nextValue;

    const releaseProgress = clamp(
      (cameraX - stickyStart) / Math.max(stickyEnd - stickyStart, 1),
      0,
      1
    );
    const factor =
      testimonialHandoffSticky.maxFactor -
      smoothProgress(releaseProgress) *
        (testimonialHandoffSticky.maxFactor - testimonialHandoffSticky.minFactor);

    return baseValue + delta * factor;
  }

  function getTitleStyle() {
    const titleFontSize = Math.min(180 * sceneScale, Math.max(56, (viewportWidth - 48) / 4.55));
    const topbarGutter = viewportWidth <= 760 ? 24 : 80;

    return [
      `left: ${scenePx(topbarGutter - cameraX * resolvedLayerSpeed.title)}`,
      `top: ${scenePx(viewportHeight / 2 - 132 * sceneScale)}`,
      `font-size: ${scenePx(titleFontSize)}`
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

  function getPhaserObjectScrollFactor(asset: SceneAsset) {
    if (asset.id.startsWith('2-')) return phaserObjectScrollFactor.middle;
    if (asset.layer === 'foreground') return phaserObjectScrollFactor.foreground;

    return resolvedLayerSpeed[asset.layer as keyof typeof resolvedLayerSpeed] ?? 1;
  }

  function getKitchenSTooltipStyle(asset: SceneAsset) {
    const x = tailAwareFigmaX(asset.x, asset.isTail, tailStartX) * sceneScale - cameraX * getPhaserObjectScrollFactor(asset);
    const top = viewportHeight - (kitchenConstructionFloorTopY - asset.y) * sceneScale;

    return [
      `width: ${scenePx(asset.width * sceneScale)}`,
      `height: ${scenePx(asset.height * sceneScale)}`,
      `top: ${scenePx(top)}`,
      `transform: translate3d(${scenePx(x)}, 0, 0)`,
      asset.zOffset !== undefined ? `--scene-z-offset: ${asset.zOffset}` : ''
    ]
      .filter(Boolean)
      .join(';');
  }

  function getPaganiniTrailerVideoStyle() {
    const x = paganiniTrailerVideo.cameraX - cameraX;
    const top = viewportHeight - (kitchenConstructionFloorTopY - paganiniTrailerVideo.y) * sceneScale;

    return [
      `width: ${scenePx(paganiniTrailerVideo.width * sceneScale)}`,
      `height: ${scenePx(paganiniTrailerVideo.height * sceneScale)}`,
      `top: ${scenePx(top)}`,
      `transform: translate3d(${scenePx(x)}, 0, 0)`
    ].join(';');
  }

  function togglePaganiniTrailerVideo(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!paganiniTrailerVideoEl) return;

    if (paganiniTrailerVideoEl.paused) {
      void paganiniTrailerVideoEl.play();
      return;
    }

    paganiniTrailerVideoEl.pause();
  }

  function clearPaganiniTrailerControlFadeTimer() {
    if (!paganiniTrailerControlFadeTimer) return;
    clearTimeout(paganiniTrailerControlFadeTimer);
    paganiniTrailerControlFadeTimer = undefined;
  }

  function clearPaganiniTrailerCtaTimer() {
    if (!paganiniTrailerCtaTimer) return;
    clearTimeout(paganiniTrailerCtaTimer);
    paganiniTrailerCtaTimer = undefined;
  }

  function showPaganiniTrailerControl() {
    clearPaganiniTrailerControlFadeTimer();
    isPaganiniTrailerControlFaded = false;
  }

  function onPaganiniTrailerPlay() {
    isPaganiniTrailerPlaying = true;
    isPaganiniTrailerControlFaded = false;
    isPaganiniTrailerCtaVisible = false;
    clearPaganiniTrailerControlFadeTimer();
    clearPaganiniTrailerCtaTimer();
    paganiniTrailerControlFadeTimer = setTimeout(() => {
      if (isPaganiniTrailerPlaying) isPaganiniTrailerControlFaded = true;
      paganiniTrailerControlFadeTimer = undefined;
    }, 1000);
    paganiniTrailerCtaTimer = setTimeout(() => {
      if (isPaganiniTrailerPlaying) isPaganiniTrailerCtaVisible = true;
      paganiniTrailerCtaTimer = undefined;
    }, 3500);
  }

  function onPaganiniTrailerPause() {
    isPaganiniTrailerPlaying = false;
    clearPaganiniTrailerCtaTimer();
    showPaganiniTrailerControl();
  }

  function stopPaganiniTrailerControlEvent(event: Event) {
    event.stopPropagation();
  }

  function saveKitchenReturnCameraX() {
    if (!browser) return;
    sessionStorage.setItem(kitchenReturnCameraStorageKey, String(Math.round(cameraX)));
  }

  function getHoveredKitchenSTooltipId() {
    if (!hasPointerScenePosition || isPointerOverTestimonialHitbox) return undefined;

    for (let index = kitchenSTooltipAssets.length - 1; index >= 0; index -= 1) {
      const asset = kitchenSTooltipAssets[index];
      const x = tailAwareFigmaX(asset.x, asset.isTail, tailStartX) * sceneScale - cameraX * getPhaserObjectScrollFactor(asset);
      const y = viewportHeight - (kitchenConstructionFloorTopY - asset.y) * sceneScale;
      const width = asset.width * sceneScale;
      const height = asset.height * sceneScale;
      const isInside =
        pointerLocalX >= x &&
        pointerLocalX <= x + width &&
        pointerLocalY >= y &&
        pointerLocalY <= y + height;

      if (isInside) return asset.id;
    }

    return undefined;
  }

  function setHoveredKitchenSTooltipId(nextId: string | undefined) {
    if (hoveredKitchenSTooltipId === nextId) return;

    hoveredKitchenSTooltipId = nextId;
    if (nextId) playKitchenSTooltipHoverSound(nextId);
  }

  function isPointerInsideVisibleTestimonial(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return false;

    const testimonialEl = target.closest<HTMLElement>('.chef-button.is-dialogue-visible');
    if (!testimonialEl) return false;

    const pointerX = event.clientX;
    const pointerY = event.clientY;
    const hitboxPadding = 10;
    const testimonialRect = testimonialEl.getBoundingClientRect();
    const bubbleRect = testimonialEl.querySelector<HTMLElement>('.speech-bubble')?.getBoundingClientRect();
    const hitRects = [testimonialRect, bubbleRect].filter((rect): rect is DOMRect => Boolean(rect));

    return hitRects.some(
      (rect) =>
        pointerX >= rect.left - hitboxPadding &&
        pointerX <= rect.right + hitboxPadding &&
        pointerY >= rect.top - hitboxPadding &&
        pointerY <= rect.bottom + hitboxPadding
    );
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
    const enter = clamp((narrativeProgress - getTestimonialEnterProgress(testimonial)) / 0.012, 0, 1);
    const exitProgress = getTestimonialExitProgress(testimonial);
    const exit =
      exitProgress === undefined
        ? 1
        : 1 - clamp((narrativeProgress - exitProgress) / 0.012, 0, 1);

    return clamp(smoothProgress(enter) * smoothProgress(exit), 0, 1);
  }

  function getTestimonialPresence(testimonial: KitchenTestimonial) {
    if (dismissedTestimonialIds[testimonial.id]) return 0;
    return getRawTestimonialPresence(testimonial);
  }

  function isCameraInTestimonialDialogueRange(testimonial: KitchenTestimonial) {
    const range = getTestimonialCameraRange(testimonial);
    if (!range) return true;

    return cameraX >= range.dialogueStart && cameraX <= range.exit;
  }

  function isTestimonialInDialogueRange(testimonial: KitchenTestimonial) {
    return (
      isCameraInTestimonialDialogueRange(testimonial) &&
      getRawTestimonialPresence(testimonial) > (testimonial.dialogueVisibleThreshold ?? 0.94)
    );
  }

  function isTestimonialDialogueVisible(testimonial: KitchenTestimonial) {
    return (
      isCameraInTestimonialDialogueRange(testimonial) &&
      getTestimonialPresence(testimonial) > (testimonial.dialogueVisibleThreshold ?? 0.94)
    );
  }

  function getTestimonialBubbleWidth() {
    if (viewportWidth <= 760) return Math.min(330, Math.max(260, viewportWidth - 96));
    return 350;
  }

  function getTestimonialBubbleCopyHeight() {
    if (viewportWidth <= 760) return 142;
    return 172;
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
    if (testimonial.id !== 'fausto' && testimonial.id !== 'fausto2') return 0;

    const translateY = clamp(viewportWidth * 0.08, 92, 145);
    return Math.min(0, (translateY - chefHeight * 0.22) * 0.45);
  }

  function getMarcoTestimonialStyle(presence: number) {
    const assetWidth = 1276;
    const assetHeight = 2960;
    const characterScale = viewportWidth <= 760 ? 1.08 : 1.14;
    const kitchenMatchingWidth = Math.max(315, Math.min(370, viewportWidth * 0.245));
    const kitchenMatchingHeight = kitchenMatchingWidth * (565 / 185) * characterScale;
    const width = kitchenMatchingHeight / (assetHeight / assetWidth);
    const chefHeight = width * (assetHeight / assetWidth);
    const dialogueHeight = getTestimonialBubbleHeight();
    const gap = viewportWidth <= 760 ? 14 : 12;
    const characterLift = viewportWidth <= 760 ? 102 : 182;
    const topInset = testimonialDialogueTopInset;
    const testimonialTop = topInset + dialogueHeight + gap - characterLift;
    const bottomOffset = testimonialTop + chefHeight - viewportHeight;
    const entryY = (1 - presence) * Math.max(360, Math.min(520, viewportHeight * 0.54));
    const bubbleWidth = getTestimonialBubbleWidth();
    const bubbleLeft = viewportWidth <= 760 ? 24 : 80;
    const characterLeft = bubbleLeft + bubbleWidth / 2 - width / 2;
    const bubbleOffsetX = 0;
    const bubbleArrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);
    const dialogueTop = topInset - testimonialTop;

    return [
      `left: ${scenePx(characterLeft)}`,
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

  function getTestimonialStyle(testimonial: KitchenTestimonial) {
    const presence = getTestimonialPresence(testimonial);
    if (testimonial.id === 'marco') return getMarcoTestimonialStyle(presence);

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
    return testimonial.speech;
  }

  function getTestimonialSpeechPageCharacters() {
    const isMobile = viewportWidth <= 760;
    const bubbleWidth = getTestimonialBubbleWidth();
    const fontSize = isMobile ? 13 : 15;
    const horizontalPadding = isMobile ? 36 : 40;
    const verticalPadding = isMobile ? 36 : 34;
    const pageControlsHeight = 34;
    const copyHeight = getTestimonialBubbleCopyHeight();
    const lineHeight = fontSize * 1.34;
    const textHeight = copyHeight - verticalPadding - pageControlsHeight - 8;
    const lines = Math.max(3, Math.floor(textHeight / lineHeight));
    const charactersPerLine = Math.max(
      18,
      Math.floor((bubbleWidth - horizontalPadding) / (fontSize * 0.56))
    );

    return Math.max(88, Math.floor(charactersPerLine * lines * 0.82));
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

  function getVisibleTestimonialPageIndex(testimonial: KitchenTestimonial) {
    if (isAudioMuted) return getMutedTestimonialPageIndex(testimonial);

    const pages = getTestimonialSpeechPages(testimonial);
    if (!testimonial.revealSpeechWithAudio || pages.length <= 1) return 0;

    const spokenLength = Math.ceil(
      pages.join(' ').length * testimonialRevealProgress[testimonial.id]
    );
    let pageStart = 0;

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const pageEnd = pageStart + page.length;
      if (spokenLength <= pageEnd || index === pages.length - 1) return index;
      pageStart = pageEnd + 1;
    }

    return 0;
  }

  function getMutedTestimonialResumeInfo(testimonial: KitchenTestimonial) {
    const pages = paginateTestimonialSpeech(getMutedResumeSpeech(testimonial));
    const pageIndex = clamp(mutedTestimonialPageIndex[testimonial.id], 0, Math.max(pages.length - 1, 0));
    const pageStart = getPageStartCharacterIndex(pages, pageIndex);

    const normalizedSpeech = pages.join(' ');
    return {
      part: 1 as const,
      progress: clamp(pageStart / Math.max(normalizedSpeech.length, 1), 0, 0.98)
    };
  }

  function syncMutedTestimonialPageIndexFromReveal(testimonial: KitchenTestimonial) {
    const pages = paginateTestimonialSpeech(getMutedResumeSpeech(testimonial));
    const normalizedSpeech = pages.join(' ');
    const characterOffset = testimonialRevealProgress[testimonial.id] * normalizedSpeech.length;

    mutedTestimonialPageIndex[testimonial.id] = getPageIndexForCharacterOffset(
      pages,
      characterOffset
    );
  }

  function getTestimonialPageStartProgress(pages: string[], pageIndex: number) {
    const normalizedSpeech = pages.join(' ');
    const pageStart = getPageStartCharacterIndex(pages, pageIndex);
    return clamp(pageStart / Math.max(normalizedSpeech.length, 1), 0, 0.98);
  }

  function setTestimonialPage(testimonial: KitchenTestimonial, pageIndex: number) {
    const pages = getTestimonialSpeechPages(testimonial);
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted) {
      mutedTestimonialPageIndex[testimonial.id] = nextPageIndex;
      return;
    }

    const audio = getTestimonialAudioEl(testimonial);
    if (!audio) {
      mutedTestimonialPageIndex[testimonial.id] = nextPageIndex;
      return;
    }

    const progress = getTestimonialPageStartProgress(pages, nextPageIndex);
    mutedTestimonialPageIndex[testimonial.id] = nextPageIndex;
    testimonialRevealProgress[testimonial.id] = progress;
    audio.currentTime = getAudioTimeForRevealProgress(testimonial, audio, progress);
  }

  function hasNextTestimonialPage(testimonial: KitchenTestimonial) {
    return getVisibleTestimonialPageIndex(testimonial) < getTestimonialSpeechPages(testimonial).length - 1;
  }

  function hasPreviousTestimonialPage(testimonial: KitchenTestimonial) {
    return getVisibleTestimonialPageIndex(testimonial) > 0;
  }

  function advanceTestimonialPage(event: PointerEvent | MouseEvent, testimonial: KitchenTestimonial) {
    event.stopPropagation();
    setTestimonialPage(testimonial, getVisibleTestimonialPageIndex(testimonial) + 1);
  }

  function rewindTestimonialPage(event: PointerEvent | MouseEvent, testimonial: KitchenTestimonial) {
    event.stopPropagation();
    setTestimonialPage(testimonial, getVisibleTestimonialPageIndex(testimonial) - 1);
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

  function getPendingSpeech(testimonial: KitchenTestimonial) {
    const { highlightedSpeech, speech } = getCurrentSpeechPageInfo(testimonial);
    return speech.slice(highlightedSpeech.length);
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
  }

  function completeTestimonialSpeechReveal(testimonial: KitchenTestimonial) {
    testimonialRevealProgress[testimonial.id] = 1;
  }

  function finishTestimonialDialogue(testimonial: KitchenTestimonial) {
    completeTestimonialSpeechReveal(testimonial);
    dismissedTestimonialIds[testimonial.id] = true;
    if (activeTestimonialAudioId === testimonial.id) activeTestimonialAudioId = undefined;
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
    revealProgress: number
  ) {
    const startTime = testimonial.audioStartTime ?? 0;
    const fallbackDuration = testimonial.revealDurationSeconds ?? 1;
    const audioDuration =
      Number.isFinite(audio.duration) && audio.duration > startTime
        ? audio.duration - startTime
        : fallbackDuration;
    const revealDuration = testimonial.revealDurationSeconds ?? audioDuration;

    return startTime + clamp(revealProgress, 0, 0.98) * Math.max(revealDuration, 0.001);
  }

  function onWheel(event: WheelEvent) {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

    event.preventDefault();
    if (!isSceneInteractive) return;
    void startAmbientAudio();
    unlockRelevantTestimonialAudio();
    scrollBy(delta * 0.84);
  }

  function canStartTouchScroll(target: EventTarget | null) {
    return target instanceof Element && !target.closest(touchScrollInteractiveSelector);
  }

  function onTouchStart(event: TouchEvent) {
    if (!isSceneInteractive || event.touches.length !== 1 || !canStartTouchScroll(event.target)) {
      isTouchScrolling = false;
      return;
    }

    const touch = event.touches[0];
    touchLastX = touch.clientX;
    touchLastY = touch.clientY;
    isTouchScrolling = true;
    void startAmbientAudio();
    unlockRelevantTestimonialAudio();
  }

  function onTouchMove(event: TouchEvent) {
    if (!isTouchScrolling || !isSceneInteractive || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchLastX;
    const deltaY = touch.clientY - touchLastY;
    touchLastX = touch.clientX;
    touchLastY = touch.clientY;

    const dominantDelta = Math.abs(deltaY) > Math.abs(deltaX) ? -deltaY : -deltaX;
    if (Math.abs(dominantDelta) < touchScrollDeadZone) return;

    event.preventDefault();
    scrollBy(dominantDelta * touchScrollFactor);
    unlockRelevantTestimonialAudio();
  }

  function onTouchEnd() {
    isTouchScrolling = false;
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    if (event.button !== 0) return;
    if (isInteractiveSceneEventTarget(event.target)) return;
    if (!isSceneInteractive) {
      event.preventDefault();
      return;
    }
    updatePointerScenePosition(event);
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragAxis = undefined;
    void startAmbientAudio();
    unlockRelevantTestimonialAudio();
    kitchenController?.beginDrag(event.clientX);
    stageEl.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    if (!isSceneInteractive) return;
    updatePointerScenePosition(event);
    if (!isDragging) return;
    const dragDeltaX = event.clientX - dragStartX;
    const dragDeltaY = event.clientY - dragStartY;
    if (!dragAxis && Math.max(Math.abs(dragDeltaX), Math.abs(dragDeltaY)) > 6) {
      dragAxis = Math.abs(dragDeltaY) > Math.abs(dragDeltaX) ? 'y' : 'x';
      if (dragAxis === 'y') kitchenController?.beginDrag(dragStartY);
    }
    kitchenController?.dragTo(dragAxis === 'y' ? event.clientY : event.clientX);
    unlockRelevantTestimonialAudio();
  }

  function onPointerLeave() {
    if (!isDragging) {
      hasPointerScenePosition = false;
      isPointerOverTestimonialHitbox = false;
      setHoveredKitchenSTooltipId(undefined);
      kitchenPhaserGame?.setObjectHoverSuppressed(false);
    }
  }

  function endDrag(event: PointerEvent) {
    isDragging = false;
    dragAxis = undefined;
    kitchenController?.endDrag();
    updatePointerScenePosition(event);
    kitchenPhaserGame?.setObjectHoverSuppressed(isPointerOverTestimonialHitbox);
    if (stageEl.hasPointerCapture(event.pointerId)) {
      stageEl.releasePointerCapture(event.pointerId);
    }
  }

  function onContextMenu() {
    isDragging = false;
    dragAxis = undefined;
    kitchenController?.endDrag();
  }

  function onKeydown(event: KeyboardEvent) {
    const isSceneScrollKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    if (isTextInputEventTarget(event.target)) return;
    if (!isSceneInteractive) {
      if (isSceneScrollKey) event.preventDefault();
      return;
    }
    if (!isSceneScrollKey) return;
    event.preventDefault();
    void startAmbientAudio();
    unlockRelevantTestimonialAudio();
    scrollBy(event.key === 'ArrowLeft' ? -33 : 33);
  }

  function boostToolShedAudio() {
    if (!toolShedAudioEl || toolShedAudioSource) return;

    const AudioContextConstructor = getCompatibleAudioContextConstructor();
    if (!AudioContextConstructor) return;

    toolShedAudioContext = new AudioContextConstructor();
    toolShedAudioSource = toolShedAudioContext.createMediaElementSource(toolShedAudioEl);
    const gain = toolShedAudioContext.createGain();
    gain.gain.value = 1.1;
    toolShedAudioSource.connect(gain);
    gain.connect(toolShedAudioContext.destination);
  }

  function playHoverSound(audio: HTMLAudioElement | undefined, volume = 0.78, startTime = 0.35) {
    if (isAudioMuted || !audio) return;
    audio.pause();
    audio.currentTime = startTime;
    audio.volume = volume;
    void audio.play().catch(() => {});
  }

  function getKitchenSTooltipHoverAudio(soundId: keyof typeof kitchenSTooltipSoundFileById) {
    if (soundId === 'cone') return coneHoverAudioEl;
    if (soundId === 'cleaningKit') return cleaningKitHoverAudioEl;
    if (soundId === 'coffeeCup') return coffeeCupHoverAudioEl;
    if (soundId === 'alarmClock') return alarmClockHoverAudioEl;
    if (soundId === 'stove') return stoveHoverAudioEl;
    if (soundId === 'standMixer') return standMixerAudioEl;
    if (soundId === 'toolbox') return toolShedAudioEl;
    return undefined;
  }

  const standMixerHoverVolume = 0.05;
  const standMixerFadeOutLead = 0.48;
  const standMixerFadeOutDuration = 0.42;

  function getKitchenSTooltipHoverVolume(soundId: keyof typeof kitchenSTooltipSoundFileById) {
    if (soundId === 'standMixer') return standMixerHoverVolume;
    if (soundId === 'toolbox') return 0.22;
    if (soundId === 'alarmClock') return 0.46;
    if (soundId === 'stove') return 0.42;
    return 0.58;
  }

  function playKitchenSTooltipHoverSound(assetId: string) {
    const soundId = kitchenSTooltipSoundById[assetId];
    if (!soundId) return;

    if (soundId === 'toolbox') {
      boostToolShedAudio();
      void toolShedAudioContext?.resume();
    }

    if (soundId === 'standMixer') {
      playStandMixerAudioWithFade(getKitchenSTooltipHoverVolume(soundId));
      return;
    }

    playHoverSound(getKitchenSTooltipHoverAudio(soundId), getKitchenSTooltipHoverVolume(soundId), 0);
  }

  function pauseAllKitchenHoverSounds() {
    [
      toolShedAudioEl,
      standMixerAudioEl,
      coneHoverAudioEl,
      cleaningKitHoverAudioEl,
      coffeeCupHoverAudioEl,
      alarmClockHoverAudioEl,
      stoveHoverAudioEl
    ].forEach((audio) => audio?.pause());
  }

  function getKitchenAmbientMix() {
    return clamp(
      (cameraX - kitchenAmbientSwitchCameraX) / kitchenAmbientCrossfadeDistance,
      0,
      1
    );
  }

  function getKitchenAmbientTargetVolumes() {
    const mix = getKitchenAmbientMix();
    const voiceDuck = activeTestimonialAudioId ? 0.18 : 1;

    return {
      construction: isAudioMuted ? 0 : constructionAmbientVolume * (1 - mix) * voiceDuck,
      kitchen: isAudioMuted ? 0 : kitchenBackgroundAmbientVolume * mix * voiceDuck
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

  function clearStandMixerFadeOutTimer() {
    if (!standMixerFadeOutTimer) return;
    clearTimeout(standMixerFadeOutTimer);
    standMixerFadeOutTimer = undefined;
  }

  function scheduleStandMixerFadeOut() {
    if (!standMixerAudioEl) return;

    clearStandMixerFadeOutTimer();

    const duration = standMixerAudioEl.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      standMixerAudioEl.addEventListener('loadedmetadata', scheduleStandMixerFadeOut, { once: true });
      return;
    }

    const secondsUntilFade = Math.max(
      duration - standMixerAudioEl.currentTime - standMixerFadeOutLead,
      0
    );

    standMixerFadeOutTimer = setTimeout(() => {
      standMixerFadeOutTimer = undefined;
      if (standMixerAudioEl.paused || standMixerAudioEl.ended) return;

      fadeAudioVolume(standMixerAudioEl, 0, standMixerFadeOutDuration, () => {
        standMixerAudioEl.pause();
        standMixerAudioEl.currentTime = duration;
        standMixerAudioEl.volume = standMixerHoverVolume;
      });
    }, secondsUntilFade * 1000);
  }

  function playStandMixerAudioWithFade(volume = standMixerHoverVolume) {
    if (!standMixerAudioEl) return;

    clearStandMixerFadeOutTimer();
    cancelFallbackAudioFade(standMixerAudioEl);
    gsap?.killTweensOf(standMixerAudioEl);
    playHoverSound(standMixerAudioEl, volume, 0);
    scheduleStandMixerFadeOut();
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

  function syncAmbientAudioVolumes(options: { duration?: number } = {}) {
    if (!isAmbientAudioStarted || isAudioMuted) return;

    const mix = getKitchenAmbientMix();
    const isDucked = Boolean(activeTestimonialAudioId);
    if (Math.abs(mix - previousKitchenAmbientMix) < 0.02 && isDucked === previousKitchenAmbientDucked) {
      return;
    }

    previousKitchenAmbientMix = mix;
    previousKitchenAmbientDucked = isDucked;
    setAmbientAudioVolumes(options);
  }

  async function startAmbientAudio() {
    if (!isSceneRevealed || isAudioMuted || isAmbientAudioStarted || !constructionAudioEl || !kitchenAmbientAudioEl) {
      return;
    }

    constructionAudioEl.loop = true;
    kitchenAmbientAudioEl.loop = true;
    constructionAudioEl.volume = 0;
    kitchenAmbientAudioEl.volume = 0;

    try {
      await Promise.all([constructionAudioEl.play(), kitchenAmbientAudioEl.play()]);
      isAmbientAudioStarted = true;
      previousKitchenAmbientMix = getKitchenAmbientMix();
      previousKitchenAmbientDucked = Boolean(activeTestimonialAudioId);
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
      previousKitchenAmbientMix = -1;
      previousKitchenAmbientDucked = false;
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

    if (!isSceneRevealed && !muted) {
      wasAudioMuted = muted;
      return;
    }

    if (!muted) {
      void startAmbientAudio();
      if (isAmbientAudioStarted) setAmbientAudioVolumes();
      if (wasAudioMuted) resumeVisibleTestimonialAudioFromMutedPage();
      wasAudioMuted = muted;
      return;
    }

    if (!wasAudioMuted) syncMutedTestimonialPagesFromAudio();
    pauseAllKitchenHoverSounds();
    pauseAllTestimonialAudioForMute();
    stopAmbientAudio();
    wasAudioMuted = muted;
  });

  $effect(() => {
    cameraX;
    activeTestimonialAudioId;
    syncAmbientAudioVolumes({ duration: 0.18 });
  });

  $effect(() => {
    if (isAudioMuted) return;

    kitchenTestimonials.forEach((testimonial) => {
      const state = testimonialAudioState[testimonial.id];
      const audio = getTestimonialAudioEl(testimonial);
      const isInDialogueRange = isTestimonialInDialogueRange(testimonial);
      const isDialogueVisible = isTestimonialDialogueVisible(testimonial);

      if (isDialogueVisible) {
        if (!state.hasPlayed && !state.isStarting) {
          void playTestimonialAudio(testimonial, {
            resumeProgress: testimonialRevealProgress[testimonial.id],
            forceReplay: true
          });
        }
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
    playHoverSound(toolShedAudioEl, 0.22);
  }

  function resetToolShedHoverSound() {
    hasPlayedToolShedHover = false;
  }

  function playStandMixerHoverSound() {
    if (hasPlayedStandMixerHover) return;
    hasPlayedStandMixerHover = true;
    playStandMixerAudioWithFade();
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
    if (testimonial.id === 'fausto2') return fausto2AudioEl;
    if (testimonial.id === 'marco') return marcoAudioEl;
    return undefined;
  }

  function getActiveTestimonialAudioEl(testimonial: KitchenTestimonial) {
    return getTestimonialAudioEl(testimonial);
  }

  function pauseAllTestimonialAudioForMute(duration = testimonialAudioFadeOutDuration) {
    kitchenTestimonials.forEach((testimonial) => {
      const state = testimonialAudioState[testimonial.id];
      const audioElements = [getTestimonialAudioEl(testimonial)];

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
      syncTestimonialSpeechReveal(testimonial);
      syncMutedTestimonialPageIndexFromReveal(testimonial);
    });
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

    void playTestimonialAudio(testimonial, {
      resumeProgress: resumeInfo.progress,
      forceReplay: true
    });
  }

  function unlockRelevantTestimonialAudio() {
    kitchenTestimonials.forEach((testimonial) => {
      const enterProgress = getTestimonialEnterProgress(testimonial);
      const unlockStart = enterProgress - 0.04;
      const unlockEnd = (getTestimonialExitProgress(testimonial) ?? enterProgress + 0.06) + 0.03;
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
    if (isAudioMuted || (!options.forceReplay && state.hasPlayed) || !audio) {
      state.isStarting = false;
      return;
    }

    stopAllTestimonialAudio({
      duration: testimonialAudioHandoffFadeOutDuration,
      except: testimonial.id,
      resetReplay: true
    });
    gsap?.killTweensOf(audio);
    state.isStopping = false;
    audio.pause();
    audio.currentTime =
      options.resumeProgress === undefined
        ? (testimonial.audioStartTime ?? 0)
        : getAudioTimeForRevealProgress(testimonial, audio, options.resumeProgress);
    audio.muted = false;
    audio.volume = 0;
    dismissedTestimonialIds[testimonial.id] = false;
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
      fadeAudioVolume(audio, testimonialAudioVolume, testimonialAudioFadeInDuration);
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

    const duration = options.duration ?? testimonialAudioFadeOutDuration;
    const resetReplay = options.resetReplay ?? true;
    if (state.isStopping && duration > 0) return;

    state.playbackToken += 1;
    state.isStarting = false;
    state.isStopping = duration > 0 && !audio.paused;
    if (resetReplay) state.hasPlayed = false;

    syncTestimonialSpeechReveal(testimonial);
    syncMutedTestimonialPageIndexFromReveal(testimonial);
    gsap?.killTweensOf(audio);

    const afterStop = () => {
      audio.pause();
      audio.volume = 1;
      state.isStopping = false;
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
    resources.add(clearPaganiniTrailerControlFadeTimer);
    resources.add(clearPaganiniTrailerCtaTimer);
    const mobileLoadingIntroQuery = window.matchMedia('(max-width: 760px)');
    isMobileLoadingIntroEnabled = mobileLoadingIntroQuery.matches;
    isMobileLoadingIntroFinished = !mobileLoadingIntroQuery.matches;

    if (mobileLoadingIntroQuery.matches) {
      mobileLoadingIntroTimer = setTimeout(() => {
        isMobileLoadingIntroFinished = true;
        mobileLoadingIntroTimer = undefined;
      }, mobileLoadingIntroDurationMs);
      resources.add(() => {
        if (mobileLoadingIntroTimer) clearTimeout(mobileLoadingIntroTimer);
      });
    }

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
            phaserLoadingProgress = 1;
            isPhaserReady = true;
            kitchenPhaserGame?.setObjectHoverSuppressed(isPointerOverTestimonialHitbox);
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
        applyScrollResistance: applyTestimonialScrollResistance,
        bridge,
        config: kitchenSceneConfig,
        getViewport: () => ({ width: viewportWidth, height: viewportHeight }),
        isScrollEnabled: () => isSceneInteractive,
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
    stageEl.addEventListener('click', triggerTapClickFeedback, true);
    resources.addEventListener(stageEl, 'touchstart', onTouchStart as EventListener, { capture: true, passive: true });
    resources.addEventListener(stageEl, 'touchmove', onTouchMove as EventListener, { capture: true, passive: false });
    resources.addEventListener(stageEl, 'touchend', onTouchEnd as EventListener, true);
    resources.addEventListener(stageEl, 'touchcancel', onTouchEnd as EventListener, true);
    resources.addEventListener(window, 'keydown', onKeydown as EventListener);
	    return () => {
      stageEl?.removeEventListener('click', triggerTapClickFeedback, true);
      if (sceneRevealTimer) clearTimeout(sceneRevealTimer);
      if (phaserResizeTimer) clearTimeout(phaserResizeTimer);
      clearStandMixerFadeOutTimer();
      cancelFallbackAudioFade(constructionAudioEl);
      cancelFallbackAudioFade(kitchenAmbientAudioEl);
      pauseAllKitchenHoverSounds();
	      constructionAudioEl?.pause();
      kitchenAmbientAudioEl?.pause();
      stopAllTestimonialAudio({ duration: 0, resetReplay: false });
      void toolShedAudioContext?.close();
      destroyed = true;
      sceneController.destroy();
    };
  });

  $effect(() => {
    if (isSceneLoaded && isPhaserReady && isMobileLoadingIntroFinished) {
      if (!isSceneRevealed && !sceneRevealTimer) {
        sceneRevealTimer = setTimeout(() => {
          isSceneRevealed = true;
          sceneRevealTimer = undefined;
        }, sceneRevealDelayMs);
      }
      return;
    }

    if (sceneRevealTimer) {
      clearTimeout(sceneRevealTimer);
      sceneRevealTimer = undefined;
    }
    isSceneRevealed = false;
  });

  $effect(() => {
    onSceneRevealedChange?.(isSceneRevealed);
  });

  $effect(() => {
    if (hasAppliedInitialCameraX || !isSceneInteractive || !kitchenController) return;
    if (typeof initialCameraX !== 'number' || !Number.isFinite(initialCameraX)) return;

    kitchenController.scrollTo(initialCameraX);
    hasAppliedInitialCameraX = true;
  });
</script>

<section
  bind:this={stageEl}
  class="kitchen-stage"
  class:is-dragging={isDragging}
  class:is-loaded={isSceneRevealed}
  class:is-s-object-hovered={Boolean(hoveredKitchenSTooltipId)}
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
  oncontextmenu={onContextMenu}
>
  <SceneProgressBar progress={narrativeProgress} isVisible={isSceneRevealed} ticks={kitchenProgressTicks} />

  {#if browser}
    <div bind:this={phaserContainerEl} class="kitchen-phaser-layer" aria-hidden="true"></div>
  {/if}
  {#if isSceneRevealed}
    <div class="kitchen-video-container" style={getPaganiniTrailerVideoStyle()}>
      <video
        bind:this={paganiniTrailerVideoEl}
        class="kitchen-scene-video"
        src={paganiniTrailerVideo.src}
        preload="metadata"
        playsinline
        aria-label="Trailer intervista Stefano Paganini"
        onplay={onPaganiniTrailerPlay}
        onpause={onPaganiniTrailerPause}
        onended={onPaganiniTrailerPause}
      >
        <track
          kind="captions"
          src="/assets/kitchen/objects/video-paganini-trailer_v2.vtt"
          srclang="it"
          label="Italiano"
          default
        />
      </video>
      <button
        class="kitchen-video-play-button"
        class:is-playing={isPaganiniTrailerPlaying}
        class:is-faded={isPaganiniTrailerControlFaded}
        type="button"
        aria-label={isPaganiniTrailerPlaying
          ? 'Metti in pausa il trailer di Stefano Paganini'
          : 'Riproduci il trailer di Stefano Paganini'}
        onclick={togglePaganiniTrailerVideo}
        onpointerdown={stopPaganiniTrailerControlEvent}
        onpointerup={stopPaganiniTrailerControlEvent}
        onpointercancel={stopPaganiniTrailerControlEvent}
      >
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          {#if isPaganiniTrailerPlaying}
            <path d="M8.25 6.5V17.5M15.75 6.5V17.5" />
          {:else}
            <path d="M8.5 6.75L17 12L8.5 17.25V6.75Z" />
          {/if}
        </svg>
      </button>
      <a
        class="kitchen-video-full-link"
        class:is-visible={isPaganiniTrailerCtaVisible}
        href="/interviste/video-paganini?source=kitchen"
        aria-label="Guarda l'intervista completa di Stefano Paganini"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={(event) => {
          event.stopPropagation();
          saveKitchenReturnCameraX();
        }}
      >
        Intervista completa
      </a>
    </div>
  {/if}
  {#each kitchenSTooltipAssets as asset (asset.id)}
    <span
      class="kitchen-s-tooltip-hitbox"
      class:kitchen-easteregg-hitbox={asset.id === 'easteregg'}
      class:is-visible={hoveredKitchenSTooltipId === asset.id}
      style={getKitchenSTooltipStyle(asset)}
      aria-hidden="true"
    >
      {#if asset.id === 'easteregg'}
        <span class="kitchen-easteregg-layout" data-node-id="5781:1610">
          <span class="kitchen-easteregg-copy" data-node-id="5692:12640">
            Abbiamo intervistato 7 persone, tra <strong>videochiamate</strong> e
            <strong>incontri</strong> sul posto
          </span>
        </span>
      {:else}
        <span class="kitchen-s-tooltip">{kitchenSTooltipTextById[asset.id] ?? 'sample text'}</span>
      {/if}
    </span>
  {/each}
  {#if isMobileLoadingIntroEnabled && !isMobileLoadingIntroFinished && !isSceneRevealed}
    <div class="kitchen-mobile-loading-intro" role="status" aria-live="polite">
      <svg
        class="kitchen-mobile-loading-intro-graphic"
        viewBox="0 0 253 218"
        aria-labelledby="kitchen-mobile-loading-intro-title"
      >
        <title id="kitchen-mobile-loading-intro-title">Per favore ruota il telefono</title>
        <path
          class="kitchen-mobile-loading-intro-arrow"
          d="M42 183C18 158 8 121 16 86C20 66 29 48 42 33"
        />
        <path class="kitchen-mobile-loading-intro-arrow-fill" d="M7 41L51 30L43 73Z" />
        <path
          class="kitchen-mobile-loading-intro-arrow"
          d="M212 42C236 67 246 104 238 139C234 159 225 177 212 192"
        />
        <path class="kitchen-mobile-loading-intro-arrow-fill" d="M203 188L248 176L211 144Z" />
        <rect
          class="kitchen-mobile-loading-intro-phone"
          x="68.5"
          y="2.5"
          width="116"
          height="213"
          rx="20"
        />
        <rect class="kitchen-mobile-loading-intro-speaker" x="110" y="14" width="36" height="10" rx="5" />
        <text class="kitchen-mobile-loading-intro-copy" x="126.5" y="101" text-anchor="middle">
          <tspan x="126.5" dy="0">Per favore</tspan>
          <tspan x="126.5" dy="16">ruota</tspan>
          <tspan x="126.5" dy="16">il telefono</tspan>
        </text>
      </svg>
    </div>
  {:else if !isSceneRevealed}
    <SceneLoadingProgress progress={phaserLoadingProgress} />
  {/if}

  {#if isSceneRevealed}
    <h1 class="scene-title" style={getTitleStyle()} aria-label="Cucina">Cucina</h1>
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
  {/if}

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
        <span class="speech-bubble-copy has-page-controls" aria-label={getVisibleSpeech(testimonial)}>
          {#if isSpeechHighlightedWithAudio(testimonial)}
            <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
              <span class="speech-bubble-text-line">
                <span class="speech-bubble-text-progress">{getHighlightedSpeech(testimonial)}</span><span
                  class="speech-bubble-text-pending">{getPendingSpeech(testimonial)}</span
                >
              </span>
            </span>
          {:else}
            <span class="speech-bubble-text">{getVisibleSpeech(testimonial)}</span>
          {/if}
          {#if getTestimonialSpeechPages(testimonial).length > 1}
            <span
              class="speech-bubble-page-controls"
              aria-label={`Dialogo ${getVisibleTestimonialPageIndex(testimonial) + 1} di ${getTestimonialSpeechPages(testimonial).length} per ${testimonial.name}`}
            >
              <button
                class="speech-bubble-page-button speech-bubble-page-button-prev"
                type="button"
                aria-label={`Dialogo precedente di ${testimonial.name}`}
                disabled={!hasPreviousTestimonialPage(testimonial)}
                onpointerdown={(event) => rewindTestimonialPage(event, testimonial)}
                onclick={(event) => event.stopPropagation()}
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
                {getVisibleTestimonialPageIndex(testimonial) + 1}/{getTestimonialSpeechPages(testimonial).length}
              </span>
              <button
                class="speech-bubble-page-button speech-bubble-page-button-next"
                type="button"
                aria-label={`Dialogo successivo di ${testimonial.name}`}
                disabled={!hasNextTestimonialPage(testimonial)}
                onpointerdown={(event) => advanceTestimonialPage(event, testimonial)}
                onclick={(event) => event.stopPropagation()}
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
        <span class="speech-bubble-meta" aria-label={testimonial.metaLabel}>
          <span class="speech-bubble-meta-label">
            <span>{testimonial.rolePrefix}</span>
            <strong>{testimonial.name}</strong>
          </span>
        </span>
      </span>
      <img
        class="scene-chef-image"
        src={testimonial.imageSrc}
        alt={testimonial.imageAlt}
        draggable="false"
      />
    </div>
  {/each}
</section>

<audio bind:this={toolShedAudioEl} src="/sound/toolbox.mp3" preload="auto"></audio>
<audio bind:this={standMixerAudioEl} src="/sound/mixer.mp3" preload="auto"></audio>
<audio bind:this={coneHoverAudioEl} src="/sound/conook.mp3" preload="auto"></audio>
<audio bind:this={cleaningKitHoverAudioEl} src="/sound/spruzzinook.mp3" preload="auto"></audio>
<audio bind:this={coffeeCupHoverAudioEl} src="/sound/tazzinaok.mp3" preload="auto"></audio>
<audio bind:this={alarmClockHoverAudioEl} src="/sound/svegliaok.mp3" preload="auto"></audio>
<audio bind:this={stoveHoverAudioEl} src="/sound/fornellook.mp3" preload="auto"></audio>
<audio bind:this={constructionAudioEl} src="/sound/cantiere.mp3" preload="auto"></audio>
<audio bind:this={kitchenAmbientAudioEl} src="/sound/kitchen_backgroundok.mp3" preload="auto"></audio>
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
  src="/sound/faustocucina1.mp3"
  preload="auto"
  onplay={() => {
    if (!faustoAudioEl?.muted) activeTestimonialAudioId = 'fausto';
  }}
  ontimeupdate={() => syncTestimonialSpeechReveal(faustoTestimonial)}
  onpause={() => {
    if (activeTestimonialAudioId === 'fausto') activeTestimonialAudioId = undefined;
  }}
  onended={() => {
    finishTestimonialDialogue(faustoTestimonial);
  }}
></audio>
<audio
  bind:this={fausto2AudioEl}
  src="/sound/fausto2ok.mp3"
  preload="auto"
  onplay={() => {
    if (!fausto2AudioEl?.muted) activeTestimonialAudioId = 'fausto2';
  }}
  ontimeupdate={() => syncTestimonialSpeechReveal(fausto2Testimonial)}
  onpause={() => {
    if (activeTestimonialAudioId === 'fausto2') activeTestimonialAudioId = undefined;
  }}
  onended={() => {
    finishTestimonialDialogue(fausto2Testimonial);
  }}
></audio>
<audio
  bind:this={marcoAudioEl}
  src="/sound/marcofrassantecucina.mp3"
  preload="auto"
  onplay={() => {
    if (!marcoAudioEl?.muted) activeTestimonialAudioId = 'marco';
  }}
  ontimeupdate={() => syncTestimonialSpeechReveal(marcoTestimonial)}
  onpause={() => {
    if (activeTestimonialAudioId === 'marco') activeTestimonialAudioId = undefined;
  }}
  onended={() => {
    finishTestimonialDialogue(marcoTestimonial);
  }}
></audio>

<style>
  .kitchen-stage {
    position: relative;
    width: 100%;
    height: var(--app-viewport-height);
    min-height: var(--app-viewport-height);
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

  .kitchen-stage.is-s-object-hovered:not(.is-dragging) {
    cursor: var(--kitchen-pointer-cursor);
  }

  .kitchen-mobile-loading-intro {
    position: absolute;
    z-index: 30;
    inset: 0;
    display: none;
    place-items: center;
    background: var(--color-surface-page);
    color: var(--color-accent-blue, #2f4f96);
    pointer-events: none;
  }

  .kitchen-mobile-loading-intro-graphic {
    display: block;
    width: min(68vw, 253px);
    max-height: min(52svh, 218px);
  }

  .kitchen-mobile-loading-intro-arrow,
  .kitchen-mobile-loading-intro-phone {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 6;
  }

  .kitchen-mobile-loading-intro-arrow-fill,
  .kitchen-mobile-loading-intro-speaker {
    fill: currentColor;
  }

  .kitchen-mobile-loading-intro-phone {
    fill: var(--color-surface-page);
  }

  .kitchen-mobile-loading-intro-copy {
    fill: currentColor;
    font-family: "JetBrains Mono", var(--font-text);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
  }

  .kitchen-phaser-layer {
    position: absolute;
    z-index: 0;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 260ms ease;
  }

  .kitchen-stage.is-loaded .kitchen-phaser-layer {
    opacity: 1;
    visibility: visible;
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

  .kitchen-stage.is-s-object-hovered:not(.is-dragging) .kitchen-phaser-layer :global(canvas) {
    cursor: var(--kitchen-pointer-cursor) !important;
  }

  .kitchen-video-container {
    position: absolute;
    z-index: 6;
    box-sizing: border-box;
    display: block;
    overflow: hidden;
    border: 2px solid var(--color-text-primary);
    border-radius: var(--radius-s);
    background: var(--color-text-primary);
    box-shadow: 0 14px 26px rgb(42 68 132 / 0.16);
    pointer-events: auto;
    will-change: transform;
  }

  .kitchen-scene-video {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-text-primary);
    object-fit: cover;
    pointer-events: none;
    cursor: var(--kitchen-pointer-cursor);
  }

  .kitchen-video-play-button {
    --kitchen-video-button-scale: 1;

    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    width: clamp(46px, 5vw, 74px);
    height: clamp(46px, 5vw, 74px);
    place-items: center;
    border: 2px solid var(--color-text-primary);
    border-radius: var(--radius-full);
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    box-shadow: 0 10px 18px rgb(42 68 132 / 0.18);
    cursor: var(--kitchen-pointer-cursor);
    opacity: 0;
    padding: 0;
    pointer-events: none;
    transform: translate3d(-50%, -50%, 0) scale(var(--kitchen-video-button-scale));
    transition:
      opacity 160ms ease,
      transform 190ms cubic-bezier(0.18, 1.35, 0.28, 1),
      box-shadow 160ms ease;
    appearance: none;
  }

  .kitchen-video-container:hover .kitchen-video-play-button,
  .kitchen-video-play-button:focus-visible {
    opacity: 0.96;
    pointer-events: auto;
  }

  .kitchen-video-play-button svg {
    display: block;
    width: 48%;
    height: 48%;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.4;
  }

  .kitchen-video-play-button:hover,
  .kitchen-video-play-button:focus-visible {
    opacity: 1;
    box-shadow: 0 12px 22px rgb(42 68 132 / 0.22);
  }

  .kitchen-video-play-button:active {
    --kitchen-video-button-scale: 0.92;
  }

  .kitchen-video-play-button:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 5px;
  }

  .kitchen-video-play-button.is-faded {
    opacity: 0;
  }

  .kitchen-video-container:hover .kitchen-video-play-button.is-faded,
  .kitchen-video-play-button.is-faded:focus-visible {
    opacity: 0.72;
  }

  @media (hover: none) {
    .kitchen-video-play-button,
    .kitchen-video-play-button.is-faded {
      opacity: 0.86;
      pointer-events: auto;
    }
  }

  .kitchen-video-full-link {
    position: absolute;
    right: clamp(12px, 2vw, 24px);
    bottom: clamp(12px, 2vw, 24px);
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: clamp(38px, 4vw, 50px);
    padding: 0 clamp(14px, 2vw, 22px);
    border: 2px solid var(--color-text-primary);
    border-radius: var(--radius-full);
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    box-shadow: 0 10px 18px rgb(42 68 132 / 0.18);
    cursor: var(--kitchen-pointer-cursor);
    font-family: var(--font-text);
    font-size: clamp(12px, 1.15vw, 16px);
    font-weight: 800;
    line-height: 1;
    opacity: 0;
    pointer-events: none;
    text-decoration: none;
    transform: translate3d(0, 8px, 0) scale(0.98);
    transition:
      opacity 180ms ease,
      transform 220ms cubic-bezier(0.18, 1.35, 0.28, 1),
      box-shadow 160ms ease;
  }

  .kitchen-video-full-link.is-visible {
    opacity: 1;
    pointer-events: auto;
    transform: translate3d(0, 0, 0) scale(1);
  }

  .kitchen-video-full-link:hover,
  .kitchen-video-full-link:focus-visible {
    box-shadow: 0 12px 22px rgb(42 68 132 / 0.22);
  }

  .kitchen-video-full-link:active {
    transform: translate3d(0, 0, 0) scale(0.94);
  }

  .kitchen-video-full-link:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 5px;
  }

  .kitchen-s-tooltip-hitbox {
    position: absolute;
    z-index: 7;
    display: block;
    pointer-events: none;
    will-change: transform;
  }

  .kitchen-s-tooltip {
    position: absolute;
    z-index: 1;
    left: 50%;
    bottom: calc(100% + clamp(14px, 2.4vw, 28px));
    box-sizing: border-box;
    display: block;
    width: min(322px, calc(100vw - 48px));
    padding: clamp(12px, 1.4vw, 18px) clamp(14px, 1.6vw, 20px);
    border: 2px solid var(--color-interactive-hover);
    border-radius: var(--radius-s);
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    font-family: "JetBrains Mono", var(--font-text);
    font-size: clamp(13px, 1.1vw, 16px);
    font-style: italic;
    font-weight: 300;
    line-height: 1.35;
    text-align: left;
    opacity: 0;
    transform: translate3d(-50%, 10px, 0);
    transition:
      opacity 140ms ease,
      transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
    word-break: break-word;
  }

  .kitchen-s-tooltip::before,
  .kitchen-s-tooltip::after {
    position: absolute;
    left: 50%;
    width: 0;
    height: 0;
    content: '';
    transform: translateX(-50%);
  }

  .kitchen-s-tooltip::before {
    top: 100%;
    border-top: 14px solid var(--color-interactive-hover);
    border-right: 12px solid transparent;
    border-left: 12px solid transparent;
  }

  .kitchen-s-tooltip::after {
    top: calc(100% - 1px);
    border-top: 12px solid var(--color-surface-page);
    border-right: 11px solid transparent;
    border-left: 11px solid transparent;
  }

  .kitchen-s-tooltip-hitbox.is-visible .kitchen-s-tooltip {
    opacity: 1;
    transform: translate3d(-50%, 0, 0);
  }

  .kitchen-easteregg-hitbox {
    z-index: 8;
  }

  .kitchen-easteregg-layout {
    position: absolute;
    z-index: 1;
    top: calc(100% + 8px);
    left: 50%;
    display: block;
    box-sizing: border-box;
    width: min(285px, calc(100vw - 48px));
    height: 183px;
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

  .kitchen-easteregg-copy {
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

  .kitchen-easteregg-copy strong {
    font-weight: 700;
  }

  .kitchen-easteregg-hitbox.is-visible .kitchen-easteregg-layout {
    opacity: 1;
    visibility: visible;
    transform: translate3d(-50%, 0, 0);
    transition-delay: 240ms, 240ms, 0s;
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
    line-height: 1.2;
    opacity: 0;
    pointer-events: none;
    transform: translate3d(0, -50%, 0);
    transform-origin: center center;
    white-space: nowrap;
    will-change: transform;
  }

  .kitchen-stage.is-loaded .scene-title {
    animation: titleIn 420ms cubic-bezier(0.22, 1, 0.36, 1) 220ms forwards;
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
    position: relative;
    z-index: 0;
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
  }

  .chef-button[data-testimonial='fausto'] img,
  .chef-button[data-testimonial='fausto2'] img {
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
    white-space: nowrap;
    overflow: hidden;
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
    cursor: var(--kitchen-pointer-cursor);
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
    z-index: 9;
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

  @keyframes titleIn {
    from {
      opacity: 0;
      transform: translate3d(0, -50%, 0) scale(0.9);
    }

    to {
      opacity: 1;
      transform: translate3d(0, -50%, 0) scale(1);
    }
  }

  @media (max-width: 760px) {
    .chef-button > .scene-chef-image {
      visibility: hidden !important;
      opacity: 0 !important;
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

  @media (max-width: 900px), (hover: none) and (pointer: coarse), (orientation: portrait) and (max-width: 1250px) and (min-height: 1500px) {
    .chef-button > .scene-chef-image {
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
    .scene-title {
      opacity: 1;
      transform: translate3d(0, -50%, 0);
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
