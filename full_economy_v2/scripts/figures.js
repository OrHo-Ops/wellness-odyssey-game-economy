/* Full Economy V2 figures, built from the experiment results.
 * Every figure is a pure function of the results and returns [file, svg]. */
"use strict";
const K = require("./charts.js");
const { svgDoc, text, header, footer, legend, linePanel, hbarPanel, stackPanel, niceTicks, fmt } = K;

const W = 760;
const SRC = "Synthetic players; every economy value is hypothetical.";
const COHORT_STYLE = { // entity colours, fixed across every figure
  "moderate-walking": ["l1", "c1"], "moderate-regular-organic": ["l3", "c3"], "moderate-regular-sponsored": ["l4", "c4"],
  "moderate-affiliate": ["l5", "c5"], "moderate-direct": ["l6", "c6"],
};
const SHORT = {
  "casual-walking": "Casual, walking only", "moderate-walking": "Moderate, walking only", "active-walking": "Active, walking only",
  "moderate-occasional-organic": "Moderate, occasional missions", "moderate-regular-organic": "Moderate, regular missions",
  "moderate-regular-sponsored": "Moderate, missions + sponsor", "active-regular-missions": "Active, missions + sponsor",
  "moderate-affiliate": "Moderate, store purchases", "moderate-direct": "Moderate, Chronon bundles",
  "moderate-missions-cosmetics": "Moderate, missions + cosmetics", "high-engagement-collector": "High-engagement collector",
};
const KEY_LABEL = { "moderate-walking": "Walking only", "moderate-regular-organic": "Organic missions", "moderate-regular-sponsored": "Sponsored missions", "moderate-affiliate": "Store purchases", "moderate-direct": "Chronon bundles" };
const dayTicks = [0, 365, 730, 1095, 1460, 1825, 2190];
const dayFmt = (d) => (d === 0 ? "0" : `${d / 365} yr`);
const data = (file) => `${SRC} Data: full_economy_v2/outputs/${file}`;

function finish(file, title, desc, parts, bottom, notes) {
  const f = footer(notes, bottom);
  return [file, svgDoc(W, f.height, title, desc, [...parts, ...f.parts].join("\n"))];
}

function figPriceCurves(res) {
  const curves = res.reference.curves, fams = ["linear", "exponential", "piecewise", "milestone", "hybrid"];
  const names = { linear: "Linear", exponential: "Exponential", piecewise: "Piecewise", milestone: "Milestone jumps", hybrid: "Coverage-targeted hybrid (reference)" };
  const max = Math.max(...fams.map((f) => Math.max(...curves[f].slice(1))));
  const total = curves.hybrid.slice(1).reduce((a, b) => a + b, 0);
  const h = header("A. Chronon unlock price across the 100-journey World Tour", [
    `Five hypothetical price families. Each charges the same total, ${fmt(total)} Chronons for journeys 2 to 100; they differ only in when they charge it. Jerusalem is the free start journey. Prices are calibrated once and then frozen.`]);
  const lg = legend(fams.map((f, i) => ({ label: names[f], cls: `c${i + 1}` })), 24, h.y + 28, W - 48);
  const top = lg.y + 34;
  const parts = [...h.parts, ...lg.parts, ...linePanel({
    x: 72, y: top, w: W - 72 - 96, h: 280, xDomain: [1, 100], xTicks: [1, 10, 25, 50, 75, 100], yTicks: niceTicks(max, 5),
    xLabel: "Journey in unlock order", yLabel: "Chronons to unlock",
    series: fams.map((f, i) => ({ label: names[f], cls: `l${i + 1}`, fillCls: `c${i + 1}`, points: curves[f].map((v, k) => [k + 1, v]).slice(1),
      endLabel: f === "hybrid" || f === "exponential" ? `${fmt(curves[f][99])}` : null })),
  })];
  return finish("A_price_curves.svg", "Chronon unlock price across the World Tour", "Line chart of the Chronon price of journeys 2 to 100 under five hypothetical price families with equal totals.",
    parts, top + 280 + 36, data("price_curves.csv"));
}

