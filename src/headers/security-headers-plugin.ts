import * as kit from "@andornaut/game-kit/web/headers/vite/securityHeadersPlugin";
import type { Plugin } from "vite";

import {
  BASE_DIRECTIVES,
  COMMON_RULE,
  FILE_RULES,
  HASHED_ASSET_PATH,
  PAGE_RULES,
} from "./security-policy.ts";

const HEADING =
  "Written by the build from src/headers/security-policy.ts and the hashes of each page's inline " +
  "blocks.";

// The kit's security headers plugin with the game's policy (security-policy.ts): writes
// dist/_headers with the common headers on every path, a year's caching for hashed build output
// and a Content-Security-Policy per page rule. Fails the build for an unhashed file under the
// hashed asset path.
export function securityHeadersPlugin(): Plugin {
  return kit.securityHeadersPlugin({
    base: BASE_DIRECTIVES,
    fileRules: [COMMON_RULE, ...FILE_RULES],
    hashedAssetPath: HASHED_ASSET_PATH,
    heading: HEADING,
    pageRules: PAGE_RULES,
  });
}
