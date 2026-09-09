const express = require("express");

const {
  createDistributorService,
  getDistributorServices,
  getDistributorServiceById,
  updateDistributorService,
  deleteDistributorService,
  markInstallmentPaid,
} = require("../controllers/distributorServiceController");

const protect = require("../middleware/authMiddleware");
const uploadPdf = require("../middleware/uploadPdf");

const router = express.Router();

router.use(protect);

// Create distributor service
router.post("/", createDistributorService);

// Get all distributor services
router.get("/", getDistributorServices);

// Get services of one distributor
router.get("/distributor/:distributorId", getDistributorServices);

// Get single distributor service
router.get("/:id", getDistributorServiceById);

// Update distributor service
router.put("/:id", updateDistributorService);

// Delete distributor service
router.delete("/:id", deleteDistributorService);

// Mark installment as paid + upload invoice PDF
router.patch(
  "/:id/installments/:installmentId/pay",
  uploadPdf.single("pdf"),
  markInstallmentPaid
);

module.exports = router;