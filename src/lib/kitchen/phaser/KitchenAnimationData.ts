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
const S_TOOLBOX_ASSET_ID = 'S-cassetta-attrezzi';
const S_TOOLBOX_SHINE_INTERVAL_MS = 1600;
const S_TOOLBOX_SHINE_DURATION_MS = 1060;
const S_TOOLBOX_SHINE_ALPHA = 0.78;
const S_TOOLBOX_SHINE_BEAM_WIDTH_RATIO = 0.16;
const S_TOOLBOX_SHINE_BEAM_LENGTH_RATIO = 1.85;
const S_TOOLBOX_SHINE_BEAM_TILT_DEGREES = 40;
const S_TOOLBOX_SHINE_TEXTURE_KEY = 'kitchen-animation-s-cassetta-attrezzi-shine';
const S_TOOLBOX_HOVER_JUMP_HEIGHT = 20;
const S_TOOLBOX_HOVER_JUMP_DURATION_MS = 520;
const S_PLANETARIA_ASSET_ID = 'S-planetaria';
const S_PLANETARIA_SHAKE_ANGLE = 1.4;
const S_PLANETARIA_SHAKE_STEP_DURATION_MS = 55;
const S_PLANETARIA_SHAKE_PAUSE_MS = 260;
const S_COFFEE_MACHINE_ASSET_ID = 'S-macchinetta-caffe';
const S_COFFEE_DRIP_INTERVAL_MS = 650;
const S_COFFEE_DRIP_FALL_DISTANCE = 34;
const S_COFFEE_DRIP_DURATION_MS = 520;
const S_COFFEE_DRIP_OFFSET_X_RATIO = 0.52;
const S_COFFEE_DRIP_OFFSET_Y_RATIO = 0.62;
const S_COFFEE_DRIP_WIDTH = 4;
const S_COFFEE_DRIP_HEIGHT = 7;
const S_COFFEE_DRIP_COLOR = 0x2b160c;
const S_COFFEE_DRIP_ALPHA = 0.9;
const S_COFFEE_HOVER_JUMP_HEIGHT = 16;
const S_COFFEE_HOVER_JUMP_DURATION_MS = 560;
const S_KIT_PULIZIE_A_ASSET_ID = 'S-kit-pulizie-a';
const S_KIT_PULIZIE_A_JUMP_HEIGHT = 18;
const S_KIT_PULIZIE_A_JUMP_DURATION_MS = 300;
const S_KIT_PULIZIE_A_JUMP_STAGGER_MS = 150;
const S_KIT_PULIZIE_A_SEQUENCE_INTERVAL_MS = 1700;
const S_KIT_PULIZIE_A_PARTS = [
  { key: 'left', x: 0, y: 0, width: 116, height: 297 },
  { key: 'middle', x: 129, y: 126, width: 89, height: 132 },
  { key: 'right', x: 262, y: 36, width: 103, height: 261 }
] as const;
const S_ALARM_CLOCK_ASSET_ID = 'S-sveglia';
const S_ALARM_CLOCK_WOBBLE_ANGLE = 5;
const S_ALARM_CLOCK_WOBBLE_STEP_DURATION_MS = 90;
const S_ALARM_CLOCK_WOBBLE_PAUSE_MS = 900;
const S_STOVE_CONTROLS_ASSET_ID = '2-S-fornelli-b';
const S_STOVE_CONTROLS_JUMP_HEIGHT = 8;
const S_STOVE_CONTROLS_JUMP_DURATION_MS = 360;
const S_STOVE_CONTROLS_SHAKE_ANGLE = 2;
const S_STOVE_CONTROLS_SEQUENCE_INTERVAL_MS = 1450;
const S_STOVE_HOOD_ASSET_ID = '2-cappe-fornelli';
const S_STOVE_HOOD_TOP_STRETCH_HEIGHT = 20;
const S_STOVE_HOOD_TOP_STRETCH_EXTRA_TOP = 100;
const S_STOVE_HOOD_TOP_STRETCH_OVERLAP = 10;
const S_STOVE_HOOD_TOP_STRETCH_TEXTURE_KEY = 'kitchen-animation-2-cappe-fornelli-top-stretch';

