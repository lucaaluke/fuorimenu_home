export function figmaToWorldX(figmaX: number, sceneScale: number): number {
  return Math.round(figmaX * sceneScale);
}

export function figmaTopToWorldY(figmaY: number, sceneScale: number): number {
  return Math.round(figmaY * sceneScale);
}

export function figmaToWorldY(
  figmaY: number,
  sceneScale: number,
  viewportHeight: number,
  floorTopY: number
): number {
  return Math.round(viewportHeight - (floorTopY - figmaY) * sceneScale);
}

export function worldToScreenX(
  figmaX: number,
  cameraX: number,
  sceneScale: number,
  layerSpeed: number
): number {
  return Math.round(figmaToWorldX(figmaX, sceneScale) - cameraX * layerSpeed);
}

export function worldToScreenY(
  figmaY: number,
  sceneScale: number,
  viewportHeight: number,
  floorTopY: number
): number {
  return figmaToWorldY(figmaY, sceneScale, viewportHeight, floorTopY);
}

export function screenToFigmaY(screenY: number, sceneScale: number, viewportHeight: number, floorTopY: number): number {
  return floorTopY - (viewportHeight - screenY) / sceneScale;
}

export function tailAwareFigmaX(figmaX: number, isTail: boolean | undefined, tailStartX: number): number {
  return isTail ? tailStartX + figmaX : figmaX;
}
