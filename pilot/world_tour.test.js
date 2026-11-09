// node --test (from the repository root)
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("./pilot_model.js");
const W = require("./world_tour.js");
const ILLUSTRATIVE = require("./catalogs/illustrative_world_tour.js");

const clone = (x) => structuredClone(x);
const edit = (fn) => {
  const c = clone(ILLUSTRATIVE);
  fn(c);
  return c;
};
const byId = (list, id) => list.find((x) => x.id === id);
const hypothetical = (v) => ({ v, s: "hypothetical" });

function oneError(catalog, pattern) {
  const { errors } = W.validateCatalog(catalog);
  assert.equal(errors.length, 1, `expected exactly one error, got:\n${errors.join("\n")}`);
  assert.match(errors[0], pattern);
}

/** A validator test fixture, not a proposed World Tour structure: Jerusalem
 * plus placeholder destinations with every value unset, joined as a star
 * (each requires Jerusalem) or a chain (each requires the one before). */
function fixtureCatalog(destinations, shape) {
  const c = clone(ILLUSTRATIVE);
  c.id = `fixture-${shape}-${destinations}`;
  c.status = "test-fixture";
  const ids = Array.from({ length: destinations - 1 }, (_, i) => `d${String(i + 2).padStart(3, "0")}`);
  c.regions.push({ id: "fixture-region", label: "Fixture region" });
  c.cities = [byId(c.cities, "jerusalem"), ...ids.map((id) => ({ id, label: `Destination ${id}`, region: "fixture-region" }))];
  c.monuments = c.monuments.filter((m) => m.city === "jerusalem");
  c.puzzles = [byId(c.puzzles, "jaffa-gate")];
  c.collections = [];
  c.journeys = [byId(c.journeys, "jerusalem"), ...ids.map((id, i) => ({
    id, label: `Destination ${id}`, era: "present-day", city: id, pp: null, price: null,
    requires: [shape === "star" || i === 0 ? "jerusalem" : ids[i - 1]], onComplete: { chronons: null },
  }))];
  return c;
}

/** Set a readiness path, e.g. "journeys.paris.pp", in a catalog. */
function setPath(catalog, p, value) {
  const [list, id, ...rest] = p.split(".");
  let obj = list === "organic" ? catalog.organic[id] : byId(catalog[list], id);
  while (rest.length > 1) obj = obj[rest.shift()];
  obj[rest[0]] = value;
}

// --------------------------------------------------------------------------
// The illustrative catalog
// --------------------------------------------------------------------------

test("the illustrative catalog is valid but not ready", () => {
  assert.deepEqual(W.validateCatalog(ILLUSTRATIVE), { errors: [], warnings: [] });
  const journeySlots = (id) => [`journeys.${id}.pp`, `journeys.${id}.price`, `journeys.${id}.onComplete.chronons`];
  const puzzleSlots = (id) => [`puzzles.${id}.tiles`, `puzzles.${id}.piecesPerTile`, `puzzles.${id}.onComplete.energy`];
  assert.deepEqual(W.readiness(ILLUSTRATIVE), {
    ready: false,
    unset: [
      "organic.chronons.verifiedSteps.amount", "organic.chronons.verifiedSteps.perSteps",
      "organic.pieces.verifiedSteps.amount", "organic.pieces.verifiedSteps.perSteps",
      "eras.present-day.transitionReward",
      "journeys.jerusalem.onComplete.chronons",
      ...journeySlots("paris"), ...journeySlots("rome"), ...journeySlots("pisa"),
      ...puzzleSlots("eiffel-tower"), ...puzzleSlots("arc-de-triomphe"), ...puzzleSlots("colosseum"), ...puzzleSlots("leaning-tower"),
      "collections.paris.reward",
    ],
    emptyRoadmapEras: ["earlier-era"],
  });
});

test("Jerusalem and the Jaffa Gate puzzle are links to the model's constants, not copies", () => {
  const jerusalem = byId(ILLUSTRATIVE.journeys, "jerusalem");
  const jaffa = byId(ILLUSTRATIVE.puzzles, "jaffa-gate");
  assert.deepEqual(jerusalem.pp, { ref: "RULES.jerusalemJourneyPp" });
  assert.deepEqual(W.resolveValue(jerusalem.pp), { set: true, v: M.RULES.jerusalemJourneyPp, s: "verified", ref: "RULES.jerusalemJourneyPp" });
  assert.deepEqual(W.resolveValue(jaffa.tiles), { set: true, v: M.DEFAULTS.puzzleTiles, s: "proposed", ref: "DEFAULTS.puzzleTiles" });
  assert.deepEqual(W.resolveValue(jaffa.piecesPerTile), { set: true, v: M.DEFAULTS.piecesPerTile, s: "proposed", ref: "DEFAULTS.piecesPerTile" });
  assert.deepEqual(W.resolveValue(jaffa.onComplete.energy),
    { set: true, v: M.DEFAULTS.puzzleCompletionEnergy, s: "proposed", ref: "DEFAULTS.puzzleCompletionEnergy" });
  assert.deepEqual(W.resolveValue(null), { set: false });
  assert.deepEqual(W.resolveValue(hypothetical(7)), { set: true, v: 7, s: "hypothetical" });
});

