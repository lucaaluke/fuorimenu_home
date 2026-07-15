export const TOUCH_SCROLL_INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, video';
export const TOUCH_SCROLL_DEAD_ZONE = 3;
export const TOUCH_SCROLL_FACTOR = 1.54;
export const DRAG_SCROLL_FACTOR = 1.54;
export const SCENE_REVEAL_DELAY_MS = 560;
export const SECTION_AUDIO_FADE_OUT_MS = 460;
export const KITCHEN_RETURN_CAMERA_STORAGE_KEY = 'kitchen-return-camera-x';

export const SCENE_CAMERA_EASING = {
  frameDuration: 16.667,
  idleAmount: 0.14,
  dragAmount: 0.28,
  maxFrameScale: 2.4,
  snapDistance: 0.08
} as const;
