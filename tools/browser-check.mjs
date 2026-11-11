import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  createReadStream,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { guard, snapshot } from "./checks.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidenceRoot = resolve(root, ".check-results");

function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 30000, ...options });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`docker ${args[0]}: ${result.stderr}`);
  }
  return result.stdout?.trim();
}

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function save(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function artifactHash(directory) {
  const hash = createHash("sha256");
  function visit(path) {
    const stat = lstatSync(path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).sort()) {
        visit(resolve(path, entry));
      }
    } else if (stat.isFile()) {
      hash.update(relative(directory, path));
      hash.update(readFileSync(path));
    } else {
      throw new Error("Artifact contains a non-regular file");
    }
  }
  visit(directory);
  return hash.digest("hex");
}

function start(argument) {
  guard(false);
  const gate = realpathSync(resolve(root, argument ?? ""));
  if (!gate.startsWith(`${realpathSync(evidenceRoot)}${sep}`)) {
    throw new Error("Gate evidence must be inside .check-results");
  }
  const proof = json(resolve(gate, "verification.json"));
  const source = snapshot();
  if (!proof.stable || proof.exitCode !== 0 || proof.after !== source.fingerprint) {
    throw new Error("Require successful gate evidence for the unchanged source");
  }
  const dist = realpathSync(resolve(gate, "dist"));
  if (!dist.startsWith(`${gate}${sep}`)) {
    throw new Error("Artifact escapes gate evidence");
  }
  if (!lstatSync(resolve(dist, "index.html")).isFile()) {
    throw new Error("Missing built index.html");
  }
  const name = `ada-browser-${randomUUID()}`;
  const directory = resolve(evidenceRoot, name);
  mkdirSync(directory, { recursive: true });
  save(resolve(directory, "source.json"), { ...source, gate, artifact: artifactHash(dist) });
  const network = `${name}-net`;
  docker(["network", "create", "--internal", network]);
  const group = String(lstatSync(root).gid);
  const common = [
    "create",
    "--cpus",
    "4",
    "--memory",
    "2g",
    "--pids-limit",
    "512",
    "--init",
    "--user",
    "19001:19001",
    "--group-add",
    group,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--network",
    network,
    "--env",
    "HOME=/tmp",
    "--workdir",
    "/tmp",
    "--entrypoint",
    "node",
    "--mount",
    `type=bind,source=${root},target=/source,readonly`,
    "--mount",
    `type=bind,source=${dist},target=/dist,readonly`,
  ];
  const created = [];
  try {
    docker([
      ...common,
      "--name",
      `${name}-preview`,
      "--network-alias",
      "ada-preview",
      "node:24.22.2",
      "/source/tools/browser-check.mjs",
      "serve",
    ]);
    created.push(`${name}-preview`);
    docker([
      ...common,
      "--name",
      name,
      "--shm-size",
      "256m",
      "mcr.microsoft.com/playwright/mcp:v0.0.83",
      "/source/tools/browser-smoke.mjs",
    ]);
    created.push(name);
    guard(false);
    docker(["start", `${name}-preview`]);
    guard(false);
    docker(["start", name]);
  } catch (error) {
    save(resolve(directory, "startup-error.json"), { message: error.message, created, network });
    try {
      for (const container of created) {
        logs(container, resolve(directory, `${container}.log`));
      }
      for (const container of created) {
        docker(["stop", "--time", "5", container]);
      }
      if (created.length) {
        docker(["rm", ...created]);
      }
      docker(["network", "rm", network]);
    } catch (cleanupError) {
      save(resolve(directory, "cleanup-error.json"), {
        message: cleanupError.message,
        created,
        network,
      });
    }
    throw new Error(`${error.message}; startup evidence: ${name}`, { cause: error });
  }
  console.log(name);
}

function logs(name, path) {
  const fd = openSync(path, "w");
  try {
    docker(["logs", name], { stdio: ["ignore", fd, fd] });
  } finally {
    closeSync(fd);
  }
}

function collect(name) {
  if (!/^ada-browser-[a-f0-9-]{36}$/.test(name ?? "")) {
    throw new Error("Invalid browser run name");
  }
  const directory = resolve(evidenceRoot, name);
  const before = json(resolve(directory, "source.json"));
  const state = JSON.parse(docker(["inspect", "--format", "{{json .State}}", name]));
  if (state.Running) {
    process.exitCode = 75;
    return;
  }
  logs(name, resolve(directory, "browser.log"));
  logs(`${name}-preview`, resolve(directory, "preview.log"));
  let missingEvidence = false;
  try {
    docker(["cp", `${name}:/tmp/evidence/.`, directory]);
  } catch (error) {
    if (!/Could not find the file \/tmp\/evidence(?:\/\.)? in container /.test(error.message)) {
      throw error;
    }
    missingEvidence = true;
    writeFileSync(resolve(directory, "evidence-copy.txt"), error.message);
  }
  let after;
  let verificationError;
  let artifact;
  try {
    after = snapshot();
    artifact = artifactHash(resolve(before.gate, "dist"));
  } catch (error) {
    verificationError = error.message;
  }
  const stable = before.fingerprint === after?.fingerprint && before.artifact === artifact;
  save(resolve(directory, "verification.json"), {
    stable,
    head: before.head,
    before: before.fingerprint,
    after: after?.fingerprint ?? null,
    artifactBefore: before.artifact,
    artifactAfter: artifact ?? null,
    verificationError: verificationError ?? null,
    missingEvidence,
    exitCode: state.ExitCode,
  });
  docker(["stop", "--time", "5", `${name}-preview`]);
  docker(["rm", name, `${name}-preview`]);
  docker(["network", "rm", `${name}-net`]);
  console.log(directory);
  process.exitCode = stable && !missingEvidence ? state.ExitCode : 1;
}

function serve() {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".ico": "image/x-icon",
  };
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url, "http://ada-preview:4173");
      if (url.pathname === "/play") {
        response.writeHead(308, { Location: `/play/${url.search}` });
        response.end();
        return;
      }
      const path = resolve(
        "/dist",
        `.${decodeURIComponent(url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname)}`,
      );
      if (!path.startsWith("/dist/") || !lstatSync(path).isFile()) {
        throw new Error("Missing asset");
      }
      const type = Object.entries(types).find(([extension]) => path.endsWith(extension))?.[1];
      response.writeHead(200, {
        "Content-Type": type ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      const stream = createReadStream(path);
      stream.on("error", () => response.destroy());
      stream.pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  server.listen(4173, "0.0.0.0");
  setTimeout(() => process.exit(0), 180000);
}

try {
  const [command, argument] = process.argv.slice(2);
  if (command === "start") {
    start(argument);
  } else if (command === "collect") {
    collect(argument);
  } else if (command === "serve") {
    serve();
  } else {
    throw new Error(
      "Usage: node tools/browser-check.mjs start <gate-evidence-directory> | collect <run-name>",
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
