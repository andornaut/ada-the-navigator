import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The copy boundary delegates object validation and raw-byte index restoration to the Kit. */
export async function restoreCheckSourceIdentity(context, expected) {
  const marker = join(context.workRoot, ".git", "check-source-identity.json");
  const { restoreSourceIdentity } = await import("@andornaut/delivery-kit/source-identity");
  let status;
  if (!existsSync(join(context.workRoot, ".git"))) {
    status = restoreSourceIdentity(context, {
      expectedCommit: expected.commit,
      expectedDigest: expected.digest,
      expectedTree: expected.tree,
    });
    writeFileSync(marker, JSON.stringify(expected));
  } else {
    if (
      !lstatSync(join(context.workRoot, ".git")).isDirectory() ||
      !existsSync(marker) ||
      !lstatSync(marker).isFile()
    ) {
      throw new Error("Existing Git metadata is not the qualified check identity");
    }
    const recorded = JSON.parse(readFileSync(marker, "utf8"));
    if (
      recorded.commit !== expected.commit ||
      recorded.tree !== expected.tree ||
      recorded.digest !== expected.digest
    ) {
      throw new Error("Existing Git metadata is not the qualified check identity");
    }
    const git = (args) =>
      execFileSync("git", args, {
        cwd: context.workRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    const commit = git(["rev-parse", "HEAD"]);
    const tree = git(["rev-parse", "HEAD^{tree}"]);
    if (commit !== expected.commit || tree !== expected.tree) {
      throw new Error("Check source identity changed between categories");
    }
    const porcelain = git(["status", "--porcelain=v1", "--untracked-files=all"]);
    status = { commit, dirty: porcelain !== "", status: porcelain, tree };
  }
  return status;
}
