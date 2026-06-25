import type { Gsap } from '$lib/scene/gsap-loader';

type AnimationCue = ReturnType<Gsap['to']> | ReturnType<Gsap['timeline']>;
type TickerCallback = Parameters<Gsap['ticker']['add']>[0];

export function createAnimationCueManager(initialGsap?: Gsap) {
  let gsap = initialGsap;
  const cues = new Map<string, AnimationCue>();
  const tickerCallbacks = new Set<TickerCallback>();

  function requireGsap() {
    if (!gsap) throw new Error('GSAP has not been loaded yet.');
    return gsap;
  }

  function setGsap(nextGsap: Gsap) {
    gsap = nextGsap;
  }

  function registerAnimationCue<Cue extends AnimationCue>(id: string, cue: Cue) {
    cues.get(id)?.kill();
    cues.set(id, cue);
    return cue;
  }

  function kill(id: string) {
    cues.get(id)?.kill();
    cues.delete(id);
  }

  function killAll() {
    cues.forEach((cue) => cue.kill());
    cues.clear();
  }

  function addTicker(callback: TickerCallback) {
    const loadedGsap = requireGsap();

    loadedGsap.ticker.add(callback);
    tickerCallbacks.add(callback);

    return () => {
      loadedGsap.ticker.remove(callback);
      tickerCallbacks.delete(callback);
    };
  }

  function destroy() {
    killAll();
    if (gsap) tickerCallbacks.forEach((callback) => gsap!.ticker.remove(callback));
    tickerCallbacks.clear();
  }

  return {
    addTicker,
    destroy,
    get: <Cue extends AnimationCue = AnimationCue>(id: string) => cues.get(id) as Cue | undefined,
    kill,
    killAll,
    registerAnimationCue,
    setGsap
  };
}

export function registerAnimationCue<Cue extends AnimationCue>(
  manager: ReturnType<typeof createAnimationCueManager>,
  id: string,
  cue: Cue
) {
  return manager.registerAnimationCue(id, cue);
}
