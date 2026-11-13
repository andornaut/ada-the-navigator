# Dialogue and objectives

Working player text for six designed chapters. Opening, resolution and closing
pages keep their chapter panel title. A story page's text is at most 220
characters and a page offers at most three choices. On a page with three choices
every label fits one line, at most 23 characters; labels up to 36 characters,
which wrap to two lines, appear only on pages with two choices or fewer.
Choices converge. The choice column scrolls if needed. Previous remains available when there is an earlier page. Every page with Next
also offers Skip. Skip follows the whole continuation across scene boundaries
and stops for an unresolved choice.

Space Use interactions open a modal conversation, except Dock, which opens the
station card. The conversation's PARTY heading names the person or group Ada is
addressing. Each line has its own speaker name and portrait, including Ada,
Astra and Penny when they speak. A PARTY heading never attributes every line to
that party. Narration remains unattributed. Continue advances essential lines;
Ask more offers the listed optional topics and returns to the same conversation.
Optional topics never gate progress. Skip dialogue reaches the existing outcome
once, preserving any pending choice for the player to answer.

In-flight chatter and drone/Admiral broadcasts remain in the small conversation
box with touch dismissal. Automatic gate and battle reactions below stay chatter;
their presence in a chapter does not turn them into Use interactions.

Essential exchanges below contain roughly four to eight lines and two optional
Ask more topics per conversation. Runtime keys use galaxy IDs, not chapter
order: Sunflower 1, Cartwheel 2 and Whirlpool 3. Needle, Andromeda and Phantom
have copy anchors only until their runtime steps exist. Outcome chains keep
their existing keys and order. Repeated mechanical actions use the short Astra
briefs below instead of expanding to four to eight lines. These briefs explain
the existing action and preserve its outcome.

## Design status

The following items are APPROVED DESIGN, not current runtime behavior:

- Unmapped Needle anchors: arrival; holodisk and practice; practice complete.
- Unmapped Andromeda anchors: arrival; Pip confession; Pip owns up; beacon
  repaired; Pip holodisk.
- Unmapped Phantom anchors: first settlement freed; second settlement freed;
  third settlement freed; map and docks.
- Unmapped Salvage variant: the last holodisk after the flagship is disabled,
  including its optional memory response.
- Expanded editorial responses pending runtime parity: Rivet's "What do you
  repair?" answer ("Spare parts really help!"), Quartz's "Who uses the hub?"
  answer ("There's docking space for everyone."), and Mica's company response
  ("I'd like some company next time. That would help.").
- Approved Skip contract requiring runtime follow-up: every page with Next also
  offers Skip; Skip follows the whole continuation across scene boundaries and
  stops for an unresolved choice. Runtime Skip visibility retains exclusions.

## Space PARTY inventory

These names follow the cast and species rules. A role in parentheses identifies
an existing role, not an additional character. Keepers remain in Dock cards.
Admiral Archie is the antagonist dog in a red uniform. Gadget and Kiwi are Ada's
household cats; Penny remains her dog.

| Context                                | PARTY names                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Sunflower quest and handover           | Clover (Grower), Rivet (Workshop), Patch (Salvager)                                              |
| Whirlpool quest                        | Marlo (Whale), Whale family                                                                      |
| Needle quest                           | Elder Loom                                                                                       |
| Andromeda quest                        | Wick (story Settler), Pip                                                                        |
| Cartwheel quest                        | Quartz (hub Station), Mica (Miner), Opal (first Regular visitor), Jasper (final Regular visitor) |
| Nonperson Use actions                  | Astra (guide, including Salvage and ore Deposit)                                                 |
| Phantom quest                          | Blurbs (first and second freed settlements), Dollop (third), Admiral Archie                      |
| Sunflower Dock                         | Saffron, Bramble, Nectar                                                                         |
| Whirlpool Dock                         | Ripple, Coral, Brine                                                                             |
| Needle Dock                            | Sedge, Willow, Marsh                                                                             |
| Andromeda Dock and settlement greeting | Lumen, Dial, Cog; unnamed settlement greeters                                                    |
| Cartwheel Dock                         | Quartz at the hub; Slate, Garnet elsewhere                                                       |
| Phantom Dock after completion          | Admiral Archie                                                                                   |

Ada, Astra and Penny use their own portraits on their own lines. Reed is the
existing young Avi pilot, with no essential exchange added here. The blocking
pilot, calf and stranded travelers gain no speaking lines. The Admiral's
broadcast retains Unknown voice and its silhouette until his existing reveal.

## Prologue

Plays once, on first launch, around chapter one's home opening. Panel title:
The Glowing Rock.
Aboard pages picture the ship from outside, never the cockpit's interior, so the text carries whether Ada and
Penny stand or sit. They stand from their arrival through the optional questions;
from "Ada sits in the pilot's chair and buckles Penny in
beside her." onward they are seated. Boarding in later chapters, Continue and
the galaxy map always show them seated.
A replayed chapter one opening uses the boarding panels instead.

First launch only, before chapter one's opening, in Grandma's garden:

- Narration: "Ada is twelve. She loves maps, old atlases and finding the way to
  places nobody else bothers to go."
- Narration: "Every Saturday, she and her dog Penny walk to Grandma's house,
  where the garden grows a little wilder each year."
- Grandma: "There's my navigator! Did you two take the long way again?"
- Ada: "Penny found a shortcut. It was mostly mud."

Chapter one's opening and its choice follow. After its branch page, still in the
garden:

- Grandma: "Think about it on your walk home. A bit of fresh air might help you think."

In the park:

- Narration: "On the way home, Penny tugs Ada off the path and sniffs hard at the
  roots of an old tree."
- Narration: "Penny digs. Something round glints in the dirt: a rock, smoother
  than any Ada has ever seen."
- Ada: "Good nose, Penny. Let's take it home."

Ada's room, rock unpolished:

- Narration: "That evening, Ada polishes the rock at her desk. Under the dirt,
  thin lines appear, like a map of somewhere far away."
- Narration: "Gadget and Kiwi watch from the bed, tails twitching."

Ada's room, rock glowing:

- Narration: "The lines begin to glow. The pattern pulses softly, as if it is
  waiting for her." Action: "Touch the glow."

Aboard, standing:

- Narration: "Light swirls around Ada and Penny. When it fades, they are standing
  in a tiny cockpit under a blue dome. Through it, colors shimmer like nowhere at
  all."
- Narration: "Penny's tail thumps. She sniffs the two seats as if she has been
  here before."
- Astra: "Hello. Please don't be afraid. I'm Astra."
- Ada: "Who said that? Where are you?"
- Astra: "All around you. I'm an AI, the mind of this ship. You're standing
  inside me, in a way."
- Astra: "What is your name, explorer?"
- Ada: "Ada. And this is Penny."
- Astra: "Hello, Ada. Hello, Penny. The rock you found is my beacon. It waits for
  someone who loves to find the way."
- Ada: "Where are we?"
- Astra: "Between dimensions. While you are aboard, no time passes on Earth.
  Your family won't even know you left."
