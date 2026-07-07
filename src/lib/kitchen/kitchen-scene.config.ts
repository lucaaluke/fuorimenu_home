import type { SceneAsset, SceneChunk } from '$lib/scene/scene-asset.types';
import objectsPosition from './objects-position-new.json';

export type KitchenChefId = 'carlo';

export const kitchenAssetVersion = '20260708-kitchen-easteregg-lift-1';

const kitchenTailHeight = 1117;
const kitchenTailY = -137;
export const kitchenConstructionSceneHeight = 1330;
const kitchenConstructionChunkWidth = 2048;
const kitchenConstructionChunkHeight = kitchenConstructionSceneHeight;
const kitchenConstructionChunkFrameCount = 23;
const kitchenConstructionLeadingEmptyChunkCount = 1;
const kitchenConstructionTrailingEmptyWidth = 2000;
const kitchenConstructionFloorHeight = 166.2;
export const kitchenConstructionFloorTopY = kitchenConstructionSceneHeight;
const kitchenConstructionFloorTileWidth = kitchenConstructionFloorHeight;
const kitchenConstructionPositionScale = 0.5;
const toolShedMessage =
  'li devi trattare bene, devi dargli dei pasti molto caldi, magari dargli anche il tè o il caffè 24 ore al giorno';

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
  'cartello-stradale': 'kitchen/objects/cartello-stradale.png',
  'casse-spesa': 'kitchen/objects/casse-spesa.png',
  cono: 'kitchen/objects/cono.png',
  friggitrice: 'kitchen/objects/friggitrice.png',
  'mobile-pentole-a': 'kitchen/objects/mobile-pentole-a.png',
  'mobile-pentole-b': 'kitchen/objects/mobile-pentole-b.png',
  'mobile-planetaria': 'kitchen/objects/mobile-planetaria.png',
  sbarre: 'kitchen/objects/sbarre.png',
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
  assetWidth: 24268,
  foregroundSvgWidth: 24268,
  foregroundSvgHeight: 875,
  foregroundBottomOffset: 0,
  floorHeight: 225,
  floorBottomOffset: -96,
  floorTileWidth: 224,
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
  cursorCss: "url('/cursors/retrogusto-cursor.svg') 5 5, auto",
  pointerCursorCss: "url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer",
  title: 'Cucina',
  chefQuote:
    'Il 30 di gennaio era ancora un cantiere, quindi si entrava con l\'elmetto, col giubbotto catarifrangente e le scarpe antinfortunistiche.'
} as const;

export type KitchenSceneConfig = typeof kitchenSceneConfig;

// Background: separated furniture and large fixtures from the base layer.
const kitchenBackgroundFurnitureAssets: SceneAsset[] = [
  { id: 'bg-tall-shelf-3300', kind: 'static', src: 'kitchen-figma/kitchen-bg-3300.svg', x: 2990, y: 80, width: 500, height: 680, layer: 'background' },
  { id: 'bg-wall-cabinet-9120', kind: 'static', src: 'kitchen-figma/kitchen-bg-a.svg', x: 9120, y: 149, width: 384, height: 290, layer: 'background' },
  { id: 'bg-narrow-rack-9700', kind: 'static', src: 'kitchen-figma/kitchen-bg-9700.svg', x: 9688, y: 249, width: 220, height: 502, layer: 'background' },
  { id: 'bg-narrow-rack-10700', kind: 'static', src: 'kitchen-figma/kitchen-bg-10700.svg', x: 10610, y: 249, width: 215, height: 508, layer: 'background' },
  { id: 'bg-slim-fixture-14000', kind: 'static', src: 'kitchen-figma/kitchen-bg-14000.svg', x: 14277, y: 82, width: 37, height: 284, layer: 'background' },
  { id: 'bg-narrow-rack-14400', kind: 'static', src: 'kitchen-figma/kitchen-bg-14400.svg', x: 14420, y: 256, width: 208, height: 498, layer: 'background' },
  { id: 'bg-utility-rack-15800', kind: 'static', src: 'kitchen-figma/kitchen-bg-15800.svg', x: 15675, y: 316, width: 252, height: 436, layer: 'background' },
  { id: 'bg-narrow-rack-19600', kind: 'static', src: 'kitchen-figma/kitchen-bg-19600.svg', x: 19545, y: 252, width: 215, height: 508, layer: 'background' },
  { id: 'bg-narrow-rack-20000', kind: 'static', src: 'kitchen-figma/kitchen-bg-20000.svg', x: 19950, y: 252, width: 215, height: 508, layer: 'background' },
  { id: 'bg-wide-shelf-20300', kind: 'static', src: 'kitchen-figma/kitchen-bg-c.svg', x: 20298, y: 83, width: 710, height: 178, layer: 'background' }
];

