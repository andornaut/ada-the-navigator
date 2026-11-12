# Version one rules

This contract records approved story and mechanics decisions for version one.
It supersedes conflicting undecided details in the initial design. Numerical
balance values are provisional and must be tuned through playtesting.

## Scope and presentation

Version one is the game now being built, with four galaxies; anything later
belongs in [Ideas](ideas.md).
The fourth galaxy, Black Eye, holds the finale; its home chapter is to be
designed. Station jobs are in [Quests](quests.md).

Space uses authored sprites for ships, stations, outposts, pickups and asteroids,
with simple placeholders only where art has not landed yet.
Its sprite is white and blue, an elongated triangle with one front point, two
rear points, twin thrusters at those rear points, a small tail and a compact
canopy with room for Ada and her dog. Keep the ship small relative to the viewport.
In these documents, Archie and Chibi name the sibling games Archie's Dog Walks
and Chibi's Way Home. Home characters and
Ada may reuse Archie's sprites wholesale. Ada is a
brown-skinned 12-year-old girl. Use Chibi as the settings dialog, positioning,
fonts, joystick and general UI reference. These explicit reuse permissions apply to
the game; do not modify the source games.

## Start, Home and Space

The game has two halves: Home, the storybook scenes on Earth, and Space, the
flights. The first launch shows only Start, which begins galaxy one's home opening
and then the prologue. Start stays alone until the first flight begins. Later
launches show Continue and Restart.

Every launch opens on the start screen; Continue resumes where the save left off.
A flight closed mid-flight resumes exactly: galaxy, position, tow and danger (see
the exact-resume rule below). Otherwise Continue goes to galaxy selection in the
cockpit, open on the farthest unlocked galaxy. A home scene that is waiting, such as a chapter's resolution or the next
chapter's opening, plays first. When Ada goes home with no new scene, her room
shows one short repeatable line and "Pick up the rock."; old scenes never replay,
and new ones unlock with progress.

Player-visible labels use "Earth" for travel to Ada's room and "title" for the
start screen; story dialogue may still call Ada's house home. Every arrival on
Earth lands in Ada's room. Ada's room page has the pause button at the top left,
opening the Paused card with Settings and Back to title; its close
X, an outside tap, back and Escape close it. Back to title opens the start
screen, where Continue resumes as above.

Restart asks first on a card with Restart and Cancel, as in Chibi; back and Escape
cancel. Confirming clears all story progress, galaxies, holodisks, Stardust,
purchases, seen conversations and any saved flight, keeps device settings and achievements, and
replays from Start.

## Story progression

Home is an interactive story styled after choose-your-own-adventure books.
Player-visible text calls Ada's home "home" or "Earth" and never names her city.
Different responses and approaches converge on each chapter's resolution;
choices cannot cause permanent failure. Recover the current galaxy's holodisk,
complete its space quest and complete its home resolution to unlock the next
galaxy.

On first launch, galaxy one's home opening is followed by the prologue: Ada digs
up the rock, polishes it, touches its glow and arrives aboard with her dog Penny.
Astra introduces herself, her corrupted memory, the time rule and the holodisk,
and asks Ada to be her navigator. Ada straps Penny in and chooses galaxy one. The
prologue plays once. Later, Ada boards from her room with "Pick up the rock." and
a brief boarding line, then chooses a galaxy.

### Earth scenes

Earth scenes are storybook pages. Each page has a full background of a place,
colorful but low contrast, with no landmarks or signs naming the city, and its
text or dialogue in a readable panel at the bottom.

