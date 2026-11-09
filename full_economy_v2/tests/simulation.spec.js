"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { C, P, L, S, W, V1Model, close, steadyCohort } = require("./helpers.js");

const sum = (a) => a.reduce((x, y) => x + y, 0);

test("a steady walker in the simulation follows the closed-form ledger", () => {
  const cfg = C.buildScenario({ betweenPlayerStepCv: 0, dayToDayStepCv: 0, horizonDays: 2500, organicPiecesPer1000: 0 }); // no puzzle Energy: the ledger has none
  const prep = S.prepare(cfg);
  const run = S.simulatePlayer(prep, steadyCohort(5000), 0);
  const ledger = L.journeyLedger(prep.projection, { organicPer1000: 1, creditedStepsPerDay: 5000 });
  for (const k of [1, 5, 10, 20, 30, 45, 60, 70, 80, 90, 100]) {
    const expected = Math.ceil(ledger.rows[k - 1].completeDay - 1e-9) - 1;
    assert.ok(Math.abs(run.completeDay[k - 1] - expected) <= 2, `journey ${k}: simulated day ${run.completeDay[k - 1]}, ledger day ${expected}`);
  }
  const simFirstWait = (() => { for (let k = 1; k < 100; k++) if (run.unlockDay[k] - run.completeDay[k - 1] >= 1) return k + 1; return null; })();
  assert.ok(Math.abs(simFirstWait - ledger.firstWaitJourney) <= 2, `first wait: simulated ${simFirstWait}, ledger ${ledger.firstWaitJourney}`);
});

/** Random scenarios for the accounting tests. */
function randomScenarios(count) {
  const rng = V1Model.mulberry32(99), pick = (a) => a[Math.floor(rng() * a.length)];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      cfg: C.buildScenario({
        horizonDays: 300 + Math.floor(rng() * 500), playersPerCohort: 2, seed: Math.floor(rng() * 1e6),
        energyCap: pick([null, 250, 500]), dailyBonuses: rng() < 0.5, backfillInactiveDays: rng() < 0.3,
        organicChrononsPer1000: pick([0, 0.5, 1, 2.5]), organicPiecesPer1000: pick([0, 5, 20]),
        accrueWhileWaiting: rng() < 0.8, pendingPpApplication: pick(["full", "none"]), wheelMode: pick(["ev", "sampled"]),
        priceCurve: pick(Object.keys(C.PRICE_CURVES)), ppCurve: pick(Object.keys(C.PP_CURVES)),
        puzzleStructure: pick(["jaffa-only", "per-destination", "every-k"]), tileRevealChronons: pick([0, 0, 2]),
        clawbackPolicy: pick(["pending", "clawback", "no-clawback"]), refundRate: pick([0, 0.1, 0.5]),
        tierMix: pick([{ 10: 0.3, 50: 0.5, 100: 0.2 }, { 50: 1 }, { 10: 1 }]),
      }),
      cohort: pick(Object.keys(C.COHORTS)),
    });
  }
  return out;
}

test("every unit is accounted for and no wallet goes negative, on 40 random scenarios", () => {
  for (const { cfg, cohort } of randomScenarios(40)) {
    const prep = S.prepare(cfg);
    for (let i = 0; i < 2; i++) {
      const r = S.simulatePlayer(prep, cohort, i), s = r.s, tag = `${cohort} seed ${cfg.seed}`;
      close(assert, r.energy, s.eSteps + s.eBonus + s.ePuzzle + s.eRefunded - s.eCharged, 1e-6, `${tag}: Energy`);
      assert.ok(r.energy >= 0 && r.pieces >= 0, `${tag}: negative wallet`);
      close(assert, sum([...r.earned]), r.chronons + sum([...r.spentJ]) + sum([...r.spentC]) + s.clawedFromBalance + s.debtRepaid, 1e-6, `${tag}: Chronons`);
      assert.ok(r.chronons >= -1e-9 && r.envelope <= r.chronons + 1e-9, `${tag}: Chronon balance ${r.chronons}, envelope ${r.envelope}`);
      close(assert, r.debt, s.debtCreated - s.debtRepaid, 1e-9, `${tag}: debt`);
      assert.equal(s.piecesEarned - s.piecesSpent, r.pieces, `${tag}: pieces`);
      let ppDone = 0, priced = 0;
      for (let k = 0; k < prep.n; k++) { if (r.completeDay[k] >= 0) ppDone += prep.pp[k]; if (k > 0 && r.unlockDay[k] >= 0) priced += prep.price[k]; }
      close(assert, s.ppEarned, ppDone + r.prog + r.pendingPP + s.ppDiscarded, 1e-6, `${tag}: PP`);
      close(assert, sum([...r.spentJ]), priced, 1e-6, `${tag}: journey spending equals the prices of unlocked journeys`);
      if (!cfg.backfillInactiveDays) assert.equal(s.stepsWalked, s.stepsSynced + s.stepsLost, `${tag}: steps`);
      if (cfg.energyCap === null) assert.equal(s.eSteps * 10 + r.stepCarry, s.stepsSynced, `${tag}: 10 steps = 1 Energy`);
    }
  }
});

