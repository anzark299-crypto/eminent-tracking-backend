const express = require("express");

const {
  getCustomerActivities,
  getDistributorActivities,
  createActivity,
} = require("../controllers/activityController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// ALL ACTIVITY ROUTES REQUIRE LOGIN
// ============================================================

router.use(protect);

// ============================================================
// CUSTOMER ACTIVITIES
// ============================================================

router.get(
  "/customer/:customerId",
  getCustomerActivities
);

// ============================================================
// DISTRIBUTOR ACTIVITIES
// ============================================================

router.get(
  "/distributor/:distributorId",
  getDistributorActivities
);

// ============================================================
// CREATE ACTIVITY
// ============================================================

router.post(
  "/",
  createActivity
);

module.exports = router;