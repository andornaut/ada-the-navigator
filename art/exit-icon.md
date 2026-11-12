# Exit navigation icon

The start screen's Exit disc, the rightmost HUD disc where the platform can
close the app, draws `public/art/ui/icons/exit.svg` as its glyph mask: a 20x20
single-colour vector after Archie's `icon-exit` (`archies-dog-walks`
`public/art/images/icon-exit.png`), a door frame open on the right with an arrow
leaving through the gap. Frame bars and the shaft are 2 wide; the arrow head is
8 tall with its tip at x 18.5. Cream `#ead4aa`, drawn as a CSS mask in the HUD
button's glyph colour with smooth sampling, in the
[nav disc states](achievements-icon.md#states). `art/tools/settings-icons.ts`
writes it with the other start screen nav glyphs. Placement is in
[Layout](layout.md#start-screen).
