// Sprite and primitive helpers the object and enemy drawing share.
// Functions over the scene's SpritesContext.
import { GameObjects } from "phaser";

import type { GameScene } from "./scene.ts";
import { type TaperShape } from "./weaponEffects.ts";

/** The scene state and methods this module's functions use. */
export type SpritesContext = Pick<GameScene, "add" | "enemySprites" | "overlay">;

/** A reusable sprite for an object, reset to opaque and untinted each frame. */
export function objectSprite(
  scene: SpritesContext,
  id: string,
  texture: string,
  frame?: number,
): GameObjects.Image {
  let sprite = scene.enemySprites.get(id);
  if (!sprite) {
    sprite = scene.add.image(0, 0, texture, frame).setDepth(2);
    scene.enemySprites.set(id, sprite);
  }
  return sprite.setTexture(texture, frame).setAlpha(1).clearTint().setRotation(0).setVisible(true);
}

/** A taper as two triangles whose vertex alphas run linearly from tail to head. */
export function drawTaper(
  scene: SpritesContext,
  shape: TaperShape,
  graphics: Phaser.GameObjects.Graphics = scene.overlay,
): void {
  const { colour, head, tail } = shape;
  const dx = head.at.x - tail.at.x;
  const dy = head.at.y - tail.at.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return;
  }
  const nx = -dy / length;
  const ny = dx / length;
  const side = (end: TaperShape["head"], sign: number) => ({
    x: end.at.x + (sign * nx * end.width) / 2,
    y: end.at.y + (sign * ny * end.width) / 2,
  });
  const tailLeft = side(tail, 1);
  const tailRight = side(tail, -1);
  const headLeft = side(head, 1);
  const headRight = side(head, -1);
  // Each triangle takes its three corners' alphas from the first three gradient slots.
  graphics.fillGradientStyle(colour, colour, colour, colour, tail.alpha, head.alpha, tail.alpha);
  graphics.fillTriangle(tailLeft.x, tailLeft.y, headLeft.x, headLeft.y, tailRight.x, tailRight.y);
  graphics.fillGradientStyle(colour, colour, colour, colour, head.alpha, head.alpha, tail.alpha);
  graphics.fillTriangle(headLeft.x, headLeft.y, headRight.x, headRight.y, tailRight.x, tailRight.y);
  graphics.fillStyle(colour, 1);
}
