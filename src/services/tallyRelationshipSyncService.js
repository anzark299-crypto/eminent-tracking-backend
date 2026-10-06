const TallyTransaction = require("../models/tallyTransaction");
const Payment = require("../models/payment");
const Invoice = require("../models/invoice");
const PurchaseOrder = require("../models/purchaseOrder");
const CustomerService = require("../models/customerService");
const DistributorService = require("../models/distributorService");
const Service = require("../models/service");
const TallyOutstanding = require("../models/tallyOutstanding");

function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokens(value) {
  return clean(value)
    .split(/[^a-zA-Z0-9]+/)
    .map((x) => normalize(x))
    .filter(Boolean);
}

function containsReference(haystack, needle) {
  const h = normalize(haystack);
  const n = normalize(needle);
  return Boolean(h && n && (h === n || h.includes(n)));
}

function collectText(transaction) {
  const values = [
    transaction.reference,
    transaction.narration,
    transaction.voucherNumber,
    transaction.tallyVoucherKey,
    transaction.tallyVchKey,
  ];

  for (const item of transaction.inventoryEntries || []) {
    values.push(item.orderNumber, item.trackingNumber, item.description, item.stockItemName);
  }

  return values.filter(Boolean).join(" | ");
}

async function findInvoiceForTransaction(transaction) {
  const partyField = transaction.customer ? "customer" : "distributor";
  const partyId = transaction.customer || transaction.distributor;

  if (!partyId) {
    return {
      status: "unlinked",
      reason: "No application party reference"
    };
  }

  const invoices = await Invoice.find({
    [partyField]: partyId
  }).select(
    "_id invoiceNumber invoiceDate amount purchaseOrder customerService distributorService tallyVoucherIdentity tallyReference"
  );

  if (!invoices.length) {
    return {
      status: "unlinked",
      reason: "No application invoice exists for this party"
    };
  }

  // PRIMARY MATCH:
  // The Tally voucher identity is the strongest relationship key.
  // We verified that every current Tally transaction has exactly one
  // invoice with the same tallyVoucherIdentity.
  if (transaction.tallyVoucherIdentity) {
    const identityMatches = invoices.filter(
      (invoice) =>
        invoice.tallyVoucherIdentity &&
        String(invoice.tallyVoucherIdentity) ===
          String(transaction.tallyVoucherIdentity)
    );

    if (identityMatches.length === 1) {
      return {
        status: "linked",
        invoice: identityMatches[0],
        reason: "Exact Tally voucher identity matched"
      };
    }

    if (identityMatches.length > 1) {
      return {
        status: "ambiguous",
        reason: "Multiple invoices share the same Tally voucher identity"
      };
    }
  }

  // SECONDARY MATCH:
  // Exact Tally reference match. This is stronger than searching
  // arbitrary text for a short invoice number.
  if (transaction.reference) {
    const transactionReference = normalize(transaction.reference);

    const referenceMatches = invoices.filter(
      (invoice) =>
        invoice.tallyReference &&
        normalize(invoice.tallyReference) === transactionReference
    );

    if (referenceMatches.length === 1) {
      return {
        status: "linked",
        invoice: referenceMatches[0],
        reason: "Exact Tally reference matched"
      };
    }

    if (referenceMatches.length > 1) {
      return {
        status: "ambiguous",
        reason: "Multiple invoices share the same Tally reference"
      };
    }
  }

  // LAST RESORT:
  // Keep the existing invoice-number matching only when deterministic
  // identity/reference matching is unavailable.
  const text = collectText(transaction);
  const exact = invoices.filter((invoice) => {
    const invoiceNumber = clean(invoice.invoiceNumber);

    if (!invoiceNumber) return false;

    // Avoid substring matching for very short invoice numbers because
    // values such as "2", "3", "62" can occur accidentally in dates,
    // amounts, voucher keys, etc.
    if (invoiceNumber.length < 3) return false;

    return containsReference(text, invoiceNumber);
  });

  if (exact.length === 1) {
    return {
      status: "linked",
      invoice: exact[0],
      reason: "Invoice number found in Tally reference/details"
    };
  }

  if (exact.length > 1) {
    return {
      status: "ambiguous",
      reason: "Multiple invoices matched the Tally reference/details"
    };
  }

  return {
    status: "unlinked",
    reason: "No deterministic invoice relationship found"
  };
}

