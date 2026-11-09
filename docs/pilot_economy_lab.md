# 30-Tester Pilot Economy Lab

*November 2026 · companion to the [README](v1_core_economy.md)*

> **No measured pilot data.** The pilot has not run. Every tester in this model is synthetic. Mission, puzzle and Chronon rewards are **proposed pilot settings, not production-approved**. Nothing here measures revenue, conversion, retention or merchant performance.

The [legacy analysis](legacy_case_study_2026-10.md) models the original economy: one 50-Energy spin, an illustrative reward table and seven regions. This lab models the economy proposed for the first 30 pilot testers:
- variable wheel stakes;
- the present-day Jerusalem journey;
- optional sponsored walking missions;
- a 3 × 3 puzzle;
- Chronons.

It is a separate model with its own engine.

> **Implementation status.** Several rules below are fixed *in this model* without being production rules:
> - **The eight stakes (1–100)** are a development implementation behind a debug-only flag, disabled by default. Production Wheel V1 is a single 50-Energy spin, and the offline demo implements Wheel V3's 10 / 50 / 100 tiers.
> - **Chronons** are an approved design direction (planned). They are not implemented in production code.
> - **The Energy cap of the pilot build is unverified.**
>
> The dashboard tags the fixed rules "Model-verified": rules taken from the game's code and held fixed in this model, not validated with live players.

## Run it

| What | How |
|---|---|
| Dashboard | Open [`pilot/index.html`](../pilot/index.html) in a browser. It works straight from disk, with no server and no build step |
| Tests | `node --test` from the repository root (Node 18 or newer, no packages) |
| Share a scenario | The address bar carries the scenario, edits and average basis. Copy the link |
| Export | *Download configuration (JSON)* at the bottom of the dashboard |

[`pilot/pilot_model.js`](../pilot/pilot_model.js) is the only engine. The dashboard and the tests both load it, so they cannot disagree.

## Three labels

| Label | Meaning | Editable |
|---|---|---|
| **Verified** (fixed) | A rule the model holds fixed, as given in the pilot brief. The status column below says which of these are in production | No |
| **Proposed** | A pilot setting under discussion: configurable, not production-approved | Yes |
| **Hypothetical** | A behavioural or modelling assumption with no evidence behind it | Yes |

### Rules the model holds fixed

| Rule | Value | Implementation status |
|---|---|---|
| Validated steps per Energy | 10 (steps do not generate Progress Points directly) | Implemented |
| Wheel stakes | 1, 2, 3, 5, 10, 20, 50, 100 Energy | **Development only**, behind a debug-only flag. Production is a fixed 50-Energy spin; the offline demo offers 10 / 50 / 100 |
| Earned PP | base reward × stake / 50, fractional tenths carried | The same development implementation |
| Expected PP per attempt | 1.045 × stake | Derived from the reviewed production table: 52.25 PP per 50-Energy spin. See [Wheel economics](wheel_economics.md) |
| Expected Energy spent per attempt | 0.998 × stake, including the 0.2% refund outcome | Derived from the same table |
| Return per Energy by stake | Higher stakes do not improve expected return | Derived |
| Legacy Jerusalem journey | 1,500 PP | Implemented: the first destination's cost |
| Currency for additional journeys | Chronons | **Planned** (approved direction). Not implemented in production code |

The wheel enters the model **only through these two expectations**. No reward table is assumed. Each attempt earns 1.045 × stake *expected* PP and is refunded with probability 0.002, so individual outcomes vary more than the model shows, and nothing guarantees any tester's result.

### Derived metrics

These figures are **calculated from the reviewed expected values above**. They are not independent verified gameplay rules, and like the expectations they describe averages, not any individual tester's outcome.

| Metric | Value | Calculation |
|---|---|---|
| Expected PP per net Energy | ≈ 1.0471 | 1.045 ÷ 0.998. Both expectations scale with the stake, so the ratio is the same at every stake |

### Proposed pilot settings

