import type { GameObjects } from "phaser";

import { type ControlState, MOVE_STICK_GEOMETRY, STICK_GEOMETRY } from "../input/state.ts";
import type { ControlVisibility } from "./settings.ts";

interface StickView {
  readonly height: number;
  readonly showIdle: boolean;
  readonly visibility: ControlVisibility;
  readonly visible: boolean;
  readonly width: number;
}

export function drawSticks(
  graphics: GameObjects.Graphics,
  view: StickView,
  state: ControlState,
): void {
  graphics.clear();
  if (!view.visible) {
    return;
  }
  const radius = Math.min(STICK_GEOMETRY.reach, Math.max(12, (view.width - 48) / 4));
  const edge = radius + 20;
  for (const side of ["move", "aim"] as const) {
    const stick = state.stick(side);
    if (!view.visibility[side] || (!stick && !view.showIdle)) {
      continue;
    }
    if (side === "move") {
      const scale = state.movementScale;
      const reach = MOVE_STICK_GEOMETRY.reach;
      const centre = stick?.origin ?? {
        x: (reach + 20) / scale.x,
        y: view.height - (reach + 20) / scale.y,
      };
      const sampled = state.stickSample("move");
      const x = centre.x + (sampled.x * reach) / scale.x;
      const y = centre.y + (sampled.y * reach) / scale.y;
      graphics.lineStyle(5, 0x172335, 1);
      graphics.strokeEllipse(centre.x, centre.y, (reach * 2) / scale.x, (reach * 2) / scale.y);
      graphics.lineStyle(3, 0xfff8e6, 1);
      graphics.strokeEllipse(centre.x, centre.y, (reach * 2) / scale.x, (reach * 2) / scale.y);
      graphics.fillStyle(stick ? 0xffffff : 0xfff8e6, 1);
      graphics.fillEllipse(x, y, 10 / scale.x, 10 / scale.y);
      graphics.lineStyle(1, 0x172335, 1);
      graphics.strokeEllipse(x, y, 10 / scale.x, 10 / scale.y);
      continue;
    }
    const centre = stick?.origin ?? {
      x: view.width - edge,
      y: view.height - edge,
    };
    const dx = stick ? stick.position.x - centre.x : 0;
    const dy = stick ? stick.position.y - centre.y : 0;
    const divisor = Math.max(1, Math.hypot(dx, dy) / 12);
    graphics.lineStyle(5, 0x172335, 1);
    graphics.strokeCircle(centre.x, centre.y, radius);
    graphics.lineStyle(3, 0xfff8e6, 1);
    graphics.strokeCircle(centre.x, centre.y, radius);
    graphics.fillStyle(stick ? 0xffffff : 0xfff8e6, 1);
    graphics.fillCircle(centre.x + dx / divisor, centre.y + dy / divisor, 5);
    graphics.lineStyle(1, 0x172335, 1);
    graphics.strokeCircle(centre.x + dx / divisor, centre.y + dy / divisor, 5);
  }
}