async function findPurchaseOrderForTransaction(transaction, linkedInvoice) {
  if (linkedInvoice?.purchaseOrder) {
    const po = await PurchaseOrder.findById(linkedInvoice.purchaseOrder);
    if (po) return { status: "linked", purchaseOrder: po, reason: "Invoice already references this purchase order" };
  }

  const partyField = transaction.customer ? "customer" : "distributor";
  const partyId = transaction.customer || transaction.distributor;
  if (!partyId) return { status: "unlinked", reason: "No application party reference" };

  const pos = await PurchaseOrder.find({ [partyField]: partyId }).select(
    "_id poNumber ourPoNumber poDate amount customerService distributorService"
  );
  if (!pos.length) return { status: "unlinked", reason: "No application purchase order exists for this party" };

  const text = collectText(transaction);
  const matches = pos.filter((po) =>
    containsReference(text, po.poNumber) || containsReference(text, po.ourPoNumber)
  );

  if (matches.length === 1) return { status: "linked", purchaseOrder: matches[0], reason: "Exact PO number found in Tally reference/details" };
  if (matches.length > 1) return { status: "ambiguous", reason: "Multiple purchase orders matched the Tally reference" };
  return { status: "unlinked", reason: "No exact PO number found in Tally reference/details" };
}

async function linkTransaction(transaction) {
  const invoiceResult = await findInvoiceForTransaction(transaction);
  const poResult = await findPurchaseOrderForTransaction(transaction, invoiceResult.invoice);

  const update = {
    relationshipLinkStatus: "unlinked",
    relationshipLinkReason: "No deterministic application relationship found",
    relationshipLinkedAt: null,
  };

  if (invoiceResult.invoice) {
    update.invoice = invoiceResult.invoice._id;
    if (transaction.customer) update.customerService = invoiceResult.invoice.customerService || null;
    if (transaction.distributor) update.distributorService = invoiceResult.invoice.distributorService || null;
  }

  if (poResult.purchaseOrder) {
    update.purchaseOrder = poResult.purchaseOrder._id;
    if (transaction.customer && !update.customerService) update.customerService = poResult.purchaseOrder.customerService || null;
    if (transaction.distributor && !update.distributorService) update.distributorService = poResult.purchaseOrder.distributorService || null;
  }

  if (invoiceResult.status === "ambiguous" || poResult.status === "ambiguous") {
    update.relationshipLinkStatus = "ambiguous";
    update.relationshipLinkReason = invoiceResult.status === "ambiguous" ? invoiceResult.reason : poResult.reason;
  } else if (update.invoice || update.purchaseOrder || update.customerService || update.distributorService) {
    update.relationshipLinkStatus = "linked";
    update.relationshipLinkReason = [invoiceResult.reason, poResult.reason].filter(Boolean).join("; ");
    update.relationshipLinkedAt = new Date();
  } else {
    update.relationshipLinkReason = [invoiceResult.reason, poResult.reason].filter(Boolean).join("; ");
  }

  await TallyTransaction.updateOne({ _id: transaction._id }, { $set: update });

  if (invoiceResult.invoice && !invoiceResult.invoice.tallyLinkedAutomatically) {
    const invoice = invoiceResult.invoice;
    invoice.tallyVoucherIdentity = transaction.tallyVoucherIdentity || "";
    invoice.tallyVoucherIdentityType = transaction.tallyVoucherIdentityType || "";
    invoice.tallyGuid = transaction.tallyGuid || "";
    invoice.tallyVchKey = transaction.tallyVchKey || "";
    invoice.tallyVoucherKey = transaction.tallyVoucherKey || "";
    invoice.tallyVoucherRetainKey = transaction.tallyVoucherRetainKey || "";
    invoice.tallyReference = transaction.reference || "";
    invoice.tallyLinkedAutomatically = true;
    invoice.tallyLastSyncedAt = new Date();
    await invoice.save();
  }

  if (poResult.purchaseOrder && !poResult.purchaseOrder.tallyLinkedAutomatically) {
    const po = poResult.purchaseOrder;
    po.tallyVoucherIdentity = transaction.tallyVoucherIdentity || "";
    po.tallyReference = transaction.reference || "";
    po.tallyLinkedAutomatically = true;
    po.tallyLastSyncedAt = new Date();
    await po.save();
  }

  return update;
}



