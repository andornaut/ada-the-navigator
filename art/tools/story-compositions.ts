import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decodePng } from "@andornaut/art-kit/build/png";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import { decodeWebp, encodeLossyWebp } from "@andornaut/art-kit/build/webp";

interface Asset {
  id: string;
  path: string;
  subject?: { top: number; bottom: number };
  at?: { x: number; y: number };
}
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Layer {
  asset: string;
  atLogical: { x: number; y: number };
  displayWidth: number;
  displayHeight: number;
  sourceRect?: Rect;
}

const source = fileURLToPath(new URL("../../public/art/", import.meta.url));
// Lossy WebP at quality 80; alphaQuality 100 keeps the patches' binary alpha exact.
const STORY_WEBP = { quality: 80, method: 6, alphaQuality: 100, exact: false } as const;
// The most each decoded scene may differ from its authored scene at display size (2x2 box
// means), per RGB channel byte.
const DECODED_LIMITS = { mean: 1, p99: 6, max: 48 } as const;
const references = fileURLToPath(new URL("../sources/story/", import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL("../sources/story-reference.json", import.meta.url), "utf8"),
) as {
  assets: Asset[];
};
const originals = new Map(manifest.assets.map((asset) => [asset.id, asset]));
const images = new Map<string, RgbaImage>();
const original = (id: string) => {
  if (!images.has(id)) {
    const asset = originals.get(id);
    assert(asset, `Missing authored scene ${id}`);
    const archived = `${references}${basename(asset.path)}`;
    images.set(
      id,
      decodePng(readFileSync(existsSync(archived) ? archived : `${source}${asset.path.slice(5)}`)),
    );
  }
  return images.get(id)!;
};

/** Opaque replacement pixels preserve the authored opaque scene under normal source-over. */
function difference(base: RgbaImage, target: RgbaImage): { image: RgbaImage; rect: Rect } {
  assert.equal(base.width, target.width);
  assert.equal(base.height, target.height);
  let left = base.width;
  let top = base.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < base.height; y++) {
    for (let x = 0; x < base.width; x++) {
      const at = (y * base.width + x) * 4;
      if (target.data.subarray(at, at + 4).some((value, c) => value !== base.data[at + c])) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
  }
  assert(right > left && bottom > top, "Expected a visible authored state change");
  left = Math.max(0, Math.floor((left - 6) / 2) * 2);
  top = Math.max(0, Math.floor((top - 6) / 2) * 2);
  right = Math.min(base.width, Math.ceil((right + 6) / 2) * 2);
  bottom = Math.min(base.height, Math.ceil((bottom + 6) / 2) * 2);
  const rect = { x: left, y: top, width: right - left, height: bottom - top };
  const image = blankImage(rect.width, rect.height);
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const from = ((top + y) * base.width + left + x) * 4;
      const to = (y * rect.width + x) * 4;
      if (target.data.subarray(from, from + 4).some((value, c) => value !== base.data[from + c])) {
        assert.equal(target.data[from + 3], 255, "Replacement patch requires opaque target");
        image.data.set(target.data.subarray(from, from + 4), to);
      }
    }
  }
  return { image, rect };
}

/** Source-over of a scene's layers on its base, from one set of pieces. */
function compose(
  pieces: ReadonlyMap<string, RgbaImage>,
  scene: { base: string; layers: readonly Layer[] },
): Uint8Array {
  const base = pieces.get(scene.base)!;
  const data = new Uint8Array(base.data);
  for (const layer of scene.layers) {
    const image = pieces.get(layer.asset)!;
    const rect = layer.sourceRect ?? { x: 0, y: 0, width: image.width, height: image.height };
    for (let y = 0; y < rect.height; y++)
      for (let x = 0; x < rect.width; x++) {
        const at = ((rect.y + y) * image.width + rect.x + x) * 4;
        const alpha = image.data[at + 3]!;
        assert(alpha === 0 || alpha === 255, "Difference patches must be binary alpha");
        if (alpha)
          data.set(
            image.data.subarray(at, at + 4),
            ((layer.atLogical.y * 2 + y) * base.width + layer.atLogical.x * 2 + x) * 4,
          );
      }
  }
  return data;
}