A story run is every Earth and cockpit page shown in a row between two points of
play: it starts when Ada leaves the start screen, a flight or galaxy selection,
and ends at galaxy selection or on Ada's room page with its named action. Next
turns one page. Previous returns to the page shown before, across scene
boundaries within the run, and is disabled only on the run's first page. A page
that ends in a named action, such as "Pick up the rock.", shows that action in
place of Next. Skip passes every remaining page and scene of the run, taking the
default path through choices and leaving optional questions unasked, and stops
where play resumes: galaxy selection when the run leads aboard, or Ada's room
page with its named action. Skip shows on every page except that room page and
the sleep scene. A scene's effects (a chapter opened or resolved, the prologue
seen) apply as the scene ends; Previous back into an ended scene does not undo
them. Choice buttons are
all secondary, with focus on the first. A choice page offers
two or three choices; each leads to one or two branch pages and then rejoins the
main story, so choices never change a chapter's resolution. The first choice is
the default. Locations include Grandma's house and garden, the community garden
lot, Ada's room, the school hallway, the schoolyard, the front door at home and
the park where Ada finds the rock. A scene that leads aboard ends on Ada's room,
with the narration "Ada's rock glows softly on her desk." and the named action.
Backgrounds by scene: galaxy one opens in Grandma's garden and resolves and closes
at the community garden lot; galaxy two opens in the school hallway and resolves
and closes in the schoolyard; galaxy three opens at the front door and resolves
and closes in the park; the prologue moves from the park to Ada's room. Narration
pages show no name tab; dialogue pages show the speaker's. Back on a storybook
page acts as Previous. An optional-question page returns to its question list
until Continue, so Ada can ask every question. Continue lands in the cockpit with
Astra's boarding line, then galaxy selection. Story position within a scene is not
saved: a scene interrupted midway restarts from its first page.

### Cockpit and galaxy selection

The cockpit is retro-futurist: 1960s ideas of the future with 1980s and 1990s
technology details, about the size of a closet, under a blue canopy: an opaque dome
from outside that Ada sees through from within. It resembles a convertible's interior: two seats side by side
for Ada and Penny, with a little room to walk around behind them. Ada pilots
from the port seat, with Penny on the starboard seat. Pages aboard picture the ship from
outside. Astra's portrait is geometric and softly glowing, and she speaks through
it on story pages as in conversations. Every quantum jump uses one
jump effect; Astra's emergency jump when the shield fails tints it red. Jumping
home, the emergency jump included, arrives in Ada's room. An emergency jump
lands at night: its jump-home page shows, then a 2 to 3 second sleep scene (Ada
asleep with Penny curled up, the rock glowing softly) that a tap skips after a
moment, then morning, when any waiting home scene plays as on any arrival home. A
voluntary Return to Earth has no sleep scene. The holodisk
drive looks like a CD or cassette player.

Every launch, including a replay of a resolved galaxy, boards and shows the
cockpit with galaxy selection on top. Galaxies are paged one
per page, in order, with Previous and Next, like Chibi's stage cards. An unlocked
galaxy shows "Galaxy {number}", its name, a small screenshot in the galaxy's own
hue and one line of flavor text, with Jump. Every galaxy has its own main
background hue, as Chibi's zones do. A locked galaxy is shown but disabled: its
number, a greyscale screenshot, and "..." for its name and text. At first only
galaxy one is unlocked. An Earth button, between Previous and Jump, and closing galaxy selection
(its close X, an outside tap, back or Escape), leave the cockpit and return Ada to
her room without a jump.
Galaxies are named after real galaxies' nicknames:
Sunflower (one), Cartwheel (two), Whirlpool (three) and Black Eye (four). Unlocked galaxies remain
replayable. Completing a quest invites a return to Earth without forcing immediate
exit from space.

Space conversations pause action and use brief essential exchanges with optional
questions about character and culture. The first mandatory introductory encounter
occurs after roughly a minute of exploration, with precise pacing tunable. It
happens only once per galaxy; repeat visits resume progress.

### Galaxy one: cooperating outposts

Ada has gardened with her grandmother since she was little. Through her grandmother
she learns about a stalled community garden initiative. Ada learns that people
can contribute in different ways, even when they cannot commit to regular gardening.
The chapter resolves through organizing practical contributions and beginning
the garden, rather than Ada solving everything alone.

The space adventure initially appears unrelated. Three outposts try to survive
independently, without realizing their complementary capabilities. A short delivery
circuit connects them. Working roles are growers with food, a workshop with repair
skills, and salvagers with materials. Ada helps them begin an ongoing exchange.
They are not enemies; lack of coordination is the obstacle. Once their exchange
is running, the outposts give Ada the galaxy's holodisk as thanks.

### Galaxy two: mining hub

Ada notices another child being bullied at school. No reason is needed to explain
why that child is targeted. Ada and other children choose inclusion, visible
support and refusal to normalize bullying. Do not resolve this by a duel.

The space station is a busy mining collection hub with adequate docking capacity.
Ada shoots resource-bearing rocks, collects pieces on contact into the
cargo hold, returns and deposits them. Cumulative deposited resource targets
advance story milestones; partial loads count. The resource identity and exact
quantities remain open.

