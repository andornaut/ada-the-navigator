import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const results = resolve(root, ".check-results");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const error = new Error(
      `${command}: ${result.stderr || `exited with ${result.signal ?? result.status}`}`,
    );
    error.exitCode = result.status || 1;
    throw error;
  }
  return result.stdout.trim();
}

export function snapshot(checkout = root) {
  const candidates = [
    ...new Set([
      ...run("git", [
        "-C",
        checkout,
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ]).split("\0"),
      ...run("git", ["-C", checkout, "ls-tree", "-r", "--name-only", "-z", "HEAD"]).split("\0"),
    ]),
  ]
    .filter(Boolean)
    .filter((name) => !name.startsWith(".check-results/"));
  const rootNames = new Set([
    "Makefile",
    "package.json",
    "package-lock.json",
    "delivery-kit.json",
    "index.html",
    "README.md",
    "LICENSE",
    ".nvmrc",
    ".node-version",
    ".gitignore",
    ".prettierignore",
    ".prettierrc",
    ".prettierrc.json",
    ".markdownlint.json",
    ".markdownlint.jsonc",
    ".markdownlint-cli2.jsonc",
    ".markdownlint-cli2.yaml",
    "eslint.config.mjs",
    "eslint.config.base.mjs",
    ".lintstagedrc",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.node.json",
    "wrangler.jsonc",
  ]);
  const folders = new Set([
    "tests",
    "src",
    "tools",
    "docs",
    "art",
    "gameplay",
    "public",
    "pages",
    ".github",
    ".husky",
  ]);
  const files = candidates
    .filter((name) => {
      if (rootNames.has(name)) {
        return true;
      }
      const [folder, ...parts] = name.split("/");
      return (
        folders.has(folder) &&
        parts.length > 0 &&
        parts.every(
          (part) =>
            !part.startsWith(".") &&
            part !== "node_modules" &&
            !/^(?:AGENTS|CLAUDE|GEMINI)(?:\.local)?\.md$|secret|credential|\.(?:pem|key|p12|pfx|age|gpg|vault)$/i.test(
              part,
            ),
        )
      );
    })
    .sort();
  const unsupported = candidates.filter(
    (name) => !files.includes(name) && !/^(?:AGENTS|CLAUDE|GEMINI)(?:\.local)?\.md$/.test(name),
  );
  if (unsupported.length) {
    throw new Error(`Unsupported source paths: ${unsupported.join(", ")}`);
  }
  const head = run("git", ["-C", checkout, "rev-parse", "HEAD"]);
  const hash = createHash("sha256");
  hash.update(head);
  hash.update(
    run("git", [
      "-C",
      checkout,
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--",
      ".",
      ":(exclude).check-results",
    ]),
  );
  for (const name of files) {
    hash.update(name);
    try {
      if (!lstatSync(resolve(checkout, name)).isFile()) {
        throw new Error(`Non-regular source: ${name}`);
      }
      hash.update(readFileSync(resolve(checkout, name)));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      hash.update("deleted");
    }
  }
  return { head, files, fingerprint: hash.digest("hex") };
}

/** Caller approval covers every tracked path before the public API reads tree blobs. */
export async function captureSourceIdentity(context, source) {
  const checkout = context.sourceRoot ?? root;
  const tracked = run("git", ["-C", checkout, "ls-tree", "-r", "--name-only", "-z", source.head])
    .split("\0")
    .filter(Boolean);
  const approved = new Set(source.files);
  if (tracked.some((path) => !approved.has(path))) {
    throw new Error("Source identity requires the complete approved tracked inventory");
  }
  const { snapshotSourceIdentity } = await import(pathToFileURL(context.sdkModule).href);
  const manifest = snapshotSourceIdentity(
    { artifactDir: context.artifactDir, sourceRoot: checkout },
    { approvedPaths: tracked, expectedCommit: source.head },
  );
  if (snapshot(checkout).fingerprint !== source.fingerprint) {
    throw new Error("Source changed during identity capture");
  }
  return manifest;
}

