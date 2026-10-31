
const mongoose = require("mongoose");

const Invoice = require("../models/invoice");
const DistributorService = require("../models/distributorService");
const CustomerService = require("../models/customerService");
const PurchaseOrder = require("../models/purchaseOrder");
const ServiceCycle = require("../models/serviceCycle");
const ServiceAgreement = require("../models/serviceAgreement");

const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const Activity = require("../models/activity");

// ==========================================================
// CREATE INVOICE
// ==========================================================

const createInvoice = async (req, res) => {
  try {
    const {
      customer,
      customerService,
      distributor,
      distributorService,
      purchaseOrder,

      invoiceNumber,
      invoiceDate,
      amount,

      status,
      paymentDate,

      dueDate,

      installmentNumber,
      totalInstallments,
      invoiceGroupId,

      notes,
    } = req.body;

    // PARTY VALIDATION
    if (!customer && !distributor) {
      return res.status(400).json({
        message: "Customer or distributor is required",
      });
    }

    if (customer && distributor) {
      return res.status(400).json({
        message:
          "Invoice cannot belong to both customer and distributor",
      });
    }

    // BASIC VALIDATION
    if (!invoiceNumber || !invoiceNumber.trim()) {
      return res.status(400).json({
        message: "Invoice number is required",
      });
    }

    if (!invoiceDate) {
      return res.status(400).json({
        message: "Invoice date is required",
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      amount === ""
    ) {
      return res.status(400).json({
        message: "Amount is required",
      });
    }

    if (Number(amount) < 0) {
      return res.status(400).json({
        message: "Amount cannot be negative",
      });
    }

    let finalCustomerService = customerService || null;
    let finalDistributorService = distributorService || null;
    let linkedPurchaseOrder = null;
    let inheritedServiceCycle = null;

    // CUSTOMER SERVICE
    if (customer && customerService) {
      const customerServiceExists =
        await CustomerService.findById(customerService);

      if (!customerServiceExists) {
        return res.status(404).json({
          message: "Customer service not found",
        });
      }

      if (
        customerServiceExists.customer.toString() !==
        customer.toString()
      ) {
        return res.status(400).json({
          message:
            "Customer service does not belong to this customer",
        });
      }
    }

    // DISTRIBUTOR SERVICE
    if (distributor && distributorService) {
      const distributorServiceExists =
        await DistributorService.findById(distributorService);

      if (!distributorServiceExists) {
        return res.status(404).json({
          message: "Distributor service not found",
        });
      }

      if (
        distributorServiceExists.distributor.toString() !==
        distributor.toString()
      ) {
        return res.status(400).json({
          message:
            "Distributor service does not belong to this distributor",
        });
      }
    }

    // PURCHASE ORDER
    if (purchaseOrder) {
      const purchaseOrderExists =
        await PurchaseOrder.findById(purchaseOrder);

      if (!purchaseOrderExists) {
        return res.status(404).json({
          message: "Purchase order not found",
        });
      }

      linkedPurchaseOrder = purchaseOrderExists;
      if (customer) {
        if (
          !purchaseOrderExists.customer ||
          purchaseOrderExists.customer.toString() !==
            customer.toString()
        ) {
          return res.status(400).json({
            message:
              "Purchase order does not belong to this customer",
          });
        }
      }

      if (distributor) {
        if (
          !purchaseOrderExists.distributor ||
          purchaseOrderExists.distributor.toString() !==
            distributor.toString()
        ) {
          return res.status(400).json({
            message:
              "Purchase order does not belong to this distributor",
          });
        }
      }
    }

    if (linkedPurchaseOrder) {
      if (customer) {
        if (
          linkedPurchaseOrder.customerService &&
          customerService &&
          linkedPurchaseOrder.customerService.toString() !== customerService.toString()
        ) {
          return res.status(400).json({
            message: "Purchase order belongs to a different customer service",
          });
        }
        if (!finalCustomerService && linkedPurchaseOrder.customerService) {
          finalCustomerService = linkedPurchaseOrder.customerService;
        }
      }

      if (distributor) {
        if (
          linkedPurchaseOrder.distributorService &&
          distributorService &&
          linkedPurchaseOrder.distributorService.toString() !== distributorService.toString()
        ) {
          return res.status(400).json({
            message: "Purchase order belongs to a different distributor service",
          });
        }
        if (!finalDistributorService && linkedPurchaseOrder.distributorService) {
          finalDistributorService = linkedPurchaseOrder.distributorService;
        }
      }

      inheritedServiceCycle = linkedPurchaseOrder.serviceCycle || null;
    }

    // VALIDATE INHERITED SERVICE ASSIGNMENT AND CYCLE
    if (finalCustomerService) {
      if (!customer || distributor) {
        return res.status(400).json({
          message: "Customer service cannot be assigned to a distributor invoice",
        });
      }

      if (!mongoose.isValidObjectId(String(finalCustomerService))) {
        return res.status(400).json({
          message: "Invalid customer service ID",
        });
      }

      const inheritedCustomerService =
        await CustomerService.findById(finalCustomerService);

      if (!inheritedCustomerService) {
        return res.status(404).json({
          message: "Inherited customer service not found",
        });
      }

      if (String(inheritedCustomerService.customer) !== String(customer)) {
        return res.status(400).json({
          message: "Inherited customer service belongs to a different customer",
        });
      }
    }

    if (finalDistributorService) {
      if (!distributor || customer) {
        return res.status(400).json({
          message: "Distributor service cannot be assigned to a customer invoice",
        });
      }

      if (!mongoose.isValidObjectId(String(finalDistributorService))) {
        return res.status(400).json({
          message: "Invalid distributor service ID",
        });
      }

      const inheritedDistributorService =
        await DistributorService.findById(finalDistributorService);

      if (!inheritedDistributorService) {
        return res.status(404).json({
          message: "Inherited distributor service not found",
        });
      }

      if (
        String(inheritedDistributorService.distributor) !== String(distributor)
      ) {
        return res.status(400).json({
          message: "Inherited distributor service belongs to a different distributor",
        });
      }
    }

    if (inheritedServiceCycle) {
      const cycleId = String(inheritedServiceCycle);

      if (!mongoose.isValidObjectId(cycleId)) {
        return res.status(400).json({
          message: "Invalid inherited service cycle ID",
        });
      }

      const validatedCycle = await ServiceCycle.findById(cycleId);

      if (!validatedCycle) {
        return res.status(404).json({
          message: "Inherited service cycle not found",
        });
      }

      const agreement = await ServiceAgreement.findById(
        validatedCycle.agreement
      );

      if (!agreement) {
        return res.status(404).json({
          message: "Inherited service agreement not found",
        });
      }

      const isCustomerAgreement = Boolean(agreement.customer);
      const isDistributorAgreement = Boolean(agreement.distributor);

      if (isCustomerAgreement === isDistributorAgreement) {
        return res.status(400).json({
          message: "Service agreement must belong to exactly one customer or distributor",
        });
      }

      if (customer) {
        if (
          !isCustomerAgreement ||
          String(agreement.customer) !== String(customer)
        ) {
          return res.status(400).json({
            message: "Inherited service cycle does not belong to this customer",
          });
        }

        if (
          validatedCycle.distributorService ||
          (validatedCycle.customerService &&
            String(validatedCycle.customerService) !== String(finalCustomerService || ""))
        ) {
          return res.status(400).json({
            message: "Service assignment does not match the inherited customer cycle",
          });
        }
      } else {
        if (
          !isDistributorAgreement ||
          String(agreement.distributor) !== String(distributor)
        ) {
          return res.status(400).json({
            message: "Inherited service cycle does not belong to this distributor",
          });
        }

        if (
          validatedCycle.customerService ||
          (validatedCycle.distributorService &&
            String(validatedCycle.distributorService) !== String(finalDistributorService || ""))
        ) {
          return res.status(400).json({
            message: "Service assignment does not match the inherited distributor cycle",
          });
        }
      }
    }
    // STATUS
    const finalStatus = status || "unpaid";


    if (
      !["unpaid", "paid", "cancelled"].includes(
        finalStatus
      )
    ) {
      return res.status(400).json({
        message: "Invalid invoice status",
      });
    }

    // PAYMENT DATE
    let finalPaymentDate = null;

    if (finalStatus === "paid" && paymentDate) {
      const parsedPaymentDate =
        new Date(paymentDate);

      if (isNaN(parsedPaymentDate.getTime())) {
        return res.status(400).json({
          message: "Invalid payment date",
        });
      }

      finalPaymentDate = parsedPaymentDate;
    }

    // DUE DATE
    let finalDueDate = null;

    if (dueDate) {
      const parsedDueDate =
        new Date(dueDate);

      if (isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          message: "Invalid due date",
        });
      }

      finalDueDate = parsedDueDate;
    }

    // INSTALLMENTS
    let finalInstallmentNumber = null;
    let finalTotalInstallments = null;

    if (
      installmentNumber !== undefined &&
      installmentNumber !== null &&
      installmentNumber !== ""
    ) {
      finalInstallmentNumber =
        Number(installmentNumber);

      if (
        !Number.isInteger(finalInstallmentNumber) ||
        finalInstallmentNumber < 1
      ) {
        return res.status(400).json({
          message:
            "Installment number must be at least 1",
        });
      }
    }

    if (
      totalInstallments !== undefined &&
      totalInstallments !== null &&
      totalInstallments !== ""
    ) {
      finalTotalInstallments =
        Number(totalInstallments);

      if (
        !Number.isInteger(finalTotalInstallments) ||
        finalTotalInstallments < 1
      ) {
        return res.status(400).json({
          message:
            "Total installments must be at least 1",
        });
      }
    }

    if (
      finalInstallmentNumber !== null &&
      finalTotalInstallments !== null &&
      finalInstallmentNumber >
        finalTotalInstallments
    ) {
      return res.status(400).json({
        message:
          "Installment number cannot exceed total installments",
      });
    }

    // INVOICE GROUP
    let finalInvoiceGroupId = null;

    if (invoiceGroupId) {
      if (
        !mongoose.Types.ObjectId.isValid(
          invoiceGroupId
        )
      ) {
        return res.status(400).json({
          message: "Invalid invoice group ID",
        });
      }

      finalInvoiceGroupId = invoiceGroupId;

      const existingGroupInvoices =
        await Invoice.find({
          invoiceGroupId: finalInvoiceGroupId,
        }).limit(1);

      if (existingGroupInvoices.length > 0) {
        const existingInvoice =
          existingGroupInvoices[0];

        if (customer) {
          if (
            !existingInvoice.customer ||
            existingInvoice.customer.toString() !==
              customer.toString()
          ) {
            return res.status(400).json({
              message:
                "Invoice group belongs to a different customer",
            });
          }
        }

        if (distributor) {
          if (
            !existingInvoice.distributor ||
            existingInvoice.distributor.toString() !==
              distributor.toString()
          ) {
            return res.status(400).json({
              message:
                "Invoice group belongs to a different distributor",
            });
          }
        }
      }
    } else if (
      finalTotalInstallments !== null &&
      finalTotalInstallments > 1
    ) {
      finalInvoiceGroupId =
        new mongoose.Types.ObjectId();
    }

    // CREATE
    const invoice = await Invoice.create({
      customer: customer || null,
      customerService: finalCustomerService,

      distributor: distributor || null,
      distributorService: finalDistributorService,

      purchaseOrder: purchaseOrder || null,
      serviceCycle: inheritedServiceCycle,

      invoiceGroupId: finalInvoiceGroupId,

      invoiceNumber,
      invoiceDate,
      amount,

      status: finalStatus,

      paymentDate: finalPaymentDate,

      dueDate: finalDueDate,

      installmentNumber:
        finalInstallmentNumber,

      totalInstallments:
        finalTotalInstallments,

      notes,
    });

    // ==========================================================
    // ACTIVITY
    // ==========================================================

    try {
      // CUSTOMER
      if (invoice.customer) {
        await Activity.create({
          customer: invoice.customer,
          type: "invoice_created",
          title: "Invoice Created",
          description:
            `Invoice ${invoice.invoiceNumber} created`,
          invoice: invoice._id,
        });

        // If invoice was immediately marked paid
        if (invoice.status === "paid") {
          await Activity.create({
            customer: invoice.customer,
            type: "payment_received",
            title: "Payment Received",
            description:
              `Payment received for invoice ${invoice.invoiceNumber}`,
            invoice: invoice._id,
          });
        }
      }

      // DISTRIBUTOR
      if (invoice.distributor) {
        await Activity.create({
          distributor: invoice.distributor,
          type: "invoice_created",
          title: "Invoice Created",
          description:
            `Invoice ${invoice.invoiceNumber} created`,
          invoice: invoice._id,
        });

        // If invoice was immediately marked paid
        if (invoice.status === "paid") {
          await Activity.create({
            distributor: invoice.distributor,
            type: "payment_received",
            title: "Payment Received",
            description:
              `Payment received for invoice ${invoice.invoiceNumber}`,
            invoice: invoice._id,
          });
        }
      }
    } catch (activityError) {
      console.error(
        "Create invoice activity error:",
        activityError.message
      );
    }

    res.status(201).json({
      message: "Invoice created successfully",
      invoice,
      invoiceGroupId: finalInvoiceGroupId,
    });
  } catch (error) {
    console.error(
      "Create invoice error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================================================
// GET ALL INVOICES
// CENTRAL DASHBOARD
// ==========================================================

const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate("customer", "companyName")
      .populate("distributor", "companyName")
      .populate({
        path: "customerService",
        populate: {
          path: "service",
          select:
            "name description oem category unit",
        },
      })
      .populate({
        path: "distributorService",
        populate: {
          path: "service",
          select:
            "name description oem category unit",
        },
      })
      .populate(
        "purchaseOrder",
        "poNumber poDate amount poIssuedTo ourPoNumber ourPoDate"
      )
      .sort({
        invoiceDate: -1,
        installmentNumber: 1,
      });

    res.status(200).json({
      invoices,
    });
  } catch (error) {
    console.error(
      "Get all invoices error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================================================
// GET CUSTOMER INVOICES
// ==========================================================

const getInvoicesByCustomer = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      customer: req.params.customerId,
    })
      .populate({
        path: "customerService",
        select:
          "startDate endDate amount status service",
        populate: {
          path: "service",
          select: "name",
        },
      })
      .populate(
        "purchaseOrder",
        "poNumber poDate amount"
      )
      .sort({
        invoiceDate: -1,
        installmentNumber: 1,
      });

    res.status(200).json({
      invoices,
    });
  } catch (error) {
    console.error(
      "Get customer invoices error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================================================
// GET DISTRIBUTOR INVOICES
// ==========================================================

const getInvoicesByDistributor = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      distributor: req.params.distributorId,
    })
      .populate({
        path: "distributorService",
        populate: {
          path: "service",
          select:
            "name description oem category unit",
        },
      })
      .populate(
        "purchaseOrder",
        "poNumber poDate amount"
      )
      .sort({
        invoiceDate: -1,
        installmentNumber: 1,
      });

    res.status(200).json({
      invoices,
    });
  } catch (error) {
    console.error(
      "Get distributor invoices error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================================================
// ==========================================================
// GET INVOICES BY CUSTOMER SERVICE ASSIGNMENT
// ==========================================================
const getInvoicesByCustomerService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.isValidObjectId(serviceId)) {
      return res.status(400).json({ message: "Invalid customer service ID" });
    }

    const assignment = await CustomerService.findById(serviceId).select("customer");
    if (!assignment) {
      return res.status(404).json({ message: "Customer service assignment not found" });
    }

    const invoices = await Invoice.find({
      customerService: assignment._id,
      customer: assignment.customer,
    })
      .populate("purchaseOrder", "poNumber poDate amount pdfUrl")
      .sort({ invoiceDate: -1, createdAt: -1 });

    return res.status(200).json({ invoices });
  } catch (error) {
    console.error("Get customer-service invoices error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ==========================================================
// GET INVOICES BY DISTRIBUTOR SERVICE ASSIGNMENT
// ==========================================================
const getInvoicesByDistributorService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.isValidObjectId(serviceId)) {
      return res.status(400).json({ message: "Invalid distributor service ID" });
    }

    const assignment = await DistributorService.findById(serviceId).select("distributor");
    if (!assignment) {
      return res.status(404).json({ message: "Distributor service assignment not found" });
    }

    const invoices = await Invoice.find({
      distributorService: assignment._id,
      distributor: assignment.distributor,
    })
      .populate("purchaseOrder", "poNumber poDate amount pdfUrl")
      .sort({ invoiceDate: -1, createdAt: -1 });

    return res.status(200).json({ invoices });
  } catch (error) {
    console.error("Get distributor-service invoices error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};
// GET INVOICES BY GROUP
// ==========================================================

const getInvoicesByGroup = async (req, res) => {
  try {
    const { invoiceGroupId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        invoiceGroupId
      )
    ) {
      return res.status(400).json({
        message: "Invalid invoice group ID",
      });
    }

    const invoices = await Invoice.find({
      invoiceGroupId,
    })
      .populate("customer", "companyName")
      .populate({
        path: "customerService",
        populate: {
          path: "service",
          select: "name",
        },
      })
      .populate("distributor", "companyName")
      .populate({
        path: "distributorService",
        populate: {
          path: "service",
          select:
            "name description oem category unit",
        },
      })
      .populate(
        "purchaseOrder",
        "poNumber poDate amount"
      )
      .sort({
        installmentNumber: 1,
        invoiceDate: 1,
      });

    res.status(200).json({
      invoices,
    });
  } catch (error) {
    console.error(
      "Get invoice group error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================================================
// GET SINGLE INVOICE
// ==========================================================

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(
      req.params.id
    )
      .populate("customer", "companyName")
      .populate({
        path: "customerService",
        populate: {
          path: "service",
          select: "name",
        },
      })
      .populate("distributor", "companyName")
      .populate({
        path: "distributorService",
        populate: {
          path: "service",
          select:
            "name description oem category unit",
        },
      })
      .populate("purchaseOrder");

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      invoice,
    });
  } catch (error) {
    console.error(
      "Get invoice error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================================================
// UPDATE INVOICE
// ==========================================================

const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(
      req.params.id
    );

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    if (invoice.tallyLinkedAutomatically === true) {
      return res.status(409).json({
        message: "Tally-linked invoices are read-only. Update them in TallyPrime.",
      });
    }

    const {
      customerService,
      distributorService,
      purchaseOrder,

      invoiceNumber,
      invoiceDate,
      amount,

      status,
      paymentDate,

      dueDate,

      installmentNumber,
      totalInstallments,
      invoiceGroupId,

      notes,
    } = req.body;

    // OLD VALUES
    const oldStatus = invoice.status;

    const oldInvoiceNumber =
      invoice.invoiceNumber;

    const oldAmount = invoice.amount;

    // PURCHASE ORDER + SERVICE RELATIONSHIP SYNCHRONIZATION
    let nextCustomerService = invoice.customerService || null;
    let nextDistributorService = invoice.distributorService || null;
    let nextServiceCycle = invoice.serviceCycle || null;
    let nextPurchaseOrder = invoice.purchaseOrder || null;
    let linkedPurchaseOrder = null;
    let previousPurchaseOrder = null;

    const previousPurchaseOrderId = invoice.purchaseOrder
      ? String(invoice.purchaseOrder)
      : null;

    const sameId = (a, b) =>
      Boolean(a && b && String(a) === String(b));

    if (purchaseOrder !== undefined) {
      if (purchaseOrder === null || purchaseOrder === "") {
        if (invoice.purchaseOrder) {
          previousPurchaseOrder =
            await PurchaseOrder.findById(invoice.purchaseOrder);
        }

        if (
          previousPurchaseOrder &&
          sameId(nextCustomerService, previousPurchaseOrder.customerService)
        ) {
          nextCustomerService = null;
        }

        if (
          previousPurchaseOrder &&
          sameId(nextDistributorService, previousPurchaseOrder.distributorService)
        ) {
          nextDistributorService = null;
        }

        nextPurchaseOrder = null;
        nextServiceCycle = null;
      } else {
        if (!mongoose.isValidObjectId(String(purchaseOrder))) {
          return res.status(400).json({
            message: "Invalid purchase order ID",
          });
        }

        linkedPurchaseOrder =
          await PurchaseOrder.findById(purchaseOrder);

        if (!linkedPurchaseOrder) {
          return res.status(404).json({
            message: "Purchase order not found",
          });
        }

        if (invoice.customer) {
          if (
            !linkedPurchaseOrder.customer ||
            String(linkedPurchaseOrder.customer) !== String(invoice.customer)
          ) {
            return res.status(400).json({
              message: "Purchase order does not belong to this customer",
            });
          }
        }

        if (invoice.distributor) {
          if (
            !linkedPurchaseOrder.distributor ||
            String(linkedPurchaseOrder.distributor) !== String(invoice.distributor)
          ) {
            return res.status(400).json({
              message: "Purchase order does not belong to this distributor",
            });
          }
        }

        const purchaseOrderChanged =
          previousPurchaseOrderId !== String(linkedPurchaseOrder._id);

        if (purchaseOrderChanged && invoice.purchaseOrder) {
          previousPurchaseOrder =
            await PurchaseOrder.findById(invoice.purchaseOrder);

          if (
            previousPurchaseOrder &&
            sameId(nextCustomerService, previousPurchaseOrder.customerService)
          ) {
            nextCustomerService = null;
          }

          if (
            previousPurchaseOrder &&
            sameId(nextDistributorService, previousPurchaseOrder.distributorService)
          ) {
            nextDistributorService = null;
          }
        }

        nextPurchaseOrder = linkedPurchaseOrder._id;
        nextServiceCycle = linkedPurchaseOrder.serviceCycle || null;
      }
    } else if (
      invoice.purchaseOrder &&
      (customerService !== undefined || distributorService !== undefined)
    ) {
      linkedPurchaseOrder =
        await PurchaseOrder.findById(invoice.purchaseOrder);

      if (!linkedPurchaseOrder) {
        return res.status(404).json({
          message: "Linked purchase order not found",
        });
      }
    }

    // EXPLICIT SERVICE SELECTIONS
    if (customerService !== undefined) {
      nextCustomerService =
        customerService === null || customerService === ""
          ? null
          : customerService;
    }

    if (distributorService !== undefined) {
      nextDistributorService =
        distributorService === null || distributorService === ""
          ? null
          : distributorService;
    }

    // INHERIT AND VALIDATE PURCHASE ORDER SERVICE ASSIGNMENTS
    if (linkedPurchaseOrder) {
      if (invoice.customer && linkedPurchaseOrder.customerService) {
        if (
          nextCustomerService &&
          !sameId(nextCustomerService, linkedPurchaseOrder.customerService)
        ) {
          return res.status(400).json({
            message: "Purchase order belongs to a different customer service",
          });
        }

        nextCustomerService = linkedPurchaseOrder.customerService;
      }

      if (invoice.distributor && linkedPurchaseOrder.distributorService) {
        if (
          nextDistributorService &&
          !sameId(nextDistributorService, linkedPurchaseOrder.distributorService)
        ) {
          return res.status(400).json({
            message: "Purchase order belongs to a different distributor service",
          });
        }

        nextDistributorService = linkedPurchaseOrder.distributorService;
      }
    }

    // VALIDATE CUSTOMER SERVICE
    if (nextCustomerService) {
      if (!invoice.customer || invoice.distributor) {
        return res.status(400).json({
          message: "Customer service cannot be assigned to a distributor invoice",
        });
      }

      if (!mongoose.isValidObjectId(String(nextCustomerService))) {
        return res.status(400).json({
          message: "Invalid customer service ID",
        });
      }

      const validatedCustomerService =
        await CustomerService.findById(nextCustomerService);

      if (!validatedCustomerService) {
        return res.status(404).json({
          message: "Customer service not found",
        });
      }

      if (String(validatedCustomerService.customer) !== String(invoice.customer)) {
        return res.status(400).json({
          message: "Customer service does not belong to this customer",
        });
      }
    }

    // VALIDATE DISTRIBUTOR SERVICE
    if (nextDistributorService) {
      if (!invoice.distributor || invoice.customer) {
        return res.status(400).json({
          message: "Distributor service cannot be assigned to a customer invoice",
        });
      }

      if (!mongoose.isValidObjectId(String(nextDistributorService))) {
        return res.status(400).json({
          message: "Invalid distributor service ID",
        });
      }

      const validatedDistributorService =
        await DistributorService.findById(nextDistributorService);

      if (!validatedDistributorService) {
        return res.status(404).json({
          message: "Distributor service not found",
        });
      }

      if (
        String(validatedDistributorService.distributor) !==
        String(invoice.distributor)
      ) {
        return res.status(400).json({
          message: "Distributor service does not belong to this distributor",
        });
      }
    }

    // VALIDATE SERVICE CYCLE AND AGREEMENT
    if (nextServiceCycle) {
      const cycleId = String(nextServiceCycle);

      if (!mongoose.isValidObjectId(cycleId)) {
        return res.status(400).json({
          message: "Invalid service cycle ID",
        });
      }

      const validatedCycle = await ServiceCycle.findById(cycleId);

      if (!validatedCycle) {
        return res.status(404).json({
          message: "Service cycle not found",
        });
      }

      const agreement = await ServiceAgreement.findById(
        validatedCycle.agreement
      );

      if (!agreement) {
        return res.status(404).json({
          message: "Service agreement not found",
        });
      }

      const isCustomerAgreement = Boolean(agreement.customer);
      const isDistributorAgreement = Boolean(agreement.distributor);

      if (isCustomerAgreement === isDistributorAgreement) {
        return res.status(400).json({
          message: "Service agreement must belong to exactly one customer or distributor",
        });
      }

      if (invoice.customer) {
        if (
          !isCustomerAgreement ||
          String(agreement.customer) !== String(invoice.customer)
        ) {
          return res.status(400).json({
            message: "Service cycle does not belong to this customer",
          });
        }

        if (
          validatedCycle.distributorService ||
          (
            validatedCycle.customerService &&
            String(validatedCycle.customerService) !==
              String(nextCustomerService || "")
          )
        ) {
          return res.status(400).json({
            message: "Service assignment does not match the customer cycle",
          });
        }
      } else {
        if (
          !isDistributorAgreement ||
          String(agreement.distributor) !== String(invoice.distributor)
        ) {
          return res.status(400).json({
            message: "Service cycle does not belong to this distributor",
          });
        }

        if (
          validatedCycle.customerService ||
          (
            validatedCycle.distributorService &&
            String(validatedCycle.distributorService) !==
              String(nextDistributorService || "")
          )
        ) {
          return res.status(400).json({
            message: "Service assignment does not match the distributor cycle",
          });
        }
      }
    }

    // APPLY VALIDATED RELATIONSHIPS
    invoice.customerService = nextCustomerService;
    invoice.distributorService = nextDistributorService;
    invoice.purchaseOrder = nextPurchaseOrder;
    invoice.serviceCycle = nextServiceCycle;
    // INVOICE GROUP
    if (invoiceGroupId !== undefined) {
      if (
        invoiceGroupId === null ||
        invoiceGroupId === ""
      ) {
        invoice.invoiceGroupId = null;
      } else {
        if (
          !mongoose.Types.ObjectId.isValid(
            invoiceGroupId
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid invoice group ID",
          });
        }

        const groupInvoices =
          await Invoice.find({
            invoiceGroupId,
            _id: { $ne: invoice._id },
          }).limit(1);

        if (groupInvoices.length > 0) {
          const groupInvoice =
            groupInvoices[0];

          if (invoice.customer) {
            if (
              !groupInvoice.customer ||
              groupInvoice.customer.toString() !==
                invoice.customer.toString()
            ) {
              return res.status(400).json({
                message:
                  "Invoice group belongs to a different customer",
              });
            }
          }

          if (invoice.distributor) {
            if (
              !groupInvoice.distributor ||
              groupInvoice.distributor.toString() !==
                invoice.distributor.toString()
            ) {
              return res.status(400).json({
                message:
                  "Invoice group belongs to a different distributor",
              });
            }
          }
        }

        invoice.invoiceGroupId =
          invoiceGroupId;
      }
    }

    // BASIC FIELDS
    if (invoiceNumber !== undefined) {
      invoice.invoiceNumber =
        invoiceNumber;
    }

    if (invoiceDate !== undefined) {
      invoice.invoiceDate =
        invoiceDate;
    }

    if (amount !== undefined) {
      if (Number(amount) < 0) {
        return res.status(400).json({
          message:
            "Amount cannot be negative",
        });
      }

      invoice.amount = amount;
    }

    // STATUS
    if (status !== undefined) {
      if (
        ![
          "unpaid",
          "paid",
          "cancelled",
        ].includes(status)
      ) {
        return res.status(400).json({
          message: "Invalid invoice status",
        });
      }

      invoice.status = status;

      if (
        status === "unpaid" ||
        status === "cancelled"
      ) {
        invoice.paymentDate = null;
      }

      if (status === "paid") {
        if (
          paymentDate === null ||
          paymentDate === ""
        ) {
          invoice.paymentDate = null;
        } else if (paymentDate) {
          const parsedPaymentDate =
            new Date(paymentDate);

          if (
            isNaN(
              parsedPaymentDate.getTime()
            )
          ) {
            return res.status(400).json({
              message:
                "Invalid payment date",
            });
          }

          invoice.paymentDate =
            parsedPaymentDate;
        }
      }
    } else if (
      paymentDate !== undefined
    ) {
      if (
        paymentDate === null ||
        paymentDate === ""
      ) {
        invoice.paymentDate = null;
      } else {
        const parsedPaymentDate =
          new Date(paymentDate);

        if (
          isNaN(
            parsedPaymentDate.getTime()
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid payment date",
          });
        }

        invoice.paymentDate =
          parsedPaymentDate;
      }
    }

    // DUE DATE
    if (dueDate !== undefined) {
      if (
        dueDate === null ||
        dueDate === ""
      ) {
        invoice.dueDate = null;
      } else {
        const parsedDueDate =
          new Date(dueDate);

        if (
          isNaN(parsedDueDate.getTime())
        ) {
          return res.status(400).json({
            message:
              "Invalid due date",
          });
        }

        invoice.dueDate =
          parsedDueDate;
      }
    }

    // INSTALLMENT NUMBER
    if (
      installmentNumber !== undefined
    ) {
      if (
        installmentNumber === null ||
        installmentNumber === ""
      ) {
        invoice.installmentNumber =
          null;
      } else {
        const parsedInstallmentNumber =
          Number(installmentNumber);

        if (
          !Number.isInteger(
            parsedInstallmentNumber
          ) ||
          parsedInstallmentNumber < 1
        ) {
          return res.status(400).json({
            message:
              "Installment number must be at least 1",
          });
        }

        invoice.installmentNumber =
          parsedInstallmentNumber;
      }
    }

    // TOTAL INSTALLMENTS
    if (
      totalInstallments !== undefined
    ) {
      if (
        totalInstallments === null ||
        totalInstallments === ""
      ) {
        invoice.totalInstallments =
          null;
      } else {
        const parsedTotalInstallments =
          Number(totalInstallments);

        if (
          !Number.isInteger(
            parsedTotalInstallments
          ) ||
          parsedTotalInstallments < 1
        ) {
          return res.status(400).json({
            message:
              "Total installments must be at least 1",
          });
        }

        invoice.totalInstallments =
          parsedTotalInstallments;
      }
    }

    // CONSISTENCY
    if (
      invoice.installmentNumber !== null &&
      invoice.installmentNumber !==
        undefined &&
      invoice.totalInstallments !==
        null &&
      invoice.totalInstallments !==
        undefined
    ) {
      if (
        Number(invoice.installmentNumber) >
        Number(invoice.totalInstallments)
      ) {
        return res.status(400).json({
          message:
            "Installment number cannot exceed total installments",
        });
      }
    }

    // NOTES
    if (notes !== undefined) {
      invoice.notes = notes;
    }

    // SAVE
    await invoice.save();

    // ==========================================================
    // ACTIVITY
    // ==========================================================

    try {
      const invoiceChanged =
        oldInvoiceNumber !==
          invoice.invoiceNumber ||
        oldAmount !== invoice.amount ||
        status !== undefined ||
        customerService !== undefined ||
        distributorService !== undefined ||
        purchaseOrder !== undefined ||
        invoiceDate !== undefined ||
        paymentDate !== undefined ||
        dueDate !== undefined ||
        installmentNumber !== undefined ||
        totalInstallments !== undefined ||
        invoiceGroupId !== undefined ||
        notes !== undefined;

      // PAYMENT RECEIVED
      if (
        oldStatus !== "paid" &&
        invoice.status === "paid"
      ) {
        if (invoice.customer) {
          await Activity.create({
            customer: invoice.customer,
            type: "payment_received",
            title: "Payment Received",
            description:
              `Payment received for invoice ${invoice.invoiceNumber}`,
            invoice: invoice._id,
          });
        }

        if (invoice.distributor) {
          await Activity.create({
            distributor: invoice.distributor,
            type: "payment_received",
            title: "Payment Received",
            description:
              `Payment received for invoice ${invoice.invoiceNumber}`,
            invoice: invoice._id,
          });
        }
      }
      // NORMAL UPDATE
      else if (invoiceChanged) {
        if (invoice.customer) {
          await Activity.create({
            customer: invoice.customer,
            type: "invoice_updated",
            title: "Invoice Updated",
            description:
              `Invoice ${invoice.invoiceNumber} updated`,
            invoice: invoice._id,
          });
        }

        if (invoice.distributor) {
          await Activity.create({
            distributor: invoice.distributor,
            type: "invoice_updated",
            title: "Invoice Updated",
            description:
              `Invoice ${invoice.invoiceNumber} updated`,
            invoice: invoice._id,
          });
        }
      }
    } catch (activityError) {
      console.error(
        "Update invoice activity error:",
        activityError.message
      );
    }

    res.status(200).json({
      message:
        "Invoice updated successfully",
      invoice,
    });
  } catch (error) {
    console.error(
      "Update invoice error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================================================
// DELETE INVOICE
// ==========================================================

const deleteInvoice = async (req, res) => {
  try {
    const invoice =
      await Invoice.findById(
        req.params.id
      );

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    if (invoice.tallyLinkedAutomatically === true) {
      return res.status(409).json({
        message: "Tally-linked invoices are read-only. Update them in TallyPrime.",
      });
    }

    if (invoice.pdfPublicId) {
      try {
        await cloudinary.uploader.destroy(
          invoice.pdfPublicId,
          {
            resource_type: "raw",
          }
        );
      } catch (deleteError) {
        console.error(
          "Invoice PDF deletion error:",
          deleteError.message
        );
      }
    }

    await invoice.deleteOne();

    res.status(200).json({
      message:
        "Invoice deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete invoice error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ==========================================================
// UPLOAD INVOICE PDF
// ==========================================================

const uploadInvoicePdf = async (
  req,
  res
) => {
  try {
    const invoice =
      await Invoice.findById(
        req.params.id
      );

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "PDF file is required",
      });
    }

    if (invoice.pdfPublicId) {
      try {
        await cloudinary.uploader.destroy(
          invoice.pdfPublicId,
          {
            resource_type: "raw",
          }
        );
      } catch (deleteError) {
        console.error(
          "Old invoice PDF deletion error:",
          deleteError.message
        );
      }
    }

    const publicId =
      `invoices/${invoice._id}_${Date.now()}.pdf`;

    const uploadResult =
      await new Promise(
        (resolve, reject) => {
          const uploadStream =
            cloudinary.uploader.upload_stream(
              {
                resource_type: "raw",
                public_id: publicId,
              },
              (error, result) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(result);
                }
              }
            );

          streamifier
            .createReadStream(
              req.file.buffer
            )
            .pipe(uploadStream);
        }
      );

    invoice.pdfUrl =
      uploadResult.secure_url;

    invoice.pdfFileName =
      req.file.originalname;

    invoice.pdfPublicId =
      uploadResult.public_id;

    await invoice.save();

    res.status(200).json({
      message:
        "Invoice PDF uploaded successfully",
      invoice,
    });
  } catch (error) {
    console.error(
      "Upload invoice PDF error:",
      error.message
    );

    res.status(500).json({
      message:
        "Failed to upload invoice PDF",
    });
  }
};

// ==========================================================
// EXPORTS
// ==========================================================

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoicesByCustomer,
  getInvoicesByCustomerService,
  getInvoicesByDistributorService,
  getInvoicesByDistributor,
  getInvoicesByGroup,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  uploadInvoicePdf,
};