function figPpCurves(res) {
  const pp = res.reference.ppCurves, keys = ["flat", "gentle", "capped"];
  const names = { flat: "Flat after Santorini", gentle: "Gentle growth (+1% of Santorini per journey)", capped: "8% growth capped at 3x Jerusalem" };
  const h = header("A2. PP length per journey: three pacing scenarios", [
    "Journeys 1 to 7 keep their implemented costs (1,500 x 1.08^(n-1)). After that, length is a separate, hypothetical pacing choice. Extending the implemented 8% growth instead would reach 3,055,224 PP at journey 100, far off this chart."]);
  const lg = legend(keys.map((k, i) => ({ label: names[k], cls: `o${i + 1}` })), 24, h.y + 28, W - 48);
  const top = lg.y + 34;
  const totals = keys.map((k) => `${names[k].split(" (")[0]}: ${fmt(pp[k].reduce((a, b) => a + b, 0))} PP`).join(" · ");
  const parts = [...h.parts, ...lg.parts, ...linePanel({
    x: 72, y: top, w: W - 72 - 40, h: 260, xDomain: [1, 100], xTicks: [1, 7, 25, 50, 75, 100], yTicks: [0, 1000, 2000, 3000, 4000, 5000],
    xLabel: "Journey", yLabel: "PP to complete",
    series: keys.map((k, i) => ({ label: names[k], cls: `ol${i + 1}`, fillCls: `o${i + 1}`, points: pp[k].map((v, j) => [j + 1, v]) })),
  })];
  return finish("A2_pp_curves.svg", "PP length per journey under three pacing scenarios", "Line chart of PP per journey: journeys 1 to 7 implemented, journeys 8 to 100 under three hypothetical pacing curves.",
    parts, top + 260 + 36, [`Tour totals. ${totals}.`, data("pp_curves.csv")]);
}

function figSources(res) {
  const srcNames = ["Walking (organic)", "Journey completion", "Organic missions", "Sponsored missions", "Wellness Store", "Chronon bundles"];
  const keys = ["walking", "completion", "organic-mission", "sponsored-mission", "store", "direct"];
  const textCls = ["tw", "tw", "tw", "tb", "tw", "tw"];
  const h = header("B. Where each cohort's Chronons come from", "Share of all Chronons earned over the simulated horizon, by source. Reference scenario.");
  const lg = legend(srcNames.map((nm, i) => ({ label: nm, cls: `c${i + 1}`, kind: "box" })), 24, h.y + 28, W - 48);
  const st = stackPanel({ x: 236, y: lg.y + 28, w: W - 236 - 30, rows: res.cohorts.map((c) => ({
    label: SHORT[c.key], segments: keys.map((k, i) => ({ v: c.sourceShare[k], cls: `c${i + 1}`, name: srcNames[i], textCls: textCls[i] })),
  })) });
  return finish("B_chronon_sources.svg", "Chronon sources by cohort", "Stacked horizontal bars of the share of Chronons each cohort earns from walking, completion rewards, missions, store purchases and bundles.",
    [...h.parts, ...lg.parts, ...st.parts], st.bottom, data("chronon_sources.csv"));
}

