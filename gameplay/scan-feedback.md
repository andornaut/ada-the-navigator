# Scan feedback

## Status

Approved feedback semantics and exact Astra copy. At inspected source
`96f0803a73e1ddd7e3bad0bf66d2077bd47c1d61`, immutable `ScanOutcome`
emission/draining and the UI consumer/queue are implemented in
`src/model/scanOutcomes.ts`, `src/model/game.ts` and `src/ui/scanFeedback.ts`.
`src/data/landmarkScanCopy.ts` contains all four outcome sentences;
`src/model/scanOutcomeSpeech.ts` selects one intro and actual completions.
`src/game/sceneUi.ts` drains into the view, while the model submits the outcome
for Astra narration. Integrated source presence is verified at that pin; runtime
checks, delivered revision and rendered acceptance remain unverified here.
No scan mock-first or sequencing hold applies; independent guards remain.

## Approved semantics

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

## Remembered scan credit

Approved behavior, with model reconciliation present at the inspected source pin;
full flow acceptance remains unverified. Persist authoritative scan IDs independently of quest acceptance.
A scan alone never accepts or starts a quest.

When a quest is given, accepted or started after its required item was scanned,
immediately reconcile the requirement against the remembered scan ID. Tick the
already-known requirement and celebrate its completion without another visit or
scan. Complete the quest only when all its requirements are satisfied. Grant its
reward and emit each corresponding completion notice exactly once, including
across save/Continue or repeated reconciliation.

Use the same approved feedback distinction: a completed task shows a checkbox,
task text and related quest icon; a completed quest shows its quest icon and
quest name, with no checkbox or task icon. Astra acknowledges remembered credit
using the canonical outcome copy below.

The current exclusion of already-charted survey job offers must not discard a
valid accepted quest whose scan requirement was satisfied before acceptance.
Keep offer filtering separate from reconciliation of accepted quest progress.

## Canonical Astra outcome copy

Tech owns `src/data/landmarkScanCopy.ts`. Use these approved keys and strings:

| Key                 | Exact copy                        | Token source                                       |
| ------------------- | --------------------------------- | -------------------------------------------------- |
| `outcomeScan`       | `Scan complete: {target}.`        | `ScanOutcome.target.name`                          |
| `outcomeRemembered` | `We've already scanned {target}.` | `ScanOutcome.target.name`                          |
| `outcomeTask`       | `Task complete: {task}.`          | `ScanCompletion.task.text`, only for kind `task`   |
| `outcomeQuest`      | `Quest complete: {quest}.`        | `ScanCompletion.quest.name`, only for kind `quest` |

Astra receives one dialogue receipt per actual outcome. Select exactly one intro
from source `scan` or `remembered`, then append only actual completion sentences
in event order. An empty completions array adds no completion sentence. Do not
repeat the intro for each completion or infer tasks, quests or labels from the
nearest/current quest. The current single-condition Survey emits a quest
completion only, never a synthetic task completion.

Use shared safe token substitution. Do not add generic praise, invented rewards
or quest associations, restate objective counts, or claim all objectives are done
without an actual quest completion. Continue must not reconstruct outcome events
or replay rewards.

## Completion presentation

The rectangle originates at the scanned object, moves continuously straight up
toward the top and fades. Its vertical path is chosen once, clear of the HUD,
and stops below any HUD element above it. Astra's dialogue draws over the
rectangle; the rectangle never hops, dodges or moves sideways around dialogue.
With reduced motion it stays at its starting position.
Art retains rendered visual review and Tech retains implementation. Review task
and quest treatments, start/mid/top states, and placement against Astra dialogue
and the HUD. No scan mock-first or sequencing hold applies. Independent input,
story, placement and acceptance guards remain. Scene wiring is present at the
inspected pin; its presence is not delivery or
rendered acceptance evidence.

## Quest details through contextual Use

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

## Acceptance and handoff

The following cases are planned acceptance requirements, not executed checks.

| Case                                           | Required result                                                                                                 | State / owner                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Scan succeeds while its instruction is visible | Stale Scan instruction disappears for that target.                                                              | Source invalidation implemented; acceptance unverified: Tech.       |
| Ordinary scan completes                        | Feedback does not claim task or quest completion.                                                               | Copy and scene wiring present; runtime acceptance unverified: Tech. |
| Task completes                                 | Checkbox, task text and related quest icon.                                                                     | Semantics approved; integrated flow acceptance unverified.          |
| Quest completes                                | Quest icon and quest name; no checkbox or task icon.                                                            | Semantics approved; integrated flow acceptance unverified.          |
| Completion motion                              | Rectangle starts at scanned object, moves toward top and fades without obscuring required HUD/dialogue content. | Consumer and scene wiring present; rendered acceptance unverified.  |

Remembered-credit acceptance requires scan-before-quest, partial and full
requirement completion, no scan-triggered auto-acceptance, immediate recognition
without revisiting, save/Continue, repeated reconciliation without duplicate
rewards/notices, and accepted-quest retention despite survey-offer filtering.
No outcome or reward may be reconstructed solely to replay feedback on Continue.

Contextual Use acceptance requires focused evidence for immediate-action
priority, repeatable Dock on every visit, Scan before and after completion,
unchanged station quest access, direct details return, multiple
linked quests, existing gesture safeguards and the rendered centered quest icon.
These contextual Use checks remain independent of scan-feedback acceptance.

Gameplay maintains this contract and compares it with actual source, check,
integration, delivery and acceptance evidence. Tech retains implementation and
integration ownership; Art retains mock production and rendered visual review.
Track each stage separately with exact source and base pins. A routed request or
assigned mock is not implementation, integration, delivery or acceptance proof.
