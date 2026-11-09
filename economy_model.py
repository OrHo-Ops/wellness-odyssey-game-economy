"""Wellness Odyssey: pre-launch game economy simulation.

Every player in this file is SYNTHETIC. The game has not launched and there is
no player data. Inputs come from assumptions.csv and carry one of four labels:

    verified      a rule of the game, read from its implementation
    illustrative  a synthetic stand-in for a production value that was not
                  published when this model was built (the wheel's reward table)
    assumption    a modelling choice about behaviour: how much a player walks,
                  how often the app is opened
    hypothetical  a commercial input with no evidence behind it

    python economy_model.py

runs the checks, the simulation and the scenarios, then writes two charts and
four tables to outputs/.
"""

from __future__ import annotations

import csv
import sys
from dataclasses import dataclass, replace
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "outputs"

CAP_GRID = (250, 375, 500, 750, 1000, 1500)  # bank caps tested in the sensitivity run
VISITS_PER_QUEST_GRID = (10, 25, 60)  # monthly volumes for the unit-economics table

LEDGER_FLOWS = ("steps", "energy_carried_in", "energy_from_steps", "energy_lost_to_cap",
                "energy_credited_after_cap", "bonus_energy", "energy_available", "spins", "energy_spent",
                "energy_carried_out", "pp_expected", "pp_realized")

PROFILES = (  # synthetic activity levels: modelling scenarios, not observed segments
    ("Low", "profile_low_mean_steps"),
    ("Moderate", "profile_moderate_mean_steps"),
    ("High", "profile_high_mean_steps"),
)


# --------------------------------------------------------------------------
# Inputs
# --------------------------------------------------------------------------

def load_assumptions(path: Path = ROOT / "assumptions.csv") -> dict[str, float]:
    """Read assumptions.csv into {parameter: value}."""
    with path.open(newline="", encoding="utf-8") as handle:
        return {row["parameter"]: float(row["value"]) for row in csv.DictReader(handle)}


@dataclass(frozen=True)
class Economy:
    """The rules of the game economy.

    Everything is verified against the game except the wheel's reward table,
    which is an illustrative stand-in: the production table was not published
    when this model was built.
    """

    steps_per_energy: int
    bank_cap: int
    spin_cost: int
    starting_energy: int
    starting_coins: int
    goal_steps: int
    goal_bonus: int
    milestone_steps: np.ndarray   # daily step thresholds
    milestone_energy: np.ndarray  # Energy paid at each threshold (bypasses the cap)
    milestone_coins: np.ndarray
    wheel_points: np.ndarray      # Progress Points per wedge; the free respin is last
    wheel_probs: np.ndarray
    region_costs: np.ndarray      # Progress Points needed for each region
    quest_energy: int
    quest_coins: int
    walking_bonus_rate: float     # extra Energy on steps walked on the way to a quest

    @classmethod
    def from_assumptions(cls, a: dict[str, float]) -> "Economy":
        tiers = sorted(int(k.split("_")[1]) for k in a if k.startswith("milestone_") and k.endswith("_energy"))
        wedges = sorted(int(k.rsplit("_", 1)[1]) for k in a if k.startswith("wheel_weight_pp_"))
        weights = np.array([a[f"wheel_weight_pp_{p}"] for p in wedges] + [a["wheel_weight_free_respin"]])
        regions = np.arange(int(a["region_count"]))
        return cls(
            steps_per_energy=int(a["steps_per_energy"]),
            bank_cap=int(a["energy_bank_cap"]),
            spin_cost=int(a["spin_cost"]),
            starting_energy=int(a["starting_energy"]),
            starting_coins=int(a["starting_coins"]),
            goal_steps=int(a["default_step_goal"]),
            goal_bonus=int(a["goal_bonus_energy"]),
            milestone_steps=np.array(tiers),
            milestone_energy=np.array([int(a[f"milestone_{t}_energy"]) for t in tiers]),
            milestone_coins=np.array([int(a[f"milestone_{t}_coins"]) for t in tiers]),
            wheel_points=np.array(wedges + [0]),
            wheel_probs=weights / weights.sum(),
            region_costs=np.rint(a["region_base_cost"] * a["region_cost_multiplier"] ** regions).astype(int),
            quest_energy=int(a["quest_reward_energy"]),
            quest_coins=int(a["quest_reward_coins"]),
            walking_bonus_rate=a["quest_walking_bonus_rate"],
        )

    @property
    def circuit_total(self) -> int:
        """Progress Points needed to finish every region."""
        return int(self.region_costs.sum())

    @property
    def ev_per_draw(self) -> float:
        """Expected Progress Points of one wheel draw (free respins count as zero)."""
        return float(self.wheel_points @ self.wheel_probs)

    @property
    def ev_per_paid_spin(self) -> float:
        """Expected Progress Points per spin actually paid for.

        A free respin pays nothing and charges nothing, and the player draws
        again on the same Energy. Every spin that is paid for therefore ends
        on a paying wedge, so its average is the per-draw average divided by
        the share of draws that pay: ev_per_draw / (1 - p_respin).
        """
        return self.ev_per_draw / (1.0 - self.wheel_probs[-1])