// Background: separated small fixtures and wall details.
const kitchenBackgroundFixtureAssets: SceneAsset[] = [
  { id: 'bg-wall-rail-10950', kind: 'static', src: 'kitchen-figma/kitchen-bg-b.svg', x: 10943, y: 321, width: 290, height: 38, layer: 'background' },
  { id: 'bg-small-detail-6265', kind: 'static', src: 'kitchen-figma/kitchen-bg-e.svg', x: 6265.996, y: 324.02, width: 107.262, height: 102.98, layer: 'background' },
  { id: 'bg-small-detail-6300', kind: 'static', src: 'kitchen-figma/kitchen-bg-d.svg', x: 6299.59, y: 333.141, width: 90.415, height: 84.52, layer: 'background' },
  { id: 'bg-tall-fixture-6480', kind: 'static', src: 'kitchen-figma/kitchen-bg-f.svg', x: 6480, y: 181, width: 397, height: 579, layer: 'background' },
  { id: 'bg-slim-fixture-18430', kind: 'static', src: 'kitchen-figma/kitchen-bg-g.svg', x: 18433, y: 216, width: 72, height: 297, layer: 'background' }
];

// Background tail: furniture after the scene loops into the tail segment.
const kitchenBackgroundTailFurnitureAssets: SceneAsset[] = [
  { id: 'bg-tail-standing-cabinet-29000', kind: 'static', src: 'kitchen-figma/kitchen-bg-tail-29000.svg', x: 5300.49, y: 272.901, width: 298.16, height: 487.099, layer: 'background', isTail: true }
];

// Middle layer: small separated objects and near-floor elements.
const kitchenMiddleObjectAssets: SceneAsset[] = [
  { id: 'mid-small-object-840', kind: 'static', src: 'kitchen-figma/kitchen-mid-n.svg', x: 836, y: 710, width: 86, height: 129, layer: 'middle' },
  { id: 'mid-small-object-2130', kind: 'static', src: 'kitchen-figma/kitchen-mid-c.svg', x: 2129, y: 720, width: 86, height: 129, layer: 'middle' },
  { id: 'mid-small-object-2200', kind: 'static', src: 'kitchen-figma/kitchen-mid-f.svg', x: 2197, y: 693, width: 86, height: 129, layer: 'middle' },
  { id: 'mid-small-object-2260', kind: 'static', src: 'kitchen-figma/kitchen-mid-e.svg', x: 2261, y: 723, width: 86, height: 129, layer: 'middle' },
  { id: 'mid-small-object-4210', kind: 'static', src: 'kitchen-figma/kitchen-mid-d.svg', x: 4212, y: 731, width: 86, height: 129, layer: 'middle' },
  { id: 'mid-countertop-object-4285', kind: 'static', src: 'kitchen-figma/kitchen-mid-i.svg', x: 4286, y: 626, width: 163, height: 128, layer: 'middle' },
  { id: 'mid-countertop-object-4405', kind: 'static', src: 'kitchen-figma/kitchen-mid-j.svg', x: 4406, y: 634, width: 170, height: 134, layer: 'middle' },
  { id: 'mid-hanging-object-17345', kind: 'static', src: 'kitchen-figma/kitchen-mid-o.svg', x: 17345, y: 77, width: 91, height: 139, layer: 'middle' },
  { id: 'mid-hanging-object-17855', kind: 'static', src: 'kitchen-figma/kitchen-mid-p.svg', x: 17853, y: 77, width: 91, height: 139, layer: 'middle' }
];

// Middle layer: separated furniture blocks.
const kitchenMiddleFurnitureAssets: SceneAsset[] = [
  { id: 'mid-wide-counter-8380', kind: 'static', src: 'kitchen-figma/kitchen-mid-g.svg', x: 8383, y: 516.223, width: 567, height: 299.985, layer: 'middle' },
  { id: 'mid-small-cabinet-8895', kind: 'static', src: 'kitchen-figma/kitchen-mid-h.svg', x: 8894.001, y: 479, width: 107.663, height: 114.102, layer: 'middle' },
  { id: 'mid-wide-cabinet-13300', kind: 'static', src: 'kitchen-figma/kitchen-mid-l.svg', x: 13316, y: 388, width: 578, height: 464, layer: 'middle' },
  { id: 'mid-wide-counter-19000', kind: 'static', src: 'kitchen-figma/kitchen-mid-m.svg', x: 19014, y: 402, width: 894, height: 460, layer: 'middle' },
  { id: 'mid-tall-cabinet-22500', kind: 'static', src: 'kitchen-figma/kitchen-mid-k.svg', x: 22503, y: 259, width: 463, height: 538, layer: 'middle' }
];

