import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { setTextureFilters } from "@andornaut/game-kit/view/phaser/textureFilter";
import { densityTexels } from "@andornaut/game-kit/view/renderScale";
import { GameObjects, Scene, Textures } from "phaser";

import type { UseAction } from "../model/types.ts";
import {
  isTouchChromePose,
  type Point,
  SPEED_LINE_CAP,
  SPEED_LINE_CAPSULE,
  speedLineLayers,
  speedLinePlacement,
  TOUCH_CHROME_ALPHA,
  TOUCH_CHROME_COLOURS,
  TOUCH_CHROME_FRAME,
  TOUCH_CHROME_SHEETS,
  TOUCH_KNOB_FRAME,
  type TouchChromeKind,
  type TouchChromeLayer,
  touchChromeLayers,
  touchChromePixel,
  type TouchChromePose,
  USE_CALLOUT_CENTRE,
  USE_CALLOUT_FRAME,
  USE_DISC_POSES,
  USE_SYMBOLS,
  useCalloutLayers,
  useDiscLayers,
  type UseDiscPose,
} from "../ui/touchChrome.ts";

export const UI_MANIFEST_KEY = "ui-manifest";
const UI_MANIFEST_PATH = "/art/ui/manifest.json";
const UI_ROOT = "/art/ui/";

interface UiSprite {
  readonly json: string;
  readonly key: string;
  readonly once?: readonly string[];
}

interface UiManifest {
  readonly sprites?: readonly UiSprite[];
}

const SHEET_KEYS = [...new Set(Object.values(TOUCH_CHROME_SHEETS))];

// Queues the UI manifest and, once it loads, the joystick sheets it lists.
export function preloadTouchChrome(scene: Scene): void {
  scene.load.once(`filecomplete-json-${UI_MANIFEST_KEY}`, () => {
    const manifest = scene.cache.json.get(UI_MANIFEST_KEY) as UiManifest | undefined;
    for (const sprite of manifest?.sprites ?? []) {
      if (SHEET_KEYS.includes(sprite.key)) {
        scene.load.json(sprite.key, `${UI_ROOT}${sprite.json}`);
      }
    }
  });
  scene.load.json(UI_MANIFEST_KEY, UI_MANIFEST_PATH);
}

type Size = { readonly height: number; readonly width: number };

// What a chrome texture is painted from, kept on it so it can paint again at a new scale.
interface ChromePaint {
  readonly frames: ReadonlyMap<string, readonly TouchChromeLayer[]>;
  readonly logical: Size;
  scale: number;
}

const paintOf = (texture: Textures.Texture): ChromePaint =>
  (texture.customData as { chrome: ChromePaint }).chrome;

// Paints texture's frames from paint at scale texels per logical px, one texel of clear edge
// around each, resizing the canvas and the frames in place.
function paintChrome(texture: Textures.CanvasTexture, paint: ChromePaint, scale: number): void {
  const width = densityTexels(scale, paint.logical.width);
  const height = densityTexels(scale, paint.logical.height);
  const texels = width / paint.logical.width;
  const stride = width + 2;
  texture.setSize(stride * paint.frames.size, height + 2);
  const context = texture.getContext();
  context.clearRect(0, 0, texture.width, texture.height);
  let column = 0;
  for (const [frame, layers] of paint.frames) {
    const image = context.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        image.data.set(
          touchChromePixel(texels, layers, {
            x: (x + 0.5) / texels,
            y: (y + 0.5) / texels,
          }),
          4 * (y * width + x),
        );
      }
    }
    context.putImageData(image, column * stride + 1, 1);
    if (texture.has(frame)) {
      texture.get(frame).setSize(width, height, column * stride + 1, 1);
    } else {
      texture.add(frame, 0, column * stride + 1, 1, width, height);
    }
    column++;
  }
  texture.refresh();
  paint.scale = scale;
}

function createChromeTexture(
  scene: Scene,
  scale: number,
  key: string,
  logical: Size,
  frames: ReadonlyMap<string, readonly TouchChromeLayer[]>,
): void {
  const texture = scene.textures.createCanvas(key, 1, 1);
  if (!texture) {
    throw new Error(`Cannot create ${key}`);
  }
  const paint: ChromePaint = { frames, logical, scale };
  texture.customData = { chrome: paint };
  paintChrome(texture, paint, scale);
  setTextureFilters(scene.textures, new Map([[key, "linear"]]));
}