| Setting | Proposal |
|---|---|
| Enrolled testers | 30 |
| Medium mission | 2 km eligible route → 90 puzzle pieces + 5 Chronons |
| Short and long missions | Distance 1 km and 4 km as placeholders. **Rewards unset.** The model refuses to run a tier that has a share but no reward |
| First puzzle | 3 × 3 = 9 tiles, 30 pieces per tile, tester chooses which tile |
| Puzzle completion bonus | 100 Energy, once, only for all nine tiles |
| Additional journey price | **Unset** (Chronons) |
| Additional journey length | **Unset** (PP) |

What the settings imply, independent of behaviour:

- One medium mission is 90 ÷ 30 = **3 tiles, one third of the puzzle**. Three medium missions complete it.
- Jerusalem needs 1,500 ÷ 1.0471 (a derived metric, above) ≈ **1,433 net Energy**, or about **14,325 credited steps**, at any stake. That is a PP-budget approximation that ignores the last spin's overshoot. The exact expected cost is slightly higher and grows with the stake ([Wheel economics](wheel_economics.md#5-wheel-v3-three-tiers-offline-demo)).

### Hypothetical assumptions and scenarios

Scenarios change behaviour only. The rules and proposed rewards are identical in all three.

| Assumption | Conservative | Baseline | Optimistic |
|---|---|---|---|
| Testers who ever open the app | 75% | 90% | 100% |
| Active-day probability | 50% | 70% | 85% |
| Weekly dropout | 12% | 5% | 2% |
| Median daily steps (between-tester CV 0.35, day-to-day CV 0.30) | 4,500 | 6,000 | 8,000 |
| Energy wagered on an active day | 60% | 80% | 90% |
| Participating businesses (1 mission each) | 2 | 4 | 6 |
| Mission discovery per active day | 8% | 15% | 25% |
| Acceptance of a discovered mission | 30% | 50% | 70% |
| Verified completion of an accepted mission | 50% | 70% | 85% |
| Share of a mission route that is extra walking | 30% | 50% | 70% |

The following are shared by all three scenarios:
- **Pilot length:** 28 days.
- **Stake mix (share of attempts):** 1: 4%, 2: 4%, 3: 4%, 5: 12%, 10: 24%, 20: 22%, 50: 22%, 100: 8%.
- **Mission tiers:** all medium.
- **Walking:** 1,300 steps per km.
- **Sessions:** steps on a day without a session are not credited.
- **Legacy rules:** case-study bonuses and cap off.
- **Simulation:** 300 simulated cohorts, seed 2026.

## How the model works

Each simulated cohort plays every enrolled tester day by day. Every tester walks every day. On an active day, in order:

1. A mission accepted on an earlier active day resolves. Verified completion pays its pieces and Chronons and adds the extra-walking part of the route to the day's steps. Otherwise the mission is abandoned. One mission is in progress at a time.
2. With no mission in progress, the tester may discover a mission they have not seen and accept or decline it. Declined missions are not offered again. Each mission pays a tester at most once.
3. Steps sync: 10 steps = 1 Energy, and the remainder carries over.
4. Whole tiles are revealed while pieces cover one. The bonus is paid once, when the last tile is revealed.
5. A finished journey unlocks the next one only if a price and length are set and the tester holds the Chronons.
6. The tester wagers the assumed share of the balance. Each attempt draws a stake from the stake mix among stakes the remaining budget covers, is charged in full, earns expected PP and is refunded with probability 0.2%. A refund returns to the wallet, not to that day's budget. No attempt is made while no journey is in progress.

Results are averaged over 300 cohorts. Ranges are the 10th to 90th percentile across cohorts.

The model reports two kinds of average:
- **Per enrolled tester** divides by all 30 testers.
- **Per active tester** divides by testers with at least one active day.

## Safeguards and how they are tested

The following properties are checked by tests in [`pilot/pilot_model.test.js`](../pilot/pilot_model.test.js).