// Middle tail: separated furniture in the tail segment.
const kitchenMiddleTailFurnitureAssets: SceneAsset[] = [
  { id: 'mid-tail-transition-cabinet-23600', kind: 'static', src: 'kitchen-figma/kitchen-mid-tail-seam-23600.svg', x: -673, y: 400, width: 936, height: 458, layer: 'middle', isTail: true },
  { id: 'mid-tail-wide-cabinet-31300', kind: 'static', src: 'kitchen-figma/kitchen-mid-tail-31300.svg', x: 7508, y: 299, width: 556, height: 476, layer: 'middle', isTail: true },
  { id: 'mid-tail-tall-cabinet-31900', kind: 'static', src: 'kitchen-figma/kitchen-mid-tail-31900.svg', x: 8238, y: 180, width: 247, height: 594, layer: 'middle', isTail: true },
  { id: 'mid-tail-wide-cabinet-33100', kind: 'static', src: 'kitchen-figma/kitchen-mid-tail-33100.svg', x: 9270, y: 360, width: 615, height: 415, layer: 'middle', isTail: true }
];

// Foreground tail: separated movable furniture.
const kitchenForegroundTailFurnitureAssets: SceneAsset[] = [
  { id: 'fg-tail-utility-shelf-28100', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-shelf-28100.svg', x: 4014, y: 463, width: 600, height: 428, layer: 'foreground', isTail: true },
  { id: 'fg-tail-rolling-cabinet-30000', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-30000.svg', x: 5958, y: 483, width: 744, height: 400, layer: 'foreground', isTail: true },
  { id: 'fg-tail-display-cabinet-32000', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-32000.svg', x: 8300, y: 560, width: 640, height: 310, layer: 'foreground', isTail: true },
  { id: 'fg-tail-display-cabinet-33400', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-33400.svg', x: 9570, y: 530, width: 640, height: 310, layer: 'foreground', isTail: true },
  { id: 'fg-tail-wide-cabinet-37000', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-37000.svg', x: 13108, y: 500, width: 736, height: 392, layer: 'foreground', isTail: true },
  { id: 'fg-tail-left-display-rack-40000', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-40000.svg', x: 16600, y: 500, width: 380, height: 336, layer: 'foreground', isTail: true },
  { id: 'fg-tail-right-display-rack-40700', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-40700.svg', x: 16980, y: 520, width: 340, height: 336, layer: 'foreground', isTail: true },
  { id: 'fg-tail-left-end-shelf-46000', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-46000.svg', x: 22250, y: 101, width: 295, height: 686, layer: 'foreground', isTail: true },
  { id: 'fg-tail-right-end-shelf-46200', kind: 'static', src: 'kitchen-figma/kitchen-fg-tail-46200.svg', x: 22545, y: 101, width: 295, height: 686, layer: 'foreground', isTail: true }
];

const kitchenInteractiveMiddleAssets: SceneAsset[] = [
  {
    id: 'coffee-machine',
    kind: 'interactive',
    src: 'kitchen-figma/kitchen-coffee-machine-25900.svg',
    x: 2288,
    y: 363,
    width: 194,
    height: 148,
    layer: 'foreground',
    isTail: true,
    zOffset: 4,
    ariaLabel: 'Messaggio oggetto cucina con dettagli arancioni',
    hoverDialogue: toolShedMessage,
    shineEffect: true,
    hoverDialoguePlacement: {
      left: 178,
      top: -126,
      width: 322,
      padding: 20,
      fontSize: 16,
      arrowLeft: 176,
      arrowTop: 126,
      arrowSize: 18
    }
  },
  {
    id: 'orange-detail-machine',
    kind: 'interactive',
    src: 'kitchen-figma/kitchen-orange-detail-27800.svg',
    x: 4200,
    y: 394,
    width: 170,
    height: 125,
    layer: 'foreground',
    isTail: true,
    zOffset: 4,
    ariaLabel: 'Messaggio oggetto cucina con dettagli arancioni',
    hoverDialogue: toolShedMessage,
    shineEffect: true,
    hoverDialoguePlacement: {
      left: 154,
      top: 24,
      width: 322,
      padding: 20,
      fontSize: 16,
      arrowLeft: 152,
      arrowTop: 108,
      arrowSize: 18
    }
  },
  {
    id: 'alarm-clock',
    kind: 'interactive',
    src: 'kitchen-figma/kitchen-alarm-clock-29600.svg',
    x: 6000,
    y: 401,
    width: 120,
    height: 136,
    layer: 'foreground',
    isTail: true,
    zOffset: 4,
    ariaLabel: 'Messaggio sveglia cucina',
    hoverDialogue: toolShedMessage,
    shineEffect: true,
    hoverDialoguePlacement: {
      left: 108,
      top: -138,
      width: 322,
      padding: 20,
      fontSize: 16,
      arrowLeft: 106,
      arrowTop: 138,
      arrowSize: 18
    }
  },
  {
    id: 'stove-top',
    kind: 'interactive',
    src: 'kitchen-figma/kitchen-stove-top-41700.svg',
    x: 17887,
    y: 390,
    width: 414,
    height: 108,
    layer: 'middle',
    isTail: true,
    zOffset: 4,
    ariaLabel: 'Messaggio fornelli cucina',
    hoverDialogue: toolShedMessage,
    shineEffect: true,
    hoverDialoguePlacement: {
      left: 384,
      top: -128,
      width: 322,
      padding: 20,
      fontSize: 16,
      arrowLeft: 382,
      arrowTop: 128,
      arrowSize: 18
    }
  }
];

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
  'office-figma/primopiano/easteregg.png',
  53000,
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

export const kitchenAssets: SceneAsset[] = [
  {
    id: 'layer-bg',
    kind: 'static',
    src: 'kitchen-figma/layer-bg-base.svg',
    x: 0,
    y: 0,
    width: kitchenSceneConfig.assetWidth,
    height: kitchenSceneConfig.sceneHeight,
    layer: 'background'
  },
  ...kitchenBackgroundFurnitureAssets,
  ...kitchenBackgroundFixtureAssets,
  {
    id: 'layer-bg-tail',
    kind: 'static',
    src: 'kitchen-figma/layer-bg-tail-base.svg',
    x: 0,
    y: kitchenTailY,
    width: 23000,
    height: kitchenTailHeight,
    layer: 'background',
    isTail: true
  },
  ...kitchenBackgroundTailFurnitureAssets,
  {
    id: 'layer-mid',
    kind: 'static',
    src: 'kitchen-figma/layer-mid-base.svg',
    x: 0,
    y: 0,
    width: kitchenSceneConfig.assetWidth,
    height: kitchenSceneConfig.sceneHeight,
    layer: 'middle'
  },
  ...kitchenMiddleObjectAssets,
  ...kitchenMiddleFurnitureAssets,
  ...kitchenInteractiveMiddleAssets,
  {
    id: 'layer-mid-tail',
    kind: 'static',
    src: 'kitchen-figma/layer-mid-tail-base.svg',
    x: 0,
    y: kitchenTailY,
    width: 23000,
    height: kitchenTailHeight,
    layer: 'middle',
    isTail: true
  },
	  ...kitchenMiddleTailFurnitureAssets,
	  {
    id: 'tool-shed',
    kind: 'interactive',
    src: 'casetta_attrezzi_figma.svg',
    x: 5500,
    y: 595 - 180.446,
    width: 166.747,
    height: 180.446,
    layer: 'foreground',
    zOffset: 2,
    ariaLabel: 'Messaggio casetta degli attrezzi',
    hoverDialogue: toolShedMessage,
    hoverDialogueNodeId: '3928:1640',
    hoverSound: 'toolbox',
    shineEffect: true,
    hoverDialoguePlacement: {
      left: 190,
      top: 36,
      width: 322,
      padding: 20,
      fontSize: 16,
      arrowTop: 64,
      arrowSize: 18
    }
  },
  {
    id: 'stand-mixer',
    kind: 'interactive',
    src: 'planetaria_figma.svg',
    nodeId: '3622:4038',
    x: 6690,
    y: 545 - 160,
    width: 154,
    height: 160,
    layer: 'foreground',
    zOffset: 1,
    hoverDialogue: toolShedMessage,
    hoverDialogueNodeId: '3950:1617',
    hoverSound: 'mixer',
    shineEffect: true,
    hoverDialoguePlacement: {
      left: 168,
      top: 8,
      width: 322,
      padding: 20,
      fontSize: 16,
      arrowLeft: 168,
      arrowTop: 102,
      arrowSize: 18
    }
  },
  {
    id: 'layer-fg',
    kind: 'static',
    src: 'layer-fg.svg',
    x: 0,
    y: 0,
    width: kitchenSceneConfig.assetWidth,
    height: kitchenSceneConfig.foregroundSvgHeight,
    layer: 'foreground'
  },
  {
    id: 'layer-fg-tail',
    kind: 'static',
    src: 'layer-fg-tail.svg',
    x: 0,
    y: kitchenTailY,
    width: 23000,
    height: kitchenTailHeight,
    layer: 'foreground',
    isTail: true
  },
  ...kitchenForegroundTailFurnitureAssets
];
