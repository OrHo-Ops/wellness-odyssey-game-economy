# Planned Systems: Chronons, Wellness Store, Leagues, Duels and the World Atlas

> **Nothing in this document is in production.** These are the approved product directions for Wellness Odyssey's full release, with the design questions each one raises. Where an offline-demo implementation exists, it is named. Prices, rates, rewards, durations and scoring rules are **unset** unless a value is given, and no value is a forecast. No commercial or retention outcome has been observed or validated.

Status labels follow the [README](v1_core_economy.md): **Implemented**, **Implemented (legacy)**, **Offline demo**, **Planned** (approved direction, not built), **Option** (a design option, not approved), **Unset** (deliberately undecided).

## Contents

1. [The governing principle](#1-the-governing-principle)
2. [The Chronons economy](#2-the-chronons-economy)
3. [The Wellness Store](#3-the-wellness-store)
4. [Odyssey Leagues](#4-odyssey-leagues)
5. [Odyssey Duels](#5-odyssey-duels)
6. [Competitive fairness](#6-competitive-fairness)
7. [The Odyssey World Atlas](#7-the-odyssey-world-atlas)

## 1. The governing principle

> **Buying Chronons is intentionally allowed to accelerate access to new journeys and cosmetic customization. Real-money purchases must not directly generate walking-based Energy, PP, completed journey progress or competitive Odyssey Score.**

Earlier access is an intended benefit, so spending does affect overall progression timing: a paying player may start the next journey sooner. The journey itself still has to be walked.

That gives three layers, each with a different relationship to money:

| Layer | What it holds | Earned by | Money can buy it? |
|---|---|---|---|
| **Progress** | Energy → Wheel spins → PP → journey completion | Verified steps (10 steps per Energy) | **No.** Purchases never directly generate it |
| **Access** | Which journeys are open, and how soon | Chronons | **Yes, by design**: spending can open journeys sooner. A non-paying player must keep a viable path |
| **Expression** | Avatar clothing, character appearances, pets | Chronons | **Yes, by design** |

**Competition** (leagues and duels) ranks a dedicated **Odyssey Score** (design direction, formula unset), not PP. The score rewards verified activity, not wheel luck or spending. Section 6 traces how each lever could reach a ranking.

> **Implemented legacy behaviour.** The game's server currently credits **Premium Energy** for a paid partner purchase, above the Energy cap. Energy converts to PP through the wheel, so this path predates and contradicts the rule above. It is documented as implemented legacy behaviour. The approved economy replaces it with Chronon rewards, and changing the code is a separate task.

## 2. The Chronons economy

Chronons become the game's major currency, with two families of sink: access and expression. They never generate PP, never complete a journey and never count as competitive score.

### 2.1 Sources

| Source | Design | Status |
|---|---|---|
| Verified organic walking | Chronons per N verified steps | Planned. Rate **unset** |
| Journey completion | A Chronon reward when a journey completes | Planned. Amounts **unset** |
| Sponsored walking missions (optional) | A Chronon reward for a verified walked route | Planned. The offline demo uses 5 Chronons per 2-km mission as a provisional value |
| Eligible Wellness Store purchases | A configurable number of Chronons per dollar spent. Chronons are the only reward for real-money purchases | Planned. Rate **unset** |
| Direct purchase | Chronon bundles bought with real money | Planned. Bundles and prices **unset** |

### 2.2 Sinks

| Sink | Examples | Status |
|---|---|---|
| Unlocking additional journeys | A Chronon price per journey, once its prerequisites are complete | Planned. Prices **unset**. The offline demo has a configurable price that is unset by default |
| Avatar clothing and accessories | Hats, shirts, shoes | Planned |
| Unique character appearances | Special playable character designs | Planned |
| Pets and companions | Cosmetic companions | Planned |

### 2.3 The non-paying path, stated as a constraint

The design requires a walking-only player to keep a viable route to new journeys. Without inventing any values, the constraint can be written down so that it can be tested once values exist.

For journey *k*, let:
- `S_k` be the credited steps needed to complete it. This is derived from its PP cost: about PP ÷ 1.0471 × 10, as in [README section 6.1](v1_core_economy.md#61-implemented-seven-destinations).
- `r` be the organic Chronons earned per N verified steps.
- `C_k` be journey *k*'s completion reward.
- `P_k+1` be the price of the next journey.

A walking-only player can afford the next journey on finishing the current one when:

```
r × S_k / N  +  C_k  +  (Chronons carried over, minus Chronons spent on cosmetics)  ≥  P_k+1
```

Three consequences follow.

1. **Prices and rates must be set together**, journey by journey, because `S_k` grows with each journey's PP cost. A fixed price against a fixed rate drifts as journeys lengthen.
2. **Cosmetics compete with access for the same currency.** A walking-only player who buys a hat delays their next journey. That is a legitimate choice, but cosmetic prices have to be set knowing they draw on the access budget.
3. **The constraint can be checked mechanically.** The World Tour catalog validator already refuses undecided values that pretend to be zero. A future check could flag any journey where walking alone cannot reach `P_k+1` within a target number of steps. That target is itself **unset**.

### 2.4 Coins and Chronons

The game's implemented second currency is **Coins**. How Coins relate to Chronons, and what happens to existing Coin balances, is an **open migration and design decision**. This repository assumes no conversion rate and no migration rule.

## 3. The Wellness Store

**Status: Planned.** An in-app store of wellness, health and fitness products for a young, urban, fitness-interested audience. It is intended to support:
- sales of relevant physical products;
- brand partnerships;
- Chronon rewards on eligible real-money purchases, alongside direct Chronon purchases.

**Not set here:** Chronons per dollar, product prices or margins, Chronon bundle prices, conversion rates, refund policy and revenue. None of them is invented.

### Design questions

| Question | Why it matters to the economy |
|---|---|
| **Purchase verification** | Chronons should be credited only for a purchase that has actually completed. When are they credited: at payment, at delivery, or after the return window? |
| **Refunds and returns** | If a refunded purchase already paid Chronons that have since unlocked a journey or bought a cosmetic, is anything clawed back? A negative balance, a reversed unlock or a written-off cost are all possible answers, each with different abuse and goodwill costs |
| **Two prices for one currency** | Direct purchase and store rewards both turn dollars into Chronons. If store purchases yield more Chronons per dollar than bundles, bundles are dominated. Combined with generous returns, buying and returning becomes a currency source. The two rates need to be set as a pair |
| **Source and sink balance** | Paid Chronons enter the same pool as walking Chronons. If journey prices rise to absorb paid inflow, the non-paying constraint in section 2.3 tightens. If they don't, paid players exhaust content faster |
| **Access versus expression** | Whether paid Chronons should preferentially flow to cosmetics, and whether journey access should have a walking-only component, are open choices |
| **Fair competition** | Store Chronons are bought access. Section 6 traces whether access can turn into score |

## 4. Odyssey Leagues

**Status: Planned.** Competitive leaderboards over **daily, weekly, monthly and yearly** periods, plus **all-time** rankings.

**Design goals:**
- increase engagement;
- give new players attainable competition;
- give experienced players lasting status;
- support both short and long horizons.

**Not claimed:** any retention effect. None has been measured.

### Why several periods

- An **all-time** board rewards tenure: a new player cannot catch someone who started a year earlier.
- A **daily** board resets before tenure matters, so it gives a new player a winnable contest.
- **Weekly and monthly** boards smooth one-day spikes.
- A **yearly** board is the long-term status layer that all-time alone would make unreachable.

### Ranking metric: the Odyssey Score

**Design direction:** leagues rank a dedicated **Odyssey Score** that rewards verified activity, not wheel luck or spending. PP stays the journey-progression resource and is not the preferred ranking metric. **Unset:** the score's formula, mission bonuses, fairness rules and rewards.

| Metric considered | For | Against |
|---|---|---|
| Verified steps | The purest measure of the health promise; no randomness; money cannot buy it | Favours people with more time and mobility; the anti-cheat surface is step verification |
| PP earned | Ties competition to the game loop | **Not preferred.** Wheel randomness (section 5); and PP accrues only while a journey is active, which links it to access (section 6) |
| Completed physical missions | Rewards exploring | Mission supply depends on location and partners (section 6) |
| **Odyssey Score** (design direction) | Designed for fairness from the start; rewards verified activity | Formula, mission bonuses, fairness rules and rewards **unset**; one more number to explain |

### Open questions

- **The Odyssey Score's formula**, and how missions count in it without favouring players near participating businesses.
- **Grouping**: by activity level, by experience, or both. How small a group must be for the top to feel attainable.
- **Promotion and relegation** between tiers.
- **Seasonal resets**, and what survives a reset.
- **Rewards**: whether league rewards may include Chronons, which would feed access, or only cosmetics and status.
- **Anti-cheat**: only verified activity counts, and each physical step counts once. A step that earns a mission reward is not counted again as separate step activity.
- **Not discouraging** new or less-active players, for example through activity-matched groups or personal-best framing. Undecided.

## 5. Odyssey Duels

**Status: Planned.** Time-limited head-to-head challenges between two players. **Unset:** duration, matchmaking, rewards and scoring rules.

### Candidate metrics and their tradeoffs

| Metric | Tradeoff |
|---|---|
| Verified steps | Fair and legible; no game strategy at all |
| Completed physical missions | Geography decides: a player with no participating business nearby cannot compete |
| PP earned | Introduces Wheel randomness, quantified below |
| **Odyssey Score** | **Design direction.** Rewards verified activity, not wheel luck or spending. Formula, mission bonuses, fairness rules and rewards **unset** |

### How much of a PP duel the wheel decides

Suppose two players turn verified steps into Energy and spend it all on Wheel V3 spins, and one of them walked **10% more** than the other. How often does the player who walked less finish ahead on PP?

The figures below are **exact mathematical analysis, not observed player behaviour**. They are computed by convolving the reviewed payout table in [`analysis/competition.js`](../analysis/competition.js) and cross-checked by Monte Carlo. The step totals are illustrative volumes of walking, **not proposed duel lengths**. Both players use the same tier:

| Steps walked (less active vs more active) | Quick Spin (10) | Journey Spin (50) | Epic Spin (100) |
|---|---|---|---|
| 10,000 vs 11,000 | 15.7% | 32.1% | 36.5% |
| 50,000 vs 55,000 | 1.3% | 15.7% | 23.7% |
| 100,000 vs 110,000 | 0.1% | 7.8% | 15.7% |

*Cells give the probability that the player who walked 10% less finishes strictly ahead on PP. Ties are under 1.3% in every cell. Data: [`outputs/portfolio/pp_contest_odds.csv`](../outputs/portfolio/pp_contest_odds.csv).*

**Three findings.**

1. **At everyday volumes the wheel decides a large share of PP duels.** With one Journey Spin per 500 steps, a player who walked 10% less still wins about a third of the time at 10,000 steps.
2. **Only the number of spins matters.** Quick at 10,000 steps, Journey at 50,000 and Epic at 100,000 are all 100 spins against 110, and all three give 15.7%. Scaling payouts by stake scales the whole distribution, so a contest's fairness is set by spins, not steps.
3. **Tier choice stops being neutral.** For progress, the three tiers are equivalent: same PP per Energy (see [Wheel economics](wheel_economics.md)). In a PP duel they are not. At 50,000 against 55,000 steps, with the more active player on Journey Spin, the less active player's chance of finishing ahead depends on their tier:

| Less active player's tier | Quick Spin | Journey Spin | Epic Spin |
|---|---|---|---|
| Chance of finishing ahead | 9.9% | 15.7% | 20.2% |

A trailing player maximises their chance by choosing the highest-variance tier. A PP-scored duel would turn a progress-neutral choice into a strategic gamble. That may be fun, but it is a change in what the duel rewards, and it should be designed deliberately rather than inherited.

**The decision this supports.** A PP-ranked contest would need one of three things:
- a long enough horizon for walking to dominate;
- a fixed tier for competitive spins;
- a metric that removes the wheel.

The design direction takes the third: Leagues and Duels rank a dedicated **Odyssey Score** that rewards verified activity, not wheel luck or spending. PP stays the journey-progression resource. The score's formula, mission bonuses, fairness rules and rewards are **unset**.

## 6. Competitive fairness

How each money or location lever could reach a ranking:

| Lever | Direct route to score? | Indirect route | Risk if PP were ranked |
|---|---|---|---|
| **Purchased Chronons** (direct or store) | No. Chronons never generate PP | No PP-generating spins happen without an active journey. A paying player can open the next journey sooner and resume spinning earlier | **Indirect pay-to-score.** Faster access would become a ranking advantage |
| **Premium Energy from partner purchases** (implemented legacy behaviour) | Yes. Energy converts to PP | — | **Direct pay-to-score.** Superseded by the approved rule (section 1) |
| **Sponsored missions** | Only if mission completions are scored | Mission Chronons buy access, as above | **Geography**: players near participating businesses earn more access and possibly more score |
| **Wheel tier choice** | No | Variance (section 5) | Luck and gambling decide close contests |
| **Duplicate step credit** | Only if a step counts twice | — | Each physical step is counted once, whether it also earns a mission reward or not |

**With the Odyssey Score as the ranked metric**, the PP rows above no longer reach competition.

**Progression timing is affected, and that is intended.** A player who buys Chronons can open the next journey sooner and resume spinning earlier. That is the benefit access is meant to give, not a purchase of PP: the PP still comes from walking.

The planned pending-PP rules hold across the gap:
- overflow at journey completion is preserved;
- pending PP does not bypass unlock requirements;
- under the current design, no PP-generating spins happen without an active journey;
- when a new journey is unlocked, pending PP may be applied according to the planned progression rules.

What a walking-only player experiences while waiting is set by journey prices, the organic Chronon rate and the Energy cap, which can discard step Energy during a long wait.

**Safeguards to evaluate** (options, none decided):
- keep the Odyssey Score independent of whether a journey is active;
- size journey prices and organic rates so the walking-only wait stays reasonable (section 2.3);
- decide whether the cap should treat time without an active journey differently;
- exclude purchase-derived balances from anything ranked;
- group leagues by mission availability;
- count each physical step once, across steps and missions.

## 7. The Odyssey World Atlas

**Status: Planned.** Not described as implemented: the offline demo contains no Atlas, and implementation must be verified before any claim changes.

### Two levels

| Level | What it is |
|---|---|
| **1. World Globe** | A premium, futuristic holographic globe for choosing countries and exploring the global journey roadmap |
| **2. Country Adventure Map** | A detailed, illustrated topographic adventure map of the chosen country |

### Real geography

Unlike fictional RPG maps, every country map keeps real-world geography:
- country outlines and coastlines;
- major mountains and elevation;
- rivers, lakes and deserts;
- each destination at its actual coordinates;
- recognisable geographic relationships between places.

**Art direction:** fantasy adventure cartography in deep emerald, teal, brass and gold, with subtle cyan holographic accents.

### Journey nodes

| Node state | Meaning | Label to the player |
|---|---|---|
| **Playable** | Implemented and unlocked | — |
| **Locked** | Implemented, but prerequisites or Chronon price not yet met | Shows what unlocks it |
| **Planned** | Not yet built | "Coming in a future update". Never presented as playable |

**How journeys are chosen.** Selection is **non-linear**. Any journey whose prerequisites are complete is eligible, and there is no single mandatory route. This matches the World Tour's prerequisite graph ([README section 6.2](v1_core_economy.md#62-planned-the-world-tour)). Future historical eras may be teased.

**First vertical slice (intended).** The offline demo will lead with Israel, adding Jordan and Italy as previews if feasible.

### Open questions

- **Geographic data.** The source of the coastlines, elevation and rivers, and its licence. This is a dependency decision: the game currently paints its scenes rather than using a map SDK.
- **Catalog fields.** The World Tour catalog format has no coordinates, country or implementation-state fields today. Rendering node states from the catalog needs them. Adding them is a format change for separate approval.
- **Which country** holds each implemented destination, and how a destination that spans or borders countries is placed. This is an editorial decision.
- **Era teasers.** How a future era is shown without implying a release date.
