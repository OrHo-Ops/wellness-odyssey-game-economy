/* Wellness Odyssey: closed-form journey ledger (Full Economy V2).
 *
 * The expected-value, steady-walker view of the World Tour. It answers, for
 * each journey, how many credited steps it takes, how many Chronons a player
 * earns meanwhile, what they hold on finishing, what the next journey costs
 * and how long they wait for it. It is arithmetic, not simulation: one
 * player who credits the same steps every day, spends every Energy on the
 * wheel at its expected return, and earns Chronons at constant rates.
 *
 * Time runs on a steps clock T (cumulative credited steps):
 *   journey k can complete once T x (PP per step) covers the PP of journeys
 *   1..k (pending PP keeps every overshoot, and with no cap, Energy banked
 *   while waiting is spent the moment the next journey opens), and
 *   journey k unlocks once the player holds its price:
 *     U_k = max(C_{k-1}, time the balance reaches P_k)
 *     C_k = max(U_k, steps to cover cumulative PP through k)
 * Organic Chronons accrue while waiting (approved rule); with that rule
 * switched off, a balance below the next price never grows again unless an
 * extra source (missions, purchases) pays, and the ledger reports a deadlock.
 *
 * No Energy cap is modelled here; the simulation covers caps.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./wheel_v3.js"));
  else root.V2Ledger = factory(root.V2Wheel);
})(typeof self !== "undefined" ? self : this, function (W) {
  "use strict";

  /**
   * @param projection  from projection_catalog.buildProjection
   * @param o.organicPer1000         organic Chronons per 1,000 credited steps
   * @param o.creditedStepsPerDay    the walker's credited steps per day (missions' extra walking excluded)
   * @param o.extraStepsPerDay       extra credited steps per day from mission routes
   * @param o.extraChrononsPerDay    Chronons per day from missions and purchases
   * @param o.cosmeticShare          share of every Chronon earned set aside for cosmetics
   * @param o.accrueWhileWaiting     organic Chronons while no journey is active
   */
  function journeyLedger(projection, o) {
    const stepsPerDay = o.creditedStepsPerDay + (o.extraStepsPerDay || 0);
    const organicPerStep = o.organicPer1000 / 1000;
    const extraPerStep = (o.extraChrononsPerDay || 0) / stepsPerDay;
    const keep = 1 - (o.cosmeticShare || 0);
    const activeRate = (organicPerStep + extraPerStep) * keep;
    const waitRate = ((o.accrueWhileWaiting === false ? 0 : organicPerStep) + extraPerStep) * keep;
    const js = projection.journeys;
    const rows = [];
    let cumSteps = 0, balance = 0, prevComplete = 0, deadlockAt = null;
    for (let i = 0; i < js.length; i++) {
      const j = js[i];
      const steps = W.stepsForPp(j.pp);
      let unlock, wait = 0, balanceBefore = balance;
      if (i === 0) unlock = 0;
      else if (deadlockAt !== null) unlock = Infinity;
      else if (balance >= j.price) unlock = prevComplete;
      else if (waitRate > 0) { wait = (j.price - balance) / waitRate; unlock = prevComplete + wait; balance = j.price; }
      else { deadlockAt = j.index; unlock = Infinity; }
      cumSteps += steps;
      if (!Number.isFinite(unlock)) {
        rows.push({ journey: j.index, label: j.label, kind: j.kind, pp: j.pp, steps, price: j.price, reward: j.completionReward,
          unlockSteps: Infinity, completeSteps: Infinity, waitSteps: Infinity, waitDays: Infinity, balanceBefore,
          balanceOnCompletion: null, earnedDuring: null, coverageNext: null, unlockDay: Infinity, completeDay: Infinity, deadlock: true });
        continue;
      }
      if (i > 0) balance -= j.price;
      const complete = Math.max(unlock, cumSteps);
      const earnedActive = (complete - unlock) * activeRate;
      balance += earnedActive + j.completionReward * keep;
      const next = js[i + 1];
      const earnedDuring = W.stepsForPp(j.pp) * organicPerStep * keep + j.completionReward * keep + W.stepsForPp(j.pp) * extraPerStep * keep;
      rows.push({
        journey: j.index, label: j.label, kind: j.kind, pp: j.pp, steps, price: j.price, reward: j.completionReward,
        unlockSteps: unlock, completeSteps: complete, waitSteps: wait, waitDays: wait / stepsPerDay,
        balanceBefore, balanceOnCompletion: balance, earnedDuring,
        coverageNext: next ? earnedDuring / next.price : null,
        unlockDay: unlock / stepsPerDay, completeDay: complete / stepsPerDay, deadlock: false,
      });
      prevComplete = complete;
    }
    const finite = rows.filter((r) => !r.deadlock);
    const firstWait = rows.find((r) => r.journey > 1 && r.waitDays > 1e-9);
    return {
      rows,
      deadlockAt,
      firstWaitJourney: firstWait ? firstWait.journey : null,
      totalWaitDays: finite.reduce((s, r) => s + r.waitDays, 0),
      tourDays: deadlockAt === null ? rows[rows.length - 1].completeDay : Infinity,
      walkingOnlyTourDays: cumSteps / stepsPerDay,
    };
  }

  return { journeyLedger };
});
