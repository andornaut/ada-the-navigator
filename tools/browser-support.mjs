import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

// Shared by the browser smoke and the Art review captures, which run in the same container.
export const output = "/tmp/evidence";
export const storageKey = "ada-the-navigator.prototype.v1";
export const previewOrigin = "http://ada-preview:4173";
mkdirSync(output, { recursive: true });

export function save(name, value) {
  writeFileSync(`${output}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
}

// A canvas's size in logical px: its CSS size over the fit of the 720x360 base view. Its backing
// is in device pixels.
export function logicalSize(canvas) {
  const fit = Math.min(canvas.offsetWidth / 720, canvas.offsetHeight / 360);
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

// A CSP violation in any page logs a console error, which the run's error check fails on.
export function reportViolations() {
  document.addEventListener("securitypolicyviolation", (event) => {
    console.error(
      `CSP violation: ${event.effectiveDirective} blocked ${event.blockedURI || "inline"}`,
    );
  });
}

// No outside requests are needed to render the built prototype.
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
  { PROTOTYPE },
  { playOpening },
  { restoreSave },
  { ASTEROID_ART },
  asteroidArt,
  { orbitMotion },
] = await Promise.all([
  import(new URL("../src/model/game.ts", import.meta.url)),
  import(new URL("../src/data/prototype.ts", import.meta.url)),
  import(new URL("../src/testing/launch.ts", import.meta.url)),
  import(new URL("../src/model/save.ts", import.meta.url)),
  import(new URL("../src/data/asteroid-catalog.ts", import.meta.url)),
  import(new URL("../src/game/asteroid-art.ts", import.meta.url)),
  import(new URL("../src/model/asteroids.ts", import.meta.url)),
]);

// The play view's projection of a world offset from Ada to logical screen px, and back.
export const toScreen = (world) => ({
  x: 360 + world.x - world.y,
  y: 180 + (world.x + world.y) / 2,
});
export const toWorld = (screen) => ({ x: screen.x / 2 + screen.y, y: screen.y - screen.x / 2 });

// The first flight seed whose backdrop field shows a rock in the asteroid fixture's open
// top-centre area, clear of its play rocks (shown), or none in view at all. `rockArt` is Art's
// served asteroid catalog. Backdrop rocks lie in their layer, about the camera's world position
// times the rocks' `parallax` (art/backdrop.md).
export function backdropSeed(rockArt, parallax, shown, player) {
  const { cell } = asteroidArt.BACKDROP_FIELD;
  const camera = { x: player.x * parallax, y: player.y * parallax };
  const cx = Math.floor(camera.x / cell);
  const cy = Math.floor(camera.y / cell);
  for (let seed = 1; seed < 2000; seed++) {
    let near = false;
    let visible = false;
    for (let x = cx - 4; x <= cx + 4; x++) {
      for (let y = cy - 4; y <= cy + 4; y++) {
        const rock = asteroidArt.backdropRock(rockArt, seed, x, y);
        if (rock) {
          const at = toScreen({ x: rock.x - camera.x, y: rock.y - camera.y });
          near ||= at.x > 250 && at.x < 340 && at.y > 70 && at.y < 140;
          visible ||= at.x > -120 && at.x < 840 && at.y > -80 && at.y < 440;
        }
      }
    }
    if (shown ? near : !visible) {
      return seed;
    }
  }
  throw new Error(`No backdrop seed ${shown ? "shows" : "hides"} a rock near Ada`);
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
export function asteroidFixture(rockArt, parallax, sector, drifting = true) {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked = [1, 2, 3];
  model.startSector(sector);
  playOpening(model);
  assert.ok(model.state.flight, `Asteroid fixture requires galaxy ${sector}'s flight`);
  const flight = model.state.flight;
  model.state.progress[sector].introduced = true;
  model.state.dialogue = null;
  flight.objects = [];
  flight.shots = [];
  flight.seed = backdropSeed(rockArt, parallax, true, flight.player);
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
