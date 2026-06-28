import { browser } from '$app/environment';
import type { SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';
import {
  createKitchenMainSceneClass,
  type KitchenMainSceneApi,
  type KitchenMainSceneViewport
} from './KitchenMainScene';

export type KitchenPhaserGameOptions = {
  assetVersion: string;
  assets: SceneAsset[];
  chunks?: SceneChunk[];
  container: HTMLElement;
  floorTopY?: number;
  getViewport: () => KitchenMainSceneViewport;
  onLoadingProgress?: (progress: number) => void;
  onReady?: () => void;
  sceneHeight?: number;
};

export type KitchenPhaserGameHandle = {
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

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

export async function createKitchenPhaserGame(
  options: KitchenPhaserGameOptions
): Promise<KitchenPhaserGameHandle | undefined> {
  if (!browser) return undefined;

  const Phaser = await import('phaser');
  const viewport = options.getViewport();
  const initialPixelRatio = getPixelRatio();
  let sceneApi: KitchenMainSceneApi | undefined;
  let latestCameraX = 0;
  let game: Phaser.Game | undefined;

  const KitchenMainScene = createKitchenMainSceneClass(Phaser, {
    assetVersion: options.assetVersion,
    assets: options.assets,
    chunks: options.chunks,
    floorTopY: options.floorTopY,
    getViewport: options.getViewport,
    onLoadingProgress: options.onLoadingProgress,
    onReady: () => {
      sceneApi = game?.scene.getScene('KitchenMain') as KitchenMainSceneApi | undefined;
      sceneApi?.setCameraX(latestCameraX);
      setCanvasCssSize(game, viewport.width, viewport.height);
      options.onReady?.();
    },
    pixelRatio: initialPixelRatio,
    sceneHeight: options.sceneHeight
  });

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent: options.container,
    width: Math.round(viewport.width * initialPixelRatio),
    height: Math.round(viewport.height * initialPixelRatio),
    transparent: true,
    canvasStyle: `width: ${viewport.width}px; height: ${viewport.height}px;`,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER
    },
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: true
    },
    scene: [KitchenMainScene]
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
