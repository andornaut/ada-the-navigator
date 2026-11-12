# Architecture and Development

## Platform

- **Stack:** Phaser 4, TypeScript and Vite.
- **Hosting:** Cloudflare Workers static assets, no Worker script (`wrangler.jsonc`).
- **Targets:** landscape phone browsers with twin touch joysticks, and desktop browsers with keyboard controls.
- **Tooling:** Node 24.22.2, Vitest, ESLint with the shared house rules, Prettier, markdownlint, Dependabot, and the Test and AI attributions workflows.

## Site

Vite builds the HTML inputs in [`pages/`](../pages/) and serves the landing page at
`/` and the game at `/play/`. [`vite.config.ts`](../vite.config.ts) uses game-kit's
`gameViteConfig` (`@andornaut/game-kit/web/build/vite/gameConfig`) with the plugin
inputs in [`src/tools/viteConfigModules.ts`](tools/viteConfigModules.ts): the
dev server's `/play` redirect (`sitePages`), hashed icons and the service worker's
precache. Build and deployment commands are in the [root README](../README.md).

## Architecture

Player-facing rules live in the [gameplay rules](../gameplay/rules.md); this section
describes their implementation.

### Source layout

- **Entry:** [`src/main.ts`](main.ts) creates the Phaser game at the 720 × 360 base
  view in device pixels, mounts the loading bar and sets up the phone app.
  [`src/lifecycle.ts`](lifecycle.ts) sleeps the game loop while the page is hidden.
- **Model:** [`src/model/`](model/) holds the game state (`GameModel`), flight,
  combat, economy, stories, saves and their migrations, Phaser-free.
- **Data:** [`src/data/`](data/) holds the authored content: galaxies, ships,
  weapons, enemies, story pages, conversations and the base view (`screen.ts`).
- **Game:** [`src/game/`](game/) holds the play scene (`scene.ts`), its cameras
  and touch chrome, and the Phaser-free art adapters, draw order, palettes and
  persistence the scene reads.
- **Input:** [`src/input/`](input/) holds keyboard and stick state (`state.ts`)
  and the controls that wire them to the scene and the interface (`controls.ts`).
- **UI:** [`src/ui/`](ui/) holds the HTML interface drawn over the canvas: the
  start screen, cards, storybook, station, map, settings, HUD and touch sticks.
  [`src/ui/layout/`](ui/layout/) computes every position, size and press area,
  with the spacing and type tokens in `tokens.ts`.
- **Page:** [`src/loading/`](loading/) drives the kit's DOM progress bar,
  [`src/pwa/`](pwa/) the service worker, install and update flows,
  [`src/view/`](view/) the frame turn, and [`src/landing/`](landing/) the landing
  page's Install button.
- **Phaser boundary:** only `src/main.ts` and the Phaser modules
  (`game/playCamera`, `game/scene`, `game/touchChrome`, `input/controls`) import
  Phaser, the kit's `phaser/` modules or one another, enforced by ESLint's
  `no-restricted-imports`. The model, data, layout, interface and the rest of
  `src/game/` are Phaser-free, so they unit-test without a renderer.
- **Test helpers:** [`src/testing/`](testing/) is importable only from tests and
  `src/testSetup.ts`: `launch.ts` pins launch seeds and drives a model through the
  opening and story pages, and `public-art.ts` reads Art's manifests from
  `public/art/`. [`src/tests/`](tests/) holds the repository-level tests (hooks,
  check startup, kit consumption, page lifecycle).

### Assets and build

- **Shared kits:** game-kit, art-kit and delivery-kit are installed from their
  version-pinned GitHub release tarballs in `package.json`, with checksum integrity
  in `package-lock.json`.
- **Icons:** the build writes each icon in [`src/pwa/icons.ts`](pwa/icons.ts) again
  under a content-hashed name in `/assets/` and points the built pages and manifest
  there.
- **Build label:** `gameViteConfig` defines `__APP_VERSION__` and `__COMMIT__`;
  [`src/buildLabel.ts`](buildLabel.ts) formats them for the Settings card's last
  line. The checks pass the checked revision as the build's commit.

## Save data

The persistence contract distinguishes an interrupted flight from leaving a galaxy:

- Every launch opens on the start screen. After closing mid-flight, Continue
  resumes the exact flight, including its layout seed, position, cargo, shield,
  equipped weapon, tow and danger.
