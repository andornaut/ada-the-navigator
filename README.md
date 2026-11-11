# Ada the Navigator

A browser-game prototype combining space exploration with interactive stories
at home. Built with Phaser, TypeScript and Vite using the shared art-kit,
game-kit and delivery-kit.

## Version one scope

The [version one rules](gameplay/rules.md) define the scope and approved rules.
Balance values are provisional and tuned through playtesting.

Three story galaxies are designed:

- Cooperating outposts: connect growers, a workshop and salvagers, then help start
  a community garden at home.
- Mining hub: collect and deposit resources, support a miner facing intimidation,
  then help Ada and her friends include a child at school.
- Whale family: clear debris, locate the whale's family and relay coordinates,
  then help Ada understand her dog's need to explore.

A galaxy's space quest, its resolution at home and its recovered holodisk unlock
the next galaxy. Completed galaxies remain replayable. Galaxy four's conclusion is deferred and has no
playable story. See [dialogue and objectives](gameplay/player-copy.md).

Flight has independent movement and aim, a rechargeable shield and contextual
interactions; the status pill shows the shield and Ada's Stardust. Ada has six
weapons: Basic, always available, and five upgrades (Rapid Missile, Multi-Laser,
Heavy Missile, Scattershot and Phaser). Each has three levels and fires from the
ship's nose without ammunition. Enemies, asteroids and discovery caches release
Stardust, which station shops exchange for weapons, weapon levels, ship upgrades
and paint schemes; enemies also drop weapons rarely. Once a galaxy's chapter is
complete, its stations' Projects tab takes donations toward community projects,
100 Stardust a press. The Paused card's Map shows
the galaxy's discovered destinations and stations and how much of it is mapped;
Travel here reaches a chosen one outside danger. Space draws
authored sprites for Ada's ship, enemy ships, stations, galaxy one's outposts,
discovery caches, the holodisk and its beacon, Stardust, weapon pickups, missiles,
blasts, the Phaser beam and asteroids. Galaxy two's hub, miner and visitors,
galaxy three's whale and family, mining deposits, cargo, hazards and traveling
debris keep simple placeholders. See [economy](gameplay/economy.md).

## Controls

The game uses a 720 × 360 base view (2:1 landscape), matching Chibi. The canvas
expands to available space while the play view stays centered across the top.
Portrait touch screens turn the page frame to landscape; controls remain mapped
to the visible frame. Rendering uses nearest-neighbor scaling.

Prototype input mappings:

| Input                    | Action                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ |
| WASD                     | Move                                                                           |
| Arrow keys               | Aim and fire while held                                                        |
| Space                    | Use the available contextual action                                            |
| Esc                      | Close the open card; with none open, pause in flight or open Settings at start |
| Back                     | Close the open card; with none open, pause in flight                           |
| Weapon buttons           | Equip an owned weapon                                                          |
| Pause button (touch)     | Pause in flight                                                                |
| Left touch joystick      | Move                                                                           |
| Right touch joystick     | Aim and fire while deflected                                                   |
| Contextual action button | Talk, deliver or deposit when available                                        |

The Paused card offers Resume, Map, Settings and Return home.

Mobile uses independent twin joysticks. Centering the aim stick stops firing;
without aim input, the ship faces its movement direction.

## Saving

The persistence contract distinguishes an interrupted flight from leaving a galaxy:

- Closing and reopening resumes the exact flight, including its layout seed,
  position, cargo, shield and equipped weapon.
- Leaving a galaxy ends its flight: re-entering generates a new layout seed and
  starts without carried cargo. Story progress, known destinations, discovered
  stations, deposited resources, activity counters, Stardust, owned weapons, levels,
  ship upgrades and paint schemes persist.
- Shield depletion jumps Ada home and costs only the flight: its layout, open-space
  enemies, pickups, carried cargo and any towed pod. Weapons, levels, Stardust and
  accepted quests are kept. She lands at night, sleeps while Astra recharges
  overnight, and wakes in the morning.

Combat includes data-defined solo ships and packs, independent large-ship
hardpoints and straight-flying missiles. Required approach encounters stay outside
friendly safe zones. See the [enemy rule interface](gameplay/enemies.md).

Flight snapshots are stored locally in this browser. If browser storage is
unavailable, play continues with a nonblocking save warning. The warning clears
after a successful write; failed writes preserve the last persisted snapshot.

## Offline and install

The production build writes `/sw.js`, a service worker scoped to `/` that
precaches the game page at `/play/`, the build output it loads, the web app
manifest and its icons, every file under `public/art/` except `app-icon/`, and
the galaxy selector previews under `public/previews/`.
The precache version is a hash of that content, so any change installs a new
worker. Hashed `/assets/` files are served cache-first; the page, art and
manifest are network-first, so an online load shows the latest deploy and an
offline load uses the cached copy. A first visit registers the worker once the
game has drawn. While a new worker waits, the start screen offers it: Update now
switches to it and reloads, and Cancel keeps the current version for that visit.
Otherwise it takes over on a later launch, after every page the old one controls
has closed. The landing page at `/` is not precached.

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

## Development

Use Node.js 24.22.2 (or supported Node.js 26.12.0+). Install the locked dependencies and start Vite:

```bash
npm ci && \
  npm run dev
```

Open the local URL printed by Vite for the website, then follow Play to `/play/`.
The website and game use the same origin and browser save key. The available
prototype behavior depends on the integrated source revision. Dependency
installation enables the Husky pre-commit hook. Native npm checks run directly in
the current environment; Make selects the container profile below.

## Checks

Native lint requires ShellCheck 0.11.0 on PATH; the container image supplies it.
Native npm scripts never invoke Make: `npm run lint` checks shell helpers, formatting and
source lint, `npm test` runs Vitest, and `npm run build` builds Vite output and
retains assets. `npm run check` combines scratch-owned hook verification,
TypeScript, lint, tests, build and both packaging dry runs.

`make check` enters the canonical container launcher. This repository also keeps
optional `make lint`, `make test` and `make build` aliases, and `make previews`
rebuilds and recaptures the galaxy selector previews. Its custom Dockerfile
is required by CI, which runs `make lint` for `Lint` and `make test build` for
`Test`. `AI attributions` remains a separate required check.

See [check commands and evidence](docs/checks.md) and
[container compatibility](docs/container-adoption.md). The detached receipt
adapter and browser artifact proof remain available.

## Delivery

`delivery-kit.json` schedules Ada departures hourly at :00 America/Toronto using
pinned delivery-kit 3.0.0. Only the existing bus deploys, after the isolated gate
and required CI pass for the exact commit. The monitor schedule is unchanged.
Desired control remains paused; game-dev enables only Ada after READY review.

Cloudflare setup uses typed `cloudflare.config.ts` for the existing assets-only
Worker `ada-the-navigator` and custom domain `navigator.adabekele.com`. The
Cloudflare Vite plugin writes static assets and deployment metadata into
`.cloudflare/output/v0/`. The gate build also retains those assets as `dist/`.

The bus uses pinned Wrangler with root `wrangler.jsonc` and the retained gated
`dist/`. Deployment neither rebuilds nor depends on hidden Cloudflare output.
No application Worker entrypoint or deploy-time build command is configured.
The existing account, disabled workers.dev and preview URLs, logs and traces
are preserved in both configurations.

The isolated gate validates both CF prebuilt output and Wrangler packaging with
`npm run deploy:prebuilt:dry-run` and `npm run deploy:wrangler:dry-run`. These
commands do not deploy. See [isolated checks](docs/checks.md) for gate evidence.
Credentials are not part of this repository.
