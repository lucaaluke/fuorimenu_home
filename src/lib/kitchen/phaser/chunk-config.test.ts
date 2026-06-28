import { describe, expect, it } from 'vitest';
import {
  CHUNK_WIDTH_FIGMA,
  generateSceneChunks,
  getChunkAssetPath,
  getChunksNeeded,
  getMaxVisibleXFigma,
  getSceneScale,
  getWorldWidth,
  SCENE_HEIGHT_FIGMA,
  SCENE_WIDTH_FIGMA
} from './chunk-config';

describe('chunk-config', () => {
  it('uses viewport height as the only scene scale input', () => {
    expect(getSceneScale(982)).toBeCloseTo(982 / SCENE_HEIGHT_FIGMA);
  });

  it('computes world width from figma scene width and scene scale', () => {
    expect(getWorldWidth(1512, 982)).toBeCloseTo(SCENE_WIDTH_FIGMA * (982 / SCENE_HEIGHT_FIGMA));
  });

  it('computes visible figma range for a parallax layer', () => {
    const maxVisible = getMaxVisibleXFigma({
      layerSpeed: 0.42,
      viewportHeight: 982,
      viewportWidth: 1512
    });

    expect(maxVisible).toBeGreaterThan(19000);
    expect(maxVisible).toBeLessThan(21000);
  });

  it('adds one guard chunk without exceeding total scene chunks', () => {
    const backgroundChunks = getChunksNeeded({
      layerSpeed: 0.42,
      viewportHeight: 982,
      viewportWidth: 1512
    });
    const foregroundChunks = getChunksNeeded({
      layerSpeed: 1,
      viewportHeight: 982,
      viewportWidth: 1512
    });

    expect(backgroundChunks).toBe(11);
    expect(foregroundChunks).toBe(Math.ceil(SCENE_WIDTH_FIGMA / CHUNK_WIDTH_FIGMA));
  });

  it('generates deterministic chunk metadata and paths', () => {
    const chunks = generateSceneChunks({
      layers: ['background'],
      viewportHeight: 982,
      viewportWidth: 1512
    });

    expect(chunks[0]).toEqual({
      layer: 'background',
      frameIndex: 0,
      figmaX: 0,
      figmaY: 0,
      figmaWidth: 2048,
      figmaHeight: 875,
      assetKey: 'bg-frame-00'
    });
    expect(chunks.at(-1)?.assetKey).toBe('bg-frame-10');
    expect(getChunkAssetPath(chunks[0], 'test-version')).toBe(
      '/assets/kitchen/bg/frame-00.png?v=test-version'
    );
  });
});
