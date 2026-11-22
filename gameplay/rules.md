# Version one rules

This contract records approved story and mechanics decisions for version one.
It supersedes conflicting undecided details in the initial design. Numerical
balance values are provisional and must be tuned through playtesting.

## Scope and presentation

Version one is the game now being built, with six galaxies; anything later
belongs in [Ideas](ideas.md). The route runs:

| Position | Galaxy    | Home lesson                        |
| -------: | --------- | ---------------------------------- |
|        1 | Sunflower | Cooperation: the community garden  |
|        2 | Whirlpool | Caring for Penny                   |
|        3 | Needle    | Patience: practising a hard skill  |
|        4 | Andromeda | Honesty: owning up to a mistake    |
|        5 | Cartwheel | Inclusion: standing up to bullying |
|        6 | Phantom   | The finale: letting go of control  |

Tension rises, dips at Needle, builds again through Andromeda, and peaks with Cartwheel's stand against a bully
before Phantom's stand against Admiral Archie. Content tied to a galaxy, its
story, places, roster and art, is named by galaxy. Difficulty, rewards and prices
follow route position, so reordering the route moves a galaxy's content and gives
it its new position's values. Astra's memory lines and Admiral Archie's
broadcasts follow the order holodisks are recovered, which is route position once
every galaxy is built. Station jobs are in [Quests](quests.md).

Space uses authored sprites for ships, stations, outposts, pickups and asteroids,
with simple placeholders only where art has not landed yet.
Its sprite is white and blue, an elongated triangle with one front point, two
rear points, twin thrusters at those rear points, a small tail and a compact
canopy with room for Ada and her dog. Keep the ship small relative to the viewport.
When actual velocity is backward relative to the ship's facing or aim, yellow
reverse-thrust flames point forward just forward of the wingtip leading edges,
without covering the wing tips or extending the attachment points outside the
wings. Standard rear thruster flames remain blue. This is presentation only and does not change
forces or speed. Activation threshold and hysteresis preserve the existing
stationary threshold, reduced-motion behavior and engine-effects setting.
In these documents, Archie and Chibi name the sibling games Archie's Dog Walks
and Chibi's Way Home. Home characters and
Ada may reuse Archie's sprites wholesale. Ada is a
brown-skinned 12-year-old girl. Use Chibi as the settings dialog, positioning,
fonts, joystick and general UI reference. These explicit reuse permissions apply to
the game; do not modify the source games.

All UI fits the 720 by 360 logical pixel game area, centred on both axes so any
bands split evenly. Backgrounds may bleed
across the phone display. Intersect the actual game area with device-safe insets
for the common UI rectangle. Modal windows use the shared width families with
a 16 logical pixel screen margin: Large 688, Medium 500 and Small 400; height
follows content and fonts stay full size. Shop and Jobs are Large cards;
confirms and details are Small cards. The local and galaxy maps are full-screen
space views. Earth uses its own storybook page. Preserve existing padding and reflow. Do not mask or clip text or buttons to conceal overflow.

## Start, Home and Space

The game has two halves: Home, the storybook scenes on Earth, and Space, the
flights. With neither a started game nor a held story, the start screen offers
only Start, which begins Sunflower's home opening and then the prologue. Once a
flight has begun or a held story exists, it offers Continue and Restart,
including when a story is held before the first flight. A later launch with
neither condition still offers only Start. Newer-save recovery keeps these
start actions fenced until compatibility is rechecked.

Every launch opens on the start screen; Continue resumes where the save left off.
A held story page resumes at that page, including an unanswered choice. A saved
flight resumes exactly: galaxy, position, tow and danger (see the exact-resume
rule below), with any held story page restored over it. With neither a held
story page nor a saved flight, Continue opens Ada's room page, after any waiting home scene; picking up the rock then shows the glow,
"Welcome back, Navigator." and the galaxy map, with the farthest unlocked galaxy
selected. A home scene that is waiting, such as a chapter's resolution or the next
chapter's opening, plays first. When Ada goes home with no new scene, her room
shows one short repeatable line and "Pick up the rock."; finished chapters can be
replayed from the room, and new scenes unlock with progress.

Player-visible labels use "Earth" for travel to Ada's room and "title" for the
start screen; story dialogue may still call Ada's house home. Every arrival on
Earth lands in Ada's room. Nonpausable story pages use the three-line Menu at the
same position as Pause. Pause and Menu are one modal; Menu uses the smallest
modal preset. Its bottom button is primary: Close in Menu, Resume in Pause. Every
Menu or Pause outside Start, including Earth, story pages and maps, has Back to
title immediately above the bottom button. All other buttons are in alphabetical
order by label. Start's Menu lists Achievements, Exit and Settings; Earth and
story Menus list Achievements and Settings. Exit shows only on Start, and only
where exiting closes the installed app in the current runtime, detected at
runtime; it is hidden in plain browser tabs and never navigates elsewhere. Q
exits from the bare start screen only where Exit shows. Opening or closing Menu or
its children preserves the exact story page, dialogue, choices, progress and
locks. Closing a child returns to the same Menu and opener.

Restart asks first on a card with Restart and Cancel, as in Chibi; back and Escape
cancel. Confirming clears all story progress, unlocked galaxies, holodisks, seen
conversations and greetings, and everything else in
[What each event keeps](#what-each-event-keeps) except device settings and
achievements, then replays from Start.

## Story progression

Home is an interactive story styled after choose-your-own-adventure books.
Player-visible text calls Ada's home "home" or "Earth" and never names her city.
Different responses and approaches converge on each chapter's resolution;
choices cannot cause permanent failure. Recover the current galaxy's holodisk,
complete its space quest and complete its home resolution to unlock the next
galaxy.

On first launch, Sunflower's home opening is followed by the prologue: Ada digs
up the rock, polishes it, touches its glow and arrives aboard with her dog Penny.
Astra introduces herself, her corrupted memory, the time rule and the holodisk,
and asks Ada to be her navigator. Ada straps Penny in and chooses Sunflower. The
prologue plays once. Later, Ada boards from her room with "Pick up the rock." and
a brief boarding line, then chooses a galaxy.

### Earth scenes

Earth scenes are storybook pages. Each page has a full background of a place,
colorful but low contrast, with no landmarks or signs naming the city, and its
text or dialogue in a readable panel at the bottom.

A story run is every Earth and aboard page shown in a row between two points of
play: it starts when Ada leaves the start screen, a flight or the galaxy map,
or with Ada's room page's named action, and ends at the galaxy map or on Ada's
room page with its named action. Next
turns one page. Previous returns to the page shown before, across scene
boundaries within the run, and is hidden when no earlier page exists. The
run that starts with Ada's room page's named action counts that room page as
its first, so Previous on the boarding page that follows returns to it. The
"Welcome back, Navigator." page always follows the rock, so its Previous always
returns to Ada's room page. A page
that ends in a named action, such as "Pick up the rock.", shows that action in
place of Next. Skip follows the continuation across pages and scenes in the same
run, leaving optional questions unasked. It stops at an unresolved choice and
never selects an answer; material choices require the player's explicit answer.
With no unresolved choice ahead, it stops where play resumes: the galaxy map
when the run leads aboard, or Ada's room page with its named action. Every page
with Next also offers Skip. Skip sits in the top-right corner, apart from
Previous and Next, so tapping quickly through pages cannot skip a run. A scene's effects (a chapter opened or resolved, the prologue
seen) apply as the scene ends; Previous back into an ended scene does not undo
them. Choice buttons are
all secondary, with focus on the first. A choice page offers
two or three choices; each leads to one or two branch pages and then rejoins the
main story, so choices never change a chapter's resolution. No choice is
automatically selected. Locations include Grandma's house and garden, the community garden
lot, Ada's room, the school hallway, the schoolyard, the front door and kitchen at home and
the park where Ada finds the rock. A scene that leads aboard ends on Ada's room,
with the narration "Ada's rock glows softly on her desk." and the named action.
Backgrounds by scene: Sunflower opens in Grandma's garden and resolves and closes
at the community garden lot; Whirlpool opens at the front door and resolves and
closes in the park; Needle opens and resolves in Ada's room with the recorder
in view, its boarding pages included, and closes in the school concert hall, a
new location, with Ada playing on stage; Andromeda opens, resolves and closes
at Grandma's house and garden, with the seedling tray spilled from the opening
through the resolution's branch pages and replanted on the closing; Cartwheel opens in the school hallway, with dinner in the kitchen at home, and resolves and
closes in the schoolyard; Phantom opens in Ada's room with the party
invitations on the desk, its boarding pages included, resolves at the
community garden lot in the rain and closes in Ada's room at night with the rock
glowing; the prologue moves from the park to Ada's room. Narration
pages show no name tab; dialogue pages show the speaker's. Back on a storybook
page acts as Previous. An optional-question page returns to its question list
until Continue, so Ada can ask every question. Continue shows Astra's boarding line,
then the galaxy map. Back to title and Continue, or closing and reopening the
game, retain the exact story page, unanswered choice, questions already asked,
cross-scene Previous trail and elapsed sleep time. Resume does not select an
answer, repeat completed scene effects or restart the sleep scene. Saves keep
canonical scene, page and question references and navigation state, not embedded
authored text; the runtime resolves those references against its current story
content under the existing save compatibility guards.

### Earth return and replay status

Pending new Earth scenes play before Ada's room. Stay on Earth returns to the
room. "Pick up the rock." boards the ship. Once the first-launch prologue has
played and an authored Earth chapter is resolved, "Replay chapter" in Ada's room
opens the finished-chapter picker. Replay runs the chapter's authored opening
and resolution, including their choices. Selecting an answer immediately
replaces the saved choice for that scene and shows its branch. An absent legacy
choice remains unset until answered. Finishing or skipping replay returns to
the room. Skip leaves unanswered choices unset or unchanged, and replay
preserves pending mandatory scenes and existing rewards.

### Aboard and the galaxy map

The cockpit is retro-futurist: 1960s ideas of the future with 1980s and 1990s
technology details, about the size of a closet, under a blue canopy: an opaque dome
from outside that Ada sees through from within. It resembles a convertible's interior: two seats side by side
for Ada and Penny, with a little room to walk around behind them. Ada pilots
from the port seat, with Penny on the starboard seat. No page shows the cockpit's interior: pages aboard picture
the ship from outside, and the text carries where Ada and Penny are. Astra's portrait is geometric and softly glowing, and she speaks through
it on story pages as in conversations. Every page set aboard (the prologue from
Ada's arrival aboard, each boarding's "Welcome back, Navigator." page and the
pages after it, the holodisk narration and memory lines) shows the still aboard
background, with no animation and no separate holodisk-insert picture; the
jump-home page after the emergency jump shows the aboard-emergency background. Every quantum jump uses one
jump effect, with Ada's ship shown in it, arriving on the heading she starts the
flight with: jumps from the galaxy map (Jump to a galaxy, and Jump to Earth in flight), Travel and the
emergency jump. Boarding from her room is the rock's glow, not a jump; Astra's emergency jump when the shield fails tints it red. Jumping
home, the emergency jump included, arrives in Ada's room. Before a real shield-failure
return warps, the existing ship damage effect plays and Astra's portrait and name
show "Shields are down. We need to jump to safety!" for three visible seconds.
Combat, input and damage stay frozen until the jump finishes. Hidden-tab time
does not consume the warning, and reduced motion keeps the same reading time.
The return outcome is committed once before this presentation: reload resumes
home without another cargo penalty or replaying the warning. An emergency jump
lands at night: its jump-home page shows, then a 2 to 3 second sleep scene (Ada
asleep with Penny curled up, the rock glowing softly) that a tap skips after a
moment, then morning, when any waiting home scene plays as on any arrival home. A
voluntary Jump to Earth from the galaxy map has no sleep scene. The holodisk
drive looks like a CD or cassette player.

