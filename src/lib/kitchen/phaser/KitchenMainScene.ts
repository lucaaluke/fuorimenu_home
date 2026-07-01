import type Phaser from 'phaser';
import type { SceneAsset, SceneChunk, SceneLayer } from '$lib/scene/scene-asset.types';
import {
  FLOOR_TOP_Y_FIGMA,
  LAYER_BASE_DEPTH,
  LAYER_SPEED,
  SCENE_HEIGHT_FIGMA,
  SCENE_WIDTH_FIGMA,
  TAIL_START_X,
  generateSceneChunks
} from './chunk-config';
import {
  figmaToWorldX,
  figmaToWorldY,
  figmaTopToWorldY,
  tailAwareFigmaX,
  viewportBottomAlignedWorldY
} from './coordinate-utils';

export type PhaserModule = typeof import('phaser');

export type KitchenMainSceneViewport = {
  width: number;
  height: number;
};

export type KitchenMainSceneDependencies = {
  assetVersion: string;
  assets: SceneAsset[];
  chunks?: SceneChunk[];
  floorTopY?: number;
  getViewport: () => KitchenMainSceneViewport;
  layerBaseDepth?: Record<SceneLayer, number>;
  layerSpeed?: Record<SceneLayer, number>;
  onLoadingProgress?: (progress: number) => void;
  onReady?: () => void;
  pixelRatio?: number;
  sceneHeight?: number;
  sceneWidth?: number;
  tailStartX?: number;
};

export type KitchenMainSceneApi = {
  resize: (width: number, height: number, pixelRatio?: number) => void;
  setCameraX: (cameraX: number) => void;
};

type ChunkSprite = {
  chunk: SceneChunk;
  sprite: Phaser.GameObjects.Sprite;
};

type AssetSprite = {
  asset: SceneAsset;
  sprite: Phaser.GameObjects.Sprite;
};

const chunkPathPrefix = {
  background: 'bg',
  middle: 'mid',
  foreground: 'fg'
} as const satisfies Partial<Record<SceneLayer, string>>;

function resolveAssetPath(src: string, version: string) {
  const normalized = src.startsWith('/') ? src : `/assets/${src}`;
  const separator = normalized.includes('?') ? '&' : '?';

  return `${normalized}${separator}v=${version}`;
}

function resolveChunkPath(chunk: SceneChunk, version: string) {
  const prefix = chunkPathPrefix[chunk.layer as keyof typeof chunkPathPrefix];

  return `/assets/kitchen/${prefix}/frame-${chunk.frameIndex.toString().padStart(2, '0')}.png?v=${version}`;
}

function isPhaserObjectAsset(asset: SceneAsset) {
  if (asset.interactive || asset.kind === 'interactive') return false;
  if (asset.id.startsWith('layer-')) return false;

  return asset.src.startsWith('kitchen/objects/') || asset.src.startsWith('/assets/kitchen/objects/');
}

