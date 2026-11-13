import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { SCREEN } from "../src/data/screen.ts";
import {
  asteroidFixture,
  hideOverCanvas,
  logicalSize,
  observe,
  output,
  previewOnly,
  previewOrigin,
  reportViolations,
  save,
  storageKey,
  toScreen,
  toWorld,
} from "./browser-support.mjs";

// Art review captures (art/heavies.md, art/weapons.md, art/asteroids.md): screenshots of
// canonical fixtures for Art to review, outside the gating smoke. A run fails only on a page
// error, a failed request or a fixture that never draws Art's frames.
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
  { enemyDefinition },
  { createEnemy },
  { readAsteroidCatalog },
  asteroidArt,
  { DEVICE_STORAGE_KEYS },
] = await Promise.all([
  import(new URL("../src/model/game.ts", import.meta.url)),
  import(new URL("../src/data/content.ts", import.meta.url)),
  import(new URL("../src/testing/launch.ts", import.meta.url)),
  import(new URL("../src/model/save.ts", import.meta.url)),
  import(new URL("../src/data/enemyCatalog.ts", import.meta.url)),
  import(new URL("../src/model/enemyAi.ts", import.meta.url)),
  import(new URL("../src/data/asteroidCatalog.ts", import.meta.url)),
  import(new URL("../src/game/asteroidArt.ts", import.meta.url)),
  import(new URL("../src/ui/deviceSettings.ts", import.meta.url)),
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
/**
 * Opens a canonical save in a fresh context, one renderer at a time, with the flight held still
 * (`frozen`) and the page clock under the run's control, then continues into the flight and
 * waits until every enemy and rock in view draws Art's frames. The clock is then paused, so
 * each frame is taken at a stepped time rather than whenever its screenshot lands.
 */
async function closeFixture() {
  await context?.close();
}
async function openFixture(serialized, { frozen = true, reducedMotion = false } = {}) {
  await closeFixture();
  const opened = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    hasTouch: true,
  });
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
  // Held from the start screen, so the game boots as a showing page and the flight never steps.
  await page.evaluate((held) => {
    window.adaCaptureFrozen = held;
  }, frozen);
  await page.locator('.ada-start-actions > [data-action="continue"]').click();
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.locator('#game-status[data-enemies="art"]').waitFor({ state: "attached" });
  await page.locator('#game-status[data-asteroids="art"]').waitFor({ state: "attached" });
  await page.locator("#game-canvas > canvas").waitFor({ state: "visible" });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
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
  for (const { archetype, fire = [], screen, setup } of heavies) {
    const definition = enemyDefinition(galaxy, archetype);
    const offset = toWorld(screen);
    const at = { x: origin.x + offset.x, y: origin.y + offset.y };
    const enemy = createEnemy(
      definition,
      { archetype, id: `browser-art:${archetype}:${screen.x}`, packId: null, phase: 0 },
      at,
    );
    enemy.engaged = true;
    for (const part of enemy.hardpoints) {
      part.cooldown = fire.includes(part.id) ? 0.6 : 999;
    }
    setup?.(enemy);
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
  const response = await page.request.get(`${previewOrigin}/art/asteroids.json`);
  assert.equal(response.status(), 200, "Art's asteroid catalog must be served");
  const rockArt = readAsteroidCatalog(await response.json());
  assert.ok(rockArt, "Art's asteroid catalog must read as version 1");
  const backdrop = await page.request.get(`${previewOrigin}/art/backdrop.json`);
  const parallax = (await backdrop.json()).debris.rocks.parallax;
  // Galaxy one's rocks turning: small and medium rocks turn 4 to 18 degrees a second, so 15
  // degree frames change within two seconds of clock time.
  const spinning = asteroidFixture(rockArt, parallax, 1);
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
  const still = asteroidFixture(rockArt, parallax, 1, false);
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
    async ({ baseWidth, encoded, intrinsic: size, outlines: drawn }) => {
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
      const map = (point) => [(point.x + left) * scale, point.y * scale];
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
    { baseWidth: SCREEN.width, encoded: image.toString("base64"), intrinsic, outlines },
  );
  writeFileSync(`${output}/asteroids-footprints.png`, Buffer.from(overlay, "base64"));
  events.captures.push("asteroids-footprints.png");
  save("asteroid-footprints.json", {
    scope: "Frame 0 footprints in magenta over the sprites, under reduced motion",
    image: "asteroids-footprints.png",
    rocks: outlines.map(({ at, id }) => ({ id, pivot: at })),
  });
}

try {
  const require = createRequire("/app/package.json");
  const { chromium } = require("playwright");
  browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--no-sandbox"] });
  await captureHeavies();
  await captureRocks();
  await closeFixture();
  assert.deepEqual(events.errors, [], "Captured pages must report no errors");
  assert.deepEqual(events.failedRequests, [], "Captured pages must load every request");
  assert.deepEqual(events.badResponses, [], "Captured pages must get no error responses");
  save("events.json", events);
  save("result.json", {
    passed: true,
    scope: "Rendered canonical fixtures; screenshot review by Art required",
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
