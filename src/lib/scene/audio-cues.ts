import type { Gsap } from '$lib/scene/gsap-loader';

export type AudioCueConfig = {
  el?: HTMLAudioElement;
  fadeIn?: boolean;
  fadeInDuration?: number;
  loop?: boolean;
  maxTime?: number;
  outputGain?: number;
  src?: string;
  startTime?: number;
  targetVolume: number;
};

type AudioCueManagerOptions = {
  fade?: {
    duration: number;
    ease: string;
  };
  gsap?: Gsap;
};

const defaultFade = {
  duration: 0.52,
  ease: 'power2.inOut'
};

export function createAudioCueManager<Id extends string>(options: AudioCueManagerOptions = {}) {
  const cues = new Map<Id, AudioCueConfig>();
  const fadeTweens = new Map<Id, ReturnType<Gsap['to']>>();
  const fallbackFadeFrames = new Map<Id, number>();
  const loopFrames = new Map<Id, number>();
  const fadeMotion = { ...defaultFade, ...options.fade };
  let gsap = options.gsap;
  let unlocked = false;

  function setGsap(nextGsap: Gsap) {
    gsap = nextGsap;
  }

  function registerAudioCue(id: Id, config: AudioCueConfig) {
    cues.set(id, config);
    return () => {
      stop(id, { duration: 0 });
      cues.delete(id);
    };
  }

  function getCue(id: Id) {
    return cues.get(id);
  }

  function cancelLoop(id: Id) {
    const frame = loopFrames.get(id);
    if (frame) cancelAnimationFrame(frame);
    loopFrames.delete(id);
  }

  function cancelFade(id: Id) {
    fadeTweens.get(id)?.kill();
    fadeTweens.delete(id);
    const frame = fallbackFadeFrames.get(id);
    if (frame) cancelAnimationFrame(frame);
    fallbackFadeFrames.delete(id);
  }

  function watchLoop(id: Id) {
    const config = cues.get(id);
    const audio = config?.el;
    if (!config?.maxTime || !audio || config.maxTime <= (config.startTime ?? 0)) return;

    const tick = () => {
      if (audio.currentTime >= config.maxTime!) {
        audio.currentTime = config.startTime ?? 0;
      }
      loopFrames.set(id, requestAnimationFrame(tick));
    };

    loopFrames.set(id, requestAnimationFrame(tick));
  }

  function fade(id: Id, targetVolume: number, afterFade?: () => void, duration = fadeMotion.duration) {
    const audio = cues.get(id)?.el;
    if (!audio) return;

    cancelFade(id);
    if (duration <= 0) {
      audio.volume = targetVolume;
      afterFade?.();
      return;
    }

    if (!gsap) {
      const initialVolume = audio.volume;
      const startedAt = performance.now();
      const durationMs = duration * 1000;

      const step = (now: number) => {
        const progress = Math.min((now - startedAt) / durationMs, 1);
        audio.volume = initialVolume + (targetVolume - initialVolume) * progress;

        if (progress < 1) {
          fallbackFadeFrames.set(id, requestAnimationFrame(step));
          return;
        }

        audio.volume = targetVolume;
        fallbackFadeFrames.delete(id);
        afterFade?.();
      };

      fallbackFadeFrames.set(id, requestAnimationFrame(step));
      return;
    }

    fadeTweens.set(
      id,
      gsap.to(audio, {
        volume: targetVolume,
        duration,
        ease: fadeMotion.ease,
        overwrite: true,
        onComplete: () => {
          audio.volume = targetVolume;
          fadeTweens.delete(id);
          afterFade?.();
        }
      })
    );
  }

  function getTargetVolume(config: AudioCueConfig) {
    return Math.min(1, config.targetVolume * (config.outputGain ?? 1));
  }

  async function play(id: Id) {
    const config = cues.get(id);
    const audio = config?.el;
    if (!config || !audio) return false;

    const targetVolume = getTargetVolume(config);
    if (!audio.paused && !audio.ended) {
      audio.loop = config.loop ?? false;
      fade(id, targetVolume, undefined, config.fadeInDuration);
      watchLoop(id);
      return true;
    }

    cancelFade(id);
    cancelLoop(id);
    audio.loop = config.loop ?? false;
    audio.pause();
    audio.currentTime = config.startTime ?? 0;
    audio.volume = config.fadeIn === false ? targetVolume : 0;

    try {
      await audio.play();
      watchLoop(id);
      if (config.fadeIn !== false) fade(id, targetVolume, undefined, config.fadeInDuration);
      return true;
    } catch {
      return false;
    }
  }

  function stop(id: Id, options: { duration?: number } = {}) {
    const config = cues.get(id);
    const audio = config?.el;
    if (!config || !audio) return;

    cancelLoop(id);
    fade(
      id,
      0,
      () => {
        audio.pause();
        audio.currentTime = config.startTime ?? 0;
      },
      options.duration ?? fadeMotion.duration
    );
  }

  function stopAll(ids: readonly Id[] = Array.from(cues.keys()), options: { duration?: number } = {}) {
    ids.forEach((id) => stop(id, options));
  }

  async function unlock(ids: readonly Id[] = Array.from(cues.keys())) {
    if (unlocked) return true;

    const entries = ids
      .map((id) => ({ audio: cues.get(id)?.el, config: cues.get(id) }))
      .filter((entry): entry is { audio: HTMLAudioElement; config: AudioCueConfig } => Boolean(entry.audio));
    if (!entries.length) return false;

    try {
      const results = await Promise.allSettled(
        entries.map(async ({ audio, config }) => {
          const previousMuted = audio.muted;
          const previousVolume = audio.volume;
          try {
            audio.muted = true;
            audio.volume = 0;
            await audio.play();
            audio.pause();
            audio.currentTime = config.startTime ?? 0;
          } finally {
            audio.volume = previousVolume;
            audio.muted = previousMuted;
          }
        })
      );
      unlocked = results.some((result) => result.status === 'fulfilled');
      return unlocked;
    } catch {
      unlocked = false;
      return false;
    }
  }

  function destroy() {
    Array.from(cues.keys()).forEach((id) => {
      cancelFade(id);
      cancelLoop(id);
      const audio = cues.get(id)?.el;
      audio?.pause();
    });
    cues.clear();
  }

  return {
    destroy,
    fade,
    getCue,
    play,
    registerAudioCue,
    setGsap,
    stop,
    stopAll,
    unlock
  };
}

export function registerAudioCue<Id extends string>(
  manager: ReturnType<typeof createAudioCueManager<Id>>,
  id: Id,
  config: AudioCueConfig
) {
  return manager.registerAudioCue(id, config);
}
