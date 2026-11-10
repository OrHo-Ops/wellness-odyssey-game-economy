/* Check the Full Economy V2 outputs and documents against the code.
 *
 *     node full_economy_v2/scripts/check_v2.js
 *
 * 1. Every generated file (tables, figures, results.md, the browser wheel
 *    table) is exactly what build_v2.js produces now: no stale output.
 * 2. The projection passes V1's catalog validator through the V2 wrapper, and
 *    the cosmetic catalog is valid (cosmetic only).
 * 3. Each number quoted in the V2 case study is recomputed here and must
 *    appear, character for character, in the text.
 * 4. Every relative link and #anchor in the V2 Markdown documents resolves.
 * 5. V1 is still green: its claim checker passes and a root `node --test`
 *    runs only V1's suite, with no failures.
 *
 * Exits non-zero and lists every failure. Takes about a minute.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const C = require("../config/scenario_config.js");
const K = require("../config/cosmetics_catalog.js");
const { build } = require("./build_v2.js");

const ROOT = path.join(__dirname, "..", "..");
const V2 = "full_economy_v2";
const failures = [];
let passed = 0;
const check = (ok, message) => (ok ? passed++ : failures.push(message));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Render the Model V2 lab in a minimal browser stand-in, with the given state in its URL hash; returns the KPI HTML. */
function renderLab(state) {
  const vm = require("node:vm");
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, innerHTML: "", textContent: "", style: {}, dataset: {}, children: [], value: "", checked: false,
    appendChild(c) { this.children.push(c); return c; }, querySelectorAll: () => [], querySelector: () => el(`${id}-child`),
    addEventListener() {}, setAttribute() {}, remove() {}, getBoundingClientRect: () => ({ left: 0, width: 560 }) });
  let n = 0;
  const ctx = { console, setTimeout: () => 0, clearTimeout() {}, location: { hash: "#" + encodeURIComponent(JSON.stringify(state)) },
    history: { replaceState() {} }, localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ getPropertyValue: () => "#2a78d6" }) };
  ctx.document = { getElementById: el, createElement: () => el(`new-${n++}`), createElementNS: () => el(`svg-${n++}`), documentElement: el("root") };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const dir = path.join(ROOT, V2, "dashboard"), html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  for (const [, src] of html.matchAll(/<script src="([^"]+)"><\/script>/g)) vm.runInContext(fs.readFileSync(path.join(dir, src), "utf8"), ctx, { filename: src });
  vm.runInContext(html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>")), ctx, { filename: "lab inline script" });
  return els.kpis.innerHTML;
}

// 1. Generated outputs are current -------------------------------------------------
const { res, files } = build();
for (const [rel, content] of Object.entries(files)) {
  const full = path.join(ROOT, rel);
  check(fs.existsSync(full) && fs.readFileSync(full, "utf8") === content, `${rel} is stale: run node ${V2}/scripts/build_v2.js`);
}

// 2. Catalogs ------------------------------------------------------------------------
check(res.reference.validation.errors.length === 0, `projection catalog: ${res.reference.validation.errors.join("; ")}`);
check(K.validateCatalog().length === 0, `cosmetic catalog: ${K.validateCatalog().join("; ")}`);

