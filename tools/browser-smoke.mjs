import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { SHIPPED_TITLE_SHIP } from "../src/testing/shippedShipSources.ts";
import {
  asteroidFixture,
  backdropSeed,
  hideOverCanvas,
  logicalSize,
  observe as observeEvents,
  output,
  previewOnly,
  reportViolations,
  reseedFlight,
  save,
  storageKey,
} from "./browser-support.mjs";
import { SMOKE_LIMIT_SECONDS } from "./smoke-limit.mjs";

const events = { errors: [], failedRequests: [], badResponses: [], checks: [] };

const watchdog = setTimeout(() => {
  save("events.json", events);
  save("result.json", {
    passed: false,
    error: `Browser smoke exceeded ${SMOKE_LIMIT_SECONDS} seconds`,
  });
  process.exit(124);
}, SMOKE_LIMIT_SECONDS * 1000);

// The screen wake lock as the game asks for it: held counts the sentinels not yet released.
function fakeWakeLock() {
  const lock = { held: 0, requests: 0 };
  window.adaWakeLock = lock;
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: {
      request: async () => {
        lock.requests += 1;
        lock.held += 1;
        const sentinel = new EventTarget();
        let released = false;
        sentinel.release = async () => {
          if (!released) {
            released = true;
            lock.held -= 1;
            sentinel.dispatchEvent(new Event("release"));
          }
        };
        return sentinel;
      },
    },
  });
}

let browser;
let page;
// An inline control icon's placement in its line, in CSS px: the image loaded, its size, its
// gap after the name's last glyph and its inset in its line box, with its decorative markers.
async function measureInlineIcons(root) {
  const icons = [...root.querySelectorAll(".ada-control-icon")];
  await Promise.all(icons.map((icon) => icon.decode()));
  const lineHeight = parseFloat(getComputedStyle(root).lineHeight);
  const top = root.getBoundingClientRect().top;
  return icons.map((icon) => {
    const box = icon.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(icon.previousSibling);
    const name = range.getBoundingClientRect();
    const style = getComputedStyle(icon);
    return {
      alt: icon.getAttribute("alt"),
      ariaHidden: icon.getAttribute("aria-hidden"),
      control: icon.dataset.control,
      gap: box.left - name.right,
      height: box.height,
      inset: (box.top - top) % lineHeight,
      lineHeight,
      natural: [icon.naturalWidth, icon.naturalHeight],
      opacity: style.opacity,
      rendering: style.imageRendering,
      sameLine: Math.abs(box.top + box.height / 2 - (name.top + name.height / 2)) < 1,
      width: box.width,
      wrap: getComputedStyle(icon.parentElement).whiteSpace,
    };
  });
}

// Each icon as Art places it at scale (CSS px per logical px), on a line of lineHeight logical px.
function assertInlineIcons(icons, controls, scale, lineHeight, where) {
  assert.deepEqual(
    icons.map(({ control }) => control),
    controls,
    `${where}: each named control has its icon`,
  );
  for (const icon of icons) {
    const detail = `${where}: ${JSON.stringify(icon)}`;
    assert.equal(icon.alt, "", `The icon has an empty alt: ${detail}`);
    assert.equal(icon.ariaHidden, "true", `The icon is hidden from screen readers: ${detail}`);
    assert.deepEqual(icon.natural, [16, 16], `The icon loads its 16 by 16 frame: ${detail}`);
    assert.equal(icon.opacity, "1", `The icon is at full opacity: ${detail}`);
    assert.equal(icon.rendering, "pixelated", `The icon scales nearest-neighbour: ${detail}`);
    assert.equal(icon.wrap, "nowrap", `The name and icon wrap as one: ${detail}`);
    assert.ok(icon.sameLine, `The icon is on its name's line: ${detail}`);
    assert.ok(Math.abs(icon.lineHeight - lineHeight * scale) < 0.1, `Line box: ${detail}`);
    assert.ok(Math.abs(icon.width - 16 * scale) < 0.1, `The icon is 16 wide: ${detail}`);
    assert.ok(Math.abs(icon.height - 16 * scale) < 0.1, `The icon is 16 high: ${detail}`);
    assert.ok(Math.abs(icon.gap - 4 * scale) < 0.6, `The icon starts 4 after its name: ${detail}`);
    assert.ok(
      Math.abs(icon.inset - ((lineHeight - 16) / 2) * scale) < 0.1,
      `The icon centres on its line box: ${detail}`,
    );
  }
}

