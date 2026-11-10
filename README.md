# Ada the Navigator

A browser-game prototype combining space exploration with interactive Toronto
stories. Built with Phaser, TypeScript and Vite using the shared art-kit,
game-kit and delivery-kit.

## Prototype scope

The [prototype contract](gameplay/prototype.md) defines the implementation target;
integration and playtesting are still in progress. This is an untuned prototype,
not a polished game or a claim that every contracted behavior has passed checks.

Three story sectors are designed:

- Cooperating outposts: connect growers, a workshop and salvagers, then help start
  a community garden in Toronto.
- Mining hub: collect and deposit resources, support a miner facing intimidation,
  then help Ada and her friends include a child at school.
- Whale family: clear debris, locate the whale's family and relay coordinates,
  then help Ada understand her dog's need to explore.

Space quests and their Toronto resolutions unlock sectors in order. Completed
sectors remain replayable. Sector four's conclusion is deferred and has no
playable story. See [dialogue and objectives](gameplay/prototype-copy.md).

The flight target includes independent movement and aim, a rechargeable shield,
basic fire and limited-ammo upgrades, contextual interactions and travel to
known destinations outside danger. Space uses monochrome placeholders apart
from Ada's compact white-and-blue ship.

## Controls

Prototype input mappings:

| Input                    | Action                                            |
| ------------------------ | ------------------------------------------------- |
| WASD                     | Move                                              |
| Arrow keys               | Aim and fire while held                           |
| Space                    | Use the available contextual action               |
| Esc                      | Open or close settings                            |
| Left touch joystick      | Move                                              |
| Right touch joystick     | Aim and fire while deflected                      |
| Contextual action button | Talk, deliver, deposit or continue when available |

Mobile uses independent twin joysticks. Centering the aim stick stops firing;
without aim input, the ship faces its movement direction.

## Saving

The persistence contract distinguishes an interrupted flight from leaving a sector:

- Closing and reopening should resume the exact flight, including layout seed,
  cargo, ammunition and shield state.
- Leaving and re-entering should generate a new layout seed and reset carried
  cargo and weapon pickups. Story progress, known destinations, deposited
  resources and achievements persist.

These behaviors require integrated validation; reload is not intended to act as
leaving a sector.

## Development

Use Node.js 24.21.0 or newer. Install the locked dependencies and start Vite:

```bash
npm ci && \
  npm run dev
```

Open the local URL printed by Vite to play the development build. The available
prototype behavior depends on the integrated source revision. Dependency
installation enables the Husky pre-commit hook. Run tests and production builds
through the isolated checks below.

## Checks

Docker is required for verification. Start the complete isolated gate with:

```bash
node tools/checks.mjs start all
```

See [isolated checks](docs/checks.md) for collection, evidence, scheduling and
resource limits. CI requires `AI attributions`, `Lint` and `Test`.

## Delivery

Delivery is paused. `delivery-kit.json` proposes :30 America/Toronto and sets
`deploy.mode` to `none`. No runner or deployment is activated.

Future deployment requires a reviewed static build, an explicitly selected
deployment target and secret reference names, successful checks for the exact
source commit, and explicit runner activation. Credentials are not part of this
repository.
