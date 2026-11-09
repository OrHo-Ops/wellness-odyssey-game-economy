/* Wellness Odyssey: proposed starter cosmetic catalog (Full Economy V2).
 *
 * EVERY ENTRY IS A PROPOSED EXAMPLE, NOT AN IMPLEMENTED GAME ASSET. Names are
 * illustrative and original. Prices are hypothetical: each item's price comes
 * from its rarity, expressed in weeks of a moderate walker's organic Chronons
 * (scenario key `rarityWeeks`), so prices stay meaningful at any organic rate.
 *
 * Cosmetic only. An entry can describe how a player looks and nothing else:
 * the validator refuses any key that could carry an effect (Energy, PP,
 * Chronons, score, odds, boosts), so "cosmetic only" is enforced, not promised.
 *
 * Runs under Node (require) and in the browser (window.V2Cosmetics).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.V2Cosmetics = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CATEGORIES = Object.freeze({
    characters: ["alternative-appearance"],
    pets: ["small-animal", "fantasy", "futuristic"],
    clothing: ["headwear", "shirts-and-jackets", "shoes", "full-outfit"],
    equipment: ["holographic-accessory", "backpack", "glowing-wearable", "exploration-gear"],
  });
  const RARITIES = ["common", "rare", "epic", "legendary"];
  const ALLOWED_KEYS = ["id", "name", "category", "subcategory", "slot", "rarity", "set", "price", "status"];
  const STATUS = "proposed example";

  const SETS = Object.freeze({
    "desert-caravan": "Desert Caravan",
    "polar-explorer": "Polar Explorer",
    "neon-pathfinder": "Neon Pathfinder",
    "chrono-voyager": "Chrono Voyager",
  });

  const i = (id, name, category, subcategory, slot, rarity, set = null) =>
    Object.freeze({ id, name, category, subcategory, slot, rarity, set, price: null, status: STATUS });

  const ITEMS = Object.freeze([
    // Characters: alternative avatar appearances
    i("desert-navigator", "Desert Navigator", "characters", "alternative-appearance", "character", "common", "desert-caravan"),
    i("aurora-scout", "Aurora Scout", "characters", "alternative-appearance", "character", "rare"),
    i("neon-voyager", "Neon Voyager", "characters", "alternative-appearance", "character", "epic", "neon-pathfinder"),
    i("chrono-wanderer", "Chrono Wanderer", "characters", "alternative-appearance", "character", "legendary", "chrono-voyager"),
    // Pets and companions
    i("pocket-fennec", "Pocket Fennec", "pets", "small-animal", "companion", "common", "desert-caravan"),
    i("trail-terrier", "Trail Terrier", "pets", "small-animal", "companion", "common"),
    i("holo-owl", "Holo Owl", "pets", "futuristic", "companion", "rare"),
    i("ember-fox-spirit", "Ember Fox Spirit", "pets", "fantasy", "companion", "epic"),
    i("starlit-griffin-cub", "Starlit Griffin Cub", "pets", "fantasy", "companion", "legendary"),
    // Clothing
    i("sunrise-bucket-hat", "Sunrise Bucket Hat", "clothing", "headwear", "head", "common", "desert-caravan"),
    i("aurora-beanie", "Aurora Beanie", "clothing", "headwear", "head", "common", "polar-explorer"),
    i("holo-visor-cap", "Holo-Visor Cap", "clothing", "headwear", "head", "rare", "neon-pathfinder"),
    i("city-windbreaker", "City Windbreaker", "clothing", "shirts-and-jackets", "top", "common"),
    i("thermal-trail-hoodie", "Thermal Trail Hoodie", "clothing", "shirts-and-jackets", "top", "rare", "polar-explorer"),
    i("solar-weave-jacket", "Solar-Weave Jacket", "clothing", "shirts-and-jackets", "top", "epic"),
    i("cloudstep-sneakers", "Cloudstep Sneakers", "clothing", "shoes", "feet", "common"),
    i("magnetic-trail-boots", "Magnetic Trail Boots", "clothing", "shoes", "feet", "rare", "polar-explorer"),
    i("gravity-glide-runners", "Gravity-Glide Runners", "clothing", "shoes", "feet", "epic"),
    i("polar-expedition-suit", "Polar Expedition Suit", "clothing", "full-outfit", "outfit", "epic", "polar-explorer"),
    i("nightcity-runner-kit", "Night-City Runner Kit", "clothing", "full-outfit", "outfit", "legendary", "neon-pathfinder"),
    // Futuristic equipment
    i("hologram-compass-band", "Hologram Compass Band", "equipment", "holographic-accessory", "wrist", "rare", "chrono-voyager"),
    i("chrono-lens-glasses", "Chrono-Lens Glasses", "equipment", "holographic-accessory", "face", "epic", "chrono-voyager"),
    i("solar-sail-backpack", "Solar-Sail Backpack", "equipment", "backpack", "back", "rare", "neon-pathfinder"),
    i("pathfinder-thruster-pack", "Pathfinder Thruster Pack", "equipment", "backpack", "back", "legendary", "chrono-voyager"),
    i("pulse-light-laces", "Pulse-Light Laces", "equipment", "glowing-wearable", "wearable", "common", "neon-pathfinder"),
    i("glow-thread-scarf", "Glow-Thread Scarf", "equipment", "glowing-wearable", "wearable", "rare"),
    i("star-map-tablet", "Star-Map Tablet", "equipment", "exploration-gear", "gear", "common", "desert-caravan"),
    i("terrain-scanner-staff", "Terrain-Scanner Staff", "equipment", "exploration-gear", "gear", "epic"),
  ]);

  /** Every reason the catalog is not a valid cosmetic-only catalog. */
  function validateCatalog(items = ITEMS) {
    const errors = [], ids = new Set();
    for (const it of items) {
      const where = `cosmetics.${it && it.id}`;
      for (const k of Object.keys(it)) if (!ALLOWED_KEYS.includes(k)) errors.push(`${where}: "${k}" is not allowed. Cosmetics carry no gameplay effect.`);
      for (const k of ALLOWED_KEYS) if (!(k in it)) errors.push(`${where}: missing "${k}".`);
      if (ids.has(it.id)) errors.push(`${where}: duplicate id.`);
      ids.add(it.id);
      if (!(it.category in CATEGORIES)) errors.push(`${where}: unknown category ${it.category}.`);
      else if (!CATEGORIES[it.category].includes(it.subcategory)) errors.push(`${where}: ${it.subcategory} is not a ${it.category} subcategory.`);
      if (!RARITIES.includes(it.rarity)) errors.push(`${where}: unknown rarity ${it.rarity}.`);
      if (it.set !== null && !(it.set in SETS)) errors.push(`${where}: unknown set ${it.set}.`);
      if (it.status !== STATUS) errors.push(`${where}: status must be "${STATUS}".`);
      if (it.price !== null && !(it.price && Number.isInteger(it.price.v) && it.price.v > 0 && it.price.s === "hypothetical")) {
        errors.push(`${where}: price must be null (rarity-based) or { v, s: "hypothetical" }.`);
      }
    }
    for (const [cat, subs] of Object.entries(CATEGORIES)) {
      for (const sub of subs) if (!items.some((it) => it.category === cat && it.subcategory === sub)) errors.push(`No ${cat} item of kind ${sub}.`);
    }
    return errors;
  }

  /** Hypothetical price of an item: rarity weeks x a moderate walker's weekly
   * organic Chronons, rounded to the nearest 5 (at least 5). */
  function priceOf(item, rarityWeeks, weeklyOrganic) {
    if (item.price) return item.price.v;
    return Math.max(5, Math.round((rarityWeeks[item.rarity] * weeklyOrganic) / 5) * 5);
  }

  return { CATEGORIES, RARITIES, SETS, ITEMS, ALLOWED_KEYS, STATUS, validateCatalog, priceOf };
});