function figBalance(res) {
  const walk = res.ledgers["moderate-walking"].rows, mis = res.ledgers["moderate-regular-organic"].rows;
  const onset = res.ledgers["moderate-walking"].firstWaitJourney;
  const ptsBal = (rows) => rows.slice(0, 99).map((r) => [r.journey, r.balanceOnCompletion]);
  const price = walk.slice(0, 99).map((r, i) => [r.journey, walk[i + 1].price]);
  const max = Math.max(...price.map((x) => x[1]), ...ptsBal(walk).map((x) => x[1]), ...ptsBal(mis).map((x) => x[1]));
  const h = header("C. Chronons held on finishing a journey vs the next journey's price", [
    `Closed-form ledger, moderate walker. Walking alone stays ahead of prices until journey ${onset - 1}; from then on the balance reaches the next price only after a wait. Regular missions keep the balance ahead for longer.`]);
  const lg = legend([{ label: "Next journey's price", cls: "fp" }, { label: "Held: walking only", cls: "c1" }, { label: "Held: regular organic missions", cls: "c3" }], 24, h.y + 28, W - 48);
  const top = lg.y + 34;
  const parts = [...h.parts, ...lg.parts, ...linePanel({
    x: 72, y: top, w: W - 72 - 40, h: 270, xDomain: [1, 99], xTicks: [1, 10, 25, 50, 75, 99], yTicks: niceTicks(max, 5),
    xLabel: "Journey just completed", yLabel: "Chronons",
    series: [
      { label: "Price of the next journey", cls: "lp", fillCls: "fp", points: price },
      { label: "Chronons held, walking only", cls: "l1", fillCls: "c1", points: ptsBal(walk), dots: [[onset - 1, walk[onset - 2].balanceOnCompletion, `First wait: journey ${onset}`]] },
      { label: "Chronons held, regular organic missions", cls: "l3", fillCls: "c3", points: ptsBal(mis) },
    ],
  })];
  return finish("C_balance_vs_price.svg", "Chronon balance versus the next unlock price", "Line chart of Chronons held on completing each journey, for walking-only and mission players, against the price of the next journey.",
    parts, top + 270 + 36, ["Expected-value arithmetic, not simulation.", data("journey_economy.csv")]);
}

function figTimeline(res) {
  const h = header("D. Journeys completed over time", "Median synthetic player per cohort (moderate walkers), reference scenario. Dots mark the median day the tour is finished.");
  const keys = res.timeline.map((t) => t.key);
  const lg = legend(keys.map((k) => ({ label: KEY_LABEL[k], cls: COHORT_STYLE[k][1] })), 24, h.y + 28, W - 48);
  const top = lg.y + 34;
  const series = res.timeline.map((t) => {
    const c = res.cohorts.find((x) => x.key === t.key);
    return { label: KEY_LABEL[t.key], cls: COHORT_STYLE[t.key][0], fillCls: COHORT_STYLE[t.key][1], points: t.done.map((v, w) => [w * 7 + 7, v]),
      dots: c.d100 ? [[c.d100, 100, `${KEY_LABEL[t.key]}: journey 100 on day ${fmt(c.d100)}`]] : [] };
  });
  const parts = [...h.parts, ...lg.parts, ...linePanel({
    x: 72, y: top, w: W - 72 - 40, h: 280, xDomain: [0, 2190], xTicks: dayTicks, xFmt: dayFmt, yTicks: [0, 25, 50, 75, 100],
    xLabel: "Time since install", yLabel: "Journeys completed", series,
  })];
  return finish("D_journeys_over_time.svg", "Journeys completed over time", "Line chart of median journeys completed by day for walking-only, mission and purchasing cohorts.",
    parts, top + 280 + 36, data("timeline.csv"));
}

function figWaitStage(res) {
  const keys = Object.keys(KEY_LABEL);
  const stages = res.cohorts[0].stageWait.map((s) => s.stage);
  const rows = stages.map((st, si) => ({ label: `Journeys ${st}`, bars: keys.map((k) => {
    const c = res.cohorts.find((x) => x.key === k), v = c.stageWait[si].mean || 0;
    return { v, cls: COHORT_STYLE[k][1], label: fmt(v, 1), title: `${KEY_LABEL[k]}, journeys ${st}: ${fmt(v, 1)} days on average` };
  }) }));
  const max = Math.max(...rows.flatMap((r) => r.bars.map((b) => b.v)));
  const h = header("E. Waiting time between journeys, by stage of the tour", "Mean days between finishing a journey and being able to unlock the next, per journey. Moderate walkers, reference scenario.");
  const lg = legend(keys.map((k) => ({ label: KEY_LABEL[k], cls: COHORT_STYLE[k][1], kind: "box" })), 24, h.y + 28, W - 48);
  const ticks = niceTicks(max, 4);
  const p = hbarPanel({ x: 150, y: lg.y + 32, w: W - 150 - 70, rows, max: ticks[ticks.length - 1], ticks, barHeight: 11, axisLabel: "Days of waiting per journey" });
  return finish("E_wait_by_stage.svg", "Waiting time between journeys by stage", "Grouped horizontal bars of mean waiting days per journey in five stages of the tour, by cohort.",
    [...h.parts, ...lg.parts, ...p.parts], p.bottom, data("cohorts.csv"));
}

