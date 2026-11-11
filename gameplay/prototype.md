# Playable prototype contract

This contract records approved story and mechanics decisions for version one.
It supersedes conflicting undecided details in the initial design. Numerical
balance values are provisional and must be tuned through playtesting.

## Scope and presentation

Build a playable minimalist prototype with the first three story galaxies.
Version one includes a fourth concluding galaxy, but its story and mechanics are
explicitly deferred. Do not invent a finale to fill that slot.

Space uses monochrome shapes and basic placeholders except Ada's small ship.
Its sprite is white and blue, an elongated triangle with one front point, two
rear points, twin thrusters at those rear points, a small tail and a compact
canopy with room for Ada and her dog. Keep the ship small relative to the viewport.
In these documents, Archie and Chibi name the sibling games Archie's Dog Walks
and Chibi's Way Home. Home characters and
Ada may reuse Archie's sprites wholesale. Ada is a
brown-skinned 12-year-old girl. Use Chibi as the settings dialog, positioning,
fonts, joystick and general UI reference. These explicit reuse permissions apply
to the prototype; do not modify the source games.

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
text or dialogue in a readable panel at the bottom. Next turns the page and
Previous returns to the previous page in the scene; Previous is disabled on a
scene's first page. A page that ends in a named action, such as "Pick up the
rock.", shows that action in place of Next. Skip is always visible and goes to the
end of the scene, taking the default path through any choices. Choice buttons are
all secondary, with focus on the first. A choice page offers
two or three choices; each leads to one or two branch pages and then rejoins the
main story, so choices never change a chapter's resolution. The first choice is
the default. Locations include Grandma's house and garden, the community garden
lot, Ada's room, the school hallway, the schoolyard, the front door at home and
the park where Ada finds the rock. A scene that leads aboard ends on Ada's room
with the rock.

### Cockpit and galaxy selection

The cockpit is retro-futurist: 1960s ideas of the future with 1980s and 1990s
technology details, about the size of a closet, under a large glass canopy with a
view all around. It resembles a convertible's interior: two seats side by side
for Ada and Penny, with a little room to walk around behind them. Ada pilots
from the port seat, with Penny on the starboard seat. Every quantum jump uses one
jump effect; Astra's emergency jump when the shield fails tints it red. Jumping
home arrives in Ada's room. The holodisk
drive looks like a CD or cassette player.

Every launch, including a replay of a resolved galaxy, boards and shows the
cockpit with galaxy selection on top. Galaxies are paged one
per page, in order, with Previous and Next, like Chibi's stage cards. An unlocked
galaxy shows "Galaxy {number}", its name, a small screenshot in the galaxy's own
hue and one line of flavor text, with Jump. Every galaxy has its own main
background hue, as Chibi's zones do. A locked galaxy is shown but disabled: its
number, a greyscale screenshot, and "..." for its name and text. At first only
galaxy one is unlocked. Closing galaxy selection (its close X, an outside tap,
back or Escape) leaves the cockpit and returns Ada to her room, without a jump.
Galaxies are named after real galaxies' nicknames:
Sunflower (one), Cartwheel (two), Whirlpool (three) and Black Eye (four). Unlocked galaxies remain
replayable. Completing a quest invites a return home without forcing immediate
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
Ada shoots resource-bearing rocks, collects pieces on contact into a limited
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

### Galaxy three: whale family

Ada loves her dog but resents walking it and overlooks its dependence on her for
movement and exploration. Her space experience changes her understanding of care.

Ada encounters an intelligent space whale trapped by debris. She shoots the
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
  speed. Provisional movement reach is 20 CSS pixels with a 2.4 CSS pixel deadzone;
  the visual thumb follows that travel so its position shows the requested speed.
  The aim knob moves at most 12 CSS pixels, as in Chibi, because aim deflection
  sets only direction. The move ring lights its left or right marker only when the
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
- The space screen shows only essentials: the joysticks, weapon icons, shield bar,
  Stardust count and a pause button. There is no travel or destinations panel and
  no settings gear in space.
