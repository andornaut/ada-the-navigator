// The quantum jump's scenes, its cover and its end.
// Functions over the scene's JumpContext.
import { SCREEN } from "../data/screen.ts";
import { shipHeading } from "../model/nose.ts";
import { type JumpScene } from "../ui/jumpOverlay.ts";
import { sceneFit, viewShift } from "./playCamera.ts";
import type { GameScene } from "./scene.ts";

/** The scene state and methods this module's functions use. */
export type JumpContext = Pick<
  GameScene,
  "galaxies" | "jumping" | "model" | "scale" | "ship" | "specks" | "warpCover"
>;

/**
 * The scene the quantum jump plays over now, centred on the play view: the galaxy map with Ada's
 * route ship, the flight, or a page without her ship.
 */
export function jumpScene(scene: JumpContext): JumpScene {
  const flight = scene.model.state.flight;
  if (!scene.galaxies.isOpen() && scene.model.state.mode === "space" && flight) {
    return spaceJumpScene(scene);
  }
  const offset = viewShift(sceneFit(scene)).x;
  const center = { x: offset + SCREEN.width / 2, y: SCREEN.height / 2 };
  return {
    center,
    heading: scene.galaxies.isOpen() ? scene.galaxies.shipHeading() : null,
    specks: [],
  };
}

/** The flight as last drawn: the ship at the play view's centre and the visible specks. */
export function spaceJumpScene(scene: JumpContext): JumpScene {
  const offset = viewShift(sceneFit(scene)).x;
  const flight = scene.model.state.flight;
  return {
    center: { x: offset + SCREEN.width / 2, y: SCREEN.height / 2 },
    heading: flight ? shipHeading(flight.facing) : null,
    specks: scene.specks.map((speck) => ({ x: speck.x + offset, y: speck.y })),
  };
}

/** The warp ship draws over Ada's: hide hers, in flight and on the galaxy map, until the end. */
export function coverShip(scene: JumpContext): void {
  scene.warpCover = true;
  scene.ship.setVisible(false);
  scene.galaxies.coverShip();
}

export function endJump(scene: JumpContext): void {
  scene.jumping = false;
  scene.warpCover = false;
}
