# Quests

Station jobs, the landmarks surveys chart, repeatable activities and achievements. Every number in this
document is provisional tuning. [Economy](economy.md) defines Stardust pacing and
stations, and [the version one rules](rules.md) define direction indicators,
Penny's sense, conversations, carried items and persistence.

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
- The held job's objective shows in the Map's Quests modal under the story
  objective, as "Job: {objective}". Its target uses the direction indicator for quest
  events and is marked on the Map.
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
and the craft parks there. Return to Earth, Back to title or a shield-depletion jump returns the
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
| `jobObjective`  | Job: {objective}                           |
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
| `surveyTitle`   | Chart the {landmark}                       |
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

Each galaxy has four landmarks of each kind. The seed assigns the kinds, and the
names go in table order within a kind, so each landmark keeps its name on every
flight. The Map and survey titles use these names.

| Galaxy    | Nebulae                                                 | Wrecks                                                               | Beacons                                             |
| --------- | ------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| Sunflower | Petal Nebula, Honey Cloud, Pollen Haze, Dandelion Drift | Old Seed Barge, Rusty Planter Ship, Sleepy Tug, Patchwork Shuttle    | Daisy Beacon, Bee Light, Sunrise Buoy, Lantern Post |
| Cartwheel | Ember Cloud, Rust Haze, Spark Nebula, Furnace Glow      | Cracked Drill Ship, Lost Ore Hauler, Bent Crane Barge, Quiet Smelter | Ring Light, Miner's Lamp, Spoke Beacon, Hub Marker  |
| Whirlpool | Tide Nebula, Bubble Cloud, Swirl Haze, Kelp Glow        | Sunken Skimmer, Coral Hull, Driftwood Hull, Old Diving Bell          | Song Buoy, Wave Light, Shell Beacon, Current Marker |
| Black Eye | Shadow Cloud, Inkwell Nebula, Dim Veil, Smoke Haze      | Broken Drone, Silent Hull, Cold Freighter, Old Patrol Ship           | Red Lamp, Watch Light, Lost Signal, Far Marker      |

## Repeatable activities

Once a galaxy's chapter is complete, its story places offer a repeatable
activity through Talk, with Accept and Not now. An activity takes the galaxy's
one optional task slot, shared with station jobs: while it is active, that
galaxy's job boards offer no job, and an active job keeps the activity from
being offered. An accepted activity, its galaxy and its progress persist across
flights like a job; a supply run's carried item uses the job carried-item slot.
It pays at completion with the job completion notice alone, with no lore line,
and is offered again on the next Talk. Black Eye has no repeatable activity yet.

- While an activity is active, the galaxy's boards show their jobs, and Accept
  refuses with "Finish your activity first." The activity shows at the top of
  every board in its galaxy, marked Active, with Drop, as a held job does; Talk
  at its offering place also offers Drop. Drop asks "Drop this activity?" and
  loses its progress.
- While a job holds the slot, Talk plays the activity line, and Accept refuses
  with "Finish or drop your current job first."
- The Map's Quests modal shows an active activity as its "Job:" line.
- On a board, the Active activity row's detail line is its goal: "Carry
  supplies to a station.", "Guide a whale calf home." or "Deposit 30 resources
  at the hub."
- Holding one outpost's supply run, Talk at another outpost refuses Accept with
  "Finish your activity first."

| Galaxy    | Activity        | Offered by          | Goal                                                     |   Reward |
| --------- | --------------- | ------------------- | -------------------------------------------------------- | -------: |
| Sunflower | Supply run      | Any of the outposts | Carry supplies to a station 3000 or more away.           | 15 or 25 |
| Cartwheel | Mining contract | The hub             | Deposit 30 resources at the hub; partial loads count.    |       35 |
| Whirlpool | Guide a calf    | The whale family    | Lead a whale calf 5000 to 8000 world units home to them. |       50 |

- **Supply run**: follows the delivery job rules in full, 3000 minimum
  included: the outpost's item goes to a known station at least 3000 world
  units away, preferring the nearest, and pays the delivery rewards (15 short,
  25 long). With no such station known, the outpost makes no offer. The items
  are fresh food, repaired tools and spare parts; a lost item is replaced
  through Talk at the issuing outpost.
- **Mining contract**: counts only deposits made after accepting, from 0; the
  hub's story deposit total keeps counting alongside. At most half of
  ore fields have a platform guarding them, so unguarded ore is always available.
