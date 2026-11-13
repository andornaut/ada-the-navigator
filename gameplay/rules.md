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
before Phantom's stand against General Gadget. Content tied to a galaxy, its
story, places, roster and art, is named by galaxy. Difficulty, rewards and prices
follow route position, so reordering the route moves a galaxy's content and gives
it its new position's values. Astra's memory lines and General Gadget's
broadcasts follow the order holodisks are recovered, which is route position once
every galaxy is built. Station jobs are in [Quests](quests.md).

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
flights. The first launch shows only Start, which begins Sunflower's home opening
and then the prologue. Start stays alone until the first flight begins. Later
launches show Continue and Restart.

Every launch opens on the start screen; Continue resumes where the save left off.
With a saved flight, Continue resumes it exactly: galaxy, position, tow and danger
(see the exact-resume rule below). Without a saved flight, Continue opens Ada's
room page, after any waiting home scene; picking up the rock then shows the glow,
"Welcome back, Navigator." and the galaxy map, with the farthest unlocked galaxy
selected. A home scene that is waiting, such as a chapter's resolution or the next
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
boundaries within the run, and is disabled only on the run's first page. The
run that starts with Ada's room page's named action counts that room page as
its first, so Previous on the boarding page that follows returns to it. The
"Welcome back, Navigator." page always follows the rock, so its Previous always
returns to Ada's room page. A page
that ends in a named action, such as "Pick up the rock.", shows that action in
place of Next. Skip passes every remaining page and scene of the run, taking the
default path through choices and leaving optional questions unasked, and stops
where play resumes: the galaxy map when the run leads aboard, or Ada's room
page with its named action. Skip shows only where it passes at least one page that Next, or the page's named
action, would show. It is hidden on the last page before the galaxy map, on
the page before Ada's room page, on that room page and on the sleep scene. Skip sits in the top-right corner, apart from
Previous and Next, so tapping quickly through pages cannot skip a run. A scene's effects (a chapter opened or resolved, the prologue
seen) apply as the scene ends; Previous back into an ended scene does not undo
them. Choice buttons are
all secondary, with focus on the first. A choice page offers
two or three choices; each leads to one or two branch pages and then rejoins the
main story, so choices never change a chapter's resolution. The first choice is
the default. Locations include Grandma's house and garden, the community garden
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
then the galaxy map. Story position within a scene is not
saved: a scene interrupted midway restarts from its first page.

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
flight with: jumps from the galaxy map (Jump, and Earth in flight), Travel and the
emergency jump. Boarding from her room is the rock's glow, not a jump; Astra's emergency jump when the shield fails tints it red. Jumping
home, the emergency jump included, arrives in Ada's room. An emergency jump
lands at night: its jump-home page shows, then a 2 to 3 second sleep scene (Ada
asleep with Penny curled up, the rock glowing softly) that a tap skips after a
moment, then morning, when any waiting home scene plays as on any arrival home. A
voluntary Earth from the galaxy map has no sleep scene. The holodisk
drive looks like a CD or cassette player.

