import { browser } from '$app/environment';
import type { SceneAsset, SceneChunk, SceneLayer } from '$lib/scene/scene-asset.types';
import {
  createParallaxMainSceneClass,
  type ParallaxMainSceneApi,
  type ParallaxSceneViewport
} from './ParallaxMainScene';
import { getDevicePixelRatio, setCanvasCssSize } from './game-utils';

export type ParallaxPhaserGameOptions = {
  assetVersion: string;
  assets: SceneAsset[];
  chunks: SceneChunk[];
  chunkOffsetY?: number;
  chunkViewportOffsetY?: number;
  container: HTMLElement;
  floorDepth?: number;
  getChunkPath: (chunk: SceneChunk) => string;
  getViewport: () => ParallaxSceneViewport;
  isAudioMuted?: () => boolean;
  layerBaseDepth?: Record<string, number>;
  layerSpeed?: Record<string, number>;
  onLoadingProgress?: (progress: number) => void;
  onReady?: () => void;
  sceneHeight: number;
  sceneWidth: number;
  viewportOffsetYByLayer?: Partial<Record<SceneLayer, number>>;
};

export type ParallaxPhaserGameHandle = {
  destroy: () => void;
  resize: (width: number, height: number) => void;
  setAudioMuted: (isMuted: boolean) => void;
  setCameraX: (cameraX: number) => void;
  setHoveredAssetId: (assetId?: string) => void;
};

export async function createParallaxPhaserGame(
  options: ParallaxPhaserGameOptions
): Promise<ParallaxPhaserGameHandle | undefined> {
  if (!browser) return undefined;

  const Phaser = await import('phaser');
  const viewport = options.getViewport();
  const initialPixelRatio = getDevicePixelRatio();
  let game: Phaser.Game | undefined;
  let sceneApi: ParallaxMainSceneApi | undefined;
  let latestAudioMuted = options.isAudioMuted?.() ?? false;
  let latestCameraX = 0;

  const ParallaxMainScene = createParallaxMainSceneClass(Phaser, {
    assetVersion: options.assetVersion,
    assets: options.assets,
    chunks: options.chunks,
    chunkOffsetY: options.chunkOffsetY,
    chunkViewportOffsetY: options.chunkViewportOffsetY,
    floorDepth: options.floorDepth,
    getChunkPath: options.getChunkPath,
    getViewport: options.getViewport,
    isAudioMuted: () => latestAudioMuted,
    layerBaseDepth: options.layerBaseDepth,
    layerSpeed: options.layerSpeed,
    onLoadingProgress: options.onLoadingProgress,
    onReady: () => {
      sceneApi = game?.scene.getScene('ParallaxMain') as ParallaxMainSceneApi | undefined;
      sceneApi?.setCameraX(latestCameraX);
      sceneApi?.setAudioMuted(latestAudioMuted);
      setCanvasCssSize(game, viewport.width, viewport.height);
      options.onReady?.();
    },
    pixelRatio: initialPixelRatio,
    sceneHeight: options.sceneHeight,
    sceneWidth: options.sceneWidth,
    viewportOffsetYByLayer: options.viewportOffsetYByLayer
  });

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent: options.container,
    width: Math.round(viewport.width * initialPixelRatio),
    height: Math.round(viewport.height * initialPixelRatio),
    transparent: true,
    canvasStyle: `position: absolute; top: 0; left: 0; display: block; width: ${viewport.width}px; height: ${viewport.height}px;`,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: Math.round(viewport.width * initialPixelRatio),
      height: Math.round(viewport.height * initialPixelRatio)
    },
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: true
    },
    scene: [ParallaxMainScene]
  };

  game = new Phaser.Game(config);
  setCanvasCssSize(game, viewport.width, viewport.height);

  return {
    destroy() {
      game?.destroy(true);
      game = undefined;
      sceneApi = undefined;
    },
    resize(width: number, height: number) {
      const pixelRatio = getDevicePixelRatio();
      game?.scale.resize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
      setCanvasCssSize(game, width, height);
      sceneApi?.resize(width, height, pixelRatio);
      setCanvasCssSize(game, width, height);
    },
    setAudioMuted(isMuted: boolean) {
      latestAudioMuted = isMuted;
      sceneApi?.setAudioMuted(isMuted);
    },
    setCameraX(cameraX: number) {
      latestCameraX = cameraX;
      sceneApi?.setCameraX(cameraX);
    },
    setHoveredAssetId(assetId?: string) {
      sceneApi?.setHoveredAssetId(assetId);
    }
  };
}
