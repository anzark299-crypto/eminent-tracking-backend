const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    // ==========================================================
    // CUSTOMER
    // ==========================================================
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

    // ==========================================================
    // DISTRIBUTOR
    // ==========================================================
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

    // ==========================================================
    // PURCHASE ORDER
    // ==========================================================
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },

    // ==========================================================
    // INVOICE GROUP
    //
    // All invoices belonging to the same installment plan
    // share the same invoiceGroupId.
    //
    // Example:
    //
    // INV-001 â†’ 1/4 â†’ Group A
    // INV-002 â†’ 2/4 â†’ Group A
    // INV-003 â†’ 3/4 â†’ Group A
    // INV-004 â†’ 4/4 â†’ Group A
    //
    // A one-time invoice can have null here.
    // ==========================================================
    invoiceGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // ==========================================================
    // INVOICE DETAILS
    // ==========================================================
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },

    invoiceDate: {
      type: Date,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ==========================================================
    // TALLY INTEGRATION
    // ==========================================================
    tallyVoucherIdentity: { type: String, trim: true, default: "" },
    tallyVoucherIdentityType: {
      type: String,
      enum: ["", "GUID", "VCHKEY", "REMOTEID", "VOUCHERKEY", "VOUCHERRETAINKEY", "FALLBACK"],
      default: "",
    },
    tallyGuid: { type: String, trim: true, default: "" },
    tallyVchKey: { type: String, trim: true, default: "" },
    tallyVoucherKey: { type: String, trim: true, default: "" },
    tallyVoucherRetainKey: { type: String, trim: true, default: "" },
    tallyReference: { type: String, trim: true, default: "" },
    tallyLinkedAutomatically: { type: Boolean, default: false },
    tallyLastSyncedAt: { type: Date, default: null },

    // ==========================================================
    // PAYMENT
    // ==========================================================
    status: {
      type: String,
      enum: ["unpaid", "paid", "cancelled"],
      default: "unpaid",
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // PAYMENT STATUS RECONCILIATION
    // ==========================================================

    paymentStatusSource: {
      type: String,
      enum: ["tally", "manual", ""],
      default: "",
    },

    manualPaymentStatus: {
      type: String,
      enum: ["paid", "unpaid", null],
      default: null,
    },

    manualPaymentDate: {
      type: Date,
      default: null,
    },

    manualPaymentUpdatedAt: {
      type: Date,
      default: null,
    },

    // TALLY PAYMENT RECONCILIATION
    tallyPaymentStatus: {
      type: String,
      enum: ["unpaid", "unconfirmed", "partial", "paid"],
      default: "unpaid",
    },

    tallyPaymentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    tallyPaymentUpdatedAt: {
      type: Date,
      default: null,
    },

    tallyPaymentConfirmationType: {
      type: String,
      enum: ['', 'automatic', 'manual'],
      default: '',
    },


    // ==========================================================
    // DUE DATE
    // ==========================================================
    dueDate: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // INSTALLMENT
    // ==========================================================
    installmentNumber: {
      type: Number,
      min: 1,
      default: null,
    },

    totalInstallments: {
      type: Number,
      min: 1,
      default: null,
    },

    // ==========================================================
    // NOTES
    // ==========================================================
    notes: {
      type: String,
      trim: true,
    },

    // ==========================================================
    // PDF
    // ==========================================================
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

const Invoice = mongoose.model("Invoice", invoiceSchema);

module.exports = Invoice;