- Leaving a galaxy ends its flight: re-entering generates a new layout seed and
  starts without carried cargo. Story progress, known destinations, discovered
  stations, deposited resources, activity counters, Stardust, owned weapons, levels,
  ship upgrades and paint schemes persist.
- Shield depletion jumps Ada home and costs only the flight: its layout, open-space
  enemies, pickups, carried cargo and any towed pod. Weapons, levels, Stardust and
  accepted quests are kept. She lands at night, sleeps while Astra recharges
  overnight, and wakes in the morning.

Flight snapshots are stored locally in this browser. If browser storage is
unavailable, play continues with a nonblocking save warning. The warning clears
after a successful write; failed writes preserve the last persisted snapshot.

The flight snapshot is stored in `localStorage` under one key
([`src/game/persistence.ts`](game/persistence.ts)), validated and migrated by
[`src/model/save.ts`](model/save.ts). Device settings (move stick, aim stick,
sound and reduced motion) are stored under their own keys
([`src/ui/deviceSettings.ts`](ui/deviceSettings.ts)), outside the save.

## Phone

The production build writes `/sw.js`, a service worker scoped to `/` that
precaches the game page at `/play/`, the build output it loads, the web app
manifest and its icons, every file under `public/art/` except `app-icon/`, and
the galaxy selector previews under `public/previews/`.
The precache version is a hash of that content, so any change installs a new
worker. Hashed `/assets/` files are served cache-first; the page, art and
manifest are network-first, so an online load shows the latest deploy and an
offline load uses the cached copy. A first visit registers the worker once the
game has drawn. A launch the worker controls checks for a newer version first,
holding the start screen for at most 4 seconds while it does. While a new worker
waits, the start screen offers it: Update now
switches to it and reloads, and Cancel keeps the current version for that visit.
Otherwise it takes over on a later launch, after every page the old one controls
has closed. The landing page at `/` is not precached.

A loading bar along the view's top edge, above every other layer, shows the loads
the player waits for. The boot preload and a galaxy's art as its first flight
starts fill it left to right; it holds full for 250 ms and fades out over 150 ms,
then its element is removed. While a first visit precaches the game, a segment
30% of the width travels across it until that work ends; an update installs
silently and resumes from the files it already stored. Art loaded on demand
during play (scenery, rocks, ship parts, paint) shows nothing, and with nothing
waited for there is no bar. Its cream fill and ink track sit on a 1 px ink rule,
so it reads on every galaxy's field.

Both pages link `/manifest.webmanifest`, which installs the game at `/play/`.
The build writes each icon in `src/pwa/icons.ts` again under a content-hashed
name in `/assets/` and points the built pages and manifest there, so a redrawn
icon reaches an installed app; the source pages and manifest keep plain URLs.
`src/pwa/index.ts` exposes the install state, its change listener, the install
prompt and the browser whose own menu installs the game (iOS and Firefox for
Android). The dev server registers no service worker. The landing page's
Install button runs on `src/landing/main.ts`, which loads only the kit's
install modules: it shows while the browser can install the game, opens the
browser's prompt or that browser's menu steps, and registers no service worker.

## Dev tools

- **Cheats:** the browser-tab cheats are defined in [gameplay/cheats.md](../gameplay/cheats.md)
  and implemented in [`src/ui/cheats.ts`](ui/cheats.ts) and
  [`src/model/cheats.ts`](model/cheats.ts).
- **Launch worlds:** `ADA_LAUNCH_SEED=<n> npm test` replays the suite in another
  launch-seed world; [`tools/test-worlds.mjs`](../tools/test-worlds.mjs) runs three
  further worlds in the container's test category.
- **Pacing:** [`tools/pacing-sim.ts`](../tools/pacing-sim.ts) simulates Stardust
  pacing headlessly for Gameplay review.
- **Layout:** [`tools/layout-dump.ts`](../tools/layout-dump.ts) dumps every computed
  UI layout result as canonical JSON.
- **Previews:** `make previews` recaptures the galaxy selector previews with
  [`tools/galaxy-previews.mjs`](../tools/galaxy-previews.mjs).
- **Browser smoke:** [`tools/browser-check.mjs`](../tools/browser-check.mjs) runs
  [`tools/browser-smoke.mjs`](../tools/browser-smoke.mjs) against a gated build; see
  [check commands and evidence](../docs/checks.md).
