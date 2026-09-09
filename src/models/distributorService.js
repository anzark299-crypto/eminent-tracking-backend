const mongoose = require("mongoose");

// ============================================================
// PAYMENT INSTALLMENT
// ============================================================

const paymentInstallmentSchema = new mongoose.Schema(
  {
    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "upcoming",
        "due",
        "overdue",
        "paid",
      ],
      default: "upcoming",
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    // Actual invoice information
    invoiceNumber: {
      type: String,
      trim: true,
      default: null,
    },

    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },

    invoicePdfUrl: {
      type: String,
      default: null,
    },

    invoicePdfFileName: {
      type: String,
      default: null,
    },

    invoicePdfPublicId: {
      type: String,
      default: null,
    },
  },
  {
    _id: true,
  }
);

// ============================================================
// DISTRIBUTOR SERVICE
// ============================================================

const distributorServiceSchema = new mongoose.Schema(
  {
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    purchaseDate: {
      type: Date,
      required: true,
    },

    serviceStartDate: {
      type: Date,
      required: true,
    },

    serviceEndDate: {
      type: Date,
      required: true,
    },

    // ==========================================================
    // PAYMENT PLAN
    // ==========================================================

    totalPayableAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentType: {
      type: String,
      enum: [
        "one_time",
        "installment",
      ],
      default: "one_time",
    },

    installmentFrequency: {
      type: String,
      enum: [
        "monthly",
        "quarterly",
        "half_yearly",
        "yearly",
      ],
      default: null,
    },

    installmentAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    numberOfInstallments: {
      type: Number,
      default: null,
      min: 1,
    },

    firstPaymentDueDate: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // GENERATED PAYMENT SCHEDULE
    // ==========================================================

    installments: {
      type: [paymentInstallmentSchema],
      default: [],
    },

    status: {
      type: String,
      enum: [
        "active",
        "expired",
        "cancelled",
      ],
      default: "active",
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const DistributorService = mongoose.model(
  "DistributorService",
  distributorServiceSchema
);

module.exports = DistributorService;