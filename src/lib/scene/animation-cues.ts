import gsap from 'gsap';

type AnimationCue = gsap.core.Tween | gsap.core.Timeline;
type TickerCallback = Parameters<typeof gsap.ticker.add>[0];

export function createAnimationCueManager() {
  const cues = new Map<string, AnimationCue>();
  const tickerCallbacks = new Set<TickerCallback>();

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
    gsap.ticker.add(callback);
    tickerCallbacks.add(callback);

    return () => {
      gsap.ticker.remove(callback);
      tickerCallbacks.delete(callback);
    };
  }

  function destroy() {
    killAll();
    tickerCallbacks.forEach((callback) => gsap.ticker.remove(callback));
    tickerCallbacks.clear();
  }

  return {
    addTicker,
    destroy,
    get: <Cue extends AnimationCue = AnimationCue>(id: string) => cues.get(id) as Cue | undefined,
    kill,
    killAll,
    registerAnimationCue
  };
}

export function registerAnimationCue<Cue extends AnimationCue>(
  manager: ReturnType<typeof createAnimationCueManager>,
  id: string,
  cue: Cue
) {
  return manager.registerAnimationCue(id, cue);
}
