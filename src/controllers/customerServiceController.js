const CustomerService = require("../models/customerService");
const Customer = require("../models/customer");
const Service = require("../models/service");
const Activity = require("../models/activity");

// ------------------------------------
// CREATE CUSTOMER SERVICE
// ------------------------------------
const createCustomerService = async (req, res) => {
  try {
    const {
      customer,
      service,
      startDate,
      endDate,
      amount,
      poNumber,
      billingCycle,
      reminderDaysBefore,
      paymentStatus,
      paymentDate,
    } = req.body;

    // Validate required fields
    if (!customer) {
      return res.status(400).json({
        message: "Customer is required",
      });
    }

    if (!service) {
      return res.status(400).json({
        message: "Service is required",
      });
    }

    if (!startDate) {
      return res.status(400).json({
        message: "Start date is required",
      });
    }

    if (!endDate) {
      return res.status(400).json({
        message: "End date is required",
      });
    }

    if (amount === undefined || amount === null) {
      return res.status(400).json({
        message: "Amount is required",
      });
    }

    // Check customer exists
    const existingCustomer = await Customer.findById(customer);

    if (!existingCustomer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    // Check service exists
    const existingService = await Service.findById(service);

    if (!existingService) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid service dates",
      });
    }

    if (end <= start) {
      return res.status(400).json({
        message: "End date must be after start date",
      });
    }

    // Create customer service
    const customerService = await CustomerService.create({
      customer,
      service,
      startDate: start,
      endDate: end,
      amount,
      poNumber,
      billingCycle,
      reminderDaysBefore,
      paymentStatus,
      paymentDate: paymentDate ? new Date(paymentDate) : null,
    });

    // Return populated data
    await customerService.populate("customer");
    await customerService.populate("service");

    // ------------------------------------
    // CREATE ACTIVITY
    // ------------------------------------
    await Activity.create({
      customer: customerService.customer._id,
      type: "service_assigned",
      title: "Service Assigned",
      description: `${customerService.service.name} assigned to customer`,
      customerService: customerService._id,
    });

    res.status(201).json({
      message: "Customer service created successfully",
      customerService,
    });
  } catch (error) {
    console.error(
      "Create customer service error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// GET ALL CUSTOMER SERVICES
// ------------------------------------
const getCustomerServices = async (req, res) => {
  try {
    const customerServices = await CustomerService.find()
      .populate("customer")
      .populate("service")
      .sort({ createdAt: -1 });

    res.status(200).json({
      customerServices,
    });
  } catch (error) {
    console.error(
      "Get customer services error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// GET SERVICES FOR ONE CUSTOMER
// ------------------------------------
const getCustomerServicesByCustomer = async (req, res) => {
  try {
    const customerServices = await CustomerService.find({
      customer: req.params.customerId,
    })
      .populate("customer")
      .populate("service")
      .sort({ createdAt: -1 });

    res.status(200).json({
      customerServices,
    });
  } catch (error) {
    console.error(
      "Get customer services by customer error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// GET SINGLE CUSTOMER SERVICE
// ------------------------------------
const getCustomerServiceById = async (req, res) => {
  try {
    const customerService = await CustomerService.findById(
      req.params.id
    )
      .populate("customer")
      .populate("service");

    if (!customerService) {
      return res.status(404).json({
        message: "Customer service not found",
      });
    }

    res.status(200).json({
      customerService,
    });
  } catch (error) {
    console.error(
      "Get customer service error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ------------------------------------
// UPDATE CUSTOMER SERVICE
// ------------------------------------
const updateCustomerService = async (req, res) => {
  try {
    const customerService = await CustomerService.findById(
      req.params.id
    );

    if (!customerService) {
      return res.status(404).json({
        message: "Customer service not found",
      });
    }

    const {
      customer,
      service,
      startDate,
      endDate,
      amount,
      poNumber,
      billingCycle,
      status,
      reminderDaysBefore,
      paymentStatus,
      paymentDate,
    } = req.body;

    if (customer) {
      const existingCustomer = await Customer.findById(customer);

      if (!existingCustomer) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }

      customerService.customer = customer;
    }

    if (service) {
      const existingService = await Service.findById(service);

      if (!existingService) {
        return res.status(404).json({
          message: "Service not found",
        });
      }

      customerService.service = service;
    }

    if (startDate) {
      customerService.startDate = new Date(startDate);
    }

    if (endDate) {
      customerService.endDate = new Date(endDate);
    }

    if (amount !== undefined) {
      customerService.amount = amount;
    }

    if (poNumber !== undefined) {
      customerService.poNumber = poNumber;
    }

    if (billingCycle !== undefined) {
      customerService.billingCycle = billingCycle;
    }

    if (status !== undefined) {
      customerService.status = status;
    }

    if (reminderDaysBefore !== undefined) {
      customerService.reminderDaysBefore = reminderDaysBefore;
    }

    // ------------------------------------
    // PAYMENT STATUS
    // ------------------------------------
    if (paymentStatus !== undefined) {
      customerService.paymentStatus = paymentStatus;

      if (paymentStatus === "unpaid") {
        customerService.paymentDate = null;
      }
    }

    if (
      paymentDate !== undefined &&
      paymentStatus !== "unpaid"
    ) {
      customerService.paymentDate =
        paymentDate === null || paymentDate === ""
          ? null
          : new Date(paymentDate);
    }

    // Validate dates after updating
    if (
      customerService.endDate <=
      customerService.startDate
    ) {
      return res.status(400).json({
        message: "End date must be after start date",
      });
    }

    await customerService.save();

    await customerService.populate("customer");
    await customerService.populate("service");

    res.status(200).json({
      message: "Customer service updated successfully",
      customerService,
    });
  } catch (error) {
    console.error(
      "Update customer service error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};
// ============================================================
// PAYMENT SCHEDULE HELPERS
// ============================================================

const addMonths = (date, months) => {
  const result = new Date(date);

  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDay));

  return result;
};

const getFrequencyMonths = (frequency) => {
  switch (frequency) {
    case "monthly":
      return 1;

    case "quarterly":
      return 3;

    case "half_yearly":
      return 6;

    case "yearly":
      return 12;

    default:
      return 0;
  }
};

const generateInstallments = ({
  paymentType,
  installmentAmount,
  numberOfInstallments,
  firstPaymentDueDate,
  installmentFrequency,
}) => {
  if (paymentType !== "installment") {
    return [];
  }

  const count = Number(numberOfInstallments);
  const amount = Number(installmentAmount);
  const months = getFrequencyMonths(installmentFrequency);

  if (
    !count ||
    count < 1 ||
    !amount ||
    amount <= 0 ||
    !firstPaymentDueDate ||
    !months
  ) {
    return [];
  }

  const installments = [];

  for (let i = 0; i < count; i++) {
    const dueDate = addMonths(firstPaymentDueDate, months * i);

    installments.push({
      installmentNumber: i + 1,
      amount,
      dueDate,
      status: "upcoming",
      paymentDate: null,
      invoiceNumber: null,
      invoicePdfUrl: null,
      invoicePdfFileName: null,
      invoicePdfPublicId: null,
    });
  }

  return installments;
};

// ------------------------------------
// DELETE CUSTOMER SERVICE
// ------------------------------------
const deleteCustomerService = async (req, res) => {
  try {
    const customerService = await CustomerService.findById(
      req.params.id
    );

    if (!customerService) {
      return res.status(404).json({
        message: "Customer service not found",
      });
    }

    await customerService.deleteOne();

    res.status(200).json({
      message: "Customer service deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete customer service error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createCustomerService,
  getCustomerServices,
  getCustomerServicesByCustomer,
  getCustomerServiceById,
  updateCustomerService,
  deleteCustomerService,
};