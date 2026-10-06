const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema(
  {
    // =========================
    // CUSTOMER
    // =========================

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    customerService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerService",
      default: null,
    },

    // =========================
    // DISTRIBUTOR
    // =========================

    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      default: null,
    },

    distributorService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributorService",
      default: null,
    },

    // =========================
    // PO INFORMATION
    // =========================

    poNumber: {
      type: String,
      required: true,
      trim: true,
    },

    poDate: {
      type: Date,
      required: true,
    },

    poIssuedTo: {
      type: String,
      trim: true,
    },

    ourPoNumber: {
      type: String,
      trim: true,
    },

    ourPoDate: {
      type: Date,
      default: null,
    },

    // =========================
    // TALLY INTEGRATION
    // =========================
    tallyVoucherIdentity: { type: String, trim: true, default: "" },
    tallyReference: { type: String, trim: true, default: "" },
    tallyLinkedAutomatically: { type: Boolean, default: false },
    tallyLastSyncedAt: { type: Date, default: null },

    // =========================
    // FINANCIAL
    // =========================

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // =========================
    // NOTES
    // =========================

    notes: {
      type: String,
      trim: true,
    },

    // =========================
    // PDF
    // =========================

    pdfUrl: {
      type: String,
      default: null,
    },

    pdfFileName: {
      type: String,
      default: null,
    },

    pdfPublicId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const PurchaseOrder = mongoose.model(
  "PurchaseOrder",
  purchaseOrderSchema
);

module.exports = PurchaseOrder;