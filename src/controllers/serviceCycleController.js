const mongoose = require("mongoose");
const ServiceAgreement = require("../models/serviceAgreement");
const ServiceCycle = require("../models/serviceCycle");
const CustomerService = require("../models/customerService");
const DistributorService = require("../models/distributorService");
const Customer = require("../models/customer");
const Distributor = require("../models/distributor");
const Service = require("../models/service");
const Quotation = require("../models/quotation");
const PurchaseOrder = require("../models/purchaseOrder");
const Invoice = require("../models/invoice");
const Payment = require("../models/payment");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const sameId = (a, b) =>
  Boolean(a && b && String(a) === String(b));

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validatePartyAssignment = async ({
  agreement,
  customerServiceId,
  distributorServiceId,
}) => {
  const customerAgreement = Boolean(agreement.customer);
  const distributorAgreement = Boolean(agreement.distributor);

  if (customerAgreement === distributorAgreement) {
    return "Agreement must belong to exactly one customer or distributor.";
  }

  if (customerServiceId && !isValidId(customerServiceId)) {
    return "Invalid customer service assignment ID.";
  }

  if (distributorServiceId && !isValidId(distributorServiceId)) {
    return "Invalid distributor service assignment ID.";
  }

  let customerAssignment = null;
  let distributorAssignment = null;

  if (customerServiceId) {
    customerAssignment = await CustomerService.findById(customerServiceId);
    if (!customerAssignment) {
      return "Customer service assignment not found.";
    }

    if (
      !sameId(customerAssignment.service, agreement.service)
    ) {
      return "Customer service assignment uses a different master service.";
    }
  }

  if (distributorServiceId) {
    distributorAssignment = await DistributorService.findById(
      distributorServiceId
    );

    if (!distributorAssignment) {
      return "Distributor service assignment not found.";
    }

    if (!sameId(distributorAssignment.service, agreement.service)) {
      return "Distributor service assignment uses a different master service.";
    }
  }

  if (customerAgreement) {
    if (
      customerAssignment &&
      !sameId(customerAssignment.customer, agreement.customer)
    ) {
      return "Customer service assignment does not match this agreement.";
    }

    if (distributorAssignment && !customerAssignment) {
      return "Both explicitly linked service assignments are required.";
    }

    if (distributorAssignment) {
      if (
        !sameId(
          customerAssignment.linkedDistributor,
          distributorAssignment.distributor
        ) ||
        !sameId(
          distributorAssignment.linkedCustomer,
          agreement.customer
        )
      ) {
        return "Customer and distributor assignments are not explicitly linked to each other.";
      }
    }
  } else {
    if (
      distributorAssignment &&
      !sameId(distributorAssignment.distributor, agreement.distributor)
    ) {
      return "Distributor service assignment does not match this agreement.";
    }

    if (customerAssignment && !distributorAssignment) {
      return "Both explicitly linked service assignments are required.";
    }

    if (customerAssignment) {
      if (
        !sameId(
          distributorAssignment.linkedCustomer,
          customerAssignment.customer
        ) ||
        !sameId(
          customerAssignment.linkedDistributor,
          agreement.distributor
        )
      ) {
        return "Customer and distributor assignments are not explicitly linked to each other.";
      }
    }
  }

  return null;
};

const validateAgreementReferences = async ({
  customer,
  distributor,
  service,
}) => {
  const serviceRecord = await Service.findById(service);
  if (!serviceRecord) {
    return "Master service not found.";
  }

  if (customer) {
    const customerRecord = await Customer.findById(customer);
    if (!customerRecord) {
      return "Customer not found.";
    }
  }

  if (distributor) {
    const distributorRecord = await Distributor.findById(distributor);
    if (!distributorRecord) {
      return "Distributor not found.";
    }
  }

  return null;
};

const validateCycleDates = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) {
    return { error: "Valid startDate and endDate are required." };
  }

  if (end <= start) {
    return { error: "endDate must be later than startDate." };
  }

  return { start, end };
};

