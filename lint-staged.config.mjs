import { readFileSync } from "node:fs";

export default JSON.parse(readFileSync(new URL("./.lintstagedrc", import.meta.url), "utf8"));
