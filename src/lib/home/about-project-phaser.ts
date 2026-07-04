import { browser } from '$app/environment';
import type Phaser from 'phaser';

export type AboutProjectPhaserAsset = {
  name: string;
  src: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isBackdrop?: boolean;
};

export type AboutProjectPhaserGameHandle = {
  destroy: () => void;
  resize: (width: number, height: number) => void;
};

type PhaserModule = typeof import('phaser');

type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function getPixelRatio() {
  return Math.max(1, window.devicePixelRatio ?? 1);
}

function getAssetBounds(assets: AboutProjectPhaserAsset[]): Bounds {
  return assets.reduce(
    (bounds, asset) => ({
      left: Math.min(bounds.left, asset.x),
      top: Math.min(bounds.top, asset.y),
      right: Math.max(bounds.right, asset.x + asset.width),
      bottom: Math.max(bounds.bottom, asset.y + asset.height)
    }),
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY
    }
  );
}

function setCanvasCssSize(game: Phaser.Game | undefined, width: number, height: number) {
  const canvas = game?.canvas;
  if (!canvas) return;

  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.display = 'block';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function createAboutProjectSceneClass(
  Phaser: PhaserModule,
  assets: AboutProjectPhaserAsset[],
  initialViewport: { width: number; height: number; pixelRatio: number }
) {
  return class AboutProjectScene extends Phaser.Scene {
    private bounds = getAssetBounds(assets);
    private pixelRatio = initialViewport.pixelRatio;
    private sprites: { asset: AboutProjectPhaserAsset; sprite: Phaser.GameObjects.Sprite }[] = [];
    private viewport = { width: initialViewport.width, height: initialViewport.height };

    constructor() {
      super({ key: 'AboutProject' });
    }

    preload() {
      for (const asset of assets) {
        this.load.image(asset.name, asset.src);
      }
    }

    create() {
      this.cameras.main.setRoundPixels(true);
      this.sprites = assets.map((asset) => {
        const sprite = this.add.sprite(0, 0, asset.name);
        sprite.setOrigin(0, 0);
        sprite.setDepth(asset.isBackdrop ? 2 : 1);
        return { asset, sprite };
      });
      this.resize(this.viewport.width, this.viewport.height, this.pixelRatio);
    }

    resize(width: number, height: number, pixelRatio = this.pixelRatio) {
      this.viewport = { width, height };
      this.pixelRatio = Math.max(1, pixelRatio);

      const renderWidth = Math.max(1, Math.round(width * this.pixelRatio));
      const renderHeight = Math.max(1, Math.round(height * this.pixelRatio));
      const boundsWidth = Math.max(1, this.bounds.right - this.bounds.left);
      const boundsHeight = Math.max(1, this.bounds.bottom - this.bounds.top);
      const sceneScale = Math.min((width * 0.92) / boundsWidth, (height * 0.8) / boundsHeight) * this.pixelRatio;
      const contentWidth = boundsWidth * sceneScale;
      const contentHeight = boundsHeight * sceneScale;
      const offsetX = (renderWidth - contentWidth) / 2;
      const offsetY = renderHeight - contentHeight;

      this.scale.resize(renderWidth, renderHeight);
      this.cameras.main.setViewport(0, 0, renderWidth, renderHeight);
      this.cameras.main.setSize(renderWidth, renderHeight);
      this.cameras.main.setScroll(0, 0);
      this.cameras.main.setZoom(1);

      for (const { asset, sprite } of this.sprites) {
        sprite.setPosition(
          offsetX + (asset.x - this.bounds.left) * sceneScale,
          offsetY + (asset.y - this.bounds.top) * sceneScale
        );
        sprite.setDisplaySize(asset.width * sceneScale, asset.height * sceneScale);
      }
    }
  };
}

export async function createAboutProjectPhaserGame(options: {
  assets: AboutProjectPhaserAsset[];
  container: HTMLElement;
}): Promise<AboutProjectPhaserGameHandle | undefined> {
  if (!browser) return undefined;

  const Phaser = await import('phaser');
  const pixelRatio = getPixelRatio();
  const rect = options.container.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  let game: Phaser.Game | undefined;

  const AboutProjectScene = createAboutProjectSceneClass(Phaser, options.assets, { width, height, pixelRatio });

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: options.container,
    width: Math.round(width * pixelRatio),
    height: Math.round(height * pixelRatio),
    transparent: true,
    canvasStyle: `position:absolute;inset:0;display:block;width:${width}px;height:${height}px;`,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: Math.round(width * pixelRatio),
      height: Math.round(height * pixelRatio)
    },
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: true
    },
    scene: [AboutProjectScene]
  };

  game = new Phaser.Game(config);
  setCanvasCssSize(game, width, height);

  return {
    destroy() {
      game?.destroy(true);
      game = undefined;
    },
    resize(nextWidth: number, nextHeight: number) {
      const nextPixelRatio = getPixelRatio();
      const scene = game?.scene.getScene('AboutProject') as InstanceType<typeof AboutProjectScene> | undefined;
      game?.scale.resize(Math.round(nextWidth * nextPixelRatio), Math.round(nextHeight * nextPixelRatio));
      scene?.resize(nextWidth, nextHeight, nextPixelRatio);
      setCanvasCssSize(game, nextWidth, nextHeight);
    }
  };
}
