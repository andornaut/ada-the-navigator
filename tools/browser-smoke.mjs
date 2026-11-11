import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const output = "/tmp/evidence";
const storageKey = "ada-the-navigator.prototype.v1";
const events = { errors: [], failedRequests: [], badResponses: [], checks: [] };
mkdirSync(output, { recursive: true });

function save(name, value) {
  writeFileSync(`${output}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
}

const watchdog = setTimeout(() => {
  save("events.json", events);
  save("result.json", { passed: false, error: "Browser smoke exceeded 120 seconds" });
  process.exit(124);
}, 120000);

let browser;
let page;
try {
  const require = createRequire("/app/package.json");
  const { chromium } = require("playwright");
  browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    hasTouch: true,
  });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  // Settings: its own button on the start screen; in play it opens from the Paused card, which
  // the pause button (a touch control) or Escape opens.
  async function openPause() {
    const button = page.locator('[data-action="pause"]');
    // A reloaded game shows the pause button once its controls exist; a fine pointer never does.
    const shown = await button.waitFor({ state: "visible", timeout: 5000 }).then(
      () => true,
      () => false,
    );
    if (shown) {
      await button.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
  }
  async function openSettings() {
    const own = page.locator('[data-action="settings"]');
    if (await own.isVisible()) {
      await own.click();
    } else {
      await openPause();
      await page.locator('[data-action="pause-settings"]').click();
    }
    await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
  }
  // Settings opened in play closes back to the Paused card; Resume returns to play.
  async function resumeIfPaused() {
    const resume = page.locator('[data-action="pause-resume"]');
    if (await resume.isVisible()) {
      await resume.click();
    }
  }
  async function closeSettings() {
    await page.locator('[data-action="close-settings"]').click();
    await resumeIfPaused();
  }
  function observe(observed) {
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
  observe(page);
  // No outside requests are needed to render the built prototype.
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === "http://ada-preview:4173") {
      return route.continue();
    }
    return route.abort("blockedbyclient");
  });
  async function iconLinks() {
    assert.equal(
      await page.locator('link[rel="manifest"]').getAttribute("href"),
      "/manifest.webmanifest",
    );
    const links = await page
      .locator('link[rel="icon"],link[rel="apple-touch-icon"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          href: node.getAttribute("href"),
          rel: node.getAttribute("rel"),
          sizes: node.getAttribute("sizes"),
        })),
      );
    assert.equal(links.length, 4, "Each entry must declare both PNG favicons, ICO and Apple icon");
    await Promise.all(
      links.map(async (link) => {
        const response = await page.request.get(`http://ada-preview:4173${link.href}`);
        assert.equal(response.status(), 200, `Icon must be served: ${link.href}`);
        assert.ok(response.headers()["content-type"].startsWith("image/"));
        if (link.href.endsWith(".png")) {
          const dimensions = await page.evaluate(async (href) => {
            const image = await createImageBitmap(await (await fetch(href)).blob());
            const size = `${image.width}x${image.height}`;
            image.close();
            return size;
          }, link.href);
          assert.equal(
            dimensions,
            link.sizes,
            "Decoded favicon/Apple icon dimensions must match HTML metadata",
          );
        }
      }),
    );
    return links;
  }
  const response = await page.goto("http://ada-preview:4173/");
  assert.equal(response.status(), 200);
  assert.equal(await page.locator("#game-canvas").count(), 0, "Landing must not bootstrap Phaser");
  const landingIcons = await iconLinks();
  const manifestResponse = await page.request.get("http://ada-preview:4173/manifest.webmanifest");
  assert.equal(manifestResponse.status(), 200);
  assert.ok(manifestResponse.headers()["content-type"].startsWith("application/manifest+json"));
  const manifest = await manifestResponse.json();
  assert.equal(manifest.id, "/play/");
  assert.equal(manifest.start_url, "/play/");
  assert.equal(manifest.scope, "/");
  const decodedIcons = await page.evaluate(async (icons) => {
    return Promise.all(
      icons.map(async (icon) => {
        const response = await fetch(icon.src);
        if (!response.ok) {
          throw new Error(`Missing app icon: ${icon.src}`);
        }
        const bitmap = await createImageBitmap(await response.blob());
        const result = {
          src: icon.src,
          sizes: `${bitmap.width}x${bitmap.height}`,
          purpose: icon.purpose,
        };
        bitmap.close();
        return result;
      }),
    );
  }, manifest.icons);
  for (const icon of decodedIcons) {
    assert.equal(icon.sizes, manifest.icons.find((entry) => entry.src === icon.src).sizes);
  }
  const playLink = page.locator('a[href="/play/"]').first();
  await playLink.waitFor({ state: "visible" });
  await page.screenshot({ path: `${output}/site-desktop.png` });
  await Promise.all([page.waitForURL("**/play/"), playLink.click()]);
  const playIcons = await iconLinks();
  assert.deepEqual(
    playIcons,
    landingIcons,
    "Landing and play must share the same app icon identity",
  );
  save("app-icon-proof.json", {
    scope: "Served app metadata and decoded icons only, not installation or offline support",
    manifest,
    decodedIcons,
    landingIcons,
    playIcons,
  });
  events.checks.push(
    "Landing and play share a play-start manifest and actual decoded app/favicons",
  );
  events.checks.push(
    "Root website links to the real game at /play/ without starting Phaser on the landing page",
  );
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  await page.locator("canvas").waitFor({ state: "visible" });
  assert.ok(
    await page.locator("canvas").evaluate((canvas) => canvas.width > 0 && canvas.height > 0),
  );
  events.checks.push("Real renderer and accessible home status");
  async function contextControlProof(expected, phase) {
    assert.equal(
      await page.locator(".ada-use:visible").count(),
      expected,
      `${phase}: the dedicated control must be the only visible contextual action`,
    );
    assert.equal(
      await page.locator('[data-action="interact"]').count(),
      0,
      `${phase}: travel must not duplicate the contextual action`,
    );
  }
  await contextControlProof(0, "home");
  async function frameProof(portrait = false) {
    const frame = await page.locator("canvas").evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      const style = getComputedStyle(document.body);
      const matrix = new DOMMatrixReadOnly(
        style.transform === "none" ? undefined : style.transform,
      );
      return {
        intrinsic: { width: canvas.width, height: canvas.height },
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        body: { width: document.body.clientWidth, height: document.body.clientHeight },
        rotation: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d },
        imageRendering: getComputedStyle(canvas).imageRendering,
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    assert.ok(frame.intrinsic.width >= 720 && frame.intrinsic.height >= 360);
    assert.ok(
      Math.abs(frame.intrinsic.width - 720) <= 1 || Math.abs(frame.intrinsic.height - 360) <= 1,
      "EXPAND must preserve one logical base dimension of 720x360",
    );
    const displayRatio = portrait
      ? frame.bounds.height / frame.bounds.width
      : frame.bounds.width / frame.bounds.height;
    assert.ok(
      Math.abs(frame.intrinsic.width / frame.intrinsic.height - displayRatio) < 0.02,
      "Canvas base dimensions and CSS display must scale uniformly",
    );
    assert.ok(["pixelated", "crisp-edges"].includes(frame.imageRendering));
    if (portrait) {
      assert.ok(Math.abs(frame.rotation.a) < 0.001 && Math.abs(frame.rotation.d) < 0.001);
      assert.ok(Math.abs(Math.abs(frame.rotation.b) - 1) < 0.001);
      assert.ok(Math.abs(frame.rotation.b + frame.rotation.c) < 0.001);
      assert.ok(
        frame.body.width > frame.body.height,
        "Portrait body must retain a landscape frame",
      );
      assert.ok(
        frame.bounds.height > frame.bounds.width,
        "Landscape canvas must turn into portrait",
      );
      assert.ok(Math.abs(frame.bounds.x) < 3 && Math.abs(frame.bounds.y) < 3);
      assert.ok(Math.abs(frame.bounds.width - frame.viewport.width) < 3);
      assert.ok(Math.abs(frame.bounds.height - frame.viewport.height) < 3);
    } else {
      assert.ok(Math.abs(frame.rotation.a - 1) < 0.001 && Math.abs(frame.rotation.b) < 0.001);
      assert.ok(frame.bounds.width > frame.bounds.height);
    }
    return frame;
  }
  save("desktop-frame.json", await frameProof());
  events.checks.push("Desktop canvas preserves the 720x360 EXPAND base and pixel-art scaling");

  const [
    { GameModel },
    { PROTOTYPE },
    { ensureDestination },
    { playOpening },
    { restoreSave: restoreCalm },
  ] = await Promise.all([
    import(new URL("../src/model/game.ts", import.meta.url)),
    import(new URL("../src/data/prototype.ts", import.meta.url)),
    import(new URL("../src/model/flight.ts", import.meta.url)),
    import(new URL("../src/model/test-launch.ts", import.meta.url)),
    import(new URL("../src/model/save.ts", import.meta.url)),
  ]);
  // Reads storybook pages (the default choice, else Next or its named action) until galaxy
  // selection opens or flight begins, and returns each page's background, its image and text,
  // and, just after its press, the transition frame fading in and whether the panel hid.
  async function readStory(remaining = 30, pages = []) {
    await page.waitForFunction(
      () =>
        document.querySelector("#game-status")?.dataset.mode === "space" ||
        document.querySelector('.ada-story-panel:not([hidden]) [data-action="story-next"]') ||
        document.querySelector('[data-dialog="galaxies"]')?.closest(".ada-modal:not([hidden])"),
    );
    const panel = page.locator(".ada-story-panel:not([hidden])");
    if (!(await panel.count())) {
      return pages;
    }
    assert.ok(remaining > 0, "Storybook pages must reach galaxy selection");
    // The art loads once, after the manifest.
    await page.waitForFunction(
      () => document.querySelector(".ada-story-art")?.style.backgroundImage,
    );
    pages.push({
      art: await page
        .locator(".ada-story-art")
        .first()
        .evaluate((art) => art.style.backgroundImage),
      astra: await page.locator(".ada-story-astra").evaluate((patch) => !patch.hidden),
      background: await page.locator(".ada-story-background").getAttribute("data-background"),
      speaker: await panel.evaluate(
        (node) => node.querySelector(".ada-story-speaker:not([hidden])")?.textContent ?? "",
      ),
      text: (await panel.locator(".ada-story-paragraph").textContent()) ?? "",
    });
    const choice = panel.locator('[data-action="story-choice"]');
    const press = (await choice.count())
      ? choice.first()
      : panel.locator('[data-action="story-next"]');
    await press.waitFor({ state: "visible" });
    pages.at(-1).after = await press.evaluate((button) => {
      button.click();
      return {
        incoming: document.querySelectorAll(".ada-story-art")[1]?.style.backgroundImage ?? "",
        panelHidden: document.querySelector(".ada-story-panel")?.hidden ?? false,
      };
    });
    return readStory(remaining - 1, pages);
  }
  const selector = page.locator('[data-dialog="galaxies"]');
  // A first launch: Start, galaxy one's opening, the prologue in Ada's room and the cockpit, then
  // galaxy selection on galaxy one.
  await page.locator('[data-action="start"]').click();
  await page.locator(".ada-story-panel:not([hidden])").waitFor({ state: "visible" });
  await page.screenshot({ path: `${output}/story-opening.png` });
  const launchPages = await readStory();
  assert.equal(launchPages[0]?.background, "grandmaGarden", "Start opens galaxy one's opening");
  assert.equal(
    launchPages[1]?.text,
    PROTOTYPE.chapters[1].openingBranches[0],
    "The default choice's branch page follows the opening",
  );
  assert.deepEqual(
    launchPages.slice(2, 5).map(({ background, text }) => [background, text]),
    PROTOTYPE.premise.prologue.slice(0, 3).map(({ background, text }) => [background, text]),
    "The prologue begins in the park, then Ada polishes the rock and it glows in her room",
  );
  // The rest plays in the cockpit: empty while Ada and Penny stand, seated once Ada sits.
  const seatedText = PROTOTYPE.premise.prologue.find(
    ({ background }) => background === "cockpitSeated",
  )?.text;
  const seatedAt = launchPages.findIndex(({ text }) => text === seatedText);
  assert.ok(seatedAt > 5, "Ada sits after the cockpit's first pages");
  assert.deepEqual(
    launchPages.slice(5).map(({ background }) => background),
    launchPages.slice(5).map((_, index) => (index + 5 < seatedAt ? "cockpit" : "cockpitSeated")),
    "The prologue's cockpit is empty until Ada sits, then seated",
  );
  // Every page shows its location's image from Art's manifest; only the glowing room's press into
  // the cockpit plays the rock glow, hiding the panel as its first frame fades in.
  const { BACKGROUND_ART } = await import(new URL("../src/data/storybook.ts", import.meta.url));
  const artManifest = await (
    await page.request.get("http://ada-preview:4173/art/manifest.json")
  ).json();
  const artUrl = (id) => `url("${artManifest.assets.find((entry) => entry.id === id)?.path}")`;
  for (const { art, background } of launchPages) {
    assert.equal(art, artUrl(BACKGROUND_ART[background]), `${background} shows its art`);
  }
  const glow = launchPages.findIndex(
    ({ background }, index) =>
      background === "adaRoom" && launchPages[index + 1]?.background === "cockpit",
  );
  assert.ok(glow >= 0, "The prologue leaves Ada's room for the cockpit");
  assert.deepEqual(launchPages[glow].after, {
    incoming: artUrl("story-ada-room-glow-1"),
    panelHidden: true,
  });
  assert.deepEqual(
    launchPages.filter((_, index) => index !== glow).map(({ after }) => after.incoming),
    launchPages.slice(1).map(() => ""),
    "Every other page change cuts",
  );
  // Astra's lens animates on the cockpit pages she speaks, and on no other.
  assert.deepEqual(
    launchPages.map(({ astra }) => astra),
    launchPages.map(
      ({ background, speaker }) => speaker === "Astra" && background.startsWith("cockpit"),
    ),
  );
  assert.ok(
    launchPages.some(({ astra }) => astra),
    "Astra speaks in the prologue's cockpit",
  );
  events.checks.push(
    "Storybook pages show Art's backgrounds, the glowing room plays the rock glow into the " +
      "cockpit, and Astra's lens animates while she speaks there",
  );
  // Each optional question's answer returns to the list until Continue.
  for (const { answer } of PROTOTYPE.premise.prologue.find(({ questions }) => questions)
    .questions) {
    assert.ok(
      launchPages.some(({ text }) => text === answer),
      `The prologue answers "${answer}"`,
    );
  }
  await selector.waitFor({ state: "visible" });
  assert.equal(
    await page.locator(".ada-story-background").getAttribute("data-background"),
    "cockpitSeated",
    "Galaxy selection shows Ada and Penny seated",
  );
  assert.equal(
    await page
      .locator(".ada-story-art")
      .first()
      .evaluate((art) => art.style.backgroundImage),
    artUrl("cockpit-seated"),
  );
  // Galaxy one is unlocked, so its preview is the tinted capture; it must be served.
  const preview = await selector
    .locator(".ada-galaxy-shot")
    .evaluate((shot) => shot.style.backgroundImage);
  assert.equal(preview, 'url("/previews/galaxy-sunflower.png")');
  const previewResponse = await page.request.get(
    "http://ada-preview:4173/previews/galaxy-sunflower.png",
  );
  assert.equal(previewResponse.status(), 200, "Galaxy previews must be served");
  assert.equal(
    (await selector.locator("h2").textContent())?.trim(),
    PROTOTYPE.labels.galaxyNumber.replace("{number}", "1"),
  );
  await page.screenshot({ path: `${output}/galaxy-select.png` });
  await page.locator('[data-action="galaxy-jump"]').click();
  events.checks.push(
    "Start plays galaxy one's opening and the prologue as storybook pages, then galaxy " +
      "selection's Jump begins the flight",
  );
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  const position = () =>
    page.locator("#game-status").evaluate((element) => ({
      x: Number(element.dataset.x),
      y: Number(element.dataset.y),
    }));
  const readSave = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  async function waitForRest(previous, remaining = 20) {
    await page.waitForTimeout(250);
    const current = await position();
    if (current.x === previous.x && current.y === previous.y) {
      return current;
    }
    assert.ok(remaining > 0, "Released movement must settle");
    return waitForRest(current, remaining - 1);
  }
  const before = await position();
  assert.ok(Number.isFinite(before.x) && Number.isFinite(before.y));
  await page.keyboard.down("d");
  try {
    await page.waitForFunction(({ x, y }) => {
      const status = document.querySelector("#game-status");
      return Number(status.dataset.x) !== x || Number(status.dataset.y) !== y;
    }, before);
  } finally {
    await page.keyboard.up("d");
  }
  events.checks.push("Keyboard input changes actual flight coordinates");
  await waitForRest(await position());
  await page.screenshot({ path: `${output}/desktop.png` });

  await page.keyboard.down("d");
  try {
    await openSettings();
    await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
    const paused = await position();
    await page.waitForTimeout(250);
    assert.deepEqual(await position(), paused, "Settings must pause movement");
    await closeSettings();
    await waitForRest(await position());
  } finally {
    await page.keyboard.up("d");
  }
  events.checks.push("Settings pause movement and clear held input on resume");

  async function seedOnce(value, marker) {
    // The old app's pagehide save runs before this one-shot seed on the new document.
    await page.addInitScript(
      ({ key, once, serialized }) => {
        if (!sessionStorage.getItem(once)) {
          localStorage.setItem(key, serialized);
          sessionStorage.setItem(once, "1");
        }
      },
      { key: storageKey, serialized: value, once: marker },
    );
    await page.reload();
  }
  // The launched world comes from a random seed, so an encounter can open fire during a reload.
  // Persistence checks use that same world with its hostiles removed: shield then changes only
  // through recharge, which a full shield never shows.
  const launched = await readSave();
  const calm = structuredClone(launched);
  calm.flight.objects = calm.flight.objects.filter(
    (object) => !["enemy", "debris", "hazard"].includes(object.kind),
  );
  calm.flight.shots = [];
  for (const [id, object] of Object.entries(calm.flight.world.notables)) {
    if (object?.kind === "enemy") {
      delete calm.flight.world.notables[id];
    }
  }
  if (calm.flight.combat) {
    calm.flight.combat.initialPackSizes = {};
    delete calm.flight.combat.unloadedPackMembers;
  }
  calm.flight.shield = PROTOTYPE.tuning.shieldMax;
  calm.flight.dangerFor = 0;
  assert.ok(restoreCalm(calm), "The calm launched world must remain a canonical save");
  await seedOnce(JSON.stringify(calm), "ada-browser.calm-launch.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });

  await page.waitForFunction((key) => {
    const status = document.querySelector("#game-status");
    const saved = JSON.parse(localStorage.getItem(key));
    return (
      saved?.flight?.player?.x === Number(status.dataset.x) &&
      saved?.flight?.player?.y === Number(status.dataset.y)
    );
  }, storageKey);
  const persisted = await readSave();
  assert.equal(persisted.version, 1);
  await page.reload();
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  const resumed = await readSave();
  for (const field of ["seed", "cargo", "shield", "player", "world", "visited"]) {
    assert.deepEqual(
      resumed.flight[field],
      persisted.flight[field],
      `Reload must retain flight ${field}`,
    );
  }
  assert.deepEqual(resumed.progress, persisted.progress);
  await page.goto("http://ada-preview:4173/");
  const onLanding = await readSave();
  assert.equal(await page.locator("#game-canvas").count(), 0);
  await Promise.all([
    page.waitForURL("**/play/"),
    page.locator('a[href="/play/"]').first().click(),
  ]);
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  const returned = await readSave();
  for (const field of [
    "seed",
    "cargo",
    "shield",
    "weapon",
    "ownedWeapons",
    "world",
    "visited",
    "player",
  ]) {
    assert.deepEqual(
      returned.flight[field],
      onLanding.flight[field],
      `Website round trip preserves flight ${field}`,
    );
  }
  assert.deepEqual(returned.progress, onLanding.progress);
  events.checks.push("Reload resumes the persisted flight without regeneration");

  const safeInput = new GameModel(PROTOTYPE);
  safeInput.startSector(1);
  playOpening(safeInput);
  Object.assign(safeInput.state.progress[1], {
    introduced: true,
    stage: 1,
    questItem: "food",
    known: ["growers"],
    discoveries: 1,
  });
  assert.ok(safeInput.state.flight, "Safe input fixture requires a real flight");
  const friendly = ensureDestination(PROTOTYPE, "growers", safeInput.state.flight);
  safeInput.teleport("growers");
  assert.deepEqual(safeInput.state.flight.player, { x: friendly.x, y: friendly.y });
  assert.equal(safeInput.state.flight.freshChunk, null);
  const safeSerialized = safeInput.save();
  assert.deepEqual(new GameModel(PROTOTYPE, safeSerialized).state, safeInput.state);
  save("input-fixture.json", {
    scope:
      "Friendly-destination safe-zone precondition for control checks only; no quest completion proof",
    state: JSON.parse(safeSerialized),
  });
  await seedOnce(safeSerialized, "ada-browser.input-fixture.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  assert.deepEqual(await position(), safeInput.state.flight.player);
  events.checks.push(
    "Model-generated friendly-destination fixture supplies the input-check precondition",
  );
  const { CHEAT_COPY } = await import(new URL("../src/data/cheat-copy.ts", import.meta.url));
  await page.keyboard.down("d");
  try {
    await openSettings();
    await page.getByRole("button", { name: CHEAT_COPY.open, exact: true }).click();
    const cheatDialog = page.getByRole("dialog", { name: CHEAT_COPY.title, exact: true });
    await cheatDialog.waitFor({ state: "visible" });
    const paused = await position();
    const beforeGrant = await readSave();
    await page.waitForTimeout(250);
    assert.deepEqual(await position(), paused, "Cheat modal must pause held flight input");
    const behindModal = await page.locator("canvas").boundingBox();
    assert.ok(behindModal);
    await page.mouse.move(behindModal.x + 12, behindModal.y + behindModal.height - 20);
    await page.mouse.down();
    try {
      await page.mouse.move(behindModal.x + 32, behindModal.y + behindModal.height - 20);
      await page.waitForTimeout(100);
      assert.deepEqual(
        await position(),
        paused,
        "Pointer drag behind cheats must not reach flight controls",
      );
    } finally {
      await page.mouse.up();
    }
    await page.keyboard.press("Shift+Tab");
    assert.ok(
      await cheatDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
      "Cheat modal must retain keyboard focus",
    );
    await page.getByRole("button", { name: CHEAT_COPY.grantAllWeapons, exact: true }).click();
    await page.waitForFunction((key) => {
      const owned = JSON.parse(localStorage.getItem(key)).flight.ownedWeapons ?? [];
      return ["rapidMissile", "multiLaser", "heavyMissile", "scattershot", "phaser"].every(
        (weapon) => owned.includes(weapon),
      );
    }, storageKey);
    const granted = await readSave();
    assert.deepEqual(granted.progress, beforeGrant.progress);
    assert.deepEqual(
      granted.economy,
      beforeGrant.economy,
      "Run-only granted weapons must not enter saved ownership, levels or Stardust",
    );
    for (const field of ["weapon", "shield", "cargo", "fireCooldown"]) {
      assert.deepEqual(
        granted.flight[field],
        beforeGrant.flight[field],
        `Grant preserves ${field}`,
      );
    }
    await page.screenshot({ path: `${output}/cheats.png` });
    await cheatDialog.getByRole("button", { name: CHEAT_COPY.close, exact: true }).click();
    await resumeIfPaused();
  } finally {
    await page.keyboard.up("d");
  }
  await waitForRest(await position());
  await seedOnce(safeSerialized, "ada-browser.before-installed-guard.v1");
  await openSettings();
  await page.getByRole("button", { name: CHEAT_COPY.open, exact: true }).click();
  // Exercise the iOS installed-window signal without installing or launching a PWA.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });
  await page.waitForFunction(
    () => document.querySelector('[data-action="cheats"]')?.hidden === true,
  );
  assert.equal(
    await page.getByRole("dialog", { name: CHEAT_COPY.title, exact: true }).count(),
    0,
    "An installed-window signal must close the cheats modal",
  );
  await page.locator('[data-action="cheats"]').evaluate((button) => button.click());
  await page.locator('[data-cheat="grant-all-weapons"]').evaluate((button) => button.click());
  assert.deepEqual(
    (await readSave()).flight.ownedWeapons ?? [],
    [],
    "Direct hidden-button dispatch in the installed-window fixture must not grant weapons",
  );
  save("installed-window-proof.json", {
    scope:
      "Navigator standalone eligibility fixture and pageshow recheck, not an actual installed PWA",
    grantBlocked: (await readSave()).flight.ownedWeapons ?? [],
  });
  await page.evaluate(() => {
    Reflect.deleteProperty(navigator, "standalone");
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
  });
  await page.waitForFunction(
    () => document.querySelector('[data-action="cheats"]')?.hidden === false,
  );
  await seedOnce(safeSerialized, "ada-browser.after-cheats.v1");
  events.checks.push(
    "Browser-only cheats pause input, retain focus and grant run-only weapons to the flight; " +
      "an installed-window fixture closes and rejects direct dispatch",
  );
  await page.locator(".ada-use").waitFor({ state: "visible" });
  await contextControlProof(1, "friendly flight");
  assert.equal((await page.locator(".ada-use").textContent()).trim(), PROTOTYPE.labels.talk);
  const beforeStorageFailure = await page.evaluate((key) => {
    const saved = localStorage.getItem(key);
    window.__adaOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    return saved;
  }, storageKey);
  try {
    await openSettings();
    const warning = page
      .getByRole("status")
      .filter({ hasText: PROTOTYPE.labels.savingUnavailable });
    await warning.waitFor({ state: "visible" });
    assert.equal(await warning.count(), 1, "Save failure must have one accessible status");
    assert.equal(await warning.getAttribute("id"), "save-status");
    await closeSettings();
    const blockedPosition = await position();
    await page.keyboard.down("d");
    try {
      await page.waitForFunction(({ x, y }) => {
        const status = document.querySelector("#game-status");
        return Number(status.dataset.x) !== x || Number(status.dataset.y) !== y;
      }, blockedPosition);
    } finally {
      await page.keyboard.up("d");
    }
    await waitForRest(await position());
    assert.equal(await warning.textContent(), PROTOTYPE.labels.savingUnavailable);
    await page.locator(".ada-use").click();
    await page.locator('[data-action="dialogue-choice"]').first().waitFor({ state: "visible" });
    await contextControlProof(0, "dialogue during save failure");
    assert.equal(
      await warning.textContent(),
      PROTOTYPE.labels.savingUnavailable,
      "Dialogue rendering must not clear a failed-save warning",
    );
    await page.locator('[data-action="dialogue-choice"][data-choice="continue"]').click();
    await page.locator(".ada-use").waitFor({ state: "visible" });
    await contextControlProof(1, "resumed flight");
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("Space");
    await page.locator('[data-action="dialogue-choice"]').first().waitFor({ state: "visible" });
    await contextControlProof(0, "keyboard interaction dialogue");
    await page.locator('[data-action="dialogue-choice"][data-choice="continue"]').click();
    assert.equal(await warning.textContent(), PROTOTYPE.labels.savingUnavailable);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
      beforeStorageFailure,
      "Failed writes must preserve the last persisted state",
    );
    await page.screenshot({ path: `${output}/save-unavailable.png` });
  } finally {
    await page.evaluate(() => {
      Storage.prototype.setItem = window.__adaOriginalSetItem;
      delete window.__adaOriginalSetItem;
    });
  }
  await openSettings();
  await page.waitForFunction((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    const status = document.querySelector("#game-status");
    return (
      document.querySelector("#save-status")?.textContent === "" &&
      saved?.flight?.player.x === Number(status.dataset.x) &&
      saved?.flight?.player.y === Number(status.dataset.y)
    );
  }, storageKey);
  await closeSettings();
  await contextControlProof(1, "recovered flight");
  events.checks.push(
    "Blocked browser storage preserves gameplay and last save; " +
      "status survives dialogue and clears after successful write",
  );
  events.checks.push(
    "One dedicated context control supports pointer and keyboard use, absent in home and dialogue",
  );

  const dangerInput = new GameModel(PROTOTYPE, safeSerialized);
  dangerInput.state.flight.dangerFor = 5;
  dangerInput.state.flight.player.x += PROTOTYPE.tuning.safeRadius * 3;
  dangerInput.state.flight.objects = [];
  dangerInput.state.flight.shots = [];
  await seedOnce(dangerInput.save(), "ada-browser.danger-context.v1");
  await openPause();
  const refused = await Promise.all(
    ["travel", "returnHome"].map((action) =>
      page.locator(`[data-action="pause-${action}"]`).getAttribute("aria-disabled"),
    ),
  );
  assert.deepEqual(refused, ["true", "true"], "Travel and Return home refuse in danger");
  await page
    .locator('[data-dialog="pause"]')
    .getByText(PROTOTYPE.labels.travelUnavailable, { exact: true })
    .waitFor({ state: "visible" });
  // A refused action stays pressable (aria-disabled), which Playwright treats as disabled.
  await page.locator('[data-action="pause-returnHome"]').click({ force: true });
  await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
  assert.equal(
    await page.locator('#game-status[data-mode="space"]').count(),
    1,
    "A refused Return home keeps the flight",
  );
  await page.locator('[data-action="pause-resume"]').click();
  await contextControlProof(0, "danger outside a friendly destination");
  events.checks.push(
    "Danger blocks travel and exposes no inapplicable or duplicate contextual control",
  );
  await seedOnce(safeSerialized, "ada-browser.after-save-proof.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.setViewportSize({ width: 844, height: 390 });
  // Compare observable flight response, not the implementation's stick sampling formula. Travel is
  // in logical px, --ada-unit CSS px each.
  const stickUnit = await page
    .locator("#app")
    .evaluate((app) => Number(getComputedStyle(app).getPropertyValue("--ada-unit")));
  async function analogRun(logical, marker) {
    const distance = logical * stickUnit;
    await seedOnce(safeSerialized, marker);
    const target = await page.locator('[data-control="move-joystick"]').boundingBox();
    assert.ok(target);
    const start = await position();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    await page.mouse.down();
    try {
      await page.mouse.move(target.x + target.width / 2 + distance, target.y + target.height / 2);
      await page.waitForTimeout(500);
    } finally {
      await page.mouse.up();
    }
    const end = await waitForRest(await position());
    return Math.hypot(end.x - start.x, end.y - start.y);
  }
  const deadTravel = await analogRun(1, "ada-browser.analog-dead.v1");
  const smallTravel = await analogRun(8, "ada-browser.analog-small.v1");
  const fullTravel = await analogRun(40, "ada-browser.analog-full.v1");
  assert.equal(deadTravel, 0, "Movement inside the logical dead zone must remain idle");
  assert.ok(
    smallTravel > 0 && fullTravel > smallTravel * 1.5,
    "Full logical travel must move materially farther than partial travel over the same interval",
  );
  save("analog-proof.json", { deadTravel, smallTravel, fullTravel });
  events.checks.push("Logical move-stick dead zone and partial/full throttle affect actual flight");
  await seedOnce(safeSerialized, "ada-browser.after-analog.v1");
  const joystick = page.locator('[data-control="move-joystick"]');
  await joystick.waitFor({ state: "visible" });
  const bounds = await joystick.boundingBox();
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
  const pointerStart = await position();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(bounds.x + bounds.width * 0.85, bounds.y + bounds.height / 2, {
      steps: 5,
    });
    await page.waitForFunction(({ x, y }) => {
      const status = document.querySelector("#game-status");
      return Number(status.dataset.x) !== x || Number(status.dataset.y) !== y;
    }, pointerStart);
  } finally {
    await page.mouse.up();
  }
  events.checks.push("Pointer joystick changes actual flight coordinates");
  const released = await waitForRest(await position());
  await page.waitForTimeout(250);
  assert.deepEqual(await position(), released, "Pointer release must cancel held movement");
  events.checks.push("Pointer release cancels movement");
  await page.screenshot({ path: `${output}/phone.png` });
  const moveBounds = await page.locator('[data-control="move-joystick"]').boundingBox();
  const aimBounds = await page.locator('[data-control="aim-joystick"]').boundingBox();
  assert.ok(moveBounds && aimBounds, "Both real joystick targets must be present");
  const touchBefore = await position();
  const touch = await context.newCDPSession(page);
  const origins = [moveBounds, aimBounds].map((box, index) => ({
    id: index + 1,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  }));
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: origins });
  try {
    const deflected = origins.map((point, index) => ({
      ...point,
      x: point.x + (index === 0 ? 25 : 0),
      y: point.y - (index === 1 ? 25 : 0),
    }));
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: deflected });
    await page.waitForFunction(
      ({ before, key }) => {
        const flight = JSON.parse(localStorage.getItem(key))?.flight;
        return (
          flight &&
          (flight.player.x !== before.x || flight.player.y !== before.y) &&
          flight.shots.some((shot) => !shot.enemy)
        );
      },
      { key: storageKey, before: touchBefore },
    );
    const held = (await readSave()).flight;
    save("touch-proof.json", {
      before: touchBefore,
      whileHeld: { player: held.player, shots: held.shots },
    });
    await page.screenshot({ path: `${output}/phone.png` });
  } finally {
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await touch.detach();
  }
  events.checks.push(
    "Simultaneous native move and aim touch changes saved position and emits player shots",
  );
  const touchReleased = await waitForRest(await position());
  await page.waitForFunction((key) => {
    const flight = JSON.parse(localStorage.getItem(key))?.flight;
    return flight && !flight.shots.some((shot) => !shot.enemy);
  }, storageKey);
  await page.waitForTimeout(1250);
  assert.deepEqual(
    await position(),
    touchReleased,
    "Released native touches must not resume movement",
  );
  assert.ok(
    !(await readSave()).flight.shots.some((shot) => !shot.enemy),
    "Released native aim must not resume firing",
  );
  events.checks.push("Native touch release clears movement and firing without resurrection");

  const equipment = new GameModel(PROTOTYPE, safeSerialized);
  equipment.state.flight.ownedWeapons = ["rapidMissile", "multiLaser"];
  equipment.state.flight.weapon = "basic";
  const equipmentSave = equipment.save();
  assert.deepEqual(new GameModel(PROTOTYPE, equipmentSave).state, equipment.state);
  save("equipment-fixture.json", {
    scope:
      "Canonical owned-upgrade fixture for UI selection and persistence, not pickup progression",
    state: JSON.parse(equipmentSave),
  });
  await seedOnce(equipmentSave, "ada-browser.equipment.v1");
  const missileButton = page.locator('button[data-weapon="rapidMissile"]');
  await missileButton.waitFor({ state: "visible" });
  assert.equal(
    await page.locator('button[data-weapon="scattershot"]').count(),
    0,
    "An unowned upgrade must not be offered",
  );
  await missileButton.click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "rapidMissile",
    storageKey,
  );
  assert.equal(await missileButton.getAttribute("aria-pressed"), "true");
  assert.equal(
    await page.locator(".flight-hud").count(),
    0,
    "The removed top-left information HUD must not be recreated",
  );
  // Each weapon masks its own 20px glyph.
  const { weaponGlyphPath } = await import(
    new URL("../src/data/weapon-glyphs.ts", import.meta.url)
  );
  const weaponImages = await page.locator(".ada-weapon-selector .ada-disc").evaluateAll((glyphs) =>
    glyphs.map((glyph) => ({
      decorative: glyph.getAttribute("aria-hidden") === "true",
      mask:
        getComputedStyle(glyph, "::before").maskImage ||
        getComputedStyle(glyph, "::before").webkitMaskImage,
      state: glyph.closest(".ada-weapon").dataset.state,
      weapon: glyph.closest(".ada-weapon").dataset.weapon,
    })),
  );
  assert.equal(weaponImages.length, 3, "Basic and both owned upgrades require weapon glyphs");
  for (const icon of weaponImages) {
    assert.ok(icon.decorative, "Weapon glyphs must not duplicate button names");
    assert.ok(
      icon.mask.includes(weaponGlyphPath(icon.weapon)),
      `Weapon glyphs must mask Art's 20px icon: ${icon.mask}`,
    );
  }
  const glyphStatuses = await Promise.all(
    weaponImages.map(async (icon) =>
      (await page.request.get(`http://ada-preview:4173${weaponGlyphPath(icon.weapon)}`)).status(),
    ),
  );
  assert.deepEqual(
    glyphStatuses,
    weaponImages.map(() => 200),
    "The 20px weapon glyphs must be served",
  );
  assert.equal(
    weaponImages.find((icon) => icon.weapon === "rapidMissile")?.state,
    "selected",
    "The selected weapon must draw the selected state",
  );
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-weapon="rapidMissile"]')?.getAttribute("aria-pressed") ===
      "true",
  );
  assert.deepEqual((await readSave()).flight.ownedWeapons, ["rapidMissile", "multiLaser"]);
  await openSettings();
  assert.ok(await missileButton.isDisabled(), "Settings must disable weapon selection");
  const pausedWeapon = (await readSave()).flight.weapon;
  await page.locator('[data-weapon="multiLaser"]').evaluate((button) => button.click());
  assert.equal(
    (await readSave()).flight.weapon,
    pausedWeapon,
    "A disabled weapon must not change selection behind the modal",
  );
  await closeSettings();
  await page.locator('[data-weapon="multiLaser"]').click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "multiLaser",
    storageKey,
  );
  await page.keyboard.down("ArrowRight");
  try {
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).flight.shots.some((shot) => !shot.enemy),
      storageKey,
    );
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  assert.equal(
    (await readSave()).flight.weapon,
    "multiLaser",
    "Firing must not consume an upgrade",
  );
  const meter = page.getByRole("meter", { name: PROTOTYPE.labels.shield, exact: true });
  assert.equal(Number(await meter.getAttribute("aria-valuenow")), PROTOTYPE.tuning.shieldMax);
  const bar = await meter.boundingBox();
  const pill = await page.locator(".ada-status").boundingBox();
  const pauseBox = await page.locator('[data-action="pause"]').boundingBox();
  // The DOM UI is sized in logical px: --ada-unit CSS px each.
  const unit = await page
    .locator("#app")
    .evaluate((app) => Number(getComputedStyle(app).getPropertyValue("--ada-unit")));
  assert.ok(
    bar &&
      pill &&
      Math.abs(bar.width - 96 * unit) <= 1 &&
      Math.abs(bar.height - 12 * unit) <= 1 &&
      Math.abs(pill.height - 28 * unit) <= 1 &&
      bar.x > pill.x &&
      bar.x + bar.width < pill.x + pill.width,
    "The shield meter must be the status pill's 96x12 bar",
  );
  if (pauseBox && (await page.locator('[data-action="pause"]').isVisible())) {
    assert.ok(
      Math.abs(pill.x - (pauseBox.x + pauseBox.width + 8 * unit)) <= 1,
      "The status pill must sit a gap right of the pause press area",
    );
  }
  const pauseButton = page.locator('[data-action="pause"]');
  assert.equal(await pauseButton.getAttribute("aria-label"), PROTOTYPE.labels.pause);
  const pauseImage = await pauseButton.evaluate(
    (node) => getComputedStyle(node, "::before").backgroundImage,
  );
  assert.ok(
    pauseImage.includes("/art/ui/icons/pause.svg"),
    `Pause must draw its vector art: ${pauseImage}`,
  );
  assert.equal(
    (await page.request.get("http://ada-preview:4173/art/ui/icons/pause.svg")).status(),
    200,
    "The real pause button resource must be served",
  );
  assert.equal(
    await page.locator('[data-action="settings"]').isVisible(),
    false,
    "Play shows no settings button; Settings opens from the Paused card",
  );
  assert.ok(
    !("ammo" in (await readSave()).flight),
    "Saves carry no ammunition count; upgrades are unlimited",
  );
  save("weapon-icons-proof.json", { pauseImage, weaponImages });
  await page.screenshot({ path: `${output}/weapon-shield.png` });
  events.checks.push(
    "Owned unlimited weapons support accessible selection, reload, modal guards and the status pill's shield meter",
  );

  const damaged = new GameModel(PROTOTYPE, equipmentSave);
  assert.ok(damaged.selectWeapon("rapidMissile"));
  // Damage is meaningful only outside the friendly destination's protected region.
  damaged.state.flight.player.x += PROTOTYPE.tuning.safeRadius * 2;
  assert.ok(
    damaged.state.flight.objects
      .filter((object) => object.kind === "destination")
      .every(
        (destination) =>
          Math.hypot(
            destination.x - damaged.state.flight.player.x,
            destination.y - damaged.state.flight.player.y,
          ) > PROTOTYPE.tuning.safeRadius,
      ),
    "Projectile fixture must be outside every active protected destination",
  );
  damaged.state.flight.shield = PROTOTYPE.tuning.enemyDamage;
  damaged.state.flight.shots.push({
    ...damaged.state.flight.player,
    enemy: true,
    hitIds: [],
    id: "browser-shield-break",
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
  });
  damaged.state.economy.stardust = 30;
  damaged.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
  assert.equal(damaged.state.mode, "home", "Shield depletion must jump Ada home");
  assert.deepEqual(damaged.state.economy.ownedWeapons, ["multiLaser"]);
  assert.equal(damaged.state.economy.weapon, "basic", "The equipped upgrade must be lost");
  assert.equal(damaged.state.economy.stardust, 20, "Recharging must cost 10 Stardust");
  const damageSave = damaged.save();
  assert.deepEqual(new GameModel(PROTOTYPE, damageSave).state, damaged.state);
  save("shield-break-fixture.json", {
    scope: "Real-model projectile damage before restore, not a natural browser combat playthrough",
    state: JSON.parse(damageSave),
  });
  await seedOnce(damageSave, "ada-browser.shield-break.v1");
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  const jumpNotice = await page.locator("#game-status").textContent();
  assert.ok(
    jumpNotice.includes(PROTOTYPE.labels.jumpHome) &&
      jumpNotice.includes("Your Rapid Missile was lost.") &&
      jumpNotice.includes("Recharging cost 10 Stardust."),
    `The jump home notice must name the loss and the fee: ${jumpNotice}`,
  );
  assert.equal(await page.locator('[data-weapon="rapidMissile"]').count(), 0);
  events.checks.push(
    "Canonical shield depletion jumps Ada home, losing the equipped upgrade and charging the recharge fee",
  );

  const { SCREEN } = await import(new URL("../src/data/screen.ts", import.meta.url));
  const weaponModel = new GameModel(PROTOTYPE, safeSerialized);
  weaponModel.state.flight.ownedWeapons = ["rapidMissile", "multiLaser", "scattershot"];
  weaponModel.state.flight.weapon = "basic";
  weaponModel.state.flight.objects = [];
  weaponModel.state.flight.shots = [];
  const weaponSave = weaponModel.save();
  assert.deepEqual(new GameModel(PROTOTYPE, weaponSave).state, weaponModel.state);
  save("weapon-volley-fixture.json", {
    scope:
      "Canonical cleared-flight fixture for actual UI firing, not natural pickup or combat progression",
    state: JSON.parse(weaponSave),
  });
  async function heldVolley(weapon, projectile, minimum, faded = false) {
    await seedOnce(weaponSave, `ada-browser.volley-${weapon}.v1`);
    await page.locator(`button[data-weapon="${weapon}"]`).click();
    await page.keyboard.down("ArrowRight");
    try {
      await page.waitForFunction(
        ({ faded, key, minimum, projectile }) => {
          const shots =
            JSON.parse(localStorage.getItem(key))?.flight?.shots.filter(
              (shot) => !shot.enemy && shot.projectile === projectile,
            ) ?? [];
          return (
            shots.length >= minimum &&
            (!faded || shots.some((shot) => shot.fade && shot.life / shot.fade.initialLife < 0.35))
          );
        },
        { key: storageKey, projectile, minimum, faded },
      );
      const snapshot = await readSave();
      assert.deepEqual(
        new GameModel(PROTOTYPE, JSON.stringify(snapshot)).state,
        snapshot,
        "Actual fired projectiles and fade metadata must survive canonical save validation",
      );
      await page.screenshot({ path: `${output}/volley-${weapon}.png` });
      return snapshot;
    } finally {
      await page.keyboard.up("ArrowRight");
    }
  }
  const missiles = await heldVolley("rapidMissile", "missile", 3);
  // Remaining life counts down, so ascending life is firing order (oldest first).
  const missileShots = missiles.flight.shots
    .filter((shot) => !shot.enemy && shot.projectile === "missile")
    .sort((a, b) => a.life - b.life);
  assert.ok(
    new Set(missileShots.map((shot) => shot.id)).size >= 3,
    "One held aim input must emit multiple automatic missiles",
  );
  // Shots follow the damped aim facing: the immediate first shot may leave mid-turn, and once
  // the facing settles on the held screen-right aim (world angle -45 degrees) every later
  // missile shares that straight heading.
  const headingOf = (shot) => Math.atan2(shot.velocity.y, shot.velocity.x);
  const settledAim = -Math.PI / 4;
  const firstSettled = missileShots.findIndex(
    (shot) => Math.abs(headingOf(shot) - settledAim) < 0.000001,
  );
  assert.ok(
    firstSettled >= 0 && missileShots.length - firstSettled >= 2,
    "Held-direction missiles must share the settled aim heading",
  );
  for (const shot of missileShots.slice(firstSettled)) {
    assert.ok(
      Math.abs(headingOf(shot) - settledAim) < 0.000001,
      "Held-direction missiles must retain a straight shared heading once aim settles",
    );
  }
  for (const shot of missileShots) {
    assert.ok(shot.damage > PROTOTYPE.tuning.flight.playerShotDamage);
  }
  const triple = await heldVolley("multiLaser", "bolt", 3);
  const bolts = triple.flight.shots.filter((shot) => !shot.enemy && shot.projectile === "bolt");
  const newest = Math.max(...bolts.map((shot) => shot.life));
  const angles = bolts
    .filter((shot) => Math.abs(shot.life - newest) < 0.000001)
    .map(
      (shot) =>
        (Math.atan2((shot.velocity.x + shot.velocity.y) / 2, shot.velocity.x - shot.velocity.y) *
          180) /
        Math.PI,
    )
    .sort((a, b) => a - b);
  assert.equal(
    angles.length,
    3,
    "A real level 1 Multi-Laser volley must emit three simultaneous bolts",
  );
  for (const [index, offset] of [-20, 0, 20].entries()) {
    assert.ok(
      Math.abs(angles[index] - angles[1] - offset) < 0.000001,
      "The visible projected level 1 Multi-Laser volley must retain its approved ±20 degree spread",
    );
  }
  const scatter = await heldVolley("scattershot", "dot", 7, true);
  const dots = scatter.flight.shots.filter((shot) => !shot.enemy && shot.projectile === "dot");
  const fading = dots.filter((shot) => shot.life / shot.fade.initialLife < 0.35);
  // Pellets leave the nose of the heading they fired at, so from Ada's centre each lies within
  // the range plus the farthest nose offset of the 16 headings.
  const { noseScreenOffset } = await import(new URL("../src/model/nose.ts", import.meta.url));
  const noseReach = Math.max(
    ...Array.from({ length: 16 }, (_, heading) => {
      const { x, y } = noseScreenOffset(heading);
      return Math.hypot(x, y);
    }),
  );
  assert.ok(fading.length > 0, "Actual scatter particles must reach their fade segment");
  for (const shot of dots) {
    assert.equal(
      shot.fade.projectedRange,
      SCREEN.width * 0.5,
      "Range must use the fixed main camera's logical width at zoom one, not CSS width or DPR",
    );
    assert.equal(shot.fade.fadeStartFraction, 0.65);
    const dx = shot.x - scatter.flight.player.x;
    const dy = shot.y - scatter.flight.player.y;
    assert.ok(
      Math.hypot(dx - dy, (dx + dy) / 2) <= SCREEN.width * 0.5 + noseReach + 0.001,
      "Actual scatter particles must remain inside the half-camera projected range from the nose",
    );
    assert.ok(shot.damage > 0 && shot.damage < PROTOTYPE.tuning.flight.playerShotDamage);
  }
  await page.waitForFunction(
    (key) =>
      !JSON.parse(localStorage.getItem(key)).flight.shots.some(
        (shot) => !shot.enemy && shot.projectile === "dot",
      ),
    storageKey,
  );
  save("weapon-volley-proof.json", {
    scope:
      "Actual UI input and canonical saved shot trajectories; screenshots require visual fade review",
    cameraWidth: SCREEN.width,
    missiles: missileShots,
    tripleProjectedAngles: angles,
    scatter: dots,
  });
  events.checks.push(
    "Actual held aim emits automatic straight missiles, triple ±20 degree bolts " +
      "and fading half-camera scatter particles",
  );

  const cargoModel = new GameModel(PROTOTYPE);
  cargoModel.state.unlocked = [1, 2];
  cargoModel.startSector(2);
  playOpening(cargoModel);
  Object.assign(cargoModel.state.progress[2], { introduced: true, stage: 1, known: ["hub"] });
  ensureDestination(PROTOTYPE, "hub", cargoModel.state.flight);
  cargoModel.teleport("hub");
  cargoModel.state.flight.cargo = 12345;
  const cargoSave = cargoModel.save();
  assert.deepEqual(new GameModel(PROTOTYPE, cargoSave).state, cargoModel.state);
  save("cargo-fixture.json", {
    scope: "Canonical wide-cargo deposit UI fixture, not natural mining progression",
    state: JSON.parse(cargoSave),
  });
  await seedOnce(cargoSave, "ada-browser.wide-cargo.v1");
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.mode === "space" && state.flight?.sector === 2 && state.flight.cargo === 12345;
  }, storageKey);
  assert.equal(
    await page.locator(".flight-hud").count(),
    0,
    "Wide cargo must not restore the removed information HUD",
  );
  await page.getByRole("button", { name: PROTOTYPE.labels.deposit, exact: true }).click();
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.flight.cargo === 0 && state.progress[2].deposited === 12345;
  }, storageKey);
  await page.reload();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).progress[2].deposited === 12345,
    storageKey,
  );
  events.checks.push(
    "Canonical wide cargo survives restore and a real deposit persists after reload",
  );

  // This fixture proves only the saved-state UI boundary, not completion of the quest in a browser.
  const fixture = new GameModel(PROTOTYPE);
  fixture.startSector(1);
  playOpening(fixture);
  assert.ok(fixture.state.flight, "The real model must create a valid flight");
  Object.assign(fixture.state.progress[1], {
    stage: 4,
    introduced: true,
    questComplete: true,
    resolved: false,
    questItem: null,
    known: ["growers", "workshop", "salvagers"],
    discoveries: 3,
    holodisk: true,
    opened: true,
  });
  fixture.returnHome();
  assert.equal(fixture.storyView?.page.id, "resolution");
  const serialized = fixture.save();
  save("resolution-fixture.json", {
    scope: "Completed-quest save fixture for home resolution UI boundary only",
    state: JSON.parse(serialized),
  });
  await seedOnce(serialized, "ada-browser.resolution-fixture.v1");
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  // A launch at home shows the start screen; Continue plays the waiting resolution first.
  await page.locator('[data-action="continue"]').click();
  await contextControlProof(0, "home resolution");
  const choices = page.locator('[data-action="story-choice"]');
  await page.getByText(PROTOTYPE.chapters[1].resolution, { exact: true }).waitFor();
  assert.equal(await choices.count(), 2, "home resolution must offer both real choices");
  await page.screenshot({ path: `${output}/resolution.png` });
  await choices.nth(1).click();
  await page.getByText(PROTOTYPE.chapters[1].resolutionBranches[1], { exact: true }).waitFor();
  await page.locator('.ada-story-panel:not([hidden]) [data-action="story-next"]').click();
  await page.getByText(PROTOTYPE.chapters[1].closing, { exact: true }).waitFor();
  assert.equal(await choices.count(), 0, "The closing is an ordinary page");
  const homePages = await readStory();
  assert.equal(homePages[0]?.text, PROTOTYPE.chapters[1].closing);
  assert.equal(homePages[1]?.text, PROTOTYPE.chapters[2].opening, "Galaxy two's opening follows");
  await selector.waitFor({ state: "visible" });
  assert.equal(
    (await selector.locator("h2").textContent())?.trim(),
    PROTOTYPE.labels.galaxyNumber.replace("{number}", "2"),
    "Galaxy selection opens on the farthest unlocked galaxy",
  );
  assert.equal(
    await page.locator('[data-action="galaxy-jump"]').getAttribute("aria-disabled"),
    null,
    "home resolution must unlock galaxy two",
  );
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state?.progress[1].resolved && state.unlocked.includes(2);
  }, storageKey);
  events.checks.push(
    "Fixture-based home resolution, closing and the next opening lead to galaxy selection on " +
      "the newly unlocked galaxy",
  );
  // Canonical save fixtures exercise rendering and restore boundaries, not natural combat progression.
  const [{ enemyCatalog }, { createEnemy, damageEnemy }, { restoreSave }] = await Promise.all([
    import(new URL("../src/data/enemy-catalog.ts", import.meta.url)),
    import(new URL("../src/model/enemy-ai.ts", import.meta.url)),
    import(new URL("../src/model/save.ts", import.meta.url)),
  ]);
  const [{ ASTEROID_FOOTPRINTS, readAsteroidCatalog }, asteroidArt, { orbitMotion }] =
    await Promise.all([
      import(new URL("../src/data/asteroid-catalog.ts", import.meta.url)),
      import(new URL("../src/game/asteroid-art.ts", import.meta.url)),
      import(new URL("../src/model/asteroids.ts", import.meta.url)),
    ]);
  const asteroidResponse = await page.request.get("http://ada-preview:4173/art/asteroids.json");
  assert.equal(asteroidResponse.status(), 200, "Art's asteroid catalog must be served");
  const rockArt = readAsteroidCatalog(await asteroidResponse.json());
  assert.ok(rockArt, "Art's asteroid catalog must read as version 1");
  const toScreen = (world) => ({ x: 360 + world.x - world.y, y: 180 + (world.x + world.y) / 2 });
  // The first flight seed whose backdrop field shows a rock in the asteroid fixture's open
  // top-centre area, clear of its play rocks (shown), or none in view at all.
  function backdropSeed(shown, player) {
    const { cell } = asteroidArt.BACKDROP_FIELD;
    const cx = Math.floor(player.x / cell);
    const cy = Math.floor(player.y / cell);
    for (let seed = 1; seed < 2000; seed++) {
      let near = false;
      let visible = false;
      for (let x = cx - 4; x <= cx + 4; x++) {
        for (let y = cy - 4; y <= cy + 4; y++) {
          const rock = asteroidArt.backdropRock(rockArt, seed, x, y);
          if (rock) {
            const at = toScreen({ x: rock.x - player.x, y: rock.y - player.y });
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
  // Live capitals keep a viewport-sized gap, so each large enemy renders from its own canonical
  // save at the offset its sampled screen region expects.
  function combatFixture(archetype, offset, missile) {
    const combat = new GameModel(PROTOTYPE);
    combat.startSector(1);
    playOpening(combat);
    assert.ok(combat.state.flight, "Combat fixture requires a canonical flight");
    const flight = combat.state.flight;
    combat.state.progress[1].introduced = true;
    combat.state.dialogue = null;
    flight.objects = [];
    flight.shots = [];
    // No backdrop rock in view, so the sampled regions see only the combat and empty space.
    flight.seed = backdropSeed(false, flight.player);
    const origin = { ...flight.player };
    const definition = enemyCatalog[archetype];
    assert.ok(definition.hardpoints.length > 1, "Large enemies require distinct hardpoints");
    const at = { x: origin.x + offset.x, y: origin.y + offset.y };
    let enemy = createEnemy(
      definition,
      { archetype, id: `browser-combat:${archetype}`, packId: null, phase: 0 },
      at,
    );
    const engine = definition.hardpoints.find((part) => part.kind === "engine");
    assert.ok(engine, "Fixture requires a destructible engine");
    enemy = damageEnemy(definition, { amount: engine.hp, hardpointId: engine.id }, enemy);
    assert.ok(enemy.hardpoints.some((part) => part.hp === 0));
    assert.ok(enemy.hardpoints.some((part) => part.hp > 0));
    flight.objects.push({
      ...at,
      enemy,
      hp: definition.hp,
      id: enemy.id,
      kind: "enemy",
      radius: PROTOTYPE.tuning.flight.shipRadius * definition.sizeRatio,
    });
    if (missile) {
      flight.shots.push({
        enemy: true,
        hitIds: [],
        id: "browser-combat:missile",
        life: PROTOTYPE.tuning.flight.enemyProjectileLifetime,
        piercing: false,
        projectile: "missile",
        velocity: { x: 12, y: 12 },
        x: origin.x,
        y: origin.y - 180,
      });
    }
    const serialized = combat.save();
    assert.deepEqual(restoreSave(serialized), combat.state, "Canonical restore accepts combat");
    assert.deepEqual(new GameModel(PROTOTYPE, serialized).state, combat.state);
    return serialized;
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const paletteResponse = await page.request.get("http://ada-preview:4173/art/space-palette.json");
  assert.equal(paletteResponse.status(), 200, "Approved space palette must be served");
  const { colors: approvedColors } = await paletteResponse.json();
  // In flight, space takes the galaxy's field colours; the combat fixtures fly in galaxy one.
  const galaxiesResponse = await page.request.get("http://ada-preview:4173/art/galaxies.json");
  assert.equal(galaxiesResponse.status(), 200, "Approved galaxy fields must be served");
  const { galaxies: galaxyFields } = await galaxiesResponse.json();
  const paletteColors = {
    ...approvedColors,
    ...galaxyFields.find(({ number }) => number === 1).colors,
  };
  const combatSnapshots = {};
  const pixels = {};
  async function renderCombatView(view) {
    const serialized = combatFixture(view.archetype, view.offset, view.missile);
    const seeded = view.missile ? " and a seeded missile" : "";
    save(`combat-fixture-${view.archetype}.json`, {
      scope: [
        `Real-model save fixture with damaged hardpoints${seeded}`,
        "render/restore proof only, not natural encounter or combat completion",
      ].join("; "),
      state: JSON.parse(serialized),
    });
    await seedOnce(serialized, `ada-browser.combat-fixture-${view.archetype}.v1`);
    await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
    await page.waitForFunction(
      ({ archetype, key, missile }) => {
        const current = JSON.parse(localStorage.getItem(key))?.flight;
        return (
          current?.objects.some(
            (object) =>
              object.enemy?.archetype === archetype &&
              object.enemy.hardpoints.some((part) => part.hp === 0) &&
              object.enemy.hardpoints.some((part) => part.hp > 0),
          ) &&
          (!missile || current.shots.some((shot) => shot.enemy && shot.projectile === "missile"))
        );
      },
      { archetype: view.archetype, key: storageKey, missile: view.missile },
    );
    combatSnapshots[view.archetype] = await readSave();
    const canvas = page.locator("canvas");
    await canvas.waitFor({ state: "visible" });
    // The pixel regions sample the canvas alone; the conversation box and notices draw over it.
    const overlays = await page.addStyleTag({
      content: ".ada-conversation,#game-status,#save-status{visibility:hidden !important}",
    });
    const combatImage = await canvas.screenshot({
      path: `${output}/combat-canvas-${view.archetype}.png`,
    });
    const intrinsic = await canvas.evaluate((element) => ({
      width: element.width,
      height: element.height,
    }));
    Object.assign(
      pixels,
      await page.evaluate(
        async ({ encoded, intrinsic, names, paletteColors }) => {
          const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
          const sample = document.createElement("canvas");
          sample.width = bitmap.width;
          sample.height = bitmap.height;
          const drawing = sample.getContext("2d");
          drawing.drawImage(bitmap, 0, 0);
          bitmap.close();
          // Projection is anchored to logical SCREEN center (360,180), even when EXPAND adds height.
          const regions = {
            // The 5-width capital centres at (180, 180); its disabled left engine at (115, 188).
            capital: { x: 90, y: 130, width: 180, height: 100 },
            missile: { x: 510, y: 65, width: 65, height: 55 },
            disabled: { x: 100, y: 172, width: 30, height: 32 },
            background: { x: 280, y: 280, width: 160, height: 60 },
          };
          return Object.fromEntries(
            names
              .map((name) => [name, regions[name]])
              .map(([name, region]) => {
                const scaleX = sample.width / intrinsic.width;
                const scaleY = sample.height / intrinsic.height;
                const bitmapRegion = {
                  x: Math.floor((region.x + Math.max(0, (intrinsic.width - 720) / 2)) * scaleX),
                  y: Math.floor(region.y * scaleY),
                  width: Math.max(1, Math.floor(region.width * scaleX)),
                  height: Math.max(1, Math.floor(region.height * scaleY)),
                };
                const image = drawing.getImageData(
                  bitmapRegion.x,
                  bitmapRegion.y,
                  bitmapRegion.width,
                  bitmapRegion.height,
                );
                const colors = Object.fromEntries(
                  [
                    "obstacle",
                    "shipHardpoint",
                    "weapon",
                    "environment",
                    "environmentDetail",
                    "background",
                  ].map((role) => {
                    const hex = paletteColors[role];
                    if (!/^#[0-9a-f]{6}$/i.test(hex)) {
                      throw new Error(`Missing valid palette role: ${role}`);
                    }
                    return [
                      role,
                      [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)),
                    ];
                  }),
                );
                const counts = Object.fromEntries(Object.keys(colors).map((role) => [role, 0]));
                const outline = {
                  minX: Infinity,
                  maxX: -Infinity,
                  minY: Infinity,
                  maxY: -Infinity,
                };
                for (let offset = 0; offset < image.data.length; offset += 4) {
                  for (const [role, rgb] of Object.entries(colors)) {
                    // Small channel tolerance permits raster rounding without accepting another palette class.
                    if (
                      rgb.every(
                        (channel, index) => Math.abs(image.data[offset + index] - channel) <= 3,
                      )
                    ) {
                      counts[role]++;
                      if (role === "obstacle") {
                        const index = offset / 4;
                        const x = index % image.width;
                        const y = Math.floor(index / image.width);
                        outline.minX = Math.min(outline.minX, x);
                        outline.maxX = Math.max(outline.maxX, x);
                        outline.minY = Math.min(outline.minY, y);
                        outline.maxY = Math.max(outline.maxY, y);
                      }
                    }
                  }
                }
                return [
                  name,
                  {
                    logical: region,
                    bitmap: bitmapRegion,
                    counts,
                    area: image.width * image.height,
                    outlineSpan: {
                      x: counts.obstacle ? (outline.maxX - outline.minX) / scaleX : 0,
                      y: counts.obstacle ? (outline.maxY - outline.minY) / scaleY : 0,
                    },
                  },
                ];
              }),
          );
        },
        {
          encoded: combatImage.toString("base64"),
          intrinsic,
          names: view.names,
          paletteColors,
        },
      ),
    );
    await overlays.evaluate((node) => node.remove());
  }
  await renderCombatView({
    archetype: "capital",
    missile: true,
    names: ["capital", "missile", "background", "disabled"],
    offset: { x: -90, y: 90 },
  });
  assert.ok(
    pixels.capital.counts.obstacle > 20 &&
      pixels.capital.outlineSpan.x > 50 &&
      pixels.capital.outlineSpan.y > 40,
    "Large enemy must have a spatially extended coral hull outline, not isolated projectile pixels",
  );
  assert.ok(
    pixels.capital.counts.environment > pixels.capital.area * 0.2,
    "Large enemy must contain the approved hull fill",
  );
  assert.ok(
    pixels.capital.counts.shipHardpoint > 20 && pixels.capital.counts.weapon > 20,
    "Large enemy must render both live blue ship and amber weapon hardpoints",
  );
  assert.ok(
    pixels.disabled.counts.environmentDetail > 20 &&
      pixels.disabled.counts.background > 20 &&
      pixels.disabled.counts.environment > 20,
    "Disabled capital hardpoint must have a dark cutout and detail cross within the hull",
  );
  assert.ok(
    pixels.missile.counts.obstacle > 2 && pixels.missile.outlineSpan.y > 2,
    "Seeded missile must contain coral projectile geometry",
  );
  assert.ok(
    pixels.background.counts.background > pixels.background.area * 0.9,
    "Empty space must render galaxy one's hue rather than the monochrome fallback",
  );
  await page.screenshot({ path: `${output}/combat.png` });
  save("combat-proof.json", {
    scope: "Rendered canonical combat fixture; screenshot review required for visual correctness",
    states: combatSnapshots,
    canvas: await page.locator("canvas").boundingBox(),
    capitalSizeRatio: enemyCatalog.capital.sizeRatio,
    pixels,
    paletteColors,
  });
  events.checks.push(
    "Canonical combat save restores a capital, partial hardpoint damage " +
      "and missile with renderer screenshots",
  );

  // Art review captures (art/asteroids.md): one rock of each size and a drifting rock around
  // Ada in each galaxy, with a backdrop rock in view, and galaxy one's spin over four seconds.
  // Pivots sit at rock bases, so each rock rises above its point; the top centre stays open.
  const ROCK_SCREEN = {
    small: { x: -280, y: -110 },
    medium: { x: -230, y: 120 },
    large: { x: -40, y: 165 },
    huge: { x: 235, y: 150 },
  };
  const toWorld = (screen) => ({ x: screen.x / 2 + screen.y, y: screen.y - screen.x / 2 });
  function asteroidFixture(sector) {
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
    flight.seed = backdropSeed(true, flight.player);
    const origin = { ...flight.player };
    for (const [size, screen] of Object.entries(ROCK_SCREEN)) {
      const footprint = ASTEROID_FOOTPRINTS.asteroids.find((entry) => entry.size === size);
      const offset = toWorld(screen);
      flight.objects.push({
        asteroid: footprint.id,
        hp: 99,
        id: `browser-rock:${size}`,
        kind: "rock",
        radius: footprint.radius,
        x: origin.x + offset.x,
        y: origin.y + offset.y,
      });
    }
    const small = ASTEROID_FOOTPRINTS.asteroids.find((entry) => entry.size === "small");
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
    flight.objects.push({
      asteroid: small.id,
      hp: 99,
      id: "browser-rock:drifting",
      kind: "rock",
      orbit,
      radius: small.radius,
      velocity: { x: motion.velocity.x + 0, y: motion.velocity.y + 0 },
      x: motion.position.x + 0,
      y: motion.position.y + 0,
    });
    const serialized = model.save();
    assert.deepEqual(restoreSave(serialized), model.state, "Canonical restore accepts rocks");
    return serialized;
  }
  async function stonePixels(image, ramps) {
    return page.evaluate(
      async ({ encoded, ramps }) => {
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const sample = document.createElement("canvas");
        sample.width = bitmap.width;
        sample.height = bitmap.height;
        const drawing = sample.getContext("2d");
        drawing.drawImage(bitmap, 0, 0);
        bitmap.close();
        const data = drawing.getImageData(0, 0, sample.width, sample.height).data;
        const rgb = (hex) =>
          [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
        return Object.fromEntries(
          Object.entries(ramps).map(([name, colors]) => {
            const targets = colors.map(rgb);
            let count = 0;
            for (let offset = 0; offset < data.length; offset += 4) {
              if (
                targets.some((target) =>
                  target.every((channel, index) => Math.abs(data[offset + index] - channel) <= 3),
                )
              ) {
                count++;
              }
            }
            return [name, count];
          }),
        );
      },
      { encoded: image.toString("base64"), ramps },
    );
  }
  const asteroidCaptures = {};
  async function captureRocks(sector, name) {
    const tint = asteroidArt.backdropTint(rockArt, sector);
    // The ramps sample the canvas alone; the conversation box and notices draw over it.
    const overlays = await page.addStyleTag({
      content: ".ada-conversation,#game-status,#save-status{visibility:hidden !important}",
    });
    const image = await page.locator("canvas").screenshot({ path: `${output}/${name}` });
    await overlays.evaluate((node) => node.remove());
    const ramps = { backdrop: [tint.backdropLit, tint.backdropSide], stone: rockArt.stone };
    const pixels = await stonePixels(image, ramps);
    asteroidCaptures[sector].push({ name, pixels });
    return pixels;
  }
  async function captureGalaxy(sector) {
    const serialized = asteroidFixture(sector);
    save(`asteroid-fixture-${sector}.json`, {
      scope: "Canonical rock layout for Art review of sprites, drift chips and the backdrop field",
      state: JSON.parse(serialized),
    });
    await seedOnce(serialized, `ada-browser.asteroid-fixture-${sector}.v1`);
    await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
    // Rock frames load after the scene starts; placeholders draw until they all arrive.
    await page
      .locator('#game-status[data-asteroids="art"]')
      .waitFor({ state: "attached", timeout: 30000 });
    await page.waitForFunction(
      (key) =>
        JSON.parse(localStorage.getItem(key))?.flight?.objects.some((object) =>
          object.id.startsWith("browser-rock:"),
        ),
      storageKey,
    );
    await page.locator("canvas").waitFor({ state: "visible" });
    asteroidCaptures[sector] = [];
    const first = await captureRocks(sector, `asteroids-galaxy-${sector}.png`);
    assert.ok(first.stone > 2000, `Galaxy ${sector} must draw Art's stone rocks`);
    assert.ok(first.backdrop > 20, `Galaxy ${sector} must draw its tinted backdrop rocks`);
  }
  await captureGalaxy(1);
  // Small and medium rocks turn 4 to 18 degrees a second: 15 degree frames change within seconds.
  await page.waitForTimeout(2000);
  await captureRocks(1, "asteroids-spin-1.png");
  await page.waitForTimeout(2000);
  await captureRocks(1, "asteroids-spin-2.png");
  await captureGalaxy(2);
  await captureGalaxy(3);
  save("asteroid-art-proof.json", {
    scope: "Rendered canonical rock fixtures; screenshot review by Art required",
    captures: asteroidCaptures,
  });
  events.checks.push(
    "Art's rocks draw in neutral stone in every galaxy over a tinted backdrop field, with spin " +
      "captures for review",
  );

  await openSettings();
  const toggles = [];
  async function toggleSetting(key) {
    const label = PROTOTYPE.labels[key];
    assert.equal(typeof label, "string", `Canonical ${key} settings label must exist`);
    const checkbox = page.getByRole("switch", { name: label, exact: true });
    await checkbox.waitFor({ state: "visible" });
    const initial = await checkbox.isChecked();
    await checkbox.setChecked(!initial);
    assert.equal(await checkbox.isChecked(), !initial, `${key} must toggle`);
    toggles.push({ key, initial, toggled: !initial });
  }
  await toggleSetting("moveControls");
  await toggleSetting("aimControls");
  await toggleSetting("sound");
  await toggleSetting("reducedMotion");
  await page.screenshot({ path: `${output}/combat-settings.png` });
  await closeSettings();
  await openSettings();
  async function restoreSetting({ initial, key, toggled }) {
    const checkbox = page.getByRole("switch", { name: PROTOTYPE.labels[key], exact: true });
    assert.equal(await checkbox.isChecked(), toggled, `${key} survives dialog reopening`);
    await checkbox.setChecked(initial);
  }
  await restoreSetting(toggles[0]);
  await restoreSetting(toggles[1]);
  await restoreSetting(toggles[2]);
  await restoreSetting(toggles[3]);
  await closeSettings();
  save("combat-settings-proof.json", {
    scope:
      "Checkbox interaction and dialog-state proof only; audio output and shake intensity unmeasured",
    toggles,
  });
  events.checks.push(
    "Canonical joystick, sound and reduced-motion controls toggle and retain dialog state",
  );
  // One renderer at a time keeps the run inside the container's memory ceiling.
  await context.close();
  const portraitContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await portraitContext.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://ada-preview:4173"
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  await portraitContext.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: safeSerialized,
  });
  page = await portraitContext.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  observe(page);
  assert.equal((await page.goto("http://ada-preview:4173/")).status(), 200);
  await page.locator("body.site").waitFor({ state: "visible" });
  assert.equal(await page.locator("#game-canvas").count(), 0);
  assert.equal(
    await page.locator("body").evaluate((body) => getComputedStyle(body).transform),
    "none",
    "The mobile website must remain upright before entering the landscape game",
  );
  await page.screenshot({ path: `${output}/site-mobile.png` });
  await Promise.all([
    page.waitForURL("**/play/"),
    page.locator('a[href="/play/"]').first().click(),
  ]);
  events.checks.push("Mobile website stays upright and its Play link enters the rotated game");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.locator('[data-control="aim-joystick"]').waitFor({ state: "visible" });
  // Wait for the kit/Phaser viewport synchronization after its first painted frame.
  await page.waitForFunction(() => {
    const transform = getComputedStyle(document.body).transform;
    return transform !== "none" && Math.abs(new DOMMatrixReadOnly(transform).b) > 0.99;
  });
  const portraitFrame = await frameProof(true);
  await page
    .locator("#game-canvas")
    .getByRole("button", { name: PROTOTYPE.labels.talk, exact: true })
    .waitFor({ state: "visible" });
  const portraitWeapon = page.locator('button[data-weapon="basic"]');
  await portraitWeapon.waitFor({ state: "visible" });
  const turnedControls = await page.evaluate(() => {
    const weapon = document.querySelector('button[data-weapon="basic"]').getBoundingClientRect();
    const pause = document.querySelector('[data-action="pause"]').getBoundingClientRect();
    const canvas = document.querySelector("canvas").getBoundingClientRect();
    const inverse = new DOMMatrixReadOnly(getComputedStyle(document.body).transform).inverse();
    const relative = new DOMPoint(
      weapon.x + weapon.width / 2 - pause.x - pause.width / 2,
      weapon.y + weapon.height / 2 - pause.y - pause.height / 2,
      0,
      0,
    ).matrixTransform(inverse);
    return {
      rightOfPause: relative.x,
      rowOffset: relative.y,
      insideCanvas:
        weapon.left >= canvas.left - 1 &&
        weapon.right <= canvas.right + 1 &&
        weapon.top >= canvas.top - 1 &&
        weapon.bottom <= canvas.bottom + 1,
      accessibleName: document
        .querySelector('button[data-weapon="basic"]')
        .getAttribute("aria-label"),
    };
  });
  assert.ok(
    turnedControls.rightOfPause > 0 && Math.abs(turnedControls.rowOffset) < 16,
    "Turned weapon selector must sit right of the pause button on the same landscape row",
  );
  assert.ok(
    turnedControls.insideCanvas,
    "Turned weapon button must remain inside the visible canvas",
  );
  assert.equal(turnedControls.accessibleName, PROTOTYPE.labels.weaponBasic);
  save("portrait-weapon-alignment.json", turnedControls);
  const portraitBefore = await position();
  const portraitBounds = await Promise.all(
    ["move", "aim"].map((side) => page.locator(`[data-control="${side}-joystick"]`).boundingBox()),
  );
  assert.ok(portraitBounds.every((box) => box && box.width > 0 && box.height > 0));
  const portraitOrigins = portraitBounds.map((box, index) => ({
    id: index + 11,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  }));
  const portraitTouch = await portraitContext.newCDPSession(page);
  await portraitTouch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: portraitOrigins,
  });
  let portraitHeld;
  try {
    const { a, b, c, d } = portraitFrame.rotation;
    const deflected = portraitOrigins.map((point, index) => ({
      ...point,
      x: point.x + (index === 0 ? a * 25 : -c * 25),
      y: point.y + (index === 0 ? b * 25 : -d * 25),
    }));
    await portraitTouch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: deflected,
    });
    await page.waitForFunction(
      ({ before, key }) => {
        const flight = JSON.parse(localStorage.getItem(key))?.flight;
        return (
          flight &&
          flight.player.x > before.x &&
          flight.player.y < before.y &&
          flight.shots.some((shot) => !shot.enemy && shot.velocity.x < 0 && shot.velocity.y < 0)
        );
      },
      { before: portraitBefore, key: storageKey },
    );
    portraitHeld = (await readSave()).flight;
    await page.screenshot({ path: `${output}/portrait-touch.png` });
  } finally {
    await portraitTouch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await portraitTouch.detach();
  }
  const portraitRest = await waitForRest(await position());
  await page.waitForFunction(
    (key) => !JSON.parse(localStorage.getItem(key)).flight.shots.some((shot) => !shot.enemy),
    storageKey,
  );
  await page.waitForTimeout(300);
  assert.deepEqual(
    await position(),
    portraitRest,
    "Portrait touch release cancels mapped movement",
  );
  await openSettings();
  await page
    .getByRole("switch", { name: PROTOTYPE.labels.sound, exact: true })
    .waitFor({ state: "visible" });
  await page
    .getByRole("switch", { name: PROTOTYPE.labels.reducedMotion, exact: true })
    .waitFor({ state: "visible" });
  await page.screenshot({ path: `${output}/portrait-settings.png` });
  await closeSettings();
  save("portrait-proof.json", {
    scope:
      "Real mobile context, landscape frame rotation and mapped twin-touch input " +
      "using the canonical safe-destination fixture",
    frame: portraitFrame,
    before: portraitBefore,
    held: portraitHeld,
    released: portraitRest,
  });
  events.checks.push(
    "Portrait mobile context rotates the landscape frame and maps native twin-touch movement/aim/release",
  );
  events.checks.push(
    "Portrait settings and contextual action remain accessible in the turned frame",
  );
  assert.deepEqual(events.errors, [], "No browser runtime or console errors");
  assert.deepEqual(events.failedRequests, [], "No failed asset requests");
  assert.deepEqual(events.badResponses, [], "No failed HTTP responses");
  save("result.json", { passed: true, checks: events.checks });
} catch (error) {
  save("result.json", { passed: false, error: error.stack });
  process.exitCode = 1;
  if (page) {
    try {
      const diagnostics = await page.evaluate(
        (key) => ({
          mode: document.querySelector("#game-status")?.dataset.mode ?? null,
          gameState: JSON.parse(localStorage.getItem(key) ?? "null"),
          targets: [...document.querySelectorAll("[data-control]")].map((target) => {
            const bounds = target.getBoundingClientRect();
            return {
              control: target.getAttribute("data-control"),
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            };
          }),
        }),
        storageKey,
      );
      save("failure-diagnostics.json", diagnostics);
    } catch (diagnosticError) {
      save("failure-diagnostics-error.json", { error: diagnosticError.message });
    }
    try {
      await page.screenshot({ path: `${output}/failure.png`, timeout: 3000 });
    } catch {
      /* The result and Docker logs remain available if rendering failed. */
    }
  }
} finally {
  save("events.json", events);
  if (browser) {
    await browser.close();
  }
  clearTimeout(watchdog);
}
