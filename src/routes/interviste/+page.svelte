<script lang="ts">
  import VolumeMaxIcon from '$lib/VolumeMaxIcon.svelte';
  import VolumeOffIcon from '$lib/VolumeOffIcon.svelte';
  import Interviste from '$lib/home/interviste/Interviste.svelte';
  import { readAudioMutedPreference, writeAudioMutedPreference } from '$lib/scene/audio-preference';
  import { onMount } from 'svelte';

  let isAudioMuted = $state(true);
  const audioLabel = $derived(isAudioMuted ? 'Audio disattivato' : 'Audio attivo');

  onMount(() => {
    isAudioMuted = readAudioMutedPreference();
  });

  function toggleAudioMuted() {
    isAudioMuted = !isAudioMuted;
    writeAudioMutedPreference(isAudioMuted);
  }
</script>

<svelte:head>
  <title>Interviste | Fuorimenù</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=DynaPuff:wght@400..700&family=Fasthand&family=JetBrains+Mono:ital,wght@0,400;0,800;1,700;1,800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main class="interviste-page" aria-label="Interviste Fuorimenù">
  <header class="interviste-top-bar" aria-label="Navigazione principale">
    <a class="logo press-ring-control" href="/?view=brand" aria-label="Vai al brand screen Fuorimenù">
      <span class="topbar-control-content">FM</span>
    </a>
    <button
      class="icon-button top-bar-audio press-ring-control"
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
    <a
      class="icon-button top-bar-menu press-ring-control"
      href="/"
      aria-label="Torna alla home Fuorimenù"
    >
      <span class="topbar-control-content" aria-hidden="true">
        <span class="menu-icon"></span>
      </span>
    </a>
  </header>

  <Interviste standalone standaloneTopOffset="var(--interviste-navbar-height)" />
</main>

<style>
  .interviste-page {
    --interviste-navbar-height: 136px;
    --interviste-navbar-padding-x: var(--layout-page-gutter);
    --topbar-control-bg: var(--color-surface-page);
    --topbar-control-fg: var(--color-text-primary);
    --topbar-control-hover-bg: var(--color-surface-page);
    --topbar-control-hover-fg: var(--color-text-primary);
    --topbar-control-depth: var(--color-text-primary);
    --button-hover-scale: 1;
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --topbar-lift-ease: cubic-bezier(0.18, 1.35, 0.28, 1);

    position: fixed;
    inset: 0;
    width: 100%;
    height: 100svh;
    min-height: 100vh;
    overflow: hidden;
    background: var(--color-surface-page);
    color: var(--color-text-primary);
  }

  .interviste-top-bar {
    position: fixed;
    z-index: 20;
    top: 0;
    left: 0;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    height: var(--interviste-navbar-height);
    padding: 0 var(--interviste-navbar-padding-x);
    pointer-events: none;
  }

  .logo,
  .icon-button {
    pointer-events: auto;
  }

  .logo {
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
  }

  .top-bar-audio {
    justify-self: center;
  }

  .top-bar-menu {
    justify-self: end;
  }

  .icon-button {
    display: grid;
    width: var(--button-icon-size);
    height: var(--button-icon-size);
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    appearance: none;
  }

  .logo,
  .icon-button {
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

  .logo::before,
  .icon-button::before,
  .logo::after,
  .icon-button::after {
    position: absolute;
    z-index: -1;
    inset: 0;
    border: 2px solid currentColor;
    border-radius: var(--radius-full);
    content: '';
    pointer-events: none;
  }

  .logo::before,
  .icon-button::before {
    display: none;
  }

  .logo::after,
  .icon-button::after {
    background: var(--topbar-control-bg);
    transition:
      background-color 160ms ease,
      transform 210ms var(--topbar-lift-ease);
  }

  .topbar-control-content {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    transform: translate(var(--button-lift-x), var(--button-lift-y));
    transition: transform 210ms var(--topbar-lift-ease);
  }

  .logo:hover,
  .logo:focus-visible,
  .icon-button:hover,
  .icon-button:focus-visible {
    --button-hover-scale: 1.04;
    color: var(--topbar-control-hover-fg);
  }

  .logo:hover::after,
  .logo:focus-visible::after,
  .icon-button:hover::after,
  .icon-button:focus-visible::after {
    background: var(--topbar-control-hover-bg);
  }

  .logo:active,
  .icon-button:active {
    --button-hover-scale: 0.98;
  }

  .logo:focus-visible,
  .icon-button:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: var(--unit-4);
  }

  :global(.volume-icon) {
    width: 28px;
    height: 28px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.2;
  }

  :global(.volume-max-icon) {
    stroke-width: 2.33333;
  }

  :global(.volume-slash) {
    stroke-width: 2.8;
  }

  .top-bar-menu .topbar-control-content {
    width: 24px;
    height: 24px;
  }

  .menu-icon {
    position: relative;
    display: block;
    width: 18px;
    height: 14px;
    background: linear-gradient(currentColor, currentColor) center / 18px 2px no-repeat;
  }

  .menu-icon::before,
  .menu-icon::after {
    position: absolute;
    left: 0;
    display: block;
    width: 18px;
    height: 2px;
    border-radius: var(--radius-full);
    background: currentColor;
    content: '';
  }

  .menu-icon::before {
    top: 0;
  }

  .menu-icon::after {
    bottom: 0;
  }

  @media (max-width: 700px) {
    .interviste-page {
      --interviste-navbar-height: var(--layout-topbar-height-mobile);
      --interviste-navbar-padding-x: var(--layout-page-gutter-mobile);
    }

    .interviste-top-bar {
      padding: var(--layout-topbar-padding-mobile);
    }

    .logo,
    .icon-button {
      width: var(--button-icon-size);
      height: var(--button-icon-size);
    }

    .logo {
      font-size: 34px;
    }
  }
</style>
