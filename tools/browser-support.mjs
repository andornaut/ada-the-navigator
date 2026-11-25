import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

import { SCREEN } from "../src/data/screen.ts";

// Shared by the browser smoke and the Art review captures, which run in the same container.
export const output = "/tmp/evidence";
export const storageKey = "ada-the-navigator.save";
export const previewOrigin = "http://ada-preview:4173";
mkdirSync(output, { recursive: true });

export function save(name, value) {
  writeFileSync(`${output}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
}

// A canvas's size in logical px: its CSS size over the fit of the 720x360 base view. Its backing
// is in device pixels.
export function logicalSize(canvas, screen) {
  const fit = Math.min(canvas.offsetWidth / screen.width, canvas.offsetHeight / screen.height);
  return { width: canvas.offsetWidth / fit, height: canvas.offsetHeight / fit };
}

// Hides the HTML that draws over the canvas while its pixels are sampled, and returns the call
// that shows it again. Each element's own style is set through CSSOM, which the page's CSP allows
// where an injected <style> is blocked.
export async function hideOverCanvas(target) {
  const selector = ".ada-conversation,.ada-shield,.ada-item-notice,#game-status,#save-status";
  await target.evaluate((list) => {
    for (const node of document.querySelectorAll(list)) {
      node.style.setProperty("visibility", "hidden", "important");
    }
  }, selector);
  return () =>
    target.evaluate((list) => {
      for (const node of document.querySelectorAll(list)) {
        node.style.removeProperty("visibility");
      }
    }, selector);
}

// Pauses target's page clock just ahead of the page's time. Under load the page can pass a fixed
// lead before the pause lands, which the clock refuses as a fast-forward to the past, so each
// retry reads the page's time again and doubles the lead.
export async function pauseClock(target, lead = 100, attempt = 0) {
  try {
    await target.clock.pauseAt((await target.evaluate(() => Date.now())) + lead * 2 ** attempt);
  } catch (error) {
    if (attempt >= 5 || !String(error).includes("fast-forward to the past")) {
      throw error;
    }
    await pauseClock(target, lead, attempt + 1);
  }
}

// A CSP violation in any page logs a console error, which the run's error check fails on.
export function reportViolations() {
  document.addEventListener("securitypolicyviolation", (event) => {
    console.error(
      `CSP violation: ${event.effectiveDirective} blocked ${event.blockedURI || "inline"}`,
    );
  });
}

// Launches the run's headless Chromium. The production launch installs a service worker, which
// needs a secure origin, and the preview serves plain HTTP on the run's internal network.
export function launchBrowser(chromium) {
  return chromium.launch({
    args: ["--no-sandbox", `--unsafely-treat-insecure-origin-as-secure=${previewOrigin}`],
    channel: "chromium",
    headless: true,
  });
}

// The failed requests a run fails on: all but the build's update group archives that a page
// closing mid-download aborts.
const GROUP_ARCHIVE = /^\/\.game-kit\/group-[0-9a-f]{64}\.bin$/u;
export function unexpectedFailures(failedRequests) {
  return failedRequests.filter(
    ({ error, url }) => error !== "net::ERR_ABORTED" || !GROUP_ARCHIVE.test(new URL(url).pathname),
  );
}

// No outside requests are needed to render the built game.
export function previewOnly(route) {
  if (new URL(route.request().url()).origin === previewOrigin) {
    return route.continue();
  }
  return route.abort("blockedbyclient");
}

// Records a page's errors, failed requests and error responses in `events`.
export function observe(events, observed) {
  observed.on("pageerror", (error) => events.errors.push(error.message));
  observed.on("console", (message) => {
    if (message.type() === "error") {
      events.errors.push(message.text());
    }
  });
  observed.on("requestfailed", (request) =>
    events.failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText,
    }),
  );
  observed.on("response", (response) => {
    if (response.status() >= 400) {
      events.badResponses.push({ url: response.url(), status: response.status() });
    }
  });
}

const [
  { GameModel },
  { CONTENT },
  { playOpening },
  { restoreSave },
  { ASTEROID_ART },
  asteroidArt,
  { orbitMotion },
  { ensureDestination },
  { enemyActorAvailable },
  { enemyActorDefinition },
  { createEnemy },
] = await Promise.all([
  import(new URL("../src/model/game.ts", import.meta.url)),
  import(new URL("../src/data/content.ts", import.meta.url)),
  import(new URL("../src/testing/launch.ts", import.meta.url)),
  import(new URL("../src/model/save.ts", import.meta.url)),
  import(new URL("../src/data/asteroidCatalog.ts", import.meta.url)),
  import(new URL("../src/game/asteroidArt.ts", import.meta.url)),
  import(new URL("../src/model/asteroids.ts", import.meta.url)),
  import(new URL("../src/model/flight.ts", import.meta.url)),
  import(new URL("../src/data/enemyActors.ts", import.meta.url)),
  import(new URL("../src/data/enemyActorDefinition.ts", import.meta.url)),
  import(new URL("../src/model/enemyAi.ts", import.meta.url)),
]);

// The play view's projection of a world offset from Ada to logical screen px, and back.
export const toScreen = (world) => ({
  x: SCREEN.width / 2 + world.x - world.y,
  y: SCREEN.height / 2 + (world.x + world.y) / 2,
});
export const toWorld = (screen) => ({ x: screen.x / 2 + screen.y, y: screen.y - screen.x / 2 });

// The drawn screen rectangles of the backdrop rocks of one depth (backdrop-lattice.json
// `debris.rocks` or `debris.farRocks`) for a flight seed, Ada at `player`. Backdrop rocks lie in
// their layer, about the camera's world position times the depth's `parallax` (art/backdrop.md).
function backdropRockBoxes(rockArt, rule, seed, player) {
  const camera = { x: player.x * rule.parallax, y: player.y * rule.parallax };
  const cx = Math.floor(camera.x / rule.cell);
  const cy = Math.floor(camera.y / rule.cell);
  const span = Math.ceil(1080 / rule.cell) + 1;
  const boxes = [];
  for (let x = cx - span; x <= cx + span; x++) {
    for (let y = cy - span; y <= cy + span; y++) {
      const rock = asteroidArt.backdropRock(rockArt, rule, seed, x, y);
      if (rock) {
        const at = toScreen({ x: rock.x - camera.x, y: rock.y - camera.y });
        const width = rock.sprite.display.width * rock.scale;
        const height = rock.sprite.display.height * rock.scale;
        boxes.push({
          at,
          height,
          width,
          x: at.x - rock.sprite.pivot.x * width,
          y: at.y - rock.sprite.pivot.y * height,
        });
      }
    }
  }
  return boxes;
}

const meets = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// The first flight seed whose near backdrop rocks (`debris.rocks`) put one in the asteroid
// fixture's open top-centre area, clear of its play rocks; or, with `clear` screen rectangles,
// whose rocks of both depths (`debris`, backdrop-lattice.json) meet none of them. `rockArt` is
// Art's served asteroid catalog.
export function backdropSeed(rockArt, debris, player, clear = null) {
  for (let seed = 1; seed < 2000; seed++) {
    if (clear) {
      const boxes = [debris.farRocks, debris.rocks].flatMap((rule) =>
        backdropRockBoxes(rockArt, rule, seed, player),
      );
      if (!boxes.some((box) => clear.some((rect) => meets(box, rect)))) {
        return seed;
      }
    } else if (
      backdropRockBoxes(rockArt, debris.rocks, seed, player).some(
        ({ at }) => at.x > 250 && at.x < 340 && at.y > 70 && at.y < 140,
      )
    ) {
      return seed;
    }
  }
  throw new Error(`No backdrop seed ${clear ? "clears the sampled regions" : "shows a rock"}`);
}

// Art review rocks (art/asteroids.md): one of each size around Ada, plus a drifting rock, with
// a backdrop rock in the open top centre. Pivots sit at rock bases, so each rock rises above
// its point.
const ROCK_SCREEN = {
  small: { x: -280, y: -110 },
  medium: { x: -230, y: 120 },
  large: { x: -40, y: 165 },
  huge: { x: 235, y: 150 },
};
// A flight's seed and its galaxy's persistent geography seed move together: a canonical save
// requires them equal.
export function reseedFlight(model, seed) {
  const flight = model.state.flight;
  flight.seed = seed;
  const geography = model.state.progress[flight.galaxy].geography;
  if (geography) {
    geography.seed = seed;
  }
}
// A flight in `galaxy` with its opening played and no play objects, reseeded so a near backdrop
// rock shows in the open top centre.
function emptyFlight(rockArt, debris, galaxy, unlocked) {
  const model = new GameModel(CONTENT);
  model.state.unlocked = unlocked;
  model.startGalaxy(galaxy);
  playOpening(model);
  assert.ok(model.state.flight, `The fixture requires galaxy ${galaxy}'s flight`);
  const flight = model.state.flight;
  model.state.progress[galaxy].introduced = true;
  model.state.dialogue = null;
  flight.objects = [];
  flight.shots = [];
  reseedFlight(model, backdropSeed(rockArt, debris, flight.player));
  return model;
}

// The light-field keyline proof (art/galaxies.md "Light fields"): galaxy `galaxy`'s flight with a
// held frigate and interceptor under way so their jets show, two traveling debris pieces and an
// ore pickup beside Ada, who starts beside Cartwheel's hub, Needle's practice course or
// Andromeda's Pip so their story craft, buoys, gates and beacons show too. Each enemy takes its
// galaxy's own equipment, as canonical saves carry it.
const KEYLINE_SITES = { 2: "hub", 4: "needlePractice", 5: "pip" };
export function keylineFixture(galaxy) {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 2, 3, 4, 5, 6];
  model.startGalaxy(galaxy);
  playOpening(model);
  const flight = model.state.flight;
  assert.ok(flight, `The keyline proof requires galaxy ${galaxy}'s flight`);
  model.state.progress[galaxy].introduced = true;
  model.state.dialogue = null;
  const site = KEYLINE_SITES[galaxy];
  if (site) {
    const place = ensureDestination(CONTENT, site, flight);
    const beside = toWorld({ x: -150, y: 40 });
    flight.player = { x: place.x + beside.x, y: place.y + beside.y };
  }
  flight.velocity = { x: 0, y: 0 };
  flight.shots = [];
  const at = (screen) => {
    const offset = toWorld(screen);
    return { x: flight.player.x + offset.x, y: flight.player.y + offset.y };
  };
  for (const [archetype, screen] of [
    ["frigate", { x: -170, y: -90 }],
    ["interceptor", { x: 120, y: 110 }],
  ]) {
    assert.ok(enemyActorAvailable(galaxy, archetype), `${archetype} flies in galaxy ${galaxy}`);
    const id = `browser-keyline:${archetype}`;
    const definition = enemyActorDefinition(galaxy, archetype, id, 1);
    const position = at(screen);
    const enemy = createEnemy(
      definition,
      { archetype, id, packId: null, phase: 0, weaponLevel: 1 },
      position,
    );
    enemy.primaryCooldown = 999;
    for (const part of enemy.hardpoints) {
      part.cooldown = 999;
    }
    enemy.velocity = { x: 30, y: -30 };
    flight.objects.push({
      ...position,
      enemy,
      hp: enemy.hp,
      id,
      kind: "enemy",
      persistent: false,
      radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    });
  }
  for (const [index, screen] of [
    { x: -60, y: 120 },
    { x: 170, y: -40 },
  ].entries()) {
    flight.objects.push({
      ...at(screen),
      hp: 3,
      id: `ballistic:0,0:9${index}`,
      kind: "debris",
      radius: 18,
      velocity: { x: 12, y: -4 },
    });
  }
  flight.objects.push({
    ...at({ x: 60, y: -100 }),
    hp: 1,
    id: "browser-keyline:ore",
    kind: "pickup",
    radius: 7,
    role: "cargo",
  });
  const serialized = model.save();
  assert.deepEqual(restoreSave(serialized), model.state, "Canonical restore accepts the proof");
  return serialized;
}