try {
  const require = createRequire("/app/package.json");
  const { chromium } = require("playwright");
  browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--no-sandbox"] });
  let context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    hasTouch: true,
  });
  await context.addInitScript(reportViolations);
  await context.addInitScript(fakeWakeLock);
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  // Settings has no standalone button: in play it opens from the Paused card, which the pause
  // button (a touch control) or Escape opens; elsewhere from the Menu, the three-line disc at
  // the pause button's place.
  const menuDisc = () => page.locator('[data-action="menu"]');
  const menuCard = () => page.locator('[data-dialog="menu"]');
  // The open Menu's actions in order.
  const menuActionIds = () =>
    menuCard()
      .locator(".ada-actions button:not([hidden])")
      .evaluateAll((buttons) => buttons.map((button) => button.dataset.action));
  async function openMenu() {
    await menuDisc().click();
    await menuCard().waitFor({ state: "visible" });
  }
  async function closeMenu() {
    await menuCard().locator('[data-action="menu-close"]').click();
    await menuCard().waitFor({ state: "hidden" });
  }
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
  // Where the open Settings card came from: "menu" or "pause".
  let settingsParent = "pause";
  async function openSettings() {
    settingsParent = (await menuDisc().isVisible()) ? "menu" : "pause";
    if (settingsParent === "menu") {
      await openMenu();
      await menuCard().locator('[data-action="menu-settings"]').click();
    } else {
      await openPause();
      await page.locator('[data-action="pause-settings"]').click();
    }
    await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
  }
  // Settings opened in play closes back to the Paused card, and from the Menu back to the Menu;
  // Resume or Close returns to the view beneath.
  async function resumeIfPaused() {
    const resume = page.locator('[data-action="pause-resume"]');
    if (await resume.isVisible()) {
      await resume.click();
    }
  }
  async function closeSettings() {
    await page.locator('[data-action="close-settings"]').click();
    if (settingsParent === "menu") {
      await menuCard().waitFor({ state: "visible" });
      await closeMenu();
    } else {
      await resumeIfPaused();
    }
  }
  const observe = (observed) => observeEvents(events, observed);
  observe(page);
  await context.route("**/*", previewOnly);
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
  // The preview serves dist/_headers as Cloudflare does: each page's CSP, styles from its own
  // origin only, with optional platform analytics permitted only on the landing page,
  // and the wake lock allowed.
  const pageHeaders = await Promise.all(
    ["/", "/play/"].map(async (pagePath) => [
      pagePath,
      (await page.request.get(`http://ada-preview:4173${pagePath}`)).headers(),
    ]),
  );
  for (const [pagePath, headers] of pageHeaders) {
    const landing = pagePath === "/";
    const policy = headers["content-security-policy"] ?? "";
    const directives = Object.fromEntries(
      policy.split("; ").map((directive) => {
        const [name, ...sources] = directive.split(" ");
        return [name, sources];
      }),
    );
    assert.deepEqual(directives["style-src"], ["'self'"], `${pagePath} styles from its origin`);
    assert.deepEqual(
      directives["script-src"],
      ["'self'", ...(landing ? ["https://static.cloudflareinsights.com"] : [])],
      `${pagePath} scripts follow its page-specific analytics scope`,
    );
    assert.deepEqual(
      directives["connect-src"],
      ["'self'", ...(landing ? ["https://cloudflareinsights.com"] : [])],
      `${pagePath} connections follow its page-specific analytics scope`,
    );
    // No other origin anywhere in the policy.
    assert.deepEqual(
      Object.values(directives)
        .flat()
        .filter((source) => /^https?:/.test(source))
        .sort(),
      landing ? ["https://cloudflareinsights.com", "https://static.cloudflareinsights.com"] : [],
      `${pagePath} permits no external origins except landing-page analytics`,
    );
    assert.doesNotMatch(policy, /unsafe-inline/, `${pagePath} allows no inline code`);
    assert.match(headers["permissions-policy"] ?? "", /screen-wake-lock=\(self\)/);
    assert.equal(headers["x-content-type-options"], "nosniff");
  }
  events.checks.push("Both pages carry the build's CSP and permissions policy");
  assert.equal(await page.locator("#game-canvas").count(), 0, "Landing must not bootstrap Phaser");
  const landingIcons = await iconLinks();
  const manifestResponse = await page.request.get("http://ada-preview:4173/manifest.webmanifest");
  assert.equal(manifestResponse.status(), 200);
  assert.ok(manifestResponse.headers()["content-type"].startsWith("application/manifest+json"));
  const manifest = await manifestResponse.json();
  assert.equal(
    manifest.description,
    await page.locator('meta[name="description"]').getAttribute("content"),
    "The manifest describes the game as the landing page does",
  );
  assert.doesNotMatch(JSON.stringify(manifest), /%HOME_/);
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
  await page.locator("#game-canvas > canvas").waitFor({ state: "visible" });
  assert.ok(
    await page
      .locator("#game-canvas > canvas")
      .evaluate((canvas) => canvas.width > 0 && canvas.height > 0),
  );
  events.checks.push("Real renderer and accessible home status");
  // Use is Chibi's touch disc, drawn on the canvas: its accessible button takes no pointer input,
  // so a thumb taps the canvas at the disc's centre, where the press circle takes it.
  // Earth on the galaxy map: its marker selects it, and the single destination action reads Jump to
  // Earth in flight or Stay on Earth at boarding (gameplay/player-copy.md); pressing it goes home.
  async function chooseEarth(map, label) {
    await map.locator(".ada-route-marker[data-earth]").click();
    const action = map.locator('[data-action="galaxy-jump"]');
    await page.waitForFunction(
      ({ text }) =>
        document
          .querySelector('.ada-route[data-dialog="galaxies"] [data-action="galaxy-jump"]')
          ?.textContent?.trim() === text,
      { text: label },
    );
    await action.click();
  }
  // A key press switches flight to the desktop controls, which hide the sticks and the Use disc; a
  // touch on the game surface switches back (src/input/desktop.ts). The spot is clear of the HUD,
  // the notice slot and the ship.
  async function touchSurface() {
    const canvas = await page.locator("#game-canvas > canvas").boundingBox();
    assert.ok(canvas, "The game surface has a box");
    await page.touchscreen.tap(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.55);
  }
  // Talk opens the Interaction card (src/ui/conversation.ts) in its own modal, Skip and the close X
  // in its frame. Skip goes to its outcome, which ends the exchange where Continue is its only
  // choice; otherwise Continue is taken there.
  const interactionCard = () => page.locator(".ada-interaction-modal");
  // The Interaction card's HUD row (art/layout.md "Storybook page"): the close X in the Settings
  // slot and Skip beside it. Their press areas do not overlap, and a press at each one's centre
  // reaches it. Saves the card as name.
  async function interactionHudProof(name) {
    const row = await interactionCard().evaluate((modal) => {
      const app = document.querySelector("#app");
      const unit = Number(getComputedStyle(app).getPropertyValue("--ada-unit"));
      const origin = app.getBoundingClientRect();
      const box = (node) => {
        const rect = node.getBoundingClientRect();
        return [rect.left, rect.right, rect.top, rect.bottom].map(
          (value, index) =>
            Math.round(((value - (index < 2 ? origin.left : origin.top)) / unit) * 10) / 10,
        );
      };
      const hits = (node) => {
        const rect = node.getBoundingClientRect();
        const at = (x, y) => document.elementFromPoint(x, y)?.closest("button") === node;
        return [
          at(rect.left + rect.width / 2, rect.top + rect.height / 2),
          at(rect.left + 1, rect.top + rect.height / 2),
          at(rect.right - 1, rect.top + rect.height / 2),
        ];
      };
      const skip = modal.querySelector('[data-action="dialogue-skip"]');
      const close = modal.querySelector('[data-action="conversation-close"]');
      // The inputs the HUD rect comes from, as the view-scale bridge set them.
      const property = (element, name) => getComputedStyle(element).getPropertyValue(name).trim();
      const canvas = document.querySelector("#game-canvas > canvas").getBoundingClientRect();
      const inputs = {
        app: [origin.width, origin.height],
        canvas: [canvas.width, canvas.height],
        devicePixelRatio: window.devicePixelRatio,
        inner: [window.innerWidth, window.innerHeight],
        insets: Object.fromEntries(
          ["top", "right", "bottom", "left"].map((side) => [
            side,
            [
              property(document.documentElement, `--inset-${side}`),
              property(app, `--ada-safe-${side}`),
            ],
          ]),
        ),
        properties: Object.fromEntries(
          ["--ada-area-left", "--ada-hud-left", "--ada-hud-right", "--ada-hud-top"].map((name) => [
            name,
            property(app, name),
          ]),
        ),
        unit,
      };
      return {
        close: box(close),
        closeHits: hits(close),
        inputs,
        skip: box(skip),
        skipHits: hits(skip),
      };
    });
    await page.screenshot({ path: `${output}/${name}.png` });
    assert.ok(
      row.skip[1] <= row.close[0] && row.skipHits.every(Boolean) && row.closeHits.every(Boolean),
      `${name}: Skip and the close X do not overlap and each takes its own press: ${JSON.stringify(row)}`,
    );
    return row;
  }
  // Skip ends the exchange, or reaches its last page, which Continue closes. Either can take a
  // while under load, so this waits for one or the other rather than for a fixed time.
  async function leaveInteraction() {
    await interactionCard().locator('[data-action="dialogue-skip"]').click();
    const continueButton = interactionCard().getByRole("button", {
      name: CONTENT.labels.continue,
      exact: true,
    });
    // Each wait settles either way, so the one that loses the race cannot reject unhandled.
    const settles = (wait) =>
      wait.then(
        () => true,
        () => false,
      );
    await Promise.race([
      settles(interactionCard().waitFor({ state: "hidden" })),
      settles(continueButton.waitFor({ state: "visible" })),
    ]);
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }
    await interactionCard().waitFor({ state: "hidden" });
  }
  async function tapUse(name) {
    const use = page.getByRole("button", { name, exact: true });
    await use.waitFor({ state: "visible" });
    const box = await use.boundingBox();
    assert.ok(box, `${name}: the Use disc has a frame`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }
  async function contextControlProof(expected, phase) {
    // The disc shows or hides on the scene's next frame, as the sticks do.
    await page
      .waitForFunction(
        (count) =>
          [...document.querySelectorAll(".ada-use")].filter((use) => !use.hidden).length === count,
        expected,
        { timeout: 5000 },
      )
      .catch(() => undefined);
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
    const frame = await page.locator("#game-canvas > canvas").evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      const style = getComputedStyle(document.body);
      const matrix = new DOMMatrixReadOnly(
        style.transform === "none" ? undefined : style.transform,
      );
      return {
        intrinsic: { width: canvas.width, height: canvas.height },
        layout: { width: canvas.offsetWidth, height: canvas.offsetHeight },
        renderScale: Math.min(devicePixelRatio, 2),
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        body: { width: document.body.clientWidth, height: document.body.clientHeight },
        rotation: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d },
        imageRendering: getComputedStyle(canvas).imageRendering,
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    assert.ok(
      Math.abs(frame.intrinsic.width - Math.round(frame.layout.width * frame.renderScale)) <= 1 &&
        Math.abs(frame.intrinsic.height - Math.round(frame.layout.height * frame.renderScale)) <= 1,
      "The canvas backing must be its CSS size times min(devicePixelRatio, 2)",
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
  events.checks.push("Desktop canvas backs its CSS size at min(devicePixelRatio, 2), pixelated");

  const [
    { GameModel },
    { CONTENT },
    { ensureDestination, routeBlocked },
    { playOpening, relaunch },
    { SAVE_VERSION, restoreSave: restoreCalm },
    { ACHIEVEMENTS },
  ] = await Promise.all([
    import(new URL("../src/model/game.ts", import.meta.url)),
    import(new URL("../src/data/content.ts", import.meta.url)),
    import(new URL("../src/model/flight.ts", import.meta.url)),
    import(new URL("../src/testing/launch.ts", import.meta.url)),
    import(new URL("../src/model/save.ts", import.meta.url)),
    import(new URL("../src/data/achievements.ts", import.meta.url)),
  ]);
  // The storybook panel is .ada-story-panel:not(.ada-dialogue-panel): the conversation and station
  // cards share its class inside their own modals, which stay hidden rather than the panel.
  // Reads storybook pages (the default choice, else Next or its named action) until galaxy
  // selection opens or flight begins, and returns each page's background, its image and text,
  // and, just after its press, the transition frame fading in and whether the panel hid.
  const storyShots = new Set();
  async function readStory(remaining = 60, pages = []) {
    await page.waitForFunction(
      () =>
        document.querySelector("#game-status")?.dataset.mode === "space" ||
        document.querySelector(
          '.ada-story-panel:not(.ada-dialogue-panel):not([hidden]) [data-action="story-next"]',
        ) ||
        document.querySelector('.ada-route[data-dialog="galaxies"]:not([hidden])'),
    );
    const panel = page.locator(".ada-story-panel:not(.ada-dialogue-panel):not([hidden])");
    if (!(await panel.count())) {
      return pages;
    }
    assert.ok(remaining > 0, "Storybook pages must reach galaxy selection");
    // The art loads once, after the manifest: Art's background image, or on an aboard page the
    // title screen's ship (.ada-story-ship) over the last-played galaxy's backdrop, with no image.
    await page.waitForFunction(
      () =>
        document.querySelector(".ada-story-art")?.style.backgroundImage ||
        document.querySelector(".ada-story-ship:not([hidden])")?.childElementCount,
    );
    pages.push({
      // Whether the title screen's ship draws, as on an ordinary aboard page.
      aboardShip: await page.evaluate(() =>
        Boolean(document.querySelector(".ada-story-ship:not([hidden])")?.childElementCount),
      ),
      art: await page
        .locator(".ada-story-art")
        .first()
        .evaluate((art) => art.style.backgroundImage),
      background: await page.locator(".ada-story-background").getAttribute("data-background"),
      speaker: await panel.evaluate(
        (node) => node.querySelector(".ada-story-tab:not([hidden])")?.textContent ?? "",
      ),
      text: (await panel.locator(".ada-story-paragraph").textContent()) ?? "",
      // The spread: its top and the canvas top in logical px, and whether the text column scrolls.
      spread: await panel.evaluate((node) => {
        const unit = Number(
          getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
        );
        const view = document.querySelector(".ada-story-background").getBoundingClientRect();
        const round = (value) => Math.round((value / unit) * 100) / 100;
        return {
          artTop: round(
            document.querySelector(".ada-story-art").getBoundingClientRect().top - view.top,
          ),
          heading: node.querySelector(".ada-story-heading:not([hidden])")?.textContent ?? "",
          scrolls: node.querySelector(".ada-story-copy").classList.contains("ada-story-scrolls"),
          choicesScroll: node
            .querySelector(".ada-story-choices")
            .classList.contains("ada-story-scrolls"),
          // The choice column never overflows its panel: every choice and page control shows.
          clipped: [...node.querySelector(".ada-story-choice-column").querySelectorAll("button")]
            .filter((button) => button.offsetParent !== null)
            .some(
              (button) =>
                button.getBoundingClientRect().bottom > node.getBoundingClientRect().bottom + 0.5,
            ),
          top: round(node.getBoundingClientRect().top - view.top),
        };
      }),
      portrait: await panel.evaluate((node) => {
        const frame = node.querySelector(".ada-story-frame");
        if (!frame || frame.hidden) {
          return null;
        }
        const unit = Number(
          getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
        );
        const box = frame.getBoundingClientRect();
        const card = node.querySelector(".ada-story-copy").getBoundingClientRect();
        const round = (value) => Math.round((value / unit) * 10) / 10;
        const face = frame.querySelector(".ada-story-portrait");
        return {
          frame: Number(face.dataset.frame),
          image: getComputedStyle(face).backgroundImage,
          left: round(box.left - card.left),
          right: round(card.right - box.right),
          side: node.querySelector(".ada-story-text").dataset.side,
          size: round(box.width),
          speaker: face.dataset.speaker,
        };
      }),
    });
    // The first page aboard where Astra speaks, with her portrait's loop: the aboard capture.
    const current = pages.at(-1);
    const shot =
      current.speaker === "Astra" && current.background === "aboard" ? "story-astra-aboard" : null;
    if (shot && !storyShots.has(shot)) {
      storyShots.add(shot);
      await page.screenshot({ path: `${output}/${shot}.png` });
      await page.waitForFunction(
        (frame) =>
          Number(
            document.querySelector(
              ".ada-story-panel:not(.ada-dialogue-panel):not([hidden]) .ada-story-portrait",
            )?.dataset.frame,
          ) !== frame,
        current.portrait?.frame,
      );
      current.looped = true;
    }
    const choice = panel.locator('[data-action="story-choice"]');
    const press = (await choice.count())
      ? choice.first()
      : panel.locator('[data-action="story-next"]');
    await press.waitFor({ state: "visible" });
    pages.at(-1).after = await press.evaluate((button) => {
      button.click();
      return {
        incoming: document.querySelectorAll(".ada-story-art")[1]?.style.backgroundImage ?? "",
        panelHidden:
          document.querySelector(".ada-story-panel:not(.ada-dialogue-panel)")?.hidden ?? false,
      };
    });
    return readStory(remaining - 1, pages);
  }
  // Resolved on the current page, which each fixture replaces.
  const selector = () => page.locator('[data-dialog="galaxies"]');
  // The start screen's Menu opens Achievements on page one, every entry locked in a new game, and
  // closing it returns to the Menu.
  async function achievementsPage() {
    const card = page.locator('[data-dialog="achievements"]');
    await card.waitFor({ state: "visible" });
    return {
      count: (await card.locator(".ada-achievement-pager > p").textContent())?.trim(),
      entries: await card
        .locator(".ada-achievement")
        .evaluateAll((nodes) =>
          nodes.map((node) => [
            node.querySelector(".ada-achievement-name")?.textContent,
            node.getAttribute("data-unlocked"),
          ]),
        ),
    };
  }
  assert.deepEqual(
    await page
      .locator(".ada-start button")
      .evaluateAll((buttons) => buttons.map((button) => button.dataset.action)),
    ["start"],
    "The start screen holds only Start before the first flight",
  );
  await assertNoTapFlash(
    ['[data-action="menu"]', '.ada-start-actions > [data-action="start"]'],
    "The start screen",
  );
  // The start screen's one navigation entry is the three-line Menu at the pause button's place
  // (rules.md "Start, Home and Space"), drawn from the pause pose with its bars replaced; Settings,
  // Achievements and Exit have no standalone disc.
  assert.deepEqual(
    await Promise.all(
      ["achievements", "settings", "exit"].map((action) =>
        page.locator(`[data-action="${action}"]`).isVisible(),
      ),
    ),
    [false, false, false],
    "The start screen shows no standalone Achievements, Settings or Exit disc",
  );
  assert.deepEqual(
    [
      await menuDisc().getAttribute("aria-label"),
      await menuDisc().getAttribute("data-navigation"),
      await menuDisc().evaluate((button) =>
        getComputedStyle(button, "::before").backgroundImage.startsWith('url("data:image/svg+xml'),
      ),
    ],
    ["Menu", "menu", true],
    "The start screen's entry is the three-line Menu",
  );
  const startMenuBox = await menuDisc().boundingBox();
  assert.ok(startMenuBox, "The start screen's Menu has a box");
  // The start Menu holds Achievements, Settings and a Chromium tab's Exit, then primary Close,
  // each labelled from Gameplay's strings.
  await openMenu();
  assert.deepEqual(
    await menuActionIds(),
    ["menu-achievements", "menu-settings", "menu-exit", "menu-close"],
    "The start screen's Menu holds Achievements, Settings, Exit, then Close",
  );
  assert.deepEqual(
    await menuCard()
      .locator(".ada-actions button:not([hidden])")
      .evaluateAll((buttons) => buttons.map((button) => button.textContent?.trim())),
    [
      CONTENT.labels.achievements,
      CONTENT.labels.settings,
      CONTENT.labels.exit,
      CONTENT.labels.close,
    ],
    "The start screen's Menu actions read Gameplay's strings",
  );
  await menuCard().locator('[data-action="menu-achievements"]').click();
  const firstAchievements = await achievementsPage();
  assert.equal(firstAchievements.count, "1/3", "The 14 achievements page six at a time");
  assert.deepEqual(
    firstAchievements.entries.map(([name]) => name),
    ACHIEVEMENTS.slice(0, 6).map(({ name }) => name),
    "Achievements list in Gameplay's order",
  );
  assert.ok(
    firstAchievements.entries.every(([, unlocked]) => unlocked === "false"),
    "A new game has no achievement unlocked",
  );
  await page.screenshot({ path: `${output}/achievements-start.png` });
  // An open modal draws above the top-row buttons: the topmost element at each button's centre
  // belongs to the modal.
  async function modalCovers(inside, boxes) {
    return page.evaluate(
      ({ centres, inside }) => {
        const modal = document.querySelector(inside)?.closest(".ada-modal");
        return centres.map(([x, y]) => Boolean(modal?.contains(document.elementFromPoint(x, y))));
      },
      {
        centres: boxes.map((box) => [box.x + box.width / 2, box.y + box.height / 2]),
        inside,
      },
    );
  }
  assert.deepEqual(
    await modalCovers('[data-dialog="achievements"]', [startMenuBox]),
    [true],
    "The open Achievements modal draws above the Menu disc",
  );
  await page.locator('[data-action="achievements-next"]').click();
  assert.equal((await achievementsPage()).count, "2/3");
  await page.locator('[data-action="close-achievements"]').click();
  await page.locator('[data-dialog="achievements"]').waitFor({ state: "hidden" });
  await menuCard().waitFor({ state: "visible" });
  await menuCard().locator('[data-action="menu-settings"]').click();
  await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
  assert.deepEqual(
    await modalCovers('[data-action="close-settings"]', [startMenuBox]),
    [true],
    "The open Settings modal draws above the Menu disc",
  );
  // The build line: the card's last text, right after the rows' layout-tree arrangement
  // (.ada-settings-rows), naming package.json's version and the gated revision, read with the
  // card and never focused.
  const { version } = JSON.parse(readFileSync("/source/package.json", "utf8"));
  const commit = process.env.CHECK_REVISION?.slice(0, 8) ?? "dev";
  const buildLine = await page.locator(".ada-build").evaluate((line) => ({
    afterRows: line.previousElementSibling?.classList.contains("ada-settings-rows") ?? false,
    color: getComputedStyle(line).color,
    hidden: line.closest("[aria-hidden='true']") !== null,
    inCard: line.closest(".ada-card") !== null,
    tag: line.tagName,
    tabIndex: line.tabIndex,
    text: line.textContent,
    visible: line.getBoundingClientRect().height > 0,
  }));
  assert.deepEqual(
    buildLine,
    {
      afterRows: true,
      color: "rgb(184, 179, 201)",
      hidden: false,
      inCard: true,
      tag: "P",
      tabIndex: -1,
      text: `v${version} · ${commit}`,
      visible: true,
    },
    "Settings shows this build's version and commit after its rows",
  );
  events.checks.push(`Settings shows the build label v${version} · ${commit}`);
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-action="close-settings"]').waitFor({ state: "hidden" });
  // Closing Settings returns to the Menu; its Close returns to the start screen.
  await menuCard().waitFor({ state: "visible" });
  await closeMenu();
  await page.locator('[data-action="start"]').waitFor({ state: "visible" });
  // A first launch: Start, galaxy one's opening, the prologue in Ada's room and aboard, then
  // galaxy selection on galaxy one.
  assert.equal(
    await page.evaluate(() => window.adaWakeLock.held),
    0,
    "The start screen lets the screen sleep",
  );
  await page.locator('[data-action="start"]').click();
  await page
    .locator(".ada-story-panel:not(.ada-dialogue-panel):not([hidden])")
    .waitFor({ state: "visible" });
  await page.waitForFunction(() => window.adaWakeLock.held === 1);
  await page.screenshot({ path: `${output}/story-opening.png` });
  const launchPages = await readStory();
  const { gardenArrival, gardenFarewell, prologue: prologueSteps } = CONTENT.premise;
  // Grandma's garden frames chapter one's opening on the first launch.
  const openingAt = gardenArrival.length;
  assert.deepEqual(
    launchPages.slice(0, openingAt + 3).map(({ background, text }) => [background, text]),
    [
      ...gardenArrival.map(({ text }) => text),
      CONTENT.chapters[1].opening,
      CONTENT.chapters[1].openingBranches[0],
      gardenFarewell.text,
    ].map((text) => ["grandmaGarden", text]),
    "Start opens in Grandma's garden, then chapter one's opening, its branch and her farewell",
  );
  // The prologue begins in the park, then Ada polishes the rock and it glows in her room.
  const prologueAt = openingAt + 3;
  const earthSteps = prologueSteps.filter(
    ({ background }) => background && background !== "aboard",
  );
  assert.deepEqual(
    launchPages
      .slice(prologueAt, prologueAt + earthSteps.length)
      .map(({ background, text }) => [background, text]),
    earthSteps.map(({ background, text }) => [background, text]),
    "The prologue's Earth pages: the park, the unpolished room, the glowing room",
  );
  // The rest plays aboard, Ada's ship from outside, standing and seated alike.
  const aboardAt = prologueAt + earthSteps.length;
  assert.deepEqual(
    [...new Set(launchPages.slice(aboardAt).map(({ background }) => background))],
    ["aboard"],
    "Every prologue page from Ada's arrival shows aboard",
  );
  // Every Earth page shows its location's image from Art's manifest; an ordinary aboard page
  // draws the title screen's ship over the last-played galaxy's backdrop instead, with no image.
  // Only the glowing room's press aboard plays the rock glow, hiding the panel as its first frame
  // fades in.
  const { BACKGROUND_ART } = await import(new URL("../src/data/storybook.ts", import.meta.url));
  const artManifest = await (
    await page.request.get("http://ada-preview:4173/art/manifest.json")
  ).json();
  const artUrl = (id) => `url("${artManifest.assets.find((entry) => entry.id === id)?.path}")`;
  for (const { aboardShip, art, background } of launchPages) {
    assert.deepEqual(
      [aboardShip, art],
      background === "aboard" ? [true, ""] : [false, artUrl(BACKGROUND_ART[background])],
      `${background} shows its art`,
    );
  }
  const glow = launchPages.findIndex(
    ({ background }, index) =>
      background === "adaRoom" && launchPages[index + 1]?.background === "aboard",
  );
  assert.ok(glow >= 0, "The prologue leaves Ada's room for aboard");
  assert.deepEqual(launchPages[glow].after, {
    incoming: artUrl("story-ada-room-glow-1"),
    panelHidden: true,
  });
  assert.deepEqual(
    launchPages.filter((_, index) => index !== glow).map(({ after }) => after.incoming),
    launchPages.slice(1).map(() => ""),
    "Every other page change cuts",
  );
  assert.ok(
    launchPages.some(({ background, speaker }) => speaker === "Astra" && background === "aboard"),
    "Astra speaks aboard in the prologue",
  );
  // Each dialogue page shows its speaker's 32 portrait in the 68 frame: Ada at the inner left,
  // Astra and Grandma at the inner right; narration and a speaker Art has not drawn show none.
  const sheets = { Ada: "ada", Astra: "astra", Grandma: "grandma" };
  for (const { background, portrait, speaker, text } of launchPages) {
    const sheet = sheets[speaker];
    if (!sheet) {
      assert.equal(portrait, null, `No portrait on "${text}"`);
      continue;
    }
    assert.equal(portrait?.speaker, sheet, `${speaker}'s portrait on "${text}"`);
    assert.equal(portrait.size, 68, `${speaker}'s 68 frame on ${background}`);
    assert.match(portrait.image, new RegExp(`/art/portraits/${sheet}\\.png`, "u"));
    assert.equal(portrait.side, sheet === "ada" ? "left" : "right", `${speaker}'s side`);
  }
  assert.ok(
    launchPages.some(({ portrait }) => portrait?.speaker === "grandma"),
    "Grandma speaks with her portrait in her garden",
  );
  const adaPage = launchPages.find(({ portrait }) => portrait?.speaker === "ada");
  const astraPages = launchPages.filter(({ portrait }) => portrait?.speaker === "astra");
  assert.ok(adaPage && astraPages.length, "Ada and Astra both speak with portraits");
  assert.ok(
    Math.abs(adaPage.portrait.left) < 0.2 &&
      astraPages.every(({ portrait }) => Math.abs(portrait.right) < 0.2),
    "Ada's frame sits on the text column's left edge and Astra's on its right",
  );
  assert.deepEqual([...storyShots], ["story-astra-aboard"], "Astra speaks aboard");
  assert.ok(
    launchPages.filter(({ looped }) => looped).length === 1,
    "Astra's portrait loop runs on her page aboard",
  );
  // The light spread: no page scrolls or rises past the top cap, and each background keeps one
  // placement through the run.
  for (const { spread, text } of launchPages) {
    assert.ok(
      !spread.scrolls && !spread.choicesScroll && !spread.clipped && spread.top >= 60.5 - 0.01,
      `"${text}" fits: ${JSON.stringify(spread)}`,
    );
  }
  // Every page of chapter one's opening scene, its first-launch garden arrival and farewell among
  // them, carries the chapter's panel title; the prologue's pages after it carry none.
  assert.deepEqual(
    launchPages.map(({ spread }) => spread.heading),
    launchPages.map((_, index) => (index < openingAt + 3 ? CONTENT.chapters[1].name : "")),
    "Chapter one's opening scene carries its panel title on every page, the prologue none",
  );
  for (const background of new Set(launchPages.map(({ background }) => background))) {
    const tops = new Set(
      launchPages
        .filter((entry) => entry.background === background)
        .map(({ spread }) => spread.artTop),
    );
    assert.equal(tops.size, 1, `${background} keeps one placement through the run: ${[...tops]}`);
  }
  events.checks.push(
    "Story pages lay out as the light spread: every launch page fits under the top cap without " +
      "scrolling, the opening scene carries the chapter heading, and each background keeps one " +
      "placement through the run",
  );
  events.checks.push(
    "Story pages show the speaker's 32 portrait in the 68 frame, Ada left and Astra right, " +
      "Astra's portrait loop running aboard",
  );
  events.checks.push(
    "Storybook pages show Art's backgrounds and the glowing room plays the rock glow aboard",
  );
  // Each optional question's answer returns to the list until Continue.
  for (const { answer } of CONTENT.premise.prologue.find(({ questions }) => questions).questions) {
    assert.ok(
      launchPages.some(({ text }) => text === answer),
      `The prologue answers "${answer}"`,
    );
  }
  await selector().waitFor({ state: "visible" });
  // The route map draws over the route sky, Ada and Penny watching it from the ground.
  assert.equal(
    await selector()
      .locator(".ada-route-sky")
      .evaluate((sky) => sky.style.backgroundImage),
    'url("/art/route-sky.png")',
    "Galaxy selection is the route map over the route sky",
  );
  assert.equal(await selector().locator(".ada-route-figure").count(), 2);
  // Six galaxy markers and the Earth marker, a route marker carrying data-earth.
  assert.equal(await selector().locator(".ada-route-marker:not([data-earth])").count(), 6);
  assert.equal(await selector().locator(".ada-route-marker[data-earth]").count(), 1);
  // Galaxy one is unlocked, so its preview is the tinted capture; it must be served.
  const preview = await selector()
    .locator(".ada-galaxy-shot")
    .evaluate((shot) => shot.style.backgroundImage);
  assert.equal(preview, 'url("/previews/galaxy-sunflower.png")');
  const previewResponse = await page.request.get(
    "http://ada-preview:4173/previews/galaxy-sunflower.png",
  );
  assert.equal(previewResponse.status(), 200, "Galaxy previews must be served");
  assert.equal(
    (await selector().locator("h2").textContent())?.trim(),
    CONTENT.labels.galaxyNumber.replace("{number}", "1"),
  );
  await page.screenshot({ path: `${output}/galaxy-select.png` });
  await page.locator('[data-action="galaxy-jump"]').click();
  events.checks.push(
    "Start plays galaxy one's opening and the prologue as storybook pages, then galaxy " +
      "selection's Jump begins the flight",
  );
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  // The first flight opens on Astra's move lesson in the conversation box: her compact sheet on
  // the right, its speaking loop running, and her teal tab.
  const astraBox = page.locator('.ada-conversation[data-speaker="astra"]:not([hidden])');
  await astraBox.waitFor({ state: "visible" });
  const astraFace = astraBox.locator(".ada-conversation-portrait");
  const firstFrame = await astraFace.getAttribute("data-frame");
  await page.waitForFunction(
    (frame) =>
      document.querySelector('.ada-conversation[data-speaker="astra"] .ada-conversation-portrait')
        ?.dataset.frame !== frame,
    firstFrame,
  );
  const astraLine = await astraBox.evaluate((box) => ({
    image: getComputedStyle(box.querySelector(".ada-conversation-portrait")).backgroundImage,
    side: box.dataset.side,
    tab: getComputedStyle(box.querySelector(".ada-conversation-name")).backgroundColor,
  }));
  await page.screenshot({ path: `${output}/conversation-astra.png` });
  // On touch the move lesson names the left stick, then shows its icon inline, hidden from screen
  // readers, which read the words alone.
  const lessonLine = astraBox.locator(".ada-conversation-line");
  assert.equal(await lessonLine.textContent(), "Fly with the left stick.", "Lesson words");
  const lessonScale = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById("app")).getPropertyValue("--ada-unit")),
  );
  assertInlineIcons(
    await lessonLine.evaluate(measureInlineIcons),
    ["move"],
    lessonScale,
    20,
    "The move lesson",
  );
  await astraBox.screenshot({ path: `${output}/lesson-move-icon.png` });
  events.checks.push("The touch move lesson shows the left stick's icon 4 after its name");
  assert.match(astraLine.image, /\/art\/portraits\/astra-compact\.png/u, "Astra's compact sheet");
  assert.equal(astraLine.side, "right", "Astra's portrait sits at the box's right");
  assert.equal(astraLine.tab, "rgb(143, 224, 242)", "Astra's tab is teal #8fe0f2");
  events.checks.push(
    "Astra's in-flight line shows her compact portrait at the right, looping, with her teal tab",
  );
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
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(({ x, y }) => {
      const status = document.querySelector("#game-status");
      return Number(status.dataset.x) !== x || Number(status.dataset.y) !== y;
    }, before);
  } finally {
    await page.keyboard.up("w");
  }
  events.checks.push("Keyboard input changes actual flight coordinates");
  await waitForRest(await position());
  await page.screenshot({ path: `${output}/desktop.png` });

  await page.keyboard.down("w");
  try {
    await openSettings();
    await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
    const paused = await position();
    await page.waitForTimeout(250);
    assert.deepEqual(await position(), paused, "Settings must pause movement");
    await closeSettings();
    await waitForRest(await position());
  } finally {
    await page.keyboard.up("w");
  }
  events.checks.push("Settings pause movement and clear held input on resume");
  // The first flight after a real prologue has New Navigator unlocked, and only it.
  const prologueSaved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    storageKey,
  );
  assert.deepEqual(
    prologueSaved.achievements.unlocked,
    [ACHIEVEMENTS[0].id],
    "Only New Navigator is unlocked after the prologue",
  );
  // Achievements is on the start screen only: the Paused card has none.
  await openPause();
  assert.equal(
    await page.locator('[data-dialog="pause"] [data-action="pause-achievements"]').count(),
    0,
    "The Paused card has no Achievements",
  );
  await page.waitForFunction(() => window.adaWakeLock.held === 0);
  await page.locator('[data-action="pause-resume"]').click();
  await page.waitForFunction(() => window.adaWakeLock.held === 1);
  events.checks.push("Play holds the screen wake lock; the start screen and Paused card let it go");

  // No touch flash: every interactive element's tap highlight is transparent, inherited from the
  // page root, so a press shows only the element's own pressed state.
  async function assertNoTapFlash(selectors, where) {
    const colours = await page.evaluate(
      (list) =>
        list.map((selector) => {
          const node = document.querySelector(selector);
          return node
            ? getComputedStyle(node).getPropertyValue("-webkit-tap-highlight-color")
            : null;
        }),
      selectors,
    );
    selectors.forEach((selector, index) =>
      assert.equal(colours[index], "rgba(0, 0, 0, 0)", `${where}: ${selector} draws no tap flash`),
    );
  }
  // Every launch opens on the start screen; Continue resumes a mid-flight save in flight.
  async function continueFlight() {
    await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
    await page.locator('.ada-start-actions > [data-action="continue"]').click();
    await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  }
  // A flight control's box once the flight layout has settled: the mode flips to space before
  // the controls lay out after Continue, so this waits, bounded, for a non-zero box first.
  async function settledBox(selector, timeout = 10000) {
    try {
      await page.waitForFunction(
        (target) => {
          const rect = document.querySelector(target)?.getBoundingClientRect();
          return rect !== undefined && rect.width > 0 && rect.height > 0;
        },
        selector,
        { timeout },
      );
    } catch {
      assert.fail(`${selector} has no laid-out box ${timeout} ms after Continue`);
    }
    return page.locator(selector).boundingBox();
  }
  // Holds the aim stick deflected exactly screen-right through a native touch, so Ada's guns aim
  // and fire along it; the returned function lifts the touch. Desktop keys thrust and turn the
  // ship instead (src/input/desktop.ts), and Space is also Use.
  async function holdAimRight() {
    const box = await settledBox('[data-control="aim-joystick"]');
    const session = await page.context().newCDPSession(page);
    const origin = {
      force: 1,
      id: 1,
      radiusX: 8,
      radiusY: 8,
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [origin] });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...origin, x: origin.x + 25 }],
    });
    return async () => {
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await session.detach();
    };
  }
  // The touch HUD's bottom controls, in logical px: each joystick ring's drawn outer side and
  // bottom (the rings draw 1 inside their 75 frame targets) 50 in from the screen's sides and 50
  // above its bottom, the aim ring's from the view's whole-pixel width, unless that would leave less
  // than the stick area margin (8) to the game area's edge, where the ring moves in to it; and the
  // shield pill on its own bottom line, its drawn bottom margin mirroring the status pill's drawn
  // top margin. The smoke's pages have no safe insets. Saves the proof, with the edges the clamp
  // moved, and captures the HUD as name.
  async function touchHudProof(name) {
    await settledBox('[data-control="aim-joystick"]');
    await page.locator(".ada-shield").waitFor({ state: "visible" });
    const hud = await page.evaluate(() => {
      const app = document.getElementById("app");
      const unit = Number(getComputedStyle(app).getPropertyValue("--ada-unit"));
      const origin = app.getBoundingClientRect();
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return {
          bottom: (rect.bottom - origin.top) / unit,
          left: (rect.left - origin.left) / unit,
          right: (rect.right - origin.left) / unit,
          top: (rect.top - origin.top) / unit,
        };
      };
      // The 720x360 game area, from the view properties the play area is laid out by.
      const property = (name) => parseFloat(getComputedStyle(app).getPropertyValue(name)) / unit;
      const left = property("--ada-area-left");
      const bottom = origin.height / unit - property("--ada-area-bottom");
      return {
        aim: box('[data-control="aim-joystick"]'),
        area: { bottom, left, right: left + 720 },
        dpr: devicePixelRatio,
        move: box('[data-control="move-joystick"]'),
        shield: box(".ada-shield"),
        status: box(".ada-status"),
        unit,
        view: { height: origin.height / unit, width: origin.width / unit },
      };
    });
    const { area, view } = hud;
    const margin = 8;
    const side = 50;
    const below = 50;
    const width = Math.floor(view.width);
    const expected = {
      aimRight: Math.min(width - side, area.right - margin),
      bottom: Math.min(view.height - below, area.bottom - margin),
      moveLeft: Math.max(side, area.left + margin),
    };
    const drawn = {
      aimRight: hud.aim.right - 1,
      bottoms: [hud.move.bottom - 1, hud.aim.bottom - 1],
      moveLeft: hud.move.left + 1,
    };
    const proof = {
      ...hud,
      clamped: {
        aim: width - side > area.right - margin,
        bottom: view.height - below > area.bottom - margin,
        move: area.left + margin > side,
      },
      drawn,
      expected,
      fromScreen: {
        aim: width - drawn.aimRight,
        bottom: view.height - drawn.bottoms[0],
        move: drawn.moveLeft,
      },
      insideArea: {
        aim: area.right - drawn.aimRight,
        bottom: area.bottom - drawn.bottoms[0],
        move: drawn.moveLeft - area.left,
      },
      shieldBottom: view.height - hud.shield.bottom,
    };
    save(`touch-hud-${name}.json`, proof);
    const detail = `${name}: ${JSON.stringify(proof)}`;
    // Whole-pixel ring centres put a drawn edge within a logical px of its place.
    const near = (value, target) => Math.abs(value - target) < 1;
    assert.ok(near(drawn.moveLeft, expected.moveLeft), `The move ring's left edge: ${detail}`);
    assert.ok(near(drawn.aimRight, expected.aimRight), `The aim ring's right edge: ${detail}`);
    for (const bottom of drawn.bottoms) {
      assert.ok(near(bottom, expected.bottom), `Each ring's drawn bottom: ${detail}`);
    }
    for (const gap of Object.values(proof.insideArea)) {
      assert.ok(gap > margin - 1, `Each ring stays the margin inside the game area: ${detail}`);
    }
    assert.ok(
      Math.abs(proof.shieldBottom - hud.status.top) < 1,
      `The shield pill's bottom margin mirrors the status pill's top margin: ${detail}`,
    );
    await page.screenshot({ path: `${output}/touch-hud-${name}.png` });
    return proof;
  }
  // Each fixture loads in a fresh context at the same URL and viewport, carrying the stored
  // settings over: a reloaded tab keeps every earlier load's images alive until the context
  // closes, which the container's memory ceiling cannot hold across the run. A mid-flight
  // fixture continues into its flight unless resume is false.
  async function seedOnce(value, marker, { resume = true } = {}) {
    const fixture = await openFixture(await leaveFixture(), value, marker);
    context = fixture.context;
    page = fixture.page;
    await page.goto(fixture.url);
    if (resume && JSON.parse(value).mode === "space") {
      await continueFlight();
    }
  }
  // The current page's URL, viewport and stored entries, then its context closed.
  async function leaveFixture() {
    const url = page.url();
    const viewport = page.viewportSize();
    const { origins } = await context.storageState();
    const stored =
      origins
        .find(({ origin }) => origin === "http://ada-preview:4173")
        ?.localStorage.map(({ name, value: entry }) => [name, entry]) ?? [];
    await context.close();
    return { stored, url, viewport };
  }
  async function openFixture({ stored, url, viewport }, value, marker) {
    const opened = await browser.newContext({ viewport, hasTouch: true });
    await opened.addInitScript(reportViolations);
    await opened.route("**/*", previewOnly);
    // One-shot per tab, so a later reload in the fixture resumes the game's own save.
    await opened.addInitScript(
      ({ entries, key, once, serialized }) => {
        if (!sessionStorage.getItem(once)) {
          for (const [name, entry] of entries) {
            localStorage.setItem(name, entry);
          }
          localStorage.setItem(key, serialized);
          sessionStorage.setItem(once, "1");
        }
      },
      { entries: stored, key: storageKey, once: marker, serialized: value },
    );
    const fresh = await opened.newPage();
    fresh.setDefaultTimeout(10000);
    fresh.setDefaultNavigationTimeout(15000);
    observe(fresh);
    return { context: opened, page: fresh, url };
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
  calm.flight.shield = CONTENT.tuning.shieldMax;
  calm.flight.dangerFor = 0;
  assert.ok(restoreCalm(calm), "The calm launched world must remain a canonical save");
  // A launch from a mid-flight save opens on the start screen with Continue focused, the flight
  // held as saved; Continue resumes it where the save left off.
  await seedOnce(JSON.stringify(calm), "ada-browser.calm-launch.v1", { resume: false });
  const midFlightContinue = page.locator('.ada-start-actions > [data-action="continue"]');
  await midFlightContinue.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector(".ada-start-ship")?.complete);
  assert.equal(
    await page.locator("#game-status").getAttribute("data-mode"),
    "home",
    "A mid-flight save launches to the start screen",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.action ?? null),
    "continue",
    "Continue is focused on a mid-flight launch",
  );
  assert.equal(
    await page.locator("#game-status").textContent(),
    "",
    "The flight's notice waits with the flight, off the start screen",
  );
  await page.waitForTimeout(500);
  assert.deepEqual(
    (await readSave()).flight.player,
    calm.flight.player,
    "The start screen holds the saved flight unchanged",
  );
  await page.screenshot({ path: `${output}/launch-mid-flight.png` });
  await midFlightContinue.click();
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  assert.deepEqual(
    await page
      .locator("#game-status")
      .evaluate((status) => [Number(status.dataset.x), Number(status.dataset.y)]),
    [calm.flight.player.x, calm.flight.player.y],
    "Continue resumes the flight at its saved position",
  );
  events.checks.push(
    "A mid-flight save launches to the start screen with Continue focused, and Continue " +
      "resumes the flight at its saved position",
  );

  await page.waitForFunction((key) => {
    const status = document.querySelector("#game-status");
    const saved = JSON.parse(localStorage.getItem(key));
    return (
      saved?.flight?.player?.x === Number(status.dataset.x) &&
      saved?.flight?.player?.y === Number(status.dataset.y)
    );
  }, storageKey);
  // A save's progress survives a later save of the same flight: Penny keeps sensing while the
  // resumed flight runs, so a landmark she senses after the earlier save adds its marker knowledge.
  // Every other progress fact stays exactly as saved, and every marker known then stays known.
  function assertProgressRetained(after, before, message) {
    const withoutKnowledge = (progress) =>
      Object.fromEntries(
        Object.entries(progress).map(([galaxy, entry]) => {
          const rest = { ...entry };
          delete rest.markerKnowledge;
          return [galaxy, rest];
        }),
      );
    assert.deepEqual(withoutKnowledge(after), withoutKnowledge(before), message);
    for (const [galaxy, entry] of Object.entries(before)) {
      for (const id of Object.keys(entry.markerKnowledge ?? {})) {
        assert.ok(
          Object.hasOwn(after[galaxy]?.markerKnowledge ?? {}, id),
          `${message}: galaxy ${galaxy} keeps knowing ${id}`,
        );
      }
    }
  }
  const persisted = await readSave();
  assert.equal(persisted.version, SAVE_VERSION);
  await page.reload();
  await continueFlight();
  const resumed = await readSave();
  for (const field of ["seed", "cargo", "shield", "player", "world", "visited"]) {
    assert.deepEqual(
      resumed.flight[field],
      persisted.flight[field],
      `Reload must retain flight ${field}`,
    );
  }
  assertProgressRetained(resumed.progress, persisted.progress, "Reload must retain progress");
  await page.goto("http://ada-preview:4173/");
  const onLanding = await readSave();
  assert.equal(await page.locator("#game-canvas").count(), 0);
  await Promise.all([
    page.waitForURL("**/play/"),
    page.locator('a[href="/play/"]').first().click(),
  ]);
  await continueFlight();
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
  assertProgressRetained(
    returned.progress,
    onLanding.progress,
    "Website round trip preserves progress",
  );
  events.checks.push("Reload resumes the persisted flight without regeneration");

  const safeInput = new GameModel(CONTENT);
  safeInput.startGalaxy(1);
  playOpening(safeInput);
  Object.assign(safeInput.state.progress[1], {
    introduced: true,
    stage: 1,
    questItem: "food",
    known: ["growers"],
    discoveries: 1,
  });
  assert.ok(safeInput.state.flight, "Safe input fixture requires a real flight");
  const friendly = ensureDestination(CONTENT, "growers", safeInput.state.flight);
  safeInput.teleport("growers");
  assert.deepEqual(safeInput.state.flight.player, { x: friendly.x, y: friendly.y });
  // Chapter one's stage places a quest guard on the Growers route; with its weapons stopped it no
  // longer blocks the way in (routeBlocked in src/model/flight.ts), so Talk is offered there.
  for (const guard of safeInput.state.flight.objects) {
    if (guard.kind === "enemy" && guard.routeId === "growers") {
      guard.enemy.disabled = true;
    }
  }
  assert.equal(
    routeBlocked("growers", safeInput.state.flight),
    false,
    "The safe input fixture's Growers route is open",
  );
  // The first flight's move and aim lessons are seen, so no lesson line holds the notice slot the
  // save status yields to (src/ui/notice.ts).
  safeInput.state.seenConversations.push("lesson:move", "lesson:aim");
  // Every flight follows the prologue, which unlocks the Paused card's Map and New Navigator.
  safeInput.state.prologueSeen = true;
  safeInput.state.achievements.unlocked.push(ACHIEVEMENTS[0].id);
  assert.equal(safeInput.state.flight.freshChunk, null);
  const safeSerialized = safeInput.save();
  assert.deepEqual(relaunch(CONTENT, safeSerialized).state, safeInput.state);
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
  const { CHEAT_COPY } = await import(new URL("../src/data/cheatCopy.ts", import.meta.url));
  await page.keyboard.down("w");
  try {
    await openSettings();
    await page.getByRole("button", { name: CHEAT_COPY.open, exact: true }).click();
    const cheatDialog = page.getByRole("dialog", { name: CHEAT_COPY.title, exact: true });
    await cheatDialog.waitFor({ state: "visible" });
    const paused = await position();
    const beforeGrant = await readSave();
    await page.waitForTimeout(250);
    assert.deepEqual(await position(), paused, "Cheat modal must pause held flight input");
    const behindModal = await page.locator("#game-canvas > canvas").boundingBox();
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
    // Closing Cheats returns to Settings, its parent; closing Settings returns to the Paused card.
    await page.locator('[data-action="close-settings"]').waitFor({ state: "visible" });
    await closeSettings();
    // Each new weapon queues an item notice: the chip shows under the pill once play resumes,
    // hidden from assistive technology, and its label is announced politely.
    const chip = page.locator(".ada-item-notice");
    await chip.waitFor({ state: "visible" });
    assert.equal(await chip.getAttribute("aria-hidden"), "true");
    const weaponNames = ["RapidMissile", "MultiLaser", "HeavyMissile", "Scattershot", "Phaser"].map(
      (id) => `+ ${CONTENT.labels[`weapon${id}`]}`,
    );
    const announced = page.locator(".ada-item-notice-live");
    assert.equal(await announced.getAttribute("aria-live"), "polite");
    assert.ok(
      weaponNames.includes((await announced.textContent()) ?? ""),
      `A granted weapon's notice reads + {weapon}: ${await announced.textContent()}`,
    );
  } finally {
    await page.keyboard.up("w");
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
  // The disc shows the action's symbol, no text; its accessible name is the action's.
  assert.equal(await page.locator(".ada-use").getAttribute("aria-label"), CONTENT.labels.talk);
  assert.equal(await page.locator(".ada-use").getAttribute("data-use"), "talk");
  assert.equal((await page.locator(".ada-use").textContent()).trim(), "", "Use shows no text");
  // The save status yields the notice slot to conversation lines (src/ui/notice.ts), so a tap on
  // the box dismisses the line showing there, as a player would, before saving fails.
  async function freeNoticeSlot(remaining = 5) {
    const shown = page.locator(".ada-conversation:not([hidden])");
    const line = (await shown.count()) ? await shown.boundingBox() : null;
    if (!line) {
      return;
    }
    assert.ok(remaining > 0, "A conversation line keeps the notice slot");
    await page.touchscreen.tap(line.x + line.width / 2, line.y + line.height / 2);
    await page.waitForTimeout(150);
    await freeNoticeSlot(remaining - 1);
  }
  await freeNoticeSlot();
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
    const warning = page.getByRole("status").filter({ hasText: CONTENT.labels.savingUnavailable });
    await warning.waitFor({ state: "visible" });
    assert.equal(await warning.count(), 1, "Save failure must have one accessible status");
    assert.equal(await warning.getAttribute("id"), "save-status");
    await closeSettings();
    const blockedPosition = await position();
    // Keys pressed on a focused page control stay with it (src/input/desktop.ts), and closing the
    // Paused card returns focus to its opener, so flight keys go to the page.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.down("w");
    try {
      await page.waitForFunction(({ x, y }) => {
        const status = document.querySelector("#game-status");
        return Number(status.dataset.x) !== x || Number(status.dataset.y) !== y;
      }, blockedPosition);
    } finally {
      await page.keyboard.up("w");
    }
    await waitForRest(await position());
    assert.equal(await warning.textContent(), CONTENT.labels.savingUnavailable);
    await touchSurface();
    await tapUse(CONTENT.labels.talk);
    await interactionCard().waitFor({ state: "visible" });
    await contextControlProof(0, "dialogue during save failure");
    assert.equal(
      await warning.textContent(),
      CONTENT.labels.savingUnavailable,
      "Dialogue rendering must not clear a failed-save warning",
    );
    await leaveInteraction();
    await page.locator(".ada-use").waitFor({ state: "visible" });
    await contextControlProof(1, "resumed flight");
    await page.evaluate(() => document.activeElement?.blur());
    // The keyboard's Use is E (or Enter); Space fires (src/input/desktop.ts).
    await page.keyboard.press("KeyE");
    await interactionCard().waitFor({ state: "visible" });
    await contextControlProof(0, "keyboard interaction dialogue");
    await leaveInteraction();
    assert.equal(await warning.textContent(), CONTENT.labels.savingUnavailable);
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
  // The keyboard Use above switched flight to the desktop controls; a touch brings the disc back.
  await touchSurface();
  await contextControlProof(1, "recovered flight");
  // With saving restored the notice slot is free, and Talk opens the Interaction card again.
  assert.equal(await page.locator("#save-status").textContent(), "", "Saving works again");
  await tapUse(CONTENT.labels.talk);
  await interactionCard().waitFor({ state: "visible" });
  // The card at 1280x720, 844x390 and 720x360 with the phone insets set (the full-viewport
  // policy keeps hardware insets zero, so they move nothing).
  const interactionViewport = page.viewportSize();
  const interactionRows = {
    "1280x720": await interactionHudProof("interaction-hud-1280x720"),
  };
  await page.setViewportSize({ height: 390, width: 844 });
  await page.waitForTimeout(250);
  interactionRows["844x390"] = await interactionHudProof("interaction-hud-844x390");
  await page.setViewportSize({ height: 360, width: 720 });
  await page.evaluate(() => {
    const unit = Number(
      getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
    );
    for (const [side, value] of Object.entries({ bottom: 19, left: 43, right: 43, top: 0 })) {
      document.documentElement.style.setProperty(`--inset-${side}`, `${value * unit}px`);
    }
  });
  await page.waitForTimeout(250);
  interactionRows["720x360-insets"] = await interactionHudProof("interaction-hud-720x360-insets");
  await page.evaluate(() => {
    for (const side of ["bottom", "left", "right", "top"]) {
      document.documentElement.style.removeProperty(`--inset-${side}`);
    }
  });
  await page.setViewportSize(interactionViewport);
  await page.waitForTimeout(250);
  save("interaction-hud-proof.json", interactionRows);
  events.checks.push(
    "The Interaction card's close X takes the Settings slot with Skip beside it, their press " +
      "areas apart, at 1280x720, 844x390 and 720x360 with insets",
  );
  await leaveInteraction();
  events.checks.push(
    "Blocked browser storage preserves gameplay and last save; " +
      "status survives dialogue and clears after successful write",
  );
  events.checks.push(
    "One dedicated context control supports pointer and keyboard use, absent in home and dialogue",
  );

  const dangerInput = relaunch(CONTENT, safeSerialized);
  dangerInput.state.flight.dangerFor = 5;
  dangerInput.state.flight.player.x += CONTENT.tuning.safeRadius * 3;
  dangerInput.state.flight.objects = [];
  // An enemy shot held still inside the battle square keeps Ada in danger while she flies or
  // waits paused; it lasts the whole check.
  dangerInput.state.flight.shots = [
    {
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "smoke:held-shot",
      life: 3600,
      piercing: false,
      velocity: { x: 0, y: 0 },
      x: dangerInput.state.flight.player.x,
      y: dangerInput.state.flight.player.y + 300,
    },
  ];
  await seedOnce(dangerInput.save(), "ada-browser.danger-context.v1");
  await openPause();
  // In flight the card shows Map, Ship, Quests, Settings and Back to title over Resume, every one
  // available in danger.
  const pauseActions = () => page.locator('[data-dialog="pause"] .ada-stack button:not([hidden])');
  assert.deepEqual(
    await pauseActions().evaluateAll((buttons) =>
      buttons.map((button) => [
        button.dataset.action,
        button.textContent,
        button.getAttribute("aria-disabled"),
      ]),
    ),
    [
      ["pause-map", CONTENT.labels.map, null],
      ["pause-ship", CONTENT.labels.ship, null],
      ["pause-quests", CONTENT.labels.quests, null],
      ["pause-settings", CONTENT.labels.settings, null],
      ["pause-backToTitle", CONTENT.labels.backToTitle, null],
      ["pause-resume", CONTENT.labels.resume, null],
    ],
    "The in-flight Paused card shows Map, Ship, Quests, Settings, Back to title and Resume, all " +
      "available in danger",
  );
  await page.screenshot({ path: `${output}/pause-flight-danger.png` });
  // Ship opens its card in the Paused card's place, focus on its Back; Escape and the X return to
  // the Paused card on its Ship button.
  const shipCard = page.locator('[data-dialog="ship"]');
  const focusedAction = () =>
    page.evaluate(() => document.activeElement?.getAttribute("data-action"));
  const openAndCloseShip = async (close) => {
    await page.locator('[data-action="pause-ship"]').click();
    await shipCard.waitFor({ state: "visible" });
    assert.equal(
      await page.locator('[data-dialog="pause"]').isVisible(),
      false,
      "The Ship card hides the Paused card",
    );
    assert.equal(
      await shipCard.locator("h2").textContent(),
      CONTENT.labels.ship,
      "The Ship card is titled Ship",
    );
    assert.deepEqual(
      await shipCard
        .locator(".ada-ship-section h3")
        .evaluateAll((headings) => headings.map((heading) => heading.textContent)),
      [CONTENT.labels.cargo, CONTENT.labels.equipment, CONTENT.labels.shopWeapons],
      "The Ship card shows Cargo, Equipment, then Weapons",
    );
    assert.equal(await focusedAction(), "back-ship", "Focus starts on the Ship card's Back");
    if (close === "Escape") {
      await page.screenshot({ path: `${output}/pause-ship.png` });
      await page.keyboard.press("Escape");
    } else {
      await page.locator('[data-action="close-ship"]').click();
    }
    await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
    assert.equal(await shipCard.isVisible(), false, `${close} closes the Ship card`);
    assert.equal(await focusedAction(), "pause-ship", `${close} returns to the Ship button`);
  };
  await openAndCloseShip("Escape");
  await openAndCloseShip("x");
  // Map opens in danger as a full-screen map in the Paused card's place, with the galaxy's
  // name and how much is mapped in its header; nothing undiscovered appears.
  await page.locator('[data-action="pause-map"]').click();
  const mapScreen = page.locator('[data-dialog="map"]');
  await mapScreen.waitFor({ state: "visible" });
  assert.equal(
    await page.locator('[data-dialog="pause"]').isVisible(),
    false,
    "The map hides the Paused card",
  );
  const mapBox = await mapScreen.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(
    mapBox &&
      viewport &&
      Math.abs(mapBox.width - viewport.width) <= 1 &&
      Math.abs(mapBox.height - viewport.height) <= 1,
    "The map fills the view",
  );
  assert.match(
    (await mapScreen.locator(".ada-map-percent").textContent()) ?? "",
    /^\d+% mapped$/u,
    "Map shows the percent mapped",
  );
  assert.equal(
    (await mapScreen.locator(".ada-map-galaxy").textContent()) ?? "",
    "Sunflower",
    "Map names the galaxy",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("data-action")),
    "map-close",
    "Focus starts on the map's close",
  );
  assert.deepEqual(
    await mapScreen
      .locator(".ada-map-tool")
      .evaluateAll((tools) => tools.map((tool) => tool.dataset.tool)),
    ["zoomOut", "zoomIn", "recentre"],
    "The map's tools are zoom out, zoom in and recentre, top to bottom",
  );
  // No close X: the footer's primary dismisses the map, Back since it returns to the Paused card.
  assert.deepEqual(
    await mapScreen.locator('[data-action="map-close"]').evaluate((close) => ({
      primary: close.classList.contains("ada-primary"),
      text: close.textContent?.trim(),
      tool: close.classList.contains("ada-map-tool"),
    })),
    { primary: true, text: CONTENT.labels.questBack, tool: false },
    "The map's footer primary, not a tool, returns to the Paused card as Back",
  );
  assert.deepEqual(
    await mapScreen
      .locator(".ada-map-tool")
      .evaluateAll((tools) => tools.map((tool) => tool.getAttribute("aria-label"))),
    ["mapZoomOut", "mapZoomIn", "mapCenterOnAda"].map((key) => CONTENT.labels[key]),
    "The map's tools carry Gameplay's accessible labels",
  );
  // Galaxies in the footer with Quests and Close, the header capped SPACING.gap short of the tools.
  // In danger it refuses, and the reason-only panel shows the danger line with nothing selected.
  const mapEarth = mapScreen.locator('[data-action="map-galaxies"]');
  assert.equal(
    await mapEarth.textContent(),
    CONTENT.labels.galaxies,
    "The local map offers Galaxies",
  );
  await assertNoTapFlash(
    ['[data-action="map-galaxies"]', '[data-action="map-quests"]', ".ada-map-tools [data-action]"],
    "The Map",
  );
  const hudRow = await mapScreen.evaluate((screen) => {
    const unit = Number(
      getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
    );
    const box = (selector) => screen.querySelector(selector).getBoundingClientRect();
    return {
      close: box('[data-action="map-close"]'),
      galaxies: box('[data-action="map-galaxies"]'),
      header: box(".ada-map-header"),
      quests: box('[data-action="map-quests"]'),
      tools: box(".ada-map-tools"),
      unit,
    };
  });
  const logical = (px) => Math.round((px / hudRow.unit) * 10) / 10;
  // The footer (art/map.md "Footer"): Quests, Galaxies, then Close, each 98 by 48 and BUTTON_GAP
  // (16) apart face to face on one row, Close's right the tool row's right. Device-pixel snapping
  // puts each width within 0.1 either side.
  const footer = [hudRow.quests, hudRow.galaxies, hudRow.close];
  assert.ok(
    footer.every(
      (button) =>
        Math.abs(button.width / hudRow.unit - 98) <= 0.1 &&
        Math.abs(button.height / hudRow.unit - 48) <= 0.1 &&
        Math.abs(button.top - hudRow.close.top) <= 0.5,
    ) &&
      Math.abs(logical(hudRow.galaxies.left - hudRow.quests.right) - 16) <= 0.1 &&
      Math.abs(logical(hudRow.close.left - hudRow.galaxies.right) - 16) <= 0.1 &&
      Math.abs(hudRow.close.right - hudRow.tools.right) <= 0.5,
    `Quests, Galaxies and Close are 98 by 48, 16 apart, Close under the tools' right: ${JSON.stringify(hudRow)}`,
  );
  // The tools: one row of three 48 targets, 9 apart, 162 wide, on the page rect's top-right corner.
  assert.ok(
    Math.abs(logical(hudRow.tools.width) - 162) <= 0.1 &&
      Math.abs(logical(hudRow.tools.height) - 48) <= 0.1 &&
      hudRow.tools.bottom < hudRow.close.top,
    `The tools are one 162 by 48 row above the footer: ${JSON.stringify(hudRow)}`,
  );
  assert.ok(
    hudRow.header.right <= hudRow.tools.left - 8 * hudRow.unit + 0.5,
    `The header stays SPACING.gap short of the tools: ${JSON.stringify(hudRow)}`,
  );
  assert.equal(await mapEarth.getAttribute("aria-disabled"), "true", "It is disabled in danger");
  const reasonOnly = await mapScreen.evaluate((screen) => {
    const panel = screen.querySelector(".ada-map-panel");
    const unit = Number(
      getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
    );
    const box = panel.getBoundingClientRect();
    return {
      height: Math.round((box.height / unit) * 10) / 10,
      hidden: panel.hidden,
      reason: [...panel.querySelectorAll(".ada-map-reason [data-shown]")].map(
        (line) => line.textContent,
      ),
      row: panel.querySelector(".ada-map-row").hidden,
      width: Math.round((box.width / unit) * 10) / 10,
    };
  });
  // With nothing mapped the reason follows the empty note: 80 high, else 52.
  const emptyMap = (await mapScreen.locator(".ada-map-places .ada-map-place").count()) === 0;
  assert.deepEqual(
    reasonOnly,
    {
      height: emptyMap ? 80 : 52,
      hidden: false,
      reason: [CONTENT.labels.travelUnavailable],
      row: true,
      // maxWidth: Quests' left less SPACING.gap and the page inset (378 - 8 - 16).
      width: 354,
    },
    "In danger with nothing selected the reason-only panel is 354 by 52, or 80 with the empty note",
  );
  await page.screenshot({ path: `${output}/map-earth-danger.png` });
  // Map proofs: the local map with its tools, place panel and footer at 1280x720, and at 720x360
  // with the phone insets set (the full-viewport policy keeps hardware insets zero).
  await page.screenshot({ path: `${output}/map-local-1280x720.png` });
  const mapViewport = page.viewportSize();
  await page.setViewportSize({ height: 360, width: 720 });
  await page.evaluate(() => {
    const unit = Number(
      getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
    );
    for (const [side, value] of Object.entries({ bottom: 19, left: 43, right: 43, top: 0 })) {
      document.documentElement.style.setProperty(`--inset-${side}`, `${value * unit}px`);
    }
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/map-local-720x360-insets.png` });
  await page.evaluate(() => {
    for (const side of ["bottom", "left", "right", "top"]) {
      document.documentElement.style.removeProperty(`--inset-${side}`);
    }
  });
  await page.setViewportSize(mapViewport);
  await page.waitForTimeout(250);
  // Tab order: the tools, the places in reading order, Travel here where offered, Quests,
  // Galaxies, then Close, wrapping at either end; from Close, Tab starts over at the tools.
  await mapScreen.locator('[data-action="map-close"]').focus();
  // Each press in turn, then what it focused.
  const tabThrough = async (presses, seen = []) => {
    if (presses === 0) {
      return seen;
    }
    await page.keyboard.press("Tab");
    const at = await page.evaluate(
      () => document.activeElement?.dataset.tool ?? document.activeElement?.dataset.action ?? "",
    );
    return tabThrough(presses - 1, [...seen, at]);
  };
  const shownPlaces = await mapScreen.evaluate((screen) =>
    [...screen.querySelectorAll(".ada-map-places button")]
      .filter((button) => !button.hidden && !button.closest("[hidden]"))
      .map((button) => button.dataset.tool ?? button.dataset.action ?? ""),
  );
  const travelShown = await mapScreen.locator('[data-action="map-travel"]').isVisible();
  const tabOrder = [
    "zoomOut",
    "zoomIn",
    "recentre",
    ...shownPlaces,
    ...(travelShown ? ["map-travel"] : []),
    "map-quests",
    "map-galaxies",
    "map-close",
  ];
  const tabbed = await tabThrough(tabOrder.length);
  assert.deepEqual(
    tabbed,
    tabOrder,
    `Tab moves through the tools, the places, Quests, Galaxies and back to Close: ${tabbed}`,
  );
  // Quests: the shared Quests list over the map (src/ui/questsScreen.ts). Opened from the map, its
  // footer's primary is Back to the map and takes focus; Escape returns to the map as Back does.
  const questsCard = page.locator(".ada-quests-screen");
  await mapScreen.locator('[data-action="map-quests"]').click();
  await questsCard.waitFor({ state: "visible" });
  assert.deepEqual(
    await page.evaluate(() => {
      const active = document.activeElement;
      return {
        inCard: Boolean(active?.closest(".ada-quests-screen")),
        primary: active?.classList.contains("ada-primary") ?? false,
        text: active?.textContent?.trim(),
      };
    }),
    { inCard: true, primary: true, text: CONTENT.labels.questBack },
    "Quests opened from the map focuses its primary Back",
  );
  await page.screenshot({ path: `${output}/map-quests.png` });
  await page.keyboard.press("Escape");
  await questsCard.waitFor({ state: "hidden" });
  assert.ok(await mapScreen.isVisible(), "Escape closes Quests back to the map");
  await mapScreen.locator('[data-action="map-close"]').focus();
  // A refused action stays pressable (aria-disabled), which Playwright treats as disabled.
  await mapEarth.click({ force: true });
  assert.ok(
    (await mapScreen.isVisible()) &&
      (await page.locator('#game-status[data-mode="space"]').count()) === 1,
    "A refused Galaxies keeps the local map and the flight",
  );
  const known = dangerInput.state.progress[dangerInput.state.flight.galaxy];
  const chips = mapScreen.locator(".ada-map-places .ada-map-place");
  assert.ok(
    (await chips.count()) <= known.known.length + known.stations.length,
    "Map shows only discovered places",
  );
  if ((await chips.count()) > 0) {
    // A selected place's panel names its type and distance from Ada, and in danger the danger
    // line, whatever the place offers.
    await chips.first().dispatchEvent("click");
    assert.deepEqual(
      await mapScreen
        .locator(".ada-map-reason [data-shown]")
        .evaluateAll((lines) => lines.map((line) => line.textContent)),
      [CONTENT.labels.travelUnavailable],
      "In danger the danger line shows with a selection",
    );
    await page.screenshot({ path: `${output}/map-earth-danger-selected.png` });
    const kinds = Object.entries(CONTENT.labels)
      .filter(([key]) => key.startsWith("mapKind"))
      .map(([, value]) => value);
    const typeLine = (await mapScreen.locator(".ada-map-detail").first().textContent()) ?? "";
    const [kind, distance] = typeLine.split(" · ");
    assert.ok(
      kinds.includes(kind) && /^(?:\d[\d,]*(?:\.\d)? light-years|1 light-year)$/u.test(distance),
      `The place panel's type line names a kind and a distance: ${typeLine}`,
    );
  }
  await page.keyboard.press("Escape");
  await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
  assert.equal(await mapScreen.isVisible(), false, "Back and Escape close Map to the Paused card");
  await page.locator('[data-action="pause-map"]').click();
  await mapScreen.waitFor({ state: "visible" });
  await page.locator('[data-action="map-close"]').click();
  await page.locator('[data-dialog="pause"]').waitFor({ state: "visible" });
  assert.equal(await mapScreen.isVisible(), false, "The close tool returns to the Paused card");
  await page.locator('[data-action="pause-resume"]').click();
  await contextControlProof(0, "danger outside a friendly destination");
  events.checks.push(
    "Danger refuses the local map's Galaxies with its reason; the full-screen local map opens " +
      "with its galaxy, percent and tools, focus on close, and closes on Escape and its close " +
      "tool, and " +
      "no inapplicable or duplicate contextual control shows",
  );
  events.checks.push(
    "Achievements open from the start screen's Menu in Gameplay's order, paging six at a time, " +
      "and close back to the Menu; the start actions and the Paused card hold no Achievements",
  );
  // A held job's long Job line wraps inside the place panel, which stays clear of the tool
  // column, and selecting its target pans the chip clear of the panel's rendered height.
  const { ECONOMY } = await import(new URL("../src/data/economy.ts", import.meta.url));
  const { stationsNear } = await import(new URL("../src/model/stations.ts", import.meta.url));
  const jobInput = relaunch(CONTENT, safeSerialized);
  const issuer = stationsNear(ECONOMY, 1, 25000, { x: 0, y: 0 })[0];
  const growersAt = jobInput.state.flight.objects.find(
    (o) => o.kind === "destination" && o.id === "growers",
  );
  jobInput.state.progress[1].stations = [issuer.id];
  jobInput.state.tasks = {
    1: {
      carrying: true,
      id: "job:smoke",
      item: "a crate of seedling trays for the far greenhouse ring",
      kind: "job",
      reward: 20,
      station: issuer.id,
      target: { id: "growers", x: growersAt.x, y: growersAt.y },
      type: "delivery",
    },
  };
  await seedOnce(jobInput.save(), "ada-browser.map-job-line.v1");
  await openPause();
  await page.locator('[data-action="pause-map"]').click();
  // The fixture opened a new page, so the map is found afresh.
  const jobMap = page.locator('[data-dialog="map"]');
  await jobMap.waitFor({ state: "visible" });
  await jobMap.locator('.ada-map-places [data-place="growers"]').dispatchEvent("click");
  const jobPanel = await jobMap.evaluate((screen) => {
    const box = (node) => node.getBoundingClientRect();
    const lines = [...screen.querySelectorAll(".ada-map-detail:not([hidden])")];
    const jobLine = lines.at(-1);
    const target = screen.querySelector('.ada-map-places [data-place="growers"]');
    return {
      chip: box(target),
      face: getComputedStyle(target).backgroundColor,
      jobHeight: jobLine ? box(jobLine).height : 0,
      jobText: jobLine?.textContent ?? "",
      lineHeight: jobLine ? parseFloat(getComputedStyle(jobLine).lineHeight) : 0,
      panel: box(screen.querySelector(".ada-map-panel")),
      quests: box(screen.querySelector('[data-action="map-quests"]')),
      unit: Number(getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit")),
    };
  });
  assert.match(jobPanel.jobText, /^Job: Deliver /u, "The job's target shows its Job line");
  assert.equal(
    jobPanel.face,
    "rgb(254, 174, 52)",
    "A held job's target chip has main's orange face",
  );
  assert.ok(
    jobPanel.jobHeight > 1.5 * jobPanel.lineHeight,
    `A long Job line wraps inside the panel: ${JSON.stringify(jobPanel)}`,
  );
  // The panel's maxWidth keeps it at least SPACING.gap left of the footer (art/map.md).
  assert.ok(
    jobPanel.panel.right <= jobPanel.quests.left - 8 * jobPanel.unit + 0.5,
    `The panel stays SPACING.gap left of the footer: ${JSON.stringify(jobPanel)}`,
  );
  assert.ok(
    jobPanel.chip.bottom < jobPanel.panel.top,
    `Selecting pans the chip clear of the wrapped panel: ${JSON.stringify(jobPanel)}`,
  );
  events.checks.push(
    "A held job's target chip has main's orange face; its long Job line wraps in the place " +
      "panel, left of the footer, and the selected target pans clear of the panel's " +
      "rendered height",
  );
  // Back to title from a flight in danger: the start screen with the flight kept and saved, no
  // sleep scene; Continue resumes that flight exactly (rules.md "What each event keeps").
  await seedOnce(dangerInput.save(), "ada-browser.danger-title.v1");
  await openPause();
  await page.locator('[data-action="pause-backToTitle"]').click();
  await page.locator('[data-action="continue"]').waitFor({ state: "visible" });
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  const titled = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.ok(
    titled.mode === "space" &&
      titled.flight !== null &&
      titled.flight.seed === dangerInput.state.flight.seed &&
      titled.economy.stardust === dangerInput.state.economy.stardust,
    "Back to title keeps the flight saved for Continue",
  );
  assert.equal(
    await page.locator(".ada-story-panel:not(.ada-dialogue-panel):not([hidden])").count(),
    0,
    "Back to title shows the start screen, not the jump-home page or the sleep scene",
  );
  // Achievements opens from the title's Menu, which Back to title leaves without Back to title.
  await openMenu();
  assert.deepEqual(
    await menuActionIds(),
    ["menu-achievements", "menu-settings", "menu-exit", "menu-close"],
    "The title's Menu is the start Menu",
  );
  await menuCard().locator('[data-action="menu-achievements"]').click();
  assert.equal((await achievementsPage()).count, "1/3", "Achievements opens from the title");
  await page.screenshot({ path: `${output}/achievements-title.png` });
  await page.locator('[data-action="close-achievements"]').click();
  await page.locator('[data-dialog="achievements"]').waitFor({ state: "hidden" });
  await menuCard().waitFor({ state: "visible" });
  await closeMenu();
  assert.deepEqual(
    await page
      .locator(".ada-start button")
      .evaluateAll((buttons) => buttons.map((button) => button.dataset.action)),
    ["restart", "continue"],
    "The start screen holds only Restart and Continue, in that order",
  );
  await page.locator('[data-action="continue"]').click();
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  assert.equal(
    await page.locator('[data-action="continue"]').isVisible(),
    false,
    "Continue resumes the flight from the title",
  );
  // The local map's Galaxies opens the galaxy map over the paused flight: its ship on the galaxy
  // Ada is flying in, whose single destination action reads Stay in {galaxy}, with no close X or
  // Back. Stay in and Escape return to the local map on the same flight; Earth lands on Ada's room
  // page, where the Paused card holds only Settings and Back to title, and closes on Escape and its
  // X. With the opening and prologue seen, Earth lands on the room page itself.
  const roomInput = relaunch(CONTENT, safeSerialized);
  roomInput.state.progress[1].opened = true;
  roomInput.state.prologueSeen = true;
  // Whirlpool open too, its opening played, so the galaxy map has another galaxy to jump to and
  // Earth still lands on the room page.
  roomInput.state.unlocked = [1, 3];
  roomInput.state.progress[3].opened = true;
  await seedOnce(roomInput.save(), "ada-browser.room-pause.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await openPause();
  await page.locator('[data-action="pause-map"]').click();
  await page.screenshot({ path: `${output}/map-earth.png` });
  const galaxyMap = page.locator('.ada-route[data-dialog="galaxies"]');
  const localMap = page.locator('[data-dialog="map"]');
  const flightSaved = () =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.flight ?? null, storageKey);
  const flightBefore = await flightSaved();
  await localMap.locator('[data-action="map-galaxies"]').click();
  await galaxyMap.waitFor({ state: "visible" });
  assert.equal(
    (await galaxyMap.locator('[data-action="galaxy-jump"]').textContent())?.trim(),
    // Gameplay's "Stay in {galaxy}" (gameplay/player-copy.md).
    "Stay in Sunflower",
    "The galaxy map opened in flight offers Stay in on the galaxy Ada is flying in",
  );
  assert.equal(
    (await galaxyMap.locator("h2").textContent())?.trim(),
    CONTENT.labels.galaxyNumber.replace("{number}", "1"),
    "The galaxy map opens on Sunflower, where Ada is flying",
  );
  // No close X or Back: the single destination action, back and Escape leave the galaxy map.
  assert.equal(
    await galaxyMap.locator('[data-action="close-galaxies"], .ada-close').count(),
    0,
    "The galaxy map has no close X or Back",
  );
  // The galaxy map at 844x390, without and with phone insets.
  const viewportBefore = page.viewportSize();
  await page.setViewportSize({ height: 390, width: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/galaxy-map-844.png` });
  const setInsets = (logical) =>
    page.evaluate((insets) => {
      const unit = Number(
        getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
      );
      for (const [side, value] of Object.entries(insets)) {
        if (value === null) {
          document.documentElement.style.removeProperty(`--inset-${side}`);
        } else {
          document.documentElement.style.setProperty(`--inset-${side}`, `${value * unit}px`);
        }
      }
    }, logical);
  await setInsets({ bottom: 19, left: 43, right: 43, top: 0 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/galaxy-map-844-insets.png` });
  await setInsets({ bottom: null, left: null, right: null, top: null });
  if (viewportBefore) {
    await page.setViewportSize(viewportBefore);
  }
  // Stay in {galaxy}: the destination action on the galaxy Ada is flying in returns to the local
  // map the galaxy map opened from, focus on its Galaxies, the same flight kept with no jump.
  await galaxyMap.locator('[data-action="galaxy-jump"]').click();
  await galaxyMap.waitFor({ state: "hidden" });
  assert.ok(await localMap.isVisible(), "Stay in returns to the local map");
  assert.equal(await focusedAction(), "map-galaxies", "Focus returns to the local map's Galaxies");
  const flightAfter = await flightSaved();
  assert.ok(
    flightBefore &&
      flightAfter &&
      flightAfter.seed === flightBefore.seed &&
      flightAfter.galaxy === flightBefore.galaxy,
    `Stay in keeps the same flight: ${JSON.stringify([flightBefore?.seed, flightAfter?.seed])}`,
  );
  // Escape closes the galaxy map back to the local map too, focus again on Galaxies.
  await localMap.locator('[data-action="map-galaxies"]').click();
  await galaxyMap.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await galaxyMap.waitFor({ state: "hidden" });
  assert.ok(await localMap.isVisible(), "Escape closes the galaxy map back to the local map");
  assert.equal(await focusedAction(), "map-galaxies", "Escape returns focus to Galaxies");
  // Jump to another unlocked galaxy: Right moves the ship to Whirlpool, where the action reads Jump to
  // Whirlpool, and
  // the flight there begins.
  await localMap.locator('[data-action="map-galaxies"]').click();
  await galaxyMap.waitFor({ state: "visible" });
  await galaxyMap.locator('[data-action="galaxy-jump"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    (label) =>
      document.querySelector('.ada-route[data-dialog="galaxies"] h2')?.textContent?.trim() ===
      label,
    CONTENT.labels.galaxyNumber.replace("{number}", "2"),
  );
  assert.equal(
    (await galaxyMap.locator('[data-action="galaxy-jump"]').textContent())?.trim(),
    "Jump to Whirlpool",
    "The destination action reads Jump to Whirlpool on another open galaxy",
  );
  await galaxyMap.locator('[data-action="galaxy-jump"]').click();
  await galaxyMap.waitFor({ state: "hidden" });
  const jumped = await page
    .waitForFunction(
      (key) => {
        const saved = JSON.parse(localStorage.getItem(key));
        return saved?.mode === "space" && saved.flight?.galaxy === 3;
      },
      storageKey,
      { timeout: 15000 },
    )
    .then(
      () => true,
      () => false,
    );
  assert.ok(jumped, "Jump to another galaxy from the galaxy map ends in Whirlpool's flight");
  // Earth: the flight ends with the jump home.
  await openPause();
  await page.locator('[data-action="pause-map"]').click();
  await localMap.locator('[data-action="map-galaxies"]').click();
  await galaxyMap.waitFor({ state: "visible" });
  await chooseEarth(galaxyMap, "Jump to Earth");
  await page
    .locator(".ada-story-panel:not(.ada-dialogue-panel):not([hidden])")
    .getByText(CONTENT.labels.pickUpRock, { exact: true })
    .waitFor({ state: "visible" });
  const roomSaved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.ok(
    roomSaved.mode === "home" && roomSaved.flight === null,
    "The galaxy map's Earth ends the flight, saved",
  );
  events.checks.push(
    "The local map's Galaxies opens the galaxy map on the galaxy Ada is flying in, with Stay in " +
      "and no close X; Stay in and Escape return to the local map on the same flight with focus " +
      "on Galaxies, Jump to another galaxy flies there, and Earth ends the flight home",
  );
  // Ada's room page is not pausable: its entry is the Menu at the pause button's place, holding
  // Achievements, Settings and Back to title above Close (gameplay/rules.md "Start, Home and Space").
  const roomMenu = menuDisc();
  await roomMenu.waitFor({ state: "visible" });
  const roomMenuBox = await roomMenu.boundingBox();
  const game = await page.locator("canvas").first().boundingBox();
  assert.ok(
    roomMenuBox &&
      game &&
      roomMenuBox.x - game.x < game.width / 4 &&
      roomMenuBox.y - game.y < game.height / 4,
    "Ada's room page shows the Menu at the game area's top left",
  );
  await openMenu();
  assert.deepEqual(
    await menuActionIds(),
    ["menu-achievements", "menu-settings", "menu-backToTitle", "menu-close"],
    "Ada's room page's Menu holds Achievements, Settings, Back to title, then Close",
  );
  await page.screenshot({ path: `${output}/menu-room.png` });
  await page.keyboard.press("Escape");
  await menuCard().waitFor({ state: "hidden" });
  await openMenu();
  // The X sits in the card's frame, outside its section.
  await page.locator('[data-action="close-menu"]').click();
  await menuCard().waitFor({ state: "hidden" });
  await openMenu();
  await menuCard().locator('[data-action="menu-backToTitle"]').click();
  await page.locator('[data-action="continue"]').waitFor({ state: "visible" });
  events.checks.push(
    "Back to title keeps a flight in danger with progress saved and no sleep scene, and " +
      "Continue resumes it; the galaxy map's Earth lands on Ada's room page, whose Menu holds " +
      "Achievements, Settings and Back to title above Close, closing on Escape and its X",
  );
  // The mining hub is a station: Use deposits the ore Ada carries, then docks, and once
  // Cartwheel's space quest is complete the shop's Ship tab heads with the holodisk.
  // Cartwheel's story is resolved before its flight starts, as src/model/hubStation.test.ts does,
  // so the world holds the hub with no capital encounter planned around it.
  const hubInput = new GameModel(CONTENT);
  hubInput.state.unlocked = [1, 2];
  Object.assign(hubInput.state.progress[2], {
    introduced: true,
    questComplete: true,
    resolved: true,
    stage: 5,
  });
  hubInput.startGalaxy(2);
  playOpening(hubInput);
  hubInput.state.dialogue = null;
  Object.assign(hubInput.state.progress[2], { known: ["hub"], stations: ["hub"] });
  const hubFlight = hubInput.state.flight;
  delete hubFlight.storyScene;
  hubFlight.objects = hubFlight.objects.filter(({ kind }) => kind !== "enemy");
  hubFlight.shots = [];
  const hubAt = ensureDestination(CONTENT, "hub", hubFlight);
  hubFlight.player = { x: hubAt.x + 100, y: hubAt.y };
  hubFlight.velocity = { x: 0, y: 0 };
  hubFlight.dangerFor = 0;
  hubFlight.cargo = 4;
  hubInput.state.economy.stardust = 600;
  assert.equal(hubInput.contextAction, "deposit", "The hub fixture starts with ore to deposit");
  await seedOnce(hubInput.save(), "ada-browser.hub-station.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await tapUse(CONTENT.labels.deposit);
  // Depositing opens Astra's Interaction card; leaving it offers Dock.
  await interactionCard().waitFor({ state: "visible" });
  await leaveInteraction();
  await tapUse(CONTENT.labels.dock);
  await page.locator('[data-action="open-shop"]').waitFor({ state: "visible" });
  await page.locator('[data-action="open-shop"]').click();
  await page.locator('[data-tab="ship"]').click();
  await page.getByText(CONTENT.labels.holodiskAbout, { exact: true }).waitFor({ state: "visible" });
  const hubSaved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.equal(hubSaved.docked, "hub", "Dock at the hub opens its station card");
  assert.equal(hubSaved.progress[2].deposited, hubInput.state.progress[2].deposited + 4);
  await page.screenshot({ path: `${output}/hub-station-shop.png` });
  events.checks.push(
    "The mining hub deposits the ore Ada carries, then docks with Use, and its shop's Ship tab " +
      "heads with the holodisk once Cartwheel's space quest is complete",
  );
  // Towing never refuses the local map's Galaxies; leaving the galaxy from the galaxy map ends the
  // flight with the held rescue still held, its craft back where it was stranded.
  const { ensureStation } = await import(new URL("../src/model/flight.ts", import.meta.url));
  const towInput = relaunch(CONTENT, roomInput.save());
  const towFlight = towInput.state.flight;
  // The nearest station whose board offers a rescue.
  let rescue;
  for (const site of stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 }).sort(
    (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
  )) {
    ensureStation(CONTENT, site.id, towFlight);
    towFlight.player = { x: site.x, y: site.y };
    towInput.state.docked = site.id;
    rescue = towInput.jobBoard().find((row) => row.type === "rescue");
    if (rescue) {
      break;
    }
  }
  assert.ok(rescue, "A station near the origin offers a rescue");
  assert.equal(towInput.acceptJob(rescue.id), "accepted", "A rescue is accepted for the tow");
  towInput.undock();
  const still = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  const towTarget = towInput.state.tasks[1].target;
  towFlight.objects = towFlight.objects.filter(({ kind }) => kind !== "enemy");
  towFlight.player = { x: towTarget.x + 100, y: towTarget.y };
  towFlight.velocity = { x: 0, y: 0 };
  towFlight.dangerFor = 0;
  towInput.state.dialogue = null;
  towInput.step(0.05, { ...still, use: true });
  assert.ok(towInput.towing, "The fixture is towing");
  // Clear of the stranded site's hostiles, the tow line still attached. The world comes from the
  // launch's random seed, so a drone pack can patrol near any one spot: the fixture takes the
  // first of several spots 2500 away where the flight, resumed from the calm save, stays out of
  // danger for 10 s in the model, which steps the same world as the browser. At each, one step
  // generates the space around the spot, then its drones, hazards, drifting debris and shots go,
  // and the save holds no enemies to load, as the calm launched world.
  const towBase = towInput.save();
  const calmTowAt = ([dx, dy]) => {
    const trial = relaunch(CONTENT, towBase);
    const flight = trial.state.flight;
    for (const at of [flight.player, flight.tow]) {
      at.x += dx;
      at.y += dy;
    }
    flight.velocity = { x: 0, y: 0 };
    trial.step(0.05, still);
    flight.objects = flight.objects.filter(
      ({ kind }) => kind !== "enemy" && kind !== "hazard" && kind !== "debris",
    );
    flight.shots = flight.shots.filter((shot) => !shot.enemy);
    flight.dangerFor = 0;
    trial.state.dialogue = null;
    const calm = JSON.parse(trial.save());
    for (const [id, object] of Object.entries(calm.flight.world.notables)) {
      if (object?.kind === "enemy") {
        delete calm.flight.world.notables[id];
      }
    }
    if (calm.flight.combat) {
      calm.flight.combat.initialPackSizes = {};
      delete calm.flight.combat.unloadedPackMembers;
    }
    const resumed = relaunch(CONTENT, JSON.stringify(calm));
    const quiet = (steps) => {
      if (steps === 0) {
        return true;
      }
      resumed.state.dialogue = null;
      resumed.step(0.05, still);
      return !resumed.inDanger && quiet(steps - 1);
    };
    return trial.towing && quiet(200) ? calm : null;
  };
  const towCalm = [
    [-2500, 0],
    [2500, 0],
    [0, -2500],
    [0, 2500],
    [-1800, -1800],
    [1800, 1800],
  ].reduce((found, offset) => found ?? calmTowAt(offset), null);
  assert.ok(towCalm, "A spot 2500 from the stranded site keeps the towing flight out of danger");
  const towRestored = restoreCalm(towCalm);
  assert.ok(
    towRestored?.flight?.tow,
    "The calm tow fixture remains a canonical save, still towing",
  );
  await seedOnce(JSON.stringify(towCalm), "ada-browser.tow-earth.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await openPause();
  await page.locator('[data-action="pause-map"]').click();
  const towGalaxies = page.locator('[data-dialog="map"] [data-action="map-galaxies"]');
  const towDisabled = await towGalaxies.getAttribute("aria-disabled");
  // What put Ada in danger, if anything did: the paused flight's engaged enemies and enemy shots.
  const towDanger =
    towDisabled === null
      ? null
      : await page.evaluate((key) => {
          const { flight } = JSON.parse(localStorage.getItem(key));
          const near = (at) => Math.hypot(at.x - flight.player.x, at.y - flight.player.y);
          return {
            dangerFor: flight.dangerFor,
            enemies: flight.objects
              .filter((object) => object.kind === "enemy")
              .map((object) => ({
                distance: Math.round(near(object)),
                engaged: object.enemy?.engaged,
                id: object.id,
                routeId: object.routeId,
              })),
            shots: flight.shots.filter((shot) => shot.enemy).length,
          };
        }, storageKey);
  assert.equal(towDisabled, null, `Towing keeps Galaxies available: ${JSON.stringify(towDanger)}`);
  await towGalaxies.click();
  const towGalaxyMap = page.locator('.ada-route[data-dialog="galaxies"]');
  await towGalaxyMap.waitFor({ state: "visible" });
  await chooseEarth(towGalaxyMap, "Jump to Earth");
  await page
    .locator(".ada-story-panel:not(.ada-dialogue-panel):not([hidden])")
    .getByText(CONTENT.labels.pickUpRock, { exact: true })
    .waitFor({ state: "visible" });
  const towed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  assert.ok(
    towed.flight === null &&
      towed.tasks["1"]?.id === rescue.id &&
      towed.tasks["1"]?.target?.x === towTarget.x &&
      towed.tasks["1"]?.target?.y === towTarget.y,
    "Leaving the galaxy while towing ends the flight, the rescue held and its craft where stranded",
  );
  events.checks.push(
    "The local map's Galaxies stays available while towing; leaving the galaxy from the galaxy " +
      "map ends the flight, the rescue still held with its craft where it was stranded",
  );
  // Station keepers (gameplay/rules.md "Generic station keeper interface and copy", art/layout.md
  // "Station card"): the station card is the story panel with the keeper's name tab, portrait and
  // greeting line, Jobs, the single primary Shop, Next line and Undock. The first docking's three
  // introduction lines step on with Next line, which then goes with Shop focused; a later docking
  // shows one return line without Next line. The model supplies the name and every line.
  const keeperInput = relaunch(CONTENT, roomInput.save());
  const keeperFlight = keeperInput.state.flight;
  const [keeperSite] = stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 }).sort(
    (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
  );
  ensureStation(CONTENT, keeperSite.id, keeperFlight);
  keeperInput.state.progress[1].stations = [
    ...new Set([...keeperInput.state.progress[1].stations, keeperSite.id]),
  ];
  keeperInput.state.progress[1].greetings = {};
  keeperFlight.objects = keeperFlight.objects.filter(({ kind }) => kind === "station");
  keeperFlight.shots = [];
  keeperFlight.player = { x: keeperSite.x, y: keeperSite.y };
  keeperFlight.velocity = { x: 0, y: 0 };
  keeperFlight.dangerFor = 0;
  keeperInput.state.dialogue = null;
  keeperInput.state.docked = null;
  const modelDock = relaunch(CONTENT, keeperInput.save());
  modelDock.interact();
  const firstGreeting = [];
  const readGreeting = (remaining = 5) => {
    const greeting = modelDock.stationGreeting;
    if (!greeting || remaining === 0) {
      return;
    }
    firstGreeting.push(greeting.line);
    if (greeting.index < greeting.count - 1) {
      modelDock.advanceGreeting();
      readGreeting(remaining - 1);
    }
  };
  readGreeting();
  const keeperName = modelDock.stationGreeting?.displayName;
  modelDock.undock();
  modelDock.interact();
  const laterLine = modelDock.stationGreeting?.line;
  assert.ok(
    firstGreeting.length === 3 && keeperName && laterLine,
    `The model docks at the keeper's station: ${JSON.stringify({ firstGreeting, keeperName, laterLine })}`,
  );
  await seedOnce(keeperInput.save(), "ada-browser.keeper.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  const stationCard = page.locator('[data-dialog="station"]');
  const nextLine = stationCard.getByRole("button", { name: CONTENT.labels.nextLine, exact: true });
  // Docks with the keyboard's Use. E switches flight to the desktop controls, which hide the Use
  // disc, so the offer is read from the disc's action rather than its visibility.
  const dockHere = async () => {
    await page.locator('.ada-use[data-use="dock"]').waitFor({ state: "attached" });
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("KeyE");
    await stationCard.waitFor({ state: "visible" });
  };
  const keeperShown = async () => ({
    ...(await stationCard.evaluate((card) => ({
      focused: document.activeElement?.dataset.action ?? null,
      line: card.querySelector(".ada-story-paragraph")?.textContent ?? "",
      primaries: [...card.querySelectorAll("button.ada-primary")].map(
        (button) => button.dataset.action ?? "",
      ),
      tab: card.querySelector(".ada-story-tab")?.textContent ?? "",
    }))),
    next: await nextLine.isVisible(),
  });
  await dockHere();
  await page.screenshot({ path: `${output}/station-keeper.png` });
  const first = await keeperShown();
  assert.deepEqual(
    { line: first.line, next: first.next, primaries: first.primaries, tab: first.tab },
    { line: firstGreeting[0], next: true, primaries: ["open-shop"], tab: keeperName },
    "The first docking shows the keeper's name and first line, Next line, and Shop as the primary",
  );
  await nextLine.click();
  const second = await keeperShown();
  await nextLine.focus();
  await page.keyboard.press("Enter");
  const third = await keeperShown();
  assert.deepEqual(
    [second, third].map(({ line, next }) => ({ line, next })),
    [
      { line: firstGreeting[1], next: true },
      { line: firstGreeting[2], next: false },
    ],
    "A tap or Enter on Next line shows the next line; after the third it goes",
  );
  assert.equal(third.focused, "open-shop", "Focus moves to Shop once Next line goes");
  await stationCard.locator('[data-action="undock"]').click();
  await stationCard.waitFor({ state: "hidden" });
  await dockHere();
  const later = await keeperShown();
  assert.deepEqual(
    { line: later.line, next: later.next, tab: later.tab },
    { line: laterLine, next: false, tab: keeperName },
    "A later docking shows one return line without Next line",
  );
  await stationCard.locator('[data-action="undock"]').click();
  await stationCard.waitFor({ state: "hidden" });
  events.checks.push(
    "The station card shows the keeper's name, portrait and greeting with Shop as its primary; " +
      "the first docking's three lines step on with Next line, which then goes with Shop " +
      "focused, and a later docking shows one return line",
  );
  await seedOnce(safeSerialized, "ada-browser.after-save-proof.v1");
  await page.locator('#game-status[data-mode="space"]').waitFor({ state: "attached" });
  await page.setViewportSize({ width: 844, height: 390 });
  const narrowHud = await touchHudProof("844x390");
  assert.deepEqual(
    narrowHud.clamped,
    { aim: false, bottom: false, move: false },
    "At 844x390 the rings sit 50 from the screen's sides and 50 from its bottom, unclamped",
  );
  events.checks.push(
    "At 844x390 the sticks' rings sit 50 in from the screen's sides and 50 from its bottom, " +
      "the shield pill on its own line",
  );
  // Compare observable flight response, not the implementation's stick sampling formula. Travel is
  // in logical px, --ada-unit CSS px each.
  const stickUnit = await page
    .locator("#app")
    .evaluate((app) => Number(getComputedStyle(app).getPropertyValue("--ada-unit")));
  async function analogRun(logical, marker) {
    const distance = logical * stickUnit;
    await seedOnce(safeSerialized, marker);
    const target = await settledBox('[data-control="move-joystick"]');
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
  const bounds = await settledBox('[data-control="move-joystick"]');
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
  const moveBounds = await settledBox('[data-control="move-joystick"]');
  const aimBounds = await settledBox('[data-control="aim-joystick"]');
  assert.ok(moveBounds && aimBounds, "Both real joystick targets must be present");
  await assertNoTapFlash(
    [
      '[data-control="move-joystick"]',
      '[data-control="aim-joystick"]',
      ".ada-pause",
      ".ada-weapon",
      ".ada-weapon .ada-disc",
    ],
    "Flight",
  );
  events.checks.push(
    "The start screen's discs and Start, the sticks, pause and weapon discs, and the Map's " +
      "controls draw no tap flash",
  );
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

  const equipment = relaunch(CONTENT, safeSerialized);
  equipment.state.flight.ownedWeapons = ["rapidMissile", "multiLaser"];
  // Each with a new weapon's three packs.
  Object.assign(equipment.state.flight.ammo, { multiLaser: 600, rapidMissile: 600 });
  equipment.state.flight.weapon = "laser";
  const equipmentSave = equipment.save();
  assert.deepEqual(relaunch(CONTENT, equipmentSave).state, equipment.state);
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
  // The next switch waits after this one: a second switch inside that 1 s wait plays the refusal
  // cue. The flight applies a switch on its next step, so the second press waits for the first to
  // show, or both could land in one frame before the wait starts.
  await page.waitForFunction(
    () =>
      document.querySelector('[data-weapon="rapidMissile"]')?.getAttribute("aria-pressed") ===
      "true",
    null,
    { timeout: 1000 },
  );
  await page.locator('[data-weapon="multiLaser"]').click();
  // The kit's refusal cue marks the pressed icon red with its data-ui-refusal-red attribute.
  await page.waitForFunction(
    () => document.querySelector('[data-weapon="multiLaser"]')?.hasAttribute("data-ui-refusal-red"),
    null,
    { timeout: 2000 },
  );
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "rapidMissile",
    storageKey,
  );
  assert.equal(await missileButton.getAttribute("aria-pressed"), "true");
  assert.equal(
    await page.locator('[data-weapon="multiLaser"]').getAttribute("aria-pressed"),
    "false",
    "A switch during the wait after the last one must be refused",
  );
  assert.equal(
    await page.locator(".flight-hud").count(),
    0,
    "The removed top-left information HUD must not be recreated",
  );
  // Each weapon masks its own 20px glyph.
  const { weaponGlyphPath } = await import(new URL("../src/data/weaponGlyphs.ts", import.meta.url));
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
  assert.equal(weaponImages.length, 3, "Laser and both owned upgrades require weapon glyphs");
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
  await continueFlight();
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
  // The saved switch wait from the Rapid Missile switch runs out in play first.
  await page.waitForTimeout(1200);
  await page.locator('[data-weapon="multiLaser"]').click();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).flight.weapon === "multiLaser",
    storageKey,
  );
  const liftFire = await holdAimRight();
  try {
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).flight.shots.some((shot) => !shot.enemy),
      storageKey,
    );
  } finally {
    await liftFire();
  }
  assert.equal(
    (await readSave()).flight.weapon,
    "multiLaser",
    "Firing must not consume an upgrade",
  );
  const meter = page.getByRole("meter", { name: CONTENT.labels.shield, exact: true });
  assert.equal(Number(await meter.getAttribute("aria-valuenow")), CONTENT.tuning.shieldMax);
  const pill = await settledBox(".ada-status");
  const pauseBox = await settledBox('[data-action="pause"]');
  const bar = await meter.boundingBox();
  // The DOM UI is sized in logical px: --ada-unit CSS px each.
  const unit = await page
    .locator("#app")
    .evaluate((app) => Number(getComputedStyle(app).getPropertyValue("--ada-unit")));
  // The shield sits apart in its pill at the bottom centre (src/data/layout.ts SHIELD_PILL), its
  // Shield level 1 bar inside it, centred across the canvas.
  const shieldLayout = await import(new URL("../src/ui/layout/playView.ts", import.meta.url));
  const { SPACING } = await import(new URL("../src/data/layout.ts", import.meta.url));
  const shieldSize = {
    barHeight: shieldLayout.SHIELD_PILL.bar.height,
    barWidth: shieldLayout.shieldBarWidth(1),
    pillHeight: shieldLayout.SHIELD_PILL.pill.height,
    pillWidth: shieldLayout.shieldPillWidth(1),
  };
  const canvasBox = await settledBox("#game-canvas > canvas");
  const shieldPill = await settledBox(".ada-shield");
  assert.ok(
    bar &&
      pill &&
      canvasBox &&
      shieldPill &&
      Math.abs(shieldPill.width - shieldSize.pillWidth * unit) <= 1 &&
      Math.abs(shieldPill.height - shieldSize.pillHeight * unit) <= 1 &&
      bar.x > shieldPill.x &&
      bar.x + bar.width < shieldPill.x + shieldPill.width &&
      Math.abs(shieldPill.x + shieldPill.width / 2 - (canvasBox.x + canvasBox.width / 2)) <= 1 &&
      Math.abs(bar.width - shieldSize.barWidth * unit) <= 1 &&
      Math.abs(bar.height - shieldSize.barHeight * unit) <= 1 &&
      Math.abs(pill.height - shieldSize.pillHeight * unit) <= 1 &&
      bar.y > canvasBox.y + canvasBox.height / 2,
    `The shield meter must be the shield pill's bar at the bottom centre: ${JSON.stringify({
      bar,
      canvasBox,
      pill,
      shieldPill,
      shieldSize,
      unit,
    })}`,
  );
  if (pauseBox && (await page.locator('[data-action="pause"]').isVisible())) {
    assert.ok(
      Math.abs(pill.x - (pauseBox.x + pauseBox.width + SPACING.gap * unit)) <= 1,
      "The status pill must sit a gap right of the pause press area",
    );
  }
  const pauseButton = page.locator('[data-action="pause"]');
  assert.equal(await pauseButton.getAttribute("aria-label"), CONTENT.labels.pause);
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
  const savedAmmo = (await readSave()).flight.ammo;
  assert.ok(
    savedAmmo.rapidMissile === 600 && savedAmmo.multiLaser < 600,
    `Saves carry each upgrade's ammunition, one shot spent per volley: ${JSON.stringify(savedAmmo)}`,
  );
  save("weapon-icons-proof.json", { pauseImage, weaponImages });
  await page.screenshot({ path: `${output}/weapon-shield.png` });
  events.checks.push(
    "Owned upgrade weapons support accessible selection, the switch wait's refusal, saved " +
      "ammunition, reload, modal guards and the bottom-centre shield meter",
  );
  // The status pill's width follows its counts (art/layout.md "Status pill"): 36 plus the
  // Stardust slot, ore 37 plus its slot, cargo or tow 33; each slot the count's width in
  // Liberation Sans Bold at 16 px (digits and k 1139/2048 em, m 1821/2048, the point 569/2048),
  // at least one digit. Its left edge stays put while its right edge follows a small and a large
  // Stardust count.
  const countAdvance = (character) => (({ ".": 569, m: 1821 })[character] ?? 1139) * (16 / 2048);
  const countSlot = (text) =>
    Math.max(
      countAdvance("0"),
      [...text].reduce((sum, c) => sum + countAdvance(c), 0),
    );
  const pillAt = async (stardust, marker) => {
    const model = relaunch(CONTENT, safeSerialized);
    model.state.economy.stardust = stardust;
    await seedOnce(model.save(), marker);
    await settledBox(".ada-status");
    const shown = await page.locator(".ada-status").evaluate((pill) => {
      const unit = Number(
        getComputedStyle(document.getElementById("app")).getPropertyValue("--ada-unit"),
      );
      const box = pill.getBoundingClientRect();
      const visible = (selector) => !pill.querySelector(selector).hidden;
      return {
        aboard: visible(".ada-status-aboard"),
        left: box.left / unit,
        ore: visible(".ada-status-ore-slot")
          ? pill.querySelector(".ada-status-ore-count").textContent
          : null,
        stardust: pill.querySelector(".ada-status-stardust-count").textContent,
        transition: getComputedStyle(pill).transitionProperty,
        width: box.width / unit,
      };
    });
    const expected =
      36 +
      countSlot(shown.stardust) +
      (shown.ore === null ? 0 : 37 + countSlot(shown.ore)) +
      (shown.aboard ? 33 : 0);
    assert.ok(
      Math.abs(shown.width - expected) < 0.5,
      `The status pill is ${expected} wide for its counts: ${JSON.stringify(shown)}`,
    );
    await page.locator(".ada-status").screenshot({ path: `${output}/${marker}.png` });
    return { ...shown, expected };
  };
  const smallPill = await pillAt(7, "status-pill-small");
  const largePill = await pillAt(44_449, "status-pill-large");
  assert.equal(smallPill.stardust, "7");
  assert.equal(largePill.stardust, "44.4k");
  assert.ok(Math.abs(largePill.left - smallPill.left) < 0.01, "The pill's left edge stays put");
  assert.ok(
    Math.abs(largePill.width - smallPill.width - (countSlot("44.4k") - countSlot("7"))) < 0.5,
    `Only the right edge moves, by the Stardust slot's growth: ${JSON.stringify({ largePill, smallPill })}`,
  );
  save("status-pill-proof.json", { largePill, smallPill });
  events.checks.push("The status pill grows with its counts, its left edge fixed");

  const damaged = relaunch(CONTENT, equipmentSave);
  assert.ok(damaged.selectWeapon("rapidMissile"));
  // Damage is meaningful only outside the friendly destination's protected region.
  damaged.state.flight.player.x += CONTENT.tuning.safeRadius * 2;
  assert.ok(
    damaged.state.flight.objects
      .filter((object) => object.kind === "destination")
      .every(
        (destination) =>
          Math.hypot(
            destination.x - damaged.state.flight.player.x,
            destination.y - damaged.state.flight.player.y,
          ) > CONTENT.tuning.safeRadius,
      ),
    "Projectile fixture must be outside every active protected destination",
  );
  damaged.state.flight.shield = CONTENT.tuning.hazardDamage;
  damaged.state.flight.shots.push({
    ...damaged.state.flight.player,
    damage: CONTENT.tuning.hazardDamage,
    enemy: true,
    hitIds: [],
    id: "browser-shield-break",
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
  });
  damaged.state.economy.stardust = 30;
  // The flight a step before the shield breaks, for the browser's own jump home below.
  const breakingSave = damaged.save();
  const carriedOre = damaged.state.flight.cargo;
  damaged.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
  assert.equal(damaged.state.mode, "home", "Shield depletion must jump Ada home");
  assert.equal(damaged.state.flight, null, "The jump home must lose only the flight");
  assert.deepEqual(damaged.state.economy.ownedWeapons, ["rapidMissile", "multiLaser"]);
  assert.equal(damaged.state.economy.weapon, "rapidMissile", "The equipped weapon must stay");
  assert.equal(damaged.state.economy.stardust, 30, "The jump home must cost no Stardust");
  const oreLost = Math.ceil(carriedOre / 2) < carriedOre;
  const jumpPage = damaged.storyView?.page.text ?? "";
  assert.ok(
    jumpPage.includes(CONTENT.labels.jumpHome) &&
      jumpPage.includes(CONTENT.labels.jumpHomeOreLost) === oreLost &&
      !jumpPage.includes("cost"),
    `The jump home page must name the ore loss only when ore was lost, and no fee: ${jumpPage}`,
  );
  const damageSave = damaged.save();
  assert.deepEqual(relaunch(CONTENT, damageSave).state, damaged.state);
  save("shield-break-fixture.json", {
    scope: "Real-model projectile damage before restore, not a natural browser combat playthrough",
    state: JSON.parse(damageSave),
  });
  await seedOnce(damageSave, "ada-browser.shield-break.v1");
  await page.locator('#game-status[data-mode="home"]').waitFor({ state: "attached" });
  const jumpNotice = await page.locator("#game-status").textContent();
  assert.ok(
    !jumpNotice.includes(CONTENT.labels.jumpHome),
    `The jump-home line shows on its page only, never as a restored notice: ${jumpNotice}`,
  );
  events.checks.push(
    "Canonical shield depletion jumps Ada home, costing only the flight and keeping weapons and Stardust",
  );

  // Art's overnight room (art/storybook.md "Sleep scene overlay" and "Sequence"): the shield breaks
  // in the browser, the jump lands aboard in the emergency red, and the sleep page plays the
  // unoccupied night room, the rock's one breath and the cross-fade to the environment-only
  // morning, with no figures or waking sprite; morning follows.
  await seedOnce(breakingSave, "ada-browser.overnight.v1");
  const storyNext = () =>
    page.locator(
      '.ada-story-panel:not(.ada-dialogue-panel):not([hidden]) [data-action="story-next"]',
    );
  const roomShows = (background) =>
    page
      .locator(`.ada-story-background[data-background="${background}"]`)
      .waitFor({ state: "attached", timeout: 30000 });
  await roomShows("aboardEmergency");
  await storyNext().waitFor({ state: "visible", timeout: 30000 });
  // The emergency jump's overlay ends before the jump-home page is captured.
  await page.waitForFunction(() => !document.querySelector(".ada-jump"), null, { timeout: 30000 });
  await page.waitForFunction(() =>
    document.querySelector(".ada-story-art")?.style.backgroundImage.includes("aboard-emergency"),
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/overnight-aboard-emergency.png` });
  await storyNext().click();
  const sleepStart = Date.now();
  await roomShows("adaRoomSleep");
  await page
    .locator('.ada-story-overlay[data-overlay="story-ada-room-sleep-glow"]')
    .waitFor({ state: "attached" });
  // Midway through the breath: the glow near its peak (400 + 750 ms).
  await page.waitForTimeout(Math.max(0, 1150 - (Date.now() - sleepStart)));
  const sleepState = await page.evaluate(() => {
    const opacity = (id) =>
      Number(getComputedStyle(document.querySelector(`[data-overlay="${id}"]`)).opacity);
    return {
      glow: opacity("story-ada-room-sleep-glow"),
      overlays: [...document.querySelectorAll(".ada-story-overlay")].map(
        (node) => node.dataset.overlay,
      ),
      panelHidden: document.querySelector(".ada-story-panel:not(.ada-dialogue-panel)").hidden,
    };
  });
  await page.screenshot({ path: `${output}/overnight-sleep.png` });
  // Midway through the cross-fade to morning: the incoming image is the morning room alone.
  const fadeState = await (
    await page.waitForFunction(
      () => {
        const incoming = document.querySelectorAll(".ada-story-art")[1];
        const opacity = incoming ? Number(getComputedStyle(incoming).opacity) : 0;
        return (
          incoming?.style.backgroundImage.includes("ada-room-morning") &&
          opacity > 0.2 &&
          opacity < 0.8 && {
            incoming: incoming.style.backgroundImage,
            opacity,
            overlays: [...incoming.querySelectorAll(".ada-story-overlay")].map(
              (node) => node.dataset.overlay,
            ),
          }
        );
      },
      null,
      { polling: "raf" },
    )
  ).jsonValue();
  await page.screenshot({ path: `${output}/overnight-waking-fade.png` });
  await roomShows("adaRoomMorningCats");
  const sleptMs = Date.now() - sleepStart;
  await storyNext().waitFor({ state: "visible" });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${output}/overnight-morning.png` });
  const morning = {
    art: await page
      .locator(".ada-story-art")
      .first()
      .evaluate((art) => art.style.backgroundImage),
    overlays: await page
      .locator(".ada-story-overlay:not([hidden])")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.overlay)),
  };
  save("overnight-proof.json", {
    fadeState,
    morning,
    scope: "The browser's own shield break and jump home, then Art's overnight sequence",
    sleepState,
    sleptMs,
  });
  assert.deepEqual(
    sleepState.overlays,
    ["story-ada-room-sleep-glow"],
    "The sleep page's only overlay is the rock's glow, over the unoccupied night room",
  );
  assert.ok(sleepState.glow > 0.5, `The rock's breath must near its peak: ${sleepState.glow}`);
  assert.ok(sleepState.panelHidden, "The sleep page shows no panel");
  assert.ok(
    sleptMs >= 2300 && sleptMs < 4500,
    `The sleep page must last Art's 2.5 s sequence: ${sleptMs} ms`,
  );
  assert.ok(
    morning.art.includes("ada-room-morning"),
    `Morning must draw Art's room: ${morning.art}`,
  );
  assert.ok(
    fadeState.incoming.includes("ada-room-morning") &&
      fadeState.opacity > 0 &&
      fadeState.opacity < 1,
    `The capture falls inside the cross-fade to morning: ${JSON.stringify(fadeState)}`,
  );
  // The morning background is environment only: no waking sprite or figures fade in with it.
  assert.deepEqual(fadeState.overlays, [], "Nothing but the morning room fades in");
  assert.deepEqual(
    morning.overlays,
    [],
    "The cross-fade to morning ends the night's glow and adds no figures",
  );
  events.checks.push(
    "The browser's jump home lands in Art's unoccupied night room, plays the rock's breath and " +
      "the cross-fade, and wakes in the environment-only morning room",
  );

  // A story run (gameplay/rules.md "Earth scenes"): from Start, Previous on the prologue's first
  // page returns across Grandma's garden into chapter one's opening, Skip from a mid-prologue page aboard
  // passes the rest of the run to galaxy selection, and Stay on Earth lands on Ada's room page,
  // which starts its run and, like every page with Next or a named action, offers Skip.
  await seedOnce(new GameModel(CONTENT).save(), "ada-browser.story-run.v1");
  await page.locator('[data-action="start"]').click();
  const storyPanel = page.locator(".ada-story-panel:not(.ada-dialogue-panel):not([hidden])");
  const storyButton = (action) => storyPanel.locator(`[data-action="story-${action}"]`);
  const storyPage = async () => ({
    background: await page.locator(".ada-story-background").getAttribute("data-background"),
    // Unavailable Previous is hidden without a slot (art/layout.md "Station card").
    previousShown: await storyButton("previous").isVisible(),
    skipShown: await page.locator('[data-action="story-skip"]').isVisible(),
    text: ((await storyPanel.locator(".ada-story-paragraph").textContent()) ?? "").trim(),
  });
  const showsText = (text) =>
    storyPanel.locator(".ada-story-paragraph", { hasText: text }).waitFor();
  await showsText(CONTENT.premise.gardenArrival[0].text);
  const opening = await storyPage();
  // Next through each page in turn, each shown before the next press.
  async function nextThrough(texts) {
    if (texts.length === 0) {
      return;
    }
    await storyButton("next").click();
    await showsText(texts[0]);
    await nextThrough(texts.slice(1));
  }
  // Next until the page with this text shows.
  async function nextTo(text, remaining = 30) {
    if ((await storyPage()).text === text) {
      return;
    }
    assert.ok(remaining > 0, `The story run must reach "${text}"`);
    await storyButton("next").click();
    await page.waitForTimeout(50);
    await nextTo(text, remaining - 1);
  }
  await nextThrough(CONTENT.premise.gardenArrival.slice(1).map(({ text }) => text));
  await storyButton("next").click();
  await storyButton("choice").first().click();
  await showsText(CONTENT.chapters[1].openingBranches[0]);
  await storyButton("next").click();
  await showsText(CONTENT.premise.gardenFarewell.text);
  await storyButton("next").click();
  await showsText(CONTENT.premise.prologue[0].text);
  const prologue = await storyPage();
  // Previous across Grandma's garden into chapter one's opening.
  await storyButton("previous").click();
  await showsText(CONTENT.premise.gardenFarewell.text);
  const garden = await storyPage();
  await storyButton("previous").click();
  await showsText(CONTENT.chapters[1].openingBranches[0]);
  const back = await storyPage();
  // On to a page aboard, Astra asking Ada's name, then Skip.
  const named = CONTENT.premise.prologue.find(
    ({ text }) => text === "What is your name, explorer?",
  );
  assert.ok(named, "Astra asks Ada's name aboard in the prologue");
  await nextTo(named.text);
  const aboard = await storyPage();
  await page.locator('[data-action="story-skip"]').click();
  await selector().waitFor({ state: "visible" });
  await chooseEarth(selector(), "Stay on Earth");
  await storyButton("next").waitFor({ state: "visible" });
  const room = await storyPage();
  const roomAction = ((await storyButton("next").textContent()) ?? "").trim();
  await page.screenshot({ path: `${output}/story-run-room.png` });
  save("story-run-proof.json", { aboard, back, garden, opening, prologue, room, roomAction });
  assert.ok(!opening.previousShown, "Previous is hidden on the run's first page");
  assert.equal(opening.background, "grandmaGarden", "The run opens in Grandma's garden");
  assert.ok(opening.skipShown, "Skip shows inside the run");
  assert.ok(prologue.previousShown, "Previous crosses back from the prologue");
  assert.equal(garden.background, "grandmaGarden", "Previous returns to Grandma's farewell");
  assert.equal(back.text, CONTENT.chapters[1].openingBranches[0]);
  assert.ok(back.previousShown, "Previous goes on within chapter one's opening");
  assert.equal(aboard.background, "aboard", "Skip is pressed on a page aboard");
  assert.equal(room.background, "adaRoom", "Home from galaxy selection shows Ada's room");
  assert.equal(roomAction, CONTENT.labels.pickUpRock);
  assert.ok(room.skipShown, "Ada's room page offers Skip with its named action");
  assert.ok(!room.previousShown, "Ada's room page from galaxy selection starts its run");
  events.checks.push(
    "A story run's Previous crosses from the prologue across Grandma's garden into chapter one, " +
      "Skip from aboard passes the run to galaxy selection, and Ada's room page starts a run " +
      "with its named action and Skip",
  );

  // The start screen (art/layout.md "Start screen"): every part in play-view px from the game
  // area's left edge, at 720x360 and on an 844x390 phone, without and with insets (left and right
  // 43, bottom 19 logical), first run and with a save.
  const { START_SCREEN } = await import(new URL("../src/data/layout.ts", import.meta.url));
  const startPlayView = await import(new URL("../src/ui/layout/playView.ts", import.meta.url));
  const startScreenAt = async (name, size, insets) => {
    await page.setViewportSize(size);
    await page.evaluate((logical) => {
      const unit = Number(
        getComputedStyle(document.querySelector("#app")).getPropertyValue("--ada-unit"),
      );
      for (const [side, value] of Object.entries(logical)) {
        document.documentElement.style.setProperty(`--inset-${side}`, `${value * unit}px`);
      }
    }, insets);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${output}/start-screen-${name}.png` });
    return page.evaluate(() => {
      const app = document.querySelector("#app");
      const unit = Number(getComputedStyle(app).getPropertyValue("--ada-unit"));
      const x0 = parseFloat(getComputedStyle(app).getPropertyValue("--ada-area-left")) / unit;
      const origin = app.getBoundingClientRect();
      const box = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect
          ? [
              (rect.x - origin.x) / unit - x0,
              (rect.y - origin.y) / unit,
              rect.width / unit,
              rect.height / unit,
            ].map((value) => Math.round(value * 10) / 10)
          : null;
      };
      return {
        actions: [...document.querySelectorAll(".ada-start-actions > button")].map((button) => [
          button.dataset.action,
          box(`.ada-start-actions > [data-action="${button.dataset.action}"]`),
          button.classList.contains("ada-primary") ? "primary" : "secondary",
        ]),
        // The retired top-right discs that draw: none.
        discs: ["achievements", "settings", "exit"].filter((action) => {
          const button = document.querySelector(`[data-action="${action}"]`);
          return Boolean(button && !button.hidden && button.getClientRects().length > 0);
        }),
        focused: document.activeElement?.dataset.action ?? null,
        menu: box('[data-action="menu"]'),
        note: document.querySelectorAll(".ada-start-note").length,
        // The play area's CSS size, which the canvas fills.
        size: [origin.width, origin.height],
        ship: box(".ada-start-ship"),
        shipSrc: document.querySelector(".ada-start-ship")?.getAttribute("src"),
        title: document.querySelector(".ada-start-title img")?.getAttribute("alt"),
        unit,
        wordmark: box(".ada-start-title"),
        x0,
      };
    });
  };
  const sizes = [
    ["720", { height: 360, width: 720 }, {}],
    ["720-insets", { height: 360, width: 720 }, { bottom: 19, left: 43, right: 43, top: 0 }],
    ["844", { height: 390, width: 844 }, {}],
    ["844-insets", { height: 390, width: 844 }, { bottom: 19, left: 43, right: 43, top: 0 }],
  ];
  const fresh = new GameModel(CONTENT);
  const saved = new GameModel(CONTENT);
  saved.state.started = true;
  const startScreens = {};
  // One at a time, in order: each seeds or resizes the one page.
  const inTurn = (items, run) =>
    items.reduce((prior, item) => prior.then(() => run(item)), Promise.resolve());
  await inTurn(
    [
      ["new", fresh],
      ["saved", saved],
    ],
    async ([kind, model]) => {
      await seedOnce(model.save(), `ada-browser.start-screen-${kind}.v1`);
      await page.locator(".ada-start-actions > button").first().waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector(".ada-start-ship")?.complete);
      // Once loading ends the kit's one loading bar hides: an idle start screen shows none.
      const idle = await page
        .waitForFunction(
          () => {
            // Idle, or complete with its hold and fade over (the kit's complete state ends hidden).
            const bars = document.querySelectorAll(".progress-bar");
            return (
              bars.length === 1 &&
              (bars[0].hidden || getComputedStyle(bars[0]).visibility === "hidden")
            );
          },
          null,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      assert.ok(idle, `The ${kind} start screen hides its one loading bar once loading ends`);
      await inTurn(sizes, async ([name, size, insets]) => {
        startScreens[`${kind}-${name}`] = await startScreenAt(`${kind}-${name}`, size, insets);
      });
    },
  );
  await page.setViewportSize({ height: 720, width: 1280 });
  save("start-screen-proof.json", startScreens);
  const { actions, ship, wordmark } = START_SCREEN;
  for (const [name, shot] of Object.entries(startScreens)) {
    assert.deepEqual(
      shot.wordmark,
      [wordmark.left, wordmark.top, wordmark.width, wordmark.height],
      `${name}: the wordmark sits at its play-view place`,
    );
    assert.deepEqual(
      shot.ship,
      [ship.centre.x - ship.size / 2, ship.centre.y - ship.size / 2, ship.size, ship.size],
      `${name}: the ship frame is 280 square on its centre`,
    );
    assert.equal(shot.note, 0, `${name}: the start screen has no note`);
    assert.equal(shot.title, CONTENT.labels.home, `${name}: the wordmark is named by home`);
    assert.equal(shot.shipSrc, SHIPPED_TITLE_SHIP, `${name}: the canonical Classic title frame`);
    for (const [action, box, role] of shot.actions) {
      assert.deepEqual(
        box,
        [actions.left[action], actions.top, actions.width, actions.height],
        `${name}: ${action} sits at its play-view place`,
      );
      assert.equal(
        role,
        action === "restart" ? "secondary" : "primary",
        `${name}: ${action}'s role`,
      );
    }
    // The Menu's press area is the pause button's, on the HUD rect's top-left corner, inside the
    // game area. The full-viewport policy keeps hardware insets zero, so insets move nothing.
    const [width, height] = shot.size;
    const hud = startPlayView.hudRect(
      startPlayView.NO_INSETS,
      startPlayView.logicalView({ height, width }),
    );
    const { hit } = startPlayView.PAUSE_BUTTON;
    const menuPlace = [hud.x + hit.x - shot.x0, hud.y + hit.y, hit.width, hit.height];
    assert.ok(
      shot.menu?.every((value, index) => Math.abs(value - menuPlace[index]) <= 0.1),
      `${name}: the Menu sits at the pause button's place: ${JSON.stringify([shot.menu, menuPlace])}`,
    );
    assert.ok(shot.menu[0] >= 0, `${name}: the Menu in the game area`);
    assert.deepEqual(shot.discs, [], `${name}: no standalone nav disc draws`);
  }
  assert.deepEqual(
    startScreens["new-720"].actions.map(([action]) => action),
    ["start"],
    "A first run offers Start alone",
  );
  assert.deepEqual(
    startScreens["saved-720"].actions.map(([action]) => action),
    ["restart", "continue"],
    "A save offers Restart, then Continue, in tab order, as they read left to right",
  );
  assert.equal(startScreens["new-720"].focused, "start", "Start is the default");
  assert.equal(startScreens["saved-720"].focused, "continue", "Continue is the default");
  assert.equal(startScreens["new-844"].x0, 29, "The 844x390 phone's game area starts at 29");
  // Tab order follows the DOM: Restart, Continue, then the Menu. Focus opens on Continue, so Tab
  // reaches the Menu and Shift+Tab reaches Restart.
  const order = [];
  await page.setViewportSize({ height: 360, width: 720 });
  await seedOnce(saved.save(), "ada-browser.start-screen-tabs.v1");
  await page.locator('.ada-start-actions > [data-action="continue"]').waitFor({ state: "visible" });
  // The boot reveal focuses the default once the screen is ready, after it shows.
  await page.waitForFunction(() => document.activeElement?.dataset.action === "continue");
  await page.keyboard.press("Tab");
  order.push(await page.evaluate(() => document.activeElement?.dataset.action ?? null));
  await page.locator('.ada-start-actions > [data-action="continue"]').focus();
  await page.keyboard.press("Shift+Tab");
  order.push(await page.evaluate(() => document.activeElement?.dataset.action ?? null));
  await page.setViewportSize({ height: 720, width: 1280 });
  assert.deepEqual(order, ["menu", "restart"], "Tab follows Continue's lead");
  // An open modal is the topmost layer: over the Menu disc, Achievements' card shows.
  await openMenu();
  await menuCard().locator('[data-action="menu-achievements"]').click();
  await page.locator('[data-dialog="achievements"]').waitFor({ state: "visible" });
  const topmost = await page.evaluate(() => {
    const disc = document.querySelector('[data-action="menu"]').getBoundingClientRect();
    const hit = document.elementFromPoint(disc.x + disc.width / 2, disc.y + disc.height / 2);
    return {
      button: Boolean(hit?.closest('[data-action="menu"]')),
      modal: Boolean(hit?.closest(".ada-modal")),
      start: Boolean(hit?.closest(".ada-start")),
    };
  });
  await page.locator('[data-action="close-achievements"]').click();
  await page.locator('[data-dialog="achievements"]').waitFor({ state: "hidden" });
  await menuCard().waitFor({ state: "visible" });
  await closeMenu();
  assert.deepEqual(
    topmost,
    { button: false, modal: true, start: false },
    "An open modal draws over the start screen and its Menu disc",
  );
  events.checks.push(
    "The start screen draws the field, ship, wordmark and actions at their play-view places " +
      "and the Menu at the pause button's, at 720x360 and 844x390, with and without insets, " +
      "defaults to Start or Continue and tabs Continue, the Menu, Restart",
  );

  const { SCREEN } = await import(new URL("../src/data/screen.ts", import.meta.url));
  const weaponModel = relaunch(CONTENT, safeSerialized);
  weaponModel.state.flight.ownedWeapons = ["rapidMissile", "multiLaser", "scattershot"];
  Object.assign(weaponModel.state.flight.ammo, {
    multiLaser: 600,
    rapidMissile: 600,
    scattershot: 390,
  });
  weaponModel.state.flight.weapon = "laser";
  weaponModel.state.flight.objects = [];
  weaponModel.state.flight.shots = [];
  const weaponSave = weaponModel.save();
  assert.deepEqual(relaunch(CONTENT, weaponSave).state, weaponModel.state);
  save("weapon-volley-fixture.json", {
    scope:
      "Canonical cleared-flight fixture for actual UI firing, not natural pickup or combat progression",
    state: JSON.parse(weaponSave),
  });
  // heading, when given, also waits for a shot flying at that world angle.
  async function heldVolley(weapon, projectile, minimum, heading = null) {
    await seedOnce(weaponSave, `ada-browser.volley-${weapon}.v1`);
    await page.locator(`button[data-weapon="${weapon}"]`).click();
    const liftAim = await holdAimRight();
    try {
      await page.waitForFunction(
        ({ heading, key, minimum, projectile }) => {
          const shots =
            JSON.parse(localStorage.getItem(key))?.flight?.shots.filter(
              (shot) => !shot.enemy && shot.projectile === projectile,
            ) ?? [];
          return (
            shots.length >= minimum &&
            (heading === null ||
              shots.some(
                (shot) =>
                  Math.abs(Math.atan2(shot.velocity.y, shot.velocity.x) - heading) < 0.000001,
              ))
          );
        },
        { key: storageKey, projectile, minimum, heading },
      );
      const snapshot = await readSave();
      assert.deepEqual(
        relaunch(CONTENT, JSON.stringify(snapshot)).state,
        snapshot,
        "Actual fired projectiles and fade metadata must survive canonical save validation",
      );
      await page.screenshot({ path: `${output}/volley-${weapon}.png` });
      return snapshot;
    } finally {
      await liftAim();
    }
  }
  // A level 1 Rapid Missile lives 0.44 s (220 at 500) against its 0.30 s interval, so at most
  // two are in flight between shots. The held screen-right aim settles on world angle -45 degrees.
  const settledAim = -Math.PI / 4;
  const missiles = await heldVolley("rapidMissile", "missile", 2, settledAim);
  // Remaining life counts down, so ascending life is firing order (oldest first).
  const missileShots = missiles.flight.shots
    .filter((shot) => !shot.enemy && shot.projectile === "missile")
    .sort((a, b) => a.life - b.life);
  assert.ok(
    new Set(missileShots.map((shot) => shot.id)).size >= 2,
    "One held aim input must emit multiple automatic missiles",
  );
  // Shots follow the damped aim facing: the immediate first shot may leave mid-turn, and once
  // the facing settles on the held screen-right aim (world angle -45 degrees) every later
  // missile shares that straight heading.
  const headingOf = (shot) => Math.atan2(shot.velocity.y, shot.velocity.x);
  const firstSettled = missileShots.findIndex(
    (shot) => Math.abs(headingOf(shot) - settledAim) < 0.000001,
  );
  assert.ok(firstSettled >= 0, "Held-direction missiles must share the settled aim heading");
  for (const shot of missileShots.slice(firstSettled)) {
    assert.ok(
      Math.abs(headingOf(shot) - settledAim) < 0.000001,
      "Held-direction missiles must retain a straight shared heading once aim settles",
    );
  }
  for (const shot of missileShots) {
    assert.ok(shot.damage > CONTENT.tuning.flight.playerShotDamage);
  }
  // One volley's bolts take consecutive shot ids. Each bolt's life follows its own heading's reach
  // to the view's edge, so the bolts of one volley are grouped by id, not by life.
  const { WEAPON_CATALOG } = await import(new URL("../src/data/weaponCatalog.ts", import.meta.url));
  const fanDegrees = WEAPON_CATALOG.multiLaser[0].anglesDegrees;
  const triple = await heldVolley("multiLaser", "bolt", fanDegrees.length);
  const boltIds = triple.flight.shots
    .filter((shot) => !shot.enemy && shot.projectile === "bolt")
    .map((shot) => ({ number: Number(shot.id.split(":").at(-1)), shot }))
    .sort((a, b) => b.number - a.number);
  // The newest volley present in full: a run of consecutive ids as long as the fan.
  const volleyStart = boltIds.findIndex(
    ({ number }, index) =>
      boltIds[index + fanDegrees.length - 1]?.number === number - fanDegrees.length + 1,
  );
  const volley =
    volleyStart < 0
      ? []
      : boltIds.slice(volleyStart, volleyStart + fanDegrees.length).map(({ shot }) => shot);
  // Headings on screen: the fan spreads in the projected view (src/model/playerProjectiles.ts).
  const angles = volley
    .map(
      (shot) =>
        (Math.atan2((shot.velocity.x + shot.velocity.y) / 2, shot.velocity.x - shot.velocity.y) *
          180) /
        Math.PI,
    )
    .sort((a, b) => a - b);
  assert.equal(
    angles.length,
    fanDegrees.length,
    `A real level 1 Multi-Laser volley must emit ${fanDegrees.length} simultaneous bolts: ${JSON.stringify(
      boltIds.map(({ number }) => number),
    )}`,
  );
  const middle = angles[Math.floor(angles.length / 2)];
  const offsets = angles.map((angle) => angle - middle);
  const expectedOffsets = [...fanDegrees].sort((a, b) => a - b);
  assert.ok(
    offsets.every((offset, index) => Math.abs(offset - expectedOffsets[index]) < 0.000001),
    `The level 1 Multi-Laser volley keeps its fan on screen: ${JSON.stringify({ expectedOffsets, offsets })}`,
  );
  // A dot lives 100 / 600 s and the save lands once a second, so a snapshot rarely catches one
  // fading; the fade to nothing is covered in src/model/weaponProjectiles.test.ts.
  const scatter = await heldVolley("scattershot", "dot", 7);
  const dots = scatter.flight.shots.filter((shot) => !shot.enemy && shot.projectile === "dot");
  // Pellets leave the nose of the heading they fired at, so from Ada's centre each lies within
  // Scattershot's 100 world-unit range plus the farthest world nose offset of any facing.
  const scatterRange = 100;
  const { noseOffset } = await import(new URL("../src/model/nose.ts", import.meta.url));
  const noseReach = Math.max(
    ...Array.from({ length: 360 }, (_, degrees) => {
      const angle = (degrees * Math.PI) / 180;
      const { x, y } = noseOffset({ x: Math.cos(angle), y: Math.sin(angle) });
      return Math.hypot(x, y);
    }),
  );
  for (const shot of dots) {
    assert.equal(
      shot.fade.projectedRange,
      scatterRange,
      "Range must be Scattershot's fixed world range, not the camera, CSS width or DPR",
    );
    assert.equal(shot.fade.fadeStartFraction, 0.65);
    const dx = shot.x - scatter.flight.player.x;
    const dy = shot.y - scatter.flight.player.y;
    assert.ok(
      Math.hypot(dx, dy) <= scatterRange + noseReach + 0.001,
      "Actual scatter particles must remain inside the 100 world-unit range from the nose",
    );
    assert.ok(shot.damage > 0 && shot.damage < CONTENT.tuning.flight.playerShotDamage);
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
    "Actual held aim emits automatic straight missiles, the level 1 Multi-Laser's three-bolt " +
      "fan and 100 world-unit scatter particles",
  );

  // As the hub station fixture: Cartwheel's story resolves before its flight starts, so the hub
  // is in the flight with no capital encounter planned around it.
  const cargoSetup = new GameModel(CONTENT);
  cargoSetup.state.unlocked = [1, 2];
  Object.assign(cargoSetup.state.progress[2], {
    introduced: true,
    questComplete: true,
    resolved: true,
    stage: 5,
  });
  cargoSetup.startGalaxy(2);
  playOpening(cargoSetup);
  cargoSetup.state.dialogue = null;
  Object.assign(cargoSetup.state.progress[2], { known: ["hub"], stations: ["hub"] });
  ensureDestination(CONTENT, "hub", cargoSetup.state.flight);
  cargoSetup.teleport("hub");
  cargoSetup.state.flight.cargo = 12345;
  // Relaunched, as the browser loads it: a resolved Cartwheel unlocks its achievement on load.
  const cargoModel = relaunch(CONTENT, cargoSetup.save());
  assert.equal(cargoModel.contextAction, "deposit", "The wide-cargo fixture offers Deposit");
  const cargoSave = cargoModel.save();
  assert.deepEqual(relaunch(CONTENT, cargoSave).state, cargoModel.state);
  save("cargo-fixture.json", {
    scope: "Canonical wide-cargo deposit UI fixture, not natural mining progression",
    state: JSON.parse(cargoSave),
  });
  await seedOnce(cargoSave, "ada-browser.wide-cargo.v1");
  // Deposit is actionable once the resumed flight is live: the galaxy art its first flight waits
  // on has loaded (the kit's one loading bar is hidden, idle or complete) and the flight has
  // stepped past the seeded save, which the scene writes back each second, with the cargo still
  // aboard. The seeded save alone already reads as this flight before it resumes.
  await page.waitForFunction(
    () => {
      const bar = document.querySelector(".progress-bar");
      return bar !== null && (bar.hidden || getComputedStyle(bar).visibility === "hidden");
    },
    null,
    { timeout: 30000 },
  );
  await page.waitForFunction(
    ({ from, key }) => {
      const state = JSON.parse(localStorage.getItem(key));
      return (
        state.mode === "space" &&
        state.flight?.galaxy === 2 &&
        state.flight.cargo === 12345 &&
        state.flight.time > from
      );
    },
    { from: cargoModel.state.flight.time, key: storageKey },
    { timeout: 30000 },
  );
  assert.equal(
    await page.locator(".flight-hud").count(),
    0,
    "Wide cargo must not restore the removed information HUD",
  );
  assert.equal(await page.locator(".ada-use").getAttribute("data-use"), "deposit");
  await tapUse(CONTENT.labels.deposit);
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.flight.cargo === 0 && state.progress[2].deposited === 12345;
  }, storageKey);
  await page.reload();
  await continueFlight();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).progress[2].deposited === 12345,
    storageKey,
  );
  events.checks.push(
    "Canonical wide cargo survives restore and a real deposit persists after reload",
  );

  // This fixture proves only the saved-state UI boundary, not completion of the quest in a browser.
  const fixture = new GameModel(CONTENT);
  fixture.startGalaxy(1);
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
  await page.getByText(CONTENT.chapters[1].resolution, { exact: true }).waitFor();
  assert.equal(await choices.count(), 2, "home resolution must offer both real choices");
  await page.screenshot({ path: `${output}/resolution.png` });
  await choices.nth(1).click();
  await page.getByText(CONTENT.chapters[1].resolutionBranches[1], { exact: true }).waitFor();
  await page
    .locator('.ada-story-panel:not(.ada-dialogue-panel):not([hidden]) [data-action="story-next"]')
    .click();
  await page.getByText(CONTENT.chapters[1].closing, { exact: true }).waitFor();
  assert.equal(await choices.count(), 0, "The closing is an ordinary page");
  const homePages = await readStory();
  assert.equal(homePages[0]?.text, CONTENT.chapters[1].closing);
  assert.equal(
    homePages[1]?.text,
    CONTENT.chapters[3].opening,
    "Whirlpool's opening follows, second on the route",
  );
  await selector().waitFor({ state: "visible" });
  // The first boarding after the unlock flies the ship from Sunflower to Whirlpool.
  assert.equal(
    (await selector().locator("h2").textContent())?.trim(),
    CONTENT.labels.galaxyNumber.replace("{number}", "1"),
    "The unlock flight starts on Sunflower",
  );
  await page.locator('.ada-route[data-dialog="galaxies"]:not([data-flight])').waitFor();
  assert.equal(
    (await selector().locator("h2").textContent())?.trim(),
    CONTENT.labels.galaxyNumber.replace("{number}", "2"),
    "Galaxy selection opens on the farthest unlocked galaxy, Whirlpool at route position 2",
  );
  assert.equal(
    await selector().locator(".ada-route-marker[data-earth]").getAttribute("aria-label"),
    CONTENT.labels.homeButton,
    "Galaxy selection's Earth marker is named Earth",
  );
  await page.screenshot({ path: `${output}/selector-earth.png` });
  assert.equal(
    await page.locator('[data-action="galaxy-jump"]').getAttribute("aria-disabled"),
    null,
    "home resolution must unlock Whirlpool",
  );
  await page.waitForFunction((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return state?.progress[1].resolved && state.unlocked.includes(3);
  }, storageKey);
  events.checks.push(
    "Fixture-based home resolution, closing and the next opening lead to galaxy selection on " +
      "the newly unlocked galaxy",
  );
  // The route runs left to right along one arc, so Left and Right follow screen order and skip
  // locked galaxies; Tab runs the markers, Earth, then the single destination action and wraps,
  // with no close X or Back, and Escape goes one step back to the story page the map opened from
  // (here the prologue's last, since this fixture has not seen it; a boarding from Ada's room
  // returns to "Welcome back, Navigator.").
  // The galaxy markers, in route order; the Earth marker sits apart from the route.
  const routeMarkers = selector().locator(".ada-route-marker:not([data-earth])");
  const markerLefts = await routeMarkers.evaluateAll((markers) =>
    markers.map((marker) => marker.getBoundingClientRect().left),
  );
  assert.deepEqual(
    markerLefts,
    [...markerLefts].sort((a, b) => a - b),
    "The markers run left to right in route order",
  );
  assert.equal(
    await selector().locator('[data-action="close-galaxies"], .ada-close').count(),
    0,
    "The galaxy map has no close X or Back",
  );
  // The destination action is last in Tab order: Tab from it wraps to the first marker, and
  // Shift+Tab from it reaches Earth's marker.
  await page.locator('[data-action="galaxy-jump"]').focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.position ?? ""),
    "1",
    "Tab after the destination action wraps to the first marker",
  );
  await page.locator('[data-action="galaxy-jump"]').focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset.position ?? ""),
    "earth",
    "Earth's marker comes just before the destination action",
  );
  await page.screenshot({ path: `${output}/route-map.png` });
  const panelNumber = (number) => CONTENT.labels.galaxyNumber.replace("{number}", number);
  const selectedMarker = () =>
    routeMarkers.evaluateAll((markers) =>
      markers.findIndex((marker) => marker.hasAttribute("data-selected")),
    );
  // The panel switches at the input; the selected ring returns once the ship's move ends.
  const shipRestsOn = (number, message) =>
    page
      .waitForFunction(
        ({ index, label }) => {
          const route = document.querySelector('.ada-route[data-dialog="galaxies"]');
          const markers = [
            ...(route?.querySelectorAll(".ada-route-marker:not([data-earth])") ?? []),
          ];
          return (
            route?.querySelector("h2")?.textContent?.trim() === label &&
            markers.findIndex((marker) => marker.hasAttribute("data-selected")) === index
          );
        },
        { index: Number(number) - 1, label: panelNumber(number) },
        { timeout: 5000 },
      )
      .then(
        () => true,
        () => false,
      )
      .then((rests) => assert.ok(rests, message));
  // The arrows walk the route wherever focus is on the map; focus starts on Jump.
  await page.locator('[data-action="galaxy-jump"]').focus();
  await page.keyboard.press("ArrowLeft");
  await shipRestsOn("1", "Left moves the ship left on screen, to Sunflower");
  await page.keyboard.press("ArrowRight");
  await shipRestsOn("2", "Right moves the ship right on screen, to Whirlpool");
  // Every galaxy right of Whirlpool is locked, so Right skips them all and the ship stays.
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  assert.equal(
    (await selector().locator("h2").textContent())?.trim(),
    panelNumber("2"),
    "Right skips locked galaxies",
  );
  assert.equal(await selectedMarker(), 1);
  await page.keyboard.press("Escape");
  await selector().waitFor({ state: "hidden" });
  const openedFrom = homePages.at(-1)?.text;
  const escapedBack = await page
    .waitForFunction(
      (text) =>
        document.querySelector(
          ".ada-story-panel:not(.ada-dialogue-panel):not([hidden]) .ada-story-paragraph",
        )?.textContent === text,
      openedFrom,
      { timeout: 10000 },
    )
    .then(
      () => true,
      () => false,
    );
  assert.ok(escapedBack, "Escape from galaxy selection shows the page the map opened from");
  // Focus moves to the page's Next, which opened the galaxy map, once its page shows.
  const backFocused = await page
    .waitForFunction(
      () =>
        document.activeElement?.dataset.action === "story-next" &&
        Boolean(
          document.activeElement.closest(".ada-story-panel:not(.ada-dialogue-panel):not([hidden])"),
        ),
      null,
      { timeout: 5000 },
    )
    .then(
      () => true,
      () => false,
    );
  assert.ok(backFocused, "Closing the galaxy map at boarding focuses the page's Next");
  events.checks.push(
    "The galaxy map lays the markers left to right on one arc with its destination action last " +
      "in Tab order and no close X; Left and Right follow screen order and skip locked galaxies, " +
      "and Escape goes one step back to the page the map opened from",
  );
  // Canonical save fixtures exercise rendering and restore boundaries, not natural combat progression.
  const [{ enemyCatalog }, { createEnemy, damageEnemy }, { restoreSave }] = await Promise.all([
    import(new URL("../src/data/enemyCatalog.ts", import.meta.url)),
    import(new URL("../src/model/enemyAi.ts", import.meta.url)),
    import(new URL("../src/model/save.ts", import.meta.url)),
  ]);
  // A claim platform beside Ada in Cartwheel: its hull is in Cartwheel's manifest and its turret
  // and port frames load when it first draws, after that manifest has loaded.
  const claimModel = new GameModel(CONTENT);
  claimModel.state.unlocked = [1, 2];
  claimModel.state.prologueSeen = true;
  claimModel.startGalaxy(2);
  playOpening(claimModel);
  if (claimModel.state.mode !== "space") {
    claimModel.jump();
  }
  {
    const flight = claimModel.state.flight;
    flight.objects = [];
    flight.shots = [];
    const definition = enemyCatalog.platform;
    const at = { x: flight.player.x - 60, y: flight.player.y + 170 };
    const enemy = createEnemy(
      definition,
      { archetype: "platform", id: "browser-claim:platform", packId: null, phase: 0 },
      at,
    );
    flight.objects.push({
      ...at,
      enemy,
      hp: definition.hp,
      id: enemy.id,
      kind: "enemy",
      radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    });
  }
  await seedOnce(claimModel.save(), "ada-browser.claim-platform.v1");
  // The resource timing buffer holds 250 entries by default, fewer than a flight's art requests;
  // a reload with a larger buffer keeps every request this check reads.
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.reload();
  await continueFlight();
  await page.waitForFunction(
    () =>
      [
        "/art/cartwheel/enemies/platform.svg",
        "/art/cartwheel/enemies/platform-port-intact-0.svg",
      ].every((path) =>
        performance.getEntriesByType("resource").some(({ name }) => name.endsWith(path)),
      ),
    null,
    { timeout: 30000 },
  );
  events.checks.push(
    "A Cartwheel flight loads the claim platform's hull and, once Cartwheel's manifest has loaded, " +
      "its part frames",
  );
  const [{ readAsteroidCatalog }, asteroidArt] = await Promise.all([
    import(new URL("../src/data/asteroidCatalog.ts", import.meta.url)),
    import(new URL("../src/game/asteroidArt.ts", import.meta.url)),
  ]);
  const asteroidResponse = await page.request.get("http://ada-preview:4173/art/asteroids.json");
  assert.equal(asteroidResponse.status(), 200, "Art's asteroid catalog must be served");
  const rockArt = readAsteroidCatalog(await asteroidResponse.json());
  assert.ok(rockArt, "Art's asteroid catalog must read as version 1");
  // Backdrop rocks lie in their layer, about the camera's world position times the rocks'
  // parallax (art/backdrop.md).
  const rockParallax = (
    await (await page.request.get("http://ada-preview:4173/art/backdrop.json")).json()
  ).debris.rocks.parallax;
  // Live capitals keep a viewport-sized gap, so each large enemy renders from its own canonical
  // save at the offset its sampled screen region expects.
  function combatFixture(archetype, offset, missile) {
    const combat = new GameModel(CONTENT);
    combat.startGalaxy(1);
    playOpening(combat);
    assert.ok(combat.state.flight, "Combat fixture requires a canonical flight");
    const flight = combat.state.flight;
    combat.state.progress[1].introduced = true;
    combat.state.dialogue = null;
    flight.objects = [];
    flight.shots = [];
    // No backdrop rock in view, so the sampled regions see only the combat and empty space.
    reseedFlight(combat, backdropSeed(rockArt, rockParallax, false, flight.player));
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
      radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    });
    if (missile) {
      flight.shots.push({
        damage: CONTENT.tuning.flight.playerShotDamage,
        enemy: true,
        hitIds: [],
        id: "browser-combat:missile",
        life: CONTENT.tuning.flight.enemyProjectileLifetime,
        piercing: false,
        projectile: "missile",
        velocity: { x: 12, y: 12 },
        x: origin.x,
        y: origin.y - 180,
      });
    }
    const serialized = combat.save();
    assert.deepEqual(restoreSave(serialized), combat.state, "Canonical restore accepts combat");
    assert.deepEqual(relaunch(CONTENT, serialized).state, combat.state);
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
    ...galaxyFields.sunflower.colors,
  };
  // Empty space shows galaxy one's backdrop layers (art/backdrop.md): each channel within its sky
  // ends and plate steps, give or take a darker plate over the darker sky.
  const backdropResponse = await page.request.get(
    "http://ada-preview:4173/art/sunflower/backdrop.json",
  );
  assert.equal(backdropResponse.status(), 200, "Galaxy one's backdrop must be served");
  const sunflowerBackdrop = await backdropResponse.json();
  const backdropTones = [
    sunflowerBackdrop.sky.from,
    sunflowerBackdrop.sky.to,
    ...sunflowerBackdrop.plates.steps.map((step) => step.color),
  ].map((hex) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)));
  const backdropBox = [0, 1, 2].map((channel) => [
    Math.min(...backdropTones.map((tone) => tone[channel])) - 12,
    Math.max(...backdropTones.map((tone) => tone[channel])) + 12,
  ]);
  const combatSnapshots = {};
  const pixels = {};
  const heavyColors = {
    hull: "#d68b72",
    scorch: "#5c3a31",
    turretTop: "#c27a62",
  };
  // A new hull faces up, heading 12; its disabled engine's base centres on that heading's anchor.
  const capitalLayout = await (
    await page.request.get("http://ada-preview:4173/art/enemies/capital-hardpoints.json")
  ).json();
  const disabledAnchor = capitalLayout.headings[12].hardpoints.find(
    (part) => part.id === "engine-left",
  ).anchor;
  const capitalScale = 210 / capitalLayout.frame;
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
    const canvas = page.locator("#game-canvas > canvas");
    await canvas.waitFor({ state: "visible" });
    // The pixel regions sample the canvas alone; the conversation box and notices draw over it.
    const showOverCanvas = await hideOverCanvas(page);
    const intrinsic = await canvas.evaluate(logicalSize, SCREEN);
    // A heavy's part frames load once it is in flight, so sample until its turret tops show.
    async function sampleUntilComposed(remaining) {
      const sampled = await sampleCombatView(view, canvas, intrinsic);
      Object.assign(pixels, sampled);
      if (view.composed && sampled.capital.counts.turretTop <= 20 && remaining > 0) {
        await page.waitForTimeout(250);
        await sampleUntilComposed(remaining - 1);
      }
    }
    await sampleUntilComposed(20);
    await showOverCanvas();
  }
  async function sampleCombatView(view, canvas, intrinsic) {
    const combatImage = await canvas.screenshot({
      path: `${output}/combat-canvas-${view.archetype}.png`,
    });
    return page.evaluate(
      async ({ backdropBox, disabled, encoded, heavyColors, intrinsic, names, paletteColors }) => {
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const sample = document.createElement("canvas");
        sample.width = bitmap.width;
        sample.height = bitmap.height;
        const drawing = sample.getContext("2d");
        drawing.drawImage(bitmap, 0, 0);
        bitmap.close();
        // Projection is anchored to logical SCREEN center (360,180), even when the view is taller.
        const regions = {
          // The 5-width capital centres at (180, 180); its disabled left engine at its anchor.
          capital: { x: 90, y: 130, width: 180, height: 100 },
          missile: { x: 510, y: 65, width: 65, height: 55 },
          disabled: { x: disabled.x - 15, y: disabled.y - 15, width: 30, height: 30 },
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
                  ...Object.keys(heavyColors),
                ].map((role) => {
                  const hex = paletteColors[role] ?? heavyColors[role];
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
              counts.backdrop = 0;
              const outline = {
                minX: Infinity,
                maxX: -Infinity,
                minY: Infinity,
                maxY: -Infinity,
              };
              for (let offset = 0; offset < image.data.length; offset += 4) {
                if (
                  backdropBox.every(
                    ([low, high], index) =>
                      image.data[offset + index] >= low && image.data[offset + index] <= high,
                  )
                ) {
                  counts.backdrop++;
                }
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
        backdropBox,
        disabled: {
          x: 180 + (disabledAnchor[0] - capitalLayout.frame / 2) * capitalScale,
          y: 180 + (disabledAnchor[1] - capitalLayout.frame / 2) * capitalScale,
        },
        encoded: combatImage.toString("base64"),
        heavyColors,
        intrinsic,
        names: view.names,
        paletteColors,
      },
    );
  }
  await renderCombatView({
    archetype: "capital",
    composed: true,
    missile: true,
    names: ["capital", "missile", "background", "disabled"],
    offset: { x: -90, y: 90 },
  });
  assert.ok(
    pixels.capital.counts.hull > pixels.capital.area * 0.15,
    "Large enemy must draw Art's coral hull",
  );
  assert.ok(
    pixels.capital.counts.turretTop > 20,
    "Large enemy must draw Art's aimed turret tops on its live turrets",
  );
  assert.ok(
    pixels.disabled.counts.scorch > 100,
    "Disabled capital engine must draw Art's scorched wreck",
  );
  assert.ok(
    pixels.missile.counts.obstacle > 2 && pixels.missile.outlineSpan.y > 2,
    "Seeded missile must contain coral projectile geometry",
  );
  assert.ok(
    pixels.background.counts.backdrop > pixels.background.area * 0.9,
    "Empty space must render galaxy one's backdrop tones rather than the monochrome fallback",
  );
  await page.screenshot({ path: `${output}/combat.png` });
  save("combat-proof.json", {
    scope: "Rendered canonical combat fixture; screenshot review required for visual correctness",
    states: combatSnapshots,
    canvas: await page.locator("#game-canvas > canvas").boundingBox(),
    capitalSizeRatio: enemyCatalog.capital.sizeRatio,
    pixels,
    paletteColors,
  });
  events.checks.push(
    "Canonical combat save restores a capital, partial hardpoint damage " +
      "and missile with Art's composed frames in renderer screenshots",
  );

  // Art's rocks in each galaxy (art/asteroids.md): one rock of each size and a drifting rock
  // around Ada, with a backdrop rock in view, draw in stone over the tinted backdrop field. The
  // spin frames and footprint overlay are review captures (browser-captures.mjs).
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
  async function captureRocks(galaxy, name) {
    const tint = asteroidArt.backdropTint(rockArt, galaxy);
    // The ramps sample the canvas alone; the conversation box and notices draw over it.
    const showOverCanvas = await hideOverCanvas(page);
    const image = await page
      .locator("#game-canvas > canvas")
      .screenshot({ path: `${output}/${name}` });
    await showOverCanvas();
    const ramps = { backdrop: [tint.backdropLit, tint.backdropSide], stone: rockArt.stone };
    const pixels = await stonePixels(image, ramps);
    asteroidCaptures[galaxy].push({ name, pixels });
    return pixels;
  }
  async function captureGalaxy(galaxy) {
    const serialized = asteroidFixture(rockArt, rockParallax, galaxy);
    save(`asteroid-fixture-${galaxy}.json`, {
      scope: "Canonical rock layout for Art review of sprites, drift chips and the backdrop field",
      state: JSON.parse(serialized),
    });
    await seedOnce(serialized, `ada-browser.asteroid-fixture-${galaxy}.v1`);
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
    await page.locator("#game-canvas > canvas").waitFor({ state: "visible" });
    asteroidCaptures[galaxy] = [];
    const first = await captureRocks(galaxy, `asteroids-galaxy-${galaxy}.png`);
    assert.ok(first.stone > 2000, `Galaxy ${galaxy} must draw Art's stone rocks`);
    assert.ok(first.backdrop > 20, `Galaxy ${galaxy} must draw its tinted backdrop rocks`);
  }
  await captureGalaxy(1);
  await captureGalaxy(2);
  await captureGalaxy(3);
  save("asteroid-art-proof.json", {
    scope: "Stone and backdrop pixels in each galaxy's canonical rock fixture",
    captures: asteroidCaptures,
  });
  events.checks.push(
    "Art's rocks draw in neutral stone in every galaxy over a tinted backdrop field",
  );

  // At 844x390 the Settings card fits the view with every row's note: the Move and Aim controls
  // rows carry the same note element as Sound's.
  const settingsViewport = page.viewportSize();
  await page.setViewportSize({ width: 844, height: 390 });
  await openSettings();
  const notes = await page
    .locator(".ada-row[data-setting]")
    .evaluateAll((rows) =>
      rows.map((row) => [row.dataset.setting, row.querySelector(".ada-setting-note")?.textContent]),
    );
  for (const setting of ["move", "aim"]) {
    assert.deepEqual(
      notes.find(([key]) => key === setting),
      [setting, CONTENT.labels.controlsNote],
      `${setting} controls row notes that touch still works when hidden`,
    );
  }
  assert.deepEqual(
    notes.find(([key]) => key === "sound"),
    ["sound", CONTENT.labels.soundNote],
    "Sound keeps its note in the same element",
  );
  // The Move and Aim controls rows show Art's control icons, nearest-neighbour.
  const stickIcons = await page.locator(".ada-row[data-setting]").evaluateAll((rows) =>
    rows
      .filter((row) => ["move", "aim"].includes(row.dataset.setting))
      .map((row) => {
        const icon = row.querySelector(".ada-icon");
        const style = getComputedStyle(icon);
        return [
          row.dataset.setting,
          icon.dataset.icon,
          /\/art\/ui\/sprites\/icon-(?:move|aim)-controls\.png/u.test(style.backgroundImage),
          style.imageRendering,
        ];
      }),
  );
  assert.deepEqual(stickIcons, [
    ["move", "icon-move-controls", true, "pixelated"],
    ["aim", "icon-aim-controls", true, "pixelated"],
  ]);
  await page
    .locator('.ada-row[data-setting="move"]')
    .screenshot({ path: `${output}/settings-move-row.png` });
  await page
    .locator('.ada-row[data-setting="aim"]')
    .screenshot({ path: `${output}/settings-aim-row.png` });
  const settingsFit = await page.locator('[data-action="close-settings"]').evaluate((close) => {
    const card = close.closest(".ada-card-frame") ?? close.parentElement;
    const box = card.getBoundingClientRect();
    const body = card.querySelector(".ada-card-body");
    return {
      inside:
        box.top >= -0.5 &&
        box.left >= -0.5 &&
        box.bottom <= window.innerHeight + 0.5 &&
        box.right <= window.innerWidth + 0.5,
      overflow: body ? body.scrollHeight - body.clientHeight : 0,
    };
  });
  assert.ok(
    settingsFit.inside && settingsFit.overflow <= 1,
    `The Settings card fits 844x390 with the controls notes: ${JSON.stringify(settingsFit)}`,
  );
  await closeSettings();
  if (settingsViewport) {
    await page.setViewportSize(settingsViewport);
  }
  await openSettings();
  const toggles = [];
  async function toggleSetting(key) {
    const label = CONTENT.labels[key];
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
    const checkbox = page.getByRole("switch", { name: CONTENT.labels[key], exact: true });
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
  await portraitContext.addInitScript(reportViolations);
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
  // The landing page's Mobile line names each control and follows it with the game's icon.
  const mobileLine = page.locator(".site-controls li p").first();
  assert.equal(
    await mobileLine.textContent(),
    "Move with the left stick. Aim and fire with the right stick. Tap Use to interact.",
  );
  assertInlineIcons(
    await mobileLine.evaluate(measureInlineIcons),
    ["move", "aim", "use"],
    1,
    22.4,
    "The landing page's Mobile line",
  );
  await page.locator(".site-controls").screenshot({ path: `${output}/site-controls.png` });
  events.checks.push("The landing page's Mobile line shows each named control's icon");
  await Promise.all([
    page.waitForURL("**/play/"),
    page.locator('a[href="/play/"]').first().click(),
  ]);
  events.checks.push("Mobile website stays upright and its Play link enters the rotated game");
  await continueFlight();
  await page.locator('[data-control="aim-joystick"]').waitFor({ state: "visible" });
  // Wait for the kit/Phaser viewport synchronization after its first painted frame.
  await page.waitForFunction(() => {
    const transform = getComputedStyle(document.body).transform;
    return transform !== "none" && Math.abs(new DOMMatrixReadOnly(transform).b) > 0.99;
  });
  const portraitFrame = await frameProof(true);
  await page
    .locator("#game-canvas")
    .getByRole("button", { name: CONTENT.labels.talk, exact: true })
    .waitFor({ state: "visible" });
  const portraitWeapon = page.locator('button[data-weapon="laser"]');
  await portraitWeapon.waitFor({ state: "visible" });
  const turnedControls = await page.evaluate(() => {
    const weapon = document.querySelector('button[data-weapon="laser"]').getBoundingClientRect();
    const pause = document.querySelector('[data-action="pause"]').getBoundingClientRect();
    const canvas = document.querySelector("#game-canvas > canvas").getBoundingClientRect();
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
        .querySelector('button[data-weapon="laser"]')
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
  assert.equal(turnedControls.accessibleName, CONTENT.labels.weaponLaser);
  save("portrait-weapon-alignment.json", turnedControls);
  const portraitBefore = await position();
  const portraitBounds = await Promise.all(
    ["move", "aim"].map((side) => settledBox(`[data-control="${side}-joystick"]`)),
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
    .getByRole("switch", { name: CONTENT.labels.sound, exact: true })
    .waitFor({ state: "visible" });
  await page
    .getByRole("switch", { name: CONTENT.labels.reducedMotion, exact: true })
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
  // A save from a newer version, before version 1 (gameplay/rules.md "Saves reset before version
  // 1"): it is incompatible, so it resets to a new game through the new-game path, the replaced
  // data kept as the backup save. The newer-save update path applies from version 1.
  await portraitContext.close();
  const newerSaved = JSON.stringify({
    marker: "from a newer build",
    mode: "home",
    version: SAVE_VERSION + 1,
  });
  const newerContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await newerContext.addInitScript(reportViolations);
  await newerContext.addInitScript(
    ({ key, value }) => {
      if (!sessionStorage.getItem("ada-smoke.newer-seeded")) {
        sessionStorage.setItem("ada-smoke.newer-seeded", "1");
        localStorage.setItem(key, value);
      }
    },
    { key: storageKey, value: newerSaved },
  );
  await newerContext.route("**/*", previewOnly);
  page = await newerContext.newPage();
  page.on("console", (message) => {
    if (message.text().startsWith("CSP violation")) {
      events.errors.push(message.text());
    }
  });
  await page.goto("http://ada-preview:4173/play/");
  await page.locator('.ada-start-actions > [data-action="start"]').waitFor({ state: "visible" });
  const newerStart = await page.evaluate(
    (keys) => ({
      actions: [...document.querySelectorAll(".ada-start-actions > button")].map(
        (button) => button.dataset.action,
      ),
      backup: localStorage.getItem(keys.backup),
      version: JSON.parse(localStorage.getItem(keys.save) ?? "null")?.version ?? null,
    }),
    { backup: `${storageKey}.backup`, save: storageKey },
  );
  assert.deepEqual(
    newerStart,
    { actions: ["start"], backup: newerSaved, version: SAVE_VERSION },
    "Before version 1 a newer save resets to a new game, kept as the backup save",
  );
  await page.screenshot({ path: `${output}/newer-save.png` });
  events.checks.push(
    "Before version 1 a newer save resets to a new game, Start alone, and is kept as the backup",
  );
  await newerContext.close();
  // A 2404x1080 phone at device pixel ratio 2.5, in whole CSS px (962x432 is 2405x1080), on touch.
  const phoneContext = await browser.newContext({
    deviceScaleFactor: 2.5,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 432, width: 962 },
  });
  await phoneContext.addInitScript(reportViolations);
  await phoneContext.route("**/*", previewOnly);
  await phoneContext.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: safeSerialized,
  });
  page = await phoneContext.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  observe(page);
  assert.equal((await page.goto("http://ada-preview:4173/play/")).status(), 200);
  await continueFlight();
  const phoneHud = await touchHudProof("2404x1080");
  assert.equal(phoneHud.dpr, 2.5, "The phone context renders at device pixel ratio 2.5");
  // 2404x1080 at dpr 2.5 is 801x360 logical, the area 40 to 760: 50 from the sides lies at least
  // 9 inside it, past the 8 margin.
  assert.deepEqual(
    phoneHud.clamped,
    { aim: false, bottom: false, move: false },
    "At 2404x1080 the rings sit 50 from the screen's sides, unclamped",
  );
  events.checks.push(
    "At 2404x1080 dpr 2.5 the rings sit 50 from the screen's sides and 50 from its bottom, " +
      "the shield pill on its own line",
  );
  await phoneContext.close();
  // A crash: the kit's crash screen over the game, in the game's words, with the build label in
  // the dev details, and the last save kept through the page hiding. The thrown error is the point
  // here, so only this page's CSP violations count as errors.
  const crashContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await crashContext.addInitScript(reportViolations);
  await crashContext.route("**/*", previewOnly);
  page = await crashContext.newPage();
  page.on("console", (message) => {
    if (message.text().startsWith("CSP violation")) {
      events.errors.push(message.text());
    }
  });
  // Exit: a browser tab offers it in the start screen's Menu, after Achievements and Settings and
  // before Close, named from Gameplay's string; it and Q on the bare start screen leave for the
  // site's home page.
  await page.goto("http://ada-preview:4173/play/");
  await menuDisc().waitFor({ state: "visible" });
  await openMenu();
  const exitAction = menuCard().locator('[data-action="menu-exit"]');
  assert.equal(
    (await exitAction.textContent())?.trim(),
    CONTENT.labels.exit,
    "Exit is named from Gameplay's string",
  );
  assert.deepEqual(
    (await menuActionIds()).slice(-2),
    ["menu-exit", "menu-close"],
    "Exit sits immediately above the Menu's Close",
  );
  await exitAction.click();
  await page.waitForURL("http://ada-preview:4173/");
  await page.goto("http://ada-preview:4173/play/");
  await menuDisc().waitFor({ state: "visible" });
  await page.keyboard.press("KeyQ");
  await page.waitForURL("http://ada-preview:4173/");
  events.checks.push("A Chromium tab offers Exit in the start screen's Menu; Exit and Q go home");
  await page.goto("http://ada-preview:4173/play/?dev=1");
  await page.locator('[data-action="start"]').waitFor({ state: "visible" });
  const savedBeforeCrash = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  assert.ok(savedBeforeCrash, "The game has saved before the crash");
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("Smoke crash");
    });
  });
  await page.locator(".crash").waitFor({ state: "visible" });
  const { CRASH_COPY } = await import(new URL("../src/data/crashCopy.ts", import.meta.url));
  const crashScreen = await page.locator(".crash").evaluate((screen) => ({
    body: screen.querySelector(".crash-body")?.textContent,
    details: screen.querySelector(".crash-stack")?.textContent ?? "",
    focused: document.activeElement?.textContent,
    role: screen.getAttribute("role"),
    title: screen.querySelector(".crash-title")?.textContent,
  }));
  const { version: crashVersion } = JSON.parse(readFileSync("/source/package.json", "utf8"));
  const crashCommit = process.env.CHECK_REVISION?.slice(0, 8) ?? "dev";
  assert.deepEqual(
    {
      ...crashScreen,
      details: crashScreen.details.split("\n").slice(0, 2),
    },
    {
      body: CRASH_COPY.body,
      details: [`v${crashVersion} · ${crashCommit}`, "Error: Smoke crash"],
      focused: CRASH_COPY.reload,
      role: "alertdialog",
      title: CRASH_COPY.title,
    },
    "A crash shows the crash screen with the build label and the error",
  );
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    savedBeforeCrash,
    "A crash keeps the last save as the page hides",
  );
  await page.screenshot({ path: `${output}/crash-screen.png` });
  events.checks.push("A crash shows the kit's crash screen and keeps the last save");
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