During returns, Ada observes a pilot deliberately blocking another miner's docking
approach. She speaks with that miner and other regular visitors, establishes that
company would be welcome, and helps arrange an approach together. Others make
space and reject the intimidation. The targeted miner docks; they do not need
better piloting skills. No instant apology or friendship is required. Subsequent
visits preserve the changed relationships. The hub sells the galaxy's holodisk for
a provisional 300 Stardust.

Cartwheel's story ships are the miner, two regular visitors and the blocking
pilot: non-hostile small craft drawn with 16 headings and thrust jets, which
shots pass through and which never fight. Each scene is a short scripted path
near the hub that plays without Ada steering it. At the first deposit milestone
the blocking pilot cuts across the miner's approach and the miner turns away. At
the final milestone the miner and the visitors fly in together and dock, and the
blocking pilot flies off. Between scenes the miner and visitors wait at
holding points near the hub, inside the view while Ada is docked, which are
their story destinations; these have no
route guards, since Cartwheel's danger is at the ore fields. Each scene plays
first, and its dialogue line follows when the scene ends. A scene cut short by
the end of a flight replays with its line when Ada next reaches the hub. The hub looks worn but working until its Hub repairs project is funded.

Resource rocks come in medium and large classes, colliding and taking hits like
asteroids. A medium rock has 3 HP and releases 3 pieces, a large rock 5 HP
and 5 pieces; two of every three are medium. Cartwheel has no damaging hazards.

