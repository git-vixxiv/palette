/**
 * palette test harness — emulators only. Nothing here touches a real Firebase
 * project, Square, or DNS.
 *
 *   npm test
 *
 * 1. unit: entitlement gating, status vocabulary, hub sign-in URL.
 * 2. Firestore emulator: palette's rules (01) and the purge sweep (02).
 * 3. Firestore + Functions emulators: the purge trigger, driven by the hub's
 *    own runPurge (03). Needs the vixxiv-id repo built at HUB_DIR.
 *
 * The Auth emulator is not needed (rules-unit-testing mints tokens), which keeps
 * port 9399 free for anything else running on this machine. Java for the
 * emulators: set JAVA_HOME, or the portable JDK under C:\dev\tools is used.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "vixxiv-id";
const win = process.platform === "win32";

const env = { ...process.env };
if (!env.JAVA_HOME) {
  const tools = "C:\\dev\\tools";
  const jdk = existsSync(tools) && readdirSync(tools).find((d) => d.startsWith("jdk-"));
  if (jdk) env.JAVA_HOME = join(tools, jdk);
}
if (env.JAVA_HOME) env.PATH = `${join(env.JAVA_HOME, "bin")}${win ? ";" : ":"}${env.PATH}`;
env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
env.GCLOUD_PROJECT = PROJECT;

const q = (s) => (win ? `"${s}"` : s);
function run(cmd, args) {
  console.log(`\n→ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: win, env });
  return r.status ?? 1;
}

let failed = 0;
failed |= run("node", ["--test", "tests/unit/*.test.ts"]);
failed |= run("npm", ["--prefix", "functions", "run", "build"]);
failed |= run("firebase", [
  "emulators:exec", "--project", PROJECT, "--only", "firestore",
  q("node --test --test-concurrency=1 tests/emulator/*.test.mjs"),
]);
failed |= run("firebase", [
  "emulators:exec", "--project", PROJECT, "--only", "firestore,functions",
  q("node --test --test-concurrency=1 tests/emulator-functions/*.test.mjs"),
]);
process.exit(failed ? 1 : 0);
