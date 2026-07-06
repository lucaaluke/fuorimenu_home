<script lang="ts">
  let {
    href,
    label,
    ariaLabel = `Vai alla sezione ${label}`,
    visible = true,
    onclick
  } = $props<{
    href: string;
    label: string;
    ariaLabel?: string;
    visible?: boolean;
    onclick?: (event: MouseEvent) => void;
  }>();
</script>

<a
  class="section-next-link"
  class:is-visible={visible}
  {href}
  aria-label={ariaLabel}
  aria-hidden={!visible}
  tabindex={visible ? 0 : -1}
  {onclick}
>
  <span class="section-next-control" aria-hidden="true" data-node-id="584:1462">
    <span class="section-next-control-content">
      <svg class="section-next-arrow" viewBox="0 0 24 24" focusable="false">
        <path d="M5 12H19M13 6L19 12L13 18" />
      </svg>
    </span>
  </span>
  <span class="section-next-label">{label}</span>
</a>

<style>
  .section-next-link {
    --next-ring-opacity: 0;
    --next-ring-inner-size: 0px;
    --next-content-scale: 1;

    position: fixed;
    right: var(--layout-page-gutter);
    top: 50%;
    z-index: 85;
    display: inline-grid;
    justify-items: center;
    gap: 8px;
    opacity: 0;
    pointer-events: none;
    transform: translate3d(12px, -50%, 0);
    transition:
      opacity 180ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: 1;
    text-decoration: none;
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
  }

  .section-next-link.is-visible {
    opacity: 1;
    pointer-events: auto;
    transform: translate3d(0, -50%, 0);
  }

  .section-next-control {
    position: relative;
    display: grid;
    width: var(--topbar-control-size, 48px);
    height: var(--topbar-control-size, 48px);
    place-items: center;
    border-radius: var(--radius-full);
    color: currentColor;
    isolation: isolate;
  }

  .section-next-control::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    border: 2px solid currentColor;
    border-radius: var(--radius-full);
    background: transparent;
    box-shadow: inset 0 0 0 var(--next-ring-inner-size) currentColor;
    content: '';
    opacity: var(--next-ring-opacity);
    transition:
      border-color 160ms ease,
      box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 120ms ease;
  }

  .section-next-control-content {
    position: relative;
    z-index: 2;
    display: grid;
    place-items: center;
    transform: scale(var(--next-content-scale));
    transition:
      color 160ms ease,
      transform 170ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .section-next-arrow {
    display: block;
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.85;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .section-next-label {
    display: block;
    color: currentColor;
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0;
    text-align: center;
  }

  .section-next-link:hover,
  .section-next-link:focus-visible {
    --next-ring-opacity: 1;
  }

  .section-next-link:active {
    --next-ring-opacity: 1;
    --next-ring-inner-size: 5px;
    --next-content-scale: 0.83;
  }

  .section-next-link:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 8px;
  }

  @media (max-width: 760px) {
    .section-next-link {
      right: var(--layout-page-gutter-mobile);
      gap: 7px;
    }
  }
</style>
