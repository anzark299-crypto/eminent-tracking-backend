const Distributor = require("../models/distributor");

// ==========================
// CREATE DISTRIBUTOR
// ==========================

const createDistributor = async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      phone,
      distributorType,
      address,
      city,
      state,
      pincode,
      gstin,
      notes,
    } = req.body;

    if (!companyName) {
      return res.status(400).json({
        message: "Company name is required",
      });
    }

    if (!contactPerson) {
      return res.status(400).json({
        message: "Contact person is required",
      });
    }

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    if (!phone) {
      return res.status(400).json({
        message: "Phone is required",
      });
    }

    if (!distributorType) {
      return res.status(400).json({
        message: "Distributor type is required",
      });
    }

    if (!address) {
      return res.status(400).json({
        message: "Address is required",
      });
    }

    if (!city) {
      return res.status(400).json({
        message: "City is required",
      });
    }

    if (!state) {
      return res.status(400).json({
        message: "State is required",
      });
    }

    if (!pincode) {
      return res.status(400).json({
        message: "Pincode is required",
      });
    }

    if (!gstin) {
      return res.status(400).json({
        message: "GSTIN is required",
      });
    }

    const existingDistributor = await Distributor.findOne({
      gstin: gstin.toUpperCase(),
    });

    if (existingDistributor) {
      return res.status(400).json({
        message: "Distributor with this GSTIN already exists",
      });
    }

    const distributor = await Distributor.create({
      companyName,
      contactPerson,
      email,
      phone,
      distributorType,
      address,
      city,
      state,
      pincode,
      gstin: gstin.toUpperCase(),
      notes,
    });

    res.status(201).json({
      message: "Distributor created successfully",
      distributor,
    });
  } catch (error) {
    console.error(
      "Create distributor error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================
// GET ALL DISTRIBUTORS
// ==========================

const getAllDistributors = async (req, res) => {
  try {
    const distributors = await Distributor.find({
      isArchived: { $ne: true },
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      distributors,
    });
  } catch (error) {
    console.error(
      "Get distributors error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================
// GET DISTRIBUTOR BY ID
// ==========================

const getDistributorById = async (req, res) => {
  try {
    const distributor = await Distributor.findById(
      req.params.id
    );

    if (!distributor) {
      return res.status(404).json({
        message: "Distributor not found",
      });
    }

    res.status(200).json({
      distributor,
    });
  } catch (error) {
    console.error(
      "Get distributor error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================
// UPDATE DISTRIBUTOR
// ==========================

const updateDistributor = async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      phone,
      distributorType,
      address,
      city,
      state,
      pincode,
      gstin,
      notes,
    } = req.body;

    const distributor = await Distributor.findById(
      req.params.id
    );

    if (!distributor) {
      return res.status(404).json({
        message: "Distributor not found",
      });
    }

    if (gstin) {
      const existingDistributor =
        await Distributor.findOne({
          gstin: gstin.toUpperCase(),
          _id: { $ne: req.params.id },
        });

      if (existingDistributor) {
        return res.status(400).json({
          message: "Distributor with this GSTIN already exists",
        });
      }
    }

    distributor.companyName = companyName;
    distributor.contactPerson = contactPerson;
    distributor.email = email;
    distributor.phone = phone;
    distributor.distributorType = distributorType;
    distributor.address = address;
    distributor.city = city;
    distributor.state = state;
    distributor.pincode = pincode;
    distributor.gstin = gstin
      ? gstin.toUpperCase()
      : distributor.gstin;
    distributor.notes = notes ?? "";

    await distributor.save();

    res.status(200).json({
      message: "Distributor updated successfully",
      distributor,
    });
  } catch (error) {
    console.error(
      "Update distributor error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================
// DELETE DISTRIBUTOR
// ==========================

const deleteDistributor = async (req, res) => {
  try {
    const distributor = await Distributor.findById(
      req.params.id
    );

    if (!distributor) {
      return res.status(404).json({
        message: "Distributor not found",
      });
    }

    // Soft-delete: preserve the distributor _id and all linked history.
    distributor.isArchived = true;
    distributor.archivedAt = new Date();

    await distributor.save();

    res.status(200).json({
      message: "Distributor archived successfully",
    });
  } catch (error) {
    console.error(
      "Delete distributor error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createDistributor,
  getAllDistributors,
  getDistributorById,
  updateDistributor,
  deleteDistributor,
};