test("the progression rules are the approved baseline and cannot be changed", () => {
  assert.deepEqual(W.PROGRESSION_RULES, {
    unlock: "prerequisites", choice: "eligible-and-affordable", ppOverflow: "pending",
    pendingPpPaysPrice: false, ppWithoutActiveJourney: false, eraCompletion: "all",
  });
  assert.ok(Object.isFrozen(W.PROGRESSION_RULES));
  assert.ok(Object.isFrozen(W.LINKS));
});

test("the World Tour layer holds no Wheel figures", () => {
  for (const file of ["world_tour.js", path.join("catalogs", "illustrative_world_tour.js")]) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.doesNotMatch(source, /1\.04|0\.998|expectedPp|expectedEnergy|ppPerNetEnergy/, file);
  }
  assert.deepEqual(Object.keys(W.LINKS),
    ["RULES.jerusalemJourneyPp", "DEFAULTS.puzzleTiles", "DEFAULTS.piecesPerTile", "DEFAULTS.puzzleCompletionEnergy"]);
});

test("validation and readiness do not modify the catalog", () => {
  const before = clone(ILLUSTRATIVE);
  W.validateCatalog(ILLUSTRATIVE);
  W.readiness(ILLUSTRATIVE);
  assert.deepEqual(ILLUSTRATIVE, before);
});

test("a catalog with every value set is ready", () => {
  const c = edit((x) => {
    x.eras = [byId(x.eras, "present-day")];
    x.eras[0].next = null;
    delete x.eras[0].transitionReward;
  });
  for (const p of W.readiness(c).unset) setPath(c, p, p.endsWith(".reward") ? { chronons: hypothetical(1) } : hypothetical(1));
  assert.deepEqual(W.validateCatalog(c).errors, []);
  assert.deepEqual(W.readiness(c), { ready: true, unset: [], emptyRoadmapEras: [] });
});

test("an empty roadmap era keeps a catalog from being ready, even with every value set", () => {
  const c = clone(ILLUSTRATIVE);
  for (const p of W.readiness(c).unset) setPath(c, p, p.endsWith("Reward") || p.endsWith(".reward") ? { chronons: hypothetical(1) } : hypothetical(1));
  assert.deepEqual(W.readiness(c), { ready: false, unset: [], emptyRoadmapEras: ["earlier-era"] });
});

test("readiness refuses an invalid catalog", () => {
  assert.throws(() => W.readiness(edit((c) => { byId(c.journeys, "paris").city = "lyon"; })), /Invalid catalog/);
});

// --------------------------------------------------------------------------
// Links and labels
// --------------------------------------------------------------------------

test("a linked slot cannot be replaced by a literal", () => {
  oneError(edit((c) => { byId(c.journeys, "jerusalem").pp = { v: 1500, s: "proposed" }; }),
    /journeys\.jerusalem\.pp must link to RULES\.jerusalemJourneyPp/);
  oneError(edit((c) => { byId(c.puzzles, "jaffa-gate").tiles = { v: 9, s: "proposed" }; }),
    /puzzles\.jaffa-gate\.tiles must link to DEFAULTS\.puzzleTiles/);
  oneError(edit((c) => { byId(c.puzzles, "jaffa-gate").piecesPerTile = null; }),
    /piecesPerTile must link to DEFAULTS\.piecesPerTile/);
  oneError(edit((c) => { byId(c.puzzles, "jaffa-gate").onComplete = { energy: { v: 100, s: "proposed" } }; }),
    /onComplete\.energy must link to DEFAULTS\.puzzleCompletionEnergy/);
});

test("a link is used only at its own slot, and only model constants can be linked", () => {
  oneError(edit((c) => { byId(c.journeys, "paris").pp = { ref: "RULES.jerusalemJourneyPp" }; }),
    /journeys\.paris\.pp: RULES\.jerusalemJourneyPp may only be used at journeys\.jerusalem\.pp/);
  oneError(edit((c) => { byId(c.journeys, "paris").pp = { ref: "RULES.expectedPpPerStake" }; }),
    /"RULES\.expectedPpPerStake" is not a linkable model constant/);
});

test("no literal value can be labelled verified", () => {
  oneError(edit((c) => { byId(c.journeys, "paris").pp = { v: 1500, s: "verified" }; }),
    /journeys\.paris\.pp: a catalog value cannot be labelled verified/);
  oneError(edit((c) => { byId(c.journeys, "paris").price = { v: 10, s: "approved" }; }),
    /label must be proposed or hypothetical/);
});

