const express = require("express");

const {
  createQuotation,
  getAllQuotations,
  getQuotationById,
  getCustomerQuotations,
  getDistributorQuotations,
  updateQuotation,
  deleteQuotation,
  getQuotationHistory,
  uploadQuotationPdf,
} = require("../controllers/quotationController");

const protect = require("../middleware/authMiddleware");

const uploadPdf = require("../middleware/uploadPdf");

const router = express.Router();

// =====================================================
// CREATE
// =====================================================

router.post(
  "/",
  protect,
  createQuotation
);

// =====================================================
// GET ALL QUOTATIONS
// =====================================================

router.get(
  "/",
  protect,
  getAllQuotations
);

// =====================================================
// CUSTOMER
// =====================================================

router.get(
  "/customer/:customerId",
  protect,
  getCustomerQuotations
);

// =====================================================
// DISTRIBUTOR
// =====================================================

router.get(
  "/distributor/:distributorId",
  protect,
  getDistributorQuotations
);

// =====================================================
// QUOTATION HISTORY
// =====================================================

router.get(
  "/:id/history",
  protect,
  getQuotationHistory
);

// =====================================================
// SINGLE QUOTATION
// =====================================================

router.get(
  "/:id",
  protect,
  getQuotationById
);

// =====================================================
// UPDATE
// =====================================================

router.put(
  "/:id",
  protect,
  updateQuotation
);

// =====================================================
// DELETE
// =====================================================

router.delete(
  "/:id",
  protect,
  deleteQuotation
);

// =====================================================
// PDF
// =====================================================

router.post(
  "/:id/pdf",
  protect,
  uploadPdf.single("pdf"),
  uploadQuotationPdf
);

module.exports = router;