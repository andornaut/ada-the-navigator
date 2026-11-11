import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import Phaser from "phaser";

import {
  isTouchChromePose,
  TOUCH_CHROME_ALPHA,
  TOUCH_CHROME_COLOURS,
  TOUCH_CHROME_FRAME,
  TOUCH_CHROME_SCALE,
  TOUCH_CHROME_SHEETS,
  TOUCH_KNOB_FRAME,
  type TouchChromeKind,
  type TouchChromeLayer,
  touchChromeLayers,
  touchChromePixel,
  type TouchChromePose,
} from "../ui/touch-chrome.ts";

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
export function preloadTouchChrome(scene: Phaser.Scene): void {
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

function createChromeTexture(
  scene: Phaser.Scene,
  key: string,
  logical: number,
  frames: ReadonlyMap<string, readonly TouchChromeLayer[]>,
): void {
  const size = logical * TOUCH_CHROME_SCALE;
  const stride = size + 2;
  const texture = scene.textures.createCanvas(key, stride * frames.size, stride);
  if (!texture) {
    throw new Error(`Cannot create ${key}`);
  }
  const context = texture.getContext();
  let column = 0;
  for (const [frame, layers] of frames) {
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        image.data.set(
          touchChromePixel(layers, {
            x: (x + 0.5) / TOUCH_CHROME_SCALE,
            y: (y + 0.5) / TOUCH_CHROME_SCALE,
          }),
          4 * (y * size + x),
        );
      }
    }
    context.putImageData(image, column * stride + 1, 1);
    texture.add(frame, 0, column * stride + 1, 1, size, size);
    column++;
  }
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

// A joystick part drawn from its sheet's frames and tags, or undefined while the UI manifest
// lists no such sheet. Textures and animations live for the game; the sprite belongs to scene.
export function createTouchChrome(
  scene: Phaser.Scene,
  kind: TouchChromeKind,
): Phaser.GameObjects.Sprite | undefined {
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
      key,
      logical,
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
export function showTouchChrome(sprite: Phaser.GameObjects.Sprite, tag: TouchChromePose): void {
  const key = animationKey(sprite.texture.key, tag);
  if (sprite.anims.currentAnim?.key !== key && sprite.scene.anims.exists(key)) {
    sprite.play(key);
  }
}
