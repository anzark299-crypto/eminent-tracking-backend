const DistributorService = require("../models/distributorService");
const Distributor = require("../models/distributor");
const Service = require("../models/service");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const Activity = require("../models/activity");
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

  result.setDate(
    Math.min(originalDay, lastDay)
  );

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

// ============================================================
// GENERATE PAYMENT SCHEDULE
// ============================================================

const generateInstallments = ({
  paymentType,
  totalPayableAmount,
  installmentAmount,
  numberOfInstallments,
  firstPaymentDueDate,
  installmentFrequency,
}) => {
  // ----------------------------------------------------------
  // ONE TIME
  // ----------------------------------------------------------

  if (paymentType === "one_time") {
    return [
      {
        installmentNumber: 1,
        amount: Number(totalPayableAmount),
        dueDate: firstPaymentDueDate
          ? new Date(firstPaymentDueDate)
          : new Date(),

        status: "upcoming",

        paymentDate: null,

        invoiceNumber: null,
        invoiceId: null,

        invoicePdfUrl: null,
        invoicePdfFileName: null,
        invoicePdfPublicId: null,
      },
    ];
  }

  // ----------------------------------------------------------
  // INSTALLMENT
  // ----------------------------------------------------------

  const count = Number(numberOfInstallments);
  const amount = Number(installmentAmount);

  const months =
    getFrequencyMonths(installmentFrequency);

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
    const dueDate = addMonths(
      firstPaymentDueDate,
      months * i
    );

    installments.push({
      installmentNumber: i + 1,
      amount,

      dueDate,

      status: "upcoming",

      paymentDate: null,

      invoiceNumber: null,
      invoiceId: null,

      invoicePdfUrl: null,
      invoicePdfFileName: null,
      invoicePdfPublicId: null,
    });
  }

  return installments;
};

// ============================================================
// REFRESH INSTALLMENT STATUS
// ============================================================

const refreshInstallmentStatuses = (
  installments = []
) => {
  const now = new Date();

  if (!Array.isArray(installments)) {
    return [];
  }

  return installments.map((installment) => {
    // Already paid → never overwrite
    if (installment.status === "paid") {
      return installment;
    }

    if (!installment.dueDate) {
      installment.status = "upcoming";
      return installment;
    }

    const dueDate =
      new Date(installment.dueDate);

    if (isNaN(dueDate.getTime())) {
      installment.status = "upcoming";
      return installment;
    }

    if (dueDate < now) {
      installment.status = "overdue";
    } else if (
      dueDate.getTime() <= now.getTime()
    ) {
      installment.status = "due";
    } else {
      installment.status = "upcoming";
    }

    return installment;
  });
};

// ============================================================
// CREATE DISTRIBUTOR SERVICE
// ============================================================

