# Ship prototype

- `public/art/ship.svg` is idle; `public/art/ship-thrust.svg` adds twin exhaust flames only. Hull, cockpit and engine geometry are identical.
- Both SVGs use a transparent 64 by 96 viewport, face up and have pivot (0.5, 0.5) at source coordinate (32, 48).
- The pointed hull runs from (32, 4) to rear shoulders near (8, 78) and (56, 78). Engines occupy the rear corners; the central tail is compact.
- Target display size is 32 by 48 logical pixels. Most cockpit details align to two-unit source steps for half-scale clarity. Ada sits on the left with brown skin and dark hair; Toronto sits on the right with tan fur and dark ears.
- Export or embed the complete viewport without trimming transparent margins. Preserve the common pivot and aspect ratio when switching states.
- Assets contain authored SVG paths with solid fills, no strokes, external images, fonts, scripts or filters.
