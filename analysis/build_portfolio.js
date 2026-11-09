/* Regenerate the portfolio tables and figures in outputs/portfolio/.
 *
 *     node analysis/build_portfolio.js
 *
 * Every number comes from analysis/wheel.js (the reviewed wheel table), from
 * analysis/competition.js (exact contest odds derived from that table) or from
 * a run of the unchanged pilot engine (pilot/pilot_model.js) at its default
 * settings: three scenarios, 300 synthetic cohorts each, seed 2026. Nothing is
 * typed in by hand. The output is deterministic, so a rerun on any machine
 * produces byte-identical files, and analysis/check_claims.js uses that to
 * detect a stale figure.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const W = require("./wheel.js");
const M = require("../pilot/pilot_model.js");
const C = require("./competition.js");

const OUT = "outputs/portfolio";
/** Jerusalem's PP requirement, as the engine holds it. */
const JERUSALEM_PP = M.RULES.jerusalemJourneyPp;
const SCENARIOS = ["conservative", "baseline", "optimistic"];
const SCENARIO_LABEL = { conservative: "Conservative", baseline: "Baseline", optimistic: "Optimistic" };

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function runScenarios() {
  return Object.fromEntries(SCENARIOS.map((s) => [s, M.runPilot(M.buildConfig(s))]));
}

/** The headline pilot metrics, as the README and the pilot doc report them. */
function scenarioMetrics(res) {
  const m = res.metrics;
  const mean = (key, basis = "total") => m[key][basis].mean;
  return [
    ["testers_with_an_active_day", mean("everActive")],
    ["testers_finishing_jerusalem", mean("testersCompletedJerusalem")],
    ["median_finishing_day", res.jerusalemCompletionDayMedian.mean],
    ["share_of_active_days_with_nothing_to_buy", mean("energyIdleTesterDays") / mean("activeTesterDays")],
    ["energy_credited_per_enrolled_tester", mean("energyCredited", "perEnrolled")],
    ["energy_credited_per_active_tester", mean("energyCredited", "perActive")],
    ["energy_unspent_at_day_28_per_active_tester", mean("energyBalance", "perActive")],
    ["missions_discovered", mean("missionsDiscovered")],
    ["missions_accepted", mean("missionsAccepted")],
    ["missions_completed", mean("missionsCompleted")],
    ["tiles_revealed", mean("tilesRevealed")],
    ["testers_completing_the_puzzle", mean("puzzlesCompleted")],
    ["chronons_earned_per_active_tester", mean("chrononsEarned", "perActive")],
    ["chronons_spent", mean("chrononsSpent")],
    ["pp_overshoot_per_completed_journey", mean("ppOvershoot") / mean("journeysCompleted")],
    ["share_of_steps_never_synced", mean("stepsNeverSynced") / mean("stepsWalked")],
    ["puzzle_bonus_share_of_energy", mean("puzzleBonusEnergy") / (mean("energyCredited") + mean("puzzleBonusEnergy"))],
  ];
}

const num = (x, digits) => (Number.isFinite(x) ? x.toFixed(digits) : "");

function csv(header, rows) {
  return [header, ...rows].map((r) => r.join(",")).join("\n") + "\n";
}

function wheelOutcomesCsv() {
  const rows = W.payoutTable(W.BASE_STAKE).map((x, i) => [
    x.refund ? "refund" : x.basePp, W.V1_OUTCOMES[i].weight, num(x.probability, 3), num(x.shareOfExpectedPp, 4),
    ...W.V3_TIERS.map((t) => (x.refund ? "stake returned" : num(W.payoutTable(t.stake)[i].pp, 1))),
  ]);
  return csv(["base_pp", "weight_of_1000", "probability", "share_of_expected_pp", ...W.V3_TIERS.map((t) => `pp_at_stake_${t.stake}`)], rows);
}

