import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decodePng } from "@andornaut/art-kit/build/png";
import { composite, resizeNearest } from "@andornaut/art-kit/build/raster";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import { decodeWebp, encodeLosslessWebp, encodeLossyWebp } from "@andornaut/art-kit/build/webp";

import {
  BACKGROUNDS,
  overnightOverlays,
  paint,
  PARTY_ROOM,
  PARTY_ROOM_STAGES,
} from "./storybook.ts";

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
const rainScene = "story-community-garden-rain";
const partyOpening = "story-ada-room-party-ada";
const lunchScene = "story-schoolyard-friends";
const peakNightScene = "story-ada-room-night-glowing";
const sleepGlow = "story-ada-room-sleep-glow";
const figureScenes = {
  // Reverse the historical party room's 74-row lift to match the shared bedroom camera.
  [partyOpening]: [["story-ada-list", 308, 258, 2]],
  [rainScene]: [
    ["story-party-grandma", 379, 185, 1],
    ["story-party-mom", 428, 187, 1],
    ["story-party-dad", 494, 182, 1],
    ["story-party-casey", 350, 217, 1],
    ["story-party-ada", 408, 218, 1],
    ["story-party-sam", 467, 216, 1],
    ["story-party-friend", 523, 218, 1],
    ["story-party-penny", 548, 224, 1],
  ],
  [peakNightScene]: [["story-ada-night", 233, 290, 2]],
  [lunchScene]: [
    ["story-schoolyard-casey", 501, 218, 1],
    ["story-schoolyard-ada", 525, 222, 1],
    ["story-schoolyard-sam", 552, 220, 1],
    ["story-schoolyard-friend", 574, 219, 1],
  ],
} as const;
const sharedFigurePaths = new Map([
  ["story-schoolyard-casey", "story-party-casey"],
  ["story-schoolyard-sam", "story-party-sam"],
  ["story-schoolyard-friend", "story-party-friend"],
]);
const subjects = new Map([
  ...PARTY_ROOM_STAGES.map(({ id }) => [id, { top: 255, bottom: 300 }] as const),
  [partyOpening, { top: 255, bottom: 300 }],
  [lunchScene, { top: 168, bottom: 278 }],
  [rainScene, { top: 182, bottom: 274 }],
  [peakNightScene, { top: 250, bottom: 300 }],
]);
const originals = new Map(manifest.assets.map((asset) => [asset.id, asset]));
const bedrooms = new Map(
  BACKGROUNDS.filter(({ id }) => id.startsWith("story-ada-room")).map((scene) => [scene.id, scene]),
);
const earthLocations = new Map(
  BACKGROUNDS.filter(
    ({ id }) =>
      id.startsWith("story-grandma-garden") ||
      id === "story-community-garden" ||
      id === "story-front-door" ||
      id === "story-concert-hall",
  ).map((scene) => [scene.id, scene]),
);
const images = new Map<string, RgbaImage>();
const original = (id: string): RgbaImage => {
  if (!images.has(id)) {
    if (id === rainScene) {
      const lot = decodePng(readFileSync(`${references}community-garden-rain.png`));
      const rain = decodePng(readFileSync(`${references}rain.png`));
      composite({ x: 0, y: 0 }, resizeNearest(lot.width, lot.height, rain), lot);
      images.set(id, lot);
      return lot;
    }
    if (id === peakNightScene) {
      const night = original("story-ada-room-night");
      const peak = { ...night, data: new Uint8Array(night.data) };
      const { x, y } = originals.get(sleepGlow)!.at!;
      composite({ x: x * 2, y: y * 2 }, original(sleepGlow), peak);
      images.set(id, peak);
      return peak;
    }
    if (id === partyOpening) return original(PARTY_ROOM);
    if (id === lunchScene) return original("story-schoolyard");
    const partyStage = PARTY_ROOM_STAGES.find((stage) => stage.id === id);
    if (partyStage) {
      const image = partyStage.render();
      images.set(id, image);
      return image;
    }
    const asset = originals.get(id);
    assert(asset, `Missing authored scene ${id}`);
    const archived = `${references}${basename(asset.path)}`;
    const sourceId = `story-${basename(asset.path, ".png")}`;
    const artwork = bedrooms.get(sourceId) ?? earthLocations.get(sourceId);
    if (artwork) {
      images.set(
        id,
        id === artwork.id
          ? paint(artwork.palette, artwork.build(artwork.palette))
          : original(artwork.id),
      );
    } else if (id === sleepGlow) {
      const { at, image } = overnightOverlays()[sleepGlow];
      assert.deepEqual(at, asset.at, "The authored overnight overlay anchor must stay fixed");
      images.set(id, image);
    } else {
      images.set(
        id,
        decodePng(
          readFileSync(existsSync(archived) ? archived : `${source}${asset.path.slice(5)}`),
        ),
      );
    }
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
export async function buildStoryCompositions(
  output: string,
  {
    bedroomOnly = false,
    earthLocationsOnly = false,
  }: { bedroomOnly?: boolean; earthLocationsOnly?: boolean } = {},
) {
  assert(!(bedroomOnly && earthLocationsOnly), "Select one composition scope");
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
  const publish = async (id: string, image: RgbaImage, lossless = false) => {
    const path = `/art/story-composed/${id}.webp`;
    const encoded = lossless
      ? await encodeLosslessWebp(image)
      : await encodeLossyWebp(STORY_WEBP, image);
    const restored = await decodeWebp(encoded);
    if (lossless) assert.deepEqual(restored, image, `Exact figure pixels: ${id}`);
    writeFileSync(`${directory}${path.slice(4)}`, encoded);
    generated.set(id, image);
    decoded.set(id, restored);
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
    rainScene,
    "story-schoolyard",
    "story-school-hallway",
    "story-kitchen",
    "story-front-door",
    "story-concert-hall",
  ].filter(
    (id) => (!bedroomOnly || bedrooms.has(id)) && (!earthLocationsOnly || earthLocations.has(id)),
  );
  const addScene = (id: string, base: string, layers: Layer[]) => {
    const subject = subjects.get(id) ?? originals.get(id)?.subject;
    assert(subject, `Missing original subject band ${id}`);
    scenes[id] = { base, layers, subject };
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
  const day = scenes["story-ada-room-unpolished"]?.base;
  if (day) {
    const polished = await patch(
      "prop-polished-rock",
      "story-ada-room-unpolished",
      "story-ada-room",
    );
    const stages: Layer[][] = [[polished]];
    addScene("story-ada-room", day, stages[0]!);
    for (let stage = 1; stage <= 3; stage++) {
      const id = `story-ada-room-glow-${stage}`;
      stages.push([polished, await patch(`glow-${stage}`, "story-ada-room", id)]);
      addScene(id, day, stages[stage]!);
    }
    for (const prop of ["recorder", "invitations", "party"]) {
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
  }
  for (const state of bedroomOnly ? [] : ["spilled", "replanted"]) {
    const id = `story-grandma-garden-${state}`;
    addScene(id, scenes["story-grandma-garden"]!.base, [
      await patch(`garden-${state}`, "story-grandma-garden", id),
    ]);
  }
  if (day) {
    const glow = original(sleepGlow);
    const at = originals.get(sleepGlow)!.at!;
    await publish(sleepGlow, glow);
    assets.at(-1)!.at = at;
    addScene(peakNightScene, scenes["story-ada-room-night"]!.base, [
      {
        asset: sleepGlow,
        atLogical: at,
        displayWidth: glow.width / 2,
        displayHeight: glow.height / 2,
      },
    ]);
    addScene(partyOpening, day, [...scenes[PARTY_ROOM]!.layers]);
  }
  if (!bedroomOnly && !earthLocationsOnly)
    addScene(lunchScene, scenes["story-schoolyard"]!.base, []);
  // Preserve environment-only aliases and their individual run placement bands.
  for (const asset of originals.values()) {
    if (!asset.id.startsWith("story-") || scenes[asset.id] || !asset.subject) continue;
    const canonical = [...originals.values()].find(
      (entry) => scenes[entry.id] && entry.path === asset.path,
    );
    if (canonical) addScene(asset.id, scenes[canonical.id]!.base, scenes[canonical.id]!.layers);
  }
  const authoredFigures = new Map<string, RgbaImage>();
  for (const [id, figures] of Object.entries(figureScenes)) {
    if (!scenes[id]) continue;
    const plate = original(id);
    const authored = { ...plate, data: new Uint8Array(plate.data) };
    for (const [name, x, y, scale] of figures) {
      const sprite = decodePng(readFileSync(`${references}${name.slice(6)}.png`));
      const displayWidth = sprite.width * scale;
      const displayHeight = sprite.height * scale;
      const image = resizeNearest(displayWidth * 2, displayHeight * 2, sprite);
      assert(x + displayWidth <= plate.width / 2 && y + displayHeight <= plate.height / 2, name);
      composite({ x: x * 2, y: y * 2 }, image, authored);
      const shared = sharedFigurePaths.get(name);
      if (shared) {
        const asset = assets.find(({ id }) => id === shared);
        assert(asset, `Missing shared figure asset: ${shared}`);
        assert.deepEqual(image, generated.get(shared), `Shared figure pixels: ${name}`);
        assets.push({ ...asset, id: name });
        generated.set(name, image);
        decoded.set(name, decoded.get(shared)!);
      } else {
        await publish(name, image, true);
      }
      scenes[id]!.layers.push({
        asset: name,
        atLogical: { x, y },
        displayWidth,
        displayHeight,
      });
    }
    authoredFigures.set(id, authored);
  }
  // The lossless pieces rebuild every authored scene exactly; then the decoded WebP pieces
  // stay within DECODED_LIMITS of it at display size.
  const reconstructed: string[] = [];
  const decodedScenes: Record<string, ReturnType<typeof displayDifference>> = {};
  for (const [id, scene] of Object.entries(scenes)) {
    const authored = authoredFigures.get(id) ?? original(id);
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
        codec:
          "Published ArtKit WebP: lossy quality 80, method 6, alpha quality 100; lossless figures",
        baseCount: baseIds.length,
        generatedPaths: Object.keys(bytes).length,
        retainedPaths: ["/art/story/ada-skywatch.png", "/art/story/penny-sitting.png"],
        bytes,
        encodedBytes: Object.values(bytes).reduce((sum, value) => sum + value, 0),
        decodedBytes: [...new Set(decoded.values())].reduce(
          (sum, image) => sum + image.data.length,
          0,
        ),
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
  const scope = process.argv[3];
  assert(
    scope === undefined || scope === "--bedroom-only" || scope === "--earth-locations-only",
    "Unknown composition scope",
  );
  await buildStoryCompositions(process.argv[2], {
    bedroomOnly: scope === "--bedroom-only",
    earthLocationsOnly: scope === "--earth-locations-only",
  });
}
