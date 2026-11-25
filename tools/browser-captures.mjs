import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { SCREEN } from "../src/data/screen.ts";
import { batchCaptures } from "./browser-captures-batch.mjs";
import {
  asteroidFixture,
  hideOverCanvas,
  hubFixture,
  keylineFixture,
  launchBrowser,
  logicalSize,
  observe,
  output,
  pauseClock,
  previewOnly,
  previewOrigin,
  reportViolations,
  save,
  served,
  storageKey,
  toScreen,
  toWorld,
  unexpectedFailures,
} from "./browser-support.mjs";

// Art review captures (art/heavies.md, art/weapons.md, art/asteroids.md): screenshots of
// canonical fixtures for Art to review, outside the gating smoke. A run fails only on a page
// error, a failed request or a fixture that never draws Art's frames. The arguments name the
// capture sets to run (SETS below); none runs DEFAULT_SETS.
const events = { errors: [], failedRequests: [], badResponses: [], captures: [] };
const CAPTURE_LIMIT_SECONDS = 120;
const watchdog = setTimeout(() => {
  save("events.json", events);
  save("result.json", {
    passed: false,
    error: `Art captures exceeded ${CAPTURE_LIMIT_SECONDS} seconds`,
  });
  process.exit(124);
}, CAPTURE_LIMIT_SECONDS * 1000);

const [
  { GameModel },
  { CONTENT },
  { playOpening },
  { restoreSave },
  { enemyActorDefinition },
  { enemyActorAvailable },
  { createEnemy },
  { readAsteroidCatalog },
  asteroidArt,
  { DEVICE_STORAGE_KEYS },
  viewScale,
  { GALAXY_ID },
] = await Promise.all([
  import(new URL("../src/model/game.ts", import.meta.url)),
  import(new URL("../src/data/content.ts", import.meta.url)),
  import(new URL("../src/testing/launch.ts", import.meta.url)),
  import(new URL("../src/model/save.ts", import.meta.url)),
  import(new URL("../src/data/enemyActorDefinition.ts", import.meta.url)),
  import(new URL("../src/data/enemyActors.ts", import.meta.url)),
  import(new URL("../src/model/enemyAi.ts", import.meta.url)),
  import(new URL("../src/data/asteroidCatalog.ts", import.meta.url)),
  import(new URL("../src/game/asteroidArt.ts", import.meta.url)),
  import(new URL("../src/ui/deviceSettings.ts", import.meta.url)),
  import(new URL("../src/ui/layout/viewScale.ts", import.meta.url)),
  import(new URL("../src/data/galaxies.ts", import.meta.url)),
]);

/**
 * Holds the flight still while `window.adaCaptureFrozen` is set: the scene steps the flight
 * only while the document shows, so reporting it hidden stops every craft and shot while the
 * scene keeps drawing and loading frames.
 */
function freezable() {
  Object.defineProperty(Document.prototype, "hidden", {
    configurable: true,
    get: () => window.adaCaptureFrozen === true,
  });
}

let browser;
let context;
let page;
/** Art's JSON at `path` as the installed build serves it, opening the start screen if needed. */
async function servedJson(path) {
  if (!page) {
    await openHome(null);
  }
  const response = await served(page, path);
  assert.equal(response.status(), 200, `${path} must be served`);
  return response.json();
}
/**
 * Opens a canonical save in a fresh context, one renderer at a time, with the flight held still
 * (`frozen`) and the page clock under the run's control, then continues into the flight and
 * waits until every enemy and rock in view draws Art's frames. The clock is then paused, so
 * each frame is taken at a stepped time rather than whenever its screenshot lands.
 * `deviceScaleFactor` sets the device pixels per CSS px; the game renders at up to 2.
 */
