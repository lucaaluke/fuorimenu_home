<script lang="ts">
  import { onMount } from 'svelte';

  // ── Stato ──
  let reelProgress = 0;
  let pageProgress = 0;
  let homeScreen: HTMLElement;
  let nextScreen: HTMLElement;
  let reelCards: HTMLElement[] = [];
  let introLetters: HTMLElement[] = [];
  let nextLetters: HTMLElement[] = [];

  // ── Utility ──
  const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);
  const ease  = (v: number) => v * v * (3 - 2 * v);

  // ── Helpers testo ──
  function parseMessage(msg: string, accentWord: string) {
    const start = msg.indexOf(accentWord);
    const end   = start + accentWord.length;
    return msg.split('').map((letter, i) => ({
      letter,
      isSpace:  letter === ' ',
      isAccent: i >= start && i < end
    }));
  }

  const introMessage    = 'Tutti abbiamo visto i video virali sulla cucina olimpica...';
  const nextMessage     = 'Incontra Le persone che hanno reso tutto questo possibile.';
  const introCharacters = parseMessage(introMessage, 'cucina');
  const nextCharacters  = parseMessage(nextMessage,  'persone');

  // ── Dati reel ──
  const reels = [
    { src: '/videos/tiramisu.mp4', bg: '#f0f0f0', fromX: -8,  fromY:  4, toX: -34, toY: -18, rotate: -8  },
    { src: '/videos/1.mp4',        bg: '#2a4484', fromX:  7,  fromY: -3, toX:  30, toY:  16, rotate:  7  },
    { src: '/videos/2.mp4',        bg: '#fdc567', fromX: -4,  fromY: -8, toX: -18, toY:  28, rotate:  10 },
    { src: '/videos/3.mp4',        bg: '#101318', fromX:  9,  fromY:  8, toX:  36, toY: -24, rotate: -11 },
    { src: '/videos/4.mp4',        bg: '#5f6fa8', fromX: -10, fromY: -2, toX: -40, toY:   6, rotate:  -5 }
  ];

  // ── Animazione lettere (riutilizzabile per intro e next) ──
  function applyLetterStyles(
    letters: HTMLElement[],
    progress: number,
    opts: { start: number; end: number; windowSize: number; invert: boolean; dy: number }
  ) {
    const { start, end, windowSize, invert, dy } = opts;
    const stagger = (end - start) / Math.max(letters.length - 1, 1);

    letters.forEach((el, i) => {
      if (!el) return;
      const local      = clamp((progress - start - i * stagger) / windowSize);
      const e          = ease(local);
      const opacity    = invert ? 1 - e : e;
      const translateY = invert ? e * -dy : (1 - e) * dy;
      el.style.setProperty('--letter-opacity', opacity.toFixed(3));
      el.style.setProperty('--letter-y',       `${translateY.toFixed(1)}px`);
    });
  }

  // ── Calcolo presentazione reel ──
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

  // ── Apply DOM ──
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

  function applyPageStyles() {
    const ep = ease(pageProgress);
    homeScreen?.style.setProperty('--page-y', `${(-100 * ep).toFixed(2)}svh`);
    nextScreen?.style.setProperty('--page-y', `${(100 - 100 * ep).toFixed(2)}svh`);

    applyLetterStyles(introLetters, pageProgress, {
      start: 0, end: 0.5, windowSize: 0.08, invert: true, dy: 12
    });
    applyLetterStyles(nextLetters, pageProgress, {
      start: 0.12, end: 0.92, windowSize: 0.07, invert: false, dy: 12
    });
  }

  // ── Input handling ──
  onMount(() => {
    const updateFlow = (delta: number) => {
      if (delta > 0) {
        const step = Math.min(delta, 1 - reelProgress);
        reelProgress += step;
        pageProgress  = clamp(pageProgress + delta - step);
      } else {
        const abs  = Math.abs(delta);
        const step = Math.min(abs, pageProgress);
        pageProgress  -= step;
        reelProgress   = clamp(reelProgress - (abs - step));
      }
      applyReelStyles();
      applyPageStyles();
    };

    const onWheel   = (e: WheelEvent)   => { e.preventDefault(); updateFlow(e.deltaY / 1500); };
    const onKeydown = (e: KeyboardEvent) => {
      const map: Record<string, number> = {
        ArrowDown: 0.08, PageDown: 0.08, ' ': 0.08,
        ArrowUp: -0.08,  PageUp:  -0.08
      };
      if (e.key in map) { e.preventDefault(); updateFlow(map[e.key]); }
    };

    applyReelStyles();
    applyPageStyles();
    window.addEventListener('wheel',   onWheel,   { passive: false });
    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('wheel',   onWheel);
      window.removeEventListener('keydown', onKeydown);
    };
  });
</script>


<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=DynaPuff&family=JetBrains+Mono:ital,wght@0,400;1,700&display=swap"
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

  <section class="intro" aria-labelledby="intro-title">
    <h1 id="intro-title" aria-label={introMessage}>
      {#each introCharacters as { letter, isSpace, isAccent }, index}
        {#if isSpace}
          <span class="space" aria-hidden="true">&nbsp;</span>
        {:else}
          <span bind:this={introLetters[index]} class:accent-letter={isAccent} aria-hidden="true"
            >{letter}</span>
        {/if}
      {/each}
    </h1>
  </section>

  <section class="reel-layer" aria-label="Mockup reels in profondità">
    {#each reels as reel, index}
      <article
        bind:this={reelCards[index]}
        class="reel-card"
        aria-label={`Reel ${index + 1}`}
      >
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
    width: 100%; height: 100svh;
    overflow: hidden;
    background: var(--background-50);
    color: var(--brand-500);
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
  }

  h1, .next-message {
    width: min(434px, 100%); margin: 0;
    color: #2A4385;
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

  .next-screen {
    position: fixed; z-index: 20; inset: 0;
    display: grid; place-items: center; box-sizing: border-box;
    padding: 102px var(--unit-40) var(--unit-80);
    background: var(--background-50);
    transform: translateY(var(--page-y, 100svh));
    transition: transform 160ms ease-out; will-change: transform;
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

  @media (max-width: 700px) {
    .top-bar      { height: 88px; padding: 28px 24px; }
    .logo         { font-size: 34px; }
    .intro        { padding: 88px 24px 72px; }
    h1, .next-message { font-size: 24px; }
    .reel-card    { width: min(34vw, 132px); }
    .next-screen  { padding: 88px 24px 72px; }
  }
</style>