// Captures the galaxy selector previews (art/galaxies.md "Selector preview") from a built dist and
// writes public/previews/galaxy-{id}.png (in the galaxy's own field colours) and
// galaxy-{id}-locked.png (the base field in greyscale). `node tools/galaxy-previews.mjs <dist>`
// runs the capture in an isolated Playwright container; inside it, `capture` does the work.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE = "mcr.microsoft.com/playwright/mcp:v0.0.83";
const root = fileURLToPath(new URL("..", import.meta.url));
// The view at 1 px per logical px: the 720 by 360 base at a device pixel ratio of 1.
const VIEW = { height: 360, width: 720 };
// A fixed world per galaxy, so a re-run captures the same frame.
const SEED = 1;
// The ship's offset from the framed destination in world units: the destination draws 80 logical
// px left of the ship, which stays at the view's centre.
const SHIP_OFFSET = { x: 40, y: -40 };
// Where the framed destination sits in the crop: a third in from the left, centred vertically,
// with field across the rest.
const FOCUS_ANCHOR = { x: 1 / 3, y: 1 / 2 };
// The hostile and drifting kinds a capture leaves out, so nothing moves between runs.
const MOVING = ["debris", "enemy", "hazard"];

function host(dist) {
  const source = realpathSync(resolve(root, dist ?? ""));
  assert.ok(statSync(join(source, "index.html")).isFile(), `${source} must be a built dist`);
  const output = resolve(root, "public/previews");
  mkdirSync(output, { recursive: true });
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--cpus",
      "4",
      "--memory",
      "2g",
      "--pids-limit",
      "512",
      "--init",
      "--shm-size",
      "256m",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--user",
      `${process.getuid()}:${process.getgid()}`,
      "--env",
      "HOME=/tmp",
      "--workdir",
      "/tmp",
      "--mount",
      `type=bind,source=${root},target=/source,readonly`,
      "--mount",
      `type=bind,source=${source},target=/dist,readonly`,
      "--mount",
      `type=bind,source=${output},target=/out`,
      "--entrypoint",
      "node",
      IMAGE,
      "/source/tools/galaxy-previews.mjs",
      "capture",
    ],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

const TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
};

// Serves the dist as built; a capture page overrides the field data it needs.
function serve(dist) {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname));
    let file = join(dist, path);
    if (!file.startsWith(dist)) {
      response.writeHead(400).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      file = join(file, "index.html");
    }
    if (!existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(readFileSync(file));
  });
  return new Promise((done) => {
    server.listen(4173, "127.0.0.1", () => done(server));
  });
}

// CLEANUP (added 2026-11-11): recapture Cartwheel and Whirlpool once the hub and the whale draw
// as art; they still draw the placeholder ellipse.
// A save in flight in galaxy `number` with the ship beside the first destination of its route, or,
// for a galaxy with no flight yet, the base field with no objects at the same framing.
// CLEANUP (added 2026-11-11): galaxy four has no flight (SectorId is 1 to 3), so it captures the
// empty field; re-run this tool once galaxy four has a sector, and drop the empty-field case.
async function fixture(number) {
  const [
    { GameModel, galaxyRoute },
    { PROTOTYPE },
    { createFlight, ensureDestination },
    { playOpening },
  ] = await Promise.all([
    import("/source/src/model/game.ts"),
    import("/source/src/data/prototype.ts"),
    import("/source/src/model/flight.ts"),
    import("/source/src/testing/launch.ts"),
  ]);

  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  const { state } = model;
  const flyable = number <= 3;
  const flight = createFlight(PROTOTYPE, flyable ? number : 1, SEED, { known: [] });
  state.flight = flight;
  state.dialogue = null;
  state.mode = "space";
  state.unlocked = [1, 2, 3];
  state.selectedSector = flight.sector;
  for (const id of [1, 2, 3]) {
    Object.assign(state.progress[id], { introduced: true, opened: true });
  }
  // The galaxy's first destination in its route, from the model's data, placed with its
  // surroundings generated around it; unknown, so it draws no label.
  const focus = flyable
    ? ensureDestination(PROTOTYPE, galaxyRoute(number)[0], flight)
    : { x: flight.player.x - SHIP_OFFSET.x, y: flight.player.y - SHIP_OFFSET.y };
  flight.objects = flyable ? flight.objects.filter(({ kind }) => !MOVING.includes(kind)) : [];
  // Drift stops, so every run captures the same frame.
  for (const object of flight.objects) {
    if (object.velocity) {
      object.velocity = { x: 0, y: 0 };
    }
  }
  flight.player = { x: focus.x + SHIP_OFFSET.x, y: focus.y + SHIP_OFFSET.y };
  flight.velocity = { x: 0, y: 0 };
  // The focus's screen position: the scene projects world offsets from the ship at the centre.
  const dx = focus.x - flight.player.x;
  const dy = focus.y - flight.player.y;
  return {
    focus: { x: VIEW.width / 2 + dx - dy, y: VIEW.height / 2 + (dx + dy) / 2 },
    save: model.save(),
    sector: flight.sector,
  };
}

