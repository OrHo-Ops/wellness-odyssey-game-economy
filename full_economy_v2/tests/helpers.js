"use strict";
const path = require("node:path");
const ROOT = path.join(__dirname, "..", "..");
const V2 = path.join(__dirname, "..");
const req = (rel) => require(path.join(V2, rel));
module.exports = {
  ROOT, V2, req,
  C: req("config/scenario_config.js"),
  K: req("config/cosmetics_catalog.js"),
  W: req("engine/wheel_v3.js"),
  P: req("engine/projection_catalog.js"),
  L: req("engine/journey_ledger.js"),
  S: req("engine/simulation.js"),
  B: req("engine/business.js"),
  V1Wheel: require(path.join(ROOT, "analysis", "wheel.js")),
  V1Model: require(path.join(ROOT, "pilot", "pilot_model.js")),
  WorldTour: require(path.join(ROOT, "pilot", "world_tour.js")),
  close(assert, actual, expected, tol, msg) {
    assert.ok(Math.abs(actual - expected) <= tol, `${msg}: ${actual} vs ${expected} (tolerance ${tol})`);
  },
  /** A fully deterministic walker: same steps every day, a session every day. */
  steadyCohort(steps, extra = {}) {
    return { label: "steady test walker", activity: { label: "steady", medianDailySteps: steps, activeDayRate: 1 },
      missions: "none", sponsorInReach: false, purchases: "none", cosmetics: "none", ...extra };
  },
};
