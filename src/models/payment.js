const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // ==========================================================
    // PARTY
    // ==========================================================

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

    partyType: {
      type: String,
      required: true,
      enum: ["customer", "distributor"],
    },

    partyName: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================================
    // TALLY PARTY IDENTITY
    // ==========================================================

    tallyPartyName: {
      type: String,
      required: true,
      trim: true,
    },

    tallyAlterId: {
      type: String,
      trim: true,
      default: "",
    },

    tallyMasterId: {
      type: String,
      trim: true,
      default: "",
    },

    tallySyncKey: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================================
    // TALLY VOUCHER IDENTITY
    // ==========================================================

    tallyVoucherIdentity: {
      type: String,
      trim: true,
      default: "",
    },

    tallyVoucherIdentityType: {
      type: String,
      trim: true,
      enum: [
        "",
        "GUID",
        "VCHKEY",
        "REMOTEID",
        "VOUCHERKEY",
        "VOUCHERRETAINKEY",
        "FALLBACK",
      ],
      default: "",
    },

    tallyGuid: {
      type: String,
      trim: true,
      default: "",
    },

    tallyVchKey: {
      type: String,
      trim: true,
      default: "",
    },

    tallyRemoteId: {
      type: String,
      trim: true,
      default: "",
    },

    tallyVoucherKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    tallyVoucherRetainKey: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================================
    // VOUCHER STATUS
    // ==========================================================

    voucherStatus: {
      type: String,
      trim: true,
      default: "",
    },

    isCancelled: {
      type: Boolean,
      default: false,
    },

    // ==========================================================
    // PAYMENT DETAILS
    // ==========================================================

    paymentType: {
      type: String,
      required: true,
      enum: [
        "customer_receipt",
        "customer_payment",
        "distributor_payment",
        "distributor_receipt",
      ],
    },

    voucherType: {
      type: String,
      required: true,
      enum: ["Payment", "Receipt"],
    },

    voucherNumber: {
      type: String,
      trim: true,
      default: "",
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    tallyReference: { type: String, trim: true, default: "" },
    tallyNarration: { type: String, trim: true, default: "" },

    relationshipLinkReason: { type: String, trim: true, default: "" },

    // ==========================================================
    // INVOICE LINK
    // ==========================================================

    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },

    invoiceLinkedAutomatically: {
      type: Boolean,
      default: false,
    },

    // MANUAL CONFIRMATION OF AN OTHERWISE UNALLOCATED TALLY PAYMENT
    manuallyConfirmedForInvoice: {
      type: Boolean,
      default: false,
    },

    manuallyConfirmedAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // TALLY BILL ALLOCATION
    // ==========================================================

    billAllocations: {
      type: [
        {
          name: {
            type: String,
            trim: true,
            default: "",
          },

          billType: {
            type: String,
            trim: true,
            default: "",
          },

          amount: {
            type: Number,
            default: 0,
          },

          rawReference: {
            type: String,
            trim: true,
            default: "",
          },
        },
      ],
      default: [],
    },

    // ==========================================================
    // OTHER LEDGERS
    // ==========================================================

    bankOrOtherLedgers: {
      type: [
        {
          name: {
            type: String,
            trim: true,
            default: "",
          },

          amount: {
            type: Number,
            default: 0,
          },
        },
      ],
      default: [],
    },

    // ==========================================================
    // SOURCE / SYNC
    // ==========================================================

    source: {
      type: String,
      default: "TallyPrime",
      trim: true,
    },

    syncBatchId: {
      type: String,
      trim: true,
      default: "",
    },

    syncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// QUERY INDEXES
// ============================================================

paymentSchema.index({
  customer: 1,
  paymentDate: -1,
});

paymentSchema.index({
  distributor: 1,
  paymentDate: -1,
});

paymentSchema.index({
  tallyAlterId: 1,
  paymentDate: -1,
});

// ============================================================
// STABLE TALLY VOUCHER IDENTITY INDEX
// Empty strings are excluded.
// ============================================================

paymentSchema.index(
  {
    tallyVoucherIdentity: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      tallyVoucherIdentity: {
        $type: "string",
        $gt: "",
      },
    },
  }
);

// ============================================================
// OPTIONAL DIRECT TALLY IDENTIFIER INDEXES
// Empty strings are excluded.
// ============================================================

paymentSchema.index(
  {
    tallyGuid: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      tallyGuid: {
        $type: "string",
        $gt: "",
      },
    },
  }
);

paymentSchema.index(
  {
    tallyVchKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      tallyVchKey: {
        $type: "string",
        $gt: "",
      },
    },
  }
);

paymentSchema.index(
  {
    tallyRemoteId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      tallyRemoteId: {
        $type: "string",
        $gt: "",
      },
    },
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model(
  "Payment",
  paymentSchema
);
