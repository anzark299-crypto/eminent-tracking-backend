const Customer = require("../models/customer");

// ------------------------------------
// CREATE CUSTOMER
// ------------------------------------
const createCustomer = async (req, res) => {
  try {
   const {
  companyName,
  contactPerson,
  email,
  phone,
  address,
  city,
  state,
  pincode,
  gstin,
  startDate,
  endDate,
} = req.body;

    // Required field
    if (!companyName) {
      return res.status(400).json({
        message: "Company name is required",
      });
    }

    // Check duplicate GSTIN if provided
    if (gstin) {
      const existingCustomer = await Customer.findOne({
        gstin: gstin.toUpperCase(),
      });

      if (existingCustomer) {
        return res.status(400).json({
          message: "Customer with this GSTIN already exists",
        });
      }
    }

    const customer = await Customer.create({
    companyName,
    contactPerson,
    email,
    phone,
    address,
    city,
    state,
    pincode,
    gstin,
    startDate,
    endDate,
    });

    res.status(201).json({
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("Create customer error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// GET ALL CUSTOMERS
// ------------------------------------
const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });

    res.status(200).json({
      customers,
    });
  } catch (error) {
    console.error("Get customers error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// GET SINGLE CUSTOMER
// ------------------------------------
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.status(200).json({
      customer,
    });
  } catch (error) {
    console.error("Get customer error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// UPDATE CUSTOMER
// ------------------------------------
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const {
    companyName,
    contactPerson,
    email,
    phone,
    address,
    city,
    state,
    pincode,
    gstin,
    startDate,
    endDate,
  } = req.body;

    customer.companyName = companyName ?? customer.companyName;
    customer.contactPerson = contactPerson ?? customer.contactPerson;
    customer.email = email ?? customer.email;
    customer.phone = phone ?? customer.phone;
    customer.address = address ?? customer.address;
    customer.city = city ?? customer.city;
    customer.state = state ?? customer.state;
    customer.startDate = startDate ?? customer.startDate;
    customer.endDate = endDate ?? customer.endDate;
    customer.pincode = pincode ?? customer.pincode;
    customer.gstin = gstin
      ? gstin.toUpperCase()
      : customer.gstin;

    await customer.save();

    res.status(200).json({
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    console.error("Update customer error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// DELETE CUSTOMER
// ------------------------------------
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    await customer.deleteOne();

    res.status(200).json({
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Delete customer error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};