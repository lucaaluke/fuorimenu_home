<script lang="ts">
  import { onMount } from 'svelte';

  let reelProgress = 0;
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
  let introAudioEl: HTMLElement;
  let isAudioMuted = $state(false);
  let isBrandWordSharp = $state(false);
  let isAboutOpen = $state(false);
  let isAboutClosing = $state(false);
  let aboutCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let mountFadeTimer: ReturnType<typeof setTimeout> | undefined;
  let mountFadeFrame = 0;
  let audioFadeFrames: Partial<Record<AudioRole, number>> = {};
  let audioLoopFrames: Partial<Record<AudioRole, number>> = {};
  let audioUnlocked = false;

  type AudioRole = 'ufficio' | 'cucina' | 'servizio';
  type RoleItem = {
    title: AudioRole;
    description: string;
    speaker: string;
    dialogue: string;
    personSrc: string;
  };

  const roleAudio: Record<
    AudioRole,
    { src: string; startTime: number; maxTime: number; targetVolume: number; el?: HTMLAudioElement }
  > = {
    ufficio: {
      src: '/sound/office.mp3',
      startTime: 10,
      maxTime: 20,
      targetVolume: 0.95
    },
    cucina: {
      src: '/sound/kitchen.mp3',
      startTime: 0,
      maxTime: 10,
      targetVolume: 0.42
    },
    servizio: {
      src: '/sound/restaurant.mp3',
      startTime: 0,
      maxTime: 9.7,
      targetVolume: 0.5
    }
  };

  const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);
  const ease  = (v: number) => v * v * (3 - 2 * v);

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
  const brandWord       = 'FuoriMenù';
  const brandSubtitle   = 'Dentro le cucine di Milano Cortina 2026';
  const introCharacters = parseMessage(introMessage, 'cucina');
  const nextCharacters  = parseMessage(nextMessage,  'persone');
  const introWords      = groupWords(introCharacters);

  const brandLetters = brandWord.split('').map((letter, i) => ({ letter, i }));
  const brandOrder   = [...brandLetters.map((_, i) => i)].sort(() => Math.random() - 0.5);
  const brandArrivalRank: number[] = new Array(brandLetters.length);
  brandOrder.forEach((letterIndex, rank) => { brandArrivalRank[letterIndex] = rank; });
  const brandBurstOrder = [...brandLetters.map((_, i) => i)].sort(() => Math.random() - 0.5);
  const brandBurstRank: number[] = new Array(brandLetters.length);
  const brandBurstMotion = brandLetters.map(() => ({
    x: (Math.random() - 0.5) * 36,
    y: -22 - Math.random() * 28,
    rotate: (Math.random() - 0.5) * 34
  }));
  brandBurstOrder.forEach((letterIndex, rank) => { brandBurstRank[letterIndex] = rank; });
  let brandLetterEls: HTMLElement[] = [];
  let floatingFrame = 0;
  let floatingLast = 0;
  let floatingEls: HTMLElement[] = [];
  const brandScrollMax = 3.42;

  const roleItems: RoleItem[] = [
    {
      title: 'ufficio',
      description: 'descrizione testo',
      speaker: 'Carlo Zarri',
      dialogue: "il mio ruolo ... seguimi nell'ufficio per saperne di più",
      personSrc: '/images/carlo-zarri.png'
    },
    {
      title: 'cucina',
      description: 'descrizione testo',
      speaker: 'Stefano Paganini',
      dialogue: 'il mio ruolo ... seguimi nella cucina per saperne di più',
      personSrc: '/images/stefano-paganini-new.png'
    },
    {
      title: 'servizio',
      description: 'descrizione testo',
      speaker: 'Ken Frank',
      dialogue: 'il mio ruolo ... seguimi nella mensa per saperne di più',
      personSrc: '/images/ken-frank.png'
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

  const reels = [
    { src: '/videos/tiramisu.mp4', bg: 'var(--reel-placeholder-neutral)', fromX: -8,  fromY:  4, toX: -34, toY: -18, rotate: -8  },
    { src: '/videos/1.mp4',        bg: 'var(--color-text-primary)', fromX:  7,  fromY: -3, toX:  30, toY:  16, rotate:  7  },
    { src: '/videos/2.mp4',        bg: 'var(--reel-placeholder-gold)', fromX: -4,  fromY: -8, toX: -18, toY:  28, rotate:  10 },
    { src: '/videos/3.mp4',        bg: 'var(--color-surface-dark)', fromX:  9,  fromY:  8, toX:  36, toY: -24, rotate: -11 },
    { src: '/videos/4.mp4',        bg: 'var(--reel-placeholder-lavender)', fromX: -10, fromY: -2, toX: -40, toY:   6, rotate:  -5 }
  ];

  function applyLetterStyles(
    letters: HTMLElement[],
    progress: number,
    opts: { start: number; end: number; windowSize: number; invert: boolean; dy: number }
  ) {
    const { start, end, windowSize, invert, dy } = opts;
    const stagger = (end - start) / Math.max(letters.length - 1, 1);
    letters.forEach((el, i) => {
      if (!el) return;
      const local   = clamp((progress - start - i * stagger) / windowSize);
      const e       = ease(local);
      const opacity = invert ? 1 - e : e;
      const ty      = invert ? e * -dy : (1 - e) * dy;
      el.style.setProperty('--letter-opacity', opacity.toFixed(3));
      el.style.setProperty('--letter-y',       `${ty.toFixed(1)}px`);
    });
  }

  function applyBrandLetters() {
    isBrandWordSharp = brandProgress > 0.96 && brandProgress < 1.86;

    const n = brandLetterEls.length;
    brandLetterEls.forEach((el, i) => {
      if (!el) return;
      const rank    = brandArrivalRank[i];
      const stagger = 0.6 / Math.max(n - 1, 1);
      const local   = clamp((clamp(brandProgress) - rank * stagger) / 0.18);
      const e       = ease(local);
      const burstRank = brandBurstRank[i];
      const burstStagger = 0.5 / Math.max(n - 1, 1);
      const burstProgress = clamp((brandProgress - 1.9) / 0.66);
      const burstLocal = clamp((burstProgress - burstRank * burstStagger) / 0.14);
      const burst = ease(burstLocal);
      const burstMotion = brandBurstMotion[i];
      el.style.setProperty('--bl-z',       `${((1 - e) * 600).toFixed(1)}px`);
      el.style.setProperty('--bl-scale',   (1 + (1 - e) * 3.5 + burst * 1.35).toFixed(3));
      el.style.setProperty('--bl-opacity', (clamp(local / 0.25) * (1 - burst)).toFixed(3));
      el.style.setProperty('--bl-x',       `${(burstMotion.x * burst).toFixed(1)}px`);
      el.style.setProperty('--bl-y',       `${(burstMotion.y * burst).toFixed(1)}px`);
      el.style.setProperty('--bl-rotate',  `${(burstMotion.rotate * burst).toFixed(1)}deg`);
    });
  }

  function getReelPresentation(index: number) {
    const reel  = reels[index];
    const local = clamp((reelProgress - index * 0.105 - 0.04) / 0.48);
    const e     = ease(local);
    return {
      z:       -980 + e * 1850,
      scale:   0.28 + e * 4.2,
      opacity: clamp(local / 0.18) * (1 - clamp((local - 0.76) / 0.24)),
      x:       reel.fromX + (reel.toX - reel.fromX) * e,
      y:       reel.fromY + (reel.toY - reel.fromY) * e,
      rotate:  reel.rotate * (0.35 + e * 0.65)
    };
  }

  function applyReelStyles() {
    reelCards.forEach((card, i) => {
      if (!card) return;
      const { z, scale, opacity, x, y, rotate } = getReelPresentation(i);
      card.style.setProperty('--x',       `${x.toFixed(2)}vw`);
      card.style.setProperty('--y',       `${y.toFixed(2)}vh`);
      card.style.setProperty('--z',       `${z.toFixed(1)}px`);
      card.style.setProperty('--scale',   scale.toFixed(3));
      card.style.setProperty('--rotate',  `${rotate.toFixed(2)}deg`);
      card.style.setProperty('--opacity', opacity.toFixed(3));
    });
  }

  function moveFloatingAssets(time: number) {
    if (!brandScreen) {
      floatingFrame = requestAnimationFrame(moveFloatingAssets);
      return;
    }

    const dt = Math.min((time - (floatingLast || time)) / 1000, 0.032);
    floatingLast = time;

    const bounds = brandScreen.getBoundingClientRect();
    const pad    = Math.max(16, Math.min(bounds.width, bounds.height) * 0.035);

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
      const driftTime = time / 1000 * wobble.speed + wobble.phase;
      const hoverTarget = motion.hover ? 1 : 0;
      const hoverStep = dt / (motion.hover ? 0.2 : 0.28);
      motion.hoverProgress = clamp(
        motion.hoverProgress + (hoverTarget - motion.hoverProgress) * hoverStep * 4
      );
      const hoverEase = ease(motion.hoverProgress);
      const hoverBoost = 1 + hoverEase * 0.75;

      motion.x += motion.vx * dt * hoverBoost;
      motion.y += motion.vy * dt * hoverBoost;
      motion.spinAngle = (motion.spinAngle + spin.speed * dt * (1 + hoverEase * 0.7)) % 360;

      if (motion.x <= pad || motion.x >= maxX) {
        motion.x  = clamp(motion.x, pad, maxX);
        motion.vx = -motion.vx;
      }

      if (motion.y <= pad || motion.y >= maxY) {
        motion.y  = clamp(motion.y, pad, maxY);
        motion.vy = -motion.vy;
      }

      if (!motion.hover) {
        motion.tiltX *= 0.88;
        motion.tiltY *= 0.88;
      }

      el.style.setProperty('--float-x', `${(motion.x + Math.sin(driftTime) * wobble.x).toFixed(1)}px`);
      el.style.setProperty('--float-y', `${(motion.y + Math.cos(driftTime * 0.82) * wobble.y).toFixed(1)}px`);
      el.style.setProperty('--float-tilt-x', `${motion.tiltX.toFixed(2)}deg`);
      el.style.setProperty('--float-tilt-y', `${motion.tiltY.toFixed(2)}deg`);
      el.style.setProperty(
        '--float-rotate',
        `${(spin.phase + motion.spinAngle + Math.sin(driftTime * 0.7) * 5).toFixed(2)}deg`
      );
      el.style.setProperty('--float-hover-z', `${(hoverEase * 28).toFixed(1)}px`);
      el.style.setProperty('--float-hover-scale', (1 + hoverEase * 0.035).toFixed(3));
      el.style.setProperty('--float-shadow-alpha', (hoverEase * 0.28).toFixed(3));
    });

    floatingFrame = requestAnimationFrame(moveFloatingAssets);
  }

  function tiltFloatingAsset(e: PointerEvent, index: number) {
    const el = floatingEls[index];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx   = (e.clientX - rect.left) / rect.width - 0.5;
    const ny   = (e.clientY - rect.top) / rect.height - 0.5;
    floatingAssets[index].motion.tiltX = clamp(-ny * 22, -14, 14);
    floatingAssets[index].motion.tiltY = clamp(nx * 22, -14, 14);
  }

  function tiltRoleCard(e: PointerEvent, index: number) {
    const card = roleCards[index];
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty('--role-tilt-x', `${clamp(-ny * 11, -7, 7).toFixed(2)}deg`);
    card.style.setProperty('--role-tilt-y', `${clamp(nx * 13, -8, 8).toFixed(2)}deg`);
    card.style.setProperty('--role-bg-x', `${(nx * -8.1).toFixed(1)}px`);
    card.style.setProperty('--role-bg-y', `${(ny * -4.9).toFixed(1)}px`);
    card.style.setProperty('--role-copy-x', `${(nx * 2.7).toFixed(1)}px`);
    card.style.setProperty('--role-dialogue-x', `${(nx * 3.2).toFixed(1)}px`);
    card.style.setProperty('--role-dialogue-y', `${(ny * 1.7).toFixed(1)}px`);
    card.style.setProperty('--role-person-x', `${(nx * 6.3).toFixed(1)}px`);
    card.style.setProperty('--role-person-y', `${(ny * 2.8).toFixed(1)}px`);
  }

  function resetRoleCard(index: number) {
    const card = roleCards[index];
    if (!card) return;
    card.style.setProperty('--role-tilt-x', '0deg');
    card.style.setProperty('--role-tilt-y', '0deg');
    card.style.setProperty('--role-bg-x', '0px');
    card.style.setProperty('--role-bg-y', '0px');
    card.style.setProperty('--role-copy-x', '0px');
    card.style.setProperty('--role-dialogue-x', '0px');
    card.style.setProperty('--role-dialogue-y', '0px');
    card.style.setProperty('--role-person-x', '0px');
    card.style.setProperty('--role-person-y', '0px');
  }

  function reloadHome(event: MouseEvent) {
    event.preventDefault();
    if (window.location.pathname === '/') {
      window.location.reload();
    } else {
      window.location.assign('/');
    }
  }

  function openAbout() {
    if (aboutCloseTimer) clearTimeout(aboutCloseTimer);
    isAboutClosing = false;
    isAboutOpen = true;
  }

  function closeAbout() {
    isAboutClosing = true;
    if (aboutCloseTimer) clearTimeout(aboutCloseTimer);
    aboutCloseTimer = setTimeout(() => {
      isAboutOpen = false;
      isAboutClosing = false;
    }, 420);
  }

  function cancelAudioFrame(store: Partial<Record<AudioRole, number>>, role: AudioRole) {
    const frame = store[role];
    if (frame) cancelAnimationFrame(frame);
    store[role] = 0;
  }

  function fadeAudio(role: AudioRole, targetVolume: number, afterFade?: () => void) {
    const config = roleAudio[role];
    const audio = config.el;
    if (!audio) return;
    cancelAudioFrame(audioFadeFrames, role);

    const startVolume = audio.volume;
    const startTime = performance.now();
    const duration = 520;

    const tick = (now: number) => {
      const progress = clamp((now - startTime) / duration);
      const eased = ease(progress);
      audio.volume = startVolume + (targetVolume - startVolume) * eased;

      if (progress < 1) {
        audioFadeFrames[role] = requestAnimationFrame(tick);
      } else {
        audio.volume = targetVolume;
        audioFadeFrames[role] = 0;
        afterFade?.();
      }
    };

    audioFadeFrames[role] = requestAnimationFrame(tick);
  }

  function keepAudioLooping(role: AudioRole) {
    const config = roleAudio[role];
    const audio = config.el;
    if (!audio) return;
    if (audio.currentTime >= config.maxTime) {
      audio.currentTime = config.startTime;
    }
    audioLoopFrames[role] = requestAnimationFrame(() => keepAudioLooping(role));
  }

  async function startRoleAudio(role: AudioRole) {
    const config = roleAudio[role];
    const audio = config.el;
    if (!audio || isAudioMuted) return;

    cancelAudioFrame(audioFadeFrames, role);
    cancelAudioFrame(audioLoopFrames, role);
    audio.loop = false;
    if (audio.volume === 0 || audio.paused) audio.volume = 0;
    if (audio.paused) {
      audio.currentTime = config.startTime;
    }

    try {
      await audio.play();
      audioLoopFrames[role] = requestAnimationFrame(() => keepAudioLooping(role));
      fadeAudio(role, config.targetVolume);
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

  async function unlockAmbientAudio() {
    if (audioUnlocked) return;
    const audios = Object.values(roleAudio).map((config) => config.el).filter(Boolean) as HTMLAudioElement[];
    if (!audios.length) return;

    try {
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
    (Object.keys(roleAudio) as AudioRole[]).forEach(stopRoleAudio);
  }

  function cancelAllAudioFrames() {
    (Object.keys(roleAudio) as AudioRole[]).forEach((role) => {
      cancelAudioFrame(audioFadeFrames, role);
      cancelAudioFrame(audioLoopFrames, role);
    });
  }

  // ── Unica funzione che gestisce tutto — nessun conflitto ──
  function applyAllStyles() {
    // 1. Home scorre via
    const epPage        = ease(pageProgress);
    const brandReveal   = clamp(brandProgress);
    const epBrand       = ease(brandReveal);
    homeScreen?.style.setProperty('--page-y', `${(-100 * epPage).toFixed(2)}svh`);

    // 2. next-screen: appare con pageProgress, sparisce con brandProgress
    //    opacity finale = pageProgress-driven * (1 - brandProgress-driven)
    if (nextScreen) {
      const showNext = epPage;                      // 0→1 mentre scrolla verso next
      const hideNext = epBrand;                     // 0→1 mentre scrolla verso brand
      nextScreen.style.opacity = (showNext * (1 - hideNext)).toFixed(3);
      // pointer-events solo quando visibile
      nextScreen.style.pointerEvents = showNext > 0.05 && hideNext < 0.95 ? 'auto' : 'none';
    }

    // 3. brand-screen: appare con brandProgress
    if (brandScreen) {
      brandScreen.style.opacity = epBrand.toFixed(3);
      brandScreen.style.pointerEvents = epBrand > 0.05 ? 'auto' : 'none';
    }

    const floatingExit = ease(clamp((brandProgress - 1.08) / 0.64));
    floatingEls.forEach((el, index) => {
      if (!el) return;
      const asset = floatingAssets[index];
      const fadeOut = ease(clamp((floatingExit - 0.72) / 0.28));
      const scrollX = asset.exitX * floatingExit;
      const scrollY = asset.exitY * floatingExit;
      el.style.setProperty('--float-scroll-x', `${scrollX.toFixed(2)}vw`);
      el.style.setProperty('--float-scroll-y', `${scrollY.toFixed(2)}vh`);
      el.style.setProperty('--float-scale', (1 - floatingExit * 0.08).toFixed(3));
      el.style.setProperty('--float-opacity', (1 - fadeOut).toFixed(3));
      el.style.pointerEvents = fadeOut > 0.82 ? 'none' : 'auto';
    });

    const rolesProgress = clamp((brandProgress - 2.48) / 0.94);
    const rolesEase = ease(rolesProgress);
    if (rolesScreen) {
      rolesScreen.style.opacity = rolesEase.toFixed(3);
      rolesScreen.style.pointerEvents = rolesProgress > 0.08 ? 'auto' : 'none';
    }
    roleCards.forEach((card, index) => {
      if (!card) return;
      const cardProgress = clamp((rolesProgress - index * 0.13) / 0.44);
      const cardEase = ease(cardProgress);
      card.style.setProperty('--role-card-y', `${((1 - cardEase) * 38).toFixed(1)}vh`);
      card.style.setProperty('--role-card-opacity', cardEase.toFixed(3));
    });

    // 4. Lettere intro: dissolvono con pageProgress
    applyLetterStyles(introLetters, pageProgress, {
      start: 0.2, end: 0.5, windowSize: 0.08, invert: true, dy: 12
    });
    const introAudioOut = ease(clamp((pageProgress - 0.2) / 0.24));
    introAudioEl?.style.setProperty('--intro-audio-opacity', (1 - introAudioOut).toFixed(3));
    introAudioEl?.style.setProperty('--intro-audio-y', `${(-introAudioOut * 12).toFixed(1)}px`);
    if (introAudioEl) {
      introAudioEl.style.pointerEvents = introAudioOut > 0.9 ? 'none' : 'auto';
    }

    // 5. Lettere next: si rivelano con pageProgress
    applyLetterStyles(nextLetters, pageProgress, {
      start: 0.45, end: 0.92, windowSize: 0.07, invert: false, dy: 12
    });

    // 6. Lettere brand
    applyBrandLetters();

    const subtitleIn = ease(clamp((brandProgress - 0.7) / 0.22));
    const subtitleOut = ease(clamp((brandProgress - 2.04) / 0.18));
    const subtitleOpacity = subtitleIn * (1 - subtitleOut);
    const subtitleY = (1 - subtitleIn) * 14 - subtitleOut * 16;
    brandSubtitleEl?.style.setProperty('--brand-subtitle-opacity', subtitleOpacity.toFixed(3));
    brandSubtitleEl?.style.setProperty('--brand-subtitle-y', `${subtitleY.toFixed(1)}px`);
  }

  onMount(() => {
    mountFadeTimer = setTimeout(() => {
      const mountStart    = performance.now();
      const mountDuration = 2000;
      const tickMount = (now: number) => {
        const o = ease(Math.min((now - mountStart) / mountDuration, 1));
        introEl?.style.setProperty('--mount-opacity', o.toFixed(3));
        if (o < 1) {
          mountFadeFrame = requestAnimationFrame(tickMount);
        } else {
          mountFadeFrame = 0;
        }
      };
      mountFadeFrame = requestAnimationFrame(tickMount);
    }, 400);

    const updateFlow = (delta: number) => {
      if (delta > 0) {
        const reelStep = Math.min(delta, 1 - reelProgress);
        reelProgress  += reelStep;
        const rem1     = delta - reelStep;
        const pageStep = Math.min(rem1, 1 - pageProgress);
        pageProgress  += pageStep;
        brandProgress  = clamp(brandProgress + rem1 - pageStep, 0, brandScrollMax);
      } else {
        const abs       = Math.abs(delta);
        const brandStep = Math.min(abs, brandProgress);
        brandProgress  -= brandStep;
        const rem1      = abs - brandStep;
        const pageStep  = Math.min(rem1, pageProgress);
        pageProgress   -= pageStep;
        reelProgress    = clamp(reelProgress - (rem1 - pageStep));
      }
      applyReelStyles();
      applyAllStyles();
    };

    const onWheel   = (e: WheelEvent)    => { e.preventDefault(); updateFlow(e.deltaY / 1500); };
    const onKeydown = (e: KeyboardEvent) => {
      unlockAmbientAudio();
      const map: Record<string, number> = {
        ArrowDown: 0.08, PageDown: 0.08, ' ': 0.08,
        ArrowUp: -0.08,  PageUp:  -0.08
      };
      if (e.key in map) { e.preventDefault(); updateFlow(map[e.key]); }
    };

    applyReelStyles();
    applyAllStyles();
    floatingFrame = requestAnimationFrame(moveFloatingAssets);
    window.addEventListener('wheel',   onWheel,   { passive: false });
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('pointerdown', unlockAmbientAudio, { passive: true });
    return () => {
      cancelAnimationFrame(floatingFrame);
      if (mountFadeTimer) clearTimeout(mountFadeTimer);
      if (aboutCloseTimer) clearTimeout(aboutCloseTimer);
      cancelAnimationFrame(mountFadeFrame);
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


<main bind:this={homeScreen} class="home">
  <section class="intro" aria-labelledby="intro-title" bind:this={introEl}>
    <div class="intro-copy">
      <h1 id="intro-title" aria-label={introMessage}>
        {#each introWords as group (group.index)}
          {#if group.type === 'space'}
            <span class="space" aria-hidden="true">&nbsp;</span>
          {:else}
            <span class="word" aria-hidden="true">
              {#each group.characters as { letter, isAccent, index } (index)}
                <span bind:this={introLetters[index]} class:accent-letter={isAccent}
                  >{letter}</span>
              {/each}
            </span>
          {/if}
        {/each}
      </h1>
      <button
        bind:this={introAudioEl}
        class="icon-button intro-audio"
        type="button"
        aria-label={isAudioMuted ? 'Audio disattivato' : 'Audio attivo'}
        aria-pressed={isAudioMuted}
        onclick={toggleAudioMuted}
      >
        <svg class="volume-icon" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M4 11.5h5l6-5v15l-6-5H4z" />
          <path d="M18.5 10a6 6 0 0 1 0 8" />
          <path d="M21 7.5a9.5 9.5 0 0 1 0 13" />
          {#if isAudioMuted}
            <path class="volume-slash" d="M5.5 4.5 23.5 23.5" />
          {/if}
        </svg>
      </button>
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
      {#if isSpace}
        <span class="space" aria-hidden="true">&nbsp;</span>
      {:else}
        <span bind:this={nextLetters[index]} class:accent-letter={isAccent} aria-hidden="true"
          >{letter}</span>
      {/if}
    {/each}
  </p>
</section>


<section bind:this={brandScreen} class="brand-screen" aria-label="Fuorimenu">
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

<section bind:this={rolesScreen} class="roles-screen" aria-label="Aree Fuorimenu">
  <header class="roles-top-bar" aria-label="Navigazione principale">
    <a class="logo" href="/" aria-label="Fuorimenu home" onclick={reloadHome}>FM</a>
    <button
      class="icon-button top-bar-audio"
      type="button"
      aria-label={isAudioMuted ? 'Audio disattivato' : 'Audio attivo'}
      aria-pressed={isAudioMuted}
      onclick={toggleAudioMuted}
    >
      <svg class="volume-icon" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M4 11.5h5l6-5v15l-6-5H4z" />
        <path d="M18.5 10a6 6 0 0 1 0 8" />
        <path d="M21 7.5a9.5 9.5 0 0 1 0 13" />
        {#if isAudioMuted}
          <path class="volume-slash" d="M5.5 4.5 23.5 23.5" />
        {/if}
      </svg>
    </button>
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
        <div class="role-card-overlay"></div>
        <div class="role-card-copy">
          <h2>{item.title}</h2>
          <p>{item.description}</p>
        </div>
        {#if item.dialogue}
          <div class="role-dialogue">
            <p>
              Sono <strong>{item.speaker}</strong> {item.dialogue}
            </p>
          </div>
          {#if item.personSrc}
            <img class="role-person" src={item.personSrc} alt={item.speaker} draggable="false" />
          {/if}
        {/if}
        <button class="role-action" type="button" aria-label={`Vai alla storia di ${item.speaker}`}>
          <span class="role-action-icon" aria-hidden="true">→</span>
        </button>
      </article>
    {/each}
  </div>
</section>

{#each Object.entries(roleAudio) as [role, config] (role)}
  <audio
    bind:this={config.el}
    src={config.src}
    preload="none"
    aria-hidden="true"
  ></audio>
{/each}

{#if isAboutOpen}
  <section
    class="about-screen"
    class:is-closing={isAboutClosing}
    aria-labelledby="about-title"
    data-node-id="256:1827"
  >
    <header class="about-top-bar" aria-label="Navigazione about">
      <a class="logo about-logo" href="/" aria-label="Fuorimenu home" onclick={reloadHome}>FM</a>
      <button
        class="icon-button top-bar-audio about-audio"
        type="button"
        aria-label={isAudioMuted ? 'Audio disattivato' : 'Audio attivo'}
        aria-pressed={isAudioMuted}
        onclick={toggleAudioMuted}
      >
        <svg class="volume-icon" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M4 11.5h5l6-5v15l-6-5H4z" />
          <path d="M18.5 10a6 6 0 0 1 0 8" />
          <path d="M21 7.5a9.5 9.5 0 0 1 0 13" />
          {#if isAudioMuted}
            <path class="volume-slash" d="M5.5 4.5 23.5 23.5" />
          {/if}
        </svg>
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
      <h2 id="about-title" class="visually-hidden">About Fuorimenu</h2>
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
    overscroll-behavior: none;
  }
  :global(button), :global(a) { font: inherit; }

  .home {
    position: fixed; inset: 0;
    width: 100%; height: 100svh; overflow: hidden;
    background: var(--color-surface-page); color: var(--color-text-primary);
    transform: translateY(var(--page-y, 0));
    transition: transform 160ms ease-out;
    will-change: transform;
  }

  .logo {
    width: 51px; color: var(--color-interactive-primary);
    font-family: var(--font-display);
    font-size: var(--unit-40); line-height: 1; text-decoration: none;
    transition: color 160ms ease;
  }

  .top-bar-audio { justify-self: center; }
  .top-bar-menu { justify-self: end; }

  .roles-top-bar a {
    color: var(--color-interactive-primary);
    font-family: var(--font-display);
    font-weight: 400; text-decoration: none;
  }

  .icon-button {
    display: grid; width: var(--button-icon-size); height: var(--button-icon-size); place-items: center;
    padding: 0; color: var(--color-interactive-primary);
    background: transparent; border: 0; cursor: pointer;
    transition: color 160ms ease, opacity 0.2s ease;
  }
  .logo:hover,
  .logo:focus-visible,
  .icon-button:hover,
  .icon-button:focus-visible { color: var(--color-interactive-hover); }
  .icon-button:hover         { opacity: 1; }
  .icon-button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: var(--unit-4); }

  .volume-icon {
    width: 28px; height: 28px; fill: none; stroke: currentColor;
    stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2;
  }

  .volume-slash {
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
    border-radius: var(--card-action-radius);
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
    color: var(--color-text-inverse);
    animation: about-curtain-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
    transform-origin: right center;
    will-change: clip-path, transform;
  }

  .about-screen.is-closing {
    animation: about-curtain-out 420ms cubic-bezier(0.64, 0, 0.78, 0) both;
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

  @keyframes about-curtain-in {
    from {
      clip-path: inset(0 0 0 100%);
      transform: translateX(6%);
    }
    to {
      clip-path: inset(0 0 0 0);
      transform: translateX(0);
    }
  }

  @keyframes about-curtain-out {
    from {
      clip-path: inset(0 0 0 0);
      transform: translateX(0);
    }
    to {
      clip-path: inset(0 0 0 100%);
      transform: translateX(6%);
    }
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

  .intro-audio {
    pointer-events: auto;
    opacity: var(--intro-audio-opacity, 1);
    transform: translateY(var(--intro-audio-y, 0px));
    transition: color 160ms ease, opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }

  h1, .next-message {
    width: min(434px, 100%); margin: 0; color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 32px; font-weight: 400; line-height: 1.5; text-align: center;
  }

  h1 span {
    display: inline-block;
    opacity: var(--letter-opacity, 1);
    transform: translateY(var(--letter-y, 0px));
    transition: opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
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
    width: clamp(112px, 13vw, 168px); aspect-ratio: 9 / 16;
    opacity: var(--opacity);
    transform: translate(-50%, -50%) translate3d(var(--x), var(--y), var(--z)) rotate(var(--rotate)) scale(var(--scale));
    transform-style: preserve-3d;
    transition: opacity 120ms linear, transform 120ms linear;
    will-change: transform, opacity;
  }

  .reel-frame {
    position: relative; width: 100%; height: 100%;
    overflow: hidden; border: var(--card-border-width) solid var(--color-border-dark); border-radius: var(--radius-m);
    box-shadow: 0 36px 80px rgb(var(--shadow-brand-rgb) / .22), 0 10px 26px rgb(var(--shadow-dark-rgb) / .28);
    box-sizing: border-box; background: var(--color-surface-dark);
  }

  .reel-video, .reel-placeholder {
    display: block; width: 100%; height: 100%; object-fit: cover;
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
    opacity: var(--letter-opacity, 0);
    transform: translateY(var(--letter-y, 12px));
    transition: opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }
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
    cursor: grab;
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
    cursor: grabbing;
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
    gap: 30px;
    transform-style: preserve-3d;
  }

  .brand-word {
    margin: 0;
    display: flex;
    align-items: baseline;
    font-family: var(--font-display);
    font-size: clamp(72px, 12vw, 160px);
    font-weight: 700;
    font-variation-settings: "wdth" 100;
    line-height: 1;
    color: var(--color-text-primary);
    transform-style: preserve-3d;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: geometricPrecision;
  }

  .brand-letter {
    display: inline-block;
    opacity: var(--bl-opacity, 0);
    transform:
      translate3d(var(--bl-x, 0px), var(--bl-y, 0px), var(--bl-z, 600px))
      rotate(var(--bl-rotate, 0deg))
      scale(var(--bl-scale, 4.5));
    transition: opacity 100ms linear, transform 100ms linear;
    will-change: opacity, transform;
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
    grid-template-columns: repeat(3, minmax(0, 384px));
    justify-content: space-between;
    column-gap: 42px;
    perspective: 1100px;
    perspective-origin: 50% 45%;
  }

  .role-card {
    position: relative;
    overflow: hidden;
    min-height: 0;
    border: var(--card-border-width) solid var(--color-border-primary);
    border-radius: var(--card-radius);
    background: var(--color-text-primary);
    opacity: var(--role-card-opacity, 0);
    transform:
      translateY(var(--role-card-y, 38vh))
      translateZ(var(--role-hover-z, 0px))
      rotateX(var(--role-tilt-x, 0deg))
      rotateY(var(--role-tilt-y, 0deg))
      scale(var(--role-hover-scale, 1));
    transform-style: preserve-3d;
    transform-origin: 50% 50%;
    box-shadow: 0 20px 46px rgb(var(--shadow-brand-rgb) / var(--role-shadow-alpha, 0));
    transition:
      opacity 120ms linear,
      transform 180ms ease-out,
      box-shadow 180ms ease;
    will-change: opacity, transform;
  }

  .role-card:hover,
  .role-card:focus-visible {
    --role-hover-z: 24px;
    --role-hover-scale: 1.018;
    --role-shadow-alpha: 0.24;
  }
  

  .role-card-bg {
    position: absolute;
    top: -20%; left: 50%;
    width: 136%; height: 140%;
    object-fit: cover;
    transform:
      translateX(calc(-50% + var(--role-bg-x, 0px)))
      translateY(var(--role-bg-y, 0px))
      translateZ(-24px)
      scale(1.04);
    transition: filter 260ms ease, transform 260ms ease;
    user-select: none;
    pointer-events: none;
  }

  .role-card-overlay {
    position: absolute; inset: -3px;
    height: auto;
    border-radius: var(--card-radius);
    background: var(--color-overlay-brand);
    transition: background 260ms ease;
    transform: translateZ(2px);
  }

  .role-card-copy {
    position: absolute;
    top: 88px; left: 0; right: 0;
    display: grid; justify-items: center;
    color: var(--color-text-inverse);
    text-align: center;
    transform: translateZ(34px);
    transition: transform 260ms ease;
  }

  .role-card-copy h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(34px, 3.45vw, 50px);
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: 0;
    font-variation-settings: "wdth" 100;
  }

  .role-card-copy p {
    margin: -8px 0 0;
    font-family: var(--font-text);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: 0;
    transition: opacity 180ms ease;
  }

  .role-dialogue {
    position: absolute; z-index: 3;
    top: 112px; left: var(--spacing-5);
    width: 184px;
    box-sizing: border-box;
    padding: 14px;
    border-radius: var(--dialogue-radius);
    background: var(--color-text-primary);
    color: var(--color-text-inverse);
    opacity: 0;
    transform: translateX(-130%) translateZ(48px);
    transition: opacity 260ms ease, transform 320ms ease;
    will-change: transform, opacity;
  }

  .role-dialogue p {
    margin: 0;
    font-family: var(--font-text);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: 0;
  }

  .role-dialogue strong {
    font-weight: 800;
    font-style: italic;
  }

  .role-person {
    position: absolute; z-index: 4;
    right: 8px; bottom: -168px;
    width: auto;
    height: min(126%, 600px);
    opacity: 0;
    transform:
      translateX(42%)
      translateX(var(--role-person-x, 0px))
      translateY(var(--role-person-y, 0px))
      translateZ(62px);
    transition: opacity 280ms ease, transform 360ms ease;
    user-select: none;
    pointer-events: none;
    will-change: transform, opacity;
  }

  .role-card.is-servizio .role-person {
    right: var(--servizio-person-right, -10px);
    bottom: var(--servizio-person-bottom, -168px);
    height: var(--servizio-person-height, min(126%, 600px));
  }

  .role-card.is-ufficio .role-person {
    right: var(--ufficio-person-right, -24px);
    bottom: var(--ufficio-person-bottom, -168px);
    height: var(--ufficio-person-height, min(124%, 590px));
  }

  .role-card.is-ufficio .role-dialogue {
    left: 20px;
    width: 164px;
  }

  .role-card.is-ufficio .role-action {
    left: 20px;
  }

  .role-action {
    position: absolute;
    z-index: 6;
    left: var(--spacing-5);
    top: 50%;
    display: grid;
    place-items: center;
    width: var(--card-action-size);
    height: var(--card-action-size);
    padding: var(--spacing-0);
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-variant-ligatures: common-ligatures discretionary-ligatures contextual;
    font-feature-settings: "liga" 1, "dlig" 1, "calt" 1, "kern" 1;
    background: var(--color-surface-panna);
    border: var(--card-action-border-width) solid var(--color-border-primary);
    border-radius: var(--card-action-radius);
    cursor: pointer;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transform:
      translateX(calc((var(--card-action-size) + var(--spacing-8)) * 4))
      translateY(-50%)
      translateZ(86px)
      rotate(-150deg)
      scale(0.72);
    transform-origin: 50% 50%;
    transition:
      color 160ms ease,
      border-color 180ms ease,
      opacity 220ms ease,
      transform 520ms cubic-bezier(0.2, 1.3, 0.32, 1);
    will-change: opacity, transform;
  }

  .role-action::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    content: '';
    background: var(--brand-500);
    transform: scaleY(0);
    transform-origin: bottom;
    transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .role-action-icon {
    position: relative;
    z-index: 1;
    display: block;
    font-family: var(--font-display);
    font-size: var(--spacing-6);
    font-weight: 700;
    font-variation-settings: "wdth" 100;
    font-style: normal;
    line-height: normal;
    transform: translateY(-1px);
  }

  .role-card:hover .role-action,
  .role-card:focus-within .role-action,
  .role-card:focus-visible .role-action {
    opacity: 1;
    pointer-events: auto;
    transform:
      translateX(var(--role-copy-x, 0px))
      translateY(calc(-50% + var(--role-dialogue-y, 0px)))
      translateZ(86px)
      rotate(0deg)
      scale(1);
  }

  .role-action:hover,
  .role-action:focus-visible {
    color: var(--color-text-inverse);
    border-color: var(--color-text-inverse);
    outline: none;
  }

  .role-action:hover::before,
  .role-action:focus-visible::before {
    transform: scaleY(1);
  }

  .role-card.has-dialogue:hover .role-card-bg,
  .role-card.has-dialogue:focus-visible .role-card-bg {
    filter: blur(2.5px);
    transform:
      translateX(calc(-50% + var(--role-bg-x, 0px)))
      translateY(var(--role-bg-y, 0px))
      translateZ(-24px)
      scale(1.08);
  }

  .role-card.is-cucina:hover .role-card-overlay,
  .role-card.is-cucina:focus-visible .role-card-overlay {
    background: var(--color-overlay-cucina-strong);
  }

  .role-card.is-ufficio:hover .role-card-overlay,
  .role-card.is-ufficio:focus-visible .role-card-overlay,
  .role-card.is-servizio:hover .role-card-overlay,
  .role-card.is-servizio:focus-visible .role-card-overlay {
    background: var(--color-overlay-brand-strong);
  }

  .role-card.has-dialogue:hover .role-card-copy,
  .role-card.has-dialogue:focus-visible .role-card-copy {
    transform:
      translateY(-78px)
      translateX(var(--role-copy-x, 0px))
      translateZ(58px);
  }

  .role-card.has-dialogue:hover .role-card-copy p,
  .role-card.has-dialogue:focus-visible .role-card-copy p {
    opacity: 0;
  }

  .role-card.has-dialogue:hover .role-dialogue,
  .role-card.has-dialogue:focus-visible .role-dialogue {
    opacity: 1;
    transform:
      translateX(var(--role-dialogue-x, 0px))
      translateY(var(--role-dialogue-y, 0px))
      translateZ(66px);
  }

  .role-card.has-dialogue:hover .role-person,
  .role-card.has-dialogue:focus-visible .role-person {
    opacity: 1;
    transform:
      translateX(var(--role-person-x, 0px))
      translateY(var(--role-person-y, 0px))
      translateZ(72px);
  }

  @media (max-width: 700px) {
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
    h1, .next-message { font-size: 24px; }
    .reel-card    { width: min(34vw, 132px); }
    .next-screen  { padding: var(--layout-page-gutter-mobile); }
    .brand-word   { font-size: clamp(48px, 14vw, 96px); }
    .brand-lockup { gap: 12px; }
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
      gap: 18px;
      justify-content: stretch;
      transform: none;
    }
    .role-card { min-height: 260px; border-radius: var(--card-radius-mobile); }
    .role-card-bg { top: -24%; width: 116%; height: 150%; }
    .role-card-overlay { height: 100%; border-radius: var(--card-radius-mobile); }
    .role-card-copy { top: 36px; }
    .role-card-copy h2 { font-size: clamp(32px, 10vw, 44px); }
    .role-card-copy p { font-size: 12px; }
    .role-card.has-dialogue:hover .role-card-copy,
    .role-card.has-dialogue:focus-visible .role-card-copy {
      transform: translateY(-22px) translateZ(58px);
    }
    .role-dialogue {
      top: 74px; left: 14px;
      width: min(54vw, 176px);
      padding: 10px;
      border-radius: var(--dialogue-radius-mobile);
    }
    .role-card.is-ufficio .role-dialogue {
      left: 14px;
      width: min(54vw, 160px);
    }
    .role-card.is-ufficio .role-action {
      left: 14px;
    }
    .role-dialogue p { font-size: 11px; }
    .role-action {
      top: 50%;
      left: var(--spacing-4);
      width: var(--card-action-size-mobile);
      height: var(--card-action-size-mobile);
      transform:
        translateX(calc((var(--card-action-size-mobile) + var(--spacing-6)) * 4))
        translateY(-50%)
        translateZ(86px)
        rotate(-150deg)
        scale(0.72);
    }
    .role-action-icon {
      font-size: var(--spacing-5);
    }
    .role-person {
      right: -16px; bottom: -6px;
      width: auto;
      height: min(82%, 260px);
    }
    .role-card.is-servizio .role-person {
      right: var(--servizio-person-mobile-right, -18px);
      bottom: var(--servizio-person-mobile-bottom, -6px);
      height: var(--servizio-person-mobile-height, min(82%, 260px));
    }
    .role-card.is-ufficio .role-person {
      right: var(--ufficio-person-mobile-right, -20px);
      bottom: var(--ufficio-person-mobile-bottom, -6px);
      height: var(--ufficio-person-mobile-height, min(80%, 250px));
    }
  }
</style>
