require("dotenv").config();

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Customer = require("../models/customer");
const Distributor = require("../models/distributor");

const REGISTRY_PATH =
  "E:\\eminent-tally-sync\\output\\confirmed-party-registry.json";

function clean(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCustomerData(party) {
  return {
    companyName: clean(party.requestedName),

    contactPerson: clean(party.contactPerson),

    email: clean(party.email),

    phone: clean(party.phone || party.mobile),

    address: clean(party.address),

    city: clean(party.city),

    state: clean(party.state),

    pincode: clean(party.pincode),

    gstin: clean(party.gstin),

    tallyPartyName: clean(party.tallyName),

    tallyAlterId: clean(party.alterId),

    tallyMasterId: clean(party.masterId),

    tallySyncKey: clean(party.syncKey),

    tallyParent: clean(party.parent),

    tallyOpeningBalance: numberValue(party.openingBalance),

    tallyClosingBalance: numberValue(party.closingBalance),

    tallyLastSyncedAt: new Date(),

    source: "TallyPrime",
  };
}

function buildDistributorData(party) {
  return {
    companyName: clean(party.requestedName),

    contactPerson: clean(party.contactPerson),

    email: clean(party.email),

    phone: clean(party.phone || party.mobile),

    distributorType: "Other",

    address: clean(party.address),

    city: clean(party.city),

    state: clean(party.state),

    pincode: clean(party.pincode),

    gstin: clean(party.gstin),

    notes: "",

    tallyPartyName: clean(party.tallyName),

    tallyAlterId: clean(party.alterId),

    tallyMasterId: clean(party.masterId),

    tallySyncKey: clean(party.syncKey),

    tallyParent: clean(party.parent),

    tallyOpeningBalance: numberValue(party.openingBalance),

    tallyClosingBalance: numberValue(party.closingBalance),

    tallyLastSyncedAt: new Date(),

    source: "TallyPrime",
  };
}

async function upsertCustomer(party) {
  const data = buildCustomerData(party);

  const existing = await Customer.findOne({
    companyName: {
      $regex: `^${data.companyName.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}$`,
      $options: "i",
    },
  });

  if (existing) {
    Object.assign(existing, data);
    await existing.save();

    return {
      action: "updated",
      name: data.companyName,
      id: existing._id.toString(),
    };
  }

  const created = await Customer.create(data);

  return {
    action: "created",
    name: data.companyName,
    id: created._id.toString(),
  };
}

async function upsertDistributor(party) {
  const data = buildDistributorData(party);

  const existing = await Distributor.findOne({
    companyName: {
      $regex: `^${data.companyName.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}$`,
      $options: "i",
    },
  });

  if (existing) {
    Object.assign(existing, data);
    await existing.save();

    return {
      action: "updated",
      name: data.companyName,
      id: existing._id.toString(),
    };
  }

  const created = await Distributor.create(data);

  return {
    action: "created",
    name: data.companyName,
    id: created._id.toString(),
  };
}

async function main() {
  console.log("========================================");
  console.log("TALLY CONFIRMED PARTY MASTER SYNC");
  console.log("========================================");

  if (!fs.existsSync(REGISTRY_PATH)) {
    throw new Error(
      `Registry file not found:\n${REGISTRY_PATH}`
    );
  }

  const registry = JSON.parse(
    fs.readFileSync(REGISTRY_PATH, "utf8")
  );

  console.log(
    `Confirmed customers: ${registry.customers.length}`
  );

  console.log(
    `Confirmed distributors: ${registry.distributors.length}`
  );

  console.log("");

  await mongoose.connect(process.env.MONGODB_URI);

  console.log("MongoDB connected successfully");
  console.log("");

  const results = {
    customers: {
      created: 0,
      updated: 0,
    },

    distributors: {
      created: 0,
      updated: 0,
    },
  };

  console.log("----- CUSTOMERS -----");

  for (const party of registry.customers) {
    const result = await upsertCustomer(party);

    results.customers[result.action]++;

    console.log(
      `${result.action.toUpperCase()}: ${result.name}`
    );
  }

  console.log("");

  console.log("----- DISTRIBUTORS -----");

  for (const party of registry.distributors) {
    const result = await upsertDistributor(party);

    results.distributors[result.action]++;

    console.log(
      `${result.action.toUpperCase()}: ${result.name}`
    );
  }

  console.log("");
  console.log("========================================");
  console.log("SYNC COMPLETE");
  console.log("========================================");

  console.log(
    `Customers created: ${results.customers.created}`
  );

  console.log(
    `Customers updated: ${results.customers.updated}`
  );

  console.log(
    `Distributors created: ${results.distributors.created}`
  );

  console.log(
    `Distributors updated: ${results.distributors.updated}`
  );

  console.log("");

  const customerCount = await Customer.countDocuments();
  const distributorCount = await Distributor.countDocuments();

  console.log(
    `Total customers currently in MongoDB: ${customerCount}`
  );

  console.log(
    `Total distributors currently in MongoDB: ${distributorCount}`
  );

  await mongoose.disconnect();

  console.log("");
  console.log("MongoDB disconnected.");
}

main().catch(async (error) => {
  console.error("");
  console.error("SYNC FAILED");
  console.error(error);

  try {
    await mongoose.disconnect();
  } catch (_) {}

  process.exit(1);
});