<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import VolumeMaxIcon from '$lib/VolumeMaxIcon.svelte';
  import VolumeOffIcon from '$lib/VolumeOffIcon.svelte';
  import { animateCompat, waitForAnimationCompat } from '$lib/scene/browser-compat';
  import { readAudioMutedPreference, writeAudioMutedPreference } from '$lib/scene/audio-preference';
  import SectionNextLink from '$lib/scene/SectionNextLink.svelte';
  import OfficeScene from './OfficeScene.svelte';

  let isAudioMuted = $state(true);
  let sceneProgress = $state(0);
  let isLeavingSection = false;
  const sectionAudioFadeOutMs = 460;
  const audioLabel = $derived(isAudioMuted ? 'Audio disattivato' : 'Audio attivo');
  const showNextSectionLink = $derived(sceneProgress >= 0.96);

  function toggleAudioMuted() {
    isAudioMuted = !isAudioMuted;
    writeAudioMutedPreference(isAudioMuted);
  }

  function navigateWithAudioFade(event: MouseEvent, href: string, options: { immediate?: boolean } = {}) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (isLeavingSection) return;

    isLeavingSection = true;
    isAudioMuted = true;
    if (options.immediate) {
      void goto(href);
      return;
    }

    window.setTimeout(() => {
      void goto(href);
    }, sectionAudioFadeOutMs);
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
        animateCompat(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: '0' }], {
          duration: 220,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards'
        })
      );

      Promise.allSettled(animations.map((animation) => waitForAnimationCompat(animation, 220))).then(() => {
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
  <header class="scene-topbar office-topbar" aria-label="Navigazione ufficio">
    <a
      class="logo press-ring-control"
      href="/?view=brand"
      aria-label="Vai al brand screen Fuorimenu"
      onclick={(event) => navigateWithAudioFade(event, '/?view=brand')}
    >
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
      class="home-link press-ring-control"
      href="/?view=cards"
      aria-label="Torna alle card"
      onclick={(event) => navigateWithAudioFade(event, '/?view=cards', { immediate: true })}
    >
      <span class="topbar-control-content" aria-hidden="true">
        <span class="close-icon"></span>
      </span>
    </a>
  </header>

  <SectionNextLink
    href="/phaser"
    label="cucina"
    ariaLabel="Vai alla sezione cucina"
    visible={showNextSectionLink}
    onclick={(event) => navigateWithAudioFade(event, '/phaser', { immediate: true })}
  />

  <section class="office-shell" aria-label="Scena parallasse dell'ufficio">
    <OfficeScene {isAudioMuted} onProgressChange={(progress) => (sceneProgress = progress)} />
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: var(--color-surface-page);
    overscroll-behavior: none;
  }

  .office-page {
    position: relative;
    height: var(--app-viewport-height);
    overflow: hidden;
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

  .office-topbar .logo,
  .office-topbar .icon-button,
  .office-topbar .home-link {
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
    box-sizing: border-box;
    place-items: center;
    border: 0;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--topbar-control-fg);
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    isolation: isolate;
    transform: scale(var(--button-hover-scale));
    transition:
      color 160ms ease,
      opacity 0.2s ease,
      transform 210ms var(--topbar-lift-ease);
    will-change: transform;
  }

  .office-topbar .logo::before,
  .office-topbar .icon-button::before,
  .office-topbar .home-link::before {
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

  .office-topbar .logo::after,
  .office-topbar .icon-button::after,
  .office-topbar .home-link::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    border: 2px solid var(--topbar-control-fg);
    border-radius: var(--radius-full);
    background: var(--topbar-control-bg);
    content: '';
    transform: translate(var(--button-lift-x), var(--button-lift-y));
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
    transform: translate(var(--button-lift-x), var(--button-lift-y));
    transition:
      color 160ms ease,
      transform 210ms var(--topbar-lift-ease);
    will-change: transform;
  }

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

  .office-topbar .logo:hover,
  .office-topbar .logo:focus-visible,
  .office-topbar .icon-button:hover,
  .office-topbar .icon-button:focus-visible,
  .office-topbar .home-link:hover,
  .office-topbar .home-link:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: calc(var(--button-depth-y) * -1);
    --button-hover-scale: 1;
    color: var(--topbar-control-hover-fg);
  }

  .office-topbar .logo:hover::after,
  .office-topbar .logo:focus-visible::after,
  .office-topbar .icon-button:hover::after,
  .office-topbar .icon-button:focus-visible::after,
  .office-topbar .home-link:hover::after,
  .office-topbar .home-link:focus-visible::after {
    border-color: var(--topbar-control-fg);
    background: var(--topbar-control-hover-bg);
  }

  .office-topbar .logo:hover::before,
  .office-topbar .logo:focus-visible::before,
  .office-topbar .icon-button:hover::before,
  .office-topbar .icon-button:focus-visible::before,
  .office-topbar .home-link:hover::before,
  .office-topbar .home-link:focus-visible::before {
    opacity: 1;
  }

  .office-topbar .logo:active,
  .office-topbar .icon-button:active,
  .office-topbar .home-link:active {
    --button-lift-x: 0px;
    --button-lift-y: -1px;
    --button-hover-scale: 1;
  }

  .office-topbar .logo:active::before,
  .office-topbar .icon-button:active::before,
  .office-topbar .home-link:active::before {
    opacity: 1;
  }

  .scene-topbar .press-ring-control {
    --press-ring-opacity: 0;
    --press-ring-inner-size: 0px;
    --press-content-scale: 1;
    --button-lift-x: 0px;
    --button-lift-y: 0px;
  }

  .scene-topbar .press-ring-control::before {
    display: none;
  }

  .scene-topbar .press-ring-control::after {
    border-color: currentColor;
    background: transparent;
    box-shadow: inset 0 0 0 var(--press-ring-inner-size) currentColor;
    opacity: var(--press-ring-opacity);
    transform: none;
    transition:
      border-color 160ms ease,
      box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 120ms ease;
  }

  .scene-topbar .press-ring-control .topbar-control-content {
    transform: scale(var(--press-content-scale));
    transition:
      color 160ms ease,
      transform 170ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .scene-topbar .press-ring-control:hover,
  .scene-topbar .press-ring-control:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --press-ring-opacity: 1;
  }

  .scene-topbar .press-ring-control:hover::after,
  .scene-topbar .press-ring-control:focus-visible::after {
    border-color: currentColor;
    background: transparent;
  }

  .scene-topbar .press-ring-control:active {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --press-ring-opacity: 1;
    --press-ring-inner-size: 5px;
    --press-content-scale: 0.83;
  }

  .scene-topbar .home-link.press-ring-control .topbar-control-content {
    width: 24px;
    height: 24px;
  }

  .scene-topbar .home-link.press-ring-control .close-icon {
    width: 24px;
    height: 24px;
    background: linear-gradient(currentColor, currentColor) center / 24px 2.4px no-repeat;
    transform: rotate(45deg);
  }

  .scene-topbar .home-link.press-ring-control .close-icon::before {
    top: 50%;
    width: 24px;
    height: 2.4px;
    transform: translateY(-50%) rotate(90deg);
  }

  .logo:focus-visible,
  .icon-button:focus-visible,
  .home-link:focus-visible {
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

  .office-shell {
    position: relative;
    height: var(--app-viewport-height);
    overflow: hidden;
  }

  @media (max-width: 760px) {
    .office-topbar {
      height: var(--layout-topbar-height-mobile);
      padding: var(--layout-topbar-padding-mobile);
    }

    .logo {
      font-size: 24px;
    }
  }
</style>
