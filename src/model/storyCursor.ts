import type { Scene, StoryPosition, StoryStep } from "./storybook.ts";

export interface StorySceneReference {
  readonly id: string;
  readonly variant?: "firstLaunch" | "announce" | "oreLost";
  readonly background?: "adaRoom" | "adaRoomMorningCats" | "adaRoomNight";
}

export interface StoryCursorStep {
  readonly scene: StorySceneReference;
  readonly page: string;
  readonly asked: readonly string[];
}

export interface StoryCursor {
  readonly version: 1;
  readonly current: StoryCursorStep;
  readonly trail: readonly StoryCursorStep[];
}

function record(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }
  const keys = Reflect.ownKeys(value);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string" || (!required.includes(key) && !optional.includes(key))) {
      return null;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return null;
    }
    result[key] = descriptor.value;
  }
  return required.every((key) => Object.hasOwn(result, key)) ? result : null;
}

function list(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return null;
  }
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(length) || length < 0 || Reflect.ownKeys(value).length !== length + 1) {
    return null;
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return null;
    }
    result.push(descriptor.value);
  }
  return result;
}

function reference(value: unknown): StorySceneReference | null {
  const ref = record(value, ["id"], ["variant", "background"]);
  if (!ref || typeof ref.id !== "string" || !ref.id) {
    return null;
  }
  const variant = ref.variant;
  const background = ref.background;
  if (
    variant !== undefined &&
    variant !== "firstLaunch" &&
    variant !== "announce" &&
    variant !== "oreLost"
  ) {
    return null;
  }
  if (
    background !== undefined &&
    background !== "adaRoom" &&
    background !== "adaRoomMorningCats" &&
    background !== "adaRoomNight"
  ) {
    return null;
  }
  if (
    (Object.hasOwn(ref, "variant") && variant === undefined) ||
    (Object.hasOwn(ref, "background") && background === undefined)
  ) {
    return null;
  }
  return {
    id: ref.id,
    ...(variant === undefined ? {} : { variant }),
    ...(background === undefined ? {} : { background }),
  };
}

const identity = (ref: StorySceneReference): string =>
  JSON.stringify([ref.id, ref.variant ?? null, ref.background ?? null]);

function validStep(
  scene: Scene,
  page: unknown,
  askedValue: unknown,
): { page: string; asked: readonly string[] } | null {
  const asked = list(askedValue);
  if (
    typeof page !== "string" ||
    !scene.pages.some((candidate) => candidate.id === page) ||
    !asked
  ) {
    return null;
  }
  const targets = new Set(
    scene.pages.flatMap(
      (candidate) =>
        candidate.questions?.flatMap((question) =>
          question.next === undefined ? [] : [question.next],
        ) ?? [],
    ),
  );
  const seen = new Set<string>();
  for (const id of asked) {
    if (
      typeof id !== "string" ||
      !targets.has(id) ||
      !scene.pages.some((candidate) => candidate.id === id) ||
      seen.has(id)
    ) {
      return null;
    }
    seen.add(id);
  }
  return { asked: [...seen], page };
}

/** Canonical pages plus their optional-question returns bound the saved navigation trail. */
function trailCapacity(scenes: Iterable<Scene>): number {
  let capacity = 0;
  for (const scene of scenes) {
    capacity +=
      scene.pages.length +
      scene.pages.reduce(
        (sum, page) =>
          sum + (page.questions?.filter((question) => question.next !== undefined).length ?? 0),
        0,
      );
  }
  return capacity;
}

/** Store references and navigation state without copying authored pages or applying effects. */
export function storyCursor(
  context: { readonly reference: (scene: Scene) => StorySceneReference },
  position: StoryPosition,
): StoryCursor {
  const scenes = new Map<string, Scene>();
  const encode = (step: StoryStep): StoryCursorStep => {
    const ref = reference(context.reference(step.scene));
    const valid = validStep(step.scene, step.page, step.asked);
    if (!ref || ref.id !== step.scene.id || !valid) {
      throw new RangeError("Invalid story cursor step");
    }
    scenes.set(identity(ref), step.scene);
    return { ...valid, scene: ref };
  };
  const current = encode(position);
  const trail = position.trail.map(encode);
  if (trail.length > trailCapacity(scenes.values())) {
    throw new RangeError("Story cursor trail exceeds canonical pages");
  }
  return { current, trail, version: 1 };
}

/** Resolve only canonical references; identical references share one scene per decode. */
export function readStoryCursor(
  context: { readonly resolve: (reference: StorySceneReference) => Scene | null },
  value: unknown,
): StoryPosition | null {
  try {
    const cursor = record(value, ["version", "current", "trail"]);
    if (!cursor || cursor.version !== 1) {
      return null;
    }
    const savedTrail = list(cursor.trail);
    if (!savedTrail) {
      return null;
    }
    const scenes = new Map<string, Scene>();
    const decode = (value: unknown): StoryStep | null => {
      const step = record(value, ["scene", "page", "asked"]);
      const ref = step && reference(step.scene);
      if (!step || !ref) {
        return null;
      }
      const key = identity(ref);
      let scene = scenes.get(key);
      if (!scene) {
        const resolved = context.resolve(ref);
        if (!resolved || resolved.id !== ref.id) {
          return null;
        }
        scene = resolved;
        scenes.set(key, scene);
      }
      const valid = validStep(scene, step.page, step.asked);
      return valid ? { ...valid, scene } : null;
    };
    const current = decode(cursor.current);
    if (!current) {
      return null;
    }
    const trail: StoryStep[] = [];
    for (const step of savedTrail) {
      const decoded = decode(step);
      if (!decoded) {
        return null;
      }
      trail.push(decoded);
    }
    if (trail.length > trailCapacity(scenes.values())) {
      return null;
    }
    return { ...current, trail };
  } catch {
    return null;
  }
}