export function startKitchenSceneAnimations(
  scene: Phaser.Scene,
  assetSprites: KitchenAnimationSprite[],
  getSceneScale: () => number,
  isObjectHoverSuppressed: () => boolean = () => false
) {
  const sCono = assetSprites.find(({ asset }) => asset.id === S_CONO_ASSET_ID)?.sprite;
  const toolbox = assetSprites.find(({ asset }) => asset.id === S_TOOLBOX_ASSET_ID)?.sprite;
  const planetaria = assetSprites.find(({ asset }) => asset.id === S_PLANETARIA_ASSET_ID)?.sprite;
  const coffeeMachine = assetSprites.find(({ asset }) => asset.id === S_COFFEE_MACHINE_ASSET_ID)?.sprite;
  const kitPulizieA = assetSprites.find(({ asset }) => asset.id === S_KIT_PULIZIE_A_ASSET_ID)?.sprite;
  const alarmClock = assetSprites.find(({ asset }) => asset.id === S_ALARM_CLOCK_ASSET_ID)?.sprite;
  const stoveControls = assetSprites.find(({ asset }) => asset.id === S_STOVE_CONTROLS_ASSET_ID)?.sprite;
  const stoveHood = assetSprites.find(({ asset }) => asset.id === S_STOVE_HOOD_ASSET_ID)?.sprite;

  if (sCono) {
    scene.time.addEvent({
      delay: S_CONO_JUMP_INTERVAL_MS,
      loop: true,
      callback: () => playSConoJump(scene, sCono, getSceneScale())
    });
  }

  if (toolbox) {
    startToolboxShineAnimation(scene, toolbox);
    startToolboxHoverJumpAnimation(scene, toolbox, getSceneScale, isObjectHoverSuppressed);
  }

  if (planetaria) {
    startPlanetariaShakeAnimation(scene, planetaria);
  }

  if (coffeeMachine) {
    startCoffeeDripAnimation(scene, coffeeMachine, getSceneScale);
    startCoffeeHoverJumpAnimation(scene, coffeeMachine, getSceneScale, isObjectHoverSuppressed);
  }

  if (kitPulizieA) {
    startKitPulizieAJumpAnimation(scene, kitPulizieA, getSceneScale);
  }

  if (alarmClock) {
    startAlarmClockWobbleAnimation(scene, alarmClock);
  }

  if (stoveControls) {
    startStoveControlsJumpShakeAnimation(scene, stoveControls, getSceneScale);
  }

  if (stoveHood) {
    startStoveHoodTopStretch(scene, stoveHood);
  }
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

function startToolboxHoverJumpAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  getSceneScale: () => number,
  isObjectHoverSuppressed: () => boolean
) {
  let isJumping = false;

  sprite.setInteractive({ useHandCursor: true });
  sprite.on('pointerover', () => {
    if (!sprite.active || isJumping || isObjectHoverSuppressed()) return;

    isJumping = true;
    playToolboxHoverJump(scene, sprite, getSceneScale(), () => {
      isJumping = false;
    });
  });
}

function playToolboxHoverJump(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  sceneScale: number,
  onComplete: () => void
) {
  const baseY = sprite.y;
  const jumpHeight = Math.max(6, Math.round(S_TOOLBOX_HOVER_JUMP_HEIGHT * sceneScale));

  scene.tweens.killTweensOf(sprite);
  scene.tweens.add({
    targets: sprite,
    y: baseY - jumpHeight,
    duration: S_TOOLBOX_HOVER_JUMP_DURATION_MS * 0.36,
    ease: 'Sine.easeOut',
    yoyo: true,
    onComplete: () => {
      sprite.setY(baseY);
      onComplete();
    }
  });
}

