# Quests

Station jobs, the landmarks surveys chart, repeatable activities and achievements. Every number in this
document is provisional tuning. [Economy](economy.md) defines Stardust pacing and
stations, and [the version one rules](rules.md) define direction indicators,
Penny's sense, conversations, carried items and persistence.

## Station jobs

Stations with the jobs specialty have a board of small helping jobs. A job takes two to five
minutes, reads simply for a 12-year-old and is non-violent at its core: no job
asks Ada to destroy anything, and drones met on the way are incidental. Job
targets keep 1000 world units clear of retained frigates, capitals and platforms.

### Job board

The Station footer opens Jobs & Projects wherever the current station offers
jobs, unlocked projects or an existing held-task action. Its left Jobs pane
shows ordinary offers only where available. Community projects occupy its
right pane, including at project-only stations. Preserve held-task details
and Drop. Back and the permitted companion dismissals return one layer to
the Station welcome.

- Each board offers three jobs at once, drawn from its galaxy's job pool by the
  station's seed, with no two of the same type while the pool allows. Short and
  long deliveries count as one type.
- The job row opens details with the job icon, title, objective, Reward with
  its Stardust amount, Cancel and Accept. A short galaxy-specific brief
  can add context for the actual job type. Preserve objective facts.
- Ada holds at most one station job per galaxy. An unavailable Accept
  preserves the refusal text “Finish or drop your current job first.”
- The held job shows at the top of every board in its galaxy, marked Active,
  with Drop. Drop asks "Drop this job?" with Drop and Cancel. Dropping loses the
  job's progress and returns it to the board that offered it.
- Untaken offers re-roll at the start of each new flight. A slot refills with a
  new job from the pool when its job is completed. When every landmark in a
  galaxy is charted, its boards stop offering surveys.
- An offer whose target becomes invalid, such as a survey landmark charted
  meanwhile or a target another offer already uses, is replaced with a new job
  from the pool.
- The held job's objective shows in the local map's Quests modal under the story
  objective, as "Job: {objective}". Its target uses the direction indicator for quest
  events and is marked on the local map.
- A job pays at completion wherever Ada is: a notice shows "Job complete: +{amount}
  Stardust", then Astra says one unseen lore line from the galaxy's job pool.

Jobs persist across flights, regeneration, closing the game and visits to other
galaxies. A job's targets are fixed and saved when it is offered, and survive
layout regeneration like stations. Restart clears jobs and boards.

### Job types