async function closeFixture() {
  await context?.close();
}
async function openFixture(
  serialized,
  {
    deviceScaleFactor = 1,
    frozen = true,
    reducedMotion = false,
    viewport = { width: 1280, height: 720 },
  } = {},
) {
  await closeFixture();
  const opened = await browser.newContext({ deviceScaleFactor, viewport, hasTouch: true });
  context = opened;
  await opened.addInitScript(reportViolations);
  await opened.addInitScript(freezable);
  await opened.route("**/*", previewOnly);
  await opened.addInitScript(
    ({ entries }) => {
      if (!sessionStorage.getItem("ada-captures.seeded")) {
        for (const [name, entry] of entries) {
          localStorage.setItem(name, entry);
        }
        sessionStorage.setItem("ada-captures.seeded", "1");
      }
    },
    {
      entries: [
        [storageKey, serialized],
        ...(reducedMotion ? [[DEVICE_STORAGE_KEYS.reducedMotion, "on"]] : []),
      ],
    },
  );
  page = await opened.newPage();
  page.setDefaultTimeout(30000);
  observe(events, page);
  await page.clock.install();
  await page.goto(`${previewOrigin}/play/`);
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  // Continue takes effect only on a showing page, so it runs on the paused clock and the frames
  // it takes are stepped one at a time; the flight is then held hidden while its art loads.
  await pauseClock(page);
  await page.locator('.ada-start-actions > [data-action="continue"]').click();
  const space = page.locator('#game-status[data-mode="space"]');
  async function goLive(frames) {
    assert.ok(frames < 20, "Continue reaches the flight within 20 frames");
    await page.clock.runFor(16);
    if ((await space.count()) === 0) {
      await goLive(frames + 1);
    }
  }
  await goLive(0);
  await page.evaluate((held) => {
    window.adaCaptureFrozen = held;
  }, frozen);
  await page.clock.resume();
  await page.locator('#game-status[data-enemies="art"]').waitFor({ state: "attached" });
  await page.locator('#game-status[data-asteroids="art"]').waitFor({ state: "attached" });
  await page.locator("#game-canvas > canvas").waitFor({ state: "visible" });
  await pauseClock(page);
}
/** Lets the flight run again from the paused clock. */
const release = () =>
  page.evaluate(() => {
    window.adaCaptureFrozen = false;
  });
/** Saves the canvas, without the HTML drawn over it, as `file`, and returns its image. */
async function shot(file) {
  const showOverCanvas = await hideOverCanvas(page);
  const image = await page
    .locator("#game-canvas > canvas")
    .screenshot({ path: `${output}/${file}` });
  await showOverCanvas();
  events.captures.push(file);
  return image;
}
/**
 * Saves a square of the page `side` CSS px wide, without the HTML drawn over the canvas, centred
 * on the element `selector` (by default the canvas, where Ada draws), as `file`. Without `side`
 * the square is twice the element's larger dimension.
 */