Cartwheel's space is an industrial ring of mining platforms in rust and ember
tones. Gadget's claim-jumper drones harass miners at the ore fields with hit and
run attacks, and fixed turret platforms guard some ore fields. Difficulty ramps
quickly from Sunflower; the roster is in [Ships](ships.md#galaxy-two-roster).

### Galaxy three: whale family

Ada loves her dog but resents walking it and overlooks its dependence on her for
movement and exploration. Her space experience changes her understanding of care.

Ada encounters an intelligent space whale trapped by debris: 3 medium stone
rocks of 3 HP, evenly spaced on a ring 86 world units from the whale's centre,
clear of its footprint. She shoots the
obstructions clear without harming the whale, learns about its needs and culture,
explores until she finds its family, then returns and relays their coordinates.
A short departure scene confirms reunion. The whale's family gives Ada a waypoint
to the galaxy's holodisk, which she must fight her way to. A direction indicator and a holodisk
beacon mark the waypoint at any range until the holodisk is recovered; a holodisk
whose location is not yet known shows no beacon; the waypoint is not a
Travel destination. Each galaxy's chapter completes only once its holodisk is
recovered. No persistent
companion-following AI or escort is required. Back home, Ada chooses to meet her dog's needs; the lesson
is expressed through her actions rather than a speech.

Whirlpool's space is teal and full of swirling debris. Gadget's hunter drones
chase the whale family; the roster is in [Ships](ships.md#galaxy-three-roster).
Its signature mechanic is space currents, flow fields that push every ship in
them. All values are provisional tuning:

- A current is an open curved path 3000 to 8000 world units long and 300 to 500
  wide. Its flow is strongest at the centre line, a peak of 70 world units per
  second (0.35 of Ada's 200 base top speed), falls to zero at its edges and fades
  out over the last 600 world units at each end.
- Currents and their debris rivers are placed by the galaxy's seed, so they stay
  in the same places on every flight, like stations. They cover about a tenth of
  open space, never overlap or close into loops, and keep 800 world units clear
  of stations, story destinations, landmarks and quantum jump arrivals. Asteroids
  are not placed in currents, and chunk generation keeps them clear.
- The flow adds to a ship's own velocity as drift, outside its physics and speed
  cap: riding a current gives Ada up to 270 world units per second, and pushing
  against its centre still makes 130. Ada steers, docks and fights normally in a
  current.
- Currents never trap Ada. The peak flow stays well below her slowest top speed,
  towing included (130), every current ends in open space, and she can always
  leave across it.
- Small enemy craft drift fully. Frigates, capitals, platforms, stations and
  whales do not drift. Inactive retained ships do not drift.
- Projectiles, missiles and beams ignore currents, so aim stays readable.
- Stardust and weapon pickups drift with the flow until they leave the current;
  the tractor beam pulls them as usual.
- A debris river is traveling debris that follows its current's centre line at
  the peak flow speed, entering at one end and leaving at the other. This is Whirlpool's one
  exception to constant-velocity moving obstacles; debris still never chases Ada.
  About a third of currents carry one.
- Currents show as flowing teal streaks whose direction reads at a glance,
  drawn as a placeholder until Art's streak art lands.

### Galaxy four: deferred conclusion

A concluding home chapter draws on the first three experiences without adding
another community problem. Ada and the allies she made in earlier galaxies
confront General Gadget's fleet here, take the last holodisk from him by force and
defeat him; shown that the galaxies are infinite and cannot be controlled, he
relents. The detailed scenes, enemies and home chapter remain to be designed; see
[the design](design.md#general-gadget).

## Flight and combat

- Isometric sprite-based presentation with independently controlled movement and aim.
- Ship physics, including Ada's acceleration, braking, momentum and turn smoothing,
  are defined per ship type in data; see [Ships](ships.md). Ada's ship has
  noticeable momentum and swings wide on sharp turns.
- Left joystick moves with analog speed and a short noticeable drag to reach full
  speed. Provisional movement reach is 40 logical pixels with a 2.4 logical pixel
  deadzone, scaling with the view like every layout value;
  the long reach gives finer low-speed control. The drawn knob stays inside the ring, as in
  Chibi. Each joystick draws a line from its origin to the thumb's actual position,
  extending past the ring however far the thumb travels, so the line shows the
  drag. Both joysticks' drawn rings sit 40 logical pixels in from the game area's side
  edges and 30 above its bottom, mirrored, with the Use button's bottom also 30
  above it. The move ring lights its left or right marker only when the
  move direction is within 67.5 degrees of that side.
- Speed rises steeply with stick deflection so the difference is clearly
  noticeable: small deflections give slow, controlled maneuvering and full
  deflection gives maximum speed. With deflection `m` from 0 just past the deadzone
  to 1 at full reach, target speed is
  `maxSpeed * (minSpeedFraction + (1 - minSpeedFraction) * m ^ speedCurveExponent)`.
  Provisional values are `minSpeedFraction` 0.04 and `speedCurveExponent` 2.5:
  about 8 world units per second just past the deadzone, 14 at a quarter, 42 at
  half, 102 at three quarters and 200 at full. Keyboard movement is full deflection.
- The ship's thrust jets scale with current speed as a fraction of maximum speed,
  not with stick deflection.
- Right joystick aims and fires continuously while deflected. The ship turns toward
  the aim with damping. Shots follow the ship's current facing and start
  immediately at the normal cadence.
- Maximum movement speed is provisionally 200 world units per second.
- The space screen shows only essentials: the joysticks, weapon icons, the
  status pill (shield and Stardust) and a pause button. There is no travel or destinations panel and
  no settings gear in space.
- Space shows no in-world name labels. Each named destination has a distinct
  look by role, the current objective's destination is marked by the direction
  indicator, and the Talk or Use button and the conversation name tab identify
  speakers up close.
- Pause, as in Chibi: the pause button at the top left opens a card titled
  "Paused" over the dimmed game, which pauses play, with a close X. Its buttons,
  one shape, in a full-width stack: "Resume" (primary), "Map", "Settings" and
  "Back to title". The card shows no objective text, and neither does space;
  in flight the direction indicator is the objective cue.
  The Map's header shows the galaxy name with its landmark pips and
  "{percent}% mapped" below them, then a "Quests" button and "Return to Earth".
  Quests opens a modal titled "Quests" listing the galaxy's current story
  objective, or "Story complete." once the chapter is resolved, then the held
  job or activity as "Job: {objective}". With no job held, a last line reads
  "Station job boards have more to do." once the galaxy has a discovered station.
  A line whose target is mapped is a button: it closes the modal and selects
  and centres that chip. With no lines at all, the modal reads "Explore to find
  something to do." The close X, an outside tap, back and Escape close it.
  Map shows the current galaxy: Ada's position, discovered destinations and
  stations, charted landmarks, the current objective's destination once mapped,
  a known holodisk waypoint until its holodisk is recovered, and how much of the
  galaxy is mapped. Undiscovered places never appear. Map places keep at least
  1020 world units apart, so each stays separate at full zoom; placement
  enforces this for every mapped place, outposts and the waypoint included, and
  a relaunch spaces story destinations at least 1200 apart. Story characters
  waiting at a station, such as Cartwheel's miner and visitors, are not map
  places; the station stands for them. Only chunks inside the charting circle
  enter the explored record. The
  explored area persists per galaxy across flights and clears on Restart. Choosing
  a discovered destination or station offers "Travel here", which teleports there. The Map
  also has "Return to Earth", a labelled secondary button on its top row beside
  the header, on every galaxy's Map, with no confirm, as for
  Travel here. Unlike Travel here it stays available while towing; the towed craft
  returns to where it was stranded. Return to Earth ends the flight and takes Ada to her room, with story progress saved
  and no quantum jump cost. Back to title ends the flight the same way and opens
  the start screen; it stays available in danger. While Ada is in danger, Travel
  here and Return to Earth stay visible but disabled, refuse with the shared refusal feedback, and the Map
  shows "Unavailable while you are in danger." The close X, an outside tap, back
  and Escape resume. Settings opened from the pause card returns to it when closed.
  On the start screen, Settings opens from its own button, as in Chibi, and
  Achievements sits immediately left of it in the same form; the start card
  holds only Start, or Continue and Restart. Achievements is on the start
  screen only.
- Weapon and pause controls use icons inspired by Chibi, with accessible labels.
- Settings uses the same terms and patterns as Archie and Chibi. Rows, in order:
  - Move controls and Aim controls, as in Chibi: each shows or hides one on-screen
    joystick (left and right). Each is shown unless the player hides it. Hiding a
    control hides only its drawing; its input still works. As in Chibi, on-screen
    joysticks appear only when the primary pointer is coarse (a touch screen).
  - Each row has its icon and a switch, as in Archie and Chibi.
  - Sound, as in Archie: a switch, on when sound is enabled, with the note "Mutes
    sound effects".
  - Reduced motion, as in Archie: a switch, on when motion is reduced, with the
    note "Skips screen shakes". A player's first setting on a device follows the
    device's reduced-motion preference.
  - Install, as in Archie: shown only while installation is available and the game
    is not installed, with the note "Full screen, offline" and an Install button.
    The row and the landing page's Install button show in every browser that is
    not running the installed app. The button opens the browser's install prompt
    when it holds one; otherwise it shows that browser's steps. Strings are under
    "Install steps" in [the player copy](player-copy.md#install-steps).
- Every setting persists on that device. Settings shows no keyboard binding text,
  and keyboard input is unchanged.
- Updates, as in Archie and Chibi: when a new version is waiting, the start screen
  offers it in a compact modal titled "Update available", with secondary "Cancel"
  on the left, primary "Update now" on the right, the ordinary close X and no body
  text. Only Update now reloads into the new version. Cancel, the close X, an
  outside tap, Escape and back defer it for that start-screen visit. Settings and
  install steps covering the start screen suppress the offer.
- Back, as in Chibi: it closes the innermost open card (install steps, Settings,
  the cheats card, the station card or shop) or defers the update offer; during
  flight with nothing open it opens the pause card, and with the pause card open it
  resumes.
  On the start screen with nothing open, and where the browser cannot hand back to
  the game, back is the browser's own.
- The landing page, as in Archie, shows an "Install" button beside Play while the
  game can be installed. It opens the browser's install prompt, or the same
  browser steps as the Settings Install row in a dialog with a "Close" button.
- Apart from the status pill, do not show a top-left information or status panel. Objectives, deposits and
  progression remain part of the game.
- With no aim input, the ship turns toward its movement direction with the same aim
  damping. Centered aim does not fire.
- Basic fire has unlimited ammunition; every other weapon has its own ammunition,
  bought at shops (see [Economy](economy.md#ammunition)).
- Basic is the starter weapon. The other weapons are Heavy Missile, Rapid Missile,
  Multi-Laser, Scattershot and Phaser, bought at station shops or found as rare drops; see
  [Economy](economy.md). Icon pickups, presented like Chibi's power-ups,
  equip their weapon at any time unless the switch wait is running, and retain
  other owned weapons; during the wait the weapon is added without equipping it.
- Every weapon and the shield have three levels. Each level multiplies effective
  output (damage times fire rate times how often it hits) by about 1.5, so level 3
  is about 2.25 times level 1. Single-target output meets those steps on its own;
  range, blast and spread growth add to them. Each weapon grows along its own
  dimensions:
  - Basic: damage and fire rate.
  - Heavy Missile: one slow straight missile (every 1.2 s, speed x0.6, 8 times
    basic damage) with a large blast; levels shorten its interval (1.2, 1.0, 0.8 s) and grow its
    blast radius (60, 72, 85).
  - Rapid Missile: quicker straight missiles (every 0.30 s, speed x1.3, 1.5 times
    basic damage) with a small blast (25); levels grow its fire rate and damage.
  - Multi-Laser: a fan of bolts evenly spaced across a fixed 40 degrees, 3 at
    level 1 (-20, 0 and 20 degrees), then 4, then 5, with a small damage rise to reach the level step.
  - Scattershot: a shotgun of visual dots across -30 to 30 degrees, 7 at level 1,
    then 9, then 11, each level reaching a little farther. Up close every dot hits;
    at range the spread covers more area but fewer dots hit. Dots do not apply
    damage over time.
  - Phaser: a hitscan beam. Each shot hits instantly along the aim from the ship
    out to a set range (provisionally 320 world units), stopping at the first enemy
    or obstacle it meets, then shows briefly as a visible beam. It fires
    intermittently, 4 times slower than basic fire, and deals 4 times basic damage
    to the enemy it hits; levels grow its range and damage.
- A missile's blast damages every enemy within its radius, never Ada.
- Ada's shots and Phaser beams leave from her ship's nose, and weapon ranges are
  measured from there.
- Fan angles are measured in the projected aim plane. Rotate there before
  unprojecting each shot direction; preserve the weapon's world-speed ratio.
- Each scattershot dot travels half the current projected viewport width along its
  own rotated heading, fades after 65% of that range and vanishes at the limit.
- Weapon intervals, speed and damage ratios, angles, range and fade are provisional
  catalog tuning. Speed ratios multiply the existing base projectile speed; damage
  ratios multiply base shot damage. No homing, piercing or reloading is added.
- Top-right weapon icons select basic fire or an owned weapon, in the order Basic,
  Rapid Missile, Multi-Laser, Heavy Missile, Scattershot, Phaser; only owned
  weapons show an icon. Switching preserves
  ownership of the other weapons. Ada can switch at any time, including in combat;
  after a switch the next switch waits 1 second (provisional).
- Enemy behavior uses data-defined archetypes and reusable behavior rules for
  solo ships, packs, frigates and capital ships. Galaxy one's roster is in
  [Ships](ships.md).
- General Gadget's uncrewed drone fleet is the recurring hostile faction in every
  galaxy, searching for the same holodisks.
- Defeated enemy ships are destroyed and drop Stardust, the game's currency.
- One rechargeable shield; avoiding damage briefly restores it. No hull resource.
- No post-hit invulnerability or protection window.
- Shield depletion makes Astra quantum jump Ada home to recharge overnight. Only the
  flight is lost; weapons, levels, Stardust, purchases and story progress persist,
  and the next flight generates a new layout. See [Economy](economy.md).
- The shield and Stardust share one status pill at the top left, beside the pause
  button: a shield icon and bar, a divider and the Stardust count. The bar is blue,
  turning red when the shield is low (below 25%) or empty, and shows hits, the
  recharge delay and regeneration. Low shield never relies on color alone: the bar
  also pulses, held steady under reduced motion, and Astra says "Shield low!".
- Game and save notices, such as the save-failure notice, show briefly in the
  conversation box's slot and style, without a portrait. A notice shows at once,
  ahead of ordinary conversation lines, which resume after it.
- One forgiving difficulty; no overall exploration timer.
- Ada's ship bounces off asteroids and other ordinary scenery with a little recoil
  and keeps moving; it never sticks. Scenery deals no damage. Attacks and marked
  hazards damage the shield.
- Friendly destinations, dialogue locations and teleport arrivals are always safe. No
  encounter is placed within 2000 world units of a flight's start or any quantum
  jump arrival, so every launch begins calm.

## Interactions and navigation

Use one contextual button, visible only when an interaction is available, with
an action label. Resources collect on contact. Mining cargo has no capacity limit.
No map or minimap.

Required events and undiscovered quest destinations spawn ahead of Ada in chunks
she approaches. Tune fresh-chunk exploration distance between encounters so continued
exploration reliably encounters required events regardless of direction. Standing
still, teleporting and revisiting chunks do not advance fresh-exploration pacing. Chunk generation must place
content ahead of arrival, not visibly spawn it on top of the player.

Discovered destinations become teleport options, including the whale. Travel is
available only outside immediate danger. Ada can return to Earth voluntarily from the Map.
Teleporting cargo to the mining hub is allowed outside danger: mining's challenge
is finding and extracting resources, not a mandatory return flight.

Quest deliveries use a separate carried-item state, independent of mining cargo.
Sources provide replacement quest items while their delivery remains unfinished.
Completed deliveries remain completed.

## Persistence and regeneration

Leaving a galaxy and re-entering generates a new layout seed. Story progress,
known destinations, deposited resources and achievements persist. Carried cargo
and weapon pickups reset. Known destinations remain usable despite regeneration.

Closing the game is not leaving the galaxy: resume the same flight with exact
important state and current nearby space, cargo, owned and selected weapons and
shield. Disposed ordinary history is not part of that exact-resume guarantee.
Save durable milestones as they occur.

Preauthored chunk shapes, contents and points of interest assemble near Ada.
They provide the existing galaxy variety of open areas, asteroid clusters and
narrow passages without adding stories or indoor transitions. Active and generation
distances are provisional tuning: three chunks for active space and two for
nearby generation. Retention depends on distance, not elapsed time.

Ordinary scenery and trash may be discarded beyond the retention distance and
regenerated on backtracking. Bound ordinary chunk, object and pack-history metadata
as well as active simulation. Persist a compact visited-chunk bitset so first visits
remain exact even when ordinary contents regenerate. Revisits never count as fresh
exploration. Compact visited information can grow with visited chunks; meaningful
persistent history can also grow with interactions and important encounters.

Retain frigates and capital ships independently of disposable chunks, including
mutable hardpoints, AI state and destroyed-ship tombstones. Interacted NPC state,
story, quests, routes and destinations also persist independently of those chunks.
Important guards must not reroll or disappear to bypass a required fight.

Retained inactive AI and debris freeze without advancing movement or cooldowns.
Reactivation applies no catch-up damage or elapsed-time simulation. Projectiles
remain globally owned exactly once and expire after a finite lifetime.
Unloading is not defeat, a resource drop, a pack casualty or a feedback event.

Destinations and quest debris remain accessible. Dormant required guards still
block their routes. Wake a required guard before relocating its pending destination,
then synchronize the guard's position and retained state with that relocation.

A completed galaxy keeps its resolved story and offers exploration, combat and
optional repeatable galaxy activities. One optional task per galaxy can remain
active while Ada visits other galaxies. Preserve its objective across regeneration;
lost carried quest items remain replaceable.

Additional mining deposits provide recorded totals and achievement progress.
Stardust and station shops are described in [Economy](economy.md). Achievements emphasize story, exploration and galaxy
activities, with none requiring missable dialogue choices. [Quests](quests.md)
defines achievements and [repeatable activities](quests.md#repeatable-activities).

## Astra and Penny in flight

In flight, Ada, Astra and Penny talk in short conversations, as Chibi's bosses
do. A conversation shows in a compact box shared with Chibi, below the HUD row,
leaving at least 24 logical pixels clear above Ada's ship. The speaker's name sits
in a tab above the box, with one portrait per line for its speaker: Ada's on the
left, Astra's, Penny's and the General's on the right. Each line wraps to at most
two lines. The box never pauses play, and the pause button and weapon icons stay
live while it shows. Its background is an ink #181425 panel at 0.65 alpha, the opacity of every panel, so it
stays readable over the brightest space signals; text, tab and portrait stay
opaque. Each line shows for 5 seconds or until the box (tab included) is tapped; a
tap moves to the next line, and the last tap closes the conversation. Tapping a
notice dismisses it. A conversation has one to three lines, and only one shows at
a time, with a cooldown between ordinary conversations. Hints are always on.

Conversations come from data, each with a trigger and a priority: warnings
(including the General's broadcasts), then notices, then first-flight lessons, then
Penny, then lore. A higher priority interrupts a lower one, which resumes after it
if still relevant. A queued conversation re-checks its trigger when its turn
comes and is dropped if the trigger no longer holds, such as Penny's lost-item
line once Ada has left the item's range. Triggers include the first flight's
lessons (each shown once, skipped when the player has already done the action),
a first arrival in a galaxy, meeting each alien group, a newly mapped destination
or station, a capital ship sighting, a low shield (once per fight), drones
arriving (only when drones are near; damage from debris or hazards alone never
plays the drone warning), and quiet stretches without combat, which draw unseen lore from the
galaxy's pool. Astra shares lore and flavor about places and alien species; Ada
asks questions and reacts. Seen conversations are saved so they do not repeat.

Penny rides in the second seat and never barks aloud. When an undiscovered point
of interest comes within a provisional 900 world units of Ada, even off screen,
one conversation shows Penny's "Woof! Woof!" and then Ada's reaction; it plays
once per point of interest, at most once per 60 seconds (provisional). Exact lines are in
[the player copy](player-copy.md#in-flight-conversations).

## Space encounters and feedback

Combat occurs in small groups separated by quiet stretches. Terrain mixes open
areas, asteroid clusters and narrow passages. There is no enemy-entry warning.
Direction indicators are rare. They mark only the current objective's
destination, a quest item or quest event, the holodisk waypoint and an
undiscovered station within range. Ordinary enemies, optional discovery caches
and ordinary resource rocks get none; Penny senses those instead. A discovery
cache lights when Ada comes within 160 world units. The holodisk is collected on
contact, like other pickups. The pause menu's Map is the only map; there is no minimap.
Discovery rewards use cargo and Stardust pickups; a discovery cache holds 5
Stardust. Weapons come only from shops and rare enemy drops. Stations are rare
points of interest with shops.

Visual effects distinguish hits, shield damage, destroyed ships, pickups and
deposits. Sound effects remain restrained. Reduced motion skips screen shakes.
Asteroids come in more sizes, including much larger ones, with irregular shapes
and variety; about a quarter of small and medium asteroids drift in slow closed
loops around their starting point. Every asteroid can be destroyed; bigger ones take more shots and release more
Stardust. Shots, Ada's, enemies' and the phaser's alike, strike an asteroid or
resource rock where it is drawn, on its current frame's silhouette, so a shot
that crosses the drawn rock on screen hits it; ship contact and placement use
Art's footprint. Drifting asteroids follow fixed loops that never overlap other rocks,
stations or destinations; ships bounce off them, and they deal no damage. Large
and huge asteroids stay out of passages and clear of stations, destinations and
launch points. Background objects stay muted
but carry a light tint of color; asteroids are play objects, not background.
Moving inanimate obstacles have constant velocity and direction. Regions of
traveling debris create navigation challenges along exploration and quest routes.
They do not chase Ada or change direction to intercept her.

Small enemy ships have independent movement, aiming and firing, with solo,
erratic circling, swarming and pack behaviors. Aggression can begin on sight or
only after being attacked. Individual enemies can flee, and packs can retreat
after losing members. Behavior selection and tuning belong in data wherever
practical; reusable code handles the underlying behavior operations.

Frigates have two or three designated hardpoints, such as an engine and weapons.
Capital ships are prominent large targets that cover at most a sixth of the
screen, about 5 Ada widths across, so the whole ship and its hardpoints stay
readable. A capital has many hardpoints and can travel with escort fighters. All designated
hardpoints must be disabled to defeat a ship. A disabled weapon hardpoint stops
firing. Each engine provides an equal share of thrust, so losing one of two engines
halves a ship's speed and losing all of them stops it. Large-ship weapons and command areas
must be visually distinguishable from the rest of the hull.

Missile launchers initially fire straight-flying missiles, visually distinct
from ordinary shots. Homing is not part of this combat pass.

Most enemy ships remain at or below Ada's speed. Selected small ships can reach
110% of her speed, with a finite pursuit range. Frigates and capital ships can
block required quest routes in the first three galaxies. This encounter expansion
does not define galaxy four's story or conclusion.

## Verification priorities

Check independent move/aim controls, shield recharge, the shield-depletion jump home,
safe dialogue and arrivals, unlimited mining cargo and deposits, recoverable deliveries,
fresh-chunk quest encounters, saved story progression, regeneration and exact
interrupted-flight resume. Verify the three home resolutions unlock galaxies
in order and completed stories remain resolved on replay.

Use rudimentary visuals to evaluate these behaviors before polishing graphics.