| Safeguard | Test |
|---|---|
| Energy is not all spent at once | Spend share below 100%; unspent Energy carries |
| No double-counted steps | Mission route steps are a part of *Walked*, added once; Energy from steps rises by exactly route steps ÷ 10 |
| No double-counted refunds | Stakes are charged gross and refunds counted once as a source; Energy sources − sinks = balance on 150 random configurations |
| No fractional puzzle bonus | 8 tiles pay nothing; 5 missions' worth of pieces still pays the bonus once |
| No negative wallets | Energy, PP, pieces, Chronons and tiles are ≥ 0 for every tester on 150 random configurations |
| Reviewed wheel expectations | 1.045 × stake PP per attempt exactly; refund share within four standard errors of 0.2% |
| Journey completes at 1,500 PP and spinning stops | 144 attempts at stake 10, then none |
| Unset prices spend nothing | Chronons spent = 0 whenever no price is set |
| Scenarios change behaviour only | No scenario touches a verified or proposed key; conservative < baseline < optimistic on five outputs |
| Legacy constants cannot drift | Pinned to `assumptions.csv` |

**How the guards were seen to fail.** Each safeguard was broken deliberately in a copy of the engine and the suite rerun. Each mutation turned at least one test red:
- paying the bonus every day after completion;
- paying it for eight tiles;
- double-counting refunds into the budget;
- letting a stake exceed the budget;
- counting route steps twice;
- spinning after the journey ends;
- changing the legacy cap to 250.

## What the baseline shows (synthetic)

| Metric | Conservative | Baseline | Optimistic |
|---|---|---|---|
| Testers with at least one active day (of 30) | 22.6 | 27.0 | 30.0 |
| Testers who finish Jerusalem (of 30) | 20.6 | 26.8 | 30.0 |
| Median finishing day among finishers | 8.2 | 4.4 | 2.9 |
| Share of active days with nothing to spend Energy on | 63% | 82% | 89% |
| Energy credited, per enrolled / per active | 4,188 / 5,548 | 10,451 / 11,634 | 20,005 / 20,005 |
| Energy unspent at day 28, per active tester | 4,142 | 10,181 | 18,600 |
| Missions discovered / accepted / completed (cohort) | 18.8 / 5.6 / 2.6 | 64.9 / 32.4 / 21.8 | 139.0 / 96.9 / 79.7 |
| Tiles revealed (cohort) | 7.8 | 65.3 | 207.6 |
| Testers completing the puzzle (of 30) | 0.0 | 1.0 | 16.3 |
| Chronons earned per active tester (spent: 0) | 0.57 | 4.05 | 13.29 |

1. **Progression runs out within days.** At 1,500 PP, Jerusalem takes about 14,300 credited steps. Baseline testers finish around day 4. With no additional journey priced, most later active days leave Energy with nothing to buy, and Energy simply accumulates. Pricing a second journey, or giving Energy another sink, is the decision this lab is most sensitive to.
2. **Chronons accumulate with no sink** until a journey price is set.
3. **The puzzle bonus is not an inflation risk, but it is hard to reach.** It is under 0.1% of credited Energy. Completing the puzzle needs three verified medium missions. With two businesses (conservative) it is impossible, because each tester can complete at most two missions. In the baseline about one tester in thirty completes it. The funnel rates that decide this are entirely hypothetical.
4. **Walking on days without a session is lost** under the default assumption. At a 70% active-day rate that is about 40% of all steps. Whether the pilot build backfills earlier days changes Energy income materially; a toggle switches it on.

## Limitations