- Astra: "I was made to explore and map new places. But my memory is damaged.
  Pieces of it are stored on holodisks, and they were scattered across the
  galaxies."
- Astra: "I can still jump, but I can't find my way alone. I need a navigator.
  Will you be mine?"
- Ada: "A real navigator? In space?"
- Astra: "In space. I'll fly where you steer. You choose where we go, and tell me
  what you see."

Optional questions, each returning to the list until Continue:

- "What's a holodisk?" Astra: "A disk that holds part of my memory. Each one you
  find helps me remember, maybe even how I came to Earth, and shows me new
  places to jump."
- "Can Penny come?" Astra: "There are two seats. Please strap Penny in."
- "How do I get home?" Astra: "Ask me any time you're safe. I'll jump you back to
  the moment you left."

Aboard, seated:

- Narration: "Ada sits in the pilot's chair and buckles Penny in beside her."
- Astra: "You steer, and you aim. My shield will protect us. If it ever fails,
  I'll jump us straight back to Earth."
- Astra: "I remember one galaxy: Sunflower. Its holodisk is somewhere there.
  Quantum jump ready." Action: "Let's find your holodisk."

Boarding, for later chapters: Narration: "Ada holds Penny close and touches the
rock's glow." Astra: "Welcome back, Navigator."

Holodisk inserted: Narration: "Ada slides the holodisk into Astra's drive."
For the first five holodisks, Astra: "Memory restored. I've found new coordinates."
For the sixth holodisk only, Astra: "Memory restored."

Then Astra's memory line for how many holodisks she now holds:

- First holodisk: "I remember a fleet... and someone giving orders."
- Second: "I carried that fleet from galaxy to galaxy. But whose fleet?"
- Third: "Admiral Archie. I was his navigator. I scattered my holodisks to keep
  them from him."
- Fourth: "I remember running from him. I scattered the disks in one wild jump,
  and it broke something in me. That's how I ended up near Earth."
- Fifth: "Now I remember what he wants: copies of my mind that always obey. If
  I'm whole again, he'll want me even more."
- Sixth: "I remember everything now. He wanted copies of me that would never
  say no. I don't have to run anymore."

Memory lines and broadcasts follow the order holodisks are recovered. The
Admiral's broadcast in a built galaxy plays once, in the conversation box, the
first time his drones engage Ada there: the line after the number of holodisks
she holds then, so none plays while she holds none. Placeholder galaxies play no
broadcast. His name tab reads "Unknown voice" until the third holodisk is
inserted, then "Admiral Archie". While the tab reads "Unknown voice", his
portrait is a dark silhouette with no face; once named, it shows him:

- Second: Unknown voice: "All drones: find the holodisks. Bring them to me."
  Astra: "That voice... I don't know why it scares me."
- Third: Unknown voice: "Someone is collecting my holodisks. Stop them." Ada:
  "Your holodisks? They're Astra's!"
- Fourth: Admiral Archie: "Little navigator, you can't hide from me. My drones
  will wait at every exit." Ada: "Then we'll take our time."
- Fifth: Admiral Archie: "Astra. I know you can hear me. Come back, and bring my
  disks." Astra: "I'm not yours, Admiral. I never was."
- Sixth: Admiral Archie: "So you came to Phantom. I have the last disk, little
  navigator." Ada: "Then we'll come and get it."

Outposts handing over the holodisk, said by whichever outpost Ada is talking to:
"We found this drifting near our outposts. Take it. And thank you."

Boarding after a new galaxy unlocks, once, instead of "Welcome back, Navigator.":
Astra: "Welcome back, Navigator. A new galaxy is ready." Shown when any newly
unlocked galaxy has a built story.

Hub shop holodisk row: Holodisk; Restores part of Astra's memory. Purchase
confirm: "Buy Holodisk?" with the shared shop strings.

## Chapter one: the garden

Panel title: The Outposts.

Opening: "Ada has gardened with Grandma since she was little. Today, Grandma
mentions a nearby community garden that never got started. Its
organizer needs help, but nobody can look after everything."

Choices:

- "What kind of help do they need?"
- "I'd like to meet the organizer."

Branch pages, then the story rejoins:

- "What kind of help do they need?": "Grandma smiles. 'Planting, watering, finding tools... It's a lot for one person.'"
- "I'd like to meet the organizer.": "'They'd love that,' Grandma says. 'Sometimes people want to help. They just need someone to ask.'"

Space dialogue, in story order:

### 1.grower: PARTY Clover

- Clover: "A visitor! We grow food here, but our equipment needs repairs."
- Ada: "Can someone help fix it?"
- Clover: "There's a workshop out here somewhere. Would you take them some food and ask for help?"
- Ada: "I'll take the food and ask."

Ask more:

- "What do you need?" Clover: "Help with the equipment. We could grow more if it worked."
- "Do you know the others?" Clover: "We haven't spoken much with the other outposts."

### 1.workshop: PARTY Rivet

- Ada: "Food from the growers. Their equipment needs repairs."
- Rivet: "We can repair it. We're short of parts, though."
- Ada: "Where could we find some?"
- Rivet: "The salvagers might have what we need. Take them this tool kit."

Ask more:

- "What do you repair?" Rivet: "Tools, ships and growing equipment. Spare parts really help!"
- "Why a tool kit?" Rivet: "Useful tools for them, spare parts for us."

### 1.salvager: PARTY Patch

- Ada: "The workshop sent this tool kit. They need spare parts."
- Patch: "Useful tools! We have parts to spare, but our food is running low."
- Ada: "The growers have food. I brought some to the workshop."
- Patch: "Take these parts to the workshop. We'll contact the growers."

Ask more:

- "What do you salvage?" Patch: "Things people have lost or left behind. Plenty can be used again."
- "Who will ask for food?" Patch: "We will. You've shown us who to ask."

### 1.deliveryComplete: PARTY Rivet

- Ada: "Here are the spare parts."
- Rivet: "Now we can repair the growers' equipment."
- Ada: "And the salvagers will contact the growers for food."
- Rivet: "We'll arrange the next exchange ourselves. Thank you for introducing us!"

Ask more:

- "Need another delivery?" Rivet: "Not for this repair. We can arrange the next exchange ourselves."
- "Who has the holodisk?" Rivet: "Ask at any of our outposts. We have something for you."

### holodiskHandover: PARTY Clover, Rivet or Patch

Use the name and portrait of the outpost character Ada addresses for each
Outpost speaker line. The handover uses the existing outcome once.

- Outpost: "We found this drifting near our outposts."
- Ada: "Astra, is that your holodisk?"
- Astra: "Yes. A piece of my memory."
- Outpost: "Take it. And thank you."

Ask more:

- "Where was it?" Outpost: "Drifting near our outposts."
- "What does it hold?" Astra: "Part of my memory."

Home resolution: "Back on Earth, Ada meets the organizer at the empty lot and
asks which jobs need doing. The organizer lists planting, finding tools,
watering and teaching new gardeners. Grandma offers to help people learn."

Choices:

- "Ask what each person can offer."
- "Divide the work into smaller jobs."

