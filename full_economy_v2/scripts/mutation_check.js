/* Mutation check: break each V2 safeguard in a throwaway copy of the
 * repository and confirm that at least one V2 test turns red.
 *
 *     node full_economy_v2/scripts/mutation_check.js
 *
 * The copy lives in the operating system's temporary directory and is removed
 * afterwards; the working tree is never modified. Takes a few minutes.
 */
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "..");
const SIM = "full_economy_v2/engine/simulation.js";
const MUTANTS = [
  ["organic Chronons ignore the waiting rule", SIM, "if (prep.orgChr && (!waiting || cfg.accrueWhileWaiting)) {", "if (prep.orgChr) {"],
  ["mission route steps counted twice", SIM, "const daySteps = walked + routeSteps;", "const daySteps = walked + 2 * routeSteps;"],
  ["a bundle credits Energy", SIM, "credit(S_DIRECT, bundle.chronons); s.bundles++;", "credit(S_DIRECT, bundle.chronons); energy += bundle.chronons; s.bundles++;"],
  ["puzzle completion Energy paid per tile", SIM, "pieces -= pz.piecesPerTile; st.tiles++; s.tilesRevealed++; s.piecesSpent += pz.piecesPerTile;",
    "pieces -= pz.piecesPerTile; st.tiles++; s.tilesRevealed++; s.piecesSpent += pz.piecesPerTile; energy += pz.completionEnergy; s.ePuzzle += pz.completionEnergy;"],
  ["puzzle bonus paid at eight tiles", SIM, "if (st.tiles >= pz.tiles) {\n          if (!st.paid)", "if (st.tiles >= pz.tiles - 1) {\n          if (!st.paid)"],
  ["pending PP pays part of a price", SIM, "if (chronons - envelope + 1e-9 < prep.price[next]) break;\n            spend(prep.price[next], spentJ);",
    "if (chronons - envelope + pendingPP + 1e-9 < prep.price[next]) break;\n            spend(Math.min(prep.price[next], chronons), spentJ);"],
  ["a mission is rewarded twice", SIM, "credit(src, reward.chronons);", "credit(src, reward.chronons); credit(src, reward.chronons);"],
  ["a refund is not clawed back", SIM, "comp[S_STORE] -= take; chronons -= take; s.clawedFromBalance += take;\n            debt += ch - take; s.debtCreated += ch - take; s.storeChrononsGranted -= ch;", "s.storeChrononsGranted -= 0;"],
  ["spins happen with no active journey", SIM, "if (chronons - envelope + 1e-9 < prep.price[next]) break;",
    "if (chronons - envelope + 1e-9 < prep.price[next]) { while (energy >= prep.minSpin) { energy -= 10; s.eCharged += 10; s.spins++; s.ppEarned += 10.45; pendingPP += 10.45; } break; }"],
  ["store Chronons credited before the return window", SIM, "if (cfg.clawbackPolicy === \"pending\") { if (!refunded && ch > 0) storePending.push(d + cfg.verificationDays, ch); }",
    "if (cfg.clawbackPolicy === \"pending\") { if (ch > 0) storePending.push(d, ch); }"],
  ["prices follow the pacing curve", "full_economy_v2/engine/projection_catalog.js", "const calPp = ppSchedule(cfg, cfg.priceCalibrationPpCurve);", "const calPp = ppSchedule(cfg, cfg.ppCurve);"],
  ["a cosmetic may carry an effect", "full_economy_v2/config/cosmetics_catalog.js", "for (const k of Object.keys(it)) if (!ALLOWED_KEYS.includes(k))", "for (const k of []) if (!ALLOWED_KEYS.includes(k))"],
  ["the implemented PP rule drifts", "full_economy_v2/config/scenario_config.js", "costMultiplier: 1.08,", "costMultiplier: 1.09,"],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v2-mutants-"));
const skip = new Set([".git", "node_modules", "outputs"]);
let survived = 0;
try {
  for (const [name, rel, from, to] of MUTANTS) {
    const dir = path.join(tmp, "repo");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !(path.dirname(src) === ROOT && skip.has(path.basename(src))) });
    const file = path.join(dir, rel), text = fs.readFileSync(file, "utf8");
    if (text.split(from).length !== 2) { console.log(`?    ${name}: pattern not found exactly once`); survived++; continue; }
    fs.writeFileSync(file, text.replace(from, to));
    const files = fs.readdirSync(path.join(dir, "full_economy_v2", "tests")).filter((f) => f.endsWith(".spec.js")).sort()
      .map((f) => path.join(dir, "full_economy_v2", "tests", f));
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], { encoding: "utf8" });
    const red = (run.stdout.match(/^not ok/gm) || []).length;
    console.log(`${red ? "ok  " : "MISS"} ${name}: ${red} failing test${red === 1 ? "" : "s"}`);
    if (!red) survived++;
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${MUTANTS.length - survived} of ${MUTANTS.length} mutants caught.`);
process.exitCode = survived ? 1 : 0;
