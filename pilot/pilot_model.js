/* Wellness Odyssey: 30-tester pilot economy model.
 *
 * Every tester in this file is SYNTHETIC. No pilot has run and there is no
 * measured pilot data. Inputs carry one of three labels:
 *
 *     verified      a game rule restated in the pilot brief (Wheel V2, steps,
 *                   the Jerusalem journey). Locked in the dashboard
 *     proposed      a pilot setting under discussion: configurable, not
 *                   production-approved (missions, puzzle, Chronons)
 *     hypothetical  a behavioural or modelling assumption with no evidence
 *                   behind it (activity, discovery, acceptance, stake choice)
 *
 * The same file runs in the dashboard (window.PilotModel) and under Node
 * (`node --test pilot`), so the dashboard and the tests share one engine.
 *
 * The wheel is modelled by its reviewed expectations only: 1.045 x stake
 * Progress Points per attempt, and 0.998 x stake net Energy per attempt, the
 * 0.002 difference being the refund outcome. No per-wedge distribution is
 * assumed, so Progress Points are expected values and individual outcomes
 * vary more than this model shows.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PilotModel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------------------
  // Inputs
  // ------------------------------------------------------------------------

  /** Game rules from the pilot brief. Not editable in the dashboard. */
  const RULES = Object.freeze({
    stepsPerEnergy: 10,
    wheelStakes: Object.freeze([1, 2, 3, 5, 10, 20, 50, 100]),
    expectedPpPerStake: 1.045,          // reviewed: expected PP per attempt = 1.045 x stake
    expectedEnergySpentPerStake: 0.998, // reviewed: includes the 0.2% refund outcome
    ppBaseStake: 50,                    // earned PP = base reward x stake / 50, tenths carried
    jerusalemJourneyPp: 1500,
  });

  /** The legacy daily bonuses of the existing case study (assumptions.csv,
   * labelled verified there). The pilot brief does not restate them, so the
   * pilot applies them only when `legacyDailyBonuses` is switched on. Pinned
   * to assumptions.csv by the tests. */
  const LEGACY_BONUSES = Object.freeze({
    milestones: Object.freeze([
      Object.freeze({ at: 3000, energy: 50 }),
      Object.freeze({ at: 7000, energy: 75 }),
      Object.freeze({ at: 10000, energy: 100 }),
      Object.freeze({ at: 15000, energy: 150 }),
    ]),
    goalSteps: 5000,
    goalEnergy: 100,
    bankCap: 500,
  });

  const MISSION_TIERS = ["short", "medium", "long"];

  /** Every editable input: default, label, status, unit and bounds. */
  const PARAMETERS = [
    // Proposed pilot settings
    p("enrolledTesters", 30, "Enrolled testers", "proposed", "testers", "cohort", { min: 1, max: 500, step: 1, int: true }),
    p("mediumMissionKm", 2, "Medium mission: eligible distance", "proposed", "km", "missions", { min: 0.1, max: 20, step: 0.1 }),
    p("mediumMissionPieces", 90, "Medium mission: puzzle pieces", "proposed", "pieces", "missions", { min: 0, max: 1000, step: 1, int: true }),
    p("mediumMissionChronons", 5, "Medium mission: Chronons", "proposed", "Chronons", "missions", { min: 0, max: 1000, step: 1, int: true }),
    p("shortMissionKm", 1, "Short mission: eligible distance", "proposed", "km", "missions", { min: 0.1, max: 20, step: 0.1 }),
    p("shortMissionPieces", null, "Short mission: puzzle pieces", "proposed", "pieces", "missions", { min: 0, max: 1000, step: 1, int: true, nullable: true }),
    p("shortMissionChronons", null, "Short mission: Chronons", "proposed", "Chronons", "missions", { min: 0, max: 1000, step: 1, int: true, nullable: true }),
    p("longMissionKm", 4, "Long mission: eligible distance", "proposed", "km", "missions", { min: 0.1, max: 30, step: 0.1 }),
    p("longMissionPieces", null, "Long mission: puzzle pieces", "proposed", "pieces", "missions", { min: 0, max: 1000, step: 1, int: true, nullable: true }),
    p("longMissionChronons", null, "Long mission: Chronons", "proposed", "Chronons", "missions", { min: 0, max: 1000, step: 1, int: true, nullable: true }),
    p("puzzleTiles", 9, "First puzzle tiles (3 x 3)", "proposed", "tiles", "puzzle", { min: 1, max: 100, step: 1, int: true }),
    p("piecesPerTile", 30, "Pieces per tile reveal", "proposed", "pieces", "puzzle", { min: 1, max: 1000, step: 1, int: true }),
    p("puzzleCompletionEnergy", 100, "Puzzle completion bonus (once)", "proposed", "Energy", "puzzle", { min: 0, max: 10000, step: 1, int: true }),
    p("additionalJourneyChronons", null, "Additional journey price", "proposed", "Chronons", "puzzle", { min: 1, max: 100000, step: 1, int: true, nullable: true,
      note: "Not approved. Leave blank: Chronons then have no sink." }),
    p("additionalJourneyPp", null, "Additional journey length", "proposed", "PP", "puzzle", { min: 1, max: 100000, step: 1, int: true, nullable: true,
      note: "Not approved. Needed with a price to model a second journey." }),

    // Hypothetical behaviour
    p("pilotDays", 28, "Pilot length", "hypothetical", "days", "cohort", { min: 7, max: 120, step: 1, int: true }),
    p("activationRate", 0.9, "Testers who ever open the app", "hypothetical", "share", "cohort", { min: 0, max: 1, step: 0.01 }),
    p("activeDayRate", 0.7, "Active-day probability", "hypothetical", "share of days", "cohort", { min: 0, max: 1, step: 0.01,
      note: "Chance an activated tester opens the app on a given day." }),
    p("weeklyDropoutRate", 0.05, "Weekly dropout", "hypothetical", "share per week", "cohort", { min: 0, max: 1, step: 0.01,
      note: "Chance an activated tester stops for good at each week boundary." }),
    p("medianDailySteps", 6000, "Median daily steps", "hypothetical", "steps", "steps", { min: 500, max: 30000, step: 100, int: true }),
    p("betweenTesterStepCv", 0.35, "Between-tester variation", "hypothetical", "CV", "steps", { min: 0, max: 1.5, step: 0.05 }),
    p("dayToDayStepCv", 0.3, "Day-to-day variation", "hypothetical", "CV", "steps", { min: 0, max: 1.5, step: 0.05 }),
    p("creditInactiveDaySteps", false, "Credit steps from days without a session", "hypothetical", "toggle", "steps", {
      note: "Off: steps on a day the app is not opened never reach the game." }),
    p("spendShare", 0.8, "Energy wagered on an active day", "hypothetical", "share of balance", "wheel", { min: 0, max: 1, step: 0.05 }),
    p("stakeMix", { 1: 0.04, 2: 0.04, 3: 0.04, 5: 0.12, 10: 0.24, 20: 0.22, 50: 0.22, 100: 0.08 }, "Stake choice", "hypothetical",
      "share of attempts", "wheel", { note: "Normalised to 100%. A tester never bets a stake above the day's remaining budget." }),
    p("participatingBusinesses", 4, "Participating businesses", "hypothetical", "businesses", "missions", { min: 0, max: 100, step: 1, int: true }),
    p("missionsPerBusiness", 1, "Missions per business", "hypothetical", "missions", "missions", { min: 0, max: 20, step: 1, int: true }),
    p("missionMixShort", 0, "Missions that are short", "hypothetical", "share", "missions", { min: 0, max: 1, step: 0.05 }),
    p("missionMixMedium", 1, "Missions that are medium", "hypothetical", "share", "missions", { min: 0, max: 1, step: 0.05 }),
    p("missionMixLong", 0, "Missions that are long", "hypothetical", "share", "missions", { min: 0, max: 1, step: 0.05 }),
    p("discoveryRatePerActiveDay", 0.15, "Mission discovery", "hypothetical", "chance per active day", "missions", { min: 0, max: 1, step: 0.01 }),
    p("acceptanceRate", 0.5, "Mission acceptance", "hypothetical", "share of discovered", "missions", { min: 0, max: 1, step: 0.01 }),
    p("completionRate", 0.7, "Verified completion", "hypothetical", "share of accepted", "missions", { min: 0, max: 1, step: 0.01 }),
    p("stepsPerKm", 1300, "Steps per km walked", "hypothetical", "steps", "missions", { min: 500, max: 2500, step: 10, int: true }),
    p("incrementalWalkShare", 0.5, "Mission walk beyond a usual day", "hypothetical", "share of route", "missions", { min: 0, max: 1, step: 0.05,
      note: "The rest of the route is walking the tester would have done anyway, so it is not counted twice." }),
    p("legacyDailyBonuses", false, "Apply case-study daily bonuses and 500 bank cap", "hypothetical", "toggle", "advanced", {
      note: "Milestones, goal bonus and bank cap from the existing model. Not restated in the pilot brief." }),
    p("replications", 300, "Simulated pilot cohorts", "hypothetical", "runs", "advanced", { min: 20, max: 2000, step: 10, int: true }),
    p("seed", 2026, "Random seed", "hypothetical", "seed", "advanced", { min: 0, max: 2147483647, step: 1, int: true }),
  ];

  function p(key, value, label, status, unit, group, extra) {
    return Object.freeze({ key, default: value, label, status, unit, group, ...(extra || {}) });
  }

  const DEFAULTS = Object.freeze(Object.fromEntries(PARAMETERS.map((x) => [x.key, x.default])));

  /** Scenarios change hypothetical behaviour only. Rules and proposed
   * rewards are identical in all three. */
  const SCENARIOS = Object.freeze({
    baseline: Object.freeze({}),
    conservative: Object.freeze({
      activationRate: 0.75, activeDayRate: 0.5, weeklyDropoutRate: 0.12, medianDailySteps: 4500, spendShare: 0.6,
      participatingBusinesses: 2, discoveryRatePerActiveDay: 0.08, acceptanceRate: 0.3, completionRate: 0.5,
      incrementalWalkShare: 0.3,
    }),
    optimistic: Object.freeze({
      activationRate: 1, activeDayRate: 0.85, weeklyDropoutRate: 0.02, medianDailySteps: 8000, spendShare: 0.9,
      participatingBusinesses: 6, discoveryRatePerActiveDay: 0.25, acceptanceRate: 0.7, completionRate: 0.85,
      incrementalWalkShare: 0.7,
    }),
  });

  function buildConfig(scenario = "baseline", overrides = {}) {
    if (!(scenario in SCENARIOS)) throw new Error(`Unknown scenario: ${scenario}`);
    const cfg = { ...DEFAULTS, ...SCENARIOS[scenario], ...overrides };
    cfg.stakeMix = { ...(overrides.stakeMix || SCENARIOS[scenario].stakeMix || DEFAULTS.stakeMix) };
    return cfg;
  }

  /** Every reason the configuration cannot be simulated. Empty when valid. */
  function validateConfig(cfg) {
    const errors = [];
    for (const meta of PARAMETERS) {
      const value = cfg[meta.key];
      if (meta.unit === "toggle") {
        if (typeof value !== "boolean") errors.push(`${meta.label}: must be on or off.`);
        continue;
      }
      if (meta.key === "stakeMix") continue;
      if (value === null || value === undefined || value === "") {
        if (!meta.nullable) errors.push(`${meta.label}: required.`);
        continue;
      }
      if (typeof value !== "number" || !Number.isFinite(value)) { errors.push(`${meta.label}: must be a number.`); continue; }
      if (value < meta.min || value > meta.max) errors.push(`${meta.label}: must be between ${meta.min} and ${meta.max}.`);
      if (meta.int && !Number.isInteger(value)) errors.push(`${meta.label}: must be a whole number.`);
    }
    const mix = cfg.stakeMix || {};
    let total = 0;
    for (const [stake, share] of Object.entries(mix)) {
      if (!RULES.wheelStakes.includes(Number(stake))) errors.push(`Stake choice: ${stake} is not a Wheel V2 stake.`);
      if (typeof share !== "number" || !Number.isFinite(share) || share < 0) errors.push(`Stake choice: share for ${stake} must be 0 or more.`);
      else total += share;
    }
    if (!(total > 0)) errors.push("Stake choice: at least one stake needs a share above zero.");
    const tierShare = MISSION_TIERS.reduce((sum, t) => sum + (cfg[mixKey(t)] || 0), 0);
    if (missionCount(cfg) > 0 && !(tierShare > 0)) errors.push("Mission distance mix: at least one tier needs a share above zero.");
    for (const tier of MISSION_TIERS) {
      if ((cfg[mixKey(tier)] || 0) > 0 && (cfg[`${tier}MissionPieces`] == null || cfg[`${tier}MissionChronons`] == null)) {
        errors.push(`${cap(tier)} missions have a share but no reward. Set their pieces and Chronons, or set their share to 0.`);
      }
    }
    if ((cfg.additionalJourneyChronons == null) !== (cfg.additionalJourneyPp == null)) {
      errors.push("Additional journey: set both the Chronon price and the length, or leave both blank.");
    }
    return errors;
  }

  const mixKey = (tier) => `missionMix${cap(tier)}`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const missionCount = (cfg) => cfg.participatingBusinesses * cfg.missionsPerBusiness;

  // ------------------------------------------------------------------------
  // Closed-form rules: the arithmetic the simulation must agree with
  // ------------------------------------------------------------------------

  /** Convert synced steps to Energy; steps under a whole Energy carry over. */
  function stepsToEnergy(steps, carriedSteps = 0) {
    const pending = steps + carriedSteps;
    return { energy: Math.floor(pending / RULES.stepsPerEnergy), carriedSteps: pending % RULES.stepsPerEnergy };
  }

  /** Reveal every tile the pieces pay for. Only whole tiles; never past the puzzle. */
  function revealTiles(pieces, tilesRevealed, cfg) {
    const affordable = Math.floor(pieces / cfg.piecesPerTile);
    const revealed = Math.min(affordable, cfg.puzzleTiles - tilesRevealed);
    return { revealed, pieces: pieces - revealed * cfg.piecesPerTile, tilesRevealed: tilesRevealed + revealed };
  }

  /** The wheel's reviewed expectations under a stake mix. */
  function wheelSummary(cfg) {
    const { stakes, weights } = stakeTable(cfg.stakeMix);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const meanStake = stakes.reduce((sum, s, i) => sum + s * weights[i], 0) / totalWeight;
    const ppPerNetEnergy = RULES.expectedPpPerStake / RULES.expectedEnergySpentPerStake;
    return {
      meanStake,
      expectedPpPerAttempt: RULES.expectedPpPerStake * meanStake,
      expectedNetEnergyPerAttempt: RULES.expectedEnergySpentPerStake * meanStake,
      refundProbability: 1 - RULES.expectedEnergySpentPerStake,
      ppPerNetEnergy,
      byStake: RULES.wheelStakes.map((stake) => ({
        stake,
        expectedPp: RULES.expectedPpPerStake * stake,
        expectedNetEnergy: RULES.expectedEnergySpentPerStake * stake,
        ppPerNetEnergy,
      })),
      netEnergyForJerusalem: RULES.jerusalemJourneyPp / ppPerNetEnergy,
      stepsForJerusalem: (RULES.jerusalemJourneyPp / ppPerNetEnergy) * RULES.stepsPerEnergy,
    };
  }

  /** What one mission of each tier buys in the first puzzle. */
  function puzzleSummary(cfg) {
    const piecesForPuzzle = cfg.puzzleTiles * cfg.piecesPerTile;
    const tiers = MISSION_TIERS.map((tier) => {
      const pieces = cfg[`${tier}MissionPieces`];
      const chronons = cfg[`${tier}MissionChronons`];
      const set = pieces != null && chronons != null;
      return {
        tier,
        km: cfg[`${tier}MissionKm`],
        pieces, chronons, set,
        tilesPerMission: set ? Math.floor(pieces / cfg.piecesPerTile) : null,
        shareOfPuzzle: set ? Math.min(pieces / piecesForPuzzle, 1) : null,
        missionsForPuzzle: set && pieces > 0 ? Math.ceil(piecesForPuzzle / pieces) : null,
      };
    });
    return { piecesForPuzzle, tiers, missionsAvailablePerTester: missionCount(cfg) };
  }

  function stakeTable(mix) {
    const stakes = [], weights = [];
    for (const stake of RULES.wheelStakes) {
      const w = mix[stake] || 0;
      if (w > 0) { stakes.push(stake); weights.push(w); }
    }
    return { stakes, weights };
  }

  // ------------------------------------------------------------------------
  // Random numbers
  // ------------------------------------------------------------------------

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFor(seed, replication) {
    let h = (seed ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (replication + 0x85ebca6b), 0xc2b2ae35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function normal(rng) {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  /** Gamma(shape, scale), Marsaglia and Tsang. Never negative, skewed right like step counts. */
  function gamma(rng, shape, scale) {
    if (shape < 1) return gamma(rng, shape + 1, scale) * Math.pow(rng() || Number.MIN_VALUE, 1 / shape);
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = normal(rng); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
    }
  }

  function dailySteps(rng, mean, cv) {
    if (cv <= 0) return Math.round(mean);
    return Math.round(gamma(rng, 1 / (cv * cv), mean * cv * cv));
  }

  /** Spread the missions over distance tiers by largest remainder, so the
   * cohort sees the mix exactly as specified rather than a random draw of it. */
  function assignMissionTiers(cfg) {
    const n = missionCount(cfg);
    const shares = MISSION_TIERS.map((t) => cfg[mixKey(t)] || 0);
    const total = shares.reduce((a, b) => a + b, 0);
    if (n === 0 || total === 0) return [];
    const exact = shares.map((s) => (s / total) * n);
    const counts = exact.map(Math.floor);
    const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; k < n - counts.reduce((a, b) => a + b, 0); k++) counts[order[k][1]]++;
    return counts.flatMap((count, i) => Array(count).fill(i));
  }

  // ------------------------------------------------------------------------
  // Simulation
  // ------------------------------------------------------------------------

  /** One synthetic pilot cohort.
   *
   * Each tester walks every day. On an active day, in this order:
   *   1. A mission accepted on an earlier active day resolves: verified
   *      completion pays its pieces and Chronons, and adds the incremental
   *      route steps to today's walk. Otherwise it is abandoned. One mission
   *      is in progress at a time, so nothing is discovered on this day.
   *   2. With no mission in progress, the tester may discover one they have
   *      not seen, and accept or decline it. Declined missions are not
   *      offered again, and each mission pays a tester at most once.
   *   3. Steps sync: 10 steps = 1 Energy, remainder carried.
   *   4. Whole tiles are revealed while pieces cover one. The completion
   *      bonus is paid once, when the last tile is revealed.
   *   5. A finished journey unlocks the next one if a price and length are
   *      configured and the tester holds the Chronons.
   *   6. The tester wagers a share of the balance. Each attempt draws a stake
   *      from the stake mix among stakes the remaining budget covers, is
   *      charged in full, earns 1.045 x stake expected PP, and is refunded
   *      with probability 0.002. A refund returns to the wallet, not to
   *      today's budget. No attempt is made once the journey is complete
   *      and no next journey is unlocked.
   * Wallets cannot go negative: every debit is checked against the balance.
   */
  function simulateCohort(cfg, seed) {
    const rng = mulberry32(seed);
    const n = cfg.enrolledTesters, days = cfg.pilotDays;
    const { stakes, weights } = stakeTable(cfg.stakeMix);
    const cumulative = [];
    weights.reduce((sum, w, i) => (cumulative[i] = sum + w), 0);
    const refundProbability = 1 - RULES.expectedEnergySpentPerStake;
    const tierOf = assignMissionTiers(cfg);
    const tierReward = MISSION_TIERS.map((t) => ({
      pieces: cfg[`${t}MissionPieces`] || 0,
      chronons: cfg[`${t}MissionChronons`] || 0,
      routeSteps: Math.round(cfg[`${t}MissionKm`] * cfg.stepsPerKm * cfg.incrementalWalkShare),
    }));
    const hasNextJourney = cfg.additionalJourneyChronons != null && cfg.additionalJourneyPp != null;
    const bankCap = cfg.legacyDailyBonuses ? LEGACY_BONUSES.bankCap : null;
    const sigma = Math.sqrt(Math.log(1 + cfg.betweenTesterStepCv ** 2));

    const t = { // cohort totals
      stepsWalked: 0, stepsSynced: 0, stepsNeverSynced: 0, missionRouteSteps: 0,
      energyFromSteps: 0, energyLostToCap: 0, energyCredited: 0, legacyBonusEnergy: 0, puzzleBonusEnergy: 0,
      energyRefunded: 0, energyCharged: 0, energyBalance: 0,
      attempts: 0, attemptsByStake: Object.fromEntries(RULES.wheelStakes.map((s) => [s, 0])),
      energyByStake: Object.fromEntries(RULES.wheelStakes.map((s) => [s, 0])),
      ppEarned: 0, ppOvershoot: 0, ppProgress: 0, journeysCompleted: 0, journeysUnlocked: 0,
      missionsDiscovered: 0, missionsAccepted: 0, missionsCompleted: 0, missionsAbandoned: 0, missionsPending: 0,
      missionsCompletedByTier: [0, 0, 0],
      piecesEarned: 0, piecesSpent: 0, piecesBalance: 0, tilesRevealed: 0, puzzlesCompleted: 0,
      chrononsEarned: 0, chrononsSpent: 0, chrononsBalance: 0,
      activated: 0, everActive: 0, activeAtEnd: 0, activeTesterDays: 0,
      energyIdleTesterDays: 0, // active days with a finished journey and nothing to spend Energy on
    };
    const daily = {
      activeTesters: new Array(days).fill(0),
      jerusalemCompleted: new Array(days).fill(0),
      ppSum: new Array(days).fill(0),
      energySum: new Array(days).fill(0),
      piecesSum: new Array(days).fill(0),
      chrononsSum: new Array(days).fill(0),
      tilesSum: new Array(days).fill(0),
      puzzlesCompleted: new Array(days).fill(0),
    };
    const testers = [];

    for (let i = 0; i < n; i++) {
      const activated = rng() < cfg.activationRate;
      const meanSteps = cfg.medianDailySteps * Math.exp(sigma * normal(rng));
      const unseen = tierOf.map((_, m) => m);
      let dropped = false, everActive = false, pending = -1, backlog = 0, carried = 0;
      let energy = 0, pp = 0, target = RULES.jerusalemJourneyPp, journeys = 0, jerusalemDay = null;
      let pieces = 0, tiles = 0, bonusPaid = false, puzzleDay = null, chronons = 0, completed = 0;
      if (activated) t.activated++;

      const unlockNext = () => {
        if (pp >= target && hasNextJourney && chronons >= cfg.additionalJourneyChronons) {
          chronons -= cfg.additionalJourneyChronons;
          t.chrononsSpent += cfg.additionalJourneyChronons;
          target += cfg.additionalJourneyPp;
          t.journeysUnlocked++;
        }
      };

      for (let d = 0; d < days; d++) {
        if (activated && !dropped && d > 0 && d % 7 === 0 && rng() < cfg.weeklyDropoutRate) dropped = true;
        const walked = dailySteps(rng, meanSteps, cfg.dayToDayStepCv);
        const active = activated && !dropped && rng() < cfg.activeDayRate;

        if (!active) {
          t.stepsWalked += walked;
          if (cfg.creditInactiveDaySteps && activated && !dropped) backlog += walked;
          else t.stepsNeverSynced += walked;
        } else {
          everActive = true;
          t.activeTesterDays++;
          daily.activeTesters[d]++;

          // 1-2. Missions.
          let routeSteps = 0;
          if (pending >= 0) {
            if (rng() < cfg.completionRate) {
              const reward = tierReward[pending];
              routeSteps = reward.routeSteps;
              pieces += reward.pieces; chronons += reward.chronons;
              t.piecesEarned += reward.pieces; t.chrononsEarned += reward.chronons;
              t.missionsCompleted++; t.missionsCompletedByTier[pending]++; completed++;
            } else t.missionsAbandoned++;
            pending = -1;
          } else if (unseen.length > 0 && rng() < cfg.discoveryRatePerActiveDay) {
            const m = unseen.splice(Math.floor(rng() * unseen.length), 1)[0];
            t.missionsDiscovered++;
            if (rng() < cfg.acceptanceRate) { t.missionsAccepted++; pending = tierOf[m]; }
          }
          const daySteps = walked + routeSteps;
          t.stepsWalked += daySteps;
          t.missionRouteSteps += routeSteps;

          // 3. Sync.
          const synced = daySteps + backlog;
          t.stepsSynced += synced;
          backlog = 0;
          const conversion = stepsToEnergy(synced, carried);
          carried = conversion.carriedSteps;
          const credited = bankCap == null ? conversion.energy : Math.min(conversion.energy, Math.max(bankCap - energy, 0));
          t.energyFromSteps += conversion.energy;
          t.energyCredited += credited;
          t.energyLostToCap += conversion.energy - credited;
          energy += credited;
          if (cfg.legacyDailyBonuses) { // outside the cap, judged on today's walk only
            let bonus = daySteps >= LEGACY_BONUSES.goalSteps ? LEGACY_BONUSES.goalEnergy : 0;
            for (const tier of LEGACY_BONUSES.milestones) if (daySteps >= tier.at) bonus += tier.energy;
            energy += bonus;
            t.legacyBonusEnergy += bonus;
          }

          // 4. Tiles and the one-time puzzle bonus.
          const reveal = revealTiles(pieces, tiles, cfg);
          pieces = reveal.pieces; tiles = reveal.tilesRevealed;
          t.piecesSpent += reveal.revealed * cfg.piecesPerTile;
          t.tilesRevealed += reveal.revealed;
          if (tiles === cfg.puzzleTiles && !bonusPaid) {
            bonusPaid = true; puzzleDay = d + 1;
            energy += cfg.puzzleCompletionEnergy;
            t.puzzleBonusEnergy += cfg.puzzleCompletionEnergy;
            t.puzzlesCompleted++;
            daily.puzzlesCompleted[d]++;
          }

          // 5-6. Journey unlock and wheel attempts.
          unlockNext();
          if (pp >= target) t.energyIdleTesterDays++;
          let budget = Math.floor(energy * cfg.spendShare);
          while (pp < target) {
            let k = -1; // largest affordable stake index
            while (k + 1 < stakes.length && stakes[k + 1] <= budget) k++;
            if (k < 0) break;
            const u = rng() * cumulative[k];
            let j = 0;
            while (cumulative[j] <= u) j++;
            const stake = stakes[j];
            energy -= stake; budget -= stake;
            t.energyCharged += stake; t.attempts++;
            t.attemptsByStake[stake]++; t.energyByStake[stake] += stake;
            if (rng() < refundProbability) { energy += stake; t.energyRefunded += stake; }
            pp += RULES.expectedPpPerStake * stake;
            t.ppEarned += RULES.expectedPpPerStake * stake;
            if (pp >= target) {
              t.ppOvershoot += pp - target;
              pp = target;
              journeys++;
              if (jerusalemDay === null) jerusalemDay = d + 1;
              unlockNext();
            }
          }
        }

        daily.ppSum[d] += pp;
        daily.energySum[d] += energy;
        daily.piecesSum[d] += pieces;
        daily.chrononsSum[d] += chronons;
        daily.tilesSum[d] += tiles;
        if (jerusalemDay !== null) daily.jerusalemCompleted[d]++;
      }

      if (everActive) t.everActive++;
      if (activated && !dropped) t.activeAtEnd++;
      if (pending >= 0) t.missionsPending++;
      t.stepsNeverSynced += backlog; // walked on trailing inactive days, still waiting for a sync
      t.journeysCompleted += journeys;
      t.ppProgress += pp;
      t.energyBalance += energy; t.piecesBalance += pieces; t.chrononsBalance += chronons;
      testers.push({ activated, everActive, dropped, energy, pp, journeys, jerusalemDay, pieces, tiles, puzzleDay,
        chronons, missionsCompleted: completed, carriedSteps: carried });
    }
    return { totals: t, daily, testers };
  }

  // ------------------------------------------------------------------------
  // Aggregation over many synthetic cohorts
  // ------------------------------------------------------------------------

  function quantile(sorted, q) {
    if (sorted.length === 0) return NaN;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function describe(values) {
    const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    const mean = v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
    return { mean, p10: quantile(v, 0.1), p50: quantile(v, 0.5), p90: quantile(v, 0.9), n: v.length };
  }

  const median = (values) => quantile([...values].sort((a, b) => a - b), 0.5);

  /** Run `cfg.replications` synthetic cohorts and summarise them.
   *
   * `perEnrolled` divides a cohort total by every enrolled tester.
   * `perActive` divides it by testers with at least one active day, so it
   * describes the people who actually played. Both are averaged over cohorts.
   */
  function runPilot(cfg) {
    const errors = validateConfig(cfg);
    if (errors.length) return { errors };
    const runs = [];
    for (let r = 0; r < cfg.replications; r++) runs.push(simulateCohort(cfg, seedFor(cfg.seed, r)));
    const n = cfg.enrolledTesters, days = cfg.pilotDays;

    const metric = (fn) => {
      const totals = runs.map(fn);
      return {
        total: describe(totals),
        perEnrolled: describe(totals.map((x) => x / n)),
        perActive: describe(totals.map((x, r) => (runs[r].totals.everActive ? x / runs[r].totals.everActive : NaN))),
      };
    };
    const tot = (key) => metric((run) => run.totals[key]);
    const keys = Object.keys(runs[0].totals).filter((k) => typeof runs[0].totals[k] === "number");
    const metrics = Object.fromEntries(keys.map((k) => [k, tot(k)]));
    metrics.testersCompletedJerusalem = metric((run) => run.testers.filter((x) => x.jerusalemDay !== null).length);
    metrics.testersWithATile = metric((run) => run.testers.filter((x) => x.tiles > 0).length);
    metrics.testersStrandedPieces = metric((run) => run.testers.filter((x) => x.pieces > 0 && x.pieces < cfg.piecesPerTile && x.tiles < cfg.puzzleTiles).length);
    metrics.testersPiecesAfterPuzzle = metric((run) => run.testers.filter((x) => x.tiles === cfg.puzzleTiles && x.pieces > 0).length);
    metrics.testersExhaustedMissions = metric((run) => run.testers.filter((x) => missionCount(cfg) > 0 && x.missionsCompleted === missionCount(cfg)).length);

    const completionDays = describe(runs.map((run) => median(run.testers.filter((x) => x.jerusalemDay !== null).map((x) => x.jerusalemDay))));
    const puzzleDays = describe(runs.map((run) => median(run.testers.filter((x) => x.puzzleDay !== null).map((x) => x.puzzleDay))));

    const series = (fn) => Array.from({ length: days }, (_, d) => describe(runs.map((run) => fn(run, d))));
    const wallet = (key) => ({
      perEnrolled: series((run, d) => run.daily[key][d] / n),
      perActive: series((run, d) => (run.totals.everActive ? run.daily[key][d] / run.totals.everActive : NaN)),
    });
    const dailyOut = {
      jerusalemCompleted: series((run, d) => run.daily.jerusalemCompleted[d]),
      activeTesters: series((run, d) => run.daily.activeTesters[d]),
      pp: wallet("ppSum"),
      energy: wallet("energySum"),
      pieces: wallet("piecesSum"),
      chronons: wallet("chrononsSum"),
      tiles: wallet("tilesSum"),
    };

    const tileHistogram = Array.from({ length: cfg.puzzleTiles + 1 }, (_, k) =>
      describe(runs.map((run) => run.testers.filter((x) => x.tiles === k).length)));
    const stakeAttempts = RULES.wheelStakes.map((s) => ({
      stake: s,
      attempts: describe(runs.map((run) => run.totals.attemptsByStake[s])).mean,
      energy: describe(runs.map((run) => run.totals.energyByStake[s])).mean,
    }));

    const result = {
      errors: [], cfg, replications: runs.length, metrics, dailyOut, tileHistogram, stakeAttempts,
      jerusalemCompletionDayMedian: completionDays, puzzleCompletionDayMedian: puzzleDays,
      wheel: wheelSummary(cfg), puzzle: puzzleSummary(cfg),
    };
    result.flags = computeFlags(result);
    return result;
  }

  /** Inflation and bottleneck signals. Each is a model output, not an observation. */
  function computeFlags(res) {
    const { cfg, metrics: m } = res;
    const flags = [];
    const n = cfg.enrolledTesters;
    const mean = (key, basis = "total") => m[key][basis].mean;
    const completed = mean("testersCompletedJerusalem");
    const hasNextJourney = cfg.additionalJourneyChronons != null;
    const idleShare = mean("activeTesterDays") ? mean("energyIdleTesterDays") / mean("activeTesterDays") : 0;

    if (completed > 0 && !hasNextJourney) {
      flags.push({
        level: idleShare > 0.25 ? "serious" : "warning",
        title: "Progression runs out after Jerusalem",
        body: `${fmt(completed, 1)} of ${n} testers finish the 1,500 PP journey, half of them by about day ` +
          `${fmt(res.jerusalemCompletionDayMedian.mean, 0)}. With no additional journey priced, ${pct(idleShare)} of active days ` +
          `leave Energy with nothing to buy. Average balance at the end: ${fmt(mean("energyBalance", "perActive"), 0)} Energy per active tester.`,
      });
    }
    if (mean("chrononsEarned") > 0 && !hasNextJourney) {
      flags.push({
        level: "warning",
        title: "Chronons have no sink",
        body: `Testers earn ${fmt(mean("chrononsEarned", "perActive"), 1)} Chronons per active tester and spend none, because no ` +
          "additional journey price is set. The balance only grows.",
      });
    }
    const supply = missionCount(cfg);
    const pz = res.puzzle;
    const bestTier = pz.tiers.filter((x) => x.set && (cfg[mixKey(x.tier)] || 0) > 0)
      .reduce((best, x) => Math.max(best, x.pieces), 0);
    if (supply * bestTier < pz.piecesForPuzzle) {
      flags.push({
        level: "serious",
        title: "The first puzzle cannot be completed",
        body: `Each tester can complete at most ${supply} mission${supply === 1 ? "" : "s"}, worth up to ${fmt(supply * bestTier, 0)} pieces. ` +
          `The puzzle needs ${pz.piecesForPuzzle}. The ${cfg.puzzleCompletionEnergy} Energy bonus is unreachable.`,
      });
    }
    const stranded = mean("testersStrandedPieces") + mean("testersPiecesAfterPuzzle");
    if (stranded >= 0.5) {
      flags.push({
        level: "warning",
        title: "Pieces held that cannot buy anything",
        body: `${fmt(stranded, 1)} testers end the pilot holding pieces below the ${cfg.piecesPerTile}-piece tile price or ` +
          "left over after the last tile. Check that mission rewards are multiples of the tile price.",
      });
    }
    const missionsPerActive = mean("missionsCompleted", "perActive");
    if (supply > 0 && missionsPerActive < pz.piecesForPuzzle / Math.max(bestTier, 1) / 2) {
      flags.push({
        level: "warning",
        title: "Few testers reach the puzzle bonus",
        body: `An active tester completes ${fmt(missionsPerActive, 2)} missions on average. ${fmt(mean("puzzlesCompleted"), 1)} of ${n} ` +
          `testers complete the puzzle. The funnel (discovery ${pct(cfg.discoveryRatePerActiveDay)} a day, acceptance ` +
          `${pct(cfg.acceptanceRate)}, completion ${pct(cfg.completionRate)}) is entirely hypothetical.`,
      });
    }
    const sources = mean("energyCredited") + mean("legacyBonusEnergy") + mean("puzzleBonusEnergy");
    if (sources > 0 && mean("puzzleBonusEnergy") > 0) {
      const share = mean("puzzleBonusEnergy") / sources;
      flags.push({
        level: share > 0.1 ? "warning" : "good",
        title: share > 0.1 ? "Puzzle bonus is a large Energy source" : "Puzzle bonus does not inflate Energy",
        body: `The one-time bonus is ${share < 0.001 ? "under 0.1%" : pct(share, 1)} of all Energy credited in the pilot.`,
      });
    }
    if (mean("energyLostToCap") > 0) {
      flags.push({
        level: "warning",
        title: "The bank cap discards step Energy",
        body: `${pct(mean("energyLostToCap") / mean("energyFromSteps"), 0)} of step Energy is lost at sync.`,
      });
    }
    if (mean("stepsNeverSynced") / Math.max(mean("stepsWalked"), 1) > 0.25) {
      flags.push({
        level: "warning",
        title: "Most walking never reaches the game",
        body: `${pct(mean("stepsNeverSynced") / mean("stepsWalked"), 0)} of steps fall on days without a session, ` +
          "or belong to testers who never start, and are not credited.",
      });
    }
    return flags;
  }

  function fmt(x, digits) {
    if (!Number.isFinite(x)) return "n/a";
    return x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  const pct = (x, digits = 0) => `${fmt(100 * x, digits)}%`;

  return {
    RULES, LEGACY_BONUSES, PARAMETERS, DEFAULTS, SCENARIOS, MISSION_TIERS,
    buildConfig, validateConfig, stepsToEnergy, revealTiles, wheelSummary, puzzleSummary,
    assignMissionTiers, simulateCohort, runPilot, computeFlags, describe, mulberry32, seedFor,
  };
});