Branch pages, then the story rejoins:

- "Ask what each person can offer.": "A neighbor can water on weekends. Another has
  spare tools. Grandma will teach. Nobody can do everything, but everyone can do
  something."
- "Divide the work into smaller jobs.": "Ada writes each job on a card: plant, water,
  fetch tools, teach. Small jobs are easier to say yes to, and soon every card has
  a name."

Closing: "On planting day, neighbors bring tools, plants and time. People help in different ways. At last, the garden is getting started."

Objectives, in order:

1. Explore the galaxy.
2. Take food from the growers to the workshop.
3. Take the workshop's tool kit to the salvagers.
4. Bring spare parts from the salvagers to the workshop.
5. Collect the holodisk from the outposts.
6. Go home to Earth when ready.

## Chapter two: the whale

Panel title: The Whale Family.

Opening: "Penny waits by the door. It's time for a walk, but Ada would rather keep
playing. 'Nobody has to take me for a walk,' she complains. She loves Penny, but
hasn't considered how much Penny depends on her."

Choices:

- "Wonder why walks matter so much."
- "Think about what Penny can choose."

Branch pages, then the story rejoins:

- "Wonder why walks matter so much.": "Penny can't open the door, read a map or
  choose a path. Every walk is her chance to explore."
- "Think about what Penny can choose.": "Ada can go anywhere she likes, even other
  galaxies. Penny can only go where Ada takes her."

Mom, after the branch page: "Ada, Penny's been waiting by the door all morning."

Space dialogue, in story order:

### 3.whale / 3.trapped: PARTY Marlo

- Marlo: "Can you hear me? I can't get through these rocks."
- Ada: "A whale in space! And you can talk?"
- Marlo: "Yes, and I'd like to get through. Could you help clear a way?"
- Ada: "I'll clear those rocks. My shots won't hurt you."

Ask more:

- "Where do you travel?" Marlo: "We travel through space together. There are places we visit and currents we follow."
- "Are you stuck?" Marlo: "These rocks block my way. Clear them so I can move again."

### 3.freed: PARTY Marlo

- Marlo: "That's better. Thank you."
- Ada: "Where will you go now?"
- Marlo: "I don't know where my family went. Would you look for them?"
- Ada: "I'll look. Then I'll bring you their coordinates."

Ask more:

- "Will they be looking?" Marlo: "They'll be searching for me too."
- "What do you like?" Marlo: "Familiar voices and finding places I haven't seen before. The young ones learn our routes from us."

### 3.family: PARTY Whale family

- Whale family: "Have you seen someone traveling alone? We've been searching."
- Ada: "Marlo was stuck behind some rocks. I've cleared a way."
- Whale family: "They're safe? Please share our coordinates so they can find us."
- Ada: "I'll go back and tell Marlo where you are."

Ask more:

- "Who are you seeking?" Whale family: "The whale traveling alone. We want to be together again."
- "What should I share?" Whale family: "Our coordinates. Then Marlo will know where to go."

### 3.reunion: PARTY Marlo

- Ada: "I found your family. Here are their coordinates."
- Marlo: "You found my family! Now I know where to go."
- Ada: "They're searching for you too."
- Marlo: "Thank you for listening."

Ask more:

- "Can you reach them?" Marlo: "Yes. The rocks are clear, and now I know where they are."
- "What happens next?" Marlo: "I'll swim back to my family."

Continue into `3.reunionDeparture`: Narration: "The whale swims off, and soon
the family is traveling together again." Then keep `3.holodiskLead` and
`3.holodiskLeadSong` in order:

### 3.holodiskLead / 3.holodiskLeadSong: PARTY Whale family

- Whale family: "You listened when nobody else did. Now listen to us."
- Ada: "What can you hear?"
- Whale family: "A shining disk drifts on the current ahead. Drones guard it. Follow our song."
- Ada: "Astra's holodisk! We'll follow."

Ask more:

- "Where is the disk?" Whale family: "Ahead on the current. Follow our song."
- "Is it guarded?" Whale family: "Drones guard it. Take care on your way."

Home resolution: "Ada returns to the same moment. Penny is still waiting by the
door. Ada thinks of the whale, who wanted to roam and find its family. Penny
wants to explore too."

Choices:

- "Get the leash."
- "Let's go exploring."

Branch pages, then the story rejoins:

- "Get the leash.": "Penny's tail goes wild as Ada clips on the leash. 'Come on,
  girl. Let's see what's out there today.'"
- "Let's go exploring.": "Ada lets Penny choose the way. They take a new path
  through the park, and Penny sniffs every exciting thing."

Closing: "Ada takes Penny out and lets her stop, sniff and explore. They come
home muddy and happy."

Objectives, in order:

1. Explore the galaxy.
2. Shoot the debris blocking the whale.
3. Talk with the freed whale.
4. Explore to find the whale's family.
5. Return to the whale and share the coordinates.
6. Fight your way to the holodisk.
7. Go home to Earth when ready.

## Chapter three: the needle

Panel title: Threading the Needle.

Opening: "Ada is learning the recorder for the school concert. Her song squeaks
on the same hard part every time. She puts the recorder down. 'I'm just not good
at this,' she says."

Choices:

- "Think about quitting."
- "Wonder how anyone gets good at it."

Branch pages, then the story rejoins:

- "Think about quitting.": "If she quits now, nobody will hear the squeaks. But
  nobody will hear her song either."
- "Wonder how anyone gets good at it.": "Ada's music teacher plays so smoothly.
  Ada wonders if she ever squeaked too."

Space dialogue, in story order:

### Needle copy anchor: arrival: PARTY Elder Loom

- Elder Loom: "Welcome to Needle, young pilot. Our channels are narrow, and they cannot be rushed."
- Ada: "I'm looking for a shining disk."
- Elder Loom: "It drifted into the Eye, our narrowest channel."
- Ada: "How do I reach it?"

Ask more:

- "Who flies here?" Elder Loom: "We Avi fly between the star clouds through channels thin as thread."
- "How do pilots learn?" Elder Loom: "Every pilot learns them one gate at a time."

### Needle copy anchor: holodisk and practice: PARTY Elder Loom

- Elder Loom: "To reach the disk you must thread every gate, slowly."
- Ada: "Can I try a shorter channel first?"
- Elder Loom: "Try our practice channel. Three gates. Breathe, and go slowly."
- Ada: "Three gates first. I'll take my time."

Ask more:

- "Why practice?" Elder Loom: "The Eye is our narrowest channel. Learn the gates here first."
- "How many practice gates?" Elder Loom: "Three. One gate at a time."

### Needle copy anchor: practice complete: PARTY Elder Loom

- Elder Loom: "There. You learned it one gate at a time."
- Ada: "The short channel helped."
- Elder Loom: "The Eye is waiting."
- Ada: "I'll go slowly through each gate."

Ask more:

- "Where is the disk?" Elder Loom: "In the Eye, our narrowest channel."
- "Should I hurry now?" Elder Loom: "No. The channels cannot be rushed."

Automatic reactions remain short:

