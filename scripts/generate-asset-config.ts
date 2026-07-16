#!/usr/bin/env tsx
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { stdin as processStdin, stdout as processStdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const TAIL_START_X = 23600;
const CONFIG_PATH = 'src/lib/kitchen/kitchen-scene.config.ts';
const VALID_LAYERS = ['background', 'middle', 'foreground'] as const;

type SceneLayer = (typeof VALID_LAYERS)[number];

type FigmaExportAsset = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
};

type CliOptions = {
  append: boolean;
  defaults: boolean;
  input?: string;
};

type GeneratedAsset = FigmaExportAsset & {
  interactive: boolean;
  isTail: boolean;
  layer: SceneLayer;
  src: string;
  zOffset: number;
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { append: false, defaults: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--input' || arg === '-i') {
      options.input = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--append') {
      options.append = true;
      continue;
    }

    if (arg === '--defaults') {
      options.defaults = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/generate-asset-config.ts --input figma-export.json
  pbpaste | npx tsx scripts/generate-asset-config.ts

Options:
  --input, -i   Read Figma exporter JSON from a file.
  --append      Disabled: kitchen scene assets now come from Phaser chunks plus objects-position-new.json.
  --defaults    Non-interactive mode: foreground, not tail, zOffset 0, not interactive.
`);
}

async function readInput(options: CliOptions) {
  if (options.input) {
    return readFile(resolve(repoRoot, options.input), 'utf8');
  }

  if (processStdin.isTTY) {
    throw new Error('No input provided. Pass --input figma-export.json or pipe JSON via stdin.');
  }

  const chunks: Buffer[] = [];
  for await (const chunk of processStdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function parseExportJson(input: string): FigmaExportAsset[] {
  const parsed = JSON.parse(input) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Figma export must be a JSON array.');
  }

  return parsed.map((asset, index) => {
    if (!asset || typeof asset !== 'object') {
      throw new Error(`Asset at index ${index} is not an object.`);
    }

    const candidate = asset as Partial<FigmaExportAsset>;
    if (!candidate.id || typeof candidate.id !== 'string') {
      throw new Error(`Asset at index ${index} is missing a string id.`);
    }

    for (const key of ['x', 'y', 'width', 'height'] as const) {
      if (typeof candidate[key] !== 'number' || !Number.isFinite(candidate[key])) {
        throw new Error(`Asset "${candidate.id}" has invalid ${key}.`);
      }
    }

    return {
      id: candidate.id,
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      height: candidate.height,
      name: typeof candidate.name === 'string' ? candidate.name : candidate.id
    };
  });
}

function getExistingAssetIds() {
  const configPath = resolve(repoRoot, CONFIG_PATH);
  if (!existsSync(configPath)) return new Set<string>();

  const config = readFileSync(configPath, 'utf8');
  return new Set([...config.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]));
}

function validateBaseAsset(asset: FigmaExportAsset, existingIds: Set<string>) {
  if (existingIds.has(asset.id)) {
    throw new Error(`Asset id "${asset.id}" already exists in ${CONFIG_PATH}.`);
  }

  if (asset.width <= 0 || asset.height <= 0) {
    throw new Error(`Asset "${asset.id}" must have positive width and height.`);
  }
}

function createPrompt() {
  if (existsSync('/dev/tty')) {
    return createInterface({
      input: createReadStream('/dev/tty'),
      output: createWriteStream('/dev/tty')
    });
  }

  return createInterface({ input: processStdin, output: processStdout });
}

async function askWithDefault(
  prompt: ReturnType<typeof createPrompt>,
  question: string,
  defaultValue: string
) {
  const answer = (await prompt.question(`${question} (${defaultValue}): `)).trim();
  return answer || defaultValue;
}

async function askLayer(prompt: ReturnType<typeof createPrompt>, asset: FigmaExportAsset): Promise<SceneLayer> {
  while (true) {
    const answer = await askWithDefault(
      prompt,
      `Layer for "${asset.id}" [background/middle/foreground]`,
      'foreground'
    );

    if ((VALID_LAYERS as readonly string[]).includes(answer)) {
      return answer as SceneLayer;
    }

    console.error(`Invalid layer "${answer}".`);
  }
}

async function askYesNo(
  prompt: ReturnType<typeof createPrompt>,
  question: string,
  defaultValue: boolean
) {
  const label = defaultValue ? 'Y/n' : 'y/N';

  while (true) {
    const answer = (await prompt.question(`${question} (${label}): `)).trim().toLowerCase();
    if (!answer) return defaultValue;
    if (answer === 'y' || answer === 'yes') return true;
    if (answer === 'n' || answer === 'no') return false;
    console.error('Answer y or n.');
  }
}

async function askNumber(
  prompt: ReturnType<typeof createPrompt>,
  question: string,
  defaultValue: number
) {
  while (true) {
    const answer = await askWithDefault(prompt, question, String(defaultValue));
    const parsed = Number(answer);

    if (Number.isFinite(parsed)) return parsed;
    console.error(`Invalid number "${answer}".`);
  }
}

async function enrichAsset(
  asset: FigmaExportAsset,
  prompt: ReturnType<typeof createPrompt> | undefined,
  useDefaults: boolean
): Promise<GeneratedAsset> {
  const layer = useDefaults || !prompt ? 'foreground' : await askLayer(prompt, asset);
  const isTail = useDefaults || !prompt ? false : await askYesNo(prompt, `Is "${asset.id}" a tail asset?`, false);
  const zOffset = useDefaults || !prompt ? 0 : await askNumber(prompt, `zOffset for "${asset.id}"`, 0);
  const interactive =
    useDefaults || !prompt ? false : await askYesNo(prompt, `Is "${asset.id}" interactive?`, false);
  const x = isTail ? Number((asset.x - TAIL_START_X).toFixed(3)) : asset.x;

  if (isTail && x < 0) {
    throw new Error(`Asset "${asset.id}" has negative tail x (${x}) after subtracting ${TAIL_START_X}.`);
  }

  return {
    ...asset,
    x,
    layer,
    isTail,
    zOffset,
    interactive,
    src: `/assets/kitchen/objects/${asset.id}.png`
  };
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(3)).toString();
}

function formatEntry(asset: GeneratedAsset) {
  const lines = [
    '{',
    `  id: '${asset.id}',`,
    `  src: '${asset.src}',`,
    asset.isTail
      ? `  x: ${formatNumber(asset.x)}, // local tail coordinate (${formatNumber(asset.x + TAIL_START_X)} - ${TAIL_START_X})`
      : `  x: ${formatNumber(asset.x)},`,
    `  y: ${formatNumber(asset.y)},`,
    `  width: ${formatNumber(asset.width)},`,
    `  height: ${formatNumber(asset.height)},`,
    `  layer: '${asset.layer}',`
  ];

  if (asset.isTail) lines.push('  isTail: true,');
  lines.push(`  zOffset: ${formatNumber(asset.zOffset)},`);
  if (asset.interactive) lines.push('  interactive: true,');
  lines.push('},');

  return lines.join('\n');
}

function appendEntries(entries: string[]) {
  void entries;
  throw new Error(
    [
      '--append is disabled for the kitchen scene.',
      'The active scene uses Phaser chunks plus kitchenConstructionObjectAssets generated from objects-position-new.json.',
      'Add new object sprites under static/assets/kitchen/objects and map them in kitchenConstructionObjectSourceByName instead.'
    ].join(' ')
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = await readInput(options);
  const assets = parseExportJson(input);
  const existingIds = getExistingAssetIds();
  const prompt = options.defaults ? undefined : createPrompt();

  try {
    const generatedAssets: GeneratedAsset[] = [];
    for (const asset of assets) {
      validateBaseAsset(asset, existingIds);
      generatedAssets.push(await enrichAsset(asset, prompt, options.defaults));
      existingIds.add(asset.id);
    }

    const entries = generatedAssets.map(formatEntry);
    const output = entries.join('\n\n');

    console.log(output);

    if (options.append) {
      appendEntries(entries);
      console.error(`\nAppended ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} to ${CONFIG_PATH}.`);
    }
  } finally {
    prompt?.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