- No pilot data. Activity, steps, the mission funnel, stake choice and spend behaviour are all assumptions.
- The wheel is modelled by expectations only, so the variance of Progress Points is understated.
- Only the first puzzle and, if priced, a chain of identical additional journeys are modelled.
- **PP beyond a journey's requirement is dropped.** That is about 27 PP per completed journey in every scenario, 1.8% of 1,500. The approved World Tour direction keeps it as pending PP. The game's development branch already keeps overflow past the final destination, and the offline demo keeps it past Jerusalem.
- **The stake mix uses the eight development stakes, not Wheel V3's 10 / 50 / 100 tiers.** Expected PP per Energy is identical at every stake, but that alone does not make pilot results identical. Discrete stake affordability, Energy left below the smallest tier, journey overshoot and daily spending budgets can all shift completion timing and idle balances. Overshoot alone means Jerusalem costs an expected 1,439 net Energy at Quick Spin and 1,502 at Epic Spin. **A V3-specific rerun is needed** before any pilot result is quoted for V3.
- The bank cap and daily step bonuses of the case study are not part of the pilot brief and are off by default. If the pilot build applies them, Energy figures move in both directions: the cap removes Energy and the bonuses add it.
- Not modelled: revenue, merchant performance, retention as a decision, fraud, non-walking travel, and Coins.

## Values for the Flutter demo to mirror

These are the exact values the lab uses. Only the first two groups describe the game. The behavioural assumptions are not game settings and should not be mirrored.

The key name `verifiedRules` means "fixed in this model". It does not mean "in production": `wheelStakes` lists the development-only stakes, and the offline demo has since moved to Wheel V3's 10 / 50 / 100 tiers.

```json
{
  "verifiedRules": {
    "stepsPerEnergy": 10,
    "wheelStakes": [1, 2, 3, 5, 10, 20, 50, 100],
    "expectedPpPerStake": 1.045,
    "expectedEnergySpentPerStake": 0.998,
    "refundProbability": 0.002,
    "ppBaseStake": 50,
    "jerusalemJourneyPp": 1500
  },
  "proposedPilotSettings": {
    "enrolledTesters": 30,
    "mediumMission": { "eligibleKm": 2, "puzzlePieces": 90, "chronons": 5 },
    "shortMission": { "eligibleKm": 1, "puzzlePieces": null, "chronons": null },
    "longMission": { "eligibleKm": 4, "puzzlePieces": null, "chronons": null },
    "firstPuzzle": { "tiles": 9, "grid": "3x3", "piecesPerTile": 30, "completionEnergy": 100, "completionBonusOnce": true },
    "additionalJourney": { "chrononPrice": null, "lengthPp": null }
  }
}
```

## World Tour catalog (format and validation only)

> **Format and validation only.** The World Tour layer describes and checks a catalog. It does not simulate or project anything, and the pilot dashboard above is unchanged: it still models Jerusalem and the first puzzle. The illustrative catalog is not a production catalog and not implemented gameplay. Every new amount in it is unset.

| File | What |
|---|---|
| [`pilot/world_tour.js`](../pilot/world_tour.js) | The catalog format, `validateCatalog` and `readiness`. Pure functions with no I/O. Loads after `pilot_model.js` in a browser |
| [`pilot/catalogs/illustrative_world_tour.js`](../pilot/catalogs/illustrative_world_tour.js) | The small illustrative pilot catalog |
| [`pilot/world_tour.test.js`](../pilot/world_tour.test.js) | Its tests, run by the same `node --test` |

### Pilot and roadmap

- **The pilot catalog is small and illustrative.** It is not the editorial catalog. The game's seven implemented destinations are listed in the [README](v1_core_economy.md#61-implemented-seven-destinations).
  - Present Day contains Jerusalem, Paris, Rome and Pisa.
  - Its puzzles are Jaffa Gate, the Eiffel Tower, the Arc de Triomphe, the Colosseum and the Leaning Tower of Pisa.
  - Paris has a collection of its two puzzles.
  - The earlier era is a placeholder with no journeys.
- **The long-term World Tour is a roadmap, not gameplay.** It is about 100 present-day destinations followed by an earlier historical era, and it is not written out. The 100-destination star and chain catalogs in the tests are validator fixtures only, not proposed progression structures.
- **Pilot results and long-term projections stay separate.** The 28-day pilot horizon is one thing. Any long-term projection will be a separate, later layer, labelled as a projection.