/** Export the installed public bundle, not the resident host dependency or Git metadata. */
async function prepareSourceIdentity(context, source) {
  const name = `ada-source-sdk-${randomUUID()}`;
  const sdkModule = join(context.scratch, "source-identity.mjs");
  const container = run("docker", [
    "create",
    "--name",
    name,
    "--cpus",
    "4",
    "--memory",
    "4g",
    "--user",
    "19001:19001",
    "--network",
    "none",
    "--entrypoint",
    "node",
    context.image,
    "--version",
  ]);
  try {
    run("docker", [
      "cp",
      `${container}:/opt/check/node_modules/@andornaut/delivery-kit/dist/source-identity.js`,
      sdkModule,
    ]);
  } finally {
    run("docker", ["rm", container]);
  }
  return captureSourceIdentity(
    { artifactDir: join(context.scratch, "identity"), sdkModule, sourceRoot: root },
    source,
  );
}

export function guard(ci) {
  if (ci) {
    if (
      process.env.GITHUB_ACTIONS !== "true" ||
      process.env.RUNNER_ENVIRONMENT !== "github-hosted"
    ) {
      throw new Error("--ci requires a GitHub-hosted runner");
    }
    return;
  }
  if (loadavg()[0] >= 20) {
    throw new Error("Start blocked: load >=20");
  }
}

/**
 * Build the Make profile's check image from the inputs `tests/container/run` uses: the
 * `tests/container/context` manifest, `tests/container/Dockerfile`, the `build-image` admission
 * phase, the capped build resources and the per-checkout `local-check` tag, so Docker reuses the
 * layers Make builds. The canonical launcher has no build-only action, so this mirrors its build.
 */