# --------------------------------------------------------------------------
# Simulation
# --------------------------------------------------------------------------

def simulate(
    econ: Economy,
    mean_steps: float,
    *,
    days: int,
    n_players: int,
    seed: int,
    step_cv: float,
    sessions_per_day: int = 1,
    bank_cap: int | None = None,
    goal_steps: int | None = None,
    quests_per_week: float = 0.0,
    quest_walk_steps: int = 0,
) -> dict[str, np.ndarray]:
    """Simulate `n_players` synthetic players for `days` days.

    Daily sequence, in the order the game applies it:
      1. The player carries over yesterday's unspent Energy (it never expires).
      2. The player walks. Steps reach the game only when the app is opened.
      3. At each app session the new steps convert to Energy (10 steps = 1,
         leftover steps carry). The bank cap limits how much of that is
         credited; the rest is lost. Milestone and goal bonuses are then added
         on top, outside the cap.
      4. The player spins while the balance covers a whole spin. Spins are
         whole numbers. A free respin pays nothing, charges nothing and is
         followed by another draw.
      5. Whatever is left carries to the next session.
    Once the last region is complete the game accepts no further spins, so
    spinning stops for good while Energy keeps arriving.

    Returns arrays shaped (days, n_players). "spins" counts paid spins only;
    free respin draws are counted separately in "respins".
    """
    cap = econ.bank_cap if bank_cap is None else bank_cap
    goal = econ.goal_steps if goal_steps is None else goal_steps
    rng_steps, rng_wheel, rng_quest = (np.random.default_rng([seed, stream]) for stream in range(3))
    cdf = np.cumsum(econ.wheel_probs)
    cdf[-1] = 1.0  # guard against floating-point shortfall in the last wedge
    respin = len(econ.wheel_points) - 1
    steps_per_bonus_energy = round(econ.steps_per_energy / econ.walking_bonus_rate)

    balance = np.full(n_players, econ.starting_energy, dtype=np.int64)
    leftover_steps = np.zeros(n_players, dtype=np.int64)
    points = np.zeros(n_players, dtype=np.int64)
    coins = np.full(n_players, econ.starting_coins, dtype=np.int64)
    fields = ("steps", "carry_in", "converted", "lost", "credited", "bonus", "spins", "respins", "carry_out",
              "pp", "pp_cum", "coins", "goal_reached", "first_milestone")
    out = {name: np.zeros((days, n_players), dtype=np.int64) for name in fields}

    for day in range(days):
        if step_cv > 0:  # gamma: never negative and skewed to the right, like daily step counts
            steps = np.rint(rng_steps.gamma(1 / step_cv**2, mean_steps * step_cv**2, n_players)).astype(np.int64)
        else:
            steps = np.full(n_players, round(mean_steps), dtype=np.int64)
        out["steps"][day] = steps
        out["carry_in"][day] = balance
        seen = np.zeros(n_players, dtype=np.int64)  # steps already synced today
        claimed = np.zeros((n_players, len(econ.milestone_steps)), dtype=bool)
        goal_paid = np.zeros(n_players, dtype=bool)

        for session in range(1, sessions_per_day + 1):
            # Sync: convert the steps walked since the previous session.
            total_seen = steps * session // sessions_per_day
            pending = total_seen - seen + leftover_steps
            seen = total_seen
            converted = pending // econ.steps_per_energy
            leftover_steps = pending % econ.steps_per_energy
            credited = np.minimum(converted, np.maximum(cap - balance, 0))

            # Bonuses bypass the cap: each is paid once per day when crossed.
            newly = (seen[:, None] >= econ.milestone_steps[None, :]) & ~claimed
            claimed |= newly
            reached_goal = (seen >= goal) & ~goal_paid
            goal_paid |= reached_goal
            bonus = newly @ econ.milestone_energy + reached_goal * econ.goal_bonus
            coins += newly @ econ.milestone_coins

            # Scenario only: a verified quest arrival pays Energy and Coins, plus the
            # walking bonus on the steps assumed to be walked on the way there.
            if quests_per_week > 0 and session == sessions_per_day:
                arrived = rng_quest.random(n_players) < quests_per_week / 7
                walking_bonus = np.minimum(steps, quest_walk_steps) // steps_per_bonus_energy
                bonus = bonus + arrived * (econ.quest_energy + walking_bonus)
                coins += arrived * econ.quest_coins

            balance += credited + bonus
            out["converted"][day] += converted
            out["credited"][day] += credited
            out["lost"][day] += converted - credited
            out["bonus"][day] += bonus

            # Spin: whole spins only, each a uniform roll against the cumulative
            # weights. A roll on the free respin is not charged and not counted
            # as a spin: the player rolls again. Nobody spins once their last
            # region is complete.
            while True:
                can_spin = np.flatnonzero((balance >= econ.spin_cost) & (points < econ.circuit_total))
                if can_spin.size == 0:
                    break
                wedge = np.searchsorted(cdf, rng_wheel.random(can_spin.size), side="right")
                paying = can_spin[wedge != respin]
                balance[paying] -= econ.spin_cost
                points[can_spin] += econ.wheel_points[wedge]
                out["spins"][day, paying] += 1
                out["respins"][day, can_spin[wedge == respin]] += 1
                out["pp"][day, can_spin] += econ.wheel_points[wedge]

        out["carry_out"][day] = balance
        out["pp_cum"][day] = np.minimum(points, econ.circuit_total)
        out["coins"][day] = coins
        out["goal_reached"][day] = goal_paid
        out["first_milestone"][day] = claimed[:, 0]
    return out


