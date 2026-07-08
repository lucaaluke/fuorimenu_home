<script lang="ts">
  import { onMount } from 'svelte';

  const paganiniWrittenInterviewHref = '/interviste?chef=paganini&view=full';
  const paganiniKitchenDefaultCameraX = 8900;
  const kitchenReturnCameraStorageKey = 'kitchen-return-camera-x';
  const paganiniYoutubeEmbedSrc = 'https://www.youtube.com/embed/lIS9D7-pVkU?rel=0';

  let viewportWidth = $state(1280);
  let viewportHeight = $state(720);
  let backHref = $state(paganiniWrittenInterviewHref);
  let backLabel = $state("Torna all'intervista scritta di Stefano Paganini");

  const paganiniVideoShellStyle = $derived.by(() => {
    const isMobile = viewportWidth <= 700;
    const topOffset = isMobile ? 84 : 136;
    const sideGutter = isMobile ? 24 : 80;
    const bottomGap = isMobile ? 32 : Math.min(72, Math.max(40, viewportHeight * 0.06));
    const availableWidth = Math.max(260, viewportWidth - sideGutter * 2);
    const availableHeight = Math.max(180, viewportHeight - topOffset - bottomGap);
    const width = Math.min(1280, availableWidth, availableHeight * (16 / 9));
    const height = width * (9 / 16);

    return `width: ${width}px; height: ${height}px;`;
  });

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const isKitchenSource = params.get('source') === 'kitchen';
    const storedCameraXValue = sessionStorage.getItem(kitchenReturnCameraStorageKey);
    const storedCameraX = storedCameraXValue === null ? undefined : Number(storedCameraXValue);
    const kitchenCameraX =
      typeof storedCameraX === 'number' && Number.isFinite(storedCameraX)
        ? storedCameraX
        : paganiniKitchenDefaultCameraX;

    backHref = isKitchenSource ? `/phaser?cameraX=${Math.round(kitchenCameraX)}` : paganiniWrittenInterviewHref;
    backLabel = isKitchenSource ? 'Torna alla cucina' : "Torna all'intervista scritta di Stefano Paganini";
  });
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

<svelte:head>
  <title>Video Paganini | Fuorimenù</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=DynaPuff:wght@400..700&family=Fasthand&family=JetBrains+Mono:ital,wght@0,400;0,800;1,700;1,800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main class="paganini-video-page" aria-labelledby="paganini-video-title">
  <a
    class="paganini-video-back"
    href={backHref}
    aria-label={backLabel}
  >
    <span class="paganini-video-back-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M19 12H5M11 6L5 12L11 18" />
      </svg>
    </span>
  </a>

  <h1 id="paganini-video-title" class="sr-only">Video intervista Stefano Paganini</h1>

  <div class="paganini-video-shell" style={paganiniVideoShellStyle}>
    <iframe
      class="paganini-video-embed"
      src={paganiniYoutubeEmbedSrc}
      title="Video intervista Stefano Paganini"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen
    ></iframe>
  </div>
</main>

<style>
  .paganini-video-page {
    --paganini-video-top-offset: 136px;
    --paganini-video-bottom-gap: clamp(40px, 6vh, 72px);

    box-sizing: border-box;
    display: grid;
    grid-template-rows: var(--paganini-video-top-offset) minmax(0, 1fr);
    min-height: var(--app-viewport-height);
    padding: 0 var(--layout-page-gutter) var(--paganini-video-bottom-gap);
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, auto;
  }

  .paganini-video-back {
    position: fixed;
    top: 37px;
    left: 88px;
    z-index: 2;
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    color: var(--color-text-primary);
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    text-decoration: none;
  }

  .paganini-video-back:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 6px;
  }

  .paganini-video-back-icon,
  .paganini-video-back svg {
    display: block;
    width: 24px;
    height: 24px;
  }

  .paganini-video-back svg {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  .paganini-video-shell {
    grid-row: 2;
    align-self: center;
    justify-self: center;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 2px solid var(--color-text-primary);
    border-radius: var(--radius-s);
    background: var(--color-text-primary);
    box-shadow: 0 18px 34px rgb(42 68 132 / 0.16);
  }

  .paganini-video-embed {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 700px) {
    .paganini-video-page {
      --paganini-video-top-offset: 84px;
      --paganini-video-bottom-gap: 32px;

      padding: 0 var(--layout-page-gutter-mobile) var(--paganini-video-bottom-gap);
    }

    .paganini-video-back {
      top: 28px;
      left: var(--layout-page-gutter-mobile);
    }
  }
</style>
