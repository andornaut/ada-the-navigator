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
ship's nose. Basic is unlimited; each upgrade has its own ammunition count, shown
under its icon, and Ada switches to Basic when the equipped one runs out. Enemies,
asteroids and discovery caches release Stardust, which station shops exchange for
weapons, weapon levels, ammunition packs, ship upgrades and paint schemes; enemies
also drop weapons rarely, and a dropped weapon Ada owns gives a pack of its
ammunition. Once a galaxy's chapter is
complete, its stations' Projects tab takes donations toward community projects:
each confirmed donation pays what the balance covers, and part payments persist.
A funded project with world art changes its outpost, fading in once the first
time the outpost is on screen.
The Paused card's Map shows
the galaxy's discovered destinations and stations and how much of it is mapped;
Travel here reaches a chosen one outside danger, and Return to Earth ends the
flight outside danger, towing or not. Its Quests card lists the story objective
and the held job; a line whose target is mapped selects that place. Space draws
authored sprites for Ada's ship, enemy ships, stations, galaxy one's outposts,
discovery caches, the holodisk and its beacon, Stardust, weapon pickups, missiles,
blasts, the Phaser beam and asteroids. Galaxy two's hub, miner and visitors,
galaxy three's whale and family, mining deposits, cargo, hazards and traveling
debris keep simple placeholders. See [economy](gameplay/economy.md).

## Controls

The game uses a 720 × 360 base view (2:1 landscape), matching Chibi. The canvas
expands to available space while the play view stays centered across the top.
Portrait touch screens turn the page frame to landscape; controls remain mapped
to the visible frame. The canvas renders in device pixels at up to twice its CSS
size, with pixel art sampled nearest-neighbor and vector art smoothly.

Prototype input mappings:

| Input                    | Action                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ |
| WASD                     | Move                                                                           |
| Arrow keys               | Aim and fire while held                                                        |
| Space                    | Use the available contextual action                                            |
| Esc                      | Close the open card; with none open, pause in flight or open Settings at start |
| Back                     | Close the open card; with none open, pause in flight                           |
| Weapon buttons           | Equip an owned weapon                                                          |
| Pause button (touch)     | Pause in flight and on Ada's room page                                         |
| Left touch joystick      | Move                                                                           |
| Right touch joystick     | Aim and fire while deflected                                                   |
| Contextual action button | Talk, deliver or deposit when available                                        |

In flight the Paused card offers Resume, Map, Settings and Back to title; on
Ada's room page it offers Settings and Back to title. Back to title opens the
start screen, where Continue resumes. The start screen's Achievements button
sits left of Settings.

Mobile uses independent twin joysticks. Centering the aim stick stops firing;
without aim input, the ship faces its movement direction.

## Saving

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
source lint, `npm test` runs Vitest, and `npm run build` builds the Vite output
in `dist/`. `npm run check` combines scratch-owned hook verification,
TypeScript, lint, tests, build and the Wrangler packaging dry run.

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

The bus uses pinned Wrangler with root `wrangler.jsonc`, which defines the
assets-only Worker `ada-the-navigator`, its custom domain
`navigator.adabekele.com` and the gated `dist/` as its assets. Deployment does
not rebuild. No application Worker entrypoint or deploy-time build command is
configured. The account, disabled workers.dev and preview URLs, logs and traces
are set there.

The isolated gate validates Wrangler packaging with
`npm run deploy:wrangler:dry-run`, which does not deploy. See [isolated checks](docs/checks.md) for gate evidence.
Credentials are not part of this repository.
