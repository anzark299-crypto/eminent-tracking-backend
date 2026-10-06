const express = require("express");

const router = express.Router();

// ============================================================
// TALLY CONTROLLERS
// ============================================================

const {
  testTallySync,
  syncTallyData,
  syncTallyPayments,
  getTallyPayments,
  confirmTallyPaymentForInvoice,
} = require("../controllers/tallyController");

const {
  syncTallyTransactions,
  getCustomerTallyTransactions,
  getDistributorTallyTransactions,
} = require("../controllers/tallyTransactionController");

const {
  syncTallyMasters,
} = require("../controllers/tallyMasterController");

const {
  syncTallyOutstanding,
  getCustomerTallyOutstanding,
  getDistributorTallyOutstanding,
} = require("../controllers/tallyOutstandingController");

const {
  getDistributorAccountSummary,
} = require("../controllers/distributorAccountController");

// ============================================================
// EXISTING TALLY ROUTES
// ============================================================

router.post(
  "/test",
  testTallySync
);

router.post(
  "/sync",
  (req, res) => {
    return res.status(410).json({
      success: false,
      message: "Legacy Tally sync endpoint is retired. Use /api/tally/sync-masters instead.",
    });
  }
);

router.post(
  "/sync-payments",
  syncTallyPayments
);

router.post(
  "/payments/confirm-invoice",
  confirmTallyPaymentForInvoice
);

router.post(
  "/sync-masters",
  syncTallyMasters
);

router.post(
  "/sync-transactions",
  syncTallyTransactions
);

// ============================================================
// EXISTING TRANSACTION GET ROUTES
// ============================================================

router.get(
  "/customer/:customerId/transactions",
  getCustomerTallyTransactions
);

router.get(
  "/distributor/:distributorId/transactions",
  getDistributorTallyTransactions
);

// ============================================================
// TALLY PAYMENT ROUTES
// ============================================================

router.get(
  "/customer/:customerId/payments",
  (req, res, next) => {
    req.query.customerId = req.params.customerId;
    next();
  },
  getTallyPayments
);

router.get(
  "/distributor/:distributorId/payments",
  (req, res, next) => {
    req.query.distributorId = req.params.distributorId;
    next();
  },
  getTallyPayments
);

// ============================================================
// DISTRIBUTOR ACCOUNTING SUMMARY
// ============================================================

router.get(
  "/distributor/:distributorId/account-summary",
  getDistributorAccountSummary
);

// ============================================================
// TALLY OUTSTANDING ROUTES
// ============================================================

router.post(
  "/sync-outstanding",
  syncTallyOutstanding
);

router.get(
  "/customer/:customerId/outstanding",
  getCustomerTallyOutstanding
);

router.get(
  "/distributor/:distributorId/outstanding",
  getDistributorTallyOutstanding
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
