<script lang="ts">
  import { onMount } from 'svelte';

  let reelProgress = 0;
  let pageProgress = 0;
  let brandProgress = 0;
  let homeScreen: HTMLElement;
  let nextScreen: HTMLElement;
  let brandScreen: HTMLElement;
  let reelCards: HTMLElement[] = [];
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
  let brandLetterEls: HTMLElement[] = [];
  let floatingFrame = 0;
  let floatingLast = 0;
  let floatingEls: HTMLElement[] = [];

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
    motion: FloatingMotion;
  }> = [
    {
      src: '/images/raviolo.svg',
      label: 'Raviolo',
      className: 'floating-raviolo',
      nodeId: '266:413',
      motion: { x: 84, y: 96, vx: 92, vy: 74, tiltX: 0, tiltY: 0, hover: false }
    },
    {
      src: '/images/pizza.svg',
      label: 'Pizza',
      className: 'floating-pizza',
      nodeId: '2567:2664',
      motion: { x: 220, y: 280, vx: -82, vy: 96, tiltX: 0, tiltY: 0, hover: false }
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
      const local   = clamp((brandProgress - rank * stagger) / 0.18);
      const e       = ease(local);
      el.style.setProperty('--bl-z',       `${((1 - e) * 600).toFixed(1)}px`);
      el.style.setProperty('--bl-scale',   (1 + (1 - e) * 3.5).toFixed(3));
      el.style.setProperty('--bl-opacity', clamp(local / 0.25).toFixed(3));
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

      el.style.setProperty('--float-x', `${motion.x.toFixed(1)}px`);
      el.style.setProperty('--float-y', `${motion.y.toFixed(1)}px`);
      el.style.setProperty('--float-tilt-x', `${motion.tiltX.toFixed(2)}deg`);
      el.style.setProperty('--float-tilt-y', `${motion.tiltY.toFixed(2)}deg`);
      el.style.setProperty('--float-rotate', `${((motion.x + motion.y) * 0.018).toFixed(2)}deg`);
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

  // ── Unica funzione che gestisce tutto — nessun conflitto ──
  function applyAllStyles() {
    // 1. Home scorre via
    const epPage  = ease(pageProgress);
    const epBrand = ease(brandProgress);
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
        brandProgress  = clamp(brandProgress + rem1 - pageStep);
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
    href="https://fonts.googleapis.com/css2?family=DynaPuff:wght@400..700&family=JetBrains+Mono:ital,wght@0,400;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>


<main bind:this={homeScreen} class="home">
  <header class="top-bar" aria-label="Navigazione principale">
    <a class="logo" href="/" aria-label="Fuorimenu home">FM</a>
    <div class="top-bar-icons">
      <button class="icon-button" type="button" aria-label="Audio">
        <svg class="volume-icon" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M4 11.5h5l6-5v15l-6-5H4z" />
          <path d="M18.5 10a6 6 0 0 1 0 8" />
          <path d="M21 7.5a9.5 9.5 0 0 1 0 13" />
        </svg>
      </button>
      <button class="icon-button" type="button" aria-label="Menu">
        <span class="menu-icon" aria-hidden="true"></span>
      </button>
    </div>
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
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; height: 102px;
    padding: var(--unit-40) var(--unit-80);
  }

  .logo {
    width: 51px; color: var(--brand-500);
    font-family: 'DynaPuff', system-ui, sans-serif;
    font-size: var(--unit-40); line-height: 1; text-decoration: none;
  }

  .top-bar-icons { display: flex; align-items: center; gap: 24px; }
  .top-bar a {
    color: var(--brand-500);
    font-family: 'DynaPuff', system-ui, sans-serif;
    font-weight: 400; text-decoration: none;
  }

  .icon-button {
    display: grid; width: 40px; height: 40px; place-items: center;
    padding: 0; color: var(--brand-500);
    background: transparent; border: 0; cursor: pointer;
    transition: opacity 0.2s ease;
  }
  .icon-button:hover         { opacity: 0.65; }
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
    transform:
      translate3d(var(--float-x, 84px), var(--float-y, 96px), 0)
      rotateZ(var(--float-rotate, 0deg))
      rotateX(var(--float-tilt-x, 0deg))
      rotateY(var(--float-tilt-y, 0deg));
    transform-style: preserve-3d;
    transform-origin: 50% 50%;
    transition: filter 160ms ease;
    will-change: transform;
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

  .brand-word {
  position: relative; z-index: 1;
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
    transform: translateZ(var(--bl-z, 600px)) scale(var(--bl-scale, 4.5));
    transition: opacity 100ms linear, transform 100ms linear;
    will-change: opacity, transform;
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
  }
</style>
