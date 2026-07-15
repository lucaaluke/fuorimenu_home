import type Phaser from 'phaser';

export function getDevicePixelRatio() {
  return Math.max(1, window.devicePixelRatio ?? 1);
}

export function setCanvasCssSize(game: Phaser.Game | undefined, width: number, height: number) {
  const canvas = game?.canvas;
  if (!canvas) return;

  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.display = 'block';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}
