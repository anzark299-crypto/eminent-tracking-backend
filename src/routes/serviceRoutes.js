const express = require("express");

const {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService,
} = require("../controllers/serviceController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================================
// CREATE SERVICE
// ==========================================================

router.post("/", protect, createService);

// ==========================================================
// GET ALL SERVICES
// ==========================================================

router.get("/", protect, getServices);

// ==========================================================
// GET SINGLE SERVICE
// ==========================================================

router.get("/:id", protect, getServiceById);

// ==========================================================
// UPDATE SERVICE
// ==========================================================

router.put("/:id", protect, updateService);

// ==========================================================
// DELETE SERVICE
// ==========================================================

router.delete("/:id", protect, deleteService);

module.exports = router;