def first_day_reaching(pp_cum: np.ndarray, target: int) -> np.ndarray:
    """Per player: the first day (1-based) cumulative points reach `target`, inf if never."""
    reached = pp_cum >= target
    return np.where(reached.any(axis=0), reached.argmax(axis=0) + 1.0, np.inf)


def summarise(sim: dict[str, np.ndarray], econ: Economy, window_days: int) -> dict[str, float | str]:
    """Summarise one run.

    `sim` covers the whole projection, which is longer than the reported
    window. Everything except the finish day is measured inside the window.
    The finish day is read from the full run and labelled by where it falls,
    so a finish after the window is never presented as a window result.

    Daily rates are averaged over player-days that end with regions still to
    complete. Once a player finishes, the game accepts no more spins, so later
    days say nothing about the running economy.
    """
    window = {name: values[:window_days] for name, values in sim.items()}
    playing = window["pp_cum"] < econ.circuit_total
    rates = ("steps", "converted", "lost", "credited", "bonus", "spins", "carry_out", "goal_reached", "first_milestone")
    per_day = {name: float(window[name][playing].mean()) for name in rates}
    income = per_day["credited"] + per_day["bonus"]
    final = window["pp_cum"][-1]
    finish = first_day_reaching(sim["pp_cum"], econ.circuit_total)
    first_region = first_day_reaching(sim["pp_cum"], int(econ.region_costs[0]))
    finish_median = float(np.median(finish))
    basis = "within the reported window" if finish_median <= window_days else "projection beyond the window"
    return {
        "steps_per_day": per_day["steps"],
        "step_energy_per_day": per_day["converted"],
        "energy_lost_to_cap_per_day": per_day["lost"],
        "pct_step_energy_lost": 100 * per_day["lost"] / per_day["converted"],
        "energy_credited_per_day": per_day["credited"],
        "bonus_energy_per_day": per_day["bonus"],
        "energy_income_per_day": income,
        "bonus_share_pct": 100 * per_day["bonus"] / income,
        "energy_per_1000_steps": 1000 * income / per_day["steps"],
        "pct_days_goal_reached": 100 * per_day["goal_reached"],
        "pct_days_first_milestone": 100 * per_day["first_milestone"],
        "spins_per_day": per_day["spins"],
        "energy_spent_per_day": per_day["spins"] * econ.spin_cost,
        "energy_carried_forward_per_day": per_day["carry_out"],
        "pp_expected_per_day": per_day["spins"] * econ.ev_per_paid_spin,
        "pp_end_of_window_mean": float(final.mean()),
        "pp_end_of_window_p10": float(np.percentile(final, 10)),
        "pp_end_of_window_p90": float(np.percentile(final, 90)),
        "regions_completed_in_window": float(np.searchsorted(np.cumsum(econ.region_costs), final, side="right").mean()),
        "pct_players_finished_in_window": 100 * float((final >= econ.circuit_total).mean()),
        "first_region_day_median": float(np.median(first_region)),
        "finish_day_median": finish_median,
        "finish_day_p10": float(np.percentile(finish, 10)),
        "finish_day_p90": float(np.percentile(finish, 90)),
        "finish_day_basis": basis,
        "coins_end_of_window": float(window["coins"][-1].mean()),
        "unspent_energy_end_of_window": float(window["carry_out"][-1].mean()),
    }


def daily_ledger(sim: dict[str, np.ndarray], econ: Economy, days: int) -> list[dict[str, float | str]]:
    """Average ledger of one profile, day by day.

    Energy flows are averaged over players who end the day with regions still
    to complete (blank once nobody is left). Cumulative points cover everyone.
    """
    rows = []
    for day in range(days):
        cumulative = sim["pp_cum"][day]
        playing = cumulative < econ.circuit_total
        row: dict[str, float | str] = {"day": day + 1, "pct_players_still_playing": 100 * float(playing.mean())}
        if playing.any():
            mean = {name: float(values[day][playing].mean()) for name, values in sim.items()}  # still playing
            row.update({
                "steps": mean["steps"],
                "energy_carried_in": mean["carry_in"],
                "energy_from_steps": mean["converted"],
                "energy_lost_to_cap": mean["lost"],
                "energy_credited_after_cap": mean["credited"],
                "bonus_energy": mean["bonus"],
                "energy_available": mean["carry_in"] + mean["credited"] + mean["bonus"],
                "spins": mean["spins"],
                "energy_spent": mean["spins"] * econ.spin_cost,
                "energy_carried_out": mean["carry_out"],
                "pp_expected": mean["spins"] * econ.ev_per_paid_spin,
                "pp_realized": mean["pp"],
            })
        else:
            row.update(dict.fromkeys(LEDGER_FLOWS, ""))
        row.update({
            "pp_cumulative_mean": float(cumulative.mean()),
            "pp_cumulative_p10": float(np.percentile(cumulative, 10)),
            "pp_cumulative_p90": float(np.percentile(cumulative, 90)),
        })
        rows.append(row)
    return rows


