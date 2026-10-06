
const express = require("express");

const {
  createInvoice,
  getAllInvoices,
  getInvoicesByCustomer,
  getInvoicesByDistributor,
  getInvoicesByGroup,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  uploadInvoicePdf,
} = require("../controllers/invoiceController");

const protect = require("../middleware/authMiddleware");

const uploadPdf = require("../middleware/uploadPdf");

const router = express.Router();

// ==========================================================
// CREATE INVOICE
// ==========================================================

router.post(
  "/",
  protect,
  createInvoice
);

// ==========================================================
// GET ALL INVOICES
// CENTRAL DASHBOARD
//
// IMPORTANT:
// This route must come BEFORE /:id
// ==========================================================

router.get(
  "/",
  protect,
  getAllInvoices
);

// ==========================================================
// CUSTOMER INVOICES
// ==========================================================

router.get(
  "/customer/:customerId",
  protect,
  getInvoicesByCustomer
);

// ==========================================================
// DISTRIBUTOR INVOICES
// ==========================================================

router.get(
  "/distributor/:distributorId",
  protect,
  getInvoicesByDistributor
);

// ==========================================================
// INVOICES BY INSTALLMENT GROUP
//
// IMPORTANT:
// This route must come BEFORE /:id
// ==========================================================

router.get(
  "/group/:invoiceGroupId",
  protect,
  getInvoicesByGroup
);

// ==========================================================
// SINGLE INVOICE
// ==========================================================

router.get(
  "/:id",
  protect,
  getInvoiceById
);

// ==========================================================
// UPDATE INVOICE
// ==========================================================

router.put(
  "/:id",
  protect,
  updateInvoice
);

// ==========================================================
// DELETE INVOICE
// ==========================================================

router.delete(
  "/:id",
  protect,
  deleteInvoice
);

// ==========================================================
// UPLOAD INVOICE PDF
// ==========================================================

router.post(
  "/:id/pdf",
  protect,
  uploadPdf.single("pdf"),
  uploadInvoicePdf
);

module.exports = router;
