const mongoose = require("mongoose");

const TallyTransaction = require("../models/tallyTransaction");
const Customer = require("../models/customer");
const Distributor = require("../models/distributor");
const { syncTallyRelationships } = require("../services/tallyRelationshipSyncService");

const SYNC_SECRET =
  process.env.TALLY_SYNC_SECRET ||
  "eminent_tally_sync_2026_change_this_later";

// ============================================================
// HELPERS
// ============================================================

function clean(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

// ============================================================
// REGEX ESCAPE
// ============================================================

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================
// FIND PARTY
// ============================================================

async function findParty(transaction) {
  const partyType = clean(
    transaction.party?.businessRole
  ).toLowerCase();

  const requestedName = clean(
    transaction.party?.requestedName
  );

  const tallyName = clean(
    transaction.party?.tallyName ||
      transaction.partyLedgerName
  );

  const names = [
    ...new Set(
      [requestedName, tallyName].filter(Boolean)
    ),
  ];

  // ----------------------------------------------------------
  // CUSTOMER
  // ----------------------------------------------------------

  if (partyType === "customer") {
    for (const name of names) {
      const customer = await Customer.findOne({
        companyName: {
          $regex: `^${escapeRegex(name)}$`,
          $options: "i",
        },
      });

      if (customer) {
        return {
          customer,
          distributor: null,
        };
      }
    }
  }

  // ----------------------------------------------------------
  // DISTRIBUTOR
  // ----------------------------------------------------------

  if (partyType === "distributor") {
    for (const name of names) {
      const distributor = await Distributor.findOne({
        companyName: {
          $regex: `^${escapeRegex(name)}$`,
          $options: "i",
        },
      });

      if (distributor) {
        return {
          customer: null,
          distributor,
        };
      }
    }
  }

  return null;
}

// ============================================================
// TALLY TRANSACTION IDENTITIES
// ============================================================
//
// We keep all known stable identifiers.
//
// IMPORTANT:
// A voucher may expose more than one identifier.
// We therefore search using ALL identifiers before using
// the fallback key. This prevents duplicates if Tally later
// returns a different preferred identifier.
//

function getTransactionIdentities(transaction) {
  const identities = [];

  const candidates = [
    {
      field: "tallyGuid",
      value: clean(transaction.guid),
      type: "GUID",
    },
    {
      field: "tallyVchKey",
      value: clean(transaction.vchKey),
      type: "VCHKEY",
    },
    {
      field: "tallyRemoteId",
      value: clean(transaction.remoteId),
      type: "REMOTEID",
    },
    {
      field: "tallyVoucherKey",
      value: clean(transaction.voucherKey),
      type: "VOUCHERKEY",
    },
    {
      field: "tallyVoucherRetainKey",
      value: clean(transaction.voucherRetainKey),
      type: "VOUCHERRETAINKEY",
    },
  ];

  for (const candidate of candidates) {
    if (candidate.value) {
      identities.push(candidate);
    }
  }

  return identities;
}

// ============================================================
// TRANSACTION KEY
// ============================================================

function getTransactionKey(transaction) {
  const identities = getTransactionIdentities(transaction);

  if (identities.length > 0) {
    return {
      field: identities[0].field,
      value: identities[0].value,
      type: identities[0].type,
    };
  }

  return {
    field: "fallback",
    value: [
      clean(transaction.party?.tallyName) ||
        clean(transaction.partyLedgerName),

      clean(transaction.voucherType),

      clean(transaction.voucherNumber),

      clean(transaction.date),
    ].join("|"),
    type: "FALLBACK",
  };
}

// ============================================================
// FIND EXISTING TRANSACTION
// ============================================================
//
// First search every stable Tally identity.
//
// If not found, search the old fallback identity.
// This allows an older MongoDB record to be upgraded to a
// stable Tally identity without creating a duplicate.
//

async function findExistingTransaction(
  transaction,
  party,
  partyType,
  transactionDate
) {
  const identities =
    getTransactionIdentities(transaction);

  // ----------------------------------------------------------
  // SEARCH ALL STABLE IDENTITIES
  // ----------------------------------------------------------

  if (identities.length > 0) {
    const stableQueries = identities.map(
      (identity) => ({
        [identity.field]: identity.value,
      })
    );

    const existing =
      await TallyTransaction.findOne({
        $or: stableQueries,
      });

    if (existing) {
      return existing;
    }
  }

  // ----------------------------------------------------------
  // FALLBACK SEARCH
  // ----------------------------------------------------------

  const fallbackQuery = {
    partyType,

    voucherType: clean(
      transaction.voucherType
    ),

    voucherNumber: clean(
      transaction.voucherNumber
    ),

    transactionDate,
  };

  if (partyType === "customer") {
    fallbackQuery.customer =
      party.customer?._id;
  } else {
    fallbackQuery.distributor =
      party.distributor?._id;
  }

  return TallyTransaction.findOne(
    fallbackQuery
  );
}

// ============================================================
// GET ACTUAL PARTY LEDGER AMOUNT
// ============================================================
//
// IMPORTANT:
//
// Do NOT use transaction.totals.ledgerAmount as the primary
// total because it may contain:
//
// Party ledger
// + sales/purchase ledger
// + tax ledgers
//
// Instead, use the exact party ledger amount.
//

function getPartyLedgerAmount(transaction) {
  if (!Array.isArray(transaction.ledgerEntries)) {
    return 0;
  }

  const partyTallyName = clean(
    transaction.party?.tallyName ||
      transaction.partyLedgerName
  ).toLowerCase();

  if (!partyTallyName) {
    return 0;
  }

  // ----------------------------------------------------------
  // EXACT PARTY LEDGER MATCH
  // ----------------------------------------------------------

  const exactMatch =
    transaction.ledgerEntries.find(
      (entry) =>
        clean(entry.ledgerName).toLowerCase() ===
        partyTallyName
    );

  if (exactMatch) {
    return Math.abs(
      toNumber(exactMatch.amount)
    );
  }

  // ----------------------------------------------------------
  // FALLBACK PARTYLEDGERNAME MATCH
  // ----------------------------------------------------------

  const partyLedgerName = clean(
    transaction.partyLedgerName
  ).toLowerCase();

  if (partyLedgerName) {
    const fallbackMatch =
      transaction.ledgerEntries.find(
        (entry) =>
          clean(entry.ledgerName).toLowerCase() ===
          partyLedgerName
      );

    if (fallbackMatch) {
      return Math.abs(
        toNumber(fallbackMatch.amount)
      );
    }
  }

  // ----------------------------------------------------------
  // LAST FALLBACK
  // ----------------------------------------------------------

  return Math.abs(
    toNumber(
      transaction.totals?.ledgerAmount
    )
  );
}

// ============================================================
// NORMALIZE INVENTORY
// ============================================================

function normalizeInventoryEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((item) => ({
    stockItemName: clean(item.stockItemName),

    description: clean(item.description),

    actualQty: toNumber(item.actualQty),

    billedQty: toNumber(item.billedQty),

    rate: toNumber(item.rate),

    amount: toNumber(item.amount),

    discount: toNumber(item.discount),

    godownName: clean(item.godownName),

    trackingNumber: clean(
      item.trackingNumber
    ),

    orderNumber: clean(
      item.orderNumber
    ),

    orderDueDate: clean(
      item.orderDueDate
    ),

    batchAllocations:
      Array.isArray(item.batchAllocations)
        ? item.batchAllocations.map(
            (batch) => ({
              batchName: clean(
                batch.batchName
              ),

              godownName: clean(
                batch.godownName
              ),

              actualQty: toNumber(
                batch.actualQty
              ),

              billedQty: toNumber(
                batch.billedQty
              ),

              amount: toNumber(
                batch.amount
              ),
            })
          )
        : [],

    accountingAllocations:
      Array.isArray(
        item.accountingAllocations
      )
        ? item.accountingAllocations.map(
            (allocation) => ({
              ledgerName: clean(
                allocation.ledgerName
              ),

              amount: toNumber(
                allocation.amount
              ),
            })
          )
        : [],
  }));
}

