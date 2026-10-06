const mongoose = require("mongoose");

const customerServiceSchema = new mongoose.Schema(
  {
    // Customer who is receiving this service
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    // Service from our master Service catalog
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    // Actual service period for this customer
    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    // Commercial information
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Payment information
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    // Customer's PO information
    poNumber: {
      type: String,
      trim: true,
    },

    // How often this service is billed
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "half_yearly", "yearly", "one_time"],
      default: "yearly",
    },

    // Service status
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },

    // Reminder before service expiry
    reminderDaysBefore: {
      type: Number,
      default: 30,
      min: 0,
    },

    // Tally integration identity. A customer-service row created from a
    // Tally voucher is keyed to the exact voucher + item, so live sync can
    // update it without creating duplicates.
    tallyVoucherIdentity: {
      type: String,
      default: null,
      index: true,
    },

    tallyVoucherIdentityType: {
      type: String,
      default: null,
    },

    tallyItemName: {
      type: String,
      default: null,
      trim: true,
    },

    tallyLinkedAutomatically: {
      type: Boolean,
      default: false,
    },

    tallyLastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const CustomerService = mongoose.model(
  "CustomerService",
  customerServiceSchema
);

module.exports = CustomerService;