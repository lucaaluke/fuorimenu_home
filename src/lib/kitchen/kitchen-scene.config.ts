import type { SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';
import objectsPosition from './objects-position-new.json';

export type KitchenChefId = 'carlo';

export const kitchenAssetVersion = '20260708-kitchen-easteregg-lift-1';

export const kitchenConstructionSceneHeight = 1330;
const kitchenConstructionChunkWidth = 2048;
const kitchenConstructionChunkHeight = kitchenConstructionSceneHeight;
const kitchenConstructionChunkFrameCount = 23;
const kitchenConstructionLeadingEmptyChunkCount = 1;
const kitchenConstructionFloorHeight = 166.2;
export const kitchenConstructionFloorTopY = kitchenConstructionSceneHeight;
const kitchenConstructionFloorTileWidth = kitchenConstructionFloorHeight;
const kitchenConstructionPositionScale = 0.5;

type KitchenObjectPosition = {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const kitchenConstructionForegroundObjectZOffset = 8;
const kitchenConstructionMiddlegroundObjectZOffset = 4;

const kitchenConstructionExistingObjectNames = new Set([
  'cartello-cantiere',
  'cono_1',
  'transenna',
  'cono_2',
  'cono_3',
  'cono_4',
  'sabbia-pala',
  'cariola',
  'mattoni-pila'
]);

const kitchenConstructionObjectSourceByName: Record<string, string> = {
  '2-S-fornelli-a': 'kitchen/objects/2_S_fornelli-a.png',
  '2-S-fornelli-b': 'kitchen/objects/2_S_fornelli-b.png',
  '2-cappe-fornelli': 'kitchen/objects/2_cappe-fornelli.png',
  '2-carrello-brocche': 'kitchen/objects/2_carrello-brocche.png',
  '2-carrello-pentole': 'kitchen/objects/2_carrello-pentole.png',
  '2-carrello-vassoi': 'kitchen/objects/2_carrello-vassoi.png',
  '2-cassetta-martello': 'kitchen/objects/2_cassetta-martello.png',
  '2-frigo-aperto': 'kitchen/objects/2_frigo-aperto.png',
  '2-lampadari': 'kitchen/objects/2_lampadari.png',
  '2-lavello': 'kitchen/objects/2_lavello.png',
  '2-mobile-spremute': 'kitchen/objects/2_mobile-spremute.png',
  '2-mobili-cascograttugia': 'kitchen/objects/2_mobili-cascograttugia.png',
  '2-pila-mattoni-g': 'kitchen/objects/2_pila-mattoni-g.png',
  '2-secchi-sabbia': 'kitchen/objects/2_secchi-sabbia.png',
  '2-secchio-p': 'kitchen/objects/2_secchio-p.png',
  '2-tavoli-pane': 'kitchen/objects/2_tavoli-pane.png',
  '2-tavoli-sci': 'kitchen/objects/2_tavoli-sci.png',
  '2-tavolo-colapasta': 'kitchen/objects/2_tavolo-colapasta.png',
  '2-tavolo-salepepe': 'kitchen/objects/2_tavolo-salepepe.png',
  '2-tavolo-tupperware': 'kitchen/objects/2_tavolo-tupperware.png',
  'S-cassetta-attrezzi': 'kitchen/objects/S_cassetta-attrezzi.png',
  'S-cono': 'kitchen/objects/S_cono.png',
  'S-kit-pulizie-a': 'kitchen/objects/S_kit-pulizie-a.png',
  'S-kit-pulizie-b': 'kitchen/objects/S_kit-pulizie-b.png',
  'S-macchinetta-caffe': 'kitchen/objects/S_macchinetta-caffe.png',
  'S-planetaria': 'kitchen/objects/S_planetaria.png',
  'S-sveglia': 'kitchen/objects/S_sveglia.png',
  'carrelli-piatti': 'kitchen/objects/carrelli-piatti.png',
  'carrello-pulizie': 'kitchen/objects/carrello-pulizie.png',
  'casse-spesa': 'kitchen/objects/casse-spesa.png',
  friggitrice: 'kitchen/objects/friggitrice.png',
  'mobile-pentole-a': 'kitchen/objects/mobile-pentole-a.png',
  'mobile-pentole-b': 'kitchen/objects/mobile-pentole-b.png',
  'mobile-planetaria': 'kitchen/objects/mobile-planetaria.png',
  scatoloni: 'kitchen/objects/scatoloni.png',
  sgabello: 'kitchen/objects/sgabello.png',
  'tavolo-caffe': 'kitchen/objects/tavolo-caffe.png',
  'tavolo-cappello-a': 'kitchen/objects/tavolo-cappello-a.png',
  'tavolo-elmetto': 'kitchen/objects/tavolo-elmetto.png',
  'tavolo-spremuta': 'kitchen/objects/tavolo-spremuta.png',
  'tavolo-sveglia': 'kitchen/objects/tavolo-sveglia.png',
  'tavolo-verdure': 'kitchen/objects/tavolo-verdure.png'
};

function isKitchenObjectPosition(value: unknown): value is KitchenObjectPosition {
  if (!value || typeof value !== 'object') return false;
  const position = value as Partial<KitchenObjectPosition>;

  return (
    typeof position.name === 'string' &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    typeof position.width === 'number' &&
    typeof position.height === 'number'
  );
}

function isKitchenMiddlegroundNote(value: unknown): boolean {
  if (typeof value === 'string') return value.toLowerCase().includes('middleground') || value.toLowerCase().includes('middlegournd');
  if (!value || typeof value !== 'object') return false;

  return Object.values(value).some(
    (entry) =>
      typeof entry === 'string' &&
      (entry.toLowerCase().includes('middleground') || entry.toLowerCase().includes('middlegournd'))
  );
}

const kitchenConstructionSceneWidth = 36000;

export const kitchenSceneConfig = {
  sceneWidth: kitchenConstructionSceneWidth,
  sceneHeight: 1330,
  chef: {
    id: 'carlo' as KitchenChefId,
    x: 1100,
    width: 185,
    visibleThreshold: 0.34
  },
  layerSpeed: {
    background: 0.42,
    middle: 0.74,
    title: 0.8,
    chef: 0.8,
    foreground: 1
  },
  cursorCss: "url('/assets/ui/cursors/retrogusto-cursor.svg') 5 5, auto",
  pointerCursorCss: "url('/assets/ui/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer",
  title: 'Cucina',
  chefQuote:
    'Il 30 di gennaio era ancora un cantiere, quindi si entrava con l\'elmetto, col giubbotto catarifrangente e le scarpe antinfortunistiche.'
} as const;

export type KitchenSceneConfig = typeof kitchenSceneConfig;

export const kitchenConstructionChunks: SceneChunk[] = Array.from(
  { length: kitchenConstructionChunkFrameCount },
  (_, frameIndex) => ({
    layer: 'foreground',
    frameIndex,
    figmaX: kitchenConstructionChunkWidth * (frameIndex + kitchenConstructionLeadingEmptyChunkCount),
    figmaY: 0,
    figmaWidth: kitchenConstructionChunkWidth,
    figmaHeight: kitchenConstructionChunkHeight,
    assetKey: `fg-frame-${frameIndex.toString().padStart(2, '0')}`
  })
);

const kitchenConstructionFloorAssets: SceneAsset[] = Array.from(
  { length: Math.ceil(kitchenConstructionSceneWidth / kitchenConstructionFloorTileWidth) + 1 },
  (_, index) => ({
    id: `pavimento-${index.toString().padStart(2, '0')}`,
    kind: 'static',
    src: 'kitchen/objects/pavimento.png',
    x: Number((index * kitchenConstructionFloorTileWidth).toFixed(2)),
    y: 0,
    width: kitchenConstructionFloorTileWidth,
    height: kitchenConstructionFloorHeight,
    layer: 'foreground',
    viewportBottomAligned: true,
    overlapX: 2,
    zOffset: 1
  })
);

function kitchenConstructionObjectAsset(
  id: string,
  src: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zOffset = 8
): SceneAsset {
  return {
    id,
    kind: 'static',
    src,
    x: x * kitchenConstructionPositionScale,
    y: y * kitchenConstructionPositionScale,
    width: width * kitchenConstructionPositionScale,
    height: height * kitchenConstructionPositionScale,
    layer: 'foreground',
    zOffset
  };
}

const kitchenConstructionObjectPositionByName = new Map<string, KitchenObjectPosition>();

for (const position of objectsPosition as unknown[]) {
  if (!isKitchenObjectPosition(position)) continue;
  kitchenConstructionObjectPositionByName.set(position.name.trim(), position);
}

function kitchenConstructionObjectAssetFromPosition(
  positionName: string,
  id: string,
  src: string,
  fallbackX: number,
  fallbackY: number,
  fallbackWidth: number,
  fallbackHeight: number,
  zOffset = kitchenConstructionForegroundObjectZOffset
) {
  const position = kitchenConstructionObjectPositionByName.get(positionName);

  return kitchenConstructionObjectAsset(
    id,
    src,
    position?.x ?? fallbackX,
    position?.y ?? fallbackY,
    position?.width ?? fallbackWidth,
    position?.height ?? fallbackHeight,
    zOffset
  );
}

function kitchenConstructionUnscaledObjectAsset(
  position: KitchenObjectPosition,
  zOffset = kitchenConstructionForegroundObjectZOffset
): SceneAsset | undefined {
  const normalizedName = position.name.trim().replaceAll('_', '-');
  const sourceName = normalizedName.replace(/-\d+$/, '');
  const src =
    kitchenConstructionObjectSourceByName[position.name.trim()] ??
    kitchenConstructionObjectSourceByName[normalizedName] ??
    kitchenConstructionObjectSourceByName[sourceName];
  if (!src) return undefined;

  return {
    id: normalizedName,
    kind: 'static',
    src,
    x: position.x * kitchenConstructionPositionScale,
    y: position.y * kitchenConstructionPositionScale,
    width: position.width * kitchenConstructionPositionScale,
    height: position.height * kitchenConstructionPositionScale,
    layer: 'foreground',
    zOffset
  };
}

const kitchenConstructionPlacedAssets: SceneAsset[] = [
  kitchenConstructionObjectAssetFromPosition(
    'cartello-cantiere',
    'cartello-cantiere',
    'kitchen/objects/cartello-cantiere.png',
    4415,
    2080,
    491,
    654
  ),
  kitchenConstructionObjectAssetFromPosition('cono_1', 'cono-1', 'kitchen/objects/cono-cantiere.png', 5748, 2256, 223, 339, 9),
  kitchenConstructionObjectAssetFromPosition('transenna', 'transenna', 'kitchen/objects/transenna.png', 8478, 1891, 1157, 711, 7),
  kitchenConstructionObjectAssetFromPosition('cono_2', 'cono-2', 'kitchen/objects/cono-cantiere.png', 9988, 2275, 223, 339, 9),
  kitchenConstructionObjectAssetFromPosition('cono_3', 'cono-3', 'kitchen/objects/cono-cantiere.png', 10304, 2199, 223, 339, 9),
  kitchenConstructionObjectAssetFromPosition('sabbia-pala', 'sabbia-pala', 'kitchen/objects/sabbia-pala.png', 12793, 1961, 1520, 899),
  kitchenConstructionObjectAssetFromPosition('cariola', 'cariola', 'kitchen/objects/cariola.png', 16498, 2080, 1120, 691),
  kitchenConstructionObjectAssetFromPosition('mattoni-pila', 'mattoni-pila', 'kitchen/objects/mattoni-pila.png', 18887, 2470, 868, 243)
];

const kitchenConstructionEasterEggAsset: SceneAsset = kitchenConstructionObjectAsset(
  'easteregg',
  'office/figma/primopiano/easteregg.png',
  53300,
  -221,
  310,
  1167,
  kitchenConstructionForegroundObjectZOffset
);

function kitchenConstructionObjectZOffset(id: string, fallback: number) {
  if (id === 'S-kit-pulizie-a') return fallback - 1;

  return fallback;
}

const kitchenConstructionAdditionalPlacedAssets: SceneAsset[] = [];
let isReadingMiddlegroundObjects = false;

for (const position of objectsPosition as unknown[]) {
  if (isKitchenMiddlegroundNote(position)) {
    isReadingMiddlegroundObjects = true;
    continue;
  }

  if (!isKitchenObjectPosition(position)) continue;
  if (kitchenConstructionExistingObjectNames.has(position.name)) continue;

  const normalizedName = position.name.trim().replaceAll('_', '-');
  const zOffset =
    isReadingMiddlegroundObjects || normalizedName.startsWith('2-')
      ? kitchenConstructionMiddlegroundObjectZOffset
      : kitchenConstructionForegroundObjectZOffset;
  const asset = kitchenConstructionUnscaledObjectAsset(
    position,
    kitchenConstructionObjectZOffset(normalizedName, zOffset)
  );
  if (asset) kitchenConstructionAdditionalPlacedAssets.push(asset);
}

export const kitchenConstructionObjectAssets: SceneAsset[] = [
  ...kitchenConstructionFloorAssets,
  ...kitchenConstructionPlacedAssets,
  ...kitchenConstructionAdditionalPlacedAssets,
  kitchenConstructionEasterEggAsset
];
