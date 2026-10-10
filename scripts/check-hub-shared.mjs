/**
 * Fails if src/vendor/vixxiv-auth.js has drifted from the identity hub's
 * shared module (hosting/shared/vixxiv-auth.js in git-vixxiv/vixxiv-id).
 *
 *   npm run check:hub                       # compare to the local hub checkout
 *   HUB_DIR=/path/to/vixxiv-id npm run check:hub
 *   HUB_URL=https://vixxiv-id-auth.web.app/shared/vixxiv-auth.js npm run check:hub
 *
 * Line endings are normalised; everything else must match byte for byte.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const norm = (s) => s.replace(/\r\n/g, "\n");
const ours = norm(readFileSync(join(root, "src", "vendor", "vixxiv-auth.js"), "utf8"));

let theirs, source;
if (process.env.HUB_URL) {
  source = process.env.HUB_URL;
  const res = await fetch(source);
  if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
  theirs = norm(await res.text());
} else {
  const hubDir = process.env.HUB_DIR || "C:/dev/vixxiv-id";
  source = join(hubDir, "hosting", "shared", "vixxiv-auth.js");
  if (!existsSync(source)) {
    console.error(`hub checkout not found at ${source}; set HUB_DIR or HUB_URL`);
    process.exit(2);
  }
  theirs = norm(readFileSync(source, "utf8"));
}

if (ours !== theirs) {
  console.error(`DRIFT: src/vendor/vixxiv-auth.js differs from ${source}. Re-copy it from the hub.`);
  process.exit(1);
}
console.log(`ok: src/vendor/vixxiv-auth.js matches ${source}`);