test("purchases never touch Energy or PP: same walking, same Energy, same PP per Energy", () => {
  const cfg = C.buildScenario({ puzzleStructure: "jaffa-only", horizonDays: 300 }); // short enough that no one finishes the tour and stops early
  const prep = S.prepare(cfg);
  for (let i = 0; i < 5; i++) {
    const free = S.simulatePlayer(prep, "moderate-walking", i);
    for (const paying of ["moderate-direct", "moderate-affiliate"]) {
      const r = S.simulatePlayer(prep, paying, i);
      assert.ok(r.completed < 100 && free.completed < 100, "no early stop");
      assert.equal(r.s.eSteps, free.s.eSteps, `${paying}: step Energy`);
      assert.equal(r.s.eBonus, free.s.eBonus, `${paying}: bonus Energy`);
      assert.equal(r.s.ePuzzle, free.s.ePuzzle, `${paying}: puzzle Energy`);
      close(assert, r.s.ppEarned / r.s.eCharged, 1.045, 1e-9, `${paying}: PP per staked Energy`);
      assert.ok(r.earned[4] + r.earned[5] > 0, `${paying}: earned no purchased Chronons`);
    }
  }
});

test("no PP is generated without an active journey, and Energy waits", () => {
  const cfg = C.buildScenario({ priceCurve: "exponential-fixed", fixedStartPrice: 10000, horizonDays: 200 });
  const r = S.simulatePlayer(S.prepare(cfg), "moderate-walking", 0);
  assert.equal(r.unlockDay[1], -1, "journey 2 should be unaffordable");
  assert.ok(r.s.ppEarned <= 1500 + 500, `PP ${r.s.ppEarned} after Jerusalem`);
  assert.ok(r.energy > 20000, `Energy should bank while waiting, got ${r.energy}`);
  assert.ok(r.s.waitingActiveDays > 100);
});

test("pending PP is applied in full to the next journey, or discarded when that rule is off", () => {
  const prepFull = S.prepare(C.buildScenario({ horizonDays: 400 }));
  const prepNone = S.prepare(C.buildScenario({ horizonDays: 400, pendingPpApplication: "none" }));
  const full = S.simulatePlayer(prepFull, "active-walking", 3), none = S.simulatePlayer(prepNone, "active-walking", 3);
  assert.equal(full.s.ppDiscarded, 0);
  assert.ok(none.s.ppDiscarded > 0);
  assert.ok(full.completed >= none.completed);
});

test("mission steps are counted once and each mission is rewarded once", () => {
  const cfg = C.buildScenario({ organicPiecesPer1000: 0, horizonDays: 300, puzzleStructure: "jaffa-only" });
  const prep = S.prepare(cfg);
  for (let i = 0; i < 4; i++) {
    const r = S.simulatePlayer(prep, "moderate-regular-sponsored", i), s = r.s;
    const missions = s.organicMissions + s.sponsoredMissions;
    assert.ok(missions > 0);
    assert.equal(s.routeSteps, missions * prep.routeExtra);
    assert.equal(s.piecesEarned, missions * 90);
    close(assert, r.earned[2] + r.earned[3], missions * 5, 1e-9, "mission Chronons");
    const walkOnly = S.simulatePlayer(prep, "moderate-walking", i).s;
    assert.equal(s.stepsWalked - s.routeSteps, walkOnly.stepsWalked, "the walk itself is the same; only the route's extra part is added");
  }
});

test("each puzzle pays its completion Energy once; tile reveals pay nothing unless the experiment is on", () => {
  const base = S.simulatePlayer(S.prepare(C.buildScenario({ horizonDays: 700 })), "moderate-regular-organic", 1);
  assert.equal(base.s.ePuzzle, base.s.puzzlesCompleted * 100);
  assert.equal(base.earned[6], 0);
  assert.ok(base.s.tilesRevealed <= 9 * 100);
  assert.equal(base.s.tilesRevealed * 30, base.s.piecesSpent);
  const exp = S.simulatePlayer(S.prepare(C.buildScenario({ horizonDays: 700, tileRevealChronons: 2 })), "moderate-regular-organic", 1);
  assert.equal(exp.earned[6], exp.s.tilesRevealed * 2);
});

