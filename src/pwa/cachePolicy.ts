import type { CachePolicy } from "@andornaut/game-kit/runtime/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the router, the page's launch and
// the build share. cacheNamePrefix scopes every build cache and record the kit writes for the
// game; content-hashed build output is under /assets/.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "ada-the-navigator-",
  hashedAssetPrefix: "/assets/",
};
