/* Illustrative World Tour catalog for the 30-tester pilot.
 *
 * NOT a production catalog and not implemented gameplay. It shows the format
 * with the cities and monuments named in the planning brief. The prerequisite
 * graph follows the approved design baseline: Jerusalem is the free start
 * journey and the other cities each require it. The long-term 100-destination
 * World Tour is a roadmap and is not written out here.
 *
 * Values: null means unset. Jerusalem's 1,500 PP and the Jaffa Gate puzzle
 * settings are links to pilot_model.js, never copies. Every other amount is
 * unset, so this catalog is valid but not ready to simulate.
 *
 * Runs under Node (require) and in the browser (window.WorldTourCatalogs).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root.WorldTourCatalogs = root.WorldTourCatalogs || {}).illustrative = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  return {
    id: "illustrative-pilot",
    label: "Illustrative pilot World Tour",
    status: "pilot-illustrative",

    // Walking-based earning only: an amount per N verified steps. Rates unset.
    organic: {
      chronons: { verifiedSteps: { amount: null, perSteps: null } },
      pieces: { verifiedSteps: { amount: null, perSteps: null } },
    },

    eras: [
      {
        id: "present-day", label: "Present Day", playOrder: 1, status: "illustrative",
        startJourneys: ["jerusalem"], completion: "all", next: "earlier-era",
        transitionReward: null, // undecided
      },
      {
        id: "earlier-era", label: "Earlier historical era (unnamed)", playOrder: 2, status: "roadmap",
        startJourneys: [], completion: "all", next: null,
      },
    ],

    regions: [
      { id: "israel", label: "Israel" },
      { id: "france", label: "France" },
      { id: "italy", label: "Italy" },
    ],
    cities: [
      { id: "jerusalem", label: "Jerusalem", region: "israel" },
      { id: "paris", label: "Paris", region: "france" },
      { id: "rome", label: "Rome", region: "italy" },
      { id: "pisa", label: "Pisa", region: "italy" },
    ],
    monuments: [
      { id: "jaffa-gate", label: "Jaffa Gate", city: "jerusalem" },
      { id: "eiffel-tower", label: "Eiffel Tower", city: "paris" },
      { id: "arc-de-triomphe", label: "Arc de Triomphe", city: "paris" },
      { id: "colosseum", label: "Colosseum", city: "rome" },
      { id: "leaning-tower", label: "Leaning Tower of Pisa", city: "pisa" },
    ],

    journeys: [
      {
        id: "jerusalem", label: "Jerusalem", era: "present-day", city: "jerusalem",
        pp: { ref: "RULES.jerusalemJourneyPp" }, requires: [], onComplete: { chronons: null },
      },
      {
        id: "paris", label: "Paris", era: "present-day", city: "paris",
        pp: null, price: null, requires: ["jerusalem"], onComplete: { chronons: null },
      },
      {
        id: "rome", label: "Rome", era: "present-day", city: "rome",
        pp: null, price: null, requires: ["jerusalem"], onComplete: { chronons: null },
      },
      {
        id: "pisa", label: "Pisa", era: "present-day", city: "pisa",
        pp: null, price: null, requires: ["jerusalem"], onComplete: { chronons: null },
      },
    ],

    // Future Vision puzzles, revealed from one general pool of pieces.
    puzzles: [
      {
        id: "jaffa-gate", label: "Jaffa Gate: Future Vision", monument: "jaffa-gate",
        tiles: { ref: "DEFAULTS.puzzleTiles" }, piecesPerTile: { ref: "DEFAULTS.piecesPerTile" },
        onComplete: { energy: { ref: "DEFAULTS.puzzleCompletionEnergy" } }, availableWhen: "start",
      },
      {
        id: "eiffel-tower", label: "Eiffel Tower: Future Vision", monument: "eiffel-tower",
        tiles: null, piecesPerTile: null, onComplete: { energy: null }, availableWhen: { journeyUnlocked: "paris" },
      },
      {
        id: "arc-de-triomphe", label: "Arc de Triomphe: Future Vision", monument: "arc-de-triomphe",
        tiles: null, piecesPerTile: null, onComplete: { energy: null }, availableWhen: { journeyUnlocked: "paris" },
      },
      {
        id: "colosseum", label: "Colosseum: Future Vision", monument: "colosseum",
        tiles: null, piecesPerTile: null, onComplete: { energy: null }, availableWhen: { journeyUnlocked: "rome" },
      },
      {
        id: "leaning-tower", label: "Leaning Tower of Pisa: Future Vision", monument: "leaning-tower",
        tiles: null, piecesPerTile: null, onComplete: { energy: null }, availableWhen: { journeyUnlocked: "pisa" },
      },
    ],

    collections: [
      { id: "paris", label: "Paris collection", city: "paris", puzzles: ["eiffel-tower", "arc-de-triomphe"], reward: null },
    ],
  };
});
