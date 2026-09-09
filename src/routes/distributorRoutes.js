const express = require("express");

const {
  createDistributor,
  getAllDistributors,
  getDistributorById,
  updateDistributor,
  deleteDistributor,
} = require("../controllers/distributorController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Create distributor
router.post("/", protect, createDistributor);

// Get all distributors
router.get("/", protect, getAllDistributors);

// Get distributor by ID
router.get("/:id", protect, getDistributorById);

// Update distributor
router.put("/:id", protect, updateDistributor);

// Delete distributor
router.delete("/:id", protect, deleteDistributor);

module.exports = router;