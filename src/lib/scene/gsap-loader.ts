import type gsapDefault from 'gsap';
import type ScrollTriggerDefault from 'gsap/ScrollTrigger';

export type Gsap = typeof gsapDefault;
export type ScrollTriggerPlugin = typeof ScrollTriggerDefault;

export async function loadGsap(): Promise<Gsap> {
  const module = await import('gsap');
  return (module.gsap ?? module.default) as Gsap;
}

export async function loadGsapWithScrollTrigger() {
  const [gsap, scrollTriggerModule] = await Promise.all([
    loadGsap(),
    import('gsap/ScrollTrigger')
  ]);
  const ScrollTrigger = (scrollTriggerModule.ScrollTrigger ?? scrollTriggerModule.default) as ScrollTriggerPlugin;

  gsap.registerPlugin(ScrollTrigger);

  return { gsap, ScrollTrigger };
}
