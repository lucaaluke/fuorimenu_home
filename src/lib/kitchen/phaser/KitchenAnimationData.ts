import type Phaser from 'phaser';
import type { SceneAsset } from '$lib/scene/scene-asset.types';

type KitchenAnimationSprite = {
  asset: Pick<SceneAsset, 'id'>;
  sprite: Phaser.GameObjects.Sprite;
};

const S_CONO_ASSET_ID = 'S-cono';
const S_CONO_JUMP_INTERVAL_MS = 2000;
const S_CONO_JUMP_HEIGHT = 28;
const S_CONO_SHAKE_DISTANCE = 3;

export function startKitchenSceneAnimations(
  scene: Phaser.Scene,
  assetSprites: KitchenAnimationSprite[],
  getSceneScale: () => number
) {
  const sCono = assetSprites.find(({ asset }) => asset.id === S_CONO_ASSET_ID)?.sprite;
  if (!sCono) return;

  scene.time.addEvent({
    delay: S_CONO_JUMP_INTERVAL_MS,
    loop: true,
    callback: () => playSConoJump(scene, sCono, getSceneScale())
  });
}

function playSConoJump(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, sceneScale: number) {
  if (!sprite.active) return;

  const baseX = sprite.x;
  const baseY = sprite.y;
  const jumpHeight = Math.max(8, Math.round(S_CONO_JUMP_HEIGHT * sceneScale));
  const shakeDistance = Math.max(1, Math.round(S_CONO_SHAKE_DISTANCE * sceneScale));

  scene.tweens.killTweensOf(sprite);
  scene.tweens.add({
    targets: sprite,
    y: baseY - jumpHeight,
    duration: 220,
    ease: 'Sine.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: sprite,
        x: baseX + shakeDistance,
        angle: 1.5,
        duration: 45,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 3
      });
      scene.tweens.add({
        targets: sprite,
        y: baseY,
        delay: 220,
        duration: 260,
        ease: 'Bounce.easeOut',
        onComplete: () => {
          sprite.setPosition(baseX, baseY);
          sprite.setAngle(0);
        }
      });
    }
  });
}
