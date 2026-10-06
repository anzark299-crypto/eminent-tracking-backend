const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    pincode: {
      type: String,
      trim: true,
      default: "",
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    // Tally integration fields
    tallyPartyName: {
      type: String,
      trim: true,
      default: "",
    },

    tallyName: {
      type: String,
      trim: true,
      default: "",
    },

    tallyCompanyName: {
      type: String,
      trim: true,
      default: "",
    },

    tallyContactPerson: {
      type: String,
      trim: true,
      default: "",
    },

    tallyEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    tallyPhone: {
      type: String,
      trim: true,
      default: "",
    },

    tallyMobile: {
      type: String,
      trim: true,
      default: "",
    },

    tallyAddress: {
      type: String,
      trim: true,
      default: "",
    },

    tallyAddressLines: {
      type: [String],
      default: [],
    },

    tallyCity: {
      type: String,
      trim: true,
      default: "",
    },

    tallyState: {
      type: String,
      trim: true,
      default: "",
    },

    tallyPincode: {
      type: String,
      trim: true,
      default: "",
    },

    tallyCountry: {
      type: String,
      trim: true,
      default: "",
    },

    tallyGstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    tallyGstRegistrationType: {
      type: String,
      trim: true,
      default: "",
    },

    tallyPlaceOfSupply: {
      type: String,
      trim: true,
      default: "",
    },

    tallyPan: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    tallySource: {
      type: String,
      trim: true,
      default: "TallyPrime",
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

    tallyParent: {
      type: String,
      trim: true,
      default: "",
    },

    tallyOpeningBalance: {
      type: Number,
      default: 0,
    },

    tallyClosingBalance: {
      type: Number,
      default: 0,
    },

    tallyLastSyncedAt: {
      type: Date,
      default: null,
    },

    // Soft-delete / archive fields
    isArchived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    source: {
      type: String,
      trim: true,
      default: "Manual",
    },
  },
  {
    timestamps: true,
  }
);

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
