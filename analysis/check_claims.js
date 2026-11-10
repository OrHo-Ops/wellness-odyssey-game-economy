/* Check the portfolio documents against the code.
 *
 *     node analysis/check_claims.js
 *
 * 1. The wheel table in analysis/wheel.js reproduces the constants the pilot
 *    engine uses, so the two cannot drift apart.
 * 2. outputs/portfolio/ is exactly what analysis/build_portfolio.js generates
 *    now, so no published figure is stale.
 * 3. Each number quoted in the documents is recomputed here and must appear,
 *    character for character, in the file that quotes it.
 * 4. Every relative link and #anchor in the Markdown documents resolves.
 *
 * Exits non-zero and lists every failure.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const W = require("./wheel.js");
const M = require("../pilot/pilot_model.js");
const { build } = require("./build_portfolio.js");
const C = require("./competition.js");

const ROOT = path.join(__dirname, "..");
const failures = [];
let passed = 0;
const check = (ok, message) => (ok ? passed++ : failures.push(message));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// 1. Wheel table <-> engine constants -----------------------------------------

check(W.V1_OUTCOMES.reduce((s, o) => s + o.weight, 0) === W.TOTAL_WEIGHT, "wheel weights do not sum to 1000");
check(Math.abs(W.ppPerEnergyStaked(W.BASE_STAKE) - M.RULES.expectedPpPerStake) < 1e-12,
  `wheel table gives ${W.ppPerEnergyStaked(W.BASE_STAKE)} PP per staked Energy, engine uses ${M.RULES.expectedPpPerStake}`);
check(Math.abs(1 - W.refundProbability() - M.RULES.expectedEnergySpentPerStake) < 1e-12,
  `wheel table gives ${1 - W.refundProbability()} Energy spent per staked Energy, engine uses ${M.RULES.expectedEnergySpentPerStake}`);
check(JSON.stringify(W.V2_STAKES) === JSON.stringify(M.RULES.wheelStakes), "V2 stakes differ from the engine's stake list");
check(W.BASE_STAKE === M.RULES.ppBaseStake && W.STEPS_PER_ENERGY === M.RULES.stepsPerEnergy, "base stake or steps per Energy differ from the engine");
check(Math.abs(W.costOf(M.RULES.jerusalemJourneyPp, 50).netEnergy - M.wheelSummary(M.buildConfig()).netEnergyForJerusalem) < 1e-9,
  "Jerusalem's net Energy differs between the wheel table and the engine");
for (const s of W.V2_STAKES) {
  check(Math.abs(W.ppPerNetEnergy(s) - W.ppPerNetEnergy(W.BASE_STAKE)) < 1e-12, `return per net Energy differs at stake ${s}`);
  check(W.isWholeNumberStake(s) === (s % 10 === 0), `whole-number rule fails at stake ${s}`);
}

for (const s of W.V2_STAKES) {
  const exact = W.firstPassage(1500, s).attempts, budget = W.costOf(1500, s).attempts;
  const overshoot = exact * W.expectedPp(s) - 1500, largest = Math.max(...W.payoutTable(s).map((x) => x.pp));
  check(overshoot >= 0 && overshoot < largest && exact > budget, `first-passage attempts at stake ${s} imply an impossible overshoot of ${overshoot}`);
}

// 2. Generated outputs are current --------------------------------------------

const { results, files } = build();
for (const [rel, content] of Object.entries(files)) {
  const full = path.join(ROOT, rel);
  check(fs.existsSync(full) && fs.readFileSync(full, "utf8") === content, `${rel} is stale: run node analysis/build_portfolio.js`);
}

// 3. Quoted numbers -------------------------------------------------------------

const f = (x, digits = 0) => x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (x, digits = 0) => `${f(100 * x, digits)}%`;
const metric = (scenario, key, basis = "total") => results[scenario].metrics[key][basis].mean;
const ratio = (scenario, a, b) => metric(scenario, a) / metric(scenario, b);
const regions = Array.from({ length: 7 }, (_, i) => Math.round(1500 * 1.08 ** i));
const cumulative = regions.map((_, i) => regions.slice(0, i + 1).reduce((a, b) => a + b, 0));
const stepsFor = (pp) => f(W.costOf(pp, 50).steps);
const W50 = W.stakeRow(50);

const README = "docs/v1_core_economy.md", WHEEL = "docs/wheel_economics.md", PILOT = "docs/pilot_economy_lab.md", LEGACY = "docs/legacy_case_study_2026-10.md";
const PLAY = "docs/playtest_plan.md", PLANNED = "docs/planned_systems.md", PORTFOLIO = "README.md";
const sameTier = C.sameTierTable();
const tierChoice = C.tierChoiceTable();
const contestRow = (v) => `| ${f(v.lessSteps)} vs ${f(v.moreSteps)} | ${v.byTier.map((t) => pct(t.lessAhead, 1)).join(" | ")} |`;
const choiceOf = (stake) => tierChoice.find((t) => t.stake === stake).lessAhead;
const claims = [
  // Wheel
  [README, `**52.25 PP per 50-Energy spin**`, `**${f(W.expectedPp(50), 2)} PP per 50-Energy spin**`],
  [README, "1.045 PP per Energy staked", `${f(W.ppPerEnergyStaked(50), 3)} PP per Energy staked`],
  [README, "**1.0471 PP per Energy actually spent**", `**${f(W.ppPerNetEnergy(50), 4)} PP per Energy actually spent**`],
  [README, "| Standard deviation | 36.21 |", `| Standard deviation | ${f(W.sdPp(50), 2)} |`],
  [README, "√(4,041.25 − 52.25²)", `√(${f(W.sdPp(50) ** 2 + W.expectedPp(50) ** 2, 2)} − ${f(W.expectedPp(50), 2)}²)`],
  [README, "| Median outcome | 35 PP | 70.2% of attempts", `| Median outcome | ${W.medianPp(50)} PP | ${pct(W.shareBelowMean(50), 1)} of attempts`],
  [README, "| Expected Energy spent | 49.9 |", `| Expected Energy spent | ${f(W50.expectedNetEnergy, 1)} |`],
  [README, "The 250-PP outcome is 3.8% of the mean", `The 250-PP outcome is ${pct(W.payoutTable(50)[6].shareOfExpectedPp, 1)} of the mean`],
  [README, "**The standard deviation is 0.724 × stake.**", `**The standard deviation is ${f(W.sdPp(1), 3)} × stake.**`],
  [README, "at stakes 1–3, **65% of outcomes**", `at stakes 1–3, **${pct(W.fractionalShare(1))} of outcomes**`],
  [README, "| **65%** | **65%** | **65%** | **25%** | 0% |",
    `| **${pct(W.fractionalShare(1))}** | **${pct(W.fractionalShare(2))}** | **${pct(W.fractionalShare(3))}** | **${pct(W.fractionalShare(5))}** | ${pct(W.fractionalShare(10))} |`],
  // V3 tiers: expected PP, the PP-budget approximation and the exact first-passage expectation for Jerusalem
  ...W.V3_TIERS.flatMap((t) => {
    const pays = W.payoutTable(t.stake).filter((x) => !x.refund).map((x) => f(x.pp));
    const ev = f(W.expectedPp(t.stake), t.stake === 100 ? 1 : 2);
    const budget = f(W.costOf(1500, t.stake).attempts, 1);
    const exact = W.firstPassage(1500, t.stake);
    return [
      [README, `| ${pays.join(" · ")} | ${ev} | ≈ ${budget} | ${f(exact.attempts, 2)} |`, `| ${pays.join(" · ")} | ${ev} | ≈ ${budget} | ${f(exact.attempts, 2)} |`],
      [WHEEL, `| ${pays.join(", ")} | ${ev} | ≈ ${budget} | ${f(exact.attempts, 2)} | ${f(exact.netEnergy)} |`,
        `| ${pays.join(", ")} | ${ev} | ≈ ${budget} | ${f(exact.attempts, 2)} | ${f(exact.netEnergy)} |`],
    ];
  }),
  [README, "| 4 · 7 · 10 · 14 · 20 · 30 · 50 | 10.45 | ≈ 143.5 | 144.23 |", `| 4 · 7 · 10 · 14 · 20 · 30 · 50 | 10.45 | ≈ 143.5 | ${f(W.firstPassage(1500, 10).attempts, 2)} |`],
  [README, "| 20 · 35 · 50 · 70 · 100 · 150 · 250 | 52.25 | ≈ 28.7 | 29.40 |", `| 20 · 35 · 50 · 70 · 100 · 150 · 250 | 52.25 | ≈ 28.7 | ${f(W.firstPassage(1500, 50).attempts, 2)} |`],
  [README, "| 40 · 70 · 100 · 140 · 200 · 300 · 500 | 104.5 | ≈ 14.4 | 15.05 |", `| 40 · 70 · 100 · 140 · 200 · 300 · 500 | 104.5 | ≈ 14.4 | ${f(W.firstPassage(1500, 100).attempts, 2)} |`],
  [README, "Overshoot adds about 0.69 attempts at every tier", `Overshoot adds about ${[...new Set(W.V2_STAKES.map((s) => f(W.firstPassage(1500, s).attempts - W.costOf(1500, s).attempts, 2)))].join(" or ")} attempts at every tier`],
  [WHEEL, "Overshoot** adds about 0.69 attempts at every stake", `Overshoot** adds about ${[...new Set(W.V2_STAKES.map((s) => f(W.firstPassage(1500, s).attempts - W.costOf(1500, s).attempts, 2)))].join(" or ")} attempts at every stake`],
  [README, "is 1,439 at Quick, 1,467 at Journey and 1,502 at Epic, against a budget figure of 1,433",
    `is ${f(W.firstPassage(1500, 10).netEnergy)} at Quick, ${f(W.firstPassage(1500, 50).netEnergy)} at Journey and ${f(W.firstPassage(1500, 100).netEnergy)} at Epic, against a budget figure of ${f(W.costOf(1500, 50).netEnergy)}`],
  ...[README, PILOT].map((file) => [file, "Jerusalem costs an expected 1,439 net Energy at Quick Spin and 1,502 at Epic Spin",
    `Jerusalem costs an expected ${f(W.firstPassage(1500, 10).netEnergy)} net Energy at Quick Spin and ${f(W.firstPassage(1500, 100).netEnergy)} at Epic Spin`]),
  [WHEEL, "| **Total** | **1,000** | **100%** | **52.25** | **100%** |", `| **Total** | **${f(W.TOTAL_WEIGHT)}** | **100%** | **${f(W.expectedPp(50), 2)}** | **100%** |`],
  [WHEEL, "| Second moment | E[PP²] = Σ pᵢ·aᵢ² | 4,041.25 |", `| Second moment | E[PP²] = Σ pᵢ·aᵢ² | ${f(W.sdPp(50) ** 2 + W.expectedPp(50) ** 2, 2)} |`],
  [WHEEL, "√1,311.19 | **36.21** |", `√${f(W.sdPp(50) ** 2, 2)} | **${f(W.sdPp(50), 2)}** |`],
  [WHEEL, "52.25 ÷ 0.998 = 52.35", `52.25 ÷ 0.998 = ${f(W.expectedPp(50) / (1 - W.refundProbability()), 2)}`],
  [WHEEL, "about 1,433 net Energy, or 14,325 credited steps", `about ${f(W.costOf(1500, 50).netEnergy)} net Energy, or ${stepsFor(1500)} credited steps`],
  ...W.V2_STAKES.map((s) => {
    const r = W.stakeRow(s);
    return [WHEEL, `| ${f(s)} | ${f(r.stepsPerAttempt)} | ${f(r.minPp, r.minPp % 1 ? 1 : 0)} – ${f(r.maxPp)} |`,
      `| ${f(s)} | ${f(r.stepsPerAttempt)} | ${f(r.minPp, r.minPp % 1 ? 1 : 0)} – ${f(r.maxPp)} |`];
  }),
  ...W.payoutTable(50).filter((x) => !x.refund).map((x) => [WHEEL, `| ${pct(x.shareOfExpectedPp, 1)} |`, `| ${pct(x.shareOfExpectedPp, 1)} |`]),
  // Destinations
  ...regions.map((pp, i) => [README, `| ${f(pp)} | ${f(cumulative[i])} | ${stepsFor(pp)} | ${stepsFor(cumulative[i])} |`,
    `| ${f(pp)} | ${f(cumulative[i])} | ${stepsFor(pp)} | ${stepsFor(cumulative[i])} |`]),
  [LEGACY, "1.0471 PP per net Energy. That is 4.7% more", `${f(W.ppPerNetEnergy(50), 4)} PP per net Energy. That is ${pct(W.ppPerNetEnergy(50) - 1, 1)} more`],
  [LEGACY, "finish dates about 4.5% earlier", `finish dates about ${pct(1 - 1 / W.ppPerNetEnergy(50), 1)} earlier`],
  // Pilot results
  [README, "| Testers with at least one active day | 22.6 | 27.0 | 30.0 |",
    `| Testers with at least one active day | ${["conservative", "baseline", "optimistic"].map((s) => f(metric(s, "everActive"), 1)).join(" | ")} |`],
  [README, "| Testers who finish Jerusalem | 20.6 | 26.8 | 30.0 |",
    `| Testers who finish Jerusalem | ${["conservative", "baseline", "optimistic"].map((s) => f(metric(s, "testersCompletedJerusalem"), 1)).join(" | ")} |`],
  [README, "| Median finishing day, among finishers | 8.2 | 4.4 | 2.9 |",
    `| Median finishing day, among finishers | ${["conservative", "baseline", "optimistic"].map((s) => f(results[s].jerusalemCompletionDayMedian.mean, 1)).join(" | ")} |`],
  [README, "| Active days with nothing to spend Energy on | 63% | 82% | 89% |",
    `| Active days with nothing to spend Energy on | ${["conservative", "baseline", "optimistic"].map((s) => pct(ratio(s, "energyIdleTesterDays", "activeTesterDays"))).join(" | ")} |`],
  [README, "| Unspent Energy at day 28, per active tester | 4,142 | 10,181 | 18,600 |",
    `| Unspent Energy at day 28, per active tester | ${["conservative", "baseline", "optimistic"].map((s) => f(metric(s, "energyBalance", "perActive"))).join(" | ")} |`],
  [README, "| Missions completed | 2.6 | 21.8 | 79.7 |",
    `| Missions completed | ${["conservative", "baseline", "optimistic"].map((s) => f(metric(s, "missionsCompleted"), 1)).join(" | ")} |`],
  [README, "| Testers completing the first puzzle | 0.0 | 1.0 | 16.3 |",
    `| Testers completing the first puzzle | ${["conservative", "baseline", "optimistic"].map((s) => f(metric(s, "puzzlesCompleted"), 1)).join(" | ")} |`],
  [README, "| Chronons earned per active tester (none can be spent) | 0.57 | 4.05 | 13.29 |",
    `| Chronons earned per active tester (none can be spent) | ${["conservative", "baseline", "optimistic"].map((s) => f(metric(s, "chrononsEarned", "perActive"), 2)).join(" | ")} |`],
  [README, "| PP beyond 1,500, per completed journey | 25.6 | 27.3 | 27.4 |",
    `| PP beyond 1,500, per completed journey | ${["conservative", "baseline", "optimistic"].map((s) => f(ratio(s, "ppOvershoot", "journeysCompleted"), 1)).join(" | ")} |`],
  [README, "about 27 of 30 testers finish Jerusalem (an average of 26.8 across 300 simulated pilots), half of them by **day 4.4**, and then **82% of active days**",
    `about ${f(Math.round(metric("baseline", "testersCompletedJerusalem")))} of 30 testers finish Jerusalem (an average of ${f(metric("baseline", "testersCompletedJerusalem"), 1)} across ${f(results.baseline.replications)} simulated pilots), half of them by **day ${f(results.baseline.jerusalemCompletionDayMedian.mean, 1)}**, and then **${pct(ratio("baseline", "energyIdleTesterDays", "activeTesterDays"))} of active days**`],
  [README, "Tester counts are averages across 300 simulated 30-tester pilots", `Tester counts are averages across ${f(results.baseline.replications)} simulated 30-tester pilots`],
  [README, "It is under 0.3% of Energy credited even in the optimistic scenario",
    `It is under ${pct(Math.ceil(1000 * metric("optimistic", "puzzleBonusEnergy") / (metric("optimistic", "energyCredited") + metric("optimistic", "puzzleBonusEnergy"))) / 1000, 1)} of Energy credited even in the optimistic scenario`],
  [README, "In the baseline, 41% of steps fall on days without a session", `In the baseline, ${pct(ratio("baseline", "stepsNeverSynced", "stepsWalked"))} of steps fall on days without a session`],
  [README, "About 27 PP, 1.8% of a journey", `About ${f(ratio("baseline", "ppOvershoot", "journeysCompleted"))} PP, ${pct(ratio("baseline", "ppOvershoot", "journeysCompleted") / 1500, 1)} of a journey`],
  [PILOT, "That is about 27 PP per completed journey in every scenario, 1.8% of 1,500",
    `That is about ${f(ratio("baseline", "ppOvershoot", "journeysCompleted"))} PP per completed journey in every scenario, ${pct(ratio("baseline", "ppOvershoot", "journeysCompleted") / 1500, 1)} of 1,500`],
  [README, "with four, about 1 tester in 30 completes it", `with four, about ${f(metric("baseline", "puzzlesCompleted"))} tester in 30 completes it`],
  // PP contests (planned leagues and duels)
  ...[README, PLANNED].flatMap((file) => [
    [file, "| 10,000 vs 11,000 | 15.7% | 32.1% | 36.5% |", contestRow(sameTier[0])],
    [file, "| 50,000 vs 55,000 | 1.3% | 15.7% | 23.7% |", contestRow(sameTier[1])],
    [file, "| 100,000 vs 110,000 | 0.1% | 7.8% | 15.7% |", contestRow(sameTier[2])],
  ]),
  [PLANNED, "| Chance of finishing ahead | 9.9% | 15.7% | 20.2% |", `| Chance of finishing ahead | ${[10, 50, 100].map((s) => pct(choiceOf(s), 1)).join(" | ")} |`],
  [README, "raises their chance from 15.7% to 20.2%", `raises their chance from ${pct(choiceOf(50), 1)} to ${pct(choiceOf(100), 1)}`],
  [PLANNED, "Ties are under 1.3% in every cell", `Ties are under ${pct(Math.ceil(1000 * Math.max(...sameTier.flatMap((v) => v.byTier.map((t) => t.level)))) / 1000, 1)} in every cell`],
  [README, "every 15.7% cell is 100 spins against 110",
    `every ${pct(sameTier[0].byTier[0].lessAhead, 1)} cell is ${sameTier[0].lessSteps / 10 / 10} spins against ${sameTier[0].moreSteps / 10 / 10}`],
  // "About a third" in the README and planned systems: Journey Spin at 10,000 vs 11,000 steps
  [README, "about a third of the time at 10,000 steps", Math.abs(sameTier[0].byTier[1].lessAhead - 1 / 3) < 0.02 ? "about a third of the time at 10,000 steps" : "not about a third"],
  [PLANNED, "still wins about a third of the time at 10,000 steps", Math.abs(sameTier[0].byTier[1].lessAhead - 1 / 3) < 0.02 ? "still wins about a third of the time at 10,000 steps" : "not about a third"],
  // Sampling margin quoted in the playtest plan and the README
  [PLAY, "has a 95% margin of about ±18 percentage points", `has a 95% margin of about ±${f(100 * 1.96 * Math.sqrt(0.25 / 30))} percentage points`],
  [README, "has a 95% margin of about ±18 points", `has a 95% margin of about ±${f(100 * 1.96 * Math.sqrt(0.25 / 30))} points`],
  // The portfolio README at the repository root
  [PORTFOLIO, "**52.25 PP per 50-Energy spin**", `**${f(W.expectedPp(50), 2)} PP per 50-Energy spin**`],
  [PORTFOLIO, "That is 1.045 PP per Energy staked, or 1.0471 PP per Energy actually spent",
    `That is ${f(W.ppPerEnergyStaked(50), 3)} PP per Energy staked, or ${f(W.ppPerNetEnergy(50), 4)} PP per Energy actually spent`],
  [PORTFOLIO, "payouts from 20 to 250 PP and a 0.2% free respin",
    `payouts from ${f(W.stakeRow(50).minPp)} to ${f(W.stakeRow(50).maxPp)} PP and a ${pct(W.refundProbability(), 1)} free respin`],
  [PORTFOLIO, "at stakes 1–3, **65% of outcomes**", `at stakes 1–3, **${pct(W.fractionalShare(1))} of outcomes**`],
  [PORTFOLIO, "about 27 of 30 synthetic testers finish the first journey (an average of 26.8 across 300 simulated pilots), half of them by **day 4.4**",
    `about ${f(Math.round(metric("baseline", "testersCompletedJerusalem")))} of 30 synthetic testers finish the first journey (an average of ${f(metric("baseline", "testersCompletedJerusalem"), 1)} across ${f(results.baseline.replications)} simulated pilots), half of them by **day ${f(results.baseline.jerusalemCompletionDayMedian.mean, 1)}**`],
  [PORTFOLIO, "**52.25 PP** per 50-Energy spin, exactly", `**${f(W.expectedPp(50), 2)} PP** per 50-Energy spin, exactly`],
  [PORTFOLIO, "made **65%** of rewards at stakes 1–3 fractional", `made **${pct(W.fractionalShare(1))}** of rewards at stakes 1–3 fractional`],
  [PORTFOLIO, "do so by **day 4.4**, and **82%** of active days then leave Energy with nothing to buy",
    `do so by **day ${f(results.baseline.jerusalemCompletionDayMedian.mean, 1)}**, and **${pct(ratio("baseline", "energyIdleTesterDays", "activeTesterDays"))}** of active days then leave Energy with nothing to buy`],
  [PORTFOLIO, "Simulated: 300 synthetic 30-tester pilots", `Simulated: ${f(results.baseline.replications)} synthetic 30-tester pilots`],
  [PORTFOLIO, "**82% of active days**", `**${pct(ratio("baseline", "energyIdleTesterDays", "activeTesterDays"))} of active days**`],
  [PORTFOLIO, "still finishes ahead on PP 32.1% of the time on Journey Spin", `still finishes ahead on PP ${pct(sameTier[0].byTier[1].lessAhead, 1)} of the time on Journey Spin`],
  [PORTFOLIO, "raises their chance from 15.7% to 20.2%", `raises their chance from ${pct(choiceOf(50), 1)} to ${pct(choiceOf(100), 1)}`],
];
for (const [file, quoted, computed] of claims) {
  check(quoted === computed, `${file}: quoted "${quoted}" but the code gives "${computed}"`);
  check(read(file).includes(quoted), `${file}: does not contain "${quoted}"`);
}

// 4. Links and anchors ------------------------------------------------------------

/** Exists with exactly this case, segment by segment: GitHub serves paths case-sensitively. */
function existsExact(rel) {
  let dir = ROOT;
  for (const seg of rel.split("/").filter((x) => x && x !== ".")) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory() || !fs.readdirSync(dir).includes(seg)) return false;
    dir = path.join(dir, seg);
  }
  return true;
}
const slug = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
const anchors = (rel) => new Set(read(rel).split("\n").filter((l) => /^#{1,6} /.test(l)).map((l) => slug(l.replace(/^#+ /, ""))));
const PAGES = "https://orho-ops.github.io/wellness-odyssey-game-economy/";
const markdown = ["README.md", ...fs.readdirSync(path.join(ROOT, "docs")).filter((n) => n.endsWith(".md")).map((n) => `docs/${n}`)];
for (const rel of markdown) {
  const text = read(rel).replace(/```[\s\S]*?```/g, "");
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (target.startsWith(PAGES)) {
      // A live lab link must name a file this repository publishes, with exact case.
      const file = target.slice(PAGES.length).split("#")[0];
      check(existsExact(file || "index.html"), `${rel}: live link to a missing file ${target}`);
      continue;
    }
    if (/^[a-z]+:/i.test(target)) continue;
    const [file, anchor] = target.split("#");
    const resolved = file ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), file)) : rel;
    const exists = existsExact(resolved);
    check(exists, `${rel}: broken link ${target}`);
    if (exists && anchor && resolved.endsWith(".md")) check(anchors(resolved).has(anchor), `${rel}: missing anchor ${target}`);
  }
  for (const [, src] of text.matchAll(/<img [^>]*src="([^"]+)"/g)) {
    check(existsExact(path.posix.normalize(path.posix.join(path.posix.dirname(rel), src))), `${rel}: broken image ${src}`);
  }
}
for (const [, target] of read("index.html").matchAll(/(?:href|src)="([^"#]+)/g)) {
  if (/^[a-z]+:/i.test(target)) continue;
  check(existsExact(path.posix.normalize(target)), `index.html: broken link ${target}`);
}

console.log(`${passed} checks passed, ${failures.length} failed${failures.length ? ":" : "."}`);
for (const message of failures) console.log(`  FAIL ${message}`);
process.exitCode = failures.length ? 1 : 0;
