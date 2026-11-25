import assert from "node:assert/strict";

import { pauseClock, toWorld } from "./browser-support.mjs";

// The visible-art batch review sets for tools/browser-captures.mjs: canonical saves of each view
// the batch redraws (the fleet, stations, pickups, landmarks, Needle, craft and whales,
// backdrops, Ada's ship and its fixes, weapons, effects, controls and edge markers), held still
// on a paused page clock.
// Each set stays within the run's 120 second limit; name the sets in separate runs.

const [
  { GameModel },
  { CONTENT },
  { ECONOMY },
  { playOpening },
  { restoreSave },
  { enemyActorDefinition },
  { createEnemy },
  { retaliatorVariant },
  {
    activateRequiredWhirlpoolRoute,
    ensureDestination,
    ensureStation,
    shipSpeedFraction,
    spawnChapterEnemy,
  },
  { stationsNear },
  { settlementsNear },
  { landmarkSites },
  { guideBeaconSlots },
  { needleCourses },
  { ensureNeedleDebris },
  { phantomAllyRoster, rotatePhantomAllies },
  { SHIP_REACH },
  { currentsNear, pointOnCurrent },
  { JOB_POOL },
  { PROJECTS },
  { GALAXY_ID },
  { readAsteroidCatalog },
  { backdropFixture },
  { uiIconUrl },
  { flightEncounterSeed },
  { GAME_AREA },
  { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP },
] = await Promise.all([
  import(new URL("../src/model/game.ts", import.meta.url)),
  import(new URL("../src/data/content.ts", import.meta.url)),
  import(new URL("../src/data/economy.ts", import.meta.url)),
  import(new URL("../src/testing/launch.ts", import.meta.url)),
  import(new URL("../src/model/save.ts", import.meta.url)),
  import(new URL("../src/data/enemyActorDefinition.ts", import.meta.url)),
  import(new URL("../src/model/enemyAi.ts", import.meta.url)),
  import(new URL("../src/data/enemyIdentity.ts", import.meta.url)),
  import(new URL("../src/model/flight.ts", import.meta.url)),
  import(new URL("../src/model/stations.ts", import.meta.url)),
  import(new URL("../src/model/legacySettlements.ts", import.meta.url)),
  import(new URL("../src/model/landmarks.ts", import.meta.url)),
  import(new URL("../src/model/guideBeacons.ts", import.meta.url)),
  import(new URL("../src/model/needle.ts", import.meta.url)),
  import(new URL("../src/model/needleFlight.ts", import.meta.url)),
  import(new URL("../src/model/phantomAllies.ts", import.meta.url)),
  import(new URL("../src/model/shipBody.ts", import.meta.url)),
  import(new URL("../src/model/currents.ts", import.meta.url)),
  import(new URL("../src/data/jobs.ts", import.meta.url)),
  import(new URL("../src/data/projects.ts", import.meta.url)),
  import(new URL("../src/data/galaxies.ts", import.meta.url)),
  import(new URL("../src/data/asteroidCatalog.ts", import.meta.url)),
  import("./browser-support.mjs"),
  import(new URL("../src/data/uiIconUrl.ts", import.meta.url)),
  import(new URL("../src/model/flightTopology.ts", import.meta.url)),
  import(new URL("../src/model/edgeMarkers.ts", import.meta.url)),
  import(new URL("../src/data/phantom.ts", import.meta.url)),
]);

const ALL = [1, 2, 3, 4, 5, 6];
const scope = "Canonical visible-art batch fixture for before/after review";

/** Runs `step` for each item in turn, one renderer at a time. */
const inTurn = (items, step) =>
  items.reduce((previous, item) => previous.then(() => step(item)), Promise.resolve());

/**
 * The destination `id` in the model's flight, placed as Ada's arrival places it: a required
 * site reserved in a role plan moves into the flight with its guards.
 */
function located(model, id) {
  const flight = model.state.flight;
  const place = ensureDestination(CONTENT, id, flight);
  activateRequiredWhirlpoolRoute(CONTENT, model.state.progress[flight.galaxy], flight, id);
  return place;
}
/** A flight in `galaxy` with its opening played, no dialogue and no shots, held at rest. */
function flightModel(galaxy, { unlocked = ALL } = {}) {
  const model = new GameModel(CONTENT);
  model.state.unlocked = unlocked;
  // The highest shield outlasts every capture's hits on Ada.
  model.state.economy.levels.shield = 3;
  model.startGalaxy(galaxy);
  playOpening(model);
  const flight = model.state.flight;
  assert.ok(flight, `The fixture requires galaxy ${galaxy}'s flight`);
  model.state.progress[galaxy].introduced = true;
  model.state.dialogue = null;
  flight.shots = [];
  flight.mines = [];
  flight.velocity = { x: 0, y: 0 };
  return model;
}
const withoutEnemies = (flight) => {
  flight.objects = flight.objects.filter(({ kind }) => kind !== "enemy");
};
/** The world point at a screen offset from Ada. */
function at(flight, screen) {
  const offset = toWorld(screen);
  return { x: flight.player.x + offset.x, y: flight.player.y + offset.y };
}
/** Moves Ada so `point` draws at the screen offset `screen` from her. */
function beside(flight, point, screen) {
  const offset = toWorld(screen);
  flight.player = { x: point.x - offset.x, y: point.y - offset.y };
}
/** Funds and reveals `ids` of the galaxy's community projects, as a finished project stands. */
function fund(model, galaxy, ids) {
  const progress = model.state.progress[galaxy];
  progress.donated = { ...progress.donated };
  for (const id of ids) {
    const project = PROJECTS[galaxy].find((entry) => entry.id === id);
    assert.ok(project, `Galaxy ${galaxy} has project ${id}`);
    progress.donated[id] = project.cost;
  }
  progress.revealed = [...new Set([...(progress.revealed ?? []), ...ids])];
}
/** An enemy held at a screen offset from Ada, holding its fire unless its hardpoints are listed. */
function addEnemy(model, { archetype, fire = [], id, screen, setup, weaponLevel = 1 }) {
  const flight = model.state.flight;
  const galaxy = flight.galaxy;
  const actorId = id ?? `browser-art:${archetype}:${screen.x}:${screen.y}`;
  const definition = enemyActorDefinition(galaxy, archetype, actorId, weaponLevel);
  const position = at(flight, screen);
  const enemy = createEnemy(
    definition,
    { archetype, id: actorId, packId: null, phase: 0, weaponLevel },
    position,
  );
  enemy.engaged = true;
  enemy.primaryCooldown = 999;
  for (const part of enemy.hardpoints) {
    part.cooldown = fire.includes(part.id) ? 0.6 : 999;
  }
  setup?.(enemy);
  flight.objects.push({
    ...position,
    enemy,
    hp: enemy.hp,
    id: enemy.id,
    kind: "enemy",
    persistent: false,
    radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
  });
  return enemy;
}
const destroyWeapons = (enemy) => {
  for (const part of enemy.hardpoints) {
    if (!["command", "engine", "engine-left", "engine-right"].includes(part.id)) {
      part.hp = 0;
    }
  }
  enemy.disabled = true;
};

/**
 * Builds the visible-art batch sets over the runner's fixture helpers: `ctx` supplies
 * openFixture, openHome, frames, shot, closeUp, pageShot, release, awaitGalaxyArt, fixtureFile
 * and page.
 */