function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function itemName(item, transaction = null) {
  const actualName = clean(item?.stockItemName || item?.description);

  if (actualName) return actualName;

  if (transaction?.voucherNumber) {
    return `Tally Purchase Voucher ${clean(transaction.voucherNumber)}`;
  }

  if (transaction?.tallyVoucherIdentity) {
    return `Tally Purchase Voucher ${clean(transaction.tallyVoucherIdentity)}`;
  }

  return null;
}

async function ensureTallyService(transaction, item) {
  const name = itemName(item, transaction);
  if (!name || !transaction.tallyVoucherIdentity) return null;

  let service = await Service.findOne({
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });

  if (!service) {
    service = await Service.create({
      name,
      description: clean(item.description || item.stockItemName),
      unit: "Piece",
      status: "active",
    });
  }

  const serviceDate = toDate(transaction.transactionDate) || new Date();
  const amount = positiveNumber(item.amount) || positiveNumber(transaction.totalAmount);

  if (transaction.partyType === "customer" && transaction.customer) {
    const existing = await CustomerService.findOne({
      customer: transaction.customer,
      tallyVoucherIdentity: transaction.tallyVoucherIdentity,
      tallyItemName: name,
    });

    const data = {
      customer: transaction.customer,
      service: service._id,
      startDate: serviceDate,
      endDate: serviceDate,
      amount,
      paymentStatus: "unpaid",
      paymentDate: null,
      poNumber: clean(item.orderNumber) || undefined,
      billingCycle: "one_time",
      status: "active",
      tallyVoucherIdentity: transaction.tallyVoucherIdentity,
      tallyVoucherIdentityType: transaction.tallyVoucherIdentityType || null,
      tallyItemName: name,
      tallyLinkedAutomatically: true,
      tallyLastSyncedAt: new Date(),
    };

    if (existing) {
      Object.assign(existing, data);
      await existing.save();
      return existing;
    }

    return CustomerService.create(data);
  }

  if (transaction.partyType === "distributor" && transaction.distributor) {
    const existing = await DistributorService.findOne({
      distributor: transaction.distributor,
      tallyVoucherIdentity: transaction.tallyVoucherIdentity,
      tallyItemName: name,
    });

    const quantity = positiveNumber(item.billedQty) || positiveNumber(item.actualQty) || 1;
    const purchasePrice = positiveNumber(item.rate) || (amount / quantity);

    const data = {
      distributor: transaction.distributor,
      service: service._id,
      quantity,
      purchasePrice,
      purchaseDate: serviceDate,
      serviceStartDate: serviceDate,
      serviceEndDate: serviceDate,
      totalPayableAmount: amount,
      paymentType: "one_time",
      installmentFrequency: null,
      installmentAmount: null,
      numberOfInstallments: null,
      firstPaymentDueDate: null,
      tallyVoucherIdentity: transaction.tallyVoucherIdentity,
      tallyVoucherIdentityType: transaction.tallyVoucherIdentityType || null,
      tallyItemName: name,
      tallyLinkedAutomatically: true,
      tallyLastSyncedAt: new Date(),
    };

    if (existing) {
      Object.assign(existing, data);
      await existing.save();
      return existing;
    }

    return DistributorService.create(data);
  }

  return null;
}

