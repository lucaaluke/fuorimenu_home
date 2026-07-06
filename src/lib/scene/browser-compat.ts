type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export function getCompatibleAudioContextConstructor() {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
}

export function animateCompat(
  element: HTMLElement,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions
) {
  if (typeof element.animate !== 'function') return undefined;

  try {
    return element.animate(keyframes, options);
  } catch {
    return undefined;
  }
}

export function waitForAnimationCompat(animation: Animation | undefined, duration = 0) {
  if (!animation) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
  }

  return animation.finished?.then(() => undefined).catch(() => undefined) ?? Promise.resolve();
}

export function syncAppViewportHeightCssVar() {
  if (typeof window === 'undefined') return () => {};

  let frame: number | undefined;

  const sync = () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);

    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
    });
  };

  sync();
  window.addEventListener('resize', sync, { passive: true });
  window.visualViewport?.addEventListener('resize', sync, { passive: true });
  window.visualViewport?.addEventListener('scroll', sync, { passive: true });

  return () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', sync);
    window.visualViewport?.removeEventListener('resize', sync);
    window.visualViewport?.removeEventListener('scroll', sync);
  };
}