- Pause, as in Chibi: the pause button at the top left opens a card titled
  "Paused" over the dimmed game, which pauses play, with a close X. Its buttons,
  one shape, stacked: "Resume" (primary), "Travel", "Settings" and "Return home".
  Travel opens the discovered destinations; choosing one teleports there. Return
  home ends the flight and takes Ada home to Earth, with story
  progress saved and no quantum jump cost. While Ada is in danger, Travel and Return home
  stay visible but disabled, refuse with the shared refusal feedback, and the card
  shows "Unavailable while you are in danger." The close X, an outside tap, back
  and Escape resume. Settings opened from the pause card returns to it when closed.
  On the start screen, Settings opens from its own button, as in Chibi.
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
    The button opens the browser's install prompt. Where the browser has none, it
    shows that browser's steps: on iOS, "Add to Home Screen" with "Tap Share, then
    Add to Home Screen."; in Firefox for Android, "Add app to Home screen" with "Tap
    the menu, then More, then Add app to Home screen."
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
- Do not show a top-left information or status panel. Objectives, deposits and
  progression remain part of the game.
- With no aim input, the ship turns toward its movement direction with the same aim
  damping. Centered aim does not fire.
- Basic fire and all upgrades have unlimited ammunition.
- Basic is the starter weapon. Upgrades are Missiles, Triple Laser and Scattershot,
  bought at station shops or found as rare drops; see [Economy](economy.md). Icon
  pickups, presented like Chibi's power-ups, automatically equip their upgrade
  outside combat and retain other owned upgrades.
- Missiles fire one slower, stronger straight projectile. Triple Laser fires three
  bolts at -20, 0 and 20 degrees. Scattershot fires seven visual dots at -30, -20,
  -10, 0, 10, 20 and 30 degrees; the dots do not apply damage over time.
- Fan angles are measured in the projected aim plane. Rotate there before
  unprojecting each shot direction; preserve the weapon's world-speed ratio.
- Each scattershot dot travels half the current projected viewport width along its
  own rotated heading, fades after 65% of that range and vanishes at the limit.
- Weapon intervals, speed and damage ratios, angles, range and fade are provisional
  catalog tuning. Speed ratios multiply the existing base projectile speed; damage
  ratios multiply base shot damage. No homing, splash, piercing or reload is added.
- Top-right weapon icons select basic fire or an owned upgrade. Switching preserves
  ownership of the other upgrades. Weapons cannot be changed during combat or for 5
  seconds after it.
- Enemy behavior uses data-defined archetypes and reusable behavior rules for
  solo ships, packs, frigates and capital ships. Galaxy one's roster is in
  [Ships](ships.md).
- General Gadget's uncrewed drone fleet is the recurring hostile faction in every
  galaxy, searching for the same holodisks.
- Defeated enemy ships are destroyed and drop Stardust, the game's currency.
- One rechargeable shield; avoiding damage briefly restores it. No hull resource.
- No post-hit invulnerability or protection window.
- Shield depletion makes Astra quantum jump Ada home to Earth and galaxy
  selection to recharge. The equipped weapon is lost unless it is Basic, and
  recharging costs a flat Stardust fee. Story progress persists; the next flight
  generates a new layout.
- The shield bar spans the full width at the bottom safe edge, above any
  home-indicator inset, and is approximately three pixels high.
- Game and save notices, such as the save-failure notice, show briefly as a
  compact strip at the top center below the safe inset, clear of the pause button
  and weapon icons.
- One forgiving difficulty; no overall exploration timer.
- Ordinary scenery blocks or slides the ship without damage. Attacks and marked
  hazards damage the shield.
- Friendly destinations, dialogue locations and teleport arrivals are always safe.

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
available only outside immediate danger. Ada can return home voluntarily from the pause card.
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
activities, with none requiring missable dialogue choices. Exact achievement
requirements and repeatable-task content remain to be specified.