async function ensureTallyPurchaseOrder(transaction, item, serviceRecord) {
  const poNumber = clean(item?.orderNumber);
  if (!poNumber || !transaction.tallyVoucherIdentity) return null;

  const partyField = transaction.partyType === "customer" ? "customer" : "distributor";
  const partyId = transaction[partyField];
  if (!partyId) return null;

  const query = {
    poNumber,
    [partyField]: partyId,
  };

  let po = await PurchaseOrder.findOne(query);
  const amount = positiveNumber(item.amount) || positiveNumber(transaction.totalAmount);
  const poDate = toDate(transaction.transactionDate) || new Date();

  const data = {
    [partyField]: partyId,
    poNumber,
    poDate,
    poIssuedTo: clean(transaction.partyName || transaction.tallyPartyName),
    amount,
    notes: [clean(transaction.reference), clean(transaction.narration)].filter(Boolean).join(" | ") || undefined,
    tallyVoucherIdentity: transaction.tallyVoucherIdentity,
    tallyReference: clean(transaction.reference),
    tallyLinkedAutomatically: true,
    tallyLastSyncedAt: new Date(),
  };

  if (transaction.partyType === "customer") {
    data.customerService = serviceRecord?._id || null;
  } else {
    data.distributorService = serviceRecord?._id || null;
  }

  if (po) {
    Object.assign(po, data);
    await po.save();
    return po;
  }

  return PurchaseOrder.create(data);
}

async function ensureTallyInvoice(transaction, serviceRecord, po) {
  if (!transaction.isInvoice || transaction.isCancelled || !transaction.tallyVoucherIdentity) return null;
  const invoiceNumber = clean(transaction.voucherNumber || transaction.reference);
  if (!invoiceNumber) return null;

  const partyField = transaction.partyType === "customer" ? "customer" : "distributor";
  const partyId = transaction[partyField];
  if (!partyId) return null;

  let invoice = await Invoice.findOne({
    tallyVoucherIdentity: transaction.tallyVoucherIdentity,
  });

  if (!invoice) {
    invoice = await Invoice.findOne({
      invoiceNumber,
      [partyField]: partyId,
    });
  }

  const data = {
    [partyField]: partyId,
    invoiceNumber,
    invoiceDate: toDate(transaction.transactionDate) || new Date(),
    amount: positiveNumber(transaction.totalAmount) || positiveNumber(transaction.inventoryAmount),
    dueDate: null,
    purchaseOrder: po?._id || null,
    tallyVoucherIdentity: transaction.tallyVoucherIdentity,
    tallyVoucherIdentityType: transaction.tallyVoucherIdentityType || null,
    tallyGuid: transaction.tallyGuid || "",
    tallyVchKey: transaction.tallyVchKey || "",
    tallyVoucherKey: transaction.tallyVoucherKey || "",
    tallyVoucherRetainKey: transaction.tallyVoucherRetainKey || "",
    tallyReference: clean(transaction.reference),
    tallyLinkedAutomatically: true,
    tallyLastSyncedAt: new Date(),
    notes: [clean(transaction.narration), ...(transaction.inventoryEntries || []).map(itemName).filter(Boolean)].filter(Boolean).join(" | ") || undefined,
  };

  if (transaction.partyType === "customer") data.customerService = serviceRecord?._id || null;
  else data.distributorService = serviceRecord?._id || null;

  if (invoice) {
    // Never erase a manually entered PDF or an already established installment plan.
    const preserve = {
      pdfUrl: invoice.pdfUrl,
      pdfFileName: invoice.pdfFileName,
      pdfPublicId: invoice.pdfPublicId,
      invoiceGroupId: invoice.invoiceGroupId,
      installmentNumber: invoice.installmentNumber,
      totalInstallments: invoice.totalInstallments,
    };
    Object.assign(invoice, data);
    Object.assign(invoice, preserve);
    await invoice.save();
    return invoice;
  }

  return Invoice.create(data);
}

async function materializeTallyTransaction(transaction) {
  if (!transaction || transaction.isCancelled) return { service: null, po: null, invoice: null };

  let serviceRecord = null;
  const items = Array.isArray(transaction.inventoryEntries) ? transaction.inventoryEntries : [];
  if (items.length) {
    // One service record per Tally voucher + item. This keeps the customer's/distributor's
    // service list tied to the exact accounting transaction and prevents duplicates.
    for (const item of items) {
      serviceRecord = await ensureTallyService(transaction, item) || serviceRecord;
    }
  }

  let po = null;
  for (const item of items) {
    if (clean(item.orderNumber)) {
      po = await ensureTallyPurchaseOrder(transaction, item, serviceRecord) || po;
      if (po) break;
    }
  }

  const invoice = await ensureTallyInvoice(transaction, serviceRecord, po);

  return { service: serviceRecord, po, invoice };
}

