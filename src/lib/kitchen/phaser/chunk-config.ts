import type { SceneChunk, SceneLayer } from '$lib/scene/scene-asset.types';

export const SCENE_WIDTH_FIGMA = 46600;
export const SCENE_HEIGHT_FIGMA = 1330;
export const TAIL_START_X = 23600;
export const FLOOR_TOP_Y_FIGMA = 3;
export const FLOOR_HEIGHT_FIGMA = 333.18;
export const CHUNK_WIDTH_FIGMA = 2048;

export const LAYER_SPEED = {
  background: 0.42,
  middle: 0.74,
  title: 0.8,
  chef: 0.8,
  foreground: 1
} as const satisfies Record<SceneLayer, number>;

export const LAYER_BASE_DEPTH = {
  background: 100,
  middle: 300,
  title: 400,
  chef: 400,
  foreground: 600
} as const satisfies Record<SceneLayer, number>;

export const CHUNK_LAYER_PREFIX = {
  background: 'bg',
  middle: 'mid',
  foreground: 'fg'
} as const satisfies Partial<Record<SceneLayer, string>>;

export type ChunkedSceneLayer = keyof typeof CHUNK_LAYER_PREFIX;

export type ChunkCountOptions = {
  chunkWidth?: number;
  layerSpeed: number;
  sceneHeight?: number;
  sceneWidth?: number;
  viewportHeight: number;
  viewportWidth: number;
};

export type GenerateSceneChunksOptions = {
  chunkWidth?: number;
  layers?: ChunkedSceneLayer[];
  sceneHeight?: number;
  sceneWidth?: number;
  viewportHeight: number;
  viewportWidth: number;
};

export function getSceneScale(viewportHeight: number, sceneHeight = SCENE_HEIGHT_FIGMA): number {
  return viewportHeight / sceneHeight;
}

export function getWorldWidth(
  viewportWidth: number,
  viewportHeight: number,
  sceneWidth = SCENE_WIDTH_FIGMA,
  sceneHeight = SCENE_HEIGHT_FIGMA
): number {
  return Math.max(viewportWidth, sceneWidth * getSceneScale(viewportHeight, sceneHeight));
}

export function getMaxScrollX(
  viewportWidth: number,
  viewportHeight: number,
  sceneWidth = SCENE_WIDTH_FIGMA,
  sceneHeight = SCENE_HEIGHT_FIGMA
): number {
  return Math.max(0, getWorldWidth(viewportWidth, viewportHeight, sceneWidth, sceneHeight) - viewportWidth);
}

export function getMaxVisibleXFigma(options: ChunkCountOptions): number {
  const sceneScale = getSceneScale(options.viewportHeight, options.sceneHeight);
  const maxScrollX = getMaxScrollX(
    options.viewportWidth,
    options.viewportHeight,
    options.sceneWidth,
    options.sceneHeight
  );

  return (options.viewportWidth + maxScrollX * options.layerSpeed) / sceneScale;
}

export function getChunksNeeded(options: ChunkCountOptions): number {
  const chunkWidth = options.chunkWidth ?? CHUNK_WIDTH_FIGMA;
  const sceneWidth = options.sceneWidth ?? SCENE_WIDTH_FIGMA;
  const totalChunks = Math.ceil(sceneWidth / chunkWidth);
  const requestedChunks = Math.ceil(getMaxVisibleXFigma(options) / chunkWidth) + 1;

  return Math.max(1, Math.min(totalChunks, requestedChunks));
}

export function getChunkAssetKey(layer: ChunkedSceneLayer, frameIndex: number): string {
  return `${CHUNK_LAYER_PREFIX[layer]}-frame-${frameIndex.toString().padStart(2, '0')}`;
}

export function getChunkAssetPath(chunk: SceneChunk, version?: string): string {
  const prefix = CHUNK_LAYER_PREFIX[chunk.layer as ChunkedSceneLayer];
  const path = `/assets/kitchen/${prefix}/frame-${chunk.frameIndex.toString().padStart(2, '0')}.png`;

  return version ? `${path}?v=${version}` : path;
}

export function generateSceneChunks(options: GenerateSceneChunksOptions): SceneChunk[] {
  const chunkWidth = options.chunkWidth ?? CHUNK_WIDTH_FIGMA;
  const sceneWidth = options.sceneWidth ?? SCENE_WIDTH_FIGMA;
  const layers = options.layers ?? ['background', 'middle', 'foreground'];

  return layers.flatMap((layer) => {
    const count = getChunksNeeded({
      chunkWidth,
      layerSpeed: LAYER_SPEED[layer],
      sceneHeight: options.sceneHeight,
      sceneWidth,
      viewportHeight: options.viewportHeight,
      viewportWidth: options.viewportWidth
    });

    return Array.from({ length: count }, (_, frameIndex): SceneChunk => {
      const figmaX = frameIndex * chunkWidth;

      return {
        layer,
        frameIndex,
        figmaX,
        figmaY: 0,
        figmaWidth: Math.min(chunkWidth, sceneWidth - figmaX),
        figmaHeight: options.sceneHeight ?? SCENE_HEIGHT_FIGMA,
        assetKey: getChunkAssetKey(layer, frameIndex)
      };
    });
  });
}