function wheelByStakeCsv() {
  const status = (s) => [W.V3_TIERS.some((t) => t.stake === s) ? "V3 tier (demo)" : "", W.V2_STAKES.includes(s) ? "V2 stake (dev flag)" : "",
    s === W.BASE_STAKE ? "V1 production" : ""].filter(Boolean).join("; ");
  const rows = W.V2_STAKES.map((s) => {
    const r = W.stakeRow(s);
    const budget = W.costOf(JERUSALEM_PP, s), exact = W.firstPassage(JERUSALEM_PP, s);
    return [s, `"${status(s)}"`, r.stepsPerAttempt, num(r.minPp, 1), num(r.maxPp, 1), num(r.expectedPp, 3), num(r.sdPp, 3),
      num(r.expectedNetEnergy, 3), num(r.ppPerEnergyStaked, 4), num(r.ppPerNetEnergy, 10), num(r.fractionalShare, 3), r.wholeNumber,
      num(budget.attempts, 3), num(exact.attempts, 3), num(budget.netEnergy, 2), num(exact.netEnergy, 2)];
  });
  return csv(["stake", "status", "steps_per_attempt", "min_pp", "max_pp", "expected_pp", "sd_pp", "expected_net_energy",
    "pp_per_energy_staked", "pp_per_net_energy", "share_of_fractional_outcomes", "all_payouts_whole",
    "jerusalem_attempts_pp_budget", "jerusalem_attempts_exact", "jerusalem_net_energy_pp_budget", "jerusalem_net_energy_exact"], rows);
}

/** A PP-scored contest between a player and one who walked 10% more: the wheel's share of the outcome. */
function ppContestCsv() {
  const row = (comparison, lessSteps, lessTier, moreTier, r) => [comparison, lessSteps, C.MORE_PERCENT * lessSteps / 100, lessTier.stake, moreTier.stake,
    num(r.lessAhead, 4), num(r.level, 4), num(r.moreAhead, 4)];
  const journey = W.V3_TIERS.find((t) => t.stake === W.BASE_STAKE);
  const rows = [
    ...C.sameTierTable().flatMap((v) => v.byTier.map((t) => row("same tier", v.lessSteps, t, t, t))),
    ...C.tierChoiceTable().map((t) => row("less active player chooses", 50000, t, journey, t)),
  ];
  return csv(["comparison", "less_active_steps", "more_active_steps", "less_active_stake", "more_active_stake",
    "p_less_active_ahead", "p_level", "p_more_active_ahead"], rows);
}

function pilotScenariosCsv(results) {
  const table = SCENARIOS.map((s) => scenarioMetrics(results[s]));
  const rows = table[0].map(([key], i) => [key, ...table.map((t) => num(t[i][1], 4))]);
  return csv(["metric", ...SCENARIOS], rows);
}

function pilotDailyCsv(results) {
  const rows = [];
  for (const s of SCENARIOS) {
    const r = results[s], n = r.cfg.enrolledTesters;
    r.dailyOut.jerusalemCompleted.forEach((done, d) => {
      const e = r.dailyOut.energy.perActive[d];
      rows.push([s, d + 1, num(done.mean / n, 4), num(done.p10 / n, 4), num(done.p90 / n, 4), num(e.mean, 1), num(e.p10, 1), num(e.p90, 1)]);
    });
  }
  return csv(["scenario", "day", "share_finished_jerusalem_mean", "share_finished_jerusalem_p10", "share_finished_jerusalem_p90",
    "unspent_energy_per_active_tester_mean", "unspent_energy_per_active_tester_p10", "unspent_energy_per_active_tester_p90"], rows);
}

// ---------------------------------------------------------------------------
// SVG figures. Light surface by default, a stepped dark palette when the
// viewer's system is dark. Every series is directly labelled and every figure
// has a CSV beside it, so colour never carries identity alone.
// ---------------------------------------------------------------------------

const STYLE = `<style>
.bg{fill:#fcfcfb}.t1{fill:#0b0b0b}.t2{fill:#52514e}.mu{fill:#898781}
.grid{stroke:#e1e0d9;stroke-width:1}.axis{stroke:#c3c2b7;stroke-width:1}
.f1{fill:#2a78d6}.f2{fill:#eb6834}.f3{fill:#1baf7a}.s1{stroke:#2a78d6}.s2{stroke:#eb6834}.s3{stroke:#1baf7a}
text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
@media (prefers-color-scheme: dark){
.bg{fill:#1a1a19}.t1{fill:#f0efec}.t2{fill:#c3c2b7}.grid{stroke:#2c2c2a}.axis{stroke:#383835}
.f1{fill:#3987e5}.f2{fill:#d95926}.f3{fill:#199e70}.s1{stroke:#3987e5}.s2{stroke:#d95926}.s3{stroke:#199e70}}
</style>`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (x) => Math.round(x * 10) / 10;

function svgDoc(width, height, title, desc, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title>
<desc id="desc">${esc(desc)}</desc>
${STYLE}
<rect class="bg" width="${width}" height="${height}" rx="8"/>
${body}
</svg>
`;
}

function text(x, y, s, cls, opts = {}) {
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : "";
  const weight = opts.bold ? ` font-weight="600"` : "";
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${opts.size || 12}" class="${cls}"${anchor}${weight}>${esc(s)}</text>`;
}

