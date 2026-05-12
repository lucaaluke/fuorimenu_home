<script lang="ts">
  import { onMount } from 'svelte';

  let reelProgress = 0;
  let pageProgress = 0;
  let brandProgress = 0;
  let homeScreen: HTMLElement;
  let nextScreen: HTMLElement;
  let brandScreen: HTMLElement;
  let rolesScreen: HTMLElement;
  let reelCards: HTMLElement[] = [];
  let roleCards: HTMLElement[] = [];
  let introLetters: HTMLElement[] = [];
  let nextLetters: HTMLElement[] = [];
  let mountProgress = 0;
  let introEl: HTMLElement;

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
  const nextMessage     = 'Incontra Le persone che hanno reso tutto questo possibile.';
  const brandWord       = 'Fuorimenu';
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

  const roleItems = [
    { title: 'ufficio', description: 'descrizione testo' },
    {
      title: 'cucina',
      description: 'descrizione testo',
      dialogue: 'Sono Stefano Paganini il mio ruolo ... seguimi nella mensa per saperne di più'
    },
    { title: 'servizio', description: 'descrizione testo' }
  ];

  type FloatingMotion = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    tiltX: number;
    tiltY: number;
    hover: boolean;
  };

  const floatingAssets: Array<{
    src: string;
    label: string;
    className: string;
    nodeId: string;
    exitX: number;
    exitY: number;
    wobble: { x: number; y: number; speed: number; phase: number };
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
      motion: { x: 84, y: 96, vx: 92, vy: 74, tiltX: 0, tiltY: 0, hover: false }
    },
    {
      src: '/images/pizza.svg',
      label: 'Pizza',
      className: 'floating-pizza',
      nodeId: '2567:2664',
      exitX: 7,
      exitY: -112,
      wobble: { x: 5, y: 7, speed: 0.92, phase: 1.8 },
      motion: { x: 220, y: 280, vx: -82, vy: 96, tiltX: 0, tiltY: 0, hover: false }
    },
    {
      src: '/images/fusillo.svg',
      label: 'Fusillo',
      className: 'floating-fusillo',
      nodeId: '266:420',
      exitX: -3,
      exitY: -126,
      wobble: { x: 12, y: 10, speed: 1.37, phase: 4.4 },
      motion: { x: 520, y: 132, vx: -63, vy: 117, tiltX: 0, tiltY: 0, hover: false }
    }
  ];

  const reels = [
    { src: '/videos/tiramisu.mp4', bg: '#f0f0f0', fromX: -8,  fromY:  4, toX: -34, toY: -18, rotate: -8  },
    { src: '/videos/1.mp4',        bg: '#2a4484', fromX:  7,  fromY: -3, toX:  30, toY:  16, rotate:  7  },
    { src: '/videos/2.mp4',        bg: '#fdc567', fromX: -4,  fromY: -8, toX: -18, toY:  28, rotate:  10 },
    { src: '/videos/3.mp4',        bg: '#101318', fromX:  9,  fromY:  8, toX:  36, toY: -24, rotate: -11 },
    { src: '/videos/4.mp4',        bg: '#5f6fa8', fromX: -10, fromY: -2, toX: -40, toY:   6, rotate:  -5 }
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
      const driftTime = time / 1000 * wobble.speed + wobble.phase;

      motion.x += motion.vx * dt;
      motion.y += motion.vy * dt;

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
      el.style.setProperty('--float-rotate', `${(((motion.x + motion.y) * 0.018) + Math.sin(driftTime * 0.7) * 5).toFixed(2)}deg`);
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

  function reloadHome(event: MouseEvent) {
    event.preventDefault();
    if (window.location.pathname === '/') {
      window.location.reload();
    } else {
      window.location.assign('/');
    }
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

    // 5. Lettere next: si rivelano con pageProgress
    applyLetterStyles(nextLetters, pageProgress, {
      start: 0.45, end: 0.92, windowSize: 0.07, invert: false, dy: 12
    });

    // 6. Lettere brand
    applyBrandLetters();
  }

  onMount(() => {
    setTimeout(() => {
      const mountStart    = performance.now();
      const mountDuration = 2000;
      const tickMount = (now: number) => {
        const o = ease(Math.min((now - mountStart) / mountDuration, 1));
        introEl?.style.setProperty('--mount-opacity', o.toFixed(3));
        if (o < 1) requestAnimationFrame(tickMount);
      };
      requestAnimationFrame(tickMount);
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
    return () => {
      cancelAnimationFrame(floatingFrame);
      window.removeEventListener('wheel',   onWheel);
      window.removeEventListener('keydown', onKeydown);
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
  <header class="top-bar" aria-label="Navigazione principale">
    <a class="logo" href="/" aria-label="Fuorimenu home" onclick={reloadHome}>FM</a>
    <button class="icon-button top-bar-audio" type="button" aria-label="Audio">
      <svg class="volume-icon" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M4 11.5h5l6-5v15l-6-5H4z" />
        <path d="M18.5 10a6 6 0 0 1 0 8" />
        <path d="M21 7.5a9.5 9.5 0 0 1 0 13" />
      </svg>
    </button>
    <button class="icon-button top-bar-menu" type="button" aria-label="Menu">
      <span class="menu-icon" aria-hidden="true"></span>
    </button>
  </header>

  <section class="intro" aria-labelledby="intro-title" bind:this={introEl}>
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
  </section>

  <section class="reel-layer" aria-label="Mockup reels in profondità">
    {#each reels as reel, index}
      <article bind:this={reelCards[index]} class="reel-card" aria-label={`Reel ${index + 1}`}>
        <div class="reel-frame">
          {#if reel.src}
            <video class="reel-video" src={reel.src} autoplay muted playsinline loop preload="auto"></video>
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

  <p class="brand-word" aria-label="Fuorimenu">
    {#each brandLetters as { letter }, index}
      <span bind:this={brandLetterEls[index]} class="brand-letter" aria-hidden="true"
        >{letter}</span>
    {/each}
  </p>
</section>

<section bind:this={rolesScreen} class="roles-screen" aria-label="Aree Fuorimenu">
  <header class="roles-top-bar" aria-label="Navigazione principale">
    <a class="logo" href="/" aria-label="Fuorimenu home" onclick={reloadHome}>FM</a>
    <button class="icon-button top-bar-audio" type="button" aria-label="Audio">
      <svg class="volume-icon" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M4 11.5h5l6-5v15l-6-5H4z" />
        <path d="M18.5 10a6 6 0 0 1 0 8" />
        <path d="M21 7.5a9.5 9.5 0 0 1 0 13" />
      </svg>
    </button>
    <button class="icon-button top-bar-menu" type="button" aria-label="Menu">
      <span class="menu-icon" aria-hidden="true"></span>
    </button>
  </header>

  <div class="role-grid">
    {#each roleItems as item, index}
      <article
        bind:this={roleCards[index]}
        class="role-card"
        class:is-cucina={item.title === 'cucina'}
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
              Sono <strong>Stefano Paganini</strong> il mio ruolo ... seguimi nella cucina per
              saperne di più
            </p>
          </div>
          <img class="role-person" src="/images/stefano-paganini.png" alt="Stefano Paganini" draggable="false" />
        {/if}
      </article>
    {/each}
  </div>
</section>


<style>
  :global(html), :global(body) {
    width: 100%; height: 100%;
    margin: 0; overflow: hidden;
    background: var(--background-50);
    overscroll-behavior: none;
  }
  :global(button), :global(a) { font: inherit; }

  .home {
    position: fixed; inset: 0;
    width: 100%; height: 100svh; overflow: hidden;
    background: var(--background-50); color: var(--brand-500);
    transform: translateY(var(--page-y, 0));
    transition: transform 160ms ease-out;
    will-change: transform;
  }

  .top-bar {
    position: absolute; z-index: 30; top: 0; left: 0;
    box-sizing: border-box;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    width: 100%; height: 102px;
    padding: var(--unit-40) var(--unit-80);
  }

  .logo {
    width: 51px; color: var(--brand-500);
    font-family: 'DynaPuff', system-ui, sans-serif;
    font-size: var(--unit-40); line-height: 1; text-decoration: none;
    transition: color 160ms ease;
  }

  .top-bar-audio { justify-self: center; }
  .top-bar-menu { justify-self: end; }

  .top-bar a, .roles-top-bar a {
    color: var(--brand-500);
    font-family: 'DynaPuff', system-ui, sans-serif;
    font-weight: 400; text-decoration: none;
  }

  .icon-button {
    display: grid; width: 40px; height: 40px; place-items: center;
    padding: 0; color: var(--brand-500);
    background: transparent; border: 0; cursor: pointer;
    transition: color 160ms ease, opacity 0.2s ease;
  }
  .logo:hover,
  .logo:focus-visible,
  .icon-button:hover,
  .icon-button:focus-visible { color: var(--accent-500, #FE4C00); }
  .icon-button:hover         { opacity: 1; }
  .icon-button:focus-visible { outline: 2px solid var(--accent-500); outline-offset: 4px; }

  .volume-icon {
    width: 28px; height: 28px; fill: none; stroke: currentColor;
    stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2;
  }

  .menu-icon, .menu-icon::before, .menu-icon::after {
    display: block; width: 18px; height: 2px;
    background: currentColor; border-radius: 999px;
  }
  .menu-icon          { position: relative; }
  .menu-icon::before,
  .menu-icon::after   { position: absolute; left: 0; content: ''; }
  .menu-icon::before  { top: -6px; }
  .menu-icon::after   { top:  6px; }

  .intro {
    position: absolute; z-index: 5; inset: 0;
    display: grid; place-items: center;
    box-sizing: border-box;
    padding: 102px var(--unit-40) var(--unit-80);
    pointer-events: none;
    opacity: var(--mount-opacity, 0);
    transition: opacity 80ms linear;
    will-change: opacity;
  }

  h1, .next-message {
    width: min(434px, 100%); margin: 0; color: #2A4385;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
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

  .accent-letter { color: var(--accent-500, #FE4C00); font-style: italic; font-weight: 700; }

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
    overflow: hidden; border: 3px solid #101318; border-radius: 18px;
    box-shadow: 0 36px 80px rgb(42 68 132/.22), 0 10px 26px rgb(16 19 24/.28);
    box-sizing: border-box; background: #101318;
  }

  .reel-video, .reel-placeholder {
    display: block; width: 100%; height: 100%; object-fit: cover;
  }

  /* Parte invisibile, nessun transform — solo opacity gestita da JS */
  .next-screen {
    position: fixed; z-index: 20; inset: 0;
    display: grid; place-items: center; box-sizing: border-box;
    padding: 102px var(--unit-40) var(--unit-80);
    background: var(--background-50);
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
  .next-message .accent-letter { color: var(--accent-500, #FE4C00); font-style: italic; font-weight: 700; }
  .next-message .space { display: inline-block; opacity: 1; transform: none; transition: none; width: 0.28em; }

  /* Parte invisibile, sopra next-screen, solo opacity gestita da JS */
  .brand-screen {
    position: fixed; z-index: 25; inset: 0;
    display: grid; place-items: center;
    overflow: hidden;
    background: var(--background-50);
    perspective: 900px; perspective-origin: 50% 50%;
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .floating-vector {
    position: absolute; z-index: 2; top: 0; left: 0;
    cursor: grab;
    opacity: var(--float-opacity, 1);
    transform:
      translate3d(var(--float-x, 84px), var(--float-y, 96px), 0)
      translate3d(var(--float-scroll-x, 0vw), var(--float-scroll-y, 0vh), 0)
      rotateZ(var(--float-rotate, 0deg))
      rotateX(var(--float-tilt-x, 0deg))
      rotateY(var(--float-tilt-y, 0deg))
      scale(var(--float-scale, 1));
    transform-style: preserve-3d;
    transform-origin: 50% 50%;
    transition: filter 160ms ease, opacity 100ms linear;
    will-change: transform, opacity;
  }

  .floating-vector:hover {
    filter: drop-shadow(0 18px 20px rgb(42 68 132/.18));
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

  .brand-word {
  position: relative; z-index: 3;
  margin: 0;
  display: flex; align-items: baseline;
  font-family: 'DynaPuff', system-ui, sans-serif;
  font-size: clamp(72px, 12vw, 160px);
  font-weight: 700;                    
  font-variation-settings: "wdth" 100;      
  line-height: 1;
  color: var(--brand-500, #2A4385);
  transform-style: preserve-3d;
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

  .roles-screen {
    position: fixed; z-index: 35; inset: 0;
    overflow: hidden;
    background: var(--background-50);
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .roles-top-bar {
    position: absolute; z-index: 5; top: 0; left: 0;
    box-sizing: border-box;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    width: 100%; height: 102px;
    padding: var(--unit-40) var(--unit-80);
    color: var(--brand-500);
  }

  .role-grid {
    position: absolute; z-index: 2;
    top: 110px; left: 80px; right: 80px; bottom: -18px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .role-card {
    position: relative;
    overflow: hidden;
    min-height: 0;
    border: 3px solid var(--brand-500, #2a4484);
    border-radius: 32px 32px 0 0;
    background: var(--brand-500, #2a4484);
    opacity: var(--role-card-opacity, 0);
    transform: translateY(var(--role-card-y, 38vh));
    transition: opacity 120ms linear, transform 120ms ease-out;
    will-change: opacity, transform;
  }

  .role-card-bg {
    position: absolute;
    top: -20%; left: 50%;
    width: 136%; height: 140%;
    object-fit: cover;
    transform: translateX(-50%);
    transition: filter 260ms ease, transform 260ms ease;
    user-select: none;
    pointer-events: none;
  }

  .role-card-overlay {
    position: absolute; inset: -3px;
    height: auto;
    border-radius: 32px 32px 0 0;
    background: rgb(42 68 132 / 0.6);
    transition: background 260ms ease;
  }

  .role-card-copy {
    position: absolute;
    top: 111px; left: 0; right: 0;
    display: grid; justify-items: center;
    color: var(--background-50, #f8f3e9);
    text-align: center;
    transition: transform 260ms ease;
  }

  .role-card-copy h2 {
    margin: 0;
    font-family: 'DynaPuff', system-ui, sans-serif;
    font-size: clamp(42px, 4vw, 60px);
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: 0;
    font-variation-settings: "wdth" 100;
  }

  .role-card-copy p {
    margin: -8px 0 0;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: 0;
    transition: opacity 180ms ease;
  }

  .role-dialogue {
    position: absolute; z-index: 3;
    top: 132px; left: 28px;
    width: 210px;
    box-sizing: border-box;
    padding: 16px;
    border-radius: 24px;
    background: var(--brand-500, #2a4484);
    color: var(--background-50, #f8f3e9);
    opacity: 0;
    transform: translateX(-130%);
    transition: opacity 260ms ease, transform 320ms ease;
    will-change: transform, opacity;
  }

  .role-dialogue p {
    margin: 0;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 16px;
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
    right: -112px; bottom: -110px;
    width: min(109%, 474px);
    height: auto;
    opacity: 0;
    transform: translateX(42%);
    transition: opacity 280ms ease, transform 360ms ease;
    user-select: none;
    pointer-events: none;
    will-change: transform, opacity;
  }

  .role-card.is-cucina:hover .role-card-bg,
  .role-card.is-cucina:focus-visible .role-card-bg {
    filter: blur(2.5px);
    transform: translateX(-50%) scale(1.02);
  }

  .role-card.is-cucina:hover .role-card-overlay,
  .role-card.is-cucina:focus-visible .role-card-overlay {
    background: rgb(42 68 132 / 0.8);
  }

  .role-card.is-cucina:hover .role-card-copy,
  .role-card.is-cucina:focus-visible .role-card-copy {
    transform: translateY(-102px);
  }

  .role-card.is-cucina:hover .role-card-copy p,
  .role-card.is-cucina:focus-visible .role-card-copy p {
    opacity: 0;
  }

  .role-card.is-cucina:hover .role-dialogue,
  .role-card.is-cucina:focus-visible .role-dialogue {
    opacity: 1;
    transform: translateX(0);
  }

  .role-card.is-cucina:hover .role-person,
  .role-card.is-cucina:focus-visible .role-person {
    opacity: 1;
    transform: translateX(0);
  }

  @media (max-width: 700px) {
    .top-bar      { height: 88px; padding: 28px 24px; }
    .logo         { font-size: 34px; }
    .intro        { padding: 88px 24px 72px; }
    h1, .next-message { font-size: 24px; }
    .reel-card    { width: min(34vw, 132px); }
    .next-screen  { padding: 88px 24px 72px; }
    .brand-word   { font-size: clamp(48px, 14vw, 96px); }
    .floating-raviolo { width: clamp(86px, 28vw, 124px); }
    .floating-pizza { width: clamp(92px, 30vw, 132px); }
    .floating-fusillo { width: clamp(82px, 26vw, 118px); }
    .roles-top-bar { height: 88px; padding: 28px 24px; }
    .role-grid {
      top: 88px; left: 24px; right: 24px; bottom: 0;
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .role-card { min-height: 260px; border-radius: 24px; }
    .role-card-bg { top: -24%; width: 116%; height: 150%; }
    .role-card-overlay { height: 100%; border-radius: 24px; }
    .role-card-copy { top: 42px; }
    .role-card-copy h2 { font-size: clamp(38px, 12vw, 52px); }
    .role-card-copy p { font-size: 13px; }
    .role-card.is-cucina:hover .role-card-copy,
    .role-card.is-cucina:focus-visible .role-card-copy {
      transform: translateY(-28px);
    }
    .role-dialogue {
      top: 78px; left: 16px;
      width: min(58vw, 210px);
      padding: 12px;
      border-radius: 18px;
    }
    .role-dialogue p { font-size: 12px; }
    .role-person {
      right: -70px; bottom: 0;
      width: min(78vw, 300px);
    }
  }
</style>
