const mongoose = require("mongoose");

const Service = require("../models/service");
const ServiceAgreement = require("../models/serviceAgreement");
const ServiceCycle = require("../models/serviceCycle");
const CustomerService = require("../models/customerService");
const DistributorService = require("../models/distributorService");
const CycleInventory = require("../models/cycleInventory");
const Asset = require("../models/asset");
const AssetHistory = require("../models/assetHistory");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const sameId = (a, b) =>
  Boolean(a && b && String(a) === String(b));


const sameNullableId = (a, b) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return String(a) === String(b);
};

const findCycleInventoryForPair = async (
  { service, customerCycle, distributorCycle },
  session = null
) => {
  const clauses = [];

  if (customerCycle) {
    clauses.push({ customerCycle });
  }

  if (distributorCycle) {
    clauses.push({ distributorCycle });
  }

  if (!clauses.length) {
    return { inventory: null };
  }

  let query = CycleInventory.find({ $or: clauses });

  if (session) {
    query = query.session(session);
  }

  const records = await query;

  if (records.length > 1) {
    return {
      error: "Multiple inventory snapshots reference this cycle pair. Please review the inventory records.",
    };
  }

  const inventory = records[0] || null;

  if (
    inventory &&
    (
      !sameId(inventory.service, service) ||
      !sameNullableId(inventory.customerCycle, customerCycle) ||
      !sameNullableId(inventory.distributorCycle, distributorCycle)
    )
  ) {
    return {
      error: "An inventory snapshot exists with a different service or cycle pairing. No changes were made.",
    };
  }

  return { inventory };
};
const getCycleContext = async ({ serviceType, serviceId, cycleId }, session = null) => {
  const runQuery = (query) => session ? query.session(session) : query;
  if (!["customer", "distributor"].includes(serviceType)) {
    return { error: "Service type must be customer or distributor.", status: 400 };
  }

  if (!isValidId(serviceId) || !isValidId(cycleId)) {
    return { error: "Invalid service or cycle ID.", status: 400 };
  }

  const isCustomer = serviceType === "customer";
  const assignment = await runQuery(
    (isCustomer ? CustomerService : DistributorService).findById(serviceId)
  );

  if (!assignment) {
    return { error: "Service assignment not found.", status: 404 };
  }

  const cycle = await runQuery(ServiceCycle.findById(cycleId));

  if (!cycle) {
    return { error: "Service cycle not found.", status: 404 };
  }

  const assignmentField = isCustomer ? "customerService" : "distributorService";

  if (!sameId(cycle[assignmentField], assignment._id)) {
    return { error: "This cycle does not belong to the selected service assignment.", status: 403 };
  }

  const agreement = await runQuery(ServiceAgreement.findById(cycle.agreement));

  if (!agreement || !sameId(agreement.service, assignment.service)) {
    return { error: "The cycle's service agreement is invalid.", status: 409 };
  }

  const primaryPartyField = isCustomer ? "customer" : "distributor";

  if (!sameId(agreement[primaryPartyField], assignment[primaryPartyField])) {
    return { error: "The cycle agreement does not belong to this service assignment.", status: 409 };
  }

  const masterService = await runQuery(Service.findById(assignment.service));

  if (!masterService) {
    return { error: "Master service not found.", status: 404 };
  }

  let counterpartCycle = null;
  let counterpartAgreement = null;
  let customerService = isCustomer ? assignment : null;
  let distributorService = isCustomer ? null : assignment;

  if (cycle.counterpartCycle) {
    counterpartCycle = await runQuery(ServiceCycle.findById(cycle.counterpartCycle));

    if (
      !counterpartCycle ||
      !sameId(counterpartCycle.counterpartCycle, cycle._id)
    ) {
      return { error: "The paired cycle relationship is incomplete or invalid.", status: 409 };
    }

    counterpartAgreement = await runQuery(
      ServiceAgreement.findById(counterpartCycle.agreement)
    );

    if (
      !counterpartAgreement ||
      !sameId(agreement.counterpartAgreement, counterpartAgreement._id) ||
      !sameId(counterpartAgreement.counterpartAgreement, agreement._id) ||
      !sameId(counterpartAgreement.service, assignment.service)
    ) {
      return { error: "The paired agreement relationship is invalid.", status: 409 };
    }

    const expectedCounterpartField = isCustomer
      ? "distributorService"
      : "customerService";

    const counterpartAssignmentId = counterpartCycle[expectedCounterpartField];

    if (!counterpartAssignmentId) {
      return { error: "The paired cycle has no linked service assignment.", status: 409 };
    }

    const counterpartAssignment = await runQuery(
      (isCustomer ? DistributorService : CustomerService).findById(counterpartAssignmentId)
    );

    const counterpartPartyField = isCustomer ? "distributor" : "customer";

    if (
      !counterpartAssignment ||
      !sameId(counterpartAssignment.service, assignment.service) ||
      !sameId(
        counterpartAgreement[counterpartPartyField],
        counterpartAssignment[counterpartPartyField]
      )
    ) {
      return { error: "The paired service assignment is invalid.", status: 409 };
    }

    if (isCustomer) {
      distributorService = counterpartAssignment;
    } else {
      customerService = counterpartAssignment;
    }
  }

  return {
    assignment,
    masterService,
    cycle,
    counterpartCycle,
    customerService,
    distributorService,
    customerCycle: isCustomer ? cycle : counterpartCycle,
    distributorCycle: isCustomer ? counterpartCycle : cycle,
  };
};

