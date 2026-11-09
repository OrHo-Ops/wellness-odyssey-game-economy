/* Wellness Odyssey: Full Economy V2 scenario configuration.
 *
 * Full Economy V2 is a long-horizon PROJECTION layer. Every player it
 * simulates is synthetic, and every economy value in this file that is not
 * linked to V1 code is HYPOTHETICAL: an exploratory input chosen to map the
 * design space. None is a proposal, an approved rate or a final price.
 *
 * Labels used throughout V2:
 *   linked        read from V1 code at load time (pilot/pilot_model.js,
 *                 analysis/wheel.js), never copied, so V2 cannot drift from it
 *   implemented   a rule of the current game, restated here and pinned by a
 *                 V2 test to its V1 source (assumptions.csv)
 *   approved      a modelling decision taken by the product owner for V2
 *                 (for example: organic Chronons keep accruing while waiting)
 *   hypothetical  an exploratory value with no evidence behind it
 *
 * Every hypothetical value lives here, in PARAMS, so nothing is scattered
 * through the engine as a hardcoded fact.
 *
 * Runs under Node (require) and in the browser after pilot_model.js
 * (window.V2Config).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../../pilot/pilot_model.js"));
  else if (root.PilotModel) root.V2Config = factory(root.PilotModel);
  else throw new Error("Load pilot_model.js before scenario_config.js.");
})(typeof self !== "undefined" ? self : this, function (M) {
  "use strict";

  // ------------------------------------------------------------------------
  // Linked and implemented values
  // ------------------------------------------------------------------------

  /** Values read from the V1 pilot engine. Their V1 labels are kept: the
   * reference mission and puzzle are provisional offline-demo values
   * ("proposed" in V1), not final economy rates. */
  const LINKED = Object.freeze({
    stepsPerEnergy: { value: M.RULES.stepsPerEnergy, label: "implemented", source: "pilot_model.js RULES.stepsPerEnergy" },
    jerusalemPp: { value: M.RULES.jerusalemJourneyPp, label: "implemented", source: "pilot_model.js RULES.jerusalemJourneyPp" },
    missionKm: { value: M.DEFAULTS.mediumMissionKm, label: "proposed (provisional demo value)", source: "pilot_model.js DEFAULTS.mediumMissionKm" },
    missionPieces: { value: M.DEFAULTS.mediumMissionPieces, label: "proposed (provisional demo value)", source: "pilot_model.js DEFAULTS.mediumMissionPieces" },
    missionChronons: { value: M.DEFAULTS.mediumMissionChronons, label: "proposed (provisional demo value)", source: "pilot_model.js DEFAULTS.mediumMissionChronons" },
    puzzleTiles: { value: M.DEFAULTS.puzzleTiles, label: "proposed (Jaffa Gate, provisional)", source: "pilot_model.js DEFAULTS.puzzleTiles" },
    piecesPerTile: { value: M.DEFAULTS.piecesPerTile, label: "proposed (Jaffa Gate, provisional)", source: "pilot_model.js DEFAULTS.piecesPerTile" },
    puzzleCompletionEnergy: { value: M.DEFAULTS.puzzleCompletionEnergy, label: "proposed (Jaffa Gate, provisional)", source: "pilot_model.js DEFAULTS.puzzleCompletionEnergy" },
    stepsPerKm: { value: M.DEFAULTS.stepsPerKm, label: "hypothetical (V1)", source: "pilot_model.js DEFAULTS.stepsPerKm" },
  });
  const linked = (key) => LINKED[key].value;

  /** The seven destinations implemented in the game, with the implemented PP
   * rule (region n costs 1,500 x 1.08^(n-1), rounded). Their placement in the
   * 100-destination World Tour is HYPOTHETICAL; their PP costs are not. */
  const IMPLEMENTED = Object.freeze({
    destinations: Object.freeze(["Jerusalem", "Dead Sea", "Petra", "Cappadocia", "Burj Khalifa", "Acropolis", "Santorini"]),
    baseCostPp: M.RULES.jerusalemJourneyPp,
    costMultiplier: 1.08, // assumptions.csv region_cost_multiplier (pinned by a test)
    source: "assumptions.csv: region_base_cost 1500, region_cost_multiplier 1.08, region_count 7",
  });
  const implementedPp = (n) => Math.round(IMPLEMENTED.baseCostPp * Math.pow(IMPLEMENTED.costMultiplier, n - 1));

  const JOURNEY_COUNT = 100;

  // ------------------------------------------------------------------------
  // Player building blocks (hypothetical behaviour)
  // ------------------------------------------------------------------------

  const ACTIVITY = Object.freeze({
    casual: Object.freeze({ label: "Casual walker", medianDailySteps: 3000, activeDayRate: 0.6 }),
    moderate: Object.freeze({ label: "Moderate walker", medianDailySteps: 6000, activeDayRate: 0.7 }),
    active: Object.freeze({ label: "Active walker", medianDailySteps: 10000, activeDayRate: 0.85 }),
  });

  /** Share of offered missions a player accepts. */
  const MISSION_PATTERNS = Object.freeze({ none: 0, occasional: 0.2, regular: 0.6, high: 0.9 });

  /** Purchase behaviour. Affiliate shoppers buy physical products through the
   * Wellness Store; buyers purchase Chronon bundles directly. */
  const PURCHASE_PATTERNS = Object.freeze({
    none: Object.freeze({ affiliatePer30Days: 0, bundle: null, bundleEveryDays: null }),
    affiliate: Object.freeze({ affiliatePer30Days: 0.67, bundle: null, bundleEveryDays: null }),
    direct: Object.freeze({ affiliatePer30Days: 0, bundle: "small", bundleEveryDays: 30 }),
    enthusiast: Object.freeze({ affiliatePer30Days: 0, bundle: "medium", bundleEveryDays: 30 }),
  });

  /** How a player splits Chronons between journeys and cosmetics.
   *   none              never buys cosmetics
   *   progression-first buys only while a journey is active, keeping the next journey's price in reserve
   *   envelope          reserves `share` of every Chronon earned for cosmetics (purchased Chronons at `paidShare`)
   *   cosmetics-first   buys the next wished-for item whenever affordable, before unlocking journeys
   */
  const COSMETIC_POLICIES = Object.freeze({
    none: Object.freeze({ label: "No cosmetics", kind: "none" }),
    "progression-first": Object.freeze({ label: "Progression-first", kind: "progression-first", rarities: ["common", "rare", "epic"] }),
    balanced: Object.freeze({ label: "Balanced (20% of earnings)", kind: "envelope", share: 0.2, rarities: ["common", "rare", "epic"] }),
    "share-20": Object.freeze({ label: "20% of earnings", kind: "envelope", share: 0.2, rarities: ["common", "rare", "epic", "legendary"] }),
    "share-40": Object.freeze({ label: "40% of earnings", kind: "envelope", share: 0.4, rarities: ["common", "rare", "epic", "legendary"] }),
    "share-60": Object.freeze({ label: "60% of earnings", kind: "envelope", share: 0.6, rarities: ["common", "rare", "epic", "legendary"] }),
    "cosmetics-first": Object.freeze({ label: "Cosmetics-first", kind: "cosmetics-first", rarities: ["common", "rare", "epic", "legendary"] }),
    collector: Object.freeze({ label: "Collector (60%, sets first)", kind: "envelope", share: 0.6, setsFirst: true, rarities: ["common", "rare", "epic", "legendary"] }),
    enthusiast: Object.freeze({ label: "Paying cosmetics enthusiast", kind: "envelope", share: 0.2, paidShare: 1, rarities: ["common", "rare", "epic", "legendary"] }),
  });

  /** The player cohorts. The first ten follow the V2 brief; the sponsored
   * cohort is added so organic-mission and sponsored-mission players can be
   * compared directly. */
  const COHORTS = Object.freeze({
    "casual-walking": cohort("Casual walker, no missions, no purchases", "casual", "none", false, "none", "none"),
    "moderate-walking": cohort("Moderate walker, no missions, no purchases", "moderate", "none", false, "none", "none"),
    "active-walking": cohort("Active walker, no missions, no purchases", "active", "none", false, "none", "none"),
    "moderate-occasional-organic": cohort("Moderate walker, occasional organic missions", "moderate", "occasional", false, "none", "none"),
    "moderate-regular-organic": cohort("Moderate walker, regular organic missions", "moderate", "regular", false, "none", "none"),
    "moderate-regular-sponsored": cohort("Moderate walker, regular missions with a sponsor in reach", "moderate", "regular", true, "none", "none"),
    "active-regular-missions": cohort("Active walker, regular missions with a sponsor in reach", "active", "regular", true, "none", "none"),
    "moderate-affiliate": cohort("Moderate walker, Wellness Store purchases", "moderate", "none", false, "affiliate", "none"),
    "moderate-direct": cohort("Moderate walker, direct Chronon purchases", "moderate", "none", false, "direct", "none"),
    "moderate-missions-cosmetics": cohort("Moderate walker, regular organic missions and cosmetics", "moderate", "regular", false, "none", "balanced"),
    "high-engagement-collector": cohort("High-engagement collector", "active", "high", true, "none", "collector"),
  });

  function cohort(label, activity, missions, sponsorInReach, purchases, cosmetics) {
    return Object.freeze({ label, activity, missions, sponsorInReach, purchases, cosmetics });
  }

  /** The four player types the analysis compares first. */
  const KEY_COHORTS = Object.freeze(["moderate-walking", "moderate-regular-organic", "moderate-regular-sponsored", "moderate-affiliate", "moderate-direct"]);

  // ------------------------------------------------------------------------
  // Hypothetical economy parameters
  // ------------------------------------------------------------------------

  /** Pacing scenarios: PP length of journeys 8-100. Journeys 1-7 always keep
   * the implemented costs. The implemented 8% growth is NOT extrapolated: on
   * its own it would make journey 100 cost about 3 million PP. */
  const PP_CURVES = Object.freeze({
    flat: Object.freeze({ label: "Flat after Santorini", note: "Journeys 8-100 at Santorini's 2,380 PP" }),
    gentle: Object.freeze({ label: "Gentle growth", note: "+1% of Santorini's cost per journey after journey 7" }),
    capped: Object.freeze({ label: "8% growth, capped", note: "The implemented 8% growth continues until it reaches 3 x Jerusalem, then stays flat" }),
  });

  /** Chronon price families for journeys 2-100. Jerusalem is the free start
   * journey. Every family except `exponential-fixed` is scaled so that the
   * whole tour costs the same total as the coverage-targeted hybrid: the
   * families differ in WHEN they charge, not how much. */
  const PRICE_CURVES = Object.freeze({
    linear: Object.freeze({ label: "Linear" }),
    exponential: Object.freeze({ label: "Exponential" }),
    piecewise: Object.freeze({ label: "Piecewise (early / mid / late)" }),
    milestone: Object.freeze({ label: "Milestone jumps" }),
    hybrid: Object.freeze({ label: "Coverage-targeted hybrid" }),
    "exponential-fixed": Object.freeze({ label: "Exponential from a fixed start price (not budget-matched)" }),
  });

  /** Coverage levels for the hybrid: the ratio of Chronons a walking-only
   * player earns during journey k-1 (organic + completion reward) to the
   * price of journey k, at journeys 2, 10, 40 and 100 (linear between). */
  const COVERAGE_LEVELS = Object.freeze({
    generous: Object.freeze([1.5, 1.4, 1.2, 1.0]),
    reference: Object.freeze([1.3, 1.2, 0.95, 0.7]),
    scarce: Object.freeze([1.15, 1.0, 0.8, 0.55]),
  });
  const COVERAGE_ANCHOR_JOURNEYS = Object.freeze([2, 10, 40, 100]);

  const BUNDLES = Object.freeze({
    small: Object.freeze({ price: 4.99, walkingDays: 7 }),
    medium: Object.freeze({ price: 9.99, walkingDays: 15 }),
    large: Object.freeze({ price: 19.99, walkingDays: 32 }),
  });

  const RARITIES = Object.freeze(["common", "rare", "epic", "legendary"]);

  /** Every editable input. `status` is one of the labels above. */
  const PARAMS = [
    // Rules decided for V2 (approved) and analytical switches
    p("accrueWhileWaiting", true, "Organic Chronons accrue while no journey is active", "approved", "toggle", "rules",
      { note: "Approved. Switching it off is the failure scenario that can deadlock a free player." }),
    p("pendingPpApplication", "full", "Pending PP on the next unlocked journey", "approved", "option", "rules",
      { options: ["full", "none"], note: "Approved: applied in full. Never pays a Chronon price." }),
    p("energyCap", null, "Bank cap on step Energy at sync", "hypothetical", "Energy", "rules",
      { options: [null, 250, 500], note: "No cap is an analytical baseline, not a production decision. Production: 250; dev/beta/demo: 500." }),
    p("dailyBonuses", false, "Implemented daily milestones and goal bonus", "implemented", "toggle", "rules",
      { note: "Off in the baseline, tested separately. Values are V1's LEGACY_BONUSES." }),
    p("backfillInactiveDays", false, "Credit steps from days without a session", "hypothetical", "toggle", "rules"),

    // Walking (hypothetical behaviour)
    p("betweenPlayerStepCv", 0.35, "Between-player step variation", "hypothetical", "CV", "walking", { min: 0, max: 1.5 }),
    p("dayToDayStepCv", 0.3, "Day-to-day step variation", "hypothetical", "CV", "walking", { min: 0, max: 1.5 }),

    // Organic earning
    p("organicChrononsPer1000", 1, "Organic Chronons per 1,000 verified steps", "hypothetical", "Chronons", "chronons", { min: 0, max: 20 }),
    p("organicPiecesPer1000", 5, "Organic puzzle pieces per 1,000 verified steps", "hypothetical", "pieces", "puzzle", { min: 0, max: 200 }),

    // Journeys
    p("ppCurve", "gentle", "PP length of journeys 8-100 (pacing)", "hypothetical", "option", "journeys", { options: Object.keys(PP_CURVES) }),
    p("ppGentleSlope", 0.01, "Gentle growth per journey", "hypothetical", "share of Santorini", "journeys", { min: 0, max: 0.2 }),
    p("ppCapMultiple", 3, "Cap for 8% growth", "hypothetical", "x Jerusalem", "journeys", { min: 1, max: 20 }),
    p("tierSize", 3, "Journeys per prerequisite tier after journey 7", "hypothetical", "journeys", "journeys", { min: 1, max: 10, int: true }),
    p("completionRewardPer100Pp", 1, "Journey completion reward", "hypothetical", "Chronons per 100 PP", "journeys", { min: 0, max: 20 }),
    p("priceCurve", "hybrid", "Journey price family", "hypothetical", "option", "prices", { options: Object.keys(PRICE_CURVES) }),
    p("coverageLevel", "reference", "Hybrid coverage level", "hypothetical", "option", "prices", { options: Object.keys(COVERAGE_LEVELS) }),
    p("coverageAnchors", null, "Override: hybrid coverage at journeys 2, 10, 40 and 100", "hypothetical", "ratios", "prices",
      { nullable: true, note: "Used by the balance sweep; null uses the named coverage level." }),
    p("priceCalibrationPpCurve", "gentle", "PP curve the price schedule is calibrated on", "hypothetical", "option", "prices",
      { options: Object.keys(PP_CURVES), note: "Prices are frozen numbers: changing the pacing curve alone does not reprice journeys." }),
    p("priceCalibrationOrganicPer1000", 1, "Organic rate the price schedule is calibrated on", "hypothetical", "Chronons per 1,000 steps", "prices", { min: 0.01, max: 20 }),
    p("priceCalibrationCompletionPer100Pp", 1, "Completion reward the price schedule is calibrated on", "hypothetical", "Chronons per 100 PP", "prices", { min: 0, max: 20 }),
    p("linearSlope", 0.04, "Linear: growth per journey", "hypothetical", "share of first price", "prices", { min: 0, max: 1 }),
    p("expGrowth", 1.03, "Exponential: growth per journey", "hypothetical", "ratio", "prices", { min: 1, max: 1.2 }),
    p("piecewiseSlopes", [0.01, 0.03, 0.06], "Piecewise: growth per journey in journeys 2-10, 11-40, 41-100", "hypothetical", "share of first price", "prices"),
    p("milestoneEvery", 10, "Milestone: jump every n journeys", "hypothetical", "journeys", "prices", { min: 2, max: 50, int: true }),
    p("milestoneJump", 1.2, "Milestone: size of each jump", "hypothetical", "ratio", "prices", { min: 1, max: 3 }),
    p("milestoneSlope", 0.02, "Milestone: growth between jumps", "hypothetical", "share of first price", "prices", { min: 0, max: 1 }),
    p("fixedStartPrice", 23, "Exponential-fixed: price of journey 2", "hypothetical", "Chronons", "prices", { min: 1, max: 10000, int: true }),

    // Missions
    p("organicOfferPerActiveDay", 0.5, "Organic mission offered on an active day", "hypothetical", "probability", "missions", { min: 0, max: 1 }),
    p("sponsoredOfferPerActiveDay", 0.3, "Sponsored mission offered on an active day (sponsor in reach)", "hypothetical", "probability", "missions", { min: 0, max: 1 }),
    p("missionCompletion", 0.8, "Verified completion of an accepted mission", "hypothetical", "share", "missions", { min: 0, max: 1 }),
    p("organicMissionRewardShare", 1, "Organic mission reward relative to the 2 km reference", "hypothetical", "share", "missions", { min: 0, max: 2 }),
    p("incrementalWalkShare", 0.5, "Mission route walked beyond a usual day", "hypothetical", "share of route", "missions", { min: 0, max: 1 }),
    p("missionRatePerActiveDay", null, "Override: missions completed per active day", "hypothetical", "probability", "missions",
      { min: 0, max: 1, nullable: true, note: "Used by the heatmap to set an exact mission frequency." }),

    // Puzzles
    p("puzzleStructure", "per-destination", "Future Vision puzzles", "hypothetical", "option", "puzzle",
      { options: ["jaffa-only", "per-destination", "every-k"], note: "Only Jaffa Gate is defined. One per destination generalises its provisional values as a labelled assumption." }),
    p("puzzleEveryK", 5, "Every-k: one puzzle every k journeys", "hypothetical", "journeys", "puzzle", { min: 1, max: 50, int: true }),
    p("laterPuzzleCompletionEnergy", 100, "Completion Energy for puzzles after Jaffa Gate", "hypothetical", "Energy", "puzzle", { min: 0, max: 1000, int: true }),
    p("puzzleBonusOff", false, "Counterfactual: no puzzle completion Energy", "hypothetical", "toggle", "puzzle",
      { note: "Analysis switch only: measures how much PP the completion Energy adds." }),
    p("tileRevealChronons", 0, "Chronons per tile revealed (experiment only)", "hypothetical", "Chronons", "puzzle",
      { min: 0, max: 20, int: true, note: "0 matches the documentation and the demo audit. Non-zero values are a separate experiment." }),

    // Wellness Store (affiliate)
    p("productPriceMedian", 45, "Product price, median", "hypothetical", "USD", "store", { min: 1, max: 1000 }),
    p("productPriceSigma", 0.6, "Product price spread (log)", "hypothetical", "sigma", "store", { min: 0, max: 2 }),
    p("eligibleShare", 0.9, "Share of an order eligible for Chronons", "hypothetical", "share", "store", { min: 0, max: 1 }),
    p("affiliateRewardRate", 0.05, "Reward rate: bundle-equivalent value per eligible dollar", "hypothetical", "share", "store", { min: 0, max: 0.5 }),
    p("affiliateCommission", 0.08, "Affiliate commission to the game", "hypothetical", "share", "store", { min: 0, max: 0.5 }),
    p("refundRate", 0.1, "Orders refunded or returned", "hypothetical", "share", "store", { min: 0, max: 1 }),
    p("verificationDays", 30, "Verification delay before store Chronons release", "hypothetical", "days", "store", { min: 0, max: 120, int: true }),
    p("clawbackPolicy", "pending", "Refund handling", "hypothetical", "option", "store",
      { options: ["pending", "clawback", "no-clawback"], note: "pending: credited after the return window; clawback: credited at once, reversed on refund (balance may go negative); no-clawback: the abuse case." }),
    p("cannibalization", 0.5, "Store Chronons that displace bundle purchases", "hypothetical", "share", "store", { min: 0, max: 1 }),
    p("storeCostPerOrder", 0.15, "Verification and support cost per order", "hypothetical", "USD", "store", { min: 0, max: 10 }),

    // Direct purchase
    p("platformFee", 0.3, "App-store fee on bundles", "hypothetical", "share", "bundles", { min: 0, max: 0.5, note: "Typical platform fees are 15-30%; to verify." }),
    p("bundleReferenceOrganicPer1000", 1, "Organic rate bundles are sized on", "hypothetical", "Chronons per 1,000 steps", "bundles", { min: 0.01, max: 20 }),

    // Cosmetics
    p("rarityWeeks", { common: 0.75, rare: 2, epic: 4, legendary: 8 }, "Cosmetic price, in weeks of a moderate walker's organic Chronons", "hypothetical", "weeks", "cosmetics"),

    // Wheel and simulation
    p("wheelMode", "ev", "Wheel accounting", "hypothetical", "option", "simulation", { options: ["ev", "sampled"],
      note: "ev: each spin pays its expected PP (refunds still drawn); sampled: each spin draws an outcome from the reviewed table." }),
    p("tierMix", { 10: 0.3, 50: 0.5, 100: 0.2 }, "Wheel V3 tier choice (offline demo tiers)", "hypothetical", "share of spins", "simulation"),
    p("horizonDays", 2190, "Simulation horizon", "hypothetical", "days", "simulation", { min: 1, max: 5000, int: true }),
    p("playersPerCohort", 200, "Synthetic players per cohort", "hypothetical", "players", "simulation", { min: 1, max: 5000, int: true }),
    p("seed", 2026, "Random seed", "hypothetical", "seed", "simulation", { min: 0, max: 2147483647, int: true }),
  ];

  function p(key, value, label, status, unit, group, extra) {
    return Object.freeze({ key, default: value, label, status, unit, group, ...(extra || {}) });
  }

  const DEFAULTS = Object.freeze(Object.fromEntries(PARAMS.map((x) => [x.key, x.default])));
  const clone = (v) => (v === null || typeof v !== "object" ? v : JSON.parse(JSON.stringify(v)));

  /** A complete scenario: defaults, then overrides. */
  function buildScenario(overrides = {}) {
    const cfg = {};
    for (const [k, v] of Object.entries(DEFAULTS)) cfg[k] = clone(k in overrides ? overrides[k] : v);
    for (const k of Object.keys(overrides)) if (!(k in DEFAULTS)) throw new Error(`Unknown scenario key: ${k}`);
    return cfg;
  }

  /** Every reason a scenario cannot run. Empty when valid. */
  function validateScenario(cfg) {
    const errors = [];
    for (const meta of PARAMS) {
      const v = cfg[meta.key];
      if (meta.options) {
        if (!meta.options.includes(v)) errors.push(`${meta.label}: must be one of ${meta.options.map(String).join(", ")}.`);
        continue;
      }
      if (meta.unit === "toggle") { if (typeof v !== "boolean") errors.push(`${meta.label}: must be on or off.`); continue; }
      if (v === null && meta.nullable) continue;
      if (typeof meta.default === "number") {
        if (typeof v !== "number" || !Number.isFinite(v)) { errors.push(`${meta.label}: must be a number.`); continue; }
        if (meta.min !== undefined && v < meta.min) errors.push(`${meta.label}: must be at least ${meta.min}.`);
        if (meta.max !== undefined && v > meta.max) errors.push(`${meta.label}: must be at most ${meta.max}.`);
        if (meta.int && !Number.isInteger(v)) errors.push(`${meta.label}: must be a whole number.`);
      }
    }
    const mix = cfg.tierMix || {};
    const tierTotal = Object.values(mix).reduce((a, b) => a + (b > 0 ? b : 0), 0);
    if (!(tierTotal > 0)) errors.push("Wheel V3 tier choice: at least one tier needs a share above zero.");
    for (const s of Object.keys(mix)) if (![10, 50, 100].includes(Number(s))) errors.push(`Wheel V3 tier choice: ${s} is not a V3 tier.`);
    if (cfg.coverageAnchors !== null && !(Array.isArray(cfg.coverageAnchors) && cfg.coverageAnchors.length === 4 && cfg.coverageAnchors.every((x) => x > 0))) {
      errors.push("Coverage anchors: four values above zero, or null.");
    }
    if (!Array.isArray(cfg.piecewiseSlopes) || cfg.piecewiseSlopes.length !== 3 || cfg.piecewiseSlopes.some((x) => !(x >= 0))) {
      errors.push("Piecewise slopes: three values of 0 or more.");
    }
    for (const r of RARITIES) if (!(cfg.rarityWeeks && cfg.rarityWeeks[r] > 0)) errors.push(`Cosmetic price for ${r}: above zero.`);
    return errors;
  }

  // ------------------------------------------------------------------------
  // Derived reference quantities (arithmetic on the inputs above)
  // ------------------------------------------------------------------------

  /** Expected verified steps credited per calendar day for an activity
   * profile: lognormal between-player mean x session rate (steps on days
   * without a session are lost unless backfilled). */
  function creditedStepsPerDay(cfg, activityKey) {
    const a = ACTIVITY[activityKey];
    const meanFactor = Math.sqrt(1 + cfg.betweenPlayerStepCv ** 2);
    return a.medianDailySteps * meanFactor * (cfg.backfillInactiveDays ? 1 : a.activeDayRate);
  }

  /** Chronons a moderate walker earns organically per week, at a given rate. */
  const weeklyOrganicReference = (cfg, per1000) => (7 * creditedStepsPerDay(cfg, "moderate") * per1000) / 1000;

  /** Bundle sizes: a bundle buys `walkingDays` of a moderate walker's organic
   * Chronons at the bundle reference rate. The bundle price is what gives a
   * Chronon an implied dollar value; nothing else does. */
  function bundleChronons(cfg, size) {
    const b = BUNDLES[size];
    return Math.max(1, Math.round((b.walkingDays * creditedStepsPerDay(cfg, "moderate") * cfg.bundleReferenceOrganicPer1000) / 1000));
  }
  const chrononDollarValue = (cfg) => BUNDLES.small.price / bundleChronons(cfg, "small");

  return {
    LINKED, linked, IMPLEMENTED, implementedPp, JOURNEY_COUNT,
    ACTIVITY, MISSION_PATTERNS, PURCHASE_PATTERNS, COSMETIC_POLICIES, COHORTS, KEY_COHORTS,
    PP_CURVES, PRICE_CURVES, COVERAGE_LEVELS, COVERAGE_ANCHOR_JOURNEYS, BUNDLES, RARITIES,
    PARAMS, DEFAULTS, buildScenario, validateScenario,
    creditedStepsPerDay, weeklyOrganicReference, bundleChronons, chrononDollarValue,
  };
});
