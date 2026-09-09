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
    // INV-001 → 1/4 → Group A
    // INV-002 → 2/4 → Group A
    // INV-003 → 3/4 → Group A
    // INV-004 → 4/4 → Group A
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