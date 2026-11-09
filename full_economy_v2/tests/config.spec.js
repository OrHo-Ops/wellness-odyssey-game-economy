"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { C, K, V1Model, ROOT } = require("./helpers.js");

test("the default scenario is valid and unknown or invalid inputs are refused", () => {
  assert.deepEqual(C.validateScenario(C.buildScenario()), []);
  assert.throws(() => C.buildScenario({ notAKey: 1 }), /Unknown scenario key/);
  assert.match(C.validateScenario(C.buildScenario({ organicChrononsPer1000: -1 })).join(" "), /at least 0/);
  assert.match(C.validateScenario(C.buildScenario({ priceCurve: "zigzag" })).join(" "), /must be one of/);
  assert.match(C.validateScenario(C.buildScenario({ tierMix: { 7: 1 } })).join(" "), /not a V3 tier/);
  assert.match(C.validateScenario(C.buildScenario({ energyCap: 300 })).join(" "), /must be one of/);
});

test("linked values are read from the V1 engine, not copied", () => {
  assert.equal(C.linked("stepsPerEnergy"), V1Model.RULES.stepsPerEnergy);
  assert.equal(C.linked("jerusalemPp"), V1Model.RULES.jerusalemJourneyPp);
  assert.equal(C.linked("missionKm"), V1Model.DEFAULTS.mediumMissionKm);
  assert.equal(C.linked("missionPieces"), V1Model.DEFAULTS.mediumMissionPieces);
  assert.equal(C.linked("missionChronons"), V1Model.DEFAULTS.mediumMissionChronons);
  assert.equal(C.linked("puzzleTiles"), V1Model.DEFAULTS.puzzleTiles);
  assert.equal(C.linked("piecesPerTile"), V1Model.DEFAULTS.piecesPerTile);
  assert.equal(C.linked("puzzleCompletionEnergy"), V1Model.DEFAULTS.puzzleCompletionEnergy);
  assert.deepEqual([C.linked("missionKm"), C.linked("missionPieces"), C.linked("missionChronons")], [2, 90, 5]);
});

test("the seven implemented destinations keep their implemented PP, pinned to assumptions.csv", () => {
  const rows = fs.readFileSync(path.join(ROOT, "assumptions.csv"), "utf8").trim().split("\n").map((l) => l.split(","));
  const value = (name) => Number(rows.find((r) => r[1] === name)[2]);
  assert.equal(value("region_base_cost"), C.IMPLEMENTED.baseCostPp);
  assert.equal(value("region_cost_multiplier"), C.IMPLEMENTED.costMultiplier);
  assert.equal(value("region_count"), C.IMPLEMENTED.destinations.length);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(C.implementedPp), [1500, 1620, 1750, 1890, 2041, 2204, 2380]);
  assert.deepEqual([...C.IMPLEMENTED.destinations], ["Jerusalem", "Dead Sea", "Petra", "Cappadocia", "Burj Khalifa", "Acropolis", "Santorini"]);
});

test("every input carries a status, and approved rules have the owner's defaults", () => {
  const allowed = ["hypothetical", "approved", "implemented"];
  for (const p of C.PARAMS) assert.ok(allowed.includes(p.status), `${p.key} has status ${p.status}`);
  const d = C.DEFAULTS;
  assert.equal(d.accrueWhileWaiting, true);
  assert.equal(d.pendingPpApplication, "full");
  assert.equal(d.energyCap, null, "no cap is the analytical baseline");
  assert.equal(d.dailyBonuses, false);
  assert.equal(d.tileRevealChronons, 0, "tile reveals pay nothing unless the experiment is on");
  assert.ok(C.PARAMS.find((p) => p.key === "energyCap").options.includes(250) && C.PARAMS.find((p) => p.key === "energyCap").options.includes(500));
});

test("the cosmetic catalog is valid, varied and proposed examples only", () => {
  assert.deepEqual(K.validateCatalog(), []);
  assert.equal(K.ITEMS.length, 28);
  for (const it of K.ITEMS) assert.equal(it.status, "proposed example");
  const cats = new Set(K.ITEMS.map((it) => it.category));
  assert.deepEqual([...cats].sort(), ["characters", "clothing", "equipment", "pets"]);
});

test("a cosmetic cannot carry a gameplay effect", () => {
  for (const key of ["energy", "pp", "chronons", "score", "odds", "boost", "effect"]) {
    const items = [...K.ITEMS.slice(1), { ...K.ITEMS[0], [key]: 1 }];
    assert.match(K.validateCatalog(items).join(" "), new RegExp(`"${key}" is not allowed`), key);
  }
  assert.match(K.validateCatalog([...K.ITEMS.slice(1), { ...K.ITEMS[0], price: { v: 10, s: "verified" } }]).join(" "), /price must be/);
});

test("cosmetic prices rise with rarity and scale with the organic reference", () => {
  const cfg = C.buildScenario();
  const weekly = C.weeklyOrganicReference(cfg, 1);
  const byRarity = (r) => K.priceOf(K.ITEMS.find((it) => it.rarity === r), cfg.rarityWeeks, weekly);
  const prices = K.RARITIES.map(byRarity);
  for (let i = 1; i < prices.length; i++) assert.ok(prices[i] > prices[i - 1], prices.join(" < "));
  assert.ok(byRarity("rare") < K.priceOf(K.ITEMS.find((it) => it.rarity === "rare"), cfg.rarityWeeks, weekly * 2));
});
