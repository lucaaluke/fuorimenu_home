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
  isAudioMuted?: () => boolean;
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
  setAudioMuted: (isMuted: boolean) => void;
  setCameraX: (cameraX: number) => void;
  setHoveredAssetId: (assetId?: string) => void;
};

type ChunkSprite = {
  chunk: SceneChunk;
  sprite: Phaser.GameObjects.Sprite;
};

type AssetSprite = {
  asset: SceneAsset;
  sprite: Phaser.GameObjects.Sprite;
};

type ShineEffect = {
  shine: Phaser.GameObjects.Sprite;
  texture: Phaser.Textures.CanvasTexture;
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

function resolveSoundPath(src: string) {
  if (src.startsWith('/')) return src;
  return `/sound/${src}`;
}

function isRenderableAsset(asset: SceneAsset) {
  if (asset.interactive || asset.kind === 'interactive') return false;
  if (asset.id.startsWith('layer-')) return false;

  return true;
}

function isFloorAsset(asset: SceneAsset) {
  return asset.id.includes('floor') || asset.src.endsWith('/pavimento.png') || asset.src.endsWith('pavimento.png');
}

function shouldRenderAssetShine(asset: SceneAsset) {
  return Boolean(asset.hoverAnimation || asset.hoverSoundSrc || asset.idleAnimation);
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
    private hoveredAssetId: string | undefined;
    private hoverAnimatingSprites = new WeakSet<Phaser.GameObjects.Sprite>();
    private idleTweens = new WeakMap<Phaser.GameObjects.Sprite, Phaser.Tweens.Tween>();
    private isAudioMuted = dependencies.isAudioMuted?.() ?? false;
    private pixelRatio = dependencies.pixelRatio ?? 1;
    private sceneScale = 1;
    private shineEffects = new WeakMap<Phaser.GameObjects.Sprite, ShineEffect>();
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
      this.load.on('loaderror', (file: { key?: string; src?: string; url?: string }) => {
        console.warn('[ParallaxMainScene] Asset load failed', file.key, file.url ?? file.src);
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
        this.loadAssetHoverSound(asset);
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

      for (const { asset, sprite } of this.assetSprites) {
        this.startAssetShine(sprite, asset);
      }

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

    setAudioMuted(isMuted: boolean) {
      this.isAudioMuted = isMuted;
    }

    setHoveredAssetId(assetId?: string) {
      if (this.hoveredAssetId === assetId) return;
      this.hoveredAssetId = assetId;
      if (!assetId) return;

      const assetSprite = this.assetSprites.find(({ asset }) => asset.id === assetId);
      if (!assetSprite) return;
      this.playAssetHover(assetSprite);
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
        const originX = asset.origin?.x ?? 0;
        const originY = asset.origin?.y ?? 0;
        const viewportOffsetY = (dependencies.viewportOffsetYByLayer?.[asset.layer] ?? 0) * this.pixelRatio;
        const worldY =
          asset.viewportBottomAligned === true
            ? viewportBottomAlignedWorldY(asset.height, this.sceneScale, renderHeight)
            : Math.round(asset.y * this.sceneScale + viewportOffsetY);

        sprite.setOrigin(originX, originY);
        sprite.setPosition(
          figmaToWorldX(asset.x, this.sceneScale) + (displayWidth + overlapX) * originX,
          worldY + displayHeight * originY
        );
        sprite.setDisplaySize(displayWidth + overlapX, displayHeight);

        if (asset.flipX || asset.flipY || asset.rotate || asset.scaleOverride) {
          sprite.setFlip(Boolean(asset.flipX), Boolean(asset.flipY));
          sprite.setRotation(((asset.rotate ?? 0) * Math.PI) / 180);
          sprite.setScale(asset.scaleOverride?.x ?? 1, asset.scaleOverride?.y ?? 1);
        }

        if (asset.opacity !== undefined) sprite.setAlpha(asset.opacity);
        this.setAssetIdleBase(sprite);
        this.startAssetIdle(sprite, asset);
        this.syncAssetShine(sprite);
      }

      this.updateChunkVisibility();
    }

    private getAssetKey(asset: SceneAsset) {
      return `obj-${asset.id}`;
    }

    private getAssetHoverSoundKey(asset: SceneAsset) {
      return `hover-sound-${asset.id}`;
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

    private loadAssetHoverSound(asset: SceneAsset) {
      if (!asset.hoverSoundSrc) return;
      this.load.audio(this.getAssetHoverSoundKey(asset), resolveSoundPath(asset.hoverSoundSrc));
    }

    private playAssetHoverSound(asset: SceneAsset) {
      if (this.isAudioMuted || !asset.hoverSoundSrc) return;
      const key = this.getAssetHoverSoundKey(asset);
      const sound = this.sound.get(key);
      if (sound) sound.stop();

      this.sound.play(key, {
        volume: asset.hoverSoundVolume ?? 0.55
      });
    }

    private playAssetHover({ asset, sprite }: AssetSprite) {
      this.playAssetHoverSound(asset);
      if (!asset.hoverAnimation || this.hoverAnimatingSprites.has(sprite)) return;

      this.hoverAnimatingSprites.add(sprite);
      this.stopAssetIdle(sprite);
      this.restoreAssetIdleBase(sprite);

      const onComplete = () => {
        this.hoverAnimatingSprites.delete(sprite);
        this.startAssetIdle(sprite, asset);
      };

      if (asset.hoverAnimation === 'shake') {
        this.playAssetShake(sprite, onComplete);
        return;
      }

      if (asset.hoverAnimation === 'bob-shake') {
        this.playAssetBobShake(sprite, onComplete);
        return;
      }

      this.playAssetPop(sprite, asset, onComplete);
    }

    private playAssetPop(sprite: Phaser.GameObjects.Sprite, asset: SceneAsset, onComplete: () => void) {
      const baseY = this.getAssetIdleBaseY(sprite);
      const baseScaleX = this.getAssetIdleBaseScaleX(sprite);
      const baseScaleY = this.getAssetIdleBaseScaleY(sprite);
      const jumpHeight = Math.max(7, 18 * this.sceneScale) * (asset.hoverPopHeightMultiplier ?? 1);
      this.tweens.killTweensOf(sprite);
      this.tweens.add({
        targets: sprite,
        y: baseY - jumpHeight,
        scaleX: baseScaleX * 1.035,
        scaleY: baseScaleY * 1.035,
        duration: 120,
        ease: 'Sine.easeOut',
        yoyo: true,
        onComplete: () => {
          sprite.setY(baseY);
          sprite.setScale(baseScaleX, baseScaleY);
          onComplete();
        }
      });
    }

    private playAssetShake(sprite: Phaser.GameObjects.Sprite, onComplete: () => void) {
      const baseAngle = this.getAssetIdleBaseAngle(sprite);
      const baseY = this.getAssetIdleBaseY(sprite);
      this.tweens.killTweensOf(sprite);
      const steps = [
        {
          angle: baseAngle - 6,
          y: baseY - Math.max(3, 5 * this.sceneScale),
          duration: 70,
          ease: 'Sine.easeOut'
        },
        {
          angle: baseAngle + 6,
          y: baseY + Math.max(2, 3 * this.sceneScale),
          duration: 82,
          ease: 'Sine.easeInOut'
        },
        {
          angle: baseAngle - 4,
          y: baseY - Math.max(2, 4 * this.sceneScale),
          duration: 74,
          ease: 'Sine.easeInOut'
        },
        {
          angle: baseAngle,
          y: baseY,
          duration: 110,
          ease: 'Back.easeOut'
        }
      ];

      const playStep = (index: number) => {
        const step = steps[index];
        if (!step) {
          sprite.setAngle(baseAngle);
          sprite.setY(baseY);
          onComplete();
          return;
        }

        this.tweens.add({
          targets: sprite,
          ...step,
          onComplete: () => playStep(index + 1)
        });
      };

      playStep(0);
    }

    private playAssetBobShake(sprite: Phaser.GameObjects.Sprite, onComplete: () => void) {
      const baseX = sprite.x;
      const baseY = this.getAssetIdleBaseY(sprite);
      const baseAngle = this.getAssetIdleBaseAngle(sprite);
      const baseScaleX = this.getAssetIdleBaseScaleX(sprite);
      const baseScaleY = this.getAssetIdleBaseScaleY(sprite);
      const unit = Math.max(1, this.sceneScale);

      this.tweens.killTweensOf(sprite);
      const steps = [
        {
          x: baseX - 2 * unit,
          y: baseY - 8 * unit,
          angle: baseAngle - 5.6,
          scaleX: baseScaleX * 1.025,
          scaleY: baseScaleY * 1.025,
          duration: 112,
          ease: 'Sine.easeOut'
        },
        {
          x: baseX + 3 * unit,
          y: baseY - 5 * unit,
          angle: baseAngle + 5.6,
          scaleX: baseScaleX * 1.018,
          scaleY: baseScaleY * 1.018,
          duration: 87,
          ease: 'Sine.easeInOut'
        },
        {
          x: baseX - 2 * unit,
          y: baseY - 4 * unit,
          angle: baseAngle - 4,
          scaleX: baseScaleX * 1.012,
          scaleY: baseScaleY * 1.012,
          duration: 99,
          ease: 'Sine.easeInOut'
        },
        {
          x: baseX + 2 * unit,
          y: baseY - 2 * unit,
          angle: baseAngle + 2.4,
          scaleX: baseScaleX * 1.006,
          scaleY: baseScaleY * 1.006,
          duration: 112,
          ease: 'Sine.easeInOut'
        },
        {
          x: baseX,
          y: baseY,
          angle: baseAngle,
          scaleX: baseScaleX,
          scaleY: baseScaleY,
          duration: 210,
          ease: 'Back.easeOut'
        }
      ];

      const playStep = (index: number) => {
        const step = steps[index];
        if (!step) {
          sprite.setPosition(baseX, baseY);
          sprite.setAngle(baseAngle);
          sprite.setScale(baseScaleX, baseScaleY);
          onComplete();
          return;
        }

        this.tweens.add({
          targets: sprite,
          ...step,
          onComplete: () => playStep(index + 1)
        });
      };

      playStep(0);
    }

    private setAssetIdleBase(sprite: Phaser.GameObjects.Sprite) {
      sprite.setData('idleBaseY', sprite.y);
      sprite.setData('idleBaseAngle', sprite.angle);
      sprite.setData('idleBaseScaleX', sprite.scaleX);
      sprite.setData('idleBaseScaleY', sprite.scaleY);
    }

    private restoreAssetIdleBase(sprite: Phaser.GameObjects.Sprite) {
      sprite.setY(this.getAssetIdleBaseY(sprite));
      sprite.setAngle(this.getAssetIdleBaseAngle(sprite));
      sprite.setScale(this.getAssetIdleBaseScaleX(sprite), this.getAssetIdleBaseScaleY(sprite));
    }

    private getAssetIdleBaseY(sprite: Phaser.GameObjects.Sprite) {
      return Number(sprite.getData('idleBaseY') ?? sprite.y);
    }

    private getAssetIdleBaseAngle(sprite: Phaser.GameObjects.Sprite) {
      return Number(sprite.getData('idleBaseAngle') ?? sprite.angle);
    }

    private getAssetIdleBaseScaleX(sprite: Phaser.GameObjects.Sprite) {
      return Number(sprite.getData('idleBaseScaleX') ?? sprite.scaleX);
    }

    private getAssetIdleBaseScaleY(sprite: Phaser.GameObjects.Sprite) {
      return Number(sprite.getData('idleBaseScaleY') ?? sprite.scaleY);
    }

    private startAssetShine(sprite: Phaser.GameObjects.Sprite, asset: SceneAsset) {
      if (!shouldRenderAssetShine(asset)) return;

      const texture = this.createAssetShineTexture(sprite, asset);
      if (!texture) return;

      const shine = this.add.sprite(sprite.x, sprite.y, texture.key);
      shine.setOrigin(sprite.originX, sprite.originY);
      shine.setScrollFactor(sprite.scrollFactorX, sprite.scrollFactorY);
      shine.setDepth(sprite.depth + 0.12);
      shine.setBlendMode(Phaser.BlendModes.SCREEN);
      shine.setAlpha(0);
      shine.setVisible(false);

      this.shineEffects.set(sprite, { shine, texture });
      this.syncAssetShine(sprite);

      const delay = 720 + (Math.abs(this.hashAssetId(`${asset.id}-shine`)) % 720);
      this.time.addEvent({
        delay,
        callback: () => this.playAssetShine(sprite),
        callbackScope: this
      });

      this.time.addEvent({
        delay: 1500 + (Math.abs(this.hashAssetId(`${asset.id}-shine-loop`)) % 420),
        loop: true,
        callback: () => this.playAssetShine(sprite),
        callbackScope: this
      });
    }

    private createAssetShineTexture(sprite: Phaser.GameObjects.Sprite, asset: SceneAsset) {
      const key = `shine-${asset.id}`;
      if (this.textures.exists(key)) this.textures.remove(key);

      const sourceImage = sprite.texture.getSourceImage(sprite.frame.name);
      const width =
        sourceImage instanceof HTMLImageElement || sourceImage instanceof HTMLCanvasElement
          ? sourceImage.width
          : Math.max(1, Math.round(sprite.width));
      const height =
        sourceImage instanceof HTMLImageElement || sourceImage instanceof HTMLCanvasElement
          ? sourceImage.height
          : Math.max(1, Math.round(sprite.height));

      return this.textures.createCanvas(key, Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
    }

    private playAssetShine(sprite: Phaser.GameObjects.Sprite) {
      const effect = this.shineEffects.get(sprite);
      if (!effect || !sprite.active || !effect.shine.active) return;

      const sweep = { progress: 0 };
      this.tweens.killTweensOf(effect.shine);
      this.tweens.killTweensOf(sweep);
      this.syncAssetShine(sprite);
      this.drawAssetShineTexture(sprite, effect.texture, sweep.progress);
      effect.shine.setVisible(true);
      effect.shine.setAlpha(0);

      this.tweens.add({
        targets: effect.shine,
        alpha: 0.76,
        duration: 230,
        ease: 'Sine.easeOut',
        yoyo: true,
        hold: 240,
        onComplete: () => {
          effect.texture.clear();
          effect.shine.setAlpha(0);
          effect.shine.setVisible(false);
        }
      });

      this.tweens.add({
        targets: sweep,
        progress: 1,
        duration: 920,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.syncAssetShine(sprite);
          this.drawAssetShineTexture(sprite, effect.texture, sweep.progress);
        }
      });
    }

    private syncAssetShine(sprite: Phaser.GameObjects.Sprite) {
      const effect = this.shineEffects.get(sprite);
      if (!effect) return;

      effect.shine.setPosition(sprite.x, sprite.y);
      effect.shine.setOrigin(sprite.originX, sprite.originY);
      effect.shine.setDisplaySize(sprite.displayWidth, sprite.displayHeight);
      effect.shine.setScrollFactor(sprite.scrollFactorX, sprite.scrollFactorY);
      effect.shine.setDepth(sprite.depth + 0.12);
      effect.shine.setAngle(sprite.angle);
      effect.shine.setFlip(sprite.flipX, sprite.flipY);
    }

    private drawAssetShineTexture(
      sprite: Phaser.GameObjects.Sprite,
      shineTexture: Phaser.Textures.CanvasTexture,
      progress: number
    ) {
      const sourceImage = sprite.texture.getSourceImage(sprite.frame.name);
      if (!(sourceImage instanceof HTMLImageElement) && !(sourceImage instanceof HTMLCanvasElement)) return;

      const width = shineTexture.width;
      const height = shineTexture.height;
      const beamWidth = Math.max(2, width * 0.18);
      const beamLength = Math.hypot(width, height) * 1.95;
      const centerX = width * (-0.24 + 1.48 * progress);
      const centerY = height * (-0.2 + 1.4 * progress);
      const context = shineTexture.getContext();

      context.clearRect(0, 0, width, height);
      context.save();
      context.fillStyle = '#fff7df';
      context.globalAlpha = 1;
      this.fillRotatedRect(context, centerX, centerY, beamWidth, beamLength, (90 + 38) * (Math.PI / 180));
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(sourceImage, 0, 0, width, height);
      context.restore();
      shineTexture.refresh();
    }

    private fillRotatedRect(
      context: CanvasRenderingContext2D,
      centerX: number,
      centerY: number,
      width: number,
      height: number,
      longAxisAngle: number
    ) {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const longX = Math.cos(longAxisAngle);
      const longY = Math.sin(longAxisAngle);
      const sideX = Math.cos(longAxisAngle - Math.PI / 2);
      const sideY = Math.sin(longAxisAngle - Math.PI / 2);
      const points = [
        {
          x: centerX - sideX * halfWidth - longX * halfHeight,
          y: centerY - sideY * halfWidth - longY * halfHeight
        },
        {
          x: centerX + sideX * halfWidth - longX * halfHeight,
          y: centerY + sideY * halfWidth - longY * halfHeight
        },
        {
          x: centerX + sideX * halfWidth + longX * halfHeight,
          y: centerY + sideY * halfWidth + longY * halfHeight
        },
        {
          x: centerX - sideX * halfWidth + longX * halfHeight,
          y: centerY - sideY * halfWidth + longY * halfHeight
        }
      ];

      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      context.lineTo(points[1].x, points[1].y);
      context.lineTo(points[2].x, points[2].y);
      context.lineTo(points[3].x, points[3].y);
      context.closePath();
      context.fill();
    }

    private stopAssetIdle(sprite: Phaser.GameObjects.Sprite) {
      this.idleTweens.get(sprite)?.stop();
      this.idleTweens.delete(sprite);
    }

    private startAssetIdle(sprite: Phaser.GameObjects.Sprite, asset: SceneAsset) {
      this.stopAssetIdle(sprite);
      if (!asset.idleAnimation) return;

      this.restoreAssetIdleBase(sprite);
      const baseY = this.getAssetIdleBaseY(sprite);
      const baseAngle = this.getAssetIdleBaseAngle(sprite);
      const delay = Math.abs(this.hashAssetId(asset.id)) % 700;
      const duration = 980 + (Math.abs(this.hashAssetId(`${asset.id}-duration`)) % 360);
      const swayAngle = 5.6;
      const tween =
        asset.idleAnimation === 'sway'
          ? (sprite.setAngle(baseAngle - swayAngle),
            this.tweens.add({
                targets: sprite,
                angle: baseAngle + swayAngle,
                duration,
                delay,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
              }))
          : this.tweens.add({
              targets: sprite,
              y: baseY - Math.max(9, 20 * this.sceneScale),
              duration,
              delay,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });

      this.idleTweens.set(sprite, tween);
    }

    private hashAssetId(value: string) {
      let hash = 0;
      for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash |= 0;
      }
      return hash;
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
