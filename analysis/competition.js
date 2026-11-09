/* How much of a Progress-Point contest the wheel decides rather than walking.
 *
 * Leagues and duels are planned, and their scoring metric is undecided. If PP
 * were the metric, the wheel's spread would sit between effort and result.
 * This file measures that exactly: two players turn verified steps into Energy
 * (10 steps per Energy), spend all of it on paid spins at a V3 tier, and the
 * probability that the player who walked less finishes ahead is computed by
 * convolving the per-spin payout distribution, not by simulation or a normal
 * approximation.
 *
 * The step totals are illustrative volumes of walking, not proposed duel
 * lengths. Duel durations, matchmaking and scoring are unset.
 *
 * A refund outcome returns the stake and the player spins again, so the payout
 * of a spin that actually consumes Energy is the reviewed table conditioned on
 * not refunding.
 */
"use strict";
const W = require("./wheel.js");

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Payout distribution of one Energy-consuming spin at `stake`, in units of `unit` PP. */
function paidSpin(stake) {
  const table = W.payoutTable(stake).filter((x) => !x.refund);
  if (table.some((x) => x.fractional)) throw new Error(`stake ${stake} has fractional payouts`);
  const total = table.reduce((s, x) => s + x.probability, 0);
  const unit = table.reduce((g, x) => gcd(g, x.pp), 0);
  return { unit, outcomes: table.map((x) => ({ k: x.pp / unit, p: x.probability / total })) };
}

/** Distributions of total PP after each spin count in `counts`, by exact convolution. */
function totals(stake, counts) {
  const { unit, outcomes } = paidSpin(stake);
  const maxK = Math.max(...outcomes.map((o) => o.k));
  const wanted = new Set(counts);
  const out = new Map();
  let dist = new Float64Array([1]);
  if (wanted.has(0)) out.set(0, { unit, dist });
  for (let n = 1; n <= Math.max(...counts); n++) {
    const next = new Float64Array(dist.length + maxK);
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] === 0) continue;
      for (const o of outcomes) next[i + o.k] += dist[i] * o.p;
    }
    dist = next;
    if (wanted.has(n)) out.set(n, { unit, dist });
  }
  return out;
}

function spinsFor(steps, stake) {
  const energy = steps / W.STEPS_PER_ENERGY;
  if (!Number.isInteger(energy / stake)) throw new Error(`${steps} steps do not divide into ${stake}-Energy spins`);
  return energy / stake;
}

/** Probability the player who walked `lessSteps` ends ahead of, level with, or behind the one who walked `moreSteps`. */
function duel({ lessSteps, moreSteps, lessStake, moreStake }) {
  const a = totals(lessStake, [spinsFor(lessSteps, lessStake)]).values().next().value;
  const b = totals(moreStake, [spinsFor(moreSteps, moreStake)]).values().next().value;
  // Cumulative probability that the more active player holds at most x PP.
  const bCdf = new Float64Array(b.dist.length);
  let run = 0;
  for (let i = 0; i < b.dist.length; i++) bCdf[i] = run += b.dist[i];
  const atMost = (pp) => {
    const i = Math.floor(pp / b.unit);
    return i < 0 ? 0 : bCdf[Math.min(i, bCdf.length - 1)];
  };
  let ahead = 0, level = 0;
  for (let i = 0; i < a.dist.length; i++) {
    if (a.dist[i] === 0) continue;
    const pp = i * a.unit;
    ahead += a.dist[i] * atMost(pp - 1e-9);
    level += a.dist[i] * (atMost(pp) - atMost(pp - 1e-9));
  }
  return { lessAhead: ahead, level, moreAhead: 1 - ahead - level };
}

/** The illustrative grid the documents quote: one player walks 10% more than the other. */
const VOLUMES = Object.freeze([10000, 50000, 100000]);
const MORE_PERCENT = 110;
const more = (steps) => (steps * MORE_PERCENT) / 100;

function sameTierTable() {
  return VOLUMES.map((steps) => ({
    lessSteps: steps,
    moreSteps: more(steps),
    byTier: W.V3_TIERS.map((t) => ({ ...t, ...duel({ lessSteps: steps, moreSteps: more(steps), lessStake: t.stake, moreStake: t.stake }) })),
  }));
}

/** The less active player chooses a tier while the other stays on Journey Spin. */
function tierChoiceTable(steps = 50000) {
  return W.V3_TIERS.map((t) => ({ ...t, ...duel({ lessSteps: steps, moreSteps: more(steps), lessStake: t.stake, moreStake: W.BASE_STAKE }) }));
}

module.exports = { paidSpin, totals, duel, sameTierTable, tierChoiceTable, VOLUMES, MORE_PERCENT };
