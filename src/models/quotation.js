const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema(
  {
    // ==========================================
    // CUSTOMER / DISTRIBUTOR
    // ==========================================

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      default: null,
    },

    // ==========================================
    // QUOTATION DETAILS
    // ==========================================

    quotationNumber: {
      type: String,
      required: true,
      trim: true,
    },

    quotationDate: {
      type: Date,
      required: true,
    },

    providedDate: {
      type: Date,
      default: null,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // STATUS
    // ==========================================

    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      default: "draft",
    },

    // ==========================================
    // PDF
    // ==========================================

    pdfUrl: {
      type: String,
      default: "",
    },

    pdfFileName: {
      type: String,
      default: "",
    },

    pdfPublicId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Quotation", quotationSchema);