const mongoose = require("mongoose");

const quotationHistorySchema = new mongoose.Schema(
  {
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
      required: true,
    },

    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "status_changed",
        "pdf_uploaded",
        "pdf_replaced",
        "deleted",
      ],
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional information about what changed
    previousStatus: {
      type: String,
      default: "",
    },

    newStatus: {
      type: String,
      default: "",
    },

    // User who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "QuotationHistory",
  quotationHistorySchema
);