async function closeUp(file, { selector = "#game-canvas > canvas", side } = {}) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${selector} must be laid out for its close-up`);
  const width = side ?? 2 * Math.max(box.width, box.height);
  const showOverCanvas = await hideOverCanvas(page);
  await page.screenshot({
    clip: {
      height: width,
      width,
      x: box.x + box.width / 2 - width / 2,
      y: box.y + box.height / 2 - width / 2,
    },
    path: `${output}/${file}`,
  });
  await showOverCanvas();
  events.captures.push(file);
}
/**
 * Saves `shots` frames of the open fixture as art-<name>[-n].png: the first `after` ms of
 * clock time in, then each `every` ms of clock time after the last.
 */
async function frames(name, { after = 0, every = 0, shots = 1 } = {}) {
  if (after > 0) {
    await page.clock.runFor(after);
  }
  // Each frame follows the last, so they run in turn.
  async function frame(index) {
    await shot(shots === 1 ? `art-${name}.png` : `art-${name}-${index + 1}.png`);
    if (index + 1 < shots) {
      await page.clock.runFor(every);
      await frame(index + 1);
    }
  }
  await frame(0);
}
function fixtureFile(name, scope, serialized) {
  save(`art-fixture-${name}.json`, { scope, state: JSON.parse(serialized) });
}

/**
 * A flight in `galaxy` with each heavy at its screen offset from Ada, holding its fire unless
 * its hardpoints are listed, and an upgrade pickup at each of `pickups`' screen offsets.
 */
function heavyFixture(galaxy, heavies, pickups = []) {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 2, 3, 4, 5, 6];
  // The highest shield outlasts every capture's hits on Ada.
  model.state.economy.levels.shield = 3;
  model.startGalaxy(galaxy);
  playOpening(model);
  assert.ok(model.state.flight, `Heavy fixture requires galaxy ${galaxy}'s flight`);
  const flight = model.state.flight;
  model.state.progress[galaxy].introduced = true;
  model.state.dialogue = null;
  flight.objects = [];
  flight.shots = [];
  flight.mines = [];
  const origin = { ...flight.player };
  for (const { archetype, fire = [], id, screen, setup, weaponLevel = 1 } of heavies) {
    const actorId = id ?? `browser-art:${archetype}:${screen.x}`;
    assert.ok(
      enemyActorAvailable(galaxy, archetype),
      "Fixture actor must be available in its galaxy",
    );
    const definition = enemyActorDefinition(galaxy, archetype, actorId, weaponLevel);
    const offset = toWorld(screen);
    const at = { x: origin.x + offset.x, y: origin.y + offset.y };
    const enemy = createEnemy(
      definition,
      { archetype, id: actorId, packId: null, phase: 0, weaponLevel },
      at,
    );
    enemy.engaged = true;
    for (const part of enemy.hardpoints) {
      part.cooldown = fire.includes(part.id) ? 0.6 : 999;
    }
    setup?.(enemy);
    assert.equal(enemy.id, actorId, "Supply fixture identity before setup");
    assert.equal(enemy.archetype, archetype, "Fixture setup must preserve its archetype");
    assert.equal(enemy.weaponLevel ?? 1, weaponLevel, "Supply fixture weaponLevel before setup");
    flight.objects.push({
      ...at,
      enemy,
      hp: enemy.hp,
      id: enemy.id,
      kind: "enemy",
      persistent: false,
      radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    });
  }
  for (const screen of pickups) {
    const offset = toWorld(screen);
    flight.objects.push({
      hp: 1,
      id: `browser-art:upgrade:${screen.x}`,
      kind: "pickup",
      radius: CONTENT.tuning.flight.pickupRadius,
      role: "drop",
      upgrade: true,
      x: origin.x + offset.x,
      y: origin.y + offset.y,
    });
  }
  const serialized = model.save();
  assert.deepEqual(restoreSave(serialized), model.state, "Canonical restore accepts heavies");
  return serialized;
}
const destroyWeapons = (enemy) => {
  for (const part of enemy.hardpoints) {
    if (!["command", "engine", "engine-left", "engine-right"].includes(part.id)) {
      part.hp = 0;
    }
  }
  enemy.disabled = true;
};
const pair = () => [
  { archetype: "frigate", screen: { x: -170, y: -20 } },
  { archetype: "capital", screen: { x: 150, y: -40 } },
];
const upgradePickup = { x: 0, y: 70 };
const heavyScope = "Canonical heavy and enemy weapon fixture for Art review";

