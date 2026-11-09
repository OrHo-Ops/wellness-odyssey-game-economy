/* Run the Full Economy V2 tests:
 *
 *     node full_economy_v2/scripts/run_tests.js
 *
 * V2 tests are named *.spec.js in full_economy_v2/tests/, a pattern Node's
 * default `node --test` discovery does not match, so a root `node --test`
 * still runs exactly V1's suite. This runner lists the V2 files explicitly,
 * which works on every Node version from 18.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const dir = path.join(__dirname, "..", "tests");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".spec.js")).sort().map((f) => path.join(dir, f));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status === null ? 1 : result.status);