// Cartwheel's hub with its story craft and mooring buoys in view, for the keyline review: the
// story resolved, as the hub station fixture holds it, so the world places the hub and the miner
// and visitors stand docked or moored beside it; Ada just below it, with no enemies near.
export function hubFixture() {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 2];
  Object.assign(model.state.progress[2], {
    introduced: true,
    questComplete: true,
    resolved: true,
    stage: 5,
  });
  model.startGalaxy(2);
  playOpening(model);
  model.state.dialogue = null;
  Object.assign(model.state.progress[2], { known: ["hub"], stations: ["hub"] });
  const flight = model.state.flight;
  assert.ok(flight, "The hub fixture requires Cartwheel's flight");
  delete flight.storyScene;
  flight.objects = flight.objects.filter(({ kind }) => kind !== "enemy");
  flight.shots = [];
  const hub = ensureDestination(CONTENT, "hub", flight);
  assert.ok(
    flight.objects.some((object) => object.kind === "destination" && object.id === "hub"),
    "The resolved story places the hub",
  );
  const below = toWorld({ x: 0, y: 90 });
  flight.player = { x: hub.x + below.x, y: hub.y + below.y };
  flight.velocity = { x: 0, y: 0 };
  const serialized = model.save();
  assert.deepEqual(restoreSave(serialized), model.state, "Canonical restore accepts the hub");
  return serialized;
}