- Elder Loom, in response to a gate passed too fast: "Slow down before the ring. Then try again."
- Ada, lighting the Eye's last gate: "Eight gates! I did it, one at a time."
- Astra, at the Eye's exit: "Drones ahead, Navigator. They've been waiting for us."

Practice feedback responds to attempts. Independent mode has no unsolicited
hints. A failed crossing does not automatically move Ada back to a gate.

Home resolution: "Ada returns to the same moment, holding her recorder. She
remembers Elder Loom: one gate at a time. She picks out the hard part and plays
just that, slowly."

Choices:

- "Practice the hard part every day."
- "Ask her teacher for help."

Branch pages, then the story rejoins:

- "Practice the hard part every day.": "Every evening, Ada plays the hard part
  five times, slowly. By the end of the week, it only squeaks once."
- "Ask her teacher for help.": "Her teacher shows her how to cover the holes
  gently. 'Everyone squeaks at first,' she says. 'I did too.'"

Dad, looking in after the branch page: "Sounding better every day."

Closing: "At the concert, Ada plays the whole song. One note wobbles, and she
keeps going. Everyone claps, and Ada is proud of every gate she threaded to get
there."

Objectives, in order:

1. Explore the galaxy.
2. Meet Elder Loom.
3. Light the practice gates.
4. Light the Eye's gates.
5. Collect the holodisk.
6. Go home to Earth when ready.

## Chapter four: the beacon

Panel title: The Dark Beacon.

Opening: "At Grandma's house, Ada reaches past a tray of seedlings Grandma has
been raising for the community garden. Her elbow catches it, and soil spills
everywhere. Ada pushes the little pots back into place and says nothing."

Choices:

- "Hope nobody notices."
- "Tell herself it was an accident."

Branch pages, then the story rejoins:

- "Hope nobody notices.": "Later, Grandma finds the spilled soil. 'I wonder what
  happened to my seedlings,' she says quietly. Ada's stomach twists."
- "Tell herself it was an accident.": "It was an accident. But when Grandma
  looks so puzzled and sad, Ada knows that staying quiet isn't."

Space dialogue, in story order:

### Andromeda copy anchor: arrival: PARTY Wick

- Wick: "A traveler! Be careful. One of our guide beacons has gone dark."
- Ada: "What's happening to the ships?"
- Wick: "They keep getting lost. It must be Archie's drones. Everyone is scared to fly."
- Ada: "I'll look at the beacon."

Ask more:

- "What do beacons do?" Wick: "They guide ships between the settlements."
- "Why are ships lost?" Wick: "Without the beacons, the bright spiral is easy to get lost in."

Ada, at the dark beacon, before meeting Pip: "This beacon isn't shot. It's
dented, like something bumped into it."

### Andromeda copy anchor: Pip confession: PARTY Pip

- Ada: "Pip, did you see the dent in the beacon?"
- Pip: "You saw the dent? It was me. I was late, I flew too fast, and I clipped it."
- Ada: "Have you told anyone?"
- Pip: "I've been too scared to tell anyone."
- Pip: "There's something else. I found this disk floating by the beacon. It's so strange and shiny. I kept it."
- Ada: "I won't tell on you, Pip. But I'll come with you while you tell them."

Ask more:

- "What do you carry?" Pip: "Mail between the settlements. I'm good at it, mostly. I just hurry."
- "Will you come with me?" Pip: "Yes. I'll tell them what happened."

### Andromeda copy anchor: Pip owns up: PARTY Wick

- Pip: "I clipped the beacon. I was flying too fast."
- Wick: "So it wasn't the drones at all. Thank you for telling us, Pip."
- Wick: "Now, who can help us fix it?"
- Pip: "I can help! Spare beacon parts are kept at the settlement. Let's go get them."

Ask more:

- "Where are the parts?" Pip: "At the settlement. Come with me."
- "What needs fixing?" Wick: "The dark guide beacon. Ships need its light."

### Andromeda copy anchor: beacon repaired: PARTY Wick

- Ada: "We brought the beacon parts."
- Pip: "Let's fix the beacon."
- Wick: "There. The beacon is lit again, and ships can find their way."
- Ada: "I can see its light!"

Ask more:

- "Can ships travel now?" Wick: "Yes. The beacon can guide them again."
- "What was damaged?" Wick: "The beacon Pip clipped. The parts have repaired it."

### Andromeda copy anchor: Pip holodisk: PARTY Pip

- Pip: "This belongs to your ship, doesn't it?"
- Ada: "Yes. It's part of Astra's memory."
- Pip: "I should have given it back right away. Here."
- Ada: "Thank you, Pip."

Ask more:

- "Where did you find it?" Pip: "Floating by the beacon."
- "Why did you keep it?" Pip: "It was so strange and shiny. I should have given it back."

Home resolution: "Ada returns to the same moment, at Grandma's house. Grandma is
still looking at the spilled soil. Ada takes a breath and tells her what really
happened."

Choices:

- "Say sorry, and offer to help."
- "Explain why she stayed quiet."

Branch pages, then the story rejoins:

- "Say sorry, and offer to help.": "'I'm sorry, Grandma. I knocked it over. Can I
  help you replant?' Grandma hands her a trowel."
- "Explain why she stayed quiet.": "'I was scared you'd be upset,' Ada says.
  Grandma nods. 'I'd much rather know. Thank you for telling me.'"

Closing: "Ada and Grandma replant every seedling together. 'Accidents happen,'
Grandma says. 'Telling the truth is the part that counts.' Ada feels light again."

Objectives, in order:

1. Explore the galaxy.
2. Find out why ships are getting lost.
3. Talk with Pip.
4. Go with Pip to the settlers.
5. Get beacon parts at the settlement with Pip.
6. Bring beacon parts to the dark beacon.
7. Take the holodisk from Pip.
8. Go home to Earth when ready.

## Chapter five: the mining hub

Panel title: The Mining Hub.

Opening: "At school, Ada sees Sam, a child in her class, left out of a game at
recess. Other children look away. Ada wonders who else noticed."

Choices:

- "Notice who might help."
- "Think about how to offer support."

Branch pages, then the story rejoins:

- "Notice who might help.": "A few children look uncomfortable, not amused. Ada
  guesses they don't like it either. They just don't know what to do yet."
- "Think about how to offer support.": "Ada thinks about what she would want:
  someone beside her, and an invitation to join in. No speeches, just company."

At dinner, after the branch page: Narration: "At dinner, Ada tells Dad what she
saw at school." Dad: "That sounds hard to watch. What do you think would help?"

Space dialogue, in story order:

### 2.hub: PARTY Quartz

The hub arrival conversation uses Quartz's name and portrait. Repeated ore
Deposit uses Astra's short brief below; Dock still opens the station card.

- Quartz: "Welcome. Independent miners bring ore here for transport."
- Ada: "Where do I find ore?"
- Quartz: "Shoot ore rocks and collect the ore they release. Bring it here to deposit it."
- Ada: "Can I bring a little at a time?"
- Quartz: "Partial loads count, and you can travel back when you're out of danger."

Ask more:

