/* Wellness Odyssey: the reviewed wheel distribution and what follows from it.
 *
 * Production Wheel V1 is one spin at a fixed 50 Energy. The server draws one
 * of eight outcomes with the integer weights below (out of 1000) and the
 * client only animates to it. This file holds that table as data and derives
 * everything the portfolio states about the wheel from it: expected value,
 * spread, return per Energy, how payouts scale with a stake, which stakes
 * produce fractional Progress Points, the V3 tiers, and the exact expected
 * number of attempts to complete a journey.
 *
 * Statuses, kept explicit because they differ:
 *     V1_OUTCOMES       implemented in the game's server code (one 50-Energy spin)
 *     V2_STAKES         eight stakes: a local development implementation behind a
 *                       debug-only flag, disabled by default. Not production
 *     V3_TIERS          implemented in the offline product demo only; not production
 *
 * Arithmetic is done in tenths of a Progress Point, the unit the game uses for
 * scaled rewards, so every payout below is an exact integer and fractional
 * outcomes are detected exactly rather than by a floating-point tolerance.
 */
"use strict";

const BASE_STAKE = 50;
const STEPS_PER_ENERGY = 10;
const TOTAL_WEIGHT = 1000;

/** Production Wheel V1, at the 50-Energy base stake. The refund outcome pays no
 * Progress Points and returns the stake: the free respin. */
const V1_OUTCOMES = Object.freeze([
  Object.freeze({ pp: 20, weight: 250 }),
  Object.freeze({ pp: 35, weight: 250 }),
  Object.freeze({ pp: 50, weight: 200 }),
  Object.freeze({ pp: 70, weight: 150 }),
  Object.freeze({ pp: 100, weight: 100 }),
  Object.freeze({ pp: 150, weight: 40 }),
  Object.freeze({ pp: 250, weight: 8 }),
  Object.freeze({ pp: 0, weight: 2, refund: true }),
]);

/** Wheel V2: the eight stakes of the flag-gated development implementation. */
const V2_STAKES = Object.freeze([1, 2, 3, 5, 10, 20, 50, 100]);

/** Proposed Wheel V3: three fixed tiers, named as the offline demo names them. */
const V3_TIERS = Object.freeze([
  Object.freeze({ name: "Quick Spin", stake: 10 }),
  Object.freeze({ name: "Journey Spin", stake: 50 }),
  Object.freeze({ name: "Epic Spin", stake: 100 }),
]);

const probability = (o) => o.weight / TOTAL_WEIGHT;
const paying = () => V1_OUTCOMES.filter((o) => !o.refund);
const refundProbability = () => V1_OUTCOMES.filter((o) => o.refund).reduce((s, o) => s + probability(o), 0);

/** A payout at `stake`, in tenths of a PP: pp x stake / 50 = pp x stake / 5 tenths. */
function payoutTenths(pp, stake) {
  const tenths = (pp * stake) / (BASE_STAKE / 10);
  if (!Number.isInteger(tenths)) throw new Error(`${pp} PP at stake ${stake} is not a whole number of tenths`);
  return tenths;
}

/** Expected PP of one attempt at `stake`. A refunded attempt counts as zero PP. */
function expectedPp(stake) {
  return V1_OUTCOMES.reduce((s, o) => s + o.weight * payoutTenths(o.pp, stake), 0) / TOTAL_WEIGHT / 10;
}

/** Standard deviation of the PP of one attempt at `stake`. */
function sdPp(stake) {
  const mean = expectedPp(stake);
  const second = V1_OUTCOMES.reduce((s, o) => s + probability(o) * (payoutTenths(o.pp, stake) / 10) ** 2, 0);
  return Math.sqrt(second - mean ** 2);
}

/** Expected Energy an attempt costs once the refund outcome is returned. */
const expectedNetEnergy = (stake) => stake * (1 - refundProbability());

/** Return per Energy, on the two bases used in this repository. */
const ppPerEnergyStaked = (stake) => expectedPp(stake) / stake;
const ppPerNetEnergy = (stake) => expectedPp(stake) / expectedNetEnergy(stake);

