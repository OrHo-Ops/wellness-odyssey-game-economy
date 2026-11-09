"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { V2, C, S } = require("./helpers.js");

const ORDER = ["../../pilot/pilot_model.js", "../../pilot/world_tour.js", "../generated/wheel_table.js", "../config/scenario_config.js", "../config/cosmetics_catalog.js",
  "../engine/wheel_v3.js", "../engine/projection_catalog.js", "../engine/journey_ledger.js", "../engine/business.js", "../engine/simulation.js"];
const dashboard = path.join(V2, "dashboard", "index.html");

/** A minimal stand-in for the browser: enough DOM for the lab to render into. */
function browser() {
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, innerHTML: "", textContent: "", style: {}, dataset: {}, children: [], value: "", checked: false,
    appendChild(c) { this.children.push(c); return c; }, querySelectorAll: () => [], querySelector: () => el(`${id}-child`),
    addEventListener() {}, setAttribute() {}, remove() {}, getBoundingClientRect: () => ({ left: 0, width: 560 }) });
  const ctx = { console, setTimeout: () => 0, clearTimeout() {}, location: { hash: "" }, history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ getPropertyValue: () => "#2a78d6" }) };
  let n = 0;
  ctx.document = { getElementById: el, createElement: () => el(`new-${n++}`), createElementNS: () => el(`svg-${n++}`), documentElement: el("root") };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  return { ctx, els };
}

test("the engine loads in a browser, in the order the lab loads it", () => {
  const { ctx } = browser();
  for (const f of ORDER) vm.runInContext(fs.readFileSync(path.join(V2, "dashboard", f), "utf8"), ctx, { filename: f });
  for (const g of ["PilotModel", "WorldTour", "V2WheelTable", "V2Config", "V2Cosmetics", "V2Wheel", "V2Projection", "V2Ledger", "V2Business", "V2Sim"]) assert.ok(ctx[g], g);
  const cfg = ctx.V2Config.buildScenario({ playersPerCohort: 5, horizonDays: 300 });
  const browserRun = ctx.V2Sim.runCohort(ctx.V2Sim.prepare(cfg), "moderate-regular-organic");
  const nodeRun = S.runCohort(S.prepare(C.buildScenario({ playersPerCohort: 5, horizonDays: 300 })), "moderate-regular-organic");
  assert.equal(JSON.stringify(browserRun.daysTo.slice(0, 20)), JSON.stringify(nodeRun.daysTo.slice(0, 20)), "browser and Node engines disagree");
});

test("the generated browser wheel table is current with analysis/wheel.js", () => {
  const { wheelTableJs } = require(path.join(V2, "scripts", "build_v2.js"));
  assert.equal(fs.readFileSync(path.join(V2, "generated", "wheel_table.js"), "utf8"), wheelTableJs());
});

test("the lab renders its figures, flags and table without errors", () => {
  const { ctx, els } = browser();
  const html = fs.readFileSync(dashboard, "utf8");
  for (const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1])) {
    vm.runInContext(fs.readFileSync(path.join(V2, "dashboard", src), "utf8"), ctx, { filename: src });
  }
  const inline = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
  vm.runInContext(inline, ctx, { filename: "dashboard inline script" });
  assert.match(els.kpis.innerHTML, /Journey 100 finished/);
  assert.ok((els.flags.innerHTML.match(/class="flag"/g) || []).length >= 2);
  assert.equal((els.table.innerHTML.match(/<tr>/g) || []).length, 101);
  for (const id of ["c1", "c2", "c3", "c4"]) assert.ok(els[id].children.length > 0, `chart ${id} is empty`);
});

test("the exact mission-frequency override applies to mission players only", () => {
  const prep = S.prepare(C.buildScenario({ missionRatePerActiveDay: 0.5, horizonDays: 200 }));
  assert.equal(S.simulatePlayer(prep, "moderate-walking", 0).s.organicMissions, 0);
  assert.ok(S.simulatePlayer(prep, { ...C.COHORTS["moderate-walking"], missions: "regular" }, 0).s.organicMissions > 0);
});
