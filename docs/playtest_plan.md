# Live Playtesting Plan

*Companion to the [README](v1_core_economy.md) · a plan, not a result. No playtest has run.*

## Purpose

The [Economy Lab](pilot_economy_lab.md) can only say what *would* happen if testers walked, opened the app and accepted missions at assumed rates. A first live playtest with about 30 people over 28 days has two jobs:

1. **Replace the lab's hypothetical inputs with measured ones.** Re-run the model with them and see which conclusions survive.
2. **Find out what players understand and how they feel.** Do they understand the wheel, the tiers, the puzzle and the journey choices, and is anything frustrating?

A 30-person playtest is a calibration exercise, not an experiment. A proportion near 50% measured on 30 people has a 95% margin of about ±18 percentage points. It can show that an assumption is badly wrong, and it can surface confusion. It cannot detect small effects or establish retention. No result from it will be presented as a population estimate.

## What is measured, and what it decides

| Measurement | Lab input it replaces | Decision it informs |
|---|---|---|
| Verified daily steps per tester: level, day-to-day and between-tester variation | Median daily steps, the two CVs | Journey lengths in steps; whether the 1,500-PP Jerusalem journey takes days or weeks |
| App sessions per day, sync times and the Energy balance at each sync | One session per active day | The Energy cap: none, 250 or 500, and how much Energy it would discard |
| Days with steps but no session, and whether the health platform backfills them | "Steps on a day without a session are not credited" | Whether missed days lose walking; the size of the Energy faucet |
| Share of the balance spent per session; Energy left below the smallest tier | Spend share | Pacing; whether idle Energy is a problem |
| Tier choice (Quick, Journey, Epic) and switching | Stake mix | Whether three tiers suffice; the default tier |
| Steps before a new tester's first spin, and day-1 drop-off | (not modelled) | Whether new players need an onboarding spin |
| Day each tester finishes Jerusalem; active days afterwards with nothing to buy | Output: median finishing day, idle share | Second-journey length and Chronon price |
| Mission funnel: shown, accepted, completed, and the extra walking per route | Discovery, acceptance, completion, extra-walk share | Mission rewards, the number of missions and their distances |
| Tiles revealed, which tiles players choose, leftover pieces | Output: tiles, stranded pieces | Pieces per tile; puzzle size; whether a completion bonus is needed |
| Chronons held over time | Output: Chronons earned | The organic Chronon rate and journey prices, together |
| Short survey at days 3 and 28 | (not modelled) | Comprehension of odds, tiers and pending PP; perceived fairness; frustration points |

## Instrumentation

Analytics events, all pseudonymous and aggregated before analysis:

| Area | Events |
|---|---|
| Steps and sessions | `steps_synced`, with Energy credited and Energy discarded by the cap |
| Wheel | `spin_started` (tier) and `spin_settled` (outcome index, PP, refund, "Reveal now" used) |
| Journeys | `journey_completed`, `journey_unlocked` (Chronons spent) and pending PP at completion |
| Missions | `mission_shown`, `mission_accepted`, `mission_completed` and `mission_abandoned` |
| Puzzle | `tile_revealed` and `puzzle_completed` |

Every refusal is reported as well, for example a spin refused for insufficient Energy, so that rates are computed over attempts rather than successes.

## Analysis

1. **Before the playtest, write down the target for each decision.** For example, the number of days a typical tester should take to finish a journey, or the share of active days on which Energy should have something to buy. These are design targets to agree, not predictions.
2. **After the playtest, fit the lab's hypothetical inputs** to the measured distributions and re-run the three scenarios with them.
3. **Compare the re-run with the targets.** Change one lever at a time, in this order:
   - the journey length and price;
   - the organic Chronon rate;
   - the mission rewards;
   - the Energy cap.

   This is the same sequencing as the legacy analysis: fix the target game length first, because every other lever moves it.
4. **Record each change and its reason** in the lab's documentation, with the evidence behind it.

## Decisions the playtest cannot settle

- **Retention and long-term engagement.** Answering these needs larger cohorts and a pre-registered experiment, such as the [sponsored-quest experiment design](monetization_and_experiment.md#6-proposed-post-launch-ab-experiment).
- **Merchant willingness to pay.** Nothing in a 30-tester playtest measures a commercial outcome.
- **Store, league and duel economics.** Purchases, cosmetics and competition are not part of the pilot. The PP-contest odds in [planned systems](planned_systems.md#5-odyssey-duels) are mathematical analysis of the wheel table, not measured player behaviour.
- **Era transitions and the 100-destination roadmap.** A 28-day playtest sees the first journeys only.

## Ethics and privacy

- Testers opt in.
- Step data is used only to run the game and to compute aggregates.
- No individual's location trail or step history is published.
- Results are reported as aggregates without names.