function startPlanetariaShakeAnimation(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {
  const playShake = () => {
    if (!sprite.active) return;
    playPlanetariaShake(scene, sprite, playShake);
  };

  playShake();
}

function playPlanetariaShake(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  onComplete: () => void
) {
  scene.tweens.add({
    targets: sprite,
    angle: -S_PLANETARIA_SHAKE_ANGLE,
    duration: S_PLANETARIA_SHAKE_STEP_DURATION_MS,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: 2,
    onComplete: () => {
      sprite.setAngle(0);
      scene.time.delayedCall(S_PLANETARIA_SHAKE_PAUSE_MS, onComplete);
    }
  });
}

function startAlarmClockWobbleAnimation(scene: Phaser.Scene, sourceSprite: Phaser.GameObjects.Sprite) {
  const wobbleSprite = scene.add.sprite(sourceSprite.x, sourceSprite.y, sourceSprite.texture.key, sourceSprite.frame.name);
  wobbleSprite.setOrigin(0.5, 1);
  wobbleSprite.setScrollFactor(sourceSprite.scrollFactorX, sourceSprite.scrollFactorY);
  wobbleSprite.setDepth(sourceSprite.depth);
  sourceSprite.setVisible(false);

  const syncWobbleSprite = () => {
    wobbleSprite.setPosition(sourceSprite.x + sourceSprite.displayWidth / 2, sourceSprite.y + sourceSprite.displayHeight);
    wobbleSprite.setDisplaySize(sourceSprite.displayWidth, sourceSprite.displayHeight);
    wobbleSprite.setScrollFactor(sourceSprite.scrollFactorX, sourceSprite.scrollFactorY);
    wobbleSprite.setDepth(sourceSprite.depth);
    wobbleSprite.setVisible(sourceSprite.active);
  };

  const playWobble = () => {
    if (!sourceSprite.active || !wobbleSprite.active) return;
    playAlarmClockWobble(scene, wobbleSprite, playWobble);
  };

  scene.events.on('postupdate', syncWobbleSprite);
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', syncWobbleSprite);
    wobbleSprite.destroy();
  });

  syncWobbleSprite();
  playWobble();
}

function playAlarmClockWobble(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  onComplete: () => void
) {
  scene.tweens.add({
    targets: sprite,
    angle: S_ALARM_CLOCK_WOBBLE_ANGLE,
    duration: S_ALARM_CLOCK_WOBBLE_STEP_DURATION_MS,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: 3,
    onComplete: () => {
      sprite.setAngle(0);
      scene.time.delayedCall(S_ALARM_CLOCK_WOBBLE_PAUSE_MS, onComplete);
    }
  });
}

function startStoveControlsJumpShakeAnimation(
  scene: Phaser.Scene,
  sourceSprite: Phaser.GameObjects.Sprite,
  getSceneScale: () => number
) {
  const state = {
    angle: 0,
    jumpOffset: 0
  };
  const animatedSprite = scene.add.sprite(
    sourceSprite.x,
    sourceSprite.y,
    sourceSprite.texture.key,
    sourceSprite.frame.name
  );

  animatedSprite.setOrigin(0.5, 0.5);
  animatedSprite.setScrollFactor(sourceSprite.scrollFactorX, sourceSprite.scrollFactorY);
  animatedSprite.setDepth(sourceSprite.depth);
  sourceSprite.setVisible(false);

  const syncAnimatedSprite = () => {
    animatedSprite.setPosition(
      sourceSprite.x + sourceSprite.displayWidth / 2,
      sourceSprite.y + sourceSprite.displayHeight / 2 + state.jumpOffset
    );
    animatedSprite.setDisplaySize(sourceSprite.displayWidth, sourceSprite.displayHeight);
    animatedSprite.setScrollFactor(sourceSprite.scrollFactorX, sourceSprite.scrollFactorY);
    animatedSprite.setDepth(sourceSprite.depth);
    animatedSprite.setAngle(state.angle);
    animatedSprite.setVisible(sourceSprite.active);
  };

  const playAnimation = () => {
    if (!sourceSprite.active || !animatedSprite.active) return;
    playStoveControlsJumpShake(scene, state, getSceneScale(), playAnimation);
  };

  scene.events.on('postupdate', syncAnimatedSprite);
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', syncAnimatedSprite);
    animatedSprite.destroy();
  });

  syncAnimatedSprite();
  playAnimation();
}

function playStoveControlsJumpShake(
  scene: Phaser.Scene,
  state: { angle: number; jumpOffset: number },
  sceneScale: number,
  onComplete: () => void
) {
  const jumpHeight = Math.max(3, Math.round(S_STOVE_CONTROLS_JUMP_HEIGHT * sceneScale));

  state.angle = 0;
  state.jumpOffset = 0;
  scene.tweens.killTweensOf(state);
  scene.tweens.add({
    targets: state,
    jumpOffset: -jumpHeight,
    angle: S_STOVE_CONTROLS_SHAKE_ANGLE,
    duration: S_STOVE_CONTROLS_JUMP_DURATION_MS * 0.36,
    ease: 'Sine.easeOut',
    yoyo: true,
    onComplete: () => {
      scene.tweens.add({
        targets: state,
        angle: -S_STOVE_CONTROLS_SHAKE_ANGLE,
        duration: 85,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          state.jumpOffset = 0;
          state.angle = 0;
          scene.time.delayedCall(S_STOVE_CONTROLS_SEQUENCE_INTERVAL_MS, onComplete);
        }
      });
    }
  });
}

