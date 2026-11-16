import type {
  HashedFiles,
  VerifiedJsonFamilySelection,
} from "@andornaut/game-kit/build/precachePlugin";

const HARDPOINT_FAMILIES = [
  [
    "/art/andromeda/enemies/capital-hardpoints.json",
    "/art/cartwheel/enemies/capital-hardpoints.json",
    "/art/enemies/capital-hardpoints.json",
    "/art/needle/enemies/capital-hardpoints.json",
  ],
  [
    "/art/andromeda/enemies/frigate-hardpoints.json",
    "/art/cartwheel/enemies/frigate-hardpoints.json",
    "/art/enemies/frigate-hardpoints.json",
    "/art/needle/enemies/frigate-hardpoints.json",
  ],
  [
    "/art/andromeda/enemies/hostileStation-hardpoints.json",
    "/art/cartwheel/enemies/hostileStation-hardpoints.json",
    "/art/enemies/hostileStation-hardpoints.json",
  ],
] as const;

// Data fetches may share verified bodies; navigation retains each original response policy.
export function verifiedJsonFamilies(files: HashedFiles): readonly VerifiedJsonFamilySelection[] {
  const discovered = new Set(files.urls);
  return HARDPOINT_FAMILIES.map((urls) => {
    for (const url of urls) {
      if (!discovered.has(url)) {
        throw new Error(`Required verified JSON URL is not emitted: ${url}`);
      }
    }
    return { responseProfile: "fetch-json-data-v1", urls };
  });
}