// 3. Quoted numbers --------------------------------------------------------------------
const CS = `${V2}/docs/case_study.md`, RD = "README.md", PD = "docs/progressive_difficulty.md";
const PROFILES = ["casual", "moderate", "active"];
const series = (xs, last) => `${xs.slice(0, -1).join(", ")} ${last} ${xs[xs.length - 1]}`;
const num = (x) => Math.round(x).toLocaleString("en-US");
const day = (x) => `day ${num(x)}`;
const pc = (x) => `${(100 * x).toFixed(0)}%`;
const p1 = (x) => `${(100 * x).toFixed(1)}%`;
const co = (k) => res.cohorts.find((c) => c.key === k);
const [cas, mod, act, org, spo, aff, dir] = ["casual-walking", "moderate-walking", "active-walking", "moderate-regular-organic", "moderate-regular-sponsored", "moderate-affiliate", "moderate-direct"].map(co);
const stress = (name, key) => res.stress.find((s) => s.name.includes(name)).cohorts.find((c) => c.key === key);
const mf = (key) => { const g = res.missionFrequency.find((x) => x.key === key); const r = g.rows.find((x) => x.stageWait[4].p50 !== null && x.stageWait[4].p50 < 1); return r ? String(r.missionsPerWeekSet) : "more than 4"; };
const grid = (cann, comm) => res.storeBusinessGrid.find((g) => g.cannibalization === cann && g.commission === comm);
const order = res.storeOrder.median;
const cos = (key, pol) => { const g = res.cosmetics.find((x) => x.key === key), b = g.rows.find((r) => r.policy === "none").d100, r = g.rows.find((x) => x.policy === pol); return Math.round(r.d100) - Math.round(b); };
const cosRow = (key, pol) => res.cosmetics.find((x) => x.key === key).rows.find((r) => r.policy === pol);
const store = (rate, f) => res.storePlayer.find((s) => s.rewardRate === rate && s.ordersPer30Days === f);
const refund = (policy, rate) => res.refundPolicies.find((r) => r.policy === policy && r.refundRate === rate).business;
const pz = res.puzzleParticipation;
const tile1 = res.tileExperiment.find((t) => t.tileRevealChronons === 1 && t.key === "moderate-walking");
const weekly = C.weeklyOrganicReference(res.reference.cfg, res.reference.cfg.priceCalibrationOrganicPer1000);
const prices = K.RARITIES.map((r) => K.priceOf(K.ITEMS.find((it) => it.rarity === r), res.reference.cfg.rarityWeeks, weekly));
const fam = (f) => res.priceCurves.find((x) => x.family === f).cohorts.find((c) => c.key === "moderate-walking");
const pacing = (curve, level, key) => res.pacing.find((x) => x.curve === curve && x.level === level).cohorts.find((c) => c.key === key);
const frozen = (curve) => res.pacingFrozen.find((x) => x.curve === curve).cohorts.find((c) => c.key === "moderate-walking");
const sweep = (cov, key) => res.balanceSweep.find((b) => b.lateCoverage === cov).cohorts.find((c) => c.key === key);
const sens = res.sensitivity.find((g) => g.key === "moderate-walking");
const lever = (name) => sens.levers.find((l) => l.name === name);
const ppTotal = (curve) => res.reference.ppCurves[curve].reduce((a, b) => a + b, 0);
const total = res.reference.curves.hybrid.slice(1).reduce((a, b) => a + b, 0);
const stepsPerDay = C.creditedStepsPerDay(res.reference.cfg, "moderate");
const heat = res.heatmap.cells;
const okGrowth = heat.filter((row) => row.find((c) => c.missionsPerWeek === 1).j730 >= 100).map((row) => row[0].growth);
const badGrowth = heat.filter((row) => Math.max(...row.map((c) => c.j730)) < 100).map((row) => row[0].growth);
const mmc = C.COHORTS["moderate-missions-cosmetics"], hec = C.COHORTS["high-engagement-collector"];
// The Model V2 lab's defaults, read from the page, and its KPIs rendered with missions off and 200 players.
const labHtml = read(`${V2}/dashboard/index.html`);
const labDefault = (key) => { const m = labHtml.match(new RegExp(`key: "${key}"[^\\n]*?def: "?([\\w.]+)"?`)); return m ? m[1] : "unknown"; };
const labWalkingOnly = renderLab({ missionsPerWeek: 0, players: "200" });
const g = (x) => `${Number(((x - 1) * 100).toFixed(1))}%`;

