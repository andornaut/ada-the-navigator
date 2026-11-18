# Art

Art owns the art rules, asset specifications and pipeline in [art/](../../art/README.md); assets ship from `public/art/`.

- Layout: screen geometry, HUD placement and the modal width families (Large 688, Medium 500, Small 400, inset by a 16 px screen margin) are in [layout](../../art/layout.md).
- Space: placeholders stay monochrome apart from Ada's white-and-blue ship. Every play object draws over an ink keyline, and palette roles are in [space palette](../../art/space-palette.md).
- Ships and jets: hull, flame layers and the logical-size jet rule are in [ship](../../art/ship.md).
- Map: the local map, galaxy selector and survey header are in [map](../../art/map.md).
- Producers: generated assets come from `art/tools/` and are pinned by hash in `public/art/manifest.json`.

Reference: [art](../../art/README.md).

## Work items

| ID       | Title                                                                 | Link                               |
| -------- | --------------------------------------------------------------------- | ---------------------------------- |
| ada-0007 | Replace the survey beacon pedestal with symmetric solar panels        | [ada-0007.md](../work/ada-0007.md) |
| ada-0008 | Document the player jet materials, small core and middle band         | [ada-0008.md](../work/ada-0008.md) |
| ada-0009 | Encode the quantum jump sheets as lossy WebP quality 90               | [ada-0009.md](../work/ada-0009.md) |
| ada-0010 | Place the sticks and shield pill and specify the threat-red hit flash | [ada-0010.md](../work/ada-0010.md) |
| ada-0011 | Align the Ship card and ship keyline specs with the rendered game     | [ada-0011.md](../work/ada-0011.md) |
| ada-0012 | Size modals by width family with Large cards at 688                   | [ada-0012.md](../work/ada-0012.md) |
| ada-0013 | Place the Interaction close X, story Skip faces and 844x390 HUD row   | [ada-0013.md](../work/ada-0013.md) |
| ada-0014 | Match the map tools and galaxy selector specs to source               | [ada-0014.md](../work/ada-0014.md) |