const createDistributorService = async (
  req,
  res
) => {
  try {
    const {
      distributor,
      service,
      quantity,
      purchasePrice,
      purchaseDate,
      serviceStartDate,
      serviceEndDate,
      totalPayableAmount,
      paymentType,
      installmentFrequency,
      installmentAmount,
      numberOfInstallments,
      firstPaymentDueDate,
      status,
      notes,
    } = req.body;

    // ========================================================
    // REQUIRED FIELDS
    // ========================================================

    if (!distributor) {
      return res.status(400).json({
        message: "Distributor is required",
      });
    }

    if (!service) {
      return res.status(400).json({
        message: "Service is required",
      });
    }

    if (
      quantity === undefined ||
      quantity === null
    ) {
      return res.status(400).json({
        message: "Quantity is required",
      });
    }

    if (
      purchasePrice === undefined ||
      purchasePrice === null
    ) {
      return res.status(400).json({
        message: "Purchase price is required",
      });
    }

    if (!purchaseDate) {
      return res.status(400).json({
        message: "Purchase date is required",
      });
    }

    if (!serviceStartDate) {
      return res.status(400).json({
        message:
          "Service start date is required",
      });
    }

    if (!serviceEndDate) {
      return res.status(400).json({
        message:
          "Service end date is required",
      });
    }

    if (
      totalPayableAmount === undefined ||
      totalPayableAmount === null
    ) {
      return res.status(400).json({
        message:
          "Total payable amount is required",
      });
    }

    // ========================================================
    // DATE VALIDATION
    // ========================================================

    const parsedPurchaseDate =
      new Date(purchaseDate);

    const parsedStartDate =
      new Date(serviceStartDate);

    const parsedEndDate =
      new Date(serviceEndDate);

    if (
      isNaN(parsedPurchaseDate.getTime())
    ) {
      return res.status(400).json({
        message: "Invalid purchase date",
      });
    }

    if (
      isNaN(parsedStartDate.getTime())
    ) {
      return res.status(400).json({
        message:
          "Invalid service start date",
      });
    }

    if (
      isNaN(parsedEndDate.getTime())
    ) {
      return res.status(400).json({
        message:
          "Invalid service end date",
      });
    }

    if (
      parsedEndDate < parsedStartDate
    ) {
      return res.status(400).json({
        message:
          "Service end date cannot be before service start date",
      });
    }

    // ========================================================
    // PAYMENT TYPE
    // ========================================================

    const finalPaymentType =
      paymentType || "one_time";

    if (
      ![
        "one_time",
        "installment",
      ].includes(finalPaymentType)
    ) {
      return res.status(400).json({
        message: "Invalid payment type",
      });
    }

    // ========================================================
    // ONE-TIME PAYMENT
    // ========================================================

    let parsedFirstPaymentDueDate =
      null;

    if (
      finalPaymentType === "one_time"
    ) {
      parsedFirstPaymentDueDate =
        purchaseDate
          ? parsedPurchaseDate
          : new Date();
    }

    // ========================================================
    // INSTALLMENT VALIDATION
    // ========================================================

    if (
      finalPaymentType ===
      "installment"
    ) {
      if (!installmentFrequency) {
        return res.status(400).json({
          message:
            "Installment frequency is required",
        });
      }

      if (
        !installmentAmount &&
        installmentAmount !== 0
      ) {
        return res.status(400).json({
          message:
            "Installment amount is required",
        });
      }

      if (
        Number(installmentAmount) <= 0
      ) {
        return res.status(400).json({
          message:
            "Installment amount must be greater than 0",
        });
      }

      if (
        !numberOfInstallments ||
        Number(numberOfInstallments) < 1
      ) {
        return res.status(400).json({
          message:
            "Number of installments must be at least 1",
        });
      }

      if (!firstPaymentDueDate) {
        return res.status(400).json({
          message:
            "First payment due date is required",
        });
      }

      parsedFirstPaymentDueDate =
        new Date(firstPaymentDueDate);

      if (
        isNaN(
          parsedFirstPaymentDueDate.getTime()
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid first payment due date",
        });
      }

      const total =
        Number(totalPayableAmount);

      const installmentTotal =
        Number(installmentAmount) *
        Number(numberOfInstallments);

      if (
        Math.abs(
          installmentTotal - total
        ) > 0.01
      ) {
        return res.status(400).json({
          message:
            "Installment total must equal total payable amount",
        });
      }
    }

    // ========================================================
    // CHECK DISTRIBUTOR
    // ========================================================

    const distributorExists =
      await Distributor.findById(
        distributor
      );

    if (!distributorExists) {
      return res.status(404).json({
        message: "Distributor not found",
      });
    }

    // ========================================================
    // CHECK SERVICE
    // ========================================================

    const serviceExists =
      await Service.findById(service);

    if (!serviceExists) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    // ========================================================
    // GENERATE PAYMENT SCHEDULE
    // ========================================================

    const installments =
      generateInstallments({
        paymentType:
          finalPaymentType,

        totalPayableAmount,

        installmentAmount,

        numberOfInstallments,

        firstPaymentDueDate:
          parsedFirstPaymentDueDate,

        installmentFrequency,
      });

    if (!installments.length) {
      return res.status(400).json({
        message:
          "Unable to generate payment schedule",
      });
    }

    // ========================================================
    // CREATE
    // ========================================================

    const distributorService =
      await DistributorService.create({
        distributor,
        service,

        quantity,
        purchasePrice,

        purchaseDate:
          parsedPurchaseDate,

        serviceStartDate:
          parsedStartDate,

        serviceEndDate:
          parsedEndDate,

        totalPayableAmount,

        paymentType:
          finalPaymentType,

        installmentFrequency:
          finalPaymentType ===
          "installment"
            ? installmentFrequency
            : null,

        installmentAmount:
          finalPaymentType ===
          "installment"
            ? installmentAmount
            : null,

        numberOfInstallments:
          finalPaymentType ===
          "installment"
            ? numberOfInstallments
            : null,

        firstPaymentDueDate:
          parsedFirstPaymentDueDate,

        installments,

        status:
          status || "active",

        notes:
          notes || null,
      });

    // ========================================================
    // POPULATE
    // ========================================================

   await distributorService.populate("distributor");

await distributorService.populate("service");

// ========================================================
// CREATE ACTIVITY
// ========================================================

console.log("🔥 BEFORE ACTIVITY CREATE");
console.log("Distributor ID:", distributorService.distributor._id);
console.log("Distributor Service ID:", distributorService._id);
console.log("Service:", distributorService.service.name);

await Activity.create({
  distributor: distributorService.distributor._id,
  distributorService: distributorService._id,
  type: "service_assigned",
  title: "Service Assigned",
  description:
    `${distributorService.service.name} assigned to distributor`,
});

console.log("🔥 AFTER ACTIVITY CREATE");

    res.status(201).json({
      message:
        "Distributor service created successfully",

      distributorService,
    });
  } catch (error) {
    console.error(
      "Create distributor service error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// ============================================================
// GET ALL SERVICES FOR DISTRIBUTOR
// ============================================================

const getDistributorServices = async (
  req,
  res
) => {
  try {
    const distributorServices =
      await DistributorService.find({
        distributor:
          req.params.distributorId,
      })
        .populate("service")
        .populate(
          "distributor",
          "companyName contactPerson"
        )
        .sort({
          createdAt: -1,
        });

    const result =
      distributorServices.map(
        (distributorService) => {
          const serviceObject =
            distributorService.toObject();

          serviceObject.installments =
            refreshInstallmentStatuses(
              Array.isArray(
                distributorService.installments
              )
                ? distributorService.installments
                : []
            );

          return serviceObject;
        }
      );

    return res.status(200).json({
      distributorServices: result,
    });
  } catch (error) {
    console.error(
      "Get distributor services error:",
      error
    );

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// GET ONE DISTRIBUTOR SERVICE
// ============================================================

const getDistributorServiceById =
  async (req, res) => {
    try {
      console.log(
        "GET DISTRIBUTOR SERVICE ID:",
        req.params.id
      );

      const distributorService =
        await DistributorService.findById(
          req.params.id
        )
          .populate("service")
          .populate("distributor");

      if (!distributorService) {
        return res.status(404).json({
          message:
            "Distributor service not found",
        });
      }

      const installments =
        Array.isArray(
          distributorService.installments
        )
          ? distributorService.installments
          : [];

      const refreshedInstallments =
        refreshInstallmentStatuses(
          installments
        );

      const serviceObject =
        distributorService.toObject();

      serviceObject.installments =
        refreshedInstallments;

      return res.status(200).json({
        distributorService:
          serviceObject,
      });
    } catch (error) {
      console.error(
        "Get distributor service error:",
        error
      );

      return res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  };

// ============================================================
// UPDATE DISTRIBUTOR SERVICE
// ============================================================

const updateDistributorService =
  async (req, res) => {
    try {
      const distributorService =
        await DistributorService.findById(
          req.params.id
        );

      if (!distributorService) {
        return res.status(404).json({
          message:
            "Distributor service not found",
        });
      }

      const {
        distributor,
        service,
        quantity,
        purchasePrice,
        purchaseDate,
        serviceStartDate,
        serviceEndDate,
        totalPayableAmount,
        paymentType,
        installmentFrequency,
        installmentAmount,
        numberOfInstallments,
        firstPaymentDueDate,
        status,
        notes,
      } = req.body;

      // ======================================================
      // PREVENT PAYMENT PLAN DAMAGE
      // ======================================================

      const hasPaidInstallment =
        distributorService.installments.some(
          (item) =>
            item.status === "paid"
        );

      const paymentPlanChanged =
        paymentType !== undefined ||
        installmentFrequency !==
          undefined ||
        installmentAmount !==
          undefined ||
        numberOfInstallments !==
          undefined ||
        firstPaymentDueDate !==
          undefined ||
        totalPayableAmount !==
          undefined;

      if (
        hasPaidInstallment &&
        paymentPlanChanged
      ) {
        return res.status(400).json({
          message:
            "Payment plan cannot be changed after an installment has been paid",
        });
      }

      // ======================================================
      // DISTRIBUTOR
      // ======================================================

      if (
        distributor !== undefined
      ) {
        const exists =
          await Distributor.findById(
            distributor
          );

        if (!exists) {
          return res.status(404).json({
            message:
              "Distributor not found",
          });
        }

        distributorService.distributor =
          distributor;
      }

      // ======================================================
      // SERVICE
      // ======================================================

      if (service !== undefined) {
        const exists =
          await Service.findById(
            service
          );

        if (!exists) {
          return res.status(404).json({
            message:
              "Service not found",
          });
        }

        distributorService.service =
          service;
      }

      // ======================================================
      // BASIC FIELDS
      // ======================================================

      if (quantity !== undefined) {
        distributorService.quantity =
          quantity;
      }

      if (
        purchasePrice !== undefined
      ) {
        distributorService.purchasePrice =
          purchasePrice;
      }

      if (
        purchaseDate !== undefined
      ) {
        const parsed =
          new Date(purchaseDate);

        if (
          isNaN(parsed.getTime())
        ) {
          return res.status(400).json({
            message:
              "Invalid purchase date",
          });
        }

        distributorService.purchaseDate =
          parsed;
      }

      if (
        serviceStartDate !==
        undefined
      ) {
        const parsed =
          new Date(
            serviceStartDate
          );

        if (
          isNaN(parsed.getTime())
        ) {
          return res.status(400).json({
            message:
              "Invalid service start date",
          });
        }

        distributorService.serviceStartDate =
          parsed;
      }

      if (
        serviceEndDate !==
        undefined
      ) {
        const parsed =
          new Date(
            serviceEndDate
          );

        if (
          isNaN(parsed.getTime())
        ) {
          return res.status(400).json({
            message:
              "Invalid service end date",
          });
        }

        distributorService.serviceEndDate =
          parsed;
      }

      // ======================================================
      // PAYMENT PLAN
      // ======================================================

      if (
        totalPayableAmount !==
        undefined
      ) {
        distributorService.totalPayableAmount =
          totalPayableAmount;
      }

      if (
        paymentType !== undefined
      ) {
        if (
          ![
            "one_time",
            "installment",
          ].includes(paymentType)
        ) {
          return res.status(400).json({
            message:
              "Invalid payment type",
          });
        }

        distributorService.paymentType =
          paymentType;
      }

      if (
        installmentFrequency !==
        undefined
      ) {
        distributorService.installmentFrequency =
          installmentFrequency;
      }

      if (
        installmentAmount !==
        undefined
      ) {
        distributorService.installmentAmount =
          installmentAmount;
      }

      if (
        numberOfInstallments !==
        undefined
      ) {
        distributorService.numberOfInstallments =
          numberOfInstallments;
      }

      if (
        firstPaymentDueDate !==
        undefined
      ) {
        if (
          firstPaymentDueDate ===
            null ||
          firstPaymentDueDate === ""
        ) {
          distributorService.firstPaymentDueDate =
            null;
        } else {
          const parsed =
            new Date(
              firstPaymentDueDate
            );

          if (
            isNaN(parsed.getTime())
          ) {
            return res.status(400).json({
              message:
                "Invalid first payment due date",
            });
          }

          distributorService.firstPaymentDueDate =
            parsed;
        }
      }

      // ======================================================
      // VALIDATE PAYMENT PLAN
      // ======================================================

      if (
        distributorService.paymentType ===
        "installment"
      ) {
        if (
          !distributorService
            .installmentFrequency
        ) {
          return res.status(400).json({
            message:
              "Installment frequency is required",
          });
        }

        if (
          !distributorService
            .installmentAmount ||
          Number(
            distributorService
              .installmentAmount
          ) <= 0
        ) {
          return res.status(400).json({
            message:
              "Installment amount must be greater than 0",
          });
        }

        if (
          !distributorService
            .numberOfInstallments ||
          Number(
            distributorService
              .numberOfInstallments
          ) < 1
        ) {
          return res.status(400).json({
            message:
              "Number of installments must be at least 1",
          });
        }

        if (
          !distributorService
            .firstPaymentDueDate
        ) {
          return res.status(400).json({
            message:
              "First payment due date is required",
          });
        }

        const total =
          Number(
            distributorService
              .totalPayableAmount
          );

        const installmentTotal =
          Number(
            distributorService
              .installmentAmount
          ) *
          Number(
            distributorService
              .numberOfInstallments
          );

        if (
          Math.abs(
            installmentTotal -
              total
          ) > 0.01
        ) {
          return res.status(400).json({
            message:
              "Installment total must equal total payable amount",
          });
        }
      }

      // ======================================================
      // REGENERATE PAYMENT PLAN
      // ======================================================

      if (
        paymentPlanChanged &&
        !hasPaidInstallment
      ) {
        distributorService.installments =
          generateInstallments({
            paymentType:
              distributorService.paymentType,

            totalPayableAmount:
              distributorService
                .totalPayableAmount,

            installmentAmount:
              distributorService
                .installmentAmount,

            numberOfInstallments:
              distributorService
                .numberOfInstallments,

            firstPaymentDueDate:
              distributorService
                .firstPaymentDueDate,

            installmentFrequency:
              distributorService
                .installmentFrequency,
          });
      }

      // ======================================================
      // STATUS / NOTES
      // ======================================================

      if (status !== undefined) {
        distributorService.status =
          status;
      }

      if (notes !== undefined) {
        distributorService.notes =
          notes;
      }

      // ======================================================
      // SERVICE DATE VALIDATION
      // ======================================================

      if (
        distributorService
          .serviceEndDate <
        distributorService
          .serviceStartDate
      ) {
        return res.status(400).json({
          message:
            "Service end date cannot be before service start date",
        });
      }

      // ======================================================
      // REFRESH PAYMENT STATUS
      // ======================================================

      distributorService.installments =
        refreshInstallmentStatuses(
          distributorService.installments
        );

      // ======================================================
      // SAVE
      // ======================================================

      await distributorService.save();

      await distributorService.populate(
        "service"
      );

      await distributorService.populate(
        "distributor"
      );
// ======================================================
// CREATE UPDATE ACTIVITY
// ======================================================

await Activity.create({
  distributor: distributorService.distributor._id,
  distributorService: distributorService._id,

  type: "service_updated",

  title: "Service Updated",

  description:
    `${distributorService.service.name} was updated`,
});

      res.status(200).json({
        message:
          "Distributor service updated successfully",

        distributorService,
      });
    } catch (error) {
      console.error(
        "Update distributor service error:",
        error.message
      );

      res.status(500).json({
        message: "Server error",
      });
    }
  };

// ============================================================
// MARK ONE INSTALLMENT AS PAID + UPLOAD INVOICE PDF
// ============================================================

const markInstallmentPaid = async (
  req,
  res
) => {
  let uploadedPublicId = null;

  try {
    const {
      id,
      installmentId,
    } = req.params;

    const {
      paymentDate,
      invoiceNumber,
    } = req.body;

    // ========================================================
    // PDF VALIDATION
    // ========================================================

    if (!req.file) {
      return res.status(400).json({
        message:
          "Invoice PDF is required",
      });
    }

    if (
      req.file.mimetype !==
      "application/pdf"
    ) {
      return res.status(400).json({
        message:
          "Only PDF files are allowed",
      });
    }

    // ========================================================
    // PAYMENT DATE VALIDATION
    // ========================================================

    if (!paymentDate) {
      return res.status(400).json({
        message:
          "Payment date is required",
      });
    }

    const parsedPaymentDate =
      new Date(paymentDate);

    if (
      Number.isNaN(
        parsedPaymentDate.getTime()
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid payment date",
      });
    }

    // ========================================================
    // FIND DISTRIBUTOR SERVICE
    // ========================================================

    const distributorService =
      await DistributorService.findById(
        id
      )
        .populate("distributor")
        .populate("service");

    if (!distributorService) {
      return res.status(404).json({
        message:
          "Distributor service not found",
      });
    }

    // ========================================================
    // FIND INSTALLMENT
    // ========================================================

    const installment =
      distributorService.installments.id(
        installmentId
      );

    if (!installment) {
      return res.status(404).json({
        message:
          "Installment not found",
      });
    }

    if (
      installment.status === "paid"
    ) {
      return res.status(400).json({
        message:
          "This installment is already paid",
      });
    }

    // ========================================================
    // KEEP OLD PDF ID
    // ========================================================

    const oldPdfPublicId =
      installment.invoicePdfPublicId;

    // ========================================================
    // UPLOAD NEW PDF TO CLOUDINARY
    // ========================================================

    const publicId =
      `distributor-invoices/${distributorService._id}_${installment._id}_${Date.now()}`;

    const uploadResult =
      await new Promise(
        (resolve, reject) => {
          const uploadStream =
            cloudinary.uploader.upload_stream(
              {
                resource_type: "raw",
                public_id: publicId,
              },
              (
                error,
                result
              ) => {
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

    uploadedPublicId =
      uploadResult.public_id;

    // ========================================================
    // UPDATE INSTALLMENT
    // ========================================================

    installment.status = "paid";

    installment.paymentDate =
      parsedPaymentDate;

    if (
      invoiceNumber !==
      undefined
    ) {
      installment.invoiceNumber =
        invoiceNumber === null ||
        invoiceNumber === ""
          ? null
          : invoiceNumber.trim();
    }

    installment.invoicePdfUrl =
      uploadResult.secure_url;

    installment.invoicePdfFileName =
      req.file.originalname;

    installment.invoicePdfPublicId =
      uploadResult.public_id;

    // ========================================================
    // SAVE DATABASE
    // ========================================================

    await distributorService.save();

    // ========================================================
// CREATE PAYMENT ACTIVITY
// ========================================================

await Activity.create({
  distributor: distributorService.distributor._id,
  distributorService: distributorService._id,

  type: "payment_received",

  title: "Payment Received",

  description:
    `Payment received for ${distributorService.service.name} - ` +
    `Installment ${installment.installmentNumber} ` +
    `of ₹${installment.amount}`,
});

    // ========================================================
    // DELETE OLD PDF
    // ========================================================

    if (oldPdfPublicId) {
      try {
        await cloudinary.uploader.destroy(
          oldPdfPublicId,
          {
            resource_type: "raw",
          }
        );
      } catch (
        deleteError
      ) {
        console.error(
          "Old invoice PDF deletion error:",
          deleteError.message
        );
      }
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      message:
        "Installment marked as paid and invoice PDF uploaded successfully",

      distributorService,

      installment,
    });
  } catch (error) {
    console.error(
      "markInstallmentPaid error:",
      error
    );

    // ========================================================
    // CLEANUP NEW PDF IF DATABASE SAVE FAILED
    // ========================================================

    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(
          uploadedPublicId,
          {
            resource_type: "raw",
          }
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "Uploaded PDF cleanup error:",
          cleanupError.message
        );
      }
    }

    return res.status(500).json({
      message:
        "Failed to mark installment as paid",

      error: error.message,
    });
  }
};

// ============================================================
// DELETE DISTRIBUTOR SERVICE
// ============================================================

const deleteDistributorService =
  async (req, res) => {
    try {
      const distributorService =
        await DistributorService.findById(
          req.params.id
        );

      if (!distributorService) {
        return res.status(404).json({
          message:
            "Distributor service not found",
        });
      }

      await distributorService.deleteOne();

      res.status(200).json({
        message:
          "Distributor service deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete distributor service error:",
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
  createDistributorService,
  getDistributorServices,
  getDistributorServiceById,
  updateDistributorService,
  deleteDistributorService,
  markInstallmentPaid,
};