for (const [name, slot, value, pattern] of [
  ["NaN", "pp", NaN, /must be a whole number above 0, not NaN/],
  ["Infinity", "pp", Infinity, /not Infinity/],
  ["a negative number", "pp", -1, /not -1/],
  ["a fraction", "pp", 1.5, /not 1\.5/],
  ["a string", "pp", "1500", /not "1500"/],
  ["zero PP", "pp", 0, /above 0, not 0/],
  ["a negative price", "price", -5, /0 or more, not -5/],
]) {
  test(`${name} is refused as a ${slot}`, () => {
    oneError(edit((c) => { byId(c.journeys, "paris")[slot] = hypothetical(value); }), pattern);
  });
}

test("a price of 0 is a valid hypothetical value", () => {
  assert.deepEqual(W.validateCatalog(edit((c) => { byId(c.journeys, "paris").price = hypothetical(0); })).errors, []);
});

// --------------------------------------------------------------------------
// Structure, one mistake at a time
// --------------------------------------------------------------------------

/** Mistakes whose consequences are reported too. A shared play order also
 * leaves the era chain out of order; a repeated start journey also breaks
 * "Jerusalem alone". Every other mistake must produce exactly one error. */
const CASCADES = new Set(["a duplicate play order", "a first era that does not start with Jerusalem alone"]);

for (const [name, mutate, pattern] of [
  ["an unknown catalog status", (c) => { c.status = "production"; }, /catalog\.status must be one of/],
  ["a duplicate id", (c) => { c.journeys.push(clone(byId(c.journeys, "paris"))); }, /journeys\.paris: duplicate id/],
  ["a malformed id", (c) => { c.collections[0].id = "Paris Collection"; }, /collections\.Paris Collection: id must be lower-case/],
  ["an unknown key", (c) => { byId(c.journeys, "paris").dailyLoginChronons = hypothetical(5); }, /journeys\.paris: unknown key "dailyLoginChronons"/],
  ["a missing key", (c) => { delete byId(c.journeys, "paris").onComplete; }, /journeys\.paris: missing "onComplete"/],
  ["a reference to a missing city", (c) => { byId(c.journeys, "paris").city = "lyon"; }, /journeys\.paris: unknown city "lyon"/],
  ["a reference to a missing region", (c) => { byId(c.cities, "paris").region = "europe"; }, /cities\.paris: unknown region "europe"/],
  ["an unknown prerequisite", (c) => { byId(c.journeys, "rome").requires = ["naples"]; }, /journeys\.rome: unknown prerequisite "naples"/],
  ["a repeated prerequisite", (c) => { byId(c.journeys, "rome").requires = ["jerusalem", "jerusalem"]; }, /prerequisite "jerusalem" is listed twice/],
  ["a prerequisite cycle", (c) => { byId(c.journeys, "paris").requires = ["jerusalem", "rome"];
    byId(c.journeys, "rome").requires = ["jerusalem", "paris"]; }, /in or behind a prerequisite cycle: paris, rome/],
  ["a journey that requires itself", (c) => { byId(c.journeys, "pisa").requires = ["pisa"]; }, /prerequisite cycle: pisa\./],
  ["a priced start journey", (c) => { byId(c.journeys, "jerusalem").price = null; }, /a start journey is unlocked free; remove "price"/],
  ["a start journey with a prerequisite", (c) => { byId(c.journeys, "jerusalem").requires = ["pisa"]; }, /a start journey has no prerequisites/],
  ["a journey without a price", (c) => { delete byId(c.journeys, "paris").price; }, /journeys\.paris: missing "price"/],
  ["a prerequisite from another era", (c) => {
    c.journeys.push({ id: "earlier-jerusalem", label: "Jerusalem, earlier", era: "earlier-era", city: "jerusalem",
      pp: null, price: null, requires: ["paris"], onComplete: { chronons: null } });
  }, /prerequisite "paris" belongs to another era/],
  ["a completion rule other than all", (c) => { c.eras[0].completion = { count: 2 }; }, /completion must be "all"/],
  ["an era that is never reached", (c) => { c.eras[0].next = null; delete c.eras[0].transitionReward; },
    /eras\.earlier-era: not reached from the first era/],
  ["an era that leads back", (c) => { c.eras[1].next = "present-day"; c.eras[1].transitionReward = null; },
    /eras\.earlier-era: next era "present-day" must come later in play order/],
  ["a duplicate play order", (c) => { c.eras[1].playOrder = 1; }, /eras\.earlier-era: playOrder 1 is also used by present-day\./],
  ["a transition reward with no next era", (c) => { c.eras[1].transitionReward = null; }, /transitionReward needs a next era/],
  ["a next era with no transition reward key", (c) => { delete c.eras[0].transitionReward; }, /missing "transitionReward"/],
  ["a non-roadmap era with no journeys", (c) => { c.eras[1].status = "illustrative"; }, /not on the roadmap needs at least one journey/],
  ["a first era that does not start with Jerusalem alone", (c) => { c.eras[0].startJourneys = ["jerusalem", "jerusalem"]; },
    /listed twice|starts with Jerusalem alone/],
  ["a puzzle on a missing monument", (c) => { byId(c.puzzles, "colosseum").monument = "pantheon"; }, /unknown monument "pantheon"/],
  ["a malformed availability rule", (c) => { byId(c.puzzles, "colosseum").availableWhen = "later"; }, /availableWhen must be "start"/],
  ["a collection spanning two cities", (c) => { c.collections[0].puzzles.push("colosseum"); },
    /collections\.paris: puzzle "colosseum" belongs to another city/],
  ["an unknown reward", (c) => { byId(c.journeys, "paris").onComplete = { coins: null }; }, /onComplete\.coins: unknown reward/],
]) {
  test(`structure: ${name} is refused`, () => {
    const { errors } = W.validateCatalog(edit(mutate));
    assert.ok(errors.length >= 1, "no error reported");
    assert.ok(errors.some((e) => pattern.test(e)), errors.join("\n"));
    if (!CASCADES.has(name)) assert.equal(errors.length, 1, errors.join("\n"));
  });
}

