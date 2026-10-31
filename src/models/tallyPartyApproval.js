const mongoose = require("mongoose");

const tallyPartyApprovalSchema = new mongoose.Schema(
  {
    tallyCompany: {
      type: String,
      required: true,
      trim: true,
    },

    tallyMasterId: {
      type: String,
      default: "",
      trim: true,
    },

    tallySyncKey: {
      type: String,
      required: true,
      trim: true,
    },

    tallyAlterId: {
      type: String,
      default: "",
      trim: true,
    },

    tallyName: {
      type: String,
      required: true,
      trim: true,
    },

    companyName: {
      type: String,
      default: "",
      trim: true,
    },

    tallyParent: {
      type: String,
      default: "",
      trim: true,
    },

    detectedPartyType: {
      type: String,
      enum: ["customer", "distributor", "other"],
      default: "other",
    },

    partyDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ["pending", "approved", "declined"],
      default: "pending",
      index: true,
    },

    approvedAs: {
      type: String,
      enum: ["customer", "distributor", null],
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    linkedPartyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

tallyPartyApprovalSchema.index(
  {
    tallyCompany: 1,
    tallySyncKey: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "TallyPartyApproval",
  tallyPartyApprovalSchema
);
