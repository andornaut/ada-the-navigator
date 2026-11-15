# Typed layout consumers

GameKit 0.41 supplies the typed tree and DOM reconciler. The local adapter wraps
`createCard`, `createButton`, `createActions` and `createProse`; it does not interpret
expressions or implement another renderer. Action registries, current availability,
modal lifecycle and return context stay outside tree data.

`stationDropTree` and `mountStationDropDetails` in
[src/ui/stationDropDetails.ts](../src/ui/stationDropDetails.ts) serve the station's
job/activity Drop confirmation and the isolated component fixture. Other station
views retain their existing production components. The confirmation preserves its
small card, authored labels, secondary Cancel and primary Drop actions.

`restartTree` in [src/ui/restartTree.ts](../src/ui/restartTree.ts) supplies the
Restart confirmation through the same card and button ports. The small card keeps
its secondary Cancel and primary Restart actions. A footer-only card sets `body:
false` to omit the empty content slot. Restart's caller retains dismissal, focus,
press scope and the original restart callback; callbacks are not stored in tree data.

Runtime and fixture callers supply the same data, production styles, fonts, skins,
view-unit bridge and action availability. `presentAdaButton` supplies the actual
button presentation; the published availability binding guards execution.
`settle()` waits for fonts, explicit art readiness and image decoding before fitting
updated descendants. The caller's active-view predicate blocks dormant actions.
Reconciliation retains keyed component and slot identities. `fit()` requests the
native card fit for an already shown view; it does not make physical inspection
ready. Call `settle()` before interpreting the measurement report.

```ts
const detail = mountStationDropDetails(
  { active, artReady, availability, onCancel, onDrop },
  host,
  data,
);
await detail.settle();
const evidence = detail.inspect(viewport);
```

The viewport and physical measurements use the production view bridge's logical
units. The inspector in
[src/ui/layoutTreeMeasurements.ts](../src/ui/layoutTreeMeasurements.ts) retains one
current keyed DOM snapshot. It reports available and required rectangles, actual
text fragments, clipping and overlaps, including native title and Close controls.
Card capacity comes from its modal's measured content box, including the canonical
Close hit area. Integer scroll dimensions do not replace subpixel text geometry.

Hidden, disconnected, zero-size or missing evidence yields `unavailable`. A pending
font/art fit also stays unavailable. Actual scroll/clipping remains visible in the
report; it cannot establish fit by hiding excess content. Physical reports and
rendered artifacts are both required for visual review.

Shop offer rows and purchase-detail headers share `createStationItemIcon` from
[src/ui/stationItemIcon.ts](../src/ui/stationItemIcon.ts). The caller's existing
item descriptor selects the canonical sprite, weapon upgrade composite or paint
swatch. Header icons are decorative and preserve the visible item name. Rendering
an additional header icon does not move or replace the row's icon.

## Galaxy selector

Earth is a selectable marker centered inside the route arc, aligned vertically with Sunflower. Its panel uses the canonical `story-ada-room` asset, Home kicker and Earth title. One centered primary action names the selected destination: Jump to Earth, Jump to the galaxy, Stay on Earth or Stay in the current galaxy. There is no separate Back action. A current-location action invokes the contextual close callback without travel; other destinations retain the existing return-home/jump callbacks and unlock checks. Locked destination actions retain their refusal behavior while naming the destination.

## Detail actions

Ada detail rows do not display decorative right-angle brackets or disclosure
chevrons to indicate click or tap. Retain their action targets, accessible names,
keyboard activation and focus. Directional controls and meaningful navigation or
route arrows retain their existing meaning. Production and mock callers use the
same detail components.

## Quest details

Each detail has one Objectives checklist, contextual description and a separate Reward. The first unchecked row is the next action. Checklist facts retain known completed deliveries and actual deposit quantities. Hunt collection completes the job without adding a return step. Unknown locations do not supply identity icons. Known targets use canonical map or inventory icons beside the shared read-only completion indicator. The existing two-column detail card and return actions are retained. Reward sits below Objectives while the contextual description and route span both rows.

## Contextual quest route port

`createQuestsScreen.openContext({ targetId, quests })` consumes only the active quest entries already selected by the canonical model resolver. It does not infer object links, ranges or availability from location labels. One quest opens details with Close to gameplay. Multiple quests open a filtered existing list; detail Back and X return to that list, and list Close and X dismiss to gameplay. Normal station/list entry remains unfiltered. `questContextIcon` supplies an existing canonical icon without a question-mark fallback. This route port does not wire contextual Use or adopt an unchecked model getter.

Accepted Use samples read `GameModel.contextQuestDetails` again before opening a
quest view. A null getter forwards the original Use sample to the model, so
current real actions, including every Dock visit, retain priority. A successful
quest open consumes that sample and clears movement/fire for the opening frame.
Both single and filtered plural routes have gameplay as their outer return;
plural detail Back returns to its filtered list. The existing Use ring displays
the canonical quest target icon at its rendered centre without a new action ID
or world pointer target.
