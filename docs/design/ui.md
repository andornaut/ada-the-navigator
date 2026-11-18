# UI

The interface is HTML over the Phaser canvas. Cards, buttons, actions and prose come from the
pinned game-kit typed layout tree through a local adapter; action registries, availability,
modal lifecycle and return context stay outside tree data. The Ship inventory and the read-only
completion indicators use shared presentation factories and stylesheet. The 720 by 360 play view stays centred while the canvas fills the available space,
and portrait touch screens turn the page frame to landscape.

Reference: [UI layout tree](../ui-layout-tree.md), [ship screen](../ship-screen.md),
[completion indicators](../completion-indicators.md), [Phone](../../src/README.md#phone).

## Work items

| ID       | Title                                                                           | Link                               |
| -------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| ada-0001 | Centre the game area in iPhone portrait                                         | [ada-0001.md](../work/ada-0001.md) |
| ada-0003 | Hide the parent dim when Settings opens over Pause or Menu                      | [ada-0003.md](../work/ada-0003.md) |
| ada-0004 | Remove the galaxy map close-button layout and align its header and danger panel | [ada-0004.md](../work/ada-0004.md) |