function figWaitJourney(res, which) {
  const activity = which === "activity";
  const order = ["casual-walking", "moderate-walking", "active-walking"];
  const rows = activity ? order.map((k) => res.waitByJourney.find((w) => w.key === k)) : res.waitByJourney.filter((w) => KEY_LABEL[w.key]);
  const label = (k) => (activity ? { "casual-walking": "Casual walker", "moderate-walking": "Moderate walker", "active-walking": "Active walker" }[k] : KEY_LABEL[k]);
  const sty = (k, i) => (activity ? [`ol${i + 1}`, `o${i + 1}`] : COHORT_STYLE[k]);
  const max = Math.max(...rows.flatMap((r) => r.wait.filter((v) => v !== null)));
  const onsets = rows.map((r) => res.cohorts.find((c) => c.key === r.key).firstMedianWait);
  const h = activity
    ? header("E3. Walking only: scarcity starts at the same journey at every activity level", [
      `Median wait per journey. The casual, moderate and active walkers first wait at journeys ${onsets.join(", ")}: the same steps earn Energy and Chronons, so walking more changes how long a wait lasts, not where it starts.`])
    : header("E2. Where Chronon scarcity starts affecting journey access", [
      `Median wait per journey, moderate walkers. First journey with a median wait of a day or more: ${rows.map((r, i) => `${label(r.key)} ${onsets[i] || "none"}`).join("; ")}.`]);
  const lg = legend(rows.map((r, i) => ({ label: label(r.key), cls: sty(r.key, i)[1] })), 24, h.y + 28, W - 48);
  const top = lg.y + 34;
  const parts = [...h.parts, ...lg.parts, ...linePanel({
    x: 72, y: top, w: W - 72 - 40, h: 260, xDomain: [1, 100], xTicks: [1, 10, 25, 50, 75, 100], yTicks: niceTicks(max, 4),
    xLabel: "Journey to unlock", yLabel: "Median days waiting",
    series: rows.map((r, i) => ({ label: label(r.key), cls: sty(r.key, i)[0], fillCls: sty(r.key, i)[1], points: r.wait.map((v, k) => [k + 1, v]).slice(1) })),
  })];
  return finish(activity ? "E3_wait_by_journey_activity.svg" : "E2_wait_by_journey.svg",
    activity ? "Walking-only waiting time by journey and activity level" : "Waiting time by journey for each player type",
    "Line chart of median waiting days before each journey unlock.", parts, top + 260 + 36, data("wait_by_journey.csv"));
}

function figPuzzles(res) {
  const rows = res.puzzleParticipation;
  const h = header("F. Puzzle completion and its effect on PP progression", [
    "Moderate walker, one Future Vision puzzle per destination (Jaffa Gate's provisional 9 tiles x 30 pieces and 100 Energy, generalised as a labelled assumption), 5 organic pieces per 1,000 steps. Right: how many days the completion Energy brings journey 50 forward."]);
  const top = h.y + 36;
  const left = hbarPanel({ x: 196, y: top + 18, w: 150, rows: rows.map((r) => ({ label: r.label, bars: [{ v: r.puzzlesPerYear, cls: "c1", label: fmt(r.puzzlesPerYear, 1), title: `${r.label}: ${fmt(r.puzzlesPerYear, 1)} puzzles a year` }] })),
    max: 60, ticks: [0, 20, 40, 60], barHeight: 14, axisLabel: "Puzzles completed per year" });
  const right = hbarPanel({ x: 560, y: top + 18, w: 140, rows: rows.map((r) => { const v = (r.d50NoBonus || 0) - (r.d50 || 0); return { label: "", bars: [{ v, cls: "c1", label: `${fmt(v)} d`, title: `${r.label}: journey 50 reached ${fmt(v)} days sooner with the completion Energy` }] }; }),
    max: 15, ticks: [0, 5, 10, 15], barHeight: 14, axisLabel: "Days saved to journey 50" });
  const share = rows.map((r) => `${fmt(100 * r.puzzleEnergyShare, 1)}%`);
  return finish("F_puzzles.svg", "Puzzle completion and PP acceleration", "Two horizontal bar charts: puzzles completed per year and days saved to journey 50 by the puzzle completion Energy, by mission participation.",
    [...h.parts, text(196, top, "Completion frequency", "t2", { size: 12, bold: true }), text(560, top, "PP acceleration", "t2", { size: 12, bold: true }), ...left.parts, ...right.parts],
    Math.max(left.bottom, right.bottom),
    [`Completion Energy is ${share[0]} to ${share[share.length - 1]} of all Energy credited. Once a player is Chronon-bound it no longer speeds the tour.`, data("puzzles.csv")]);
}