// A joystick part drawn from its sheet's frames and tags, painted at scale texels per logical px,
// or undefined while the UI manifest lists no such sheet. Textures and animations live for the
// game; the sprite belongs to scene.
export function createTouchChrome(
  scene: Scene,
  scale: number,
  kind: TouchChromeKind,
): GameObjects.Sprite | undefined {
  const source = TOUCH_CHROME_SHEETS[kind];
  const sheet = scene.cache.json.get(source) as AsepriteSheet | undefined;
  if (!sheet) {
    return undefined;
  }
  const tags = sheetTags(sheet);
  const key = `touch-chrome-${kind}`;
  const logical = kind === "knob" ? TOUCH_KNOB_FRAME : TOUCH_CHROME_FRAME;
  if (!scene.textures.exists(key)) {
    const poses = new Map<string, TouchChromePose>();
    for (const [tag, frames] of tags) {
      if (isTouchChromePose(tag)) {
        for (const { frame } of frames) {
          poses.set(frame, tag);
        }
      }
    }
    createChromeTexture(
      scene,
      scale,
      key,
      { height: logical, width: logical },
      new Map(
        [...poses].map(([frame, pose]) => [
          frame,
          touchChromeLayers(TOUCH_CHROME_COLOURS, kind, pose),
        ]),
      ),
    );
    const manifest = scene.cache.json.get(UI_MANIFEST_KEY) as UiManifest | undefined;
    const once = manifest?.sprites?.find((entry) => entry.key === source)?.once ?? [];
    for (const [tag, frames] of tags) {
      if (isTouchChromePose(tag)) {
        scene.anims.create({
          frames: frames.map(({ duration, frame }) => ({ duration, frame, key })),
          key: animationKey(key, tag),
          repeat: tagRepeat(once, tag),
        });
      }
    }
  }
  const rest = tags.get("rest")?.[0]?.frame;
  return scene.add
    .sprite(0, 0, key, rest)
    .setOrigin(0)
    .setDisplaySize(logical, logical)
    .setAlpha(TOUCH_CHROME_ALPHA);
}

// Plays the part's tag unless it already shows it.
export function showTouchChrome(sprite: GameObjects.Sprite, tag: TouchChromePose): void {
  const key = animationKey(sprite.texture.key, tag);
  if (sprite.anims.currentAnim?.key !== key && sprite.scene.anims.exists(key)) {
    sprite.play(key);
  }
}

const USE_DISC_KEY = "touch-chrome-use";

/** The Use disc frame for an action and pose. */
export const useDiscFrame = (action: UseAction, pose: UseDiscPose): string => `${action}-${pose}`;

// The Use disc: every action's symbol in every pose, painted procedurally like the rings at scale
// texels per logical px, as one sprite that shows the frame useDiscFrame names.
export function createUseDisc(scene: Scene, scale: number): GameObjects.Sprite {
  if (!scene.textures.exists(USE_DISC_KEY)) {
    const frames = new Map<string, ReturnType<typeof useDiscLayers>>();
    for (const action of Object.keys(USE_SYMBOLS) as UseAction[]) {
      for (const pose of USE_DISC_POSES) {
        frames.set(useDiscFrame(action, pose), useDiscLayers(TOUCH_CHROME_COLOURS, action, pose));
      }
    }
    createChromeTexture(
      scene,
      scale,
      USE_DISC_KEY,
      { height: TOUCH_CHROME_FRAME, width: TOUCH_CHROME_FRAME },
      frames,
    );
  }
  return scene.add
    .sprite(0, 0, USE_DISC_KEY, useDiscFrame("use", "rest"))
    .setOrigin(0)
    .setDisplaySize(TOUCH_CHROME_FRAME, TOUCH_CHROME_FRAME)
    .setAlpha(TOUCH_CHROME_ALPHA);
}

const USE_CALLOUT_KEY = "touch-chrome-callout";