### Progression rules (approved design baseline, not yet in any build)

| Rule | Baseline |
|---|---|
| Unlocking | A journey becomes eligible once every journey it requires is complete |
| Choice | The player chooses among eligible journeys they can afford |
| Start | Jerusalem is the free start journey of the first era |
| PP overflow | PP beyond a journey's requirement is kept in a pending balance |
| Pending PP | Never stands in for a Chronon price |
| PP without a journey | None is generated while no journey is active |
| Era completion | Every journey of an era, before the next era opens |

These rules are fixed in `world_tour.js` (`PROGRESSION_RULES`), so a catalog cannot change them.

### Values

Every amount in a catalog is one of three things:

| Form | Meaning |
|---|---|
| `null` | Unset: no decision yet. Never read as zero |
| `{ v, s }` | A literal, labelled `proposed` or `hypothetical`. A literal can never be labelled `verified` |
| `{ ref }` | A link to a constant in `pilot_model.js` |

Exactly four links exist, and each one is required at one place and allowed nowhere else:
- Jerusalem's PP links to `RULES.jerusalemJourneyPp` (verified).
- Jaffa Gate's tiles, pieces per tile and completion Energy link to the existing proposed puzzle defaults.

Changing a model constant therefore changes the catalog, and the two cannot drift apart. The catalog holds no Wheel figures and no PP-per-Energy conversion.

### Organic earning

- **Walking only.** Chronons and puzzle pieces are earned organically per N verified steps (`organic.<currency>.verifiedSteps: { amount, perSteps }`). Both rates are unset.
- **No passive rewards.** There is no slot for login or time-based rewards, and any earning basis other than `verifiedSteps` is refused.
- **Two keys reserved for future safeguards:** `periodCap` (an earning limit per period) and `stepDeduplication` (a guard so each physical step is credited only once). The format names them so they can be added later without redesign. Setting either one is refused until they are implemented.
- **Other sources.** Journey completion rewards Chronons, and sponsored missions remain an additional source of pieces and Chronons, configured as before. Puzzle pieces are one general pool.

### Validation and readiness

**`validateCatalog`** refuses:
- unknown or missing keys;
- duplicate or malformed ids;
- references to anything that doesn't exist;
- prerequisite cycles, which are reported with every journey in or behind them;
- prerequisites from another era;
- a start journey with a price or prerequisites, or a non-start journey with no price slot;
- a first era that does not start with Jerusalem alone;
- an era chain that loops or leaves an era unreached;
- any completion rule other than `"all"`;
- a non-roadmap era with no journeys;
- a collection spanning two cities;
- values that are not whole numbers, are NaN, infinite or negative, or are zero where they must be above zero.

A puzzle that becomes available with a journey in another city is a warning, not an error.

**`readiness`** lists what a valid catalog still lacks: every unset value, every undecided reward, and every roadmap era that has no journeys yet. The illustrative catalog is valid but not ready. It has 28 unset values and an empty earlier era.

**How the guards were seen to fail.** Fourteen guards were each broken in a copy of `world_tour.js`, and each break turned at least one test red. The first run found one gap: an empty roadmap era could count as ready. A test now covers it.

### Energy cap: not assumed

- **The lab assumes no Energy cap for the pilot** until the exact pilot build is identified. **The pilot build's cap is unverified.** This lab changes no production setting.
- **Values elsewhere (November 2026):**
  - the game's production code has a cap of 250;
  - its development branch and the approved beta have 500;
  - the offline demo applies 500 to step Energy.
- **On the development branch the cap limits only Energy converted from ordinary steps at sync:**
  - step milestones, the daily goal bonus, quest claims and legacy Premium Energy from partner purchases are credited above it;
  - leftover steps under 10 carry to the next sync;
  - steps that would convert past the cap are not credited.
- **Its milestones and goal bonus match this lab's legacy switch.**
- **It is not the pilot build:** its production wheel is still a single 50-Energy spin.
