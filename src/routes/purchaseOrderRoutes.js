const express = require("express");

const {
  createPurchaseOrder,
  getPurchaseOrdersByCustomer,
  getPurchaseOrdersByDistributor,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  uploadPurchaseOrderPdf,
} = require("../controllers/purchaseOrderController");

const protect = require("../middleware/authMiddleware");
const uploadPdf = require("../middleware/uploadPdf");

const router = express.Router();

// =====================================================
// CREATE
// =====================================================

router.post(
  "/",
  protect,
  createPurchaseOrder
);

// =====================================================
// CUSTOMER
// =====================================================

router.get(
  "/customer/:customerId",
  protect,
  getPurchaseOrdersByCustomer
);

// =====================================================
// DISTRIBUTOR
// =====================================================

router.get(
  "/distributor/:distributorId",
  protect,
  getPurchaseOrdersByDistributor
);

// =====================================================
// SINGLE PO
// =====================================================

router.get(
  "/:id",
  protect,
  getPurchaseOrderById
);

// =====================================================
// UPDATE
// =====================================================

router.put(
  "/:id",
  protect,
  updatePurchaseOrder
);

// =====================================================
// DELETE
// =====================================================

router.delete(
  "/:id",
  protect,
  deletePurchaseOrder
);

// =====================================================
// PDF
// =====================================================

router.post(
  "/:id/pdf",
  protect,
  uploadPdf.single("pdf"),
  uploadPurchaseOrderPdf
);

module.exports = router;