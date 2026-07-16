import type Phaser from 'phaser';
import { resolveVersionedAssetPath } from '$lib/scene/asset-paths';
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
  tailAwareFigmaX,
  viewportBottomAlignedWorldY
} from './coordinate-utils';
import { startKitchenSceneAnimations } from './KitchenAnimationData';

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
  isObjectHoverSuppressed?: () => boolean;
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

const BACKGROUND_TILE_SCROLL_FACTOR = 1;
const FLOOR_SCROLL_FACTOR = 1;
const MIDDLEGROUND_OBJECT_SCROLL_FACTOR = 1.25;
const FOREGROUND_OBJECT_SCROLL_FACTOR = 1.5;

function resolveChunkPath(chunk: SceneChunk, version: string) {
  const prefix = chunkPathPrefix[chunk.layer as keyof typeof chunkPathPrefix];

  return resolveVersionedAssetPath(
    `kitchen/${prefix}/frame-${chunk.frameIndex.toString().padStart(2, '0')}.png`,
    version
  );
}

function isPhaserObjectAsset(asset: SceneAsset) {
  if (asset.interactive || asset.kind === 'interactive') return false;
  if (asset.id.startsWith('layer-')) return false;
  if (asset.id === 'easteregg') return true;

  return asset.src.startsWith('kitchen/objects/') || asset.src.startsWith('/assets/kitchen/objects/');
}

function isFloorAsset(asset: SceneAsset) {
  return asset.id.startsWith('pavimento-') || asset.src.endsWith('/pavimento.png') || asset.src.endsWith('pavimento.png');
}

function isMiddlegroundObjectAsset(asset: SceneAsset) {
  return asset.id.startsWith('2-');
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

      const loadedChunkKeys = new Set<string>();
      for (const chunk of this.chunks) {
        if (loadedChunkKeys.has(chunk.assetKey)) continue;
        loadedChunkKeys.add(chunk.assetKey);
        this.load.image(chunk.assetKey, resolveChunkPath(chunk, dependencies.assetVersion));
      }

      for (const asset of dependencies.assets) {
        if (!isPhaserObjectAsset(asset)) continue;
        this.loadSceneAsset(asset);
      }
    }

    create() {
      const camera = this.cameras.main;
      const renderWidth = this.getRenderWidth();
      const renderHeight = this.getRenderHeight();

      camera.setRoundPixels(true);
      camera.setPosition(0, 0);
      camera.setSize(renderWidth, renderHeight);
      camera.setViewport(0, 0, renderWidth, renderHeight);
      camera.setScroll(0, 0);
      camera.setZoom(1);
      camera.scrollY = 0;

      this.chunkSprites = this.chunks.map((chunk) => {
        this.setTextureSmoothing(chunk.assetKey);
        const sprite = this.add.sprite(0, 0, chunk.assetKey);
        sprite.setOrigin(0, 0);
        sprite.setScrollFactor(this.getChunkScrollFactor(), 0);
        sprite.setDepth(this.getLayerDepth(chunk.layer));

        return { chunk, sprite };
      });

      this.assetSprites = dependencies.assets.flatMap((asset): AssetSprite[] => {
        if (!isPhaserObjectAsset(asset)) return [];

        const assetKey = this.getAssetKey(asset);
        this.setTextureSmoothing(assetKey);
        const sprite = this.add.sprite(0, 0, assetKey);
        sprite.setOrigin(0, 0);
        sprite.setScrollFactor(this.getAssetScrollFactor(asset), 0);
        sprite.setDepth(this.getLayerDepth(asset.layer) + (asset.zOffset ?? 0));

        return [{ asset, sprite }];
      });
      startKitchenSceneAnimations(
        this,
        this.assetSprites,
        () => this.sceneScale,
        () => dependencies.isObjectHoverSuppressed?.() ?? false
      );

      this.resize(this.viewport.width, this.viewport.height);
      dependencies.onReady?.();
    }

    update() {
      this.cameras.main.scrollX = this.getRenderCameraX();
      this.cameras.main.scrollY = 0;
      this.updateChunkVisibility();
    }

    setCameraX(cameraX: number) {
      this.cameraX = cameraX;
      this.cameras.main.scrollX = this.getRenderCameraX();
      this.cameras.main.scrollY = 0;
      this.updateChunkVisibility();
    }

    resize(width: number, height: number, pixelRatio = this.pixelRatio) {
      this.viewport = { width, height };
      this.pixelRatio = Math.max(1, pixelRatio);
      this.sceneScale = this.getSceneScale();
      const renderWidth = this.getRenderWidth();
      const renderHeight = this.getRenderHeight();

      this.scale.resize(renderWidth, renderHeight);
      this.cameras.main.setPosition(0, 0);
      this.cameras.main.setSize(renderWidth, renderHeight);
      this.cameras.main.setViewport(0, 0, renderWidth, renderHeight);
      this.cameras.main.setZoom(1);
      this.cameras.main.scrollX = this.getRenderCameraX();
      this.cameras.main.scrollY = 0;

      for (const { chunk, sprite } of this.chunkSprites) {
        const chunkHeight = chunk.figmaHeight ?? (dependencies.sceneHeight ?? SCENE_HEIGHT_FIGMA);
        sprite.setPosition(
          figmaToWorldX(chunk.figmaX, this.sceneScale),
          viewportBottomAlignedWorldY(chunkHeight, this.sceneScale, renderHeight)
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
            ? viewportBottomAlignedWorldY(asset.height, this.sceneScale, renderHeight)
            : figmaToWorldY(asset.y, this.sceneScale, renderHeight, dependencies.floorTopY ?? FLOOR_TOP_Y_FIGMA);

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
      const path = resolveVersionedAssetPath(asset.src, dependencies.assetVersion);

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

    private getChunkScrollFactor() {
      return BACKGROUND_TILE_SCROLL_FACTOR;
    }

    private getAssetScrollFactor(asset: SceneAsset) {
      if (isFloorAsset(asset)) return FLOOR_SCROLL_FACTOR;
      if (isMiddlegroundObjectAsset(asset)) return MIDDLEGROUND_OBJECT_SCROLL_FACTOR;
      if (asset.layer === 'foreground') return FOREGROUND_OBJECT_SCROLL_FACTOR;

      return this.getLayerSpeed(asset.layer);
    }

    private getSceneScale() {
      return this.getRenderHeight() / (dependencies.sceneHeight ?? SCENE_HEIGHT_FIGMA);
    }

    private getRenderCameraX() {
      return Math.round(this.cameraX * this.pixelRatio);
    }

    private getRenderWidth() {
      return Math.round(this.viewport.width * this.pixelRatio);
    }

    private getRenderHeight() {
      return Math.round(this.viewport.height * this.pixelRatio);
    }

    private updateChunkVisibility() {
      for (const { chunk, sprite } of this.chunkSprites) {
        const width = Math.round(chunk.figmaWidth * this.sceneScale);
        const screenX = sprite.x - this.getRenderCameraX() * this.getChunkScrollFactor();

        sprite.visible = screenX > -width && screenX < this.getRenderWidth() + width;
      }
    }
  };
}
