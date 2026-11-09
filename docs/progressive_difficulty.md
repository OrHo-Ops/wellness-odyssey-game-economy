# Planned: A Progressive Difficulty Curve for the World Tour

*Accessible → Balanced → Challenging*

> **Status: design direction, work in progress.** This is the intended shape of the 100-journey World Tour's difficulty. **It is not a calibrated or approved result.**
>
> - **Unset until the final calibration is approved:** stage boundaries, coverage targets, PP growth per stage and every other value.
> - **What the numbers below are:** findings from the existing [Full Economy V2](../full_economy_v2/docs/case_study.md) reference calibration, which this direction responds to. They are not targets for the new curve.

## Why a progressive curve

The V2 reference calibration showed two things.
1. **The tour's shape decides how scarcity feels.** A walking-only player first has to wait for Chronons at journey 60, whether they walk 3,000, 6,000 or 10,000 steps a day. The point where scarcity starts is a property of the catalog, not of the player.
2. **Once scarcity starts, it arrives as blocked sessions, not as a harder walk.** No spins happen without an active journey, so a Chronon-bound player banks Energy through the wait and then completes the next journey the moment it unlocks. In that hypothetical calibration, 54% of a synthetic walking-only player's sessions in the tour were fully blocked (see the [README](../README.md#10-a-discovered-design-risk-blocked-sessions)).

A progressive curve aims to make difficulty rise **deliberately and legibly** across the tour, rather than as a cliff where the catalog's price schedule overtakes walking.

## The three stages (intended character)

| Stage | Intended player experience | Levers it is expected to use | Status |
|---|---|---|---|
| **Accessible** | Early journeys come quickly. Walking alone pays for the next journey, so a new player never waits for Chronons, and the wheel and journeys teach the loop | Shorter journeys (PP); prices at or below what walking earns during the previous journey (coverage above 1) | Design direction. Journey range **unset** |
| **Balanced** | Walking alone still roughly keeps pace. Missions and puzzles start to matter and shorten any gap | PP growth resumes; coverage near 1 | Design direction. Journey range and values **unset** |
| **Challenging** | Long journeys with real goals. Walking-only players may wait for Chronons, but waits stay bounded and there is always a free path. Missions become most valuable here, and spending shortens waits without buying progress | Longer journeys; coverage below 1 within a limit still to be set | Design direction. Journey range, coverage floor and maximum acceptable wait **unset** |

**These descriptions are the intended character of each stage, not calibrated behaviour.** In particular, how much of the challenge comes from longer journeys (the PP clock) and how much from scarcer Chronons (the Chronon clock) is undecided.

## Guardrails that carry over

These come from approved rules or from V2's results, and any calibration of the curve must keep them.

- **No deadlock.** Organic Chronons keep accruing while no journey is active (an approved V2 modelling rule). Without it, V2 found that 100% of synthetic moderate walking-only players were stuck for good.
- **Money accelerates access, never progress.** Purchases reward Chronons only. They never directly generate Energy, PP, journey progress or Odyssey Score.
- **Set the PP clock first.** Total journey length is the floor no Chronon setting can beat, and it decides whether casual walkers can finish at all.
- **Price as coverage, not as a price list.** V2 found that coverage at or above 1 keeps walking-only players PP-bound. Its stated design hypothesis maps to late-game coverage of roughly 0.8 to 1.0, where walking-only waits appear late and missions or bundles remove them.
- **The free path must not depend on commerce.** In V2, lower mission or store participation slowed only the players who used them; the walking-only path was unchanged.

## Open decisions

- Where each stage begins and ends, in journeys.
- Coverage and PP growth targets for each stage.
- The maximum acceptable wait in the Challenging stage, and for which persona.
- Whether long Chronon-bound stretches are softened. V2 lists three options, none decided:
  - keep late coverage near 1;
  - let a player choose and start walking toward the next journey before paying;
  - give banked Energy a non-PP use while waiting.
- Whether stage transitions are visible to the player, for example on the World Atlas.
- How the curve interacts with eras and the next era's economy.

## How it will be evaluated

The V2 engine already exposes the levers this curve needs:
- separate PP pacing curves;
- price schedules set by coverage at chosen journeys;
- the balance sweep over late-game coverage.

A candidate curve would be run through the same synthetic cohorts and the same checks, and compared on:
- blocked sessions;
- waiting time by stage;
- the share of casual walkers who finish;
- the day each persona reaches journey 100.

**Acceptance criteria are unset.** They belong to the calibration's approval, not to this document. Real tolerance of waiting can only be measured with longer cohorts or staged releases, not in the 28-day pilot.