def unit_economics(a: dict[str, float]) -> list[dict[str, float | str]]:
    """Hypothetical sponsored-quest pilot: revenue and contribution for three pricing models.

    Every input is a placeholder. Nothing here is a forecast.
    """
    quests = a["pilot_sponsored_quests"]
    base_visits = (a["pilot_monthly_active_players"] * a["pilot_eligible_share"] * a["pilot_participation_rate"]
                   * a["pilot_quests_started_per_participant"] * a["pilot_verified_visit_rate"])
    models = {  # (fixed fee per quest per month, fee per verified visit)
        "Fixed fee": (a["price_fixed_fee"], 0.0),
        "Per verified visit": (0.0, a["price_per_verified_visit"]),
        "Hybrid": (a["price_hybrid_fixed_fee"], a["price_hybrid_per_visit"]),
    }
    rows = []
    for visits_per_quest in sorted({base_visits / quests, *map(float, VISITS_PER_QUEST_GRID)}):
        visits = visits_per_quest * quests
        cost = quests * a["cost_merchant_servicing"] + visits * a["cost_per_verified_visit"]
        for name, (fixed, per_visit) in models.items():
            revenue = quests * fixed + visits * per_visit
            rows.append({
                "model": name,
                "visits_per_quest_per_month": visits_per_quest,
                "verified_visits_per_month": visits,
                "revenue_usd": revenue,
                "operating_cost_usd": cost,
                "contribution_usd": revenue - cost,
                "contribution_margin_pct": 100 * (revenue - cost) / revenue,
                "merchant_cost_per_visit_usd": revenue / visits,
            })
    return rows


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------

