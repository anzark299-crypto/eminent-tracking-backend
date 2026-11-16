const express = require("express");
const {
  getCycleInventory,
  saveCycleInventory,
} = require("../controllers/serviceInventoryController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get(
  "/:serviceType/:serviceId/cycles/:cycleId",
  getCycleInventory
);

router.post(
  "/:serviceType/:serviceId/cycles/:cycleId",
  saveCycleInventory
);

module.exports = router;
