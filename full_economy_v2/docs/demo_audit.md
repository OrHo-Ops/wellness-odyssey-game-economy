# Offline demo audit

A read-only audit of the Flutter offline demo, made on 9 November 2026 to check which V2 inputs the demo actually implements. Nothing in the demo was changed or run.

**Scope.** The offline demo lives in the game's private app repository, which is not published here. It has two parts:
- **the full demo:** wheel, walk, collection, atlas and their tests;
- **a shared module** ("the module" below) holding the mission and puzzle logic. The full demo extends the module's state without changing its mission or puzzle rules.

**Evidence.** Every finding below was read from the source and tests of both parts. The Flutter tests were not run, so the evidence is what the code does and what its tests assert, not a fresh test run. File and line citations to the private repository are omitted from this public copy.

## Puzzle and mission rewards

1. **Tile reveals award nothing.**
   - A reveal accepts tiles 0-8, each once, while at least 30 pieces are held. It subtracts 30 pieces and records the tile.
   - It changes no Energy, PP or Chronons.
   - Revealing the ninth distinct tile completes the puzzle and sets its completion flag.
2. **The 100-Energy bonus is awarded exactly once.**
   - The bonus is a single flag, not a running credit: the module's Energy is 100 once the flag is set and 0 before, and only the ninth distinct tile sets it.
   - The full demo adds that fixed 100 to the wheel wallet.
   - The module's tests check 0 Energy before the puzzle is complete, 100 after the ninth tile, still 100 after a refused extra reveal, and 0 after a reset.
3. **Each verified mission awards 90 pieces and 5 Chronons exactly once.**
   - A mission must be started and walked 2,000 m in four simulated 500 m stages until it has arrived, then checked in with its own receipt ID.
   - Only that check-in adds a receipt and 90 pieces. Chronons are not stored but counted as 5 per receipt.
   - A second check-in, a stale or wrong ID and a check-in before arrival are all refused.
   - "Verified" means the simulated check-in. The screens state that walking, location, arrival and verification are all simulated, with no GPS, QR check-in or partner.
4. **Walking steps are counted once, and mission walking is not counted as steps at all.**
   - Steps enter the demo only in synthetic batches of 1,000. They come from a demo-controls button or from the app's step-sync stand-in, which ignores the step count it is given.
   - Each batch is added to one running total, and the Energy credited is the increase in that total divided by 10, so no step makes Energy twice.
   - A mission's 2 km is a separate distance counter that makes no steps, no Energy and no reward until check-in.
5. **Other reward paths and limits.**
   - *Three missions per session.* A fourth start or check-in is refused, so a session earns at most 15 Chronons and 270 pieces: exactly one puzzle.
   - *One source and one sink each.* Pieces come only from missions and are spent only on tiles. Chronons come only from missions, and their only sink is the one-off journey-unlock concept. The module has no PP; PP comes only from the wheel.
   - *Collection.* Completing the puzzle also marks the Jaffa Gate artwork as collected, for the session only.
   - *Session only.* Nothing persists, and Reset clears every wallet, tile, receipt and mission stage.
   - *Sponsored framing.* The only quest is presented as a sponsored walk to a fictional participating business, with "proposed economy values".

## The rest of the demo

| Mechanic | In the demo | In the V2 model | Verdict |
|---|---|---|---|
| Energy cap | Step credit stops once the wallet, including the puzzle bonus, holds 500 Energy. The extra steps are not banked | No cap in the analytical baseline; caps of 250 and 500 compared, on step Energy only | The 500 scenario is the demo's rule |
| Wheel | The 1,000-ticket table matches the backend's. Stakes of 10, 50 and 100 pay base PP × stake ÷ 50 in exact tenths, carrying the fraction. The refund returns the Energy. 1.045 PP per staked Energy at every stake | The same table and tiers, built from V1's `analysis/wheel.js` | Match |
| Journey completion | Jerusalem completes at 1,500 PP. PP above that is kept as unallocated, and the wheel is disabled once the journey is complete | The overshoot becomes pending PP for the next journey; no spins without an active journey | Consistent (the demo has no next journey) |
| Journey unlock | A one-off concept: a configurable price of 5, 10 or 15 Chronons marked "hypothetical", spent once, with no prerequisite and no playable route. The screen states "No approved production price" | Price families for journeys 2-100, all hypothetical; a journey unlocks after its prerequisites | No approved price to match |
| Destinations | Jerusalem is playable. Dead Sea (region 2) and Petra (region 3) are implemented catalog content, locked in the demo. Rome is a roadmap concept with no region. "The 100-destination World Tour is a roadmap" | Journeys 1-3 are Jerusalem, Dead Sea and Petra; journeys 8-100 are placeholders | Match |
| Not in the demo | Organic Chronons and pieces from walking, completion rewards, daily and milestone bonuses, the Wellness Store, bundles and cosmetics. The shop route opens the Future Vision collection | Modelled, all labelled hypothetical | Labels unchanged |

## What changes in V2

No model default changes. The source confirms what V2 had taken from V1's documentation:
- tiles pay nothing;
- the completion Energy is paid once;
- the reference mission pays 90 pieces and 5 Chronons once.

Two V2 rules are assumptions rather than demo behaviour, and both are labelled hypothetical in the configuration:
- the model credits the extra part of a mission route as steps, while the demo's mission distance makes no steps;
- the model also pays the reference reward for organic missions, while the demo's only quest is sponsored.

**Limits V2 does not adopt.** The demo's three-mission limit is a boundary of the demo session, not a rule V2 adopts; V2 allows at most one mission a day.

**Values still unapproved.** No journey price has been approved. Organic Chronons and pieces, completion rewards, the store, bundles and cosmetics have no demo implementation, so they stay labelled hypothetical.

**The Energy cap.** The demo's 500-Energy step cap matches the cap approved as a closed-beta experiment, which V2 already compares as a scenario.
