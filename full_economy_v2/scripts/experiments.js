/* Full Economy V2: every experiment, as data.
 *
 * Pure: runs the engine at fixed seeds and returns plain objects. Nothing is
 * typed in by hand and nothing is written here; build_v2.js turns the result
 * into CSV tables, SVG charts and the generated results page. Every input is
 * the hypothetical scenario configuration or a labelled override of it.
 */
"use strict";
const C = require("../config/scenario_config.js");
const P = require("../engine/projection_catalog.js");
const L = require("../engine/journey_ledger.js");
const S = require("../engine/simulation.js");
const B = require("../engine/business.js");

const N = { main: 200, sweep: 200, grid: 100 };

const prepCache = new Map(), runCache = new Map();
function prep(overrides) {
  const key = JSON.stringify(overrides);
  if (!prepCache.has(key)) prepCache.set(key, S.prepare(C.buildScenario(overrides)));
  return prepCache.get(key);
}
function run(overrides, cohort, players = N.main) {
  const key = JSON.stringify([overrides, cohort, players]);
  if (!runCache.has(key)) runCache.set(key, S.runCohort(prep(overrides), cohort, { players }));
  return runCache.get(key);
}

const KEY = [
  ["moderate-walking", "Walking only"],
  ["moderate-regular-organic", "Organic missions"],
  ["moderate-regular-sponsored", "Sponsored missions"],
  ["moderate-affiliate", "Store purchases"],
  ["moderate-direct", "Direct purchases"],
];
const WALKERS = [["casual-walking", "Casual"], ["moderate-walking", "Moderate"], ["active-walking", "Active"]];
const fin = (x) => (Number.isFinite(x) ? x : null);
const cohortObj = (key, patch) => ({ ...C.COHORTS[key], ...patch });

/** The figures every experiment reports for a cohort. */
function metrics(r) {
  const firstMedianWait = (() => { for (let k = 2; k <= 100; k++) { const w = r.wait[k - 1]; if (w && w.p50 >= 1) return k; } return null; })();
  const years = r.horizonDays / 365;
  return {
    label: r.label, players: r.players,
    tourShare: r.tourCompleteShare,
    d10: fin(r.daysTo[9].p50), d25: fin(r.daysTo[24].p50), d50: fin(r.daysTo[49].p50), d75: fin(r.daysTo[74].p50),
    d100: fin(r.daysTo[99].p50), d100p10: fin(r.daysTo[99].p10), d100p90: fin(r.daysTo[99].p90),
    onset: fin(r.onset.p50), onsetP10: fin(r.onset.p10), onsetP90: fin(r.onset.p90), firstMedianWait,
    wait10: fin(r.wait[9].p50), wait25: fin(r.wait[24].p50), wait50: fin(r.wait[49].p50), wait75: fin(r.wait[74].p50), wait100: fin(r.wait[99].p50),
    stageWait: r.stageWait.map((x) => ({ stage: x.stage, p50: fin(x.p50), mean: fin(x.meanFinite), waitingShare: x.waitingShare })),
    blockedShare: r.waitingShareOfActiveDays,
    j365: r.journeysBy.find((x) => x.day === 365).p50, j730: r.journeysBy.find((x) => x.day === 730).p50, j1095: r.journeysBy.find((x) => x.day === 1095).p50,
    missionsPerWeek: r.missions.perWeek,
    puzzlesPerYear: r.puzzles.completedPerPlayerYear, firstPuzzleDay: fin(r.puzzles.firstPuzzleDay.p50),
    puzzleEnergyShare: r.energy.puzzleShare, energyWhileWaitingShare: r.energy.whileWaitingShare, capLostShare: r.energy.lostToCapShare,
    energyHeldEnd: r.energy.balancePerPlayer,
    sourceShare: Object.fromEntries(S.SOURCES.map((s, i) => [s, r.chronons.earnedShare[i]])),
    fundingShare: Object.fromEntries(S.SOURCES.map((s, i) => [s, r.chronons.journeyFundingShare[i]])),
    earnedPerYear: r.chronons.earnedPerSimYear,
    cosmeticsOwned: r.cosmetics.ownedPerPlayer, cosmeticSpend: r.cosmetics.spendPerPlayer, tradeoffDays: r.cosmetics.tradeoffDaysPerPlayer,
    deadlockedShare: r.deadlockedShare, business: r.business,
    storeChrononsPerYear: r.chronons.earnedPerPlayer[4] / years, directChrononsPerYear: r.chronons.earnedPerPlayer[5] / years,
  };
}

