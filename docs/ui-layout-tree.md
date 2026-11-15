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

Runtime and fixture callers supply the same data, production styles, fonts, skins,
view-unit bridge and action availability. `presentAdaButton` supplies the actual
button presentation; the published availability binding guards execution.
`settle()` waits for fonts, explicit art readiness and image decoding before fitting
updated descendants. The caller's active-view predicate blocks dormant actions.
Reconciliation retains keyed component and slot identities.

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