- "Who uses the hub?" Quartz: "Independent miners. There's docking space for everyone."
- "Should I keep some ore?" Astra: "Yes. Above ten percent shield, recharge needs ore."

Ada, first deposit milestone: "That pilot cut right in front of the miner!
There's plenty of room. Why block them?"

### 2.miner: PARTY Mica

- Ada: "That pilot keeps blocking you. Does it happen often?"
- Mica: "It keeps happening. I've started waiting until they're gone."
- Ada: "Would you like company next time?"
- Mica: "I'd like some company next time. That would help."

Ask more:

- "Do you need docking help?" Mica: "I know how to dock. I just need them to stop blocking me."
- "What would help?" Mica: "Company on the approach. Stay nearby."

### 2.visitors: PARTY Opal

- Ada: "Have you seen the pilot blocking Mica?"
- Opal: "I've seen it. I didn't know what to do."
- Ada: "Mica would like company next time. Will you come?"
- Opal: "I'll come in with you. We can make room and stay nearby."

Ask more:

- "Does Mica want company?" Ada: "Yes. I asked, and Mica said it would help."
- "What will we do?" Opal: "Come in together. Make room and stay nearby."

### 2.approach: PARTY Jasper

- Jasper: "There's room for everyone here. Let them dock."
- Ada: "We're right here, Mica."
- Mica: "I'm coming in."
- Jasper: "We are staying."

Ask more:

- "Should we move away?" Jasper: "Stay nearby. There's room for everyone."
- "What does Mica need?" Ada: "Room to dock and company on the approach."

Continue into `2.approachDocking`: Narration: "The miner flies in with company,
docks and unloads." Then keep `2.approachThanks`: Mica: "Thank you for staying.
See you next trip." These closing lines belong to the same outcome, not a new
quest step.

Home resolution: "Back at school, Ada speaks privately with Sam: 'I saw what happened. Would you like to join us?' Sam says yes. Ada talks with her friends about making room and refusing to laugh along."

Choices:

- "Make room in the game."
- "Sit with them and invite friends."

Branch pages, then the story rejoins:

- "Make room in the game.": "Ada's friends shuffle over and make room. Sam steps in. When someone laughs, nobody laughs along."
- "Sit with them and invite friends.": "At lunch, Ada and Sam sit
  together. One by one, Ada's friends join them, and the table gets louder and
  happier."

Closing: "Sam joins their lunch table. The next time someone is unkind, Ada
and her friends stay right beside Sam. Nobody has to stand alone."

Objectives, in order:

1. Explore the galaxy.
2. Mine ore rocks and deposit the ore at the hub.
3. Keep depositing ore and talk with the miner.
4. Speak with regular visitors about approaching together.
5. Join the miner's approach at the hub.
6. Buy the holodisk at the hub.
7. Go home to Earth when ready.

## Chapter six: the garden party

Panel title: The Garden Party.

Opening: "Ada wants to thank everyone who helped her this year: Grandma, Sam,
her friends, Mom and Dad. She plans a party at the community garden, with a list
for every minute."

Choices:

- "Plan every last detail."
- "Ask everyone to bring something."

Branch pages, then the story rejoins:

- "Plan every last detail.": "Ada writes a schedule: games at three, cake at
  four, thank-yous at five. If everything goes to plan, it will be perfect."
- "Ask everyone to bring something.": "Ada asks everyone to bring one thing.
  Then she writes it all down anyway, just to be sure nothing goes wrong."

Space dialogue, in story order:

### Phantom copy anchor: first settlement freed: PARTY Blurbs

- Blurbs: "Blub! The drones are gone!"
- Ada: "Can you leave your homes now?"
- Blurbs: "We haven't left since the Admiral came."
- Ada: "The blockade here is broken."

Ask more:

- "Who lives here?" Blurbs: "We Blurbs wobble, but we always hold together."
- "What kept you inside?" Blurbs: "The Admiral's drones. They're gone now."

### Phantom copy anchor: second settlement freed: PARTY Blurbs

- Blurbs: "You broke the blockade!"
- Ada: "Were travelers stuck away from home?"
- Blurbs: "Yes. The stranded travelers can come home now."
- Ada: "Then they have a way back."

Ask more:

- "Can travelers return?" Blurbs: "Yes. The blockade is broken."
- "Who blocked the way?" Blurbs: "The Admiral's drones."

### Phantom copy anchor: third settlement freed: PARTY Dollop

- Dollop: "Thank you, Navigator."
- Ada: "Where is the Admiral's flagship?"
- Dollop: "Past the dark nebula."
- Dollop: "We'll send word to everyone you've helped."

Ask more:

- "Where should I look?" Dollop: "Past the dark nebula. His flagship waits there."
- "Who will you tell?" Dollop: "Everyone you've helped."

Battle chatter stays in the small box:

- With allies: Astra: "That's his flagship. And Ada, look." Ada: "Everyone came!" (happy)
- Without allies: Astra: "That's his flagship. It's just us." Ada: "Just us is enough."
- Admiral Archie, as the flagship attacks: "Astra. Come home, and bring my disks. No one needs to get hurt." Astra: "No one will. But I'm not yours."
- Admiral Archie, flagship disabled: "Enough! Take it. Take the last disk."

Salvage the last holodisk uses Astra's short brief below and the existing
holodisk outcome. After the sixth memory line:

### Phantom copy anchor: map and docks: PARTY Admiral Archie

- Ada: "Astra, show him your map."
- Astra: "Six disks, every coordinate. There are galaxies past galaxies, Admiral. They never end."
- Admiral Archie: "No end... No one could hold all of that."
- Ada: "No one has to. But you could help fix what you broke here."
- Admiral Archie: "The Blurbs' docks. My blockades cracked them. I'll start there."

Ask more:

- "What is on the map?" Astra: "Every coordinate. There are galaxies past galaxies."
- "Where will you start?" Admiral Archie: "The Blurbs' docks. My blockades cracked them."

Home resolution: "On the day, rain pours over the garden. The schedule turns to
mush in Ada's hand. She stands in the rain, watching her perfect plan wash away."

Choices:

- "Try to save the plan."
- "Let the plan go."

Branch pages, then the story rejoins:

- "Try to save the plan.": "Ada rushes to move the games into the shed, but
  nothing fits. Grandma laughs and hands her an umbrella. 'Plans are for
  starting, love.'"
- "Let the plan go.": "Ada laughs and drops the soggy list. Sam starts a puddle
  race, and Dad shields the cake under his coat."

Rejoin: "Everyone crowds together in the rain. Mom passes cake, Penny shakes rain
over everyone, and nobody minds at all."

Closing: "Nobody remembers the schedule. Everyone remembers the rain. That night,
Ada tells Astra, 'I couldn't control any of it, and it was the best day.'"
Astra: "I'm whole now, Ada. I could fly anywhere. I'd like to keep flying with
you." Ada: "Always." (happy)

Objectives, in order:

1. Explore the galaxy.
2. Break the drone blockades.
3. Talk with the freed Blurbs.
4. Fly to Archie's flagship.
5. Disable the flagship.
6. Salvage the last holodisk.
7. Go home to Earth when ready.

