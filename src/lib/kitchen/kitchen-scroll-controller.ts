import {
  kitchenSceneConfig,
  type KitchenChefId,
  type KitchenSceneConfig
} from '$lib/kitchen/kitchen-scene.config';
import { setupSceneBridge, type SceneBridge } from '$lib/scene/bridge';
import { loadGsapWithScrollTrigger } from '$lib/scene/gsap-loader';
import { clamp } from '$lib/scene/math';
import { createTriggerRegistry } from '$lib/scene/triggers';
import {
  getHorizontalSceneMetrics,
  getVisibleRatio,
  type HorizontalSceneMetrics,
  type Viewport
} from '$lib/scene/viewport';

export type KitchenControllerState = {
  cameraX: number;
  targetCameraX: number;
  progress: number;
  activeChefId: KitchenChefId | undefined;
};

export type KitchenControllerEvents = {
  'chef:enter': { id: KitchenChefId };
  'chef:exit': { id: KitchenChefId };
};

export type KitchenControllerBridge = SceneBridge<KitchenControllerState, KitchenControllerEvents>;

type KitchenScrollControllerOptions = {
  applyScrollResistance?: (nextValue: number, baseValue: number) => number;
  bridge?: KitchenControllerBridge;
  config?: KitchenSceneConfig;
  getViewport: () => Viewport;
  isScrollEnabled?: () => boolean;
  onUpdate?: (state: KitchenControllerState) => void;
  stageEl: HTMLElement;
};

type KitchenTriggerContext = {
  cameraX: number;
  config: KitchenSceneConfig;
  metrics: HorizontalSceneMetrics;
};

const easing = {
  frameDuration: 16.667,
  idle: 0.14,
  maxFrameScale: 2.4,
  snapDistance: 0.08
};

export const initialKitchenControllerState: KitchenControllerState = {
  cameraX: 0,
  targetCameraX: 0,
  progress: 0,
  activeChefId: undefined
};

