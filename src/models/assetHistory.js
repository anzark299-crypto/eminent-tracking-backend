const mongoose = require("mongoose");

const assetHistorySchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    cycleInventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CycleInventory",
      default: null,
      index: true,
    },
    customerCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCycle",
      default: null,
    },
    distributorCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCycle",
      default: null,
    },
    eventType: {
      type: String,
      enum: [
        "added",
        "removed",
        "updated",
        "warranty_updated",
        "carried_forward",
      ],
      required: true,
      index: true,
    },
    previousSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    effectiveAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

assetHistorySchema.index({ asset: 1, createdAt: -1 });

module.exports = mongoose.model("AssetHistory", assetHistorySchema);
