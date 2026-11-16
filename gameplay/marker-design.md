# Unified target markers

## Status and scope

Approved implementation contract with a shared range of **5,000 world units**.
At inspected source `96f0803a73e1ddd7e3bad0bf66d2077bd47c1d61`,
`src/data/targetMarkers.ts` supplies that range; `src/model/targetMarkers.ts`
implements stable entries, merged contributors, persistent knowledge, wrapped
resolution and range hiding; `src/ui/layout/targetMarkers.ts` implements edge
placement. Compatibility edge/Penny modules do not imply separate lifetimes.
Source presence is not full acceptance: all-edge rendered-pixel proof, complete
flow checks and the delivered revision remain unverified in this document.

## Contract

- One target has one stable ID and at most one marker. Ordinary markers, Penny
  sensing, quest destinations and explicit encounter triggers contribute to the
  same registry entry rather than creating competing markers.
- Known targets use their real icon, with no Penny question mark. An unknown
  sensed target uses `?`; actual visual identification changes that same entry
  to its real icon. Sensing alone does not identify the target.
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

## State and presentation

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
markers follow this placement rule. The 5,000 range, lifetime and knowledge/icon
rules remain unchanged.

## Phased implementation

| Phase | Planned work                                                                                                   | Ownership and exit evidence                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Define stable IDs, contributor merging, wrapped position resolution and shared 5,000 range.                    | Gameplay maintains this contract; Tech supplies reviewed registry/interface source.                                                           |
| 2     | Persist sensed/identified knowledge; reconstruct entries on Continue; reconcile explicit removal.              | Tech supplies focused state and save compatibility evidence.                                                                                  |
| 3     | Route ordinary, Penny, quest and triggered-boss contributions through unified eligibility and icon resolution. | Tech supplies integrated source; Gameplay checks discoverability and exception scope.                                                         |
| 4     | Share bearing-first edge rendering, raster rounding and overlap diagnostics.                                   | Tech integrates; Art inspects rendered states and viewports.                                                                                  |
| 5     | Verify acceptance flows and reconcile delivery evidence.                                                       | Gameplay compares contract to actual source, checks, integration and delivery; Tech retains runtime implementation and integration ownership. |

Assignment, queue admission and message acceptance are not completion. Record
exact implementation SHA and base, focused check evidence, integrated main SHA,
rendered acceptance and delivered revision separately. Keep unverified clauses
open; this plan grants no additional delivery authority.

## Acceptance matrix

These are planned acceptance cases, not executed checks.

Placement review covers projected bearing and actual visible pixels on all four
edges, at corners, under temporary HUD/dialogue overlap and in narrow viewports,
including scaled Penny `?` and known-target icons. Retain fractional rounding and
the three-logical-pixel small-corner exception. Component proof is not full
GameScene or physical-device acceptance; exact-one-pixel spacing and HUD
separation are not acceptance blockers.

| Case                                             | Required result                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Known target also sensed by Penny                | One marker with its real icon; no `?`.                                                                        |
| Unknown sensed target then visually identified   | One stable entry changes from `?` to its real icon.                                                           |
| Dialogue ends or a nearer target appears         | Existing eligible target remains marked.                                                                      |
| Range boundary, exit and re-entry                | Ordinary off-screen target qualifies at distance at most 5,000; outside range hides it, re-entry restores it. |
| Target crosses a world seam                      | Range and direction follow shortest wrapped displacement without duplicate identity.                          |
| Save/Continue with sensed and identified targets | Knowledge and eligible markers return without identification, scan or story advancement.                      |
| Target enters view, then leaves                  | Edge icon hides on screen and returns off screen while eligible.                                              |
| Destroyed/removed versus unloaded target         | Removal clears it; unloading preserves authoritative resolution and knowledge.                                |
| Multiple contributors, one removed               | One marker remains while another contribution qualifies.                                                      |
| Two nearby target directions                     | Both targets remain represented on their bearings; temporary overlap does not delete either target.           |
| Quest references an unknown destination          | Reference alone does not reveal identity; sensing and visual identification follow the shared rules.          |
| Explicit boss trigger outside range              | Only that encounter's target receives the far marker; termination removes its exception contribution.         |
