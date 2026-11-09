"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { C, P, W, WorldTour, close } = require("./helpers.js");

const cfg = C.buildScenario();

test("the projection holds 100 journeys: Jerusalem free, then the six other implemented destinations", () => {
  const pr = P.buildProjection(cfg);
  assert.equal(pr.journeys.length, 100);
  const [j1] = pr.journeys;
  assert.equal(j1.label, "Jerusalem"); assert.equal(j1.price, null); assert.equal(j1.kind, "start"); assert.equal(j1.pp, 1500);
  C.IMPLEMENTED.destinations.forEach((name, i) => {
    assert.equal(pr.journeys[i].label, name);
    assert.equal(pr.journeys[i].pp, C.implementedPp(i + 1));
  });
  for (const j of pr.journeys.slice(7)) { assert.equal(j.kind, "placeholder"); assert.match(j.label, /\(placeholder\)$/); }
});

test("the implemented 8% growth is not extrapolated", () => {
  const extrapolated = Math.round(1500 * Math.pow(1.08, 99));
  assert.ok(extrapolated > 3e6, `journey 100 at 8% growth would cost ${extrapolated} PP`);
  for (const curve of Object.keys(C.PP_CURVES)) {
    const s = P.ppSchedule(cfg, curve);
    assert.deepEqual(s.slice(0, 7), [1500, 1620, 1750, 1890, 2041, 2204, 2380], curve);
    assert.ok(Math.max(...s) <= cfg.ppCapMultiple * 1500 * 1.0001 + (curve === "gentle" ? 2380 : 0), curve);
  }
  assert.ok(P.ppSchedule(cfg, "flat").slice(7).every((x) => x === 2380));
  assert.ok(P.ppSchedule(cfg, "capped").every((x) => x <= 3 * 1500));
  assert.equal(P.ppSchedule(cfg, "gentle")[99], Math.round(2380 * (1 + 0.01 * 93)));
});

test("PP length and Chronon price are separate schedules", () => {
  const base = P.priceSchedule(cfg);
  for (const curve of Object.keys(C.PP_CURVES)) assert.deepEqual(P.priceSchedule(C.buildScenario({ ppCurve: curve })), base, `pacing ${curve} repriced journeys`);
  for (const fam of Object.keys(C.PRICE_CURVES)) assert.deepEqual(P.ppSchedule(C.buildScenario({ priceCurve: fam })), P.ppSchedule(cfg), `price ${fam} changed PP`);
  assert.deepEqual(P.priceSchedule(C.buildScenario({ organicChrononsPer1000: 3 })), base, "the organic rate alone repriced journeys");
  assert.deepEqual(P.priceSchedule(C.buildScenario({ completionRewardPer100Pp: 2 })), base, "the completion reward alone repriced journeys");
});

test("budget-matched price families charge the hybrid's total, differently over time", () => {
  const total = (fam) => P.priceSchedule(cfg, fam).slice(1).reduce((a, b) => a + b, 0);
  const hybrid = total("hybrid");
  for (const fam of ["linear", "exponential", "piecewise", "milestone"]) close(assert, total(fam), hybrid, 60, fam);
  assert.ok(Math.abs(total("exponential-fixed") - hybrid) > 1000, "the fixed-start exponential is deliberately not matched");
  const early = (fam) => P.priceSchedule(cfg, fam).slice(1, 11).reduce((a, b) => a + b, 0);
  assert.ok(early("exponential") < early("linear"), "exponential is back-loaded relative to linear");
});

test("hybrid prices meet their coverage targets at the calibration basis", () => {
  const pp = P.ppSchedule(cfg, cfg.priceCalibrationPpCurve), rewards = P.completionRewards(cfg, pp), price = P.priceSchedule(cfg, "hybrid");
  for (const k of [2, 10, 25, 40, 60, 100]) {
    const earned = (W.stepsForPp(pp[k - 2]) * cfg.priceCalibrationOrganicPer1000) / 1000 + rewards[k - 2];
    close(assert, earned / price[k - 1], P.coverageAt(cfg.coverageLevel, k), 0.05, `coverage at journey ${k}`);
  }
});

test("prices never fall along the unlock order, and index order respects prerequisites", () => {
  for (const fam of Object.keys(C.PRICE_CURVES)) {
    const s = P.priceSchedule(cfg, fam).slice(1);
    for (let i = 1; i < s.length; i++) assert.ok(s[i] >= s[i - 1], `${fam}: journey ${i + 2} cheaper than ${i + 1}`);
  }
  const pr = P.buildProjection(cfg);
  for (const j of pr.journeys) for (const r of j.requires) assert.ok(r < j.index, `journey ${j.index} requires later ${r}`);
  assert.deepEqual([...pr.journeys[10].requires], [8, 9, 10]);
});

test("the projection passes V1's catalog validator through the wrapper: valid, not ready", () => {
  const pr = P.buildProjection(cfg), cat = P.toCatalog(pr, cfg), before = JSON.stringify(cat);
  const v = P.validateProjectionCatalog(cat);
  assert.deepEqual(v.errors, []);
  assert.equal(v.readiness.ready, false);
  assert.deepEqual(v.readiness.emptyRoadmapEras, ["earlier-era"]);
  assert.equal(JSON.stringify(cat), before, "validation must not modify the catalog");
  assert.equal(cat.status, P.V2_STATUS);
  assert.equal(WorldTour.validateCatalog(cat).errors.some((e) => /catalog.status/.test(e)), true, "V1 alone refuses the V2 status, hence the wrapper");
});

test("the wrapper refuses a wrong status, a changed implemented PP, a forward prerequisite and a 'verified' literal", () => {
  const pr = P.buildProjection(cfg);
  const mutate = (f) => { const c = P.toCatalog(pr, cfg); f(c); return P.validateProjectionCatalog(c).errors.join(" "); };
  assert.match(mutate((c) => { c.status = "pilot-illustrative"; }), /catalog.status must be/);
  assert.match(mutate((c) => { c.journeys[3].pp = { v: 1900, s: "hypothetical" }; }), /keep its implemented 1890 PP/);
  assert.match(mutate((c) => { c.journeys[20].requires = [c.journeys[30].id]; }), /comes later in index order/);
  assert.match(mutate((c) => { c.journeys[40].price = { v: 70, s: "verified" }; }), /cannot be labelled verified/);
});

test("puzzle structures: Jaffa Gate only, one per destination, or one every k journeys", () => {
  assert.equal(P.puzzles(C.buildScenario({ puzzleStructure: "jaffa-only" })).length, 1);
  assert.equal(P.puzzles(C.buildScenario({ puzzleStructure: "per-destination" })).length, 100);
  assert.equal(P.puzzles(C.buildScenario({ puzzleStructure: "every-k", puzzleEveryK: 5 })).length, 20);
  const [jaffa] = P.puzzles(cfg);
  assert.deepEqual([jaffa.tiles, jaffa.piecesPerTile, jaffa.completionEnergy, jaffa.linked], [9, 30, 100, true]);
});