function startStoveHoodTopStretch(scene: Phaser.Scene, sourceSprite: Phaser.GameObjects.Sprite) {
  const sourceImage = sourceSprite.texture.getSourceImage(sourceSprite.frame.name);
  if (!(sourceImage instanceof HTMLImageElement) && !(sourceImage instanceof HTMLCanvasElement)) return;

  const cropY = findFirstOpaqueRow(sourceImage, sourceSprite.width, sourceSprite.height) ?? 0;
  const cropHeight = Math.min(S_STOVE_HOOD_TOP_STRETCH_HEIGHT, sourceSprite.height - cropY);
  if (cropHeight <= 0) return;

  const stretchTexture = createCroppedTexture(
    scene,
    S_STOVE_HOOD_TOP_STRETCH_TEXTURE_KEY,
    sourceImage,
    0,
    cropY,
    sourceSprite.width,
    cropHeight
  );
  if (!stretchTexture) return;

  const stretchSprite = scene.add.sprite(sourceSprite.x, 0, stretchTexture.key);
  stretchSprite.setOrigin(0, 0);
  stretchSprite.setScrollFactor(sourceSprite.scrollFactorX, sourceSprite.scrollFactorY);
  stretchSprite.setDepth(sourceSprite.depth + 0.1);

  const syncStretchSprite = () => {
    const scaleY = sourceSprite.displayHeight / sourceSprite.height;
    const visibleTopY = sourceSprite.y + cropY * scaleY;

    stretchSprite.setPosition(sourceSprite.x, -S_STOVE_HOOD_TOP_STRETCH_EXTRA_TOP);
    stretchSprite.setDisplaySize(
      sourceSprite.displayWidth,
      Math.max(0, visibleTopY + S_STOVE_HOOD_TOP_STRETCH_EXTRA_TOP + S_STOVE_HOOD_TOP_STRETCH_OVERLAP)
    );
    stretchSprite.setScrollFactor(sourceSprite.scrollFactorX, sourceSprite.scrollFactorY);
    stretchSprite.setDepth(sourceSprite.depth + 0.1);
    stretchSprite.setVisible(sourceSprite.active && visibleTopY > 0);
  };

  scene.events.on('postupdate', syncStretchSprite);
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', syncStretchSprite);
    stretchSprite.destroy();
  });

  syncStretchSprite();
}

function findFirstOpaqueRow(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  context.drawImage(sourceImage, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) return y;
    }
  }

  return undefined;
}

function startCoffeeDripAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  getSceneScale: () => number
) {
  scene.time.addEvent({
    delay: S_COFFEE_DRIP_INTERVAL_MS,
    loop: true,
    callback: () => playCoffeeDrip(scene, sprite, getSceneScale())
  });
}

function playCoffeeDrip(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, sceneScale: number) {
  if (!sprite.active) return;

  const drop = scene.add.ellipse(
    sprite.x + sprite.displayWidth * S_COFFEE_DRIP_OFFSET_X_RATIO,
    sprite.y + sprite.displayHeight * S_COFFEE_DRIP_OFFSET_Y_RATIO,
    Math.max(1, S_COFFEE_DRIP_WIDTH * sceneScale),
    Math.max(1, S_COFFEE_DRIP_HEIGHT * sceneScale),
    S_COFFEE_DRIP_COLOR,
    S_COFFEE_DRIP_ALPHA
  );

  drop.setScrollFactor(sprite.scrollFactorX, sprite.scrollFactorY);
  drop.setDepth(sprite.depth + 0.2);

  scene.tweens.add({
    targets: drop,
    y: drop.y + Math.max(8, S_COFFEE_DRIP_FALL_DISTANCE * sceneScale),
    alpha: 0,
    scaleY: 1.4,
    duration: S_COFFEE_DRIP_DURATION_MS,
    ease: 'Sine.easeIn',
    onComplete: () => drop.destroy()
  });
}

function startCoffeeHoverJumpAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  getSceneScale: () => number,
  isObjectHoverSuppressed: () => boolean
) {
  let isJumping = false;

  sprite.setInteractive({ useHandCursor: true });
  sprite.on('pointerover', () => {
    if (!sprite.active || isJumping || isObjectHoverSuppressed()) return;

    isJumping = true;
    playCoffeeHoverJump(scene, sprite, getSceneScale(), () => {
      isJumping = false;
    });
  });
}