// ============================================================
// NORMALIZE LEDGERS
// ============================================================

function normalizeLedgerEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => ({
    ledgerName: clean(entry.ledgerName),

    amount: toNumber(entry.amount),

    isPartyLedger: Boolean(
      entry.isPartyLedger
    ),

    billAllocations:
      Array.isArray(entry.billAllocations)
        ? entry.billAllocations.map(
            (bill) => ({
              name: clean(bill.name),

              billType: clean(
                bill.billType
              ),

              amount: toNumber(
                bill.amount
              ),

              billDate: clean(
                bill.billDate
              ),
            })
          )
        : [],
  }));
}

// ============================================================
// SYNC ONE TRANSACTION
// ============================================================

async function syncOneTransaction(
  transaction,
  syncBatchId
) {
  // ----------------------------------------------------------
  // PARTY TYPE
  // ----------------------------------------------------------

  const partyType = clean(
    transaction.party?.businessRole
  ).toLowerCase();

  if (
    !["customer", "distributor"].includes(
      partyType
    )
  ) {
    return {
      status: "skipped",
      reason: "Invalid party type",
    };
  }

  // ----------------------------------------------------------
  // FIND PARTY
  // ----------------------------------------------------------

  const party = await findParty(
    transaction
  );

  if (!party) {
    return {
      status: "skipped",
      reason:
        `Party not found in MongoDB: ${
          transaction.party?.requestedName ||
          transaction.party?.tallyName ||
          transaction.partyLedgerName ||
          "Unknown"
        }`,
    };
  }

  // ----------------------------------------------------------
  // TRANSACTION DATE
  // ----------------------------------------------------------

  const transactionDate = toDate(
    transaction.date
  );

  if (!transactionDate) {
    return {
      status: "skipped",
      reason: "Invalid transaction date",
    };
  }

  // ----------------------------------------------------------
  // TRANSACTION KEY
  // ----------------------------------------------------------

  const key =
    getTransactionKey(transaction);

  // ----------------------------------------------------------
  // FIND EXISTING RECORD
  // ----------------------------------------------------------

  const existing =
    await findExistingTransaction(
      transaction,
      party,
      partyType,
      transactionDate
    );

  // ----------------------------------------------------------
  // CORRECT TRANSACTION TOTAL
  // ----------------------------------------------------------

  const totalAmount =
    getPartyLedgerAmount(
      transaction
    );

  // ----------------------------------------------------------
  // PARTY NAME
  // ----------------------------------------------------------

  const partyName =
    clean(
      transaction.party?.requestedName
    ) ||
    clean(
      transaction.party?.tallyName
    ) ||
    clean(
      transaction.partyLedgerName
    );

  if (!partyName) {
    return {
      status: "skipped",
      reason:
        "Unable to determine party name",
    };
  }

  // ----------------------------------------------------------
  // TRANSACTION TYPE
  // ----------------------------------------------------------

  const normalizedVoucherType =
    clean(
      transaction.voucherType
    ).toLowerCase();

  const transactionType =
    normalizedVoucherType ===
      "purchase"
      ? "purchase"
      : "sale";

  // ----------------------------------------------------------
  // TALLY IDENTITIES
  // ----------------------------------------------------------

  const transactionIdentities =
    getTransactionIdentities(
      transaction
    );

  const primaryIdentity =
    transactionIdentities[0] || null;

  // ----------------------------------------------------------
  // CANCELLATION
  // ----------------------------------------------------------
  //
  // THIS IS THE IMPORTANT FIX:
  //
  // Tally's cancellation state is explicitly persisted.
  //
  const isCancelled = Boolean(
    transaction.isCancelled
  );

  // ----------------------------------------------------------
  // BUILD MONGODB DATA
  // ----------------------------------------------------------

  const data = {
    customer:
      partyType === "customer"
        ? party.customer?._id || null
        : null,

    distributor:
      partyType === "distributor"
        ? party.distributor?._id || null
        : null,

    partyType,

    partyName,

    tallyPartyName: clean(
      transaction.party?.tallyName ||
        transaction.partyLedgerName
    ),

    partyGstin: clean(
      transaction.partyGstin ||
        transaction.party?.gstin
    ),

    transactionType,

    voucherType: clean(
      transaction.voucherType
    ),

    voucherNumber: clean(
      transaction.voucherNumber
    ),

    transactionDate,

    reference: clean(
      transaction.reference
    ),

    narration: clean(
      transaction.narration
    ),

    isInvoice: Boolean(
      transaction.isInvoice
    ),

    voucherStatus: clean(
      transaction.voucherStatus
    ),

    // --------------------------------------------------------
    // CANCELLATION STATE
    // --------------------------------------------------------

    isCancelled,

    // --------------------------------------------------------
    // AMOUNTS
    // --------------------------------------------------------

    inventoryAmount: toNumber(
      transaction.totals
        ?.inventoryAmount
    ),

    totalAmount,

    // --------------------------------------------------------
    // INVENTORY
    // --------------------------------------------------------

    inventoryEntries:
      normalizeInventoryEntries(
        transaction.inventoryEntries
      ),

    // --------------------------------------------------------
    // LEDGER ENTRIES
    // --------------------------------------------------------

    ledgerEntries:
      normalizeLedgerEntries(
        transaction.ledgerEntries
      ),

    // --------------------------------------------------------
    // TALLY IDENTIFIERS
    // --------------------------------------------------------

    tallyVoucherIdentity:
      primaryIdentity
        ? primaryIdentity.value
        : key.value,

    tallyVoucherIdentityType:
      primaryIdentity
        ? primaryIdentity.type
        : "FALLBACK",

    tallyGuid: clean(
      transaction.guid
    ),

    tallyVchKey: clean(
      transaction.vchKey
    ),

    tallyRemoteId: clean(
      transaction.remoteId
    ),

    tallyVoucherKey: clean(
      transaction.voucherKey
    ),

    tallyVoucherRetainKey: clean(
      transaction.voucherRetainKey
    ),

    tallyAlterId: clean(
      transaction.alterId
    ),

    tallyMasterId: clean(
      transaction.masterId
    ),

    // --------------------------------------------------------
    // SYNC INFORMATION
    // --------------------------------------------------------

    source:
      clean(transaction.source) ||
      "TallyPrime",

    lastSyncedAt: new Date(),

    lastTallyAlterId: clean(
      transaction.alterId
    ),

    syncVersion: existing
      ? (existing.syncVersion || 1) + 1
      : 1,

    syncBatchId,
  };

  // ----------------------------------------------------------
  // INSERT
  // ----------------------------------------------------------

  if (!existing) {
    data.firstSyncedAt = new Date();

    const created =
      await TallyTransaction.create(
        data
      );
     return {
      status: "created",
      id: created._id,
    };
  }

  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------

  Object.assign(
    existing,
    data
  );

  await existing.save();

  return {
    status: "updated",
    id: existing._id,
  };
}