export async function mountKitchenScrollController(options: KitchenScrollControllerOptions) {
  const { gsap, ScrollTrigger } = await loadGsapWithScrollTrigger();
  const bridge =
    options.bridge ??
    setupSceneBridge<KitchenControllerState, KitchenControllerEvents>(
      initialKitchenControllerState
  );
  const config = options.config ?? kitchenSceneConfig;
  const isScrollEnabled = options.isScrollEnabled ?? (() => true);
  const triggers = createTriggerRegistry<KitchenTriggerContext>();
  const onUpdate = options.onUpdate ?? (() => {});
  let activeChefId: KitchenChefId | undefined;
  let cameraX = 0;
  let targetCameraX = 0;
  let dragStartPosition = 0;
  let dragScrollStart = 0;
  let dragging = false;
  let isSettingScrollFromController = false;
  let killed = false;
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = reducedMotionQuery.matches;

  const syncReducedMotion = () => {
    prefersReducedMotion = reducedMotionQuery.matches;
  };

  reducedMotionQuery.addEventListener('change', syncReducedMotion);

  function getMetrics() {
    return getHorizontalSceneMetrics(options.getViewport(), config.sceneWidth, config.sceneHeight);
  }

  function getProgress(metrics = getMetrics()) {
    return metrics.maxScrollX > 0 ? clamp(cameraX / metrics.maxScrollX, 0, 1) : 0;
  }

  function applyScrollResistance(value: number, baseValue = targetCameraX) {
    return options.applyScrollResistance?.(value, baseValue) ?? value;
  }

  function setTargetCameraX(value: number) {
    targetCameraX = clamp(applyScrollResistance(value), 0, getMetrics().maxScrollX);
  }

  function getScrollForCameraXFromBounds(value: number, start: number, end: number, metrics = getMetrics()) {
    const progress = metrics.maxScrollX > 0 ? clamp(value / metrics.maxScrollX, 0, 1) : 0;
    return start + (end - start) * progress;
  }

  function getScrollForCameraX(value: number) {
    return getScrollForCameraXFromBounds(value, scrollTrigger.start, scrollTrigger.end);
  }

  function setScrollFromController(value: number, targetScrollTrigger = scrollTrigger) {
    isSettingScrollFromController = true;
    targetScrollTrigger.scroll(value);
    requestAnimationFrame(() => {
      isSettingScrollFromController = false;
    });
  }

  function scrollToCameraX(value: number) {
    if (!isScrollEnabled()) {
      cameraX = 0;
      targetCameraX = 0;
      setScrollFromController(scrollTrigger.start);
      return;
    }

    setTargetCameraX(value);
    setScrollFromController(getScrollForCameraX(targetCameraX));
  }

  function evaluateScene(delta: number, now: number) {
    const metrics = getMetrics();
    if (!isScrollEnabled()) {
      cameraX = 0;
      targetCameraX = 0;
      activeChefId = undefined;
      const state: KitchenControllerState = {
        activeChefId,
        cameraX,
        progress: 0,
        targetCameraX
      };

      bridge.updateState(state);
      onUpdate(state);
      return;
    }

    if (targetCameraX > cameraX) {
      targetCameraX = clamp(applyScrollResistance(targetCameraX, cameraX), 0, metrics.maxScrollX);
    }

    if (prefersReducedMotion) {
      cameraX = targetCameraX;
    } else {
      const distance = targetCameraX - cameraX;
      const frameScale = Math.min(delta / easing.frameDuration, easing.maxFrameScale);
      const stepAmount = 1 - Math.pow(1 - easing.idle, frameScale);

      if (Math.abs(distance) < easing.snapDistance) {
        cameraX = targetCameraX;
      } else {
        cameraX += distance * stepAmount;
      }
    }

    cameraX = clamp(cameraX, 0, metrics.maxScrollX);
    targetCameraX = clamp(targetCameraX, 0, metrics.maxScrollX);
    triggers.evaluate({ cameraX, config, metrics });

    const state: KitchenControllerState = {
      activeChefId,
      cameraX,
      progress: getProgress(metrics),
      targetCameraX
    };

    bridge.updateState(state);
    onUpdate(state);
  }

  function registerSceneTriggers() {
    triggers.registerTrigger({
      id: `${config.chef.id}:visible`,
      mode: 'repeat',
      isActive: ({ cameraX: currentCameraX, config: currentConfig, metrics }) =>
        getVisibleRatio({
          cameraX: currentCameraX,
          layerSpeed: currentConfig.layerSpeed.chef,
          objectX: currentConfig.chef.x,
          objectWidth: currentConfig.chef.width,
          sceneScale: metrics.sceneScale,
          viewWidth: metrics.viewWidth
        }) > currentConfig.chef.visibleThreshold,
      onEnter: ({ config: currentConfig }) => {
        activeChefId = currentConfig.chef.id;
        bridge.emit('chef:enter', { id: currentConfig.chef.id });
      },
      onExit: ({ config: currentConfig }) => {
        if (activeChefId === currentConfig.chef.id) activeChefId = undefined;
        bridge.emit('chef:exit', { id: currentConfig.chef.id });
      }
    });
  }

  registerSceneTriggers();

  const scrollTrigger = ScrollTrigger.create({
    anticipatePin: 1,
    end: () => `+=${Math.max(getMetrics().maxScrollX, window.innerHeight * 0.85, 1)}`,
    id: 'kitchen-horizontal-scroll',
    invalidateOnRefresh: true,
    onRefresh: (self) => {
      if (!isScrollEnabled()) {
        cameraX = 0;
        targetCameraX = 0;
        activeChefId = undefined;
        if (self.scroll() !== self.start) self.scroll(self.start);
        return;
      }
      const metrics = getMetrics();
      const preservedCameraX = clamp(targetCameraX || cameraX, 0, metrics.maxScrollX);
      cameraX = preservedCameraX;
      targetCameraX = preservedCameraX;
      const preservedScroll = getScrollForCameraXFromBounds(preservedCameraX, self.start, self.end, metrics);
      if (Math.abs(self.scroll() - preservedScroll) > 0.5) setScrollFromController(preservedScroll, self);
    },
    onUpdate: (self) => {
      if (!isScrollEnabled()) {
        cameraX = 0;
        targetCameraX = 0;
        activeChefId = undefined;
        if (self.scroll() !== self.start) setScrollFromController(self.start, self);
        return;
      }
      if (isSettingScrollFromController) return;

      const preservedScroll = getScrollForCameraXFromBounds(targetCameraX || cameraX, self.start, self.end);
      if (Math.abs(self.scroll() - preservedScroll) > 0.5) setScrollFromController(preservedScroll, self);
    },
    pin: options.stageEl,
    scrub: true,
    start: 'top top',
    trigger: options.stageEl
  });

  const tick = (_time: number, delta: number) => {
    if (killed) return;
    evaluateScene(delta, performance.now());
  };

  gsap.ticker.add(tick);
  ScrollTrigger.refresh();

  return {
    beginDrag(clientPosition: number) {
      if (!isScrollEnabled()) return;
      dragging = true;
      dragStartPosition = clientPosition;
      dragScrollStart = scrollTrigger.scroll();
    },
    bridge,
    destroy() {
      killed = true;
      reducedMotionQuery.removeEventListener('change', syncReducedMotion);
      gsap.ticker.remove(tick);
      triggers.clear();
      scrollTrigger.kill();
    },
    dragTo(clientPosition: number) {
      if (!dragging || !isScrollEnabled()) return;
      setScrollFromController(dragScrollStart + (dragStartPosition - clientPosition) * 1.54);
    },
    endDrag() {
      dragging = false;
    },
    resize() {
      const metrics = getMetrics();
      const preservedCameraX = clamp(targetCameraX || cameraX, 0, metrics.maxScrollX);
      cameraX = preservedCameraX;
      targetCameraX = preservedCameraX;
      ScrollTrigger.refresh();
      cameraX = clamp(preservedCameraX, 0, getMetrics().maxScrollX);
      targetCameraX = cameraX;
      setScrollFromController(getScrollForCameraX(targetCameraX));
    },
    scrollTo(cameraX: number) {
      scrollToCameraX(cameraX);
    },
    scrollBy(delta: number) {
      if (!isScrollEnabled()) return;
      scrollToCameraX(targetCameraX + delta);
    }
  };
}