## Repeated mechanical Use briefs

PARTY is Astra when the interaction has no person to address. Show Astra's
name and portrait as guide, never a new NPC or an object portrait. Ada and Penny
keep their own speaker names and portraits if they have a line. These short
exchanges describe existing actions; they add no quest stage, reward or choice.
Skip dialogue reaches the same existing action outcome once and leaves any
pending choice for the player. Named-person deliveries use that person's PARTY;
Dock always opens its station card.

### Salvage: PARTY Astra

Disabled heavy:

- Astra: "Its weapons are down. I can salvage parts."
- Ada: "Let's take what we need and go."

Last holodisk, after the flagship is disabled:

- Astra: "The last holodisk is here. I can bring it aboard."
- Ada: "Let's get your memory back."

Ask more, optional for the relevant salvage:

- "What can we collect?" Astra: "Parts from this disabled ship." For the flagship's last holodisk: Astra: "The last piece of my memory."
- "Is it disabled?" Astra: "Yes. Its weapons are down."

### Ore Deposit: PARTY Astra

- Astra: "Ore deposited at the hub. Partial loads count."
- Ada: "Let's keep ore for your shield too."

Ask more:

- "Why keep ore?" Astra: "Above ten percent shield, recharge needs ore. Without ore, it won't charge higher."
- "When does recharge start?" Astra: "Thirty seconds after our last hit. Keep ore for recharge above ten percent."

Deposit keeps its existing cargo and milestone outcome. Its brief never speaks
as Quartz. If a deposit triggers a named NPC scene, that scene follows with its
own PARTY and speakers, including the existing first-deposit Ada reaction.

## In-flight conversations

Ada's and Penny's lines show the portrait mood in brackets after the line; an
unmarked line is neutral. Ada has happy and neutral; Penny has happy, neutral and
upset.