function playCoffeeHoverJump(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  sceneScale: number,
  onComplete: () => void
) {
  const baseY = sprite.y;
  const jumpHeight = Math.max(6, Math.round(S_COFFEE_HOVER_JUMP_HEIGHT * sceneScale));

  scene.tweens.killTweensOf(sprite);
  scene.tweens.add({
    targets: sprite,
    y: baseY - jumpHeight,
    duration: S_COFFEE_HOVER_JUMP_DURATION_MS * 0.38,
    ease: 'Sine.easeOut',
    yoyo: true,
    onComplete: () => {
      sprite.setY(baseY);
      onComplete();
    }
  });
}

function startKitPulizieAJumpAnimation(
  scene: Phaser.Scene,
  sourceSprite: Phaser.GameObjects.Sprite,
  getSceneScale: () => number
) {
  const sourceImage = sourceSprite.texture.getSourceImage(sourceSprite.frame.name);
  if (!(sourceImage instanceof HTMLImageElement) && !(sourceImage instanceof HTMLCanvasElement)) return;

  const parts = S_KIT_PULIZIE_A_PARTS.flatMap((part) => {
    const textureKey = `kitchen-animation-${S_KIT_PULIZIE_A_ASSET_ID}-${part.key}`;
    const texture = createCroppedTexture(scene, textureKey, sourceImage, part.x, part.y, part.width, part.height);
    if (!texture) return [];

    const sprite = scene.add.sprite(sourceSprite.x, sourceSprite.y, texture.key);
    sprite.setOrigin(sourceSprite.originX, sourceSprite.originY);
    sprite.setScrollFactor(sourceSprite.scrollFactorX, sourceSprite.scrollFactorY);
    sprite.setDepth(sourceSprite.depth);

    return [{ ...part, sprite, jumpOffset: 0 }];
  });

  if (parts.length === 0) return;

  sourceSprite.setVisible(false);

  const syncParts = () => {
    const scaleX = sourceSprite.displayWidth / sourceSprite.width;
    const scaleY = sourceSprite.displayHeight / sourceSprite.height;

    for (const part of parts) {
      part.sprite.setPosition(
        sourceSprite.x + part.x * scaleX,
        sourceSprite.y + part.y * scaleY + part.jumpOffset
      );
      part.sprite.setDisplaySize(part.width * scaleX, part.height * scaleY);
      part.sprite.setScrollFactor(sourceSprite.scrollFactorX, sourceSprite.scrollFactorY);
      part.sprite.setDepth(sourceSprite.depth);
      part.sprite.setVisible(sourceSprite.active);
    }
  };

  scene.events.on('postupdate', syncParts);
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', syncParts);
    for (const part of parts) part.sprite.destroy();
  });

  const playSequence = () => {
    if (!sourceSprite.active) return;
    parts.forEach((part, index) => {
      scene.time.delayedCall(index * S_KIT_PULIZIE_A_JUMP_STAGGER_MS, () => {
        playKitPulizieAPartJump(scene, part, getSceneScale());
      });
    });
  };

  syncParts();
  playSequence();
  scene.time.addEvent({
    delay: S_KIT_PULIZIE_A_SEQUENCE_INTERVAL_MS,
    loop: true,
    callback: playSequence
  });
}

function createCroppedTexture(
  scene: Phaser.Scene,
  textureKey: string,
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (scene.textures.exists(textureKey)) {
    scene.textures.remove(textureKey);
  }

  const texture = scene.textures.createCanvas(textureKey, width, height);
  if (!texture) return undefined;

  const context = texture.getContext();
  context.clearRect(0, 0, width, height);
  context.drawImage(sourceImage, x, y, width, height, 0, 0, width, height);
  texture.refresh();

  return texture;
}

function playKitPulizieAPartJump(
  scene: Phaser.Scene,
  part: { jumpOffset: number },
  sceneScale: number
) {
  part.jumpOffset = 0;
  scene.tweens.killTweensOf(part);
  scene.tweens.add({
    targets: part,
    jumpOffset: -Math.max(6, Math.round(S_KIT_PULIZIE_A_JUMP_HEIGHT * sceneScale)),
    duration: S_KIT_PULIZIE_A_JUMP_DURATION_MS * 0.42,
    ease: 'Sine.easeOut',
    yoyo: true,
    onComplete: () => {
      part.jumpOffset = 0;
    }
  });
}

