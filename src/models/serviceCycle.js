const mongoose = require("mongoose");

const serviceCycleSchema = new mongoose.Schema(
  {
    agreement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceAgreement",
      required: true,
      index: true,
    },
    counterpartCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCycle",
      default: null,
      index: true,
    },
    cycleNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    previousCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCycle",
      default: null,
    },
    previousCounterpartCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCycle",
      default: null,
    },
    cycleType: {
      type: String,
      enum: ["initial", "renewal"],
      required: true,
      default: "initial",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    customerAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    distributorAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    currency: {
      type: String,
      trim: true,
      default: "INR",
    },
    serviceVersion: {
      type: String,
      trim: true,
      default: "",
    },
    packageName: {
      type: String,
      trim: true,
      default: "",
    },
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["draft", "active", "expired", "cancelled"],
      default: "draft",
      index: true,
    },
    customerService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerService",
      default: null,
      index: true,
    },
    distributorService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributorService",
      default: null,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

serviceCycleSchema.index(
  { agreement: 1, cycleNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("ServiceCycle", serviceCycleSchema);
