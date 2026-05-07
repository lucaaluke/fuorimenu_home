<script lang="ts">
  import { onMount } from 'svelte';

  let reelProgress = 0;
  let reelCards: HTMLElement[] = [];

  const reels = [
    { src: '', poster: '', bg: '#fe4c00', fromX: -8, fromY: 4, toX: -34, toY: -18, rotate: -8 },
    { src: '', poster: '', bg: '#2a4484', fromX: 7, fromY: -3, toX: 30, toY: 16, rotate: 7 },
    { src: '', poster: '', bg: '#fdc567', fromX: -4, fromY: -8, toX: -18, toY: 28, rotate: 10 },
    { src: '', poster: '', bg: '#101318', fromX: 9, fromY: 8, toX: 36, toY: -24, rotate: -11 },
    { src: '', poster: '', bg: '#5f6fa8', fromX: -10, fromY: -2, toX: -40, toY: 6, rotate: -5 }
  ];

  const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
  const ease  = (value: number) => value * value * (3 - 2 * value);

  onMount(() => {
    const updateProgress = (delta: number) => {
      reelProgress = clamp(reelProgress + delta, 0, 1);
      applyReelStyles();
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      updateProgress(event.deltaY / 1500);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        updateProgress(0.08);
      }

      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        updateProgress(-0.08);
      }
    };

    applyReelStyles();
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
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
      card.style.setProperty('--x', `${x.toFixed(2)}vw`);
      card.style.setProperty('--y', `${y.toFixed(2)}vh`);
      card.style.setProperty('--z', `${z.toFixed(1)}px`);
      card.style.setProperty('--scale', scale.toFixed(3));
      card.style.setProperty('--rotate', `${rotate.toFixed(2)}deg`);
      card.style.setProperty('--opacity', opacity.toFixed(3));
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


<main class="home">

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
    <h1 id="intro-title">
      <span>Tutti abbiamo visto</span>
      <span>i video virali sulla</span>
      <span><em>cucina</em> olimpica...</span>
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
              muted
              playsinline
              loop
              preload="metadata"
            ></video>
          {:else}
            <div class="reel-placeholder" style="background: {reel.bg}"></div>
          {/if}
        </div>
      </article>
    {/each}
  </section>

</main>


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

  h1 {
    width: min(434px, 100%);
    margin: 0;
    color: var(--brand-500);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 32px; font-weight: 400;
    line-height: 1.45; text-align: center;
  }
  h1 span { display: block; }

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
    transition:
      opacity 120ms linear,
      transform 120ms linear;
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

  @media (max-width: 700px) {
    .top-bar   { height: 88px; padding: 28px 24px; }
    .logo      { font-size: 34px; }
    .intro     { padding: 88px 24px 72px; }
    h1         { font-size: 24px; }
    .reel-card { width: min(34vw, 132px); }
  }
</style>