// The Use callout above a destination: every action's callout painted procedurally like the Use
// disc at scale texels per logical px, as one hidden sprite with its origin on O that shows the
// frame named by the action.
export function createUseCallout(scene: Scene, scale: number): GameObjects.Sprite {
  if (!scene.textures.exists(USE_CALLOUT_KEY)) {
    createChromeTexture(
      scene,
      scale,
      USE_CALLOUT_KEY,
      USE_CALLOUT_FRAME,
      new Map(
        (Object.keys(USE_SYMBOLS) as UseAction[]).map((action) => [
          action,
          useCalloutLayers(TOUCH_CHROME_COLOURS, action),
        ]),
      ),
    );
  }
  return scene.add
    .sprite(0, 0, USE_CALLOUT_KEY, "use")
    .setOrigin(
      USE_CALLOUT_CENTRE.x / USE_CALLOUT_FRAME.width,
      USE_CALLOUT_CENTRE.y / USE_CALLOUT_FRAME.height,
    )
    .setDisplaySize(USE_CALLOUT_FRAME.width, USE_CALLOUT_FRAME.height)
    .setVisible(false);
}

const SPEED_LINE_KEY = "touch-chrome-line";

// The speed line's texels per logical px: its capsule's painted width over its logical width.
function lineTexels(slice: GameObjects.NineSlice): number {
  return slice.frame.width / SPEED_LINE_CAPSULE.width;
}

// Fits slice's end caps and scale to its texture's current paint.
function fitSpeedLine(slice: GameObjects.NineSlice): void {
  const texels = lineTexels(slice);
  const cap = SPEED_LINE_CAP * texels;
  slice.setSlices(slice.frame.width, slice.frame.height, cap, cap, 0, 0, true);
  slice.setScale(1 / texels);
}

// A joystick's speed line: the capsule frame, painted at scale texels per logical px, as a
// three-slice whose middle stretches to the line's length, hidden until showSpeedLine places it.
export function createSpeedLine(scene: Scene, scale: number): GameObjects.NineSlice {
  if (!scene.textures.exists(SPEED_LINE_KEY)) {
    createChromeTexture(
      scene,
      scale,
      SPEED_LINE_KEY,
      SPEED_LINE_CAPSULE,
      new Map([["line", speedLineLayers(TOUCH_CHROME_COLOURS)]]),
    );
  }
  const frame = scene.textures.getFrame(SPEED_LINE_KEY, "line");
  const cap = SPEED_LINE_CAP * (frame.width / SPEED_LINE_CAPSULE.width);
  const slice = scene.add.nineslice(0, 0, SPEED_LINE_KEY, "line", frame.width, 0, cap, cap);
  fitSpeedLine(slice);
  return slice.setAlpha(TOUCH_CHROME_ALPHA).setVisible(false);
}

// Paints every touch chrome texture again at scale texels per logical px, keeping each part's
// display size: the sticks' sprites at their frames' logical size, the speed lines refitted.
export function rasterTouchChrome(scene: Scene, scale: number): void {
  const textures = Object.keys(TOUCH_CHROME_SHEETS)
    .map((kind) => `touch-chrome-${kind}`)
    .concat(USE_DISC_KEY, USE_CALLOUT_KEY, SPEED_LINE_KEY)
    .filter((key) => scene.textures.exists(key))
    .map((key) => scene.textures.get(key) as Textures.CanvasTexture);
  for (const texture of textures) {
    const paint = paintOf(texture);
    if (paint.scale === scale) {
      continue;
    }
    paintChrome(texture, paint, scale);
    for (const child of scene.children.list) {
      if (child instanceof GameObjects.Sprite && child.texture === texture) {
        child.setSizeToFrame(child.frame).setDisplaySize(paint.logical.width, paint.logical.height);
      } else if (child instanceof GameObjects.NineSlice && child.texture === texture) {
        // showSpeedLine sizes it to its line again on the next draw.
        fitSpeedLine(child);
      }
    }
  }
}

// Draws the line from the stick's origin to the thumb, however far it reaches, or hides it.
export function showSpeedLine(
  slice: GameObjects.NineSlice,
  line: { readonly from: Point; readonly to: Point } | undefined,
): void {
  slice.setVisible(line !== undefined);
  if (line) {
    const { angle, from, length } = speedLinePlacement(line);
    const texels = lineTexels(slice);
    slice.setSize((length + 2 * SPEED_LINE_CAP) * texels, SPEED_LINE_CAPSULE.height * texels);
    // The origin sits on the starting cap's centre, so the line pivots on the stick's origin.
    slice.setOrigin(SPEED_LINE_CAP / (length + 2 * SPEED_LINE_CAP), 0.5);
    slice.setPosition(from.x, from.y).setRotation(angle);
  }
}
