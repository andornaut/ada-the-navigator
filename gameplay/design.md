# Ada the Navigator: version one design

This document records the current version one design. Details labelled tentative
remain open. It describes intended behavior, not implemented features.
Future-version proposals belong in [ideas](ideas.md).

## Premise and protagonist

Ada is a 12-year-old girl living in Toronto with her mom, dad, two cats and a dog.
She is curious, intelligent and kind. She notices things she would like to improve
at school, in her neighborhood and in the wider world.

The playable Earth stories focus on problems in her community, family and
friendships. These are small in scale compared with her intergalactic adventures,
while still mattering to the people involved. Specific problems and solutions
have not been selected.

Ada enjoys finding, digging up and polishing rocks. She discovers a special rock
that reveals itself as a personal spaceship when she holds it. The rock form is
provisional. The ship carries Ada; whether her dog can accompany her is tentative.

## Travel rule

Whenever Ada travels, she returns to the same Earth moment at which she left.
To someone observing her at home, she appears never to have left. She does not
age through these journeys, but retains her experiences and knowledge.

She cannot demonstrate her absence to others, making her adventures difficult
to explain or substantiate. What she learns in space can help her act on problems
at home. Whether anything physical can return with her is unspecified.

## Two connected parts

### Toronto: interactive story

The Earth portion is an interactive story styled after choose-your-own-adventure
books, with choices involving Ada's local life. It continues throughout the game.
It is one ongoing part of the experience, rather than an introductory phase that
ends when space travel begins.

Ada learns about a community problem, explores space, then brings back knowledge
and experience that can help her community, family or friends. The particular
choices, branches, consequences and presentation are not yet defined.

### Space: isometric twin-stick shooter

Players control Ada's personal ship in sprite-based, isometric space adventures.
The ship appears relatively small and has an elongated triangular silhouette.
Its detailed appearance will be designed collaboratively. Sprites for approximately
eight facing directions, with animations, are the tentative visual approach.

Space play combines exploration, adventure and a search for useful knowledge.
Combat is part of the twin-stick shooter concept; enemies, weapons, damage,
failure and recovery rules are not yet specified.

## Core loop

1. Ada encounters a problem in her Toronto life through the interactive story.
2. She travels to a sector associated with that problem.
3. She explores, encounters challenges and discovers knowledge relevant to home.
4. She returns to the same Earth moment and uses what she learned in the story.
5. Further local problems lead to further adventures.

The exact conditions for discoveries, returning home and resolving a problem
remain open.

## Sectors and procedural generation

Each authored story problem has a themed space sector. A sector's layout and
encounters vary between visits. Sectors have distinct aspects, enemies, quests
and items, with discoveries relevant to their associated local problem.

Procedural levels support continued, effectively unlimited replay. How authored
quests and discoveries are placed within generated content is not yet defined.
The number of story problems and sectors is unspecified; unlimited replay does
not establish an unlimited supply of authored Earth stories.

## Mobile controls

- Left joystick: moves the ship independently of its facing direction.
- Right joystick: determines facing and firing direction. Deflecting it fires;
  centering it stops firing. Movement alone does not fire.
- Use button: planned for interactions; its exact actions remain open.

Chibi is the reference for settings and joystick behavior. Ada's left joystick
should follow Chibi's behavior. The spoken reference to “GP's controls” for the
use button has not been identified separately. Existing controls should be
reviewed before defining detailed interaction requirements. No code reuse or
implementation interface is established here.

## Version one scope

Version one includes the Toronto interactive story, themed procedural space
sectors, isometric twin-stick ship play, achievements and continued procedural
play after the story is complete. Achievements provide a reason to keep playing;
their individual requirements are not yet defined.

Upgrades, cosmetics and other horizontal or vertical progression are outside the
current version. Their possible forms are recorded in [ideas](ideas.md).

## Open design details

- Specific community problems, supporting characters, story branches and endings.
- The rock's final form, travel activation and whether the dog accompanies Ada.
- Sector themes, quests, items, enemies and discovery requirements.
- Combat, failure, recovery, return travel and story-resolution rules.
- Detailed ship visuals, animation requirements and interaction behavior.
- Achievement definitions and the structure of play after story completion.

These are unresolved design details, not implementation assignments.
