import { CAPITAL_CAPTAINS } from "../data/capitalCaptains.ts";
import { CAST, castFrames, type CastPortraitSheet, SPEAKER_CAST } from "../data/cast.ts";
import type { Mood } from "../data/conversations.ts";
import type { ConversationLineView } from "./conversation.ts";
import { COLOURS } from "./layout/colours.ts";
import { units } from "./layout/css.ts";

export const COMPACT_PORTRAITS = {
  ada: { frames: 2, moods: { happy: 0, neutral: 1 }, url: "/art/portraits/ada-compact.png" },
  archie: {
    frames: 10,
    speaking: { named: [6, 7, 8, 9], unknown: [1, 2, 3, 4] },
    url: "/art/portraits/archie-compact.png",
  },
  astra: { frames: 5, speaking: [1, 2, 3, 4], url: "/art/portraits/astra-compact.png" },
  penny: {
    frames: 3,
    moods: { happy: 0, neutral: 1, upset: 2 },
    url: "/art/portraits/penny-compact.png",
  },
} as const;

/** The tab fill of a story speaker with no tab of their own, unnamed Archie's. */
export const AWAITING_TAB = COLOURS.supporting;

/** Each speaking frame's time. */
export const SPEAKING_FRAME_MS = 120;

const PORTRAIT_CROP_IMAGE = "--ada-portrait-crop-image";
const portraitPages = new Map<string, Promise<HTMLImageElement>>();
const portraitCrops = new Map<string, Promise<string>>();
const selectedCrops = new WeakMap<HTMLElement, CastPortraitSheet>();

function readPortraitPage(document: Document, url: string): Promise<HTMLImageElement> {
  const existing = portraitPages.get(url);
  if (existing) {
    return existing;
  }
  const page = document.createElement("img");
  page.src = url;
  const loaded = page.decode().then(() => page);
  portraitPages.set(url, loaded);
  void loaded.catch(() => portraitPages.delete(url));
  return loaded;
}

/** A packed crop is decoded at its original size so CSS retains the authored frame offsets. */
export function selectPortraitCrop(face: HTMLElement, sheet: CastPortraitSheet | undefined): void {
  const crop = sheet?.crop;
  if (!sheet || !crop) {
    selectedCrops.delete(face);
    return;
  }
  if (selectedCrops.get(face) === sheet) {
    return;
  }
  selectedCrops.set(face, sheet);
  face.style.removeProperty(PORTRAIT_CROP_IMAGE);
  const document = face.ownerDocument;
  const { height, width, x, y } = crop;
  const cropKey = `${sheet.url}#${x},${y},${width},${height}`;
  let image = portraitCrops.get(cropKey);
  if (!image) {
    image = readPortraitPage(document, sheet.url).then((page) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      // This scratch crop is serialized immediately and never displayed as a canvas.
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("Unable to read the portrait crop");
      }
      context.drawImage(page, x, y, width, height, 0, 0, width, height);
      return `url("${canvas.toDataURL()}")`;
    });
    portraitCrops.set(cropKey, image);
    void image.catch(() => portraitCrops.delete(cropKey));
  }
  void image.then(
    (url) => {
      if (selectedCrops.get(face) === sheet) {
        face.style.setProperty(PORTRAIT_CROP_IMAGE, url);
      }
    },
    () => undefined,
  );
}

/** Scale a source frame to the existing square portrait slot. */
export function portraitBackground(sheet: CastPortraitSheet, image: number, frame = 0): string {
  const { crop, frames, url } = sheet;
  const source = crop ? `var(${PORTRAIT_CROP_IMAGE}, none)` : `url('${url}')`;
  const x = frame ? units(-frame * image) : "0";
  return `${source} ${x} 0 / ${units(frames * image)} ${units(image)} no-repeat`;
}

/**
 * The sheet frame the box shows for line: Ada's or Penny's mood (neutral where the sheet has no
 * such mood), or Astra's or Archie's speaking loop timed from the line's start, held on its
 * first frame under reduced motion.
 */
export function portraitFrame(
  reducedMotion: boolean,
  line: Pick<ConversationLineView, "elapsed" | "mood" | "named" | "speaker">,
): number {
  const loop = (frames: readonly number[]): number =>
    frames[
      reducedMotion
        ? 0
        : Math.floor((line.elapsed * 1000) / SPEAKING_FRAME_MS + 1e-9) % frames.length
    ]!;
  if (line.speaker === "ada" || line.speaker === "penny") {
    const moods: Readonly<Partial<Record<Mood, number>>> = COMPACT_PORTRAITS[line.speaker].moods;
    return moods[line.mood] ?? moods.neutral!;
  }
  if (SPEAKER_CAST[line.speaker]) {
    return castFrames(SPEAKER_CAST[line.speaker]!).neutral;
  }
  if (line.speaker === "astra") {
    return loop(COMPACT_PORTRAITS.astra.speaking);
  }
  return line.speaker === "archie"
    ? loop(COMPACT_PORTRAITS.archie.speaking[line.named ? "named" : "unknown"])
    : -1;
}

// Each speaker's name tab fill (art/controls.md "Conversation box").
export const TAB_COLOURS = {
  ada: COLOURS.adaBlue,
  archie: COLOURS.supporting,
  archieNamed: COLOURS.archieTab,
  astra: COLOURS.astraTab,
  penny: COLOURS.jobOrange,
  ...Object.fromEntries(Object.keys(CAPITAL_CAPTAINS).map((speaker) => [speaker, AWAITING_TAB])),
  ...Object.fromEntries(
    Object.entries(SPEAKER_CAST).map(([speaker, key]) => [speaker, CAST[key].tab]),
  ),
} as Readonly<Record<string, string>>;

/** Semantic family addresses keep their dialogue text while profiles supply the name tabs. */
export const FAMILY_PORTRAITS = {
  dad: { address: "Dad", frames: 2, name: "Bin", neutral: 1, url: "/art/portraits/mr-b.png" },
  mom: { address: "Mom", frames: 2, name: "Trista", neutral: 1, url: "/art/portraits/trista.png" },
} as const;

export function familyPortrait(name: string | undefined): keyof typeof FAMILY_PORTRAITS | null {
  return (
    (Object.keys(FAMILY_PORTRAITS) as (keyof typeof FAMILY_PORTRAITS)[]).find(
      (key) =>
        name === key ||
        name === FAMILY_PORTRAITS[key].address ||
        name === FAMILY_PORTRAITS[key].name,
    ) ?? null
  );
}

export function storySpeakerName(name: string): string {
  const family = familyPortrait(name);
  return family ? FAMILY_PORTRAITS[family].name : name;
}
