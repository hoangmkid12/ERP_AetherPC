/**
 * Weighted-average inventory costing (VAS-compatible "bình quân gia quyền").
 *
 * Product.averageCost is a running per-unit cost blended across every GRN intake.
 * Called from GRN intake (purchase.controller.js / warehouse.controller.js
 * validateReceipt) BEFORE the stock increment is applied, using the quantity/cost
 * on hand at that moment — must run inside the same transaction as the increment
 * so a concurrent intake for the same product can't read stale stock/cost.
 *
 * Returns the blended cost so the caller can increment stockQuantity and set
 * averageCost in a single update (avoids a second read-modify-write race window).
 */
const computeBlendedAverageCost = (oldQty, oldCost, intakeQty, unitCost) => {
  const newQty = oldQty + intakeQty;
  if (newQty <= 0) return oldCost;
  return ((oldCost * oldQty) + (unitCost * intakeQty)) / newQty;
};

module.exports = { computeBlendedAverageCost };