Each speaker line wraps to at most two lines. First flight lessons, once each, skipped if already
done: (on touch, each named stick's control icon follows its name, per the rules):

- Astra: "Fly with the left stick." (desktop: "Fly with WASD.")
- Astra: "Aim and fire with the right stick." (desktop: "Aim and fire with the
  arrow keys.")
- Astra: "That's Stardust. Fly close and I'll pull it in." Ada: "Like a magnet!" (happy)
- Astra: "A station! Come close and tap Use to dock." (desktop: "A station! Come
  close and press Space to dock.") Ada: "Shopping in space!" (happy)

Repeating triggers draw one variant from their pool, as the rules describe.

Shield low, once per fight (every variant opens with "Shield low!"):

- Astra: "Shield low!" Penny: "Whimper..." (upset)
- Astra: "Shield low! Pull back." Penny: "Whimper..." (upset)
- Astra: "Shield low! Let's get clear." Ada: "Hang on, Penny."
- Astra: "Shield low! Find somewhere quiet to recharge." Penny: "Whimper..."
  (upset)

Drones arrive:

- Astra: "Drones ahead." Ada: "I see them."
- Astra: "Drones, coming our way." Ada: "Stay close, Penny."
- Ada: "Drones!" Astra: "Shield's ready. Steady aim."
- Astra: "Incoming drones." Penny: "Grr..." (upset)
- Astra: "Here they come." Ada: "We can handle this."

Frigate sighted:

- Astra: "A frigate. Its guns are the glowing parts." Ada: "Then that's where
  I'll aim."
- Ada: "That one's bigger than a drone." Astra: "A frigate. Knock out its guns
  to stop it."
- Astra: "Frigate ahead. Take out its weapons first." Ada: "Got it."

Capital ship sighted:

- Ada: "That ship is huge!" Astra: "No crew aboard. Aim for the glowing parts."
- Ada: "Look at the size of that!" Astra: "Big, but empty. Hit the glowing
  parts."
- Astra: "A capital ship. Nobody aboard, just machines." Ada: "Then let's find
  its glowing parts."

A heavy disabled, first time each flight:

- Astra: "Its weapons are down. We could salvage parts and let it go." Ada: "No
  need to wreck it." (happy)
- Astra: "Its guns are out. We can salvage it, or finish it." Ada: "Salvage.
  It can't hurt anyone now." (happy)
- Astra: "Disabled. Come close and I can salvage parts." Ada: "Let's take what
  we need and go."

Penny senses a point of interest (Penny's line is always the same, so players
learn it):

- Penny: "Woof! Woof!" (happy) Ada: "Penny, did you sense something, girl?"
  (happy)
- Penny: "Woof! Woof!" (happy) Ada: "What is it, Penny? Something out there?"
- Penny: "Woof! Woof!" (happy) Ada: "Your nose is never wrong. Let's look
  around." (happy)
- Penny: "Woof! Woof!" (happy) Ada: "Okay, okay! I'll find it." (happy)
- Penny: "Woof! Woof!" (happy) Ada: "Ears up! Astra, Penny found something."

New destination mapped:

- Astra: "New place mapped." Ada: "Our map is growing!" (happy)
- Astra: "Marking it on the map." Ada: "We're real explorers." (happy)
- Ada: "Astra, put that on the map!" (happy) Astra: "Already done, Navigator."
- Astra: "Saved to the map. We can come back any time." Ada: "Good. I want to
  visit again." (happy)

New station mapped:

- Astra: "A station. Shops, jobs and friendly faces." Ada: "Let's say hello."
  (happy)
- Astra: "Station on the map. A good place to rest." Ada: "And to shop!" (happy)
- Ada: "Look, a station!" (happy) Astra: "Mapped. Come close and we can dock."
- Astra: "Another station. Someone always has a job for us." Ada: "I like
  helping." (happy)

Back at a mapped station, once per station each flight:

- Astra: "Our station again." Ada: "It feels like a second home." (happy)
- Ada: "I wonder what jobs they have today." Astra: "Let's dock and see."
- Astra: "Welcome back, Navigator. The dock is waiting." Ada: "Thanks, Astra."
  (happy)

A guard still blocks the destination Ada reached, one variant in turn:

- Astra: "Something's guarding this place. Here it comes!" Ada: "Get ready,
  Penny."
- Astra: "We can't visit yet. A guard ship is watching." Ada: "Then let's deal
  with it."
- Astra: "A guard is blocking the way in. Stop its weapons first." Ada: "Okay.
  I'm ready."

Sunflower:

- First arrival: Astra: "Sunflower. It's the only place I remember." Ada: "Then
  let's make new memories." (happy)
- Meeting the growers: Ada: "Who grows food out here?" Astra: "The growers farm
  starlight on their outpost."
- Meeting the workshop: Astra: "The workshop can fix almost anything." Ada:
  "Maybe they can fix you
  too, Astra!" (happy)
- Meeting the salvagers: Ada: "What do salvagers do?" Astra: "They find lost
  things and use them again."
- Quiet stretch: Ada: "Astra, do you ever get lonely?" Astra: "Not with a
  navigator aboard."
- Quiet stretch: Astra: "Penny's tail is wagging at my console lights." Ada: "She
  thinks you're fun." (happy)
- Quiet stretch: Ada: "Why is it called Sunflower?" Astra: "Its arms spiral like
  the seeds of a sunflower."

Astra grows as her memory returns: tentative in the first galaxy, warmer and
surer through the middle of the route, and worried but steady from the fifth on.

Cartwheel:

- First arrival: Astra: "Cartwheel. I remember the noise of this place." Ada:
  "Noisy is good. Busy means people." (happy)
- Meeting the Cobbles, when Ada first nears the mining hub: Ada: "Astra, did
  that rock just wave at us?" (happy) Astra: "That's a Cobble. They're made of
  stone, and they eat the ore they mine." Ada: "Rocks that eat rocks!" (happy)
- Quiet stretch: Astra: "I used to rush everywhere. With you, I notice more."
  Ada: "That's what exploring is for." (happy)
- Quiet stretch: Astra: "Almost whole. I'm a little scared of that." Ada: "We'll
  do it together."

Whirlpool:

- First arrival: Astra: "Whirlpool. I'm sure of my course now, Navigator." Ada:
  "You sound more like yourself." (happy)
- Meeting the whale family, when Ada first sees them: Ada: "So many whales! Why
  do they sing like that?" (happy) Astra: "Whale songs carry far. It's how
  families find each other in the dark." Ada: "No wonder it missed them."
- Meeting the Voron, when Ada first nears a Voron station: Ada: "Who are the
  squid folk by the currents?" Astra: "The Voron. They ride the currents with
  the whales and write in glowing ink."
- Quiet stretch: Astra: "My maps feel fuller every day." Ada: "Our maps." (happy)
- Quiet stretch: Astra: "I'm glad it was you who found the rock." Ada: "Me too."
  (happy)
- First space current, once per save when Ada first enters a current: Astra: "A
  space current. Ride it for speed, or push across it." Ada: "Like a river in
  space!" (happy)

Needle:

- First arrival: Astra: "Needle. So thin, and so long." Ada: "Like a road made of
  stars."
- Meeting the Avi, as Elder Loom comes into view, before Elder Loom's arrival
  line: Ada: "Who's that, standing so still?" Astra: "An Avi. They wait and
  watch before they move. That's Elder Loom." Astra: "The young Avi pilots
  learn their channels from Elder Loom."
- Quiet stretch: Astra: "I used to jump without thinking. Now I like to look
  first." Ada: "Me too." (happy)
- Quiet stretch: Ada: "Do you dream, Astra?" Astra: "Not yet. Maybe I'll learn."

Andromeda:

- First arrival: Astra: "Andromeda. It feels like visiting a neighbor." Ada: "A
  very big, very bright neighbor." (happy)
- Meeting the Munix, when Ada first nears a settlers' station or settlement:
  Ada: "Are the settlers robots?" Astra: "They're Munix. They were built, like
  me, and they steer by beacon light." Ada: "So you have cousins out here!"
  (happy)
- Quiet stretch: Astra: "When I scattered my disks, I didn't tell anyone. Not
  even myself." Ada: "You can tell me now."
- Quiet stretch: Astra: "I like that you never pretend, Ada." Ada: "Penny can
  always tell when I do." (happy)

Phantom:

- First arrival: Astra: "Phantom. I don't like it here." Ada: "We'll face it
  together."
- Quiet stretch: Astra: "If I'm whole again, will you still fly with me?" Ada:
  "Always." (happy)
- Quiet stretch: Astra: "Whatever is waiting, I'm not running this time." Ada:
  "Neither am I."

## Greeters

On a first docking the greeting is one button that shows the next line on each
tap; its accessible name is "Next line".

Station keepers, first docking (three lines), then later dockings (one line, in
turn):

Sunflower, a Bumble keeper:

- "Bzz, hello! A new face at our station. I'm the keeper here."
- "We Bumbles hum while we work. It makes heavy jobs feel lighter."
- "Trade your Stardust, or take a job. Every bit of help counts."
- Later: "Welcome back! The whole station is humming today." / "Back again?
  Good. Many wings make light work." / "Hello, friend. The shop is open, and the
  job board is full."

Whirlpool, a Voron keeper:

- "Oh, a visitor! Welcome, welcome. I'm the keeper of this station."
- "We Voron ride the currents with the whales. They're our oldest friends."
- "Trade, rest or take a job. Mind the currents on your way out."
- Later: "Welcome back! The currents brought you right to us." / "Hello again.
  Eight arms, and every one of them waving at you." / "Back so soon? The whales
  were singing about you."

Needle, an Avi keeper:

- "Welcome, young pilot. Rest your wings. Well, your engines."
- "We Avi stand still a long time before we move. It helps us see clearly."
- "Trade, or take a job. There is no hurry here."
- Later: "Welcome back. Slowly in, slowly out." / "Ah, the young pilot. Your
  docking was very smooth." / "Hello again. Stay as long as you need."

Andromeda, a Munix keeper:

- "Hello, traveler! Come into the light. I'm the keeper of this station."
- "We Munix were built to follow the beacons. Their light shows us home."
- "Trade your Stardust, or take a job. We trade fairly here."
- Later: "Welcome back! Our lamps are always lit for you." / "Hello again,
  traveler. Safe flying out there?" / "Back again! Come in, out of the dark."

Cartwheel, Cobble keepers. Lines that mention the hub play only at the mining
hub.

The mining hub, Quartz:

- "Welcome to the hub! Mind the dust. I'm the keeper here."
- "We Cobbles are made of stone, so a little bump never bothers us."
- "Trade your Stardust, or take a job. There's room for everyone."
- Later: "Welcome back! Wipe your boots. Well, your thrusters." / "Hello again!
  Find any good rocks out there?" / "Back again. There's always room at the
  hub."

Every other Cartwheel station, Slate or Garnet:

- "Welcome! Mind the dust. I'm the keeper here."
- "We Cobbles are made of stone, so a little bump never bothers us."
- "Trade your Stardust, or take a job. There's room for everyone."
- Later: "Welcome back! Wipe your boots. Well, your thrusters." / "Hello again!
  Find any good rocks out there?" / "Back again. There's always room here."

Phantom, Admiral Archie as keeper once the chapter is complete:

- "Ah. The navigator. Welcome to the Blurbs' station."
- "I am helping mend their docks. It is slower than conquering, and better."
- "Trade, or take a job. The Blurbs insist I say please."
- Later: "Welcome back, Navigator." / "The docks are nearly mended. Mind the
  scaffolding." / "Astra still flies with you, I see. Good."

Andromeda settler, first approach to a settlement: Settler: "Hello! You found
our little settlement." Settler: "Mail comes by courier, and visitors come by
beacon light. Welcome!"

## Shared interface text

- Start screen: Ada the Navigator; Start on first launch, then Continue and
  Restart.
- Restart card: Restart? with Restart and Cancel.
- Galaxy map Earth button: Earth.
- Earth with nothing new: Narration: "Penny thumps her tail. Ready for another adventure?" then Pick up the rock.
- Use actions, each the disc's accessible name and drawn as a symbol: Talk,
  Deliver, Deposit, Tow, Salvage, Dock, and Use for any other interaction.
- Conversation buttons: Continue, Ask more.
- Disabled heavy banner: Disabled.
- Status labels: Shield, Cargo, Stardust, Ore.
- Item notices, always "+ {item}": "+ Holodisk", "+ Spare parts", "+ {weapon}",
  "+ {weapon} level {n}", "+ Shield level {n}", "+ Engine level {n}", "+ Tractor
  beam level {n}", "+ {paint} paint", "+ {weapon} ammo" and "+ {craft}" for a towed craft; merged repeats add
  " ×{n}".
- Ship card: Ship; Cargo: Stardust, Ore, Holodisks: {n} of 6, Carrying:
  {item}, Towing: {craft}; Equipment: Shield, Engine, Tractor beam and each owned weapon's name with Level {n} of 3, a weapon's ammunition
  as {count} left, and Paint: {paint}.
- Pause: Pause (button label), Paused, Map, Ship, Settings, Back to title, Resume. On Ada's room page: Settings, Back to title.
- Start screen top right: Achievements, Settings, Exit (label and accessible
  name Exit).
- Update offer: title "Update available", with Cancel and Update now.
- Settings rows, each with its note:
  - Move controls: "Touch still works when hidden"
  - Aim controls: "Touch still works when hidden"
  - Sound: "Mutes sound effects"
  - Reduced motion: "Skips screen shakes"
  - Install: "Full screen, offline", with an Install button
- Storybook pages: Previous, Next, Skip. Ada's room page, before boarding:
  Narration: "Ada's rock glows softly on her desk." then Pick up the rock.
- Galaxy map: Galaxy {number}, Earth, Jump, Stay here (on the galaxy Ada is
  flying in); Previous and Next as the
  accessible labels for Left and Right. A locked galaxy's name and text: ... A
  placeholder galaxy: its name and flavor text, then Story in development.
- Galaxy names and flavor text, in route order:
  - Sunflower: "Scattered outposts grow, build and salvage, each on
    their own."
  - Whirlpool: "Swirling debris, and a song somewhere in the dark."
  - Needle: "A thin silver line of stars, where nothing can be rushed."
  - Andromeda: "A great bright spiral, close enough to feel like a
    neighbor."
  - Cartwheel: "A busy mining hub where every rock is worth something."
  - Phantom: "Faint and ghostly, and something in it is watching."
- Local map: Map; {percent}% mapped; Travel here; Galaxies; Quests.
- Quests modal: Quests; Story complete.; Job: {objective}; Station job boards
  have more to do.; Explore to find something to do.
- Map with nothing discovered yet: No destinations mapped yet.
- Map tools, accessible labels: Center on Ada; Zoom in; Zoom out.
- Map place panel: under the place's name, a line naming its kind: Station,
  Outpost, Story place (other story destinations, such as the whale and its family;
  the mining hub is a Station), Holodisk, Nebula, Wreck or
  Beacon, then " · " and the distance from Ada. When the place is the held
  job's target, the job's "Job: {objective}" line follows. The holodisk
  waypoint's name is Lost holodisk. A job's own spot, such as a search area,
  shows the job title as its name and no type or "Job:" line.
- Map distance: world units divided by 1000, in light-years: one decimal below
  10 ("0.4 light-years"), whole numbers from 10 ("12 light-years"), en-US
  grouping, and "1 light-year" when it rounds to 1.
- Unavailable in danger: Unavailable while you are in danger.
- Shield depletion: Astra jumped you back to Earth to recharge. Your story progress is
  saved.
- Shield depletion that loses ore, after that line on the same page: Astra:
  "We're safe, and that matters most. We lost half the ore we were carrying."
- After the sleep scene, morning: Narration: "Astra recharges overnight. In the
  morning, the rock is warm again, and Gadget and Kiwi are curled at her feet."
- Station welcome: Welcome aboard. Trade your Stardust, or take a job.
- Crash screen: title "Something went wrong", text "The game stopped. Reload to
  play again.", button "Reload".
- Update required (a save from a newer version, shown while offline or until
  the newer version is available; it retries on its own): Connect to the
  internet to update Ada the Navigator.
- Saving failure: Couldn't save progress. You can keep playing, but recent
  progress may be lost if you close the game.
- Completed story, the notice when a chapter completes: Chapter complete. You
  can keep exploring.

### Carried item names

The status pill's carried segment, the Ship card and item notices name a
carried item, lost item or towed craft by its display name: the item's name
without an article, starting with a capital.

| Source                   | Display names                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sunflower story          | Food (growers), Tool kit (workshop), Spare parts (salvagers)                                                                        |
| Andromeda story          | Beacon parts                                                                                                                        |
| Supply run               | Fresh food, Repaired tools, Spare parts                                                                                             |
| Delivery jobs, Sunflower | Seeds, Spare parts, Message                                                                                                         |
| Delivery jobs, Whirlpool | Song shells, Star maps, Message                                                                                                     |
| Delivery jobs, Needle    | Thread spools, Glass beads, Message                                                                                                 |
| Delivery jobs, Andromeda | Beacon parts, Mail, Message                                                                                                         |
| Delivery jobs, Cartwheel | Ore samples, Drill bits, Message                                                                                                    |
| Lost-item hunts          | Toolbox, Watering can, Music shell, Whale-call whistle, Weaving shuttle, Silver bell, Courier's badge, Lantern, Lucky charm, Helmet |
| Towed craft              | Seed pod, Scrap barge, Current skimmer, Pod, Stuck glider, Lost courier, Drifting lamp buoy, Ore pod, Stuck hauler, Traveler's pod  |

Whirlpool, Needle and Cartwheel have no carried story item; Cartwheel's ore is
cargo, not a carried item.

## Install steps

Shown when the browser holds no install prompt. Title, then steps:

- iOS: "Add to Home Screen" / "Tap Share, then Add to Home Screen."
- Firefox for Android: "Add app to Home screen" / "Tap the menu, then More, then
  Add app to Home screen."
- Chrome or Edge for Android: "Install app" / "Tap the menu, then Add to Home
  screen or Install app."
- Samsung Internet: "Add to Home screen" / "Tap the menu, then Add page to, then
  Home screen."
- Chrome or Edge on a computer: "Install app" / "Choose Install in the address bar or
  the browser menu."
- Safari on a Mac: "Add to Dock" / "Choose File, then Add to Dock."
- Firefox on a computer: "Not available in Firefox" / "Firefox can't install this game.
  Open it in Chrome or Edge to install."
- Any other browser: "Install" / "Use your browser's menu to install it or
  add it to your home screen."

## Landing page

- Pitch: Explore space. Bring new ideas home.
- Subline and meta description: Join Ada on space adventures and help her community
  back home with what she learns.
- Mobile: Move with the left stick. Aim and fire with the right stick. Tap Use to
  interact. Each named control's icon follows its name.
- Desktop: Move with WASD. Aim and fire with the arrow keys. Press Space to
  interact and Escape to pause.