- **Survey**: chart one uncharted landmark for Astra's map (see
  [Landmarks](#landmarks)). The indicator marks the landmark, and charting
  it completes the job. A valid accepted quest immediately credits its already
  scanned target without a revisit; scanning alone never accepts a quest. Survey
  emits only its actual quest completion, not a synthetic task. Once-only rewards
  and notices follow [Scan feedback](scan-feedback.md#remembered-scan-credit).
- **Delivery**: carry cargo or a message from the issuing station to another
  known station or outpost in the galaxy at least 3000 world units away,
  preferring the nearest, with no upper limit. The job names the destination by
  its Map name. A board offers no delivery while no known place qualifies as its
  destination, and shows no line about it. An outpost destination keeps its id
  and reward when the layout regenerates, and the indicator points to its
  current position. Accepting loads the item into a job carried-item slot,
  separate from story items and mining cargo. Deliver at the destination
  completes the job. A lost item is replaced at the issuing station, as for
  story deliveries. While Ada carries a job item (a delivery's or a supply
  run's), the local map's Travel here is unavailable and refuses with the shared
  refusal feedback, as while towing.
- **Rescue and tow**: find a stranded pod or small ship 3000 to 7000 world units
  away and tow it to safety at any known station or outpost in the galaxy. See
  [Tow handling](#tow-handling).
- **Lost-item hunt**: search a marked area, 900 world units in radius, for a lost
  item. The indicator points to the area's centre while Ada is outside it and
  hides while she is inside. Penny's sense helps: when the item is within 5000 world units, Penny's
  "Woof! Woof!" conversation plays once for that item, ignoring its usual 60 second
  limit. The item glints within 160 world units, like a discovery cache, and is
  collected as a pickup by the one pickup rule, and the tractor beam pulls it.
  Collecting the item completes the job, which pays then.

### Tow handling

Ada attaches the tow with Use (Tow) within 120 world units of
the stranded craft. The craft trails on an 80 world unit line, pulled along when
the line is taut, and passes through scenery so it never snags. While towing:

- Ada's top speed is multiplied by 0.65.
- `accelerationSeconds` and `brakingSeconds` are doubled, so the ship gathers and
  sheds speed slowly and carries more momentum.
- `turnSeconds` is multiplied by 1.5, so turns swing wider.

The multipliers apply to Ada's current values, so engine tuning still helps.
Enemies ignore the towed craft, and it takes no damage. Ada fights normally.
The local map's Travel here is unavailable while towing, as while carrying a job
item, and refuses with the shared refusal feedback.
Bringing the craft within 400 world units of any known station or outpost in the
galaxy completes the rescue,
and the craft parks there. Leaving the galaxy (Earth or Jump from the galaxy map) or a shield-depletion
jump returns the craft to where it was stranded, still marked. Closing the game
or Back to title keeps the tow, and Continue resumes it exactly.

### Rewards

A job pays Stardust and a lore line, on top of ordinary earnings from asteroids
and drones met on the way. All existing Stardust quest-completion rewards use
`questReward(base) = ceil(2 * base / 25) * 25`: double the base reward, then round
up to the nearest 25. This covers station jobs, repeatable activities and any
existing story-quest Stardust payout. Current main-story outcomes do not award
Stardust; this rule adds none. Ordinary drops, discovery caches, shop prices,
Exchange, donations and nonquest achievement bonuses keep their own rules.
Pacing, kill-time and ore-income simulations remain deferred; [Economy](economy.md)
records the approved job-assisted pacing.

Keep saved job and activity rewards in base units, including existing saves.
Offer rows, accepted-task details, completion notices and the actual credited
amount must use the same canonical transform exactly once. Preserve already
paid balances and existing completion guards; do not multiply stored base
values on reload or pay a completed task again. Final payouts follow route
position below.

| Job             | Typical minutes | Position 1 | Position 2 | Positions 3 to 5 | Position 6 |
| --------------- | --------------: | ---------: | ---------: | ---------------: | ---------: |
| Survey          |               2 |         75 |        100 |              125 |        125 |
| Lost-item hunt  |               3 |        100 |        125 |              200 |          – |
| Delivery, short |               3 |        100 |        125 |              200 |          – |
| Delivery, long  |               4 |        150 |        225 |              300 |          – |
| Rescue and tow  |               4 |        150 |        225 |              300 |        300 |

A short delivery is under 6000 world units; a long one is 6000 or more. Phantom
boards offer only surveys and rescue and tow: travelers stranded by the blockades.

### Job pool

Each galaxy's pool fills job titles with its own items.

| Galaxy    | Delivery items                        | Stranded craft                       | Lost items                          |
| --------- | ------------------------------------- | ------------------------------------ | ----------------------------------- |
| Sunflower | seeds, spare parts, a message         | a seed pod, a scrap barge            | a toolbox, a watering can           |
| Whirlpool | song shells, star maps, a message     | a current skimmer, a pod             | a music shell, a whale-call whistle |
| Needle    | thread spools, glass beads, a message | a stuck glider, a pod                | a weaving shuttle, a silver bell    |
| Andromeda | beacon parts, mail, a message         | a lost courier, a drifting lamp buoy | a courier's badge, a lantern        |
| Cartwheel | ore samples, drill bits, a message    | an ore pod, a stuck hauler           | a lucky charm, a helmet             |
| Phantom   | none                                  | a traveler's pod                     | none                                |

Job lore lines, said by Astra after a job completes, one unseen line per job:

- Sunflower: "Nebulae are clouds where new stars are born." "The growers trade
  seeds the way some people trade stories."
- Whirlpool: "Whales sing to map the currents. We are both mapmakers."
  "Currents carry seeds, rocks and songs from one side of Whirlpool to the other."
- Needle: "We see Needle from its edge, like a plate held sideways." "The Avi
  say a channel is learned, not won."
- Andromeda: "Andromeda is so bright that people on Earth can see it without a
  telescope." "A beacon only helps if it tells the truth about where it is."
- Cartwheel: "Every rock here was once part of something bigger." "Miners name
  their drills. I'd like a name for my drive."
- Phantom: "Not every traveler here chose to stay." "Even a dark rim has
  stars."

### Player strings

| Key                   | Text                                        |
| --------------------- | ------------------------------------------- |
| `jobs`                | Jobs                                        |
| `jobBoard`            | Job board                                   |
| `jobBoardIntro`       | People here could use some help.            |
| `jobObjective`        | Job: {objective}                            |
| `job`                 | Job                                         |
| `jobAccept`           | Accept                                      |
| `jobActive`           | Active                                      |
| `jobDrop`             | Drop                                        |
| `jobDropTitle`        | Drop this job?                              |
| `jobDropCancel`       | Cancel                                      |
| `jobBusy`             | Finish or drop your current job first.      |
| `jobReward`           | {amount} Stardust                           |
| `jobComplete`         | Job complete: +{amount} Stardust            |
| `tow`                 | Tow                                         |
| `towTravel`           | Unavailable while towing.                   |
| `carryTravel`         | Unavailable while carrying a delivery.      |
| `surveyTitle`         | Chart the {landmark}                        |
| `surveyAbout`         | Fly close and scan it.                      |
| `deliveryTitle`       | Deliver {item} to {place}                   |
| `deliveryAbout`       | They're waiting for it.                     |
| `questDeliveryDetail` | Take {item} to {place}, where it is needed. |
| `rescueTitle`         | Tow {craft} to safety                       |
| `rescueAbout`         | Its engine stopped. Towing makes you slow.  |
| `huntTitle`           | Find a lost {item}                          |
| `huntAbout`           | It's in the marked area. Ask Penny.         |

In-flight lines, each played once per save:

- Tow attached: Astra: "Tow line attached. We'll be slow and heavy." Ada: "Hold
  on, we've got you!" (happy)
- Search area entered: Ada: "It's around here somewhere. Penny, can you help?"

## Landmarks

Each galaxy targets roughly 200 landmarks for surveys to chart: nebulae, wrecks
and beacons, drawn in the galaxy's own palette. Wrecks are old hulls with no one
aboard. Seeded placements extend to a maximum radius of 100000 world units
from the galaxy's origin, retaining 3000-world-unit landmark spacing and
1500-world-unit clearance from stations and story destinations. Measure accepted
safe placements after rejection; the target is not an unverified accepted count.
Preserve the existing 12 landmarks' ids, positions, kinds, names, charted state
and saved survey targets. Additional placements do not relocate or invalidate
them. Chunk generation keeps landmark space clear.

Landmarks beyond the existing 25000-world-unit galactic-center progress circle
remain visible, scannable, chartable and available on the map. Their wider
extent does not expand the mapping-progress or survey-area denominator.

- An uncharted landmark is a point of interest for Penny's sense. A survey's
  target gets a direction indicator. The exact target of an actually displayed
  Penny notice also gets its marker within 5000 world units: a question mark
  until actual on-screen identification, then its matching real glyph, without
  duplicate markers. Sensing and identification alone do not chart it.
- Within the existing station Talk range of 160 world units, an uncharted
  landmark offers Use (Scan), with the nearby Use callout. Only explicit Scan
  charts it and plays the existing "New place mapped." conversation, committing
  survey and achievement progress once. Passable flyover does not chart it or
  grant a discovery reward; already charted landmarks cannot pay again.
  [Rules](rules.md#interactions-and-navigation) defines the shared interaction
  contract; [Penny's sense](rules.md#astra-and-penny-in-flight) defines marker
  retention and the displayed-target contract.
- Charted landmarks persist across flights and regeneration. Restart clears them.

The original 12 landmarks retain their four names per kind exactly. New
landmarks use stable ids `landmark:{galaxy}:{index}`, with permanent indices
12 through 199; these are identity indices, never discovery order. Select the
base name from the existing four canonical names of the actual kind using
`index % 4`. `LANDMARK_NAME_FORMAT` is "{baseName} {landmarkWords}".

For a new landmark, encode its full stable identity as
`N = 6 * index + (galaxy - 1)`, for galaxy numbers 1 through 6. Render the minimal
base-16 digits as words from this ordered alphabet, separated by spaces:
Amber, Beacon, Comet, Dawn, Ember, Fern, Glimmer, Haven, Iris, Juniper, Kite,
Lantern, Meadow, Nova, Orbit, Pebble. Zero is Amber; nonzero encodings have no
leading zero digit. This is injective across galaxies and permanent indices,
without raw numeric UI, full UTF-8 id encoding or collision-prone hashes.
The finite 200-per-galaxy identity domain needs at most three qualifier words.
Do not add a redundant galaxy name, new stories or assets. Tech must report an
actual longest-label example for UI wrapping rather than invent an abbreviation.

`LandmarkSite.name` remains a canonical base-name key. Only new sites have the
optional `nameWords` qualifier. The shared `landmarkLabel(labelFn, site)` returns
legacy labels unchanged and formats new labels consistently for Scan, Penny,
the map, survey offers and task details. Names remain stable across revisits
and saves.

| Galaxy    | Nebulae                                                 | Wrecks                                                               | Beacons                                                |
| --------- | ------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Sunflower | Petal Nebula, Honey Cloud, Pollen Haze, Dandelion Drift | Old Seed Barge, Rusty Planter Ship, Sleepy Tug, Patchwork Shuttle    | Daisy Beacon, Bee Light, Sunrise Buoy, Lantern Post    |
| Whirlpool | Tide Nebula, Bubble Cloud, Swirl Haze, Kelp Glow        | Sunken Skimmer, Coral Hull, Driftwood Hull, Old Diving Bell          | Song Buoy, Wave Light, Shell Beacon, Current Marker    |
| Needle    | Silver Thread, Spindle Cloud, Loom Haze, Eye Nebula     | Tangled Glider, Snapped Spool Ship, Old Avi Hull, Quiet Shuttle      | Gate Light, Thread Marker, Stitch Beacon, Pin Lamp     |
| Andromeda | Bright Veil, Neighbor Nebula, Pearl Cloud, Dawn Haze    | Old Mail Ship, Lost Courier Pod, Rusted Lamp Barge, Sleepy Ferry     | Guide Light, Harbor Beacon, Truth Lamp, Courier Marker |
| Cartwheel | Ember Cloud, Rust Haze, Spark Nebula, Furnace Glow      | Cracked Drill Ship, Lost Ore Hauler, Bent Crane Barge, Quiet Smelter | Ring Light, Miner's Lamp, Spoke Beacon, Hub Marker     |
| Phantom   | Shadow Cloud, Inkwell Nebula, Dim Veil, Smoke Haze      | Broken Drone, Silent Hull, Cold Freighter, Old Patrol Ship           | Red Lamp, Watch Light, Lost Signal, Far Marker         |

## Repeatable activities

Once a galaxy's chapter is complete, its story places offer a repeatable
activity through Talk, with Accept and Not now. The mining hub is a station, so
its mining contract is offered instead as a row at the top of the hub's job
board, with the activity icon, its name, its goal, its reward and Accept. An activity takes the galaxy's
one optional task slot, shared with station jobs, so Ada holds a job or an
activity in a galaxy, never both. An accepted activity, its galaxy and its progress persist across
flights like a job; a supply run's carried item uses the job carried-item slot.
It pays at completion with the job completion notice alone, with no lore line,
and is offered again on the next Talk. Phantom has no repeatable activity yet.
Final activity rewards follow route position: 225 at the second, 300 at the
third, 350 at the fourth and 375 at the fifth; the first galaxy's supply run pays
the final delivery rewards. Stored base rewards use the same one-time
`questReward` transform defined above.

- While an activity is active, the galaxy's boards show their jobs, and Accept
  refuses with "Finish your activity first." The activity shows at the top of
  every board in its galaxy, marked Active, with Drop, as a held job does; Talk
  at its offering place also offers Drop. Drop asks "Drop this activity?" and
  loses its progress.
- While a job holds the slot, Talk plays the activity line, and Accept refuses
  with "Finish or drop your current job first."
- The local map's Quests modal shows an active activity as its "Job:" line.
- On a board, the Active activity row shows the shared activity icon, a circular
  repeat arrow, in place of a job type's icon; its title is the activity's name.
  Its detail line is its goal: "Carry
  supplies to a station.", "Guide a whale calf home.", "Light the gates of a
  practice channel.", "Fly a parcel with Pip." or "Deposit 30 ore at the
  hub."
- Holding one outpost's supply run, Talk at another outpost refuses Accept with
  "Finish your activity first."

| Galaxy    | Activity          | Offered by          | Goal                                                              |     Reward |
| --------- | ----------------- | ------------------- | ----------------------------------------------------------------- | ---------: |
| Sunflower | Supply run        | Any of the outposts | Carry supplies to a station 3000 or more away.                    | 100 or 150 |
| Whirlpool | Guide a calf      | The whale family    | Lead a whale calf 5000 to 8000 world units home to them.          |        225 |
| Needle    | Thread the needle | Elder Loom          | Light the 8 gates of a practice channel.                          |        300 |
| Andromeda | Courier run       | Pip                 | Fly a parcel with Pip to a settlement, keeping within 600 of him. |        350 |
| Cartwheel | Mining contract   | The hub             | Deposit 30 ore at the hub; partial loads count.                   |        375 |

- **Supply run**: follows the delivery job rules in full, 3000 minimum
  included: the outpost's item goes to a known station at least 3000 world
  units away, preferring the nearest, and pays the final delivery rewards
  (150 short, 225 long). With no such station known, the outpost makes no offer. The items
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
  guide exactly, as for a tow, and so does Back to title.
  Leaving the galaxy or a shield-depletion jump returns the calf to its start.
- **Courier run**: Pip flies a parcel to a seeded settlement 5000 to 8000 world
  units away at 0.7 of Ada's base top speed, and Ada escorts him. Pip waits
  whenever Ada is more than 600 world units away and goes on when she returns.
  Pip takes no damage, and drones ignore him; one drone patrol waits along the
  way. Pip reaching the settlement completes the activity. Leaving the galaxy or a
  shield-depletion jump returns Pip to his start; closing the game or Back to
  title keeps the run for Continue.
- **Thread the needle**: a gate run (see [Needle](rules.md#galaxy-three-needle-threading-the-needle))
  through a seeded practice channel of 8 gates near Elder Loom. A gate passed too
  fast sends Ada back to the last lit gate, or the first if none is lit. Lighting the last gate completes the
  activity.

Activity lines:

- Grower: "Fresh food for the station traders. Would you carry it?"
- Workshop: "A station ordered these repaired tools. Could you take them?"
- Salvager: "A station shop needs these spare parts. Will you bring them?"
- Whale family: "One of our young ones swam off to play. Could you guide them
  home? Stay close. They follow friends."
- Pip: "I've got a parcel for the far settlement. Fly with me? It's less scary
  with company."
- Elder Loom: "The practice channel is open. Thread it again, slowly."

| Key                 | Text                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- |
| `activityTake`      | Accept                                                                                  |
| `activitySkip`      | Not now                                                                                 |
| `activityBusy`      | Finish your activity first.                                                             |
| `activityDrop`      | Drop this activity?                                                                     |
| `supplyObjective`   | Carry {item} to {destination}.                                                          |
| `questSupplyDetail` | Carry {item} from {source} to {destination}. The station is waiting for these supplies. |
| `contractObjective` | Deposit ore at the hub: {have} of 30.                                                   |
| `calfFind`          | Find the whale calf.                                                                    |
| `calfGuide`         | Guide the calf home.                                                                    |

Templates carry no article; every destination has a sentence name with its
article, used in objectives, job titles and details whether or not the place is
mapped (only the From and To endpoint lines show "Explore to locate"): a station is "the station", an
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
| Time to Explore    | Complete the Whirlpool chapter.                     |
| Steady Hands       | Complete the Needle chapter.                        |
| Truth Teller       | Complete the Andromeda chapter.                     |
| Room for Everyone  | Complete the Cartwheel chapter.                     |
| Blockade Breaker   | Break Admiral Archie's blockade in Phantom.         |
| Cartographer       | Chart every landmark in one galaxy.                 |
| Astra's Atlas      | Chart every landmark in all six galaxies.           |
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
achievement also shows its progress as `{have}/{need}`. Every count is lifetime
progress and survives Restart; a landmark, project, ally or paint counts once
however often Restart lets Ada repeat it:

| Name               | Counts                                                       |
| ------------------ | ------------------------------------------------------------ |
| Cartographer       | Landmarks ever charted in the galaxy with the most           |
| Astra's Atlas      | Landmarks ever charted across all six galaxies               |
| Good Neighbor      | Station jobs and repeatable activities ever completed, of 25 |
| Friends Everywhere | Optional allies ever made                                    |
| Community Builder  | Community projects ever funded                               |
| Good Nose          | Penny finds ever made, of 10                                 |
| Full Palette       | Ship paints ever owned, Classic included                     |

The other achievements show no count. When the list is longer than the card, it
pages with Previous, the page count and Next, as in Chibi. Achievements is
not on the pause card.

| Key                   | Text                |
| --------------------- | ------------------- |
| `achievements`        | Achievements        |
| `achievement`         | Achievement: {name} |
| `achievementProgress` | {have}/{need}       |
| `achievementsPage`    | {page}/{pages}      |
