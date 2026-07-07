import type { InteractiveSceneAsset, SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';

const officeChunkCount = 16;
export const officeChunkWidth = 2048;
export const officeSceneHeight = 1330;
export const officeBackgroundOffsetY = 4;
const officeExportScale = 0.5;
const officeFloorHeight = 166.2;
const officeFloorTileWidth = officeFloorHeight;

function getAssetEndX(asset: Pick<SceneAsset, 'x' | 'width'>) {
  return asset.x + asset.width;
}

function getLayerSceneWidth(assets: SceneAsset[], speed: number) {
  return assets.reduce((width, asset) => Math.max(width, getAssetEndX(asset) / speed), 0);
}

export const officeSceneConfig = {
  sceneWidth: 33068,
  sceneHeight: officeSceneHeight,
  assetVersion: '20260708-office-assets-1',
  layerSpeed: {
    background: 1,
    middle: 1.5,
    title: 0.8,
    floor: 1,
    foreground: 2
  }
} as const;

function officeLayerAsset(
  folder: 'primopiano' | 'secondopiano',
  name: string,
  x: number,
  y: number,
  width: number,
  height: number
): SceneAsset {
  return {
    id: name,
    kind: 'static',
    src: `office-figma/${folder}/${name}.png`,
    x: Number((x * officeExportScale).toFixed(2)),
    y: Number((y * officeExportScale).toFixed(2)),
    width: Number((width * officeExportScale).toFixed(2)),
    height: Number((height * officeExportScale).toFixed(2)),
    layer: folder === 'primopiano' ? 'foreground' : 'middle'
  };
}

function officeInteractiveAsset(
  folder: 'primopiano' | 'secondopiano',
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  ariaLabel: string
): InteractiveSceneAsset {
  return {
    ...officeLayerAsset(folder, name, x, y, width, height),
    kind: 'interactive',
    ariaLabel,
    shineEffect: true
  };
}

export const officeBackgroundChunks: SceneChunk[] = Array.from(
  { length: officeChunkCount },
  (_, index) => ({
    layer: 'background',
    frameIndex: index,
    figmaX: index * officeChunkWidth,
    figmaY: 0,
    figmaWidth: officeChunkWidth,
    figmaHeight: officeSceneHeight,
    assetKey: `office-slice-${index + 1}`
  })
);

export const officeForegroundAssets: SceneAsset[] = [
  officeLayerAsset('primopiano', '1_raccoglitori', 6998, 1733, 1173, 924),
  officeInteractiveAsset('primopiano', '1_cio', 14428, 1634, 443, 268, 'Elemento interattivo CIO ufficio'),
  officeLayerAsset('primopiano', '1_tavolosedielibri', 13189, 1667, 4889, 988),
  officeLayerAsset('primopiano', '1_sediedesign', 20637, 1765, 3183, 903),
  officeLayerAsset('primopiano', '1_attaccapannibidoni', 26066, 782, 2138, 1878),
  officeLayerAsset('primopiano', '1_tavolosediedesign', 31887, 1772, 3595, 889),
  officeInteractiveAsset('primopiano', '1_mappa', 43749, 1033, 1418, 1627, 'Mappa interattiva ufficio'),
  officeLayerAsset('primopiano', '1_scrivaniamonitor', 36573, 1662, 1656, 997),
  officeInteractiveAsset('primopiano', '1_chiavi', 38010, 2136, 269, 234, 'Chiavi interattive ufficio'),
  officeLayerAsset('primopiano', '1_carrellino', 41208, 1805, 678, 854),
  officeLayerAsset('primopiano', '1_scrivaniamonitor2', 46612, 1381, 1886, 1276),
  officeLayerAsset('primopiano', '1_tavolosedia', 51396, 1772, 1620, 890),
  officeLayerAsset('primopiano', '1_mobilemedaglie', 55508, 1671, 1130, 992),
  officeLayerAsset('primopiano', '1_poltroncinatavolo', 58571, 1920, 1786, 740),
  officeLayerAsset('primopiano', '1_mobiletelefono', 61961, 1795, 1612, 878),
  officeLayerAsset('primopiano', '1_cartelli', 66379, 1495, 3094, 1165),
  officeLayerAsset('primopiano', '1_faldoni', 74808, 1666, 995, 995),
  officeLayerAsset('primopiano', '1_cassetti', 81219, 2069, 1355, 621),
  officeLayerAsset('primopiano', '1_postazione1', 83817, 1744, 1829, 916),
  officeLayerAsset('primopiano', '1_postazione2', 85915, 1769, 1830, 891),
  officeLayerAsset('primopiano', '1_poltroncine', 92587, 2018, 2861, 653),
  officeLayerAsset('primopiano', '1_megatavolo', 99371, 0, 5723, 2659),
  officeInteractiveAsset('primopiano', 'easteregg', 101517, 0, 310, 1167, 'Easter egg interattivo ufficio'),
  officeLayerAsset('primopiano', '1_mobiletv', 105482, 579, 759, 2081),
  officeLayerAsset('primopiano', '1_divano-1', 108060, 1956, 1620, 705),
  officeLayerAsset('primopiano', '1_tavolinopianta', 110232, 1921, 846, 740),
  officeLayerAsset('primopiano', '1_divano', 111631, 1955, 1618, 705),
  officeLayerAsset('primopiano', '1_scrivaniacomodini', 115623, 1528, 1983, 1133),
  officeLayerAsset('primopiano', '1_scrivaniacomodini2', 117492, 1526, 1983, 1133),
  officeLayerAsset('primopiano', '1_scrivaniacomodini3', 119592, 1531, 1983, 1133),
  officeLayerAsset('primopiano', '1_acqua', 121927, 1331, 315, 1333),
  officeLayerAsset('primopiano', '1_tavolotazza', 124717, 1335, 2725, 1330),
  officeLayerAsset('primopiano', '1_carrellinofaldoni2', 129031, 1655, 816, 1016),
  officeLayerAsset('primopiano', '1_carrellinofaldoni3', 131443, 1658, 827, 1014)
];

export const officeMiddleAssets: SceneAsset[] = [
  officeLayerAsset('secondopiano', '2_mobilestampa', 4927, 1456, 1485, 940),
  officeLayerAsset('secondopiano', '2_scrivaniacestino', 9209, 1257, 2571, 1138),
  officeLayerAsset('secondopiano', '2_pianta', 12399, 870, 805, 1536),
  officeLayerAsset('secondopiano', '2_mobilescomparto', 16001, 577, 702, 1848),
  officeLayerAsset('secondopiano', '2_acqua', 19931, 837, 355, 1555),
  officeLayerAsset('secondopiano', '2_mobilecaffe', 23851, 1211, 707, 1230),
  officeLayerAsset('secondopiano', '2_sedie', 25246, 1525, 1526, 875),
  officeLayerAsset('secondopiano', '2_mobilino', 28983, 1610, 938, 791),
  officeLayerAsset('secondopiano', '2_postazione', 31142, 1678, 1314, 718),
  officeLayerAsset('secondopiano', '2_postazione2', 35095, 1640, 1072, 755),
  officeLayerAsset('secondopiano', '2_tavolocassetti', 39291, 1804, 1404, 591),
  officeLayerAsset('secondopiano', '2_stampante', 42107, 1391, 1022, 1001),
  officeLayerAsset('secondopiano', '2_3cassetti', 46152, 1515, 382, 878),
  officeLayerAsset('secondopiano', '2_libreria', 48742, 967, 483, 1428),
  officeLayerAsset('secondopiano', '2_postazione3', 49963, 1735, 1187, 666),
  officeLayerAsset('secondopiano', '2_postazionetelefono', 57469, 1736, 1133, 743),
  officeLayerAsset('secondopiano', '2_faldoni', 60933, 1682, 567, 726),
  officeLayerAsset('secondopiano', '2_stampacestino', 65590, 1587, 732, 808),
  officeLayerAsset('secondopiano', '2_mobilozzi', 67683, 1860, 1905, 535),
  officeLayerAsset('secondopiano', '2_postazionecestino2', 70321, 1576, 1653, 821),
  officeLayerAsset('secondopiano', '2_acqua2', 73608, 1238, 265, 1155),
  officeLayerAsset('secondopiano', '2_scrivanie', 76366, 1437, 4166, 1023),
  officeInteractiveAsset('secondopiano', '2_computerint', 78765, 1658, 332, 301, 'Computer interattivo ufficio'),
  officeLayerAsset('secondopiano', '2_stampacestino2', 89178, 1321, 1290, 1084),
  officeLayerAsset('secondopiano', '2_scrivaniacomodini3', 91366, 1392, 1222, 1057),
  officeLayerAsset('secondopiano', '2_scrivaniacomodini2', 92945, 1392, 1222, 1057),
  officeLayerAsset('secondopiano', '2_scrivaniacomodini', 94524, 1389, 1222, 1057),
  officeLayerAsset('secondopiano', '2_cassetti', 96348, 1839, 1241, 550),
  officeLayerAsset('secondopiano', '2_piantalibreria', 98073, 1010, 1111, 1398)
];

export const officeSceneWidth = Math.ceil(
  Math.max(
    officeChunkCount * officeChunkWidth,
    getLayerSceneWidth(officeMiddleAssets, officeSceneConfig.layerSpeed.middle),
    getLayerSceneWidth(officeForegroundAssets, officeSceneConfig.layerSpeed.foreground)
  )
);

export const officeFloorAssets: SceneAsset[] = Array.from(
  { length: Math.ceil(officeSceneWidth / officeFloorTileWidth) + 2 },
  (_, index) => ({
    id: `office-floor-${index.toString().padStart(3, '0')}`,
    kind: 'static',
    src: 'kitchen/objects/pavimento.png',
    x: Number((index * officeFloorTileWidth).toFixed(2)),
    y: 0,
    width: officeFloorTileWidth,
    height: officeFloorHeight,
    layer: 'foreground',
    viewportBottomAligned: true,
    overlapX: 2,
    zOffset: 1
  })
);