// The backdrop proof: galaxy `galaxy`'s backdrop layers and both rock depths with no play objects.
export function backdropFixture(rockArt, debris, galaxy) {
  const model = emptyFlight(rockArt, debris, galaxy, [1, 2, 3, 4, 5, 6]);
  const serialized = model.save();
  assert.deepEqual(restoreSave(serialized), model.state, "Canonical restore accepts the flight");
  return serialized;
}

export function asteroidFixture(rockArt, debris, galaxy, drifting = true) {
  const model = emptyFlight(rockArt, debris, galaxy, [1, 2, 3]);
  const flight = model.state.flight;
  const origin = { ...flight.player };
  for (const [size, screen] of Object.entries(ROCK_SCREEN)) {
    const art = ASTEROID_ART.asteroids.find((entry) => entry.size === size);
    const offset = toWorld(screen);
    flight.objects.push({
      asteroid: art.id,
      hp: 99,
      id: `browser-rock:${size}`,
      kind: "rock",
      radius: art.footprintRadius,
      x: origin.x + offset.x,
      y: origin.y + offset.y,
    });
  }
  const small = ASTEROID_ART.asteroids.find((entry) => entry.size === "small");
  const centre = toWorld({ x: -200, y: -130 });
  // Adding 0 turns -0 into 0, which a save's JSON round-trip would otherwise change.
  const orbit = {
    phase: 0 - 0.3 * flight.time,
    radius: 30,
    rate: 0.3,
    x: origin.x + centre.x,
    y: origin.y + centre.y,
  };
  const motion = orbitMotion(flight.time, orbit);
  if (drifting) {
    flight.objects.push({
      asteroid: small.id,
      hp: 99,
      id: "browser-rock:drifting",
      kind: "rock",
      orbit,
      radius: small.footprintRadius,
      velocity: { x: motion.velocity.x + 0, y: motion.velocity.y + 0 },
      x: motion.position.x + 0,
      y: motion.position.y + 0,
    });
  }
  const serialized = model.save();
  assert.deepEqual(restoreSave(serialized), model.state, "Canonical restore accepts rocks");
  return serialized;
}
