/// <reference types="@figma/plugin-typings" />

type ExportedKitchenAsset = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
};

function toAssetId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function roundFigmaValue(value: number) {
  return Number(value.toFixed(3));
}

function getExportableSelection() {
  return figma.currentPage.selection.flatMap((node): ExportedKitchenAsset[] => {
    if (!('absoluteBoundingBox' in node) || !node.absoluteBoundingBox) return [];

    const { x, y, width, height } = node.absoluteBoundingBox;
    const name = node.name;

    return [
      {
        id: toAssetId(name),
        x: roundFigmaValue(x),
        y: roundFigmaValue(y),
        width: roundFigmaValue(width),
        height: roundFigmaValue(height),
        name
      }
    ];
  });
}

const assets = getExportableSelection();

if (!assets.length) {
  figma.notify('Select one or more layers with bounds before exporting.');
  figma.closePlugin();
} else {
  const json = JSON.stringify(assets, null, 2);
  const html = `
    <script>
      const text = ${JSON.stringify(json)};
      async function copyAndClose() {
        try {
          await navigator.clipboard.writeText(text);
          parent.postMessage({ pluginMessage: { type: 'copied', count: ${assets.length} } }, '*');
        } catch (error) {
          parent.postMessage({
            pluginMessage: {
              type: 'copy-failed',
              message: error && error.message ? error.message : String(error)
            }
          }, '*');
        }
      }
      copyAndClose();
    </script>
  `;

  figma.ui.onmessage = (message: { type: string; count?: number; message?: string }) => {
    if (message.type === 'copied') {
      figma.notify(`Copied ${message.count ?? assets.length} kitchen asset entries.`);
      figma.closePlugin();
      return;
    }

    figma.notify(`Could not copy JSON: ${message.message ?? 'unknown error'}`, { error: true });
    figma.closePlugin();
  };

  figma.showUI(html, { visible: false });
}
