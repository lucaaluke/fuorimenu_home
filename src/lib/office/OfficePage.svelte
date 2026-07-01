<script lang="ts">
  import { onMount } from 'svelte';
  import VolumeMaxIcon from '$lib/VolumeMaxIcon.svelte';
  import VolumeOffIcon from '$lib/VolumeOffIcon.svelte';
  import { readAudioMutedPreference, writeAudioMutedPreference } from '$lib/scene/audio-preference';
  import OfficeScene from './OfficeScene.svelte';

  let isAudioMuted = $state(true);
  const audioLabel = $derived(isAudioMuted ? 'Audio disattivato' : 'Audio attivo');

  function toggleAudioMuted() {
    isAudioMuted = !isAudioMuted;
    writeAudioMutedPreference(isAudioMuted);
  }

  onMount(() => {
    isAudioMuted = readAudioMutedPreference(false);

    const hadTransition =
      sessionStorage.getItem('role-card-transition') === '1' ||
      sessionStorage.getItem('kitchen-card-transition') === '1';
    if (!hadTransition) return;
    sessionStorage.removeItem('role-card-transition');
    sessionStorage.removeItem('kitchen-card-transition');

    const transitionEls = Array.from(
      document.querySelectorAll<HTMLElement>('.card-enter-fade, .role-card.is-entering')
    );
    if (!transitionEls.length) return;

    requestAnimationFrame(() => {
      const animations = transitionEls.map((el) =>
        el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: '0' }], {
          duration: 220,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards'
        })
      );

      Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        transitionEls.forEach((el) => el.remove());
      });
    });
  });
</script>

<svelte:head>
  <title>Ufficio | Fuorimenu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=DynaPuff:wght@400..700&family=Fasthand&family=JetBrains+Mono:ital,wght@0,400;1,300;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main class="office-page">
  <header class="office-topbar" aria-label="Navigazione ufficio">
    <a class="logo" href="/?view=brand" aria-label="Vai al brand screen Fuorimenu">
      <span class="topbar-control-content">FM</span>
    </a>
    <button
      class="icon-button top-bar-audio"
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
    <a class="home-link" href="/?view=cards" aria-label="Torna alle card">
      <span class="topbar-control-content" aria-hidden="true">
        <span class="close-icon"></span>
      </span>
    </a>
  </header>

  <section class="office-shell" aria-label="Scena parallasse dell'ufficio">
    <OfficeScene {isAudioMuted} />
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: var(--color-surface-page);
  }

  .office-page {
    position: relative;
    min-height: 100svh;
    overflow-x: hidden;
    color: var(--color-text-primary);
    background: var(--color-surface-page);
    font-family: var(--font-text);
  }

  .office-topbar {
    position: fixed;
    z-index: 10;
    top: 0;
    left: 0;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    height: var(--layout-topbar-height);
    padding: var(--layout-topbar-padding);
    pointer-events: none;
  }

  .logo,
  .icon-button,
  .home-link {
    pointer-events: auto;
  }

  .logo {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
  }

  .home-link {
    grid-column: 3;
    justify-self: end;
  }

  .top-bar-audio {
    grid-column: 2;
    justify-self: center;
  }

  .icon-button {
    padding: 0;
    font: inherit;
  }

  .logo,
  .icon-button,
  .home-link {
    position: relative;
    display: inline-grid;
    min-width: 44px;
    min-height: 44px;
    border: 0;
    color: var(--color-text-primary);
    background: transparent;
    cursor: pointer;
    place-items: center;
  }

  .topbar-control-content {
    position: relative;
    z-index: 1;
    display: inline-grid;
    place-items: center;
  }

  .logo::before,
  .icon-button::before,
  .home-link::before {
    position: absolute;
    inset: 2px;
    content: '';
    border: 2px solid transparent;
    border-radius: 999px;
    transition:
      border-color 160ms ease,
      background-color 160ms ease;
  }

  .logo:hover::before,
  .logo:focus-visible::before,
  .icon-button:hover::before,
  .icon-button:focus-visible::before,
  .home-link:hover::before,
  .home-link:focus-visible::before {
    border-color: currentColor;
    background: rgb(247 243 234 / 0.72);
  }

  .logo:focus-visible,
  .icon-button:focus-visible,
  .home-link:focus-visible {
    outline: none;
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

  .close-icon {
    position: relative;
    display: block;
    width: 30px;
    height: 30px;
  }

  .close-icon::before,
  .close-icon::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 30px;
    height: 3px;
    content: '';
    background: currentColor;
    border-radius: 999px;
    transform-origin: 50% 50%;
  }

  .close-icon::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .close-icon::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }

  .office-shell {
    position: relative;
    min-height: 100svh;
  }
</style>