async function captureHeavies() {
  // Sunflower's tier 1 heavies with every mount drawn, above a disabled frigate with its banner
  // beside a salvaged capital, and an upgrade pickup below Ada, all held still. The climb
  // loops every 1140 ms: twelve frames 95 ms of clock time apart sample it evenly, so two or
  // three show each chevron lit.
  const sunflower = heavyFixture(
    1,
    [
      ...pair(),
      { archetype: "frigate", screen: { x: -160, y: 130 }, setup: destroyWeapons },
      {
        archetype: "capital",
        screen: { x: 160, y: 140 },
        setup: (enemy) => {
          destroyWeapons(enemy);
          enemy.salvaged = true;
        },
      },
    ],
    [upgradePickup],
  );
  fixtureFile("sunflower", heavyScope, sunflower);
  await openFixture(sunflower);
  await frames("sunflower", { every: 95, shots: 12 });
  // Needle (tier 2) and Cartwheel (tier 3) heavies, every mount drawn, held still.
  async function tier(name, galaxy) {
    const fixture = heavyFixture(galaxy, pair());
    fixtureFile(name, heavyScope, fixture);
    await openFixture(fixture);
    await frames(name);
  }
  await tier("heavies-tier-2", 4);
  await tier("heavies-tier-3", 2);
  // Phantom's capital fires its Phaser, ring burst and mine layer, and its frigate the
  // charged lance, each 0.6 s after the flight is released; the frames run from the tells to
  // the beams' end. The upgrade pickup lies below Ada, still under reduced motion.
  const weapons = heavyFixture(
    6,
    [
      { archetype: "frigate", fire: ["bow"], screen: { x: -170, y: -60 } },
      {
        archetype: "capital",
        fire: ["claw-left", "stern-left", "stern-right"],
        screen: { x: 150, y: -40 },
      },
    ],
    [upgradePickup],
  );
  fixtureFile("weapons", heavyScope, weapons);
  async function fire(name, reducedMotion) {
    await openFixture(weapons, { reducedMotion });
    await release();
    await frames(name, { after: 500, every: 200, shots: 7 });
  }
  await fire("weapons", false);
  await fire("weapons-reduced", true);
}

async function captureRocks() {
  const rockArt = readAsteroidCatalog(await servedJson("/art/asteroids.json"));
  assert.ok(rockArt, "Art's asteroid catalog must read as version 1");
  // The core manifest links the backdrop layers, with both rock depths' debris rules.
  const { debris } = await servedJson((await servedJson("/art/manifest.json")).backdropLayers);
  // Galaxy one's rocks turning: small and medium rocks turn 4 to 18 degrees a second, so 15
  // degree frames change within two seconds of clock time.
  const spinning = asteroidFixture(rockArt, debris, 1);
  save("asteroid-fixture-spin.json", {
    scope: "Canonical rock layout for Art review of spin frames",
    state: JSON.parse(spinning),
  });
  await openFixture(spinning, { frozen: false });
  await shot("asteroids-spin-0.png");
  await page.clock.runFor(2000);
  await shot("asteroids-spin-1.png");
  await page.clock.runFor(2000);
  await shot("asteroids-spin-2.png");
  // Art's footprint overlay: still rocks under reduced motion, so each draws and collides with
  // frame 0; each rock's footprint is outlined over the sprite, with its pivot marked.
  const still = asteroidFixture(rockArt, debris, 1, false);
  await openFixture(still, { reducedMotion: true });
  const canvas = page.locator("#game-canvas > canvas");
  const image = await canvas.screenshot();
  const state = JSON.parse(still);
  const outlines = state.flight.objects
    .filter((object) => object.id.startsWith("browser-rock:"))
    .map((object) => {
      const at = toScreen({
        x: object.x - state.flight.player.x,
        y: object.y - state.flight.player.y,
      });
      const outline = asteroidArt.footprintOutline(asteroidArt.rockArt(object.asteroid), 0);
      return {
        at,
        edges: outline.edges.map(([start, end]) => [
          { x: at.x + start.x, y: at.y + start.y },
          { x: at.x + end.x, y: at.y + end.y },
        ]),
        id: object.asteroid,
      };
    });
  const intrinsic = await canvas.evaluate(logicalSize, SCREEN);
  const overlay = await page.evaluate(
    async ({ baseHeight, baseWidth, encoded, intrinsic: size, outlines: drawn }) => {
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const sample = document.createElement("canvas");
      sample.width = bitmap.width;
      sample.height = bitmap.height;
      const drawing = sample.getContext("2d");
      drawing.drawImage(bitmap, 0, 0);
      bitmap.close();
      const scale = sample.width / size.width;
      const left = Math.max(0, (size.width - baseWidth) / 2);
      // The game area centres in a taller view too (playView).
      const top = Math.max(0, Math.floor((Math.floor(size.height) - baseHeight) / 2));
      const map = (point) => [(point.x + left) * scale, (point.y + top) * scale];
      drawing.lineWidth = 2;
      drawing.strokeStyle = "#ff00ff";
      drawing.fillStyle = "#ff00ff";
      for (const outline of drawn) {
        drawing.beginPath();
        for (const [start, end] of outline.edges) {
          drawing.moveTo(...map(start));
          drawing.lineTo(...map(end));
        }
        drawing.stroke();
        const [x, y] = map(outline.at);
        drawing.fillRect(x - 3, y - 3, 6, 6);
      }
      return sample.toDataURL("image/png").split(",")[1];
    },
    {
      baseHeight: SCREEN.height,
      baseWidth: SCREEN.width,
      encoded: image.toString("base64"),
      intrinsic,
      outlines,
    },
  );
  writeFileSync(`${output}/asteroids-footprints.png`, Buffer.from(overlay, "base64"));
  events.captures.push("asteroids-footprints.png");
  save("asteroid-footprints.json", {
    scope: "Frame 0 footprints in magenta over the sprites, under reduced motion",
    image: "asteroids-footprints.png",
    rocks: outlines.map(({ at, id }) => ({ id, pivot: at })),
  });
}