/** Every outcome at `stake`, with whether its payout is a whole number of PP. */
function payoutTable(stake) {
  return V1_OUTCOMES.map((o) => {
    const tenths = payoutTenths(o.pp, stake);
    return {
      basePp: o.pp, refund: !!o.refund, probability: probability(o),
      pp: tenths / 10, fractional: tenths % 10 !== 0,
      shareOfExpectedPp: (probability(o) * tenths) / 10 / expectedPp(stake),
    };
  });
}

/** Probability that an attempt at `stake` lands on a fractional payout. */
const fractionalShare = (stake) => payoutTable(stake).filter((x) => x.fractional).reduce((s, x) => s + x.probability, 0);

/** Every payout is a whole number of PP exactly when this holds. */
const isWholeNumberStake = (stake) => paying().every((o) => payoutTenths(o.pp, stake) % 10 === 0);

/** Share of attempts that pay less than the mean (refunds included, at zero). */
function shareBelowMean(stake) {
  const mean = expectedPp(stake);
  return payoutTable(stake).filter((x) => x.pp < mean).reduce((s, x) => s + x.probability, 0);
}

/** The weighted median payout of one attempt. */
function medianPp(stake) {
  const rows = [...payoutTable(stake)].sort((a, b) => a.pp - b.pp);
  let cumulative = 0;
  for (const row of rows) {
    cumulative += row.probability;
    if (cumulative >= 0.5) return row.pp;
  }
  return rows[rows.length - 1].pp;
}

/** Expected cost of `pp` Progress Points, by any stake: net Energy, steps, attempts. */
function costOf(pp, stake) {
  const netEnergy = pp / ppPerNetEnergy(stake);
  return { netEnergy, steps: netEnergy * STEPS_PER_ENERGY, attempts: pp / expectedPp(stake) };
}

/** Exact expected cost of reaching `pp` from zero at one fixed `stake`, overshoot included.
 *
 * costOf divides a PP budget by the expected payout, which ignores the last
 * spin's overshoot past the target. This is the expected first-passage time
 * instead, by dynamic programming over the PP still needed (in tenths):
 *     A(r) = (1 + sum_i p_i * A(r - a_i)) / (1 - p_refund),   A(r <= 0) = 0
 * A refund counts as an attempt that leaves the need unchanged. Refunds are
 * independent of when the target is reached, so by Wald's identity the
 * expected Energy-consuming spins are attempts x (1 - p_refund). */
function firstPassage(pp, stake) {
  const refund = refundProbability();
  const pay = payoutTable(stake).filter((x) => !x.refund).map((x) => ({ tenths: Math.round(x.pp * 10), p: x.probability }));
  const need = Math.round(pp * 10);
  const attempts = new Float64Array(need + 1);
  for (let r = 1; r <= need; r++) {
    let sum = 1;
    for (const o of pay) if (r > o.tenths) sum += o.p * attempts[r - o.tenths];
    attempts[r] = sum / (1 - refund);
  }
  const netEnergy = stake * (1 - refund) * attempts[need];
  return { attempts: attempts[need], netEnergy, steps: netEnergy * STEPS_PER_ENERGY };
}

/** One row per stake: the figures the portfolio tables quote. */
function stakeRow(stake) {
  const table = payoutTable(stake).filter((x) => !x.refund);
  return {
    stake,
    stepsPerAttempt: stake * STEPS_PER_ENERGY,
    minPp: Math.min(...table.map((x) => x.pp)),
    maxPp: Math.max(...table.map((x) => x.pp)),
    expectedPp: expectedPp(stake),
    sdPp: sdPp(stake),
    expectedNetEnergy: expectedNetEnergy(stake),
    ppPerEnergyStaked: ppPerEnergyStaked(stake),
    ppPerNetEnergy: ppPerNetEnergy(stake),
    fractionalShare: fractionalShare(stake),
    wholeNumber: isWholeNumberStake(stake),
  };
}

module.exports = {
  BASE_STAKE, STEPS_PER_ENERGY, TOTAL_WEIGHT, V1_OUTCOMES, V2_STAKES, V3_TIERS,
  refundProbability, payoutTenths, expectedPp, sdPp, expectedNetEnergy, ppPerEnergyStaked, ppPerNetEnergy,
  payoutTable, fractionalShare, isWholeNumberStake, shareBelowMean, medianPp, costOf, firstPassage, stakeRow,
};
