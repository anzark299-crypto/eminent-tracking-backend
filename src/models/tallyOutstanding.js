const mongoose = require("mongoose");

// ============================================================
// BILL
// ============================================================

const ledgerVoucherMovementSchema =
  new mongoose.Schema(
    {
      partyName: { type: String, trim: true, default: "" },
      tallyName: { type: String, trim: true, default: "" },
      role: { type: String, enum: ["customer", "distributor"], default: "customer" },
      voucherDate: { type: Date, default: null },
      voucherType: { type: String, trim: true, default: "" },
      voucherNumber: { type: String, trim: true, default: "" },
      amount: { type: Number, default: 0 },
      source: { type: String, trim: true, default: "TallyPrime Ledger Outstandings" },
    },
    { _id: false }
  );

const outstandingBillSchema =
  new mongoose.Schema(
    {
      billRef: {
        type: String,
        trim: true,
        default: "",
      },

      billDate: {
        type: Date,
        default: null,
      },

      dueDate: {
        type: Date,
        default: null,
      },

      overdueDays: {
        type: Number,
        default: 0,
        min: 0,
      },

      pendingAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      _id: false,
    }
  );

// ============================================================
// MAIN OUTSTANDING SCHEMA
// ============================================================

const tallyOutstandingSchema =
  new mongoose.Schema(
    {
      // --------------------------------------------------------
      // PARTY REFERENCES
      // --------------------------------------------------------

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
        enum: [
          "customer",
          "distributor",
        ],
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

      // --------------------------------------------------------
      // STABLE PARTY KEY
      // --------------------------------------------------------

      partyKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
      },

      // --------------------------------------------------------
      // OUTSTANDING TOTALS
      // --------------------------------------------------------

      totalPending: {
        type: Number,
        default: 0,
        min: 0,
      },

      billCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      overdueAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      overdueBillCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      // --------------------------------------------------------
      // BILL DETAILS
      // --------------------------------------------------------

      bills: {
        type: [outstandingBillSchema],
        default: [],
      },

      ledgerVouchers: {
        type: [ledgerVoucherMovementSchema],
        default: [],
      },

      // --------------------------------------------------------
      // SOURCE / SYNC
      // --------------------------------------------------------

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

      syncedAt: {
        type: Date,
        default: null,
      },

      // --------------------------------------------------------
      // REPORT RANGE
      // --------------------------------------------------------

      fromDate: {
        type: String,
        trim: true,
        default: "",
      },

      toDate: {
        type: String,
        trim: true,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

// ============================================================
// QUERY INDEXES
// ============================================================

tallyOutstandingSchema.index({
  customer: 1,
});

tallyOutstandingSchema.index({
  distributor: 1,
});

tallyOutstandingSchema.index({
  partyType: 1,
  totalPending: -1,
});

tallyOutstandingSchema.index({
  partyType: 1,
  overdueAmount: -1,
});

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model(
  "TallyOutstanding",
  tallyOutstandingSchema
);