// In the page: crops the capture with the focus a third in from the left and centred vertically,
// halves it by nearest neighbour and returns it as base64 PNG, in greyscale when locked.
async function processCapture({ anchor, capture, focus, locked, preview }) {
  const bytes = Uint8Array.from(atob(capture), (character) => character.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  const source = new OffscreenCanvas(bitmap.width, bitmap.height);
  const sourceContext = source.getContext("2d", { colorSpace: "srgb" });
  sourceContext.drawImage(bitmap, 0, 0);
  const left = Math.round(focus.x - preview.crop.width * anchor.x);
  const top = Math.round(focus.y - preview.crop.height * anchor.y);
  if (
    left < 0 ||
    top < 0 ||
    left + preview.crop.width > bitmap.width ||
    top + preview.crop.height > bitmap.height
  ) {
    throw new Error(`The crop at ${left},${top} leaves the ${bitmap.width}x${bitmap.height} view`);
  }
  const crop = sourceContext.getImageData(left, top, preview.crop.width, preview.crop.height);
  // Locked: each pixel 30 + 0.6 Y, Y the ITU-R 601 luma, truncated (preview.locked).
  const grey = (r, g, b) => {
    const value = Math.trunc(locked.offset + locked.scale * (0.299 * r + 0.587 * g + 0.114 * b));
    return [value, value, value];
  };
  const out = new ImageData(preview.width, preview.height);
  for (let y = 0; y < preview.height; y++) {
    for (let x = 0; x < preview.width; x++) {
      const from = (y * 2 * preview.crop.width + x * 2) * 4;
      const [r, g, b] = crop.data.slice(from, from + 3);
      out.data.set(
        [...(locked.apply ? grey(r, g, b) : [r, g, b]), 255],
        (y * preview.width + x) * 4,
      );
    }
  }
  const canvas = new OffscreenCanvas(out.width, out.height);
  canvas.getContext("2d", { colorSpace: "srgb" }).putImageData(out, 0, 0);
  const data = new Uint8Array(
    await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer(),
  );
  let text = "";
  for (const byte of data) {
    text += String.fromCharCode(byte);
  }
  return btoa(text);
}

// The field data one capture draws with: for unlocked, the galaxy's own field colours, backdrop
// tint and field tint (which carries the light-field rule) on the flight's galaxy (the same files
// when it flies there); for locked, the base field, which no light-field rule touches.
function fieldData({ asteroids, galaxies, ids }, galaxy, sector, base) {
  const flown = ids[sector - 1];
  const tints = Object.fromEntries(
    Object.entries(asteroids.tints).map(([id, tint]) => [
      id,
      base && id !== "base"
        ? asteroids.tints.base
        : id === flown
          ? (asteroids.tints[galaxy.id] ?? tint)
          : tint,
    ]),
  );
  return {
    asteroids: { ...asteroids, tints },
    galaxies: {
      ...galaxies,
      galaxies: base
        ? []
        : galaxies.galaxies.map((entry) =>
            entry.number === sector
              ? { ...entry, colors: galaxy.colors, tint: galaxy.tint }
              : entry,
          ),
    },
  };
}

// One preview: a fresh page on the galaxy's fixture with the field data for its state.
async function capturePreview(shared, galaxy, locked) {
  const { browser, data, manifest } = shared;
  const { focus, save, sector } = await fixture(galaxy.number);
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    viewport: VIEW,
  });
  try {
    const page = await context.newPage();
    const field = fieldData(data, galaxy, sector, locked);
    await page.route(`**${manifest.galaxyFields}`, (route) =>
      route.fulfill({ json: field.galaxies }),
    );
    await page.route(`**${manifest.asteroids}`, (route) =>
      route.fulfill({ json: field.asteroids }),
    );
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: "ada-the-navigator.prototype.v1",
      value: save,
    });
    await page.goto("http://127.0.0.1:4173/play/");
    await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
    // Only the canvas: no HUD, touch controls, notices, panels or cards.
    await page.addStyleTag({ content: "#app > :not(#game-canvas){visibility:hidden !important}" });
    await page.waitForTimeout(800);
    const canvas = page.locator("#game-canvas canvas");
    const size = await canvas.evaluate((element) => [element.width, element.height]);
    assert.deepEqual(size, [VIEW.width, VIEW.height], "The capture is 1 px per logical px");
    const shot = await canvas.screenshot();
    const png = await page.evaluate(processCapture, {
      anchor: FOCUS_ANCHOR,
      capture: shot.toString("base64"),
      focus,
      locked: { ...data.galaxies.preview.locked, apply: locked },
      preview: data.galaxies.preview,
    });
    const name = `galaxy-${galaxy.id}${locked ? "-locked" : ""}.png`;
    writeFileSync(`/out/${name}`, Buffer.from(png, "base64"));
    console.log(`${name}: framed on ${focus.x},${focus.y}`);
  } finally {
    await context.close();
  }
}

async function capture() {
  const dist = "/dist";
  const read = (url) => JSON.parse(readFileSync(join(dist, url), "utf8"));
  const manifest = read("art/manifest.json");
  const galaxies = read(manifest.galaxyFields);
  const data = {
    asteroids: read(manifest.asteroids),
    galaxies,
    ids: galaxies.galaxies.map(({ id }) => id),
  };
  const server = await serve(dist);
  const require = createRequire("/app/package.json");
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ args: ["--no-sandbox"], channel: "chromium" });
  const shared = { browser, data, manifest };
  try {
    // One at a time, in selector order: each galaxy unlocked, then locked.
    await galaxies.galaxies
      .flatMap((galaxy) => [false, true].map((locked) => [galaxy, locked]))
      .reduce(
        (prior, [galaxy, locked]) => prior.then(() => capturePreview(shared, galaxy, locked)),
        Promise.resolve(),
      );
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[2] === "capture") {
  await capture();
} else {
  host(process.argv[2]);
}
