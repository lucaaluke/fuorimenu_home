const tapClickFeedbackDurationMs = 180;

export function triggerTapClickFeedback(
  event: Event,
  selector = '.speech-bubble-page-button',
  className = 'is-tap-click-feedback'
) {
  const target = event.target instanceof Element ? event.target.closest(selector) : undefined;
  if (!(target instanceof HTMLElement) || target.hasAttribute('disabled')) return;

  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);

  window.setTimeout(() => {
    target.classList.remove(className);
  }, tapClickFeedbackDurationMs);
}
