const Customer = require("../models/customer");
const Distributor = require("../models/distributor");
const { syncTallyRelationships } = require("../services/tallyRelationshipSyncService");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");

// ============================================================
// COMMON HELPERS
// ============================================================

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeRegex(value) {
  return String(value || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function parseTallyDate(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();

  if (!/^\d{8}$/.test(text)) {
    return null;
  }

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6));
  const day = Number(text.slice(6, 8));

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// ============================================================
// TALLY SYNC SECRET
// ============================================================

function checkSyncSecret(req, res) {
  const expectedSecret =
    process.env.TALLY_SYNC_SECRET ||
    "eminent_tally_sync_2026_change_this_later";

  const receivedSecret =
    req.headers["x-tally-sync-secret"];

  if (
    !receivedSecret ||
    receivedSecret !== expectedSecret
  ) {
    res.status(401).json({
      success: false,
      message: "Unauthorized Tally sync request",
    });

    return false;
  }

  return true;
}

// ============================================================
// TEST TALLY SYNC
// ============================================================

async function testTallySync(req, res) {
  if (!checkSyncSecret(req, res)) {
    return;
  }

  try {
    res.status(200).json({
      success: true,
      message: "Tally sync connection is working",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Tally test sync error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// ============================================================
// LEGACY GENERIC TALLY SYNC
// ============================================================

async function syncTallyData(req, res) {
  if (!checkSyncSecret(req, res)) {
    return;
  }

  try {
    const data = req.body || {};

    const customers =
      Array.isArray(data.customers)
        ? data.customers
        : [];

    const distributors =
      Array.isArray(data.distributors)
        ? data.distributors
        : [];

    const invoices =
      Array.isArray(data.invoices)
        ? data.invoices
        : [];

    let customerCreated = 0;
    let customerUpdated = 0;

    let distributorCreated = 0;
    let distributorUpdated = 0;

    let invoiceCreated = 0;
    let invoiceUpdated = 0;

    // ----------------------------------------------------------
    // CUSTOMERS
    // ----------------------------------------------------------

    for (const customerData of customers) {
      const companyName =
        customerData.companyName ||
        customerData.name ||
        customerData.tallyName;

      if (!companyName) {
        continue;
      }

      const normalized =
        normalizeName(companyName);

      let customer =
        await Customer.findOne({
          $or: [
            {
              tallySyncKey:
                customerData.tallySyncKey || "",
            },
            {
              companyName: {
                $regex:
                  `^${escapeRegex(
                    companyName
                  )}$`,
                $options: "i",
              },
            },
          ],
        });

      if (customer) {
        Object.assign(
          customer,
          customerData
        );

        customer.companyName =
          companyName;

        customer.normalizedName =
          normalized;

        await customer.save();

        customerUpdated++;
      } else {
        customer =
          await Customer.create({
            ...customerData,
            companyName,
            normalizedName:
              normalized,
            source:
              customerData.source ||
              "TallyPrime",
          });

        customerCreated++;
      }
    }

    // ----------------------------------------------------------
    // DISTRIBUTORS
    // ----------------------------------------------------------

    for (const distributorData of distributors) {
      const companyName =
        distributorData.companyName ||
        distributorData.name ||
        distributorData.tallyName;

      if (!companyName) {
        continue;
      }

      const normalized =
        normalizeName(companyName);

      let distributor =
        await Distributor.findOne({
          $or: [
            {
              tallySyncKey:
                distributorData.tallySyncKey ||
                "",
            },
            {
              companyName: {
                $regex:
                  `^${escapeRegex(
                    companyName
                  )}$`,
                $options: "i",
              },
            },
          ],
        });

      if (distributor) {
        Object.assign(
          distributor,
          distributorData
        );

        distributor.companyName =
          companyName;

        distributor.normalizedName =
          normalized;

        await distributor.save();

        distributorUpdated++;
      } else {
        distributor =
          await Distributor.create({
            ...distributorData,
            companyName,
            normalizedName:
              normalized,
            source:
              distributorData.source ||
              "TallyPrime",
          });

        distributorCreated++;
      }
    }

    // ----------------------------------------------------------
    // INVOICES
    // ----------------------------------------------------------

    for (const invoiceData of invoices) {
      if (!invoiceData) {
        continue;
      }

      const invoiceNumber =
        invoiceData.invoiceNumber ||
        invoiceData.number ||
        invoiceData.tallyVoucherKey;

      if (!invoiceNumber) {
        continue;
      }

      let invoice =
        await Invoice.findOne({
          $or: [
            {
              tallyVoucherKey:
                invoiceData.tallyVoucherKey ||
                "",
            },
            {
              invoiceNumber:
                invoiceNumber,
            },
          ],
        });

      if (invoice) {
        Object.assign(
          invoice,
          invoiceData
        );

        await invoice.save();

        invoiceUpdated++;
      } else {
        await Invoice.create({
          ...invoiceData,
          invoiceNumber,
          source:
            invoiceData.source ||
            "TallyPrime",
        });

        invoiceCreated++;
      }
    }

    res.status(200).json({
      success: true,
      message:
        "Tally data synchronized successfully",

      summary: {
        customers: {
          created: customerCreated,
          updated: customerUpdated,
        },

        distributors: {
          created: distributorCreated,
          updated: distributorUpdated,
        },

        invoices: {
          created: invoiceCreated,
          updated: invoiceUpdated,
        },
      },
    });
  } catch (error) {
    console.error(
      "Tally data sync error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// ============================================================
// PARTY LOOKUP FOR PAYMENTS
// ============================================================

async function findCustomerForPayment(
  partyName,
  transaction
) {
  const normalized =
    normalizeName(partyName);

  if (!normalized) {
    return null;
  }

  // First try Tally sync key.
  if (transaction?.tallySyncKey) {
    const bySyncKey =
      await Customer.findOne({
        tallySyncKey:
          transaction.tallySyncKey,
      });

    if (bySyncKey) {
      return bySyncKey;
    }
  }

  // Then exact case-insensitive company name.
  const customer =
    await Customer.findOne({
      companyName: {
        $regex:
          `^${escapeRegex(
            partyName
          )}$`,
        $options: "i",
      },
    });

  if (customer) {
    return customer;
  }

  // Finally normalized-name lookup.
  const candidates =
    await Customer.find({});

  return (
    candidates.find(
      (item) =>
        normalizeName(
          item.companyName
        ) === normalized
    ) || null
  );
}

async function findDistributorForPayment(
  partyName,
  transaction
) {
  const normalized =
    normalizeName(partyName);

  if (!normalized) {
    return null;
  }

  if (transaction?.tallySyncKey) {
    const bySyncKey =
      await Distributor.findOne({
        tallySyncKey:
          transaction.tallySyncKey,
      });

    if (bySyncKey) {
      return bySyncKey;
    }
  }

  const distributor =
    await Distributor.findOne({
      companyName: {
        $regex:
          `^${escapeRegex(
            partyName
          )}$`,
        $options: "i",
      },
    });

  if (distributor) {
    return distributor;
  }

  const candidates =
    await Distributor.find({});

  return (
    candidates.find(
      (item) =>
        normalizeName(
          item.companyName
        ) === normalized
    ) || null
  );
}

// ============================================================
// TALLY STABLE VOUCHER IDENTITY
// ============================================================

function getTallyStableIdentity(
  transaction
) {
  if (transaction?.tallyGuid) {
    return {
      field: "tallyGuid",
      value: String(
        transaction.tallyGuid
      ).trim(),
    };
  }

  if (transaction?.tallyVchKey) {
    return {
      field: "tallyVchKey",
      value: String(
        transaction.tallyVchKey
      ).trim(),
    };
  }

  if (transaction?.tallyRemoteId) {
    return {
      field: "tallyRemoteId",
      value: String(
        transaction.tallyRemoteId
      ).trim(),
    };
  }

  if (transaction?.tallyVoucherRetainKey) {
    return {
      field:
        "tallyVoucherRetainKey",
      value: String(
        transaction.tallyVoucherRetainKey
      ).trim(),
    };
  }

  if (transaction?.tallyVoucherKey) {
    return {
      field: "tallyVoucherKey",
      value: String(
        transaction.tallyVoucherKey
      ).trim(),
    };
  }

  return null;
}

// ============================================================
// LEGACY FALLBACK IDENTITY
// ============================================================

function createLegacyTallyVoucherKey(
  transaction
) {
  return [
    transaction?.voucherType || "",
    transaction?.date || "",
    transaction?.voucherNumber || "",
    normalizeName(
      transaction?.party || ""
    ),
  ].join("|");
}

// ============================================================
// CURRENT TALLY VOUCHER KEY
// ============================================================

function createTallyVoucherKey(
  transaction
) {
  const stable =
    getTallyStableIdentity(
      transaction
    );

  if (stable?.value) {
    return `${stable.field}:${stable.value}`;
  }

  return createLegacyTallyVoucherKey(
    transaction
  );
}

// ============================================================
// PAYMENT SYNC
// ============================================================

async function syncTallyPayments(
  req,
  res
) {
  if (!checkSyncSecret(req, res)) {
    return;
  }

  try {
    const data = req.body || {};

    const transactions =
      data.transactions || {};

    const customerReceipts =
      Array.isArray(
        transactions.customerReceipts
      )
        ? transactions.customerReceipts
        : [];

    const distributorPayments =
      Array.isArray(
        transactions.distributorPayments
      )
        ? transactions.distributorPayments
        : [];

    const customerPayments =
      Array.isArray(
        transactions.customerPayments
      )
        ? transactions.customerPayments
        : [];

    const distributorReceipts =
      Array.isArray(
        transactions.distributorReceipts
      )
        ? transactions.distributorReceipts
        : [];

    const allTransactions = [
      ...customerReceipts.map(
        (item) => ({
          ...item,
          paymentType:
            "customer_receipt",
        })
      ),

      ...distributorPayments.map(
        (item) => ({
          ...item,
          paymentType:
            "distributor_payment",
        })
      ),

      ...customerPayments.map(
        (item) => ({
          ...item,
          paymentType:
            "customer_payment",
        })
      ),

      ...distributorReceipts.map(
        (item) => ({
          ...item,
          paymentType:
            "distributor_receipt",
        })
      ),
    ];

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let duplicateCount = 0;
    let skippedCount = 0;

    let customerTransactionCount = 0;
    let distributorTransactionCount = 0;

    // ----------------------------------------------------------
    // PROCESS EACH TALLY TRANSACTION
    // ----------------------------------------------------------

    for (const transaction of allTransactions) {
      const partyName =
        String(
          transaction.party || ""
        ).trim();

      const voucherType =
        String(
          transaction.voucherType ||
            ""
        ).trim();

      const voucherNumber =
        String(
          transaction.voucherNumber ||
            ""
        ).trim();

      const date =
        parseTallyDate(
          transaction.date
        );

      const amount =
        Math.abs(
          Number(
            transaction.amount || 0
          )
        );

      if (
        !partyName ||
        !date ||
        !voucherType ||
        !Number.isFinite(amount)
      ) {
        skippedCount++;
        continue;
      }

      // --------------------------------------------------------
      // DETERMINE STABLE IDENTITY
      // --------------------------------------------------------

      const stableIdentity =
        getTallyStableIdentity(
          transaction
        );

      const currentVoucherKey =
        createTallyVoucherKey(
          transaction
        );

      const legacyVoucherKey =
        createLegacyTallyVoucherKey(
          transaction
        );

      // --------------------------------------------------------
      // FIND EXISTING PAYMENT
      // --------------------------------------------------------

      let existingPayment = null;

      // 1. Stable identity first.
      if (
        stableIdentity?.field &&
        stableIdentity?.value
      ) {
        existingPayment =
          await Payment.findOne({
            [stableIdentity.field]:
              stableIdentity.value,
          });
      }

      // 2. Voucher retain key.
      if (
        !existingPayment &&
        transaction.tallyVoucherRetainKey
      ) {
        existingPayment =
          await Payment.findOne({
            tallyVoucherRetainKey:
              String(
                transaction.tallyVoucherRetainKey
              ).trim(),
          });
      }

      // 3. Current voucher key.
      if (!existingPayment) {
        existingPayment =
          await Payment.findOne({
            tallyVoucherKey:
              currentVoucherKey,
          });
      }

      // 4. Legacy fallback key.
      //
      // This is important for older records which were
      // originally saved before stable Tally identity existed.
      if (
        !existingPayment &&
        legacyVoucherKey !==
          currentVoucherKey
      ) {
        existingPayment =
          await Payment.findOne({
            tallyVoucherKey:
              legacyVoucherKey,
          });
      }

      // --------------------------------------------------------
      // FIND PARTY
      // --------------------------------------------------------

      let customer = null;
      let distributor = null;

      if (
        transaction.paymentType ===
          "customer_receipt" ||
        transaction.paymentType ===
          "customer_payment"
      ) {
        customer =
          await findCustomerForPayment(
            partyName,
            transaction
          );

        if (!customer) {
          skippedCount++;
          continue;
        }

        customerTransactionCount++;
      }

      if (
        transaction.paymentType ===
          "distributor_payment" ||
        transaction.paymentType ===
          "distributor_receipt"
      ) {
        distributor =
          await findDistributorForPayment(
            partyName,
            transaction
          );

        if (!distributor) {
          skippedCount++;
          continue;
        }

        distributorTransactionCount++;
      }

      // --------------------------------------------------------
      // BILL ALLOCATIONS
      // --------------------------------------------------------

      const billAllocations =
        Array.isArray(
          transaction.billAllocations
        )
          ? transaction.billAllocations.map(
              (item) => ({
                name:
                  item?.name || "",
                billType:
                  item?.billType || "",
                amount:
                  Number(
                    item?.amount || 0
                  ),
                rawReference:
                  item?.rawReference ||
                  "",
              })
            )
          : [];

      // --------------------------------------------------------
      // BANK / OTHER LEDGERS
      // --------------------------------------------------------

      const bankOrOtherLedgers =
        Array.isArray(
          transaction.bankOrOtherLedgers
        )
          ? transaction.bankOrOtherLedgers.map(
              (item) => ({
                name:
                  item?.name || "",
                amount:
                  Number(
                    item?.amount || 0
                  ),
              })
            )
          : [];

      // --------------------------------------------------------
      // STABLE IDENTITY FIELDS
      // --------------------------------------------------------

      const tallyGuid =
        String(
          transaction.tallyGuid || ""
        ).trim();

      const tallyVchKey =
        String(
          transaction.tallyVchKey || ""
        ).trim();

      const tallyRemoteId =
        String(
          transaction.tallyRemoteId || ""
        ).trim();

      const tallyVoucherRetainKey =
        String(
          transaction.tallyVoucherRetainKey ||
            ""
        ).trim();

      const tallyVoucherIdentity =
        stableIdentity
          ? currentVoucherKey
          : "";

      const tallyVoucherIdentityType =
        stableIdentity
          ? stableIdentity.field ===
            "tallyGuid"
            ? "GUID"
            : stableIdentity.field ===
              "tallyVchKey"
            ? "VCHKEY"
            : stableIdentity.field ===
              "tallyRemoteId"
            ? "REMOTEID"
            : stableIdentity.field ===
              "tallyVoucherRetainKey"
            ? "VOUCHERRETAINKEY"
            : "VOUCHERKEY"
          : "FALLBACK";

      // --------------------------------------------------------
      // PAYMENT DATA
      // --------------------------------------------------------
      //
      // IMPORTANT:
      // We intentionally DO NOT set:
      //
      // invoice
      // invoiceLinkedAutomatically
      //
      // when updating an existing payment.
      //
      // This prevents a live Tally sync from accidentally
      // removing an invoice relationship already created
      // inside Eminent Tracking.
      //

      const paymentData = {
        customer:
          customer?._id || null,

        distributor:
          distributor?._id || null,

        partyType:
          customer
            ? "customer"
            : "distributor",

        partyName,

        tallyPartyName:
          transaction.tallyPartyName ||
          partyName,

        tallyAlterId:
          String(
            transaction.alterId || ""
          ).trim(),

        tallyMasterId:
          String(
            transaction.masterId || ""
          ).trim(),

        tallySyncKey:
          transaction.tallySyncKey ||
          customer?.tallySyncKey ||
          distributor?.tallySyncKey ||
          "",

        tallyVoucherIdentity,

        tallyVoucherIdentityType,

        tallyGuid,

        tallyVchKey,

        tallyRemoteId,

        tallyVoucherKey:
          currentVoucherKey,

        tallyVoucherRetainKey,

        voucherStatus:
          String(
            transaction.voucherStatus ||
              ""
          ).trim(),

        isCancelled:
          Boolean(
            transaction.isCancelled
          ),

        paymentType:
          transaction.paymentType,

        voucherType,

        voucherNumber,

        paymentDate: date,

        amount,

        tallyReference:
          String(
            transaction.reference ||
              transaction.ref ||
              ""
          ).trim(),

        tallyNarration:
          String(
            transaction.narration ||
              ""
          ).trim(),

        billAllocations,

        bankOrOtherLedgers,

        source:
          transaction.source ||
          "TallyPrime",

        syncBatchId:
          data.syncBatchId ||
          "",

        syncedAt:
          new Date(),
      };

      // --------------------------------------------------------
      // CREATE OR UPDATE
      // --------------------------------------------------------

      if (existingPayment) {
        // Keep existing invoice relationship untouched.
        const oldInvoice =
          existingPayment.invoice;

        const oldInvoiceLinkedAutomatically =
          existingPayment.invoiceLinkedAutomatically;

        // Remember old values so we can identify whether
        // the meaningful Tally data actually changed.
        const oldMeaningfulData =
          JSON.stringify({
            customer:
              String(
                existingPayment.customer ||
                  ""
              ),

            distributor:
              String(
                existingPayment.distributor ||
                  ""
              ),

            partyType:
              existingPayment.partyType,

            partyName:
              existingPayment.partyName,

            tallyPartyName:
              existingPayment.tallyPartyName,

            tallyAlterId:
              existingPayment.tallyAlterId,

            tallyMasterId:
              existingPayment.tallyMasterId,

            tallySyncKey:
              existingPayment.tallySyncKey,

            tallyVoucherIdentity:
              existingPayment.tallyVoucherIdentity,

            tallyVoucherIdentityType:
              existingPayment.tallyVoucherIdentityType,

            tallyGuid:
              existingPayment.tallyGuid,

            tallyVchKey:
              existingPayment.tallyVchKey,

            tallyRemoteId:
              existingPayment.tallyRemoteId,

            tallyVoucherKey:
              existingPayment.tallyVoucherKey,

            tallyVoucherRetainKey:
              existingPayment.tallyVoucherRetainKey,

            voucherStatus:
              existingPayment.voucherStatus,

            isCancelled:
              existingPayment.isCancelled,

            paymentType:
              existingPayment.paymentType,

            voucherType:
              existingPayment.voucherType,

            voucherNumber:
              existingPayment.voucherNumber,

            paymentDate:
              existingPayment.paymentDate,

            amount:
              existingPayment.amount,

            tallyReference:
              existingPayment.tallyReference,

            tallyNarration:
              existingPayment.tallyNarration,

            billAllocations:
              existingPayment.billAllocations,

            bankOrOtherLedgers:
              existingPayment.bankOrOtherLedgers,
          });

        const newMeaningfulData =
          JSON.stringify({
            customer:
              String(
                paymentData.customer ||
                  ""
              ),

            distributor:
              String(
                paymentData.distributor ||
                  ""
              ),

            partyType:
              paymentData.partyType,

            partyName:
              paymentData.partyName,

            tallyPartyName:
              paymentData.tallyPartyName,

            tallyAlterId:
              paymentData.tallyAlterId,

            tallyMasterId:
              paymentData.tallyMasterId,

            tallySyncKey:
              paymentData.tallySyncKey,

            tallyVoucherIdentity:
              paymentData.tallyVoucherIdentity,

            tallyVoucherIdentityType:
              paymentData.tallyVoucherIdentityType,

            tallyGuid:
              paymentData.tallyGuid,

            tallyVchKey:
              paymentData.tallyVchKey,

            tallyRemoteId:
              paymentData.tallyRemoteId,

            tallyVoucherKey:
              paymentData.tallyVoucherKey,

            tallyVoucherRetainKey:
              paymentData.tallyVoucherRetainKey,

            voucherStatus:
              paymentData.voucherStatus,

            isCancelled:
              paymentData.isCancelled,

            paymentType:
              paymentData.paymentType,

            voucherType:
              paymentData.voucherType,

            voucherNumber:
              paymentData.voucherNumber,

            paymentDate:
              paymentData.paymentDate,

            amount:
              paymentData.amount,

            tallyReference:
              paymentData.tallyReference,

            tallyNarration:
              paymentData.tallyNarration,

            billAllocations:
              paymentData.billAllocations,

            bankOrOtherLedgers:
              paymentData.bankOrOtherLedgers,
          });

        Object.assign(
          existingPayment,
          paymentData
        );

        // NEVER overwrite these during Tally sync.
        existingPayment.invoice =
          oldInvoice;

        existingPayment.invoiceLinkedAutomatically =
          oldInvoiceLinkedAutomatically;

        if (
          oldMeaningfulData ===
          newMeaningfulData
        ) {
          unchangedCount++;
        } else {
          updatedCount++;
        }

        duplicateCount++;

        await existingPayment.save();

        continue;
      }

      // --------------------------------------------------------
      // CREATE NEW PAYMENT
      // --------------------------------------------------------

      await Payment.create({
        ...paymentData,

        invoice: null,

        invoiceLinkedAutomatically:
          false,
      });

      createdCount++;
    }

    // ----------------------------------------------------------
    // RELATIONSHIP LINKING
    // ----------------------------------------------------------

    let relationshipSync = null;
    try {
      relationshipSync = await syncTallyRelationships();
    } catch (relationshipError) {
      console.error(
        "Tally relationship sync warning:",
        relationshipError
      );
    }

    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

    res.status(200).json({
      success: true,

      message:
        "Tally payment data synchronized successfully",

      syncedAt:
        new Date().toISOString(),

      summary: {
        received:
          allTransactions.length,

        created:
          createdCount,

        updated:
          updatedCount,

        unchanged:
          unchangedCount,

        duplicates:
          duplicateCount,

        skipped:
          skippedCount,

        customerTransactions:
          customerTransactionCount,

        distributorTransactions:
          distributorTransactionCount,

        relationshipSync,
      },
    });
  } catch (error) {
    console.error(
      "Tally payment sync error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
      stack:
        process.env.NODE_ENV ===
        "development"
          ? error.stack
          : undefined,
    });
  }
}

// ============================================================
 // ============================================================
 // TALLY PAYMENT GET
 // ============================================================

 async function getTallyPayments(req, res) {
   try {
    console.log("TALLY PAYMENT DEBUG QUERY:", req.query);
    console.log("TALLY PAYMENT DEBUG PARAMS:", req.params);
     const Payment = require("../models/payment");

     const filter = {};

     if (req.params.customerId || req.query.customerId) {
       filter.customer = req.params.customerId || req.query.customerId;
       filter.partyType = "customer";
     }

     if (req.params.distributorId || req.query.distributorId) {
       filter.distributor = req.params.distributorId || req.query.distributorId;
       filter.partyType = "distributor";
     }

     const payments = await Payment.find(filter)
       .populate("customer", "companyName")
       .populate("distributor", "companyName")
       .populate("invoice", "invoiceNumber invoiceDate amount status")
       .sort({ paymentDate: -1, createdAt: -1 })
       .lean();

     return res.status(200).json({
       success: true,
       count: payments.length,
       payments,
     });
   } catch (error) {
     console.error("Error fetching Tally payments:", error);

     return res.status(500).json({
       success: false,
       message: error.message,
     });
   }
 }
// ============================================================
// MANUALLY CONFIRM TALLY PAYMENT FOR INVOICE
// ============================================================

async function confirmTallyPaymentForInvoice(req, res) {
  try {
    const { paymentId, invoiceId } = req.body || {};

    if (!paymentId || !invoiceId) {
      return res.status(400).json({
        success: false,
        message: "paymentId and invoiceId are required",
      });
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Tally payment not found",
      });
    }

    if (payment.source !== "TallyPrime") {
      return res.status(409).json({
        success: false,
        message: "Only TallyPrime payments can be manually confirmed here",
      });
    }

    if (payment.isCancelled === true) {
      return res.status(409).json({
        success: false,
        message: "Cancelled Tally payments cannot be confirmed",
      });
    }

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    if (invoice.status === "cancelled") {
      return res.status(409).json({
        success: false,
        message: "Cancelled invoices cannot receive a payment confirmation",
      });
    }

    const paymentPartyId =
      payment.customer || payment.distributor || null;

    const invoicePartyId =
      invoice.customer || invoice.distributor || null;

    const invoicePartyType =
      invoice.customer
        ? "customer"
        : invoice.distributor
          ? "distributor"
          : "";

    const samePartyType =
      payment.partyType === invoicePartyType;

    const sameParty =
      paymentPartyId &&
      invoicePartyId &&
      String(paymentPartyId) === String(invoicePartyId);

    if (!samePartyType || !sameParty) {
      return res.status(409).json({
        success: false,
        message: "Payment and invoice must belong to the same party",
      });
    }

    if (
      payment.invoice &&
      String(payment.invoice) !== String(invoice._id)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This Tally payment is already linked to a different invoice",
      });
    }

    // Safe/idempotent manual confirmation.
    payment.invoice = invoice._id;
    payment.invoiceLinkedAutomatically = false;
    payment.manuallyConfirmedForInvoice = true;
    payment.manuallyConfirmedAt =
      payment.manuallyConfirmedAt || new Date();
    payment.relationshipLinkReason =
      "Manually confirmed for invoice";

    await payment.save();

    // Recalculate the invoice from every active Tally payment
    // currently linked to this invoice.
    const linkedPayments = await Payment.find({
      invoice: invoice._id,
      isCancelled: false,
    }).lean();

    const tallyPaymentAmount = linkedPayments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    );

    const invoiceAmount = Number(invoice.amount || 0);

    invoice.tallyPaymentAmount = tallyPaymentAmount;
    invoice.tallyPaymentUpdatedAt = new Date();

    if (tallyPaymentAmount <= 0) {
      invoice.tallyPaymentStatus = "unpaid";
    } else if (
      invoiceAmount > 0 &&
      tallyPaymentAmount >= invoiceAmount
    ) {
      invoice.tallyPaymentStatus = "paid";
    } else {
      invoice.tallyPaymentStatus = "partial";
    }

    // The money is still Tally-sourced. Only the invoice relationship
    // was confirmed manually. Keeping the source as "tally" allows
    // future Tally syncs to continue recalculating this invoice.
    if (
      invoiceAmount > 0 &&
      tallyPaymentAmount >= invoiceAmount &&
      invoice.paymentStatusSource !== "manual"
    ) {
      invoice.status = "paid";

      const latest = linkedPayments.reduce((a, b) =>
        new Date(a.paymentDate || 0) >
        new Date(b.paymentDate || 0)
          ? a
          : b
      );

      if (latest.paymentDate) {
        invoice.paymentDate = latest.paymentDate;
      }

      invoice.paymentStatusSource = "tally";
    }

    await invoice.save();

    const populatedPayment = await Payment.findById(payment._id)
      .populate("customer", "companyName")
      .populate("distributor", "companyName")
      .populate(
        "invoice",
        "invoiceNumber invoiceDate amount status"
      )
      .lean();

    return res.status(200).json({
      success: true,
      message: "Tally payment manually confirmed for invoice",
      payment: populatedPayment,
      invoice,
    });
  } catch (error) {
    console.error(
      "Error manually confirming Tally payment:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
// EXPORTS
// ============================================================

module.exports = {
  testTallySync,
  syncTallyData,
  syncTallyPayments,
  getTallyPayments,
  confirmTallyPaymentForInvoice,
};