function prepareImage() {
  const checkout = realpathSync(root);
  const inputs = readFileSync(resolve(checkout, "tests/container/context"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const input of inputs) {
    const path = resolve(checkout, input);
    if (!path.startsWith(`${checkout}${sep}`) || !lstatSync(path).isFile()) {
      throw new Error(`Invalid container context input: ${input}`);
    }
  }
  run(resolve(checkout, "tests/container/admit"), ["build-image"]);
  const scratch = mkdtempSync(join(tmpdir(), "ada-check-image-"));
  try {
    const context = join(scratch, "context.tar");
    run("tar", [
      "--create",
      "--file",
      context,
      "--directory",
      checkout,
      "--mode=u+rwX,go+rX",
      "--no-recursion",
      "--",
      ...inputs,
    ]);
    const tag = `local-check:${createHash("sha256").update(checkout).digest("hex").slice(0, 16)}`;
    const iidfile = join(scratch, "image.id");
    const build = spawnSync(
      "docker",
      [
        "build",
        "--resource",
        "cpu-period=100000",
        "--resource",
        "cpu-quota=400000",
        "--resource",
        "memory=4g",
        "--ulimit",
        "nofile=4096:4096",
        "--tag",
        tag,
        "--iidfile",
        iidfile,
        "--file",
        "tests/container/Dockerfile",
        "-",
      ],
      {
        cwd: checkout,
        encoding: "utf8",
        input: readFileSync(context),
        maxBuffer: 64 * 1024 * 1024,
        timeout: 900000,
      },
    );
    if (build.error) {
      throw build.error;
    }
    if (build.status !== 0) {
      const error = new Error(`docker build: ${build.stderr || `exited with ${build.status}`}`);
      error.exitCode = build.status || 1;
      throw error;
    }
    const image = readFileSync(iidfile, "utf8").trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(image)) {
      throw new Error("docker build did not record an image ID");
    }
    return { image, tag };
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
}

const program = `
const {cpSync,mkdirSync,writeFileSync,openSync,existsSync,readFileSync} = await import('node:fs');
const {dirname} = await import('node:path');
const {spawnSync} = await import('node:child_process');
mkdirSync('/tmp/work',{recursive:true});
mkdirSync('/tmp/evidence',{recursive:true});
const log = openSync('/tmp/evidence/check.log','w');
let code = 0;
try {
  for (const name of JSON.parse(readFileSync('/checkout/'+process.env.SOURCE_LIST,'utf8'))) {
    if (!existsSync('/checkout/'+name)) continue;
    mkdirSync(dirname('/tmp/work/'+name),{recursive:true});
    cpSync('/checkout/'+name,'/tmp/work/'+name,{dereference:false});
  }
  for (const [command,...args] of JSON.parse(process.env.CHECK_STEPS)) {
    const result = spawnSync(command,args,{cwd:'/tmp/work',env:process.env,stdio:['ignore',log,log]});
    if (result.error || result.status !== 0) {code=result.status || 1;break;}
  }
  if (existsSync('/tmp/work/dist')) {
    cpSync('/tmp/work/dist','/tmp/evidence/dist',{recursive:true});
  }
} catch(error) {writeFileSync('/tmp/evidence/error.txt',error.message);code=1;}
writeFileSync('/tmp/evidence/result.json',JSON.stringify({code})+'\\n');
process.exitCode=code;
`;

async function start(mode, ci) {
  if (!["all", "lint", "test"].includes(mode)) {
    throw new Error("Unknown check mode");
  }
  guard(ci);
  const source = snapshot();
  const name = `ada-check-${randomUUID()}`;
  mkdirSync(resolve(results, name), { recursive: true });
  writeFileSync(resolve(results, name, "source.json"), `${JSON.stringify(source, null, 2)}\n`);
  const categories = mode === "lint" ? ["lint"] : ["lint", "test", "build"];
  const steps = categories.map((category) => ["tests/container/check", category]);
  const directory = resolve(results, name);
  const receiptPath = resolve(directory, "startup.json");
  const receipt = {
    name,
    containerId: null,
    image: null,
    stage: "image",
    cleanup: "unconfirmed",
  };
  const saveReceipt = () => writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  saveReceipt();
  try {
    // The image carries ShellCheck and the locked dependencies, so the gate runs offline.
    const { image, tag } = prepareImage();
    receipt.image = image;
    receipt.imageTag = tag;
    receipt.stage = "identity";
    saveReceipt();
    guard(ci);
    receipt.identityScratch = mkdtempSync(join(tmpdir(), "ada-check-identity-"));
    const identity = await prepareSourceIdentity(
      { image, scratch: receipt.identityScratch },
      source,
    );
    Object.assign(receipt, {
      sourceIdentity: {
        commit: identity.commit,
        digest: identity.digest,
        tree: identity.tree,
      },
    });
    copyFileSync(
      join(receipt.identityScratch, "identity", "identity.json"),
      resolve(directory, "source-identity.json"),
    );
    saveReceipt();
    // The file list goes in a file beside the receipt: as an argument it outgrows the kernel's
    // per-argument limit.
    const sourceList = resolve(directory, "source-files.json");
    writeFileSync(sourceList, JSON.stringify(source.files));
    receipt.stage = "create";
    saveReceipt();
    const containerId = run("docker", [
      "create",
      "--name",
      name,
      "--cpus",
      "4",
      "--memory",
      "4g",
      "--pids-limit",
      "512",
      "--user",
      "19001:19001",
      "--group-add",
      run("stat", ["-c", "%g", root]),
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--network",
      "none",
      "--ulimit",
      "nofile=256:256",
      "--mount",
      `type=bind,source=${root},target=/checkout,readonly`,
      "--mount",
      `type=bind,source=${join(receipt.identityScratch, "identity")},target=/source-identity,readonly`,
      "--env",
      `CHECK_SOURCE_IDENTITY=${JSON.stringify(receipt.sourceIdentity)}`,
      "--env",
      "CHECK_SOURCE_IDENTITY_DIR=/source-identity",
      "--env",
      "HOME=/tmp",
      "--env",
      "CI=true",
      "--env",
      `CHECK_REVISION=${source.head}`,
      "--env",
      `SOURCE_LIST=${relative(root, sourceList)}`,
      "--env",
      `CHECK_STEPS=${JSON.stringify(steps)}`,
      image,
      "node",
      "--input-type=module",
      "-e",
      program,
    ]);
    if (!/^[a-f0-9]{64}$/.test(containerId)) {
      throw new Error("docker create did not return a container ID; creation is unconfirmed");
    }
    receipt.containerId = containerId;
    receipt.stage = "start";
    receipt.cleanup = "retained";
    saveReceipt();
    guard(ci);
    run("docker", ["start", containerId]);
    receipt.stage = "started";
    saveReceipt();
  } catch (error) {
    receipt.error = error.message;
    if (["image", "identity"].includes(receipt.stage)) {
      receipt.cleanup = "not-created";
    }
    let recovery = ["image", "identity"].includes(receipt.stage)
      ? "No check container was created; fix the image or identity input before retrying."
      : `Creation is unconfirmed; inspect container name ${name} before retrying.`;
    if (receipt.containerId) {
      recovery = `Container retained; collect with: node tools/checks.mjs collect ${name}`;
      try {
        const state = JSON.parse(
          run("docker", [
            "inspect",
            "--format",
            '{"id":{{json .Id}},"status":{{json .State.Status}},' +
              '"running":{{json .State.Running}},"startedAt":{{json .State.StartedAt}}}',
            receipt.containerId,
          ]),
        );
        receipt.state = state;
        if (
          state.id === receipt.containerId &&
          state.status === "created" &&
          state.running === false &&
          state.startedAt === "0001-01-01T00:00:00Z"
        ) {
          run("docker", ["rm", receipt.containerId]);
          receipt.cleanup = "removed-unstarted";
          recovery = "Owned unstarted container removed; retry start when resources are available.";
        }
      } catch (cleanupError) {
        receipt.cleanupError = cleanupError.message;
        recovery = `Container retained; inspect ${receipt.containerId}, then collect ${name} if it started.`;
      }
    }
    receipt.recovery = recovery;
    saveReceipt();
    const failure = new Error(
      `Failed to start ${name}: ${error.message}. Receipt: ${receiptPath}. ${recovery}`,
      { cause: error },
    );
    failure.exitCode = error.exitCode || 1;
    throw failure;
  }
  console.log(name);
}

function collect(name) {
  if (!/^ada-check-[a-f0-9-]{36}$/.test(name ?? "")) {
    throw new Error("Invalid check name");
  }
  const state = JSON.parse(run("docker", ["inspect", "--format", "{{json .State}}", name]));
  if (state.Running) {
    process.exitCode = 75;
    return;
  }
  const directory = resolve(results, name);
  mkdirSync(directory, { recursive: true });
  const log = openSync(resolve(directory, "docker.log"), "w");
  let logs;
  try {
    logs = spawnSync("docker", ["logs", name], { cwd: root, stdio: ["ignore", log, log] });
  } finally {
    closeSync(log);
  }
  if (logs.error) {
    throw logs.error;
  }
  if (logs.status !== 0) {
    throw new Error("Cannot preserve Docker logs; container retained");
  }
  const copy = spawnSync("docker", ["cp", `${name}:/tmp/evidence/.`, directory], {
    cwd: root,
    encoding: "utf8",
  });
  if (copy.error) {
    throw copy.error;
  }
  let missingEvidence = false;
  if (copy.status !== 0) {
    missingEvidence =
      /^Error response from daemon: Could not find the file \/tmp\/evidence(?:\/\.)? in container /i.test(
        copy.stderr.trim(),
      );
    if (!missingEvidence) {
      throw new Error(`Cannot copy evidence: ${copy.stderr}`);
    }
    writeFileSync(resolve(directory, "evidence-copy.txt"), copy.stderr);
  }
  const before = JSON.parse(readFileSync(resolve(directory, "source.json"), "utf8"));
  let after;
  let fingerprintError;
  try {
    after = snapshot();
  } catch (error) {
    fingerprintError = error.message;
  }
  const stable = before.fingerprint === after?.fingerprint;
  const verification = {
    stable,
    before: before.fingerprint,
    after: after?.fingerprint ?? null,
    beforeHead: before.head ?? null,
    afterHead: after?.head ?? null,
    fingerprintError: fingerprintError ?? null,
    missingEvidence,
    exitCode: state.ExitCode,
  };
  writeFileSync(
    resolve(directory, "verification.json"),
    `${JSON.stringify(verification, null, 2)}\n`,
  );
  run("docker", ["rm", name]);
  const startup = JSON.parse(readFileSync(resolve(directory, "startup.json"), "utf8"));
  if (startup.identityScratch) {
    const identityName = basename(startup.identityScratch);
    if (
      /^ada-check-identity-[A-Za-z0-9]{6}$/.test(identityName) &&
      join(tmpdir(), identityName) === startup.identityScratch
    ) {
      rmSync(startup.identityScratch, { recursive: true });
    }
  }
  console.log(directory);
  if (!stable) {
    throw new Error("Source changed during checks: discard results");
  }
  process.exitCode = state.ExitCode || (missingEvidence ? 1 : 0);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    const [command, argument, flag] = process.argv.slice(2);
    if (command === "start") {
      await start(argument ?? "all", flag === "--ci");
    } else if (command === "identity") {
      const source = snapshot();
      const identity = await prepareSourceIdentity(
        { image: argument, scratch: resolve(flag) },
        source,
      );
      console.log(
        JSON.stringify({ commit: identity.commit, digest: identity.digest, tree: identity.tree }),
      );
    } else if (command === "collect") {
      collect(argument);
    } else {
      throw new Error(
        "Usage: node tools/checks.mjs start [all|lint|test] [--ci] | collect <name> | identity <image> <scratch>",
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  }
}