def run_checks(econ: Economy, a: dict[str, float]) -> None:
    """Hand-calculated cases for the game's rules, then identities that must always hold."""
    projection_days = int(a["projection_days"])
    assert econ.region_costs.tolist() == [1500, 1620, 1750, 1890, 2041, 2204, 2380]
    assert econ.circuit_total == 13385
    assert abs(econ.wheel_probs.sum() - 1) < 1e-12 and econ.wheel_points[-1] == 0

    # Free respin: a paid spin always ends on a paying wedge, so its average must equal the
    # average over the paying wedges alone. Computed here without using ev_per_paid_spin.
    paying_points = econ.wheel_points[:-1].astype(float)
    paying_probs = econ.wheel_probs[:-1] / econ.wheel_probs[:-1].sum()
    respin_prob = float(econ.wheel_probs[-1])
    assert abs(float(paying_points @ paying_probs) - econ.ev_per_paid_spin) < 1e-9
    assert econ.ev_per_paid_spin >= econ.ev_per_draw

    def steady(mean_steps: int, sessions: int = 1, **kwargs) -> dict[str, np.ndarray]:
        """Four identical players who walk exactly `mean_steps` every day for three days."""
        return simulate(econ, mean_steps, days=3, n_players=4, seed=1, step_cv=0.0,
                        sessions_per_day=sessions, **kwargs)

    # 5,000 steps: 500 Energy fits the bank exactly; +50 milestone, +100 goal -> 13 spins.
    run = steady(5000)
    assert (run["credited"] == 500).all() and (run["lost"] == 0).all()
    assert (run["bonus"] == 150).all() and (run["spins"] == 13).all() and (run["carry_out"] == 0).all()

    # 10,000 steps in one session: half the step Energy is lost; bonuses still land.
    run = steady(10000)
    assert (run["credited"][0] == 500).all() and (run["lost"][0] == 500).all()
    assert (run["bonus"] == 325).all() and (run["spins"] == 16).all() and (run["carry_out"] == 25).all()
    assert (run["credited"][1] == 475).all()  # 25 Energy was already in the bank

    # The same day in two sessions: 26 spins. Day 1 loses nothing; from day 2 the
    # 25 Energy left in the bank takes up headroom, so 25 is lost each day.
    run = steady(10000, sessions=2)
    assert (run["spins"] == 26).all() and (run["carry_out"] == 25).all()
    assert run["lost"][:, 0].tolist() == [0, 25, 25]

    # Leftover steps carry: 3,004 steps a day gives 300, 300, then 301 Energy.
    assert steady(3004)["converted"][:, 0].tolist() == [300, 300, 301]

    # A goal the player never reaches pays nothing; the minimum goal pays every day.
    assert (steady(2000)["bonus"] == 0).all()
    assert (steady(2000, goal_steps=int(a["min_step_goal"]))["bonus"] == 100).all()

    # A quest arrival pays 150 Energy and 100 Coins, plus 20% on 1,300 walked steps (26 Energy).
    run = steady(2000, quests_per_week=7, quest_walk_steps=1300)
    assert (run["bonus"] == 176).all() and (np.diff(run["coins"], axis=0) == 100).all()

    # Free respins in the simulation, with a wheel that lands on the respin half the time and
    # otherwise pays 100. A respin is never charged and never counted as a spin, so 650 Energy
    # still buys exactly 13 paid spins and every one of them pays: 1,300 points a day.
    respin_wheel = replace(econ, wheel_points=np.array([100, 0]), wheel_probs=np.array([0.5, 0.5]))
    assert respin_wheel.ev_per_draw == 50 and respin_wheel.ev_per_paid_spin == 100
    run = simulate(respin_wheel, 5000, days=3, n_players=400, seed=5, step_cv=0.0)
    assert (run["spins"] == 13).all() and (run["pp"] == 1300).all() and (run["carry_out"] == 0).all()
    assert abs(run["respins"].sum() / run["spins"].sum() - 1) < 0.1  # one free respin per paid spin on average

    # The seven-region limit, with a wheel that always pays exactly 100 points.
    # 133 spins leave 85 points to go, so the 134th spin is allowed and finishes
    # the last region. Its 15 surplus points are not progress, and no spin
    # follows, however much Energy keeps arriving.
    fixed_wheel = replace(econ, wheel_points=np.array([100, 0]), wheel_probs=np.array([1.0, 0.0]))
    run = simulate(fixed_wheel, 10000, days=60, n_players=50, seed=3, step_cv=a["step_cv"])
    assert (run["spins"].sum(axis=0) == 134).all() and (run["pp"].sum(axis=0) == 13400).all()
    assert (run["pp_cum"][-1] == econ.circuit_total).all()
    finish = first_day_reaching(run["pp_cum"], econ.circuit_total).astype(int)
    for player, day in enumerate(finish):
        assert run["spins"][day:, player].sum() == 0 and run["pp"][day:, player].sum() == 0
        assert run["carry_out"][-1, player] > run["carry_out"][day - 1, player]  # unspendable Energy piles up
    # Points carry across region boundaries: regions completed follow cumulative points.
    thresholds = np.cumsum(econ.region_costs)
    points_from_spins = np.minimum(100 * np.cumsum(run["spins"], axis=0), econ.circuit_total)
    assert (run["pp_cum"] == points_from_spins).all()
    assert np.searchsorted(thresholds, run["pp_cum"][-1], side="right").tolist() == [len(thresholds)] * 50

    # Identities on a full stochastic run: every unit of Energy is accounted for.
    run = simulate(econ, 10000, days=projection_days, n_players=3000, seed=7, step_cv=a["step_cv"])
    assert (run["converted"] == run["credited"] + run["lost"]).all()
    assert (run["carry_in"] + run["credited"] + run["bonus"] - run["spins"] * econ.spin_cost == run["carry_out"]).all()
    assert (run["carry_in"][1:] == run["carry_out"][:-1]).all()
    assert (run["carry_out"] >= 0).all() and (np.diff(run["pp_cum"], axis=0) >= 0).all()
    assert (run["pp_cum"][-1] == econ.circuit_total).all() and run["pp_cum"].max() == econ.circuit_total
    playing = run["pp_cum"] < econ.circuit_total
    assert (run["carry_out"][playing] < econ.spin_cost).all()  # nobody stops with a whole spin in hand
    finished_before = np.vstack([np.zeros_like(playing[:1]), ~playing[:-1]])
    assert (run["spins"][finished_before] == 0).all()  # no spins once the last region is complete

    # Realised wheel pay-outs in the first week, when nobody has finished and every roll is a
    # plain draw. The average per paid spin must match ev_per_paid_spin within four standard
    # errors. With the published table that is about a quarter of a point, half the gap to the
    # per-draw average, so charging for respins would fail here. Free respins must also turn up
    # at their stated rate.
    assert playing[:7].all()
    spins, respins, points = (int(run[name][:7].sum()) for name in ("spins", "respins", "pp"))
    spread = float(np.sqrt(paying_points**2 @ paying_probs - econ.ev_per_paid_spin**2))
    assert abs(points / spins - econ.ev_per_paid_spin) <= 4 * spread / np.sqrt(spins) + 1e-9
    draws = spins + respins
    assert abs(respins / draws - respin_prob) <= 4 * np.sqrt(respin_prob * (1 - respin_prob) / draws) + 1e-9

    # Unit economics: contribution adds up, and each model charges what it says.
    for row in unit_economics(a):
        assert abs(row["revenue_usd"] - row["operating_cost_usd"] - row["contribution_usd"]) < 1e-9
        quests = row["verified_visits_per_month"] / row["visits_per_quest_per_month"]
        if row["model"] == "Fixed fee":
            assert abs(row["revenue_usd"] - quests * a["price_fixed_fee"]) < 1e-9
        if row["model"] == "Per verified visit":
            assert abs(row["merchant_cost_per_visit_usd"] - a["price_per_verified_visit"]) < 1e-9