const getCycleInventory = async (req, res) => {
  try {
    const context = await getCycleContext({
      serviceType: req.params.serviceType,
      serviceId: req.params.serviceId,
      cycleId: req.params.cycleId,
    });

    if (context.error) {
      return res.status(context.status).json({ message: context.error });
    }

    const lookup = await findCycleInventoryForPair({
      service: context.masterService._id,
      customerCycle: context.customerCycle?._id || null,
      distributorCycle: context.distributorCycle?._id || null,
    });

    if (lookup.error) {
      return res.status(409).json({ message: lookup.error });
    }

    const inventory = lookup.inventory
      ? await CycleInventory.findById(lookup.inventory._id)
          .populate("entries.asset")
          .populate("createdFromInventory")
          .lean()
      : null;

    return res.status(200).json({
      message: "Cycle inventory retrieved successfully.",
      cycle: context.cycle,
      counterpartCycle: context.counterpartCycle,
      service: context.masterService,
      inventory: inventory || null,
    });
  } catch (error) {
    console.error("Get cycle inventory error:", error);
    return res.status(500).json({
      message: "Failed to retrieve cycle inventory.",
    });
  }
};


const saveCycleInventory = async (req, res) => {
  let session = null;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const { serviceType, serviceId, cycleId } = req.params;
    const context = await getCycleContext({
      serviceType,
      serviceId,
      cycleId,
    }, session);

    if (context.error) {
      return res.status(context.status).json({
        message: context.error,
      });
    }

    const {
      cycle,
      counterpartCycle,
      masterService,
      customerService,
      distributorService,
    } = context;

    const currentLookup = await findCycleInventoryForPair({
      service: masterService._id,
      customerCycle: context.customerCycle?._id || null,
      distributorCycle: context.distributorCycle?._id || null,
    }, session);

    if (currentLookup.error) {
      return res.status(409).json({ message: currentLookup.error });
    }

    const currentInventory = currentLookup.inventory;

    // Inventory can only be created or edited while the cycle is draft.
    if (cycle.status !== "draft") {
      return res.status(409).json({
        message: "Inventory can only be created or edited while the cycle is in draft status.",
      });
    }

    if (counterpartCycle && counterpartCycle.status !== "draft") {
      return res.status(409).json({
        message: "Inventory cannot be created or edited because the paired cycle is not in draft status.",
      });
    }

    const bodyHasEntries = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "entries"
    );

    if (bodyHasEntries && !Array.isArray(req.body.entries)) {
      return res.status(400).json({
        message: "Entries must be an array.",
      });
    }

    let previousInventory = null;

    if (!currentInventory) {
      const previousCustomerCycleId =
        context.customerCycle?.previousCycle || null;
      const previousDistributorCycleId =
        context.distributorCycle?.previousCycle || null;

      if (counterpartCycle) {
        const hasPreviousReference =
          Boolean(previousCustomerCycleId || previousDistributorCycleId);

        if (
          hasPreviousReference &&
          (
            !previousCustomerCycleId ||
            !previousDistributorCycleId ||
            !sameId(
              context.customerCycle?.previousCounterpartCycle,
              previousDistributorCycleId
            ) ||
            !sameId(
              context.distributorCycle?.previousCounterpartCycle,
              previousCustomerCycleId
            )
          )
        ) {
          return res.status(409).json({
            message: "The previous customer and distributor cycle links do not match. Inventory carry-forward was stopped.",
          });
        }
      }

      if (previousCustomerCycleId || previousDistributorCycleId) {
        const previousLookup = await findCycleInventoryForPair({
          service: masterService._id,
          customerCycle: previousCustomerCycleId,
          distributorCycle: previousDistributorCycleId,
        }, session);

        if (previousLookup.error) {
          return res.status(409).json({
            message: previousLookup.error,
          });
        }

        previousInventory = previousLookup.inventory
          ? await CycleInventory.findById(previousLookup.inventory._id)
              .populate("entries.asset")
              .session(session)
          : null;
      }
    }

    const inventoryEntriesToInput = (entries) =>
      entries.map((entry) => ({
        assetId: entry.asset?._id || entry.asset,
        assetName: entry.assetName,
        assetTag: entry.assetTag,
        serialNumber: entry.serialNumber,
        category: entry.category,
        manufacturer: entry.manufacturer,
        model: entry.model,
        quantity: entry.quantity,
        unit: entry.unit,
        unitPrice: entry.unitPrice,
        totalPrice: entry.totalPrice,
        warrantyStartDate: entry.warrantyStartDate,
        warrantyEndDate: entry.warrantyEndDate,
        coverageStartDate: entry.coverageStartDate,
        coverageEndDate: entry.coverageEndDate,
        notes: entry.notes,
      }));

    const sourceEntries = bodyHasEntries
      ? req.body.entries
      : currentInventory
        ? inventoryEntriesToInput(currentInventory.entries)
        : previousInventory
          ? inventoryEntriesToInput(previousInventory.entries)
          : [];

    const nullableIdMatches = (a, b) => {
      if (!a && !b) return true;
      if (!a || !b) return false;
      return String(a) === String(b);
    };

    const parseDate = (value, fieldName) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }

      const parsed = new Date(value);

      if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date supplied for ${fieldName}.`);
      }

      return parsed;
    };

    const validateDateRange = (start, end, label) => {
      if (start && end && end < start) {
        throw new Error(`${label} end date cannot be before its start date.`);
      }
    };

    // Validate every entry before creating any permanent Asset records.
    const stagedEntries = [];
    const seenAssetIds = new Set();

    for (let index = 0; index < sourceEntries.length; index += 1) {
      const input = sourceEntries[index] || {};
      const assetId = input.assetId || input.asset || null;

      if (assetId && !isValidId(assetId)) {
        return res.status(400).json({
          message: `Invalid asset ID in inventory entry ${index + 1}.`,
        });
      }

      if (assetId && seenAssetIds.has(String(assetId))) {
        return res.status(400).json({
          message: `The same asset appears more than once in entry ${index + 1}.`,
        });
      }

      if (assetId) {
        seenAssetIds.add(String(assetId));
      }

      const assetName = String(input.assetName || input.name || "").trim();

      if (!assetId && !assetName) {
        return res.status(400).json({
          message: `Asset name is required for new asset entry ${index + 1}.`,
        });
      }

      const quantity = Number(input.quantity ?? 1);
      const unitPrice = Number(input.unitPrice ?? 0);
      const totalPrice =
        input.totalPrice === undefined || input.totalPrice === null
          ? quantity * unitPrice
          : Number(input.totalPrice);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        !Number.isFinite(totalPrice) ||
        totalPrice < 0
      ) {
        return res.status(400).json({
          message: `Invalid quantity or price in inventory entry ${index + 1}.`,
        });
      }

      const warrantyStartDate = parseDate(
        input.warrantyStartDate,
        "warrantyStartDate"
      );
      const warrantyEndDate = parseDate(
        input.warrantyEndDate,
        "warrantyEndDate"
      );
      const coverageStartDate = parseDate(
        input.coverageStartDate,
        "coverageStartDate"
      );
      const coverageEndDate = parseDate(
        input.coverageEndDate,
        "coverageEndDate"
      );

      validateDateRange(
        warrantyStartDate,
        warrantyEndDate,
        "Warranty"
      );
      validateDateRange(
        coverageStartDate,
        coverageEndDate,
        "Coverage"
      );

      stagedEntries.push({
        assetId: assetId ? String(assetId) : null,
        assetName,
        assetTag: String(input.assetTag || "").trim(),
        serialNumber: String(input.serialNumber || "").trim(),
        category: String(input.category || "").trim(),
        manufacturer: String(input.manufacturer || "").trim(),
        model: String(input.model || "").trim(),
        quantity,
        unit: String(input.unit || "Piece").trim(),
        unitPrice,
        totalPrice,
        warrantyStartDate,
        warrantyEndDate,
        coverageStartDate,
        coverageEndDate,
        notes: String(input.notes || "").trim(),
      });
    }

    const expectedCustomer = customerService?.customer || null;
    const expectedDistributor = distributorService?.distributor || null;

    // Resolve and validate existing permanent assets.
    const existingAssetIds = stagedEntries
      .filter((entry) => entry.assetId)
      .map((entry) => entry.assetId);

    const existingAssets = existingAssetIds.length
      ? await Asset.find({
          _id: { $in: existingAssetIds },
          service: masterService._id,
        }).session(session)
      : [];

    const assetMap = new Map(
      existingAssets.map((asset) => [String(asset._id), asset])
    );

    for (const entry of stagedEntries) {
      if (!entry.assetId) continue;

      const asset = assetMap.get(entry.assetId);

      if (!asset) {
        return res.status(404).json({
          message: `Asset ${entry.assetId} was not found under this master service.`,
        });
      }

      if (
        !nullableIdMatches(asset.customer, expectedCustomer) ||
        !nullableIdMatches(asset.distributor, expectedDistributor)
      ) {
        return res.status(409).json({
          message: `Asset "${asset.name}" belongs to a different customer or distributor.`,
        });
      }
    }

    // Only after validation, create new permanent assets.
    const newAssetEntries = stagedEntries.filter((entry) => !entry.assetId);

    if (newAssetEntries.length) {
      const createdAssets = await Asset.insertMany(
        newAssetEntries.map((entry) => ({
          service: masterService._id,
          customer: expectedCustomer,
          distributor: expectedDistributor,
          assetTag: entry.assetTag,
          name: entry.assetName,
          category: entry.category,
          manufacturer: entry.manufacturer,
          model: entry.model,
          serialNumber: entry.serialNumber,
          unit: entry.unit,
          status: "active",
          notes: entry.notes,
        })),
        { session }
      );

      let createdIndex = 0;

      for (const entry of stagedEntries) {
        if (!entry.assetId) {
          entry.assetId = String(createdAssets[createdIndex]._id);
          assetMap.set(entry.assetId, createdAssets[createdIndex]);
          createdIndex += 1;
        }
      }
    }

    const previousEntries = currentInventory
      ? currentInventory.entries
      : previousInventory
        ? previousInventory.entries
        : [];

    const previousMap = new Map(
      previousEntries.map((entry) => [
        String(entry.asset?._id || entry.asset),
        entry,
      ])
    );

    const newAssetIdSet = new Set(
      stagedEntries.map((entry) => entry.assetId)
    );

    const snapshotEntries = stagedEntries.map((entry) => ({
      asset: entry.assetId,
      assetName:
        entry.assetName ||
        previousMap.get(entry.assetId)?.assetName ||
        "Unnamed asset",
      assetTag: entry.assetTag,
      serialNumber: entry.serialNumber,
      category: entry.category,
      manufacturer: entry.manufacturer,
      model: entry.model,
      quantity: entry.quantity,
      unit: entry.unit,
      unitPrice: entry.unitPrice,
      totalPrice: entry.totalPrice,
      warrantyStartDate: entry.warrantyStartDate,
      warrantyEndDate: entry.warrantyEndDate,
      coverageStartDate: entry.coverageStartDate,
      coverageEndDate: entry.coverageEndDate,
      notes: entry.notes,
    }));

    const snapshotFields = [
      "assetName",
      "assetTag",
      "serialNumber",
      "category",
      "manufacturer",
      "model",
      "quantity",
      "unit",
      "unitPrice",
      "totalPrice",
      "warrantyStartDate",
      "warrantyEndDate",
      "coverageStartDate",
      "coverageEndDate",
      "notes",
    ];

    const normalizeValue = (value) => {
      if (value instanceof Date) return value.toISOString();
      if (value === null || value === undefined) return null;
      return value;
    };

    const snapshotsDiffer = (oldEntry, newEntry) =>
      snapshotFields.some(
        (field) =>
          normalizeValue(oldEntry?.[field]) !==
          normalizeValue(newEntry?.[field])
      );

    const totalValue = snapshotEntries.reduce(
      (sum, entry) => sum + entry.totalPrice,
      0
    );

    const inventoryId = currentInventory?._id || new mongoose.Types.ObjectId();

    const inventoryData = {
      _id: inventoryId,
      customerCycle: context.customerCycle?._id || null,
      distributorCycle: context.distributorCycle?._id || null,
      service: masterService._id,
      customerService: customerService?._id || null,
      distributorService: distributorService?._id || null,
      entries: snapshotEntries,
      totalValue,
      notes: req.body?.notes === undefined ? (currentInventory?.notes || "") : String(req.body.notes || "").trim(),
      createdFromInventory:
        currentInventory?.createdFromInventory ||
        previousInventory?._id ||
        null,
    };

    const inventory = currentInventory
      ? Object.assign(currentInventory, inventoryData)
      : new CycleInventory(inventoryData);

    await inventory.save({ session });

    // Record additions, removals, carry-forwards and changes.
    const historyRecords = [];

    for (const entry of snapshotEntries) {
      const oldEntry = previousMap.get(String(entry.asset));
      let eventType = null;

      if (!oldEntry) {
        eventType = "added";
      } else if (
        !currentInventory &&
        previousInventory &&
        !snapshotsDiffer(oldEntry, entry)
      ) {
        eventType = "carried_forward";
      } else if (snapshotsDiffer(oldEntry, entry)) {
        const warrantyChanged =
          normalizeValue(oldEntry.warrantyStartDate) !==
            normalizeValue(entry.warrantyStartDate) ||
          normalizeValue(oldEntry.warrantyEndDate) !==
            normalizeValue(entry.warrantyEndDate);

        eventType = warrantyChanged ? "warranty_updated" : "updated";
      }

      if (eventType) {
        historyRecords.push({
          asset: entry.asset,
          cycleInventory: inventory._id,
          customerCycle: context.customerCycle?._id || null,
          distributorCycle: context.distributorCycle?._id || null,
          eventType,
          previousSnapshot: oldEntry ? oldEntry.toObject?.() || oldEntry : null,
          newSnapshot: entry,
        });
      }
    }

    for (const oldEntry of previousEntries) {
      const oldAssetId = String(oldEntry.asset?._id || oldEntry.asset);

      if (!newAssetIdSet.has(oldAssetId)) {
        historyRecords.push({
          asset: oldAssetId,
          cycleInventory: inventory._id,
          customerCycle: context.customerCycle?._id || null,
          distributorCycle: context.distributorCycle?._id || null,
          eventType: "removed",
          previousSnapshot: oldEntry.toObject?.() || oldEntry,
          newSnapshot: null,
        });
      }
    }

    if (historyRecords.length) {
      await AssetHistory.insertMany(historyRecords, { session });
    }

    const populatedInventory = await CycleInventory.findById(inventory._id)
      .session(session)
      .populate("entries.asset")
      .populate("createdFromInventory")
      .lean();

    await session.commitTransaction();

    return res.status(200).json({
      message: "Cycle inventory saved successfully.",
      inventory: populatedInventory,
    });
  } catch (error) {
    console.error("Save cycle inventory error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An inventory snapshot already exists for this cycle. Refresh and try again.",
      });
    }

    if (error.message && error.message.startsWith("Invalid date")) {
      return res.status(400).json({ message: error.message });
    }

    if (error.message && error.message.includes("end date cannot be before")) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Failed to save cycle inventory.",
    });
  } finally {
    if (session) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      await session.endSession();
    }
  }
};

module.exports = {
  getCycleInventory,
  saveCycleInventory,
};