- **Guide a calf**: the calf waits at a spot chosen by the galaxy seed and a
  count of guides, saved relative to the family, 5000 to 8000 world units away
  with the straight line to the family crossing a current. If no spot
  qualifies, the family makes no offer that flight. A waiting calf starts following when Ada is
  within 160 world units, so it is on screen, moving like `chase` without firing, stopping 120
  short, at most 0.8 of Ada's base top speed with no upgrades; a following calf
  keeps following out to 340, about the view's edge, then waits. Travel here ends the follow, and the
  calf waits where it is. It drifts with currents like Ada. One
  hunter pack of 3 to 4 fighters waits at the midpoint of the straight line,
  placed again whenever the calf resets. The calf takes no damage, and drones ignore
  it. The calf reaching within 400 world units of the family completes the activity.
  While the calf is away, the family shows one calf fewer. The indicator points
  to the calf until it follows, then to the family. Closing the game resumes the
  guide exactly, as for a tow.
  Return to Earth, Back to title or a shield-depletion jump returns the calf to its start.

Activity lines:

- Grower: "Fresh food for the station traders. Would you carry it?"
- Workshop: "A station ordered these repaired tools. Could you take them?"
- Salvager: "A station shop needs these spare parts. Will you bring them?"
- Station: "Contract open: deposit 30 resources here. Partial loads count."
- Whale family: "One of our young ones swam off to play. Could you guide them
  home? Stay close. They follow friends."

| Key                 | Text                                        |
| ------------------- | ------------------------------------------- |
| `activityTake`      | Accept                                      |
| `activitySkip`      | Not now                                     |
| `activityBusy`      | Finish your activity first.                 |
| `activityDrop`      | Drop this activity?                         |
| `supplyObjective`   | Carry {item} to {destination}.              |
| `contractObjective` | Deposit resources at the hub: {have} of 30. |
| `calfFind`          | Find the whale calf.                        |
| `calfGuide`         | Guide the calf home.                        |

Templates carry no article; every destination has a sentence name with its
article, used in objectives and job titles: a station is "the station", an
outpost "the growers' outpost", "the workshop" or "the salvagers' yard", and
other places "the mining hub", "the whale family" or "the settlement". So:
"Deliver seeds to the station" and "Carry fresh food to the station."

## Achievements

Achievements cover story, map charting, helping, donations, Penny's finds and
collections. The start screen has an Achievements button, immediately left
of Settings, that opens an Achievements card, as in Chibi. Achievements and their progress
survive Restart. None needs a missable dialogue choice. Unlocking one shows the
notice "Achievement: {name}"; one earned at home is announced at the start of
the next flight. A Penny find is a point of interest Penny sensed that Ada then
reaches within 160 world units, counted once per point. Restart keeps the find
count and starts a new list of found points.

| Name               | Condition                                           |
| ------------------ | --------------------------------------------------- |
| New Navigator      | Finish the prologue.                                |
| The Garden Begins  | Complete the Sunflower chapter.                     |
| Room for Everyone  | Complete the Cartwheel chapter.                     |
| Time to Explore    | Complete the Whirlpool chapter.                     |
| Blockade Breaker   | Break General Gadget's blockade in Black Eye.       |
| Cartographer       | Chart every landmark in one galaxy.                 |
| Astra's Atlas      | Chart every landmark in all four galaxies.          |
| Helping Hand       | Complete a station job.                             |
| Good Neighbor      | Complete 25 station jobs or repeatable activities.  |
| Friends Everywhere | Make every optional ally: quest and project allies. |
| Good Cause         | Fund a community project.                           |
| Community Builder  | Fund every community project.                       |
| Good Nose          | Reach 10 things Penny sensed.                       |
| Full Palette       | Own every ship paint.                               |

The card lists every achievement in table order; none is hidden. A locked entry
shows its full name and condition in muted grey with a grey badge; an unlocked
entry has an ink name and a coloured badge, as in Chibi. A locked counted
achievement also shows its progress as `{have}/{need}`:

| Name               | Counts                                                    |
| ------------------ | --------------------------------------------------------- |
| Cartographer       | Landmarks charted in the galaxy with the most charted     |
| Astra's Atlas      | Landmarks charted across all four galaxies                |
| Good Neighbor      | Station jobs and repeatable activities completed, of 25   |
| Friends Everywhere | Optional allies made                                      |
| Community Builder  | Community projects funded                                 |
| Good Nose          | Penny finds, of 10                                        |
| Full Palette       | Ship paints ever owned, Classic included; kept on Restart |

The other achievements show no count. When the list is longer than the card, it
pages with Previous, the page count and Next, as in Chibi. Achievements is
not on the pause card.

| Key                   | Text                |
| --------------------- | ------------------- |
| `achievements`        | Achievements        |
| `achievement`         | Achievement: {name} |
| `achievementProgress` | {have}/{need}       |
| `achievementsPage`    | {page}/{pages}      |