# --------------------------------------------------------------------------
# Charts
# --------------------------------------------------------------------------

SURFACE, INK, INK_2, MUTED, GRID, AXIS = "#fcfcfb", "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#c3c2b7"
SERIES = {"Low": "#2a78d6", "Moderate": "#eb6834", "High": "#1baf7a"}  # colour-blind-safe order
TITLE_SIZE, TEXT_SIZE, NOTE_SIZE = 15, 11, 10.5


def _style():
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    installed = {font.name for font in font_manager.fontManager.ttflist}
    family = next((name for name in ("Inter", "Segoe UI", "Helvetica Neue", "Arial") if name in installed), "DejaVu Sans")
    plt.rcParams.update({
        "font.family": family, "font.size": TEXT_SIZE, "text.color": INK,
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "axes.edgecolor": AXIS, "axes.labelcolor": INK_2, "axes.linewidth": 0.8,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "axes.axisbelow": True, "grid.color": GRID, "grid.linewidth": 0.8,
        "xtick.color": MUTED, "ytick.color": MUTED, "xtick.labelcolor": INK_2, "ytick.labelcolor": INK_2,
        "xtick.major.size": 0, "ytick.major.size": 0, "lines.solid_capstyle": "round", "lines.solid_joinstyle": "round",
        "legend.frameon": False, "legend.fontsize": NOTE_SIZE,
    })
    return plt


def _thousands(value: float, _position=None) -> str:
    return "0" if value == 0 else f"{value / 1000:g}K"


def _marker(ax, x: float, y: float, colour: str, hollow: bool = False) -> None:
    """A data point. Solid with a background-coloured ring, or hollow for a projected value."""
    face, edge, size = (SURFACE, colour, 7) if hollow else (colour, SURFACE, 8)
    ax.plot(x, y, "o", color=face, markersize=size, markeredgecolor=edge, markeredgewidth=2, zorder=5, clip_on=False)


def _header(fig, title: str, notes: tuple[str, ...], left: float = 0.55) -> tuple[float, float]:
    """Write the title and note lines, measured in inches from the top-left corner.

    Returns (left edge, bottom of the header) as fractions of the figure.
    """
    width, height = fig.get_size_inches()
    fig.text(left / width, 1 - 0.32 / height, title, fontsize=TITLE_SIZE, fontweight="bold", va="center")
    for index, note in enumerate(notes):
        fig.text(left / width, 1 - (0.68 + 0.25 * index) / height, note, fontsize=NOTE_SIZE, color=INK_2, va="center")
    return left / width, 1 - (0.62 + 0.25 * len(notes)) / height


def chart_progression(ledgers: dict[str, list[dict]], summaries: dict[str, dict], a: dict[str, float],
                      econ: Economy, path: Path) -> None:
    """Chart 1: cumulative Progress Points over the reported window, by profile."""
    plt = _style()
    from matplotlib.lines import Line2D
    from matplotlib.ticker import FuncFormatter

    days = int(a["horizon_days"])
    x = np.arange(days + 1)
    fig, ax = plt.subplots(figsize=(9.2, 6), dpi=160)
    for name, key in PROFILES:
        colour = SERIES[name]
        mean, low, high = (np.array([0.0] + [row[column] for row in ledgers[name]])
                           for column in ("pp_cumulative_mean", "pp_cumulative_p10", "pp_cumulative_p90"))
        ax.fill_between(x, low, high, color=colour, alpha=0.12, linewidth=0)
        ax.plot(x, mean, color=colour, linewidth=2, label=f"{name}: {a[key]:,.0f} steps a day on average")
        finish = summaries[name]["finish_day_median"]
        if finish <= days:  # mark the day by which half of this profile has finished
            _marker(ax, finish, econ.circuit_total, colour)
            ax.annotate(f"Day {finish:.0f}", (finish, econ.circuit_total), xytext=(0, 9),
                        textcoords="offset points", ha="center", fontsize=NOTE_SIZE, color=INK_2)
        else:  # otherwise label where the profile stands at the end of the window
            _marker(ax, days, mean[-1], colour)
            ax.annotate(f"{mean[-1]:,.0f} points on day {days}", (days, mean[-1]), xytext=(-6, 32),
                        textcoords="offset points", ha="right", fontsize=NOTE_SIZE, color=INK_2)

    ax.axhline(econ.circuit_total, color=MUTED, linewidth=1)
    ax.annotate(f"All {len(econ.region_costs)} regions complete: {econ.circuit_total:,} points",
                (0, econ.circuit_total), xytext=(5, 7), textcoords="offset points", fontsize=NOTE_SIZE, color=INK_2)
    regions = ax.secondary_yaxis("right")  # the same scale, labelled by regions completed
    regions.set_yticks(np.cumsum(econ.region_costs), [str(i + 1) for i in range(len(econ.region_costs))])
    regions.set_ylabel("Regions completed", color=INK_2, labelpad=8)
    regions.tick_params(length=0, labelcolor=INK_2)
    regions.spines["right"].set_visible(False)

    ax.set_xlim(0, days)
    ax.set_ylim(0, econ.circuit_total * 1.1)
    ax.set_xticks(range(0, days + 1, 7))
    ax.yaxis.set_major_formatter(FuncFormatter(_thousands))
    ax.set_xlabel("Day")
    ax.set_ylabel("Cumulative Progress Points")
    handles, _ = ax.get_legend_handles_labels()
    handles.append(Line2D([], [], color=INK_2, marker="o", linestyle="None", markersize=7,
                          markeredgecolor=SURFACE, label="Day by which half the players have finished"))
    ax.legend(handles=handles, loc="lower right", handlelength=1.6, borderaxespad=1.2)
    _, top = _header(fig, "Legacy seven-region simulation (October 2026): cumulative Progress Points", (
        f"Average of {a['n_players']:,.0f} synthetic players per profile. Band: 10th to 90th percentile.",
        f"One app session a day. Illustrative reward table. {econ.bank_cap:,}-Energy model cap. No real player data."))
    fig.tight_layout(rect=(0, 0, 1, top))
    fig.savefig(path)
    plt.close(fig)


