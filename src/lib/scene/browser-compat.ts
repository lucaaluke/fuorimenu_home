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
  let isTouchActive = false;
  let hasPendingTouchSync = false;
  let lastHeight = 0;

  const scheduleSync = () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);

    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      const height = window.visualViewport?.height ?? window.innerHeight;
      if (Math.abs(height - lastHeight) < 1) return;

      lastHeight = height;
      document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
    });
  };

  const sync = () => {
    if (isTouchActive) {
      hasPendingTouchSync = true;
      return;
    }

    scheduleSync();
  };

  const onTouchStart = () => {
    isTouchActive = true;
  };

  const onTouchEnd = (event: TouchEvent) => {
    isTouchActive = event.touches.length > 0;
    if (isTouchActive || !hasPendingTouchSync) return;

    hasPendingTouchSync = false;
    scheduleSync();
  };

  sync();
  window.addEventListener('resize', sync, { passive: true });
  window.visualViewport?.addEventListener('resize', sync, { passive: true });
  window.visualViewport?.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  window.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });

  return () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', sync);
    window.visualViewport?.removeEventListener('resize', sync);
    window.visualViewport?.removeEventListener('scroll', sync);
    window.removeEventListener('touchstart', onTouchStart, true);
    window.removeEventListener('touchend', onTouchEnd, true);
    window.removeEventListener('touchcancel', onTouchEnd, true);
  };
}
