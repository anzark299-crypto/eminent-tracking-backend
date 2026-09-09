const Activity = require("../models/activity");

// ============================================================
// GET CUSTOMER ACTIVITIES
// ============================================================

const getCustomerActivities = async (req, res) => {
  try {
    const activities = await Activity.find({
      customer: req.params.customerId,
    })
      .populate("customerService", "service startDate endDate")
      .populate(
        "purchaseOrder",
        "poNumber poDate amount"
      )
      .populate(
        "invoice",
        "invoiceNumber invoiceDate amount status paymentDate"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      activities,
    });
  } catch (error) {
    console.error(
      "Get customer activities error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ============================================================
// GET DISTRIBUTOR ACTIVITIES
// ============================================================

const getDistributorActivities = async (req, res) => {
  try {
    const activities = await Activity.find({
      distributor: req.params.distributorId,
    })
      .populate(
        "distributorService",
        "service quantity purchasePrice totalPayableAmount paymentType"
      )
      .populate(
        "purchaseOrder",
        "poNumber poDate amount poIssuedTo ourPoNumber"
      )
      .populate(
        "invoice",
        "invoiceNumber invoiceDate amount status paymentDate dueDate"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      activities,
    });
  } catch (error) {
    console.error(
      "Get distributor activities error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ============================================================
// CREATE ACTIVITY
// ============================================================

const createActivity = async (req, res) => {
  try {
    const {
      customer,
      distributor,
      type,
      title,
      description,
      customerService,
      distributorService,
      purchaseOrder,
      invoice,
    } = req.body;

    // ========================================================
    // MUST HAVE CUSTOMER OR DISTRIBUTOR
    // ========================================================

    if (!customer && !distributor) {
      return res.status(400).json({
        message:
          "Customer or distributor is required",
      });
    }

    // ========================================================
    // ACTIVITY TYPE
    // ========================================================

    if (!type) {
      return res.status(400).json({
        message: "Activity type is required",
      });
    }

    // ========================================================
    // TITLE
    // ========================================================

    if (!title) {
      return res.status(400).json({
        message: "Activity title is required",
      });
    }

    // ========================================================
    // CREATE
    // ========================================================

    const activity = await Activity.create({
      customer: customer || null,
      distributor: distributor || null,

      type,

      title,

      description,

      customerService:
        customerService || null,

      distributorService:
        distributorService || null,

      purchaseOrder:
        purchaseOrder || null,

      invoice:
        invoice || null,
    });

    res.status(201).json({
      message: "Activity created successfully",
      activity,
    });
  } catch (error) {
    console.error(
      "Create activity error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getCustomerActivities,
  getDistributorActivities,
  createActivity,
};