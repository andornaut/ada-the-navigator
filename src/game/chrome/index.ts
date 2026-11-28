import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/runtime/art/aseprite";
import { setTextureFilters } from "@andornaut/game-kit/runtime/view/phaser/textureFilter";
import { GameObjects, Scene, Textures } from "phaser";

import { chromeAtlasGrid } from "../../art/index.ts";
import { TOUCH_CHROME_SHEETS, type TouchChromeKind } from "../../data/layout.ts";
import type { UseAction } from "../../model/types.ts";
import {
  isTouchChromePose,
  layerBounds,
  type Point,
  SPEED_LINE_CAP,
  SPEED_LINE_CAPSULE,
  speedLineLayers,
  speedLinePlacement,
  TOUCH_CHROME_ALPHA,
  TOUCH_CHROME_COLOURS,
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
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
} from "../../ui/touchChrome.ts";

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

const SHEET_KEYS: readonly string[] = [...new Set(Object.values(TOUCH_CHROME_SHEETS))];

// Queues the UI manifest and, once it loads, the joystick sheets it lists.
export function preloadTouchChrome(scene: Scene, supplied?: unknown): void {
  const queueSheets = () => {
    const manifest = scene.cache.json.get(UI_MANIFEST_KEY) as UiManifest | undefined;
    for (const sprite of manifest?.sprites ?? []) {
      if (SHEET_KEYS.includes(sprite.key)) {
        scene.load.json(sprite.key, `${UI_ROOT}${sprite.json}`);
      }
    }
  };
  if (supplied !== undefined) {
    scene.cache.json.add(UI_MANIFEST_KEY, supplied);
    queueSheets();
  } else {
    scene.load.once(`filecomplete-json-${UI_MANIFEST_KEY}`, queueSheets);
    scene.load.json(UI_MANIFEST_KEY, UI_MANIFEST_PATH);
  }
}

type Size = { readonly height: number; readonly width: number };

// What a chrome texture is painted from, kept on it so it can paint again at a new scale.
interface ChromePaint {
  readonly bases?: ReadonlyMap<string, readonly TouchChromeLayer[]> | undefined;
  readonly columns: number;
  readonly frames: ReadonlyMap<string, readonly TouchChromeLayer[]>;
  readonly logical: Size;
  readonly textureLimit: number;
  scale: number;
}

const paintOf = (texture: Textures.Texture): ChromePaint =>
  (texture.customData as { chrome: ChromePaint }).chrome;

function paintChromePixels(
  image: ImageData,
  texels: number,
  layers: readonly TouchChromeLayer[],
  bounds = { bottom: image.height, left: 0, right: image.width, top: 0 },
): void {
  for (let y = bounds.top; y < bounds.bottom; y++) {
    for (let x = bounds.left; x < bounds.right; x++) {
      image.data.set(
        touchChromePixel(texels, layers, {
          x: (x + 0.5) / texels,
          y: (y + 0.5) / texels,
        }),
        4 * (y * image.width + x),
      );
    }
  }
}

// Resizes the atlas and paints each named frame at its new position in the grid.
function paintChrome(texture: Textures.CanvasTexture, paint: ChromePaint, scale: number): void {
  const { columns, frames, logical, textureLimit } = paint;
  const { height, rows, strideX, strideY, width } = chromeAtlasGrid(
    logical,
    scale,
    frames.size,
    columns,
    textureLimit,
  );
  const texels = width / paint.logical.width;
  texture.setSize(strideX * columns, strideY * rows);
  const context = texture.getContext();
  context.clearRect(0, 0, texture.width, texture.height);
  const baseImages = new Map<readonly TouchChromeLayer[], ImageData>();
  let index = 0;
  for (const [frame, layers] of frames) {
    const left = (index % columns) * strideX + 1;
    const top = Math.floor(index / columns) * strideY + 1;
    const base = paint.bases?.get(frame);
    let image: ImageData;
    if (base) {
      let painted = baseImages.get(base);
      if (!painted) {
        painted = context.createImageData(width, height);
        paintChromePixels(painted, texels, base);
        baseImages.set(base, painted);
      }
      image = painted;
      if (layers.length > base.length) {
        image = context.createImageData(width, height);
        image.data.set(painted.data);
        const symbol = layerBounds(layers.slice(base.length));
        // One extra texel covers the half-texel antialias fringe. Inside the symbol bounds,
        // composite all layers from scratch to keep the original precision and paint order.
        paintChromePixels(image, texels, layers, {
          bottom: Math.min(height, Math.ceil(symbol.bottom * texels) + 1),
          left: Math.max(0, Math.floor(symbol.left * texels) - 1),
          right: Math.min(width, Math.ceil(symbol.right * texels) + 1),
          top: Math.max(0, Math.floor(symbol.top * texels) - 1),
        });
      }
    } else {
      image = context.createImageData(width, height);
      paintChromePixels(image, texels, layers);
    }
    context.putImageData(image, left, top);
    if (texture.has(frame)) {
      texture.get(frame).setSize(width, height, left, top);
    } else {
      texture.add(frame, 0, left, top, width, height);
    }
    index++;
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
  grid?: Pick<ChromePaint, "bases" | "columns" | "textureLimit">,
): void {
  const texture = scene.textures.createCanvas(key, 1, 1);
  if (!texture) {
    throw new Error(`Cannot create ${key}`);
  }
  const paint: ChromePaint = {
    bases: grid?.bases,
    columns: grid?.columns ?? Math.max(1, frames.size),
    frames,
    logical,
    scale,
    textureLimit: grid?.textureLimit ?? Infinity,
  };
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
export const useDiscFrame = (action: UseAction | "quest", pose: UseDiscPose): string =>
  `${action}-${pose}`;

// The Use disc: every action's symbol in every pose, painted procedurally like the rings at scale
// texels per logical px, as one sprite that shows the frame useDiscFrame names.
export function createUseDisc(scene: Scene, scale: number): GameObjects.Sprite {
  if (!scene.textures.exists(USE_DISC_KEY)) {
    const frames = new Map<string, ReturnType<typeof useDiscLayers>>();
    const poseBases = new Map(
      USE_DISC_POSES.map((pose) => [pose, useDiscLayers(TOUCH_CHROME_COLOURS, "quest", pose)]),
    );
    const bases = new Map<string, readonly TouchChromeLayer[]>();
    for (const action of [...Object.keys(USE_SYMBOLS), "quest"] as (UseAction | "quest")[]) {
      for (const pose of USE_DISC_POSES) {
        const frame = useDiscFrame(action, pose);
        // The symbol-free Quest layers are the common prefix of every action in this pose.
        const base = poseBases.get(pose)!;
        const layers = useDiscLayers(TOUCH_CHROME_COLOURS, action, pose);
        frames.set(frame, layers);
        bases.set(frame, base);
      }
    }
    const renderer = scene.game.renderer;
    createChromeTexture(
      scene,
      scale,
      USE_DISC_KEY,
      { height: TOUCH_CHROME_FRAME, width: TOUCH_CHROME_FRAME },
      frames,
      {
        bases,
        columns: USE_DISC_POSES.length,
        textureLimit: "getMaxTextureSize" in renderer ? renderer.getMaxTextureSize() : Infinity,
      },
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

// Draws the line from the stick's origin toward the thumb, as long as stickViews made it, or hides it.
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
