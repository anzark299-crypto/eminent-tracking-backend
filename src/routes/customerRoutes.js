const express = require("express");

const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// ALL CUSTOMER ROUTES REQUIRE LOGIN
// ============================================================

router.use(protect);

// ============================================================
// CREATE CUSTOMER
// ============================================================

router.post("/", createCustomer);

// ============================================================
// GET ALL CUSTOMERS
// ============================================================

router.get("/", getCustomers);

// ============================================================
// GET SINGLE CUSTOMER
// ============================================================

router.get("/:id", getCustomerById);

// ============================================================
// UPDATE CUSTOMER
// ============================================================

router.put("/:id", updateCustomer);

// ============================================================
// DELETE CUSTOMER
// ============================================================

router.delete("/:id", deleteCustomer);

module.exports = router;