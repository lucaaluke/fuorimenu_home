import { describe, expect, it } from 'vitest';
import {
  figmaToWorldX,
  figmaTopToWorldY,
  figmaToWorldY,
  screenToFigmaY,
  tailAwareFigmaX,
  worldToScreenX,
  worldToScreenY
} from './coordinate-utils';
import { FLOOR_TOP_Y_FIGMA, SCENE_HEIGHT_FIGMA } from './chunk-config';

describe('coordinate-utils', () => {
  const viewportHeight = 982;
  const sceneScale = viewportHeight / SCENE_HEIGHT_FIGMA;

  it('rounds figma x coordinates into world coordinates', () => {
    expect(figmaToWorldX(5837.38, sceneScale)).toBe(6551);
  });

  it('rounds top-left figma y coordinates into world coordinates', () => {
    expect(figmaTopToWorldY(605.91, sceneScale)).toBe(680);
  });

  it('anchors figma y coordinates to the floor top ruler', () => {
    expect(figmaToWorldY(FLOOR_TOP_Y_FIGMA, sceneScale, viewportHeight, FLOOR_TOP_Y_FIGMA)).toBe(982);
    expect(figmaToWorldY(1730.9, sceneScale, viewportHeight, FLOOR_TOP_Y_FIGMA)).toBe(897);
    expect(figmaToWorldY(1554.83, sceneScale, viewportHeight, FLOOR_TOP_Y_FIGMA)).toBe(699);
    expect(figmaToWorldY(1365.22, sceneScale, viewportHeight, FLOOR_TOP_Y_FIGMA)).toBe(486);
  });

  it('converts world x into parallax screen x with integer output', () => {
    expect(worldToScreenX(5837.38, 1200, sceneScale, 0.74)).toBe(5663);
    expect(worldToScreenX(5837.38, 1200, sceneScale, 1)).toBe(5351);
  });

  it('uses the same y conversion for screen overlays', () => {
    expect(worldToScreenY(1730.9, sceneScale, viewportHeight, FLOOR_TOP_Y_FIGMA)).toBe(897);
  });

  it('converts screen y back into absolute figma y coordinates', () => {
    expect(screenToFigmaY(897, sceneScale, viewportHeight, FLOOR_TOP_Y_FIGMA)).toBeCloseTo(1731.01, 2);
  });

  it('converts tail-local x coordinates into absolute figma x coordinates', () => {
    expect(tailAwareFigmaX(1200, true, 23600)).toBe(24800);
    expect(tailAwareFigmaX(1200, false, 23600)).toBe(1200);
  });
});