/** Mean, 99th percentile and max RGB byte difference of two opaque 2x images at display size. */
function displayDifference(width: number, height: number, a: Uint8Array, b: Uint8Array) {
  const counts = new Array<number>(256).fill(0);
  let sum = 0;
  let n = 0;
  for (let y = 0; y + 1 < height; y += 2)
    for (let x = 0; x + 1 < width; x += 2) {
      const box = [y * width + x, y * width + x + 1, (y + 1) * width + x, (y + 1) * width + x + 1];
      for (let c = 0; c < 3; c++) {
        const mean = (data: Uint8Array) =>
          Math.round(box.reduce((total, i) => total + data[i * 4 + c]!, 0) / 4);
        const d = Math.abs(mean(a) - mean(b));
        counts[d]!++;
        sum += d;
        n++;
      }
    }
  let p99 = 0;
  for (let seen = 0; p99 < 255 && (seen += counts[p99]!) <= 0.99 * n;) p99++;
  return { mean: Number((sum / n).toFixed(3)), p99, max: counts.findLastIndex((v) => v > 0) };
}

/** Generate additive candidates only; the consumer owns activation and offline closure. */
export async function buildStoryCompositions(output: string) {
  const directory = resolve(output);
  assert.notEqual(directory, resolve(source), "Use a separate candidate directory");
  mkdirSync(`${directory}/story-composed`, { recursive: true });
  const assets: {
    id: string;
    path: string;
    width: number;
    height: number;
    displayWidth: number;
    displayHeight: number;
    pixelRatio: 2;
    at?: { x: number; y: number };
  }[] = [];
  const scenes: Record<string, { base: string; layers: Layer[]; subject: Asset["subject"] }> = {};
  const generated = new Map<string, RgbaImage>();
  const decoded = new Map<string, RgbaImage>();
  const bytes: Record<string, number> = {};
  const publish = async (id: string, image: RgbaImage) => {
    const path = `/art/story-composed/${id}.webp`;
    const encoded = await encodeLossyWebp(STORY_WEBP, image);
    writeFileSync(`${directory}${path.slice(4)}`, encoded);
    generated.set(id, image);
    decoded.set(id, await decodeWebp(encoded));
    bytes[path] = encoded.length;
    assets.push({
      id,
      path,
      width: image.width,
      height: image.height,
      displayWidth: image.width / 2,
      displayHeight: image.height / 2,
      pixelRatio: 2,
    });
    return id;
  };
  const baseIds = [
    "story-park",
    "story-ada-room-unpolished",
    "story-ada-room-night",
    "story-ada-room-morning",
    "story-grandma-garden",
    "story-community-garden",
    "story-schoolyard",
    "story-school-hallway",
    "story-kitchen",
    "story-front-door",
    "story-concert-hall",
  ];
  const addScene = (id: string, base: string, layers: Layer[]) => {
    const asset = originals.get(id);
    assert(asset?.subject, `Missing original subject band ${id}`);
    scenes[id] = { base, layers, subject: asset.subject };
  };
  for (const id of baseIds) {
    const base = await publish(`base-${id.slice(6)}`, original(id));
    addScene(id, base, []);
  }
  const patch = async (id: string, from: string, to: string): Promise<Layer> => {
    const { image, rect } = difference(original(from), original(to));
    return {
      asset: await publish(id, image),
      atLogical: { x: rect.x / 2, y: rect.y / 2 },
      displayWidth: rect.width / 2,
      displayHeight: rect.height / 2,
    };
  };
  const day = scenes["story-ada-room-unpolished"]!.base;
  const polished = await patch("prop-polished-rock", "story-ada-room-unpolished", "story-ada-room");
  const stages: Layer[][] = [[polished]];
  addScene("story-ada-room", day, stages[0]!);
  for (let stage = 1; stage <= 3; stage++) {
    const id = `story-ada-room-glow-${stage}`;
    stages.push([polished, await patch(`glow-${stage}`, "story-ada-room", id)]);
    addScene(id, day, stages[stage]!);
  }
  for (const prop of ["recorder", "invitations"]) {
    const cells = Array.from({ length: 4 }, (_, stage) => {
      const suffix = stage === 0 ? "" : `-glow-${stage}`;
      return difference(
        original(`story-ada-room${suffix}`),
        original(`story-ada-room-${prop}${suffix}`),
      );
    });
    // Separate padded cells avoid cross-state sampling through the cropped overlay boxes.
    const width = Math.max(...cells.map(({ image }) => image.width));
    const height = Math.max(...cells.map(({ image }) => image.height));
    const sheet = blankImage(width * 4, height);
    for (const [index, { image }] of cells.entries()) {
      for (let y = 0; y < image.height; y++) {
        sheet.data.set(
          image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4),
          (y * sheet.width + index * width) * 4,
        );
      }
    }
    const asset = await publish(`prop-${prop}`, sheet);
    for (const [stage, { image, rect }] of cells.entries()) {
      addScene(`story-ada-room-${prop}${stage === 0 ? "" : `-glow-${stage}`}`, day, [
        ...stages[stage]!,
        {
          asset,
          atLogical: { x: rect.x / 2, y: rect.y / 2 },
          displayWidth: image.width / 2,
          displayHeight: image.height / 2,
          sourceRect: { x: stage * width, y: 0, width: image.width, height: image.height },
        },
      ]);
    }
  }
  for (const state of ["spilled", "replanted"]) {
    const id = `story-grandma-garden-${state}`;
    addScene(id, scenes["story-grandma-garden"]!.base, [
      await patch(`garden-${state}`, "story-grandma-garden", id),
    ]);
  }
  const sleepGlow = "story-ada-room-sleep-glow";
  await publish(sleepGlow, original(sleepGlow));
  assets.at(-1)!.at = originals.get(sleepGlow)!.at;
  // Preserve environment-only aliases and their individual run placement bands.
  for (const asset of originals.values()) {
    if (!asset.id.startsWith("story-") || scenes[asset.id] || !asset.subject) continue;
    const canonical = [...originals.values()].find(
      (entry) => scenes[entry.id] && entry.path === asset.path,
    );
    if (canonical) addScene(asset.id, scenes[canonical.id]!.base, scenes[canonical.id]!.layers);
  }
  // The lossless pieces rebuild every authored scene exactly; then the decoded WebP pieces
  // stay within DECODED_LIMITS of it at display size.
  const reconstructed: string[] = [];
  const decodedScenes: Record<string, ReturnType<typeof displayDifference>> = {};
  for (const [id, scene] of Object.entries(scenes)) {
    const authored = original(id);
    assert.deepEqual(
      compose(generated, scene),
      new Uint8Array(authored.data),
      `Exact source-over reconstruction: ${id}`,
    );
    reconstructed.push(id);
    const difference = displayDifference(
      authored.width,
      authored.height,
      compose(decoded, scene),
      new Uint8Array(authored.data),
    );
    for (const key of ["mean", "p99", "max"] as const)
      assert(
        difference[key] <= DECODED_LIMITS[key],
        `Decoded ${id} ${key} difference ${difference[key]} exceeds ${DECODED_LIMITS[key]}`,
      );
    decodedScenes[id] = difference;
  }
  const document = { version: 1, canvas: { width: 960, height: 540 }, assets, scenes };
  writeFileSync(`${directory}/story-compositions.json`, `${JSON.stringify(document, null, 2)}\n`);
  writeFileSync(
    `${directory}/story-compositions-report.json`,
    `${JSON.stringify(
      {
        codec: "Published ArtKit lossy WebP quality 80, method 6, alpha quality 100",
        baseCount: baseIds.length,
        generatedPaths: assets.length,
        retainedPaths: ["/art/story/ada-skywatch.png", "/art/story/penny-sitting.png"],
        bytes,
        encodedBytes: Object.values(bytes).reduce((sum, value) => sum + value, 0),
        decodedBytes: assets.reduce((sum, image) => sum + image.width * image.height * 4, 0),
        reconstructed,
        nativeRgbaExact: true,
        decoded: {
          limits: DECODED_LIMITS,
          worst: {
            mean: Math.max(...Object.values(decodedScenes).map(({ mean }) => mean)),
            p99: Math.max(...Object.values(decodedScenes).map(({ p99 }) => p99)),
            max: Math.max(...Object.values(decodedScenes).map(({ max }) => max)),
          },
          scenes: decodedScenes,
        },
      },
      null,
      2,
    )}\n`,
  );
  return document;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert(process.argv[2], "Pass a separate additive candidate output directory");
  await buildStoryCompositions(process.argv[2]);
}