function figStoreAccess(res) {
  const rates = [0.02, 0.05, 0.1];
  const series = rates.map((r, i) => {
    const rows = res.storePlayer.filter((x) => x.rewardRate === r);
    return { label: `${r * 100}% reward`, cls: `ol${i + 1}`, fillCls: `o${i + 1}`, points: rows.map((x) => [x.spendPerMonth, x.d100]),
      dots: rows.map((x) => [x.spendPerMonth, x.d100, `${r * 100}% reward, $${fmt(x.spendPerMonth)} a month: journey 100 on day ${fmt(x.d100)}`]) };
  });
  const all = res.storePlayer.map((x) => x.d100).filter(Number.isFinite);
  const h = header("G. Wellness Store spending vs access to journeys", [
    "Moderate walker who shops through the Store: median day journey 100 is finished, by monthly spend and reward rate. Store Chronons are worth the reward rate at the bundle price; purchases never add Energy, PP or progress."]);
  const lg = legend(series.map((s) => ({ label: s.label, cls: s.fillCls })), 24, h.y + 28, W - 48);
  const top = lg.y + 34;
  const lo = Math.floor(Math.min(...all) / 100) * 100, hi = Math.ceil(Math.max(...all) / 100) * 100;
  const yTicks = []; for (let v = lo; v <= hi; v += 50) yTicks.push(v);
  const parts = [...h.parts, ...lg.parts, ...linePanel({ x: 72, y: top, w: W - 72 - 40, h: 250, xDomain: [0, 120], xTicks: [0, 20, 40, 60, 80, 100, 120],
    xFmt: (v) => `$${v}`, yTicks, xLabel: "Store spending per month", yLabel: "Median day journey 100 is finished", series })];
  return finish("G_store_access.svg", "Store spending versus journey access", "Line chart of median days to finish journey 100 against monthly store spending, for three reward rates.",
    parts, top + 250 + 36, data("store_player.csv"));
}

function figStoreBusiness(res) {
  const panel = (cann, x0, top) => {
    const series = [0.04, 0.08, 0.12].map((c, i) => {
      const rows = res.storeBusinessGrid.filter((g) => g.cannibalization === cann && g.commission === c);
      const be = rows[0].breakEven;
      return { label: `${c * 100}% commission`, cls: `ol${i + 1}`, fillCls: `o${i + 1}`, points: rows.map((g) => [g.rewardRate * 100, g.netUsd]),
        dots: be > 0 && be <= 0.2 ? [[be * 100, 0, `${c * 100}% commission breaks even at a ${fmt(be * 100, 1)}% reward`]] : [] };
    });
    return linePanel({ x: x0, y: top, w: 290, h: 220, xDomain: [0, 20], xTicks: [0, 5, 10, 15, 20], xFmt: (v) => `${v}%`, yTicks: [-4, -2, 0, 2, 4, 6], yFmt: (v) => `$${v}`, series });
  };
  const h = header("G2. Does commission pay for the Chronons? Net contribution per $45 order", [
    "Commission on kept orders, minus the bundle revenue the awarded Chronons displace (net of a 30% platform fee) and $0.15 handling. Left: half of store Chronons displace bundle purchases. Right: all of them do. Dots mark the break-even reward rate."]);
  const lg = legend([0.04, 0.08, 0.12].map((c, i) => ({ label: `${c * 100}% commission`, cls: `o${i + 1}` })), 24, h.y + 28, W - 48);
  const top = lg.y + 44;
  const parts = [...h.parts, ...lg.parts, text(72, top - 16, "50% of store Chronons displace bundles", "t2", { size: 12, bold: true }),
    text(440, top - 16, "100% displace bundles", "t2", { size: 12, bold: true }), ...panel(0.5, 72, top), ...panel(1, 440, top),
    text(W - 30, top + 220 + 36, "Reward rate (bundle-equivalent value per eligible dollar)", "mu", { size: 11, anchor: "end" })];
  return finish("G2_store_business.svg", "Store reward liability versus affiliate commission", "Two line charts of net contribution per order against the reward rate for three commission levels.",
    parts, top + 220 + 36, ["Hypothetical commercial inputs; not a forecast. Data: full_economy_v2/outputs/store_business.csv"]);
}

