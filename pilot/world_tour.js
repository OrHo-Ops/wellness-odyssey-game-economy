/* Wellness Odyssey: World Tour catalog format and validation.
 *
 * Pure functions only. Nothing here simulates a player, reads a file or
 * projects progression: it says whether a catalog is well formed and which of
 * its values are still unset. A catalog describes:
 *
 *     geography     regions, cities and monuments, shared by every era
 *     eras          played in order; each opens once the previous one is complete
 *     journeys      belong to one era and one city; unlocked by prerequisites
 *                   and a Chronon price, except an era's free start journeys
 *     puzzles       one per monument, revealed from a general pool of pieces
 *     collections   city-level sets of puzzles with an optional reward
 *     organic       walking-based earning rules, per N verified steps
 *
 * Every amount is a value slot:
 *
 *     null          unset: no decision yet. Never read as zero
 *     { v, s }      a literal value labelled "proposed" or "hypothetical"
 *     { ref }       a link to a constant in pilot_model.js. The only way a
 *                   catalog holds a verified value, and the only way it holds
 *                   the existing Jaffa Gate puzzle settings
 *
 * A literal can never be labelled "verified". A catalog holds no Wheel figures;
 * progression projections are a separate, later layer.
 *
 * Runs under Node (require) and in the browser after pilot_model.js
 * (window.WorldTour).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./pilot_model.js"));
  else if (root.PilotModel) root.WorldTour = factory(root.PilotModel);
  else throw new Error("Load pilot_model.js before world_tour.js.");
})(typeof self !== "undefined" ? self : this, function (PilotModel) {
  "use strict";

  /** The approved design baseline for progression. Proposed: not yet in any
   * build. Fixed here rather than per catalog, so a catalog cannot change it. */
  const PROGRESSION_RULES = Object.freeze({
    unlock: "prerequisites",           // eligible once every required journey is complete
    choice: "eligible-and-affordable", // the player chooses among eligible journeys they can pay for
    ppOverflow: "pending",             // PP beyond a journey's requirement is kept in a pending balance
    pendingPpPaysPrice: false,         // pending PP never stands in for a Chronon price
    ppWithoutActiveJourney: false,     // no new PP is generated while no journey is active
    eraCompletion: "all",              // every journey of an era, before the next era opens
  });

  const CATALOG_STATUSES = ["pilot-illustrative", "test-fixture"];
  const ERA_STATUSES = ["illustrative", "roadmap"]; // a roadmap era may have no journeys yet
  const LITERAL_LABELS = ["proposed", "hypothetical"];
  const REWARD_KEYS = ["chronons", "pieces", "energy"];
  const ORGANIC_CURRENCIES = ["chronons", "pieces"];
  const WALKING_BASES = ["verifiedSteps"];
  /** Earning-rule keys reserved for safeguards that are not implemented yet: a
   * cap per period, and a guard so each physical step is credited only once.
   * Reserving them now means adding them later needs no change to the format. */
  const RESERVED_RULE_KEYS = ["periodCap", "stepDeduplication"];
  const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  const paramStatus = (key) => PilotModel.PARAMETERS.find((x) => x.key === key).status;
  const link = (at, value, status) => Object.freeze({ at, value, status });

  /** The only model constants a catalog may link to, each at exactly one slot,
   * and each of those slots must use its link. */
  const LINKS = Object.freeze({
    "RULES.jerusalemJourneyPp": link("journeys.jerusalem.pp", PilotModel.RULES.jerusalemJourneyPp, "verified"),
    "DEFAULTS.puzzleTiles": link("puzzles.jaffa-gate.tiles", PilotModel.DEFAULTS.puzzleTiles, paramStatus("puzzleTiles")),
    "DEFAULTS.piecesPerTile": link("puzzles.jaffa-gate.piecesPerTile", PilotModel.DEFAULTS.piecesPerTile,
      paramStatus("piecesPerTile")),
    "DEFAULTS.puzzleCompletionEnergy": link("puzzles.jaffa-gate.onComplete.energy", PilotModel.DEFAULTS.puzzleCompletionEnergy,
      paramStatus("puzzleCompletionEnergy")),
  });

  const KINDS = {
    positive: { test: (v) => Number.isInteger(v) && v > 0, text: "a whole number above 0" },
    nonNegative: { test: (v) => Number.isInteger(v) && v >= 0, text: "a whole number, 0 or more" },
  };

  const SHAPES = {
    catalog: { required: ["id", "label", "status", "organic", "eras", "regions", "cities", "monuments", "journeys", "puzzles",
      "collections"] },
    region: { required: ["id", "label"] },
    city: { required: ["id", "label", "region"] },
    monument: { required: ["id", "label", "city"] },
    era: { required: ["id", "label", "playOrder", "status", "startJourneys", "completion", "next"], optional: ["transitionReward"] },
    journey: { required: ["id", "label", "era", "city", "pp", "requires", "onComplete"], optional: ["price"] },
    puzzle: { required: ["id", "label", "monument", "tiles", "piecesPerTile", "onComplete", "availableWhen"] },
    collection: { required: ["id", "label", "city", "puzzles", "reward"] },
  };
  const LISTS = [["regions", "region"], ["cities", "city"], ["monuments", "monument"], ["eras", "era"], ["journeys", "journey"],
    ["puzzles", "puzzle"], ["collections", "collection"]];

  const isObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const show = (v) => (typeof v === "string" ? `"${v}"` : String(v));

  function checkKeys(obj, shape, where, errors) {
    const allowed = [...shape.required, ...(shape.optional || [])];
    for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${where}: unknown key "${k}".`);
    for (const k of shape.required) if (!(k in obj)) errors.push(`${where}: missing "${k}".`);
  }

  function checkUnique(list, where, what, errors) {
    const seen = new Set();
    for (const id of list) {
      if (seen.has(id)) errors.push(`${where}: ${what} "${id}" is listed twice.`);
      seen.add(id);
    }
  }

  // ------------------------------------------------------------------------
  // Structure
  // ------------------------------------------------------------------------

  /** Shape, ids, references, prerequisites and the era chain. */
  function validateStructure(catalog) {
    const errors = [], warnings = [];
    if (!isObject(catalog)) return { errors: ["The catalog must be an object."], warnings };
    checkKeys(catalog, SHAPES.catalog, "catalog", errors);
    if ("status" in catalog && !CATALOG_STATUSES.includes(catalog.status)) {
      errors.push(`catalog.status must be one of ${CATALOG_STATUSES.join(", ")}.`);
    }
    const idx = indexLists(catalog, errors);
    const ref = (map, id, where, what) => {
      if (map.has(id)) return map.get(id);
      errors.push(`${where}: unknown ${what} ${show(id)}.`);
      return null;
    };

    for (const city of idx.cities.values()) ref(idx.regions, city.region, `cities.${city.id}`, "region");
    for (const m of idx.monuments.values()) ref(idx.cities, m.city, `monuments.${m.id}`, "city");
    checkEras(idx, errors);
    checkJourneys(idx, ref, errors);
    checkPuzzles(idx, ref, errors, warnings);
    checkCollections(idx, ref, errors);
    checkOrganic(catalog.organic, errors);
    return { errors, warnings };
  }

  function indexLists(catalog, errors) {
    const idx = {};
    for (const [list, kind] of LISTS) {
      idx[list] = new Map();
      const items = catalog[list];
      if (!Array.isArray(items)) {
        if (list in catalog) errors.push(`catalog.${list} must be a list.`);
        continue;
      }
      items.forEach((item, i) => {
        if (!isObject(item)) {
          errors.push(`${list}[${i}] must be an object.`);
          return;
        }
        const where = `${list}.${typeof item.id === "string" ? item.id : `[${i}]`}`;
        if (typeof item.id !== "string" || !ID.test(item.id)) errors.push(`${where}: id must be lower-case words joined by hyphens.`);
        else if (idx[list].has(item.id)) errors.push(`${where}: duplicate id.`);
        else idx[list].set(item.id, item);
        checkKeys(item, SHAPES[kind], where, errors);
        if ("label" in item && (typeof item.label !== "string" || !item.label.trim())) errors.push(`${where}: label must be text.`);
      });
    }
    return idx;
  }

  function checkEras(idx, errors) {
    const eras = [...idx.eras.values()];
    if (eras.length === 0) {
      errors.push("catalog.eras: at least one era is needed.");
      return;
    }
    const orders = new Map();
    for (const era of eras) {
      const where = `eras.${era.id}`;
      if (!Number.isInteger(era.playOrder) || era.playOrder < 1) errors.push(`${where}: playOrder must be a whole number from 1.`);
      else if (orders.has(era.playOrder)) errors.push(`${where}: playOrder ${era.playOrder} is also used by ${orders.get(era.playOrder).id}.`);
      else orders.set(era.playOrder, era);
      if ("status" in era && !ERA_STATUSES.includes(era.status)) errors.push(`${where}: status must be one of ${ERA_STATUSES.join(", ")}.`);
      if ("completion" in era && era.completion !== "all") {
        errors.push(`${where}: completion must be "all". Every journey of an era completes before the next era opens.`);
      }
      if (Array.isArray(era.startJourneys)) {
        checkUnique(era.startJourneys, where, "start journey", errors);
        for (const id of era.startJourneys) {
          const j = idx.journeys.get(id);
          if (!j) errors.push(`${where}: unknown start journey ${show(id)}.`);
          else if (j.era !== era.id) errors.push(`${where}: start journey "${id}" belongs to another era.`);
        }
      } else if ("startJourneys" in era) errors.push(`${where}: startJourneys must be a list.`);

      const hasNext = era.next !== null && era.next !== undefined;
      if (hasNext) {
        const next = idx.eras.get(era.next);
        if (!next) errors.push(`${where}: unknown next era ${show(era.next)}.`);
        else if (!(next.playOrder > era.playOrder)) errors.push(`${where}: next era "${era.next}" must come later in play order.`);
      }
      if (hasNext && !("transitionReward" in era)) errors.push(`${where}: missing "transitionReward" (null while undecided).`);
      if (!hasNext && "transitionReward" in era) errors.push(`${where}: transitionReward needs a next era.`);

      const journeys = [...idx.journeys.values()].filter((j) => j.era === era.id).length;
      if (journeys === 0 && era.status !== "roadmap") errors.push(`${where}: an era that is not on the roadmap needs at least one journey.`);
    }

    const first = orders.get(Math.min(...orders.keys()));
    if (!first) return;
    const starts = first.startJourneys;
    if (!(Array.isArray(starts) && starts.length === 1 && starts[0] === "jerusalem")) {
      errors.push(`eras.${first.id}: the first era starts with Jerusalem alone (startJourneys: ["jerusalem"]).`);
    }
    const reached = new Set();
    for (let era = first; era && !reached.has(era.id); ) {
      reached.add(era.id);
      const next = idx.eras.get(era.next);
      era = next && next.playOrder > era.playOrder ? next : null;
    }
    for (const era of eras) if (!reached.has(era.id)) errors.push(`eras.${era.id}: not reached from the first era through "next".`);
  }

  function checkJourneys(idx, ref, errors) {
    const isStart = (j) => {
      const era = idx.eras.get(j.era);
      return !!era && Array.isArray(era.startJourneys) && era.startJourneys.includes(j.id);
    };
    for (const j of idx.journeys.values()) {
      const where = `journeys.${j.id}`;
      const era = ref(idx.eras, j.era, where, "era");
      ref(idx.cities, j.city, where, "city");
      const start = isStart(j);
      if (start && "price" in j) errors.push(`${where}: a start journey is unlocked free; remove "price".`);
      if (!start && !("price" in j)) errors.push(`${where}: missing "price" (null while unset).`);
      if (!Array.isArray(j.requires)) {
        if ("requires" in j) errors.push(`${where}: requires must be a list.`);
        continue;
      }
      if (start && j.requires.length) errors.push(`${where}: a start journey has no prerequisites.`);
      checkUnique(j.requires, where, "prerequisite", errors);
      for (const id of j.requires) {
        const req = idx.journeys.get(id);
        if (!req) errors.push(`${where}: unknown prerequisite ${show(id)}.`);
        else if (era && req.era !== j.era) {
          errors.push(`${where}: prerequisite "${id}" belongs to another era. An era is entered only by completing the previous one.`);
        }
      }
    }

    // Kahn's algorithm over known prerequisites. Whatever cannot be ordered is
    // in a cycle or depends on one. Start journeys have no prerequisites (an
    // error above when they do), so their edges are left out.
    const remaining = new Map();
    const dependents = new Map();
    for (const j of idx.journeys.values()) {
      const reqs = !isStart(j) && Array.isArray(j.requires) ? [...new Set(j.requires)].filter((id) => idx.journeys.has(id)) : [];
      remaining.set(j.id, reqs.length);
      for (const id of reqs) dependents.set(id, [...(dependents.get(id) || []), j.id]);
    }
    const queue = [...remaining].filter(([, n]) => n === 0).map(([id]) => id);
    while (queue.length) {
      const id = queue.shift();
      remaining.delete(id);
      for (const d of dependents.get(id) || []) {
        remaining.set(d, remaining.get(d) - 1);
        if (remaining.get(d) === 0) queue.push(d);
      }
    }
    if (remaining.size) errors.push(`journeys: in or behind a prerequisite cycle: ${[...remaining.keys()].join(", ")}.`);
  }

  function checkPuzzles(idx, ref, errors, warnings) {
    for (const pz of idx.puzzles.values()) {
      const where = `puzzles.${pz.id}`;
      const monument = ref(idx.monuments, pz.monument, where, "monument");
      const when = pz.availableWhen;
      if (when === "start" || !("availableWhen" in pz)) continue;
      if (isObject(when) && Object.keys(when).length === 1 && typeof when.journeyUnlocked === "string") {
        const j = ref(idx.journeys, when.journeyUnlocked, where, "journey");
        if (j && monument && j.city !== monument.city) {
          warnings.push(`${where}: becomes available with "${j.id}", a journey in another city.`);
        }
      } else errors.push(`${where}: availableWhen must be "start" or { journeyUnlocked: "<journey id>" }.`);
    }
  }

  function checkCollections(idx, ref, errors) {
    for (const c of idx.collections.values()) {
      const where = `collections.${c.id}`;
      ref(idx.cities, c.city, where, "city");
      if (!Array.isArray(c.puzzles) || c.puzzles.length === 0) {
        if ("puzzles" in c) errors.push(`${where}: puzzles must be a list of at least one puzzle.`);
        continue;
      }
      checkUnique(c.puzzles, where, "puzzle", errors);
      for (const id of new Set(c.puzzles)) {
        const pz = ref(idx.puzzles, id, where, "puzzle");
        const monument = pz && idx.monuments.get(pz.monument);
        if (monument && monument.city !== c.city) errors.push(`${where}: puzzle "${id}" belongs to another city.`);
      }
    }
  }

  function checkOrganic(organic, errors) {
    if (organic === undefined) return; // reported as missing
    if (!isObject(organic)) {
      errors.push("organic must be an object.");
      return;
    }
    checkKeys(organic, { required: ORGANIC_CURRENCIES }, "organic", errors);
    for (const currency of ORGANIC_CURRENCIES) {
      const where = `organic.${currency}`;
      const rules = organic[currency];
      if (rules === undefined) continue;
      if (!isObject(rules)) {
        errors.push(`${where} must be an object of earning rules.`);
        continue;
      }
      for (const basis of Object.keys(rules)) {
        if (!WALKING_BASES.includes(basis)) {
          errors.push(`${where}: "${basis}" is not a supported basis. Organic rewards are earned from verified walking only ("verifiedSteps").`);
        }
      }
      if (!("verifiedSteps" in rules)) errors.push(`${where}: missing "verifiedSteps".`);
      const rule = rules.verifiedSteps;
      if (rule === undefined) continue;
      if (!isObject(rule)) {
        errors.push(`${where}.verifiedSteps must be { amount, perSteps }.`);
        continue;
      }
      for (const k of Object.keys(rule)) {
        if (RESERVED_RULE_KEYS.includes(k)) errors.push(`${where}.verifiedSteps: "${k}" is reserved for a future safeguard and is not implemented yet.`);
      }
      checkKeys(rule, { required: ["amount", "perSteps"], optional: RESERVED_RULE_KEYS }, `${where}.verifiedSteps`, errors);
    }
  }

  // ------------------------------------------------------------------------
  // Values
  // ------------------------------------------------------------------------

  /** Every value slot in catalog order, with the number kind it must hold. A
   * reward that is null is undecided as a whole; otherwise each of its keys is
   * a slot. Keys that are absent are skipped (reported by the structure check). */
  function slotsOf(catalog) {
    const out = [];
    const field = (obj, key, path, kind) => {
      if (isObject(obj) && key in obj) out.push({ path, value: obj[key], kind });
    };
    const reward = (obj, key, path) => {
      if (!isObject(obj) || !(key in obj)) return;
      const r = obj[key];
      if (!isObject(r)) {
        out.push({ path, value: r, kind: "reward" });
        return;
      }
      for (const k of Object.keys(r)) out.push({ path: `${path}.${k}`, value: r[k], kind: REWARD_KEYS.includes(k) ? "nonNegative" : "unknownReward" });
    };
    const items = (list) => (Array.isArray(catalog[list]) ? catalog[list].filter(isObject) : []);

    const organic = isObject(catalog.organic) ? catalog.organic : {};
    for (const currency of ORGANIC_CURRENCIES) {
      const rule = isObject(organic[currency]) ? organic[currency].verifiedSteps : undefined;
      field(rule, "amount", `organic.${currency}.verifiedSteps.amount`, "positive");
      field(rule, "perSteps", `organic.${currency}.verifiedSteps.perSteps`, "positive");
    }
    for (const era of items("eras")) reward(era, "transitionReward", `eras.${era.id}.transitionReward`);
    for (const j of items("journeys")) {
      field(j, "pp", `journeys.${j.id}.pp`, "positive");
      field(j, "price", `journeys.${j.id}.price`, "nonNegative");
      reward(j, "onComplete", `journeys.${j.id}.onComplete`);
    }
    for (const pz of items("puzzles")) {
      field(pz, "tiles", `puzzles.${pz.id}.tiles`, "positive");
      field(pz, "piecesPerTile", `puzzles.${pz.id}.piecesPerTile`, "positive");
      reward(pz, "onComplete", `puzzles.${pz.id}.onComplete`);
    }
    for (const c of items("collections")) reward(c, "reward", `collections.${c.id}.reward`);
    return out;
  }

  function checkSlot({ path, value, kind }, errors) {
    if (kind === "unknownReward") {
      errors.push(`${path}: unknown reward. Rewards are ${REWARD_KEYS.join(", ")}.`);
      return;
    }
    if (value === null) return;
    if (kind === "reward") {
      errors.push(`${path}: must be null (undecided) or an object of rewards.`);
      return;
    }
    if (!isObject(value)) {
      errors.push(`${path}: must be null (unset), { v, s } or { ref }.`);
      return;
    }
    if ("ref" in value) {
      const target = LINKS[value.ref];
      if (Object.keys(value).length !== 1) errors.push(`${path}: a link is { ref } alone.`);
      else if (!target) errors.push(`${path}: ${show(value.ref)} is not a linkable model constant.`);
      else if (target.at !== path) errors.push(`${path}: ${value.ref} may only be used at ${target.at}.`);
      return;
    }
    if (Object.keys(value).sort().join(",") !== "s,v") {
      errors.push(`${path}: a value is { v, s }.`);
      return;
    }
    if (value.s === "verified") errors.push(`${path}: a catalog value cannot be labelled verified. Verified rules enter only by link.`);
    else if (!LITERAL_LABELS.includes(value.s)) errors.push(`${path}: label must be ${LITERAL_LABELS.join(" or ")}, not ${show(value.s)}.`);
    if (!KINDS[kind].test(value.v)) errors.push(`${path}: must be ${KINDS[kind].text}, not ${show(value.v)}.`);
  }

  /** Slot form, labels, number kinds, the required links and paired settings. */
  function validateValues(catalog) {
    const errors = [], warnings = [];
    if (!isObject(catalog)) return { errors: ["The catalog must be an object."], warnings };
    const slots = slotsOf(catalog);
    for (const slot of slots) checkSlot(slot, errors);
    const byPath = new Map(slots.map((s) => [s.path, s.value]));
    for (const [name, target] of Object.entries(LINKS)) {
      const value = byPath.get(target.at);
      if (!(isObject(value) && value.ref === name)) {
        errors.push(`${target.at} must link to ${name} ({ ref: "${name}" }), so it cannot drift from the model.`);
      }
    }
    for (const currency of ORGANIC_CURRENCIES) {
      const base = `organic.${currency}.verifiedSteps`;
      if (byPath.has(`${base}.amount`) && byPath.has(`${base}.perSteps`) &&
        (byPath.get(`${base}.amount`) === null) !== (byPath.get(`${base}.perSteps`) === null)) {
        errors.push(`${base}: set both amount and perSteps, or leave both unset.`);
      }
    }
    return { errors, warnings };
  }

  function validateCatalog(catalog) {
    const structure = validateStructure(catalog);
    const values = validateValues(catalog);
    return { errors: [...structure.errors, ...values.errors], warnings: [...structure.warnings, ...values.warnings] };
  }

  // ------------------------------------------------------------------------
  // Readiness
  // ------------------------------------------------------------------------

  /** What a valid catalog still lacks before anything could be simulated or
   * projected from it: every unset slot and undecided reward, and every
   * roadmap era with no journeys yet. Valid is not the same as ready. */
  function readiness(catalog) {
    const { errors } = validateCatalog(catalog);
    if (errors.length) throw new Error(`Invalid catalog:\n${errors.join("\n")}`);
    const unset = slotsOf(catalog).filter((s) => s.value === null).map((s) => s.path);
    const emptyRoadmapEras = catalog.eras.filter((era) => !catalog.journeys.some((j) => j.era === era.id)).map((era) => era.id);
    return { ready: unset.length === 0 && emptyRoadmapEras.length === 0, unset, emptyRoadmapEras };
  }

  /** A slot's value and label, resolving links to the model's constants. */
  function resolveValue(slot) {
    if (slot === null || slot === undefined) return { set: false };
    if ("ref" in slot) {
      const target = LINKS[slot.ref];
      if (!target) throw new Error(`Not a linkable model constant: ${slot.ref}`);
      return { set: true, v: target.value, s: target.status, ref: slot.ref };
    }
    return { set: true, v: slot.v, s: slot.s };
  }

  return { PROGRESSION_RULES, LINKS, validateStructure, validateValues, validateCatalog, readiness, resolveValue };
});
