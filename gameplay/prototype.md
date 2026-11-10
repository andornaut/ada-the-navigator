# Playable prototype contract

This contract records approved story and mechanics decisions for version one.
It supersedes conflicting undecided details in the initial design. Numerical
balance values are provisional and must be tuned through playtesting.

## Scope and presentation

Build a playable minimalist prototype with the first three story sectors.
Version one includes a fourth concluding sector, but its story and mechanics are
explicitly deferred. Do not invent a finale to fill that slot.

Space uses monochrome shapes and basic placeholders except Ada's small ship.
Its sprite is white and blue, an elongated triangle with one front point, two
rear points, twin thrusters at those rear points, a small tail and a compact
canopy with room for Ada and her dog. Keep the ship small relative to the viewport.
Toronto characters and Ada may reuse Archie's sprites wholesale. Ada is a
brown-skinned 12-year-old girl. Use Chibi as the settings dialog, positioning,
fonts, joystick and general UI reference. These explicit reuse permissions apply
to the prototype; do not modify the source games.

## Story progression

Toronto is an interactive story styled after choose-your-own-adventure books.
Different responses and approaches converge on each chapter's resolution;
choices cannot cause permanent failure. Complete the current space quest and
its Toronto resolution to unlock the next sector. Unlocked sectors remain
replayable. Completing a quest invites a return home without forcing immediate
exit from space.

Space conversations pause action and use brief essential exchanges with optional
questions about character and culture. The first mandatory introductory encounter
occurs after roughly a minute of exploration, with precise pacing tunable. It
happens only once per sector; repeat visits resume progress.

### Sector one: cooperating outposts

Ada has gardened with her grandmother since she was little. Through her grandmother
she learns about a stalled community garden initiative. Ada learns that people
can contribute in different ways, even when they cannot commit to regular gardening.
The chapter resolves through organizing practical contributions and beginning
the garden, rather than Ada solving everything alone.

The space adventure initially appears unrelated. Three outposts try to survive
independently, without realizing their complementary capabilities. A short delivery
circuit connects them. Working roles are growers with food, a workshop with repair
skills, and salvagers with materials. Ada helps them begin an ongoing exchange.
They are not enemies; lack of coordination is the obstacle.

### Sector two: mining hub

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
visits preserve the changed relationships.

### Sector three: whale family

Ada loves her dog but resents walking it and overlooks its dependence on her for
movement and exploration. Her space experience changes her understanding of care.

Ada encounters an intelligent space whale trapped by debris. She shoots the
obstructions clear without harming the whale, learns about its needs and culture,
explores until she finds its family, then returns and relays their coordinates.
A short departure scene confirms reunion. No persistent companion-following AI or
escort is required. Back home, Ada chooses to meet her dog's needs; the lesson
is expressed through her actions rather than a speech.

### Sector four: deferred conclusion

A concluding Toronto chapter draws on the first three experiences without adding
another community problem. The recurring hostile faction is confronted in this
sector, but its motives, finale, enemies and resolution remain undesigned.

## Flight and combat

- Isometric sprite-based presentation with independently controlled movement and aim.
- Very gentle acceleration and braking, without strong momentum.
- Left joystick moves with analog speed and a short noticeable drag to reach full
  speed. Provisional movement reach is 20 CSS pixels with a 2.4 CSS pixel deadzone;
  the visual thumb follows that travel.
- Right joystick aims and fires continuously while deflected.
- Maximum movement speed is provisionally 200 world units per second.
- Settings use Chibi's gear control. Weapon and settings controls use icons inspired
  by Chibi, with accessible labels.
- Do not show a top-left information or status panel. Objectives, deposits and
  progression remain part of the game.
- With no aim input, the ship faces movement. Centered aim does not fire.
- Basic fire and all upgrades have unlimited ammunition.
- Upgrades are rapid fire, three-shot spread and piercing shots. Icon pickups,
  presented like Chibi's power-ups, automatically equip their upgrade and retain
  other owned upgrades.
- Top-right weapon icons select basic fire or an owned upgrade. Switching preserves
  ownership of the other upgrades.
- Enemy behavior uses data-defined archetypes and reusable behavior rules for
  solo ships, packs, frigates and capital ships.
- A recurring hostile alien faction provides continuity across sectors.
- Disabled enemy ships teleport away. How and why are unknown, as with Ada's tech.
- One rechargeable shield; avoiding damage briefly restores it. No hull resource.
- No post-hit invulnerability or protection window.
- Shield depletion while an upgrade is selected removes that upgrade, fully restores
  the shield and always equips basic fire. Other owned upgrades remain available
  for manual selection.
- Shield depletion while basic fire is selected returns Ada to Toronto and sector
  selection. Story progress persists; the next flight generates a new layout.
- The shield bar spans the full bottom width and is approximately three pixels high.
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
available only outside immediate danger. Ada can return voluntarily to Toronto.
Teleporting cargo to the mining hub is allowed outside danger: mining's challenge
is finding and extracting resources, not a mandatory return flight.

Quest deliveries use a separate carried-item state, independent of mining cargo.
Sources provide replacement quest items while their delivery remains unfinished.
Completed deliveries remain completed.

## Persistence and regeneration

Leaving a sector and re-entering generates a new layout seed. Story progress,
known destinations, deposited resources and achievements persist. Carried cargo
and weapon pickups reset. Known destinations remain usable despite regeneration.

Closing the game is not leaving the sector: resume the same flight with exact
important state and current nearby space, cargo, owned and selected weapons and
shield. Disposed ordinary history is not part of that exact-resume guarantee.
Save durable milestones as they occur.

Preauthored chunk shapes, contents and points of interest assemble near Ada.
They provide the existing sector variety of open areas, asteroid clusters and
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

A completed sector keeps its resolved story and offers exploration, combat and
optional repeatable sector activities. One optional task per sector can remain
active while Ada visits other sectors. Preserve its objective across regeneration;
lost carried quest items remain replaceable.

Additional mining deposits provide recorded totals and achievement progress,
without currency or a shop. Achievements emphasize story, exploration and sector
activities, with none requiring missable dialogue choices. Exact achievement
requirements and repeatable-task content remain to be specified.

## Space encounters and feedback

Combat occurs in small groups separated by quiet stretches. Terrain mixes open
areas, asteroid clusters and narrow passages. There is no enemy-entry warning.
Nearby optional discoveries show a direction indicator; this does not add a map.
Discovery rewards use existing cargo and weapon pickups.

Visual effects distinguish hits, shield damage, disabled ships, pickups and
deposits. Sound effects remain restrained. Screen shake can be disabled.
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
block required quest routes in the first three sectors. This encounter expansion
does not define sector four's story or conclusion.

## Verification priorities

Check independent move/aim controls, shield recharge, both shield-depletion outcomes,
safe dialogue and arrivals, unlimited mining cargo and deposits, recoverable deliveries,
fresh-chunk quest encounters, saved story progression, regeneration and exact
interrupted-flight resume. Verify the three Toronto resolutions unlock sectors
in order and completed stories remain resolved on replay.

Use rudimentary visuals to evaluate these behaviors before polishing graphics.
