
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // ============================================================
    // NOTIFICATION HEADING
    // ============================================================

    title: {
      type: String,
      required: true,
      trim: true,
    },

    // ============================================================
    // NOTIFICATION MESSAGE
    // ============================================================

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // ============================================================
    // NOTIFICATION TYPE
    // ============================================================

    type: {
      type: String,
      enum: [
        "service_expiry",
        "service_expired",
        "payment_due",
        "payment_overdue",
        "invoice",
        "purchase_order",
        "general",
      ],
      default: "general",
    },

    // ============================================================
    // REMINDER DAYS
    // ============================================================

    // Used for service expiry reminders:
    // 30, 15, 7
    //
    // Used for installment reminders:
    // 7
    //
    // null for notifications without a reminder milestone.

    reminderDays: {
      type: Number,
      default: null,
    },

    // ============================================================
    // USERS WHO SHOULD RECEIVE THIS NOTIFICATION
    // ============================================================

    recipients: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        // Each user has their own read status
        read: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // ============================================================
    // CUSTOMER
    // ============================================================

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    // ============================================================
    // CUSTOMER SERVICE
    // ============================================================

    customerService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerService",
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
    // DISTRIBUTOR SERVICE
    // ============================================================

    distributorService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributorService",
      default: null,
    },

    // ============================================================
    // INSTALLMENT
    // ============================================================

    // Identifies the exact installment that generated
    // this payment notification.

    installmentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

module.exports = Notification;
