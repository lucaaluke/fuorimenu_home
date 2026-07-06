import { browser } from '$app/environment';
import type { SceneAsset, SceneChunk, SceneLayer } from '$lib/scene/scene-asset.types';
import {
  createParallaxMainSceneClass,
  type ParallaxMainSceneApi,
  type ParallaxSceneViewport
} from './ParallaxMainScene';

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
  setCameraX: (cameraX: number) => void;
};

function getPixelRatio() {
  return Math.max(1, window.devicePixelRatio ?? 1);
}

function setCanvasCssSize(game: Phaser.Game | undefined, width: number, height: number) {
  const canvas = game?.canvas;
  if (!canvas) return;

  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.display = 'block';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

export async function createParallaxPhaserGame(
  options: ParallaxPhaserGameOptions
): Promise<ParallaxPhaserGameHandle | undefined> {
  if (!browser) return undefined;

  const Phaser = await import('phaser');
  const viewport = options.getViewport();
  const initialPixelRatio = getPixelRatio();
  let game: Phaser.Game | undefined;
  let sceneApi: ParallaxMainSceneApi | undefined;
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
    layerBaseDepth: options.layerBaseDepth,
    layerSpeed: options.layerSpeed,
    onLoadingProgress: options.onLoadingProgress,
    onReady: () => {
      sceneApi = game?.scene.getScene('ParallaxMain') as ParallaxMainSceneApi | undefined;
      sceneApi?.setCameraX(latestCameraX);
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
      const pixelRatio = getPixelRatio();
      game?.scale.resize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
      setCanvasCssSize(game, width, height);
      sceneApi?.resize(width, height, pixelRatio);
      setCanvasCssSize(game, width, height);
    },
    setCameraX(cameraX: number) {
      latestCameraX = cameraX;
      sceneApi?.setCameraX(cameraX);
    }
  };
}
