const Service = require("../models/service");

// ------------------------------------
// CREATE SERVICE
// ------------------------------------
const createService = async (req, res) => {
  try {
    const {
      name,
      description,
      oem,
      category,
      unit,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Service name is required",
      });
    }

    const service = await Service.create({
      name,
      description,
      oem,
      category,
      unit,
    });

    res.status(201).json({
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("Create service error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// GET ALL SERVICES
// ------------------------------------
const getServices = async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });

    res.status(200).json({
      services,
    });
  } catch (error) {
    console.error("Get services error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// GET SINGLE SERVICE
// ------------------------------------
const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    res.status(200).json({
      service,
    });
  } catch (error) {
    console.error("Get service error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// UPDATE SERVICE
// ------------------------------------
const updateService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    const {
      name,
      description,
      oem,
      category,
      unit,
      status,
    } = req.body;

    service.name = name ?? service.name;
    service.description = description ?? service.description;
    service.oem = oem ?? service.oem;
    service.category = category ?? service.category;
    service.unit = unit ?? service.unit;
    service.status = status ?? service.status;

    await service.save();

    res.status(200).json({
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update service error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// DELETE SERVICE
// ------------------------------------
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    await service.deleteOne();

    res.status(200).json({
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete service error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService,
};