export function batchCaptures(ctx) {
  /** The model's canonical save, checked by restore and kept as fixture evidence. */
  function canonical(model, name) {
    const serialized = model.save();
    assert.deepEqual(restoreSave(serialized), model.state, `Canonical restore accepts ${name}`);
    ctx.fixtureFile(name, scope, serialized);
    return serialized;
  }
  /** Lets lazily loaded art (whales, paints, allies) arrive on a running clock, then pauses. */
  async function settle(ms = 1500) {
    const page = ctx.page();
    await page.clock.resume();
    await page.waitForTimeout(ms);
    await pauseClock(page);
    await page.clock.runFor(100);
  }
  /** Opens a fixture and waits for its galaxy's art. */
  async function open(serialized, options) {
    await ctx.openFixture(serialized, options);
    await ctx.awaitGalaxyArt();
  }
  async function still(name, model, options) {
    await open(canonical(model, name), options);
    await ctx.frames(name);
  }

  // The enemy fleet: each galaxy's frigate and capital intact, its frigate with every weapon
  // destroyed and disabled, and its capital disabled and salvaged.
  async function fleet() {
    await inTurn(ALL, async (galaxy) => {
      const model = flightModel(galaxy);
      model.state.flight.objects = [];
      addEnemy(model, { archetype: "frigate", screen: { x: -170, y: -20 } });
      addEnemy(model, { archetype: "capital", screen: { x: 150, y: -40 } });
      addEnemy(model, {
        archetype: "frigate",
        screen: { x: -160, y: 130 },
        setup: destroyWeapons,
      });
      addEnemy(model, {
        archetype: "capital",
        screen: { x: 160, y: 140 },
        setup: (enemy) => {
          destroyWeapons(enemy);
          enemy.salvaged = true;
        },
      });
      await still(`fleet-heavies-${GALAXY_ID[galaxy]}`, model);
    });
  }
  // The weapon tops each tier mounts: Phantom's frigate and capital at weapon levels 2 and 3.
  async function fleetTops() {
    await inTurn([1, 2, 3], async (weaponLevel) => {
      const model = flightModel(6);
      model.state.flight.objects = [];
      addEnemy(model, { archetype: "frigate", screen: { x: -170, y: -20 }, weaponLevel });
      addEnemy(model, { archetype: "capital", screen: { x: 150, y: -40 }, weaponLevel });
      await still(`fleet-tops-phantom-level-${weaponLevel}`, model);
    });
  }
  // The retaliators (each hull the tree rolls), fighters, interceptors and swarm craft of each
  // galaxy, held still.
  function retaliatorIds() {
    const ids = [];
    const seen = new Set();
    for (let n = 0; n < 400 && ids.length < 3; n++) {
      const id = `browser-art:retaliator:${n}`;
      const variant = String(retaliatorVariant({ archetype: "retaliator", id }));
      if (!seen.has(variant)) {
        seen.add(variant);
        ids.push(id);
      }
    }
    for (let n = 400; ids.length < 3; n++) {
      ids.push(`browser-art:retaliator:${n}`);
    }
    return ids;
  }
  async function fleetCraft() {
    const ids = retaliatorIds();
    await inTurn(ALL, async (galaxy) => {
      const model = flightModel(galaxy);
      model.state.flight.objects = [];
      ids.forEach((id, index) =>
        addEnemy(model, { archetype: "retaliator", id, screen: { x: -220 + 220 * index, y: -95 } }),
      );
      addEnemy(model, { archetype: "fighter", screen: { x: -150, y: 80 } });
      addEnemy(model, { archetype: "interceptor", screen: { x: 30, y: 95 } });
      addEnemy(model, { archetype: "swarm", screen: { x: 170, y: 80 } });
      await still(`fleet-craft-${GALAXY_ID[galaxy]}`, model);
    });
  }
  // Hostile stations and the Claim platform: the Claim station and platform in Cartwheel, intact
  // and with their weapons destroyed, the garnet station in Andromeda and the coral station and
  // the platform in Phantom.
  async function hostile() {
    const cases = [
      ["cartwheel", 2, true, false],
      ["cartwheel-destroyed", 2, true, true],
      ["andromeda", 5, false, false],
      ["phantom", 6, true, false],
    ];
    await inTurn(cases, async ([name, galaxy, platform, destroyed]) => {
      const model = flightModel(galaxy);
      model.state.flight.objects = [];
      const setup = destroyed ? destroyWeapons : undefined;
      addEnemy(model, { archetype: "hostileStation", screen: { x: -150, y: -20 }, setup });
      if (platform) {
        addEnemy(model, { archetype: "platform", screen: { x: 200, y: 40 }, setup });
      }
      await still(`hostile-${name}`, model);
    });
  }

  /** A flight beside the galaxy's nearest seeded station, its art drawn at screen (-120, -20). */
  function stationModel(galaxy, projects = []) {
    const model = flightModel(galaxy);
    const flight = model.state.flight;
    const origin = { x: 0, y: 0 };
    const [site] = stationsNear(ECONOMY, galaxy, 40000, origin).sort(
      (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
    );
    assert.ok(site, `Galaxy ${galaxy} has a seeded station`);
    const station = ensureStation(CONTENT, site.id, flight);
    beside(flight, station, { x: -120, y: -20 });
    fund(model, galaxy, projects);
    withoutEnemies(flight);
    return model;
  }
  /** A flight beside the destination `id`, its art drawn at `screen`. */
  function destinationModel(galaxy, id, { projects = [], screen = { x: -110, y: -20 } } = {}) {
    const model = flightModel(galaxy);
    const flight = model.state.flight;
    fund(model, galaxy, projects);
    const place = located(model, id);
    beside(flight, place, screen);
    withoutEnemies(flight);
    return model;
  }
  /** Cartwheel's hub with its story resolved, Ada below it, with the projects funded. */
  function hubModel(projects) {
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
    fund(model, 2, projects);
    const flight = model.state.flight;
    delete flight.storyScene;
    withoutEnemies(flight);
    flight.shots = [];
    const hub = ensureDestination(CONTENT, "hub", flight);
    beside(flight, hub, { x: -150, y: -10 });
    flight.velocity = { x: 0, y: 0 };
    return model;
  }
  // Sunflower's station and outposts (the growers' leaf hull, its greenhouse ring, the workshop
  // crane and the salvage beacons) and Cartwheel's hub worn, worn with its docking bay and
  // repaired with it.
  async function stationsSunflowerCartwheel() {
    await still("stations-sunflower-station", stationModel(1));
    await still("stations-sunflower-growers", destinationModel(1, "growers"));
    await still(
      "stations-sunflower-growers-greenhouse",
      destinationModel(1, "growers", { projects: ["greenhouseRing"] }),
    );
    await still(
      "stations-sunflower-workshop-crane",
      destinationModel(1, "workshop", { projects: ["workshopCrane"] }),
    );
    await still(
      "stations-sunflower-salvagers-beacons",
      destinationModel(1, "salvagers", { projects: ["salvageBeacons"] }),
    );
    await still("stations-cartwheel-hub-worn", hubModel([]));
    await still("stations-cartwheel-hub-worn-bay", hubModel(["dockingBay"]));
    await still("stations-cartwheel-hub-repaired-bay", hubModel(["dockingBay", "hubRepairs"]));
  }
  // Whirlpool's and Needle's stations, the Needle station as the Loom hall, and Needle's Elder
  // Loom.
  async function stationsWhirlpoolNeedle() {
    await still("stations-whirlpool-station", stationModel(3));
    await still("stations-needle-station", stationModel(4));
    await still("stations-needle-loom-hall", stationModel(4, ["loomHall"]));
    await still("stations-needle-elder-loom", destinationModel(4, "elderLoom"));
  }
  // Andromeda's station, a hamlet and a lamphouse settlement and the dark beacon, and Phantom's
  // station and settlements cracked and mended.
  async function stationsAndromedaPhantom() {
    await still("stations-andromeda-station", stationModel(5));
    const model = flightModel(5);
    const flight = model.state.flight;
    const sites = settlementsNear(ECONOMY, 20000, flight.player);
    await inTurn([0, 1], async (parity) => {
      const site = sites.find((entry) => {
        const [cx, cy] = entry.id.slice("settlement:".length).split(",").map(Number);
        return Math.abs(cx + cy) % 2 === parity;
      });
      assert.ok(site, `Andromeda has a settlement of variant ${parity}`);
      const settled = flightModel(5);
      const settledFlight = settled.state.flight;
      const place = ensureDestination(CONTENT, site.id, settledFlight);
      place.role = "settlement";
      beside(settledFlight, place, { x: -110, y: -20 });
      withoutEnemies(settledFlight);
      await still(`stations-andromeda-settlement-${parity ? "lamphouse" : "hamlet"}`, settled);
    });
    await still("stations-andromeda-dark-beacon", destinationModel(5, "darkBeacon"));
    await still("stations-phantom-station", stationModel(6));
    await inTurn([false, true], async (mended) => {
      const phantom = flightModel(6);
      phantom.state.progress[6].questComplete = mended;
      const phantomFlight = phantom.state.flight;
      const homes = ensureDestination(CONTENT, "phantomSettlement1", phantomFlight);
      beside(phantomFlight, homes, { x: -110, y: -20 });
      withoutEnemies(phantomFlight);
      await still(`stations-phantom-homes-${mended ? "mended" : "cracked"}`, phantom);
    });
  }

  // Pickups: Stardust of one and five, ore of one and five, the ammo pack, the upgrade chevron
  // and a discovery cache lit and hidden, across the climb and glint loops; then Needle's black
  // holodisk with its waypoint beacon.
  async function pickups() {
    const model = flightModel(1);
    const flight = model.state.flight;
    flight.objects = [];
    const pickup = (id, screen, fields) =>
      flight.objects.push({ hp: 1, id, kind: "pickup", ...at(flight, screen), ...fields });
    pickup("stardust:browser-1", { x: -220, y: -70 }, { amount: 1, radius: 10, role: "stardust" });
    pickup("stardust:browser-5", { x: -140, y: -70 }, { amount: 5, radius: 12, role: "stardust" });
    pickup("piece:browser-1", { x: -60, y: -70 }, { amount: 1, radius: 7, role: "cargo" });
    pickup("piece:browser-5", { x: 20, y: -70 }, { amount: 5, radius: 7, role: "cargo" });
    pickup(
      "drop:browser-ammo",
      { x: 100, y: -70 },
      { ammoPack: true, radius: CONTENT.tuning.flight.pickupRadius, role: "drop" },
    );
    pickup(
      "drop:browser-upgrade",
      { x: 180, y: -70 },
      { radius: CONTENT.tuning.flight.pickupRadius, role: "drop", upgrade: true },
    );
    pickup("browser-cache:lit", { x: -120, y: 70 }, { amount: 5, radius: 10, role: "discovery" });
    pickup("browser-cache:hidden", { x: 300, y: 10 }, { amount: 5, radius: 10, role: "discovery" });
    await open(canonical(model, "pickups"));
    // The climb loops every 1140 ms: twelve frames 95 ms apart sample it evenly.
    await ctx.frames("pickups", { every: 95, shots: 12 });
    const disk = flightModel(4);
    const diskFlight = disk.state.flight;
    const holodisk = ensureDestination(CONTENT, "holodisk", diskFlight);
    beside(diskFlight, holodisk, { x: -90, y: -30 });
    withoutEnemies(diskFlight);
    await open(canonical(disk, "pickups-holodisk"));
    await ctx.frames("pickups-holodisk", { every: 150, shots: 6 });
  }

  // Resources (art/stardust.md): Stardust and ore of one and five in flight on
  // Phantom's dark field and Sunflower's light field, one Stardust inside Ada's tractor radius
  // with its pull streak, each with the HUD status pill; then the Ship card, the station's
  // welcome balances, Shop price pills, buy confirm, Jobs pane hints and Exchange, and the
  // Quests detail of Cartwheel's ore objective, each drawing the Stardust or ore icons.
  async function resources() {
    await inTurn(
      [
        [6, "dark"],
        [1, "light"],
      ],
      async ([galaxy, field]) => {
        const model = flightModel(galaxy);
        const flight = model.state.flight;
        flight.objects = [];
        flight.cargo = 12;
        model.state.economy.stardust = 345;
        const pickup = (id, screen, fields) =>
          flight.objects.push({ hp: 1, id, kind: "pickup", ...at(flight, screen), ...fields });
        pickup(
          "stardust:browser-1",
          { x: -180, y: -60 },
          { amount: 1, radius: 10, role: "stardust" },
        );
        pickup(
          "stardust:browser-5",
          { x: -100, y: -60 },
          { amount: 5, radius: 12, role: "stardust" },
        );
        pickup("piece:browser-1", { x: 100, y: -60 }, { amount: 1, radius: 7, role: "cargo" });
        pickup("piece:browser-5", { x: 180, y: -60 }, { amount: 5, radius: 7, role: "cargo" });
        // About 52 world px from Ada, inside the base 60 tractor radius: the pull streak trails it.
        pickup(
          "stardust:browser-pulled",
          { x: 70, y: 10 },
          { amount: 1, radius: 10, role: "stardust" },
        );
        await open(canonical(model, `resources-flight-${field}`));
        await ctx.frames(`resources-flight-${field}`, { every: 160, shots: 4 });
        await ctx.pageShot(`resources-flight-${field}-page.png`);
      },
    );
    // The Ship card's Stardust and ore rows.
    const ship = flightModel(1);
    ship.state.flight.objects = [];
    ship.state.flight.cargo = 12;
    ship.state.economy.stardust = 345;
    await open(canonical(ship, "resources-ship"), { frozen: false });
    const shipPage = ctx.page();
    await shipPage.clock.resume();
    await shipPage.locator('[data-action="pause"]').click();
    await shipPage.locator('[data-action="pause-ship"]').click();
    await shipPage.locator('[data-dialog="ship"]').waitFor({ state: "visible" });
    await shipPage.waitForTimeout(300);
    await ctx.pageShot("resources-ship-card.png");
    // Docked at Sunflower's nearest station: welcome balances, Shop, a buy confirm, Jobs and
    // Exchange.
    const docked = stationModel(1);
    docked.state.economy.stardust = 345;
    const nearest = stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 }).sort(
      (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
    )[0];
    docked.state.docked = nearest.id;
    docked.state.flight.cargo = 12;
    await open(canonical(docked, "resources-station"), { frozen: false });
    const station = ctx.page();
    await station.clock.resume();
    const view = async (action, file) => {
      await station.locator(`[data-action="${action}"]`).click();
      await station.waitForTimeout(300);
      await ctx.pageShot(file);
    };
    // A restored docked save can open without the station menu; the page is then kept as is.
    const menu = await station
      .locator('[data-action="open-shop"]')
      .waitFor({ state: "visible", timeout: 5000 })
      .then(
        () => true,
        () => false,
      );
    await ctx.pageShot("resources-station-welcome.png");
    if (menu) {
      await view("open-shop", "resources-station-shop.png");
      await station.locator(".ada-shop-row:has(.ada-price)").first().click();
      await station.waitForTimeout(300);
      await ctx.pageShot("resources-station-confirm.png");
      await view("confirm-cancel-x", "resources-station-shop-again.png");
      await view("shop-back", "resources-station-welcome-again.png");
      await view("open-jobs", "resources-station-jobs.png");
      await view("jobs-back", "resources-station-welcome-after-jobs.png");
      await view("open-exchange", "resources-station-exchange.png");
    }
    // Cartwheel's story at its first mining milestone: the Quests detail's ore objectives.
    const quest = flightModel(2);
    Object.assign(quest.state.progress[2], { deposited: 3, stage: 1 });
    quest.state.flight.cargo = 4;
    withoutEnemies(quest.state.flight);
    await open(canonical(quest, "resources-quest"), { frozen: false });
    const questPage = ctx.page();
    await questPage.clock.resume();
    await questPage.locator('[data-action="pause"]').click();
    await questPage.locator('[data-action="pause-quests"]').click();
    const quests = questPage.locator(".ada-quests-screen");
    await quests.waitFor({ state: "visible" });
    await questPage.waitForTimeout(300);
    await ctx.pageShot("resources-quests-list.png");
    await quests.locator(".ada-quest-list .ada-button").first().click();
    await questPage.waitForTimeout(300);
    await ctx.pageShot("resources-quests-detail.png");
  }

  // Beacons and landmarks: the survey beacon, wreck and nebula landmarks, Andromeda's guide
  // beacons, Needle's channel lamps and practice berth, Whirlpool's current buoys, nursery beacon
  // and quiet crossing.
  async function landmarks() {
    await inTurn(["beacon", "wreck", "nebula"], async (kind) => {
      const galaxy = [1, 2, 3, 4, 5].find((g) => landmarkSites(g).some((s) => s.kind === kind));
      assert.ok(galaxy, `Some galaxy has a ${kind} landmark`);
      const site = landmarkSites(galaxy).find((entry) => entry.kind === kind);
      const model = flightModel(galaxy);
      const flight = model.state.flight;
      beside(flight, site, { x: -110, y: -20 });
      withoutEnemies(flight);
      await still(`landmarks-${kind}`, model);
    });
    const guide = flightModel(5);
    const guideFlight = guide.state.flight;
    const distance = ({ point }) =>
      Math.hypot(point.x - guideFlight.player.x, point.y - guideFlight.player.y);
    const [slot] = guideBeaconSlots(guideFlight.player, 20000).sort(
      (a, b) => distance(a) - distance(b),
    );
    assert.ok(slot, "Andromeda has a guide beacon near Ada");
    beside(guideFlight, slot.point, { x: -110, y: -20 });
    withoutEnemies(guideFlight);
    await still("landmarks-andromeda-guide-beacon", guide);
    await still(
      "landmarks-needle-lamps-berth",
      destinationModel(4, "needlePractice", {
        projects: ["channelLights", "practiceBerth"],
        screen: { x: 0, y: 0 },
      }),
    );
    await still(
      "landmarks-whirlpool-buoys-nursery",
      destinationModel(3, "family", {
        projects: ["currentBuoys", "nurseryBeacon", "quietCrossing"],
        screen: { x: -60, y: -40 },
      }),
    );
  }

  // Needle's ring gates with Ada passing through practice gate 0 (the steep axis) and the Eye's
  // gate 4 (the shallow axis), and the band over the Eye's ordered debris at its midpoint.
  async function needle() {
    const cases = [
      ["practice", 0],
      ["eye", 4],
    ];
    await inTurn(cases, async ([course, index]) => {
      const model = flightModel(4);
      const flight = model.state.flight;
      const gate = needleCourses(flight)[course].gates[index];
      flight.player = {
        x: gate.point.x - gate.tangent.x * 12,
        y: gate.point.y - gate.tangent.y * 12,
      };
      flight.facing = { ...gate.tangent };
      flight.velocity = { x: gate.tangent.x * 60, y: gate.tangent.y * 60 };
      ensureNeedleDebris(CONTENT, flight);
      withoutEnemies(flight);
      await still(`needle-gate-${course}-${index}`, model);
    });
    const model = flightModel(4);
    const flight = model.state.flight;
    const { path } = needleCourses(flight).eye;
    flight.player = { ...path[Math.floor(path.length / 2)] };
    ensureNeedleDebris(CONTENT, flight);
    withoutEnemies(flight);
    await still("needle-eye-band", model);
  }

  // Friendly craft and whales: Whirlpool's Marlo and the whale family, Cartwheel's blocking
  // pilot, and Phantom's allies in three turns of eight, the last with the finale whale pair.
  async function craft() {
    await inTurn(["whale", "family"], async (id) => {
      const model = destinationModel(3, id, { screen: { x: -40, y: -40 } });
      await open(canonical(model, `craft-whirlpool-${id}`));
      await settle();
      await ctx.frames(`craft-whirlpool-${id}`, { every: 250, shots: 3 });
    });
    const story = new GameModel(CONTENT);
    story.state.unlocked = [1, 2];
    story.startGalaxy(2);
    playOpening(story);
    story.state.progress[2].introduced = true;
    story.state.dialogue = null;
    const storyFlight = story.state.flight;
    storyFlight.shots = [];
    storyFlight.velocity = { x: 0, y: 0 };
    const hub = located(story, "hub");
    withoutEnemies(storyFlight);
    beside(storyFlight, hub, { x: -150, y: -10 });
    await still("craft-cartwheel-hub-moored", story);
    const specs = [1, 2, 3, 4, 5].map((galaxy) => ({
      activityCompleted: true,
      galaxy,
      projects: (PROJECTS[galaxy] ?? []).map(({ ally, id }) => ({ ally, project: id })),
    }));
    const roster = phantomAllyRoster(specs, SHIP_REACH);
    await inTurn([0, 1, 2], async (turn) => {
      const model = flightModel(6);
      const flight = model.state.flight;
      withoutEnemies(flight);
      assert.ok(flight.phantom, "Phantom's flight carries its chapter state");
      const allies = rotatePhantomAllies(roster, turn, flight).map((ally) => ({
        ...ally,
        jumpAge: 1,
        velocity: { x: 0, y: -20 },
      }));
      flight.phantom.allies = allies;
      await open(canonical(model, `craft-phantom-allies-${turn + 1}`));
      await settle();
      await ctx.frames(`craft-phantom-allies-${turn + 1}`);
    });
  }

  // Each galaxy's backdrop with its motif field and decorations, no play objects.
  async function backdrops() {
    const manifest = await ctx.served("/art/manifest.json");
    const { debris } = await ctx.served(manifest.backdropLayers);
    const rockArt = readAsteroidCatalog(await ctx.served("/art/asteroids.json"));
    assert.ok(rockArt, "Art's asteroid catalog must read as version 1");
    await inTurn(ALL, async (galaxy) => {
      const serialized = backdropFixture(rockArt, debris, galaxy);
      const name = `backdrops-${GALAXY_ID[galaxy]}`;
      ctx.fixtureFile(name, scope, serialized);
      await open(serialized);
      await ctx.frames(name);
    });
  }

  /**
   * Opens a galaxy-one flight, with Whirlpool unlocked, as the fixture `name` and goes to the
   * galaxy map's Galaxies view on the running page clock.
   */
  async function galaxyMap(name, options) {
    const model = flightModel(1, { unlocked: [1, 3] });
    // The Paused card offers Map once the prologue and the opening are seen.
    model.state.prologueSeen = true;
    model.state.progress[1].opened = true;
    model.state.progress[3].opened = true;
    model.state.flight.objects = [];
    await ctx.openFixture(canonical(model, name), { ...options, frozen: false });
    const page = ctx.page();
    await page.clock.resume();
    await page.locator('[data-action="pause"]').click();
    await page.locator('[data-action="pause-map"]').click();
    await page.locator('[data-dialog="map"] [data-action="map-galaxies"]').click();
    await page.locator('.ada-route[data-dialog="galaxies"]').waitFor();
    await page.waitForTimeout(800);
    return page;
  }
  /** Moves the open Galaxies view's selection from galaxy one to Whirlpool. */
  async function selectWhirlpool(page) {
    await page.locator('[data-action="galaxy-jump"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
  }

  // Ada's ship fixes at 2 device px per CSS px: the start screen and the warp's settle poses,
  // then, in one set per plume size, her plumes at headings 0, 16, 32 and 48 under way forward
  // and in reverse. Each view adds a close-up of her canopy, tail and plume roots.
  const FIX_SCALE = { deviceScaleFactor: 2 };
  const FIX_HEADINGS = [0, 16, 32, 48];
  // Plume sizes as fractions of her top speed.
  const PLUME_SIZES = { l: 1, m: 0.6, s: 0.25 };
  /**
   * A galaxy-one flight with nothing in view, Ada facing `heading` of 64 and moving at `fraction`
   * of her top speed along it, or against it in `reverse`.
   */
  function underWay(fraction, reverse, heading) {
    const model = flightModel(1);
    const flight = model.state.flight;
    flight.objects = [];
    const angle = (heading * 2 * Math.PI) / 64;
    // Adding zero maps -0 to 0, so the save restores unchanged.
    flight.facing = { x: Math.cos(angle) + 0, y: Math.sin(angle) + 0 };
    const unit = { levels: flight.levels, velocity: { x: 1, y: 0 } };
    const speed = ((reverse ? -1 : 1) * fraction) / shipSpeedFraction(CONTENT, unit);
    flight.velocity = { x: speed * flight.facing.x + 0, y: speed * flight.facing.y + 0 };
    return model;
  }
  async function shipFixes() {
    const title = canonical(painted(flightModel(1), "classic"), "ship-fixes-title");
    const home = await ctx.openHome(title, FIX_SCALE);
    await home.locator(".ada-start-actions > button").first().waitFor();
    await home.waitForFunction(() => document.querySelector(".ada-start-ship")?.complete);
    await home.waitForTimeout(500);
    await ctx.pageShot("ship-fixes-title.png");
    await ctx.closeUp("ship-fixes-title-close.png", { selector: ".ada-start-ship" });
    const page = await galaxyMap("ship-fixes-jump", FIX_SCALE);
    await selectWhirlpool(page);
    await pauseClock(page);
    await page.locator('[data-action="galaxy-jump"]').click();
    // settle-24, settle-16 and settle-10 each hold 50 ms from 600 ms of the jump; one shot apiece
    // at its midpoint.
    await page.clock.runFor(625);
    await inTurn([24, 16, 10], async (pose) => {
      await ctx.pageShot(`ship-fixes-settle-${pose}.png`);
      await ctx.closeUp(`ship-fixes-settle-${pose}-close.png`, { side: 320 });
      await page.clock.runFor(50);
    });
  }
  const plumeSet = (size) => () =>
    inTurn(
      FIX_HEADINGS.flatMap((heading) => [false, true].map((reverse) => [reverse, heading])),
      async ([reverse, heading]) => {
        const name = `ship-fixes-${reverse ? "retro" : "forward"}-${size}-${heading}`;
        await open(canonical(underWay(PLUME_SIZES[size], reverse, heading), name), FIX_SCALE);
        await ctx.frames(name);
        await ctx.closeUp(`art-${name}-close.png`, { side: 160 });
      },
    );

  /** A save with Ada's ship in the paint scheme `paint`. */
  function painted(model, paint) {
    model.state.economy.paints = [...new Set(["classic", paint])];
    model.state.economy.paint = paint;
    return model;
  }
  // Ada's ship: the start screen in two schemes, in flight under way with her plumes in three
  // schemes and two engine levels, the galaxy map and the quantum jump.
  async function ship() {
    await inTurn(["classic", "iris"], async (paint) => {
      const model = painted(flightModel(1), paint);
      const serialized = canonical(model, `ship-title-${paint}`);
      const page = await ctx.openHome(serialized);
      await page.locator(".ada-start-actions > button").first().waitFor();
      await page.waitForFunction(() => document.querySelector(".ada-start-ship")?.complete);
      await page.waitForTimeout(500);
      await ctx.pageShot(`ship-title-${paint}.png`);
    });
    const cases = [
      ["classic", 1],
      ["classic", 3],
      ["iris", 3],
      ["amber", 3],
    ];
    await inTurn(cases, async ([paint, engine]) => {
      const model = painted(flightModel(1), paint);
      const flight = model.state.flight;
      flight.objects = [];
      flight.facing = { x: 1, y: 0 };
      flight.velocity = { x: 250, y: 0 };
      flight.levels.engine = engine;
      model.state.economy.levels.engine = engine;
      await open(canonical(model, `ship-flight-${paint}-engine-${engine}`));
      await settle();
      // Thrust held for 400 ms of clock time draws her plumes at full burn.
      const page = ctx.page();
      await ctx.release();
      await page.keyboard.down("KeyW");
      await page.clock.runFor(400);
      await ctx.frames(`ship-flight-${paint}-engine-${engine}`, { every: 120, shots: 2 });
      await page.keyboard.up("KeyW");
    });
    // The galaxy map from flight, and the quantum jump to Whirlpool from it.
    const page = await galaxyMap("ship-map");
    await ctx.pageShot("ship-map.png");
    await selectWhirlpool(page);
    await ctx.pageShot("ship-map-whirlpool.png");
    await pauseClock(page);
    await page.locator('[data-action="galaxy-jump"]').click();
    // The plume poses run from 300 to 750 ms of the 1000 ms jump.
    await page.clock.runFor(300);
    await inTurn([0, 1, 2, 3], async (step) => {
      await ctx.pageShot(`ship-jump-${step + 1}.png`);
      await page.clock.runFor(150);
    });
  }

  /** A flight in `galaxy` with nothing in view and `weapon` equipped, Ada facing `facing`. */
  function equipped(facing, level, weapon, galaxy = 1) {
    const model = flightModel(galaxy);
    const flight = model.state.flight;
    flight.objects = [];
    const length = Math.hypot(facing.x, facing.y);
    flight.facing = { x: facing.x / length, y: facing.y / length };
    // The laser is always aboard and needs no ammo.
    if (weapon !== "laser") {
      flight.ownedWeapons = [...new Set([...flight.ownedWeapons, weapon])];
      flight.ammo[weapon] = Math.max(flight.ammo[weapon], 20);
    }
    flight.weapon = weapon;
    flight.levels.weapons = { ...flight.levels.weapons, [weapon]: level };
    flight.fireCooldown = 0;
    return model;
  }
  /** A flight with `weapon` equipped and a retaliator held to Ada's screen right. */
  function armed(weapon, level = 1, galaxy = 1) {
    const model = equipped(toWorld({ x: 1, y: 0 }), level, weapon, galaxy);
    addEnemy(model, {
      archetype: "retaliator",
      id: "browser-art:target",
      screen: { x: 190, y: 0 },
    });
    return model;
  }
  // Where Ada's shots leave her hull: each weapon fired into open space at eight of the 64
  // headings, her idle hull first, then each of the first four frames after the trigger.
  const NOSE_HEADINGS = [0, 8, 16, 24, 32, 40, 48, 56];
  const noseSet = (weapon, level) => () =>
    inTurn(NOSE_HEADINGS, async (heading) => {
      const angle = (heading * 2 * Math.PI) / 64;
      const model = equipped({ x: Math.cos(angle), y: Math.sin(angle) }, level, weapon);
      const name = `nose-${weapon}-${heading}`;
      await open(canonical(model, name));
      const page = ctx.page();
      await ctx.frames(`${name}-idle`);
      await ctx.release();
      await page.keyboard.down("Space");
      await ctx.frames(name, { after: 17, every: 17, shots: 4 });
      await page.keyboard.up("Space");
    });
  // Ada's weapons in their flat look, each fired once at a held retaliator, with the missiles'
  // frames and blasts; then the Phantom capital's mines held in their spin frames.
  async function weapons() {
    const cases = [
      ["laser", 1],
      ["scattershot", 1],
      ["multiLaser", 3],
      ["rapidMissile", 1],
      ["heavyMissile", 1],
      ["phaser", 1],
    ];
    await inTurn(cases, async ([weapon, level]) => {
      const name = `weapons-${weapon}`;
      await open(canonical(armed(weapon, level), name));
      const page = ctx.page();
      await ctx.release();
      await page.keyboard.down("Space");
      await page.clock.runFor(20);
      await page.keyboard.up("Space");
      await ctx.frames(name, { after: 40, every: 110, shots: 5 });
    });
    const model = flightModel(6);
    const flight = model.state.flight;
    flight.objects = [];
    const owner = addEnemy(model, { archetype: "capital", screen: { x: 160, y: -60 } });
    [-150, -60, 30].forEach((x, index) =>
      flight.mines.push({
        age: 1 + index * 0.4,
        damage: 1,
        id: `browser-art:mine:${index}`,
        ownerId: owner.id,
        ...at(flight, { x, y: 90 }),
      }),
    );
    await open(canonical(model, "weapons-mines"));
    await ctx.frames("weapons-mines", { every: 120, shots: 3 });
  }

  /**
   * A flight in `galaxy` with traveling shots placed at screen offsets from Ada and held still:
   * the enemy's bolts, pellets (one past its fade point), Multi-Laser volleys near and far from
   * their nose and missiles along the top, and Ada's along the bottom.
   */
  function placedShots(galaxy) {
    const model = flightModel(galaxy);
    const flight = model.state.flight;
    flight.objects = [];
    const along = (screen) => {
      const world = toWorld(screen);
      const length = Math.hypot(world.x, world.y);
      return { x: (world.x / length) * 500, y: (world.y / length) * 500 };
    };
    const shots = (enemy, row) => {
      const base = (id, screen, direction, fields) => ({
        damage: 1,
        enemy,
        hitIds: [],
        id: `browser-art:shot:${enemy ? "enemy" : "ada"}:${id}`,
        life: 5,
        piercing: false,
        velocity: along(direction),
        ...at(flight, { x: screen.x, y: row + screen.y }),
        ...fields,
      });
      const fan = (id, nose, radius, spread) => {
        const origin = at(flight, { x: nose.x, y: row + nose.y });
        return [-1, 0, 1].map((index) => {
          const direction = { x: Math.cos(index * spread), y: Math.sin(index * spread) };
          return base(
            `${id}-${index}`,
            { x: nose.x + radius * direction.x, y: nose.y + radius * direction.y },
            direction,
            { fan: { count: 3, origin }, projectile: "bolt" },
          );
        });
      };
      return [
        base("bolt", { x: -300, y: -30 }, { x: 1, y: 0 }, { projectile: "bolt" }),
        base("bolt-turned", { x: -240, y: 20 }, { x: 1, y: 0.5 }, { projectile: "bolt" }),
        base("pellet", { x: -180, y: -30 }, { x: 1, y: 0 }, { projectile: "dot" }),
        base(
          "pellet-fading",
          { x: -150, y: 20 },
          { x: 1, y: 0 },
          {
            fade: { fadeStartFraction: 0.65, initialLife: 1, projectedRange: 100 },
            life: 0.2,
            projectile: "dot",
          },
        ),
        ...fan("fan-near", { x: -110, y: 0 }, 30, 0.07),
        ...fan("fan-far", { x: 10, y: 0 }, 90, 0.12),
        base("rapid", { x: 200, y: -30 }, { x: 1, y: 0 }, { blast: 30, projectile: "missile" }),
        base("heavy", { x: 270, y: 25 }, { x: 1, y: -0.5 }, { blast: 60, projectile: "missile" }),
      ];
    };
    flight.shots = [...shots(true, -140), ...shots(false, 130)];
    return model;
  }
  // The weapons' flat look switch: the enemy shots and Ada's bolts, pellets and fan held still
  // on a light field (Sunflower) and on Phantom, then Ada's Phaser fired on each at full and
  // reduced motion.
  async function weaponsFlat() {
    await inTurn([1, 6], async (galaxy) => {
      await still(`weapons-flat-shots-${GALAXY_ID[galaxy]}`, placedShots(galaxy));
    });
    const cases = [1, 6].flatMap((galaxy) => [
      [galaxy, false],
      [galaxy, true],
    ]);
    await inTurn(cases, async ([galaxy, reducedMotion]) => {
      const name = `weapons-flat-phaser-${GALAXY_ID[galaxy]}${reducedMotion ? "-reduced" : ""}`;
      await open(canonical(armed("phaser", 1, galaxy), name), { reducedMotion });
      const page = ctx.page();
      await ctx.release();
      await page.keyboard.down("Space");
      await page.clock.runFor(20);
      await page.keyboard.up("Space");
      await ctx.frames(name, { after: 20, every: 50, shots: 3 });
    });
  }

  /** A held job in galaxy 2, taken at the hub. */
  function job(model, fields) {
    model.state.tasks[2] = {
      id: `job:browser-${fields.type}`,
      kind: "job",
      reward: 20,
      station: "hub",
      ...fields,
    };
  }
  // Effects: the destruction shards of each small craft at three ages, Whirlpool's current
  // darts, the tow line to a stranded craft and the lost item glint's ping.
  async function effects() {
    const model = flightModel(1);
    const flight = model.state.flight;
    flight.objects = [];
    const kinds = ["swarm", "fighter", "interceptor", "retaliator"];
    kinds.forEach((archetype, row) =>
      [0.05, 0.15, 0.3].forEach((age, column) => {
        const id = `browser-art:${archetype}:${column}`;
        flight.objects.push({
          hp: 1,
          id: `wreck:${id}`,
          kind: "wreck",
          radius: CONTENT.tuning.flight.shipRadius,
          wreck: { age, archetype, facing: { x: 1, y: 0 } },
          ...at(flight, { x: -200 + 200 * column, y: -120 + 80 * row }),
        });
      }),
    );
    await still("effects-shards", model);
    const river = flightModel(3);
    const riverFlight = river.state.flight;
    const [current] = currentsNear(3, 20000, riverFlight.player);
    assert.ok(current, "Whirlpool has a current near Ada");
    riverFlight.player = { ...pointOnCurrent(current, current.length / 2).point };
    withoutEnemies(riverFlight);
    await open(canonical(river, "effects-current"));
    await ctx.release();
    await ctx.frames("effects-current", { after: 200, every: 300, shots: 3 });
    const tow = flightModel(2);
    const towFlight = tow.state.flight;
    withoutEnemies(towFlight);
    towFlight.facing = { x: 1, y: 0 };
    towFlight.tow = { x: towFlight.player.x - 80, y: towFlight.player.y };
    job(tow, {
      item: JOB_POOL[2].craft[0],
      target: { id: "", ...at(towFlight, { x: 200, y: 0 }) },
      type: "rescue",
    });
    await still("effects-tow", tow);
    const hunt = flightModel(2);
    const huntFlight = hunt.state.flight;
    withoutEnemies(huntFlight);
    job(hunt, {
      item: JOB_POOL[2].lost[0],
      spot: at(huntFlight, { x: 0, y: -80 }),
      target: { id: "", ...at(huntFlight, { x: 0, y: -40 }) },
      type: "hunt",
    });
    await open(canonical(hunt, "effects-ping"));
    await ctx.frames("effects-ping", { every: 300, shots: 4 });
  }

  // Controls: the settings card with its close and switches, the pressed close, the disabled
  // close and the disabled switches; then the paint notice's ship swatch.
  async function controls() {
    const serialized = canonical(flightModel(1), "controls-settings");
    const page = await ctx.openHome(serialized);
    await page.locator('[data-action="menu"]').click();
    await page.locator('[data-dialog="menu"] [data-action="menu-settings"]').click();
    const close = page.locator('[data-action="close-settings"]');
    await close.waitFor();
    await page.waitForTimeout(300);
    await ctx.pageShot("controls-settings.png");
    const box = await close.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await ctx.pageShot("controls-settings-close-pressed.png");
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await page.evaluate(() => {
      document.querySelector('[data-action="close-settings"]')?.setAttribute("disabled", "");
      for (const toggle of document.querySelectorAll("[data-setting] .ada-switch")) {
        toggle.dataset.tag = `${toggle.dataset.tag}-disabled`;
      }
    });
    await page.waitForTimeout(100);
    await ctx.pageShot("controls-settings-disabled.png");
    // The paint notice: every scheme but Amber owned and every level held, so unlocking all
    // equipment notices Amber alone.
    const model = flightModel(1);
    model.state.flight.objects = [];
    model.state.economy.paints = ["classic", "cobalt", "seafoam", "graphite", "iris"];
    for (const name of ["shield", "engine", "tractor"]) {
      model.state.economy.levels[name] = 3;
      model.state.flight.levels[name] = 3;
    }
    await ctx.openFixture(canonical(model, "controls-paint-notice"), { frozen: false });
    const flightPage = ctx.page();
    await flightPage.clock.resume();
    await flightPage.locator('[data-action="pause"]').click();
    await flightPage.locator('[data-action="pause-cheats"]').click();
    await flightPage.locator('[data-cheat="unlockAllEquipment"]').click();
    await flightPage.locator('[data-action="dismiss-cheats"]').click();
    await flightPage.locator('[data-action="pause-resume"]').click();
    // The notice fades in over 180 ms; its swatch shows once the ship's materials load.
    await flightPage.locator(".ada-item-notice").first().waitFor({ state: "visible" });
    await flightPage.waitForTimeout(500);
    await ctx.pageShot("controls-paint-notice.png");
    // The use-refusal view (art/controls.md "Use disc", Refused): an engaged fighter beside the
    // station puts Ada in danger, so a tap on Dock plays the Use disc's refusal cue with its
    // notice, taken about 40 ms in, inside the cue's first tinted beat (0 to 80 ms).
    const refusal = stationModel(1);
    addEnemy(refusal, { archetype: "fighter", screen: { x: 160, y: 40 } });
    refusal.state.flight.dangerFor = 1;
    await ctx.openFixture(canonical(refusal, "controls-use-refusal"), { frozen: false });
    const refusalPage = ctx.page();
    await refusalPage.clock.resume();
    const use = refusalPage.locator(".ada-use");
    await use.waitFor({ state: "visible" });
    const useBox = await use.boundingBox();
    assert.ok(useBox, "The Use disc has a frame");
    await refusalPage.touchscreen.tap(useBox.x + useBox.width / 2, useBox.y + useBox.height / 2);
    await refusalPage.waitForTimeout(40);
    await ctx.pageShot("controls-use-refusal.png");
  }

  // Art's retuned project placements: the salvage beacons on the salvagers' yard, Whirlpool's
  // nursery beacon by the whale family and Andromeda's spare beacon beside the relit dark
  // beacon, each whole and in a close-up at 2 device px per CSS px, after the reveal.
  async function placements() {
    const spare = () => {
      const model = destinationModel(5, "darkBeacon", {
        projects: ["spareBeacon"],
        screen: { x: -90, y: -30 },
      });
      model.state.progress[5].questComplete = true;
      return model;
    };
    const cases = [
      [
        "salvagers",
        () => destinationModel(1, "salvagers", { projects: ["salvageBeacons"] }),
        { x: -110, y: -20 },
      ],
      [
        "nursery",
        () =>
          destinationModel(3, "family", {
            projects: ["nurseryBeacon"],
            screen: { x: -60, y: -40 },
          }),
        { x: -60, y: -40 },
      ],
      ["spare", spare, { x: -90, y: -30 }],
    ];
    await inTurn(cases, async ([name, model, screen]) => {
      const file = `placements-${name}`;
      await open(canonical(model(), file), { deviceScaleFactor: 2 });
      // The reveal fades a change in over 600 ms.
      await ctx.frames(file, { after: 700 });
      await ctx.closeUp(`art-${file}-close.png`, { screen, side: 420 });
    });
  }

  // Enemy facing in Sunflower, each case released from its saved start and stepped five frames
  // 200 ms of clock time apart: a fighter crossing close past Ada with its nose on her, a
  // fighter pulling out of a finished burst, a fighter strafing in its band, a frigate moving
  // away from Ada, its hull turning to its heading while its turrets fire astern, and a
  // retaliator holding its standoff band with its nose on Ada while its launcher fires.
  async function enemyFacing() {
    const unit = (vector) => {
      const size = Math.hypot(vector.x, vector.y);
      return { x: vector.x / size, y: vector.y / size };
    };
    const toAda = (flight, enemy) =>
      unit({ x: flight.player.x - enemy.position.x, y: flight.player.y - enemy.position.y });
    const cases = [
      [
        "pass",
        { x: -60, y: 30 },
        "fighter",
        (flight, enemy) => {
          const bearing = toAda(flight, enemy);
          const across = { x: -bearing.y, y: bearing.x };
          enemy.facing = across;
          enemy.heading = across;
          enemy.velocity = { x: across.x * 160, y: across.y * 160 };
          enemy.primaryCooldown = 0;
        },
      ],
      [
        "retreat",
        { x: 160, y: -40 },
        "fighter",
        (flight, enemy) => {
          enemy.facing = toAda(flight, enemy);
          enemy.primaryCooldown = 0;
          enemy.tactic.volleys = 3;
        },
      ],
      [
        "strafe",
        { x: 280, y: 40 },
        "fighter",
        (flight, enemy) => {
          enemy.facing = toAda(flight, enemy);
          enemy.primaryCooldown = 0.3;
        },
      ],
      [
        "frigate",
        { x: -170, y: -20 },
        "frigate",
        (flight, enemy) => {
          const bearing = toAda(flight, enemy);
          enemy.facing = bearing;
          enemy.heading = { x: -bearing.x, y: -bearing.y };
          enemy.velocity = { x: -bearing.x * 100, y: -bearing.y * 100 };
          enemy.firePhasesInitialized = true;
          for (const part of enemy.hardpoints) {
            part.cooldown = 0.2;
          }
        },
      ],
      [
        "retaliator",
        { x: -260, y: -60 },
        "retaliator",
        (flight, enemy) => {
          enemy.facing = toAda(flight, enemy);
          enemy.primaryCooldown = 0;
        },
      ],
    ];
    await inTurn(cases, async ([name, screen, archetype, setup]) => {
      const model = flightModel(1);
      const flight = model.state.flight;
      flight.objects = [];
      addEnemy(model, { archetype, screen, setup: (enemy) => setup(flight, enemy) });
      const fixture = `enemy-facing-${name}`;
      await open(canonical(model, fixture));
      await ctx.release();
      await ctx.frames(fixture, { every: 200, shots: 5 });
    });
  }

  // Every ship keeps moving in Sunflower, each case released from its saved start and stepped
  // six frames 300 ms of clock time apart: an idle pack of three retaliators sharing one home,
  // which patrol apart, a fighter returning to its home, which loops on past it, and a Mining
  // Freighter tracing the edge of a large rock.
  async function keepMoving() {
    const rockArt = readAsteroidCatalog(await ctx.served("/art/asteroids.json"));
    assert.ok(rockArt, "Art's asteroid catalog must read as version 1");
    const idle = (enemy) => {
      enemy.engaged = false;
    };
    let minerIndex = 0;
    while (
      retaliatorVariant({ archetype: "retaliator", id: `browser-art:miner:${minerIndex}` }) !==
      "retaliatorMiningFreighter"
    ) {
      minerIndex++;
    }
    const cases = [
      [
        "idle-pack",
        (model) => {
          const home = at(model.state.flight, { x: -60, y: 0 });
          const screens = [
            { x: -90, y: -30 },
            { x: -40, y: 0 },
            { x: -90, y: 30 },
          ];
          for (const [index, screen] of screens.entries()) {
            addEnemy(model, {
              archetype: "retaliator",
              id: `browser-art:pack:${index}`,
              screen,
              setup: (enemy) => {
                idle(enemy);
                enemy.home = { ...home };
                enemy.packId = "browser-art:pack";
              },
            });
          }
        },
      ],
      [
        "returning",
        (model) => {
          addEnemy(model, {
            archetype: "fighter",
            screen: { x: 140, y: -40 },
            setup: (enemy) => {
              idle(enemy);
              enemy.returning = true;
            },
          });
        },
      ],
      [
        "miner",
        (model) => {
          const flight = model.state.flight;
          const art = rockArt.asteroids.find((entry) => entry.size === "large");
          const rock = at(flight, { x: 60, y: -40 });
          flight.objects.push({
            asteroid: art.id,
            hp: 99,
            id: "browser-art:rock",
            kind: "rock",
            radius: art.footprintRadius,
            x: rock.x,
            y: rock.y,
          });
          addEnemy(model, {
            archetype: "retaliator",
            id: `browser-art:miner:${minerIndex}`,
            screen: { x: -160, y: -40 },
            setup: idle,
          });
        },
      ],
    ];
    await inTurn(cases, async ([name, setup]) => {
      const model = flightModel(1);
      model.state.flight.objects = [];
      setup(model);
      const fixture = `keep-moving-${name}`;
      await open(canonical(model, fixture));
      await ctx.release();
      await ctx.frames(fixture, { every: 300, shots: 6 });
    });
  }

  // The hostile stations' pod and dome tops in each family and the Claim platform's gun tops,
  // aimed at Ada, at 2 device px per CSS px: the Claim station and platform in Cartwheel, the
  // garnet station in Andromeda and the coral station in Phantom, each still, in a close-up, and
  // with a pod and the dome, or both armed guns, firing.
  async function hostileTops() {
    const station = ["hostileStation", ["weapon-0", "weapon-5"]];
    const cases = [
      ["claim", 2, ...station],
      ["claim-platform", 2, "platform", ["port", "starboard"]],
      ["garnet", 5, ...station],
      ["coral", 6, ...station],
    ];
    const screen = { x: -150, y: -20 };
    await inTurn(cases, async ([family, galaxy, archetype, fire]) => {
      const model = flightModel(galaxy);
      model.state.flight.objects = [];
      addEnemy(model, { archetype, fire, screen });
      const name = `hostile-tops-${family}`;
      await open(canonical(model, name), { deviceScaleFactor: 2 });
      await ctx.frames(name);
      await ctx.closeUp(`art-${name}-close.png`, { screen, side: 360 });
      await ctx.release();
      await ctx.page().clock.runFor(700);
      await ctx.closeUp(`art-${name}-firing-close.png`, { screen, side: 360 });
    });
  }

  // Edge markers (art/space-palette.md "Edge markers"), each target past a different edge or
  // corner of the game area: an identified fighter, frigate, route-guarding frigate and hostile
  // station, and a sensed fighter drawn as the unidentified `?`, on Cartwheel's light field and
  // Phantom's dark field, where they draw over Phantom's white outline. On Phantom the battle's
  // flagship is the story's target, the one enemy a task targets.
  async function markers() {
    await inTurn(
      [
        [6, "dark"],
        [2, "light"],
      ],
      async ([galaxy, field]) => {
        const model = flightModel(galaxy);
        const flight = model.state.flight;
        withoutEnemies(flight);
        const enemy = addEnemy(model, {
          archetype: "fighter",
          id: "browser-art:marker-enemy",
          screen: { x: 560, y: 0 },
        });
        const station = addEnemy(model, {
          archetype: "hostileStation",
          id: "browser-art:marker-station",
          screen: { x: -640, y: 0 },
        });
        const contact = addEnemy(model, {
          archetype: "fighter",
          id: "browser-art:marker-contact",
          screen: { x: 0, y: 330 },
        });
        const heavy = addEnemy(model, {
          archetype: "frigate",
          id: "browser-art:marker-heavy",
          screen: { x: 520, y: -300 },
        });
        // A heavy still blocking a route to one of the galaxy's destinations is its guard.
        const guardPoint = at(flight, { x: -520, y: 300 });
        const guard = spawnChapterEnemy(
          CONTENT,
          "frigate",
          "browser-art:marker-guard",
          guardPoint,
          flight,
          { home: guardPoint, routeId: galaxy === 6 ? PHANTOM_DESTINATIONS[0] : "hub" },
        );
        assert.ok(guard?.enemy, "The route guard spawns");
        guard.enemy.engaged = true;
        guard.enemy.primaryCooldown = 999;
        for (const part of guard.enemy.hardpoints) {
          part.cooldown = 999;
        }
        flight.markerActors = {
          encounterSeed: flightEncounterSeed(flight),
          knowledge: {
            [contact.id]: "sensed",
            [enemy.id]: "identified",
            [guard.id]: "identified",
            [heavy.id]: "identified",
            [station.id]: "identified",
          },
        };
        const expected = {
          [contact.id]: { identified: false, taskCategory: "generic" },
          [enemy.id]: { identified: true, symbol: "enemy", taskCategory: "generic" },
          [guard.id]: { identified: true, symbol: "guard", taskCategory: "generic" },
          [heavy.id]: { identified: true, symbol: "heavy", taskCategory: "generic" },
          [station.id]: { identified: true, symbol: "hostileStation", taskCategory: "generic" },
        };
        if (galaxy === 6) {
          // The battle's last phase: every settlement freed and the flagship at its waypoint.
          const waypoint = at(flight, { x: 0, y: -340 });
          model.state.progress[6].phantom = {
            broken: [...PHANTOM_DESTINATIONS],
            flagshipKnown: true,
            freed: [...PHANTOM_DESTINATIONS],
          };
          Object.assign(flight.phantom, {
            blockades: {},
            enemyIds: [PHANTOM_FLAGSHIP],
            phase: "flagship",
            wave: 3,
            waypoint,
          });
          delete flight.phantom.pendingEncounter;
          const flagship = spawnChapterEnemy(
            CONTENT,
            "capital",
            PHANTOM_FLAGSHIP,
            waypoint,
            flight,
            { home: waypoint },
          );
          assert.ok(flagship?.enemy, "Phantom's flagship spawns at its waypoint");
          flagship.enemy.primaryCooldown = 999;
          for (const part of flagship.enemy.hardpoints) {
            part.cooldown = 999;
          }
          expected[PHANTOM_FLAGSHIP] = { identified: true, symbol: "heavy", taskCategory: "story" };
        }
        const shown = Object.fromEntries(
          model
            .targetMarkers(GAME_AREA)
            .filter(({ id }) => Object.hasOwn(expected, id))
            .map(({ id, identified, symbol, taskCategory }) => [
              id,
              identified ? { identified, symbol, taskCategory } : { identified, taskCategory },
            ]),
        );
        assert.deepEqual(shown, expected, `The ${field} field shows each edge marker`);
        await open(canonical(model, `markers-${field}`));
        await ctx.pageShot(`markers-${field}.png`);
      },
    );
  }

  // The holodisk item icons as served: icon-holodisk-24 and the 16 and 20 px vectors at their
  // own size and at 8 times, nearest-neighbour, on the item notice's ink chip and on cream.
  async function holodiskIcon() {
    const page = await ctx.openHome(null);
    const icons = [
      ["icon-holodisk-24", "/art/ui/sprites/icon-holodisk-24.png", 24],
      ["icon-holodisk-20", uiIconUrl("icon-holodisk-20"), 20],
      ["icon-holodisk", uiIconUrl("icon-holodisk"), 16],
    ];
    const cell = ([key, src, size], ground) =>
      `<figure style="margin:0;padding:16px;background:${ground};display:grid;gap:12px;` +
      `justify-items:center"><img src="${src}" width="${size}" height="${size}" alt="">` +
      `<img src="${src}" width="${size * 8}" height="${size * 8}" alt="" ` +
      `style="image-rendering:pixelated"><figcaption style="font:12px monospace;color:#888">` +
      `${key}</figcaption></figure>`;
    const cells = ["#181425", "#f2edd5"].flatMap((ground) =>
      icons.map((icon) => cell(icon, ground)),
    );
    const body = "margin:0;padding:16px;background:#7a7a7a;display:flex;flex-wrap:wrap;gap:16px";
    // The empty icon link keeps the browser from asking for a /favicon.ico the build lacks.
    await page.setContent(
      `<head><link rel="icon" href="data:,"></head><body style="${body}">${cells.join("")}</body>`,
    );
    await page.waitForFunction(() =>
      [...document.images].every((image) => image.complete && image.naturalWidth > 0),
    );
    await ctx.pageShot("holodisk-icon.png");
  }

  return {
    backdrops,
    controls,
    craft,
    effects,
    "enemy-facing": enemyFacing,
    fleet,
    "fleet-craft": fleetCraft,
    "fleet-tops": fleetTops,
    "holodisk-icon": holodiskIcon,
    hostile,
    "hostile-tops": hostileTops,
    "keep-moving": keepMoving,
    landmarks,
    markers,
    needle,
    "nose-heavy-missile": noseSet("heavyMissile", 1),
    "nose-laser": noseSet("laser", 1),
    "nose-multi-laser": noseSet("multiLaser", 3),
    "nose-phaser": noseSet("phaser", 1),
    "nose-rapid-missile": noseSet("rapidMissile", 1),
    "nose-scattershot": noseSet("scattershot", 1),
    pickups,
    placements,
    resources,
    ship,
    "ship-fixes": shipFixes,
    "ship-fixes-l": plumeSet("l"),
    "ship-fixes-m": plumeSet("m"),
    "ship-fixes-s": plumeSet("s"),
    "stations-andromeda-phantom": stationsAndromedaPhantom,
    "stations-sunflower-cartwheel": stationsSunflowerCartwheel,
    "stations-whirlpool-needle": stationsWhirlpoolNeedle,
    weapons,
    "weapons-flat": weaponsFlat,
  };
}