// Phone insets in logical px (art/layout.md): 43 left and right, 19 bottom.
const PHONE_INSETS = { bottom: 19, left: 43, right: 43, top: 0 };
/**
 * Publishes the view properties the view scale bridge would for the phone insets on the open
 * fixture's canvas size, then steps the held flight a frame so the scene lays out with them.
 */
async function phoneInsets() {
  const size = await page.evaluate(() => {
    const canvas = document.querySelector("#game-canvas > canvas").getBoundingClientRect();
    return { height: canvas.height, width: canvas.width };
  });
  const plain = viewScale.playLayout(size);
  const cssInsets = Object.fromEntries(
    Object.entries(PHONE_INSETS).map(([side, value]) => [side, value * plain.s]),
  );
  await page.evaluate(
    ({ entries, event }) => {
      const app = document.querySelector("#app");
      for (const [name, value] of entries) {
        app.style.setProperty(name, value);
      }
      window.dispatchEvent(new Event(event));
    },
    {
      entries: viewScale.viewProperties({ ...plain, cssInsets, insets: { ...PHONE_INSETS } }),
      event: viewScale.VIEW_SCALE_EVENT,
    },
  );
  await page.clock.runFor(100);
}

/**
 * Light-field keylines (art/galaxies.md "Light fields"): each light galaxy's held flight with its
 * keylined play objects, debris and enemy jets, at 1280x720 and at 720x360 with the phone insets.
 */
async function captureKeylines([galaxy, ...rest] = [1, 2, 3, 4, 5]) {
  if (galaxy === undefined) {
    return;
  }
  const serialized = keylineFixture(galaxy);
  const name = GALAXY_ID[galaxy];
  fixtureFile(`keylines-${name}`, "Light-field keyline proof flight for Art review", serialized);
  // Each size opens its own page, one renderer at a time.
  await openFixture(serialized);
  await shot(`keylines-${name}-1280x720.png`);
  await openFixture(serialized, { viewport: { width: 720, height: 360 } });
  await phoneInsets();
  await shot(`keylines-${name}-720x360-insets.png`);
  await captureKeylines(rest);
}

/**
 * Holds the open fixture until its galaxy's own art draws: the clock runs until the loading
 * bar's measured galaxy load ends, then steps the frames that draw that art. A fixture without
 * enemies passes openFixture's enemy art wait before that load ends.
 */