function figCosmetics(res) {
  const walk = res.cosmetics.find((g) => g.key === "moderate-walking"), mis = res.cosmetics.find((g) => g.key === "moderate-regular-organic");
  const pols = walk.rows.filter((r) => r.policy !== "none");
  const base = (g) => g.rows.find((r) => r.policy === "none").d100;
  const delay = (g, pol) => { const r = g.rows.find((x) => x.policy === pol); return r.d100 === null ? null : Math.round(r.d100) - Math.round(base(g)); };
  const cap = 1400;
  const rows = pols.map((x) => ({ label: x.policyLabel, bars: [walk, mis].map((g, i) => {
    const d = delay(g, x.policy);
    return { v: d === null ? cap : Math.max(d, 0), cls: i ? "c3" : "c1", label: d === null ? "not finished in 6 years" : `+${fmt(d)} d`,
      title: `${i ? "Regular missions" : "Walking only"}, ${x.policyLabel}: ${d === null ? "journey 100 not reached" : `${fmt(d)} more days to journey 100`}` };
  }) }));
  const h = header("H. Cosmetic spending vs progression delay", [
    `Extra days to finish journey 100 compared with the same players buying no cosmetics. Starter catalog: 28 proposed items costing ${fmt(res.cosmeticsCatalogTotal)} Chronons in all. Timing matters more than amount: spending from a surplus costs little, spending during scarcity costs a lot.`]);
  const lg = legend([{ label: "Moderate, walking only", cls: "c1", kind: "box" }, { label: "Moderate, regular missions", cls: "c3", kind: "box" }], 24, h.y + 28, W - 48);
  const p = hbarPanel({ x: 236, y: lg.y + 32, w: W - 236 - 150, rows, max: cap, ticks: [0, 350, 700, 1050, 1400], barHeight: 12, axisLabel: "Extra days to journey 100" });
  return finish("H_cosmetics_delay.svg", "Cosmetic spending versus progression delay", "Grouped horizontal bars of extra days to finish the tour, by cosmetic spending policy, for walking-only and mission players.",
    [...h.parts, ...lg.parts, ...p.parts], p.bottom, data("cosmetics.csv"));
}

function figSourceSink(res) {
  const h = header("I. Source and sink balance over time: Chronons and Energy held", [
    "Median holdings by day, moderate walkers. A rising Energy line is inflation: in the Chronon-bound late game no journey is active, so step Energy has no sink and is spent in one burst when the next price is paid (no cap in this analytical baseline)."]);
  const keys = res.timeline.map((t) => t.key);
  const lg = legend(keys.map((k) => ({ label: KEY_LABEL[k], cls: COHORT_STYLE[k][1] })), 24, h.y + 28, W - 48);
  const top = lg.y + 38;
  const maxC = Math.max(...res.timeline.flatMap((t) => t.chronons)), maxE = Math.max(...res.timeline.flatMap((t) => t.energy));
  const s = (field) => res.timeline.map((t) => ({ label: KEY_LABEL[t.key], cls: COHORT_STYLE[t.key][0], fillCls: COHORT_STYLE[t.key][1], points: t[field].map((v, w) => [w * 7 + 7, v]) }));
  const parts = [...h.parts, ...lg.parts,
    ...linePanel({ x: 72, y: top, w: W - 72 - 40, h: 170, xDomain: [0, 2190], xTicks: dayTicks, xFmt: dayFmt, yTicks: niceTicks(maxC, 4), yLabel: "Chronons held", series: s("chronons") }),
    ...linePanel({ x: 72, y: top + 250, w: W - 72 - 40, h: 170, xDomain: [0, 2190], xTicks: dayTicks, xFmt: dayFmt, yTicks: niceTicks(maxE, 4), yLabel: "Energy held", xLabel: "Time since install", series: s("energy") })];
  return finish("I_source_sink_balance.svg", "Source and sink balance over time", "Two line charts sharing a time axis: median Chronons held and median Energy held by cohort.",
    parts, top + 250 + 170 + 36, data("timeline.csv"));
}