const claims = [
  [CS, `from journey ${mod.onset} the Chronon clock does`],
  [CS, `first wait at journeys ${cas.onset}, ${mod.onset} and ${act.onset}`],
  [CS, `${cas.wait100}, ${mod.wait100} and ${act.wait100} days before journey 100`],
  [CS, `about ${mf("casual-walking")} mission a week for a casual walker, ${mf("moderate-walking")} for a moderate one and ${mf("active-walking")} for an active one`],
  [CS, `In the reference calibration ${pc(mod.blockedShare)} of a walking-only player's sessions`],
  [CS, `moderate walking-only players finish on ${day(mod.d100)}. Without that rule, ${pc(stress("No organic", "moderate-walking").deadlockedShare)} of them are stuck for good`],
  [CS, `bundle buyer finishes on ${day(dir.d100)} and a Store shopper on ${day(aff.d100)}, against ${day(mod.d100)} walking only`],
  [CS, `A median $45 order earns ${order.chronons} Chronons, worth $${order.valueGranted.toFixed(2)} at the bundle price, against $${order.commission.toFixed(2)} of commission`],
  [CS, `breaks even at ${p1(grid(0.5, 0.08).breakEven)}, or ${p1(grid(1, 0.08).breakEven)} if every store Chronon displaces a bundle sale`],
  [CS, `costs +${cos("moderate-walking", "progression-first")} days of tour time while still buying ${Math.round(cosRow("moderate-walking", "progression-first").cosmeticsOwned)} of the 28 starter items; reserving 20% of every Chronon costs +${cos("moderate-walking", "share-20")} days`],
  [CS, `would make it cost ${num(Math.round(1500 * Math.pow(1.08, 99)))} PP`],
  [CS, `flat (${num(ppTotal("flat"))} PP for the tour), gentle growth (${num(ppTotal("gentle"))} PP, the reference) and 8% capped at 3 × Jerusalem (${num(ppTotal("capped"))} PP)`],
  [CS, `at journeys 2, 10, 40 and 100 (${C.COVERAGE_LEVELS.reference.join(", ")})`],
  [CS, `scaled to the hybrid's total of ${num(total)} Chronons`],
  [CS, `is unchanged): ${res.reference.validation.errors.length} errors, valid but not ready`],
  [CS, `the median moderate walker first waits at journey ${mod.onset}`],
  [CS, `finish the tour on ${day(mod.d100)} (${pc(mod.tourShare)} within six years)`],
  [CS, `only ${pc(cas.tourShare)} finish within six years`],
  [CS, `Regular organic missions (${org.missionsPerWeek.toFixed(2)} a week) move the first wait from journey ${mod.onset} to journey ${org.onset} and finish the tour on ${day(org.d100)}; with a sponsor in reach (${spo.missionsPerWeek.toFixed(2)} missions a week) the first wait moves to journey ${spo.onset} and the tour ends on ${day(spo.d100)}`],
  [CS, `Missions add only ${p1(org.sourceShare["organic-mission"])} (organic) and ${p1(spo.sourceShare["organic-mission"] + spo.sourceShare["sponsored-mission"])} (sponsored)`],
  [CS, `finishes ${Math.round(mod.d100) - Math.round(org.d100)} days ahead of walking only, and only ${Math.round(org.d100) - Math.round(spo.d100)} days behind`],
  [CS, `| Casual | ${mf("casual-walking")} |`], [CS, `| Moderate | ${mf("moderate-walking")} |`], [CS, `| Active | ${mf("active-walking")} |`],
  [CS, `($4.99 for ${res.storeOrder.bundleChronons} Chronons, about $${res.storeOrder.chrononValue.toFixed(2)} each)`],
  [CS, `about $${Math.round(store(0.05, 1).spendPerMonth)} a month of shopping brings journey 100 forward from ${day(store(0.05, 0).d100)} to ${day(store(0.05, 1).d100)}; about $${Math.round(store(0.1, 2).spendPerMonth)} a month at 10% brings it to ${day(store(0.1, 2).d100)}`],
  [CS, `about $${Math.round(aff.business.gmvPerPlayerYear / 12)} a month) finishes on ${day(aff.d100)}`],
  [CS, `breaks even at ${p1(grid(0.5, 0.08).breakEven)} if half of store Chronons displace bundle purchases, and at ${p1(grid(1, 0.08).breakEven)} if all of them do`],
  [CS, `a 30% refund rate leaks ${Math.round(refund("no-clawback", 0.3).leakedChrononsPerPlayerYear)} Chronons per shopper-year and cuts the store's net from $${refund("pending", 0.3).storeNetPerPlayerYear.toFixed(2)} to $${refund("no-clawback", 0.3).storeNetPerPlayerYear.toFixed(2)} per shopper-year`],
  [CS, `completes ${pz[0].puzzlesPerYear.toFixed(1)} puzzles a year without missions and ${pz[pz.length - 1].puzzlesPerYear.toFixed(1)} with high participation`],
  [CS, `Completion Energy is ${p1(Math.min(...pz.map((p) => p.puzzleEnergyShare)))} to ${p1(Math.max(...pz.map((p) => p.puzzleEnergyShare)))} of all Energy credited. It brings journey 50 forward by ${Math.min(...pz.map((p) => Math.round(p.d50NoBonus) - Math.round(p.d50)))} to ${Math.max(...pz.map((p) => Math.round(p.d50NoBonus) - Math.round(p.d50)))} days`],
  [CS, `journey 100 moves by ${Math.min(...pz.map((p) => Math.round(p.d100NoBonus) - Math.round(p.d100)))} to ${Math.max(...pz.map((p) => Math.round(p.d100NoBonus) - Math.round(p.d100)))} days`],
  [CS, `cuts walking-only blocked sessions from ${pc(mod.blockedShare)} to ${pc(tile1.blockedShare)} and the tour from ${day(mod.d100)} to ${day(tile1.d100)}`],
  [CS, `${prices.slice(0, 3).join(", ")} and ${prices[3]} Chronons by rarity, ${num(res.cosmeticsCatalogTotal)} in all`],
  [CS, `costs +${cos("moderate-walking", "progression-first")} days and still buys ${Math.round(cosRow("moderate-walking", "progression-first").cosmeticsOwned)} of 28 items`],
  [CS, `costs +${cos("moderate-walking", "share-20")} days at 20% and +${cos("moderate-walking", "share-40")} days at 40% or 60%`],
  [CS, cos("moderate-walking", "share-40") === cos("moderate-walking", "share-60") ? "at 40% or 60%" : "40% and 60% differ"],
  [CS, `costs only +${cos("moderate-walking", "cosmetics-first")} days`],
  [CS, `per ${((stepsPerDay * res.reference.cfg.organicChrononsPer1000) / 1000).toFixed(1)} Chronons (a moderate walker's daily organic income)`],
  [CS, `Walking-only players earn ${pc(mod.sourceShare.walking)} of their Chronons from walking and ${pc(mod.sourceShare.completion)} from completion rewards`],
  [CS, `${pc(mod.energyWhileWaitingShare)} of a moderate walking-only player's step Energy is credited while no journey is active`],
  [CS, `they still hold about ${num(Math.round(mod.energyHeldEnd / 1000) * 1000)} Energy, about ${Math.round((mod.energyHeldEnd * 10) / stepsPerDay)} days of their walking`],
  [CS, (() => { const d = ["linear", "exponential", "piecewise", "milestone", "hybrid"].map((f) => fam(f).d100); return Math.max(...d) - Math.min(...d) <= 1; })() ? `to journey 100 within a day of each other, around ${day(fam("hybrid").d100)}` : "families finish more than a day apart"],
  ...[["Coverage-targeted hybrid", "hybrid"], ["Linear", "linear"], ["Piecewise", "piecewise"], ["Milestone jumps", "milestone"], ["Exponential", "exponential"]].map(([label, f]) =>
    [CS, `| ${label} | journey ${fam(f).onset} | ${pc(fam(f).blockedShare)} | ${fam(f).wait100} |`]),
  [CS, `a moderate walker finishes on ${day(pacing("flat", "generous", "moderate-walking").d100)} with no waits, and ${pc(pacing("flat", "generous", "casual-walking").tourShare)} of casual walkers finish`],
  [CS, `the moderate walker needs until ${day(pacing("capped", "scarce", "moderate-walking").d100)}, and only ${pc(pacing("capped", "scarce", "casual-walking").tourShare)} of casual walkers finish`],
  [CS, `the flat tour takes ${num(frozen("flat").d100)} days and the capped tour ${num(frozen("capped").d100)}`],
  [CS, pc(sweep(1.0, "moderate-walking").blockedShare) === "0%" ? "At coverage 1.0** walking-only players are never blocked" : "coverage 1.0 blocks walking-only players"],
  [CS, `At 0.9** they are blocked in ${pc(sweep(0.9, "moderate-walking").blockedShare)} of sessions`],
  [CS, ["moderate-regular-organic", "moderate-regular-sponsored", "moderate-direct"].every((k) => pc(sweep(0.9, k).blockedShare) === "0%") ? "while mission and bundle players are not blocked at all" : "mission players blocked at 0.9"],
  [CS, `At 0.8** organic-mission players are blocked in ${pc(sweep(0.8, "moderate-regular-organic").blockedShare)} of sessions`],
  [CS, `walking-only players are blocked in ${pc(sweep(0.7, "moderate-walking").blockedShare)} of sessions and organic-mission players in ${pc(sweep(0.7, "moderate-regular-organic").blockedShare)}`],
  [CS, `| Organic Chronon rate, 0.5x / 2x | ${day(lever("Organic Chronon rate").low.d100)} | ${day(lever("Organic Chronon rate").high.d100)} |`],
  [CS, `| Price level, scarce / generous coverage | ${day(lever("Journey price level").low.d100)} | ${day(lever("Journey price level").high.d100)} |`],
  [CS, `| Completion reward, 0.5x / 2x | ${day(lever("Completion reward").low.d100)} | ${day(lever("Completion reward").high.d100)} |`],
  [CS, `| Energy cap, 250 / 500 | ${day(lever("Energy cap").low.d100)} | ${day(lever("Energy cap").high.d100)} |`],
  [CS, `(moderate, walking only; base: ${day(sens.base.d100)})`],
  [CS, new Set([lever("Organic Chronon rate").high.d100, lever("Journey price level").high.d100, lever("Completion reward").high.d100].map(Math.round)).size === 1 ? `Day ${num(lever("Journey price level").high.d100)} is the PP floor` : "no common PP floor"],
  [CS, `moves the first wait from journey ${mod.onset} to journey ${lever("Daily bonuses").low.onset}`],
  [CS, res.stress.find((s) => s.name === "Energy cap 250").cohorts.every((c) => Math.round(c.d100 / 100) === 18) ? "finish around day 1,800" : "the cap-250 cohorts do not finish together"],
  [CS, `growth of up to ${g(Math.max(...okGrowth))} per journey still lets one mission a week finish the whole tour in two years; at ${g(1.02)} it falls just short (a median of ${heat.find((row) => row[0].growth === 1.02).find((c) => c.missionsPerWeek === 1).j730} journeys). From ${g(Math.min(...badGrowth))} per journey, no mission frequency tested`],
  [CS, `organic-mission players finish on ${day(stress("occasional", "moderate-regular-organic").d100)} instead of ${num(org.d100)}`],
  [CS, `shoppers finish on ${day(stress("a third", "moderate-affiliate").d100)} instead of ${num(aff.d100)}`],
  [CS, res.evVsSampled.every((e) => Math.round(e.ev.d100) === Math.round(e.sampled.d100)) ? "give the same median day for journey 100 in all five key cohorts" : "EV and sampled medians differ"],
  [CS, `organic-mission players need until ${day(stress("No organic", "moderate-regular-organic").d100)}`],
  [CS, `leave ${pc(1 - pacing("gentle", "generous", "casual-walking").tourShare)} of casual walkers unfinished`],
  // The portfolio README at the repository root
  ...[["Casual", cas], ["Moderate", mod], ["Active", act]].map(([label, c]) => [RD, `| ${label} | journey ${c.onset} | ${c.wait100} days |`]),
  [RD, `about ${mf("casual-walking")} mission a week for a casual walker, ${mf("moderate-walking")} for a moderate one and ${mf("active-walking")} for an active one`],
  [RD, `a hypothetical $4.99 bundle of ${res.storeOrder.bundleChronons} Chronons`],
  [RD, `break even at ${p1(grid(0.5, 0.08).breakEven)} of order value if half of store Chronons displace bundle sales, and at ${p1(grid(1, 0.08).breakEven)} if all do`],
  [RD, `Completion Energy is ${p1(Math.min(...pz.map((p) => p.puzzleEnergyShare)))} to ${p1(Math.max(...pz.map((p) => p.puzzleEnergyShare)))} of all Energy credited`],
  [RD, `${K.ITEMS.length} proposed cosmetic-only items`],
  [RD, `buying only from a surplus costs +${cos("moderate-walking", "progression-first")} days of tour time; reserving 20% of every Chronon costs +${cos("moderate-walking", "share-20")} days`],
  [RD, `V2 simulates ${["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][Object.keys(C.COHORTS).length]} synthetic cohorts`],
  [RD, `median daily steps of ${series(PROFILES.map((a) => num(C.ACTIVITY[a].medianDailySteps)), "and")}, with a session on ${series(PROFILES.map((a) => pc(C.ACTIVITY[a].activeDayRate)), "and")} of days`],
  [RD, `${num(res.reference.cfg.playersPerCohort)} synthetic players per cohort`],
  ...Object.entries({
    "casual-walking": "Casual walker, walking only", "moderate-walking": "Moderate walker, walking only", "active-walking": "Active walker, walking only",
    "moderate-regular-organic": "Moderate walker, regular organic missions", "moderate-regular-sponsored": "Moderate walker, missions with a sponsor in reach",
    "moderate-affiliate": "Moderate walker, Wellness Store shopper", "moderate-direct": "Moderate walker, Chronon bundle buyer",
    "moderate-missions-cosmetics": "Moderate walker, missions and cosmetics", "high-engagement-collector": "High-engagement collector",
  }).map(([key, label]) => { const c = co(key); return [RD, `| ${label} | ${pc(c.tourShare)} | ${c.d100 === null ? "not reached" : c.d100.toFixed(0)} | ${c.onset} | ${pc(c.blockedShare)} |`]; }),
  [RD, `Moderate walking-only players finish on ${day(mod.d100)}.`],
  [RD, `Without the rule, ${pc(stress("No organic", "moderate-walking").deadlockedShare)} of them are stuck for good`],
  [RD, `${pc(cas.tourShare)} of casual walking-only players finish within six years`],
  [RD, `A bundle buyer reaches journey 100 on ${day(dir.d100)}, against ${day(mod.d100)} walking only`],
  [RD, `late-game coverage is ${C.COVERAGE_LEVELS.reference[C.COVERAGE_LEVELS.reference.length - 1]}`],
  [RD, `**fully blocked in ${pc(mod.blockedShare)} of their in-tour sessions**`],
  [RD, `${pc(mod.energyWhileWaitingShare)} of their step Energy is credited while no journey is active`],
  [RD, `- ${pc(sweep(1.0, "moderate-walking").blockedShare)} of sessions at coverage 1.0;\n- ${pc(sweep(0.9, "moderate-walking").blockedShare)} at 0.9;\n- ${pc(sweep(0.7, "moderate-walking").blockedShare)} at 0.7.`],
  [RD, `At 0.7, organic missions cut it to ${pc(sweep(0.7, "moderate-regular-organic").blockedShare)}.`],
  [RD, pc(sweep(0.7, "moderate-walking").blockedShare) === pc(mod.blockedShare) ? "54%" : "the 0.7 sweep differs from the reference calibration"],
  // The portfolio README: "At a glance"
  [RD, cas.onset === mod.onset ? `At **journey ${mod.onset}** for casual and moderate walkers and **${act.onset}** for active ones` : "casual and moderate onsets differ"],
  [RD, `walking-only players are fully blocked in **${pc(mod.blockedShare)}** of their in-tour sessions. Regular organic missions cut that to **${pc(org.blockedShare)}**`],
  [RD, `A bundle buyer reaches journey 100 on **${day(dir.d100)}** against **${day(mod.d100)}** walking only`],
  // The portfolio README: why the cosmetic-heavy personas are blocked most
  [RD, mmc.cosmetics === "balanced" && mmc.activity === "moderate" && mmc.missions === "regular"
    ? `the moderate walker with missions and cosmetics sets aside ${pc(C.COSMETIC_POLICIES.balanced.share)} of every Chronon for cosmetics` : "missions-and-cosmetics cohort changed"],
  [RD, hec.cosmetics === "collector" && hec.activity === "active" && C.MISSION_PATTERNS[hec.missions] > 0.5 && C.COSMETIC_POLICIES.collector.setsFirst
    ? `the high-engagement collector, an active walker who takes most missions, sets aside ${pc(C.COSMETIC_POLICIES.collector.share)} and buys complete sets first` : "collector cohort changed"],
  [RD, `the first wait moves from journey ${org.onset} without cosmetics to journey ${co("moderate-missions-cosmetics").onset} with them`],
  [RD, `**Collector:** it waits from journey ${co("high-engagement-collector").onset}.`],
  [RD, co("high-engagement-collector").energyWhileWaitingShare > 0.99 ? "more than 99% of its step Energy is credited while no journey is active" : "collector banks less than 99%"],
  [RD, `it still reaches journey 100 on ${day(co("high-engagement-collector").d100)}`],
  [RD, `buying only from a surplus costs ${cos("moderate-walking", "progression-first")} days over the tour, while reserving a fixed 20% costs ${cos("moderate-walking", "share-20")}`],
  // The portfolio README: why the Model V2 lab opens on different numbers
  [RD, `a moderate walker who completes exactly ${labDefault("missionsPerWeek")} mission a week, simulated with ${labDefault("players")} synthetic players`],
  [RD, `The reference cohort with regular organic missions completes ${org.missionsPerWeek.toFixed(2)} missions a week, with ${num(res.reference.cfg.playersPerCohort)} synthetic players per cohort`],
  [RD, labWalkingOnly.includes(`day ${num(mod.d100)}`) && labWalkingOnly.includes(`${pc(mod.blockedShare)}`)
    ? `the lab reproduces this README's moderate walking-only results: ${day(mod.d100)} and ${pc(mod.blockedShare)} of sessions blocked` : "the lab does not reproduce the walking-only cohort at 200 players"],
  // The difficulty-curve design direction quotes the same reference findings
  [PD, `first has to wait for Chronons at journey ${mod.onset}, whether they walk ${series(PROFILES.map((a) => num(C.ACTIVITY[a].medianDailySteps)), "or")} steps a day`],
  [PD, cas.onset === mod.onset && Math.abs(act.onset - mod.onset) <= 1 ? "The point where scarcity starts is a property of the catalog" : "onset differs by activity"],
  [PD, `In that hypothetical calibration, ${pc(mod.blockedShare)} of a synthetic walking-only player's sessions`],
  [PD, `V2 found that ${pc(stress("No organic", "moderate-walking").deadlockedShare)} of synthetic moderate walking-only players were stuck for good`],
];
const docText = {};
for (const [file, quoted] of claims) {
  docText[file] = docText[file] || read(file);
  check(docText[file].includes(quoted), `${file}: does not contain "${quoted}"`);
}