Every boarding from Ada's room (picking up the rock), including for a replay of
a resolved galaxy, shows the galaxy map before the flight; Continue without a
saved flight opens her room page first. The app itself always opens on the start screen. The design names two
maps: the local map (the pause card's Map) charts the current galaxy, and the
galaxy map moves Ada between galaxies; neither name appears in the interface. The galaxy map is a route map, like Chibi's zone map,
drawn over a night sky full of stars, galaxies and nebulae above an evening
grass strip about 50 pixels tall along the bottom, where Ada and Penny stand
seen from behind, looking up. The panel sits above the grass, with the
destination action over it. All six galaxies sit
in route order from left to right along one arc, with names under the markers, each a marker in its galaxy's own main hue, as
Chibi's zones have, with Ada's ship, drawn as her current ship sprite, on the selected galaxy. Right moves the ship to the next
open galaxy in route order and Left to the previous one; both skip locked galaxies, as
Chibi's walk skips unavailable zones. Tapping an open marker moves the ship
there. The ship starts on the farthest unlocked galaxy, so on the first boarding
it sits on Sunflower, the only open galaxy, with "Jump to Sunflower" as the
action. Tab focuses every galaxy marker in route order, then Earth and the
destination action. Tapping, or focusing with Tab, a locked marker shows its
panel while the ship stays on its open galaxy; the action then reads "Progress
the story to unlock", is unavailable and refuses with the shared refusal
feedback. Left or Right returns the panel to the ship's galaxy. A panel under
the chart shows the selected galaxy's "Galaxy {number}", its name, a small
screenshot and one line of flavor text. Earth is a selectable marker centered
inside the route arc, labelled "Earth"; its panel shows the kicker "Home", the
title "Earth", Ada's room picture and "Ada’s life on Earth. Time here stands
still while she’s aboard the ship." One centered primary action names the
selected destination: "Jump to {galaxy}", "Stay in {galaxy}", "Jump to Earth"
or "Stay on Earth". There is no separate Earth or Back button. A locked galaxy's marker is greyscale, with "..." for its name and
text. A placeholder galaxy, one whose story is not yet built, is flyable: it has
generic space, enemies and rocks, its position's difficulty and its roster, but no
story, holodisk or story destinations. Its panel shows its number, name and flavor
line, then "Story in development.", and its Jump action works. Its marker is open, in its
galaxy's hue, and its screenshot is a generic space view until its own art lands. At first only the first galaxy
is unlocked. Completing a galaxy (its holodisk, space quest and home resolution, as above)
unlocks the next position, every
placeholder after it and the next built galaxy, so placeholders never block the
route: when the next positions are placeholders, completing a galaxy opens them
and the next built galaxy together. Saves keep every unlock. The first boarding after an
unlock shows the ship flying along the route to the farthest newly unlocked
galaxy. When one unlock opens several galaxies, their markers open together and the
ship flies once along the route to the farthest, passing the markers between,
in at most 2.4 seconds in all, then waits for the player's choice. The galaxy map is the only galaxy
selection; there is no separate selection card. It opens at every boarding and,
in flight, from the local map's Galaxies button. Opened in flight, the ship
starts on the galaxy Ada is flying in, and while it sits there the action
reads "Stay in {galaxy}": like back and Escape, it returns to the local map with no
jump and no new layout. Jump to another galaxy ends the current flight, with
story progress saved, and quantum jumps into the chosen galaxy; Jump to Earth
ends the flight and jumps Ada home to her room. At boarding Ada is on Earth, so
Earth's action reads "Stay on Earth" and returns her to her room with no jump.
The galaxy map has no close X
or Back button: Ada leaves it through the destination action, or with back and
Escape, which go one step back, to the page Ada just left: the local map in
flight, or the "Welcome back, Navigator." page at boarding. Stay on Earth is the way home from boarding.

Galaxies are named after real galaxies' nicknames, in the route order above.
Every unlocked galaxy stays replayable in any order. Its resolved story stays
resolved, and its stations, shops, jobs, activities and any unfinished quests
stay available. Completing a quest invites a return to Earth without forcing
immediate exit from space.

Every Use interaction in space (Talk, Deliver, Tow, Salvage, Deposit, Dock and
the rest) opens the conversation card: the storybook's story panel over the
paused, dimmed space view. Each line shows its actual speaker's name tab and
portrait; an interaction with no person to address uses Astra. A page offers
Continue, choice buttons and Ask more, and the card has a close X and Skip; the
close X is its only Close control. Dock opens the card on the keeper's greeting,
and its last page shows the Stardust balance, Jobs at a station with the jobs
specialty, Undock and primary Shop; its close X, an outside tap, back and Escape
undock.
All dialogue is skippable: Skip jumps to the exchange's outcome, and a pending
choice still asks. Conversations use brief essential exchanges with optional
questions about character and culture (see [Player copy](player-copy.md)).
In-flight chatter, drone warnings and the Admiral's broadcasts stay in the small
in-flight box, and that box and notices never pause play (see
[Astra and Penny in flight](#astra-and-penny-in-flight)).

Shop and Jobs open from the station's last page and return to it. Pause,
Settings and the Map keep their layout.

The first mandatory
introductory encounter occurs after a set distance of fresh exploration,
measured in fresh chunks, with the distance tunable. It happens only once per
galaxy; repeat visits resume progress.

### Galaxy one, Sunflower: cooperating outposts

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

### Galaxy two, Whirlpool: whale family

Ada loves her dog but resents walking it and overlooks its dependence on her for
movement and exploration. Her space experience changes her understanding of care.

Ada encounters an intelligent space whale trapped by debris: 3 medium stone
rocks of 3 HP, evenly spaced on a ring 86 world units from the whale's centre,
clear of its drawn outline. She shoots the
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

Whirlpool's space is teal and full of swirling debris. Archie's hunter drones
chase the whale family; the roster is in [Ships](ships.md#whirlpool-roster).
Its signature mechanic is space currents, flow fields that push every ship in
them. All values are provisional tuning:

- A current is an open curved path 3000 to 8000 world units long and 300 to 500
  wide. Its flow is strongest at the centre line, a peak of 70 world units per
  second, falls to zero at its edges and fades
  out over the last 600 world units at each end.
- Currents and their debris rivers are placed by the galaxy's fixed seed, so they
  stay in the same places on every flight, like stations (see
  [Persistence and regeneration](#persistence-and-regeneration)). They cover about a tenth of
  open space, never overlap or close into loops, and keep 800 world units clear
  of stations, story destinations, landmarks and quantum jump arrivals. Asteroids
  are not placed in currents, and chunk generation keeps them clear.
- The flow adds to a ship's own velocity as drift, outside its physics and
  maximum speed: riding a current gives Ada at her base engine up to 245 world
  units per second, and pushing against its centre still makes 105. Ada steers, docks and fights normally in a
  current.
- Currents never trap Ada. The peak flow stays well below her slowest top speed,
  towing included (about 114), every current ends in open space, and she can always
  leave across it.
- Small enemy craft drift fully. Frigates, capitals, platforms, stations and
  whales do not drift. Inactive retained ships do not drift.
- Projectiles, missiles and beams ignore currents, so aim stays readable.
- The whales' current is the current that passes nearest the whale family,
  chosen by the seed with the rest. The Map shows no currents.
- Pickups drift with the flow until they leave the current; the tractor beam
  pulls them as usual.
- A debris river is traveling debris that follows its current's centre line at
  the peak flow speed, entering at one end and leaving at the other. Its path is
  fixed, like every moving obstacle's, and never steers toward Ada. About a
  third of currents carry one.
- Currents show as flowing teal streaks whose direction reads at a glance,
  drawn as a placeholder until Art's streak art lands.

### Galaxy three, Needle: threading the needle

Ada learns patience: sticking with a hard skill through practice.

Ada is learning the recorder for the school concert, and her song keeps
squeaking. She wants to quit. After the space story she practises a little every
day, one hard part at a time, and plays the whole song at the concert. It is not
perfect, and she is proud of it.

Needle's space is a thin silver galaxy seen edge on. Its people, the Avi,
fly the long narrow channels between its star clouds and teach young pilots to
"thread the needle". Astra's holodisk has drifted to the far end of the Eye, a
narrow channel of slow drifting debris. Ada's first try is too fast. Elder Loom,
an old Avi pilot, teaches her at a short practice run, then sends her through
the Eye. Elder Loom is an older Avi with silver feathers, a lavender
tunic and pilot goggles, and has no pronoun: player text and these documents
always use the name.

A gate run is a chain of ring gates along a narrow channel. A gate lights only
when Ada passes through it below 40% of her top speed, and each gate glows while
her speed is slow enough to light it. A gate passed too fast stays dark, and
Elder Loom calls her back to the last gate she lit, or to the first gate when
she has lit none. Debris in the channel drifts slowly and bumps the ship aside,
dealing bump damage like all scenery. The practice run has 3 gates; the Eye has 8, with the holodisk
beyond the last. No enemies enter a gate run. Archie's drones wait outside the
Eye's exit, so Ada leaves with the holodisk and fights her way clear.

Objectives: explore; meet Elder Loom; light the practice gates; light the Eye's
gates; collect the holodisk; return to Earth.

Channels are 210 world units wide, 150 in the Eye, and each ring gate's opening
is 66. A gate counts as passed when Ada's centre crosses it inside the opening;
its rim bumps the ship aside like scenery but deals no damage. Every gate stands at least 30 degrees
off screen horizontal, so the upright hoop never reads edge-on. The Eye is an
almond of drifting debris around its channel, with the 8 gates along it and the
holodisk past the last. The drone pack waits beyond the exit, outside the
channel.

### Galaxy four, Andromeda: the dark beacon

Ada learns honesty: owning up to a mistake and making it right.

At Grandma's house, Ada knocks over a tray of seedlings Grandma has been raising
for the community garden. She sets the pots back and says nothing. Later Grandma
finds the spilled soil and is puzzled and a little sad; nobody is blamed. Ada
feels uneasy all day. The resolution comes after the space story: she tells Grandma what
happened, helps replant the tray, and Grandma thanks her for telling the truth.
Nobody is punished for the accident; the hard part was saying it.

Andromeda's space is a great bright spiral, the closest of the galaxies, with a
chain of guide beacons that ships follow between its settlements. One beacon has
gone dark and ships keep getting lost. The frightened settlers blame Archie's drones. Ada meets Pip, a young courier, who admits to her that he
clipped the beacon during a rushed delivery and was too scared to say. He also
found a strange disc in the wreckage, Astra's holodisk, and has kept it as a
treasure. Ada does not tell on him: she offers to go with him while he tells the
settlers. He owns up, the settlers' fear eases, and Ada and Pip gather the
parts to relight the beacon. Pip then hands Ada the holodisk himself.

Objectives: explore; find out why ships are getting lost; talk with Pip; go with
Pip to the settlers; get beacon parts at the settlement with Pip; bring beacon parts to the dark beacon; take the holodisk
from Pip; return to Earth. Archie's drones are hunting here openly. Andromeda's drones patrol in larger
groups with more frigates than Needle's; its roster is tuned like the others.

Andromeda's stations are settlers' stations, drawn with the settlers' art, as
Cartwheel's station is the mining hub: each is a full station with dock, Exchange,
its supported specialties and, once the chapter is complete, projects. The local
map calls it Station.
Going with Pip to the settlers ends at the nearest settlers' station. Getting the beacon parts with Pip ends at the
nearest settlement, where Pip collects them and Ada carries them to the dark
beacon. The
settlements are Andromeda's outposts: the local map calls them Outpost, Ada uses one
like Sunflower's outposts rather than docking, and the courier run, deliveries
and tows can end at one. Their sentence names are "the settlers' station" and
"the settlement". The guide beacons are story objects, separate from the
galaxy's beacon landmarks: the dark beacon is a story place, and the
rest of the chain is scenery, not Map places. The chain links neighbouring
settlements: a lit guide beacon stands every 2000 world units along the
straight line between two settlements, alternating its two looks, and the dark
beacon is one of them, dented until Ada and Pip relight it.

### Galaxy five, Cartwheel: mining hub

Ada notices another child, Sam, being bullied at school. No reason is needed to explain
why that child is targeted. Ada and other children choose inclusion, visible
support and refusal to normalize bullying. Do not resolve this by a duel.

The space station is a busy mining collection hub with adequate docking capacity.
Ada shoots resource-bearing rocks, collects pieces on contact into the
cargo hold, returns and deposits them. Three story milestones fall at cumulative
deposits of 10, 20 and 30 ore (provisional); partial loads count.

During returns, Ada observes a pilot deliberately blocking another miner's docking
approach. She speaks with that miner and other regular visitors, establishes that
company would be welcome, and helps arrange an approach together. Others make
space and reject the intimidation. The targeted miner docks; they do not need
better piloting skills. No instant apology or friendship is required. Subsequent
visits preserve the changed relationships. The hub sells the galaxy's holodisk for
a provisional 500 Stardust, in its shop. Once discovered, the hub is one of the
galaxy's discovered stations like any other.

Cartwheel's story ships are the miner, two regular visitors and the blocking
pilot: non-hostile small craft drawn with 16 headings and thrust jets, which
shots pass through and which never fight. Each scene is a short scripted path
near the hub that plays without Ada steering it. At the first deposit milestone
(10 ore) the blocking pilot cuts across the miner's approach and the miner turns
away. After the second (20 ore) the miner talks with Ada. At the final milestone
(30 ore) the miner and the visitors fly in together and the
blocking pilot flies off. The hub has two berths: the miner docks at the left
and the first visitor at the right, while the second visitor holds at its
holding point beside the hub. Once the Second docking bay project is funded,
that visitor docks at the new bay. Between scenes the miner and visitors wait at
holding points near the hub, inside the view while Ada is docked, which are
their story destinations; these have no
route guards, since Cartwheel's danger is at the ore fields. Each scene plays
first, and its dialogue line follows when the scene ends. A scene cut short by
the end of a flight replays with its line when Ada next reaches the hub. The hub looks worn but working until its Hub repairs project is funded.

Player text calls resource rocks "ore rocks" and their pieces "ore". Resource
rocks come in medium and large classes, colliding and taking hits
like asteroids. A medium rock has 3 HP and a large rock 5 HP; two of every three
are medium. Ore rocks use the same size-based asteroid yields, 75% initial ore
split and 25% expected ore quantity reduction in
[Economy](economy.md#earning-stardust), including the exclusive ammo outcome.
Cartwheel has no damaging hazards.

Cartwheel's space is an industrial ring of mining platforms in rust and ember
tones. Archie's claim-jumper drones harass miners at the ore fields with hit and
run attacks, and fixed turret platforms guard some ore fields. Difficulty ramps
along the route; the roster is in [Ships](ships.md#cartwheel-roster).

### Species and greeters

Each galaxy's people are one kid-friendly alien species: animal folk in
Sunflower, Whirlpool and Needle, androids in Andromeda, living rock in Cartwheel
and goo in Phantom. Its role voices, story characters and greeters are all of
that species, apart from Whirlpool's whales and Admiral Archie.

| Galaxy    | People  | Form         | Lore                                                                                                                                               |
| --------- | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sunflower | Bumbles | Bees         | Hive folk who farm starlight and hum while they work; the growers, workshop and salvagers are Bumbles.                                             |
| Whirlpool | Voron   | Squid        | Current riders who live beside the whales and write in ink that glows.                                                                             |
| Needle    | Avi     | Herons       | Long-legged pilots who stand still before they move; Elder Loom is an Avi.                                                                         |
| Andromeda | Munix   | Androids     | Built settlers who steer by beacon light and keep their lamps lit; Pip and the settlers are Munix.                                                 |
| Cartwheel | Cobbles | Living rock  | Stone folk who mine the ore that feeds them and never mind a bump; the young are pebble-sized. The miner, visitors and blocking pilot are Cobbles. |
| Phantom   | Blurbs  | Blobs of goo | Wobbly goo folk of the shadowed rim, living under Archie's watch; his blockades cut their settlements off.                                         |

Named characters show their names on name tabs in place of the role labels the
copy uses:

| Galaxy    | Role label                    | Name              |
| --------- | ----------------------------- | ----------------- |
| Sunflower | Grower                        | Clover            |
| Sunflower | Workshop                      | Rivet             |
| Sunflower | Salvager                      | Patch             |
| Whirlpool | Whale (the trapped whale)     | Marlo             |
| Needle    | Avi (the elder)               | Elder Loom        |
| Needle    | Avi (a young pilot)           | Reed              |
| Andromeda | Settler (the story's settler) | Wick              |
| Cartwheel | Station (the hub's voice)     | Quartz            |
| Cartwheel | Miner                         | Mica              |
| Cartwheel | Regular visitor               | Opal, then Jasper |
| Phantom   | Blurb, the third settlement   | Dollop            |

Cartwheel's first regular-visitor line is Opal's and the final-milestone line
Jasper's. The bullied child at home is Sam (they). The blocking pilot, the whale
family, settlement greeters and the calf stay unnamed.

Every station in all six galaxies has a distinct keeper with a unique display
name, and every Andromeda settlement a settler who greets Ada. A keeper's stable
identity derives from its station id and is saved across revisits and reloads.
Portrait ids are separate from keeper identities: a finite species portrait
roster may be reused without cycling the same three NPC identities through
stations. Tech owns serialization and deterministic name-collision handling,
preserving saved identities. Cartwheel's mining hub remains Quartz's;
other named story roles retain their identities.

The existing keeper names below identify the finite portrait reference roster,
not a limit of three station identities per galaxy.

| Galaxy    | Keepers                  |
| --------- | ------------------------ |
| Sunflower | Saffron, Bramble, Nectar |
| Whirlpool | Ripple, Coral, Brine     |
| Needle    | Sedge, Willow, Marsh     |
| Andromeda | Lumen, Dial, Cog         |
| Cartwheel | Quartz, Slate, Garnet    |

#### Generic station keeper interface and copy

Logical keeper facts are `stationId`, stable station-derived `keeperId`, unique
`displayName`, separate `portraitId`, supported services, three introduction
lines and short return lines. Name components are `givenName`, `familyName` and
the station-specific qualifier "of {station}". Generic keeper full names use
"{givenName} {familyName} of {station}", with the canonical station display name.
Station display names and keeper full names must be unique and stable across
saves and revisits; nine given/family combinations are not a limit on station
count or permission to reuse a full name. Do not expose raw coordinates or an
unreviewed numeric NPC id as the qualifier. Existing named characters keep their
identities; portrait reuse does not turn them into a new keeper. Tech owns the
representation and deterministic collision handling; stability does
not require a new save field.

Generic station labels use "{galaxyName} {stationWords} Station". Encode the full
stable station identity, including placement layer and signed cell coordinates,
bijectively as a nonnegative integer using a compact structured layer tag,
zigzag-encoded coordinates and Cantor pairing. The mapping must be injective
over the full identity; do not encode the raw UTF-8 full station id.
Render the integer's minimal base-16 digits using this ordered word alphabet,
separated by spaces:

Amber, Beacon, Comet, Dawn, Ember, Fern, Glimmer, Haven, Iris, Juniper, Kite,
Lantern, Meadow, Nova, Orbit, Pebble.

Zero is Amber. Other encodings have no leading zero digit, so labels are
unambiguous. The galaxy name distinguishes galaxies. Never derive labels from
discovery order, a station index or a collision-prone hash, and never show raw
coordinates or numeric ids. These words are a label code, not new NPC stories.
Named story destinations and Quartz's mining hub retain their existing labels.
Generic legacy keeper keys remain portrait references only; reusing a face does
not reuse an NPC identity. Labels and full keeper names are purely identity-derived;
Saved identities are never rewritten.

The model supplies `StationGreeting.displayName` separately from
`keeper: KeeperKey`, which selects the existing portrait. Its
`GameModel.stationServices` is null off dock, or a readonly `StationServices`
value with `exchange: true` and boolean `equipment`, `weaponsAmmo`, `jobs`,
`projects` and `heldTask` fields. `StationService` names the specialties
`equipment`, `weaponsAmmo` and `jobs`. The UI consumes these facts and the
formatted greeting; it never derives service availability from dialogue.
Projects preserve their existing availability. Active task details and Drop
remain available at any station through `heldTask`; only new job offers require
`jobs`. Existing story hubs retain all their approved capabilities.

| Galaxy    | Given-name components | Family-name components       |
| --------- | --------------------- | ---------------------------- |
| Sunflower | Pollen, Petal, Amber  | Goldwing, Bloom, Honeycomb   |
| Whirlpool | Cove, Eddy, Foam      | Tide, Current, Shell         |
| Needle    | Fern, Rush, Aster     | Reedwing, Thread, Stillwater |
| Andromeda | Prism, Tick, Arc      | Beacon, Lamplight, Compass   |
| Cartwheel | Flint, Shale, Chert   | Pebble, Copper, Ridge        |
| Phantom   | Dew, Puddle, Wisp     | Ripple, Drift, Glow          |

Generic station first-visit introductions have three lines:

1. "Welcome to {station}. I'm {keeper}."
2. The galaxy's flavor line below.
3. One supported service line below; Exchange is the fallback.

`{station}` is the station's display name and `{keeper}` the keeper's full unique
display name. The identity and station name make the dialogue package specific
to that station; the components add no individual NPC backstory.

| Galaxy    | Flavor line                                    |
| --------- | ---------------------------------------------- |
| Sunflower | "{station} keeps humming."                     |
| Whirlpool | "{station} welcomes current riders."           |
| Needle    | "No need to rush at {station}."                |
| Andromeda | "The lamps at {station} are lit for you."      |
| Cartwheel | "A little dust never bothers us at {station}." |
| Phantom   | "There is room to rest at {station}."          |

Service lines, emitted only when the station offers that service:

- Equipment: "{station} has equipment for your ship."
- Weapons and ammunition: "{station} sells weapons and ammo."
- Jobs: "There's work on the board at {station}."
- Exchange: "You can trade ore and Stardust at {station}."

Return lines cycle within the assigned station:

- "Welcome back to {station}, Navigator."
- "{keeper} here. You can trade ore and Stardust here."
- "Back at {station}! What do you need today?"

The mining hub and actual story characters retain their authored lines and
identities. The generic station contract does not change their story dialogue.

Each station's keeper has short station-specific introduction and return lines,
including at stations without jobs. The mining hub's lines still mention the
hub. In the compact Dock card, the generated keeper's name tab shows
"{givenName} {familyName}" on one line. The full unique name, including
"of {station}", stays in the greeting templates that use it. Keeper identity
remains station-derived. Authored keeper labels, including Quartz, retain their
authored names. A bounded name-part and flavor pool uses the approved
station-name and service templates above without inventing individual NPC
histories. Portrait assignments use the finite existing
assets separately from the named story identities. Story destinations keep their
story characters' arrival lines; landmarks have no greeter. The first time Ada
docks at a station, each of its keeper's three greeting lines is a page of the
conversation card, advanced with Continue. Skip opens the last page when more than one advance remains. Each later
docking opens on the last page with a short return line from that station's
keeper. The first time Ada comes within Talk range of a settlement, its
settler's two-line greeting plays in the conversation box. Greetings seen are
saved per place, and Restart clears them. Phantom also follows the distinct
station-keeper contract; Admiral Archie's named finale identity, dialogue and
portrait remain story content, not one keeper identity repeated at every
station. Existing authored lines are in [the player copy](player-copy.md#greeters).

### Galaxy six, Phantom: the finale

Ada learns to let go of control. The chapter draws on the first five without
adding another community problem: everyone Ada helped comes to her thank-you
party, her perfect plan washes away in the rain, and the day is better for it.
In space, Admiral Archie wants to control every galaxy; Ada shows him that they
never end (see [the design](design.md#admiral-archie)).

At home, Ada plans a thank-you party at the community garden for Grandma, Sam,
her friends, Mom and Dad, with a list for every minute. After the space story, rain
spoils the plan. Ada lets it go, everyone crowds together in the rain, and
nobody remembers the schedule. That night Astra, whole again, chooses to keep
flying with Ada.

Phantom is a shadowed rim in smoke and violet. Archie's fleet holds it, and
his blockades cut the Blurbs' settlements off from the rest of the galaxy. The
space story runs in three acts:

1. **Blockades.** Three Blurb settlements, story destinations placed like
   Sunflower's outposts, each sit inside a blockade: a `frigate` and two `fighter`
   groups from Phantom's roster, holding within 600 world units of the
   settlement. A blockade breaks when all its ships are destroyed, disabled or
   fled. The direction indicator marks the nearest unbroken blockade. A freed
   settlement's Blurb thanks Ada through Talk; the third, Dollop, tells her where
   the flagship waits and sends word to her friends. The flagship's position then
   shows as a waypoint, marked like the holodisk waypoint, at least 6000 world
   units from every settlement.
   The authored first, second and third settlement exchanges must follow actual
   liberation order, not the settlement's fixed destination number. The first two
   use Blurbs; only the third uses Dollop's flagship lead and message to friends.
   Keep the actual destination id as the interaction's outcome target. Save the
   freed-settlement order and reuse each settlement's assigned exchange on revisit
   and reload; revisiting must not reorder it. A settlement reached early must
   never expose Dollop's third-liberation lead.
2. **Fleet battle.** When Ada comes within 1500 world units of the waypoint, the
   battle begins: her allies jump in beside her (see
   [Ships](ships.md#finale-allies)), and three waves of drones come, each two
   encounters drawn from the roster without the capital battle. The next wave
   arrives when the last is destroyed, disabled or fled. The flagship and its
   escorts hold back until the third wave is gone.
3. **The flagship.** Archie's own capital ([Ships](ships.md#archies-flagship))
   then attacks. It can be beaten only by disabling it: its hull never drops below
   1 HP. Disabled, it shows the red "Disabled" banner, and Ada salvages the last
   holodisk from it. Archie surrenders the disk, Astra's memory is complete, and
   at Ada's request Astra shows him her whole map: galaxies past galaxies, without
   end. He relents and stays in Phantom to help the Blurbs mend the docks his
   blockades broke.

If the shield fails during the fleet battle or the flagship fight, the emergency
jump works as usual: broken blockades and freed settlements stay, and the battle
restarts in full on the next approach. Allies help but are never required; the
battle is tuned to be winnable with none. Objectives are in
[the player copy](player-copy.md#chapter-six-the-garden-party).

Once the chapter is complete, Phantom's drones stand down: it places no new
encounters, and Archie helps mend the Blurbs' docks. Drones in the other
galaxies are beyond his signal and keep their last orders, so their space stays
as dangerous as before. The salvaged flagship stays at the waypoint as a passable
hulk with its lights on. The Blurb settlements' docks show cracks from the blockades
until the chapter is complete, then show mended, Archie's work. The "dark nebula"
in Dollop's line is flavour: smoke banks near the waypoint, scenery only.

## Flight and combat

- Isometric sprite-based presentation with independently controlled movement and aim.
- Ship physics, including Ada's acceleration, braking, momentum and turn smoothing,
  are defined per ship type in data; see [Ships](ships.md). Ada's ship has
  noticeable momentum and swings wide on sharp turns.
- Left joystick moves with analog speed and a short noticeable drag to reach full
  speed. Provisional movement reach is 40 logical pixels with a 2.4 logical pixel
  deadzone, scaling with the view like every layout value; the long reach gives
  finer low-speed control, and from the ring's default position it fits inside
  the game area. The drawn knob stays inside the ring, as in
  Chibi. Each joystick draws a line from its origin to the thumb's actual position,
  extending past the ring however far the thumb travels, so the line shows the
  drag. Stick placement ignores the device-safe insets: each joystick's drawn
  ring sits 80 logical pixels from the screen's outer side edge and 50 above the
  screen's bottom, mirrored as in Chibi. A ring moves inward only as far as
  needed to stay at least 8 logical pixels inside the game area's edge, so it
  never appears to touch the side bars; the 8 applies only when needed. Use is
  Chibi's touch disc, placed beside the aim stick as in Chibi, and keeps its
  offset from the aim stick. The shield pill's drawn bottom sits 12 logical
  pixels above the game area's bottom, as the pause button sits 12 below its top,
  not shared with the sticks. The move ring lights its left or right marker only when the
  move direction is within 67.5 degrees of that side.
- Speed rises steeply with stick deflection so the difference is clearly
  noticeable: small deflections give slow, controlled maneuvering and full
  deflection gives maximum speed. With deflection `m` from 0 just past the deadzone
  to 1 at full reach, target speed is
  `maxSpeed * (minSpeedFraction + (1 - minSpeedFraction) * m ^ speedCurveExponent)`.
  Provisional values are `minSpeedFraction` 0.04 and `speedCurveExponent` 2.5:
  at the base engine's 175, about 7 world units per second just past the
  deadzone, 12 at a quarter, 37 at half, 89 at three quarters and 175 at full. Keyboard movement is full deflection.
- The ship's thrust jets scale with current speed as a fraction of maximum speed,
  not with stick deflection. Their colour follows engine tuning: pale blue at
  base, orange at Engine level 2 and purple at level 3, on every paint scheme.
- Right joystick aims and fires continuously while deflected. The ship turns toward
  the aim with damping. Shots follow the ship's current facing and start
  immediately at the normal cadence.
- Ada's maximum movement speed is provisionally 175 world units per second,
  200 and 225 at engine levels 2 and 3.
- The space screen shows only essentials: the joysticks, weapon icons, the
  status pill (Stardust and what Ada carries), the shield bar and a pause
  button. There is no travel or destinations panel and
  no settings gear in space.
- Destinations Ada visits (stations, the mining hub, outposts, settlements and
  quest points of interest) are drawn at 1.5 times their earlier size, the mining
  hub at 1.25 times, with a 2 pixel ink outline on light fields so they stand out
  from the background. While Ada is within Talk range of one, a small callout
  above it shows its Use action's symbol; it is hidden otherwise. At a station
  or the mining hub, an action due there comes before Dock, and Dock shows once
  it is done: Deliver for a carried item bound there, Deposit while Ada carries
  ore, or a story Talk while a story line there is unheard. With nothing due,
  Use offers Dock. While a Cartwheel story scene plays near the hub, Dock waits
  until the scene and its line have ended.
- Space shows no in-world name labels. Each named destination has a distinct
  look by role, the current objective's destination is marked by the direction
  indicator, and the Use disc's action symbol and the conversation name tab identify
  speakers up close.
- Talk range is 160 world units, centre to centre: from Ada's position to the
  object's, with no hull or drawn-size radius. It is one value for Use at a
  settlement, outpost, station or the hub, Dock included, and for Salvage on a
  disabled heavy; when several are in range, the nearest wins, and a destination
  on a blocked route is excluded. Other ranges are their own values: tow attach
  120, and station discovery uses its own 320.
- Pause is visible at the top left during gameplay, including story and dialogue,
  except on the title screen and during initial loading. Settings opens from Pause
  or Menu. Pause opens a card titled "Paused" over the dimmed game without
  advancing story or dialogue, with "Map", "Quests", "Settings" and "Ship" in
  that order, then "Back to title", then primary "Resume". Map stays hidden before it unlocks
  and during mandatory story beats or unresolved material choices. "Resume" remains primary and focused when the card opens. Ship opens a card titled "Ship" with Back and X returning to Pause.
  Cargo, Equipment and Weapons content columns are equal width, excluding shared
  divider/gap tracks; content does not size a column. A sole visible footer
  button is centered. Equipment lists Engine, Shield, Tractor beam and Paint;
  Weapons lists owned weapons and their actual ammunition. Preserve current
  compact upgraded-level names and accessible full level descriptions.
  Cargo always includes Carrying and Towing independently: all actual story,
  job and activity items appear, or "Carrying: Nothing"; towing shows the craft
  or "Towing: Nothing". Towing never hides cargo. Each carried item with an
  explicit live quest identity opens its matching details and returns to Ship;
  fallback nonquest details do not invent a quest link. Empty rows are not
  interactive. Existing icons/detail routing remain. This presentation adds
  no cargo concurrency, capacity, reward or HUD rules. Source is integrated;
  source presence alone is not rendered or device acceptance.
  The local map's header shows the galaxy name with its landmark pips and
  "{percent}% mapped" below them, then a "Quests" button and "Galaxies".
  Quests opens an icon-and-summary list of all accepted story quests, station
  jobs and activities, grouped as "Story quests" and "Station jobs". A row opens
  one full-page detail with its complete approved description, actual next step,
  known From/To locations, the canonical final payout derived once from the
  saved base reward or explicit story outcome, and actual
  progress. A story without currency or an explicit outcome shows "Story progress".
  Earth’s Map opens the existing galaxy map; flight’s Map opens the local map.
  Unknown locations show "Explore to locate" without hidden identity or coordinates.
  Known locations in the current galaxy can be selected on the map.
  List detail uses primary "Back" to return to its list. A carried quest item's
  HUD icon opens its detail directly, with secondary "All quests" and primary
  "Close" to resume gameplay. All quests deliberately opens the list. A list
  opened from the local map or Paused returns there with primary "Back"; a list
  opened from gameplay returns to gameplay with primary "Close". The close
  X, Escape and back always perform the same action as the current primary footer
  button. Detail never paginates, scrolls or truncates; only the list paginates.
  The local map has three tools, Zoom out, Zoom in and Center on Ada, and no
  close X; the primary button in its footer dismisses it, reading "Back" when the
  map was opened from Paused and "Close" otherwise.
  The local map shows the current galaxy: Ada's position, discovered destinations and
  stations, charted landmarks, the current objective's destination once mapped,
  a known holodisk waypoint until its holodisk is recovered, and how much of the
  galaxy is mapped. The mapped percentage counts the destinations, stations and
  landmarks inside the galaxy's charting circle, 25000 world units around its
  origin: those discovered or charted over the total, rounded down. An outline-only
  dashed circle marks this central progress area on the full-screen local map. It
  stays centered on the galaxy origin and follows map projection, pan and zoom;
  it is not a gameplay boundary. Stations
  beyond the circle still show on the Map once discovered but do not count.
  Landmarks extend independently to 100000 world units, targeting roughly 200
  safely placed sites per galaxy while preserving the original 12 identities and
  positions. Distant landmarks remain visible, scannable, chartable and mapped;
  the galactic-center mapping-progress and survey-area denominator stays 25000.
  Landmark labels use the stable shared [Quests](quests.md#landmarks) contract.
  Undiscovered places never appear. Map places keep at least
  1020 world units apart, so each stays separate at full zoom; placement
  enforces this for every mapped place, outposts and the waypoint included, and
  story destinations keep at least 1200 apart. Story characters
  waiting at a station, such as Cartwheel's miner and visitors, are not map
  places; the station stands for them. Only chunks inside the charting circle
  enter the explored record. The
  explored area persists per galaxy (see
  [What each event keeps](#what-each-event-keeps)). Choosing
  a discovered destination or station offers "Travel here", which teleports there.
  Travel here is unavailable while Ada tows a craft or carries a job or activity
  item, and refuses with the shared refusal feedback. The local
  map also has "Galaxies", a labelled secondary button on its top row beside
  the header, on every galaxy's local map, which opens the galaxy map with no
  confirm, as for Travel here. Unlike Travel here it stays available while
  towing or carrying a job or activity item; leaving the galaxy returns the
  towed craft to where it was stranded. Leaving by Earth or Jump costs nothing.
  Back to title keeps the flight and opens the start screen; Continue resumes it
  exactly, danger and tow included, as after closing the app. It stays
  available in danger. While Ada is in danger, Travel
  here and Galaxies stay visible but disabled, refuse with the shared refusal feedback, and the local map
  shows "Unavailable while you are in danger." The close X, an outside tap, back
  and Escape resume. Settings opened from the pause card returns to it when closed.
  Settings is nested in Pause or Menu, with no standalone Settings icon. Pause is
  available only during active pausable gameplay, determined from model state and
  its guards. Other contexts use the three-line Menu in the same entry position,
  including Start, maps and nonpausable story, with the contents and order in
  [Start, Home and Space](#start-home-and-space). The
  title remains centered and unobscured. Active gameplay uses the Pause order
  above, with primary Resume. Existing map navigation is
  retained under Menu. Closing nested Settings or Achievements restores the same
  Menu and parent context without advancing story or changing choices. The start
  card retains Start, or Continue and Restart. No mute toggle is added to Ada.
- Weapon and pause controls use icons inspired by Chibi, with accessible labels.
- As in Chibi, wherever player text names an on-screen control (the left stick,
  the right stick, Use), that control's icon follows its name inline at text
  height. The control icons are 16 pixel simplified drawings of the move stick,
  the aim stick and the Use disc; the move stick's side chevrons tell it from
  the aim stick. The icon is decorative; the name stays for screen readers. This
  covers the first-flight lessons and the landing page's mobile line. Keyboard
  text stays words.
- [Shared product consistency policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#product-consistency) applies.
  Every close X uses the same shared close icon, so all close controls look
  the same.
- [Shared settings policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#settings) applies. Ada's rows, in order:
  - Move controls and Aim controls, as in Chibi: each shows or hides one on-screen
    joystick (left and right). Each is shown unless the player hides it. Hiding a
    control hides only its drawing; its input still works. Each row has the note
    "Touch still works when hidden". As in Chibi, on-screen
    joysticks appear only when the primary pointer is coarse (a touch screen).
  - Each row has its icon and a switch, as in Archie and Chibi. The Move controls
    and Aim controls icons are the move and aim stick control icons.
  - Sound, as in Archie: a switch, on when sound is enabled, with the note "Controls
    gameplay sound effects."
  - Reduced motion, as in Archie: a switch, on when motion is reduced, with the
    note "Reduces animation and disables screen shake and flashes." A player's first setting on a device follows the
    device's reduced-motion preference.
  - Install, as in Archie: shown only while installation is available and the game
    is not installed, with the note "Full screen, offline" and an Install button.
    The row and the landing page's Install button show in every browser that is
    not running the installed app. The button opens the browser's install prompt
    when it holds one; otherwise it shows that browser's steps. Strings are under
    "Install steps" in [the player copy](player-copy.md#install-steps).
- Every setting persists on that device. Settings shows no keyboard binding text,
  and keyboard input is unchanged.
- [Shared update policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#updates) governs staging and activation.
  Ada starts offline from a known complete cached build. A first visit without a
  complete cache may bootstrap from the network; ordinary cached launches never
  wait for a mandatory new-version download.
  Updates download in the background and stage apart from the running build.
  At launch, a complete staged build activates silently, before game
  construction and save access, with no prompt. During a session, once staging
  completes, a compact modal titled "Update available" shows wherever the player
  is and pauses play, with secondary "Cancel", primary "Update now", the
  ordinary close X and no body text. Update now saves, then switches to the new
  build and reloads once. Cancel, the close X, an outside tap, Escape and back
  dismiss it and continue play on the running build; the next launch activates
  the staged build silently. A session never switches builds without Update now,
  including on Back to title or a visibility resume. Ada retains the [canonical newer-save recovery exception](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#updates).
  Start, incompatible save loading and all save writes stay fenced until the new
  document rechecks compatibility. The save remains untouched while recovery is
  pending.
- Back, as in Chibi: it closes the innermost open card (install steps, Settings,
  the cheats card, the conversation card or shop) or cancels the update offer; during
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
- Laser fire has unlimited ammunition; every other weapon has its own ammunition,
  bought at shops or found as ammo pack drops (see
  [Economy](economy.md#ammunition)).
- Weapon order (Laser, Multi-Laser, Rapid Missile, Heavy Missile, Scattershot,
  Phaser) is also the order used by inventory and shops. Each weapon has its own
  damage, rate, spread and reach; the canonical values below govern combat.
- Laser is the starter weapon. The other weapons are Multi-Laser, Rapid
  Missile, Heavy Missile, Scattershot and Phaser, bought at station shops or found as rare drops, one
  more unlocked in each galaxy along the route; see
  [Economy](economy.md#weapon-unlocks). The shared upgrade pickup, presented like Chibi's
  power-ups, gives its upgrade on collection (see
  [Economy](economy.md#earning-stardust)). A new weapon from it is equipped at
  once unless the switch wait is running, when it is added without equipping;
  other owned weapons are kept.
- Every weapon and the shield have three levels. The shield's capacity is 10,
  15 and 20. Weapons grow only along these dimensions:
  - Laser: damage, fire rate and bolt speed: every 0.30, 0.25, 0.20 s, dealing 1,
    1.25 and 1.5 times Laser damage.
  - Multi-Laser: a fan of bolts evenly spaced across a fixed 16 degrees, 3 at
    level 1 (-8, 0 and 8 degrees), then 4, then 5, every 0.30 s. Each bolt deals a fixed 0.7 times Laser damage;
    levels add only bolts. Its bolts are slower than Laser's at the same level.
  - Rapid Missile: quick straight missiles with a small blast (radius 30) and a fixed
    1.5 times Laser damage; levels grow its fire rate (every 0.30, 0.25, 0.20 s)
    and missile speed.
  - Heavy Missile: one slow straight missile with a large blast (radius 60),
    every 2.0 s at every level; levels grow only its damage (8, 12, 16 times
    Laser damage). Rapid Missile remains faster at every level. Heavy Missile
    deals 4, 6 and 8 Laser damage per second at levels 1, 2 and 3.
  - Scattershot: the close-range weapon, a shotgun of visual dots across -30 to
    30 degrees, 7 at level 1, then 9, then 11, one volley every 1.0 s. Its range
    is a fixed 100 world units on every device, and levels add dots. Up
    close every dot hits; toward its range the spread covers more area but fewer
    dots hit. Each pellet deals 0.8, 1 and 1.2 times Laser damage at levels 1,
    2 and 3. Dots do not apply damage over time.
  - Phaser: the long-range weapon, a hitscan beam. Each shot hits instantly
    along the aim to the fire-time rounded coverage boundary at every level,
    stopping at the first enemy or obstacle it meets. It then shows briefly as a
    visible beam that stays attached to the ship that fired it: from its fire
    origin, along the ship's current aim, at the length it fired with. Only the visible
    beam follows the ship; the hit stays where it resolved. It fires
    once every 1.0 s and deals 13/3 times Laser damage to the enemy it hits;
    levels grow only its damage (13/3, 6.5, 9.75).
- Rapid and Heavy Missiles have a full collision width of 12 world units
  (radius 6). Phaser also has a full hit width of 12 world units (radius 6),
  with its visible beam scaled from that same canonical width.
- A missile, Ada's or an enemy's, explodes once when it touches a ship it can hit,
  a rock, resource rock, debris or an armed mine, or at the end of its reach.
  Stations and landmarks do not consume projectiles. The primary target takes
  direct damage once; the blast does not apply the same damage to it again.
- Projectile impact feedback and missile blast origins use the drawn contact
  edge on the facing side of the target. Whole-object destruction bursts remain
  at the object's pivot. A blast is a circle on screen, radius 30 for Rapid
  Missile and 60 for Heavy Missile in the same units as the drawn ships. Every
  target whose drawn shape, hull or turrets, overlaps the circle, at its edge or
  inside, takes the missile's full damage; where a turret is in reach, the
  nearest turret takes it, as with other hits. Mines inside the circle are
  destroyed. A friendly blast damages enemies, never Ada. An enemy missile's
  blast damages Ada, never enemies.
- Damage and hit points share one unit: 1 damage removes 1 HP, and a level 1
  Laser shot deals 1 damage. Enemies fire the same six weapons at their
  equipped weapon level, with that level's damage, blast, spread and reach,
  plus three enemy-only weapons at level 1. Equipped levels, fire-rate shares
  and projectile speeds are in [Ships](ships.md#enemy-weapons); enemy
  projectiles fly at 0.6 times Ada's level 1 speed for the weapon. An enemy
  fires only while it is inside the visible game area. An enemy Heavy Missile
  hit removes 8, 12 or 16 HP at levels 1, 2 and 3, so it fires rarely.
- Laser bolts travel at 500, 600 and 700 world units per second at weapon
  levels 1, 2 and 3; Multi-Laser bolts at 400, 500 and 600. Laser and Multi-Laser bolts and Phaser
  beams, Ada's and enemies' alike, use the same fire-time rounded coverage
  envelope centred on the firing ship, half-width 380 and half-height 260 at the
  720 x 360 base view, measured from the true muzzle. The canonical shape scales
  with the game area; its centre and heading range are captured once when
  firing. Bolt lifetime follows weapon speed. Rapid Missile flies at 500, 600 and
  700, and Heavy Missile at a fixed 400; both missiles reach a fixed 220 at every
  level, so a missile that hits nothing explodes on screen. Enemy missiles share
  this reach. Scattershot dots fly at 600.
  None depends on her engine level.
- Ada's shots and Phaser beams leave from her ship's nose, and weapon ranges are
  measured from there. Every visible Phaser beam, Ada's or an enemy's, stays on
  its firing ship's fire origin (Ada's nose, an enemy's muzzle) and current aim
  while it shows. Enemy shots leave from the drawn muzzle of the gun's
  current aim frame wherever the art defines muzzles, and from the model's fire
  origin otherwise; shot direction always follows the continuous aim.
- At launch, a traveling projectile's world velocity, Ada's or an enemy's
  shared weapon alike, is its weapon heading times weapon speed plus the firing
  ship's current flight velocity. This velocity is captured once per shot,
  including delayed volley shots: later ship turns, acceleration and drag do not
  affect the released projectile. Lifetime and range fade use weapon speed
  alone, excluding inherited velocity. The rounded coverage boundary is captured
  at fire time without changing its dimensions. Instant Phaser beams have no
  traveling velocity. Allied fire and the enemy-only ring burst, mine layer and
  charged lance do not inherit launch velocity.
- Fan angles are measured in the projected aim plane. Rotate there before
  unprojecting each shot direction; preserve weapon speed before adding launch velocity.
- Each scattershot dot has 100 weapon-relative world units of travel along its rotated heading on
  every device, fades after 65% of that range and vanishes at the limit.
- Weapon intervals, speeds, damage, angles, reach and fade are provisional
  catalog tuning; damage is in multiples of a level 1 Laser shot. No homing, piercing or reloading is added.
- Top-right weapon icons select Laser fire or an owned weapon, in the order Laser,
  Multi-Laser, Rapid Missile, Heavy Missile, Scattershot, Phaser, the order
  weapons take everywhere they are listed (shop weapon and ammunition rows and
  the Ship card); only owned
  weapons show an icon. Each icon shows its weapon's level: at level 1 it looks
  as it does today; at levels 2 and 3 its ring turns orange, then purple, and one
  to three pips under the icon give the level, so it never relies on colour alone.
  Orange and purple mark level 2 and level 3 the same way on the jets. Switching preserves
  ownership of the other weapons. Ada can switch at any time, including in combat;
  after a switch the next switch waits 1 second (provisional).
- Pressing and holding a weapon icon pauses play and opens that weapon's detail
  card instead of selecting it; shop weapon and upgrade rows open their cards
  the same way (see [Economy](economy.md#detail-cards)).
- Enemy behavior uses data-defined archetypes and reusable behavior rules for
  solo ships, packs, frigates and capital ships. Sunflower's roster is in
  [Ships](ships.md).
- Enemy scenery avoidance scales its look-ahead time and corresponding query
  reach by 1.25, up from 1. The unscaled time is the greater of the turn and
  acceleration times plus the braking time. The steering grid changes from 16
  to 12 directions. At each clearance, avoidance checks up to five courses
  (straight and 30 or 60 degrees to either side), down from seven. Quest guard
  home placement keeps its 16-direction grid. Prediction takes 12 samples,
  starting with the actual first physics step and spacing the rest evenly across
  the remaining horizon. Previously the count was at least six, increased to
  cover the horizon at 60 Hz, with an extra sample for a shorter first step.
  Clearances remain 80 world units for normal steering and 40 for passages.
  Physical contact uses the existing collision rules.
- Admiral Archie's uncrewed drone fleet is the recurring hostile faction in every
  galaxy, searching for the same holodisks.
- Defeated enemy ships are destroyed and drop Stardust, the game's currency.
- One rechargeable shield of 10 HP, 15 and 20 at shield levels 2 and 3. No hull
  resource.
- Recharge starts 30 seconds after Ada last took damage, at every shield level,
  and refills from empty to full in 60 seconds at base. Shield levels 2 and 3
  shorten the full refill to 45, then 30 seconds. Only damage restarts the
  delay: enemies nearby, chasing or firing and missing do not hold it back, and
  enemies keep their damage.
- Recharge burns carried ore: 1 ore per 1% of shield capacity restored, so 10
  ore per 10% and 100 for a full refill at every Shield level. With no ore
  aboard, the shield recharges free only up to 10% of capacity; above that it
  stops until Ada has ore. Ore rocks occur in every galaxy, Cartwheel richest,
  and Cartwheel's hub deposits remain for the story and the Mining contract.
  Stardust is never at risk. See [Economy](economy.md#earning-stardust).
- Ada is in battle while an enemy that is chasing or attacking her is inside the
  battle square: centred on Ada, reaching half the game area's width plus 64
  world units along each axis (424 on the 720-wide view). Idle enemies,
  retaliators not yet hit, fleeing or returning enemies and disabled heavies do
  not count. Ada is in danger while she is in battle or while an enemy shot is in
  flight inside the battle square.
  Danger disables Travel here and Galaxies; Back to title stays available.
- No post-hit invulnerability or protection window.
- Shield depletion makes Astra quantum jump Ada home to recharge overnight. Only the
  flight and half its undeposited ore are lost, and the jump-home page says so;
  weapons, levels, Stardust, purchases and story progress persist, and the next
  flight generates a new layout. See [Economy](economy.md) and
  [What each event keeps](#what-each-event-keeps).
- The shield is a bar at the bottom centre of the game area, between the sticks, with a shield
  icon, in a pill whose visible gaps are equal as drawn: 8 logical pixels from
  the pill's edge to the drawn icon, 6 from the icon to the bar and 8 from the
  bar to the pill's edge. Its length follows shield capacity: 120 logical pixels at base, 180 at
  Shield level 2 and 240 at level 3, so each upgrade visibly lengthens it. The bar is blue, turning red when the shield is low (below
  25%) or empty, and shows hits, the recharge delay and regeneration. Low shield
  never relies on color alone: the bar also pulses, held steady under reduced
  motion, and Astra says "Shield low!". Nothing pulses or circles around Ada's
  ship while the shield recharges; the bar is the only recharge cue.
- Tapping anywhere on the shield pill opens a shared-style shield detail card
  and pauses flight. Its header shows the canonical shield icon and "Shield",
  with no suffix at level 1 and `[2]` or `[3]` at upgraded levels. Show live
  current and maximum shield HP and the recharge/depletion copy in
  [Player copy](player-copy.md). The delay comes from the current ship's
  `shieldRechargeDelay`; the free percentage comes from
  `ECONOMY.shieldRecharge.freeCapacity` times 100 (currently 30 seconds and 10%).
  Preserve existing HP presentation and rounding. The sole primary Close button
  is centered. Close, the close X, Escape and other supported dismissals return
  to the same game or originating view, following other details' pause and
  resume lifecycle. Opening details does not change recharge or depletion rules.
- While the recharge delay runs, a thin strip, about 2 logical pixels, along the
  inside of the bar's bottom edge fills left to right across the bar's full
  length, reaching full when recharge starts. Damage empties it and starts it
  again. It is hidden while the shield is full or regenerating, is a steady
  fill that reduced motion keeps, and sits inside the light-field outline.
- The status pill at the top left, beside the pause button, shows the Stardust
  count. While Ada carries ore, a divider and an ore icon with its count follow;
  while she carries a job or story item or tows a craft, a divider and its icon
  follow last. Each segment leaves when empty. Stardust and ore gains show "+N"
  ticks just below their counts, with the gain in the same at most five
  character format as the count ("+44.4k"). Ore spent on shield recharge shows
  a "−10" tick under the ore count for each 10 ore paid, mirroring the gain
  ticks.
- Item notices: when Ada gains anything other than Stardust or ore (a holodisk,
  a story item, a lost item, a job item, anything from an upgrade drop, or a
  towed craft), a small notice shows just below the status
  pill, then moves to where the gain shows and vanishes: the carried-item pill
  segment for story, lost and job items and towed craft, the weapon icons for a
  weapon, weapon level or ammunition, or the shield bar for a Shield level. A
  holodisk, an Engine or Tractor beam level and a paint scheme have no HUD place,
  so their notices fade in place. A new weapon's icon appears at pickup and the notice flies to it. Every
  notice reads "+ {item}"; an upgrade drop's notice names what it gave (see
  [Economy](economy.md#earning-stardust)). Item names drop
  their article and start with a capital ("Spare parts", "Message"). Gains close
  together queue, one notice at a time; identical gains merge into one notice
  ("+ Rapid Missile ammo ×2"), and each waiting notice holds half as long while
  others wait. A notice may pass briefly over the conversation box's top edge
  and name tab in flight. Item notices add to, and never replace, the notices in
  the conversation box's slot, such as "Job complete" and "Out of ammo.". Under
  reduced motion a notice fades in place.
- Game and save notices, such as the save-failure notice, show briefly in the
  conversation box's slot and style, without a portrait. A notice shows at once,
  ahead of ordinary conversation lines, which resume after it.
- One forgiving difficulty, rising along the route (see
  [Ships](ships.md#difficulty)); no overall exploration timer.
- Objects in flight meet where they are drawn, on each one's current frame's
  silhouette: every hit, bounce, pickup and tow contact between Ada's
  ship, enemies and their heavy parts, stations, outposts, asteroids
  and resource rocks, debris, hazards, wrecks, story ships, towed craft, pickups
  and shots. These objects are passable to Ada:
  stations, outposts and destinations, story ships and buoys, towed
  craft, whales and the calf, wrecks, the holodisk and landmarks; Ada is drawn in
  front of any of them while she overlaps it, so she is never hidden. Nothing
  else passes behind another object on screen, and placement and spawning keep drawn objects from
  overlapping on screen. A clearance stated as an object's radius plus a margin
  uses its silhouette radius, the greatest distance from its pivot to its drawn
  silhouette over all its frames, so a turning or spinning object stays clear
  on every frame; margins and centre-to-centre spacings stay as stated. Pickups
  are deliberately forgiving: every pickup (Stardust, ore nugget, discovery
  cache, weapon, ammo pack, a holodisk floating in space and a hunt job's lost item)
  follows one rule: it collects within 20 world units of Ada's drawn ship, about
  half the ship's length, measured to its own drawn outline, and zips into the
  ship over 0.15 seconds as it collects. The tractor beam pulls every pickup the
  same way (see [Economy](economy.md#earning-stardust)).
- Ada's ship bounces off asteroids and other ordinary scenery with a little recoil
  and keeps moving; it never sticks. Every bump against scenery (asteroids,
  resource rocks, debris and traveling debris) deals 1 damage, at most once per
  0.5 seconds, and restarts the shield's recharge delay. A gate rim in
  Needle is the one bump without damage. Attacks and marked hazards also damage
  the shield.
- Friendly destinations, dialogue locations and teleport arrivals are always safe. No
  encounter is placed within 2000 world units of a flight's start or any quantum
  jump arrival, so every launch begins calm.
- Ambient encounter frequency and the three capped fresh-exploration budget
  stages in every galaxy follow [Ships](ships.md#ambient-admission). Fresh flights
  reset the stage; roster and type gates remain galaxy-specific. This density
  tuning does not change enemy HP, fire rate, speed or asteroid density.

## Interactions and navigation

Use is one contextual control, Chibi's touch disc beside the aim stick, visible
only when an interaction is available. Available real actions, including
repeatable Dock on every visit, precede Quest details. Details is a fallback
only when no real action remains on a nearby quest-linked object. Use retains
its existing proximity/input guards and centered actual quest icon. World
objects are not click/tap inspection targets; station quests and All quests stay
unchanged. Return paths follow
[Scan feedback](scan-feedback.md#quest-details-through-contextual-use). It shows the action's symbol with no text;
the action's name is its accessible name. On desktop the disc is hidden, as in
Chibi, and the Use key still acts. Where the disc's press area overlaps the
conversation box, the box takes the press. Resources collect on contact. Mining cargo has no capacity limit.

Functional landmarks remain recognizable foreground objects even though Ada
can fly through them. Pure background decoration is muted and has no quest,
reward or collision role. Within the existing station Talk range (160 world
units), an uncharted landmark offers Use (Scan) and the same nearby Use callout
pattern as stations. Astra's instruction is "Fly closer, then press {useIcon} to
scan it." Render `{useIcon}` as the actual inline Use control glyph, never as
literal placeholder text or an emoji. First actual on-screen identification of
an uncharted landmark queues this in-flight Astra tutorial once per save. If
Penny's notice for that exact landmark is already active, the instruction follows
or appends through the normal conversation flow without a duplicate; direct
identification without Penny provides the first-time fallback. Normal cover and
dialogue guards apply, and the tutorial is heard only when visibly shown.
Sensing, seeing and tutorial playback do not chart the landmark. Scan needs no
additional confirmation. Explicit Scan alone charts the landmark
and commits its survey and achievement progress once. Flying over it, seeing it
on screen or sensing it with Penny does not chart it or grant a discovery
reward. An already charted landmark cannot pay again. The Use target, callout,
map and direction indicator refer to the same landmark and charted state.

Required events and undiscovered quest destinations spawn ahead of Ada in chunks
she approaches. Tune fresh-chunk exploration distance between encounters so continued
exploration reliably encounters required events regardless of direction. Standing
still, teleporting and revisiting chunks do not advance fresh-exploration pacing. Chunk generation must place
content ahead of arrival, not visibly spawn it on top of the player.

Discovered destinations become teleport options, including the whale. Travel is
available only outside danger (defined under [Flight and combat](#flight-and-combat))
and while Ada tows nothing and carries no job or activity item. Ada can return to Earth or jump to another unlocked galaxy voluntarily through
the local map's Galaxies.
Teleporting cargo to the mining hub is allowed outside danger: mining's challenge
is finding and extracting resources, not a mandatory return flight.

Quest deliveries use a separate carried-item state, independent of mining cargo.
Sources provide replacement quest items while their delivery remains unfinished.
Completed deliveries remain completed.

## Persistence and regeneration

Each galaxy keeps its geography for the playthrough. Initialize its procedural
seed on first entry and reuse it after Earth, shield failure and travel to another
galaxy. Discovered locations, station coordinates, explored paths, map completion
and story progress remain. Restart clears the playthrough's geography; first entry
in the new game receives a fresh seed.

Fresh entry creates a separate encounter identity and resets the enemy population,
including heavy ships, hostile stations, escorts, damage, casualties, wreck outcomes
and enemy retention records. Required guards still follow the current story gates;
resolved story encounters do not return. Within a flight, paging and Continue retain
the existing enemy state and equipped weapon levels. Uncollected pickups remain
run-local as specified below.

Saves reset before version 1. While the game's version is below 1, a stored save
that is invalid, incompatible or ambiguous resets to a new game through the
new-game path; the replaced data is kept as the backup save. No other save
migrations are added before version 1. Font and network loading failures leave
the save untouched.

When any required asset fails to load, the game shows the shared game-kit
loading-failure presentation; its Retry label uses the same text colour as the
Start screen's primary Start button.

Closing the game or Back to title is not leaving the galaxy: resume the same
flight with exact important state and current nearby space, cargo, owned and
selected weapons and shield, including enemy clocks, burst progress and phases.
Continue neither initializes a new encounter identity nor resets the flight.
Disposed ordinary history is not part of that
exact-resume guarantee. Held story pages retain their page, question history,
Previous trail and elapsed sleep time as specified in [Earth scenes](#earth-scenes).
Save durable milestones as they occur.

### What each event keeps

Earth means going home by choice from the galaxy map; Jump means jumping to
another galaxy from it. Restart also clears story progress, unlocked galaxies,
holodisks, seen conversations and greetings.

| State                               | Closing the app | Back to title | Earth                           | Shield-failure jump             | Jump                            | Restart |
| ----------------------------------- | --------------- | ------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------- |
| Galaxy geography                    | Resumes         | Resumes       | Kept                            | Kept                            | Kept                            | Cleared |
| Enemy population and combat state   | Resumes         | Resumes       | Reset on fresh entry            | Reset on fresh entry            | Reset on fresh entry            | Cleared |
| Stardust                            | Kept            | Kept          | Kept                            | Kept                            | Kept                            | Cleared |
| Owned weapons, upgrades, ammunition | Kept            | Kept          | Kept                            | Kept                            | Kept                            | Cleared |
| Held job and its carried item       | Resumes         | Resumes       | Kept with the job in its galaxy | Kept with the job in its galaxy | Kept with the job in its galaxy | Cleared |
| Carried story item                  | Resumes         | Resumes       | Kept with the story             | Kept with the story             | Kept with the story             | Cleared |
| Undeposited ore                     | Resumes         | Resumes       | Kept                            | Half lost                       | Kept                            | Cleared |
| Uncollected pickups                 | Resumes         | Resumes       | Lost                            | Lost                            | Lost                            | Cleared |
| A tow                               | Resumes         | Resumes       | Craft returns to its start      | Craft returns to its start      | Craft returns to its start      | Cleared |
| The calf guide                      | Resumes         | Resumes       | Calf returns to its start       | Calf returns to its start       | Calf returns to its start       | Cleared |
| Pip's courier run                   | Resumes         | Resumes       | Pip returns to his start        | Pip returns to his start        | Pip returns to his start        | Cleared |
| Explored area and charted landmarks | Kept            | Kept          | Kept                            | Kept                            | Kept                            | Cleared |
| Project funding                     | Kept            | Kept          | Kept                            | Kept                            | Kept                            | Cleared |
| Achievements and lifetime progress  | Kept            | Kept          | Kept                            | Kept                            | Kept                            | Kept    |
| Device settings                     | Kept            | Kept          | Kept                            | Kept                            | Kept                            | Kept    |

A tow's craft returns to where it was stranded, still marked; the calf and Pip
return to their starts with the activity still held. Undeposited ore is cargo
not yet deposited at the hub. A shield-failure jump loses half of it, the
smaller half on an odd load, so 11 ore keeps 6 and a single ore is kept; the
jump-home page tells the player when ore was lost. Kept ore stays aboard and
travels with Ada to every galaxy and home. Stardust is never lost.

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

Within one flight, retain frigates and capital ships independently of disposable
chunks, including mutable hardpoints, AI state and destroyed-ship tombstones.
Interacted NPC state, story, quests, routes and destinations also persist
independently of those chunks. Important guards must not reroll or disappear on
paging or Continue to bypass a required fight. Fresh entry resets enemy retention
while preserving the galaxy's geography and story gates.

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
left, Astra's, Penny's and the Admiral's on the right. Each line wraps to at most
two lines. This speech box and notices never pause play, and the pause button
and weapon icons stay live while it shows; Talk conversations and cards do
pause play. Its background is an ink #181425 panel at 0.65 alpha, the opacity of every panel, so it
stays readable over the brightest space signals; text, tab and portrait stay
opaque. Each line shows for 5 seconds plus 50 ms per character of the line, or
until the box (tab included) is tapped. Tapping the box dismisses the whole
conversation and skips its remaining lines, for every in-flight line: Ada's,
Astra's and Penny's lines, drone warnings and the Admiral's broadcasts. The box
takes the press even where it overlaps the Use disc. First-flight lessons follow
the same timing. Tapping a notice dismisses it. A conversation has one to three lines, and only one shows at
a time, with a cooldown between ordinary conversations. Hints are always on.

Conversations come from data, each with a trigger and a priority: warnings
(including the Admiral's broadcasts), then notices, then first-flight lessons, then
Penny, then lore. A higher priority interrupts a lower one, which resumes after it
if still relevant. A queued conversation re-checks its trigger when its turn
comes and is dropped if the trigger no longer holds, such as Penny's lost-item
line once Ada has left the item's range.

Quiet lines and broadcasts must also pass data-defined chronology eligibility
using the current recovered-disk count and chapter completion state. Recheck
before selection and display, while queued, on interrupted resumption and every
line advance; do not expose a stale continuation after a state change. Skip an
ineligible quiet candidate and continue to another eligible unseen line. An
unheard ineligible line is not marked heard. Preserve saved one-time flags for
lines already shown, and keep memory and broadcast order tied to recovered
disk count rather than galaxy number.

- Cartwheel `quiet:2:whole` and Phantom `quiet:6:whole` require at most 5 disks.
- Andromeda `quiet:5:disks` requires at least 3 disks, when Astra has remembered
  scattering them.
- Phantom `arrival:6` and `quiet:6:together` require its space quest to be
  incomplete; they must not anticipate the confrontation after the finale.
- A queued or resumed broadcast still requires exactly its authored held-disk
  count and any galaxy restriction, as well as its drone-danger trigger.

Triggers include the first flight's
lessons (each shown once, skipped when the player has already done the action),
a first arrival in a galaxy, meeting each alien group, a newly mapped destination
or station, a return to a mapped station (once per station each flight), a
frigate or capital ship sighting, a low shield (once per fight), drones
arriving (only when drones are near; damage from scenery bumps or hazards alone never
plays the drone warning), and quiet stretches without combat, which draw unseen lore from the
galaxy's pool. Astra shares lore and flavor about places and alien species; Ada
asks questions and reacts. Seen conversations are saved so they do not repeat. A repeating
trigger (warnings, sightings, Penny's sense, a newly mapped place, a station
return and the first disabled heavy each flight) has a pool of variants on one
theme and draws them in a shuffled order, never the same variant twice in a row,
starting a new shuffle once all have played.

Penny rides in the second seat and never barks aloud. Sensing uses the approved
shared 5,000-world-unit range. Her conversation is narration only: it does not
create, expire or replace a target marker. Penny's "Woof! Woof!" and Ada's
reaction remain once per sensed point of interest, with the existing provisional
60-second ordinary narration interval; hunt narration retains its own exception.
Target knowledge, real icons versus
`?`, persistence and placement follow [Unified target markers](marker-design.md).
Exact narration lines are in
[the player copy](player-copy.md#in-flight-conversations).

## Space encounters and feedback

Combat occurs in small groups separated by quiet stretches. Terrain mixes open
areas, asteroid clusters and narrow passages. There is no spawn warning;
Astra's drone-arrival line is the only cue.
Bottom edge markers draw under the shield pill, as under other controls. All
eligible off-screen targets use the [unified marker contract](marker-design.md):
one target, one marker, a shared 5,000-world-unit range, persistent knowledge,
and bearing-first near-edge placement. Marker centers remain on the projected
Ada-to-target ray; temporary HUD/dialogue or marker overlap does not justify
tangential or inward displacement. Visible-art inset is approximately one or two
logical pixels, retaining fractional paint rounding and the three-logical-pixel
small-marker half-scale corner exception, not a universal exact-one-pixel rule.
Leaving range hides without forgetting;
Continue does not erase knowledge. Destroyed or removed targets clear their
markers. Triggered distant boss contributions are explicit exceptions, not
permission to reveal hidden targets. Map and Quests retain long-range guidance.
Known enemies, heavies, guards and stations retain their distinct marker art;
a disabled route guard uses its heavy marker once it stops blocking the route.
The local map is the only galaxy map; there is no minimap. Discovery caches
light within 160 world units; the holodisk collects on contact like other pickups.
These are approved design rules; source presence does not establish rendered
acceptance or delivery.
Discovery rewards use cargo and Stardust pickups; a discovery cache holds 4
Stardust as four ordinary pickups worth 1 each, arranged in a diamond. Each uses
normal contact collection and the tractor beam, with no aggregate collider or
hidden bonus. Weapons come only from shops and rare enemy drops. Stations are rare
points of interest with Exchange everywhere and seeded equipment,
weapons-and-ammunition or jobs specialties, at twice the station density in every
galaxy (see [Economy](economy.md#stations)).

Visual effects distinguish hits, shield damage, destroyed ships, pickups and
deposits. Sound effects remain restrained. Reduced motion skips screen shakes and the hit flash.

Hit feedback: every time Ada's shield takes damage, from any source including
scenery bumps, the view gives a small shake and one flash of a thin red line
around the game area's perimeter. Starting
values: a 3 logical pixel red border shown once for about 200 ms, and a shake of
about 2 logical pixels for about 100 ms; Art and Tech pin the final values.
Reduced motion disables both the shake and the red line.

Asteroids come in more sizes, including much larger ones, with irregular shapes
and variety. The approved global placement-density target is 20% more ordinary
and resource asteroids in every galaxy, with no additional galaxy-by-galaxy
asteroid curve. Preserve composition weights, size distribution, HP, loot, motion
and safe corridors. Caches, other points of interest and enemies are outside
this increase. Measure actual accepted asteroid counts after clearance
rejections; the placement target alone does not establish an accepted-count
ratio. A higher object-candidate count must not increase cache placement.
Authored `ORE_FIELDS` retain their 6-to-10-rock counts and associated points of
interest, guards and platforms. Their approved variety catalog has eight total
pattern families, each with realizations for counts 6 through 10: 40 count-specific
records, not 40 distinct patterns. The families are loose cluster, crescent, two
pockets, broken ring, scattered trail, three pockets, forked trail and open spiral.
The loose-cluster family preserves the five existing layouts exactly.
The version 2 catalog supplies these families to `oreFieldLayout(variantId, count)`.
An independent seeded selection chooses uniformly among the eight families,
without changing existing placement, count or rotation seeds. The selected
variant id is transient; saved field and rock identities remain unchanged.

The catalog keeps a 450-world-unit radius and 55-world-unit footprint gap. Each
count realization preserves the existing rock-id order, start frames and large
rock count (2, 2, 3, 3 and 3 for counts 6 through 10); new variety changes only
positions, preserving comparable resource totals and clear ship routes. Art owns
the layout geometry and Tech its catalog consumer. Preserve the existing seeded
rigid rotation where geometry permits and the authored seeded rock choices; the
consumer does not reroll rock ids or start frames. Guards keep their
independent placement angle and 610-world-unit distance; platforms retain their
fixed positive-X facing and do not rotate with the rocks. Field frequency, loot,
guard counts, points of interest and saved field identities do not change.

The density exception preserves counts and guard coupling while allowing this
variety catalog. Apply the increase through ambient
ordinary and resource rocks, compensating there toward an aggregate accepted
count of approximately 1.2 times baseline where feasible. Report unchanged
authored-field counts separately alongside ambient counts in that aggregate
measurement, and report feasibility limits rather than claiming every subsystem
increases by 20%.
Ordinary asteroids have stationary centres and may rotate slowly;
they do not translate in circles or oscillate. Legacy orbiting rocks settle at
their current positions without a position jump, with HP and drops unchanged.
Asteroid resource-yield caps are 4, 6, 8 and 10 units for small, medium, large and
huge rocks. Small rocks may yield zero; all larger sizes guarantee at least one
reward, including an ammo-only outcome. An asteroid that drops ammo drops nothing
else. Initial resource units split 75% ore and 25% Stardust. Expected ore quantity
is then reduced by 25% for every size, with Stardust unchanged on each event and
non-small rocks still giving at least one resource. Resulting ore groups into
five-unit chunks and remainder singles within the size cap, with no forced bundle
selection or bonus.
Chunks use normal contact and tractor collection and count as ordinary fungible
ore. Larger rocks are more likely to yield larger totals and five-ore chunks,
but no chunk is guaranteed. Exact weights are in [Economy](economy.md#earning-stardust).
Ships bounce off them, with bump damage as for any asteroid. Large
and huge asteroids stay out of passages and clear of stations, destinations and
launch points. Background objects stay muted
but carry a light tint of color; asteroids are play objects, not background.
Ballistic debris travels at constant velocity in a straight line and may rotate;
it never circles, oscillates or steers toward Ada. Regions of traveling debris
follow their currents and create navigation challenges along exploration and
quest routes.

Small enemy ships have independent movement, aiming and firing, with solo,
erratic circling, swarming and pack behaviors. Aggression can begin on sight or
only after being attacked. The retreat policy replaces permanent
morale flight with bounded retreats and gated recovery after individual damage
or pack losses
([Retreat policy](enemies.md#bounded-retreat-follow-up)). Behavior selection and tuning belong in data wherever
practical; reusable code handles the underlying behavior operations.

Frigates have an engine and two to four weapon hardpoints. Capital ships are
prominent large targets that cover at most a sixth of the screen, about 5 Ada
widths across, so the whole ship and its hardpoints stay readable. A capital has
a command part, two engines and four to eight weapon hardpoints, and can travel
with escort fighters. The weapon count rises with route position. Every heavy has
hull HP: every hit lowers it, and at 0 the ship is destroyed. Destroying all its
weapon hardpoints disables it instead: it stops attacking, shows a red "Disabled"
banner, and Ada can salvage it and spare it, or keep firing to destroy it (see
[Ships](ships.md#heavy-hull-and-disabling)). A destroyed weapon hardpoint stops
firing. Each engine provides an equal share of thrust, so losing one of two engines
halves a ship's speed, and a heavy that loses all its engines coasts to rest,
keeping its momentum and slowing to a stop like a disabled heavy. Large-ship weapons and command areas
must be visually distinguishable from the rest of the hull.

Missile launchers fire straight-flying missiles, visually distinct from ordinary
shots. No missile homes.

Enemy speeds are fixed in world units and the same in every galaxy (see
[Ships](ships.md#values)); pursuit range is finite. Frigates and capital ships can
block required quest routes in the first five galaxies. A required story or quest
guard frigate must always be present and blocks its route until defeated or
disabled. Only its support fighters may number zero to two, within existing
caps. General ambient frigates retain two mandatory escorts; see
[Ships](ships.md#required-guard-frigates-and-support-fighters).

Plan actual required sites, guard hulls and protected footprints before optional
rocks or ambient encounters. Reserve required guard frigates before allocating
their support. Failed placement remains an explicit blocked planning condition,
not a whole empty route plan or story bypass. Preserve existing caps and
required-guard assertions. Planning must not reveal hidden targets or grant a
marker exception. Spawn guards near their station/objective outside protected
clearance and patrol there, never remotely summon them toward Ada. Existing
approved marker eligibility remains separate. Factory/world reservation interfaces are present at the inspected source;
production lifecycle checks and acceptance are not established by this rule.

### Hostile station sites and map knowledge

Approved implementation policy. Policy configuration and runtime/map entry
points are present in the inspected source; production lifecycle checks, delivery
and acceptance remain unverified here. Andromeda, Cartwheel and Phantom have seeded stable
hostile station geographic sites, 10,000 to 100,000 world units from the galaxy
center by shortest wrapped distance. Density is an expected one site per
625,000,000 world units of area (25,000 by 25,000), not a fixed site count.
Required sites/routes and protected footprints take precedence over placement.
Do not convert friendly stations, remove required guards or create cap exceptions.
Engineering owns the candidate algorithm while preserving existing random
streams, geography and required routes.

Only actual on-screen identification adds a site to persistent map knowledge;
sensing or explored chunks alone do not identify it. Label the known site
"Hostile station". Seeded geographic identity, position and knowledge persist
separately from each encounter's combat actors and casualties. Resolve current
status from the canonical loaded actor, then authoritative retained actor state.
Unloaded does not mean destroyed.
Report unresolved when the current body cannot be resolved; never infer defeat or reuse a prior encounter outcome.
These sites offer no Dock, shop or jump action.

Defenders and combat retention follow
[Ships](ships.md#hostile-station-defenders-and-encounter-lifetime); payouts follow
[Economy](economy.md#earning-stardust). These approvals resolve these placement,
defender, reward and map clauses only; independent guards remain in force.

## Verification priorities

Check independent move/aim controls, shield recharge, the shield-depletion jump home,
safe dialogue and arrivals, unlimited mining cargo and deposits, recoverable deliveries,
fresh-chunk quest encounters, saved story progression, regeneration and exact
interrupted-flight resume. Verify the five home resolutions unlock galaxies
in order and completed stories remain resolved on replay.

Evaluate these behaviors with the authored sprites, and with placeholders where
art has not landed.