function referenceProjection() {
  const cfg = C.buildScenario();
  const pr = P.buildProjection(cfg);
  const curves = {};
  for (const fam of Object.keys(C.PRICE_CURVES)) curves[fam] = P.priceSchedule(cfg, fam);
  const ppCurves = {};
  for (const c of Object.keys(C.PP_CURVES)) ppCurves[c] = P.ppSchedule(cfg, c);
  const catalog = P.toCatalog(pr, cfg);
  const validation = P.validateProjectionCatalog(catalog);
  return { cfg, projection: pr, curves, ppCurves, validation };
}

/** Closed-form ledgers: walking-only at three activity levels, and a moderate
 * walker with the simulated regular-mission rate. */
function ledgers(ref, missionsPerWeek) {
  const cfg = ref.cfg, pr = ref.projection;
  const out = {};
  for (const [key] of WALKERS) {
    const activity = C.COHORTS[key].activity;
    out[key] = L.journeyLedger(pr, { organicPer1000: cfg.organicChrononsPer1000, creditedStepsPerDay: C.creditedStepsPerDay(cfg, activity) });
  }
  out["moderate-regular-organic"] = L.journeyLedger(pr, {
    organicPer1000: cfg.organicChrononsPer1000, creditedStepsPerDay: C.creditedStepsPerDay(cfg, "moderate"),
    extraChrononsPerDay: (missionsPerWeek * C.linked("missionChronons") * cfg.organicMissionRewardShare) / 7,
    extraStepsPerDay: (missionsPerWeek * Math.round(C.linked("missionKm") * C.linked("stepsPerKm") * cfg.incrementalWalkShare)) / 7,
  });
  out.failure = L.journeyLedger(pr, { organicPer1000: cfg.organicChrononsPer1000, creditedStepsPerDay: C.creditedStepsPerDay(cfg, "moderate"), accrueWhileWaiting: false });
  return out;
}

