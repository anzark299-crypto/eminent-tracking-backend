const mongoose = require("mongoose");

const serviceAgreementSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      default: null,
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    counterpartAgreement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceAgreement",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

serviceAgreementSchema.pre("validate", function () {
  const hasCustomer = Boolean(this.customer);
  const hasDistributor = Boolean(this.distributor);

  if (hasCustomer === hasDistributor) {
    this.invalidate(
      "customer",
      "An agreement must belong to exactly one customer or distributor."
    );
    this.invalidate(
      "distributor",
      "An agreement must belong to exactly one customer or distributor."
    );
  }
});

serviceAgreementSchema.index({ customer: 1, service: 1 });
serviceAgreementSchema.index({ distributor: 1, service: 1 });

module.exports = mongoose.model(
  "ServiceAgreement",
  serviceAgreementSchema
);
