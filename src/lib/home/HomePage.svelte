<script lang="ts">
  import { goto } from '$app/navigation';
  import VolumeMaxIcon from '$lib/VolumeMaxIcon.svelte';
  import VolumeOffIcon from '$lib/VolumeOffIcon.svelte';
  import { createAnimationCueManager } from '$lib/scene/animation-cues';
  import { createAudioCueManager, type AudioCueConfig } from '$lib/scene/audio-cues';
  import { loadGsap, type Gsap } from '$lib/scene/gsap-loader';
  import { clamp, deg, ease, fixed, px, type CssVars, vh, vw } from '$lib/scene/math';
  import { createSceneResourceScope } from '$lib/scene/resources';
  import { onMount, tick } from 'svelte';

  let reelProgress = 0;
  let reelTravelDirection = 1;
  let pageProgress = 0;
  let brandProgress = 0;
  let homeScreen: HTMLElement;
  let nextScreen: HTMLElement;
  let brandScreen: HTMLElement;
  let brandSubtitleEl: HTMLElement;
  let brandScrollCueEl: HTMLElement;
  let rolesTopBar: HTMLElement;
  let rolesScreen: HTMLElement;
  let reelCards: HTMLElement[] = [];
  let roleCards: HTMLElement[] = [];
  let introLetters: HTMLElement[] = [];
  let nextLetters: HTMLElement[] = [];
  let audioGateCopyLetters: HTMLElement[] = [];
  let introEl: HTMLElement;
  let audioGateButtonEl = $state<HTMLElement>();
  let isAudioGateVisible = $state(true);
  let isAudioGateOpening = $state(false);
  let isAudioMuted = $state(true);
  let audioLabel = $derived(isAudioMuted ? 'Audio disattivato' : 'Audio attivo');
  let isBrandWordSharp = $state(false);
  let isAboutOpen = $state(false);
  let aboutScreenEl = $state<HTMLElement>();
  let gsap: Gsap;
  let flowTween: ReturnType<Gsap['to']> | undefined;
  let cardEnterTween: ReturnType<Gsap['timeline']> | undefined;
  const animations = createAnimationCueManager();
  const sceneResources = createSceneResourceScope();

  const audioRoles = ['ufficio', 'cucina', 'servizio'] as const;
  const homeAudioIds = ['background', ...audioRoles] as const;
  type AudioRole = (typeof audioRoles)[number];
  type HomeAudioId = (typeof homeAudioIds)[number];
  type RoleItem = {
    title: AudioRole;
    description: string;
    speaker: string;
    dialogue: string;
    hoverText: string;
    personSrc: string;
    personNodeId?: string;
    personFillSrc?: string;
    personFillNodeId?: string;
    href?: string;
  };

  const roleAudio: Record<AudioRole, AudioCueConfig> = {
    ufficio: {
      src: '/sound/office.mp3',
      startTime: 0.5,
      maxTime: 0,
      targetVolume: 0.62,
      fadeInDuration: 0.05
    },
    cucina: {
      src: '/sound/kitchen.mp3',
      startTime: 0,
      maxTime: 0,
      targetVolume: 0.42,
      fadeInDuration: 0.12
    },
    servizio: {
      src: '/sound/restaurant.mp3',
      startTime: 0,
      maxTime: 0,
      targetVolume: 1,
      outputGain: 0.92,
      fadeIn: false
    }
  };
  const backgroundAudio: AudioCueConfig = {
    src: '/sound/background_home.mp3',
    startTime: 0,
    targetVolume: 1,
    fadeInDuration: 1.2,
    loop: true
  };
  const roleAudioEntries = audioRoles.map((role) => ({ role, config: roleAudio[role] }));
  type LetterStyleOptions = { start: number; end: number; windowSize: number; invert: boolean; dy: number };

  function setCssVars(el: HTMLElement | undefined, vars: CssVars) {
    if (el) gsap.set(el, vars);
  }

  function setLayerState(el: HTMLElement | undefined, opacity: number, isInteractive: boolean) {
    if (!el) return;
    gsap.set(el, { opacity: fixed(opacity) });
    el.style.pointerEvents = isInteractive ? 'auto' : 'none';
  }

  function getPointerOffset(e: PointerEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return {
      nx: (e.clientX - rect.left) / rect.width - 0.5,
      ny: (e.clientY - rect.top) / rect.height - 0.5
    };
  }

  function parseMessage(msg: string, accentWord: string) {
    const start = accentWord ? msg.indexOf(accentWord) : -1;
    const end   = start >= 0 ? start + accentWord.length : -1;
    return msg.split('').map((letter, i) => ({
      index:    i,
      letter,
      isSpace:  letter === ' ',
      isAccent: start >= 0 && i >= start && i < end
    }));
  }

  function groupWords(characters: ReturnType<typeof parseMessage>) {
    const groups: Array<
      | { type: 'space'; index: number }
      | { type: 'word'; index: number; characters: typeof characters }
    > = [];

    let word: typeof characters = [];
    characters.forEach((character) => {
      if (character.isSpace) {
        if (word.length) {
          groups.push({ type: 'word', index: word[0].index, characters: word });
          word = [];
        }
        groups.push({ type: 'space', index: character.index });
      } else {
        word.push(character);
      }
    });

    if (word.length) groups.push({ type: 'word', index: word[0].index, characters: word });
    return groups;
  }

  const introMessage    = 'Tutti abbiamo visto i video virali sulla cucina delle olimpiadi...';
  const nextMessage     = 'Incontra le persone che hanno reso tutto questo possibile.';
  const audioGateMessage = "Si consiglia l’uso dell’audio per\u00a0una\u00a0migliore esperienza";
  const brandWord       = 'Fuorimenù';
  const brandSubtitle   = 'Dentro le cucine di Milano Cortina 2026';
  const introCharacters = parseMessage(introMessage, 'cucina');
  const nextCharacters  = parseMessage(nextMessage,  'persone');
  const audioGateCharacters = parseMessage(audioGateMessage, '');
  const introWords      = groupWords(introCharacters);
  const audioGateWords  = groupWords(audioGateCharacters);
  const audioGateOrbitDotCount = 64;
  const audioGateOrbitRadius = 49;
  const audioGateCopyRevealDuration = 0.48;
  const audioGateCopyRevealStagger = 0.018;
  const audioGateCopyRevealTotal =
    audioGateCopyRevealDuration + Math.max(audioGateCharacters.length - 1, 0) * audioGateCopyRevealStagger;
  const audioGateDotRevealDuration = 0.32;
  const audioGateDotRevealStagger =
    (audioGateCopyRevealTotal - audioGateDotRevealDuration) / Math.max(audioGateOrbitDotCount - 1, 1);
  const audioGateUtensilRiseDuration = 0.98;
  const audioGateUtensilShakeDuration = 0.62;
  const audioGateUtensilRiseDelay = Math.max(0, audioGateCopyRevealTotal - audioGateUtensilRiseDuration);
  const audioGateUtensilShakeDelay = audioGateCopyRevealTotal;
  const audioGateUtensilIdleDelay = audioGateUtensilShakeDelay + audioGateUtensilShakeDuration;

  function getOrbitPoint(angle: number) {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: 50 + audioGateOrbitRadius * Math.cos(radians),
      y: 50 + audioGateOrbitRadius * Math.sin(radians)
    };
  }

  const audioGateOrbitDots = Array.from({ length: audioGateOrbitDotCount }, (_, index) => ({
    index,
    point: getOrbitPoint((360 / audioGateOrbitDotCount) * index),
    delayMs: Math.max(0, audioGateDotRevealStagger * index * 1000)
  }));

  const brandLetters = brandWord.split('').map((letter, i) => ({ letter, i }));
  const brandLetterIndexes = brandLetters.map((_, i) => i);
  let brandArrivalRank: number[] = new Array(brandLetters.length).fill(0);
  let brandBurstRank: number[] = new Array(brandLetters.length).fill(0);
  let brandBurstMotion = brandLetters.map(() => ({ x: 0, y: 0, rotate: 0 }));
  let brandLetterEls: HTMLElement[] = [];
  let floatingEls: HTMLElement[] = [];
  const rolesRevealStart = 2.24;
  const rolesRevealDuration = 0.34;
  const roleCardStagger = 0.055;
  const roleCardRevealDuration = 0.2;
  const brandScrollMax = rolesRevealStart + rolesRevealDuration;
  const flowTotalMax = 2 + brandScrollMax;
  const copyScrollStart = 1;
  const copyScrollEnd = 2;
  const brandCopyScrollEnd = 3.18;
  const rolesScrollVisible = 2 + brandScrollMax;
  const introLetterOut: LetterStyleOptions = { start: 0.2, end: 0.5, windowSize: 0.08, invert: true, dy: 12 };
  const nextLetterIn: LetterStyleOptions = { start: 0.45, end: 0.92, windowSize: 0.07, invert: false, dy: 12 };
  const aboutClosedVars = { clipPath: 'inset(0 0 0 100%)', xPercent: 6 };
  const aboutOpenVars = { clipPath: 'inset(0 0 0 0%)', xPercent: 0 };
  const aboutMotion = {
    openDuration: 0.52,
    closeDuration: 0.42,
    openEase: 'power3.out',
    closeEase: 'power3.in'
  };
  const audioFadeMotion = { duration: 0.52, ease: 'power2.inOut' };
  const audioCues = createAudioCueManager<HomeAudioId>({ fade: audioFadeMotion });
  audioCues.registerAudioCue('background', backgroundAudio);
  audioRoles.forEach((role) => {
    audioCues.registerAudioCue(role, roleAudio[role]);
  });
  const mountFadeMotion = { delay: 0.4, duration: 2, ease: 'power2.out' };
  const flowMotion = {
    duration: 0.82,
    reelDuration: 0.34,
    ease: 'power3.out',
    autoStepDuration: 1.72,
    autoEase: 'power2.out',
    reverseAutoEase: 'power2.out',
    maxWheelStep: 0.066,
    reverseMaxWheelStep: 0.084,
    maxTargetLead: 0.25,
    reverseMaxTargetLead: 0.34,
    reelScrollSlowdown: 2.1,
    reelMaxTargetLead: 0.88
  };
  const keyFlowSteps: Record<string, number> = {
    ArrowDown: 0.1,
    PageDown: 0.1,
    ' ': 0.1,
    ArrowUp: -0.1,
    PageUp: -0.1
  };
  const roleCardResetVars: CssVars = {
    '--role-bg-x': '0px',
    '--role-bg-y': '0px',
    '--role-copy-x': '0px',
    '--role-copy-y': '0px',
    '--role-dialogue-x': '0px',
    '--role-dialogue-y': '0px',
    '--role-person-x': '0px',
    '--role-person-y': '0px'
  };
  const brandLetterMotion = {
    arrivalSpread: 0.36,
    arrivalDuration: 0.68,
    arrivalDepth: 420,
    introScale: 1.9,
    opacityDelay: 0.42,
    opacityRamp: 0.3,
    burstStart: 1.74,
    burstDuration: 0.84,
    burstSpread: 0.42,
    burstStaggerDuration: 0.38,
    burstScale: 1.35
  };
  const reelMotion = {
    stagger: 0.085,
    startOffset: 0,
    duration: 0.35,
    zStart: -980,
    zRange: 1850,
    scaleStart: 0.28,
    scaleRange: 4.2,
    scaleInDuration: 0.18,
    opacityOutStart: 0.76,
    opacityOutDuration: 0.24,
    rotateStartRatio: 0.35,
    rotateEndRatio: 0.65,
    spreadRadius: 1.4,
    dragTiltX: 11,
    dragTiltY: 13,
    dragZLift: 90,
    dragScale: 0.04,
    mediaParallaxX: 10,
    mediaParallaxY: 7,
    layerParallaxX: 30,
    layerParallaxY: 18,
    layerSpeed: 0,
    layerZ: 240,
    layerScale: 0.075,
    slowIntroEnd: 0.22,
    slowIntroDistance: 0.24,
    slowIntroPower: 1.08,
    viewSlowEnd: 0.84,
    viewSlowDistance: 0.54,
    fastExitPower: 5.2,
    exitSpeedStart: 0.9,
    exitCompletion: 0.72,
    exitPushX: 90,
    exitPushY: 110,
    maxSpreadX: 78,
    maxSpreadY: 60,
    exitMaxSpreadX: 154,
    exitMaxSpreadY: 160,
    autoExitFlowStart: 0.88,
    autoReturnFlowTarget: 0.82,
    autoSettleDuration: 0.36,
    shadowX: 18,
    shadowY: 10
  };
  const floatingMotion = {
    maxDelta: 0.032,
    minPad: 16,
    padRatio: 0.035,
    hoverInDuration: 0.2,
    hoverOutDuration: 0.28,
    hoverStepMultiplier: 4,
    hoverSpeedBoost: 0.75,
    hoverSpinBoost: 0.7,
    tiltDamping: 0.88,
    driftYRatio: 0.82,
    driftRotateRatio: 0.7,
    driftRotateAmount: 5,
    pointerTilt: 22,
    pointerTiltLimit: 14,
    hoverZ: 28,
    hoverScale: 0.035,
    shadowAlpha: 0.28
  };
  const roleParallaxMotion = {
    bgX: -18,
    bgY: -12,
    copyX: 7,
    copyY: 4,
    dialogueX: 2,
    dialogueY: 1.5,
    personX: 12,
    personY: 7
  };
  const floatingExitMotion = {
    start: 1.42,
    duration: 1.16,
    fadeStart: 0.76,
    fadeDuration: 0.34,
    scaleLoss: 0.08,
    pointerCutoff: 0.82
  };
  const brandSubtitleMotion = {
    inStart: 0.7,
    inDuration: 0.22,
    outStart: 2.04,
    outDuration: 0.18,
    enterY: 14,
    exitY: -16
  };

  const roleItems: RoleItem[] = [
    {
      title: 'ufficio',
      description: 'descrizione testo',
      speaker: 'Carlo Zarri',
      dialogue: "il mio ruolo ... seguimi nell'ufficio per saperne di più",
      hoverText: "io sono carlo zarri seguimi nell'ufficio",
      personSrc: '/images/carlo-zarri-figma.png',
      href: '/ufficio'
    },
    {
      title: 'cucina',
      description: 'descrizione testo',
      speaker: 'Stefano Paganini',
      dialogue: 'il mio ruolo ... seguimi nella cucina per saperne di più',
      hoverText: 'io sono stefano paganini seguimi in cucina',
      personSrc: '/images/stefano-paganini-figma.svg',
      href: '/phaser'
    },
    {
      title: 'servizio',
      description: 'descrizione testo',
      speaker: 'Ken Frank',
      dialogue: 'il mio ruolo ... seguimi nella mensa per saperne di più',
      hoverText: 'io sono ken frank seguimi in sala',
      personSrc: '/images/k.png'
    }
  ];

  type FloatingMotion = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    tiltX: number;
    tiltY: number;
    spinAngle: number;
    hover: boolean;
    hoverProgress: number;
  };

  const floatingAssets: Array<{
    src: string;
    label: string;
    className: string;
    nodeId: string;
    exitX: number;
    exitY: number;
    wobble: { x: number; y: number; speed: number; phase: number };
    spin: { speed: number; phase: number };
    motion: FloatingMotion;
  }> = [
    {
      src: '/images/raviolo.svg',
      label: 'Raviolo',
      className: 'floating-raviolo',
      nodeId: '266:413',
      exitX: -7,
      exitY: -112,
      wobble: { x: 8, y: 5, speed: 1.1, phase: 0.2 },
      spin: { speed: 18, phase: -8 },
      motion: { x: 84, y: 96, vx: 92, vy: 74, tiltX: 0, tiltY: 0, spinAngle: 0, hover: false, hoverProgress: 0 }
    },
    {
      src: '/images/pizza.svg',
      label: 'Pizza',
      className: 'floating-pizza',
      nodeId: '2567:2664',
      exitX: 7,
      exitY: -112,
      wobble: { x: 5, y: 7, speed: 0.92, phase: 1.8 },
      spin: { speed: -14, phase: 12 },
      motion: { x: 220, y: 280, vx: -82, vy: 96, tiltX: 0, tiltY: 0, spinAngle: 0, hover: false, hoverProgress: 0 }
    },
    {
      src: '/images/fusillo.svg',
      label: 'Fusillo',
      className: 'floating-fusillo',
      nodeId: '266:420',
      exitX: -3,
      exitY: -126,
      wobble: { x: 12, y: 10, speed: 1.37, phase: 4.4 },
      spin: { speed: 22, phase: 4 },
      motion: { x: 520, y: 132, vx: -63, vy: 117, tiltX: 0, tiltY: 0, spinAngle: 0, hover: false, hoverProgress: 0 }
    }
  ];

  type ReelItem = {
    src: string;
    bg: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    rotate: number;
    layer: -1 | 0 | 1;
    opacityOutStart?: number;
    opacityOutDuration?: number;
  };

  const reels: ReelItem[] = [
    { src: '/videos/tiramisu.mp4', bg: 'var(--reel-placeholder-neutral)', fromX: -8,  fromY:  4, toX: -34, toY: -18, rotate: -8,  layer:  0 },
    { src: '/videos/1.mp4',        bg: 'var(--color-text-primary)',        fromX:  7,  fromY: -3, toX:  30, toY:  16, rotate:  7,  layer:  1 },
    { src: '/videos/2.mp4',        bg: 'var(--reel-placeholder-gold)',     fromX: -4,  fromY: -8, toX: -18, toY:  28, rotate: 10,  layer:  0 },
    { src: '/videos/3.mp4',        bg: 'var(--color-surface-dark)',        fromX: 13,  fromY:  8, toX:  36, toY: -24, rotate: -11, layer:  1, opacityOutStart: 0.58, opacityOutDuration: 0.16 },
    { src: '/videos/4.mp4',        bg: 'var(--reel-placeholder-lavender)', fromX: -10, fromY: -2, toX: -40, toY:   6, rotate: -5,  layer: -1 },
    { src: '/videos/5.mp4',        bg: 'var(--reel-placeholder-neutral)',  fromX:  5,  fromY:  6, toX:  24, toY: -30, rotate:  9,  layer:  0 },
    { src: '/videos/6.mp4',        bg: 'var(--reel-placeholder-gold)',     fromX: -12, fromY:  7, toX: -28, toY:  18, rotate: -12, layer: -1 },
    { src: '/videos/7.mp4',        bg: 'var(--color-text-primary)',        fromX: 10,  fromY: -7, toX:  38, toY:   2, rotate:  5,  layer:  1 },
    { src: '/videos/8.mp4',        bg: 'var(--color-surface-dark)',        fromX: -6,  fromY: -5, toX: -36, toY: -28, rotate:  8,  layer:  0 },
    { src: '/videos/9.mp4',        bg: 'var(--reel-placeholder-lavender)', fromX: 12,  fromY:  3, toX:  42, toY:  24, rotate: -9,  layer:  1 },
    { src: '/videos/10.mp4',       bg: 'var(--reel-placeholder-neutral)',  fromX: -3,  fromY:  9, toX: -16, toY:  34, rotate:  6,  layer: -1 },
    { src: '/videos/11.mp4',       bg: 'var(--color-text-primary)',        fromX:  3,  fromY: -9, toX:  16, toY: -34, rotate: -7,  layer:  0 },
    { src: '/videos/12.mp4',       bg: 'var(--reel-placeholder-gold)',     fromX: -14, fromY:  1, toX: -44, toY:  -4, rotate: 11,  layer: -1 },
    { src: '/videos/13.mp4',       bg: 'var(--color-surface-dark)',        fromX: 14,  fromY: -1, toX:  44, toY:   8, rotate: -10, layer:  1 },
    { src: '/videos/14.mp4',       bg: 'var(--reel-placeholder-lavender)', fromX: -7,  fromY: -10, toX: -22, toY: -36, rotate: -6,  layer:  0 }
  ];

  function shuffleIndexes(indexes: number[]) {
    const shuffled = [...indexes];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function rankOrder(order: number[]) {
    const ranks = new Array(order.length).fill(0);
    order.forEach((letterIndex, rank) => { ranks[letterIndex] = rank; });
    return ranks;
  }

  function randomizeBrandLetters() {
    brandArrivalRank = rankOrder(shuffleIndexes(brandLetterIndexes));
    brandBurstRank = rankOrder(shuffleIndexes(brandLetterIndexes));
    brandBurstMotion = brandLetters.map(() => ({
      x: (Math.random() - 0.5) * 36,
      y: -22 - Math.random() * 28,
      rotate: (Math.random() - 0.5) * 34
    }));
  }

  function applyLetterStyles(
    letters: HTMLElement[],
    progress: number,
    opts: LetterStyleOptions
  ) {
    const { start, end, windowSize, invert, dy } = opts;
    const stagger = (end - start) / Math.max(letters.length - 1, 1);
    letters.forEach((el, i) => {
      if (!el) return;
      const local   = clamp((progress - start - i * stagger) / windowSize);
      const e       = ease(local);
      const opacity = invert ? 1 - e : e;
      const ty      = invert ? e * -dy : (1 - e) * dy;
      setCssVars(el, {
        '--letter-opacity': fixed(opacity),
        '--letter-y': px(ty)
      });
    });
  }

  function applyBrandLetters() {
    if (isBrandWordSharp) isBrandWordSharp = false;

    const n = brandLetterEls.length;
    brandLetterEls.forEach((el, i) => {
      if (!el) return;
      const rank    = brandArrivalRank[i];
      const stagger = brandLetterMotion.arrivalSpread / Math.max(n - 1, 1);
      const local   = clamp((brandProgress - rank * stagger) / brandLetterMotion.arrivalDuration);
      const e       = ease(local);
      const burstRank = brandBurstRank[i];
      const burstStagger = brandLetterMotion.burstSpread / Math.max(n - 1, 1);
      const burstProgress = clamp((brandProgress - brandLetterMotion.burstStart) / brandLetterMotion.burstDuration);
      const burstLocal = clamp((burstProgress - burstRank * burstStagger) / brandLetterMotion.burstStaggerDuration);
      const burst = ease(burstLocal);
      const burstMotion = brandBurstMotion[i];
      const opacityIn = clamp((local - brandLetterMotion.opacityDelay) / brandLetterMotion.opacityRamp);
      setCssVars(el, {
        '--bl-z': px((1 - e) * brandLetterMotion.arrivalDepth),
        '--bl-scale': fixed(1 + (1 - e) * brandLetterMotion.introScale + burst * brandLetterMotion.burstScale),
        '--bl-opacity': fixed(opacityIn * (1 - burst)),
        '--bl-x': px(burstMotion.x * burst),
        '--bl-y': px(burstMotion.y * burst),
        '--bl-rotate': deg(burstMotion.rotate * burst, 1)
      });
    });
  }

  function getReelPresentation(index: number) {
    const reel  = reels[index];
    const availableStaggerWindow = Math.max(0, 1 - reelMotion.startOffset - reelMotion.duration);
    const reelStagger = Math.min(reelMotion.stagger, availableStaggerWindow / Math.max(reels.length - 1, 1));
    const local = clamp((reelProgress - index * reelStagger - reelMotion.startOffset) / reelMotion.duration);
    const layer = reel.layer;
    const introEnd = reelMotion.slowIntroEnd;
    const viewEnd = reelMotion.viewSlowEnd;
    const travel = local < introEnd
      ? reelMotion.slowIntroDistance * Math.pow(local / introEnd, reelMotion.slowIntroPower)
      : local < viewEnd
        ? reelMotion.slowIntroDistance + (reelMotion.viewSlowDistance - reelMotion.slowIntroDistance) * ease((local - introEnd) / (viewEnd - introEnd))
        : reelMotion.viewSlowDistance + (1 - reelMotion.viewSlowDistance) * (1 - Math.pow(1 - ((local - viewEnd) / (1 - viewEnd)), reelMotion.fastExitPower));
    const entryScale = ease(clamp(local / reelMotion.scaleInDuration));
    const visibility = local > 0 ? 1 : 0;
    const pathX = reel.toX - reel.fromX;
    const pathY = reel.toY - reel.fromY;
    const pathLength = Math.hypot(pathX, pathY) || 1;
    const pathDirectionX = pathX / pathLength;
    const pathDirectionY = pathY / pathLength;
    const dragDirectionX = pathDirectionX * reelTravelDirection;
    const dragDirectionY = pathDirectionY * reelTravelDirection;
    const drag = Math.sin(local * Math.PI) * entryScale;
    const layerTravel = (travel - 0.5) * layer;
    const baseX = reel.fromX + (reel.toX - reel.fromX) * travel;
    const baseY = reel.fromY + (reel.toY - reel.fromY) * travel;
    const exitPhase = clamp((local - reelMotion.exitSpeedStart) / (1 - reelMotion.exitSpeedStart));
    const exitBoost = ease(clamp(exitPhase / reelMotion.exitCompletion));
    const x = baseX * reelMotion.spreadRadius
      + pathDirectionX * reelMotion.layerParallaxX * layerTravel
      + pathDirectionX * reelMotion.exitPushX * exitBoost;
    const y = baseY * reelMotion.spreadRadius
      + pathDirectionY * reelMotion.layerParallaxY * layerTravel
      + pathDirectionY * reelMotion.exitPushY * exitBoost;
    const maxX = reelMotion.maxSpreadX + (reelMotion.exitMaxSpreadX - reelMotion.maxSpreadX) * exitBoost;
    const maxY = reelMotion.maxSpreadY + (reelMotion.exitMaxSpreadY - reelMotion.maxSpreadY) * exitBoost;
    return {
      z:       reelMotion.zStart + travel * reelMotion.zRange + layer * reelMotion.layerZ + drag * reelMotion.dragZLift,
      scale:   (reelMotion.scaleStart + travel * reelMotion.scaleRange + layer * reelMotion.layerScale + drag * reelMotion.dragScale) * entryScale,
      opacity: visibility,
      x:       clamp(x, -maxX, maxX),
      y:       clamp(y, -maxY, maxY),
      rotate:  reel.rotate * (reelMotion.rotateStartRatio + travel * reelMotion.rotateEndRatio),
      tiltX:   -dragDirectionY * reelMotion.dragTiltX * drag,
      tiltY:   dragDirectionX * reelMotion.dragTiltY * drag,
      mediaX:  -dragDirectionX * reelMotion.mediaParallaxX * drag,
      mediaY:  -dragDirectionY * reelMotion.mediaParallaxY * drag,
      shadowX: dragDirectionX * reelMotion.shadowX * drag,
      shadowY: 36 + Math.abs(dragDirectionY) * reelMotion.shadowY * drag
    };
  }

  function applyReelStyles() {
    reelCards.forEach((card, i) => {
      if (!card) return;
      const { z, scale, opacity, x, y, rotate, tiltX, tiltY, mediaX, mediaY, shadowX, shadowY } = getReelPresentation(i);
      setCssVars(card, {
        '--x': vw(x),
        '--y': vh(y, 2),
        '--z': px(z),
        '--scale': fixed(scale),
        '--rotate': deg(rotate),
        '--opacity': fixed(opacity),
        '--reel-tilt-x': deg(tiltX),
        '--reel-tilt-y': deg(tiltY),
        '--reel-media-x': px(mediaX),
        '--reel-media-y': px(mediaY),
        '--reel-shadow-x': px(shadowX),
        '--reel-shadow-y': px(shadowY)
      });
    });
  }

  function moveFloatingAssets(time: number, deltaTime: number) {
    if (!brandScreen) return;

    const dt = Math.min(deltaTime / 1000, floatingMotion.maxDelta);

    const bounds = brandScreen.getBoundingClientRect();
    const pad    = Math.max(floatingMotion.minPad, Math.min(bounds.width, bounds.height) * floatingMotion.padRatio);

    floatingAssets.forEach((asset, index) => {
      const el = floatingEls[index];
      if (!el) return;

      const motion = asset.motion;
      const width  = el.offsetWidth;
      const height = el.offsetHeight;
      const maxX   = Math.max(pad, bounds.width - width - pad);
      const maxY   = Math.max(pad, bounds.height - height - pad);
      const wobble = asset.wobble;
      const spin = asset.spin;
      const driftTime = time * wobble.speed + wobble.phase;
      const hoverTarget = motion.hover ? 1 : 0;
      const hoverStep = dt / (motion.hover ? floatingMotion.hoverInDuration : floatingMotion.hoverOutDuration);
      motion.hoverProgress = clamp(
        motion.hoverProgress + (hoverTarget - motion.hoverProgress) * hoverStep * floatingMotion.hoverStepMultiplier
      );
      const hoverEase = ease(motion.hoverProgress);
      const hoverBoost = 1 + hoverEase * floatingMotion.hoverSpeedBoost;

      motion.x += motion.vx * dt * hoverBoost;
      motion.y += motion.vy * dt * hoverBoost;
      motion.spinAngle = (motion.spinAngle + spin.speed * dt * (1 + hoverEase * floatingMotion.hoverSpinBoost)) % 360;

      if (motion.x <= pad || motion.x >= maxX) {
        motion.x  = clamp(motion.x, pad, maxX);
        motion.vx = -motion.vx;
      }

      if (motion.y <= pad || motion.y >= maxY) {
        motion.y  = clamp(motion.y, pad, maxY);
        motion.vy = -motion.vy;
      }

      if (!motion.hover) {
        motion.tiltX *= floatingMotion.tiltDamping;
        motion.tiltY *= floatingMotion.tiltDamping;
      }

      setCssVars(el, {
        '--float-x': px(motion.x + Math.sin(driftTime) * wobble.x),
        '--float-y': px(motion.y + Math.cos(driftTime * floatingMotion.driftYRatio) * wobble.y),
        '--float-tilt-x': deg(motion.tiltX),
        '--float-tilt-y': deg(motion.tiltY),
        '--float-rotate': deg(spin.phase + motion.spinAngle + Math.sin(driftTime * floatingMotion.driftRotateRatio) * floatingMotion.driftRotateAmount),
        '--float-hover-z': px(hoverEase * floatingMotion.hoverZ),
        '--float-hover-scale': fixed(1 + hoverEase * floatingMotion.hoverScale),
        '--float-shadow-alpha': fixed(hoverEase * floatingMotion.shadowAlpha)
      });
    });
  }

  function tiltFloatingAsset(e: PointerEvent, index: number) {
    const el = floatingEls[index];
    if (!el) return;
    const { nx, ny } = getPointerOffset(e, el);
    floatingAssets[index].motion.tiltX = clamp(
      -ny * floatingMotion.pointerTilt,
      -floatingMotion.pointerTiltLimit,
      floatingMotion.pointerTiltLimit
    );
    floatingAssets[index].motion.tiltY = clamp(
      nx * floatingMotion.pointerTilt,
      -floatingMotion.pointerTiltLimit,
      floatingMotion.pointerTiltLimit
    );
  }

  function tiltRoleCard(e: PointerEvent, index: number) {
    const card = roleCards[index];
    if (!card) return;

    const { nx, ny } = getPointerOffset(e, card);
    setCssVars(card, {
      '--role-bg-x': px(nx * roleParallaxMotion.bgX),
      '--role-bg-y': px(ny * roleParallaxMotion.bgY),
      '--role-copy-x': px(nx * roleParallaxMotion.copyX),
      '--role-copy-y': px(ny * roleParallaxMotion.copyY),
      '--role-dialogue-x': px(nx * roleParallaxMotion.dialogueX),
      '--role-dialogue-y': px(ny * roleParallaxMotion.dialogueY),
      '--role-person-x': px(nx * roleParallaxMotion.personX),
      '--role-person-y': px(ny * roleParallaxMotion.personY)
    });
  }

  function resetRoleCard(index: number) {
    const card = roleCards[index];
    if (!card) return;
    setCssVars(card, roleCardResetVars);
  }

  function enterRoleCard(event: MouseEvent, item: RoleItem, index: number) {
    if (!item.href || cardEnterTween) return;
    event.preventDefault();

    const card = roleCards[index];
    if (!card) {
      window.location.assign(item.href);
      return;
    }

    stopAllRoleAudio();
    resetRoleCard(index);

    const rect = card.getBoundingClientRect();
    const clone = card.cloneNode(true) as HTMLElement;
    clone.removeAttribute('href');
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.add('is-entering');
    Object.assign(clone.style, {
      position: 'fixed',
      left: px(rect.left),
      top: px(rect.top),
      width: px(rect.width),
      height: px(rect.height),
      margin: '0',
      zIndex: '120',
      pointerEvents: 'none',
      background: 'transparent',
      transform: 'none',
      opacity: '1'
    });

    const bg = clone.querySelector<HTMLElement>('.role-card-bg');
    const copy = clone.querySelector<HTMLElement>('.role-card-copy');
    const hoverPanel = clone.querySelector<HTMLElement>('.role-hover-panel');
    const person = clone.querySelector<HTMLElement>('.role-person');
    const pageFade = document.createElement('div');
    pageFade.className = 'card-enter-fade';
    Object.assign(pageFade.style, {
      position: 'fixed',
      zIndex: '119',
      inset: '0',
      background: 'var(--color-surface-page)',
      pointerEvents: 'none',
      opacity: '0'
    });
    document.body.append(pageFade, clone);
    card.style.visibility = 'hidden';

    gsap.set(pageFade, { opacity: 0 });
    gsap.set(clone, {
      '--role-bg-x': '0px',
      '--role-bg-y': '0px',
      '--role-copy-x': '0px',
      '--role-copy-y': '0px',
      '--role-dialogue-x': '0px',
      '--role-dialogue-y': '0px',
      '--role-person-x': '0px',
      '--role-person-y': '0px'
    });
    gsap.set(bg, { opacity: 1, filter: 'grayscale(1) opacity(0.42)', scale: 1.04 });
    gsap.set([copy, hoverPanel, person], { opacity: 0 });

    cardEnterTween = animations.registerAnimationCue(
      'cardEnter',
      gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        onComplete: () => {
          sessionStorage.setItem('role-card-transition', '1');
          if (item.title === 'cucina') {
            sessionStorage.setItem('kitchen-card-transition', '1');
          }
          void goto(item.href as string);
        }
      })
    );

    cardEnterTween
      .to(pageFade, { opacity: 1, duration: 0.16, ease: 'power2.out' }, 0)
      .set([bg, copy, hoverPanel, person], { opacity: 0 }, 0.02)
      .to(
        clone,
        {
          left: -96,
          top: -96,
          width: window.innerWidth + 192,
          height: window.innerHeight + 192,
          borderRadius: 0,
          duration: 0.62
        },
        0
      )
      .to(clone, { boxShadow: '0 0 0 rgb(42 68 132 / 0)', duration: 0.32 }, 0);
  }

  function revealIntroLetters() {
    animations.kill('introReveal');
    gsap.set(introLetters, {
      '--intro-letter-reveal': 0,
      '--intro-reveal-y': '12px'
    });
    animations.registerAnimationCue(
      'introReveal',
      gsap.to(introLetters, {
        '--intro-letter-reveal': 1,
        '--intro-reveal-y': '0px',
        duration: 0.64,
        ease: 'power3.out',
        stagger: 0.028
      })
    );
  }

  function revealAudioGateCopyLetters() {
    const letters = audioGateCopyLetters.filter((el): el is HTMLElement => Boolean(el));
    if (!letters.length) return;
    animations.kill('audioGateCopyReveal');
    gsap.set(letters, {
      '--gate-copy-letter-reveal': 0,
      '--gate-copy-reveal-y': '12px'
    });
    animations.registerAnimationCue(
      'audioGateCopyReveal',
      gsap.to(letters, {
        '--gate-copy-letter-reveal': 1,
        '--gate-copy-reveal-y': '0px',
        duration: audioGateCopyRevealDuration,
        ease: 'power3.out',
        stagger: audioGateCopyRevealStagger
      })
    );
  }

  function reloadHome(event: MouseEvent) {
    event.preventDefault();
    const brandUrl = '/?view=brand';
    if (window.location.pathname === '/' && window.location.search === '?view=brand') {
      window.location.reload();
    } else {
      window.location.assign(brandUrl);
    }
  }

  function consumeRequestedViewParam(requestedView: string | null) {
    if (requestedView !== 'brand' && requestedView !== 'cards') return;
    window.history.replaceState(window.history.state, document.title, '/');
  }

  async function openAbout() {
    animations.kill('about');
    isAboutOpen = true;
    await tick();
    if (!aboutScreenEl) return;
    animations.registerAnimationCue(
      'about',
      gsap.fromTo(aboutScreenEl, aboutClosedVars, {
        ...aboutOpenVars,
        duration: aboutMotion.openDuration,
        ease: aboutMotion.openEase,
        clearProps: 'transform'
      })
    );
  }

  function closeAbout() {
    if (!aboutScreenEl) {
      isAboutOpen = false;
      return;
    }
    animations.kill('about');
    animations.registerAnimationCue(
      'about',
      gsap.to(aboutScreenEl, {
        ...aboutClosedVars,
        duration: aboutMotion.closeDuration,
        ease: aboutMotion.closeEase,
        onComplete: () => {
          isAboutOpen = false;
        }
      })
    );
  }

  async function startRoleAudio(role: AudioRole) {
    if (isAudioMuted) return;
    await audioCues.play(role);
  }

  function stopRoleAudio(role: AudioRole) {
    audioCues.stop(role);
  }

  function setAudioMuted(nextMuted: boolean) {
    if (isAudioMuted === nextMuted) return;
    isAudioMuted = nextMuted;
    if (isAudioMuted) {
      stopAllHomeAudio();
    } else {
      void startBackgroundAudio();
      void unlockAmbientAudio();
    }
  }

  function toggleAudioMuted() {
    setAudioMuted(!isAudioMuted);
  }

  function toggleAudioGateMuted() {
    if (isAudioGateOpening) return;
    setAudioMuted(!isAudioMuted);
  }

  function setAudioGateButtonTransitionVars() {
    if (!audioGateButtonEl) return;
    const rect = audioGateButtonEl.getBoundingClientRect();
    const horizontalReach = Math.max(rect.left + rect.width / 2, window.innerWidth - rect.left - rect.width / 2);
    const verticalReach = Math.max(rect.top + rect.height / 2, window.innerHeight - rect.top - rect.height / 2);
    const scale = Math.max((horizontalReach * 2) / rect.width, (verticalReach * 2) / rect.height) * 1.18;

    setCssVars(audioGateButtonEl, {
      '--gate-button-screen-scale': fixed(scale)
    });
  }

  async function openAudioGate(nextMuted = isAudioMuted) {
    if (isAudioGateOpening) return;
    setAudioGateButtonTransitionVars();
    isAudioMuted = nextMuted;
    isAudioGateOpening = true;
    if (!nextMuted) {
      await startBackgroundAudio();
      void unlockAmbientAudio();
    }
    sceneResources.addTimeout(revealIntroLetters, 1700);
    sceneResources.addTimeout(() => {
      isAudioGateVisible = false;
    }, 2050);
  }

  async function unlockAmbientAudio() {
    await audioCues.unlock(audioRoles);
  }

  async function startBackgroundAudio() {
    if (isAudioMuted) return;
    await audioCues.play('background');
  }

  function stopAllHomeAudio() {
    audioCues.stopAll(homeAudioIds);
  }

  function stopAllRoleAudio() {
    audioCues.stopAll(audioRoles);
  }

  // ── Unica funzione che gestisce tutto — nessun conflitto ──
  function applyAllStyles() {
    // 1. Home scorre via
    const epPage        = ease(pageProgress);
    const brandReveal   = clamp(brandProgress);
    const epBrand       = ease(brandReveal);
    setCssVars(homeScreen, { '--page-y': `${(-100 * epPage).toFixed(2)}svh` });

    // 2. next-screen: appare con pageProgress, sparisce con brandProgress
    //    opacity finale = pageProgress-driven * (1 - brandProgress-driven)
    if (nextScreen) {
      const showNext = epPage;                      // 0→1 mentre scrolla verso next
      const hideNext = epBrand;                     // 0→1 mentre scrolla verso brand
      setLayerState(nextScreen, showNext * (1 - hideNext), showNext > 0.05 && hideNext < 0.95);
    }

    // 3. brand-screen: appare con brandProgress
    if (brandScreen) {
      setLayerState(brandScreen, epBrand, epBrand > 0.05);
    }
    setLayerState(rolesTopBar, epBrand, epBrand > 0.05 && !isAboutOpen);

    const floatingExit = ease(clamp((brandProgress - floatingExitMotion.start) / floatingExitMotion.duration));
    floatingEls.forEach((el, index) => {
      if (!el) return;
      const asset = floatingAssets[index];
      const fadeOut = ease(clamp((floatingExit - floatingExitMotion.fadeStart) / floatingExitMotion.fadeDuration));
      const scrollX = asset.exitX * floatingExit;
      const scrollY = asset.exitY * floatingExit;
      setCssVars(el, {
        '--float-scroll-x': vw(scrollX),
        '--float-scroll-y': vh(scrollY, 2),
        '--float-scale': fixed(1 - floatingExit * floatingExitMotion.scaleLoss),
        '--float-opacity': fixed(1 - fadeOut)
      });
      el.style.pointerEvents = fadeOut > floatingExitMotion.pointerCutoff ? 'none' : 'auto';
    });

    const rolesProgress = clamp((brandProgress - rolesRevealStart) / rolesRevealDuration);
    const rolesEase = ease(rolesProgress);
    if (rolesScreen) {
      setLayerState(rolesScreen, rolesEase, rolesProgress > 0.08);
    }
    roleCards.forEach((card, index) => {
      if (!card) return;
      const cardStart = index * roleCardStagger;
      const cardProgress = clamp((rolesProgress - cardStart) / Math.max(1 - cardStart, roleCardRevealDuration));
      const cardEase = ease(cardProgress);
      setCssVars(card, {
        '--role-card-y': vh((1 - cardEase) * 38),
        '--role-card-opacity': fixed(cardEase)
      });
    });

    // 4. Lettere intro: dissolvono con pageProgress
    applyLetterStyles(introLetters, pageProgress, introLetterOut);

    // 5. Lettere next: si rivelano con pageProgress
    applyLetterStyles(nextLetters, pageProgress, nextLetterIn);

    // 6. Lettere brand
    applyBrandLetters();

    const subtitleIn = ease(clamp((brandProgress - brandSubtitleMotion.inStart) / brandSubtitleMotion.inDuration));
    const subtitleOut = ease(clamp((brandProgress - brandSubtitleMotion.outStart) / brandSubtitleMotion.outDuration));
    const subtitleOpacity = subtitleIn * (1 - subtitleOut);
    const subtitleY = (1 - subtitleIn) * brandSubtitleMotion.enterY + subtitleOut * brandSubtitleMotion.exitY;
    setCssVars(brandSubtitleEl, {
      '--brand-subtitle-opacity': fixed(subtitleOpacity),
      '--brand-subtitle-y': px(subtitleY)
    });
    setCssVars(brandScrollCueEl, {
      '--brand-subtitle-opacity': fixed(subtitleOpacity),
      '--brand-subtitle-y': px(subtitleY)
    });
  }

  onMount(() => {
    let isDestroyed = false;

    void loadGsap().then((loadedGsap) => {
      if (isDestroyed) return;

      gsap = loadedGsap;
      animations.setGsap(gsap);
      audioCues.setGsap(gsap);

    const requestedView = new URLSearchParams(window.location.search).get('view');
    const shouldOpenCards = requestedView === 'cards';
    const shouldOpenBrand = requestedView === 'brand';
    const shouldSkipIntro = shouldOpenCards || shouldOpenBrand;
    const initialFlowValue = shouldOpenCards ? rolesScrollVisible : shouldOpenBrand ? brandCopyScrollEnd : 0;
    const flowState = { value: 0 };
    let targetFlowValue = initialFlowValue;
    let isAutoScrolling = false;
    consumeRequestedViewParam(requestedView);
    randomizeBrandLetters();
    if (shouldSkipIntro) {
      isAudioGateVisible = false;
      flowState.value = initialFlowValue;
    }

    if (!shouldSkipIntro) {
      animations.registerAnimationCue(
        'mountFadeDelay',
        gsap.delayedCall(mountFadeMotion.delay, () => {
          if (!introEl) return;
          animations.registerAnimationCue(
            'mountFade',
            gsap.to(introEl, {
              '--mount-opacity': 1,
              duration: mountFadeMotion.duration,
              ease: mountFadeMotion.ease
            })
          );
        })
      );
    }

    const applyFlowTotal = (value: number) => {
      const flowValue = clamp(value, 0, flowTotalMax);
      const nextReelProgress = clamp(flowValue);
      const reelDelta = nextReelProgress - reelProgress;
      if (Math.abs(reelDelta) > 0.0005) reelTravelDirection = reelDelta > 0 ? 1 : -1;
      reelProgress = nextReelProgress;
      pageProgress = clamp(flowValue - 1);
      brandProgress = clamp(flowValue - 2, 0, brandScrollMax);
      applyReelStyles();
      applyAllStyles();
    };

    const tweenFlowTo = (value: number, duration = flowMotion.duration, onComplete?: () => void) => {
      targetFlowValue = clamp(value, 0, flowTotalMax);
      isAutoScrolling = false;
      flowTween = animations.registerAnimationCue(
        'flow',
        gsap.to(flowState, {
          value: targetFlowValue,
          duration,
          ease: flowMotion.ease,
          overwrite: true,
          onUpdate: () => applyFlowTotal(flowState.value),
          onComplete
        })
      );
    };

    const autoFlowTo = (value: number, duration: number, ease = flowMotion.autoEase) => {
      targetFlowValue = clamp(value, 0, flowTotalMax);
      isAutoScrolling = true;
      flowTween = animations.registerAnimationCue(
        'flow',
        gsap.to(flowState, {
          value: targetFlowValue,
          duration,
          ease,
          overwrite: true,
          onUpdate: () => applyFlowTotal(flowState.value),
          onComplete: () => {
            isAutoScrolling = false;
          },
          onInterrupt: () => {
            isAutoScrolling = false;
          }
        })
      );
    };
    const queueFlow = (delta: number) => {
      if (isAutoScrolling) {
        const autoDirection = Math.sign(targetFlowValue - flowState.value);
        const inputDirection = Math.sign(delta);
        if (inputDirection === 0 || autoDirection === 0 || inputDirection === autoDirection) return;
        flowTween?.kill();
        isAutoScrolling = false;
        targetFlowValue = flowState.value;
      }

      const isCopyForwardStep = delta > 0 && flowState.value >= copyScrollStart && flowState.value < copyScrollEnd;
      const isCopyBackStep = delta < 0 && flowState.value > copyScrollStart && flowState.value <= copyScrollEnd;
      if (isCopyForwardStep || isCopyBackStep) {
        const target = isCopyForwardStep ? copyScrollEnd : copyScrollStart;
        autoFlowTo(
          target,
          flowMotion.autoStepDuration,
          isCopyForwardStep ? flowMotion.autoEase : flowMotion.reverseAutoEase
        );
        return;
      }

      const isBrandForwardStep = delta > 0 && flowState.value >= copyScrollEnd && flowState.value < brandCopyScrollEnd;
      const isBrandBackStep = delta < 0 && flowState.value > copyScrollEnd && flowState.value <= brandCopyScrollEnd;
      if (isBrandForwardStep || isBrandBackStep) {
        const target = isBrandForwardStep ? brandCopyScrollEnd : copyScrollEnd;
        autoFlowTo(
          target,
          flowMotion.autoStepDuration,
          isBrandForwardStep ? flowMotion.autoEase : flowMotion.reverseAutoEase
        );
        return;
      }

      const isBrandExitForwardStep = delta > 0 && flowState.value >= brandCopyScrollEnd && flowState.value < rolesScrollVisible;
      const isBrandExitBackStep = delta < 0 && flowState.value > brandCopyScrollEnd && flowState.value <= flowTotalMax;
      if (isBrandExitForwardStep) {
        autoFlowTo(
          rolesScrollVisible,
          flowMotion.autoStepDuration
        );
        return;
      }

      if (isBrandExitBackStep) {
        autoFlowTo(
          brandCopyScrollEnd,
          flowMotion.autoStepDuration,
          flowMotion.reverseAutoEase
        );
        return;
      }

      const isMovingThroughReels = flowState.value < 1 || (delta < 0 && flowState.value <= copyScrollStart);
      const effectiveDelta = isMovingThroughReels ? delta * flowMotion.reelScrollSlowdown : delta;
      const targetLead = isMovingThroughReels
        ? flowMotion.reelMaxTargetLead
        : delta < 0
          ? flowMotion.reverseMaxTargetLead
          : flowMotion.maxTargetLead;
      targetFlowValue = flowState.value;
      const unclampedTarget = targetFlowValue + effectiveDelta;
      const minTarget = flowState.value - targetLead;
      const maxTarget = flowState.value + targetLead;
      const nextTarget = clamp(unclampedTarget, minTarget, maxTarget);
      const settleReelExit = () => {
        if (!isMovingThroughReels || nextTarget >= 1 || nextTarget <= reelMotion.autoReturnFlowTarget) return;
        if (delta > 0 && nextTarget >= reelMotion.autoExitFlowStart) {
          autoFlowTo(copyScrollEnd, flowMotion.autoStepDuration);
        } else if (delta < 0 && nextTarget >= reelMotion.autoExitFlowStart) {
          autoFlowTo(reelMotion.autoReturnFlowTarget, reelMotion.autoSettleDuration);
        }
      };
      tweenFlowTo(
        nextTarget,
        isMovingThroughReels ? flowMotion.reelDuration : flowMotion.duration,
        settleReelExit
      );
    };

    const normalizeWheelDelta = (e: WheelEvent) => {
      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
      const rawStep = (e.deltaY * unit) / 2400;
      return clamp(rawStep, -flowMotion.reverseMaxWheelStep, flowMotion.maxWheelStep);
    };

    const onWheel   = (e: WheelEvent)    => {
      e.preventDefault();
      if (isAudioGateVisible) return;
      queueFlow(normalizeWheelDelta(e));
    };
    const onPointerDownAudioUnlock = () => {
      if (isAudioGateVisible || isAudioMuted) return;
      void unlockAmbientAudio();
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (isAudioGateVisible) {
        const activeEl = document.activeElement;
        if ((e.key === ' ' || e.key === 'Enter') && activeEl?.classList.contains('audio-gate-button')) return;
        e.preventDefault();
        return;
      }
      if (!isAudioMuted) void unlockAmbientAudio();
      const step = keyFlowSteps[e.key];
      if (step !== undefined) { e.preventDefault(); queueFlow(step); }
    };

    applyFlowTotal(flowState.value);
    if (shouldSkipIntro) {
      gsap.set(introEl, { '--mount-opacity': 1 });
      gsap.set(introLetters, {
        '--intro-letter-reveal': 1,
        '--intro-reveal-y': '0px'
      });
    } else {
      gsap.set(introLetters, {
        '--intro-letter-reveal': 0,
        '--intro-reveal-y': '12px'
      });
    }
    revealAudioGateCopyLetters();
    animations.addTicker(moveFloatingAssets);
    sceneResources.addEventListener(window, 'wheel', onWheel as EventListener, { passive: false });
    sceneResources.addEventListener(window, 'keydown', onKeydown as EventListener);
    sceneResources.addEventListener(window, 'pointerdown', onPointerDownAudioUnlock, { passive: true });
    });

    return () => {
      isDestroyed = true;
      flowTween?.kill();
      animations.destroy();
      audioCues.destroy();
      sceneResources.destroy();
    };
  });