// POST /api/service-cycles/agreements
const createAgreementWithInitialCycle = async (req, res) => {
  const createdAgreementIds = [];
  const createdCycleIds = [];

  try {
    const {
      customer,
      distributor,
      service,
      title,
      notes,
      startDate,
      endDate,
      customerAmount,
      distributorAmount,
      currency,
      serviceVersion,
      packageName,
      specifications,
      customerService,
      distributorService,
      cycleNotes,
      counterpartTitle,
      counterpartNotes,
      counterpartStartDate,
      counterpartEndDate,
      counterpartCycleNotes,
      counterpartCustomerAmount,
      counterpartDistributorAmount,
      counterpartCurrency,
      counterpartServiceVersion,
      counterpartPackageName,
      counterpartSpecifications,
    } = req.body;

    if (Boolean(customer) === Boolean(distributor)) {
      return res.status(400).json({
        message: "Provide exactly one of customer or distributor.",
      });
    }

    if (!isValidId(service)) {
      return res.status(400).json({ message: "Valid service ID is required." });
    }

    if (customer && !isValidId(customer)) {
      return res.status(400).json({ message: "Invalid customer ID." });
    }

    if (distributor && !isValidId(distributor)) {
      return res.status(400).json({ message: "Invalid distributor ID." });
    }

    const referenceError = await validateAgreementReferences({
      customer,
      distributor,
      service,
    });

    if (referenceError) {
      return res.status(404).json({ message: referenceError });
    }

    const dates = validateCycleDates(startDate, endDate);

    if (dates.error) {
      return res.status(400).json({ message: dates.error });
    }

    const agreement = new ServiceAgreement({
      customer: customer || null,
      distributor: distributor || null,
      service,
      title,
      notes,
      status: "active",
    });

    const assignmentError = await validatePartyAssignment({
      agreement,
      customerServiceId: customerService,
      distributorServiceId: distributorService,
    });

    if (assignmentError) {
      return res.status(400).json({ message: assignmentError });
    }

    const paired = Boolean(customerService && distributorService);

    let counterpartAgreement = null;
    let counterpartCycle = null;
    let counterpartDates = null;
    let counterpartCustomer = null;
    let counterpartDistributor = null;

    if (paired) {
      counterpartDates = validateCycleDates(
        counterpartStartDate,
        counterpartEndDate
      );

      if (counterpartDates.error) {
        return res.status(400).json({
          message: `Counterpart cycle: ${counterpartDates.error}`,
        });
      }

      const [customerAssignment, distributorAssignment] =
        await Promise.all([
          CustomerService.findById(customerService),
          DistributorService.findById(distributorService),
        ]);

      if (!customerAssignment || !distributorAssignment) {
        return res.status(404).json({
          message: "One of the linked service assignments was not found.",
        });
      }

      counterpartCustomer = customer
        ? null
        : customerAssignment.customer;

      counterpartDistributor = distributor
        ? null
        : distributorAssignment.distributor;

      const counterpartReferenceError =
        await validateAgreementReferences({
          customer: counterpartCustomer,
          distributor: counterpartDistributor,
          service,
        });

      if (counterpartReferenceError) {
        return res.status(404).json({
          message: counterpartReferenceError,
        });
      }

      counterpartAgreement = new ServiceAgreement({
        customer: counterpartCustomer || null,
        distributor: counterpartDistributor || null,
        service,
        title: counterpartTitle ?? title,
        notes: counterpartNotes ?? "",
        status: "active",
      });

      agreement.counterpartAgreement = counterpartAgreement._id;
      counterpartAgreement.counterpartAgreement = agreement._id;

      await counterpartAgreement.validate();
    }

    const cycle = new ServiceCycle({
      agreement: agreement._id,
      cycleNumber: 1,
      cycleType: "initial",
      startDate: dates.start,
      endDate: dates.end,
      customerAmount: customerAmount ?? null,
      distributorAmount: distributorAmount ?? null,
      currency: currency || "INR",
      serviceVersion: serviceVersion || "",
      packageName: packageName || "",
      specifications: specifications || {},
      status: "draft",
      customerService: customer ? (customerService || null) : null,
      distributorService: distributor ? (distributorService || null) : null,
      notes: cycleNotes || "",
    });

    if (paired) {
      counterpartCycle = new ServiceCycle({
        agreement: counterpartAgreement._id,
        cycleNumber: 1,
        cycleType: "initial",
        startDate: counterpartDates.start,
        endDate: counterpartDates.end,
        customerAmount: counterpartCustomerAmount ?? null,
        distributorAmount: counterpartDistributorAmount ?? null,
        currency: counterpartCurrency || "INR",
        serviceVersion: counterpartServiceVersion || "",
        packageName: counterpartPackageName || "",
        specifications: counterpartSpecifications || {},
        status: "draft",
        customerService: counterpartCustomer ? (customerService || null) : null,
        distributorService: counterpartDistributor ? (distributorService || null) : null,
        notes: counterpartCycleNotes || "",
      });

      cycle.counterpartCycle = counterpartCycle._id;
      counterpartCycle.counterpartCycle = cycle._id;
    }

    await agreement.validate();
    await cycle.validate();

    if (counterpartCycle) {
      await counterpartCycle.validate();
    }

    await agreement.save();
    createdAgreementIds.push(agreement._id);

    if (counterpartAgreement) {
      await counterpartAgreement.save();
      createdAgreementIds.push(counterpartAgreement._id);
    }

    await cycle.save();
    createdCycleIds.push(cycle._id);

    if (counterpartCycle) {
      await counterpartCycle.save();
      createdCycleIds.push(counterpartCycle._id);
    }

    return res.status(201).json({
      message: paired
        ? "Paired service agreements and initial cycles created."
        : "Service agreement and initial cycle created.",
      agreement,
      cycle,
      ...(paired
        ? {
            paired: true,
            counterpartAgreement,
            counterpartCycle,
          }
        : {}),
    });
  } catch (error) {
    try {
      if (createdCycleIds.length) {
        await ServiceCycle.deleteMany({
          _id: { $in: createdCycleIds },
        });
      }

      if (createdAgreementIds.length) {
        await ServiceAgreement.deleteMany({
          _id: { $in: createdAgreementIds },
        });
      }
    } catch (cleanupError) {
      console.error("Create agreement/cycle cleanup error:", cleanupError);
    }

    console.error("Create agreement/cycle error:", error);

    return res.status(500).json({
      message: "Failed to create service agreement and initial cycle.",
      error: error.code === 11000
        ? "A duplicate cycle number was detected."
        : error.message,
    });
  }
};
// GET /api/service-cycles/agreements/:agreementId
const getServiceCyclesByAssignment = async (req, res) => {
  try {
    const { serviceType, serviceId } = req.params;

    if (!isValidId(serviceId)) {
      return res.status(400).json({ message: "Invalid service ID." });
    }

    const assignmentField =
      serviceType === "customer"
        ? "customerService"
        : serviceType === "distributor"
          ? "distributorService"
          : null;

    if (!assignmentField) {
      return res.status(400).json({
        message: "Service type must be customer or distributor.",
      });
    }

    const assignmentModel =
      serviceType === "customer" ? CustomerService : DistributorService;

    const assignment = await assignmentModel.findById(serviceId);

    if (!assignment) {
      return res.status(404).json({ message: "Service assignment not found." });
    }

    const cycleRecords = await ServiceCycle.find({
      [assignmentField]: assignment._id,
    })
      .sort({ agreement: 1, cycleNumber: 1 })
      .populate("previousCycle")
      .populate("counterpartCycle")
      .populate("customerService")
      .populate("distributorService");

    const agreementIds = [
      ...new Set(cycleRecords.map((cycle) => String(cycle.agreement))),
    ];

    const agreements = await Promise.all(
      agreementIds.map(async (agreementId) => {
        const agreement = await ServiceAgreement.findById(agreementId);
        if (!agreement) return null;

        const matchingCycles = cycleRecords.filter(
          (cycle) => String(cycle.agreement) === agreementId
        );

        const cycles = await Promise.all(
          matchingCycles.map(async (cycle) => {
            const documentCycleIds = [cycle._id];
            const counterpartCycle = cycle.counterpartCycle;

            if (
              counterpartCycle &&
              sameId(counterpartCycle.counterpartCycle, cycle._id)
            ) {
              documentCycleIds.push(counterpartCycle._id);
            }

            const [quotations, purchaseOrders, invoices] = await Promise.all([
              Quotation.find({ serviceCycle: { $in: documentCycleIds } })
                .sort({ quotationDate: 1, createdAt: 1 }),
              PurchaseOrder.find({ serviceCycle: { $in: documentCycleIds } })
                .populate("quotation", "quotationNumber quotationDate amount status")
                .sort({ poDate: 1, createdAt: 1 }),
              Invoice.find({ serviceCycle: { $in: documentCycleIds } })
                .populate({
                  path: "purchaseOrder",
                  select: "poNumber poDate amount quotation",
                  populate: {
                    path: "quotation",
                    select: "quotationNumber quotationDate amount status",
                  },
                })
                .sort({ invoiceDate: 1, createdAt: 1 }),
            ]);

            // Only expose payments that are already linked to an invoice in
            // this cycle. Unallocated Tally payments must not be guessed into
            // a cycle or shown as a completed workflow relationship.
            const invoiceIds = invoices.map((invoice) => invoice._id);
            const payments = invoiceIds.length
              ? await Payment.find({
                  invoice: { $in: invoiceIds },
                  isCancelled: { $ne: true },
                })
                  .populate(
                    "invoice",
                    "invoiceNumber invoiceDate amount status tallyPaymentStatus"
                  )
                  .sort({ paymentDate: 1, createdAt: 1 })
                  .lean()
              : [];

            return {
              ...cycle.toObject(),
              documents: { quotations, purchaseOrders, invoices, payments },
            };
          })
        );

        return { agreement, cycles };
      })
    );

    return res.status(200).json({
      serviceType,
      serviceId,
      agreements: agreements.filter(Boolean),
    });
  } catch (error) {
    console.error("Get service cycles by assignment error:", error);
    return res.status(500).json({
      message: "Failed to fetch service cycles for this assignment.",
    });
  }
};
const getAgreementCycles = async (req, res) => {
  try {
    const { agreementId } = req.params;

    if (!isValidId(agreementId)) {
      return res.status(400).json({ message: "Invalid agreement ID." });
    }

    const agreement = await ServiceAgreement.findById(agreementId);

    if (!agreement) {
      return res.status(404).json({ message: "Service agreement not found." });
    }

    const cycleRecords = await ServiceCycle.find({ agreement: agreement._id })
      .sort({ cycleNumber: 1 })
      .populate("previousCycle")
      .populate("counterpartCycle")
      .populate("customerService")
      .populate("distributorService");

    const cycles = await Promise.all(
      cycleRecords.map(async (cycle) => {
        const documentCycleIds = [cycle._id];
            const counterpartCycle = cycle.counterpartCycle;

            if (
              counterpartCycle &&
              sameId(counterpartCycle.counterpartCycle, cycle._id)
            ) {
              documentCycleIds.push(counterpartCycle._id);
            }

            const [quotations, purchaseOrders, invoices] = await Promise.all([
          Quotation.find({ serviceCycle: { $in: documentCycleIds } })
            .sort({ quotationDate: 1, createdAt: 1 }),

          PurchaseOrder.find({ serviceCycle: { $in: documentCycleIds } })
            .populate("quotation", "quotationNumber quotationDate amount status")
            .sort({ poDate: 1, createdAt: 1 }),

          Invoice.find({ serviceCycle: { $in: documentCycleIds } })
            .populate({
              path: "purchaseOrder",
              select: "poNumber poDate amount quotation",
              populate: {
                path: "quotation",
                select: "quotationNumber quotationDate amount status",
              },
            })
            .sort({ invoiceDate: 1, createdAt: 1 }),
        ]);

        const invoiceIds = invoices.map((invoice) => invoice._id);
        const payments = invoiceIds.length
          ? await Payment.find({
              invoice: { $in: invoiceIds },
              isCancelled: { $ne: true },
            })
              .populate(
                "invoice",
                "invoiceNumber invoiceDate amount status tallyPaymentStatus"
              )
              .sort({ paymentDate: 1, createdAt: 1 })
              .lean()
          : [];

        return {
          ...cycle.toObject(),
          documents: {
            quotations,
            purchaseOrders,
            invoices,
            payments,
          },
        };
      })
    );

    return res.status(200).json({ agreement, cycles });
  } catch (error) {
    console.error("Get agreement cycles error:", error);

    return res.status(500).json({
      message: "Failed to fetch service cycles.",
    });
  }
};