test("the first era must start with Jerusalem", () => {
  const { errors } = W.validateCatalog(edit((c) => {
    c.eras[0].startJourneys = ["paris"];
    byId(c.journeys, "jerusalem").price = null;
    delete byId(c.journeys, "paris").price;
    byId(c.journeys, "paris").requires = [];
  }));
  assert.deepEqual(errors, ['eras.present-day: the first era starts with Jerusalem alone (startJourneys: ["jerusalem"]).']);
});

test("a puzzle tied to a journey in another city is a warning, not an error", () => {
  const result = W.validateCatalog(edit((c) => { byId(c.puzzles, "colosseum").availableWhen = { journeyUnlocked: "paris" }; }));
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /puzzles\.colosseum: becomes available with "paris", a journey in another city/);
});

// --------------------------------------------------------------------------
// Organic earning rules
// --------------------------------------------------------------------------

test("organic rewards are earned from verified walking only", () => {
  oneError(edit((c) => { c.organic.chronons.dailyLogin = { amount: null, perSteps: null }; }),
    /organic\.chronons: "dailyLogin" is not a supported basis\. Organic rewards are earned from verified walking only/);
  oneError(edit((c) => { delete c.organic.pieces.verifiedSteps; }), /organic\.pieces: missing "verifiedSteps"/);
});

test("future earning safeguards are reserved, not implemented", () => {
  oneError(edit((c) => { c.organic.chronons.verifiedSteps.periodCap = null; }),
    /organic\.chronons\.verifiedSteps: "periodCap" is reserved for a future safeguard/);
  oneError(edit((c) => { c.organic.pieces.verifiedSteps.stepDeduplication = "missions"; }),
    /"stepDeduplication" is reserved for a future safeguard/);
});

test("an organic rate needs both its amount and its step count", () => {
  oneError(edit((c) => { c.organic.chronons.verifiedSteps.amount = hypothetical(1); }),
    /organic\.chronons\.verifiedSteps: set both amount and perSteps/);
  oneError(edit((c) => { c.organic.pieces.verifiedSteps = { amount: hypothetical(1), perSteps: hypothetical(0) }; }),
    /perSteps: must be a whole number above 0, not 0/);
  const set = edit((c) => { c.organic.chronons.verifiedSteps = { amount: hypothetical(1), perSteps: hypothetical(5000) }; });
  assert.deepEqual(W.validateCatalog(set).errors, []);
});

// --------------------------------------------------------------------------
// Validator test fixtures at roadmap scale
// --------------------------------------------------------------------------

for (const shape of ["star", "chain"]) {
  test(`a 100-destination ${shape} fixture is valid and not ready`, () => {
    const c = fixtureCatalog(100, shape);
    assert.equal(c.journeys.length, 100);
    assert.deepEqual(W.validateCatalog(c), { errors: [], warnings: [] });
    const r = W.readiness(c);
    assert.equal(r.ready, false);
    assert.equal(r.unset.length, 4 + 1 + 1 + 99 * 3); // organic, transition, Jerusalem's reward, 99 destinations
    assert.deepEqual(r.emptyRoadmapEras, ["earlier-era"]);
  });
}

test("closing a 100-destination chain into a loop is one cycle error", () => {
  const c = fixtureCatalog(100, "chain");
  byId(c.journeys, "d002").requires = ["d100"];
  oneError(c, /in or behind a prerequisite cycle: d002, d003, .*, d100\./);
});