## Astra and Penny in flight

In flight, Ada, Astra and Penny talk in short conversations, as Chibi's bosses
do. A conversation shows in a fixed box along the top with the speaker's name tab
and portrait: Ada's on the left, Astra's and Penny's on the right. Each line is one
line long. The box never pauses play and has a translucent background, more
transparent than Chibi's (provisionally 0.45 alpha); text and portraits stay
opaque. Each line shows for 5 seconds or until tapped; a tap moves to the next
line, and the last tap closes the conversation. A conversation has one to three
lines, and only one shows at a time, with a cooldown between ordinary
conversations. Hints are always on.

Conversations come from data, each with a trigger and a priority: warnings, then
Penny, then first-flight lessons, then lore. Triggers include the first flight's
lessons (each shown once, skipped when the player has already done the action),
a first arrival in a galaxy, meeting each alien group, a newly mapped destination
or station, a capital ship sighting, a low shield (once per fight), drones
arriving, and quiet stretches without combat, which draw unseen lore from the
galaxy's pool. Astra shares lore and flavor about places and alien species; Ada
asks questions and reacts. Seen conversations are saved so they do not repeat.

Penny rides in the second seat and never barks aloud. When an undiscovered point
of interest comes within a provisional 900 world units of Ada, even off screen,
one conversation shows Penny's "Woof! Woof!" and then Ada's reaction; it plays
once per point of interest. Exact lines are in
[the player copy](prototype-copy.md#in-flight-conversations).

## Space encounters and feedback

Combat occurs in small groups separated by quiet stretches. Terrain mixes open
areas, asteroid clusters and narrow passages. There is no enemy-entry warning.
Nearby optional discoveries show a direction indicator; this does not add a map.
Discovery rewards use cargo and Stardust pickups; a discovery cache holds 25
Stardust. Weapons come only from shops and rare enemy drops. Stations are rare
points of interest with shops.

Visual effects distinguish hits, shield damage, destroyed ships, pickups and
deposits. Sound effects remain restrained. Reduced motion skips screen shakes.
Other space objects retain monochrome placeholder graphics.

Moving inanimate obstacles have constant velocity and direction. Regions of
traveling debris create navigation challenges along exploration and quest routes.
They do not chase Ada or change direction to intercept her.

Small enemy ships have independent movement, aiming and firing, with solo,
erratic circling, swarming and pack behaviors. Aggression can begin on sight or
only after being attacked. Individual enemies can flee, and packs can retreat
after losing members. Behavior selection and tuning belong in data wherever
practical; reusable code handles the underlying behavior operations.

Frigates have two or three designated hardpoints, such as an engine and weapons.
Capital ships are prominent large targets, including ships around ten times
Ada's size and larger ships that extend beyond the viewport. All designated
hardpoints must be disabled to defeat a ship. A disabled weapon hardpoint stops
firing; a disabled engine stops movement. Large-ship weapons and command areas
must be visually distinguishable from the rest of the hull.

Missile launchers initially fire straight-flying missiles, visually distinct
from ordinary shots. Homing is not part of this combat pass.

Most enemy ships remain at or below Ada's speed. Selected small ships can reach
110% of her speed, with a finite pursuit range. Frigates and capital ships can
block required quest routes in the first three galaxies. This encounter expansion
does not define galaxy four's story or conclusion.

## Verification priorities

Check independent move/aim controls, shield recharge, both shield-depletion outcomes,
safe dialogue and arrivals, unlimited mining cargo and deposits, recoverable deliveries,
fresh-chunk quest encounters, saved story progression, regeneration and exact
interrupted-flight resume. Verify the three home resolutions unlock galaxies
in order and completed stories remain resolved on replay.

Use rudimentary visuals to evaluate these behaviors before polishing graphics.
