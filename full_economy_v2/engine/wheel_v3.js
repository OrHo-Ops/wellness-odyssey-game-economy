/* Wellness Odyssey: Wheel V3 for Full Economy V2.
 *
 * Wheel V3 (Quick 10 / Journey 50 / Epic 100 Energy) is OFFLINE-DEMO
 * functionality, not production; production Wheel V1 is a fixed 50-Energy
 * spin, available here as the Journey tier alone. V2 uses V3 as the target
 * design on the reviewed V1 table. No reward table is invented: the outcomes,
 * weights and tiers come from analysis/wheel.js (in Node directly; in the
 * browser through generated/wheel_table.js, which the V2 checker keeps
 * byte-identical to it).
 *
 * Two accounting modes:
 *   ev       a spin pays its tier's expected PP; the 0.2% refund is still drawn
 *   sampled  a spin draws one outcome from the table
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    const W = require("../../analysis/wheel.js");
    module.exports = factory({ outcomes: W.V1_OUTCOMES, tiers: W.V3_TIERS, totalWeight: W.TOTAL_WEIGHT, baseStake: W.BASE_STAKE, stepsPerEnergy: W.STEPS_PER_ENERGY });
  } else if (root.V2WheelTable) root.V2Wheel = factory(root.V2WheelTable);
  else throw new Error("Load generated/wheel_table.js before wheel_v3.js.");
})(typeof self !== "undefined" ? self : this, function (table) {
  "use strict";

  const total = table.outcomes.reduce((s, o) => s + o.weight, 0);
  if (total !== table.totalWeight) throw new Error("Wheel weights do not sum to the table total.");
  const pRefund = table.outcomes.filter((o) => o.refund).reduce((s, o) => s + o.weight, 0) / total;

  /** One V3 tier: every payout is base PP x stake / 50, a whole number at
   * stakes that are multiples of 10. */
  function buildTier(t) {
    const rows = table.outcomes.map((o) => {
      const pp = (o.pp * t.stake) / table.baseStake;
      if (!Number.isInteger(pp)) throw new Error(`${o.pp} PP at stake ${t.stake} is not whole: not a V3 tier.`);
      return { pp, weight: o.weight, refund: !!o.refund };
    });
    const cumulative = [];
    rows.reduce((sum, r, i) => (cumulative[i] = sum + r.weight), 0);
    const expectedPp = rows.reduce((s, r) => s + r.pp * r.weight, 0) / total;
    const second = rows.reduce((s, r) => s + r.pp * r.pp * r.weight, 0) / total;
    return Object.freeze({
      name: t.name, stake: t.stake, rows: Object.freeze(rows), cumulative: Object.freeze(cumulative),
      expectedPp, sdPp: Math.sqrt(second - expectedPp ** 2), maxPp: Math.max(...rows.map((r) => r.pp)),
    });
  }

  const TIERS = Object.freeze(table.tiers.map(buildTier));
  const byStake = (stake) => {
    const t = TIERS.find((x) => x.stake === stake);
    if (!t) throw new Error(`Not a Wheel V3 tier: ${stake}`);
    return t;
  };
  const MIN_STAKE = Math.min(...TIERS.map((t) => t.stake));
  const PP_PER_ENERGY_STAKED = byStake(table.baseStake).expectedPp / table.baseStake;
  const PP_PER_NET_ENERGY = PP_PER_ENERGY_STAKED / (1 - pRefund);
  /** Expected PP per verified step credited, every step spent on the wheel. */
  const PP_PER_STEP = PP_PER_NET_ENERGY / table.stepsPerEnergy;

  /** Draw one outcome at a tier: { pp, refund }. */
  function sample(rng, tier) {
    const u = rng() * total;
    let j = 0;
    while (tier.cumulative[j] <= u) j++;
    return tier.rows[j];
  }

  /** Credited steps needed for `pp`, on the PP-budget basis (pending PP keeps
   * every overshoot, so over a sequence of journeys the budget basis is the
   * right long-run cost). */
  const stepsForPp = (pp) => (pp / PP_PER_NET_ENERGY) * table.stepsPerEnergy;

  return {
    TIERS, byStake, MIN_STAKE, P_REFUND: pRefund, PP_PER_ENERGY_STAKED, PP_PER_NET_ENERGY, PP_PER_STEP,
    STEPS_PER_ENERGY: table.stepsPerEnergy, BASE_STAKE: table.baseStake, sample, stepsForPp, table,
  };
});
