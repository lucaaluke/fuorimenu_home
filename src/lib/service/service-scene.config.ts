import type { SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';

const serviceChunkCount = 16;
export const serviceChunkWidth = 2048;
export const serviceSceneHeight = 1330;
export const serviceBackgroundOffsetY = 4;
const serviceExportScale = 0.5;
const serviceLayerSpeed = {
  background: 1,
  foreground: 2,
  title: 0.8
} as const;

export const serviceSceneConfig = {
  sceneWidth: 0,
  sceneHeight: serviceSceneHeight,
  assetVersion: '20260704-service-sfondo-1',
  layerSpeed: serviceLayerSpeed
} as const;

function serviceLayerAsset(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number
): SceneAsset {
  return {
    id: name,
    kind: 'static',
    src: `servizio-figma/primopiano/${name}.png`,
    x: Number((x * serviceExportScale).toFixed(2)),
    y: Number((y * serviceExportScale).toFixed(2)),
    width: Number((width * serviceExportScale).toFixed(2)),
    height: Number((height * serviceExportScale).toFixed(2)),
    layer: 'foreground'
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
  serviceLayerAsset('1_BottiglieVaso', 81239, 1061, 434, 749),
  serviceLayerAsset('1_direzione', 3895, 1703, 1117, 957),
  serviceLayerAsset('1_mobilepiatti', 16125, 1846, 1783, 1163),
  serviceLayerAsset('1_tavolocam', 49464, 1753, 3239, 997),
  serviceLayerAsset('1_bidoni', 109761, 1777, 4606, 1330),
  serviceLayerAsset('1_carrellini', 6379, 1899, 1623, 764),
  serviceLayerAsset('1_posate', 8998, 1812, 1969, 1009),
  serviceLayerAsset('1_tè', 13136, 1689, 1623, 973),
  serviceLayerAsset('1_mobilecloche', 19454, 1679, 1757, 1122),
  serviceLayerAsset('1_cloche', 20646, 1668, 1428, 415),
  serviceLayerAsset('1_Mobileassaggini', 22834, 1619, 3423, 1041),
  serviceLayerAsset('1_tavolopane', 33320, 1797, 3124, 946),
  serviceLayerAsset('1_tavolo', 38900, 1776, 3967, 989),
  serviceLayerAsset('1_tavolo2', 45268, 1782, 3144, 968),
  serviceLayerAsset('1_camera', 50015, 1784, 451, 275),
  serviceLayerAsset('1_colazione', 56239, 999, 2460, 1666),
  serviceLayerAsset('1_colazione2', 59790, 996, 2460, 1666),
  serviceLayerAsset('1_brocca', 60134, 1736, 254, 270),
  serviceLayerAsset('1_lattuga', 66023, 1557, 2057, 1322),
  serviceLayerAsset('1_pollo', 69641, 1557, 2057, 1322),
  serviceLayerAsset('1_calici', 72703, 1703, 1935, 959),
  serviceLayerAsset('1_calici2', 81181, 1436, 1935, 1225),
  serviceLayerAsset('1_carrelli', 89505, 1639, 2468, 1024),
  serviceLayerAsset('1_Lunchbox', 90198, 1638, 372, 178),
  serviceLayerAsset('1_mobilepiatti-2', 96713, 1576, 1879, 1228),
  serviceLayerAsset('1_mobilepiatti-1', 100422, 1576, 1880, 1228),
  serviceLayerAsset('1_peperoni', 104780, 2113, 1054, 550),
  serviceLayerAsset('1_acqua', 106822, 1891, 1103, 771),
  serviceLayerAsset('1_barili', 116536, 1854, 1012, 805),
  serviceLayerAsset('1_scaffali', 118416, 2159, 2951, 594),
  serviceLayerAsset('1_furgone', 124418, 1043, 4182, 1696)
];

export const serviceSceneWidth = Math.ceil(
  Math.max(
    serviceChunkCount * serviceChunkWidth,
    ...serviceForegroundAssets.map((asset) => (asset.x + asset.width) / serviceLayerSpeed.foreground)
  )
);

export const resolvedServiceSceneConfig = {
  ...serviceSceneConfig,
  sceneWidth: serviceSceneWidth
} as const;