async function awaitGalaxyArt() {
  await page.clock.resume();
  await page
    .locator('.ada-loading [role="progressbar"]:not([data-state="determinate"])')
    .waitFor({ state: "attached" });
  await pauseClock(page);
  await page.clock.runFor(100);
}

/** Cartwheel's hub, its story craft and its mooring buoys over their keylines, at both sizes. */
async function captureHub() {
  const serialized = hubFixture();
  fixtureFile("keylines-cartwheel-hub", "Cartwheel hub keyline view for Art review", serialized);
  await openFixture(serialized);
  await awaitGalaxyArt();
  await shot("keylines-cartwheel-hub-1280x720.png");
  await openFixture(serialized, { viewport: { width: 720, height: 360 } });
  await awaitGalaxyArt();
  await phoneInsets();
  await shot("keylines-cartwheel-hub-720x360-insets.png");
}

/**
 * Opens a canonical save, or with null the browser's own, at the start screen without
 * continuing, one renderer at a time.
 */
async function openHome(
  serialized,
  { deviceScaleFactor = 1, viewport = { width: 1280, height: 720 } } = {},
) {
  await closeFixture();
  const opened = await browser.newContext({ deviceScaleFactor, viewport, hasTouch: true });
  context = opened;
  await opened.addInitScript(reportViolations);
  await opened.route("**/*", previewOnly);
  await opened.addInitScript(
    ({ key, value }) => {
      if (value !== null && !sessionStorage.getItem("ada-captures.seeded")) {
        localStorage.setItem(key, value);
        sessionStorage.setItem("ada-captures.seeded", "1");
      }
    },
    { key: storageKey, value: serialized },
  );
  page = await opened.newPage();
  page.setDefaultTimeout(30000);
  observe(events, page);
  await page.clock.install();
  await page.goto(`${previewOrigin}/play/`);
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  return page;
}

/** Saves the whole page, HTML over the canvas included, as `file`. */
async function pageShot(file) {
  await page.screenshot({ path: `${output}/${file}` });
  events.captures.push(file);
}

// The capture sets by name. The four review sets that predate the named sets run by default.
const SETS = {
  heavies: captureHeavies,
  hub: captureHub,
  keylines: () => captureKeylines(),
  rocks: captureRocks,
  ...batchCaptures({
    awaitGalaxyArt,
    closeUp,
    fixtureFile,
    frames,
    heavyFixture,
    openFixture,
    openHome,
    page: () => page,
    pageShot,
    phoneInsets,
    release,
    served: servedJson,
    shot,
  }),
};
const DEFAULT_SETS = ["heavies", "rocks", "keylines", "hub"];

try {
  const names = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_SETS;
  const unknown = names.filter((name) => !Object.hasOwn(SETS, name));
  assert.deepEqual(unknown, [], `Capture sets are ${Object.keys(SETS).join(", ")}`);
  const require = createRequire("/app/package.json");
  const { chromium } = require("playwright");
  browser = await launchBrowser(chromium);
  // Each set runs after the last, one renderer at a time.
  await names.reduce((previous, name) => previous.then(() => SETS[name]()), Promise.resolve());
  await closeFixture();
  assert.deepEqual(events.errors, [], "Captured pages must report no errors");
  assert.deepEqual(
    unexpectedFailures(events.failedRequests),
    [],
    "Captured pages must load every request",
  );
  assert.deepEqual(events.badResponses, [], "Captured pages must get no error responses");
  save("events.json", events);
  save("result.json", {
    passed: true,
    scope: "Rendered canonical fixtures; screenshot review by Art required",
    sets: process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_SETS,
    captures: events.captures,
  });
} catch (error) {
  save("events.json", events);
  save("result.json", { passed: false, error: error.stack ?? String(error) });
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  await browser?.close();
}