// ============================================================
// MAIN SYNC CONTROLLER
// ============================================================

const syncTallyTransactions =
  async (req, res) => {
    try {
      // ------------------------------------------------------
      // SECURITY
      // ------------------------------------------------------

      const secret =
        req.headers[
          "x-tally-sync-secret"
        ];

      if (secret !== SYNC_SECRET) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid Tally sync secret",
        });
      }

      // ------------------------------------------------------
      // ACCEPT DATA
      // ------------------------------------------------------

      const body = req.body || {};

      const customers =
        Array.isArray(body.customers)
          ? body.customers
          : [];

      const distributors =
        Array.isArray(
          body.distributors
        )
          ? body.distributors
          : [];

      const transactions = [
        ...customers,
        ...distributors,
      ];

      if (transactions.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "No Tally customer or distributor transactions received",
        });
      }

      // ------------------------------------------------------
      // SYNC BATCH
      // ------------------------------------------------------

      const syncBatchId =
        new mongoose.Types.ObjectId().toString();

      let created = 0;
      let updated = 0;
      let skipped = 0;

      const errors = [];

      // ------------------------------------------------------
      // PROCESS TRANSACTIONS
      // ------------------------------------------------------

      for (const transaction of transactions) {
        try {
          const result =
            await syncOneTransaction(
              transaction,
              syncBatchId
            );

          if (
            result.status === "created"
          ) {
            created++;
          } else if (
            result.status === "updated"
          ) {
            updated++;
          } else {
            skipped++;

            errors.push({
              voucherNumber:
                transaction.voucherNumber ||
                "",

              party:
                transaction.party
                  ?.requestedName ||
                transaction.party
                  ?.tallyName ||
                transaction.partyLedgerName ||
                "",

              reason: result.reason,
            });
          }
        } catch (error) {
          skipped++;

          errors.push({
            voucherNumber:
              transaction.voucherNumber ||
              "",

            party:
              transaction.party
                ?.requestedName ||
              transaction.party
                ?.tallyName ||
              transaction.partyLedgerName ||
              "",

            reason: error.message,
          });
        }
      }

      // ------------------------------------------------------
      // RELATIONSHIP LINKING
      // ------------------------------------------------------

      let relationshipSync = null;
      try {
        relationshipSync = await syncTallyRelationships();
      } catch (relationshipError) {
        console.error(
          "Tally relationship sync warning:",
          relationshipError
        );
      }

      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          "Tally business transactions synchronized successfully",

        syncBatchId,

        syncedAt:
          new Date().toISOString(),

        summary: {
          received:
            transactions.length,

          created,

          updated,

          skipped,

          customerTransactions:
            customers.length,

          distributorTransactions:
            distributors.length,

          relationshipSync,
        },

        skippedTransactions:
          errors,
      });
    } catch (error) {
      console.error(
        "Tally transaction sync error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to synchronize Tally transactions",

        error: error.message,
      });
    }
  };

// ============================================================
// GET CUSTOMER TRANSACTIONS
// ============================================================

const getCustomerTallyTransactions =
  async (req, res) => {
    try {
      const transactions =
        await TallyTransaction.find({
          customer:
            req.params.customerId,
        })
          .sort({
            transactionDate: -1,
          })
          .populate(
            "customer",
            "companyName"
          );

      return res.status(200).json({
        success: true,
        transactions,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,

        message:
          "Failed to get customer Tally transactions",

        error: error.message,
      });
    }
  };

// ============================================================
// GET DISTRIBUTOR TRANSACTIONS
// ============================================================

const getDistributorTallyTransactions =
  async (req, res) => {
    try {
      const transactions =
        await TallyTransaction.find({
          distributor:
            req.params.distributorId,
        })
          .sort({
            transactionDate: -1,
          })
          .populate(
            "distributor",
            "companyName"
          );

      return res.status(200).json({
        success: true,
        transactions,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,

        message:
          "Failed to get distributor Tally transactions",

        error: error.message,
      });
    }
  };

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  syncTallyTransactions,
  getCustomerTallyTransactions,
  getDistributorTallyTransactions,
};