/** A horizontal bar: square at the baseline, 4px rounded at the data end. */
function hbar(x, y, w, h, cls) {
  const r = Math.min(4, w / 2, h / 2);
  return `<path class="${cls}" d="M${r1(x)},${r1(y)}H${r1(x + w - r)}A${r},${r} 0 0 1 ${r1(x + w)},${r1(y + r)}V${r1(y + h - r)}A${r},${r} 0 0 1 ${r1(x + w - r)},${r1(y + h)}H${r1(x)}Z"/>`;
}

function wheelFigure() {
  const width = 760, rowH = 30, top = 108, left = 196, plotW = 330;
  const rows = W.payoutTable(W.BASE_STAKE);
  const height = top + rows.length * rowH + 58;
  const maxP = 0.3;
  const xOf = (p) => left + (p / maxP) * plotW;
  const parts = [
    text(24, 34, "Production Wheel V1: what one 50-Energy spin pays", "t1", { size: 17, bold: true }),
    text(24, 56, `Expected ${num(W.expectedPp(50), 2)} PP per spin, standard deviation ${num(W.sdPp(50), 1)}. ` +
      `Median ${W.medianPp(50)} PP: ${Math.round(100 * W.shareBelowMean(50))}% of spins pay less than the mean.`, "t2", { size: 12.5 }),
    text(24, top - 16, "Outcome", "mu", { size: 11 }),
    text(left, top - 16, "Probability", "mu", { size: 11 }),
    text(width - 24, top - 16, "Share of expected PP", "mu", { size: 11, anchor: "end" }),
  ];
  for (const p of [0, 0.1, 0.2, 0.3]) {
    parts.push(`<line class="grid" x1="${r1(xOf(p))}" y1="${top - 6}" x2="${r1(xOf(p))}" y2="${top + rows.length * rowH}"/>`);
    parts.push(text(xOf(p), top + rows.length * rowH + 16, `${Math.round(p * 100)}%`, "mu", { size: 11, anchor: "middle" }));
  }
  rows.forEach((x, i) => {
    const y = top + i * rowH;
    const label = x.refund ? "Free respin: stake returned" : `${x.basePp} PP`;
    parts.push(text(24, y + 19, label, "t1", { size: 13 }));
    parts.push(hbar(left, y + 6, Math.max(xOf(x.probability) - left, 1.5), rowH - 12, "f1"));
    parts.push(text(xOf(x.probability) + 8, y + 19, `${num(100 * x.probability, 1)}%`, "t1", { size: 12.5 }));
    parts.push(text(width - 24, y + 19, x.refund ? "0%" : `${num(100 * x.shareOfExpectedPp, 1)}%`, "t2", { size: 12.5, anchor: "end" }));
  });
  parts.push(`<line class="axis" x1="${left}" y1="${top - 6}" x2="${left}" y2="${top + rows.length * rowH}"/>`);
  parts.push(text(24, height - 18, "Weights out of 1,000, from the game's server code. Data: outputs/portfolio/wheel_outcomes.csv · analysis/wheel.js", "mu", { size: 11 }));
  return svgDoc(width, height, "Production Wheel V1 outcome probabilities",
    "Horizontal bars of the probability of each of the eight wheel outcomes at the 50-Energy base stake, with each outcome's share of the expected Progress Points.",
    parts.join("\n"));
}

