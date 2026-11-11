# Quests

Station jobs and the landmarks surveys chart. Every number in this document is
provisional tuning. [Economy](economy.md) defines Stardust pacing and stations, and
[the version one rules](rules.md) define direction indicators, Penny's sense,
carried items and persistence.

## Station jobs

Every station has a job board of small helping jobs. A job takes two to five
minutes, reads simply for a 12-year-old and is non-violent at its core: no job
asks Ada to destroy anything, and drones met on the way are incidental. Job
targets keep 1000 world units clear of retained frigates, capitals and platforms.

### Job board

The station card shows the Stardust balance, the welcome line, Undock, Shop and
Jobs. Jobs opens the job board, which follows the shop's card pattern; its close
X, an outside tap, back and Escape return to the station card.

- Each board offers three jobs at once, drawn from its galaxy's job pool by the
  station's seed, with no two of the same type while the pool allows.
- Each row shows the job type's icon, a title, one line of detail and the reward,
  with Accept. Accept takes the job at once, with no confirm.
- Ada holds at most one station job per galaxy. While she holds one, other rows' Accept stays focusable, refuses with
  the shared refusal feedback and shows "Finish or drop your current job first."
- The held job shows at the top of every board in its galaxy, marked Active,
  with Drop. Drop asks "Drop this job?" with Drop and Cancel. Dropping loses the
  job's progress and returns it to the board that offered it.
- A board's offers stay until taken. A slot refills with a new job from the pool
  when its job is completed. When every landmark in a galaxy is charted, its
  boards stop offering surveys.
- The held job's objective shows beside the story objective, labelled Job. Its
  target uses the direction indicator for quest events.
- A job pays at completion wherever Ada is: a notice shows "Job complete: +{amount}
  Stardust", then Astra says one unseen lore line from the galaxy's job pool.

Jobs persist across flights, regeneration, closing the game and visits to other
galaxies. A job's targets are fixed and saved when it is accepted, and survive
layout regeneration like stations. Restart clears jobs and boards.

### Job types

