const mongoose = require("mongoose");

// ============================================================
// INVENTORY ITEM
// ============================================================

const inventoryEntrySchema = new mongoose.Schema(
  {
    stockItemName: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    actualQty: {
      type: String,
      trim: true,
      default: "",
    },

    billedQty: {
      type: String,
      trim: true,
      default: "",
    },

    rate: {
      type: Number,
      default: 0,
    },

    amount: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    godownName: {
      type: String,
      trim: true,
      default: "",
    },

    trackingNumber: {
      type: String,
      trim: true,
      default: "",
    },

    orderNumber: {
      type: String,
      trim: true,
      default: "",
    },

    orderDueDate: {
      type: String,
      trim: true,
      default: "",
    },

    batchAllocations: {
      type: [
        {
          batchName: {
            type: String,
            trim: true,
            default: "",
          },

          quantity: {
            type: String,
            trim: true,
            default: "",
          },

          rate: {
            type: Number,
            default: 0,
          },

          amount: {
            type: Number,
            default: 0,
          },
        },
      ],
      default: [],
    },

    accountingAllocations: {
      type: [
        {
          ledgerName: {
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
  },
  { _id: false }
);

// ============================================================
// BILL ALLOCATION
// ============================================================

const billAllocationSchema = new mongoose.Schema(
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

    billDate: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// ============================================================
// LEDGER ENTRY
// ============================================================

const ledgerEntrySchema = new mongoose.Schema(
  {
    ledgerName: {
      type: String,
      trim: true,
      default: "",
    },

    amount: {
      type: Number,
      default: 0,
    },

    isPartyLedger: {
      type: Boolean,
      default: false,
    },

    billAllocations: {
      type: [billAllocationSchema],
      default: [],
    },
  },
  { _id: false }
);

// ============================================================
// MAIN TALLY TRANSACTION SCHEMA
// ============================================================

const tallyTransactionSchema = new mongoose.Schema(
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

    tallyPartyName: {
      type: String,
      trim: true,
      default: "",
    },

    partyGstin: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================================
    // TRANSACTION TYPE
    // ==========================================================

    transactionType: {
      type: String,
      required: true,
      enum: ["sale", "purchase"],
    },

    voucherType: {
      type: String,
      required: true,
      trim: true,
    },

    voucherNumber: {
      type: String,
      trim: true,
      default: "",
    },

    transactionDate: {
      type: Date,
      required: true,
    },

    reference: {
      type: String,
      trim: true,
      default: "",
    },

    narration: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================================
    // VOUCHER STATUS
    // ==========================================================

    isInvoice: {
      type: Boolean,
      default: false,
    },

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
    // AMOUNTS
    // ==========================================================

    inventoryAmount: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    // ==========================================================
    // TRANSACTION DETAILS
    // ==========================================================

    inventoryEntries: {
      type: [inventoryEntrySchema],
      default: [],
    },

    ledgerEntries: {
      type: [ledgerEntrySchema],
      default: [],
    },

    // ==========================================================
    // APP RELATIONSHIPS
    // ==========================================================

    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },

    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },

    customerService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerService",
      default: null,
    },

    distributorService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DistributorService",
      default: null,
    },

    relationshipLinkStatus: {
      type: String,
      enum: ["linked", "unlinked", "ambiguous"],
      default: "unlinked",
    },

    relationshipLinkReason: {
      type: String,
      trim: true,
      default: "",
    },

    relationshipLinkedAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // TALLY STABLE IDENTITY
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
      trim: true,
      default: "",
    },

    tallyVoucherRetainKey: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================================
    // TALLY MASTER / ALTER INFORMATION
    // ==========================================================

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

    // ==========================================================
    // SYNC INFORMATION
    // ==========================================================

    source: {
      type: String,
      trim: true,
      default: "TallyPrime",
    },

    syncBatchId: {
      type: String,
      trim: true,
      default: "",
    },

    firstSyncedAt: {
      type: Date,
      default: null,
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },

    lastTallyAlterId: {
      type: String,
      trim: true,
      default: "",
    },

    syncVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// QUERY INDEXES
// ============================================================

tallyTransactionSchema.index({
  customer: 1,
  transactionDate: -1,
});

tallyTransactionSchema.index({
  distributor: 1,
  transactionDate: -1,
});

tallyTransactionSchema.index({
  partyType: 1,
  transactionType: 1,
  transactionDate: -1,
});

tallyTransactionSchema.index({
  tallyAlterId: 1,
  transactionDate: -1,
});

// ============================================================
// STABLE TALLY IDENTITY
// Empty strings are intentionally excluded from these indexes.
// This prevents duplicate-key conflicts when Tally does not
// provide a particular identifier.
// ============================================================

tallyTransactionSchema.index(
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
// DIRECT TALLY IDENTIFIER INDEXES
// ============================================================

tallyTransactionSchema.index(
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

tallyTransactionSchema.index(
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

tallyTransactionSchema.index(
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
  "TallyTransaction",
  tallyTransactionSchema
);