test("a puzzle pays nothing until its last tile: 6 tiles nothing, 9 tiles the bonus once", () => {
  const mission = { ...steadyCohort(5000), missions: "regular" };
  const run = (days) => S.simulatePlayer(S.prepare(C.buildScenario({ organicPiecesPer1000: 0, puzzleStructure: "jaffa-only", missionRatePerActiveDay: 1,
    missionCompletion: 1, betweenPlayerStepCv: 0, dayToDayStepCv: 0, horizonDays: days })), mission, 0).s;
  const two = run(2), three = run(3), ten = run(10);
  assert.deepEqual([two.tilesRevealed, two.ePuzzle, two.puzzlesCompleted], [6, 0, 0]);
  assert.deepEqual([three.tilesRevealed, three.ePuzzle, three.puzzlesCompleted], [9, 100, 1]);
  assert.deepEqual([ten.tilesRevealed, ten.ePuzzle, ten.puzzlesCompleted], [9, 100, 1], "Jaffa Gate alone: pieces pile up after the only puzzle");
  // 80 organic pieces a day: exactly 240 pieces (8 tiles) after three days, 9 tiles on the fourth.
  const walk = (days) => S.simulatePlayer(S.prepare(C.buildScenario({ organicPiecesPer1000: 20, puzzleStructure: "jaffa-only",
    betweenPlayerStepCv: 0, dayToDayStepCv: 0, horizonDays: days })), steadyCohort(4000), 0).s;
  assert.deepEqual([walk(3).tilesRevealed, walk(3).ePuzzle], [8, 0], "eight tiles pay nothing");
  assert.deepEqual([walk(4).tilesRevealed, walk(4).ePuzzle], [9, 100]);
});

test("without accrual while waiting, walking-only players deadlock and missions or purchases rescue them", () => {
  const prep = S.prepare(C.buildScenario({ accrueWhileWaiting: false, playersPerCohort: 20 }));
  const walk = S.runCohort(prep, "moderate-walking");
  assert.equal(walk.deadlockedShare, 1);
  assert.equal(walk.tourCompleteShare, 0);
  for (const rescue of ["moderate-regular-organic", "moderate-direct"]) {
    const r = S.runCohort(prep, rescue);
    assert.equal(r.deadlockedShare, 0, rescue);
  }
  const ok = S.runCohort(S.prepare(C.buildScenario({ playersPerCohort: 20 })), "moderate-walking");
  assert.equal(ok.deadlockedShare, 0);
});

test("refunds: pending credits only kept orders, clawback reverses, no-clawback leaks", () => {
  const run = (policy) => S.simulatePlayer(S.prepare(C.buildScenario({ clawbackPolicy: policy, refundRate: 0.3, horizonDays: 600 })), "moderate-affiliate", 2);
  const pending = run("pending"), claw = run("clawback"), leak = run("no-clawback");
  assert.ok(pending.completed < 100 && leak.completed < 100, "no early stop");
  assert.equal(pending.s.orders, leak.s.orders);
  assert.ok(pending.s.refunds > 0);
  assert.equal(pending.s.storeChrononsLeaked, 0);
  assert.equal(claw.s.storeChrononsLeaked, 0);
  assert.ok(leak.s.storeChrononsLeaked > 0);
  assert.ok(leak.s.storeChrononsGranted > pending.s.storeChrononsGranted);
  assert.ok(Math.abs(claw.s.storeChrononsGranted - pending.s.storeChrononsGranted) <= 60, `${claw.s.storeChrononsGranted} vs ${pending.s.storeChrononsGranted}`);
});

test("cosmetic spending delays journeys in proportion to its share", () => {
  const cfg = C.buildScenario({ playersPerCohort: 30 });
  const prep = S.prepare(cfg);
  const at = (cos) => S.runCohort(prep, { ...C.COHORTS["moderate-regular-organic"], cosmetics: cos }).daysTo[49].p50;
  const none = at("none"), s20 = at("share-20"), s40 = at("share-40"), s60 = at("share-60"), prog = at("progression-first");
  assert.ok(none <= prog && prog <= s20 && s20 <= s40 && s40 <= s60, `${none} <= ${prog} <= ${s20} <= ${s40} <= ${s60}`);
});

test("runs reproduce exactly from the seed, and cohorts with the same activity walk the same steps", () => {
  const cfg = C.buildScenario({ playersPerCohort: 5, horizonDays: 400 });
  const a = JSON.stringify(S.runCohort(S.prepare(cfg), "moderate-regular-organic"));
  assert.equal(JSON.stringify(S.runCohort(S.prepare(cfg), "moderate-regular-organic")), a);
  assert.notEqual(JSON.stringify(S.runCohort(S.prepare(C.buildScenario({ playersPerCohort: 5, horizonDays: 400, seed: 7 })), "moderate-regular-organic")), a);
});

test("sampled wheel outcomes return the reviewed 1.045 PP per staked Energy over a cohort", () => {
  const prep = S.prepare(C.buildScenario({ wheelMode: "sampled", horizonDays: 400 }));
  let pp = 0, staked = 0;
  for (let i = 0; i < 20; i++) { const r = S.simulatePlayer(prep, "active-walking", i); pp += r.s.ppEarned; staked += r.s.eCharged - r.s.eRefunded; }
  close(assert, pp / staked, W.PP_PER_NET_ENERGY, 0.01, "PP per net Energy");
});
