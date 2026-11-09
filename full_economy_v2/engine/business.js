/* Wellness Odyssey: Wellness Store and Chronon-bundle unit economics (V2).
 *
 * Every commercial number is HYPOTHETICAL. Nothing here forecasts revenue.
 *
 * How a store reward becomes Chronons, stated explicitly:
 *   Chronons = floor(eligible order value x reward rate / dollar value of one Chronon)
 *   dollar value of one Chronon = small bundle price / Chronons in that bundle
 * So a "5% reward" means: Chronons worth 5% of the eligible order AT THE
 * BUNDLE PRICE. That is the only place a Chronon acquires a dollar value.
 * Chronons are not cash, cannot be withdrawn, and cost the game nothing to
 * create; their business cost is the bundle revenue they displace
 * (cannibalisation) plus operating cost. Affiliate commission is revenue to
 * the game and is never equated with the Chronons awarded.
 *
 * Purchases only ever credit Chronons. They never credit Energy, PP, journey
 * progress or Odyssey Score; the simulation has no code path that could.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../config/scenario_config.js"));
  else root.V2Business = factory(root.V2Config);
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";

  /** Chronons awarded for one order of `price` dollars. */
  function orderChronons(cfg, price) {
    return Math.floor((price * cfg.eligibleShare * cfg.affiliateRewardRate) / C.chrononDollarValue(cfg));
  }

  /** Expected economics of one store order, refunds included. */
  function orderEconomics(cfg, price) {
    const v = C.chrononDollarValue(cfg);
    const eligible = price * cfg.eligibleShare;
    const chronons = orderChronons(cfg, price);
    const keep = 1 - cfg.refundRate;
    const grantedShare = cfg.clawbackPolicy === "no-clawback" ? 1 : keep; // refunded orders keep their Chronons only without clawback
    const granted = chronons * grantedShare;
    const commission = eligible * cfg.affiliateCommission * keep;
    const valueGranted = granted * v;
    const displacedBundleNet = valueGranted * cfg.cannibalization * (1 - cfg.platformFee);
    const net = commission - displacedBundleNet - cfg.storeCostPerOrder;
    return {
      price, eligible, chronons, granted, chrononValue: v, valueGranted, commission, displacedBundleNet,
      cost: cfg.storeCostPerOrder, net, impliedRebate: price > 0 ? valueGranted / price : 0,
    };
  }

  /** The reward rate at which an order of `price` breaks even (ignoring the
   * whole-Chronon rounding). Above it, each order loses money once displaced
   * bundle revenue is counted. */
  function breakEvenRewardRate(cfg, price) {
    const eligible = price * cfg.eligibleShare;
    const keep = 1 - cfg.refundRate;
    const grantedShare = cfg.clawbackPolicy === "no-clawback" ? 1 : keep;
    const denom = eligible * grantedShare * cfg.cannibalization * (1 - cfg.platformFee);
    const numer = eligible * cfg.affiliateCommission * keep - cfg.storeCostPerOrder;
    if (denom <= 0) return numer >= 0 ? Infinity : -Infinity;
    return numer / denom;
  }

  /** Bundle revenue to the game, net of the platform fee. */
  const bundleNet = (cfg, size) => C.BUNDLES[size].price * (1 - cfg.platformFee);

  /** Summarise simulated store and bundle activity (sums over players). */
  function summarise(cfg, tallies, players, years) {
    const v = C.chrononDollarValue(cfg);
    const t = tallies;
    const valueGranted = t.storeChrononsGranted * v;
    const displaced = valueGranted * cfg.cannibalization * (1 - cfg.platformFee);
    const per = (x) => x / Math.max(players, 1) / Math.max(years, 1e-9);
    return {
      ordersPerPlayerYear: per(t.orders),
      gmvPerPlayerYear: per(t.gmv),
      commissionPerPlayerYear: per(t.commission),
      storeChrononsPerPlayerYear: per(t.storeChrononsGranted),
      storeChrononValuePerPlayerYear: per(valueGranted),
      displacedBundleNetPerPlayerYear: per(displaced),
      storeCostPerPlayerYear: per(t.orders * cfg.storeCostPerOrder),
      storeNetPerPlayerYear: per(t.commission - displaced - t.orders * cfg.storeCostPerOrder),
      leakedChrononsPerPlayerYear: per(t.storeChrononsLeaked),
      bundleSpendPerPlayerYear: per(t.bundleSpend),
      bundleNetPerPlayerYear: per(t.bundleNet),
    };
  }

  return { orderChronons, orderEconomics, breakEvenRewardRate, bundleNet, summarise };
});
