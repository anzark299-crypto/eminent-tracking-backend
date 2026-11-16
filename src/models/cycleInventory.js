const mongoose = require("mongoose");

const cycleInventoryEntrySchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
    },
    assetName: {
      type: String,
      required: true,
      trim: true,
    },
    assetTag: {
      type: String,
      trim: true,
      default: "",
    },
    serialNumber: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    manufacturer: {
      type: String,
      trim: true,
      default: "",
    },
    model: {
      type: String,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      required: true,
      min: Number.MIN_VALUE,
      default: 1,
    },
    unit: {
      type: String,
      trim: true,
      default: "Piece",
    },
    unitPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    warrantyStartDate: {
      type: Date,
      default: null,
    },
    warrantyEndDate: {
      type: Date,
      default: null,
    },
    coverageStartDate: {
      type: Date,
      default: null,
    },
    coverageEndDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true }
);

const cycleInventorySchema = new mongoose.Schema(
  {
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
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    customerService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerService",
      default: null,
    },
    distributorService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributorService",
      default: null,
    },
    entries: {
      type: [cycleInventoryEntrySchema],
      default: [],
    },
    totalValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    createdFromInventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CycleInventory",
      default: null,
    },
  },
  { timestamps: true }
);

cycleInventorySchema.pre("validate", function () {
  if (!this.customerCycle && !this.distributorCycle) {
    this.invalidate(
      "customerCycle",
      "An inventory snapshot must belong to at least one service cycle."
    );
  }
});

cycleInventorySchema.index(
  { customerCycle: 1 },
  {
    unique: true,
    partialFilterExpression: {
      customerCycle: { $type: "objectId" },
    },
  }
);

cycleInventorySchema.index(
  { distributorCycle: 1 },
  {
    unique: true,
    partialFilterExpression: {
      distributorCycle: { $type: "objectId" },
    },
  }
);

module.exports = mongoose.model("CycleInventory", cycleInventorySchema);