Every boarding from Ada's room (picking up the rock), including for a replay of
a resolved galaxy, shows the galaxy map before the flight; Continue without a
saved flight opens her room page first. The app itself always opens on the start screen. The design names two
maps: the local map (the pause card's Map) charts the current galaxy, and the
galaxy map moves Ada between galaxies; neither name appears in the interface. The galaxy map is a route map, like Chibi's zone map,
drawn over a night sky full of stars, galaxies and nebulae above an evening
grass strip about 50 pixels tall along the bottom, where Ada and Penny stand
seen from behind, looking up. The panel sits above the grass, with Earth and
Jump over it. All six galaxies sit
in route order from left to right along one arc, with names under the markers, each a marker in its galaxy's own main hue, as
Chibi's zones have, with Ada's ship, drawn as her current ship sprite, on the selected galaxy. Right moves the ship to the next
open galaxy in route order and Left to the previous one; both skip locked galaxies, as
Chibi's walk skips unavailable zones. Tapping an open marker moves the ship
there. The ship starts on the farthest unlocked galaxy, so on the first boarding
it sits on Sunflower, the only open galaxy, with Jump as the default action. Tab focuses every marker in route order. Tapping, or focusing with Tab, a locked marker shows its panel while the ship stays
on its open galaxy, and Jump is then disabled and refuses with the shared
refusal feedback; Left or Right returns the panel to the
ship's galaxy. A
panel under the chart shows the selected galaxy's "Galaxy {number}", its name,
a small screenshot and one line of flavor text. Earth is on the left and Jump
on the right as the default action, as Chibi's map places Back to title and
Continue. A locked galaxy's marker is greyscale, with "..." for its name and
text. A placeholder galaxy, one whose story is not yet built, is flyable: it has
generic space, enemies and rocks, its position's difficulty and its roster, but no
story, holodisk or story destinations. Its panel shows its number, name and flavor
line, then "Story in development.", and Jump works. Its marker is open, in its
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
starts on the galaxy Ada is flying in, and while it sits there the default
action reads "Stay here" in place of Jump: it closes both maps and resumes the
flight with no jump and no new layout. Jump to another galaxy ends the current
flight, with story progress saved, and quantum jumps into the chosen galaxy;
Earth ends the flight and jumps Ada home to her room. The galaxy map has the
close X, which with back and Escape goes one step back, to the page Ada just
left: the local map in flight, or the "Welcome back, Navigator." page at
boarding. Earth is the way home from boarding.

Galaxies are named after real galaxies' nicknames, in the route order above.
Every unlocked galaxy stays replayable in any order. Its resolved story stays
resolved, and its stations, shops, jobs, activities and any unfinished quests
stay available. Completing a quest invites a return to Earth without forcing
immediate exit from space.

Talk conversations in space (with Continue and Ask more) pause play, as cards
do (the station card, shop, pause card and the rest). They use brief essential
exchanges with optional questions about character and culture. The in-flight
speech box and notices never pause play (see
[Astra and Penny in flight](#astra-and-penny-in-flight)). The first mandatory
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

Whirlpool's space is teal and full of swirling debris. Gadget's hunter drones
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
  maximum speed: riding a current gives Ada at her base engine up to 230 world
  units per second, and pushing against its centre still makes 90. Ada steers, docks and fights normally in a
  current.
- Currents never trap Ada. The peak flow stays well below her slowest top speed,
  towing included (104), every current ends in open space, and she can always
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
beyond the last. No enemies enter a gate run. Gadget's drones wait outside the
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
gone dark and ships keep getting lost. The frightened settlers blame Gadget's drones. Ada meets Pip, a young courier, who admits to her that he
clipped the beacon during a rushed delivery and was too scared to say. He also
found a strange disc in the wreckage, Astra's holodisk, and has kept it as a
treasure. Ada does not tell on him: she offers to go with him while he tells the
settlers. He owns up, the settlers' fear eases, and Ada and Pip gather the
parts to relight the beacon. Pip then hands Ada the holodisk himself.

Objectives: explore; find out why ships are getting lost; talk with Pip; go with
Pip to the settlers; get beacon parts at the settlement with Pip; bring beacon parts to the dark beacon; take the holodisk
from Pip; return to Earth. Gadget's drones are hunting here openly. Andromeda's drones patrol in larger
groups with more frigates than Needle's; its roster is tuned like the others.

Andromeda's stations are settlers' stations, drawn with the settlers' art, as
Cartwheel's station is the mining hub: each is a full station with dock, shop,
Jobs and, once the chapter is complete, projects, and the local map calls it Station.
Going with Pip to the settlers ends at the nearest settlers' station. Getting the beacon parts with Pip ends at the
nearest settlement, where Pip collects them and Ada carries them to the dark
beacon. The
settlements are Andromeda's outposts: the local map calls them Outpost, Ada uses one
like Sunflower's outposts rather than docking, and the courier run, deliveries
and tows can end at one. Their sentence names are "the settlers' station" and
"the settlement". The guide beacons are story objects, separate from the
galaxy's beacon landmarks: the dark beacon is a story place, and the
rest of the chain is scenery, not Map places.

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
like asteroids. A medium rock has 3 HP and releases 3 pieces, a large rock 5 HP
and 5 pieces; two of every three are medium. Cartwheel has no damaging hazards.

Cartwheel's space is an industrial ring of mining platforms in rust and ember
tones. Gadget's claim-jumper drones harass miners at the ore fields with hit and
run attacks, and fixed turret platforms guard some ore fields. Difficulty ramps
along the route; the roster is in [Ships](ships.md#cartwheel-roster).

### Species and greeters

Each galaxy's people are one kid-friendly alien species: animal folk in
Sunflower, Whirlpool and Needle, androids in Andromeda, living rock in Cartwheel
and goo in Phantom. Its role voices, story characters and greeters are all of
that species, apart from Whirlpool's whales and General Gadget.

| Galaxy    | People  | Form         | Lore                                                                                                                                               |
| --------- | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sunflower | Bumbles | Bees         | Hive folk who farm starlight and hum while they work; the growers, workshop and salvagers are Bumbles.                                             |
| Whirlpool | Voron   | Squid        | Current riders who live beside the whales and write in ink that glows.                                                                             |
| Needle    | Avi     | Herons       | Long-legged pilots who stand still before they move; Elder Loom is an Avi.                                                                         |
| Andromeda | Munix   | Androids     | Built settlers who steer by beacon light and keep their lamps lit; Pip and the settlers are Munix.                                                 |
| Cartwheel | Cobbles | Living rock  | Stone folk who mine the ore that feeds them and never mind a bump; the young are pebble-sized. The miner, visitors and blocking pilot are Cobbles. |
| Phantom   | Blurbs  | Blobs of goo | Wobbly goo folk of the shadowed rim, living under Gadget's watch; his blockades cut their settlements off.                                         |

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

Every station in these five galaxies has a keeper of its people, and every
Andromeda settlement a settler who greets Ada. Each galaxy has three keepers,
each with a name and portrait of their own. A station's keeper follows its rank
by distance from the galaxy's origin, cycling through the three, so the nearest
three stations have different keepers. Cartwheel's mining hub is always
Quartz's, and its other stations cycle through Slate and Garnet.

| Galaxy    | Keepers                  |
| --------- | ------------------------ |
| Sunflower | Saffron, Bramble, Nectar |
| Whirlpool | Ripple, Coral, Brine     |
| Needle    | Sedge, Willow, Marsh     |
| Andromeda | Lumen, Dial, Cog         |
| Cartwheel | Quartz, Slate, Garnet    |

The mining hub's keeper has greeting lines of its own that mention the hub;
every other station's keeper uses its species' shared keeper lines. The name
tab shows the keeper's name. Story destinations keep their
story characters' arrival lines; landmarks have no greeter. The first time Ada
docks at a station, its keeper's portrait and full greeting (three lines) show
in the station card's welcome line, a tap on the line advancing it while Undock,
Shop and Jobs stay live. Each later docking shows one short line, the galaxy's
three in turn. The first time Ada comes within Talk range of a settlement, its
settler's two-line greeting plays in the conversation box. Greetings seen are
saved per place, and Restart clears them. Phantom's stations keep the generic
welcome line until the chapter is complete; then General Gadget greets Ada there,
with his own lines and portrait, as their keeper. Lines are in [the player copy](player-copy.md#greeters).

### Galaxy six, Phantom: the finale

Ada learns to let go of control. The chapter draws on the first five without
adding another community problem: everyone Ada helped comes to her thank-you
party, her perfect plan washes away in the rain, and the day is better for it.
In space, General Gadget wants to control every galaxy; Ada shows him that they
never end (see [the design](design.md#general-gadget)).

At home, Ada plans a thank-you party at the community garden for Grandma, Sam,
her friends, Mom and Dad, with a list for every minute. After the space story, rain
spoils the plan. Ada lets it go, everyone crowds together in the rain, and
nobody remembers the schedule. That night Astra, whole again, chooses to keep
flying with Ada.

Phantom is a shadowed rim in smoke and violet. Gadget's fleet holds it, and
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
2. **Fleet battle.** When Ada comes within 1500 world units of the waypoint, the
   battle begins: her allies jump in beside her (see
   [Ships](ships.md#finale-allies)), and three waves of drones come, each two
   encounters drawn from the roster without the capital battle. The next wave
   arrives when the last is destroyed, disabled or fled. The flagship and its
   escorts hold back until the third wave is gone.
3. **The flagship.** Gadget's own capital ([Ships](ships.md#gadgets-flagship))
   then attacks. It can be beaten only by disabling it: its hull never drops below
   1 HP. Disabled, it shows the red "Disabled" banner, and Ada salvages the last
   holodisk from it. Gadget surrenders the disk, Astra's memory is complete, and
   at Ada's request Astra shows him her whole map: galaxies past galaxies, without
   end. He relents and stays in Phantom to help the Blurbs mend the docks his
   blockades broke.

If the shield fails during the fleet battle or the flagship fight, the emergency
jump works as usual: broken blockades and freed settlements stay, and the battle
restarts in full on the next approach. Allies help but are never required; the
battle is tuned to be winnable with none. Objectives are in
[the player copy](player-copy.md#chapter-six-the-garden-party).

Once the chapter is complete, Phantom's drones stand down: it places no new
encounters, and Gadget is the keeper of its stations. Drones in the other
galaxies are beyond his signal and keep their last orders, so their space stays
as dangerous as before. The salvaged flagship stays at the waypoint as a passable
hulk with its lights on. The Blurb settlements' docks show cracks from the blockades
until the chapter is complete, then show mended, Gadget's work. The "dark nebula"
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
  drag. Both joysticks' drawn rings sit 60 logical pixels from the screen's
  outer side edges and 40 above its bottom, inside the safe insets, mirrored as
  in Chibi. Each stick is then clamped so it is drawn fully inside the game
  area, keeping a small border (8 logical pixels by default; Art sets the exact
  value) from the game area's edge so it never appears to touch the side bars. Use is
  Chibi's touch disc, placed beside the aim stick as in Chibi. The move ring lights its left or right marker only when the
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
- Pause, as in Chibi: the pause button at the top left opens a card titled
  "Paused" over the dimmed game, which pauses play, with a close X. Its buttons
  share one shape. "Map", "Ship", "Settings" and "Back to title" sit above, and
  "Resume" (primary) spans the full width at the bottom, focused when the card
  opens, since primary buttons sit down and to the right. Ship opens a card titled "Ship" with a close
  X, back to the pause card, in two sections. "Cargo" lists Stardust, ore
  carried this flight, "Holodisks: {n} of 6", and the carried job or story item or towed
  craft when there is one. "Equipment" lists the shield, engine and tractor
  beam, each with its level ("Level {n} of 3"); every owned weapon in
  the weapon icons' order with its level and, apart from Laser, its ammunition;
  and the ship paint. The pause card shows no objective text, and neither does space;
  in flight the direction indicator is the objective cue.
  The local map's header shows the galaxy name with its landmark pips and
  "{percent}% mapped" below them, then a "Quests" button and "Galaxies".
  Quests opens a modal titled "Quests" listing the galaxy's current story
  objective, or "Story complete." once the chapter is resolved, then the held
  job or activity as "Job: {objective}". With no job held, a last line reads
  "Station job boards have more to do." once the galaxy has a discovered station.
  A line whose target is mapped is a button: it closes the modal and selects
  and centres that chip. With no lines at all, the modal reads "Explore to find
  something to do." The close X, an outside tap, back and Escape close it.
  The local map shows the current galaxy: Ada's position, discovered destinations and
  stations, charted landmarks, the current objective's destination once mapped,
  a known holodisk waypoint until its holodisk is recovered, and how much of the
  galaxy is mapped. The mapped percentage counts the destinations, stations and
  landmarks inside the galaxy's charting circle, 25000 world units around its
  origin: those discovered or charted over the total, rounded down. Stations
  beyond the circle still show on the Map once discovered but do not count.
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
  On the start screen, Settings opens from its own button, as in Chibi, and
  Achievements sits immediately left of it in the same form. Exit, as in Archie,
  sits right of Settings, at the far top right, where it can act: in an installed app the platform lets
  close (Chrome's Android app, Chrome and Edge desktop app windows) it closes the
  app, and in a browser tab it goes to the site's home page. Installed apps that
  cannot close hide it. Q exits wherever Exit shows. The start card
  holds only Start, or Continue and Restart. Achievements is on the start
  screen only.
- Weapon and pause controls use icons inspired by Chibi, with accessible labels.
- As in Chibi, wherever player text names an on-screen control (the left stick,
  the right stick, Use), that control's icon follows its name inline at text
  height. The control icons are 16 pixel simplified drawings of the move stick,
  the aim stick and the Use disc; the move stick's side chevrons tell it from
  the aim stick. The icon is decorative; the name stays for screen readers. This
  covers the first-flight lessons and the landing page's mobile line. Keyboard
  text stays words.
- Every card's close X uses the local map's close icon, the galaxy map's
  included, so all close controls look the same.
- Settings uses the same terms and patterns as Archie and Chibi. Rows, in order:
  - Move controls and Aim controls, as in Chibi: each shows or hides one on-screen
    joystick (left and right). Each is shown unless the player hides it. Hiding a
    control hides only its drawing; its input still works. Each row has the note
    "Touch still works when hidden". As in Chibi, on-screen
    joysticks appear only when the primary pointer is coarse (a touch screen).
  - Each row has its icon and a switch, as in Archie and Chibi. The Move controls
    and Aim controls icons are the move and aim stick control icons.
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
- Updates, as in Archie and Chibi: the game checks for a new version on every
  arrival at the start screen: first launch, every Back to title (from the pause
  card or Ada's room page) and resuming the app while the start screen shows.
  Closing a card on the start screen is not an arrival. When a new version is
  waiting, the start screen offers it in a compact modal titled "Update available", with secondary "Cancel"
  on the left, primary "Update now" on the right, the ordinary close X and no body
  text. Only Update now reloads into the new version. Cancel, the close X, an
  outside tap, Escape and back cancel it until the next arrival, when a fresh
  check offers it again. A required update (a save from a newer version) is unaffected.
  Settings and
  install steps covering the start screen suppress the offer.
- Back, as in Chibi: it closes the innermost open card (install steps, Settings,
  the cheats card, the station card or shop) or cancels the update offer; during
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
  Phaser) is also the order of power and rarity: each later weapon costs more,
  drops less often, gets fewer seconds of fire per ammo pack and generally deals
  more single-target damage per second at level 1 (Laser 3.3, Multi-Laser 2.3
  per bolt and 7 with all 3 bolts, Rapid Missile 5, Heavy Missile 5, Scattershot 6.0 with
  every dot hitting, Phaser 6.5). Slower weapons deal more damage per hit. The
  later weapons are situational, each with a limit that offsets its damage:
  Heavy Missile fires slowly, Scattershot works only up close and Phaser fires
  slowly. Every weapon stays worth using.
- Laser is the starter weapon. The other weapons are Multi-Laser, Rapid
  Missile, Heavy Missile, Scattershot and Phaser, bought at station shops or found as rare drops, one
  more unlocked in each galaxy along the route; see
  [Economy](economy.md#weapon-unlocks). The shared upgrade pickup, presented like Chibi's
  power-ups, gives its upgrade on collection (see
  [Economy](economy.md#earning-stardust)). A new weapon from it is equipped at
  once unless the switch wait is running, when it is added without equipping;
  other owned weapons are kept.
- Every weapon and the shield have three levels. For most weapons each level
  multiplies effective output (damage times fire rate times how often it hits)
  by about 1.5, so level 3 is about 2.25 times level 1; Rapid Missile and
  Multi-Laser gain about 1.2 to 1.33 times per level. Single-target output meets
  those steps on its own; reach and blast stay fixed at every level. The
  shield's capacity is 10, 15 and 20, so level 3 holds 2 times level 1. Each
  weapon grows along its own dimensions:
  - Laser: damage, fire rate and bolt speed: every 0.30, 0.25, 0.20 s, dealing 1,
    1.25 and 1.5 times Laser damage.
  - Multi-Laser: a fan of bolts evenly spaced across a fixed 40 degrees, 3 at
    level 1 (-20, 0 and 20 degrees), then 4, then 5, every 0.30 s. Each bolt deals a fixed 0.7 times Laser damage;
    levels add only bolts. Its bolts are slower than Laser's at the same level.
  - Rapid Missile: quick straight missiles with a small blast (25) and a fixed
    1.5 times Laser damage; levels grow its fire rate (every 0.30, 0.25, 0.20 s)
    and missile speed.
  - Heavy Missile: one slow straight missile with a large blast (radius 50),
    every 2.0 s at every level; levels grow only its damage (10, 15, 22.5 times
    Laser damage). Rapid Missile is faster at every
    level, in missile speed and fire rate, and matches Heavy Missile's damage
    per second at level 1 (5); Heavy Missile deals more damage per hit at every
    level, a large blast, and more damage per second at levels 2 and 3 (7.5
    against 6, 11.25 against 7.5).
  - Scattershot: the close-range weapon, a shotgun of visual dots across -30 to
    30 degrees, 7 at level 1, then 9, then 11, one volley every 1.0 s. Its range
    is a fixed 100 world units on every device, and levels add dots. Up
    close every dot hits; toward its range the spread covers more area but fewer
    dots hit. A level 1 volley deals 6 times Laser damage when every dot hits
    (about 0.86 per dot); levels 2 and 3 share 1.5 and 2.25 times that volley
    across their dots. Dots do not apply damage over time.
  - Phaser: the long-range weapon, a hitscan beam. Each shot hits instantly
    along the aim from the ship out to a fixed 370 world units at every level,
    enough to cover the whole play view in any direction, stopping at the first
    enemy or obstacle it meets, then shows briefly as a visible beam. It fires
    once every 1.0 s and deals 6.5 times Laser damage to the enemy it hits;
    levels grow only its damage (6.5, 9.75, 14.625).
- A missile, Ada's or an enemy's, explodes when it touches a ship it can hit or
  an obstacle, or at the end of its reach. Its blast damages every enemy within its radius, never Ada. An enemy
  missile's blast damages Ada, never enemies.
- Damage and hit points share one unit: 1 damage removes 1 HP, and a level 1
  Laser shot deals 1 damage. Enemies fire the same weapons, always at level 1
  with Ada's level 1 damage, blast, spread and reach, plus three enemy-only
  weapons; each enemy
  keeps its own cadence, and enemy projectiles fly at 0.6 times Ada's level 1
  speed for the weapon (see [Ships](ships.md#enemy-weapons)). An enemy Heavy
  Missile hit (10) can empty a full base shield, so it fires rarely.
- Laser bolts travel at 500, 600 and 700 world units per second at weapon
  levels 1, 2 and 3; Multi-Laser bolts at 400, 500 and 600. Both reach a fixed 370 world units at
  every level, as far as Phaser: past the play view's edges straight left,
  right, up and down (about 255) and its corners (about 360); flight time
  follows speed. Rapid Missile flies at 500, 600 and
  700, and Heavy Missile at a fixed 400; both missiles reach a fixed 220 at every
  level, so a missile that hits nothing explodes on screen. Enemy missiles share
  this reach. Scattershot dots fly at 600.
  None depends on her engine level.
- Ada's shots and Phaser beams leave from her ship's nose, and weapon ranges are
  measured from there. Enemy shots leave from the drawn muzzle of the gun's
  current aim frame wherever the art defines muzzles, and from the model's fire
  origin otherwise; shot direction always follows the continuous aim.
- Fan angles are measured in the projected aim plane. Rotate there before
  unprojecting each shot direction; preserve the weapon's world speed.
- Each scattershot dot travels 100 world units along its own rotated heading on
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
- General Gadget's uncrewed drone fleet is the recurring hostile faction in every
  galaxy, searching for the same holodisks.
- Defeated enemy ships are destroyed and drop Stardust, the game's currency.
- One rechargeable shield of 10 HP, 15 and 20 at shield levels 2 and 3. No hull
  resource.
- Recharge starts 30 seconds after Ada last took damage, at every shield level,
  and refills from empty to full in 60 seconds at base. Shield levels 2 and 3
  shorten the full refill to 45, then 30 seconds. Only damage restarts the
  delay: enemies nearby, chasing or firing and missing do not hold it back, and
  enemies keep their damage.
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
- The shield is a bar at the bottom centre, between the sticks, with a shield
  icon. Its length follows shield capacity: 120 logical pixels at base, 180 at
  Shield level 2 and 240 at level 3, so each upgrade visibly lengthens it. The bar is blue, turning red when the shield is low (below
  25%) or empty, and shows hits, the recharge delay and regeneration. Low shield
  never relies on color alone: the bar also pulses, held steady under reduced
  motion, and Astra says "Shield low!".
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
  character format as the count ("+44.4k").
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

## Interactions and navigation

Use is one contextual control, Chibi's touch disc beside the aim stick, visible
only when an interaction is available. It shows the action's symbol with no text;
the action's name is its accessible name. On desktop the disc is hidden, as in
Chibi, and the Use key still acts. Where the disc's press area overlaps the
conversation box, the box takes the press. Resources collect on contact. Mining cargo has no capacity limit.

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

Each galaxy's fixed seed places its stations, outposts, currents, ore fields and
landmarks, so they stay in the same places on every flight. Each flight
generates a new layout seed that regenerates rocks, enemies and pickups. Story
progress, known destinations, deposited resources and achievements persist.
Known destinations remain usable despite regeneration.

Closing the game or Back to title is not leaving the galaxy: resume the same
flight with exact important state and current nearby space, cargo, owned and
selected weapons and shield. Disposed ordinary history is not part of that
exact-resume guarantee. Save durable milestones as they occur.

### What each event keeps

Earth means going home by choice from the galaxy map; Jump means jumping to
another galaxy from it. Restart also clears story progress, unlocked galaxies,
holodisks, seen conversations and greetings.

| State                               | Closing the app | Back to title | Earth                           | Shield-failure jump             | Jump                            | Restart |
| ----------------------------------- | --------------- | ------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------- |
| Flight layout                       | Resumes         | Resumes       | New next flight                 | New next flight                 | New next flight                 | Cleared |
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
jump-home page tells the player when ore was lost. Stardust is never lost.

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
two lines. This speech box and notices never pause play, and the pause button
and weapon icons stay live while it shows; Talk conversations and cards do
pause play. Its background is an ink #181425 panel at 0.65 alpha, the opacity of every panel, so it
stays readable over the brightest space signals; text, tab and portrait stay
opaque. Each line shows for 5 seconds plus 50 ms per character of the line, or
until the box (tab included) is tapped; a tap moves to the next line, and the
last tap closes the conversation. First-flight lessons follow the same timing. Tapping a
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

Penny rides in the second seat and never barks aloud. When an undiscovered point
of interest comes within a provisional 900 world units of Ada, even off screen,
one conversation shows Penny's "Woof! Woof!" and then Ada's reaction; it plays
once per point of interest, at most once per 60 seconds (provisional). Exact lines are in
[the player copy](player-copy.md#in-flight-conversations).

## Space encounters and feedback

Combat occurs in small groups separated by quiet stretches. Terrain mixes open
areas, asteroid clusters and narrow passages. There is no spawn warning;
Astra's drone-arrival line is the only cue.
Direction indicators are rare. They mark only the current objective's
destination, a quest item or quest event, the holodisk waypoint and an
undiscovered station within range. Optional discovery caches and ordinary
resource rocks get none; Penny senses those instead. A discovery
cache lights when Ada comes within 160 world units. The holodisk is collected on
contact, like other pickups. The pause menu's Map (the local map) is the only map of a galaxy; there is no minimap.
Edge markers show where off-screen objects Ada has already seen are. Four kinds
each have their own look: enemy (swarms, fighters, interceptors and
retaliators), heavy (frigates, capital ships, platforms and General Gadget),
guard and station (stations and outposts). A guard is a heavy that still blocks
a route: it shows the guard marker, its own image, in place of the heavy marker,
and switches to the heavy marker once it is disabled. Friendly objects she flies through (story ships,
whales, wrecks and landmarks) get none. An object gets a marker only after it
has been on Ada's screen and then left it. The marker stays while the object is
within 1400 world units of Ada, one range for every kind; past 1400 the object is
forgotten until it is on screen again. Destroying the object, leaving the zone
or galaxy, and saving and reloading clear markers. A marker sits where the line
from Ada to the object meets the game area's edge, its outermost drawn pixel 1 logical pixel in
from the edge, and may sit under the HUD. Where a direction
indicator marks the same object, only the indicator shows.
Discovery rewards use cargo and Stardust pickups; a discovery cache holds 5
Stardust. Weapons come only from shops and rare enemy drops. Stations are rare
points of interest with shops.

Visual effects distinguish hits, shield damage, destroyed ships, pickups and
deposits. Sound effects remain restrained. Reduced motion skips screen shakes.
Asteroids come in more sizes, including much larger ones, with irregular shapes
and variety; about a quarter of small and medium asteroids drift in slow closed
loops around their starting point. Every asteroid can be destroyed; bigger ones take more shots and release more
Stardust. Drifting asteroids follow fixed loops that never overlap other rocks,
stations or destinations; ships bounce off them, with bump damage as for any
asteroid. Large
and huge asteroids stay out of passages and clear of stations, destinations and
launch points. Background objects stay muted
but carry a light tint of color; asteroids are play objects, not background.
Moving obstacles follow fixed paths (straight lines, closed loops or debris
rivers) and never steer toward Ada. Regions of traveling debris create
navigation challenges along exploration and quest routes.

Small enemy ships have independent movement, aiming and firing, with solo,
erratic circling, swarming and pack behaviors. Aggression can begin on sight or
only after being attacked. Individual enemies can flee, and packs can retreat
after losing members. Behavior selection and tuning belong in data wherever
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
block required quest routes in the first five galaxies. A guard stops blocking
its route once it is disabled or destroyed. The first time each flight that Ada
comes within Talk range of a destination its guard still blocks, Astra says a
guard line, the guard gets its guard edge marker even if Ada has not seen it yet,
and the guard wakes and flies toward Ada until it is on screen, then fights as
usual.

## Verification priorities

Check independent move/aim controls, shield recharge, the shield-depletion jump home,
safe dialogue and arrivals, unlimited mining cargo and deposits, recoverable deliveries,
fresh-chunk quest encounters, saved story progression, regeneration and exact
interrupted-flight resume. Verify the five home resolutions unlock galaxies
in order and completed stories remain resolved on replay.

Evaluate these behaviors with the authored sprites, and with placeholders where
art has not landed.
