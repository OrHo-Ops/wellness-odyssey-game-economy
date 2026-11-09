/* Wellness Odyssey: Full Economy V2 player simulation.
 *
 * Every player is SYNTHETIC. Each simulated day, in this order, for a player
 * who opens the app (an "active" day):
 *   1. Mission: at most one per day. A sponsored offer (only with a sponsor in
 *      reach) is considered first, then an organic one. Accepted missions are
 *      walked the same day; verified completion pays pieces and Chronons and
 *      adds only the EXTRA part of the route to the day's steps, so no step is
 *      counted twice. Each mission is rewarded once.
 *   2. Sync: 10 steps = 1 Energy (remainder carried), with an optional bank
 *      cap on step Energy; daily bonuses (if on) are credited above the cap.
 *      Organic Chronons and pieces are earned per N verified steps; Chronons
 *      keep accruing while no journey is active unless that approved rule is
 *      switched off (the failure scenario).
 *   3. Store and bundles: store orders credit Chronons only (pending until
 *      verified, or credited at once with clawback, or the no-clawback abuse
 *      case); bundles credit Chronons at once. Never Energy, PP or progress.
 *   4. Puzzles: whole tiles from the general piece pool, oldest available
 *      puzzle first; each puzzle's completion Energy is paid once, above the
 *      cap. Tile reveals pay nothing unless the tile-reward experiment is on.
 *   5. Journeys: with no active journey, unlock the next one in index order
 *      (a valid prerequisite order) once the player holds its price; pending
 *      PP is applied in full but never pays a price. Spin Wheel V3 tiers with
 *      all spinnable Energy; completing a journey pays its Chronon reward and
 *      sends the overshoot to pending PP. No spins without an active journey.
 *   6. Cosmetics, according to the player's spending policy.
 * Steps on days without a session are lost unless backfill is on.
 *
 * Random streams are separated (walking, missions, wheel, store, cosmetic
 * preferences), so two cohorts with the same activity profile walk exactly
 * the same steps and their difference is the behaviour being compared.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../../pilot/pilot_model.js"), require("../config/scenario_config.js"), require("./wheel_v3.js"),
      require("./projection_catalog.js"), require("../config/cosmetics_catalog.js"), require("./business.js"));
  } else root.V2Sim = factory(root.PilotModel, root.V2Config, root.V2Wheel, root.V2Projection, root.V2Cosmetics, root.V2Business);
})(typeof self !== "undefined" ? self : this, function (M, C, W, P, K, B) {
  "use strict";

  const SOURCES = Object.freeze(["walking", "completion", "organic-mission", "sponsored-mission", "store", "direct", "tile-experiment"]);
  const S_WALK = 0, S_COMP = 1, S_OMIS = 2, S_SMIS = 3, S_STORE = 4, S_DIRECT = 5, S_TILE = 6;
  const NS = SOURCES.length;
  const STREAM = { walk: 11, mission: 23, wheel: 37, store: 41, prefs: 53 };
  const STAGES = Object.freeze([[2, 10], [11, 25], [26, 50], [51, 75], [76, 100]]);

  // Random numbers: the V1 generators (mulberry32, seedFor) and the V1 step
  // model (lognormal between players, gamma day to day), re-implemented here
  // because pilot_model.js does not export its gamma sampler.
  function normal(rng) {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }
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
  const dailySteps = (rng, mean, cv) => (cv <= 0 ? Math.round(mean) : Math.round(gamma(rng, 1 / (cv * cv), mean * cv * cv)));
  const rngFor = (seed, player, stream) => M.mulberry32(M.seedFor(M.seedFor(seed, player), stream));

  function rateOf(per1000) {
    const s = P.rateSlots(per1000);
    return s.amount ? { amount: s.amount.v, per: s.perSteps.v } : null;
  }

  /** Everything a run needs from a scenario, computed once. */
  function prepare(cfg) {
    const errors = C.validateScenario(cfg);
    if (errors.length) throw new Error(`Invalid scenario:\n${errors.join("\n")}`);
    const projection = P.buildProjection(cfg);
    const n = projection.journeys.length;
    const tiers = W.TIERS.slice().sort((a, b) => a.stake - b.stake);
    const weights = tiers.map((t) => Math.max(0, Number(cfg.tierMix[t.stake]) || 0));
    const cum = [];
    weights.reduce((s, w, i) => (cum[i] = s + w), 0);
    const spinStakes = tiers.filter((t, i) => weights[i] > 0).map((t) => t.stake);
    const weeklyOrganic = C.weeklyOrganicReference(cfg, cfg.priceCalibrationOrganicPer1000);
    const missionRef = { pieces: C.linked("missionPieces"), chronons: C.linked("missionChronons") };
    return {
      cfg, projection, n,
      pp: projection.journeys.map((j) => j.pp),
      price: projection.journeys.map((j) => j.price || 0),
      reward: projection.journeys.map((j) => j.completionReward),
      puzzleAt: (() => {
        const a = new Array(n).fill(null);
        for (const pz of projection.puzzles) a[pz.journey - 1] = cfg.puzzleBonusOff ? { ...pz, completionEnergy: 0 } : pz;
        return a;
      })(),
      tiers, cum, minSpin: Math.min(...spinStakes),
      cosmetics: K.ITEMS.map((it) => ({ id: it.id, rarity: it.rarity, set: it.set, price: K.priceOf(it, cfg.rarityWeeks, weeklyOrganic) })),
      orgChr: rateOf(cfg.organicChrononsPer1000),
      orgPcs: rateOf(cfg.organicPiecesPer1000),
      sponsoredReward: missionRef,
      organicReward: { pieces: Math.round(missionRef.pieces * cfg.organicMissionRewardShare), chronons: Math.round(missionRef.chronons * cfg.organicMissionRewardShare) },
      routeExtra: Math.round(C.linked("missionKm") * C.linked("stepsPerKm") * cfg.incrementalWalkShare),
      bonuses: M.LEGACY_BONUSES,
    };
  }

  /** One synthetic player over the horizon. `cohort` is a cohort key or a
   * cohort object (see scenario_config COHORTS). */
  function simulatePlayer(prep, cohort, playerIndex) {
    const cfg = prep.cfg, n = prep.n, H = cfg.horizonDays;
    const co = typeof cohort === "string" ? C.COHORTS[cohort] : cohort;
    if (!co) throw new Error(`Unknown cohort: ${cohort}`);
    const act = typeof co.activity === "string" ? C.ACTIVITY[co.activity] : co.activity; // an object in tests
    const acceptance = typeof co.missions === "number" ? co.missions : C.MISSION_PATTERNS[co.missions];
    const buy = typeof co.purchases === "string" ? C.PURCHASE_PATTERNS[co.purchases] : co.purchases;
    const policy = typeof co.cosmetics === "string" ? C.COSMETIC_POLICIES[co.cosmetics] : co.cosmetics;
    const rWalk = rngFor(cfg.seed, playerIndex, STREAM.walk), rMis = rngFor(cfg.seed, playerIndex, STREAM.mission);
    const rWheel = rngFor(cfg.seed, playerIndex, STREAM.wheel), rStore = rngFor(cfg.seed, playerIndex, STREAM.store);
    const rPref = rngFor(cfg.seed, playerIndex, STREAM.prefs);

    const sigma = Math.sqrt(Math.log(1 + cfg.betweenPlayerStepCv ** 2));
    const meanSteps = act.medianDailySteps * Math.exp(sigma * normal(rWalk));
    const cap = cfg.energyCap, spe = C.linked("stepsPerEnergy"), ev = cfg.wheelMode === "ev";
    const pRefund = W.P_REFUND;
    const missionRate = cfg.missionRatePerActiveDay;
    const useRate = missionRate != null && co.missions !== "none"; // the exact-frequency override applies to mission players only
    const missionsOn = useRate ? missionRate > 0 : acceptance > 0;
    const affiliatePerActiveDay = buy.affiliatePer30Days > 0 ? Math.min(1, buy.affiliatePer30Days / 30 / act.activeDayRate) : 0;
    const bundle = buy.bundle ? { chronons: C.bundleChronons(cfg, buy.bundle), price: C.BUNDLES[buy.bundle].price } : null;

    // Cosmetic wish list: a random order (collectors: by set, cheapest first).
    let wish = [];
    if (policy.kind !== "none") {
      wish = prep.cosmetics.filter((it) => policy.rarities.includes(it.rarity));
      if (policy.setsFirst) wish.sort((a, b) => (a.set === null) - (b.set === null) || String(a.set).localeCompare(String(b.set)) || a.price - b.price || a.id.localeCompare(b.id));
      else for (let i = wish.length - 1; i > 0; i--) { const j = Math.floor(rPref() * (i + 1)); [wish[i], wish[j]] = [wish[j], wish[i]]; }
    }
    const envShare = policy.kind === "envelope" ? policy.share : 0;
    const envPaidShare = policy.kind === "envelope" ? (policy.paidShare !== undefined ? policy.paidShare : policy.share) : 0;

    // State
    let energy = 0, stepCarry = 0, chrCarry = 0, pcsCarry = 0, backlog = 0;
    let chronons = 0, envelope = 0, debt = 0;
    const comp = new Float64Array(NS), earned = new Float64Array(NS), spentJ = new Float64Array(NS), spentC = new Float64Array(NS);
    let journey = 0, next = 1, prog = 0, pendingPP = 0, completed = 0;
    const unlockDay = new Int16Array(n).fill(-1), completeDay = new Int16Array(n).fill(-1);
    unlockDay[0] = 0;
    const puzzles = [], pzState = [];
    const addPuzzle = (pz) => { if (pz) { puzzles.push(pz); pzState.push({ tiles: 0, paid: false }); } };
    addPuzzle(prep.puzzleAt[0]);
    let pzHead = 0, pieces = 0;
    const storePending = [], clawQueue = [];
    let nextBundleDay = 0, wishPtr = 0;
    const weeks = Math.ceil(H / 7);
    const wkChronons = new Float32Array(weeks), wkEnergy = new Float32Array(weeks), wkDone = new Uint8Array(weeks), wkWaiting = new Uint8Array(weeks);

    const s = { // tallies
      stepsWalked: 0, stepsLost: 0, stepsSynced: 0, routeSteps: 0, activeDays: 0, simDays: 0, waitingActiveDays: 0, activeDaysInTour: 0,
      eSteps: 0, eLostCap: 0, eBonus: 0, ePuzzle: 0, eCharged: 0, eRefunded: 0, eWhileWaiting: 0, eLostCapWaiting: 0,
      spins: 0, ppEarned: 0, overshoot: 0, ppDiscarded: 0,
      missionsOffered: 0, missionsAccepted: 0, organicMissions: 0, sponsoredMissions: 0, missionsAbandoned: 0,
      piecesEarned: 0, piecesSpent: 0, tilesRevealed: 0, puzzlesCompleted: 0, firstPuzzleDay: -1,
      orders: 0, refunds: 0, gmv: 0, eligible: 0, commission: 0, storeChrononsGranted: 0, storeChrononsLeaked: 0, clawedFromBalance: 0,
      debtCreated: 0, debtRepaid: 0, bundles: 0, bundleSpend: 0, bundleNet: 0,
      cosmeticsOwned: 0, cosmeticSpend: 0, tradeoffDays: 0, cosmeticsByRarity: { common: 0, rare: 0, epic: 0, legendary: 0 },
      deadlocked: false,
    };

    const credit = (src, amt) => {
      if (!(amt > 0)) return;
      earned[src] += amt;
      let a = amt;
      if (debt > 0) { const pay = Math.min(debt, a); debt -= pay; a -= pay; s.debtRepaid += pay; }
      if (a <= 0) return;
      comp[src] += a; chronons += a;
      if (envShare > 0 && wishPtr < wish.length) envelope += a * (src === S_STORE || src === S_DIRECT ? envPaidShare : envShare); // nothing left to buy: nothing reserved
    };
    const spend = (amt, sink) => {
      const f = amt / chronons;
      for (let k = 0; k < NS; k++) { const x = comp[k] * f; comp[k] -= x; sink[k] += x; }
      chronons -= amt;
      if (chronons < 1e-9) { chronons = Math.max(0, chronons); }
      if (envelope > chronons) envelope = chronons;
    };
    const tourDone = () => next >= n && journey < 0;
    const buyCosmetics = (d) => {
      while (wishPtr < wish.length) {
        const it = wish[wishPtr];
        let ok;
        if (tourDone()) ok = chronons >= it.price;
        else if (policy.kind === "envelope") ok = envelope + 1e-9 >= it.price && chronons + 1e-9 >= it.price;
        else if (policy.kind === "progression-first") ok = journey >= 0 && chronons - it.price + 1e-9 >= prep.price[next] ;
        else ok = chronons + 1e-9 >= it.price; // cosmetics-first
        if (!ok) break;
        spend(it.price, spentC);
        envelope = Math.max(0, envelope - it.price);
        s.cosmeticsOwned++; s.cosmeticSpend += it.price; s.cosmeticsByRarity[it.rarity]++; wishPtr++;
        if (wishPtr >= wish.length) envelope = 0; // catalog complete: the reserve returns to journeys
      }
    };
    const reveal = (d) => {
      while (pzHead < puzzles.length) {
        const pz = puzzles[pzHead], st = pzState[pzHead];
        while (pieces >= pz.piecesPerTile && st.tiles < pz.tiles) {
          pieces -= pz.piecesPerTile; st.tiles++; s.tilesRevealed++; s.piecesSpent += pz.piecesPerTile;
          if (cfg.tileRevealChronons > 0) credit(S_TILE, cfg.tileRevealChronons);
        }
        if (st.tiles >= pz.tiles) {
          if (!st.paid) { st.paid = true; energy += pz.completionEnergy; s.ePuzzle += pz.completionEnergy; s.puzzlesCompleted++; if (s.firstPuzzleDay < 0) s.firstPuzzleDay = d; }
          pzHead++;
          continue;
        }
        break;
      }
    };

    let d = 0;
    for (; d < H; d++) {
      const walked = dailySteps(rWalk, meanSteps, cfg.dayToDayStepCv);
      const active = rWalk() < act.activeDayRate;
      s.simDays++;
      if (!active) {
        s.stepsWalked += walked;
        if (cfg.backfillInactiveDays) backlog += walked; else s.stepsLost += walked;
      } else {
        s.activeDays++;
        if (!tourDone()) s.activeDaysInTour++;
        // 1. Mission
        let routeSteps = 0;
        if (missionsOn) {
          let reward = null, src = -1;
          if (useRate) {
            if (rMis() < missionRate) { s.missionsOffered++; s.missionsAccepted++; reward = prep.organicReward; src = S_OMIS; }
          } else {
            if (co.sponsorInReach && rMis() < cfg.sponsoredOfferPerActiveDay) {
              s.missionsOffered++;
              if (rMis() < acceptance) { s.missionsAccepted++; reward = prep.sponsoredReward; src = S_SMIS; }
            }
            if (src < 0 && rMis() < cfg.organicOfferPerActiveDay) {
              s.missionsOffered++;
              if (rMis() < acceptance) { s.missionsAccepted++; reward = prep.organicReward; src = S_OMIS; }
            }
            if (src >= 0 && !(rMis() < cfg.missionCompletion)) { s.missionsAbandoned++; reward = null; src = -1; }
          }
          if (reward) {
            routeSteps = prep.routeExtra; s.routeSteps += routeSteps;
            pieces += reward.pieces; s.piecesEarned += reward.pieces;
            credit(src, reward.chronons);
            if (src === S_SMIS) s.sponsoredMissions++; else s.organicMissions++;
          }
        }
        // 2. Sync
        const daySteps = walked + routeSteps;
        s.stepsWalked += daySteps;
        const synced = daySteps + backlog;
        backlog = 0;
        s.stepsSynced += synced;
        const tot = synced + stepCarry, conv = Math.floor(tot / spe);
        stepCarry = tot - conv * spe;
        const credited = cap === null ? conv : Math.min(conv, Math.max(cap - energy, 0));
        energy += credited; s.eSteps += credited; s.eLostCap += conv - credited;
        const waiting = journey < 0 && next < n;
        if (waiting) { s.eWhileWaiting += credited; s.eLostCapWaiting += conv - credited; }
        if (cfg.dailyBonuses) {
          let bonus = daySteps >= prep.bonuses.goalSteps ? prep.bonuses.goalEnergy : 0;
          for (const m of prep.bonuses.milestones) if (daySteps >= m.at) bonus += m.energy;
          energy += bonus; s.eBonus += bonus;
        }
        if (prep.orgChr && (!waiting || cfg.accrueWhileWaiting)) {
          const t2 = synced + chrCarry, blocks = Math.floor(t2 / prep.orgChr.per);
          chrCarry = t2 - blocks * prep.orgChr.per;
          credit(S_WALK, blocks * prep.orgChr.amount);
        }
        if (prep.orgPcs) {
          const t3 = synced + pcsCarry, blocks = Math.floor(t3 / prep.orgPcs.per);
          pcsCarry = t3 - blocks * prep.orgPcs.per;
          pieces += blocks * prep.orgPcs.amount; s.piecesEarned += blocks * prep.orgPcs.amount;
        }
        // 3. Store and bundles
        if (affiliatePerActiveDay > 0 && rStore() < affiliatePerActiveDay) {
          const price = Math.min(500, Math.max(5, cfg.productPriceMedian * Math.exp(cfg.productPriceSigma * normal(rStore))));
          const ch = B.orderChronons(cfg, price);
          const refunded = rStore() < cfg.refundRate;
          const refundDay = d + 1 + Math.floor(rStore() * Math.max(cfg.verificationDays, 1));
          s.orders++; s.gmv += price; s.eligible += price * cfg.eligibleShare;
          if (refunded) s.refunds++; else s.commission += price * cfg.eligibleShare * cfg.affiliateCommission;
          if (cfg.clawbackPolicy === "pending") { if (!refunded && ch > 0) storePending.push(d + cfg.verificationDays, ch); }
          else {
            credit(S_STORE, ch); s.storeChrononsGranted += ch;
            if (refunded) { if (cfg.clawbackPolicy === "clawback") clawQueue.push(refundDay, ch); else s.storeChrononsLeaked += ch; }
          }
        }
        for (let q = 0; q < storePending.length; ) {
          if (storePending[q] <= d) { credit(S_STORE, storePending[q + 1]); s.storeChrononsGranted += storePending[q + 1]; storePending.splice(q, 2); } else q += 2;
        }
        for (let q = 0; q < clawQueue.length; ) {
          if (clawQueue[q] <= d) {
            const ch = clawQueue[q + 1], take = Math.min(comp[S_STORE], ch);
            comp[S_STORE] -= take; chronons -= take; s.clawedFromBalance += take;
            debt += ch - take; s.debtCreated += ch - take; s.storeChrononsGranted -= ch;
            if (envelope > chronons) envelope = Math.max(0, chronons);
            clawQueue.splice(q, 2);
          } else q += 2;
        }
        if (bundle && d >= nextBundleDay) {
          credit(S_DIRECT, bundle.chronons); s.bundles++; s.bundleSpend += bundle.price; s.bundleNet += B.bundleNet(cfg, buy.bundle);
          nextBundleDay = d + buy.bundleEveryDays;
        }
        // 4. Puzzles
        reveal(d);
        // 5. Journeys and spins
        if (policy.kind === "cosmetics-first" && !tourDone()) buyCosmetics(d);
        if (policy.kind !== "none" && !tourDone() && journey < 0 && wishPtr < wish.length) {
          const it = wish[wishPtr], pr = prep.price[next];
          if (chronons >= pr && chronons >= it.price && chronons < pr + it.price) s.tradeoffDays++;
        }
        const startedBlocked = journey < 0 && next < n;
        let unlockedToday = false;
        for (;;) {
          if (journey < 0) {
            if (next >= n) break;
            if (chronons - envelope + 1e-9 < prep.price[next]) break;
            spend(prep.price[next], spentJ);
            journey = next; next++; unlockDay[journey] = d; unlockedToday = true;
            if (journey > 0) addPuzzle(prep.puzzleAt[journey]);
            if (cfg.pendingPpApplication === "full") prog = pendingPP; else { s.ppDiscarded += pendingPP; prog = 0; }
            pendingPP = 0;
          }
          const need = prep.pp[journey];
          while (prog < need && energy >= prep.minSpin) {
            let k = prep.tiers.length - 1;
            while (k > 0 && prep.tiers[k].stake > energy) k--;
            if (!(prep.cum[k] > 0)) break;
            const u = rWheel() * prep.cum[k];
            let j = 0;
            while (prep.cum[j] <= u) j++;
            const tier = prep.tiers[j];
            energy -= tier.stake; s.eCharged += tier.stake; s.spins++;
            if (ev) {
              prog += tier.expectedPp; s.ppEarned += tier.expectedPp;
              if (rWheel() < pRefund) { energy += tier.stake; s.eRefunded += tier.stake; }
            } else {
              const row = W.sample(rWheel, tier);
              if (row.refund) { energy += tier.stake; s.eRefunded += tier.stake; } else { prog += row.pp; s.ppEarned += row.pp; }
            }
          }
          if (prog >= need) {
            completeDay[journey] = d; completed++;
            pendingPP += prog - need; s.overshoot += prog - need; prog = 0;
            credit(S_COMP, prep.reward[journey]);
            journey = -1;
            continue;
          }
          break;
        }
        // 6. Cosmetics
        if (policy.kind !== "none" && (policy.kind !== "cosmetics-first" || tourDone())) buyCosmetics(d);
        if (startedBlocked && !unlockedToday) s.waitingActiveDays++; // a fully blocked session: no journey to play, none affordable
      }
      if (d % 7 === 6) { const w = (d - 6) / 7; wkChronons[w] = chronons - debt; wkEnergy[w] = energy; wkDone[w] = completed; wkWaiting[w] = journey < 0 && next < n ? 1 : 0; }
      if (tourDone() && (policy.kind === "none" || wishPtr >= wish.length)) { d++; break; }
    }
    // Weeks after an early finish carry the final state forward.
    for (let w = Math.floor(d / 7); w < weeks; w++) { wkChronons[w] = chronons - debt; wkEnergy[w] = energy; wkDone[w] = completed; wkWaiting[w] = 0; }
    const canEarnWhileWaiting = cfg.accrueWhileWaiting || missionsOn || affiliatePerActiveDay > 0 || !!bundle || cfg.tileRevealChronons > 0;
    s.deadlocked = journey < 0 && next < n && !canEarnWhileWaiting;
    return {
      cohort: co, meanSteps, unlockDay, completeDay, completed,
      energy, chronons, debt, envelope, pieces, pendingPP, prog, stepCarry, backlog, activeJourney: journey, nextJourney: next,
      earned, spentJ, spentC, comp, storePendingCount: storePending.length / 2, s,
      weekly: { chronons: wkChronons, energy: wkEnergy, done: wkDone, waiting: wkWaiting },
    };
  }

  // ------------------------------------------------------------------------
  // Aggregation
  // ------------------------------------------------------------------------

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    if (!Number.isFinite(sorted[lo]) || !Number.isFinite(sorted[hi])) return sorted[hi] === Infinity || sorted[lo] === Infinity ? Infinity : NaN;
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function describe(values) {
    const v = values.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
    const finite = v.filter(Number.isFinite);
    return {
      n: v.length, p10: quantile(v, 0.1), p50: quantile(v, 0.5), p90: quantile(v, 0.9),
      meanFinite: finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : NaN,
      finiteShare: v.length ? finite.length / v.length : NaN,
    };
  }

  const CHECKPOINTS = Object.freeze([90, 180, 365, 730, 1095, 1460, 1825, 2190]);

  /** Run `cfg.playersPerCohort` players of one cohort and summarise them. */
  function runCohort(prep, cohort, opts = {}) {
    const cfg = prep.cfg, n = prep.n, H = cfg.horizonDays;
    const players = opts.players || cfg.playersPerCohort;
    const runs = [];
    for (let i = 0; i < players; i++) runs.push(simulatePlayer(prep, cohort, (opts.playerOffset || 0) + i));
    return summarise(prep, runs, cohort);
  }

  function summarise(prep, runs, cohort) {
    const cfg = prep.cfg, n = prep.n, H = cfg.horizonDays, players = runs.length;
    const co = typeof cohort === "string" ? C.COHORTS[cohort] : cohort;
    const daysTo = [], wait = [], reached = [];
    for (let k = 0; k < n; k++) {
      daysTo.push(describe(runs.map((r) => (r.completeDay[k] >= 0 ? r.completeDay[k] + 1 : Infinity))));
      reached.push(runs.filter((r) => r.completeDay[k] >= 0).length / players);
      if (k === 0) { wait.push(null); continue; }
      const w = runs.filter((r) => r.completeDay[k - 1] >= 0).map((r) => (r.unlockDay[k] >= 0 ? r.unlockDay[k] - r.completeDay[k - 1] : Infinity));
      wait.push(describe(w));
    }
    const stageWait = STAGES.map(([a, b]) => {
      const vals = [];
      for (const r of runs) for (let k = a - 1; k <= b - 1; k++) if (r.completeDay[k - 1] >= 0) vals.push(r.unlockDay[k] >= 0 ? r.unlockDay[k] - r.completeDay[k - 1] : Infinity);
      const dsc = describe(vals);
      return { stage: `${a}-${b}`, from: a, to: b, ...dsc, waitingShare: vals.length ? vals.filter((x) => x >= 1).length / vals.length : NaN };
    });
    const onset = describe(runs.map((r) => {
      for (let k = 1; k < n; k++) {
        if (r.completeDay[k - 1] < 0) return Infinity;
        if (r.unlockDay[k] < 0 || r.unlockDay[k] - r.completeDay[k - 1] >= 1) return k + 1;
      }
      return Infinity;
    }));
    const journeysBy = CHECKPOINTS.filter((c) => c <= H).map((c) => ({ day: c, ...describe(runs.map((r) => { let x = 0; for (let k = 0; k < n; k++) if (r.completeDay[k] >= 0 && r.completeDay[k] < c) x++; return x; })) }));
    const sum = (f) => runs.reduce((a, r) => a + f(r), 0);
    const mean = (f) => sum(f) / players;
    const earned = SOURCES.map((_, k) => mean((r) => r.earned[k]));
    const earnedTotal = earned.reduce((a, b) => a + b, 0);
    const spentJ = SOURCES.map((_, k) => mean((r) => r.spentJ[k]));
    const spentJTotal = spentJ.reduce((a, b) => a + b, 0);
    const spentC = SOURCES.map((_, k) => mean((r) => r.spentC[k]));
    const tally = (key) => sum((r) => r.s[key]);
    const eIn = tally("eSteps") + tally("eBonus") + tally("ePuzzle");
    const weeks = Math.ceil(H / 7);
    const weekly = (key) => Array.from({ length: weeks }, (_, w) => describe(runs.map((r) => r.weekly[key][w])));
    return {
      cohort: typeof cohort === "string" ? cohort : "custom", label: co.label, players, horizonDays: H,
      reached, daysTo, wait, stageWait, onset, journeysBy,
      tourCompleteShare: reached[n - 1],
      daysToTour: daysTo[n - 1],
      waitingShareOfActiveDays: tally("waitingActiveDays") / Math.max(tally("activeDaysInTour"), 1),
      chronons: {
        sources: SOURCES, earnedPerPlayer: earned, earnedTotal,
        earnedShare: earned.map((x) => (earnedTotal > 0 ? x / earnedTotal : 0)),
        spentOnJourneysPerPlayer: spentJ, spentOnJourneysTotal: spentJTotal,
        journeyFundingShare: spentJ.map((x) => (spentJTotal > 0 ? x / spentJTotal : 0)),
        spentOnCosmeticsPerPlayer: spentC, spentOnCosmeticsTotal: spentC.reduce((a, b) => a + b, 0),
        balancePerPlayer: mean((r) => r.chronons - r.debt),
        earnedPerSimYear: (earnedTotal * players) / Math.max(tally("simDays") / 365, 1e-9),
      },
      energy: {
        inPerPlayer: eIn / players, stepsShare: tally("eSteps") / Math.max(eIn, 1), bonusShare: tally("eBonus") / Math.max(eIn, 1),
        puzzleShare: tally("ePuzzle") / Math.max(eIn, 1), lostToCapShare: tally("eLostCap") / Math.max(tally("eSteps") + tally("eLostCap"), 1),
        whileWaitingShare: tally("eWhileWaiting") / Math.max(tally("eSteps"), 1),
        lostToCapWhileWaitingShare: tally("eLostCapWaiting") / Math.max(tally("eSteps") + tally("eLostCap"), 1),
        balancePerPlayer: mean((r) => r.energy),
      },
      pp: { earnedPerPlayer: tally("ppEarned") / players, puzzlePpShare: tally("ePuzzle") / Math.max(eIn, 1), discardedPerPlayer: tally("ppDiscarded") / players },
      missions: {
        perWeek: (tally("organicMissions") + tally("sponsoredMissions")) / Math.max(tally("simDays") / 7, 1e-9),
        organicPerPlayer: tally("organicMissions") / players, sponsoredPerPlayer: tally("sponsoredMissions") / players,
        abandonedPerPlayer: tally("missionsAbandoned") / players,
      },
      puzzles: {
        completedPerPlayer: tally("puzzlesCompleted") / players,
        completedPerPlayerYear: tally("puzzlesCompleted") / Math.max(tally("simDays") / 365, 1e-9),
        firstPuzzleDay: describe(runs.map((r) => (r.s.firstPuzzleDay >= 0 ? r.s.firstPuzzleDay + 1 : Infinity))),
        tilesPerPlayer: tally("tilesRevealed") / players, piecesHeldPerPlayer: mean((r) => r.pieces),
      },
      cosmetics: {
        ownedPerPlayer: tally("cosmeticsOwned") / players, spendPerPlayer: tally("cosmeticSpend") / players,
        tradeoffDaysPerPlayer: tally("tradeoffDays") / players,
      },
      business: B.summarise(cfg, {
        orders: tally("orders"), gmv: tally("gmv"), commission: tally("commission"), storeChrononsGranted: tally("storeChrononsGranted"),
        storeChrononsLeaked: tally("storeChrononsLeaked"), bundleSpend: tally("bundleSpend"), bundleNet: tally("bundleNet"),
      }, players, tally("simDays") / players / 365),
      deadlockedShare: runs.filter((r) => r.s.deadlocked).length / players,
      weekly: { chronons: weekly("chronons"), done: weekly("done"), energy: weekly("energy") },
      steps: { lostShare: tally("stepsLost") / Math.max(tally("stepsWalked"), 1), routeShare: tally("routeSteps") / Math.max(tally("stepsWalked"), 1) },
    };
  }

  return { SOURCES, STAGES, CHECKPOINTS, prepare, simulatePlayer, runCohort, summarise, describe, quantile, normal, gamma, dailySteps };
});
