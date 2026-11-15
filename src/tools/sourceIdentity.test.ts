import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  restoreSourceIdentity,
  snapshotSourceIdentity,
  type SourceIdentityManifest,
} from "@andornaut/delivery-kit/source-identity";
import { gitBuildMetadata } from "@andornaut/game-kit/build/gitHead";
import { describe, expect, it } from "vitest";

// The proof runner supplies an immutable real commit and its public-API artifact, not mock Git.
const proof = process.env.ADA_IDENTITY_PROOF;
interface Fixture {
  readonly source: string;
  readonly artifact: string;
  readonly commit: string;
  readonly tree: string;
  readonly digest: string;
  readonly files: readonly string[];
}
function git(cwd: string, args: readonly string[]) {
  return execFileSync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}
const checkerUrl = new URL("../../tools/checks.mjs", import.meta.url).href;
const restoreUrl = new URL("../../tests/container/sourceIdentity.mjs", import.meta.url).href;
const checks = await import(checkerUrl);
const { restoreCheckSourceIdentity } = await import(restoreUrl);
const sdkModule = fileURLToPath(import.meta.resolve("@andornaut/delivery-kit/source-identity"));
function smallFixture(): Fixture {
  const parent = mkdtempSync(join(tmpdir(), "ada-source-identity-seed-"));
  const source = join(parent, "source"),
    artifact = join(parent, "identity");
  mkdirSync(join(source, "src"), { recursive: true });
  writeFileSync(join(source, ".gitignore"), "/node_modules/\n");
  writeFileSync(join(source, "README.md"), "Source identity fixture\n");
  writeFileSync(join(source, "src/probe.ts"), "export const value = 1;\n");
  git(source, ["init", "--quiet", "--template=", "--object-format=sha1"]);
  git(source, ["add", "."]);
  git(source, [
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "Source fixture",
  ]);
  const commit = git(source, ["rev-parse", "HEAD"]);
  const files = checks.snapshot(source).files as readonly string[];
  const identity = snapshotSourceIdentity(
    { artifactDir: artifact, sourceRoot: source },
    { approvedPaths: files, expectedCommit: commit },
  );
  return { artifact, commit, digest: identity.digest, files, source, tree: identity.tree };
}
const fixture: Fixture = proof
  ? JSON.parse(readFileSync(join(proof, "fixture.json"), "utf8"))
  : smallFixture();
let next = 0;
function pins(manifest: Pick<SourceIdentityManifest, "commit" | "tree" | "digest">) {
  return { commit: manifest.commit, digest: manifest.digest, tree: manifest.tree };
}
function copiedFiles(source: string, destination: string, files: readonly string[]) {
  mkdirSync(destination, { recursive: true });
  for (const file of files) {
    if (existsSync(join(source, file))) {
      mkdirSync(join(destination, file, ".."), { recursive: true });
      cpSync(join(source, file), join(destination, file));
    }
  }
}
function sourceFixture() {
  const parent = join(tmpdir(), `ada-identity-consumer-${process.pid}-${next++}`);
  const source = join(parent, "source");
  copiedFiles(fixture.source, source, fixture.files);
  restoreSourceIdentity(
    { artifactDir: fixture.artifact, workRoot: source },
    {
      expectedCommit: fixture.commit,
      expectedDigest: fixture.digest,
      expectedTree: fixture.tree,
    },
  );
  return { parent, source };
}

// Dedicated proof uses a frozen application commit; ordinary CI uses the small real Git fixture.
describe("isolated check source identity binding", () => {
  it.each(["clean", "dirty", "deleted", "staged-deleted", "untracked"] as const)(
    "preserves the %s copied tree and qualifies only clean HEAD",
    async (kind) => {
      const f = sourceFixture();
      const file = "README.md",
        extra = "src/identity-untracked.txt";
      if (kind === "dirty") {
        writeFileSync(join(f.source, file), "Changed working source\n");
      }
      if (kind === "deleted") {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(join(f.source, file));
      }
      if (kind === "staged-deleted") {
        git(f.source, ["rm", file]);
      }
      if (kind === "untracked") {
        writeFileSync(join(f.source, extra), "Untracked source\n");
      }
      const deleted = kind === "deleted" || kind === "staged-deleted";
      const before = deleted ? undefined : readFileSync(join(f.source, file));
      const source = checks.snapshot(f.source);
      const artifact = join(f.parent, "captured");
      const identity: SourceIdentityManifest = await checks.captureSourceIdentity(
        { artifactDir: artifact, sdkModule, sourceRoot: f.source },
        source,
      );
      const work = join(f.parent, "work");
      copiedFiles(f.source, work, source.files);
      const status = await restoreCheckSourceIdentity(
        { artifactDir: artifact, workRoot: work },
        pins(identity),
      );
      expect(status.commit).toBe(fixture.commit);
      expect(status.dirty).toBe(kind !== "clean");
      expect(gitBuildMetadata(work, { WORKERS_CI_COMMIT_SHA: fixture.commit }).buildId).toBe(
        kind === "clean" ? fixture.commit : undefined,
      );
      if (deleted) {
        expect(existsSync(join(work, file))).toBe(false);
      } else {
        expect(readFileSync(join(work, file))).toEqual(before);
      }
      if (kind === "untracked") {
        expect(readFileSync(join(work, extra), "utf8")).toBe("Untracked source\n");
      }
      const repeated = await restoreCheckSourceIdentity(
        { artifactDir: artifact, workRoot: work },
        pins(identity),
      );
      expect(repeated.dirty).toBe(status.dirty);
    },
  );

  it("withholds a full ID for wrong CI and refuses an existing unqualified Git checkout", async () => {
    const f = sourceFixture();
    expect(
      gitBuildMetadata(f.source, { WORKERS_CI_COMMIT_SHA: "f".repeat(40) }).buildId,
    ).toBeUndefined();
    await expect(
      restoreCheckSourceIdentity(
        { artifactDir: fixture.artifact, workRoot: f.source },
        pins(fixture),
      ),
    ).rejects.toThrow("not the qualified check identity");
  });

  it("rejects an omitted tracked path before loading the SDK or reading its blobs", async () => {
    const f = sourceFixture(),
      source = checks.snapshot(f.source);
    await expect(
      checks.captureSourceIdentity(
        {
          artifactDir: join(f.parent, "never-created"),
          sdkModule: join(f.parent, "no-sdk.mjs"),
          sourceRoot: f.source,
        },
        { ...source, files: source.files.filter((file: string) => file !== "README.md") },
      ),
    ).rejects.toThrow("complete approved tracked inventory");
    expect(existsSync(join(f.parent, "never-created"))).toBe(false);
  });
  it("rejects unsafe tracked inventory before loading the SDK", () => {
    const f = sourceFixture();
    writeFileSync(join(f.source, ".gitmodules"), "");
    git(f.source, ["add", ".gitmodules"]);
    git(f.source, [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "Unsafe inventory fixture",
    ]);
    expect(() => checks.snapshot(f.source)).toThrow("Unsupported source paths");
  });
});
