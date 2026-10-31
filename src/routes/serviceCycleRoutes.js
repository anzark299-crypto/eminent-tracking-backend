const express = require("express");

const {
  createAgreementWithInitialCycle,
  getAgreementCycles,
  getServiceCyclesByAssignment,
  renewServiceCycle,
  deleteServiceCycle,
} = require("../controllers/serviceCycleController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// All service-agreement and cycle endpoints require authentication.
router.use(protect);

// Create an agreement and its initial cycle.
router.post("/agreements", createAgreementWithInitialCycle);

// Read all cycles belonging to one agreement.
router.get("/agreements/:agreementId/cycles", getAgreementCycles);
router.get(
  "/services/:serviceType/:serviceId/cycles",
  getServiceCyclesByAssignment
);

// Delete a cycle only when it has no linked documents or dependent renewal.
router.delete("/cycles/:cycleId", deleteServiceCycle);
// Create a renewal from a selected cycle.
router.post("/cycles/:cycleId/renew", renewServiceCycle);

module.exports = router;

