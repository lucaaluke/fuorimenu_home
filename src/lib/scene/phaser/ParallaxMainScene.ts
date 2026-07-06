import type Phaser from 'phaser';
import type { SceneAsset, SceneChunk, SceneLayer } from '$lib/scene/scene-asset.types';

export type PhaserModule = typeof import('phaser');

export type ParallaxSceneViewport = {
  width: number;
  height: number;
};

export type ParallaxMainSceneDependencies = {
  assetVersion: string;
  assets: SceneAsset[];
  chunks: SceneChunk[];
  chunkOffsetY?: number;
  chunkViewportOffsetY?: number;
  floorDepth?: number;
  getChunkPath: (chunk: SceneChunk) => string;
  getViewport: () => ParallaxSceneViewport;
  layerBaseDepth?: Record<string, number>;
  layerSpeed?: Record<string, number>;
  onLoadingProgress?: (progress: number) => void;
  onReady?: () => void;
  pixelRatio?: number;
  sceneHeight: number;
  sceneWidth: number;
  viewportOffsetYByLayer?: Partial<Record<SceneLayer, number>>;
};

export type ParallaxMainSceneApi = {
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

const defaultLayerBaseDepth = {
  background: 100,
  middle: 300,
  title: 400,
  chef: 400,
  foreground: 600
} satisfies Record<SceneLayer, number>;

function resolveVersionedPath(src: string, version: string) {
  const normalized = src.startsWith('/') ? src : `/assets/${src}`;
  const separator = normalized.includes('?') ? '&' : '?';

  return `${normalized}${separator}v=${version}`;
}

function isRenderableAsset(asset: SceneAsset) {
  if (asset.interactive || asset.kind === 'interactive') return false;
  if (asset.id.startsWith('layer-')) return false;

  return true;
}

function isFloorAsset(asset: SceneAsset) {
  return asset.id.includes('floor') || asset.src.endsWith('/pavimento.png') || asset.src.endsWith('pavimento.png');
}

function figmaToWorldX(figmaX: number, sceneScale: number) {
  return Math.round(figmaX * sceneScale);
}

function viewportBottomAlignedWorldY(assetHeight: number, sceneScale: number, renderHeight: number) {
  return renderHeight - Math.round(assetHeight * sceneScale);
}

export function createParallaxMainSceneClass(
  Phaser: PhaserModule,
  dependencies: ParallaxMainSceneDependencies
) {
  return class ParallaxMainScene extends Phaser.Scene {
    private assetSprites: AssetSprite[] = [];
    private cameraX = 0;
    private chunkSprites: ChunkSprite[] = [];
    private pixelRatio = dependencies.pixelRatio ?? 1;
    private sceneScale = 1;
    private viewport: ParallaxSceneViewport = dependencies.getViewport();

    constructor() {
      super({ key: 'ParallaxMain' });
    }

    preload() {
      this.viewport = dependencies.getViewport();
      this.sceneScale = this.getSceneScale();

      this.load.on('progress', (progress: number) => {
        dependencies.onLoadingProgress?.(progress);
      });

      const loadedChunkKeys = new Set<string>();
      for (const chunk of dependencies.chunks) {
        if (loadedChunkKeys.has(chunk.assetKey)) continue;
        loadedChunkKeys.add(chunk.assetKey);
        this.load.image(
          chunk.assetKey,
          resolveVersionedPath(dependencies.getChunkPath(chunk), dependencies.assetVersion)
        );
      }

      for (const asset of dependencies.assets) {
        if (!isRenderableAsset(asset)) continue;
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

      this.chunkSprites = dependencies.chunks.map((chunk) => {
        this.setTextureSmoothing(chunk.assetKey);
        const sprite = this.add.sprite(0, 0, chunk.assetKey);
        sprite.setOrigin(0, 0);
        sprite.setScrollFactor(this.getLayerSpeed(chunk.layer), 0);
        sprite.setDepth(this.getLayerDepth(chunk.layer));

        return { chunk, sprite };
      });

      this.assetSprites = dependencies.assets.flatMap((asset): AssetSprite[] => {
        if (!isRenderableAsset(asset)) return [];

        const assetKey = this.getAssetKey(asset);
        this.setTextureSmoothing(assetKey);
        const sprite = this.add.sprite(0, 0, assetKey);
        sprite.setOrigin(0, 0);
        sprite.setScrollFactor(this.getAssetScrollFactor(asset), 0);
        sprite.setDepth(this.getAssetDepth(asset));

        return [{ asset, sprite }];
      });

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
        const chunkHeight = chunk.figmaHeight ?? dependencies.sceneHeight;
        const offsetY =
          (dependencies.chunkOffsetY ?? 0) * this.sceneScale +
          (dependencies.chunkViewportOffsetY ?? 0) * this.pixelRatio;

        sprite.setPosition(figmaToWorldX(chunk.figmaX, this.sceneScale), Math.round(offsetY));
        sprite.setDisplaySize(
          Math.round(chunk.figmaWidth * this.sceneScale),
          Math.round(chunkHeight * this.sceneScale)
        );
      }

      for (const { asset, sprite } of this.assetSprites) {
        const displayWidth = Math.round(asset.width * this.sceneScale);
        const displayHeight = Math.round(asset.height * this.sceneScale);
        const overlapX = asset.overlapX === undefined ? 0 : Math.ceil(asset.overlapX * this.sceneScale);
        const viewportOffsetY = (dependencies.viewportOffsetYByLayer?.[asset.layer] ?? 0) * this.pixelRatio;
        const worldY =
          asset.viewportBottomAligned === true
            ? viewportBottomAlignedWorldY(asset.height, this.sceneScale, renderHeight)
            : Math.round(asset.y * this.sceneScale + viewportOffsetY);

        sprite.setPosition(figmaToWorldX(asset.x, this.sceneScale), worldY);
        sprite.setDisplaySize(displayWidth + overlapX, displayHeight);

        if (asset.flipX || asset.flipY || asset.rotate || asset.scaleOverride) {
          sprite.setFlip(Boolean(asset.flipX), Boolean(asset.flipY));
          sprite.setRotation(((asset.rotate ?? 0) * Math.PI) / 180);
          sprite.setScale(asset.scaleOverride?.x ?? 1, asset.scaleOverride?.y ?? 1);
        }

        if (asset.opacity !== undefined) sprite.setAlpha(asset.opacity);
      }

      this.updateChunkVisibility();
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
      const path = resolveVersionedPath(asset.src, dependencies.assetVersion);

      if (asset.src.toLowerCase().endsWith('.svg')) {
        this.load.svg(key, path, {
          width: Math.max(1, Math.round(asset.width * this.sceneScale)),
          height: Math.max(1, Math.round(asset.height * this.sceneScale))
        });
        return;
      }

      this.load.image(key, path);
    }

    private getAssetDepth(asset: SceneAsset) {
      const baseDepth = isFloorAsset(asset)
        ? (dependencies.floorDepth ?? 200)
        : this.getLayerDepth(asset.layer);

      return baseDepth + (asset.zOffset ?? 0);
    }

    private getLayerDepth(layer: SceneLayer) {
      return (dependencies.layerBaseDepth ?? defaultLayerBaseDepth)[layer] ?? 0;
    }

    private getLayerSpeed(layer: SceneLayer) {
      return (dependencies.layerSpeed ?? {})[layer] ?? 1;
    }

    private getAssetScrollFactor(asset: SceneAsset) {
      if (isFloorAsset(asset)) return (dependencies.layerSpeed ?? {}).floor ?? 1;

      return this.getLayerSpeed(asset.layer);
    }

    private getSceneScale() {
      return this.getRenderHeight() / dependencies.sceneHeight;
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
        const screenX = sprite.x - this.getRenderCameraX() * this.getLayerSpeed(chunk.layer);

        sprite.visible = screenX > -width && screenX < this.getRenderWidth() + width;
      }
    }
  };
}
