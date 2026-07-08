<script lang="ts">
  const paganiniWrittenInterviewHref = '/interviste?chef=paganini&view=full';
  const paganiniYoutubeEmbedSrc = 'https://www.youtube.com/embed/VIDEO_ID?rel=0';
</script>

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
    href={paganiniWrittenInterviewHref}
    aria-label="Torna all'intervista scritta di Stefano Paganini"
  >
    <span class="paganini-video-back-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M19 12H5M11 6L5 12L11 18" />
      </svg>
    </span>
  </a>

  <h1 id="paganini-video-title" class="sr-only">Video intervista Stefano Paganini</h1>

  <div class="paganini-video-shell">
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
    box-sizing: border-box;
    display: grid;
    min-height: var(--app-viewport-height);
    place-items: center;
    padding: clamp(76px, 8vw, 108px) var(--layout-page-gutter);
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
    width: min(1280px, 100%);
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
      padding: 82px var(--layout-page-gutter-mobile) 32px;
    }

    .paganini-video-back {
      top: 28px;
      left: var(--layout-page-gutter-mobile);
    }
  }
</style>
