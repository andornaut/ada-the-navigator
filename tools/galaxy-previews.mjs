// Captures the galaxy selector previews (art/galaxies.md "Selector preview") from a built dist and
// writes public/previews/galaxy-{id}.png (tinted) and galaxy-{id}-locked.png (the untinted capture
// in greyscale). `node tools/galaxy-previews.mjs <dist>` runs the capture in an isolated
// Playwright container; inside it, `capture` does the work.
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
// The view at 1 px per logical px: the 720 by 360 base, untouched by EXPAND.
const VIEW = { height: 360, width: 720 };
// A fixed world per galaxy, so a re-run captures the same frame.
const SEED = 1;
// The ship's offset from the framed destination in world units: the destination draws 80 logical
// px left of the ship, which stays at the view's centre.
const SHIP_OFFSET = { x: 40, y: -40 };
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

// Serves the dist, with galaxies.json emptied so space keeps the base field the spec captures.
function serve(dist) {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname));
    if (path === "/art/galaxies.json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ galaxies: [], version: 1 }));
      return;
    }
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

// CLEANUP (added 2026-11-11): the committed captures predate this framing and the destination
// art; recapture galaxies one to three with `make previews` once destinations draw as art.
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
    import("/source/src/model/test-launch.ts"),
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
  };
}

// In the page: crops the capture on focus, halves it by nearest neighbour, then applies the tint
// rule (unlocked) or the locked greyscale, and returns both PNGs as base64.
async function processCapture({ capture, fieldPaint, focus, locked, preview, tint }) {
  const bytes = Uint8Array.from(atob(capture), (character) => character.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  const source = new OffscreenCanvas(bitmap.width, bitmap.height);
  const sourceContext = source.getContext("2d", { colorSpace: "srgb" });
  sourceContext.drawImage(bitmap, 0, 0);
  const left = Math.round(focus.x - preview.crop.width / 2);
  const top = Math.round(focus.y - preview.crop.height / 2);
  const crop = sourceContext.getImageData(left, top, preview.crop.width, preview.crop.height);
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const toByte = (c) => Math.min(255, Math.max(0, Math.round(toGamma(c) * 255)));
  const oklab = (r, g, b) => {
    const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255));
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const srgb = (L, a, b) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
  };
  // A field colour keeps its L plus the tint's lightness and takes its chroma at its hue.
  const retint = (r, g, b) => {
    const [L, a, bb] = oklab(r, g, b);
    if (L >= fieldPaint.lightness || Math.hypot(a, bb) >= fieldPaint.chroma) {
      return [r, g, b];
    }
    const hue = (tint.hue * Math.PI) / 180;
    return srgb(L + tint.lightness, tint.chroma * Math.cos(hue), tint.chroma * Math.sin(hue));
  };
  const half = (transform) => {
    const out = new ImageData(preview.width, preview.height);
    for (let y = 0; y < preview.height; y++) {
      for (let x = 0; x < preview.width; x++) {
        const from = (y * 2 * preview.crop.width + x * 2) * 4;
        const to = (y * preview.width + x) * 4;
        const [r, g, b] = transform(crop.data[from], crop.data[from + 1], crop.data[from + 2]);
        out.data.set([r, g, b, 255], to);
      }
    }
    return out;
  };
  const grey = (r, g, b) => {
    const value = Math.trunc(locked.offset + locked.scale * (0.299 * r + 0.587 * g + 0.114 * b));
    return [value, value, value];
  };
  const encode = async (image) => {
    const canvas = new OffscreenCanvas(image.width, image.height);
    canvas.getContext("2d", { colorSpace: "srgb" }).putImageData(image, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const data = new Uint8Array(await blob.arrayBuffer());
    let text = "";
    for (const byte of data) {
      text += String.fromCharCode(byte);
    }
    return btoa(text);
  };
  return {
    locked: await encode(half(grey)),
    tinted: await encode(half(retint)),
    // The tint rule on the base background, to compare with Art's own retint of it.
    tintedBackground: retint(...fieldPaint.background),
  };
}

const hex = (color) => [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16));

// One galaxy's two previews, from a fresh page on its fixture.
async function previewGalaxy({ background, browser, galaxies }, galaxy) {
  const { focus, save } = await fixture(galaxy.number);
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    viewport: VIEW,
  });
  try {
    const page = await context.newPage();
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
    const result = await page.evaluate(processCapture, {
      capture: shot.toString("base64"),
      fieldPaint: { ...galaxies.fieldPaint, background: hex(background) },
      focus,
      locked: galaxies.preview.locked,
      preview: galaxies.preview,
      tint: galaxy.tint,
    });
    // The tint rule on the base background must land on Art's own retint of it.
    const expected = hex(galaxy.colors.background);
    result.tintedBackground.forEach((value, channel) =>
      assert.ok(
        Math.abs(value - expected[channel]) <= 1,
        `${galaxy.id}: the tint rule gives ${result.tintedBackground} for Art's ${expected}`,
      ),
    );
    writeFileSync(`/out/galaxy-${galaxy.id}.png`, Buffer.from(result.tinted, "base64"));
    writeFileSync(`/out/galaxy-${galaxy.id}-locked.png`, Buffer.from(result.locked, "base64"));
    console.log(`${galaxy.id}: framed on ${focus.x},${focus.y}`);
  } finally {
    await context.close();
  }
}

async function capture() {
  const dist = "/dist";
  const galaxies = JSON.parse(readFileSync(join(dist, "art/galaxies.json"), "utf8"));
  const palette = JSON.parse(readFileSync(join(dist, "art/space-palette.json"), "utf8"));
  const server = await serve(dist);
  const require = createRequire("/app/package.json");
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ args: ["--no-sandbox"], channel: "chromium" });
  const shared = { background: palette.colors.background, browser, galaxies };
  try {
    // One galaxy at a time, in selector order.
    await galaxies.galaxies.reduce(
      (prior, galaxy) => prior.then(() => previewGalaxy(shared, galaxy)),
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
