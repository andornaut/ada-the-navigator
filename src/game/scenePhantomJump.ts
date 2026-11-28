import jumpData from "../../public/art/quantum-jump.json" with { type: "json" };
import { type AllyJump, type AllyJumpStep, allyJumpStep, readQuantumJump } from "../art/index.ts";
import { toScreen } from "../model/convex.ts";
import type { Vec } from "../model/types.ts";
import type { ObjectsContext } from "./sceneObjects.ts";
import type { Asset } from "./sceneShared.ts";
import { objectSprite, whiteSilhouette } from "./sceneSprites.ts";

const iris = readQuantumJump(jumpData)!.iris;
type StretchGroup = ReturnType<ObjectsContext["add"]["container"]>;
const stretched = new WeakMap<ObjectsContext, Map<string, StretchGroup>>();
export interface AllyPresentation {
  readonly opacity: number;
  readonly zoom: number;
  readonly step?: AllyJumpStep;
}

export function allyJumpDuration(jump: AllyJump, reducedMotion: boolean): number {
  return reducedMotion ? jump.fadeMs : jump.out.reduce((duration, step) => duration + step.ms, 0);
}

export function allyPresentation(
  jump: AllyJump,
  direction: "in" | "out",
  age: number,
  reducedMotion: boolean,
): AllyPresentation | undefined {
  if (age < 0) {
    return undefined;
  }
  if (reducedMotion) {
    const share = Math.min(age / jump.fadeMs, 1);
    const opacity = direction === "in" ? share : 1 - share;
    return opacity ? { opacity, zoom: 1 } : undefined;
  }
  const step = allyJumpStep(jump[direction], age);
  if (!step && direction === "out") {
    return undefined;
  }
  return { opacity: 1, ...(step ? { step } : {}), zoom: step?.scale ?? 1 };
}

export function clearPhantomJump(scene: ObjectsContext): void {
  for (const group of stretched.get(scene)?.values() ?? []) {
    group.setVisible(false);
  }
}

function drawJumpAsset(
  scene: ObjectsContext,
  { at, depth, id, scale }: { at: Vec; depth: number; id: string; scale: number },
  texture: string,
  name: string,
): void {
  const asset = scene.manifest.assets.find((item) => item.id === texture);
  const frame = asset?.frames?.[name];
  if (frame === undefined || !scene.textures.exists(texture)) {
    return;
  }
  objectSprite(scene, `${id}#jump:${texture}`, texture, frame)
    .setOrigin(0.5)
    .setPosition(at.x, at.y)
    .setDisplaySize(asset!.displayWidth! * scale, asset!.displayHeight! * scale)
    .setDepth(depth);
}

export function paintAllyJump(
  scene: ObjectsContext,
  jump: AllyJump,
  view: AllyPresentation,
  at: Vec,
  id: string,
  frame: Asset,
  depth: number,
): void {
  const step = view.step;
  if (!step) {
    return;
  }
  if (step.glow) {
    drawJumpAsset(
      scene,
      { at, depth: depth - 3e-6, id, scale: frame.displayWidth! / jump.glowReference },
      "quantum-jump-glow",
      step.glow,
    );
  }
  if (step.star) {
    drawJumpAsset(scene, { at, depth: depth + 1e-6, id, scale: 1 }, "quantum-jump-star", "jump");
  }
  if (step.iris) {
    const radius = step.iris * frame.displayWidth!;
    const { line, rim } = iris;
    const colour = (value: string) => Number.parseInt(value.slice(1), 16);
    scene.overlay
      .lineStyle(rim.to - rim.from, colour(rim.colour), 1)
      .strokeCircle(at.x, at.y, radius + (rim.from + rim.to) / 2)
      .lineStyle(line.width, colour(line.colour), 1)
      .strokeCircle(at.x, at.y, radius + line.at);
  }
}

/** Rotate a parent and counter-rotate the art before stretching in the projected direction. */
export function drawStretchedAlly(
  scene: ObjectsContext,
  view: AllyPresentation,
  state: { at: Vec; depth: number; facing: Vec; id: string },
  frame: Asset,
): void {
  let groups = stretched.get(scene);
  if (!groups) {
    groups = new Map();
    stretched.set(scene, groups);
  }
  const { at, depth, facing, id } = state;
  let group = groups.get(id);
  if (!group) {
    group = scene.add.container(at.x, at.y);
    groups.set(id, group);
  }
  const projected = toScreen(facing);
  const angle = Math.atan2(projected.y, projected.x);
  group
    .setPosition(at.x, at.y)
    .setDepth(depth)
    .setVisible(true)
    .setRotation(angle)
    .setScale(view.step?.stretch ?? 1, 1);
  const image = (layer: string) => {
    const sprite = objectSprite(scene, `${id}#stretched:${layer}`, frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(0, 0)
      .setRotation(-angle);
    if (sprite.parentContainer !== group) {
      group.add(sprite);
    }
    return sprite;
  };
  image("hull");
  if (view.step?.white) {
    whiteSilhouette(image("white"), view.step.white);
  }
}
