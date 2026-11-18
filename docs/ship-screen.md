# Ship inventory

Ship opens from Pause and presents Cargo, Equipment and Weapons in three columns.
Weapons includes ammunition on each weapon row. The modal uses the shared Large
688 logical pixel width family, clamped to the game area inset by the 16 logical
pixel screen margin.
The Weapons column takes its natural content width; Cargo and Equipment share
the remaining width. Inventory does not scroll or paginate.

Every item retains its existing icon and opens details by canonical item kind and
identity. Display labels do not determine routing. Dismissing resource, equipment,
weapon or held-cargo quest details returns to the same Ship screen and item focus.
Ship's own Back returns to Pause.

Equipment and weapon names append a bracketed level above level one. Level-one
names have no suffix. Cargo, currencies and paint have no level. Accessible level
text retains the full level description.

Column separators use the shared control-presentation factory. Ship does not
define separator colors or thicknesses. Item rows have no decorative detail
chevrons; their buttons, accessible labels and detail routing remain available.
Inventory and detail views do not change purchases, ownership, quest progress or
story state.
