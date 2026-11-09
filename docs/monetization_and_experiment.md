# Location-Based Monetization and a Post-Launch Experiment

> **Historical commercial hypothesis (October 2026).** This page belongs to the [legacy seven-region analysis](legacy_case_study_2026-10.md).
> - **Its unit is an arrival.** It prices sponsored *arrival* quests: a verified visit to a destination.
> - **The newer concept is a walk.** [Sponsored walking missions](v1_core_economy.md#72-future-vision-puzzles-and-sponsored-walking-missions-planned) reward a *walked route* with puzzle pieces and Chronons, so the unit economics below do not carry over unchanged.
> - **The planned commercial model has moved on.** It is now a Wellness Store and Chronon purchases that buy access and cosmetics, never progress: see [planned systems §3](planned_systems.md#3-the-wellness-store).
> - **What still applies:** the pricing comparison, the risks and the non-inferiority experiment design remain useful as method.
> - **Its quest Energy figures** come from the legacy model's illustrative wheel.

> **Everything on this page is a proposal.** Wellness Odyssey has no merchants, no sponsorship agreements and no revenue. No experiment has been run. Every commercial number below is a hypothetical placeholder, listed in [`assumptions.csv`](../assumptions.csv) with the status `hypothetical`.

## 1. The concept

Players already walk to earn progress. A location quest gives that walk a destination: start the quest, travel there, and claim a reward on arrival. If a local business sponsors the quest, the same mechanic becomes a way to bring interested people to its door.

| Who | What they get |
|---|---|
| Player | A destination worth walking to, extra Energy, and a collectible that only quests award |
| Business | Visits it can count, from people who chose to come |
| Game | B2B revenue that does not depend on selling currency or showing ads |

**Where this stands.** Location quests with verified arrival and a walking bonus exist in the game today, and they are not sponsored. Sponsorship is a concept, not a built feature. The pricing comparison, unit economics and experiment below are proposals.

## 2. Three commercial models

| | Fixed sponsorship fee | Cost per verified visit | Hybrid |
|---|---|---|---|
| **Revenue mechanism** | Flat monthly fee to feature a quest | Fee for each verified arrival | Smaller monthly fee plus a lower fee per arrival |
| **Business incentive** | Easy to budget, but pays the same whether ten people come or sixty | Pays only for results and carries no volume risk | Shares the risk; the fixed part signals commitment |
| **Measurement challenge** | Billing needs no measurement, but renewal still depends on showing visits | Every bill rests on visit verification, so a disputed or faked visit is a revenue problem | Same as per visit, with less money riding on each arrival |
| **Operational complexity** | Low: one invoice | High: verification, per-visit billing, budget caps, disputes | Highest: both systems |
| **Main risk** | Mispriced by design. Quiet locations overpay and leave; busy ones underpay | Revenue moves with player numbers, and the game carries servicing cost when volume is low | Hardest to explain and sell |

## 3. Illustrative unit economics

A one-month, single-city pilot. All inputs are hypothetical.

| Input | Value |
|---|---|
| Sponsored quests (one merchant each) | 20 |
| Monthly active players in the city | 5,000 |
| Eligible: location permission on and a sponsored quest within reach | 40% |
| Eligible players who start at least one sponsored quest | 25% |
| Sponsored quests started per participating player | 2 |
| Started quests that end in a verified arrival | 50% |
| **Verified visits** | **500 a month, 25 per quest** |
| Prices | Fixed $150 per quest · $2.00 per visit · Hybrid $50 + $1.25 per visit |
| Costs | $40 per quest for servicing · $0.25 per visit for verification and billing |

**Result at 25 visits per quest** (monthly, all 20 quests):

| Model | Revenue | Operating cost | Contribution | Margin | Merchant's cost per visit |
|---|---|---|---|---|---|
| Fixed fee | $3,000 | $925 | $2,075 | 69% | $6.00 |
| Per verified visit | $1,000 | $925 | $75 | 7.5% | $2.00 |
| Hybrid | $1,625 | $925 | $700 | 43% | $3.25 |

**The same pilot at other volumes.** Contribution, with the merchant's cost per visit in brackets:

| Visits per quest per month | Fixed fee | Per verified visit | Hybrid |
|---|---|---|---|
| 10 | $2,150 ($15.00) | −$450 ($2.00) | $400 ($6.25) |
| 25 | $2,075 ($6.00) | $75 ($2.00) | $700 ($3.25) |
| 60 | $1,900 ($2.50) | $1,300 ($2.00) | $1,400 ($2.08) |

What the table says:

- **The models differ in who carries volume risk.** The fixed fee looks best for the game at all three volumes, but only because the merchant absorbs the risk: at 10 visits it pays $15 per visitor and is unlikely to renew.
- **Per-visit pricing has a break-even volume.** Each visit contributes $1.75 ($2.00 − $0.25), so a quest needs about 23 visits a month to cover its $40 servicing cost. Below that the game pays to run it.
- **The hybrid never loses money on a quest** under these inputs and keeps the merchant's cost per visit within a moderate range.

**What quest rewards do to progression.** A quest arrival pays 150 Energy, plus a walking bonus: 26 more if about 1,300 steps, roughly 1 km, are walked on the way. That is 176 Energy, about 3.5 paid spins, or 176 Progress Points under the illustrative reward table the simulation uses. The simulated scenario gives every player two arrivals a week on average, which is an assumption about behaviour. It adds about 50 Energy a day, one extra paid spin, whatever the player's activity level.

| Profile | Energy income per day | Paid spins per day | Median day all seven regions are complete |
|---|---|---|---|
| Low · 3,000 steps | 323 → 374 (+16%) | 6.5 → 7.5 | 42\* → 36\*, 6 days earlier |
| Moderate · 6,000 | 602 → 650 (+8%) | 12.0 → 13.0 | 23 → 21, 2 days earlier |
| High · 10,000 | 743 → 797 (+7%) | 14.8 → 15.9 | 19 → 17, 2 days earlier |

\* Projected: later than the 28-day reported window. Medians are whole days and can move by one with the random seed.

These effects are not negligible, and they are not the same for every player:

- **Low activity: a material acceleration.** A flat reward is a larger share of a smaller income. For this profile two arrivals a week are the second-largest lever tested, after the personal-goal setting (+30%). The projected finish comes forward by about six days, and by day 28 these players have completed 5.2 regions instead of 4.6.
- **Moderate and high activity: smaller, and in an unhelpful direction.** The gain is 8% and 7% of income, but these players already run out of content around day 23 and day 19, and the scenario brings that forward by about two days.
- **Fairness cuts both ways.** The same numbers are the gap between a player who completes two quests a week and one who cannot travel or prefers not to share location.
- **Everything scales with frequency.** Each weekly arrival is worth about 25 Energy a day, so the effect on income is proportional to how often players complete quests, and that frequency is unknown. For scale, the pilot in this section assumes one verified sponsored visit per participating player per month. That is 176 Energy a month, under 2% of even the Low profile's income.

The Energy a sponsored quest pays is therefore a balancing parameter, to be set against a target game length. It cannot be assumed to be too small to matter. For that reason the experiment in section 6 gives a sponsored quest the same reward as a regular one and tracks regions completed.

## 4. Strategic risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **GPS spoofing and fraudulent visits** | With per-visit billing, every fake arrival becomes a charge to a merchant | Bill only visits that pass stronger verification than a location check alone; cap billable visits per player and per merchant; audit outliers. The game's own anti-fraud rules are deliberately not described here |
| **Privacy and consent** | Location is sensitive, and merchants will ask for data | Use location only while the player is looking at quests; give merchants counts, never individual trails; make sponsored offers opt-in |
| **Poorly targeted destinations** | An irrelevant quest wastes the slot and teaches players to ignore quests | Limit sponsored quests by distance and category; rank them by observed completion; rotate |
| **Excessive commercial pressure** | Too many sponsored slots turn a walking game into an ad feed | At most one labelled sponsored slot at a time; frequency caps; a hide option; no quest is ever required for progress |
| **Merchant ROI uncertainty** | A verified arrival is not a purchase | Start with pay-per-visit and budget caps; report redemptions where the merchant can record them; keep contracts short |
| **Accessibility and fairness** | Players who cannot travel, live far from sponsors or decline location sharing must not fall behind | Decide how large a gap is acceptable and size quest Energy to it: in the scenario above a player who completes two quests a week earns 7–16% more Energy than one who completes none, about six projected days for the low-activity profile. Arrival by any travel mode already counts, and no quest gates progression |
| **Monetization undermining the health value** | If rewards favour driving to shops over walking, this stops being a health product | Keep the walking bonus so that walking there pays more than driving; make daily steps a guardrail in the experiment; refuse sponsors that conflict with the health positioning |

## 5. Recommendation: what to test first

**Test cost per verified visit first, with a monthly budget cap for each merchant. Plan to move to the hybrid once visit volumes are known.**

- The two largest unknowns are how many visits a quest produces and what a visit is worth to a merchant. Per-visit pricing puts a price on exactly that unit, so a merchant accepting the price is direct evidence of value. A fixed fee blends both unknowns into one number.
- A new channel with no track record cannot credibly ask for money up front. "Pay only for verified visits, up to a cap" is an offer a merchant can accept.
- Per-visit billing forces the verification and reporting to be built, and every other model needs them at renewal anyway.
- The cap limits fraud exposure while verification is still unproven.

This holds if visits can be verified well enough to bill on, and if merchants value a visit at or above the price. The unit economics also show why it is a test model and not the end state: below about 23 visits per quest per month it does not cover servicing cost, which is what the fixed part of the hybrid is for.

## 6. Proposed post-launch A/B experiment

**Question.** Does offering optional sponsored destination quests improve meaningful engagement without harming the core health-oriented experience?

The words "without harming" decide how the test has to be built. Finding no statistically significant drop in retention would not show that sponsored quests are harmless, because a test that is too small will usually find no significant difference whether harm exists or not. The primary test is therefore a non-inferiority test against a margin fixed in advance.

| Element | Design |
|---|---|
| **Hypotheses** | Primary, non-inferiority: week-4 retention among players offered sponsored quests is not lower than among players who see only regular quests by more than a margin Δ fixed before launch. Secondary, superiority: retention is higher. This is read from the same confidence interval, and only once non-inferiority holds. Daily steps and core-loop play are guardrails, not hypotheses |
| **Eligibility** | Players in the pilot city who have granted location permission, finished onboarding (first step sync and first spin), and have a sponsored location within quest range when they first open the quest screen during the test. The rule is fixed before assignment and applied identically to both groups. Staff and test accounts are excluded |
| **Randomization unit** | Player account, split 50/50 and assigned once at the first eligible quest-screen open. Stratified by prior-week steps and by new versus existing player |
| **Control group** | The current game: regular, non-sponsored quests only |
| **Treatment group** | The same quest screen with the same number of quest slots. At most one slot shows a sponsored quest, labelled as sponsored and dismissible. Its in-game reward equals a regular quest's, so the test measures sponsorship and not a larger reward |
| **Primary success metric** | Week-4 retention: the share of assigned players with at least one credited step sync on days 22–28 after assignment. Analysed by assignment, whether or not the player ever starts a sponsored quest. The quantity tested is the retention difference, treatment minus control, with a two-sided 95% confidence interval |
| **Secondary metrics** | Quest participation and verified destination visits per player; D7 retention; active days per week; regions completed; walking-bonus Energy earned; a one-question satisfaction survey. Merchant side, described but not compared between groups: verified visits per quest, redemptions, merchant-reported sales and cost per visit |
| **Guardrail metrics** | Daily steps per active player; spins per active day; sponsored-quest hide and opt-out rate; location-permission revocations and uninstalls; fraud flags per 100 claims; complaints about advertising. Each has a tolerance fixed before launch and is judged the way retention is: by where its confidence interval lies against the tolerance, not by whether the change is statistically significant. An interval entirely on the acceptable side of the tolerance rules out deterioration beyond it, and expansion requires this for every guardrail. An interval that crosses the tolerance is inconclusive: it is not evidence of a breach and does not stop the test, but it prevents expansion. A guardrail is breached, and the test stops, only when its interval lies entirely beyond the tolerance, which demonstrates deterioration beyond it |
| **Data collection** | An assignment log (player, group, time, stratum); an exposure event when a sponsored quest is actually shown; the quest funnel by quest type (shown, started, verified arrival, claimed); daily step syncs and spins; hide, opt-out and permission changes; survey answers; merchant-side redemption records |
| **Main confounding factors** | Novelty in the first week; weather, season and holidays, since walking is seasonal; uneven quest density across neighbourhoods; the particular merchants in the pilot; unequal notification volume between groups; spillover between players who walk together; players with more than one account |

**The non-inferiority margin.** Proposed starting value: **Δ = 2 percentage points** of week-4 retention. This is a proposal to argue about, not a finding, and no data supports it yet. It has to be justified, agreed and written down before the first player is assigned, and it does not change once data arrive. The justification has to cover four things:

- **What the product is willing to trade.** The margin is the largest retention loss that would be accepted in exchange for sponsorship revenue. A loss that is real but smaller than the margin passes the test, so it must be a loss the team is prepared to defend. A health product may choose a tighter margin than revenue alone would justify.
- **The baseline level.** Two points mean different things at different baselines: a tenth of a 20% retention rate, a fifth of a 10% rate. Once the baseline is measured, the margin should also be stated as a share of it.
- **Dilution.** The comparison is by assignment, so treatment players who are never shown a sponsored quest dilute any harm. If only half of them see one, a 2-point margin on the whole group permits a 4-point loss among those who did.
- **Whether it can be tested.** A tighter margin needs more players. The hypothetical pilot in section 3 has about 2,000 eligible players at a time, 1,000 per group before new arrivals, and whether that supports a 2-point margin depends on the baseline. If the pilot city cannot supply enough, the options are a longer test, more cities, or a wider margin that is defended as acceptable harm. Widening it only to fit the sample would defeat its purpose.

**How the result is read.** Take the two-sided 95% confidence interval for the retention difference, treatment minus control. It is read against two reference points, −Δ and zero, and the two readings are separate questions:

| Interval | Reading | Action |
|---|---|---|
| Entirely above −Δ | Non-inferior: a loss as large as the margin is ruled out. If the interval is also entirely above zero, retention improved. If it is entirely below zero, the loss is statistically significant but smaller than the margin | Can expand, subject to the other conditions below |
| Crosses −Δ and includes zero | Inconclusive: non-inferiority is not shown, and neither is a loss. The data are compatible with no harm and with harm beyond the margin | Do not expand. This is not evidence of safety |
| Crosses −Δ and lies entirely below zero | A statistically significant loss. Non-inferiority is not shown, but neither is a loss larger than the margin | Stop. The reason is the significant loss, which may be smaller than the margin. This is a conservative product decision, not a mathematical requirement of the non-inferiority test |
| Entirely below −Δ | A loss larger than the margin is shown | Stop |

**Sample size and duration.** These cannot be computed yet, because no baseline exists. For a non-inferiority comparison of two proportions with equal groups, a one-sided 2.5% test and no true difference, the standard approximation is about 15.7·p(1−p)/Δ² players per group for 80% power and 21.0·p(1−p)/Δ² for 90%, where p is baseline retention and both p and Δ are written as proportions (Δ = 0.02 for 2 points). Power here is the chance of clearing a feature that truly does no harm. Two things hold whatever p turns out to be. Halving the margin quadruples the players needed. And if a small real loss is expected, Δ in the formula is replaced by Δ minus that loss, which raises the number quickly. No baseline, effect size or sample size is assumed here.

The baseline data this needs come from a run-in period after launch, in which several weekly cohorts of eligible players are each followed for 28 days with regular quests only:

1. **Baseline week-4 retention** of eligible players under exactly this definition, and how much it varies between weekly cohorts when nothing changes. This gives p, and shows whether the margin is larger than ordinary noise.
2. **Weekly inflow of eligible players** and the size of the existing eligible base. Duration is the time needed to assign both groups, plus 28 days for the last player assigned, in whole weeks.
3. **Exposure share:** the proportion of assigned players who would actually be shown a sponsored quest, estimated in the run-in by logging where one would have appeared. This sets the dilution described above.
4. **The inputs to the margin:** the contribution per player that sponsorship is expected to bring, which stays a forecast until merchants have agreed prices, and the value the product places on a retained player.
5. **Guardrail baselines:** the mean and variance of daily steps per active player and of spins per active day, and the base rates of permission revocations, uninstalls and fraud flags, to set each tolerance and to confirm that the same sample can rule out deterioration beyond it when the feature causes none, as expansion requires.

**Decision rule, agreed before the test starts.** There is one analysis, at the planned sample size. The only early stops are guardrail breaches. When more than one rule applies, Stop takes precedence over Hold, Hold over Iterate, and Iterate over Expand.

- **Expand** only if all three hold: non-inferiority is shown (the whole retention interval is above −Δ), every guardrail interval rules out deterioration beyond its tolerance, and verified visits per sponsored quest reach the break-even volume of the pricing model in use.
- **Hold** if the retention result is inconclusive or any guardrail interval crosses its tolerance. An inconclusive result prevents expansion, but it is not proof of harm. A difference that is not statistically significant is not proof of no harm. The test is extended only if an extension was planned in advance. Otherwise the design is revised and run again.
- **Iterate** on targeting, labelling and frequency if non-inferiority is shown but hide and opt-out rates are high, or visits fall short of break-even.
- **Stop** if the retention interval lies entirely below zero and non-inferiority is not shown, or if any guardrail is breached, meaning its interval lies entirely beyond the tolerance. Only an interval entirely below −Δ shows a loss larger than the margin. One that is below zero but still crosses −Δ shows a real loss that may be smaller than the margin. Stopping on it is a conservative product decision, not a mathematical requirement of the non-inferiority test, which on its own says only that non-inferiority is not shown.
