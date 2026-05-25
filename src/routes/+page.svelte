<script lang="ts">
  import VolumeMaxIcon from '$lib/VolumeMaxIcon.svelte';
  import VolumeOffIcon from '$lib/VolumeOffIcon.svelte';
  import { gsap } from 'gsap';
  import { onMount, tick } from 'svelte';

  let reelProgress = 0;
  let reelTravelDirection = 1;
  let pageProgress = 0;
  let brandProgress = 0;
  let homeScreen: HTMLElement;
  let nextScreen: HTMLElement;
  let brandScreen: HTMLElement;
  let brandSubtitleEl: HTMLElement;
  let rolesScreen: HTMLElement;
  let reelCards: HTMLElement[] = [];
  let roleCards: HTMLElement[] = [];
  let introLetters: HTMLElement[] = [];
  let nextLetters: HTMLElement[] = [];
  let introEl: HTMLElement;
  let audioGateButtonEl = $state<HTMLElement>();
  let isAudioGateVisible = $state(true);
  let isAudioGateOpening = $state(false);
  let activeAudioGateChoice = $state<'on' | 'off' | undefined>();
  let introRevealTween: gsap.core.Tween | undefined;
  let isAudioMuted = $state(true);
  let audioLabel = $derived(isAudioMuted ? 'Audio disattivato' : 'Audio attivo');
  let isBrandWordSharp = $state(false);
  let isAboutOpen = $state(false);
  let aboutScreenEl = $state<HTMLElement>();
  let aboutTween: gsap.core.Tween | undefined;
  let mountFadeTween: gsap.core.Tween | undefined;
  let mountFadeDelay: gsap.core.Tween | undefined;
  let flowTween: gsap.core.Tween | undefined;
  const audioFadeTweens: Partial<Record<AudioRole, gsap.core.Tween>> = {};
  const audioLoopFrames: Partial<Record<AudioRole, number>> = {};
  const roleAudioSources: Partial<Record<AudioRole, MediaElementAudioSourceNode>> = {};
  const roleAudioGains: Partial<Record<AudioRole, GainNode>> = {};
  let roleAudioContext: AudioContext | undefined;
  let audioUnlocked = false;

  const audioRoles = ['ufficio', 'cucina', 'servizio'] as const;
  type AudioRole = (typeof audioRoles)[number];
  type RoleItem = {
    title: AudioRole;
    description: string;
    speaker: string;
    dialogue: string;
    hoverText: string;
    personSrc: string;
  };

  const roleAudio: Record<
    AudioRole,
    {
      src: string;
      startTime: number;
      maxTime: number;
      targetVolume: number;
      outputGain?: number;
      fadeIn?: boolean;
      fadeInDuration?: number;
      el?: HTMLAudioElement;
    }
  > = {
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
  const roleAudioEntries = audioRoles.map((role) => ({ role, config: roleAudio[role] }));

  const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);
  const ease  = (v: number) => v * v * (3 - 2 * v);
  const fixed = (v: number, digits = 3) => v.toFixed(digits);
  const px = (v: number, digits = 1) => `${v.toFixed(digits)}px`;
  const deg = (v: number, digits = 2) => `${v.toFixed(digits)}deg`;
  const vh = (v: number, digits = 1) => `${v.toFixed(digits)}vh`;
  const vw = (v: number, digits = 2) => `${v.toFixed(digits)}vw`;

  type CssVars = Record<`--${string}`, string | number>;
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
    const start = msg.indexOf(accentWord);
    const end   = start + accentWord.length;
    return msg.split('').map((letter, i) => ({
      index:    i,
      letter,
      isSpace:  letter === ' ',
      isAccent: i >= start && i < end
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

  const introMessage    = 'Tutti abbiamo visto i video virali sulla cucina olimpica...';
  const nextMessage     = 'Incontra le persone che hanno reso tutto questo possibile.';
  const audioGateMessage = "Attiva l'audio per un'esperienza più immersiva";
  const brandWord       = 'Retrogusto';
  const brandSubtitle   = 'Dentro le cucine di Milano Cortina 2026';
  const introCharacters = parseMessage(introMessage, 'cucina');
  const nextCharacters  = parseMessage(nextMessage,  'persone');
  const audioGateCharacters = audioGateMessage.split('').map((letter, index) => ({
    letter,
    index,
    isSpace: letter === ' '
  }));
  const introWords      = groupWords(introCharacters);

  const brandLetters = brandWord.split('').map((letter, i) => ({ letter, i }));
  const brandLetterIndexes = brandLetters.map((_, i) => i);
  let brandArrivalRank: number[] = new Array(brandLetters.length).fill(0);
  let brandBurstRank: number[] = new Array(brandLetters.length).fill(0);
  let brandBurstMotion = brandLetters.map(() => ({ x: 0, y: 0, rotate: 0 }));
  let brandLetterEls: HTMLElement[] = [];
  let floatingEls: HTMLElement[] = [];
  const rolesRevealStart = 2;
  const rolesRevealDuration = 0.58;
  const rolesScreenFadeEnd = 0.52;
  const roleCardStagger = 0.055;
  const roleCardRevealDuration = 0.2;
  const brandScrollMax = rolesRevealStart + rolesRevealDuration;
  const flowTotalMax = 2 + brandScrollMax;
  const copyScrollStart = 1;
  const copyScrollEnd = 2;
  const brandCopyScrollEnd = 3.18;
  const rolesScrollStart = 2 + rolesRevealStart;
  const rolesScrollVisible = rolesScrollStart + rolesRevealDuration;
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
  const mountFadeMotion = { delay: 0.4, duration: 2, ease: 'power2.out' };
  const flowMotion = {
    duration: 0.82,
    reelDuration: 0.34,
    ease: 'power3.out',
    maxWheelStep: 0.085,
    maxTargetLead: 0.34,
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
    '--role-tilt-x': '0deg',
    '--role-tilt-y': '0deg',
    '--role-bg-x': '0px',
    '--role-bg-y': '0px',
    '--role-copy-x': '0px',
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
    burstStart: 2.1,
    burstDuration: 1.86,
    burstSpread: 0.64,
    burstStaggerDuration: 0.36,
    burstScale: 1.35
  };
  const reelMotion = {
    stagger: 0.085,
    startOffset: 0.04,
    duration: 0.35,
    zStart: -980,
    zRange: 1850,
    scaleStart: 0.28,
    scaleRange: 4.2,
    opacityInDuration: 0.18,
    opacityOutStart: 0.76,
    opacityOutDuration: 0.24,
    rotateStartRatio: 0.35,
    rotateEndRatio: 0.65,
    spreadRadius: 1.4,
    dragTiltX: 7,
    dragTiltY: 8,
    dragZLift: 90,
    dragScale: 0.04,
    mediaParallaxX: 10,
    mediaParallaxY: 7,
    layerParallaxX: 30,
    layerParallaxY: 18,
    layerSpeed: 0.18,
    layerZ: 240,
    layerScale: 0.075,
    curveRadius: 8,
    swayRadius: 4,
    maxSpreadX: 66,
    maxSpreadY: 52,
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
  const roleTiltMotion = {
    tiltX: 11,
    tiltY: 13,
    tiltXLimit: 7,
    tiltYLimit: 8,
    bgX: -8.1,
    bgY: -4.9,
    copyX: 2.7,
    dialogueX: 3.2,
    dialogueY: 1.7,
    personX: 0,
    personY: 2.8
  };
  const floatingExitMotion = {
    start: 1.42,
    duration: 0.92,
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
      personSrc: '/images/carlo-zarri-figma.png'
    },
    {
      title: 'cucina',
      description: 'descrizione testo',
      speaker: 'Stefano Paganini',
      dialogue: 'il mio ruolo ... seguimi nella cucina per saperne di più',
      hoverText: 'io sono stefano paganini seguimi in cucina',
      personSrc: '/images/stefano-paganini-figma.png'
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
    curve: number;
    sway: number;
    opacityOutStart?: number;
    opacityOutDuration?: number;
  };

  const reels: ReelItem[] = [
    { src: '/videos/tiramisu.mp4', bg: 'var(--reel-placeholder-neutral)', fromX: -8,  fromY:  4, toX: -34, toY: -18, rotate: -8,  layer:  0, curve:  0.8, sway: -0.3 },
    { src: '/videos/1.mp4',        bg: 'var(--color-text-primary)',        fromX:  7,  fromY: -3, toX:  30, toY:  16, rotate:  7,  layer:  1, curve: -0.6, sway:  0.9 },
    { src: '/videos/2.mp4',        bg: 'var(--reel-placeholder-gold)',     fromX: -4,  fromY: -8, toX: -18, toY:  28, rotate: 10,  layer:  0, curve: -1.0, sway:  0.4 },
    { src: '/videos/3.mp4',        bg: 'var(--color-surface-dark)',        fromX: 13,  fromY:  8, toX:  36, toY: -24, rotate: -11, layer:  1, curve:  0.5, sway: -0.8, opacityOutStart: 0.58, opacityOutDuration: 0.16 },
    { src: '/videos/4.mp4',        bg: 'var(--reel-placeholder-lavender)', fromX: -10, fromY: -2, toX: -40, toY:   6, rotate: -5,  layer: -1, curve: -0.45, sway: -1.0 },
    { src: '/videos/5.MP4',        bg: 'var(--reel-placeholder-neutral)',  fromX:  5,  fromY:  6, toX:  24, toY: -30, rotate:  9,  layer:  0, curve:  1.0, sway:  0.25 },
    { src: '/videos/6.MP4',        bg: 'var(--reel-placeholder-gold)',     fromX: -12, fromY:  7, toX: -28, toY:  18, rotate: -12, layer: -1, curve:  0.35, sway:  0.8 },
    { src: '/videos/7.MP4',        bg: 'var(--color-text-primary)',        fromX: 10,  fromY: -7, toX:  38, toY:   2, rotate:  5,  layer:  1, curve: -0.85, sway: -0.45 },
    { src: '/videos/8.MP4',        bg: 'var(--color-surface-dark)',        fromX: -6,  fromY: -5, toX: -36, toY: -28, rotate:  8,  layer:  0, curve:  0.65, sway:  1.0 },
    { src: '/videos/9.MP4',        bg: 'var(--reel-placeholder-lavender)', fromX: 12,  fromY:  3, toX:  42, toY:  24, rotate: -9,  layer:  1, curve:  0.2, sway: -0.7 },
    { src: '/videos/10.MP4',       bg: 'var(--reel-placeholder-neutral)',  fromX: -3,  fromY:  9, toX: -16, toY:  34, rotate:  6,  layer: -1, curve: -0.75, sway:  0.55 },
    { src: '/videos/11.MP4',       bg: 'var(--color-text-primary)',        fromX:  3,  fromY: -9, toX:  16, toY: -34, rotate: -7,  layer:  0, curve:  0.9, sway: -0.15 },
    { src: '/videos/12.MP4',       bg: 'var(--reel-placeholder-gold)',     fromX: -14, fromY:  1, toX: -44, toY:  -4, rotate: 11,  layer: -1, curve: -0.25, sway: -0.9 },
    { src: '/videos/13.MP4',       bg: 'var(--color-surface-dark)',        fromX: 14,  fromY: -1, toX:  44, toY:   8, rotate: -10, layer:  1, curve: -0.55, sway:  0.35 },
    { src: '/videos/14.MP4',       bg: 'var(--reel-placeholder-lavender)', fromX: -7,  fromY: -10, toX: -22, toY: -36, rotate: -6,  layer:  0, curve:  0.45, sway:  0.7 }
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
    const layerLocal = clamp(local + layer * reelMotion.layerSpeed * reelTravelDirection);
    const e     = ease(layerLocal);
    const opacityOutStart = reel.opacityOutStart ?? reelMotion.opacityOutStart;
    const opacityOutDuration = reel.opacityOutDuration ?? reelMotion.opacityOutDuration;
    const fade = clamp(local / reelMotion.opacityInDuration) * (1 - clamp((local - opacityOutStart) / opacityOutDuration));
    const pathX = reel.toX - reel.fromX;
    const pathY = reel.toY - reel.fromY;
    const pathLength = Math.hypot(pathX, pathY) || 1;
    const directionX = (pathX / pathLength) * reelTravelDirection;
    const directionY = (pathY / pathLength) * reelTravelDirection;
    const normalX = -pathY / pathLength;
    const normalY = pathX / pathLength;
    const drag = Math.sin(local * Math.PI) * fade;
    const layerTravel = (e - 0.5) * layer;
    const baseX = reel.fromX + (reel.toX - reel.fromX) * e;
    const baseY = reel.fromY + (reel.toY - reel.fromY) * e;
    const curveOffset = Math.sin(e * Math.PI) * reel.curve * reelMotion.curveRadius;
    const swayOffset = Math.sin((e * Math.PI * 2) + index * 0.73) * reel.sway * reelMotion.swayRadius * fade;
    const x = baseX * reelMotion.spreadRadius
      + normalX * curveOffset
      + directionX * reelMotion.layerParallaxX * layerTravel
      + normalX * swayOffset;
    const y = baseY * reelMotion.spreadRadius
      + normalY * curveOffset
      + directionY * reelMotion.layerParallaxY * layerTravel
      + normalY * swayOffset;
    return {
      z:       reelMotion.zStart + e * reelMotion.zRange + layer * reelMotion.layerZ + drag * reelMotion.dragZLift,
      scale:   reelMotion.scaleStart + e * reelMotion.scaleRange + layer * reelMotion.layerScale + drag * reelMotion.dragScale,
      opacity: fade,
      x:       clamp(x, -reelMotion.maxSpreadX, reelMotion.maxSpreadX),
      y:       clamp(y, -reelMotion.maxSpreadY, reelMotion.maxSpreadY),
      rotate:  reel.rotate * (reelMotion.rotateStartRatio + e * reelMotion.rotateEndRatio),
      tiltX:   -directionY * reelMotion.dragTiltX * drag,
      tiltY:   directionX * reelMotion.dragTiltY * drag,
      mediaX:  -directionX * reelMotion.mediaParallaxX * drag,
      mediaY:  -directionY * reelMotion.mediaParallaxY * drag,
      shadowX: directionX * reelMotion.shadowX * drag,
      shadowY: 36 + Math.abs(directionY) * reelMotion.shadowY * drag
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
      '--role-tilt-x': deg(clamp(-ny * roleTiltMotion.tiltX, -roleTiltMotion.tiltXLimit, roleTiltMotion.tiltXLimit)),
      '--role-tilt-y': deg(clamp(nx * roleTiltMotion.tiltY, -roleTiltMotion.tiltYLimit, roleTiltMotion.tiltYLimit)),
      '--role-bg-x': px(nx * roleTiltMotion.bgX),
      '--role-bg-y': px(ny * roleTiltMotion.bgY),
      '--role-copy-x': px(nx * roleTiltMotion.copyX),
      '--role-dialogue-x': px(nx * roleTiltMotion.dialogueX),
      '--role-dialogue-y': px(ny * roleTiltMotion.dialogueY),
      '--role-person-x': px(nx * roleTiltMotion.personX),
      '--role-person-y': px(ny * roleTiltMotion.personY)
    });
  }

  function resetRoleCard(index: number) {
    const card = roleCards[index];
    if (!card) return;
    setCssVars(card, roleCardResetVars);
  }

  function tiltAudioGateButton(e: PointerEvent) {
    if (!audioGateButtonEl) return;
    const { nx, ny } = getPointerOffset(e, audioGateButtonEl);
    setCssVars(audioGateButtonEl, {
      '--gate-tilt-x': deg(clamp(-ny * roleTiltMotion.tiltX, -roleTiltMotion.tiltXLimit, roleTiltMotion.tiltXLimit)),
      '--gate-tilt-y': deg(clamp(nx * roleTiltMotion.tiltY, -roleTiltMotion.tiltYLimit, roleTiltMotion.tiltYLimit))
    });
  }

  function resetAudioGateButton() {
    setCssVars(audioGateButtonEl, {
      '--gate-tilt-x': '0deg',
      '--gate-tilt-y': '0deg'
    });
  }

  function revealIntroLetters() {
    introRevealTween?.kill();
    gsap.set(introLetters, {
      '--intro-letter-reveal': 0,
      '--intro-reveal-y': '12px'
    });
    introRevealTween = gsap.to(introLetters, {
      '--intro-letter-reveal': 1,
      '--intro-reveal-y': '0px',
      duration: 0.64,
      ease: 'power3.out',
      stagger: 0.028
    });
  }

  function reloadHome(event: MouseEvent) {
    event.preventDefault();
    if (window.location.pathname === '/') {
      window.location.reload();
    } else {
      window.location.assign('/');
    }
  }

  async function openAbout() {
    aboutTween?.kill();
    isAboutOpen = true;
    await tick();
    if (!aboutScreenEl) return;
    aboutTween = gsap.fromTo(
      aboutScreenEl,
      aboutClosedVars,
      {
        ...aboutOpenVars,
        duration: aboutMotion.openDuration,
        ease: aboutMotion.openEase,
        clearProps: 'transform'
      }
    );
  }

  function closeAbout() {
    if (!aboutScreenEl) {
      isAboutOpen = false;
      return;
    }
    aboutTween?.kill();
    aboutTween = gsap.to(aboutScreenEl, {
      ...aboutClosedVars,
      duration: aboutMotion.closeDuration,
      ease: aboutMotion.closeEase,
      onComplete: () => {
        isAboutOpen = false;
      }
    });
  }

  function cancelAudioFrame(store: Partial<Record<AudioRole, number>>, role: AudioRole) {
    const frame = store[role];
    if (frame) cancelAnimationFrame(frame);
    store[role] = 0;
  }

  function fadeAudio(role: AudioRole, targetVolume: number, afterFade?: () => void, duration = audioFadeMotion.duration) {
    const config = roleAudio[role];
    const audio = config.el;
    if (!audio) return;
    audioFadeTweens[role]?.kill();
    audioFadeTweens[role] = gsap.to(audio, {
      volume: targetVolume,
      ...audioFadeMotion,
      duration,
      overwrite: true,
      onComplete: () => {
        audio.volume = targetVolume;
        audioFadeTweens[role] = undefined;
        afterFade?.();
      }
    });
  }

  function setupRoleAudioOutput(role: AudioRole) {
    const config = roleAudio[role];
    const audio = config.el;
    if (!audio || roleAudioSources[role]) return;

    roleAudioContext ??= new AudioContext();
    const source = roleAudioContext.createMediaElementSource(audio);
    const gain = roleAudioContext.createGain();
    gain.gain.value = config.outputGain ?? 1;
    source.connect(gain);
    gain.connect(roleAudioContext.destination);
    roleAudioSources[role] = source;
    roleAudioGains[role] = gain;
  }

  async function startRoleAudio(role: AudioRole) {
    const config = roleAudio[role];
    const audio = config.el;
    if (!audio || isAudioMuted) return;

    audioFadeTweens[role]?.kill();
    audioFadeTweens[role] = undefined;
    cancelAudioFrame(audioLoopFrames, role);
    audio.loop = false;
    audio.pause();
    audio.currentTime = config.startTime;
    setupRoleAudioOutput(role);
    await roleAudioContext?.resume();
    audio.volume = config.fadeIn === false ? config.targetVolume : 0;

    try {
      await audio.play();
      if (config.fadeIn !== false) fadeAudio(role, config.targetVolume, undefined, config.fadeInDuration);
    } catch {
      // Browsers may block hover audio before the first user gesture.
    }
  }

  function stopRoleAudio(role: AudioRole) {
    const config = roleAudio[role];
    const audio = config.el;
    if (!audio) return;

    cancelAudioFrame(audioLoopFrames, role);
    fadeAudio(role, 0, () => {
      audio.pause();
      audio.currentTime = config.startTime;
    });
  }

  function toggleAudioMuted() {
    isAudioMuted = !isAudioMuted;
    if (isAudioMuted) {
      stopAllRoleAudio();
    }
  }

  async function openAudioGate(nextMuted = isAudioMuted, choice: 'on' | 'off') {
    if (isAudioGateOpening) return;
    isAudioMuted = nextMuted;
    activeAudioGateChoice = choice;
    isAudioGateOpening = true;
    if (!nextMuted) await unlockAmbientAudio();
    window.setTimeout(revealIntroLetters, 760);
    window.setTimeout(() => {
      isAudioGateVisible = false;
    }, 1280);
  }

  async function unlockAmbientAudio() {
    if (audioUnlocked) return;
    const audios = Object.values(roleAudio).map((config) => config.el).filter(Boolean) as HTMLAudioElement[];
    if (!audios.length) return;

    try {
      audioRoles.forEach(setupRoleAudioOutput);
      await roleAudioContext?.resume();
      await Promise.all(
        audios.map(async (audio) => {
          const previousVolume = audio.volume;
          audio.volume = 0;
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
          audio.volume = previousVolume;
        })
      );
      audioUnlocked = true;
    } catch {
      audioUnlocked = false;
    }
  }

  function stopAllRoleAudio() {
    audioRoles.forEach(stopRoleAudio);
  }

  function cancelAllAudioFrames() {
    audioRoles.forEach((role) => {
      audioFadeTweens[role]?.kill();
      audioFadeTweens[role] = undefined;
      cancelAudioFrame(audioLoopFrames, role);
    });
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
    const rolesEase = ease(clamp(rolesProgress / rolesScreenFadeEnd));
    if (rolesScreen) {
      setLayerState(rolesScreen, rolesEase, rolesProgress > 0.08);
    }
    roleCards.forEach((card, index) => {
      if (!card) return;
      const cardProgress = clamp((rolesProgress - index * roleCardStagger) / roleCardRevealDuration);
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
  }

  onMount(() => {
    const flowState = { value: 0 };
    let targetFlowValue = 0;
    let isAutoScrolling = false;
    randomizeBrandLetters();

    mountFadeDelay = gsap.delayedCall(mountFadeMotion.delay, () => {
      if (!introEl) return;
      mountFadeTween = gsap.to(introEl, {
        '--mount-opacity': 1,
        duration: mountFadeMotion.duration,
        ease: mountFadeMotion.ease
      });
    });

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

    const tweenFlowTo = (value: number, duration = flowMotion.duration) => {
      targetFlowValue = clamp(value, 0, flowTotalMax);
      isAutoScrolling = false;
      flowTween = gsap.to(flowState, {
        value: targetFlowValue,
        duration,
        ease: flowMotion.ease,
        overwrite: true,
        onUpdate: () => applyFlowTotal(flowState.value)
      });
    };

    const autoFlowTo = (value: number, duration: number) => {
      targetFlowValue = clamp(value, 0, flowTotalMax);
      isAutoScrolling = true;
      flowTween = gsap.to(flowState, {
        value: targetFlowValue,
        duration,
        ease: 'power1.inOut',
        overwrite: true,
        onUpdate: () => applyFlowTotal(flowState.value),
        onComplete: () => {
          isAutoScrolling = false;
        },
        onInterrupt: () => {
          isAutoScrolling = false;
        }
      });
    };

    const queueFlow = (delta: number) => {
      if (isAutoScrolling) return;

      const isCopyForwardStep = delta > 0 && flowState.value >= copyScrollStart && flowState.value < copyScrollEnd;
      const isCopyBackStep = delta < 0 && flowState.value > copyScrollStart && flowState.value <= copyScrollEnd;
      if (isCopyForwardStep || isCopyBackStep) {
        autoFlowTo(isCopyForwardStep ? copyScrollEnd : copyScrollStart, 1.35);
        return;
      }

      const isBrandForwardStep = delta > 0 && flowState.value >= copyScrollEnd && flowState.value < brandCopyScrollEnd;
      const isBrandBackStep = delta < 0 && flowState.value > copyScrollEnd && flowState.value <= brandCopyScrollEnd;
      if (isBrandForwardStep || isBrandBackStep) {
        autoFlowTo(isBrandForwardStep ? brandCopyScrollEnd : copyScrollEnd, 1.55);
        return;
      }

      const isRolesForwardStep = delta > 0 && flowState.value >= brandCopyScrollEnd && flowState.value < rolesScrollVisible;
      const isRolesBackStep = delta < 0 && flowState.value > brandCopyScrollEnd && flowState.value <= flowTotalMax;
      if (isRolesForwardStep) {
        autoFlowTo(rolesScrollVisible, 1.75);
        return;
      }

      if (isRolesBackStep) {
        autoFlowTo(brandCopyScrollEnd, 1.45);
        return;
      }

      const isMovingThroughReels = flowState.value < 1 || (delta < 0 && flowState.value <= copyScrollStart);
      const effectiveDelta = isMovingThroughReels ? delta * flowMotion.reelScrollSlowdown : delta;
      const targetLead = isMovingThroughReels ? flowMotion.reelMaxTargetLead : flowMotion.maxTargetLead;
      targetFlowValue = flowState.value;
      const unclampedTarget = targetFlowValue + effectiveDelta;
      const minTarget = flowState.value - targetLead;
      const maxTarget = flowState.value + targetLead;
      tweenFlowTo(
        clamp(unclampedTarget, minTarget, maxTarget),
        isMovingThroughReels ? flowMotion.reelDuration : flowMotion.duration
      );
    };

    const normalizeWheelDelta = (e: WheelEvent) => {
      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
      const rawStep = (e.deltaY * unit) / 2400;
      return clamp(rawStep, -flowMotion.maxWheelStep, flowMotion.maxWheelStep);
    };

    const onWheel   = (e: WheelEvent)    => {
      e.preventDefault();
      if (isAudioGateVisible) return;
      queueFlow(normalizeWheelDelta(e));
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (isAudioGateVisible) {
        const activeEl = document.activeElement;
        if ((e.key === ' ' || e.key === 'Enter') && activeEl?.classList.contains('audio-gate-button')) return;
        e.preventDefault();
        return;
      }
      unlockAmbientAudio();
      const step = keyFlowSteps[e.key];
      if (step !== undefined) { e.preventDefault(); queueFlow(step); }
    };

    applyReelStyles();
    applyAllStyles();
    gsap.set(introLetters, {
      '--intro-letter-reveal': 0,
      '--intro-reveal-y': '12px'
    });
    gsap.ticker.add(moveFloatingAssets);
    window.addEventListener('wheel',   onWheel,   { passive: false });
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('pointerdown', unlockAmbientAudio, { passive: true });
    return () => {
      gsap.ticker.remove(moveFloatingAssets);
      flowTween?.kill();
      mountFadeDelay?.kill();
      mountFadeTween?.kill();
      introRevealTween?.kill();
      aboutTween?.kill();
      cancelAllAudioFrames();
      window.removeEventListener('wheel',   onWheel);
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('pointerdown', unlockAmbientAudio);
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
    <div class="audio-gate-content">
      <div class="audio-gate-controls">
        <div class="audio-gate-button-wrap" class:is-active={activeAudioGateChoice === 'on'}>
          <span class="audio-gate-reveal" aria-hidden="true"></span>
          <button
            bind:this={audioGateButtonEl}
            class="audio-gate-button"
            type="button"
            aria-label="Entra con audio attivo"
            onpointermove={tiltAudioGateButton}
            onpointerleave={resetAudioGateButton}
            onclick={() => openAudioGate(false, 'on')}
          >
            <VolumeMaxIcon class="volume-icon volume-max-icon" />
          </button>
        </div>
        <div class="audio-gate-button-wrap" class:is-active={activeAudioGateChoice === 'off'}>
          <span class="audio-gate-reveal" aria-hidden="true"></span>
          <button
            class="audio-gate-button"
            type="button"
            aria-label="Entra con audio disattivato"
            onclick={() => openAudioGate(true, 'off')}
          >
            <VolumeOffIcon class="volume-icon" />
          </button>
        </div>
      </div>
      <p id="audio-gate-copy" aria-label={audioGateMessage}>
        {#each audioGateCharacters as { letter, isSpace, index } (index)}
          {#if index === 32}
            <br aria-hidden="true" />
          {:else if isSpace}
            <span class="space" aria-hidden="true">&nbsp;</span>
          {:else}
            <span style={`--gate-letter-index: ${index}`} aria-hidden="true">{letter}</span>
          {/if}
        {/each}
      </p>
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
    {#if isAudioMuted}
      <VolumeOffIcon class="volume-icon" />
    {:else}
      <VolumeMaxIcon class="volume-icon volume-max-icon" />
    {/if}
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


<section bind:this={brandScreen} class="brand-screen" aria-label="Retrogusto">
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
  </div>
</section>

<section bind:this={rolesScreen} class="roles-screen" aria-label="Aree Retrogusto">
  <header class="roles-top-bar" aria-label="Navigazione principale">
    <a class="logo" href="/" aria-label="Retrogusto home" onclick={reloadHome}>RG</a>
    <span class="top-bar-audio top-bar-audio-slot" aria-hidden="true"></span>
    <button
      class="icon-button top-bar-menu"
      type="button"
      aria-label="Apri sezione about"
      aria-expanded={isAboutOpen}
      onclick={openAbout}
    >
      <span class="menu-icon" aria-hidden="true"></span>
    </button>
  </header>

  <div class="role-grid">
    {#each roleItems as item, index}
      <article
        bind:this={roleCards[index]}
        class="role-card"
        class:is-ufficio={item.title === 'ufficio'}
        class:is-cucina={item.title === 'cucina'}
        class:is-servizio={item.title === 'servizio'}
        class:has-dialogue={Boolean(item.dialogue)}
        onpointerenter={() => startRoleAudio(item.title)}
        onpointermove={(event) => tiltRoleCard(event, index)}
        onpointerleave={() => {
          stopRoleAudio(item.title);
          resetRoleCard(index);
        }}
      >
        <img class="role-card-bg" src="/images/figma-kitchen-scene.png" alt="" draggable="false" />
        <div class="role-hover-panel">
          <p>{item.hoverText}</p>
        </div>
        <div class="role-card-copy">
          <h2>{item.title}</h2>
          <p>{item.description}</p>
        </div>
        {#if item.personSrc}
          <img class="role-person" src={item.personSrc} alt={item.speaker} draggable="false" />
        {/if}
      </article>
    {/each}
  </div>
</section>

{#each roleAudioEntries as { role, config } (role)}
  <audio
    bind:this={config.el}
    src={config.src}
    preload="none"
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
      <a class="logo about-logo" href="/" aria-label="Retrogusto home" onclick={reloadHome}>RG</a>
      <button
        class="icon-button top-bar-audio about-audio"
        type="button"
        aria-label={audioLabel}
        aria-pressed={isAudioMuted}
        onclick={toggleAudioMuted}
      >
        {#if isAudioMuted}
          <VolumeOffIcon class="volume-icon" />
        {:else}
          <VolumeMaxIcon class="volume-icon volume-max-icon" />
        {/if}
      </button>
      <button
        class="icon-button top-bar-menu about-close"
        type="button"
        aria-label="Chiudi sezione about"
        onclick={closeAbout}
      >
        <span class="close-icon" aria-hidden="true"></span>
      </button>
    </header>

    <div class="about-copy" data-node-id="256:1831">
      <h2 id="about-title" class="visually-hidden">About Retrogusto</h2>
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
    cursor: url('/cursors/retrogusto-cursor.svg') 2 2, auto;
    overscroll-behavior: none;
  }
  :global(button), :global(a) {
    font: inherit;
    cursor: url('/cursors/retrogusto-cursor.svg') 2 2, pointer;
  }

  .audio-gate {
    position: fixed;
    z-index: 100;
    inset: 0;
    overflow: hidden;
    background: var(--color-text-primary);
    color: var(--color-text-inverse);
    cursor: url('/cursors/retrogusto-cursor-light.svg') 2 2, auto;
    opacity: 1;
    transition: opacity 180ms ease 720ms;
  }

  .audio-gate.is-opening {
    opacity: 0;
    pointer-events: none;
  }

  .audio-gate-content {
    --gate-size: 80px;

    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    justify-items: center;
    gap: 0;
    width: min(100%, 1512px);
    transform: translate(-50%, -50%);
  }

  .audio-gate-controls {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-6);
    perspective: 900px;
    perspective-origin: 50% 50%;
  }

  .audio-gate-button-wrap {
    position: relative;
    z-index: 1;
    width: var(--gate-size);
    aspect-ratio: 1;
    display: grid;
    place-items: center;
  }

  .audio-gate-reveal {
    position: absolute;
    z-index: 1;
    inset: -1px;
    border-radius: 50%;
    background: var(--color-surface-page);
    opacity: 0;
    transform: translate3d(0, 0, 0) scale(0.82);
    transform-origin: center;
    transition:
      opacity 180ms ease,
      transform 220ms ease;
    will-change: opacity, transform;
  }

  .audio-gate-button-wrap:hover .audio-gate-reveal,
  .audio-gate-button-wrap:focus-within .audio-gate-reveal {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }

  .audio-gate-button {
    position: relative;
    z-index: 2;
    display: grid;
    width: var(--gate-size);
    aspect-ratio: 1;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: var(--color-text-inverse);
    background: transparent;
    cursor: url('/cursors/retrogusto-cursor-light.svg') 2 2, pointer;
    outline: 2px solid var(--color-text-inverse);
    outline-offset: -2px;
    box-shadow: none;
    transform:
      translateZ(var(--gate-hover-z, 0px))
      rotateX(var(--gate-tilt-x, 0deg))
      rotateY(var(--gate-tilt-y, 0deg))
      scale(var(--gate-scale, 1));
    transition:
      color 160ms ease,
      opacity 160ms ease,
      transform 180ms ease-out,
      box-shadow 180ms ease;
    will-change: transform, opacity;
  }

  .audio-gate-button :global(.volume-icon) {
    width: 28px;
    height: 28px;
    stroke-width: 1.8;
  }

  .audio-gate-button:hover,
  .audio-gate-button:focus-visible {
    --gate-hover-z: 24px;
    --gate-scale: 1.07;
    color: var(--color-text-primary);
    box-shadow: 0 20px 46px rgb(var(--shadow-dark-rgb) / 0.24);
  }

  .audio-gate-button:focus-visible {
    outline-color: var(--color-text-inverse);
    box-shadow:
      0 0 0 var(--unit-4) rgb(248 243 233 / 0.24),
      0 20px 46px rgb(var(--shadow-dark-rgb) / 0.24);
  }

  .audio-gate.is-opening .audio-gate-button {
    opacity: 0;
    color: transparent;
    transform: scale(1);
    box-shadow: none;
  }

  .audio-gate.is-opening .audio-gate-button-wrap.is-active .audio-gate-reveal {
    opacity: 1;
    transition:
      opacity 120ms ease,
      transform 1200ms cubic-bezier(0.84, 0, 0.16, 1);
    transform: translate3d(0, 0, 0) scale(48);
  }

  .audio-gate-content p {
    position: relative;
    z-index: 2;
    margin: var(--spacing-6) 0 0;
    color: var(--color-text-inverse);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: 1.4;
    text-align: center;
    transition: opacity 180ms ease, transform 180ms ease;
  }

  .audio-gate.is-opening .audio-gate-content p {
    opacity: 0;
    transform: translateY(8px);
  }

  .audio-gate-content p span {
    display: inline-block;
    opacity: 0;
    transform: translateY(12px);
    animation: gateLetterIn 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(180ms + var(--gate-letter-index, 0) * 24ms);
    will-change: opacity, transform;
  }

  .audio-gate-content p .space {
    width: 0.58em;
    opacity: 1;
    transform: none;
    animation: none;
  }

  @keyframes gateLetterIn {
    to {
      opacity: 1;
      transform: translateY(0);
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
    width: 51px; color: var(--color-content-primary);
    font-family: var(--font-display);
    font-size: var(--unit-40); line-height: 1; text-decoration: none;
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
    transform: translateX(-50%);
  }

  .roles-top-bar a {
    color: var(--color-interactive-primary);
    font-family: var(--font-display);
    font-weight: 400; text-decoration: none;
  }

  .icon-button {
    display: grid; width: var(--button-icon-size); height: var(--button-icon-size); place-items: center;
    padding: 0; color: var(--color-interactive-primary);
    background: transparent; border: 0; cursor: url('/cursors/retrogusto-cursor.svg') 2 2, pointer;
    transition: color 160ms ease, opacity 0.2s ease;
  }
  .logo:hover,
  .logo:focus-visible,
  .icon-button:hover,
  .icon-button:focus-visible { color: var(--color-interactive-hover); }
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
    color: var(--color-text-inverse);
  }

  .about-logo:hover,
  .about-logo:focus-visible,
  .about-audio:hover,
  .about-audio:focus-visible,
  .about-close:hover,
  .about-close:focus-visible {
    color: var(--color-interactive-hover);
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
    cursor: url('/cursors/retrogusto-cursor.svg') 2 2, grab;
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
    cursor: url('/cursors/retrogusto-cursor.svg') 2 2, grabbing;
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
    gap: 4px;
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
    padding: 0.12em 0.1em 0.16em;
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
    font-weight: 400;
    line-height: 1.2;
    text-align: center;
    opacity: var(--brand-subtitle-opacity, 0);
    transform: translateY(var(--brand-subtitle-y, 14px));
    transition: opacity 120ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }

  .roles-screen {
    position: fixed; z-index: 35; inset: 0;
    overflow: hidden;
    background: var(--color-surface-page);
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .roles-top-bar {
    position: absolute; z-index: 5; top: 0; left: 0;
    box-sizing: border-box;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    width: 100%; height: var(--layout-topbar-height);
    padding: var(--layout-topbar-padding);
    color: var(--color-text-primary);
  }

  .role-grid {
    position: absolute; z-index: 2;
    top: 130px; left: var(--layout-page-gutter); right: var(--layout-page-gutter);
    height: min(620px, calc(100svh - 190px));
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 420px));
    justify-content: space-between;
    align-items: stretch;
    column-gap: var(--spacing-5);
    perspective: none;
    transform-style: flat;
  }

  .role-card {
    --role-card-radius: clamp(42px, 4.55vw, 65px);
    --role-inner-border-inset: 10px;
    --role-inner-border-width: 2px;
    --role-reveal-duration: 300ms;
    --role-reveal-ease: cubic-bezier(0.22, 1, 0.36, 1);

    position: relative;
    overflow: hidden;
    isolation: isolate;
    min-height: 0;
    border: var(--card-border-width) solid var(--color-border-primary);
    border-radius: var(--role-card-radius);
    background: var(--color-surface-page);
    cursor: url('/cursors/retrogusto-cursor.svg') 2 2, pointer;
    opacity: var(--role-card-opacity, 0);
    transform:
      translateY(var(--role-card-y, 38vh))
      rotateX(var(--role-tilt-x, 0deg))
      rotateY(var(--role-tilt-y, 0deg))
      scale(var(--role-hover-scale, 1));
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
    z-index: 12;
    inset: var(--role-inner-border-inset);
    border: var(--card-border-width) solid var(--color-border-primary);
    border-radius: calc(var(--role-card-radius) - var(--role-inner-border-inset));
    content: '';
    pointer-events: none;
  }

  .role-card::after {
    position: absolute;
    z-index: 11;
    inset: 0;
    border: var(--role-inner-border-inset) solid var(--color-surface-page);
    border-radius: var(--role-card-radius);
    content: '';
    pointer-events: none;
  }

  .role-card:hover,
  .role-card:focus-visible {
    --role-hover-z: 24px;
    --role-hover-scale: 1.018;
    --role-shadow-alpha: 0.24;
  }

  .role-card-bg {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0.4;
    filter: grayscale(1) opacity(0.38);
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(var(--role-bg-y, 0px))
      scale(1.04);
    transition: opacity 220ms ease, filter 260ms ease, transform 260ms ease;
    user-select: none;
    pointer-events: none;
  }

  .role-hover-panel {
    position: absolute; z-index: 8;
    top: 0;
    left: 0;
    right: 0;
    width: auto;
    height: auto;
    min-height: 128px;
    display: grid;
    place-items: center;
    padding: var(--spacing-5) var(--spacing-6);
    border-radius: var(--role-card-radius) var(--role-card-radius) 0 0;
    background: var(--color-text-primary);
    color: var(--color-text-inverse);
    opacity: 1;
    transform:
      translateY(calc(-100% - 36px));
    transition: transform var(--role-reveal-duration) var(--role-reveal-ease);
    pointer-events: none;
  }

  .role-hover-panel::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: calc(clamp(46px, 4.5vw, 64px) / -2);
    width: clamp(46px, 4.5vw, 64px);
    aspect-ratio: 1;
    background: var(--color-text-primary);
    transform: translateX(-50%) rotate(45deg);
  }

  .role-hover-panel p {
    width: min(100%, 390px);
    margin: 0;
    font-family: var(--font-text);
    font-size: 24px;
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0;
    text-align: center;
  }

  .role-card-copy {
    position: absolute;
    top: 50%; left: var(--spacing-5); right: var(--spacing-5);
    display: grid; justify-items: center;
    color: var(--color-text-primary);
    text-align: center;
    transform: translateY(-50%);
    transition: transform 260ms ease;
  }

  .role-card-copy h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(42px, 4.1vw, 60px);
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0;
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
    position: absolute; z-index: 4;
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

  .role-card.is-servizio {
    --role-person-base-x: 0px;
    --role-person-base-y: 295px;
    --role-person-height: min(120%, 1220px);
  }

  .role-card.is-cucina {
    --role-person-base-x: 0px;
    --role-person-base-y: 0px;
    --role-person-height: min(60%, 720px);
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
    opacity: 1;
    filter: grayscale(1) opacity(0.42);
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(var(--role-bg-y, 0px))
      scale(1.08);
  }

  .role-card.has-dialogue:hover .role-card-copy,
  .role-card.has-dialogue:focus-visible .role-card-copy {
    opacity: 0;
    transform:
      translateY(calc(-50% - 14px))
      translateX(var(--role-copy-x, 0px));
  }

  .role-card.has-dialogue:hover .role-hover-panel,
  .role-card.has-dialogue:focus-visible .role-hover-panel {
    opacity: 1;
    transform: translateY(0);
  }

  .role-card.has-dialogue:hover .role-person,
  .role-card.has-dialogue:focus-visible .role-person {
    opacity: 1;
    transform:
      translateX(calc(-50% + var(--role-person-base-x, 0px) + var(--role-person-x, 0px)))
      translateY(calc(var(--role-person-base-y, 0px) + var(--role-person-y, 0px)));
  }

  @media (max-width: 700px) {
    .audio-gate-content {
      --gate-size: 72px;

      width: calc(100% - var(--spacing-8));
    }
    .audio-gate-content p {
      max-width: 280px;
      margin-top: var(--spacing-4);
      white-space: normal;
      font-size: 16px;
    }
    .audio-gate-controls { gap: var(--spacing-5); }
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
    .brand-lockup { gap: 8px; }
    .brand-subtitle { font-size: 24px; }
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
      transform: none;
    }
    .role-card {
      --role-card-radius: clamp(34px, 12vw, 54px);
      --role-inner-border-inset: 8px;

      min-height: 0;
      border-radius: var(--role-card-radius);
    }
    .role-card-copy { left: var(--spacing-4); right: var(--spacing-4); }
    .role-card-copy h2 { font-size: clamp(28px, 10vw, 44px); line-height: 1.08; }
    .role-card-copy p { margin-top: 2px; font-size: 11px; line-height: 1.25; }
    .role-card-bg {
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .role-hover-panel {
      top: 0;
      left: 0;
      right: 0;
      width: auto;
      height: auto;
      min-height: 64px;
      padding: var(--spacing-3) var(--spacing-4);
      border-radius: var(--role-card-radius) var(--role-card-radius) 0 0;
    }
    .role-hover-panel p { font-size: clamp(16px, 5.2vw, 20px); }
    .role-hover-panel::after {
      bottom: -16px;
      width: 32px;
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
