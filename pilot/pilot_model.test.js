// node --test pilot
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("./pilot_model.js");

const close = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected} (tolerance ${tolerance})`);

/** A fully deterministic cohort: everyone active every day, constant steps. */
function steadyConfig(overrides = {}) {
  return M.buildConfig("baseline", {
    activationRate: 1, activeDayRate: 1, weeklyDropoutRate: 0, betweenTesterStepCv: 0, dayToDayStepCv: 0,
    replications: 20, ...overrides,
  });
}

// --------------------------------------------------------------------------
// Verified rules
// --------------------------------------------------------------------------

test("10 steps make 1 Energy and leftover steps carry", () => {
  assert.deepEqual(M.stepsToEnergy(3004), { energy: 300, carriedSteps: 4 });
  assert.deepEqual(M.stepsToEnergy(6, 4), { energy: 1, carriedSteps: 0 });
  const run = M.simulateCohort(steadyConfig({ enrolledTesters: 1, medianDailySteps: 3004, pilotDays: 3,
    participatingBusinesses: 0, spendShare: 0 }), 1);
  assert.equal(run.totals.energyFromSteps, 300 + 300 + 301);
  assert.equal(run.testers[0].carriedSteps, 2);
});

test("Wheel V2 stakes and reviewed expectations are the brief's", () => {
  assert.deepEqual([...M.RULES.wheelStakes], [1, 2, 3, 5, 10, 20, 50, 100]);
  const wheel = M.wheelSummary(M.buildConfig());
  for (const row of wheel.byStake) {
    close(row.expectedPp, 1.045 * row.stake, 1e-12, `PP at stake ${row.stake}`);
    close(row.expectedNetEnergy, 0.998 * row.stake, 1e-12, `net Energy at stake ${row.stake}`);
  }
  close(wheel.refundProbability, 0.002, 1e-12, "refund probability");
  // Higher stakes do not improve the return per Energy spent.
  const ratios = new Set(wheel.byStake.map((row) => row.ppPerNetEnergy.toFixed(12)));
  assert.equal(ratios.size, 1);
  close(wheel.netEnergyForJerusalem, 1500 * 0.998 / 1.045, 1e-9, "net Energy for 1,500 PP");
});

test("simulated attempts reproduce 1.045 PP and 0.998 net Energy per stake", () => {
  for (const stake of [1, 10, 100]) {
    const t = M.simulateCohort(steadyConfig({ enrolledTesters: 50, medianDailySteps: 20000, pilotDays: 28,
      participatingBusinesses: 0, spendShare: 1, stakeMix: { [stake]: 1 } }), 11).totals;
    assert.ok(t.attempts > 0);
    close(t.ppEarned / t.attempts, 1.045 * stake, 1e-9, `PP per attempt at stake ${stake}`);
    assert.equal(t.energyCharged, t.attempts * stake);
    assert.equal(t.energyRefunded % stake, 0, "a refund returns exactly one stake");
  }
  // The refund rate over many attempts: 0.2% of attempts, within four standard errors.
  const cfg = steadyConfig({ enrolledTesters: 200, medianDailySteps: 30000, pilotDays: 60, participatingBusinesses: 0,
    spendShare: 1, stakeMix: { 1: 1 } });
  let attempts = 0, refunds = 0;
  for (let seed = 0; seed < 5; seed++) {
    const t = M.simulateCohort(cfg, seed).totals;
    attempts += t.attempts; refunds += t.energyRefunded;
  }
  const se = Math.sqrt(0.002 * 0.998 / attempts);
  close(refunds / attempts, 0.002, 4 * se, "refund share");
  close(1 - refunds / attempts, 0.998, 4 * se, "net Energy share");
});

test("the Jerusalem journey completes at exactly 1,500 PP and spinning then stops", () => {
  // 30,000 steps a day = 3,000 Energy: a single day finishes the journey.
  const run = M.simulateCohort(steadyConfig({ enrolledTesters: 5, medianDailySteps: 30000, pilotDays: 10,
    participatingBusinesses: 0, spendShare: 1, stakeMix: { 10: 1 } }), 3);
  for (const tester of run.testers) {
    assert.equal(tester.pp, 1500);
    assert.equal(tester.jerusalemDay, 1);
    assert.equal(tester.journeys, 1);
  }
  // 1,500 / 10.45 = 143.5 attempts, so the 144th completes it; overshoot is not progress.
  assert.equal(run.totals.attempts, 5 * 144);
  close(run.totals.ppOvershoot, 5 * (144 * 10.45 - 1500), 1e-6, "overshoot");
  assert.equal(run.totals.energyIdleTesterDays, 5 * 9, "every later day has nothing to spend on");
  assert.ok(run.testers.every((x) => x.energy > 20000), "unspendable Energy piles up");
});

test("a priced additional journey spends Chronons and extends progression", () => {
  const run = M.simulateCohort(steadyConfig({ enrolledTesters: 4, medianDailySteps: 30000, pilotDays: 20,
    participatingBusinesses: 1, discoveryRatePerActiveDay: 1, acceptanceRate: 1, completionRate: 1,
    spendShare: 1, stakeMix: { 10: 1 }, additionalJourneyChronons: 5, additionalJourneyPp: 1620 }), 2);
  // Day 1 discover, day 2 complete: 5 Chronons buy exactly one more journey, then nothing.
  assert.equal(run.totals.chrononsEarned, 4 * 5);
  assert.equal(run.totals.chrononsSpent, 4 * 5);
  assert.equal(run.totals.chrononsBalance, 0);
  assert.equal(run.totals.journeysUnlocked, 4);
  assert.ok(run.testers.every((x) => x.journeys === 2 && x.pp === 1500 + 1620));
});

// --------------------------------------------------------------------------
// Proposed pilot settings: missions, puzzle, Chronons
// --------------------------------------------------------------------------

test("a medium mission pays 90 pieces and 5 Chronons: three tiles, one third of the puzzle", () => {
  const cfg = M.buildConfig();
  assert.equal(cfg.mediumMissionKm, 2);
  assert.equal(cfg.mediumMissionPieces, 90);
  assert.equal(cfg.mediumMissionChronons, 5);
  assert.equal(cfg.puzzleTiles, 9);
  assert.equal(cfg.piecesPerTile, 30);
  assert.equal(cfg.puzzleCompletionEnergy, 100);
  assert.equal(cfg.additionalJourneyChronons, null);
  const medium = M.puzzleSummary(cfg).tiers.find((x) => x.tier === "medium");
  assert.equal(medium.tilesPerMission, 3);
  close(medium.shareOfPuzzle, 1 / 3, 1e-12, "share of puzzle");
  assert.equal(medium.missionsForPuzzle, 3);
});

test("tiles are whole, never exceed the puzzle, and never overdraw pieces", () => {
  const cfg = M.buildConfig();
  assert.deepEqual(M.revealTiles(90, 0, cfg), { revealed: 3, pieces: 0, tilesRevealed: 3 });
  assert.deepEqual(M.revealTiles(59, 0, cfg), { revealed: 1, pieces: 29, tilesRevealed: 1 });
  assert.deepEqual(M.revealTiles(29, 8, cfg), { revealed: 0, pieces: 29, tilesRevealed: 8 });
  assert.deepEqual(M.revealTiles(120, 8, cfg), { revealed: 1, pieces: 90, tilesRevealed: 9 });
});

/** Every tester completes one mission every second active day, until the supply runs out. */
function missionConfig(missions, overrides = {}) {
  return steadyConfig({ enrolledTesters: 3, medianDailySteps: 2000, pilotDays: 30, participatingBusinesses: missions,
    discoveryRatePerActiveDay: 1, acceptanceRate: 1, completionRate: 1, spendShare: 0, ...overrides });
}

test("the puzzle bonus is paid once, only for a full puzzle", () => {
  const two = M.simulateCohort(missionConfig(2), 1).totals;
  assert.equal(two.tilesRevealed, 3 * 6);
  assert.equal(two.puzzlesCompleted, 0);
  assert.equal(two.puzzleBonusEnergy, 0, "two thirds of a puzzle pays nothing");

  const three = M.simulateCohort(missionConfig(3), 1);
  assert.equal(three.totals.puzzlesCompleted, 3);
  assert.equal(three.totals.puzzleBonusEnergy, 3 * 100);
  assert.ok(three.testers.every((x) => x.puzzleDay === 6), "missions complete on days 2, 4 and 6");

  const five = M.simulateCohort(missionConfig(5), 1).totals;
  assert.equal(five.puzzlesCompleted, 3, "a second puzzle's worth of pieces does not pay again");
  assert.equal(five.puzzleBonusEnergy, 3 * 100);
  assert.equal(five.tilesRevealed, 3 * 9);
  assert.equal(five.piecesBalance, 3 * (5 * 90 - 270), "pieces beyond the puzzle stay in the wallet");

  // 29 pieces short: eight tiles, no bonus.
  const short = M.simulateCohort(missionConfig(3, { mediumMissionPieces: 80 }), 1).totals;
  assert.equal(short.tilesRevealed, 3 * 8);
  assert.equal(short.puzzleBonusEnergy, 0);
  assert.equal(short.piecesBalance, 3 * (240 - 8 * 30));
});

test("the puzzle bonus is credited once and spent like any other Energy", () => {
  const t = M.simulateCohort(missionConfig(3, { spendShare: 1, stakeMix: { 1: 1 }, medianDailySteps: 0,
    incrementalWalkShare: 0 }), 4).totals;
  assert.equal(t.energyCredited, 0, "no steps, so the only source is the bonus");
  assert.equal(t.puzzleBonusEnergy, 300);
  assert.equal(t.energyCharged - t.energyRefunded + t.energyBalance, 300);
});

test("a declined mission is not offered again and each pays a tester once", () => {
  const t = M.simulateCohort(missionConfig(4, { acceptanceRate: 0 }), 5).totals;
  assert.equal(t.missionsDiscovered, 12);
  assert.equal(t.missionsAccepted, 0);
  assert.equal(t.piecesEarned, 0);
  const all = M.simulateCohort(missionConfig(4, { pilotDays: 120 }), 5).totals;
  assert.equal(all.missionsCompleted, 12, "four missions, three testers, never more");
});

test("mission route steps are counted once, inside the day's walk", () => {
  const base = M.simulateCohort(missionConfig(0, { medianDailySteps: 5000, pilotDays: 10 }), 9).totals;
  const withMissions = M.simulateCohort(missionConfig(2, { medianDailySteps: 5000, pilotDays: 10 }), 9).totals;
  const route = Math.round(2 * 1300 * 0.5);
  assert.equal(withMissions.missionRouteSteps, 3 * 2 * route);
  assert.equal(withMissions.stepsWalked, base.stepsWalked + withMissions.missionRouteSteps);
  assert.equal(withMissions.energyFromSteps, base.energyFromSteps + (3 * 2 * route) / 10);
});

test("mission distance tiers follow the mix exactly and refuse an unset reward", () => {
  const mix = (s, m, l, n) => M.assignMissionTiers({ ...M.buildConfig(), participatingBusinesses: n, missionsPerBusiness: 1,
    missionMixShort: s, missionMixMedium: m, missionMixLong: l });
  assert.deepEqual(mix(0, 1, 0, 4), [1, 1, 1, 1]);
  assert.deepEqual(mix(0.25, 0.5, 0.25, 4), [0, 1, 1, 2]);
  const errors = M.validateConfig(M.buildConfig("baseline", { missionMixShort: 0.5 }));
  assert.ok(errors.some((e) => e.startsWith("Short missions have a share but no reward")));
  assert.ok(M.validateConfig(M.buildConfig("baseline", { additionalJourneyChronons: 10 })).length > 0, "price without a length");
});

// --------------------------------------------------------------------------
// Accounting identities and safeguards, on randomised configurations
// --------------------------------------------------------------------------

function randomConfig(rng) {
  const pick = (lo, hi) => lo + (hi - lo) * rng();
  const stakes = [1, 2, 3, 5, 10, 20, 50, 100];
  const mix = Object.fromEntries(stakes.map((s) => [s, rng() < 0.5 ? rng() : 0]));
  mix[stakes[Math.floor(rng() * stakes.length)]] = 0.5;
  const priced = rng() < 0.5;
  return M.buildConfig(["baseline", "conservative", "optimistic"][Math.floor(rng() * 3)], {
    enrolledTesters: 1 + Math.floor(rng() * 40), pilotDays: 7 + Math.floor(rng() * 50), activationRate: rng(),
    activeDayRate: rng(), weeklyDropoutRate: rng() * 0.5, medianDailySteps: Math.round(pick(500, 20000)),
    spendShare: rng(), stakeMix: mix, participatingBusinesses: Math.floor(rng() * 8),
    discoveryRatePerActiveDay: rng(), acceptanceRate: rng(), completionRate: rng(),
    creditInactiveDaySteps: rng() < 0.5, legacyDailyBonuses: rng() < 0.3,
    missionMixShort: rng() < 0.3 ? 0.3 : 0, shortMissionPieces: 40, shortMissionChronons: 2,
    additionalJourneyChronons: priced ? 1 + Math.floor(rng() * 10) : null, additionalJourneyPp: priced ? 1000 : null,
  });
}

test("every unit is accounted for and no wallet goes negative", () => {
  const rng = M.mulberry32(42);
  for (let k = 0; k < 150; k++) {
    const cfg = randomConfig(rng);
    assert.deepEqual(M.validateConfig(cfg), []);
    const { totals: t, testers, daily } = M.simulateCohort(cfg, k);
    const sum = (key) => testers.reduce((a, x) => a + x[key], 0);
    // Steps: walked = synced + never synced; synced = converted x 10 + steps still carried.
    assert.equal(t.stepsWalked, t.stepsSynced + t.stepsNeverSynced);
    assert.equal(t.stepsSynced, 10 * t.energyFromSteps + sum("carriedSteps"));
    // Energy: sources - sinks = balance, with refunds counted once as a source.
    assert.equal(t.energyFromSteps, t.energyCredited + t.energyLostToCap);
    assert.equal(t.energyCredited + t.legacyBonusEnergy + t.puzzleBonusEnergy + t.energyRefunded - t.energyCharged, t.energyBalance);
    assert.equal(t.energyBalance, sum("energy"));
    assert.ok(t.energyRefunded <= t.energyCharged);
    // Progress Points.
    close(t.ppEarned - t.ppOvershoot, sum("pp"), 1e-6, "PP");
    close(t.ppProgress, sum("pp"), 1e-6, "PP progress");
    // Pieces and tiles.
    assert.equal(t.piecesEarned - t.piecesSpent, t.piecesBalance);
    assert.equal(t.piecesSpent, t.tilesRevealed * cfg.piecesPerTile);
    assert.equal(t.puzzleBonusEnergy, t.puzzlesCompleted * cfg.puzzleCompletionEnergy);
    assert.equal(t.puzzlesCompleted, testers.filter((x) => x.tiles === cfg.puzzleTiles).length);
    // Chronons.
    assert.equal(t.chrononsEarned - t.chrononsSpent, t.chrononsBalance);
    if (cfg.additionalJourneyChronons == null) assert.equal(t.chrononsSpent, 0);
    // Mission funnel.
    assert.equal(t.missionsAccepted, t.missionsCompleted + t.missionsAbandoned + t.missionsPending);
    assert.ok(t.missionsDiscovered <= cfg.enrolledTesters * cfg.participatingBusinesses * cfg.missionsPerBusiness);
    // Nothing negative, anywhere, on any day.
    for (const x of testers) {
      for (const key of ["energy", "pp", "pieces", "chronons", "tiles"]) assert.ok(x[key] >= 0, `${key} negative`);
      assert.ok(x.tiles <= cfg.puzzleTiles);
    }
    for (const key of ["energySum", "piecesSum", "chrononsSum"]) assert.ok(daily[key].every((v) => v >= 0));
    // Testers.
    assert.ok(t.everActive <= t.activated && t.activated <= cfg.enrolledTesters);
  }
});

test("per-active averages divide by testers who played, per-enrolled by everyone", () => {
  const cfg = M.buildConfig("conservative", { replications: 60 });
  const res = M.runPilot(cfg);
  const m = res.metrics.energyCredited;
  close(m.perEnrolled.mean, m.total.mean / 30, 1e-9, "per enrolled");
  assert.ok(m.perActive.mean > m.perEnrolled.mean, "fewer active testers than enrolled");
  const everActive = res.metrics.everActive.total.mean;
  assert.ok(everActive < 30 && everActive > 10);
});

test("runs reproduce exactly from the seed", () => {
  const cfg = M.buildConfig("baseline", { replications: 30 });
  assert.deepEqual(M.runPilot(cfg).metrics, M.runPilot(cfg).metrics);
  assert.notDeepEqual(M.runPilot({ ...cfg, seed: 7 }).metrics.ppEarned, M.runPilot(cfg).metrics.ppEarned);
});

test("scenarios order as their names say and change behaviour only", () => {
  const verified = Object.keys(M.RULES);
  const proposed = M.PARAMETERS.filter((x) => x.status === "proposed").map((x) => x.key);
  for (const scenario of Object.values(M.SCENARIOS)) {
    for (const key of Object.keys(scenario)) {
      assert.ok(!verified.includes(key) && !proposed.includes(key), `scenario changes ${key}`);
      assert.equal(M.PARAMETERS.find((x) => x.key === key).status, "hypothetical");
    }
  }
  const run = (s) => M.runPilot(M.buildConfig(s, { replications: 100 })).metrics;
  const [c, b, o] = ["conservative", "baseline", "optimistic"].map(run);
  for (const key of ["ppEarned", "missionsCompleted", "tilesRevealed", "chrononsEarned", "testersCompletedJerusalem"]) {
    assert.ok(c[key].total.mean < b[key].total.mean && b[key].total.mean < o[key].total.mean, key);
  }
});

test("flags name the bottlenecks the default pilot settings create", () => {
  const res = M.runPilot(M.buildConfig("baseline", { replications: 60 }));
  const titles = res.flags.map((f) => f.title);
  assert.ok(titles.includes("Progression runs out after Jerusalem"));
  assert.ok(titles.includes("Chronons have no sink"));
  const tiny = M.runPilot(M.buildConfig("baseline", { replications: 20, participatingBusinesses: 2 }));
  assert.ok(tiny.flags.some((f) => f.title === "The first puzzle cannot be completed"));
  const priced = M.runPilot(M.buildConfig("baseline", { replications: 20, additionalJourneyChronons: 5, additionalJourneyPp: 1620 }));
  assert.ok(!priced.flags.some((f) => f.title === "Chronons have no sink"));
});

test("invalid input is refused rather than simulated", () => {
  const bad = (o) => M.runPilot(M.buildConfig("baseline", o)).errors;
  assert.ok(bad({ activationRate: 1.2 }).length > 0);
  assert.ok(bad({ medianDailySteps: Number.NaN }).length > 0);
  assert.ok(bad({ enrolledTesters: 2.5 }).length > 0);
  assert.ok(bad({ stakeMix: { 1: 0, 7: 1 } }).length > 0);
  assert.ok(bad({ stakeMix: { 10: -1 } }).length > 0);
});

// --------------------------------------------------------------------------
// The legacy constants must match the existing case study's assumptions.csv
// --------------------------------------------------------------------------

test("legacy bonuses and bank cap mirror assumptions.csv", () => {
  const csv = fs.readFileSync(path.join(__dirname, "..", "assumptions.csv"), "utf8").trim().split(/\r?\n/).slice(1);
  const a = Object.fromEntries(csv.map((line) => { const [, key, value] = line.split(","); return [key, Number(value)]; }));
  assert.equal(M.LEGACY_BONUSES.bankCap, a.energy_bank_cap);
  assert.equal(M.LEGACY_BONUSES.goalSteps, a.default_step_goal);
  assert.equal(M.LEGACY_BONUSES.goalEnergy, a.goal_bonus_energy);
  for (const tier of M.LEGACY_BONUSES.milestones) assert.equal(tier.energy, a[`milestone_${tier.at}_energy`]);
  assert.equal(M.LEGACY_BONUSES.milestones.length, Object.keys(a).filter((k) => /^milestone_\d+_energy$/.test(k)).length);
  assert.equal(M.RULES.stepsPerEnergy, a.steps_per_energy);
  assert.equal(M.RULES.jerusalemJourneyPp, a.region_base_cost);
});

test("legacy bonuses apply only when switched on, outside the cap", () => {
  const cfg = (on) => steadyConfig({ enrolledTesters: 1, medianDailySteps: 10000, pilotDays: 1, participatingBusinesses: 0,
    spendShare: 0, legacyDailyBonuses: on });
  const off = M.simulateCohort(cfg(false), 1).totals;
  assert.equal(off.energyCredited, 1000);
  assert.equal(off.legacyBonusEnergy, 0);
  const on = M.simulateCohort(cfg(true), 1).totals;
  assert.equal(on.energyCredited, 500);
  assert.equal(on.energyLostToCap, 500);
  assert.equal(on.legacyBonusEnergy, 325); // 50 + 75 + 100 + goal 100, as in the case study's checks
});