function figHeatmap(res) {
  const hm = res.heatmap, rows = hm.cells, cols = hm.freqs;
  const cw = 70, ch = 30, x0 = 190;
  const h = header("J. Sensitivity: mission frequency x Chronon price growth", [
    "Median journeys completed in the first two years by a moderate walker. Prices grow by the shown factor per journey from a fixed 23-Chronon start (not budget-matched). Missions completed per week are set exactly."]);
  const top = h.y + 52, parts = [...h.parts];
  parts.push(text(x0 + (cols.length * cw) / 2, top - 26, "Missions completed per week", "mu", { size: 11, anchor: "middle" }));
  cols.forEach((m, j) => parts.push(text(x0 + j * cw + cw / 2, top - 8, fmt(m, m % 1 ? 1 : 0), "t2", { size: 12, anchor: "middle" })));
  rows.forEach((row, i) => {
    const y = top + i * ch;
    parts.push(text(x0 - 12, y + ch / 2 + 4, `x${row[0].growth.toFixed(3)} per journey`, "t1", { size: 12, anchor: "end" }));
    row.forEach((c, j) => {
      const bin = Math.min(7, Math.max(1, Math.ceil((c.j730 / 100) * 7)));
      parts.push(`<rect class="h${bin}" x="${x0 + j * cw + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" rx="3"><title>${K.esc(`x${row[0].growth} per journey, ${c.missionsPerWeek} missions a week: ${fmt(c.j730)} journeys in two years`)}</title></rect>`);
      parts.push(text(x0 + j * cw + cw / 2, y + ch / 2 + 4, fmt(c.j730), `ht${bin}`, { size: 12, anchor: "middle" }));
    });
  });
  const ly = top + rows.length * ch + 28;
  parts.push(text(x0 - 12, ly, "Journeys in two years", "mu", { size: 11, anchor: "end" }));
  for (let b = 1; b <= 7; b++) {
    parts.push(`<rect class="h${b}" x="${x0 + (b - 1) * 50}" y="${ly - 11}" width="48" height="14" rx="3"/>`);
    parts.push(text(x0 + (b - 1) * 50 + 24, ly + 16, `${Math.round(((b - 1) * 100) / 7)}-${Math.round((b * 100) / 7)}`, "mu", { size: 10, anchor: "middle" }));
  }
  return finish("J_heatmap_missions_x_price_growth.svg", "Mission frequency by price growth", "Heatmap of median journeys completed in two years for combinations of weekly missions and price growth.",
    parts, ly + 18, data("heatmap.csv"));
}

function figPacing(res) {
  const keys = ["moderate-walking", "moderate-regular-organic"];
  const rows = res.pacing.map((x) => ({ label: `${x.curve} PP, ${x.level} prices`, bars: keys.map((k, i) => {
    const c = x.cohorts.find((y) => y.key === k);
    return { v: c.d100 === null ? 2190 : c.d100, cls: i ? "c3" : "c1", label: c.d100 === null ? `not finished (${fmt(100 * c.tourShare)}% did)` : `${fmt(c.d100)} d`,
      title: `${KEY_LABEL[k]}, ${x.curve} PP and ${x.level} prices: ${c.d100 === null ? "journey 100 not reached by the median player" : `day ${fmt(c.d100)}`}` };
  }) }));
  const h = header("K. Pacing scenarios: tour length vs price level", [
    "Median day a moderate walker finishes journey 100, for three PP pacing curves and three price levels, with prices calibrated to each curve. No completion target is assumed: the figure shows the trade-off, not a recommendation."]);
  const lg = legend([{ label: "Walking only", cls: "c1", kind: "box" }, { label: "Regular organic missions", cls: "c3", kind: "box" }], 24, h.y + 28, W - 48);
  const p = hbarPanel({ x: 200, y: lg.y + 32, w: W - 200 - 150, rows, max: 2190, ticks: [0, 365, 730, 1095, 1460, 1825, 2190], fmt: dayFmt, barHeight: 10, groupGap: 9, axisLabel: "Median day journey 100 is finished" });
  return finish("K_pacing_tradeoffs.svg", "Pacing scenarios", "Grouped horizontal bars of the median day the tour is finished under nine pacing and price combinations.",
    [...h.parts, ...lg.parts, ...p.parts], p.bottom, data("pacing.csv"));
}