async function syncTallyRelationships() {
  const transactions = await TallyTransaction.find({
    source: "TallyPrime",
    isCancelled: { $ne: true },
  });

  let linked = 0;
  let ambiguous = 0;
  let unlinked = 0;

  let materialized = { services: 0, purchaseOrders: 0, invoices: 0 };

  for (const transaction of transactions) {
    const materializedRecord = await materializeTallyTransaction(transaction);
    if (materializedRecord.service) materialized.services++;
    if (materializedRecord.po) materialized.purchaseOrders++;
    if (materializedRecord.invoice) materialized.invoices++;

    // The materialized records now provide deterministic application
    // relationships; run the normal linker immediately afterwards.
    const result = await linkTransaction(transaction);
    if (result.relationshipLinkStatus === "linked") linked++;
    else if (result.relationshipLinkStatus === "ambiguous") ambiguous++;
    else unlinked++;
  }

  // ==========================================================
  // GLOBAL TALLY PAYMENT RECONCILIATION
  // ==========================================================
  //
  // Rules:
  // 1. Explicit invoice allocation/reference from Tally may link automatically.
  // 2. Manually confirmed payments remain linked permanently.
  // 3. Unallocated/on-account payments are NEVER guessed onto invoices.
  // 4. Only explicitly linked payments affect an invoice's Tally amount.
  // 5. Existing manual invoice status is never overwritten here.
  // ==========================================================

  const payments = await Payment.find({
    source: "TallyPrime",
  });

  let paymentsLinked = 0;
  let paymentsUnlinked = 0;
  let paymentsManuallyConfirmed = 0;

  for (const payment of payments) {
    // Cancelled Tally payments do not participate in reconciliation.
    if (payment.isCancelled === true) {
      continue;
    }

    const partyField = payment.customer ? "customer" : "distributor";
    const partyId = payment.customer || payment.distributor;

    if (!partyId) {
      paymentsUnlinked++;
      continue;
    }

    // A payment that has already been manually confirmed must never
    // be detached or reclassified by a future Tally sync.
    if (
      payment.manuallyConfirmedForInvoice === true &&
      payment.invoice
    ) {
      paymentsManuallyConfirmed++;
      paymentsLinked++;
      continue;
    }

    // Existing deterministic invoice relationship.
    if (payment.invoice) {
      paymentsLinked++;
      continue;
    }

    const invoices = await Invoice.find({
      [partyField]: partyId,
      status: { $ne: "cancelled" },
    })
      .select("_id invoiceNumber invoiceDate amount")
      .sort({ invoiceDate: 1 });

    const searchText = [
      payment.tallyReference,
      payment.tallyNarration,
      ...(payment.billAllocations || []).map(
        (x) => `${x.name} ${x.rawReference}`
      ),
    ].join(" | ");

    const matches = invoices.filter((invoice) =>
      containsReference(searchText, invoice.invoiceNumber)
    );

    // FIRST: keep the existing deterministic invoice-number match.
    if (matches.length === 1) {
      payment.invoice = matches[0]._id;
      payment.invoiceLinkedAutomatically = true;
      payment.relationshipLinkReason =
        "Exact invoice number found in Tally payment details";

      await payment.save();
      paymentsLinked++;
    } else if (
      // SECOND: for CUSTOMER RECEIPTS only, safely match an unallocated
      // payment to one unique invoice with the exact same amount.
      partyField === "customer" &&
      payment.paymentType === "customer_receipt"
    ) {
      const paymentDate = new Date(payment.paymentDate);
      const paymentAmount = Number(payment.amount || 0);

      const amountMatches = Number.isFinite(paymentAmount)
        ? invoices.filter((invoice) => {
            const invoiceDate = new Date(invoice.invoiceDate);
            const invoiceAmount = Number(invoice.amount || 0);

            if (!Number.isFinite(invoiceAmount)) return false;
            if (invoiceAmount <= 0 || paymentAmount <= 0) return false;
            if (invoiceDate > paymentDate) return false;

            return (
              Math.round(invoiceAmount * 100) ===
              Math.round(paymentAmount * 100)
            );
          })
        : [];

      if (amountMatches.length === 1) {
        payment.invoice = amountMatches[0]._id;
        payment.invoiceLinkedAutomatically = true;
        payment.relationshipLinkReason =
          "Unique exact invoice amount matched from Tally payment";

        await payment.save();
        paymentsLinked++;
      } else {
        payment.invoiceLinkedAutomatically = false;
        payment.relationshipLinkReason =
          matches.length > 1
            ? "Multiple invoices matched Tally payment details"
            : amountMatches.length > 1
              ? "Multiple invoices have the same payment amount; invoice relationship requires confirmation"
              : "Tally payment is unallocated; invoice relationship requires confirmation";

        await payment.save();
        paymentsUnlinked++;
      }
    } else {
      payment.invoiceLinkedAutomatically = false;
      payment.relationshipLinkReason =
        matches.length > 1
          ? "Multiple invoices matched Tally payment details"
          : "Tally payment is unallocated; invoice relationship requires confirmation";

      await payment.save();
      paymentsUnlinked++;
    }
  }

  // ==========================================================
  // RECALCULATE TALLY PAYMENT STATE FOR EVERY INVOICE
  // ==========================================================
  //
  // IMPORTANT:
  // Existing manual invoice status is not changed here.
  // tallyPaymentStatus is the Tally reconciliation layer.
  // ==========================================================

  const unallocatedPartyKeys = new Set();

for (const payment of payments) {
  if (payment.isCancelled === true) continue;
  if (payment.invoice) continue;

  const partyKey = payment.customer
    ? "customer:" + String(payment.customer)
    : payment.distributor
      ? "distributor:" + String(payment.distributor)
      : null;

  if (partyKey) {
    unallocatedPartyKeys.add(partyKey);
  }
}

const invoices = await Invoice.find({});

  for (const invoice of invoices) {
    if (invoice.status === "cancelled") {
      continue;
    }

    const linkedPayments = await Payment.find({
      invoice: invoice._id,
      isCancelled: { $ne: true },
      source: "TallyPrime",
    }).select("amount paymentDate manuallyConfirmedForInvoice");

    const tallyPaymentAmount = linkedPayments.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const invoiceAmount = Number(invoice.amount || 0);

    invoice.tallyPaymentAmount = tallyPaymentAmount;
    invoice.tallyPaymentUpdatedAt = new Date();

    const invoicePartyKey = invoice.customer
      ? "customer:" + String(invoice.customer)
      : invoice.distributor
        ? "distributor:" + String(invoice.distributor)
        : null;

    const hasManuallyConfirmedPayment = linkedPayments.some(
      (payment) => payment.manuallyConfirmedForInvoice === true
    );

    if (tallyPaymentAmount <= 0) {
      invoice.tallyPaymentStatus =
        invoicePartyKey && unallocatedPartyKeys.has(invoicePartyKey)
          ? "unconfirmed"
          : "unpaid";
      invoice.tallyPaymentConfirmationType = "";
    } else if (tallyPaymentAmount >= invoiceAmount) {
      invoice.tallyPaymentStatus = "paid";
      invoice.tallyPaymentConfirmationType = hasManuallyConfirmedPayment
        ? "manual"
        : "automatic";
    } else {
      invoice.tallyPaymentStatus = "partial";
      invoice.tallyPaymentConfirmationType = hasManuallyConfirmedPayment
        ? "manual"
        : "automatic";
    }

    // Automatic Tally allocation is authoritative for the Tally layer.
    // Existing manual invoice status remains untouched.
    if (tallyPaymentAmount >= invoiceAmount && invoiceAmount > 0) {
      if (invoice.paymentStatusSource !== "manual") {
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
    }

    await invoice.save();
  }

  // ==========================================================
  // UNALLOCATED PAYMENTS
  // ==========================================================
  //
  // We intentionally DO NOT attach these to an invoice.
  // They remain visible through the Payment records with:
  // relationshipLinkReason =
  // "Tally payment is unallocated; invoice relationship requires confirmation"
  //
  // This prevents false invoice payments caused by amount/date/narration
  // guesses.
  // ==========================================================

  return {
    materialized,
    transactions: { total: transactions.length, linked, ambiguous, unlinked },
    payments: { total: payments.length, linked: paymentsLinked, unlinked: paymentsUnlinked },
  };
}

module.exports = { syncTallyRelationships };