function startToolboxShineAnimation(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {
  const shineTexture = createShineTexture(scene, sprite);
  if (!shineTexture) return;

  const shine = scene.add.sprite(sprite.x, sprite.y, shineTexture.key);

  shine.setOrigin(sprite.originX, sprite.originY);
  shine.setScrollFactor(sprite.scrollFactorX, sprite.scrollFactorY);
  shine.setDepth(sprite.depth + 0.1);
  shine.setBlendMode('SCREEN');
  shine.setAlpha(0);
  shine.setVisible(false);

  scene.time.addEvent({
    delay: S_TOOLBOX_SHINE_INTERVAL_MS,
    loop: true,
    callback: () => playToolboxShine(scene, sprite, shine, shineTexture)
  });
}

function playToolboxShine(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  shine: Phaser.GameObjects.Sprite,
  shineTexture: Phaser.Textures.CanvasTexture
) {
  if (!sprite.active || !shine.active) return;

  const sweepState = { progress: 0 };

  scene.tweens.killTweensOf(shine);
  scene.tweens.killTweensOf(sweepState);

  syncShineSprite(sprite, shine);
  drawToolboxShineTexture(sprite, shineTexture, sweepState.progress);
  shine.setVisible(true);
  shine.setAlpha(0);

  scene.tweens.add({
    targets: shine,
    alpha: S_TOOLBOX_SHINE_ALPHA,
    duration: S_TOOLBOX_SHINE_DURATION_MS * 0.28,
    ease: 'Sine.easeOut',
    yoyo: true,
    hold: S_TOOLBOX_SHINE_DURATION_MS * 0.22,
    onComplete: () => {
      shineTexture.clear();
      shine.setAlpha(0);
      shine.setVisible(false);
    }
  });

  scene.tweens.add({
    targets: sweepState,
    progress: 1,
    duration: S_TOOLBOX_SHINE_DURATION_MS,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      syncShineSprite(sprite, shine);
      drawToolboxShineTexture(sprite, shineTexture, sweepState.progress);
    }
  });
}

function syncShineSprite(sprite: Phaser.GameObjects.Sprite, shine: Phaser.GameObjects.Sprite) {
  shine.setPosition(sprite.x, sprite.y);
  shine.setDisplaySize(sprite.displayWidth, sprite.displayHeight);
  shine.setScrollFactor(sprite.scrollFactorX, sprite.scrollFactorY);
  shine.setDepth(sprite.depth + 0.1);
}

function createShineTexture(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {
  if (scene.textures.exists(S_TOOLBOX_SHINE_TEXTURE_KEY)) {
    scene.textures.remove(S_TOOLBOX_SHINE_TEXTURE_KEY);
  }

  return scene.textures.createCanvas(
    S_TOOLBOX_SHINE_TEXTURE_KEY,
    Math.max(1, Math.round(sprite.width)),
    Math.max(1, Math.round(sprite.height))
  );
}

function drawToolboxShineTexture(
  sprite: Phaser.GameObjects.Sprite,
  shineTexture: Phaser.Textures.CanvasTexture,
  progress: number
) {
  const width = shineTexture.width;
  const height = shineTexture.height;
  const beamWidth = Math.max(1, width * S_TOOLBOX_SHINE_BEAM_WIDTH_RATIO);
  const beamLength = Math.hypot(width, height) * S_TOOLBOX_SHINE_BEAM_LENGTH_RATIO;
  const centerX = width * (-0.24 + 1.48 * progress);
  const centerY = height * (-0.24 + 1.48 * progress);
  const sourceImage = sprite.texture.getSourceImage(sprite.frame.name);
  const context = shineTexture.getContext();

  if (!(sourceImage instanceof HTMLImageElement) && !(sourceImage instanceof HTMLCanvasElement)) {
    return;
  }

  context.clearRect(0, 0, width, height);
  context.save();
  context.fillStyle = '#ffffff';
  context.globalAlpha = 1;

  fillRotatedRect(
    context,
    centerX,
    centerY,
    beamWidth,
    beamLength,
    (90 + S_TOOLBOX_SHINE_BEAM_TILT_DEGREES) * (Math.PI / 180)
  );

  context.globalCompositeOperation = 'destination-in';
  context.drawImage(sourceImage, 0, 0, width, height);
  context.restore();
  shineTexture.refresh();
}

function fillRotatedRect(
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