- **Survey**: chart one uncharted landmark for Astra's map (see
  [Landmarks](#landmarks)). The indicator marks the landmark, and charting
  it completes the job.
- **Delivery**: carry cargo or a message from the issuing station to another
  known station or outpost in the galaxy at least 3000 world units away,
  preferring the nearest, with no upper limit. The job names the destination by
  its Map name. An outpost destination keeps its id and reward when the layout
  regenerates, and the indicator points to its current position. Accepting
  loads the item into a job carried-item slot, separate from story items and
  mining cargo. Deliver at the destination completes the job. A lost item is
  replaced at the issuing station, as for story deliveries. Travel here from the
  Map is allowed outside danger.
- **Rescue and tow**: find a stranded pod or small ship 3000 to 7000 world units
  away and tow it to safety at the issuing station or any known outpost. See
  [Tow handling](#tow-handling).
- **Lost-item hunt**: search a marked area, 900 world units in radius, for a lost
  item. The indicator points to the area's centre while Ada is outside it and
  hides while she is inside. Penny's sense helps: when the item is within 350 world units, Penny's
  "Woof! Woof!" conversation plays once for that item, ignoring its usual 60 second
  limit. The item glints within 160 world units, like a discovery cache, and is
  collected on contact.

### Tow handling

Ada attaches the tow with the Use button, labelled Tow, within 120 world units of
the stranded craft. The craft trails on an 80 world unit line, pulled along when
the line is taut, and passes through scenery so it never snags. While towing:

- Ada's top speed is multiplied by 0.65.
- `accelerationSeconds` and `brakingSeconds` are doubled, so the ship gathers and
  sheds speed slowly and carries more momentum.
- `turnSeconds` is multiplied by 1.5, so turns swing wider.

The multipliers apply to Ada's current values, so engine tuning still helps.
Enemies ignore the towed craft, and it takes no damage. Ada fights normally.
The Map's Travel here is unavailable while towing and refuses with the shared
refusal feedback.
Bringing the craft within 400 world units of the safe place completes the rescue,
and the craft parks there. Return home or a shield-depletion jump returns the
craft to where it was stranded, still marked. Closing the game resumes the tow
exactly.

### Rewards

A job pays Stardust and a lore line. Rewards sit on top of ordinary earnings from
asteroids and drones met on the way. The pacing target: a player who takes Sunflower
jobs back to back affords the first weapon (150) in about 15 minutes instead of
about 20, against typical income of about 8 per minute. Later galaxies multiply
rewards by 1.5 (Cartwheel) and 2 (Whirlpool and Black Eye), rounded down to a
multiple of 5.

| Job             | Typical minutes | Sunflower | Cartwheel | Whirlpool | Black Eye |
| --------------- | --------------: | --------: | --------: | --------: | --------: |
| Survey          |               2 |        10 |        15 |        20 |        20 |
| Lost-item hunt  |               3 |        15 |        20 |        30 |         – |
| Delivery, short |               3 |        15 |        20 |        30 |         – |
| Delivery, long  |               4 |        25 |        35 |        50 |         – |
| Rescue and tow  |               4 |        25 |        35 |        50 |        50 |

A short delivery is under 6000 world units; a long one is 6000 or more. Black Eye
boards offer only surveys and rescue and tow: travelers stranded by the blockades.

### Job pool

Each galaxy's pool fills job titles with its own items.

| Galaxy    | Delivery items                     | Stranded craft             | Lost items                          |
| --------- | ---------------------------------- | -------------------------- | ----------------------------------- |
| Sunflower | seeds, spare parts, a message      | a seed pod, a scrap barge  | a toolbox, a watering can           |
| Cartwheel | ore samples, drill bits, a message | an ore pod, a stuck hauler | a lucky charm, a helmet             |
| Whirlpool | song shells, star maps, a message  | a current skimmer, a pod   | a music shell, a whale-call whistle |
| Black Eye | none                               | a traveler's pod           | none                                |

Job lore lines, said by Astra after a job completes, one unseen line per job:

- Sunflower: "Nebulae are clouds where new stars are born." "The growers trade
  seeds the way some people trade stories."
- Cartwheel: "Every rock here was once part of something bigger." "Miners name
  their drills. I would like a name for my drive."
- Whirlpool: "Whales sing to map the currents. We are both mapmakers."
  "Currents carry seeds, rocks and songs from one side of Whirlpool to the other."
- Black Eye: "Not every traveler here chose to stay." "Even a dark rim has
  stars."

### Player strings

| Key             | Text                                       |
| --------------- | ------------------------------------------ |
| `jobs`          | Jobs                                       |
| `jobBoard`      | Job board                                  |
| `jobBoardIntro` | People here could use some help.           |
| `job`           | Job                                        |
| `jobAccept`     | Accept                                     |
| `jobActive`     | Active                                     |
| `jobDrop`       | Drop                                       |
| `jobDropTitle`  | Drop this job?                             |
| `jobDropCancel` | Cancel                                     |
| `jobBusy`       | Finish or drop your current job first.     |
| `jobReward`     | {amount} Stardust                          |
| `jobComplete`   | Job complete: +{amount} Stardust           |
| `tow`           | Tow                                        |
| `towTravel`     | Unavailable while towing.                  |
| `surveyTitle`   | Chart a {landmark}                         |
| `surveyAbout`   | Astra's map has a gap here. Fly close.     |
| `deliveryTitle` | Deliver {item} to {place}                  |
| `deliveryAbout` | They're waiting for it.                    |
| `rescueTitle`   | Tow {craft} to safety                      |
| `rescueAbout`   | Its engine stopped. Towing makes you slow. |
| `huntTitle`     | Find a lost {item}                         |
| `huntAbout`     | It's in the marked area. Ask Penny.        |

In-flight lines, each played once per save:

- Tow attached: Astra: "Tow line attached. We'll be slow and heavy." Ada: "Hold
  on, we've got you!" (happy)
- Search area entered: Ada: "It's around here somewhere. Penny, can you help?"

## Landmarks

Each galaxy has 12 landmarks for surveys to chart: nebulae, wrecks and beacons,
drawn in the galaxy's own palette. Wrecks are old hulls with no one aboard.
Landmarks are placed by the galaxy's seed within 25000 world units of the galaxy's
world origin, at least 3000 world units apart and 1500 from stations and story
destinations, so they stay in the same places on every flight, like stations.
Chunk generation keeps their space clear.

- An uncharted landmark is a point of interest for Penny's sense. It gets a
  direction indicator only as a survey's target.
- Flying within 300 world units of a landmark charts it at once and plays the
  existing "New place mapped." conversation.
- Charted landmarks persist across flights and regeneration. Restart clears them.