function runAll() {
  const ref = referenceProjection();
  const result = { reference: ref };

  // E1. Reference cohorts
  result.cohorts = Object.keys(C.COHORTS).map((key) => ({ key, ...metrics(run({}, key)) }));
  const refRaw = Object.fromEntries(Object.keys(C.COHORTS).map((key) => [key, run({}, key)]));
  result.waitByJourney = [...KEY, ["casual-walking", "Casual walking only"], ["active-walking", "Active walking only"]].map(([key, label]) => ({
    key, label, wait: refRaw[key].wait.map((w) => (w ? fin(w.p50) : null)), reached: refRaw[key].reached,
  }));
  result.timeline = KEY.map(([key, label]) => ({
    key, label,
    done: refRaw[key].weekly.done.map((x) => x.p50), doneP10: refRaw[key].weekly.done.map((x) => x.p10), doneP90: refRaw[key].weekly.done.map((x) => x.p90),
    chronons: refRaw[key].weekly.chronons.map((x) => x.p50), energy: refRaw[key].weekly.energy.map((x) => x.p50),
  }));
  result.ledgers = ledgers(ref, refRaw["moderate-regular-organic"].missions.perWeek);

  // E2. Price curves (budget-matched) for the key player types
  result.priceCurves = ["linear", "exponential", "piecewise", "milestone", "hybrid"].map((fam) => ({
    family: fam, label: C.PRICE_CURVES[fam].label, total: ref.curves[fam].slice(1).reduce((a, b) => a + b, 0),
    cohorts: KEY.map(([key, label]) => ({ key, label, ...metrics(run({ priceCurve: fam }, key)) })),
  }));

  // E3. Mission participation patterns (moderate walker)
  const patterns = [
    ["none", false, "No missions"], ["occasional", false, "Occasional (organic)"], ["regular", false, "Regular (organic)"],
    ["high", false, "High (organic)"], ["regular", true, "Regular, sponsor in reach"], ["high", true, "High, sponsor in reach"],
  ];
  result.missionPatterns = patterns.map(([m, sponsor, label]) => ({
    pattern: m, sponsor, label, ...metrics(run({}, cohortObj("moderate-walking", { label, missions: m, sponsorInReach: sponsor }))),
  }));

  // E3b. Missions per week needed (Q5): exact mission frequencies at three activity levels
  const freqs = [0, 0.25, 0.5, 1, 1.5, 2, 3, 4];
  result.missionFrequency = WALKERS.map(([key, label]) => {
    const act = C.ACTIVITY[C.COHORTS[key].activity];
    return {
      key, label, rows: freqs.map((m) => {
        const r = run({ missionRatePerActiveDay: Math.min(1, m / (7 * act.activeDayRate)) }, cohortObj(key, { missions: "regular" }), N.sweep);
        return { ...metrics(r), missionsPerWeekSet: m, measuredPerWeek: r.missions.perWeek };
      }),
    };
  });

  // E4. Puzzles
  result.puzzleParticipation = patterns.map(([m, sponsor, label]) => {
    const co = cohortObj("moderate-walking", { label, missions: m, sponsorInReach: sponsor });
    const on = metrics(run({}, co)), off = metrics(run({ puzzleBonusOff: true }, co));
    return { label, ...on, d50NoBonus: off.d50, d100NoBonus: off.d100, j365NoBonus: off.j365 };
  });
  result.puzzleOrganicPieces = [0, 5, 10, 20].map((pcs) => {
    const on = metrics(run({ organicPiecesPer1000: pcs }, "moderate-walking")), off = metrics(run({ organicPiecesPer1000: pcs, puzzleBonusOff: true }, "moderate-walking"));
    return { organicPiecesPer1000: pcs, ...on, d50NoBonus: off.d50, d100NoBonus: off.d100 };
  });
  result.puzzleStructures = ["jaffa-only", "every-k", "per-destination"].map((st) => ({
    structure: st, ...metrics(run({ puzzleStructure: st }, "moderate-regular-organic")),
  }));
  result.tileExperiment = [0, 1, 2].flatMap((t) => ["moderate-walking", "moderate-regular-organic"].map((key) => ({
    tileRevealChronons: t, key, ...metrics(run({ tileRevealChronons: t }, key)),
  })));

  // E5. Wellness Store: player acceleration and business economics
  const freqStore = [0, 0.33, 0.67, 1, 2], rates = [0.02, 0.05, 0.1];
  result.storePlayer = rates.flatMap((rate) => freqStore.map((f) => {
    const r = run({ affiliateRewardRate: rate }, cohortObj("moderate-walking", { label: "Store shopper", purchases: { affiliatePer30Days: f, bundle: null, bundleEveryDays: null } }), N.sweep);
    const m = metrics(r);
    return { rewardRate: rate, ordersPer30Days: f, spendPerMonth: r.business.gmvPerPlayerYear / 12, ...m };
  }));
  const cfg0 = C.buildScenario();
  result.storeOrder = { median: B.orderEconomics(cfg0, cfg0.productPriceMedian), chrononValue: C.chrononDollarValue(cfg0), bundleChronons: C.bundleChronons(cfg0, "small") };
  result.storeBusinessGrid = [];
  for (const cann of [0.5, 1]) for (const comm of [0.04, 0.08, 0.12]) for (let rr = 0; rr <= 0.2001; rr += 0.01) {
    const cfg = C.buildScenario({ affiliateRewardRate: Math.round(rr * 100) / 100, affiliateCommission: comm, cannibalization: cann });
    const e = B.orderEconomics(cfg, cfg.productPriceMedian);
    result.storeBusinessGrid.push({ cannibalization: cann, commission: comm, rewardRate: Math.round(rr * 100) / 100, chronons: e.chronons, commissionUsd: e.commission, valueGrantedUsd: e.valueGranted, displacedUsd: e.displacedBundleNet, netUsd: e.net, breakEven: B.breakEvenRewardRate(cfg, cfg.productPriceMedian) });
  }
  result.refundPolicies = ["pending", "clawback", "no-clawback"].flatMap((policy) => [0.1, 0.3].map((refund) => {
    const r = run({ clawbackPolicy: policy, refundRate: refund }, cohortObj("moderate-walking", { label: "Store shopper", purchases: { affiliatePer30Days: 1, bundle: null, bundleEveryDays: null } }), N.sweep);
    return { policy, refundRate: refund, ...metrics(r) };
  }));

  // E6. Cosmetics
  const policies = ["none", "progression-first", "share-20", "share-40", "share-60", "cosmetics-first", "collector", "enthusiast"];
  result.cosmetics = ["moderate-walking", "moderate-regular-organic"].map((key) => ({
    key, label: C.COHORTS[key].label,
    rows: policies.map((pol) => {
      const co = cohortObj(key, { cosmetics: pol, purchases: pol === "enthusiast" ? "enthusiast" : C.COHORTS[key].purchases });
      return { policy: pol, policyLabel: C.COSMETIC_POLICIES[pol].label, ...metrics(run({}, co)) };
    }),
  }));

  // E7. One-at-a-time sensitivity (prices stay frozen unless the lever is the price level)
  const levers = [
    ["Organic Chronon rate", { organicChrononsPer1000: 0.5 }, { organicChrononsPer1000: 2 }, "0.5 / 2 per 1,000 steps"],
    ["Completion reward", { completionRewardPer100Pp: 0.5 }, { completionRewardPer100Pp: 2 }, "0.5 / 2 per 100 PP"],
    ["Journey price level", { coverageLevel: "scarce" }, { coverageLevel: "generous" }, "scarce / generous coverage"],
    ["PP pacing curve", { ppCurve: "capped" }, { ppCurve: "flat" }, "capped / flat (prices frozen)"],
    ["Mission reward", { organicMissionRewardShare: 0.5 }, { organicMissionRewardShare: 2 }, "0.5x / 2x the reference"],
    ["Mission supply", { organicOfferPerActiveDay: 0.25 }, { organicOfferPerActiveDay: 0.9 }, "0.25 / 0.9 offers per active day"],
    ["Energy cap", { energyCap: 250 }, { energyCap: 500 }, "250 / 500 (baseline: none)"],
    ["Daily bonuses", { dailyBonuses: true }, null, "on (baseline: off)"],
  ];
  result.sensitivity = ["moderate-walking", "moderate-regular-organic"].map((key) => {
    const base = metrics(run({}, key, N.sweep));
    return {
      key, label: C.COHORTS[key].label, base,
      levers: levers.map(([name, lo, hi, range]) => ({
        name, range, low: lo ? metrics(run(lo, key, N.sweep)) : null, high: hi ? metrics(run(hi, key, N.sweep)) : null,
      })),
    };
  });

  // E8. Heatmap: missions per week x price growth (exponential from a fixed start price)
  const growth = [1.0, 1.01, 1.015, 1.02, 1.025, 1.03, 1.035, 1.04], hmFreqs = [0, 0.5, 1, 1.5, 2, 3, 4];
  const moderate = C.ACTIVITY.moderate;
  result.heatmap = { growth, freqs: hmFreqs, cells: growth.map((g) => hmFreqs.map((m) => {
    const r = run({ priceCurve: "exponential-fixed", expGrowth: g, missionRatePerActiveDay: Math.min(1, m / (7 * moderate.activeDayRate)) }, cohortObj("moderate-walking", { missions: "regular" }), N.grid);
    return { growth: g, missionsPerWeek: m, j730: r.journeysBy.find((x) => x.day === 730).p50, d100: fin(r.daysTo[99].p50), tourShare: r.tourCompleteShare, onset: fin(r.onset.p50) };
  })) };

  // E9. Stress: lower participation and the failure scenarios
  const stress = [
    ["Reference", {}, null],
    ["Mission acceptance down to occasional", {}, { missions: "occasional" }],
    ["Sponsored offers halved", { sponsoredOfferPerActiveDay: 0.15 }, null],
    ["Store orders down to a third", {}, { purchases: { affiliatePer30Days: 0.22, bundle: null, bundleEveryDays: null } }],
    ["Store reward halved", { affiliateRewardRate: 0.025 }, null],
    ["Energy cap 250", { energyCap: 250 }, null],
    ["Energy cap 500", { energyCap: 500 }, null],
    ["Daily bonuses on", { dailyBonuses: true }, null],
    ["Backfill days without a session", { backfillInactiveDays: true }, null],
    ["Pending PP discarded (failure)", { pendingPpApplication: "none" }, null],
    ["No organic Chronons while waiting (failure)", { accrueWhileWaiting: false }, null],
  ];
  result.stress = stress.map(([name, overrides, patch]) => ({
    name, cohorts: KEY.map(([key, label]) => {
      const applicable = !patch || (patch.missions ? C.COHORTS[key].missions !== "none" : patch.purchases ? C.COHORTS[key].purchases === "affiliate" : true);
      const co = applicable && patch ? cohortObj(key, patch) : key;
      return { key, label, applicable: applicable || !patch, ...metrics(run(overrides, co, N.sweep)) };
    }),
  }));

  // E10. Expected-value vs sampled wheel
  result.evVsSampled = KEY.map(([key, label]) => ({
    key, label, ev: metrics(run({}, key)), sampled: metrics(run({ wheelMode: "sampled" }, key)),
  }));

  // E11. Pacing scenarios: PP curve x price coverage, prices calibrated to each curve
  const pacingCohorts = [["casual-walking", "Casual walking only"], ...KEY.slice(0, 3), ["moderate-direct", "Direct purchases"]];
  result.pacing = [];
  for (const curve of Object.keys(C.PP_CURVES)) for (const level of Object.keys(C.COVERAGE_LEVELS)) {
    const overrides = { ppCurve: curve, priceCalibrationPpCurve: curve, coverageLevel: level };
    const pr = P.buildProjection(C.buildScenario(overrides));
    result.pacing.push({ curve, level, totalPp: pr.totals.pp, totalPrice: pr.totals.price,
      cohorts: pacingCohorts.map(([key, label]) => ({ key, label, ...metrics(run(overrides, key, N.sweep)) })) });
  }
  result.pacingFrozen = Object.keys(C.PP_CURVES).map((curve) => ({
    curve, cohorts: KEY.slice(0, 2).map(([key, label]) => ({ key, label, ...metrics(run({ ppCurve: curve }, key, N.sweep)) })),
  }));

  // E12. Balance sweep: late-game coverage (journey 100), other anchors at the reference
  const ref4 = C.COVERAGE_LEVELS.reference;
  result.balanceSweep = [1.1, 1.0, 0.9, 0.8, 0.7, 0.6].map((late) => {
    const overrides = { coverageAnchors: [ref4[0], ref4[1], ref4[2], late] };
    const pr = P.buildProjection(C.buildScenario(overrides));
    return { lateCoverage: late, totalPrice: pr.totals.price, cohorts: [["casual-walking", "Casual walking only"], ...KEY.slice(0, 3), ["moderate-direct", "Direct purchases"]].map(([key, label]) => ({ key, label, ...metrics(run(overrides, key, N.sweep)) })) };
  });

  return result;
}

module.exports = { runAll, metrics, KEY, WALKERS, N };
