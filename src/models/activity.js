const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    // ============================================================
    // CUSTOMER
    // ============================================================

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    // ============================================================
    // DISTRIBUTOR
    // ============================================================

    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      default: null,
    },

    // ============================================================
    // ACTIVITY TYPE
    // ============================================================

    type: {
      type: String,
      enum: [
        "purchase_order_updated",
        "service_assigned",
        "service_updated",
        "service_expired",
        "purchase_order_added",
        "invoice_created",
        "invoice_updated",
        "payment_received",
      ],
      required: true,
    },

    // ============================================================
    // ACTIVITY INFORMATION
    // ============================================================

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // ============================================================
    // RELATED CUSTOMER SERVICE
    // ============================================================

    customerService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerService",
      default: null,
    },

    // ============================================================
    // RELATED DISTRIBUTOR SERVICE
    // ============================================================

    distributorService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributorService",
      default: null,
    },

    // ============================================================
    // RELATED PURCHASE ORDER
    // ============================================================

    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },

    // ============================================================
    // RELATED INVOICE
    // ============================================================

    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Activity", activitySchema);