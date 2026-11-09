# Full Economy V2: World Tour, Chronons, Missions, Puzzles, Store and Cosmetics

A long-horizon projection layer on top of the [Wellness Odyssey Economy Lab](../docs/v1_core_economy.md). It models the planned 100-destination World Tour with Chronon-priced journeys, organic and sponsored walking missions, Future Vision puzzles, a Wellness Store with affiliate rewards, Chronon bundles and a proposed starter cosmetic catalog.

> **Synthetic players; hypothetical economy values.** Nothing here is observed. Journeys 1-7 keep their implemented PP; journeys 8-100 are placeholders. Every value that is not linked to V1 code is a labelled hypothetical input in [`config/scenario_config.js`](config/scenario_config.js). Wheel V3 is offline-demo functionality. V2 adds files only under `full_economy_v2/` and modifies no V1 file.

**Start here:** [the case study](docs/case_study.md) · [generated results and the fifteen questions](docs/results.md) · [the interactive lab](dashboard/index.html) (open the file in a browser; no server needed) · [all tables and figures](outputs).

## Reproduce

```bash
node full_economy_v2/scripts/run_tests.js   # the V2 tests (Node 18+, no packages)
node full_economy_v2/scripts/build_v2.js    # regenerate outputs/, docs/results.md and generated/ (about a minute)
node full_economy_v2/scripts/check_v2.js    # outputs current, quoted numbers recomputed, links resolve, V1 still green
```

A root `node --test` still runs exactly V1's suite: V2's tests are named `*.spec.js`, which Node's default discovery does not pick up.

## What is where

| Path | What it holds |
|---|---|
| [`config/scenario_config.js`](config/scenario_config.js) | Every hypothetical value, with its label, unit and range; activity profiles, mission, purchase and cosmetic patterns; the eleven cohorts |
| [`config/cosmetics_catalog.js`](config/cosmetics_catalog.js) | 28 proposed cosmetic items; its validator refuses any field that could carry a gameplay effect |
| [`engine/wheel_v3.js`](engine/wheel_v3.js) | Wheel V3 tiers on the reviewed table from `analysis/wheel.js` (expected-value or sampled) |
| [`engine/projection_catalog.js`](engine/projection_catalog.js) | The 100-journey projection, separate PP and price schedules, and the wrapper around V1's catalog validator |
| [`engine/journey_ledger.js`](engine/journey_ledger.js) | The closed-form steady-walker ledger (the two clocks) |
| [`engine/simulation.js`](engine/simulation.js) | Day-by-day synthetic players with every Chronon tracked by source and sink |
| [`engine/business.js`](engine/business.js) | Store and bundle unit economics |
| [`scripts/`](scripts) | Experiments, figures, the build, the checker and the test runner |
| [`generated/wheel_table.js`](generated/wheel_table.js) | The browser copy of the reviewed wheel table, kept byte-identical by the checker |
| [`outputs/`](outputs) | CSV tables and SVG figures A-L |
| [`dashboard/index.html`](dashboard/index.html) | The interactive Full Economy V2 lab |
| [`tests/`](tests) | The V2 tests |
| [`docs/`](docs) | The case study, the generated results and the read-only audit of the offline demo |

## What V2 reuses from V1, unchanged

- `analysis/wheel.js`: the reviewed wheel table, V3 tiers and exact derivations.
- `pilot/pilot_model.js`: core rules, the provisional mission and puzzle values, and the random-number generators. All are linked rather than copied.
- `pilot/world_tour.js`: the catalog validator, run on the V2 projection through a wrapper.
- `assumptions.csv`: the implemented PP rule, pinned by a V2 test.

## Labels

| Label | Meaning |
|---|---|
| **linked** | Read from V1 code at load time; never copied |
| **implemented** | A rule of the current game, pinned by a test to its V1 source |
| **approved** | A modelling decision taken by the product owner for V2, such as organic Chronons accruing while waiting |
| **proposed** | A provisional demo value carried over from V1, such as the 2 km mission |
| **hypothetical** | An exploratory value with no evidence behind it |