def chart_sensitivity(rows: list[dict], a: dict[str, float], econ: Economy, path: Path) -> None:
    """Chart 2: how the Energy bank cap changes wasted Energy and pacing (one session a day)."""
    plt = _style()
    from matplotlib.ticker import FuncFormatter

    sessions, window = int(a["sessions_per_day"]), int(a["horizon_days"])
    panels = (  # (column, panel title, panel note, label format)
        ("pct_step_energy_lost", "Step Energy lost to the cap", "Share of the Energy converted from steps", "{:.0f}%"),
        ("finish_day_median", "Days to finish all 7 regions", "Median player. Hollow: projected past day 28",
         "{:.0f} days"),
    )
    fig, axes = plt.subplots(1, 2, figsize=(9.6, 6.2), dpi=160)
    for ax, (metric, title, subtitle, label) in zip(axes, panels):
        is_days = metric == "finish_day_median"
        ax.axvline(econ.bank_cap, color=AXIS, linewidth=1.2, zorder=1)
        ax.annotate(f"Historical model baseline: {econ.bank_cap:,}", (econ.bank_cap, 1), xycoords=("data", "axes fraction"), xytext=(6, -3),
                    textcoords="offset points", va="top", fontsize=NOTE_SIZE, color=INK_2)
        if is_days:  # everything above this line lies outside the reported window
            ax.axhline(window, color=MUTED, linewidth=1, zorder=1)
            ax.annotate(f"day {window}: end of the reported window", (CAP_GRID[-1], window), xytext=(0, 5),
                        textcoords="offset points", ha="right", fontsize=NOTE_SIZE - 0.5, color=INK_2)
        for name, key in PROFILES:
            series = sorted((row["bank_cap"], row[metric]) for row in rows
                            if row["profile"] == name and row["sessions_per_day"] == sessions)
            caps, values = zip(*series)
            ax.plot(caps, values, color=SERIES[name], linewidth=2, zorder=3, label=f"{name}: {a[key]:,.0f} steps a day")
            for cap, value in series:
                _marker(ax, cap, value, SERIES[name], hollow=is_days and value > window)
            at_baseline_cap = dict(series)[econ.bank_cap]  # label only the value at the model's baseline cap
            aside = is_days and name == "High"  # keep clear of the line above
            ax.annotate(label.format(at_baseline_cap), (econ.bank_cap, at_baseline_cap),
                        xytext=(-9, -18) if aside else (9, 7), ha="right" if aside else "left",
                        textcoords="offset points", fontsize=NOTE_SIZE, color=INK, zorder=6)
        ax.set_xticks(CAP_GRID, [f"{cap:,}" for cap in CAP_GRID])
        ax.tick_params(axis="x", labelsize=NOTE_SIZE - 1)
        ax.set_xlim(CAP_GRID[0] - 70, CAP_GRID[-1] + 70)
        ax.set_ylim(0, None)
        ax.set_xlabel("Energy bank cap")
        ax.set_title(title, loc="left", fontsize=12, fontweight="bold", pad=26)
        ax.text(0, 1.035, subtitle, transform=ax.transAxes, fontsize=NOTE_SIZE, color=INK_2)
    axes[0].yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:.0f}%"))
    left, top = _header(fig, "Legacy seven-region simulation (October 2026): sensitivity to the Energy bank cap", (
        "Synthetic players, one app session a day, illustrative reward table. No real player data.",
        "Not the current configuration: production code uses a 250 cap; the pilot build's cap is unverified.",
        "Opening the app twice a day acts almost exactly like doubling the cap."))
    fig.legend(*axes[0].get_legend_handles_labels(), loc="upper left", bbox_to_anchor=(left - 0.012, top + 0.012),
               ncol=3, handlelength=1.4, columnspacing=1.8)
    fig.tight_layout(rect=(0, 0, 1, top - 0.055), w_pad=2.5)
    fig.savefig(path)
    plt.close(fig)


