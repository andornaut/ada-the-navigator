/// <reference types="@andornaut/game-kit/web/build/vite/buildInfo" />
import { readFileSync } from "node:fs";

import { buildLabel } from "@andornaut/game-kit/web/build/buildLabel";
import {
  CI_COMMIT_VARIABLE,
  shortCommit,
  UNKNOWN_COMMIT,
} from "@andornaut/game-kit/web/build/buildVersion";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BUILD_LABEL } from "./build-label.ts";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
const SHA = "0123456789abcdef0123456789abcdef01234567";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the build label", () => {
  it("shows package.json's version and this build's commit in the kit's format", () => {
    expect(__APP_VERSION__).toBe(version);
    expect(BUILD_LABEL).toBe(`v${version} · ${__COMMIT__}`);
    expect(buildLabel("1.2.3", "89abcdef")).toBe("v1.2.3 · 89abcdef");
    // The checks pass the checked revision, so this run's build names it.
    const given = process.env[CI_COMMIT_VARIABLE];
    expect(__COMMIT__).toBe(given ? given.slice(0, 8) : __COMMIT__);
    expect(__COMMIT__).toMatch(/^(?:[0-9a-f]{8}|dev)$/);
  });

  it("builds with the deploy gate's commit, shortened to 8 characters", async () => {
    vi.stubEnv(CI_COMMIT_VARIABLE, SHA);
    const { default: pending } = await import("../vite.config.ts");
    const config = await pending;
    expect(config.define).toMatchObject({
      __APP_VERSION__: JSON.stringify(version),
      __COMMIT__: JSON.stringify("01234567"),
    });
  });

  it("shows dev when the build knows no commit", () => {
    const noGit = () => {
      throw new Error("not a git repository");
    };
    expect(buildLabel(version, shortCommit(noGit, {}))).toBe(`v${version} · ${UNKNOWN_COMMIT}`);
    expect(UNKNOWN_COMMIT).toBe("dev");
    // A malformed CI value is not a commit.
    expect(shortCommit(noGit, { [CI_COMMIT_VARIABLE]: "main" })).toBe("dev");
  });
});