// POST /api/service-cycles/:cycleId/renew
const renewServiceCycle = async (req, res) => {
  let createdCycleIds = [];

  try {
    const { cycleId } = req.params;

    if (!isValidId(cycleId)) {
      return res.status(400).json({ message: "Invalid cycle ID." });
    }

    const previousCycle = await ServiceCycle.findById(cycleId);

    if (!previousCycle) {
      return res.status(404).json({ message: "Previous cycle not found." });
    }

    const agreement = await ServiceAgreement.findById(
      previousCycle.agreement
    );

    if (!agreement) {
      return res.status(404).json({ message: "Service agreement not found." });
    }

    const referenceError = await validateAgreementReferences({
      customer: agreement.customer,
      distributor: agreement.distributor,
      service: agreement.service,
    });

    if (referenceError) {
      return res.status(404).json({ message: referenceError });
    }

    const dates = validateCycleDates(
      req.body.startDate,
      req.body.endDate
    );

    if (dates.error) {
      return res.status(400).json({ message: dates.error });
    }

    const customerServiceId =
      req.body.customerService ?? previousCycle.customerService;

    const distributorServiceId =
      req.body.distributorService ?? previousCycle.distributorService;

    const assignmentError = await validatePartyAssignment({
      agreement,
      customerServiceId,
      distributorServiceId,
    });

    if (assignmentError) {
      return res.status(400).json({ message: assignmentError });
    }

    const latestCycle = await ServiceCycle.findOne({
      agreement: agreement._id,
    }).sort({ cycleNumber: -1 });

    if (!latestCycle || !sameId(latestCycle._id, previousCycle._id)) {
      return res.status(409).json({
        message: "Only the latest cycle can be renewed.",
      });
    }

    const hasCounterpartCycle = Boolean(previousCycle.counterpartCycle);
    const hasCounterpartAgreement = Boolean(agreement.counterpartAgreement);

    if (hasCounterpartCycle !== hasCounterpartAgreement) {
      return res.status(409).json({
        message: "The paired agreement or cycle relationship is incomplete.",
      });
    }

    const paired = hasCounterpartCycle && hasCounterpartAgreement;

    let counterpartPreviousCycle = null;
    let counterpartAgreement = null;
    let counterpartDates = null;
    let counterpartCustomer = null;
    let counterpartDistributor = null;
    let counterpartCycle = null;

    if (paired) {
      if (!customerServiceId || !distributorServiceId) {
        return res.status(400).json({
          message: "Both linked service assignment IDs are required.",
        });
      }

      counterpartPreviousCycle = await ServiceCycle.findById(
        previousCycle.counterpartCycle
      );

      counterpartAgreement = await ServiceAgreement.findById(
        agreement.counterpartAgreement
      );

      if (!counterpartPreviousCycle || !counterpartAgreement) {
        return res.status(404).json({
          message: "The counterpart agreement or previous cycle was not found.",
        });
      }

      if (
        !sameId(
          counterpartPreviousCycle.counterpartCycle,
          previousCycle._id
        ) ||
        !sameId(counterpartPreviousCycle.agreement, counterpartAgreement._id) ||
        !sameId(counterpartAgreement.counterpartAgreement, agreement._id)
      ) {
        return res.status(409).json({
          message: "The reciprocal counterpart links do not match.",
        });
      }

      const counterpartReferenceError =
        await validateAgreementReferences({
          customer: counterpartAgreement.customer,
          distributor: counterpartAgreement.distributor,
          service: counterpartAgreement.service,
        });

      if (counterpartReferenceError) {
        return res.status(404).json({
          message: counterpartReferenceError,
        });
      }

      if (!sameId(counterpartAgreement.service, agreement.service)) {
        return res.status(409).json({
          message: "The paired agreements use different master services.",
        });
      }

      const counterpartAssignmentError = await validatePartyAssignment({
        agreement: counterpartAgreement,
        customerServiceId,
        distributorServiceId,
      });

      if (counterpartAssignmentError) {
        return res.status(400).json({
          message: counterpartAssignmentError,
        });
      }

      counterpartDates = validateCycleDates(
        req.body.counterpartStartDate,
        req.body.counterpartEndDate
      );

      if (counterpartDates.error) {
        return res.status(400).json({
          message: `Counterpart cycle: ${counterpartDates.error}`,
        });
      }

      const latestCounterpartCycle = await ServiceCycle.findOne({
        agreement: counterpartAgreement._id,
      }).sort({ cycleNumber: -1 });

      if (
        !latestCounterpartCycle ||
        !sameId(latestCounterpartCycle._id, counterpartPreviousCycle._id)
      ) {
        return res.status(409).json({
          message: "Only the latest counterpart cycle can be renewed.",
        });
      }
    }

    const cycle = new ServiceCycle({
      agreement: agreement._id,
      cycleNumber: previousCycle.cycleNumber + 1,
      previousCycle: previousCycle._id,
      cycleType: "renewal",
      startDate: dates.start,
      endDate: dates.end,
      customerAmount:
        req.body.customerAmount ?? previousCycle.customerAmount,
      distributorAmount:
        req.body.distributorAmount ?? previousCycle.distributorAmount,
      currency: req.body.currency ?? previousCycle.currency,
      serviceVersion:
        req.body.serviceVersion ?? previousCycle.serviceVersion,
      packageName: req.body.packageName ?? previousCycle.packageName,
      specifications:
        req.body.specifications ?? previousCycle.specifications,
      status: "draft",
      customerService: agreement.customer ? (customerServiceId || null) : null,
      distributorService: agreement.distributor ? (distributorServiceId || null) : null,
      notes: req.body.cycleNotes ?? "",
    });

    if (paired) {
      counterpartCycle = new ServiceCycle({
        agreement: counterpartAgreement._id,
        cycleNumber: counterpartPreviousCycle.cycleNumber + 1,
        previousCycle: counterpartPreviousCycle._id,
        previousCounterpartCycle: previousCycle._id,
        cycleType: "renewal",
        startDate: counterpartDates.start,
        endDate: counterpartDates.end,
        customerAmount:
          req.body.counterpartCustomerAmount ??
          counterpartPreviousCycle.customerAmount,
        distributorAmount:
          req.body.counterpartDistributorAmount ??
          counterpartPreviousCycle.distributorAmount,
        currency:
          req.body.counterpartCurrency ??
          counterpartPreviousCycle.currency,
        serviceVersion:
          req.body.counterpartServiceVersion ??
          counterpartPreviousCycle.serviceVersion,
        packageName:
          req.body.counterpartPackageName ??
          counterpartPreviousCycle.packageName,
        specifications:
          req.body.counterpartSpecifications ??
          counterpartPreviousCycle.specifications,
        status: "draft",
        customerService: counterpartAgreement.customer ? customerServiceId : null,
        distributorService: counterpartAgreement.distributor ? distributorServiceId : null,
        notes: req.body.counterpartCycleNotes ?? "",
      });

      cycle.counterpartCycle = counterpartCycle._id;
      cycle.previousCounterpartCycle = counterpartPreviousCycle._id;

      counterpartCycle.counterpartCycle = cycle._id;
    }

    await cycle.validate();

    if (counterpartCycle) {
      await counterpartCycle.validate();
    }

    await cycle.save();
    createdCycleIds.push(cycle._id);

    if (counterpartCycle) {
      await counterpartCycle.save();
      createdCycleIds.push(counterpartCycle._id);
    }

    return res.status(201).json({
      message: paired
        ? "Paired renewal cycles created. Previous cycles preserved."
        : "Renewal cycle created. Previous cycle preserved.",
      previousCycle,
      cycle,
      ...(paired
        ? {
            paired: true,
            counterpartPreviousCycle,
            counterpartCycle,
          }
        : {}),
    });
  } catch (error) {
    try {
      if (createdCycleIds.length) {
        await ServiceCycle.deleteMany({
          _id: { $in: createdCycleIds },
        });
      }
    } catch (cleanupError) {
      console.error("Renew cycle cleanup error:", cleanupError);
    }

    console.error("Renew service cycle error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "A renewal cycle already exists. Refresh and try again.",
      });
    }

    return res.status(500).json({
      message: "Failed to renew service cycle.",
    });
  }
};
const deleteServiceCycle = async (req, res) => {
  try {
    const { cycleId } = req.params;

    if (!isValidId(cycleId)) {
      return res.status(400).json({ message: "Invalid cycle ID." });
    }

    const cycle = await ServiceCycle.findById(cycleId);

    if (!cycle) {
      return res.status(404).json({ message: "Service cycle not found." });
    }

    const [
      quotations,
      purchaseOrders,
      invoices,
      dependentCycles,
      dependentCounterpartCycles,
    ] = await Promise.all([
      Quotation.exists({ serviceCycle: cycle._id }),
      PurchaseOrder.exists({ serviceCycle: cycle._id }),
      Invoice.exists({ serviceCycle: cycle._id }),
      ServiceCycle.exists({ previousCycle: cycle._id }),
      ServiceCycle.exists({ previousCounterpartCycle: cycle._id }),
    ]);

    if (
      quotations ||
      purchaseOrders ||
      invoices ||
      dependentCycles ||
      dependentCounterpartCycles
    ) {
      return res.status(409).json({
        message:
          "This cycle cannot be deleted because it has linked documents or a renewal cycle. Remove or resolve those dependencies first.",
      });
    }

    // Detach only the reciprocal counterpart cycle.
    // Keep the counterpart cycle and its documents intact.
    if (cycle.counterpartCycle) {
      await ServiceCycle.updateOne(
        {
          _id: cycle.counterpartCycle,
          counterpartCycle: cycle._id,
        },
        {
          $set: { counterpartCycle: null },
        }
      );

      // Clear only a previous-counterpart reference to this cycle.
      await ServiceCycle.updateOne(
        {
          _id: cycle.counterpartCycle,
          previousCounterpartCycle: cycle._id,
        },
        {
          $set: { previousCounterpartCycle: null },
        }
      );
    }

    // Payments are linked to invoices, so never delete payments here.
    await ServiceCycle.deleteOne({ _id: cycle._id });

    return res.status(200).json({
      message: "Service cycle deleted successfully.",
      cycleId: String(cycle._id),
    });
  } catch (error) {
    console.error("Delete service cycle error:", error);

    return res.status(500).json({
      message: "Failed to delete service cycle.",
    });
  }
};
module.exports = {
  createAgreementWithInitialCycle,
  getAgreementCycles,
  getServiceCyclesByAssignment,
  renewServiceCycle,
  deleteServiceCycle,
};