export function createKitchenMainSceneClass(Phaser: PhaserModule, dependencies: KitchenMainSceneDependencies) {
  return class KitchenMainScene extends Phaser.Scene {
    private assetSprites: AssetSprite[] = [];
    private cameraX = 0;
    private chunkSprites: ChunkSprite[] = [];
    private chunks: SceneChunk[] = dependencies.chunks ?? [];
    private pixelRatio = dependencies.pixelRatio ?? 1;
    private sceneScale = 1;
    private viewport: KitchenMainSceneViewport = dependencies.getViewport();

    constructor() {
      super({ key: 'KitchenMain' });
    }

    preload() {
      this.viewport = dependencies.getViewport();
      this.sceneScale = this.getSceneScale();
      this.chunks = dependencies.chunks ?? this.generateChunksForViewport();

      this.load.on('progress', (progress: number) => {
        dependencies.onLoadingProgress?.(progress);
      });

      for (const chunk of this.chunks) {
        this.load.image(chunk.assetKey, resolveChunkPath(chunk, dependencies.assetVersion));
      }

      for (const asset of dependencies.assets) {
        if (!isPhaserObjectAsset(asset)) continue;
        this.loadSceneAsset(asset);
      }
    }

    create() {
      this.cameras.main.setRoundPixels(true);
      this.cameras.main.setScroll(0, 0);
      this.cameras.main.setZoom(this.pixelRatio);

      this.chunkSprites = this.chunks.map((chunk) => {
        this.setTextureSmoothing(chunk.assetKey);
        const sprite = this.add.sprite(0, 0, chunk.assetKey);
        sprite.setOrigin(0, 0);
        sprite.setScrollFactor(this.getLayerSpeed(chunk.layer), 0);
        sprite.setDepth(this.getLayerDepth(chunk.layer));

        return { chunk, sprite };
      });

      this.assetSprites = dependencies.assets.flatMap((asset): AssetSprite[] => {
        if (!isPhaserObjectAsset(asset)) return [];

        const assetKey = this.getAssetKey(asset);
        this.setTextureSmoothing(assetKey);
        const sprite = this.add.sprite(0, 0, assetKey);
        sprite.setOrigin(0, 0);
        sprite.setScrollFactor(this.getLayerSpeed(asset.layer), 0);
        sprite.setDepth(this.getLayerDepth(asset.layer) + (asset.zOffset ?? 0));

        return [{ asset, sprite }];
      });

      this.resize(this.viewport.width, this.viewport.height);
      dependencies.onReady?.();
    }

    update() {
      this.cameras.main.scrollX = Math.round(this.cameraX);
      this.updateChunkVisibility();
    }

    setCameraX(cameraX: number) {
      this.cameraX = cameraX;
      this.cameras.main.scrollX = Math.round(cameraX);
      this.updateChunkVisibility();
    }

    resize(width: number, height: number, pixelRatio = this.pixelRatio) {
      this.viewport = { width, height };
      this.pixelRatio = Math.max(1, pixelRatio);
      this.sceneScale = this.getSceneScale();
      this.scale.resize(Math.round(width * this.pixelRatio), Math.round(height * this.pixelRatio));
      this.cameras.main.setSize(Math.round(width * this.pixelRatio), Math.round(height * this.pixelRatio));
      this.cameras.main.setZoom(this.pixelRatio);

      for (const { chunk, sprite } of this.chunkSprites) {
        const chunkHeight = chunk.figmaHeight ?? (dependencies.sceneHeight ?? SCENE_HEIGHT_FIGMA);
        sprite.setPosition(
          figmaToWorldX(chunk.figmaX, this.sceneScale),
          figmaTopToWorldY(chunk.figmaY ?? 0, this.sceneScale)
        );
        sprite.setDisplaySize(Math.round(chunk.figmaWidth * this.sceneScale), Math.round(chunkHeight * this.sceneScale));
      }

      for (const { asset, sprite } of this.assetSprites) {
        const figmaX = tailAwareFigmaX(asset.x, asset.isTail, dependencies.tailStartX ?? TAIL_START_X);
        const displayWidth = Math.round(asset.width * this.sceneScale);
        const displayHeight = Math.round(asset.height * this.sceneScale);
        const overlapX = asset.overlapX === undefined ? 0 : Math.ceil(asset.overlapX * this.sceneScale);
        const worldY =
          asset.viewportBottomAligned === true
            ? viewportBottomAlignedWorldY(asset.height, this.sceneScale, height)
            : asset.viewportTopAligned === true
              ? figmaTopToWorldY(asset.y, this.sceneScale)
            : figmaToWorldY(asset.y, this.sceneScale, height, dependencies.floorTopY ?? FLOOR_TOP_Y_FIGMA);

        sprite.setPosition(
          figmaToWorldX(figmaX, this.sceneScale),
          worldY
        );
        sprite.setDisplaySize(displayWidth + overlapX, displayHeight);
      }

      this.updateChunkVisibility();
    }

    private generateChunksForViewport() {
      return generateSceneChunks({
        sceneHeight: dependencies.sceneHeight ?? SCENE_HEIGHT_FIGMA,
        sceneWidth: dependencies.sceneWidth ?? SCENE_WIDTH_FIGMA,
        viewportHeight: this.viewport.height,
        viewportWidth: this.viewport.width
      });
    }

    private getAssetKey(asset: SceneAsset) {
      return `obj-${asset.id}`;
    }

    private setTextureSmoothing(key: string) {
      const texture = this.textures.get(key);
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    private loadSceneAsset(asset: SceneAsset) {
      const key = this.getAssetKey(asset);
      const path = resolveAssetPath(asset.src, dependencies.assetVersion);

      if (asset.src.toLowerCase().endsWith('.svg')) {
        this.load.svg(key, path, {
          width: Math.max(1, Math.round(asset.width * this.sceneScale)),
          height: Math.max(1, Math.round(asset.height * this.sceneScale))
        });
        return;
      }

      this.load.image(key, path);
    }

    private getLayerDepth(layer: SceneLayer) {
      return (dependencies.layerBaseDepth ?? LAYER_BASE_DEPTH)[layer] ?? 0;
    }

    private getLayerSpeed(layer: SceneLayer) {
      return (dependencies.layerSpeed ?? LAYER_SPEED)[layer] ?? 1;
    }

    private getSceneScale() {
      return this.viewport.height / (dependencies.sceneHeight ?? SCENE_HEIGHT_FIGMA);
    }

    private updateChunkVisibility() {
      for (const { chunk, sprite } of this.chunkSprites) {
        const width = Math.round(chunk.figmaWidth * this.sceneScale);
        const screenX = sprite.x - this.cameraX * this.getLayerSpeed(chunk.layer);

        sprite.visible = screenX > -width && screenX < this.viewport.width + width;
      }
    }
  };
}
