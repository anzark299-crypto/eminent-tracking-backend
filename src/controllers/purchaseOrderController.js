const mongoose = require("mongoose");
const PurchaseOrder = require("../models/purchaseOrder");
const Quotation = require("../models/quotation");
const Invoice = require("../models/invoice");
const ServiceCycle = require("../models/serviceCycle");
const ServiceAgreement = require("../models/serviceAgreement");
const CustomerService = require("../models/customerService");
const DistributorService = require("../models/distributorService");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const Activity = require("../models/activity");

// =====================================================
// CREATE PURCHASE ORDER
// =====================================================

const createPurchaseOrder = async (req, res) => {
  try {
    let {
      customer,
      customerService,
      distributor,
      distributorService,
      serviceCycle,
      quotation,
      poNumber,
      poDate,
      poIssuedTo,
      ourPoNumber,
      ourPoDate,
      amount,
      notes,
    } = req.body;

    // EXACTLY ONE PARTY
    if (!customer && !distributor) {
      return res.status(400).json({
        message: "Customer or distributor is required",
      });
    }

    if (customer && distributor) {
      return res.status(400).json({
        message:
          "Purchase order cannot belong to both customer and distributor",
      });
    }

    // SERVICE VALIDATION
    if (customer && distributorService) {
      return res.status(400).json({
        message: "Distributor service cannot be linked to a customer PO",
      });
    }

    if (distributor && customerService) {
      return res.status(400).json({
        message: "Customer service cannot be linked to a distributor PO",
      });
    }

    // VALIDATE SERVICE ASSIGNMENT OWNERSHIP
    if (customerService) {
      if (!mongoose.isValidObjectId(customerService)) {
        return res.status(400).json({ message: "Invalid customer service ID" });
      }
      const assignment = await CustomerService.findById(customerService).select("customer");
      if (!assignment) {
        return res.status(404).json({ message: "Customer service assignment not found" });
      }
      if (!customer || String(assignment.customer) !== String(customer)) {
        return res.status(400).json({ message: "Customer service does not belong to this customer" });
      }
    }

    if (distributorService) {
      if (!mongoose.isValidObjectId(distributorService)) {
        return res.status(400).json({ message: "Invalid distributor service ID" });
      }
      const assignment = await DistributorService.findById(distributorService).select("distributor");
      if (!assignment) {
        return res.status(404).json({ message: "Distributor service assignment not found" });
      }
      if (!distributor || String(assignment.distributor) !== String(distributor)) {
        return res.status(400).json({ message: "Distributor service does not belong to this distributor" });
      }
    }

    // VALIDATE QUOTATION OWNERSHIP
    let validatedQuotation = null;

    if (quotation) {
      if (!mongoose.isValidObjectId(quotation)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      validatedQuotation = await Quotation.findById(quotation);

      if (!validatedQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      if (
        String(validatedQuotation.customer || "") !== String(customer || "") ||
        String(validatedQuotation.distributor || "") !== String(distributor || "")
      ) {
        return res.status(400).json({
          message: "Quotation does not belong to the selected party",
        });
      }
    }

    // RESOLVE THE SERVICE CYCLE: explicit cycle first, otherwise quotation cycle.
    let validatedServiceCycle = null;
    let validatedAgreement = null;
    const quotationCycleId = validatedQuotation?.serviceCycle
      ? String(validatedQuotation.serviceCycle)
      : null;
    const requestedCycleId = serviceCycle ? String(serviceCycle) : null;

    if (
      requestedCycleId &&
      quotationCycleId &&
      requestedCycleId !== quotationCycleId
    ) {
      return res.status(400).json({
        message: "Quotation belongs to a different service cycle",
      });
    }

    const effectiveCycleId = requestedCycleId || quotationCycleId;

    if (effectiveCycleId) {
      if (!mongoose.isValidObjectId(effectiveCycleId)) {
        return res.status(400).json({ message: "Invalid service cycle ID" });
      }

      validatedServiceCycle = await ServiceCycle.findById(effectiveCycleId);

      if (!validatedServiceCycle) {
        return res.status(404).json({ message: "Service cycle not found" });
      }

      validatedAgreement = await ServiceAgreement.findById(
        validatedServiceCycle.agreement
      );

      if (!validatedAgreement) {
        return res.status(404).json({ message: "Service agreement not found" });
      }

      const isCustomerAgreement = Boolean(validatedAgreement.customer);
      const isDistributorAgreement = Boolean(validatedAgreement.distributor);

      if (isCustomerAgreement === isDistributorAgreement) {
        return res.status(400).json({
          message: "Service agreement must belong to exactly one party",
        });
      }

      if (isCustomerAgreement) {
        if (
          !customer ||
          String(customer) !== String(validatedAgreement.customer) ||
          distributor
        ) {
          return res.status(400).json({
            message: "Service cycle does not belong to this customer",
          });
        }
      } else {
        if (
          !distributor ||
          String(distributor) !== String(validatedAgreement.distributor) ||
          customer
        ) {
          return res.status(400).json({
            message: "Service cycle does not belong to this distributor",
          });
        }
      }
    }

    // VALIDATE AND INHERIT ONLY THE SELECTED PARTY'S SERVICE ASSIGNMENT.
    if (customer) {
      const cycleAssignment = validatedServiceCycle?.customerService
        ? String(validatedServiceCycle.customerService)
        : null;
      const quotationAssignment = validatedQuotation?.customerService
        ? String(validatedQuotation.customerService)
        : null;

      if (
        cycleAssignment &&
        quotationAssignment &&
        cycleAssignment !== quotationAssignment
      ) {
        return res.status(400).json({
          message: "Quotation customer service conflicts with its service cycle",
        });
      }

      if (
        customerService &&
        cycleAssignment &&
        String(customerService) !== cycleAssignment
      ) {
        return res.status(400).json({
          message: "Customer service assignment does not match this cycle",
        });
      }

      if (
        customerService &&
        quotationAssignment &&
        String(customerService) !== quotationAssignment
      ) {
        return res.status(400).json({
          message: "Customer service assignment does not match the quotation",
        });
      }

      customerService =
        customerService || cycleAssignment || quotationAssignment || null;

      if (customerService) {
        if (!mongoose.isValidObjectId(customerService)) {
          return res.status(400).json({
            message: "Invalid customer service ID",
          });
        }

        const assignment = await CustomerService.findById(customerService)
          .select("customer service");

        if (!assignment) {
          return res.status(404).json({
            message: "Customer service assignment not found",
          });
        }

        if (
          validatedAgreement &&
          String(assignment.service) !== String(validatedAgreement.service)
        ) {
          return res.status(400).json({
            message: "Customer service assignment does not match the service agreement",
          });
        }

        if (String(assignment.customer) !== String(customer)) {
          return res.status(400).json({
            message: "Customer service does not belong to this customer",
          });
        }
      }
    } else {
      const cycleAssignment = validatedServiceCycle?.distributorService
        ? String(validatedServiceCycle.distributorService)
        : null;
      const quotationAssignment = validatedQuotation?.distributorService
        ? String(validatedQuotation.distributorService)
        : null;

      if (
        cycleAssignment &&
        quotationAssignment &&
        cycleAssignment !== quotationAssignment
      ) {
        return res.status(400).json({
          message: "Quotation distributor service conflicts with its service cycle",
        });
      }

      if (
        distributorService &&
        cycleAssignment &&
        String(distributorService) !== cycleAssignment
      ) {
        return res.status(400).json({
          message: "Distributor service assignment does not match this cycle",
        });
      }

      if (
        distributorService &&
        quotationAssignment &&
        String(distributorService) !== quotationAssignment
      ) {
        return res.status(400).json({
          message: "Distributor service assignment does not match the quotation",
        });
      }

      distributorService =
        distributorService || cycleAssignment || quotationAssignment || null;

      if (distributorService) {
        if (!mongoose.isValidObjectId(distributorService)) {
          return res.status(400).json({
            message: "Invalid distributor service ID",
          });
        }

        const assignment = await DistributorService.findById(distributorService)
          .select("distributor service");

        if (!assignment) {
          return res.status(404).json({
            message: "Distributor service assignment not found",
          });
        }

        if (
          validatedAgreement &&
          String(assignment.service) !== String(validatedAgreement.service)
        ) {
          return res.status(400).json({
            message: "Distributor service assignment does not match the service agreement",
          });
        }

        if (String(assignment.distributor) !== String(distributor)) {
          return res.status(400).json({
            message: "Distributor service does not belong to this distributor",
          });
        }
      }
    }
    // BASIC VALIDATION
    if (!poNumber || !poNumber.trim()) {
      return res.status(400).json({
        message: "PO number is required",
      });
    }

    if (!poDate) {
      return res.status(400).json({
        message: "PO date is required",
      });
    }

    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        message: "Amount is required",
      });
    }

    // CREATE PO
    const purchaseOrder = await PurchaseOrder.create({
      customer: customer || null,
      customerService: customerService || null,

      distributor: distributor || null,
      distributorService: distributorService || null,

      serviceCycle: validatedServiceCycle ? validatedServiceCycle._id : null,
      quotation: validatedQuotation ? validatedQuotation._id : null,

      poNumber,
      poDate,
      poIssuedTo,
      ourPoNumber,
      ourPoDate: ourPoDate || null,
      amount,
      notes,
    });

    // =====================================================
    // ACTIVITY
    // =====================================================

    try {
      if (purchaseOrder.customer) {
        await Activity.create({
          customer: purchaseOrder.customer,
          type: "purchase_order_added",
          title: "Purchase Order Added",
          description:
            `Purchase order ${purchaseOrder.poNumber} added`,
          purchaseOrder: purchaseOrder._id,
        });
      }

      if (purchaseOrder.distributor) {
        await Activity.create({
          distributor: purchaseOrder.distributor,
          type: "purchase_order_added",
          title: "Purchase Order Added",
          description:
            `Purchase order ${purchaseOrder.poNumber} added`,
          purchaseOrder: purchaseOrder._id,
        });
      }
    } catch (activityError) {
      console.error(
        "Purchase order activity creation error:",
        activityError.message
      );
    }

    res.status(201).json({
      message: "Purchase order created successfully",
      purchaseOrder,
    });
  } catch (error) {
    console.error("Create purchase order error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// GET CUSTOMER PURCHASE ORDERS
// =====================================================

const getPurchaseOrdersByCustomer = async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrder.find({
      customer: req.params.customerId,
    })
      .populate("customer", "companyName")
      .populate({
        path: "customerService",
        populate: {
          path: "service",
          select: "name description oem category",
        },
      })
      .sort({ poDate: -1 });

    res.status(200).json({
      purchaseOrders,
    });
  } catch (error) {
    console.error(
      "Get customer purchase orders error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// GET DISTRIBUTOR PURCHASE ORDERS
// =====================================================

const getPurchaseOrdersByDistributor = async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrder.find({
      distributor: req.params.distributorId,
    })
      .populate("distributor", "companyName")
      .populate({
        path: "distributorService",
        populate: {
          path: "service",
          select: "name description oem category",
        },
      })
      .sort({ poDate: -1 });

    res.status(200).json({
      purchaseOrders,
    });
  } catch (error) {
    console.error(
      "Get distributor purchase orders error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};
// =====================================================
// =====================================================
// GET PURCHASE ORDERS BY CUSTOMER SERVICE ASSIGNMENT
// =====================================================
const getPurchaseOrdersByCustomerService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.isValidObjectId(serviceId)) {
      return res.status(400).json({ message: "Invalid customer service ID" });
    }

    const assignment = await CustomerService.findById(serviceId).select("customer");
    if (!assignment) {
      return res.status(404).json({ message: "Customer service assignment not found" });
    }

    const purchaseOrders = await PurchaseOrder.find({
      customerService: assignment._id,
      customer: assignment.customer,
    }).sort({ poDate: -1, createdAt: -1 });

    return res.status(200).json({ purchaseOrders });
  } catch (error) {
    console.error("Get customer-service purchase orders error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// =====================================================
// GET PURCHASE ORDERS BY DISTRIBUTOR SERVICE ASSIGNMENT
// =====================================================
const getPurchaseOrdersByDistributorService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.isValidObjectId(serviceId)) {
      return res.status(400).json({ message: "Invalid distributor service ID" });
    }

    const assignment = await DistributorService.findById(serviceId).select("distributor");
    if (!assignment) {
      return res.status(404).json({ message: "Distributor service assignment not found" });
    }

    const purchaseOrders = await PurchaseOrder.find({
      distributorService: assignment._id,
      distributor: assignment.distributor,
    }).sort({ poDate: -1, createdAt: -1 });

    return res.status(200).json({ purchaseOrders });
  } catch (error) {
    console.error("Get distributor-service purchase orders error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};
// GET ALL PURCHASE ORDERS
// =====================================================

const getAllPurchaseOrders = async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrder.find()
      .populate("customer", "companyName")
      .populate("distributor", "companyName")
      .populate({
        path: "customerService",
        populate: {
          path: "service",
          select: "name description oem category",
        },
      })
      .populate({
        path: "distributorService",
        populate: {
          path: "service",
          select: "name description oem category",
        },
      })
      .sort({ poDate: -1 });

    res.status(200).json({
      purchaseOrders,
    });
  } catch (error) {
    console.error(
      "Get all purchase orders error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// GET PURCHASE ORDER BY ID
// =====================================================

const getPurchaseOrderById = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(
      req.params.id
    )
      .populate("customer", "companyName")
      .populate("distributor", "companyName")
      .populate({
        path: "customerService",
        populate: {
          path: "service",
          select: "name description oem category",
        },
      })
      .populate({
        path: "distributorService",
        populate: {
          path: "service",
          select: "name description oem category",
        },
      });

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found",
      });
    }

    res.status(200).json({
      purchaseOrder,
    });
  } catch (error) {
    console.error(
      "Get purchase order error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// UPDATE PURCHASE ORDER
// =====================================================

const updatePurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(
      req.params.id
    );

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found",
      });
    }

    if (purchaseOrder.tallyLinkedAutomatically === true) {
      return res.status(409).json({
        message: "Tally-linked purchase orders are read-only. Update them in TallyPrime.",
      });
    }

    let {
      customerService,
      distributorService,
      serviceCycle,
      quotation,
      poNumber,
      poDate,
      poIssuedTo,
      ourPoNumber,
      ourPoDate,
      amount,
      notes,
    } = req.body;

    // VALIDATE SERVICE LINKS BEFORE MUTATING THE PURCHASE ORDER.
    const partyId = purchaseOrder.customer || purchaseOrder.distributor;
    const isCustomerPO = Boolean(purchaseOrder.customer);
    const isDistributorPO = Boolean(purchaseOrder.distributor);

    if (isCustomerPO === isDistributorPO) {
      return res.status(400).json({
        message: "Purchase order must belong to exactly one party",
      });
    }

    if (isCustomerPO && distributorService !== undefined && distributorService) {
      return res.status(400).json({
        message: "Customer purchase orders cannot use distributor service assignments",
      });
    }

    if (isDistributorPO && customerService !== undefined && customerService) {
      return res.status(400).json({
        message: "Distributor purchase orders cannot use customer service assignments",
      });
    }

    const effectiveQuotationId =
      quotation === undefined
        ? (purchaseOrder.quotation ? String(purchaseOrder.quotation) : null)
        : (quotation ? String(quotation) : null);

    let effectiveCycleId =
      serviceCycle === undefined
        ? (purchaseOrder.serviceCycle ? String(purchaseOrder.serviceCycle) : null)
        : (serviceCycle ? String(serviceCycle) : null);

    let effectiveAssignmentId = isCustomerPO
      ? (
          customerService === undefined
            ? (purchaseOrder.customerService ? String(purchaseOrder.customerService) : null)
            : (customerService ? String(customerService) : null)
        )
      : (
          distributorService === undefined
            ? (purchaseOrder.distributorService ? String(purchaseOrder.distributorService) : null)
            : (distributorService ? String(distributorService) : null)
        );

    const assignmentWasExplicit = isCustomerPO
      ? customerService !== undefined
      : distributorService !== undefined;

    const relationshipChanged =
      serviceCycle !== undefined || quotation !== undefined;

    let validatedQuotation = null;
    let validatedServiceCycle = null;
    let validatedAgreement = null;

    if (effectiveQuotationId) {
      if (!mongoose.isValidObjectId(effectiveQuotationId)) {
        return res.status(400).json({ message: "Invalid quotation ID" });
      }

      validatedQuotation = await Quotation.findById(effectiveQuotationId);

      if (!validatedQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      if (
        String(validatedQuotation.customer || "") !== String(purchaseOrder.customer || "") ||
        String(validatedQuotation.distributor || "") !== String(purchaseOrder.distributor || "")
      ) {
        return res.status(400).json({
          message: "Quotation does not belong to this purchase order's party",
        });
      }
    }

    // If the quotation was explicitly changed and the cycle was omitted,
    // inherit the quotation's service cycle before validating it.
    if (serviceCycle === undefined && quotation !== undefined) {
      effectiveCycleId = validatedQuotation?.serviceCycle
        ? String(validatedQuotation.serviceCycle)
        : null;
    }

    if (effectiveCycleId) {
      if (!mongoose.isValidObjectId(effectiveCycleId)) {
        return res.status(400).json({ message: "Invalid service cycle ID" });
      }

      validatedServiceCycle = await ServiceCycle.findById(effectiveCycleId);

      if (!validatedServiceCycle) {
        return res.status(404).json({ message: "Service cycle not found" });
      }

      validatedAgreement = await ServiceAgreement.findById(
        validatedServiceCycle.agreement
      );

      if (!validatedAgreement) {
        return res.status(404).json({ message: "Service agreement not found" });
      }

      const hasCustomerAgreement = Boolean(validatedAgreement.customer);
      const hasDistributorAgreement = Boolean(validatedAgreement.distributor);

      if (hasCustomerAgreement === hasDistributorAgreement) {
        return res.status(400).json({
          message: "Service agreement must belong to exactly one party",
        });
      }

      if (
        (isCustomerPO &&
          (!hasCustomerAgreement ||
            String(validatedAgreement.customer) !== String(partyId))) ||
        (isDistributorPO &&
          (!hasDistributorAgreement ||
            String(validatedAgreement.distributor) !== String(partyId)))
      ) {
        return res.status(400).json({
          message: "Service cycle does not belong to this purchase order's party",
        });
      }
    }

    if (
      validatedQuotation?.serviceCycle &&
      String(validatedQuotation.serviceCycle) !== String(effectiveCycleId || "")
    ) {
      return res.status(400).json({
        message: "Quotation belongs to a different service cycle",
      });
    }

    const cycleAssignmentId = isCustomerPO
      ? (validatedServiceCycle?.customerService
          ? String(validatedServiceCycle.customerService)
          : null)
      : (validatedServiceCycle?.distributorService
          ? String(validatedServiceCycle.distributorService)
          : null);

    const quotationAssignmentId = isCustomerPO
      ? (validatedQuotation?.customerService
          ? String(validatedQuotation.customerService)
          : null)
      : (validatedQuotation?.distributorService
          ? String(validatedQuotation.distributorService)
          : null);

    if (
      cycleAssignmentId &&
      quotationAssignmentId &&
      cycleAssignmentId !== quotationAssignmentId
    ) {
      return res.status(400).json({
        message: "Quotation service assignment conflicts with its service cycle",
      });
    }

    if (
      assignmentWasExplicit &&
      !effectiveAssignmentId &&
      (cycleAssignmentId || quotationAssignmentId)
    ) {
      return res.status(400).json({
        message: "Cannot clear a service assignment required by the selected quotation or cycle",
      });
    }

    if (!assignmentWasExplicit && relationshipChanged) {
      effectiveAssignmentId =
        cycleAssignmentId ||
        quotationAssignmentId ||
        (quotation === undefined ? effectiveAssignmentId : null);
    }

    if (
      effectiveAssignmentId &&
      ((cycleAssignmentId && effectiveAssignmentId !== cycleAssignmentId) ||
        (quotationAssignmentId && effectiveAssignmentId !== quotationAssignmentId))
    ) {
      return res.status(400).json({
        message: "Service assignment conflicts with the selected quotation or cycle",
      });
    }

    if (effectiveAssignmentId) {
      if (!mongoose.isValidObjectId(effectiveAssignmentId)) {
        return res.status(400).json({
          message: isCustomerPO
            ? "Invalid customer service ID"
            : "Invalid distributor service ID",
        });
      }

      const assignment = isCustomerPO
        ? await CustomerService.findById(effectiveAssignmentId).select("customer service")
        : await DistributorService.findById(effectiveAssignmentId).select("distributor service");

      if (!assignment) {
        return res.status(404).json({
          message: "Service assignment not found",
        });
      }

      const assignmentPartyId = isCustomerPO
        ? assignment.customer
        : assignment.distributor;

      if (String(assignmentPartyId) !== String(partyId)) {
        return res.status(400).json({
          message: "Service assignment does not belong to this purchase order's party",
        });
      }

      if (
        validatedAgreement &&
        String(assignment.service) !== String(validatedAgreement.service)
      ) {
        return res.status(400).json({
          message: "Service assignment does not match the service agreement",
        });
      }
    }

    // All relationship checks passed. Now apply the validated links.
    if (isCustomerPO && (customerService !== undefined || relationshipChanged)) {
      purchaseOrder.customerService = effectiveAssignmentId || null;
    }

    if (isDistributorPO && (distributorService !== undefined || relationshipChanged)) {
      purchaseOrder.distributorService = effectiveAssignmentId || null;
    }

    if (serviceCycle !== undefined || quotation !== undefined) {
      purchaseOrder.serviceCycle = validatedServiceCycle
        ? validatedServiceCycle._id
        : null;
    }

    if (quotation !== undefined) {
      purchaseOrder.quotation = validatedQuotation
        ? validatedQuotation._id
        : null;
    }

    // BASIC FIELDS
    if (poNumber !== undefined) {
      purchaseOrder.poNumber = poNumber;
    }

    if (poDate !== undefined) {
      purchaseOrder.poDate = poDate;
    }

    if (poIssuedTo !== undefined) {
      purchaseOrder.poIssuedTo = poIssuedTo || null;
    }

    if (ourPoNumber !== undefined) {
      purchaseOrder.ourPoNumber = ourPoNumber || null;
    }

    if (ourPoDate !== undefined) {
      purchaseOrder.ourPoDate = ourPoDate || null;
    }

    if (amount !== undefined) {
      purchaseOrder.amount = amount;
    }

    if (notes !== undefined) {
      purchaseOrder.notes = notes || null;
    }

    // SAVE FIRST
    await purchaseOrder.save();

    // =====================================================
    // ACTIVITY
    // =====================================================

    try {
      if (purchaseOrder.customer) {
        await Activity.create({
          customer: purchaseOrder.customer,
          type: "purchase_order_updated",
          title: "Purchase Order Updated",
          description:
            `Purchase order ${purchaseOrder.poNumber} was updated`,
          purchaseOrder: purchaseOrder._id,
        });
      }

      if (purchaseOrder.distributor) {
        await Activity.create({
          distributor: purchaseOrder.distributor,
          type: "purchase_order_updated",
          title: "Purchase Order Updated",
          description:
            `Purchase order ${purchaseOrder.poNumber} was updated`,
          purchaseOrder: purchaseOrder._id,
        });
      }
    } catch (activityError) {
      console.error(
        "Purchase order update activity creation error:",
        activityError
      );
    }

    res.status(200).json({
      message: "Purchase order updated successfully",
      purchaseOrder,
    });
  } catch (error) {
    console.error(
      "Update purchase order error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};// =====================================================
// DELETE PURCHASE ORDER
// =====================================================

const deletePurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(
      req.params.id
    );

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found",
      });
    }

    if (purchaseOrder.tallyLinkedAutomatically === true) {
      return res.status(409).json({
        message: "Tally-linked purchase orders are read-only. Update them in TallyPrime.",
      });
    }

    // Prevent deletion when invoices reference this purchase order.
    const linkedInvoices = await Invoice.exists({
      purchaseOrder: purchaseOrder._id,
    });

    if (linkedInvoices) {
      return res.status(409).json({
        message:
          "This purchase order cannot be deleted because invoices are linked to it.",
      });
    }

    // DELETE PDF
    if (purchaseOrder.pdfPublicId) {
      try {
        await cloudinary.uploader.destroy(
          purchaseOrder.pdfPublicId,
          {
            resource_type: "raw",
          }
        );
      } catch (deleteError) {
        console.error(
          "PDF deletion error:",
          deleteError.message
        );
      }
    }

    await purchaseOrder.deleteOne();

    res.status(200).json({
      message: "Purchase order deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete purchase order error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// UPLOAD PURCHASE ORDER PDF
// =====================================================

const uploadPurchaseOrderPdf = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(
      req.params.id
    );

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "PDF file is required",
      });
    }

    // DELETE OLD PDF
    if (purchaseOrder.pdfPublicId) {
      try {
        await cloudinary.uploader.destroy(
          purchaseOrder.pdfPublicId,
          {
            resource_type: "raw",
          }
        );
      } catch (deleteError) {
        console.error(
          "Old PDF deletion error:",
          deleteError.message
        );
      }
    }

    // UPLOAD NEW PDF
    const publicId =
      `purchase-orders/${purchaseOrder._id}_${Date.now()}`;

    const uploadResult = await new Promise(
      (resolve, reject) => {
        const uploadStream =
          cloudinary.uploader.upload_stream(
            {
              resource_type: "raw",
              public_id: publicId,
              format: "pdf",
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
          .createReadStream(req.file.buffer)
          .pipe(uploadStream);
      }
    );

    purchaseOrder.pdfUrl =
      uploadResult.secure_url;

    purchaseOrder.pdfFileName =
      req.file.originalname;

    purchaseOrder.pdfPublicId =
      uploadResult.public_id;

    await purchaseOrder.save();

    res.status(200).json({
      message: "Purchase order PDF uploaded successfully",
      purchaseOrder,
    });
  } catch (error) {
    console.error(
      "Upload purchase order PDF error:",
      error.message
    );

    res.status(500).json({
      message: "Failed to upload purchase order PDF",
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createPurchaseOrder,
  getPurchaseOrdersByCustomer,
  getPurchaseOrdersByCustomerService,
  getPurchaseOrdersByDistributorService,
  getPurchaseOrdersByDistributor,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  uploadPurchaseOrderPdf,
};