function figBalanceSweep(res) {
  const keys = ["moderate-walking", "moderate-regular-organic", "moderate-regular-sponsored", "moderate-direct"];
  const xs = res.balanceSweep.map((b) => b.lateCoverage);
  const mk = (field, scale) => keys.map((k) => ({ label: KEY_LABEL[k], cls: COHORT_STYLE[k][0], fillCls: COHORT_STYLE[k][1],
    points: res.balanceSweep.map((b, i) => [i, scale(b.cohorts.find((c) => c.key === k)[field])]),
    dots: res.balanceSweep.map((b, i) => [i, scale(b.cohorts.find((c) => c.key === k)[field]), `${KEY_LABEL[k]} at late coverage ${b.lateCoverage}: ${fmt(scale(b.cohorts.find((c) => c.key === k)[field]), 0)}`]) }));
  const walkAt = (cov) => res.balanceSweep.find((b) => b.lateCoverage === cov).cohorts.find((c) => c.key === "moderate-walking");
  const h = header("L. Balance sweep: how much late-game scarcity, and who feels it", [
    "Coverage at journey 100 is the Chronons a walking-only player earns during the journey before it, divided by its price; the other anchors stay at the reference. Lower means scarcer.",
    `Walking-only players start to be blocked below a coverage of about 1.0 (${fmt(100 * walkAt(0.9).blockedShare)}% of sessions at 0.9); missions and bundles keep players unblocked to about 0.8.`]);
  const lg = legend(keys.map((k) => ({ label: KEY_LABEL[k], cls: COHORT_STYLE[k][1] })), 24, h.y + 28, W - 48);
  const top = lg.y + 38;
  const xt = xs.map((_, i) => i), xf = (i) => `${xs[i]}`;
  const parts = [...h.parts, ...lg.parts,
    ...linePanel({ x: 72, y: top, w: W - 72 - 60, h: 160, xDomain: [0, xs.length - 1], xTicks: xt, xFmt: xf, yTicks: [0, 20, 40, 60], yFmt: (v) => `${v}%`, yLabel: "Sessions fully blocked (share of active days in the tour)", series: mk("blockedShare", (v) => 100 * v) }),
    ...linePanel({ x: 72, y: top + 240, w: W - 72 - 60, h: 160, xDomain: [0, xs.length - 1], xTicks: xt, xFmt: xf, yTicks: [0, 10, 20, 30], yLabel: "Median wait before journey 100 (days)", xLabel: "Late-game coverage at journey 100", series: mk("wait100", (v) => v || 0) })];
  return finish("L_balance_sweep.svg", "Late-game balance sweep", "Two line charts against late-game coverage: share of fully blocked sessions and median wait before journey 100, by player type.",
    parts, top + 240 + 160 + 36, data("balance_sweep.csv"));
}

function allFigures(res) {
  return [figPriceCurves(res), figPpCurves(res), figSources(res), figBalance(res), figTimeline(res), figWaitStage(res),
    figWaitJourney(res, "key"), figWaitJourney(res, "activity"), figPuzzles(res), figStoreAccess(res), figStoreBusiness(res),
    figCosmetics(res), figSourceSink(res), figHeatmap(res), figPacing(res), figBalanceSweep(res)];
}

module.exports = { allFigures, SHORT, KEY_LABEL };
