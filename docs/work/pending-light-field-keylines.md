---
id: TBD
title: Outline every play object on the light galaxy fields
status: approved
approved: user, 2026-11-19, outline all play objects
design: art
related: [ada-0306]
---

## Scope

On light galaxy fields, every non-backdrop object draws over the ink keyline: Needle gates, channel lights, channel debris and Elder Loom's saucer; Andromeda guide beacons and Pip; Cartwheel mooring buoy, Miner, Visitors, Blocker and turret platform; Whirlpool whales; and enemy jets as part of their craft's silhouette. Fills keep their colours. Backdrop paint (band specks, stars, the edge stitch) stays field paint. Needle's build checks move from the old dark field to the current field, with the keyline as the floor on light fields. Tech's renderer draws the keylines.

## Criteria

- `lightField.keylined` names every play object family on the light fields, with its keyline width.
- Every producer's contrast check measures against the current field and passes, rerunning byte-identical.
- Rendered proofs per light galaxy at 1280x720 and 720x360 show every listed object reading against the field.

## Decisions

## Outcome
