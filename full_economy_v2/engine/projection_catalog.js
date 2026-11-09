/* Wellness Odyssey: the Full Economy V2 World Tour projection.
 *
 * A 100-journey PROJECTION, not an editorial catalog:
 *   journey 1        Jerusalem, the free start journey (PP linked to V1)
 *   journeys 2-7     the six other implemented destinations with their
 *                    implemented PP costs; their World Tour placement (a chain
 *                    in implemented order) is hypothetical
 *   journeys 8-100   placeholders, labelled as projections, in prerequisite
 *                    tiers; their PP comes from a pacing curve
 *
 * PP length and Chronon price are separate schedules. The price schedule is
 * calibrated once (on `priceCalibrationPpCurve` and
 * `priceCalibrationOrganicPer1000`) and then frozen, so changing the pacing
 * curve or the organic rate never silently reprices journeys.
 *
 * The projection is also written out in the V1 catalog format and checked by
 * V1's validator through a wrapper: V1's format accepts only two catalog
 * statuses, so the wrapper validates a copy marked "test-fixture" and checks
 * V2's own status itself. V1's world_tour.js is not modified.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../config/scenario_config.js"), require("./wheel_v3.js"), require("../../pilot/world_tour.js"));
  } else root.V2Projection = factory(root.V2Config, root.V2Wheel, root.WorldTour);
})(typeof self !== "undefined" ? self : this, function (C, W, WorldTour) {
  "use strict";

  const N = C.JOURNEY_COUNT;
  const IMPLEMENTED_COUNT = C.IMPLEMENTED.destinations.length;
  const V2_STATUS = "projection-hypothetical";
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const pad = (k) => String(k).padStart(3, "0");

  // ------------------------------------------------------------------------
  // Schedules
  // ------------------------------------------------------------------------

  /** PP length of journeys 1..100 (index 0 = journey 1) under a pacing curve. */
  function ppSchedule(cfg, curve = cfg.ppCurve) {
    if (!(curve in C.PP_CURVES)) throw new Error(`Unknown PP curve: ${curve}`);
    const last = C.implementedPp(IMPLEMENTED_COUNT);
    const out = [];
    for (let k = 1; k <= N; k++) {
      if (k <= IMPLEMENTED_COUNT) { out.push(C.implementedPp(k)); continue; }
      const j = k - IMPLEMENTED_COUNT;
      if (curve === "flat") out.push(last);
      else if (curve === "gentle") out.push(Math.round(last * (1 + cfg.ppGentleSlope * j)));
      else out.push(Math.round(Math.min(last * Math.pow(C.IMPLEMENTED.costMultiplier, j), cfg.ppCapMultiple * C.linked("jerusalemPp"))));
    }
    return out;
  }

  const completionRewards = (cfg, pp) => pp.map((x) => Math.round((cfg.completionRewardPer100Pp * x) / 100));

  /** Hybrid coverage target for journey k (2..100), linear between anchors. */
  function coverageAt(level, k, anchors = null) {
    const a = C.COVERAGE_ANCHOR_JOURNEYS, v = anchors || C.COVERAGE_LEVELS[level];
    if (k <= a[0]) return v[0];
    for (let i = 1; i < a.length; i++) {
      if (k <= a[i]) return v[i - 1] + ((v[i] - v[i - 1]) * (k - a[i - 1])) / (a[i] - a[i - 1]);
    }
    return v[v.length - 1];
  }

  /** Chronons a walking-only player earns during journey k (organic on its
   * credited steps, plus its completion reward), at the calibration basis. */
  function earnedDuring(cfg, pp, rewards, per1000) {
    return pp.map((x, i) => (W.stepsForPp(x) * per1000) / 1000 + rewards[i]);
  }

  /** Shape of a budget-matched family over journeys 2..100. */
  function shape(cfg, family) {
    const s = [];
    for (let k = 2; k <= N; k++) {
      const i = k - 2;
      if (family === "linear") s.push(1 + cfg.linearSlope * i);
      else if (family === "exponential") s.push(Math.pow(cfg.expGrowth, i));
      else if (family === "piecewise") {
        const slope = k <= 10 ? cfg.piecewiseSlopes[0] : k <= 40 ? cfg.piecewiseSlopes[1] : cfg.piecewiseSlopes[2];
        s.push(i === 0 ? 1 : s[i - 1] + slope);
      } else if (family === "milestone") {
        s.push((1 + cfg.milestoneSlope * i) * Math.pow(cfg.milestoneJump, Math.floor((k - 1) / cfg.milestoneEvery)));
      } else throw new Error(`Not a budget-matched family: ${family}`);
    }
    return s;
  }

  /** Chronon prices for journeys 1..100 (journey 1 is free: null). */
  function priceSchedule(cfg, family = cfg.priceCurve) {
    if (!(family in C.PRICE_CURVES)) throw new Error(`Unknown price curve: ${family}`);
    const calPp = ppSchedule(cfg, cfg.priceCalibrationPpCurve);
    const calRewards = calPp.map((x) => Math.round((cfg.priceCalibrationCompletionPer100Pp * x) / 100));
    const calEarned = earnedDuring(cfg, calPp, calRewards, cfg.priceCalibrationOrganicPer1000);
    const hybrid = [null];
    for (let k = 2; k <= N; k++) hybrid.push(Math.max(1, Math.round(calEarned[k - 2] / coverageAt(cfg.coverageLevel, k, cfg.coverageAnchors))));
    if (family === "hybrid") return hybrid;
    if (family === "exponential-fixed") {
      const out = [null];
      for (let k = 2; k <= N; k++) out.push(Math.max(1, Math.round(cfg.fixedStartPrice * Math.pow(cfg.expGrowth, k - 2))));
      return out;
    }
    const budget = hybrid.slice(1).reduce((a, b) => a + b, 0);
    const s = shape(cfg, family), total = s.reduce((a, b) => a + b, 0);
    return [null, ...s.map((x) => Math.max(1, Math.round((budget * x) / total)))];
  }

  /** Prerequisite tiers: journeys 1-7 form a chain; journeys 8-100 come in
   * tiers of `tierSize`, each requiring every journey of the previous tier.
   * Index order is therefore always a valid unlock order. */
  function tiers(cfg) {
    const tierOf = [], requires = [];
    for (let k = 1; k <= N; k++) {
      if (k <= IMPLEMENTED_COUNT) { tierOf.push(k - 1); requires.push(k === 1 ? [] : [k - 1]); continue; }
      const t = IMPLEMENTED_COUNT + Math.floor((k - IMPLEMENTED_COUNT - 1) / cfg.tierSize);
      tierOf.push(t);
      const prev = [];
      for (let j = 1; j < k; j++) if (tierOf[j - 1] === t - 1) prev.push(j);
      requires.push(prev);
    }
    return { tierOf, requires };
  }

  /** Puzzles available in the projection: [{ journey, tiles, piecesPerTile, completionEnergy, linked }].
   * Only Jaffa Gate is defined in V1; later puzzles generalise its provisional
   * tile settings as a labelled hypothetical assumption. */
  function puzzles(cfg) {
    const jaffa = { journey: 1, tiles: C.linked("puzzleTiles"), piecesPerTile: C.linked("piecesPerTile"), completionEnergy: C.linked("puzzleCompletionEnergy"), linked: true };
    const out = [jaffa];
    if (cfg.puzzleStructure === "jaffa-only") return out;
    for (let k = 2; k <= N; k++) {
      if (cfg.puzzleStructure === "every-k" && (k - 1) % cfg.puzzleEveryK !== 0) continue;
      out.push({ journey: k, tiles: jaffa.tiles, piecesPerTile: jaffa.piecesPerTile, completionEnergy: cfg.laterPuzzleCompletionEnergy, linked: false });
    }
    return out;
  }

  /** The whole projection: one record per journey plus the puzzle list. */
  function buildProjection(cfg) {
    const pp = ppSchedule(cfg), price = priceSchedule(cfg), reward = completionRewards(cfg, pp);
    const { tierOf, requires } = tiers(cfg);
    const journeys = [];
    for (let k = 1; k <= N; k++) {
      const implemented = k <= IMPLEMENTED_COUNT;
      const name = implemented ? C.IMPLEMENTED.destinations[k - 1] : `Projected destination ${k}`;
      journeys.push(Object.freeze({
        index: k,
        id: implemented ? slug(name) : `projected-${pad(k)}`,
        label: implemented ? name : `${name} (placeholder)`,
        kind: k === 1 ? "start" : implemented ? "implemented" : "placeholder",
        tier: tierOf[k - 1],
        requires: Object.freeze(requires[k - 1]),
        pp: pp[k - 1],
        ppSource: k === 1 ? "linked: RULES.jerusalemJourneyPp" : implemented ? "implemented: 1,500 x 1.08^(n-1)" : `hypothetical: ${cfg.ppCurve} pacing curve`,
        price: price[k - 1],
        completionReward: reward[k - 1],
        coverageTarget: k === 1 ? null : coverageAt(cfg.coverageLevel, k, cfg.coverageAnchors),
      }));
    }
    const totals = {
      pp: pp.reduce((a, b) => a + b, 0),
      price: price.slice(1).reduce((a, b) => a + b, 0),
      rewards: reward.reduce((a, b) => a + b, 0),
    };
    return { journeys: Object.freeze(journeys), puzzles: Object.freeze(puzzles(cfg)), totals, priceCurve: cfg.priceCurve, ppCurve: cfg.ppCurve };
  }

  // ------------------------------------------------------------------------
  // The projection in V1's catalog format, and the validation wrapper
  // ------------------------------------------------------------------------

  /** An organic rate per 1,000 steps as whole { amount, perSteps } slots. */
  function rateSlots(per1000) {
    if (!(per1000 > 0)) return { amount: null, perSteps: null }; // 0 cannot be written in the V1 format: left unset
    for (const m of [1, 2, 4, 5, 10, 20, 25, 50, 100, 1000]) {
      const amount = per1000 * m;
      if (Math.abs(amount - Math.round(amount)) < 1e-9) return { amount: { v: Math.round(amount), s: "hypothetical" }, perSteps: { v: 1000 * m, s: "hypothetical" } };
    }
    return { amount: { v: 1, s: "hypothetical" }, perSteps: { v: Math.round(1000 / per1000), s: "hypothetical" } };
  }

  const hyp = (v) => ({ v, s: "hypothetical" });

  function toCatalog(projection, cfg) {
    const cityOf = (j) => (j.index === 1 ? "jerusalem" : j.id);
    const cities = projection.journeys.map((j) => ({
      id: cityOf(j), label: j.kind === "placeholder" ? j.label : j.label,
      region: j.kind === "placeholder" ? "projected-destinations" : "implemented-destinations",
    }));
    const monuments = [{ id: "jaffa-gate", label: "Jaffa Gate", city: "jerusalem" }];
    const puzzleList = [];
    for (const pz of projection.puzzles) {
      if (pz.linked) {
        puzzleList.push({
          id: "jaffa-gate", label: "Jaffa Gate: Future Vision", monument: "jaffa-gate",
          tiles: { ref: "DEFAULTS.puzzleTiles" }, piecesPerTile: { ref: "DEFAULTS.piecesPerTile" },
          onComplete: { energy: { ref: "DEFAULTS.puzzleCompletionEnergy" } }, availableWhen: "start",
        });
        continue;
      }
      const j = projection.journeys[pz.journey - 1];
      const monument = `${cityOf(j)}-landmark`;
      monuments.push({ id: monument, label: `${j.label} landmark (placeholder)`, city: cityOf(j) });
      puzzleList.push({
        id: `${cityOf(j)}-future-vision`, label: `${j.label}: Future Vision (placeholder)`, monument,
        tiles: hyp(pz.tiles), piecesPerTile: hyp(pz.piecesPerTile), onComplete: { energy: hyp(pz.completionEnergy) },
        availableWhen: { journeyUnlocked: j.id },
      });
    }
    const journeys = projection.journeys.map((j) => {
      const out = {
        id: j.id, label: j.label, era: "present-day", city: cityOf(j),
        pp: j.index === 1 ? { ref: "RULES.jerusalemJourneyPp" } : hyp(j.pp),
        requires: j.requires.map((r) => projection.journeys[r - 1].id),
        onComplete: { chronons: hyp(j.completionReward) },
      };
      if (j.index !== 1) out.price = hyp(j.price);
      return out;
    });
    return {
      id: "full-economy-v2-projection",
      label: "Full Economy V2: 100-journey World Tour projection (hypothetical)",
      status: V2_STATUS,
      organic: {
        chronons: { verifiedSteps: rateSlots(cfg.organicChrononsPer1000) },
        pieces: { verifiedSteps: rateSlots(cfg.organicPiecesPer1000) },
      },
      eras: [
        { id: "present-day", label: "Present Day", playOrder: 1, status: "illustrative", startJourneys: ["jerusalem"], completion: "all",
          next: "earlier-era", transitionReward: null },
        { id: "earlier-era", label: "Earlier historical era (unnamed)", playOrder: 2, status: "roadmap", startJourneys: [], completion: "all", next: null },
      ],
      regions: [
        { id: "implemented-destinations", label: "Implemented destinations (World Tour placement hypothetical)" },
        { id: "projected-destinations", label: "Projected destinations (placeholders)" },
      ],
      cities, monuments, journeys, puzzles: puzzleList, collections: [],
    };
  }

  /** V1's validator plus V2's own checks. V1's world_tour.js is unchanged. */
  function validateProjectionCatalog(catalog) {
    const errors = [], warnings = [];
    if (!catalog || catalog.status !== V2_STATUS) errors.push(`catalog.status must be "${V2_STATUS}".`);
    const copy = JSON.parse(JSON.stringify(catalog || {}));
    copy.status = "test-fixture"; // the only V1 status that is not a pilot catalog
    const v1 = WorldTour.validateCatalog(copy);
    errors.push(...v1.errors);
    warnings.push(...v1.warnings);
    const journeys = (catalog && Array.isArray(catalog.journeys)) ? catalog.journeys : [];
    if (journeys.length !== N) errors.push(`The projection holds ${journeys.length} journeys, not ${N}.`);
    C.IMPLEMENTED.destinations.forEach((name, i) => {
      const j = journeys[i];
      if (!j || j.label !== name) errors.push(`Journey ${i + 1} must be the implemented destination ${name}.`);
      else if (i > 0 && !(j.pp && j.pp.v === C.implementedPp(i + 1))) errors.push(`${name} must keep its implemented ${C.implementedPp(i + 1)} PP.`);
    });
    const seen = new Set();
    journeys.forEach((j, i) => {
      for (const r of j.requires || []) if (!seen.has(r)) errors.push(`journeys.${j.id}: requires ${r}, which comes later in index order.`);
      seen.add(j.id);
      if (i > 0 && i < journeys.length && journeys[i - 1].price && j.price && j.price.v < journeys[i - 1].price.v) {
        warnings.push(`journeys.${j.id}: cheaper than the journey before it.`);
      }
    });
    return { errors, warnings, readiness: errors.length ? null : WorldTour.readiness(copy) };
  }

  return { V2_STATUS, ppSchedule, priceSchedule, completionRewards, coverageAt, tiers, puzzles, buildProjection, toCatalog, validateProjectionCatalog, rateSlots };
});
