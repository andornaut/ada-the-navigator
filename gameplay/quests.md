# Quests

Station jobs, exploration leads, the landmarks surveys chart, repeatable
activities and achievements. Every number in this document is provisional
tuning. [Economy](economy.md) defines Stardust pacing and stations, and
[the version one rules](rules.md) define direction indicators, Penny's sense,
conversations, carried items and persistence.

## Station jobs

Stations with the jobs specialty have a board of small helping jobs. A job takes two to five
minutes, reads simply for a 12-year-old and is non-violent at its core: no job
asks Ada to destroy anything, and drones met on the way are incidental. Ordinary
job targets keep 1000 world units clear of retained frigates, capitals and
platforms. Lost-item [exploration leads](#posted-leads) use this as a preference.

### Job board

The Station footer opens Jobs & Projects wherever the current station offers
jobs, unlocked projects or an existing held-task action. Its left Jobs pane
shows ordinary offers only where available. Community projects occupy its
right pane, including at project-only stations. Preserve held-task details
and Drop. Back and the permitted companion dismissals return one layer to
the Station welcome.

- Each board offers three jobs at once, drawn from its galaxy's job pool by the
  station's seed, with no two of the same type while the pool allows. Short and
  long deliveries count as one type. A posted
  [exploration lead](#exploration-leads) is an extra offer beyond the three.
- The job row opens details with the job icon, title, objective, Reward with
  its Stardust amount, Cancel and Accept. A short galaxy-specific brief
  can add context for the actual job type. Preserve objective facts.
- Ada holds at most one station job per galaxy. An unavailable Accept
  preserves the refusal text “Finish or drop your current job first.”
- The held job shows at the top of every board in its galaxy, marked Active,
  with Drop. Drop asks "Drop this job?" with Drop and Cancel. Dropping loses the
  job's progress and returns it to the board that offered it.
- Untaken offers other than posted leads re-roll at the start of each new
  flight. A slot refills with a new job from the pool when its job is completed.
  When every landmark in a galaxy is charted, its boards stop offering surveys.
- An offer whose target becomes invalid, such as a survey landmark charted
  meanwhile or a target another offer already uses, is replaced with a new job
  from the pool.
- The held job shows in the Quests list under "Station jobs". Its target uses
  the direction indicator for quest events and is marked on the local map.
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
  and notices follow [Scan feedback](#remembered-scan-credit).
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
  from the issuing station and tow it to safety at any known station or outpost
  in the galaxy. A rescue posted by an exploration lead is the one exception:
  its craft waits at the lead site. See [Tow handling](#tow-handling).
- **Lost-item hunt**: search a marked area, 900 world units in radius and centred
  3000 to 7000 world units from the issuing station, for a lost item. The
  indicator points to the area's centre while Ada is outside it and hides while
  she is inside. Penny's sense helps: when the item is within 5000 world units, Penny's
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

### Optional quest guidance

- After a job lead is posted, mark the known issuing station on the local map
  with its Jobs & Projects cue. Astra says “A job is waiting at {station}.
  Look for its marker on the map.” Keep the cue while that lead awaits acceptance.
- Label each revealed detour boss “Optional encounter: {ship}” in its Map
  details. Keep the actual ship name on the marker and the usual Travel here
  guards. The chapter continues while the detour remains unresolved.

### Rewards

A job pays Stardust and a lore line, on top of ordinary earnings from asteroids
and drones met on the way. All existing Stardust quest-completion rewards use
`questReward(base) = 2 * ceil(2 * base / 25) * 25`: double the payout after
the existing calculation and rounding. This covers station jobs, repeatable activities and any
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
| Survey          |               2 |        150 |        200 |              250 |        250 |
| Lost-item hunt  |               3 |        200 |        250 |              400 |          – |
| Delivery, short |               3 |        200 |        250 |              400 |          – |
| Delivery, long  |               4 |        300 |        450 |              600 |          – |
| Rescue and tow  |               4 |        300 |        450 |              600 |        600 |

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

## Exploration leads

Fresh piloting places optional exploration sites near Ada. Each site offers
Use (Scan) within the 160 world unit Talk range. An explicit Scan records the
site once and shows [Astra's scan receipt](player-copy.md#canonical-astra-outcome-copy).
A site pays no discovery reward, does not chart a landmark and does not count
toward mapping progress. Sites and their scanned state persist with the galaxy,
and Restart clears them. The pacing counter belongs to the flight: Continue
resumes it, and a fresh entry starts it at zero.

### Lead pacing

- The near-route envelope is every point within 5000 world units, the shared
  marker range, of the galaxy's story route: the legs from the flight's arrival
  through each placed story destination in route order. Distances use the
  shortest wrapped displacement.
- One counter paces sites by piloted fresh travel. Inside the envelope, 75
  seconds earn one site. Anywhere in fresh space outside it, 150 seconds earn one:
  those seconds count at half rate toward the same counter.
- Only movement with a steering command over fresh distance counts. Uncommanded
  drift, standing still, revisited chunks, teleports, dialogue, docking and pause
  add nothing. No wall-clock timer runs, and no site is mandatory.
- The counter holds at most one pending site. Ada's next newly entered chunk
  searches once for a free seeded place within 5000 world units of her, in the
  same region as the travel that earned it, clear of stations, story
  destinations, required hulls and landmark spacing. A failed search keeps the
  site pending; placing it resets the counter.

### Actionable scan results

Astra's scan receipt describes the next action backed by the site. Use one cue
per scan. A site with a live disabled hull points to that hull and says
“There's a disabled ship here. Get close and use Salvage.” Salvaging it follows
the existing wreck payout. If a scan posts a station job, use its existing
issuer cue and mark that known station's Jobs & Projects entry. If an existing
known patrol is nearby and no salvage or job lead applies, point to its known
area and say “Drones are patrolling nearby. Give them room.” Use only the normal
known-target range. Drop the cue when the patrol is no longer there. Sites with
no live actionable lead keep their ordinary scan receipt. Scanning awards no
extra loot, exposes no hidden target and accepts no job.

### Site kinds

| Region               | Resources | Salvage | Job lead |
| -------------------- | --------: | ------: | -------: |
| Near-route envelope  |      0.50 |    0.35 |     0.15 |
| Outside the envelope |         – |    0.70 |     0.30 |

- A resources site is a scannable place with no added objects.
- A salvage site also holds one disabled frigate of the galaxy, salvaged with
  the existing Use (Salvage). It takes no job and no task slot.
- A job lead is a rescue or a lost-item hunt from the galaxy's job pool. Near
  routes offer both; outside the envelope only rescue. Phantom offers only
  rescue. A site becomes a job lead only while Ada has discovered a station with
  jobs in the galaxy; otherwise it draws among the other kinds by their weights.

### Posted leads

- Scanning a job lead posts it as a job on its issuer's board. The issuer is the
  station with jobs that Ada has discovered nearest the site, by wrapped
  distance, when she scans it. Astra's scan receipt names that station.
- Scanning never accepts the job. Ada docks at the issuer and accepts it on the
  board into the galaxy's one optional task slot. Accept, the busy refusals,
  Drop, completion, payment and the lore line follow [Station jobs](#station-jobs).
- A posted lead shows on its board beyond the three ordinary offers, with the
  title and the galaxy's reward of its job type. A board holds at most one
  untaken lead; a newer lead for that board replaces it. An untaken lead stays
  across flights until it is taken or replaced, because it was found by
  exploration rather than drawn by the board. Drop returns it to the board.
  Completing it removes its row with no refill.
- A rescue lead's stranded craft waits at the lead site, not 3000 to 7000 world
  units from the issuer. Tow handling and completion at any known station or
  outpost are unchanged.
- A lost-item lead's search area lies 3000 to 7000 world units from the issuer,
  as for a board hunt. When placing the lead and again on Scan, use the first
  of the 24 seeded candidates at least 1000 world units from every retained
  frigate, capital and platform. If all fall short, use the candidate farthest
  from its nearest qualifying heavy, breaking ties by seeded order. Measure
  the shortest wrapped distance. Heavy proximity cannot prevent placement
  or posting of the Hunt lead.
- A site posts at most one lead. A scanned site offers no further Scan.

## Captain Tally

Captain Tally is an uncrewed drone commander in Sunflower. After the outposts
complete their exchange circuit, the local map charts Hammer as an optional
detour. Hammer's patrol stays clear of the required circuit, and the outposts'
holodisk handover remains independent. Ada flies to the detour normally.

While Hammer is engaged, the hull meter carries the "Captain Tally" badge.
It clears on disengagement and restores the current hull on re-entry.
[Tally's approach and Astra's first-hardpoint
reaction](player-copy.md#captain-tally-and-hammer) are shown once each. If
the same hit would trigger both a hardpoint and a final resolution cue, the
resolution takes priority.

Disabling Hammer and using Salvage resolves the encounter and awards half its
rolled Stardust, rounded down. Destroying the hull resolves it and drops the
full roll through the ordinary wreck payout. Either outcome also reveals a
normal-flight waypoint labeled "Safer route and supply cache" and a single Ore
pickup. Collecting the Ore once changes the waypoint label to "Safer route".
Astra's resolution line is shared by both outcomes.

The encounter retains its actor, damage and shown cues through Continue and
leaving and returning to Sunflower. The resolved encounter stays resolved, and
the unclaimed cache remains available across flights until collected.

## Captain Sounder

Captain Sounder is an uncrewed drone commander in Whirlpool. The whale and
family retain their earlier capital guards. After the reunion, the family's
song reveals the holodisk waypoint and opens the Sounder encounter. The
waypoint is visible on the map and uses its usual Travel here rules. The physical holodisk
becomes collectible only after the encounter resolves.

Manta Dreadnought guards the disk site with two fighter escorts and four swarm
ships. Currents carry Ada and the small ships around the capital. While
Manta Dreadnought is engaged, its hull meter carries the "Captain Sounder"
badge. It clears on disengagement and returns with the current hull on
re-entry. The approach, first hardpoint and resolution use [Sounder's exchange](player-copy.md#captain-sounder-and-manta-dreadnought).

Disable all of the capital's weapon hardpoints or destroy its hull to release
the disk. The escorts and swarm are separate threats. Ada can collect the disk after
either resolution without using Salvage. Heavy destruction and optional
Salvage use their ordinary Stardust rules. The disk is a separate pickup at
the family's waypoint and can be collected only once.

Continue preserves the encounter, current flight damage and shown cues.
Leaving Whirlpool during the unresolved encounter retains the surviving
formation for re-entry. Once resolved, the boss stays resolved across
flights and the disk stays collectible until recovered. A legacy unresolved
disk guard migrates to Sounder without an extra reward. A recovered disk
stays recovered.

## Captain Cadence

Captain Cadence is an uncrewed drone commander in Needle. Lighting the last
gate of the Eye makes the optional Crossbow detour eligible. Once placed,
the local map labels it "Crossbow" and offers Travel here under the usual rules. The detour stays
outside the gate channel and clear of the holodisk pickup route. Elder Loom's
practice, the Eye, and collection of the disk follow their existing steps.

While Crossbow is engaged, its hull meter carries the "Captain Cadence"
badge. It clears when Ada disengages and restores the current hull on
re-entry. The approach, first hardpoint loss while the
ship remains active, and resolution use
[Cadence's exchange](player-copy.md#captain-cadence-and-crossbow).

Destroy the hull or disable and Salvage Crossbow to record one transmission
in the flight log. Before the third holodisk memory finishes, the entry
attributes the orders to fleet command. After the memory, the same entry names
Admiral Archie. Continue and return preserve damage and encounter progress.
Resolution and the normal heavy Stardust payout occur once.

## Landmarks

Each galaxy targets roughly 200 landmarks for surveys to chart: nebulae, wrecks
and beacons, drawn in the galaxy's own palette. Wrecks are old hulls with no one
aboard. Seeded placements extend to a maximum radius of 80000 world units
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
  target follows [the shared marker eligibility rules](#marker-eligibility).
  Sensing and identification alone do not chart it.
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

## Unified target markers

### Status and scope

The shared range is **5,000 world units**. Tech implements the registry in
`src/model/targetMarkers.ts` and edge placement in `src/ui/layout/targetMarkers.ts`.
See [the marker work item](../docs/work/ada-0253.md) for implementation evidence.
Full all-edge rendered acceptance remains unverified here.

### Marker eligibility

- One target has one stable ID and at most one marker. Ordinary markers, Penny
  sensing, quest destinations and explicit encounter triggers contribute to the
  same registry entry rather than creating competing markers.
- Known targets use their real icon, with no Penny question mark. An unknown
  sensed target uses `?`; actual visual identification changes that same entry
  to its real icon. Sensing alone does not identify the target.
- An eligible task tint describes the task category. A shared physical target
  draws one marker. Among eligible contributors, use story quest first, then
  station job, then community project. Targets with no eligible task category
  use the generic state.
- A tint does not identify a target or disclose its map location. Until normal
  identification, show the question mark without an object glyph or name.
  A project contributes only when its active task resolves to an authoritative
  physical site and passes the existing marker eligibility rules. A project
  row or visual world change alone does not create a marker.
- Ordinary eligible off-screen targets remain marked within 5,000 world units.
  Leaving range hides the marker without erasing knowledge; re-entry restores
  it. An on-screen target needs no edge icon.
- Dialogue controls narration only. Dialogue expiry, elapsed time, a nearer
  target or save/Continue must not remove an otherwise eligible marker.
- Destroyed or explicitly removed targets clear their markers. Unloading a
  runtime object alone must not imply removal: resolve its stable identity from
  authoritative world state. Never retain a stale marker for a removed target.
- A triggered boss encounter may explicitly contribute a distant marker before
  ordinary range eligibility. Encode activation and termination in that
  encounter's contribution. Do not expose other hidden targets through this
  exception.
- Quest destinations participate in the same discoverability rules. A quest
  reference alone must not identify an unknown destination or reveal every
  hidden destination. Known destinations use their real icon; unknown sensed
  destinations use `?`. Explicit authored disclosures remain explicit.

### Marker state and presentation

The registry resolves each stable target ID to its authoritative position,
existence, knowledge and active contributors. Use shortest wrapped displacement
for distance and direction. Do not key entries by current array index, nearest
target selection, projected position or dialogue instance.

Persist target knowledge separately from scan completion and story progress.
Save/Continue reconstructs the registry from persisted knowledge and active
world, quest and encounter facts. Preserve sensed versus visually identified
states without granting scan completion or advancing story.

Evaluate eligibility, icon, lifetime and rendering through one shared pipeline.
Merge same-target contributors before layout; removing one contributor retains
the marker when another still qualifies. Distinct targets retain their entries
and identities even when their markers overlap.

Place each displayed marker center on the projected Ada-to-target bearing at
its near-edge intersection in the centered 720-logical-pixel-wide game area.
Use the actual wrapped target position and rendered projection. Bearing accuracy
has priority over HUD, dialogue or marker separation: temporary overlap is
allowed. Do not move the marker tangentially along an edge or inward to avoid
an overlap. Record overlap diagnostically without deleting or replacing targets.

The visible-art inset is approximate, ordinarily one or two logical pixels,
not a universal exact-one-pixel requirement. Preserve fractional-scale and
paint-grid rounding and the retained small-marker half-scale corner case with
an inset of three logical pixels. That corner exception is not a new global
margin. Measure actual visible art, outline and scale rather than transparent
image bounds; do not infer universal zero error or exact one-to-two-pixel
containment from component evidence. Penny's `?`, known quests, bosses and other
markers follow this placement rule. The 5,000-unit range applies to ordinary
markers; the tracked objective below has its own range.

### Tracked quest objective

Highlight one objective in the current galaxy. Default to the active story
step. Quest Details offers “Track quest” for an active job in that galaxy;
selecting it replaces the story highlight. Return to the story highlight if the
tracked job ends or Ada leaves its galaxy. Follow the selected quest's current
step as it updates.

A tracked, explicitly revealed destination remains marked at any distance in
the current galaxy. For a search step, guide to its known search area when
available. Hidden items remain undisclosed. The tracked highlight uses the
same registry entry, real location icon and wrapped bearing as ordinary
guidance. Add a quest badge and a short target label at the edge while it is
off screen. Move the highlight above the target while it is on screen.
Briefly pulse on an objective change, then hold steady. With reduced motion,
show the steady highlight immediately.

After Elder Loom's briefing, highlight the Practice Channel's green-flag start.
When Ada starts the course, move guidance to the next uncleared ring. Use the
same handoff for the Eye once it becomes the current step.

### Task category colours

[Shared task colours](../docs/work/ada-0341.md) are approved work. An eligible
unknown target keeps its question-mark glyph. Its tint can indicate the task
category without revealing the target's name or kind. Multiple contributions
still produce one marker. Follow the work item for the overlap rule and evidence.

Every identified enemy marker is threat red. Heavies (frigates, capitals, the
flagship, ore-field platforms and hostile stations) use a distinct heavy enemy
marker, also threat red; small craft and retaliators use the standard enemy
marker. An unidentified marker whose target is a story or job task keeps its
task colour; every other unidentified marker keeps the generic colour.

### Marker acceptance matrix

Review all four edges, corners, narrow viewports, overlap, and the visible
outline of scaled known and unknown glyphs. Exercise identification, range
exit and re-entry, view transitions, wrapped seams, Continue, disposal versus
removal, multiple contributors and distinct targets on overlapping bearings.
Check hidden quest references and the activation and termination of distant
boss exceptions. Follow the [marker work item](../docs/work/ada-0253.md) for
results.

## Scan feedback

### Scan scope

`ScanOutcome` drives a visual notice and [Astra's receipt](player-copy.md#canonical-astra-outcome-copy).
The model submits the outcome and the scene drains it into the view. See
[scan timing](../docs/work/ada-0309.md), [notice placement](../docs/work/ada-0401.md)
for the scoped checks. The [earlier placement checks](../docs/work/ada-0321.md)
cover a superseded layout. Ordinary scans, remembered credit and contextual Use
remain subject to their own flow verification. No scan mock-first or sequencing
hold applies.

### Scan outcomes

- Stop displaying a Scan instruction once its target is scanned. Reconcile the
  instruction with that target's actual scan state, including an instruction
  already visible when scanning succeeds. Source invalidation is implemented in
  `src/model/conversations.ts`; rendered and end-to-end acceptance remain unverified.
- Distinguish ordinary scan success, task completion and quest completion using
  the actual outcome. A successful scan alone does not imply task or quest
  completion, and a completed task does not imply a completed quest.
- Task completion uses a checkbox, task text and the related quest icon.
- Quest completion uses the quest icon and quest name, with no checkbox or task
  icon. Preserve this distinction in both mocks and implementation.

### Remembered scan credit

Persist authoritative scan IDs independently of quest acceptance.
A scan alone never accepts or starts a quest.

When a quest is given, accepted or started after its required item was scanned,
immediately reconcile the requirement against the remembered scan ID. Tick the
already-known requirement and celebrate its completion without another visit or
scan. Complete the quest only when all its requirements are satisfied. Grant its
reward and emit each corresponding completion notice exactly once, including
across save/Continue or repeated reconciliation.

Use the same [completion treatment](#scan-outcomes). Astra acknowledges
remembered credit using the [canonical outcome copy](player-copy.md#canonical-astra-outcome-copy).

The current exclusion of already-charted survey job offers must not discard a
valid accepted quest whose scan requirement was satisfied before acceptance.
Keep offer filtering separate from reconciliation of accepted quest progress.

### Completion presentation

Center the scan notice at the top of the playable area, using the same top
inset as the resource pill. Place it below a visible boss health bar or a
crowded top row while keeping it horizontally centered. The notice stays fixed
relative to the screen as the camera moves.
Astra's dialogue draws over the notice.

Ordinary scan and quest-completion receipts hold at full opacity for two
seconds. Task-completion receipts use the task text's reading time of three
seconds plus 30 ms per character, including the fade. All receipts fade over
500 ms. Both motion settings use the same placement and timing.

### Quest details through contextual Use

Direct world-object click/tap inspection is cancelled because it conflicts with
joystick interaction. Do not implement that trigger or treat its former approval
as active.

The contextual Use replacement remains approved; full interaction checks and
acceptance remain unverified. Real Scan, Dock, Deliver and
other immediate actions take priority, including every available repeatable
action. Dock remains repeatable on every visit: a visited or action-done flag
must never replace available Dock with Quest details. Only when no real action
is currently available on a
quest-linked nearby object, offer Quest details through Use. Center the actual
quest icon in the Use button, not a generic question mark.

For one active linked quest, open its existing details; Close and X return
directly to gameplay. For multiple active linked quests, open a list filtered to
that object's active quests. Details Back and X return to the filtered list;
list Close and X return to gameplay. Preserve this caller context throughout.

Use the existing proximity, availability and input guards. Do not invent an
inspection range or quest associations, change joystick behavior, or alter held
fire and cancelled-gesture handling. Inspection must not mutate quests or
rewards, change discovery state or reveal hidden targets. World objects remain
non-clickable and non-tappable.

Stations retain their existing quest interface and All quests access. This
contract does not redesign station flows.

### Scan and Use acceptance

Review ordinary scan, task and quest receipts and invalidation while Scan
guidance is showing. Check the fixed top-center position while flying, the
offset below a boss bar or crowded top row, layering behind Astra's dialogue,
and hold and fade timing in both motion settings. For remembered credit, exercise scan
before acceptance, partial and full completion, offer filtering, Continue and
repeated reconciliation without duplicate rewards or notices.

Check contextual Use independently for repeatable Dock, Scan before and after
completion, single and multiple linked quests, correct return paths, unchanged
station access and gesture guards. Inspect the centred quest icon. See the
[scan scope](#scan-scope) for available evidence.

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
Final activity rewards follow route position: 450 at the second, 600 at the
third, 700 at the fourth and 750 at the fifth; the first galaxy's supply run pays
the final delivery rewards. Stored base rewards use the same one-time
`questReward` transform defined above.

- While an activity is active, the galaxy's boards show their jobs, and Accept
  refuses with "Finish your activity first." The activity shows at the top of
  every board in its galaxy, marked Active, with Drop, as a held job does; Talk
  at its offering place also offers Drop. Drop asks "Drop this activity?" and
  loses its progress.
- While a job holds the slot, Talk plays the activity line, and Accept refuses
  with "Finish or drop your current job first."
- The Quests list shows an active activity under "Station jobs".
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
| Sunflower | Supply run        | Any of the outposts | Carry supplies to a station 3000 or more away.                    | 200 or 300 |
| Whirlpool | Guide a calf      | The whale family    | Lead a whale calf 5000 to 8000 world units home to them.          |        450 |
| Needle    | Thread the needle | Elder Loom          | Clear the 10 rings of the long course.                            |        200 |
| Andromeda | Courier run       | Pip                 | Fly a parcel with Pip to a settlement, keeping within 600 of him. |        700 |
| Cartwheel | Mining contract   | The hub             | Deposit 30 ore at the hub; partial loads count.                   |        750 |

- **Supply run**: uses the delivery job rules and payouts in the table above.
  The outpost's item goes to the nearest known station at least 3000 world
  units away. With no qualifying station, the outpost makes no offer. The
  items are fresh food, repaired tools and spare parts. Talk at the issuing
  outpost to replace a lost item.
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
  title keeps the run for Continue. Before accepting, Pip names the route's
  existing patrol complication: “Drones patrol the way to the outpost. How
  should we get past them?” Offer “Scout ahead”, “Stay with Pip” and “Not now”
  once valid route terms exist. Both approaches use the same destination and
  reward. The escort keeps the existing 600-unit follow rule. On Scout ahead,
  Pip waits at the start while Ada approaches the marked patrol area. Once she
  reaches the area, Astra says “That's the patrol. Head back to Pip and he'll
  follow you.” Returning within the follow range resumes the ordinary escort.
  After leaving follow range, returning early also resumes the escort. Neither route
  requires defeating the patrol. Continue retains the selected approach and
  route state. A missing route shows “I don't have a route ready yet. Check back
  later.” and offers no acceptance.
- **Thread the needle**: a gate run (see [Needle](rules.md#galaxy-three-needle-threading-the-needle))
  through a seeded ten-ring channel near Elder Loom. Consecutive rings are
  30% farther apart than in the original repeatable course. Enemies may appear
  alongside it, with ring openings kept clear. A fast crossing points back to
  the missed ring and keeps the earlier progress. Clearing the last ring
  completes the activity and pays the usual 200 Stardust. The optional
  “Clean run” goal means clearing every ring without a crossing rejected for
  speed or order. Show it in Quest Details, and on a clean finish say
  “Clean run! Every ring on the first try.” Keep the result through Continue
  for the current attempt. A new run starts a new attempt. A missed ring
  clears the clean-run goal for this attempt and leaves completion and payout
  available.

Activity lines:

- Grower: "Fresh food for the station traders. Would you carry it?"
- Workshop: "A station ordered these repaired tools. Could you take them?"
- Salvager: "A station shop needs these spare parts. Will you bring them?"
- Whale family: "One of our young ones swam off to play. Could you guide them
  home? Stay close. They follow friends."
- Pip: "I've got a parcel for the far settlement. Fly with me? It's less scary
  with company."
- Elder Loom: "The long course is open. Ten rings. Slow down before each one."

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
