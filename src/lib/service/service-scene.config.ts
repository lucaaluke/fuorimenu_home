import type { SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';

const serviceChunkCount = 16;
export const serviceChunkWidth = 2048;
export const serviceSceneHeight = 1330;
export const serviceBackgroundOffsetY = 4;
const serviceExportScale = 0.5;
const serviceFloorHeight = 166.2;
const serviceFloorTileWidth = serviceFloorHeight;
const serviceLayerSpeed = {
  background: 1,
  middle: 1.5,
  floor: 1,
  foreground: 2,
  title: 0.8
} as const;

export const serviceSceneConfig = {
  sceneWidth: 0,
  sceneHeight: serviceSceneHeight,
  assetVersion: '20260706-service-ascii-assets-1',
  layerSpeed: serviceLayerSpeed
} as const;

function serviceLayerAsset(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  folder: 'primopiano' | 'secondopiano' = 'primopiano',
  layer: 'middle' | 'foreground' = 'foreground',
  hover?: Pick<
    SceneAsset,
    'hoverAnimation' | 'hoverPopHeightMultiplier' | 'hoverSoundTrigger' | 'idleAnimation' | 'hoverSoundSrc' | 'hoverSoundVolume'
  >
): SceneAsset {
  return {
    id: name,
    kind: 'static',
    src: `servizio-figma/${folder}/${name}.png`,
    x: Number((x * serviceExportScale).toFixed(2)),
    y: Number((y * serviceExportScale).toFixed(2)),
    width: Number((width * serviceExportScale).toFixed(2)),
    height: Number((height * serviceExportScale).toFixed(2)),
    layer,
    ...hover
  };
}

export const serviceBackgroundChunks: SceneChunk[] = Array.from(
  { length: serviceChunkCount },
  (_, index) => ({
    layer: 'background',
    frameIndex: index,
    figmaX: index * serviceChunkWidth,
    figmaY: 0,
    figmaWidth: serviceChunkWidth,
    figmaHeight: serviceSceneHeight,
    assetKey: `service-slice-${index + 1}`
  })
);

export const serviceForegroundAssets: SceneAsset[] = [
  serviceLayerAsset('1_BottiglieVaso', 81239, 1114, 359, 589, 'primopiano', 'foreground', {
    hoverAnimation: 'shake',
    hoverSoundTrigger: 'hover',
    idleAnimation: 'sway',
    hoverSoundSrc: 'ghiacciook.mp3',
    hoverSoundVolume: 0.54
  }),
  serviceLayerAsset('1_direzione', 3895, 1703, 1117, 957),
  serviceLayerAsset('1_mobilepiatti', 16125, 1846, 1783, 1163),
  serviceLayerAsset('1_tavolocam', 49464, 1753, 3239, 997),
  serviceLayerAsset('1_bidoni', 109761, 1777, 4606, 1330),
  serviceLayerAsset('1_carrellini', 6379, 1899, 1623, 764),
  serviceLayerAsset('1_posate', 8998, 1812, 1969, 1009),
  serviceLayerAsset('1_te', 13136, 1689, 1623, 973),
  serviceLayerAsset('1_mobilecloche', 19454, 1679, 1757, 1122),
  serviceLayerAsset('1_cloche', 20646, 1668, 1428, 415, 'primopiano', 'foreground', {
    hoverAnimation: 'shake',
    hoverSoundTrigger: 'hover',
    idleAnimation: 'bob',
    hoverSoundSrc: 'clocheok.mp3',
    hoverSoundVolume: 0.52
  }),
  serviceLayerAsset('1_Mobileassaggini', 22834, 1619, 3423, 1041),
  serviceLayerAsset('1_tavolopane', 33320, 1797, 3124, 946),
  serviceLayerAsset('1_tavolo', 38900, 1776, 3967, 989),
  serviceLayerAsset('1_tavolo2', 45268, 1782, 3144, 968),
  serviceLayerAsset('1_camera', 50015, 1784, 451, 275, 'primopiano', 'foreground', {
    hoverAnimation: 'shake',
    hoverSoundTrigger: 'hover',
    idleAnimation: 'sway',
    hoverSoundSrc: 'camera.mp3',
    hoverSoundVolume: 0.54
  }),
  serviceLayerAsset('1_colazione', 56239, 999, 2460, 1666),
  serviceLayerAsset('1_colazione2', 59790, 996, 2460, 1666),
  serviceLayerAsset('1_brocca', 60134, 1736, 254, 270, 'primopiano', 'foreground', {
    hoverAnimation: 'shake',
    hoverSoundTrigger: 'hover',
    idleAnimation: 'sway',
    hoverSoundSrc: 'broccaok.mp3',
    hoverSoundVolume: 0.54
  }),
  serviceLayerAsset('1_lattuga', 66023, 1557, 2057, 1322),
  serviceLayerAsset('1_pollo', 69641, 1557, 2057, 1322),
  serviceLayerAsset('1_calici', 72703, 1703, 1935, 959),
  serviceLayerAsset('1_calici2', 81181, 1436, 1935, 1225),
  serviceLayerAsset('1_carrelli', 89505, 1639, 2468, 1024),
  serviceLayerAsset('1_Lunchbox', 90198, 1638, 372, 178, 'primopiano', 'foreground', {
    hoverAnimation: 'shake',
    hoverSoundTrigger: 'hover',
    idleAnimation: 'bob',
    hoverSoundSrc: 'lunchboxok.mp3',
    hoverSoundVolume: 0.55
  }),
  serviceLayerAsset('1_mobilepiatti-2', 96713, 1576, 1879, 1228),
  serviceLayerAsset('1_mobilepiatti-1', 100422, 1576, 1880, 1228),
  serviceLayerAsset('1_peperoni', 104780, 2113, 1054, 550),
  serviceLayerAsset('1_acqua', 106822, 1891, 1103, 771),
  serviceLayerAsset('1_barili', 116536, 1854, 1012, 805),
  serviceLayerAsset('1_scaffali', 118416, 2159, 2951, 594),
  serviceLayerAsset('1_furgone', 124418, 1043, 4182, 1696)
];

export const serviceMiddleAssets: SceneAsset[] = [
  serviceLayerAsset('2_mobileconlampada', 4745, 314, 1371, 2078, 'secondopiano', 'middle'),
  serviceLayerAsset('2_mobilepiatti', 7771, 1522, 1699, 873, 'secondopiano', 'middle'),
  serviceLayerAsset('2_mobilecaffe', 11005, 328, 2753, 2203, 'secondopiano', 'middle'),
  serviceLayerAsset('2_banconecibo', 14619, 1255, 5893, 1136, 'secondopiano', 'middle'),
  serviceLayerAsset('2_spaghetti', 21970, 1373, 5232, 1024, 'secondopiano', 'middle'),
  serviceLayerAsset('2_mobilemascotte', 31871, 1284, 5663, 1111, 'secondopiano', 'middle'),
  serviceLayerAsset('2_mascotte', 32250, 1284, 279, 422, 'secondopiano', 'middle', {
    hoverAnimation: 'pop',
    hoverPopHeightMultiplier: 1.85,
    hoverSoundTrigger: 'hover',
    idleAnimation: 'sway',
    hoverSoundSrc: 'macotteok.mp3',
    hoverSoundVolume: 0.55
  }),
  serviceLayerAsset('2_frigo', 39852, 839, 2446, 1554, 'secondopiano', 'middle'),
  serviceLayerAsset('2_carrellivassoi-1', 44225, 609, 1534, 1783, 'secondopiano', 'middle'),
  serviceLayerAsset('2_carrellivassoi', 49475, 609, 1534, 1783, 'secondopiano', 'middle'),
  serviceLayerAsset('2_mobilegrande', 58030, 1353, 5411, 1038, 'secondopiano', 'middle'),
  serviceLayerAsset('2_cibarie', 66314, 1100, 6694, 1293, 'secondopiano', 'middle'),
  serviceLayerAsset('2_mobilibarattoli', 75517, 581, 3546, 1813, 'secondopiano', 'middle'),
  serviceLayerAsset('2_vassoi', 80460, 1562, 1706, 829, 'secondopiano', 'middle'),
  serviceLayerAsset('2_carreliscatole', 84141, 1368, 2468, 1033, 'secondopiano', 'middle'),
  serviceLayerAsset('2_carrellivassoi2', 88522, 908, 3419, 1484, 'secondopiano', 'middle'),
  serviceLayerAsset('2_bancali', 94562, 1453, 1959, 946, 'secondopiano', 'middle')
];

export const serviceSceneWidth = Math.ceil(
  Math.max(
    serviceChunkCount * serviceChunkWidth,
    ...serviceMiddleAssets.map((asset) => (asset.x + asset.width) / serviceLayerSpeed.middle),
    ...serviceForegroundAssets.map((asset) => (asset.x + asset.width) / serviceLayerSpeed.foreground)
  )
);

export const serviceFloorAssets: SceneAsset[] = Array.from(
  { length: Math.ceil(serviceSceneWidth / serviceFloorTileWidth) + 2 },
  (_, index) => ({
    id: `service-floor-${index.toString().padStart(3, '0')}`,
    kind: 'static',
    src: 'kitchen/objects/pavimento.png',
    x: Number((index * serviceFloorTileWidth).toFixed(2)),
    y: 0,
    width: serviceFloorTileWidth,
    height: serviceFloorHeight,
    layer: 'foreground',
    viewportBottomAligned: true,
    overlapX: 2,
    zOffset: 1
  })
);

export const resolvedServiceSceneConfig = {
  ...serviceSceneConfig,
  sceneWidth: serviceSceneWidth
} as const;
