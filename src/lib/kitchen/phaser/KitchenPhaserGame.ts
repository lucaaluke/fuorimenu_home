import { browser } from '$app/environment';
import type { SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';
import {
  createKitchenMainSceneClass,
  type KitchenMainSceneApi,
  type KitchenMainSceneViewport
} from './KitchenMainScene';
import { getDevicePixelRatio, setCanvasCssSize } from '$lib/scene/phaser/game-utils';

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
  setObjectHoverSuppressed: (isSuppressed: boolean) => void;
};

export async function createKitchenPhaserGame(
  options: KitchenPhaserGameOptions
): Promise<KitchenPhaserGameHandle | undefined> {
  if (!browser) return undefined;

  const Phaser = await import('phaser');
  const viewport = options.getViewport();
  const initialPixelRatio = getDevicePixelRatio();
  let sceneApi: KitchenMainSceneApi | undefined;
  let latestCameraX = 0;
  let isObjectHoverSuppressed = false;
  let game: Phaser.Game | undefined;

  const KitchenMainScene = createKitchenMainSceneClass(Phaser, {
    assetVersion: options.assetVersion,
    assets: options.assets,
    chunks: options.chunks,
    floorTopY: options.floorTopY,
    getViewport: options.getViewport,
    isObjectHoverSuppressed: () => isObjectHoverSuppressed,
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
      const pixelRatio = getDevicePixelRatio();
      game?.scale.resize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
      setCanvasCssSize(game, width, height);
      sceneApi?.resize(width, height, pixelRatio);
      setCanvasCssSize(game, width, height);
    },
    setCameraX(cameraX: number) {
      latestCameraX = cameraX;
      sceneApi?.setCameraX(cameraX);
    },
    setObjectHoverSuppressed(isSuppressed: boolean) {
      isObjectHoverSuppressed = isSuppressed;
    }
  };
}