# --------------------------------------------------------------------------
# Run everything
# --------------------------------------------------------------------------

def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: (round(value, 2) if isinstance(value, float) else value) for key, value in row.items()})


def main() -> None:
    a = load_assumptions()
    econ = Economy.from_assumptions(a)
    if "--skip-checks" in sys.argv:  # for what-if runs with an edited rule in assumptions.csv
        print("Checks skipped.")
    else:
        run_checks(econ, a)
        print("Checks passed.")

    # The reported window is 28 days. Every run continues to `projection_days` so that a
    # finish later than the window comes from a longer projection of the same model.
    days, seed = int(a["horizon_days"]), int(a["random_seed"])
    common = dict(days=int(a["projection_days"]), n_players=int(a["n_players"]), step_cv=a["step_cv"])
    scenarios = {  # name -> what changes relative to the baseline
        "baseline": dict(sessions_per_day=int(a["sessions_per_day"])),
        "two_sessions_a_day": dict(sessions_per_day=int(a["alt_sessions_per_day"])),
        "goal_at_minimum": dict(sessions_per_day=int(a["sessions_per_day"]), goal_steps=int(a["min_step_goal"])),
        "two_quests_a_week": dict(sessions_per_day=int(a["sessions_per_day"]),
                                  quests_per_week=a["scenario_quests_per_week"],
                                  quest_walk_steps=int(a["scenario_quest_walk_steps"])),
    }

    scenario_rows, ledger_rows, ledgers, summaries = [], [], {}, {}
    for index, (name, key) in enumerate(PROFILES):
        for scenario, changes in scenarios.items():
            sim = simulate(econ, a[key], seed=seed + index, **common, **changes)
            summary = summarise(sim, econ, days)
            scenario_rows.append({"profile": name, "scenario": scenario, **summary})
            if scenario == "baseline":
                ledgers[name], summaries[name] = daily_ledger(sim, econ, days), summary
                ledger_rows += [{"profile": name, **row} for row in ledgers[name]]

    sensitivity_rows = []
    for cap in CAP_GRID:
        for sessions in (int(a["sessions_per_day"]), int(a["alt_sessions_per_day"])):
            for index, (name, key) in enumerate(PROFILES):
                sim = simulate(econ, a[key], seed=seed + index, bank_cap=cap, sessions_per_day=sessions, **common)
                summary = summarise(sim, econ, days)
                sensitivity_rows.append({"bank_cap": cap, "sessions_per_day": sessions, "profile": name,
                                         **{k: summary[k] for k in ("pct_step_energy_lost", "energy_income_per_day",
                                                                    "pp_end_of_window_mean", "finish_day_median",
                                                                    "finish_day_basis")}})

    OUT.mkdir(exist_ok=True)
    write_csv(OUT / "daily_ledger.csv", ledger_rows)
    write_csv(OUT / "scenario_summary.csv", scenario_rows)
    write_csv(OUT / "cap_sensitivity.csv", sensitivity_rows)
    write_csv(OUT / "sponsored_quest_unit_economics.csv", unit_economics(a))
    chart_progression(ledgers, summaries, a, econ, OUT / "progression_comparison.png")
    chart_sensitivity(sensitivity_rows, a, econ, OUT / "sensitivity_analysis.png")

    print(f"Illustrative wheel: {econ.ev_per_draw:.2f} points per draw, {econ.ev_per_paid_spin:.2f} per paid spin "
          f"(free respins are {econ.wheel_probs[-1]:.1%} of draws). "
          f"All {len(econ.region_costs)} regions: {econ.circuit_total:,} points.")
    header = ("Profile", "Energy/day", "Lost to cap", "Spins/day", f"Points, day {days}", "Finish day")
    print(f"{header[0]:<10}{header[1]:>11}{header[2]:>13}{header[3]:>11}{header[4]:>16}{header[5]:>12}")
    for name, s in summaries.items():
        projected = "" if s["finish_day_median"] <= days else " (projected)"
        print(f"{name:<10}{s['energy_income_per_day']:>11.0f}{s['pct_step_energy_lost']:>12.1f}%"
              f"{s['spins_per_day']:>11.1f}{s['pp_end_of_window_mean']:>16,.0f}"
              f"{s['finish_day_median']:>12.0f}{projected}")
    print(f"Outputs written to {OUT}")


if __name__ == "__main__":
    main()