// 4. Links and anchors ------------------------------------------------------------------
const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
const anchors = (rel) => new Set(read(rel).split("\n").filter((l) => /^#{1,6} /.test(l)).map((l) => slug(l.replace(/^#+ /, ""))));
const markdown = [`${V2}/README.md`, ...fs.readdirSync(path.join(ROOT, V2, "docs")).filter((x) => x.endsWith(".md")).map((x) => `${V2}/docs/${x}`)];
for (const rel of markdown) {
  const text = read(rel).replace(/```[\s\S]*?```/g, "");
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    const [file, anchor] = target.split("#");
    const resolved = file ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), file)) : rel;
    const exists = fs.existsSync(path.join(ROOT, resolved));
    check(exists, `${rel}: broken link ${target}`);
    if (exists && anchor && resolved.endsWith(".md")) check(anchors(resolved).has(anchor), `${rel}: missing anchor ${target}`);
  }
}

// 5. V1 is still green ---------------------------------------------------------------------
const v1Claims = spawnSync(process.execPath, ["analysis/check_claims.js"], { cwd: ROOT, encoding: "utf8" });
check(v1Claims.status === 0, `V1 analysis/check_claims.js failed:\n${v1Claims.stdout}${v1Claims.stderr}`);
const v1Tests = spawnSync(process.execPath, ["--test", "--test-reporter=tap"], { cwd: ROOT, encoding: "utf8" });
check(v1Tests.status === 0 && /# fail 0/.test(v1Tests.stdout), "V1 `node --test` did not pass");
check(!/full_economy_v2/.test(v1Tests.stdout), "a root `node --test` picked up a V2 file; V2 tests must stay out of V1's suite");

console.log(`${passed} checks passed, ${failures.length} failed${failures.length ? ":" : "."}`);
for (const message of failures) console.log(`  FAIL ${message}`);
process.exitCode = failures.length ? 1 : 0;