/** Line chart over the pilot days, one line and one 10th-90th percentile band per scenario. */
function lineFigure({ title, subtitle, results, pick, yMax, yStep, yFormat, note, desc, file }) {
  const width = 760, height = 400, left = 64, right = 132, top = 104, bottom = 54;
  const plotW = width - left - right, plotH = height - top - bottom;
  const days = results.baseline.cfg.pilotDays;
  const xOf = (day) => left + ((day - 1) / (days - 1)) * plotW;
  const yOf = (v) => top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const parts = [text(24, 34, title, "t1", { size: 17, bold: true }), text(24, 56, subtitle, "t2", { size: 12.5 })];

  let lx = 24; // legend row, in fixed scenario order
  SCENARIOS.forEach((s, i) => {
    parts.push(`<rect class="f${i + 1}" x="${lx}" y="72" width="14" height="4" rx="2"/>`);
    parts.push(text(lx + 20, 78, SCENARIO_LABEL[s], "t2", { size: 12 }));
    lx += 20 + SCENARIO_LABEL[s].length * 7 + 26;
  });
  parts.push(text(lx, 78, "Band: 10th–90th percentile of cohorts", "mu", { size: 11 }));

  for (let v = 0; v <= yMax + 1e-9; v += yStep) {
    parts.push(`<line class="${v === 0 ? "axis" : "grid"}" x1="${left}" y1="${r1(yOf(v))}" x2="${left + plotW}" y2="${r1(yOf(v))}"/>`);
    parts.push(text(left - 8, yOf(v) + 4, yFormat(v), "mu", { size: 11, anchor: "end" }));
  }
  for (const day of [1, 7, 14, 21, 28].filter((d) => d <= days)) {
    parts.push(text(xOf(day), top + plotH + 18, `Day ${day}`, "mu", { size: 11, anchor: "middle" }));
  }

  const ends = [];
  SCENARIOS.forEach((s, i) => {
    const pts = pick(results[s]);
    const band = pts.map((p, d) => `${r1(xOf(d + 1))},${r1(yOf(p.p90))}`).concat(
      pts.map((p, d) => `${r1(xOf(d + 1))},${r1(yOf(p.p10))}`).reverse());
    parts.push(`<polygon class="f${i + 1}" fill-opacity="0.12" points="${band.join(" ")}"/>`);
    const line = pts.map((p, d) => `${d ? "L" : "M"}${r1(xOf(d + 1))},${r1(yOf(p.mean))}`).join("");
    parts.push(`<path class="s${i + 1}" fill="none" stroke-width="2" stroke-linejoin="round" d="${line}"/>`);
    ends.push({ i, s, y: yOf(pts[pts.length - 1].mean), value: pts[pts.length - 1].mean });
  });
  ends.sort((a, b) => a.y - b.y); // keep direct labels at least 15px apart
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 15);
  for (const e of ends) {
    parts.push(text(left + plotW + 8, e.y + 4, `${SCENARIO_LABEL[e.s]} ${yFormat(e.value, true)}`, "t1", { size: 12 }));
  }
  parts.push(text(24, height - 14, note, "mu", { size: 11 }));
  return [file, svgDoc(width, height, title, desc, parts.join("\n"))];
}

function pilotFigures(results) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const energy = (v) => Math.round(v).toLocaleString("en-US");
  const source = "Synthetic testers: 300 cohorts of 30 per scenario, seed 2026. Data: outputs/portfolio/pilot_daily.csv";
  const median = (s) => num(results[s].jerusalemCompletionDayMedian.mean, 1);
  return [
    lineFigure({
      file: "pilot_jerusalem_completion.svg",
      title: "Share of enrolled testers who have finished Jerusalem (1,500 PP)",
      subtitle: `Median finishing day among finishers: ${median("conservative")} conservative, ${median("baseline")} baseline, ${median("optimistic")} optimistic.`,
      results, yMax: 1, yStep: 0.25, yFormat: pct, note: source,
      pick: (r) => r.dailyOut.jerusalemCompleted.map((x) => ({ mean: x.mean / r.cfg.enrolledTesters, p10: x.p10 / r.cfg.enrolledTesters, p90: x.p90 / r.cfg.enrolledTesters })),
      desc: "Three lines, one per behavioural scenario, showing the share of the 30 synthetic testers who have completed the Jerusalem journey on each pilot day.",
    }),
    lineFigure({
      file: "pilot_unspent_energy.svg",
      title: "Unspent Energy per active tester, by pilot day",
      subtitle: "Once Jerusalem is finished nothing else can be bought, so walking keeps adding Energy with no sink.",
      results, yMax: 25000, yStep: 5000, yFormat: energy, note: source,
      pick: (r) => r.dailyOut.energy.perActive,
      desc: "Three lines, one per behavioural scenario, showing average unspent Energy per active synthetic tester on each pilot day.",
    }),
  ];
}

// ---------------------------------------------------------------------------

/** Every generated file, as { relativePath: content }. */
function build() {
  const results = runScenarios();
  const files = {
    "wheel_outcomes.csv": wheelOutcomesCsv(),
    "wheel_by_stake.csv": wheelByStakeCsv(),
    "pp_contest_odds.csv": ppContestCsv(),
    "pilot_scenarios.csv": pilotScenariosCsv(results),
    "pilot_daily.csv": pilotDailyCsv(results),
    "wheel_outcomes.svg": wheelFigure(),
    ...Object.fromEntries(pilotFigures(results)),
  };
  return { results, files: Object.fromEntries(Object.entries(files).map(([k, v]) => [`${OUT}/${k}`, v])) };
}

module.exports = { build, scenarioMetrics, SCENARIOS, OUT };

if (require.main === module) {
  const root = path.join(__dirname, "..");
  const { files } = build();
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
    console.log(`wrote ${rel}`);
  }
}
