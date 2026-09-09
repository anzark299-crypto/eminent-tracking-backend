const express = require("express");

const {
  createCustomerService,
  getCustomerServices,
  getCustomerServicesByCustomer,
  getCustomerServiceById,
  updateCustomerService,
  deleteCustomerService,
} = require("../controllers/customerServiceController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// All customer-service routes require login
router.use(protect);

// Create customer service
router.post("/", createCustomerService);

// Get all customer services
router.get("/", getCustomerServices);

// Get services belonging to one customer
router.get("/customer/:customerId", getCustomerServicesByCustomer);

// Get single customer service
router.get("/:id", getCustomerServiceById);

// Update customer service
router.put("/:id", updateCustomerService);

// Delete customer service
router.delete("/:id", deleteCustomerService);

module.exports = router;