const mongoose = require("mongoose");

const TallyOutstanding = require("../models/tallyOutstanding");
const Customer = require("../models/customer");
const Distributor = require("../models/distributor");

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

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function normalizeName(value) {
  return clean(value)
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function makePartyKey(partyType, partyName) {
  return `${partyType}:${normalizeName(
    partyName
  )}`;
}

// ============================================================
// FIND CUSTOMER
// ============================================================

async function findCustomer(partyName, tallyName) {
  const names = [
    clean(partyName),
    clean(tallyName),
  ].filter(Boolean);

  for (const name of [
    ...new Set(names),
  ]) {
    const customer =
      await Customer.findOne({
        companyName: {
          $regex: `^${name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}$`,
          $options: "i",
        },
      });

    if (customer) {
      return customer;
    }
  }

  return null;
}

// ============================================================
// FIND DISTRIBUTOR
// ============================================================

async function findDistributor(
  partyName,
  tallyName
) {
  const names = [
    clean(partyName),
    clean(tallyName),
  ].filter(Boolean);

  for (const name of [
    ...new Set(names),
  ]) {
    const distributor =
      await Distributor.findOne({
        companyName: {
          $regex: `^${name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}$`,
          $options: "i",
        },
      });

    if (distributor) {
      return distributor;
    }
  }

  return null;
}

// ============================================================
// NORMALIZE BILL
// ============================================================

function normalizeLedgerVoucher(voucher) {
  return {
    partyName: clean(voucher?.partyName),
    tallyName: clean(voucher?.tallyName),
    role: clean(voucher?.role).toLowerCase() === "distributor" ? "distributor" : "customer",
    voucherDate: toDate(voucher?.voucherDate),
    voucherType: clean(voucher?.voucherType),
    voucherNumber: clean(voucher?.voucherNumber),
    amount: toNumber(voucher?.amount),
    source: clean(voucher?.source) || "TallyPrime Ledger Outstandings",
  };
}

function normalizeBill(bill) {
  return {
    billRef: clean(
      bill?.billRef
    ),

    billDate: toDate(
      bill?.billDate
    ),

    dueDate: toDate(
      bill?.dueDate
    ),

    overdueDays: Math.max(
      0,
      Math.trunc(
        toNumber(
          bill?.overdueDays
        )
      )
    ),

    pendingAmount: Math.max(
      0,
      toNumber(
        bill?.pendingAmount
      )
    ),
  };
}

// ============================================================
// UPSERT ONE OUTSTANDING PARTY
// ============================================================

async function upsertOutstandingParty({
  summary,
  partyType,
  syncBatchId,
  fromDate,
  toDate,
}) {
  const partyName = clean(
    summary?.partyName
  );

  const tallyPartyName =
    clean(
      summary?.tallyName
    ) || partyName;

  if (!partyName) {
    return {
      status: "skipped",
      reason:
        "Outstanding party name is missing.",
    };
  }

  // ----------------------------------------------------------
  // FIND BUSINESS PARTY
  // ----------------------------------------------------------

  let customer = null;
  let distributor = null;

  if (partyType === "customer") {
    customer =
      await findCustomer(
        partyName,
        tallyPartyName
      );

    if (!customer) {
      return {
        status: "skipped",
        reason:
          `Customer not found: ${partyName}`,
      };
    }
  } else {
    distributor =
      await findDistributor(
        partyName,
        tallyPartyName
      );

    if (!distributor) {
      return {
        status: "skipped",
        reason:
          `Distributor not found: ${partyName}`,
      };
    }
  }

  // ----------------------------------------------------------
  // PARTY KEY
  // ----------------------------------------------------------

  const partyKey = makePartyKey(
    partyType,
    customer?.companyName ||
      distributor?.companyName ||
      partyName
  );

  // ----------------------------------------------------------
  // BILLS
  // ----------------------------------------------------------

  const bills = Array.isArray(
    summary?.bills
  )
    ? summary.bills
        .map(normalizeBill)
        .filter(
          (bill) =>
            bill.billRef ||
            bill.pendingAmount > 0
        )
    : [];

  const ledgerVouchers = Array.isArray(
    summary?.ledgerVouchers
  )
    ? summary.ledgerVouchers
        .map(normalizeLedgerVoucher)
        .filter(
          (voucher) =>
            voucher.voucherDate ||
            voucher.voucherType ||
            voucher.voucherNumber ||
            voucher.amount !== 0
        )
    : [];

  // ----------------------------------------------------------
  // DATA
  // ----------------------------------------------------------

  const data = {
    customer:
      partyType === "customer"
        ? customer?._id || null
        : null,

    distributor:
      partyType === "distributor"
        ? distributor?._id || null
        : null,

    partyType,

    partyName:
      customer?.companyName ||
      distributor?.companyName ||
      partyName,

    tallyPartyName,

    partyKey,

    totalPending: Math.max(
      0,
      toNumber(
        summary?.totalPending
      )
    ),

    billCount: Math.max(
      0,
      Math.trunc(
        toNumber(
          summary?.billCount
        )
      )
    ),

    overdueAmount: Math.max(
      0,
      toNumber(
        summary?.overdueAmount
      )
    ),

    overdueBillCount: Math.max(
      0,
      Math.trunc(
        toNumber(
          summary?.overdueBillCount
        )
      )
    ),

    bills,

    ledgerVouchers,

    source: "TallyPrime",

    syncBatchId,

    syncedAt: new Date(),

    fromDate: clean(
      fromDate
    ),

    toDate: clean(
      toDate
    ),
  };

  // ----------------------------------------------------------
  // UPSERT
  // ----------------------------------------------------------

  const existing =
    await TallyOutstanding.findOne({
      partyKey,
    });

  if (!existing) {
    const created =
      await TallyOutstanding.create(
        data
      );

    return {
      status: "created",
      id: created._id,
    };
  }

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
// RESET PARTIES NOT PRESENT IN CURRENT SNAPSHOT
// ============================================================
//
// If a party had an outstanding balance yesterday but has no
// row today, that normally means there are no pending bills
// in the current Bills Receivable/Payable snapshot.
//
// We therefore reset its current outstanding to zero while
// keeping the document itself for stable history/querying.
//

async function resetMissingParties(
  partyType,
  incomingPartyKeys,
  syncBatchId,
  fromDate,
  toDate
) {
  const existing =
    await TallyOutstanding.find({
      partyType,
      source: "TallyPrime",
    });

  let resetCount = 0;

  for (const record of existing) {
    if (
      incomingPartyKeys.has(
        record.partyKey
      )
    ) {
      continue;
    }

    record.totalPending = 0;
    record.billCount = 0;
    record.overdueAmount = 0;
    record.overdueBillCount = 0;
    record.bills = [];
    record.ledgerVouchers = [];
    record.syncBatchId = syncBatchId;
    record.syncedAt = new Date();
    record.fromDate = clean(
      fromDate
    );
    record.toDate = clean(
      toDate
    );

    await record.save();

    resetCount++;
  }

  return resetCount;
}

// ============================================================
// SYNC OUTSTANDING
// ============================================================

const syncTallyOutstanding =
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
      // BODY
      // ------------------------------------------------------

      const body =
        req.body || {};

      const customers =
        Array.isArray(
          body.customers
        )
          ? body.customers
          : [];

      const distributors =
        Array.isArray(
          body.distributors
        )
          ? body.distributors
          : [];

      if (
        customers.length === 0 &&
        distributors.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "No Tally outstanding customer or distributor data received",
        });
      }

      const fromDate = clean(
        body.syncRange?.fromDate
      );

      const toDate = clean(
        body.syncRange?.toDate
      );

      // ------------------------------------------------------
      // COMPLETE SNAPSHOT SAFETY GUARD
      // ------------------------------------------------------
      //
      // The live Tally worker is expected to send exactly:
      //   33 confirmed customers
      //   15 confirmed distributors
      //
      // A partial snapshot must NEVER reach the update/reset
      // logic because resetMissingParties() would otherwise
      // interpret missing parties as zero outstanding.
      // ------------------------------------------------------

      if (
        body.snapshotComplete !== true
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Outstanding snapshot rejected: snapshotComplete must be true.",
        });
      }

      if (
        customers.length !== 33 ||
        distributors.length !== 15
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Outstanding snapshot rejected: expected 33 customers + 15 distributors, received ${customers.length} customers + ${distributors.length} distributors.`,
        });
      }

      // ------------------------------------------------------
      // PRE-VALIDATE ALL BUSINESS PARTIES
      // ------------------------------------------------------
      //
      // Do this BEFORE writing anything.
      // If even one incoming party does not exist in the app,
      // reject the entire snapshot before any outstanding
      // record is updated or reset.
      // ------------------------------------------------------

      const missingCustomers = [];

      for (const summary of customers) {
        const partyName = clean(
          summary?.partyName
        );

        const tallyName = clean(
          summary?.tallyName
        );

        const customer =
          await findCustomer(
            partyName,
            tallyName
          );

        if (!customer) {
          missingCustomers.push(
            partyName || tallyName || "UNKNOWN"
          );
        }
      }

      const missingDistributors = [];

      for (const summary of distributors) {
        const partyName = clean(
          summary?.partyName
        );

        const tallyName = clean(
          summary?.tallyName
        );

        const distributor =
          await findDistributor(
            partyName,
            tallyName
          );

        if (!distributor) {
          missingDistributors.push(
            partyName || tallyName || "UNKNOWN"
          );
        }
      }

      if (
        missingCustomers.length > 0 ||
        missingDistributors.length > 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Outstanding snapshot rejected: one or more Tally parties are not present in the application.",
          missingCustomers,
          missingDistributors,
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

      const customerKeys =
        new Set();

      const distributorKeys =
        new Set();

      // ------------------------------------------------------
      // CUSTOMERS
      // ------------------------------------------------------

      for (const summary of customers) {
        try {
          const result =
            await upsertOutstandingParty({
              summary,
              partyType: "customer",
              syncBatchId,
              fromDate,
              toDate,
            });

          if (
            result.status ===
            "created"
          ) {
            created++;

            const key =
              makePartyKey(
                "customer",
                summary.partyName
              );

            customerKeys.add(key);
          } else if (
            result.status ===
            "updated"
          ) {
            updated++;

            const key =
              makePartyKey(
                "customer",
                summary.partyName
              );

            customerKeys.add(key);
          } else {
            skipped++;

            errors.push({
              partyType:
                "customer",

              party:
                summary.partyName ||
                "",

              reason:
                result.reason,
            });
          }
        } catch (error) {
          skipped++;

          errors.push({
            partyType: "customer",

            party:
              summary.partyName ||
              "",

            reason:
              error.message,
          });
        }
      }

      // ------------------------------------------------------
      // DISTRIBUTORS
      // ------------------------------------------------------

      for (const summary of distributors) {
        try {
          const result =
            await upsertOutstandingParty({
              summary,
              partyType: "distributor",
              syncBatchId,
              fromDate,
              toDate,
            });

          if (
            result.status ===
            "created"
          ) {
            created++;

            const key =
              makePartyKey(
                "distributor",
                summary.partyName
              );

            distributorKeys.add(key);
          } else if (
            result.status ===
            "updated"
          ) {
            updated++;

            const key =
              makePartyKey(
                "distributor",
                summary.partyName
              );

            distributorKeys.add(key);
          } else {
            skipped++;

            errors.push({
              partyType:
                "distributor",

              party:
                summary.partyName ||
                "",

              reason:
                result.reason,
            });
          }
        } catch (error) {
          skipped++;

          errors.push({
            partyType:
              "distributor",

            party:
              summary.partyName ||
              "",

            reason:
              error.message,
          });
        }
      }

      // ------------------------------------------------------
      // RESET NO-LONGER-PENDING PARTIES
      // ------------------------------------------------------

      const resetCustomers =
        await resetMissingParties(
          "customer",
          customerKeys,
          syncBatchId,
          fromDate,
          toDate
        );

      const resetDistributors =
        await resetMissingParties(
          "distributor",
          distributorKeys,
          syncBatchId,
          fromDate,
          toDate
        );

      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          "Tally outstanding data synchronized successfully",

        syncBatchId,

        syncedAt:
          new Date().toISOString(),

        summary: {
          received:
            customers.length +
            distributors.length,

          created,

          updated,

          skipped,

          customerParties:
            customers.length,

          distributorParties:
            distributors.length,

          resetCustomers,

          resetDistributors,
        },

        skippedOutstanding:
          errors,
      });
    } catch (error) {
      console.error(
        "Tally outstanding sync error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to synchronize Tally outstanding data",

        error: error.message,
      });
    }
  };

// ============================================================
// GET CUSTOMER OUTSTANDING
// ============================================================

const getCustomerTallyOutstanding =
  async (req, res) => {
    try {
      const outstanding =
        await TallyOutstanding.findOne({
          customer:
            req.params.customerId,

          partyType: "customer",
        }).populate(
          "customer",
          "companyName"
        );

      if (!outstanding) {
        return res.status(200).json({
          success: true,

          outstanding: {
            totalPending: 0,
            billCount: 0,
            overdueAmount: 0,
            overdueBillCount: 0,
            bills: [],
          },
        });
      }

      return res.status(200).json({
        success: true,
        outstanding,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,

        message:
          "Failed to get customer Tally outstanding",

        error: error.message,
      });
    }
  };

// ============================================================
// GET DISTRIBUTOR OUTSTANDING
// ============================================================

const getDistributorTallyOutstanding =
  async (req, res) => {
    try {
      const outstanding =
        await TallyOutstanding.findOne({
          distributor:
            req.params.distributorId,

          partyType: "distributor",
        }).populate(
          "distributor",
          "companyName"
        );

      if (!outstanding) {
        return res.status(200).json({
          success: true,

          outstanding: {
            totalPending: 0,
            billCount: 0,
            overdueAmount: 0,
            overdueBillCount: 0,
            bills: [],
          },
        });
      }

      return res.status(200).json({
        success: true,
        outstanding,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,

        message:
          "Failed to get distributor Tally outstanding",

        error: error.message,
      });
    }
  };

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  syncTallyOutstanding,
  getCustomerTallyOutstanding,
  getDistributorTallyOutstanding,
};

