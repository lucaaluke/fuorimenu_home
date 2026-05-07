<script lang="ts">
  import { onMount } from 'svelte';

  let reelProgress = 0;
  let pageProgress = 0;
  let homeScreen: HTMLElement;
  let nextScreen: HTMLElement;
  let reelCards: HTMLElement[] = [];
  let nextLetters: HTMLElement[] = [];
  let introLetters: HTMLElement[] = []; // ← nuovo

  const introMessage = 'Tutti abbiamo visto i video virali sulla cucina olimpica...';
  const introCharacters = introMessage.split('').map((letter, index) => ({
    letter,
    isSpace: letter === ' ',
    isAccent:
      index >= introMessage.indexOf('cucina') &&
      index < introMessage.indexOf('cucina') + 'cucina'.length
  }));

  const nextMessage = 'Incontra Le persone che hanno reso tutto questo possibile.';
  const nextCharacters = nextMessage.split('').map((letter, index) => ({
    letter,
    isSpace: letter === ' ',
    isAccent:
      index >= nextMessage.indexOf('persone') &&
      index < nextMessage.indexOf('persone') + 'persone'.length
  }));

  const reels = [
    { src: '/videos/tiramisu.mp4', poster: '', bg: '#f0f0f0', fromX: -8,  fromY:  4, toX: -34, toY: -18, rotate: -8  },
    { src: '/videos/1.mp4',        poster: '', bg: '#2a4484', fromX:  7,  fromY: -3, toX:  30, toY:  16, rotate:  7  },
    { src: '/videos/2.mp4',        poster: '', bg: '#fdc567', fromX: -4,  fromY: -8, toX: -18, toY:  28, rotate:  10 },
    { src: '/videos/3.mp4',        poster: '', bg: '#101318', fromX:  9,  fromY:  8, toX:  36, toY: -24, rotate: -11 },
    { src: '/videos/4.mp4',        poster: '', bg: '#5f6fa8', fromX: -10, fromY: -2, toX: -40, toY:   6, rotate:  -5 }
  ];

  const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
  const ease  = (value: number) => value * value * (3 - 2 * value);

  onMount(() => {
    const updateFlow = (delta: number) => {
      if (delta > 0) {
        const reelRoom = 1 - reelProgress;
        const reelStep = Math.min(delta, reelRoom);
        reelProgress += reelStep;
        pageProgress = clamp(pageProgress + (delta - reelStep), 0, 1);
      } else {
        const reverseDelta = Math.abs(delta);
        const pageStep = Math.min(reverseDelta, pageProgress);
        pageProgress -= pageStep;
        reelProgress = clamp(reelProgress - (reverseDelta - pageStep), 0, 1);
      }

      applyReelStyles();
      applyPageStyles();
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      updateFlow(event.deltaY / 1500);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        updateFlow(0.08);
      }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        updateFlow(-0.08);
      }
    };

    applyReelStyles();
    applyPageStyles();
    window.addEventListener('wheel',   handleWheel,   { passive: false });
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('wheel',   handleWheel);
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  function getReelPresentation(index: number) {
    const reel     = reels[index];
    const start    = index * 0.105 + 0.04;
    const duration = 0.48;
    const local    = clamp((reelProgress - start) / duration);
    const eased    = ease(local);
    const fadeIn   = clamp(local / 0.18);
    const fadeOut  = 1 - clamp((local - 0.76) / 0.24);
    const opacity  = fadeIn * fadeOut;
    const z        = -980 + eased * 1850;
    const scale    = 0.28 + eased * 4.2;
    const x        = reel.fromX + (reel.toX - reel.fromX) * eased;
    const y        = reel.fromY + (reel.toY - reel.fromY) * eased;
    const rotate   = reel.rotate * (0.35 + eased * 0.65);

    return { z, scale, opacity, x, y, rotate };
  }

  function reelStyle(index: number): string {
    const { z, scale, opacity, x, y, rotate } = getReelPresentation(index);
    return [
      `--x: ${x.toFixed(2)}vw`,
      `--y: ${y.toFixed(2)}vh`,
      `--z: ${z.toFixed(1)}px`,
      `--scale: ${scale.toFixed(3)}`,
      `--rotate: ${rotate.toFixed(2)}deg`,
      `--opacity: ${opacity.toFixed(3)}`,
      `z-index: ${index + 1}`
    ].join('; ');
  }

  function applyReelStyles() {
    reelCards.forEach((card, index) => {
      if (!card) return;
      const { z, scale, opacity, x, y, rotate } = getReelPresentation(index);
      card.style.setProperty('--x',       `${x.toFixed(2)}vw`);
      card.style.setProperty('--y',       `${y.toFixed(2)}vh`);
      card.style.setProperty('--z',       `${z.toFixed(1)}px`);
      card.style.setProperty('--scale',   scale.toFixed(3));
      card.style.setProperty('--rotate',  `${rotate.toFixed(2)}deg`);
      card.style.setProperty('--opacity', opacity.toFixed(3));
    });
  }

  function applyPageStyles() {
    const easedPage = ease(pageProgress);

    if (homeScreen) homeScreen.style.setProperty('--page-y', `${(-100 * easedPage).toFixed(2)}svh`);
    if (nextScreen) nextScreen.style.setProperty('--page-y', `${(100 - 100 * easedPage).toFixed(2)}svh`);

    // ── Intro: dissolve mentre pageProgress sale ── // ← nuovo
    introLetters.forEach((letter, index) => {
      if (!letter) return;
      const stagger    = 0.5 / Math.max(introLetters.length - 1, 1);
      const local      = clamp((pageProgress - index * stagger) / 0.08);
      const letterEase = ease(local);
      letter.style.setProperty('--letter-opacity', (1 - letterEase).toFixed(3));
      letter.style.setProperty('--letter-y',       `${(letterEase * -12).toFixed(1)}px`);
    });

    // ── Next: rivela mentre pageProgress sale ──
    nextLetters.forEach((letter, index) => {
      if (!letter) return;
      const revealStart = 0.12;
      const revealEnd   = 0.92;
      const stagger     = (revealEnd - revealStart) / Math.max(nextLetters.length - 1, 1);
      const local       = clamp((pageProgress - revealStart - index * stagger) / 0.07);
      const letterEase  = ease(local);
      letter.style.setProperty('--letter-opacity', letterEase.toFixed(3));
      letter.style.setProperty('--letter-y',       `${((1 - letterEase) * 12).toFixed(1)}px`);
    });
  }
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
    <!-- h1 ora itera lettera per lettera come nextMessage -->
    <h1 id="intro-title" aria-label={introMessage}>
      {#each introCharacters as character, index}
        {#if character.isSpace}
          <span class="space" aria-hidden="true">&nbsp;</span>
        {:else}
          <span
            bind:this={introLetters[index]}
            class:accent-letter={character.isAccent}
            aria-hidden="true"
          >{character.letter}</span>
        {/if}
      {/each}
    </h1>
  </section>

  <section class="reel-layer" aria-label="Mockup reels in profondità">
    {#each reels as reel, index}
      <article
        bind:this={reelCards[index]}
        class="reel-card"
        style={reelStyle(index)}
        aria-label={`Reel ${index + 1}`}
      >
        <div class="reel-frame">
          {#if reel.src}
            <video
              class="reel-video"
              src={reel.src}
              poster={reel.poster}
              autoplay
              muted
              playsinline
              loop
              preload="auto"
            ></video>
          {:else}
            <div class="reel-placeholder" style="background: {reel.bg}"></div>
          {/if}
        </div>
      </article>
    {/each}
  </section>

</main>


<section bind:this={nextScreen} class="next-screen" aria-labelledby="next-message">
  <p id="next-message" class="next-message" aria-label={nextMessage}>
    {#each nextCharacters as character, index}
      {#if character.isSpace}
        <span class="space" aria-hidden="true">&nbsp;</span>
      {:else}
        <span
          bind:this={nextLetters[index]}
          class:accent-letter={character.isAccent}
          aria-hidden="true"
        >{character.letter}</span>
      {/if}
    {/each}
  </p>
</section>


<style>
  :global(html), :global(body) {
    width: 100%; height: 100%;
    margin: 0;
    overflow: hidden;
    background: var(--background-50);
    overscroll-behavior: none;
  }
  :global(button), :global(a) { font: inherit; }

  .home {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100svh;
    overflow: hidden;
    background: var(--background-50);
    color: var(--brand-500);
    transform: translateY(var(--page-y, 0));
    transition: transform 160ms ease-out;
    will-change: transform;
  }

  .top-bar {
    position: absolute;
    z-index: 30;
    top: 0; left: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 102px;
    padding: var(--unit-40) var(--unit-80);
  }

  .logo {
    width: 51px;
    color: var(--brand-500);
    font-family: 'DynaPuff', system-ui, sans-serif;
    font-size: var(--unit-40);
    line-height: 1;
    text-decoration: none;
  }

  .top-bar-icons { display: flex; align-items: center; gap: 24px; }

  .top-bar a {
    color: var(--brand-500);
    font-family: 'DynaPuff', system-ui, sans-serif;
    font-weight: 400;
    text-decoration: none;
  }

  .icon-button {
    display: grid;
    width: 40px; height: 40px;
    place-items: center;
    padding: 0;
    color: var(--brand-500);
    background: transparent;
    border: 0;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }
  .icon-button:hover         { opacity: 0.65; }
  .icon-button:focus-visible { outline: 2px solid var(--accent-500); outline-offset: 4px; }

  .volume-icon {
    width: 28px; height: 28px;
    fill: none; stroke: currentColor;
    stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2;
  }

  .menu-icon,
  .menu-icon::before,
  .menu-icon::after {
    display: block; width: 18px; height: 2px;
    background: currentColor; border-radius: 999px;
  }
  .menu-icon          { position: relative; }
  .menu-icon::before,
  .menu-icon::after   { position: absolute; left: 0; content: ''; }
  .menu-icon::before  { top: -6px; }
  .menu-icon::after   { top:  6px; }

  .intro {
    position: absolute;
    z-index: 5; inset: 0;
    display: grid; place-items: center;
    box-sizing: border-box;
    padding: 102px var(--unit-40) var(--unit-80);
    pointer-events: none;
  }

  h1,
  .next-message {
    width: min(434px, 100%);
    margin: 0;
    color: #2A4385;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 32px;
    font-style: normal;
    font-weight: 400;
    line-height: 1.5;
    text-align: center;
  }

  /* Intro: lettere partono visibili (default 1) e si dissolvono */
  h1 span {
    display: inline-block;
    opacity: var(--letter-opacity, 1);
    transform: translateY(var(--letter-y, 0px));
    transition: opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }

  /* Spazio intro: sempre visibile, non animato */
  h1 .space {
    opacity: 1;
    transform: none;
    transition: none;
    width: 0.28em;
  }

  .accent-letter {
    color: var(--accent-500, #FE4C00);
    font-style: italic;
    font-weight: 700;
  }

  em { color: var(--accent-500); font-style: italic; font-weight: 700; }

  .reel-layer {
    position: absolute;
    z-index: 15; inset: 0;
    overflow: hidden;
    perspective: 900px;
    perspective-origin: 50% 50%;
    pointer-events: none;
    transform-style: preserve-3d;
  }

  .reel-card {
    position: absolute;
    top: 50%; left: 50%;
    width: clamp(112px, 13vw, 168px);
    aspect-ratio: 9 / 16;
    opacity: var(--opacity);
    transform: translate(-50%, -50%) translate3d(var(--x), var(--y), var(--z)) rotate(var(--rotate)) scale(var(--scale));
    transform-style: preserve-3d;
    transition: opacity 120ms linear, transform 120ms linear;
    will-change: transform, opacity;
  }

  .reel-frame {
    position: relative;
    width: 100%; height: 100%;
    overflow: hidden;
    border: 3px solid #101318;
    border-radius: 18px;
    box-shadow:
      0 36px 80px rgb(42 68 132 / 0.22),
      0 10px 26px rgb(16 19 24 / 0.28);
    box-sizing: border-box;
    background: #101318;
  }

  .reel-video,
  .reel-placeholder {
    display: block; width: 100%; height: 100%; object-fit: cover;
  }

  .next-screen {
    position: fixed;
    z-index: 20;
    inset: 0;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    padding: 102px var(--unit-40) var(--unit-80);
    background: var(--background-50);
    transform: translateY(var(--page-y, 100svh));
    transition: transform 160ms ease-out;
    will-change: transform;
  }

  /* Next: lettere partono invisibili (default 0) e si rivelano */
  .next-message span {
    display: inline-block;
    opacity: var(--letter-opacity, 0);
    transform: translateY(var(--letter-y, 12px));
    transition: opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }

  .next-message .accent-letter {
    color: var(--accent-500, #FE4C00);
    font-style: italic;
    font-weight: 700;
  }

  .next-message .space {
    display: inline-block;
    opacity: 1;
    transform: none;
    transition: none;
    width: 0.28em;
  }

  @media (max-width: 700px) {
    .top-bar      { height: 88px; padding: 28px 24px; }
    .logo         { font-size: 34px; }
    .intro        { padding: 88px 24px 72px; }
    h1,
    .next-message { font-size: 24px; }
    .reel-card    { width: min(34vw, 132px); }
    .next-screen  { padding: 88px 24px 72px; }
  }
</style>