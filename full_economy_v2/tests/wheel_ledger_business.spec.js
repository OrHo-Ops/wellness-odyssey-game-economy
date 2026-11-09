"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { C, P, W, L, B, V1Wheel, close } = require("./helpers.js");

test("Wheel V3 tiers come from analysis/wheel.js: whole payouts at 1.045 PP per staked Energy", () => {
  assert.deepEqual(W.TIERS.map((t) => t.stake), V1Wheel.V3_TIERS.map((t) => t.stake));
  for (const t of W.TIERS) {
    for (const r of t.rows) assert.ok(Number.isInteger(r.pp));
    close(assert, t.expectedPp, V1Wheel.expectedPp(t.stake), 1e-12, `EV at ${t.stake}`);
    close(assert, t.expectedPp / t.stake, 1.045, 1e-12, `return at ${t.stake}`);
  }
  assert.equal(W.P_REFUND, V1Wheel.refundProbability());
  close(assert, W.PP_PER_NET_ENERGY, V1Wheel.ppPerNetEnergy(50), 1e-12, "PP per net Energy");
});

test("sampled outcomes reproduce the reviewed expectation", () => {
  const rng = require("./helpers.js").V1Model.mulberry32(7);
  for (const t of W.TIERS) {
    let sum = 0, sumSq = 0; const n = 200000;
    for (let i = 0; i < n; i++) { const r = W.sample(rng, t); sum += r.pp; sumSq += r.pp * r.pp; }
    const mean = sum / n, se = Math.sqrt((sumSq / n - mean * mean) / n);
    assert.ok(Math.abs(mean - t.expectedPp) < 4 * se, `tier ${t.stake}: ${mean} vs ${t.expectedPp} (4 SE = ${4 * se})`);
  }
});

const cfg = C.buildScenario();
const projection = P.buildProjection(cfg);

test("free journeys mean no waiting, and the tour takes exactly its walking", () => {
  const free = { ...projection, journeys: projection.journeys.map((j) => ({ ...j, price: j.index === 1 ? null : 0 })) };
  const l = L.journeyLedger(free, { organicPer1000: 1, creditedStepsPerDay: 5000 });
  assert.equal(l.firstWaitJourney, null);
  close(assert, l.tourDays, l.walkingOnlyTourDays, 1e-6, "tour days");
});

test("a walking-only player's first wait comes at the same journey at every activity level", () => {
  const ledgers = [2000, 4450, 9000].map((spd) => L.journeyLedger(projection, { organicPer1000: 1, creditedStepsPerDay: spd }));
  assert.ok(ledgers[0].firstWaitJourney !== null);
  assert.equal(new Set(ledgers.map((l) => l.firstWaitJourney)).size, 1, ledgers.map((l) => l.firstWaitJourney).join(", "));
  const w = ledgers.map((l) => l.rows[99].waitDays);
  close(assert, w[0] * 2000, w[2] * 9000, 1e-6, "waits scale with 1 / steps per day");
});

test("without accrual while waiting, a walking-only player deadlocks; an extra source prevents it", () => {
  const stuck = L.journeyLedger(projection, { organicPer1000: 1, creditedStepsPerDay: 4450, accrueWhileWaiting: false });
  assert.ok(stuck.deadlockAt !== null);
  assert.equal(stuck.tourDays, Infinity);
  const missions = L.journeyLedger(projection, { organicPer1000: 1, creditedStepsPerDay: 4450, accrueWhileWaiting: false, extraChrononsPerDay: 1 });
  assert.equal(missions.deadlockAt, null);
  const ok = L.journeyLedger(projection, { organicPer1000: 1, creditedStepsPerDay: 4450, accrueWhileWaiting: true });
  assert.equal(ok.deadlockAt, null);
});

test("setting Chronons aside for cosmetics brings the first wait forward", () => {
  const at = (share) => L.journeyLedger(projection, { organicPer1000: 1, creditedStepsPerDay: 4450, cosmeticShare: share }).firstWaitJourney;
  assert.ok(at(0.2) < at(0) && at(0.4) < at(0.2), `${at(0)} > ${at(0.2)} > ${at(0.4)}`);
});

test("store rewards convert to Chronons only through the bundle price", () => {
  const v = C.chrononDollarValue(cfg);
  assert.equal(B.orderChronons(cfg, 100), Math.floor((100 * cfg.eligibleShare * cfg.affiliateRewardRate) / v));
  const cheaper = C.buildScenario({ bundleReferenceOrganicPer1000: 2 });
  assert.ok(C.chrononDollarValue(cheaper) < v * 0.51);
  assert.ok(B.orderChronons(cheaper, 100) >= 2 * B.orderChronons(cfg, 100) - 1);
});

test("the break-even reward rate makes an order's net contribution zero", () => {
  for (const policy of ["pending", "clawback", "no-clawback"]) {
    const base = C.buildScenario({ clawbackPolicy: policy });
    const r = B.breakEvenRewardRate(base, 200);
    const e = B.orderEconomics(C.buildScenario({ clawbackPolicy: policy, affiliateRewardRate: Math.min(r, 0.5) }), 200);
    assert.ok(Math.abs(e.net) < 0.25, `${policy}: net ${e.net} at break-even rate ${r}`);
  }
  const e = B.orderEconomics(cfg, 45);
  assert.ok(e.commission > 0 && e.valueGranted > 0 && e.chronons > 0);
  assert.notEqual(e.commission, e.valueGranted, "commission is never equated with the Chronons awarded");
});