</script>


<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=DynaPuff:wght@400..700&family=JetBrains+Mono:ital,wght@0,400;1,700&family=Roboto:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

{#if isAudioGateVisible}
  <section
    class:is-opening={isAudioGateOpening}
    class="audio-gate"
    aria-labelledby="audio-gate-copy"
    data-node-id="3266:3591"
  >
    <div
      class="audio-gate-utensils"
      aria-hidden="true"
      style={`--utensil-rise-delay: ${Math.round(audioGateUtensilRiseDelay * 1000)}ms; --utensil-shake-delay: ${Math.round(audioGateUtensilShakeDelay * 1000)}ms; --utensil-idle-delay: ${Math.round(audioGateUtensilIdleDelay * 1000)}ms`}
    >
      <div class="audio-gate-utensil audio-gate-fork" data-node-id="4197:2170">
        <img src="/assets/audio-gate-fork.svg" alt="" draggable="false" data-node-id="4197:2168" />
      </div>
      <div class="audio-gate-utensil audio-gate-knife" data-node-id="4197:2173">
        <img src="/assets/audio-gate-knife.svg" alt="" draggable="false" data-node-id="4197:2169" />
      </div>
    </div>

    <div class="audio-gate-content">
      <div class="audio-gate-orbit" aria-hidden="true" data-node-id="4109:3541">
        <svg class="audio-gate-orbit-line" viewBox="0 0 100 100" focusable="false">
          {#each audioGateOrbitDots as dot (dot.index)}
            <circle
              class="audio-gate-orbit-dot"
              cx={fixed(dot.point.x, 3)}
              cy={fixed(dot.point.y, 3)}
              r="0.4"
              style={`--orbit-dot-index: ${dot.index}; --orbit-dot-delay: ${dot.delayMs}ms`}
            />
          {/each}
        </svg>
      </div>
      <div class="audio-gate-stack">
        <div class="audio-gate-audio-button-frame" data-node-id="4195:10927">
          <button
            class="icon-button audio-gate-audio-button"
            type="button"
            aria-label={audioLabel}
            aria-pressed={isAudioMuted}
            data-node-id="4109:3605"
            onclick={toggleAudioGateMuted}
          >
            {#if isAudioMuted}
              <VolumeOffIcon class="volume-icon" />
            {:else}
              <VolumeMaxIcon class="volume-icon volume-max-icon" />
            {/if}
          </button>
        </div>
        <p id="audio-gate-copy" aria-label={audioGateMessage} data-node-id="4109:3572">
          {#each audioGateWords as group (group.index)}
            {#if group.type === 'space'}
              <span class="audio-gate-copy-space" aria-hidden="true">&nbsp;</span>
            {:else}
              <span class="audio-gate-copy-word" aria-hidden="true">
                {#each group.characters as { letter, index } (index)}
                  <span bind:this={audioGateCopyLetters[index]} class="audio-gate-copy-letter">
                    {letter}
                  </span>
                {/each}
              </span>
            {/if}
          {/each}
        </p>
        <div class="audio-gate-button-frame" data-node-id="4109:3579">
          <button
            bind:this={audioGateButtonEl}
            class="audio-gate-button"
            type="button"
            aria-label="Inizia"
            data-node-id="4109:3575"
            onclick={() => openAudioGate(isAudioMuted)}
          >
            <span class="audio-gate-button-label" data-node-id="4109:3578">
              <span data-node-id="4109:3576">Inizia</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
{/if}

{#if !isAudioGateVisible && !isAboutOpen}
  <button
    class="icon-button persistent-top-audio"
    type="button"
    aria-label={audioLabel}
    aria-pressed={isAudioMuted}
    onclick={toggleAudioMuted}
  >
    <span class="topbar-control-content" aria-hidden="true">
      {#if isAudioMuted}
        <VolumeOffIcon class="volume-icon" />
      {:else}
        <VolumeMaxIcon class="volume-icon volume-max-icon" />
      {/if}
    </span>
  </button>
{/if}

<main bind:this={homeScreen} class="home">
  <section class="intro" aria-labelledby="intro-title" bind:this={introEl}>
    <div class="intro-copy">
      <h1 id="intro-title" aria-label={introMessage}>
        {#each introWords as group (group.index)}
          {#if group.type === 'space'}
            <span class="space" aria-hidden="true">&nbsp;</span>
          {:else}
            {#if group.index === 14 || group.index === 35}
              <br aria-hidden="true" />
            {/if}
            <span class="word" aria-hidden="true">
              {#each group.characters as { letter, isAccent, index } (index)}
                <span bind:this={introLetters[index]} class:accent-letter={isAccent}
                  >{letter}</span>
              {/each}
            </span>
          {/if}
        {/each}
      </h1>
    </div>
  </section>

  <section class="reel-layer" aria-label="Mockup reels in profondità">
    {#each reels as reel, index}
      <article bind:this={reelCards[index]} class="reel-card" aria-label={`Reel ${index + 1}`}>
        <div class="reel-frame">
          {#if reel.src}
            <video class="reel-video" src={reel.src} autoplay muted playsinline loop preload="metadata"></video>
          {:else}
            <div class="reel-placeholder" style="background:{reel.bg}"></div>
          {/if}
        </div>
      </article>
    {/each}
  </section>
</main>


<section bind:this={nextScreen} class="next-screen" aria-labelledby="next-message">
  <p id="next-message" class="next-message" aria-label={nextMessage}>
    {#each nextCharacters as { letter, isSpace, isAccent }, index}
      {#if index === 20 || index === 41}
        <br aria-hidden="true" />
      {/if}
      {#if isSpace}
        <span class="space" aria-hidden="true">&nbsp;</span>
      {:else}
        <span bind:this={nextLetters[index]} class:accent-letter={isAccent} aria-hidden="true"
          >{letter}</span>
      {/if}
    {/each}
  </p>
</section>


<section bind:this={brandScreen} class="brand-screen" aria-label="Fuorimenù">
  {#each floatingAssets as asset, index}
    <div
      bind:this={floatingEls[index]}
      class={`floating-vector ${asset.className}`}
      data-node-id={asset.nodeId}
      role="img"
      aria-label={asset.label}
      onpointerenter={() => { asset.motion.hover = true; }}
      onpointermove={(event) => tiltFloatingAsset(event, index)}
      onpointerleave={() => { asset.motion.hover = false; }}
    >
      <img src={asset.src} alt="" draggable="false" />
    </div>
  {/each}

  <div class="brand-lockup">
    <p class="brand-word" class:is-sharp={isBrandWordSharp} aria-label={brandWord}>
      {#each brandLetters as { letter }, index}
        <span bind:this={brandLetterEls[index]} class="brand-letter" aria-hidden="true"
          >{letter}</span>
      {/each}
    </p>
    <p bind:this={brandSubtitleEl} class="brand-subtitle">{brandSubtitle}</p>
    <div bind:this={brandScrollCueEl} class="brand-scroll-cue" data-node-id="3448:2821" aria-label="Scorri">
      <span data-node-id="3448:2822">Scorri</span>
      <svg class="brand-scroll-arrow" viewBox="0 0 24 24" aria-hidden="true" data-node-id="3448:1201">
        <path d="M12 5v12M7 12l5 5 5-5" />
      </svg>
    </div>
  </div>
</section>

<header bind:this={rolesTopBar} class="roles-top-bar" class:is-hidden={isAboutOpen} aria-label="Navigazione principale">
  <a class="logo" href="/?view=brand" aria-label="Vai al brand screen Fuorimenù" onclick={reloadHome}>
    <span class="topbar-control-content">FM</span>
  </a>
  <span class="top-bar-audio top-bar-audio-slot" aria-hidden="true"></span>
  <button
    class="icon-button top-bar-menu"
    type="button"
    aria-label="Apri sezione about"
    aria-expanded={isAboutOpen}
    onclick={openAbout}
  >
    <span class="topbar-control-content" aria-hidden="true">
      <span class="menu-icon"></span>
    </span>
  </button>
</header>

<section bind:this={rolesScreen} class="roles-screen" aria-label="Aree Fuorimenù">
  <div class="role-grid">
    {#snippet roleCardBody(item: RoleItem)}
      <div class="role-card-top">
        <img class="role-card-bg" src="/images/figma-kitchen-scene.png" alt="" draggable="false" />
        <span class="role-card-bg-overlay" aria-hidden="true"></span>
        <div class="role-hover-panel">
          <svg
            class="role-hover-panel-shape"
            viewBox="0 0 373 149"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M1 122.5V41C1 18.9 18.9 1 41 1H332C354.1 1 372 18.9 372 41V122.5H215.5L186.5 147.5L157.5 122.5H1Z"
            />
          </svg>
          <p>{item.hoverText}</p>
        </div>
        <div class="role-card-copy">
          <h2>{item.title}</h2>
          <p>{item.description}</p>
        </div>
        {#if item.personSrc}
          <img
            class="role-person"
            class:role-person-outline={Boolean(item.personFillSrc)}
            src={item.personSrc}
            alt={item.speaker}
            data-node-id={item.personNodeId}
            draggable="false"
          />
          {#if item.personFillSrc}
            <img
              class="role-person role-person-fill"
              src={item.personFillSrc}
              alt=""
              data-node-id={item.personFillNodeId}
              draggable="false"
            />
          {/if}
        {/if}
      </div>
    {/snippet}

    {#each roleItems as item, index}
      {#if item.href}
        <a
          bind:this={roleCards[index]}
          class="role-card is-linked"
          class:is-ufficio={item.title === 'ufficio'}
          class:is-cucina={item.title === 'cucina'}
          class:is-servizio={item.title === 'servizio'}
          class:has-dialogue={Boolean(item.dialogue)}
          class:has-person-fill={Boolean(item.personFillSrc)}
          href={item.href}
          onclick={(event) => enterRoleCard(event, item, index)}
          onpointerenter={() => startRoleAudio(item.title)}
          onpointermove={(event) => tiltRoleCard(event, index)}
          onpointerleave={() => {
            stopRoleAudio(item.title);
            resetRoleCard(index);
          }}
        >
          {@render roleCardBody(item)}
        </a>
      {:else}
        <article
          bind:this={roleCards[index]}
          class="role-card"
          class:is-ufficio={item.title === 'ufficio'}
          class:is-cucina={item.title === 'cucina'}
          class:is-servizio={item.title === 'servizio'}
          class:has-dialogue={Boolean(item.dialogue)}
          class:has-person-fill={Boolean(item.personFillSrc)}
          onpointerenter={() => startRoleAudio(item.title)}
          onpointermove={(event) => tiltRoleCard(event, index)}
          onpointerleave={() => {
            stopRoleAudio(item.title);
            resetRoleCard(index);
          }}
        >
          {@render roleCardBody(item)}
        </article>
      {/if}
    {/each}
  </div>
</section>

<audio
  bind:this={backgroundAudio.el}
  src={backgroundAudio.src}
  preload="auto"
  aria-hidden="true"
></audio>

{#each roleAudioEntries as { role, config } (role)}
  <audio
    bind:this={config.el}
    src={config.src}
    preload="auto"
    aria-hidden="true"
  ></audio>
{/each}

{#if isAboutOpen}
  <section
    bind:this={aboutScreenEl}
    class="about-screen"
    aria-labelledby="about-title"
    data-node-id="256:1827"
  >
    <header class="about-top-bar" aria-label="Navigazione about">
      <a class="logo about-logo" href="/?view=brand" aria-label="Vai al brand screen Fuorimenù" onclick={reloadHome}>
        <span class="topbar-control-content">FM</span>
      </a>
      <button
        class="icon-button top-bar-audio about-audio"
        type="button"
        aria-label={audioLabel}
        aria-pressed={isAudioMuted}
        onclick={toggleAudioMuted}
      >
        <span class="topbar-control-content" aria-hidden="true">
          {#if isAudioMuted}
            <VolumeOffIcon class="volume-icon" />
          {:else}
            <VolumeMaxIcon class="volume-icon volume-max-icon" />
          {/if}
        </span>
      </button>
      <button
        class="icon-button top-bar-menu about-close"
        type="button"
        aria-label="Chiudi sezione about"
        onclick={closeAbout}
      >
        <span class="topbar-control-content" aria-hidden="true">
          <span class="close-icon"></span>
        </span>
      </button>
    </header>

    <div class="about-copy" data-node-id="256:1831">
      <h2 id="about-title" class="visually-hidden">About Fuorimenù</h2>
      <p>
        Questo progetto nasce nel corso di Web Design del Politecnico di Milano con l'obiettivo di raccontare il ruolo delle persone che, attraverso la cultura alimentare italiana, hanno contribuito a Milano Cortina 2026.
      </p>
      <p>
        In un'esperienza digitale immersiva, il progetto esplora il lavoro di chi ha operato dietro le quinte dei Giochi Olimpici - chef, organizzatori e team di ristorazione - mettendo in luce il legame profondo tra tradizione culinaria italiana e performance sportiva.
      </p>
      <p>
        Il racconto si basa sulle testimonianze e le storie reali delle persone che hanno preso parte alla cucina olimpica, portando ogni giorno sulle tavole degli atleti il meglio della gastronomia italiana.
      </p>
    </div>

    <img
      class="polimi-logo"
      src="/images/politecnico-bianco.png"
      alt="Politecnico Milano 1863"
      data-node-id="256:1835"
      draggable="false"
    />
  </section>
{/if}


<style>
  :global(html), :global(body) {
    width: 100%; height: 100%;
    margin: 0; overflow: hidden;
    background: var(--color-surface-page);
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, auto;
    overscroll-behavior: none;
  }
  :global(button), :global(a) {
    font: inherit;
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, pointer;
  }

  .audio-gate {
    --audio-gate-orbit-size: min(calc(100vw - 48px), calc(100svh - 48px), 634px);

    position: fixed;
    z-index: 100;
    inset: 0;
    overflow: hidden;
    background: var(--color-text-primary);
    color: var(--color-text-inverse);
    cursor: url('/cursors/retrogusto-cursor-light.svg') 5 5, auto;
    opacity: 1;
  }

  .audio-gate.is-opening {
    pointer-events: none;
  }

  .audio-gate-content {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 50%;
    width: var(--audio-gate-orbit-size);
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
  }

  .audio-gate-utensils {
    position: absolute;
    z-index: 1;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .audio-gate-utensil {
    --tool-angle: 0deg;
    --tool-start-angle: 0deg;
    --tool-shake-angle-a: 2.8deg;
    --tool-shake-angle-b: -2deg;
    --tool-idle-angle: 0.9deg;

    position: absolute;
    top: 18.8svh;
    left: calc((100vw - var(--audio-gate-orbit-size)) / 4);
    width: clamp(86px, 12vw, 174px);
    height: min(149svh, 890px);
    transform: translate3d(-50%, 118svh, 0) rotate(var(--tool-start-angle));
    transform-origin: 50% 90%;
    will-change: transform, opacity;
    animation: audioGateUtensilRise 980ms cubic-bezier(0.16, 1, 0.3, 1) var(--utensil-rise-delay, 0ms) both;
  }

  .audio-gate-utensil img {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
    transform-origin: 50% 90%;
    will-change: transform;
    animation:
      audioGateUtensilShake 620ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--utensil-shake-delay, 760ms) both,
      audioGateUtensilIdle 3.2s ease-in-out var(--utensil-idle-delay, 1.22s) infinite;
  }

  .audio-gate-fork {
    --tool-angle: -0.8deg;
    --tool-start-angle: -4deg;
    --tool-shake-angle-a: -3deg;
    --tool-shake-angle-b: 2deg;
  }

  .audio-gate-knife {
    --tool-angle: 0.7deg;
    --tool-start-angle: 4deg;
    --tool-shake-angle-a: 2.5deg;
    --tool-shake-angle-b: -1.8deg;
    --tool-idle-angle: -1.3deg;

    top: 15.9svh;
    left: calc(100vw - ((100vw - var(--audio-gate-orbit-size)) / 4));
    width: clamp(68px, 9.4vw, 134px);
    height: min(178svh, 1068px);
    animation-delay: calc(var(--utensil-rise-delay, 0ms) + 80ms);
  }

  @keyframes audioGateUtensilRise {
    0% {
      transform: translate3d(-50%, 118svh, 0) rotate(var(--tool-start-angle));
    }

    76% {
      transform: translate3d(-50%, -10px, 0) rotate(calc(var(--tool-angle) - 1.2deg));
    }

    100% {
      transform: translate3d(-50%, 0, 0) rotate(var(--tool-angle));
    }
  }

  @keyframes audioGateUtensilShake {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotate(0deg);
    }

    22% {
      transform: translate3d(-4px, 1px, 0) rotate(var(--tool-shake-angle-a));
    }

    48% {
      transform: translate3d(3px, -1px, 0) rotate(var(--tool-shake-angle-b));
    }

    72% {
      transform: translate3d(-2px, 0, 0) rotate(calc(var(--tool-shake-angle-a) * 0.44));
    }
  }

  @keyframes audioGateUtensilIdle {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotate(0deg);
    }

    48% {
      transform: translate3d(0, -8px, 0) rotate(calc(var(--tool-idle-angle) * 1.35));
    }
  }

  .audio-gate-orbit {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    left: 0;
    border-radius: 50%;
    background: var(--color-text-primary);
    opacity: 1;
    transition: opacity 240ms ease, transform 760ms cubic-bezier(0.84, 0, 0.16, 1);
    will-change: transform, opacity;
  }

  .audio-gate-orbit-line {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    transform: rotate(0deg);
    transform-origin: center;
    animation: audioGateOrbitSpin 56s linear 1.15s infinite;
  }

  .audio-gate-orbit-dot {
    fill: var(--color-text-inverse);
    opacity: 0;
    animation: audioGateDotIn 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: var(--orbit-dot-delay, 0ms);
  }

  @keyframes audioGateDotIn {
    to {
      opacity: 1;
    }
  }

  @keyframes audioGateOrbitSpin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .audio-gate-orbit-line {
      animation: none;
    }

    .audio-gate-orbit-dot {
      animation: none;
      opacity: 1;
    }

    .audio-gate-copy-letter {
      opacity: 1;
      transform: none;
    }

    .audio-gate-utensil {
      animation: none;
      transform: translateX(-50%) rotate(var(--tool-angle));
    }

    .audio-gate-utensil img {
      animation: none;
      transform: rotate(0deg);
    }
  }

  .audio-gate-stack {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(var(--spacing-7), 5.8vw, var(--spacing-10));
    padding: 12%;
    transition: opacity 180ms ease, transform 180ms ease;
  }

  .audio-gate-audio-button-frame,
  .audio-gate-button-frame {
    --button-depth-x: 0px;
    --button-depth-y: 8px;
    --audio-gate-button-depth-bg: var(--color-surface-page);
    --audio-gate-button-depth-border: var(--color-surface-page);

    position: relative;
    perspective: 900px;
    perspective-origin: 50% 50%;
  }

  .audio-gate-audio-button-frame {
    width: 56px;
    height: 56px;
  }

  .audio-gate-audio-button-frame::before {
    position: absolute;
    inset: 0;
    border: 2px solid var(--audio-gate-button-depth-border);
    border-radius: var(--radius-full);
    background: var(--audio-gate-button-depth-bg);
    content: '';
    opacity: 0;
    transition: opacity 90ms ease;
  }

  .audio-gate .audio-gate-audio-button {
    --button-hover-scale: 1;
    --button-lift-x: 0px;
    --button-lift-y: 0px;

    position: relative;
    width: 100%;
    height: 100%;
    border: 2px solid var(--audio-gate-button-depth-border);
    border-radius: var(--radius-full);
    color: var(--color-text-inverse);
    background: var(--color-text-primary);
    cursor: url('/cursors/retrogusto-cursor-light.svg') 5 5, pointer;
    transform:
      translate(var(--button-lift-x), var(--button-lift-y))
      scale(var(--button-hover-scale));
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .audio-gate .audio-gate-audio-button:hover,
  .audio-gate .audio-gate-audio-button:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: calc(var(--button-depth-y) * -1);
    --button-hover-scale: 1;

    color: var(--color-text-primary);
    border-color: var(--color-text-primary);
    background: var(--color-text-inverse);
    opacity: 1;
  }

  .audio-gate-audio-button-frame:hover::before,
  .audio-gate-audio-button-frame:has(.audio-gate-audio-button:focus-visible)::before {
    opacity: 1;
  }

  .audio-gate .audio-gate-audio-button:active {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --button-hover-scale: 1;
  }

  .audio-gate .audio-gate-audio-button:focus-visible {
    outline: 2px solid var(--color-text-inverse);
    outline-offset: var(--unit-4);
  }

  .audio-gate-content p {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 0;
    width: max-content;
    max-width: min(calc(100vw - 64px), 570px);
    margin: 0;
    color: var(--color-text-inverse);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: 1.4;
    text-align: center;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .audio-gate-copy-word {
    display: inline-flex;
    white-space: nowrap;
  }

  .audio-gate-copy-space {
    display: inline-block;
    width: 0.58em;
  }

  .audio-gate-copy-letter {
    display: inline-block;
    opacity: var(--gate-copy-letter-reveal, 0);
    transform: translateY(var(--gate-copy-reveal-y, 12px));
    will-change: opacity, transform;
  }

  .audio-gate-button-frame {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: clamp(144px, 17vw, 173px);
    aspect-ratio: 173 / 68;
  }

  .audio-gate-button-frame::before {
    position: absolute;
    inset: 0;
    border: 2px solid var(--color-text-inverse);
    border-radius: var(--radius-full);
    background: var(--audio-gate-button-depth-bg);
    content: '';
    opacity: 0;
    transition: opacity 90ms ease;
  }

  .audio-gate-button {
    --gate-button-screen-scale: 18;

    position: relative;
    overflow: hidden;
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    padding: 0;
    border: 2px solid var(--color-text-inverse);
    border-radius: var(--radius-full);
    color: var(--color-text-inverse);
    background: var(--color-text-primary);
    box-shadow: none;
    cursor: url('/cursors/retrogusto-cursor-light.svg') 5 5, pointer;
    transform:
      translate(var(--button-lift-x, 0px), var(--button-lift-y, 0px))
      scale(var(--button-hover-scale, 1));
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .audio-gate-button-label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-inverse);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
    white-space: nowrap;
  }

  .audio-gate-button:hover,
  .audio-gate-button:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: calc(var(--button-depth-y) * -1);
    --button-hover-scale: 1;
    border-color: var(--color-text-primary);
    background: var(--color-text-inverse);
    color: var(--color-text-primary);
    box-shadow: none;
  }

  .audio-gate-button-frame:hover::before,
  .audio-gate-button-frame:has(.audio-gate-button:focus-visible)::before {
    opacity: 1;
  }

  .audio-gate-button:active {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --button-hover-scale: 1;
  }

  .audio-gate-button:hover .audio-gate-button-label,
  .audio-gate-button:focus-visible .audio-gate-button-label {
    color: currentColor;
  }

  .audio-gate-button:focus-visible {
    outline: 2px solid var(--color-text-inverse);
    outline-offset: var(--unit-4);
  }

  .audio-gate.is-opening .audio-gate-orbit {
    transform: scale(1.02);
  }

  .audio-gate.is-opening .audio-gate-utensil {
    opacity: 0;
    animation: none;
    transform: translate3d(-50%, 26px, 0) rotate(var(--tool-angle));
    transition:
      opacity 220ms ease,
      transform 280ms ease;
  }

  .audio-gate.is-opening .audio-gate-utensil img {
    animation: none;
  }

  .audio-gate.is-opening .audio-gate-orbit-line {
    animation-play-state: paused;
  }

  .audio-gate.is-opening .audio-gate-orbit-dot {
    opacity: 1;
    animation: audioGateDotOut 220ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
    animation-delay: calc(var(--orbit-dot-index, 0) * 8ms);
  }

  @keyframes audioGateDotOut {
    to {
      opacity: 0;
    }
  }

  .audio-gate.is-opening .audio-gate-audio-button-frame,
  .audio-gate.is-opening .audio-gate-content p {
    opacity: 0;
    transform: translateY(-6px);
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .audio-gate.is-opening .audio-gate-button-frame::before {
    opacity: 0;
  }

  .audio-gate.is-opening .audio-gate-button-frame {
    z-index: 5;
  }

  .audio-gate.is-opening .audio-gate-button {
    border-color: var(--color-surface-page);
    border-radius: var(--radius-full);
    background: var(--color-surface-page);
    color: transparent;
    transform: scale(1);
    animation: audioGateButtonExpand 860ms cubic-bezier(0.84, 0, 0.16, 1) 760ms forwards;
  }

  .audio-gate.is-opening .audio-gate-button-label {
    opacity: 0;
  }

  @keyframes audioGateButtonExpand {
    to {
      border-radius: 0;
      transform: scale(var(--gate-button-screen-scale));
    }
  }

  .home {
    position: fixed; inset: 0;
    width: 100%; height: 100svh; overflow: hidden;
    background: var(--color-surface-page); color: var(--color-text-primary);
    transform: translateY(var(--page-y, 0));
    transition: transform 160ms ease-out;
    will-change: transform;
  }

  .logo {
    color: var(--color-content-primary);
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    transition: color 160ms ease;
  }

  .top-bar-audio { justify-self: center; }
  .top-bar-menu { justify-self: end; }

  .top-bar-audio-slot {
    display: block;
    width: var(--button-icon-size);
    height: var(--button-icon-size);
  }

  .persistent-top-audio {
    position: fixed;
    z-index: 60;
    top: var(--spacing-7);
    left: 50%;
    transform: translateX(-50%) translate(var(--button-lift-x, 0px), var(--button-lift-y, 0px));
  }

  .roles-top-bar a {
    color: var(--color-interactive-primary);
    font-family: var(--font-display);
    font-weight: 400; text-decoration: none;
  }

  .icon-button {
    display: grid; width: var(--button-icon-size); height: var(--button-icon-size); place-items: center;
    padding: 0; color: var(--color-interactive-primary);
    background: transparent; border: 0; cursor: url('/cursors/retrogusto-cursor.svg') 5 5, pointer;
    transition: color 160ms ease, opacity 0.2s ease;
  }

  .roles-top-bar .logo,
  .roles-top-bar .icon-button,
  .about-top-bar .logo,
  .about-top-bar .icon-button,
  .persistent-top-audio {
    --button-depth-x: 0px;
    --button-depth-y: 6px;
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --button-hover-scale: 1;
    --topbar-lift-ease: cubic-bezier(0.18, 1.35, 0.28, 1);
    --topbar-control-bg: var(--color-surface-page);
    --topbar-control-fg: var(--color-text-primary);
    --topbar-control-hover-bg: var(--color-surface-page);
    --topbar-control-hover-fg: var(--color-text-primary);
    --topbar-control-depth: var(--color-text-primary);

    position: relative;
    display: grid;
    width: 56px;
    height: 56px;
    place-items: center;
    box-sizing: border-box;
    border: 0;
    border-radius: var(--radius-full);
    color: var(--topbar-control-fg);
    background: transparent;
    isolation: isolate;
    transform: scale(var(--button-hover-scale));
    transition:
      color 160ms ease,
      transform 210ms var(--topbar-lift-ease),
      opacity 0.2s ease;
    will-change: transform;
  }

  .persistent-top-audio {
    transform:
      translateX(-50%)
      scale(var(--button-hover-scale));
  }

  .roles-top-bar .logo,
  .about-top-bar .logo {
    font-weight: 700;
  }

  .roles-top-bar .logo::before,
  .roles-top-bar .icon-button::before,
  .about-top-bar .logo::before,
  .about-top-bar .icon-button::before,
  .persistent-top-audio::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    border: 2px solid var(--topbar-control-fg);
    border-radius: var(--radius-full);
    background: var(--topbar-control-depth);
    content: '';
    opacity: 0;
    transition: opacity 90ms ease;
  }

  .roles-top-bar .logo::after,
  .roles-top-bar .icon-button::after,
  .about-top-bar .logo::after,
  .about-top-bar .icon-button::after,
  .persistent-top-audio::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    border: 2px solid var(--topbar-control-fg);
    border-radius: var(--radius-full);
    background: var(--topbar-control-bg);
    content: '';
    transform:
      translate(var(--button-lift-x), var(--button-lift-y));
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      transform 210ms var(--topbar-lift-ease);
  }

  .topbar-control-content {
    position: relative;
    z-index: 2;
    display: grid;
    place-items: center;
    color: currentColor;
    transform:
      translate(var(--button-lift-x), var(--button-lift-y));
    transition:
      color 160ms ease,
      transform 210ms var(--topbar-lift-ease);
    will-change: transform;
  }

  .roles-top-bar .logo:hover,
  .roles-top-bar .logo:focus-visible,
  .roles-top-bar .icon-button:hover,
  .roles-top-bar .icon-button:focus-visible,
  .about-top-bar .logo:hover,
  .about-top-bar .logo:focus-visible,
  .about-top-bar .icon-button:hover,
  .about-top-bar .icon-button:focus-visible,
  .persistent-top-audio:hover,
  .persistent-top-audio:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: calc(var(--button-depth-y) * -1);
    --button-hover-scale: 1;

    color: var(--topbar-control-hover-fg);
  }

  .roles-top-bar .logo:hover::after,
  .roles-top-bar .logo:focus-visible::after,
  .roles-top-bar .icon-button:hover::after,
  .roles-top-bar .icon-button:focus-visible::after,
  .about-top-bar .logo:hover::after,
  .about-top-bar .logo:focus-visible::after,
  .about-top-bar .icon-button:hover::after,
  .about-top-bar .icon-button:focus-visible::after,
  .persistent-top-audio:hover::after,
  .persistent-top-audio:focus-visible::after {
    border-color: var(--topbar-control-fg);
    background: var(--topbar-control-hover-bg);
  }

  .roles-top-bar .logo:hover::before,
  .roles-top-bar .logo:focus-visible::before,
  .roles-top-bar .icon-button:hover::before,
  .roles-top-bar .icon-button:focus-visible::before,
  .about-top-bar .logo:hover::before,
  .about-top-bar .logo:focus-visible::before,
  .about-top-bar .icon-button:hover::before,
  .about-top-bar .icon-button:focus-visible::before,
  .persistent-top-audio:hover::before,
  .persistent-top-audio:focus-visible::before {
    opacity: 1;
  }

  .roles-top-bar .logo:active,
  .roles-top-bar .icon-button:active,
  .about-top-bar .logo:active,
  .about-top-bar .icon-button:active,
  .persistent-top-audio:active {
    --button-lift-x: 0px;
    --button-lift-y: -1px;
    --button-hover-scale: 1;
  }

  .roles-top-bar .logo:active::before,
  .roles-top-bar .icon-button:active::before,
  .about-top-bar .logo:active::before,
  .about-top-bar .icon-button:active::before,
  .persistent-top-audio:active::before {
    opacity: 1;
  }

  .logo:hover,
  .logo:focus-visible,
  .icon-button:hover,
  .icon-button:focus-visible { color: var(--color-interactive-hover); }

  .roles-top-bar .logo:hover,
  .roles-top-bar .logo:focus-visible,
  .roles-top-bar .icon-button:hover,
  .roles-top-bar .icon-button:focus-visible,
  .about-top-bar .logo:hover,
  .about-top-bar .logo:focus-visible,
  .about-top-bar .icon-button:hover,
  .about-top-bar .icon-button:focus-visible,
  .persistent-top-audio:hover,
  .persistent-top-audio:focus-visible {
    color: var(--topbar-control-fg);
  }
  .icon-button:hover         { opacity: 1; }
  .icon-button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: var(--unit-4); }

  :global(.volume-icon) {
    width: 28px; height: 28px; fill: none; stroke: currentColor;
    stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2;
  }

  :global(.volume-max-icon) {
    stroke-width: 2.33333;
  }

  :global(.volume-slash) {
    stroke-width: 2.8;
  }

  .menu-icon, .menu-icon::before, .menu-icon::after {
    display: block; width: 18px; height: 2px;
    background: currentColor; border-radius: var(--radius-full);
  }
  .menu-icon          { position: relative; }
  .menu-icon::before,
  .menu-icon::after   { position: absolute; left: 0; content: ''; }
  .menu-icon::before  { top: -6px; }
  .menu-icon::after   { top:  6px; }

  .close-icon,
  .close-icon::before {
    display: block;
    width: 24px;
    height: 2.4px;
    background: currentColor;
    border-radius: var(--radius-full);
  }

  .close-icon {
    position: relative;
    transform: rotate(45deg);
  }

  .close-icon::before {
    position: absolute;
    left: 0;
    content: '';
    transform: rotate(90deg);
  }

  .about-screen {
    position: fixed;
    z-index: 80;
    inset: 0;
    overflow: hidden;
    background: var(--color-text-primary);
    color: var(--color-surface-page);
    transform-origin: right center;
    will-change: clip-path, transform;
  }

  .about-top-bar {
    position: absolute;
    z-index: 3;
    top: 0;
    left: 0;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    height: var(--layout-topbar-height);
    padding: var(--layout-topbar-padding);
  }

  .about-logo,
  .about-audio,
  .about-close {
    color: var(--color-text-primary);
  }

  .about-logo {
    font-weight: 700;
  }

  .about-logo:hover,
  .about-logo:focus-visible,
  .about-audio:hover,
  .about-audio:focus-visible,
  .about-close:hover,
  .about-close:focus-visible {
    color: var(--color-text-primary);
  }

  .about-audio {
    justify-self: center;
  }

  .about-close {
    justify-self: end;
  }

  .about-copy {
    position: absolute;
    top: 132px;
    left: var(--layout-page-gutter);
    box-sizing: border-box;
    width: min(779px, calc(100vw - var(--spacing-13)));
    max-height: calc(100svh - 250px);
    overflow: hidden;
    color: var(--color-text-inverse);
    font-family: var(--font-text);
    font-size: clamp(18px, 1.45vw, 21px);
    font-weight: 400;
    line-height: 1.42;
  }

  .about-copy p {
    margin: 0 0 1.12em;
  }

  .polimi-logo {
    position: absolute;
    left: var(--layout-page-gutter);
    bottom: var(--spacing-8);
    width: min(250px, 36vw);
    height: auto;
    user-select: none;
    pointer-events: none;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .intro {
    position: absolute; z-index: 5; inset: 0;
    display: grid; place-items: center;
    box-sizing: border-box;
    padding: var(--spacing-7);
    pointer-events: none;
    opacity: var(--mount-opacity, 0);
    transition: opacity 80ms linear;
    will-change: opacity;
  }

  .intro-copy {
    display: grid;
    justify-items: center;
    gap: 22px;
  }

  h1, .next-message {
    width: min(434px, 100%); margin: 0; color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 32px; font-weight: 400; line-height: 1.5; text-align: center;
  }

  h1 {
    width: min(520px, 100%);
  }

  h1 span {
    display: inline-block;
    opacity: var(--letter-opacity, 1);
    transform: translateY(var(--letter-y, 0px));
    transition: opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }
  .intro h1 .word > span {
    opacity: calc(var(--letter-opacity, 1) * var(--intro-letter-reveal, 0));
    transform: translateY(calc(var(--letter-y, 0px) + var(--intro-reveal-y, 12px)));
  }
  h1 .word { white-space: nowrap; }
  h1 .space { opacity: 1; transform: none; transition: none; width: 0.28em; }

  .accent-letter { color: var(--color-interactive-hover); font-style: italic; font-weight: 700; }

  .reel-layer {
    position: absolute; z-index: 15; inset: 0;
    overflow: hidden; perspective: 900px; perspective-origin: 50% 50%;
    pointer-events: none; transform-style: preserve-3d;
  }

  .reel-card {
    position: absolute; top: 50%; left: 50%;
    width: clamp(132px, 15vw, 196px); aspect-ratio: 9 / 16;
    opacity: var(--opacity);
    transform:
      translate(-50%, -50%)
      translate3d(var(--x), var(--y), var(--z))
      rotateX(var(--reel-tilt-x, 0deg))
      rotateY(var(--reel-tilt-y, 0deg))
      rotate(var(--rotate))
      scale(var(--scale));
    transform-style: preserve-3d;
    transform-origin: 50% 52%;
    transition: opacity 120ms linear, transform 120ms linear;
    will-change: transform, opacity;
    backface-visibility: hidden;
  }

  .reel-frame {
    position: relative; width: 100%; height: 100%;
    overflow: hidden; border: var(--card-border-width) solid var(--color-border-dark); border-radius: var(--radius-m);
    box-shadow:
      var(--reel-shadow-x, 0px) var(--reel-shadow-y, 36px) 80px rgb(var(--shadow-brand-rgb) / .22),
      0 10px 26px rgb(var(--shadow-dark-rgb) / .28);
    box-sizing: border-box; background: var(--color-surface-dark);
    transform: translateZ(18px);
    transform-style: preserve-3d;
  }

  .reel-video, .reel-placeholder {
    display: block; width: 100%; height: 100%; object-fit: cover;
    transform: translate3d(var(--reel-media-x, 0px), var(--reel-media-y, 0px), 0) scale(1.08);
    transition: transform 120ms linear;
    will-change: transform;
  }

  /* Parte invisibile, nessun transform — solo opacity gestita da JS */
  .next-screen {
    position: fixed; z-index: 20; inset: 0;
    display: grid; place-items: center; box-sizing: border-box;
    padding: var(--spacing-7);
    background: var(--color-surface-page);
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .next-message span {
    display: inline-block;
    font-size: 32px;
    opacity: var(--letter-opacity, 0);
    transform: translateY(var(--letter-y, 12px));
    transition: opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }
  .next-message { font-size: 0; }
  .next-message .accent-letter { color: var(--color-interactive-hover); font-style: italic; font-weight: 700; }
  .next-message .space { display: inline-block; opacity: 1; transform: none; transition: none; width: 0.28em; }

  /* Parte invisibile, sopra next-screen, solo opacity gestita da JS */
  .brand-screen {
    position: fixed; z-index: 25; inset: 0;
    display: grid; place-items: center;
    overflow: hidden;
    background: var(--color-surface-page);
    perspective: 900px; perspective-origin: 50% 50%;
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .floating-vector {
    position: absolute; z-index: 2; top: 0; left: 0;
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, grab;
    opacity: var(--float-opacity, 1);
    transform:
      translate3d(var(--float-x, 84px), var(--float-y, 96px), var(--float-hover-z, 0px))
      translate3d(var(--float-scroll-x, 0vw), var(--float-scroll-y, 0vh), 0)
      rotateZ(var(--float-rotate, 0deg))
      rotateX(var(--float-tilt-x, 0deg))
      rotateY(var(--float-tilt-y, 0deg))
      scale(calc(var(--float-scale, 1) * var(--float-hover-scale, 1)));
    transform-style: preserve-3d;
    transform-origin: 50% 50%;
    filter: drop-shadow(0 18px 22px rgb(var(--shadow-brand-rgb) / var(--float-shadow-alpha, 0)));
    transition: filter 160ms ease, opacity 100ms linear;
    will-change: transform, opacity;
  }

  .floating-vector:hover {
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, grabbing;
  }

  .floating-vector img {
    display: block; width: 100%; height: 100%;
    pointer-events: none;
    user-select: none;
  }

  .floating-raviolo {
    width: clamp(96px, 15vw, 166px);
    aspect-ratio: 233.427 / 232.847;
  }

  .floating-pizza {
    width: clamp(104px, 16vw, 178px);
    aspect-ratio: 302.008 / 313.605;
  }

  .floating-fusillo {
    width: clamp(92px, 14vw, 158px);
    aspect-ratio: 205.888 / 235.624;
  }

  .brand-lockup {
    position: relative;
    z-index: 3;
    display: grid;
    justify-items: center;
    align-items: center;
    gap: 0;
    width: min(1240px, calc(100vw - 24px));
    padding-block: clamp(18px, 4vh, 64px);
    overflow: visible;
    transform-style: preserve-3d;
  }

  .brand-word {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    overflow: visible;
    padding: 0.12em 0.1em 0.04em;
    font-family: var(--font-display);
    font-size: clamp(72px, 12vw, 160px);
    font-weight: 700;
    font-variation-settings: "wdth" 100;
    line-height: 1.18;
    color: var(--color-text-primary);
    transform-style: preserve-3d;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: geometricPrecision;
  }

  .brand-letter {
    display: inline-block;
    overflow: visible;
    padding: 0.08em 0.04em 0.12em;
    margin: -0.08em -0.018em -0.12em;
    line-height: 1.16;
    opacity: var(--bl-opacity, 0);
    transform:
      translate3d(var(--bl-x, 0px), var(--bl-y, 0px), var(--bl-z, 420px))
      rotate(var(--bl-rotate, 0deg))
      scale(var(--bl-scale, 2.9));
    transform-origin: 50% 54%;
    transition: none;
    will-change: opacity, transform;
    backface-visibility: hidden;
  }

  .brand-word.is-sharp {
    transform-style: flat;
  }

  .brand-word.is-sharp .brand-letter {
    opacity: 1;
    transform: none;
    transition: none;
    will-change: auto;
  }

  .brand-subtitle {
    max-width: calc(100vw - 48px);
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    opacity: var(--brand-subtitle-opacity, 0);
    transform: translateY(var(--brand-subtitle-y, 14px));
    transition: opacity 120ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }

  .brand-scroll-cue {
    position: absolute;
    top: calc(100% + clamp(72px, 14vh, 150px));
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
    text-align: center;
    white-space: nowrap;
    opacity: var(--brand-subtitle-opacity, 0);
    transform: translate(-50%, calc(var(--brand-subtitle-y, 14px) * 0.8));
    transition: opacity 120ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }

  .brand-scroll-cue span {
    word-break: break-word;
  }

  .brand-scroll-arrow {
    display: block;
    width: 40px;
    height: 40px;
    padding: 6px 7px;
    box-sizing: border-box;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .roles-screen {
    position: fixed; z-index: 35; inset: 0;
    overflow: hidden;
    background: var(--color-surface-page);
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .roles-top-bar {
    position: fixed; z-index: 55; top: 0; left: 0;
    box-sizing: border-box;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    width: 100%; height: var(--layout-topbar-height);
    padding: var(--layout-topbar-padding);
    color: var(--color-text-primary);
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms linear;
  }

  .roles-top-bar.is-hidden {
    opacity: 0 !important;
    pointer-events: none !important;
  }

  .role-grid {
    position: absolute; z-index: 2;
    top: 130px; left: var(--layout-page-gutter); right: var(--layout-page-gutter);
    height: min(620px, calc(100svh - 190px));
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 386px));
    justify-content: space-between;
    align-items: start;
    column-gap: var(--spacing-5);
    transform-style: flat;
  }

  .role-card {
    --role-card-radius: clamp(42px, 4.55vw, 65px);
    --role-card-depth-y: 12px;
    --role-card-lift-y: 0px;
    --role-reveal-duration: 270ms;
    --role-reveal-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --role-dialogue-delay: 14ms;
    --role-dialogue-opacity-gap: 100ms;

    position: relative;
    width: 100%;
    aspect-ratio: 373.448 / 524;
    overflow: visible;
    isolation: isolate;
    min-height: 0;
    border: 0;
    border-radius: var(--role-card-radius);
    background: transparent;
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, pointer;
    opacity: var(--role-card-opacity, 0);
    transform: translateY(var(--role-card-y, 38vh));
    transform-style: flat;
    transform-origin: 50% 50%;
    box-shadow: 0 20px 46px rgb(var(--shadow-brand-rgb) / var(--role-shadow-alpha, 0));
    transition:
      opacity 120ms linear,
      transform 180ms ease-out,
      box-shadow 180ms ease;
    will-change: opacity, transform;
    backface-visibility: hidden;
  }

  .role-card::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--role-card-radius);
    background: var(--color-text-primary);
    content: '';
    opacity: 0;
    pointer-events: none;
    transition: opacity 90ms ease;
  }

  .role-card::after {
    display: none;
  }

  .role-card:hover,
  .role-card:focus-visible {
    --role-card-lift-y: calc(var(--role-card-depth-y) * -1);
  }

  .role-card:hover::before,
  .role-card:focus-visible::before {
    opacity: 1;
  }

  .role-card.is-linked {
    cursor: pointer;
  }

  .role-card.is-servizio {
    --role-card-fill: #aa5dde;
  }

  .role-card.is-cucina {
    --role-card-fill: var(--color-interactive-hover);
  }

  .role-card.is-ufficio {
    --role-card-fill: #199444;
  }

  :global(.card-enter-fade) {
    position: fixed;
    z-index: 119;
    inset: 0;
    background: var(--color-surface-page);
    pointer-events: none;
  }

  :global(.role-card.is-entering) {
    overflow: visible;
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, auto;
    will-change: left, top, width, height, border-radius, box-shadow;
  }

  :global(.role-card.is-entering::after) {
    opacity: 0;
  }

  :global(.role-card.is-entering .role-card-bg) {
    z-index: 1;
  }

  :global(.role-card.is-entering::before) {
    opacity: 0;
  }

  .role-card-top {
    position: absolute;
    z-index: 1;
    inset: 0;
    overflow: hidden;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--role-card-radius);
    background: var(--color-surface-page);
    transform: translateY(var(--role-card-lift-y, 0px));
    transition: transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
    will-change: transform;
  }

  .role-card-top::before {
    position: absolute;
    z-index: 3;
    inset: 0;
    background: var(--role-card-fill, transparent);
    content: '';
    mix-blend-mode: plus-darker;
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease;
  }

  .role-card-bg {
    position: absolute;
    z-index: 1;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    opacity: 0;
    filter: grayscale(1) sepia(0.16) opacity(0.72);
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(var(--role-bg-y, 0px))
      scale(1);
    transition: opacity 220ms ease, filter 260ms ease, transform 90ms linear;
    user-select: none;
    pointer-events: none;
  }

  .role-card-bg-overlay {
    position: absolute;
    z-index: 2;
    inset: 0;
    background: var(--role-card-fill, transparent);
    opacity: 0;
    mix-blend-mode: plus-darker;
    transition: opacity 180ms ease;
    pointer-events: none;
  }

  .role-card:hover .role-card-bg-overlay,
  .role-card:focus-visible .role-card-bg-overlay {
    opacity: 0.34;
  }

  .role-hover-panel {
    position: absolute; z-index: 8;
    top: -2px;
    left: -3px;
    right: -3px;
    width: auto;
    height: calc(28.45% + 4px);
    min-height: 0;
    padding: 7.2% 13.5% 6.8%;
    color: var(--color-text-primary);
    opacity: 0;
    visibility: hidden;
    transform:
      translateX(var(--role-dialogue-x, 0px))
      translateY(calc(-100% - 8px + var(--role-dialogue-y, 0px)));
    transition:
      opacity 90ms linear,
      visibility 0s linear 190ms,
      transform var(--role-reveal-duration) var(--role-reveal-ease);
    pointer-events: none;
  }

  .role-hover-panel-shape {
    position: absolute;
    z-index: 0;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .role-hover-panel-shape path {
    fill: var(--color-border-primary);
    stroke: var(--color-border-primary);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .role-hover-panel p {
    position: absolute;
    z-index: 1;
    top: 0;
    right: 13.5%;
    bottom: 17.8%;
    left: 13.5%;
    display: grid;
    place-items: center;
    width: auto;
    margin: 0;
    font-family: var(--font-text);
    font-size: clamp(12px, 1.06vw, 15px);
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0;
    text-align: center;
    color: #f7f3ea;
  }

  .role-card-copy {
    position: absolute;
    z-index: 7;
    top: 50%;
    left: var(--spacing-5);
    right: var(--spacing-5);
    display: grid;
    justify-items: center;
    color: var(--color-text-primary);
    text-align: center;
    opacity: 1;
    transform:
      translateX(var(--role-copy-x, 0px))
      translateY(calc(-50% + var(--role-copy-y, 0px)));
    transition: opacity 160ms ease, transform 180ms ease;
    pointer-events: none;
  }

  .role-card-copy h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(42px, 4.1vw, 60px);
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0;
    text-transform: uppercase;
    font-variation-settings: "wdth" 100;
  }

  .role-card-copy p {
    margin: -6px 0 0;
    font-family: var(--font-text);
    font-size: clamp(13px, 1.1vw, 16px);
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: 0;
    transition: opacity 180ms ease;
  }

  .role-person {
    position: absolute; z-index: 6;
    left: 50%; bottom: -20px;
    width: auto;
    height: min(92%, 720px);
    opacity: 0;
    transform:
      translateX(calc(-50% + var(--role-person-base-x, 0px) + var(--role-person-x, 0px)))
      translateY(calc(72px + var(--role-person-base-y, 0px) + var(--role-person-y, 0px)));
    transition:
      opacity var(--role-reveal-duration) var(--role-reveal-ease),
      transform var(--role-reveal-duration) var(--role-reveal-ease);
    user-select: none;
    pointer-events: none;
    will-change: transform, opacity;
  }

  .role-person-outline,
  .role-person-fill {
    height: var(--cucina-person-height, var(--role-person-height));
  }

  .role-card.has-person-fill .role-person-outline {
    z-index: 5;
    opacity: 0;
    transform:
      translateX(calc(-50% + var(--role-person-base-x, 0px) + var(--role-person-x, 0px)))
      translateY(calc(var(--role-person-base-y, 0px) + var(--role-person-y, 0px)));
  }

  .role-person-fill {
    z-index: 4;
    opacity: 0;
  }

  .role-card.is-servizio {
    --role-person-base-x: 0px;
    --role-person-base-y: 295px;
    --role-person-height: min(120%, 1220px);
  }

  .role-card.is-cucina {
    --role-person-base-x: 0px;
    --role-person-base-y: 28px;
    --role-person-height: min(66%, 720px);
  }

  .role-card.is-ufficio {
    --role-person-base-x: 0px;
    --role-person-base-y: 188px;
    --role-person-height: min(95%, 920px);
  }

  .role-card.is-servizio .role-person {
    height: var(--servizio-person-height, var(--role-person-height));
  }

  .role-card.is-cucina .role-person {
    height: var(--cucina-person-height, var(--role-person-height));
  }

  .role-card.is-ufficio .role-person {
    height: var(--ufficio-person-height, var(--role-person-height));
  }

  .role-card.has-dialogue:hover .role-card-bg,
  .role-card.has-dialogue:focus-visible .role-card-bg {
    opacity: 0.52;
    filter: grayscale(1) sepia(0.16) opacity(0.74);
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(var(--role-bg-y, 0px))
      scale(1);
  }

  .role-card.has-dialogue:hover .role-card-top::before,
  .role-card.has-dialogue:focus-visible .role-card-top::before {
    opacity: 0.48;
  }

  .role-card.has-dialogue:hover .role-card-copy,
  .role-card.has-dialogue:focus-visible .role-card-copy {
    opacity: 0;
    transform:
      translateX(var(--role-copy-x, 0px))
      translateY(calc(-50% - 12px + var(--role-copy-y, 0px)));
  }

  .role-card.has-dialogue:hover .role-hover-panel,
  .role-card.has-dialogue:focus-visible .role-hover-panel {
    opacity: 1;
    visibility: visible;
    transition:
      opacity 80ms linear,
      visibility 0s linear,
      transform var(--role-reveal-duration) var(--role-reveal-ease);
    transform:
      translateX(var(--role-dialogue-x, 0px))
      translateY(var(--role-dialogue-y, 0px));
  }

  .role-card.has-dialogue:hover .role-person,
  .role-card.has-dialogue:focus-visible .role-person {
    opacity: 1;
    transform:
      translateX(calc(-50% + var(--role-person-base-x, 0px) + var(--role-person-x, 0px)))
      translateY(calc(var(--role-person-base-y, 0px) + var(--role-person-y, 0px)));
  }

  .role-card.has-person-fill:hover .role-person-outline,
  .role-card.has-person-fill:focus-visible .role-person-outline {
    opacity: 1;
  }

  .role-card.has-person-fill:hover .role-person-fill,
  .role-card.has-person-fill:focus-visible .role-person-fill {
    opacity: 1;
  }

  @media (max-width: 700px) {
    .audio-gate-content {
      width: calc(100vw - var(--spacing-8));
    }
    .audio-gate-utensil {
      top: 21svh;
      width: clamp(58px, 18vw, 76px);
      height: 84svh;
      opacity: 0.82;
    }
    .audio-gate-knife {
      top: 17svh;
      width: clamp(48px, 15vw, 64px);
      height: 101svh;
    }
    .audio-gate-content p {
      max-width: 250px;
      font-size: 16px;
    }
    .audio-gate-button-frame {
      min-width: 132px;
    }
    .about-top-bar { height: var(--layout-topbar-height-mobile); padding: var(--layout-topbar-padding-mobile); }
    .logo         { font-size: 34px; }
    .close-icon,
    .close-icon::before { width: 22px; }
    .about-copy {
      top: 132px;
      left: var(--layout-page-gutter-mobile);
      width: calc(100vw - var(--spacing-8));
      max-height: calc(100svh - 220px);
      font-size: 13px;
      line-height: 1.35;
    }
    .about-copy p { margin-bottom: 0.95em; }
    .polimi-logo {
      left: var(--layout-page-gutter-mobile);
      bottom: var(--spacing-5);
      width: min(180px, 48vw);
    }
    .intro        { padding: var(--layout-page-gutter-mobile); }
    .persistent-top-audio { top: calc(var(--unit-24) + var(--unit-4)); }
    h1, .next-message { font-size: 24px; }
    .next-message span { font-size: 24px; }
    .reel-card    { width: min(38vw, 148px); }
    .next-screen  { padding: var(--layout-page-gutter-mobile); }
    .brand-word   { font-size: clamp(40px, 10.5vw, 76px); }
    .brand-lockup { gap: 0; }
    .brand-subtitle { font-size: 24px; }
    .brand-scroll-cue { top: calc(100% + clamp(58px, 11vh, 96px)); }
    .floating-raviolo { width: clamp(86px, 28vw, 124px); }
    .floating-pizza { width: clamp(92px, 30vw, 132px); }
    .floating-fusillo { width: clamp(82px, 26vw, 118px); }
    .roles-top-bar { height: var(--layout-topbar-height-mobile); padding: var(--layout-topbar-padding-mobile); }
    .role-grid {
      top: 104px; left: var(--layout-page-gutter-mobile);
      width: calc(100vw - var(--spacing-8));
      height: calc(100svh - 132px);
      grid-template-columns: 1fr;
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 12px;
      justify-content: stretch;
      align-items: stretch;
      transform: none;
    }
    .role-card {
      --role-card-radius: clamp(34px, 12vw, 54px);

      min-height: 0;
      aspect-ratio: auto;
      border-radius: var(--role-card-radius);
    }
    .role-card-copy { left: var(--spacing-4); right: var(--spacing-4); }
    .role-card-copy h2 { font-size: clamp(28px, 10vw, 44px); line-height: 1.08; }
    .role-card-copy p { margin-top: 2px; font-size: 11px; line-height: 1.25; }
    .role-card-bg {
      inset: 0;
      width: 100%;
      height: 100%;
      object-position: center center;
    }
    .role-hover-panel {
      top: -2px;
      left: -3px;
      right: -3px;
      width: auto;
      height: calc(28.45% + 4px);
      min-height: 0;
      padding: 5.2% var(--spacing-4) 4.8%;
    }
    .role-hover-panel p {
      left: var(--spacing-4);
      right: var(--spacing-4);
      font-size: clamp(11px, 3.4vw, 14px);
      line-height: 1.35;
    }
    .role-person {
      height: min(98%, 400px);
      bottom: -158px;
    }
    .role-card.is-servizio .role-person,
    .role-card.is-cucina .role-person,
    .role-card.is-ufficio .role-person {
      height: var(--role-person-mobile-height, min(98%, 400px));
    }
  }
</style>
