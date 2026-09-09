const mongoose = require("mongoose");

const distributorSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    distributorType: {
      type: String,
      required: true,
      enum: [
        "OEM / Manufacturer",
        "Authorized Distributor",
        "Supplier",
        "Dealer",
        "Service Provider",
        "Other",
      ],
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
    },

    gstin: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Distributor = mongoose.model(
  "Distributor",
  distributorSchema
);

module.exports = Distributor;