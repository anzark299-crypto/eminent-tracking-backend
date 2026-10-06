const Quotation = require("../models/quotation");
const QuotationHistory = require("../models/quotationHistory");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// =====================================================
// CREATE QUOTATION
// =====================================================

const createQuotation = async (req, res) => {
  try {
    const {
      customer,
      distributor,
      quotationNumber,
      quotationDate,
      providedDate,
      amount,
      notes,
      status,
    } = req.body;

    // =====================================================
    // EXACTLY ONE PARTY
    // =====================================================

    if (!customer && !distributor) {
      return res.status(400).json({
        message: "Customer or distributor is required",
      });
    }

    if (customer && distributor) {
      return res.status(400).json({
        message:
          "Quotation cannot belong to both customer and distributor",
      });
    }

    // =====================================================
    // BASIC VALIDATION
    // =====================================================

    if (!quotationNumber || !quotationNumber.trim()) {
      return res.status(400).json({
        message: "Quotation number is required",
      });
    }

    if (!quotationDate) {
      return res.status(400).json({
        message: "Quotation date is required",
      });
    }

    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        message: "Amount is required",
      });
    }

    // =====================================================
    // CREATE QUOTATION
    // =====================================================

    const quotation = await Quotation.create({
      customer: customer || null,
      distributor: distributor || null,

      quotationNumber,
      quotationDate,
      providedDate: providedDate || null,
      amount,
      notes: notes || "",
      status: status || "draft",
    });

    // =====================================================
    // HISTORY
    // =====================================================

    try {
      await QuotationHistory.create({
        quotation: quotation._id,
        action: "created",
        description:
          `Quotation ${quotation.quotationNumber} was created`,
        performedBy: req.user?.userId || null,
      });
    } catch (historyError) {
      console.error(
        "Quotation history creation error:",
        historyError.message
      );
    }

    // =====================================================
    // POPULATE
    // =====================================================

    const populatedQuotation = await Quotation.findById(
      quotation._id
    )
      .populate(
        "customer",
        "companyName contactPerson email phone address city state pincode gstin"
      )
      .populate(
        "distributor",
        "companyName contactPerson email phone address city state pincode gstin"
      );

    res.status(201).json({
      message: "Quotation created successfully",
      quotation: populatedQuotation,
    });
  } catch (error) {
    console.error("Create quotation error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// GET ALL QUOTATIONS
// =====================================================

const getAllQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find()
      .populate(
        "customer",
        "companyName contactPerson email phone address city state pincode"
      )
      .populate(
        "distributor",
        "companyName contactPerson email phone address city state pincode"
      )
      .sort({
        quotationDate: -1,
        createdAt: -1,
      });

    res.status(200).json({
      quotations,
    });
  } catch (error) {
    console.error(
      "Get all quotations error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// GET CUSTOMER QUOTATIONS
// =====================================================

const getCustomerQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({
      customer: req.params.customerId,
    })
      .populate(
        "customer",
        "companyName contactPerson email phone"
      )
      .sort({
        quotationDate: -1,
        createdAt: -1,
      });

    res.status(200).json({
      quotations,
    });
  } catch (error) {
    console.error(
      "Get customer quotations error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// GET DISTRIBUTOR QUOTATIONS
// =====================================================

const getDistributorQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({
      distributor: req.params.distributorId,
    })
      .populate(
        "distributor",
        "companyName contactPerson email phone"
      )
      .sort({
        quotationDate: -1,
        createdAt: -1,
      });

    res.status(200).json({
      quotations,
    });
  } catch (error) {
    console.error(
      "Get distributor quotations error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// GET QUOTATION BY ID
// =====================================================

const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(
      req.params.id
    )
      .populate(
        "customer",
        "companyName contactPerson email phone address city state pincode gstin"
      )
      .populate(
        "distributor",
        "companyName contactPerson email phone address city state pincode gstin"
      );

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    res.status(200).json({
      quotation,
    });
  } catch (error) {
    console.error(
      "Get quotation error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// GET QUOTATION HISTORY
// =====================================================

const getQuotationHistory = async (req, res) => {
  try {
    const quotation = await Quotation.findById(
      req.params.id
    );

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    const history = await QuotationHistory.find({
      quotation: req.params.id,
    })
      .populate(
        "performedBy",
        "name email"
      )
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      history,
    });
  } catch (error) {
    console.error(
      "Get quotation history error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// UPDATE QUOTATION
// =====================================================

const updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(
      req.params.id
    );

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    const {
      quotationNumber,
      quotationDate,
      providedDate,
      amount,
      notes,
      status,
    } = req.body;

    const previousStatus = quotation.status;

    // =====================================================
    // UPDATE FIELDS
    // =====================================================

    if (quotationNumber !== undefined) {
      if (!quotationNumber.trim()) {
        return res.status(400).json({
          message: "Quotation number cannot be empty",
        });
      }

      quotation.quotationNumber =
        quotationNumber.trim();
    }

    if (quotationDate !== undefined) {
      quotation.quotationDate = quotationDate;
    }

    if (providedDate !== undefined) {
      quotation.providedDate =
        providedDate || null;
    }

    if (amount !== undefined) {
      quotation.amount = amount;
    }

    if (notes !== undefined) {
      quotation.notes = notes || "";
    }

    if (status !== undefined) {
      quotation.status = status;
    }

    // =====================================================
    // SAVE
    // =====================================================

    await quotation.save();

    // =====================================================
    // HISTORY
    // =====================================================

    try {
      await QuotationHistory.create({
        quotation: quotation._id,
        action:
          status !== undefined &&
          status !== previousStatus
            ? "status_changed"
            : "updated",

        description:
          status !== undefined &&
          status !== previousStatus
            ? `Quotation status changed from ${previousStatus} to ${status}`
            : `Quotation ${quotation.quotationNumber} was updated`,

        previousStatus:
          status !== undefined &&
          status !== previousStatus
            ? previousStatus
            : "",

        newStatus:
          status !== undefined &&
          status !== previousStatus
            ? status
            : "",

        performedBy:
          req.user?.userId || null,
      });
    } catch (historyError) {
      console.error(
        "Quotation update history error:",
        historyError.message
      );
    }

    // =====================================================
    // RETURN UPDATED QUOTATION
    // =====================================================

    const updatedQuotation =
      await Quotation.findById(
        quotation._id
      )
        .populate(
          "customer",
          "companyName contactPerson email phone address city state pincode gstin"
        )
        .populate(
          "distributor",
          "companyName contactPerson email phone address city state pincode gstin"
        );

    res.status(200).json({
      message: "Quotation updated successfully",
      quotation: updatedQuotation,
    });
  } catch (error) {
    console.error(
      "Update quotation error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// DELETE QUOTATION
// =====================================================

const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(
      req.params.id
    );

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    // =====================================================
    // DELETE PDF FROM CLOUDINARY
    // =====================================================

    if (quotation.pdfPublicId) {
      try {
        await cloudinary.uploader.destroy(
          quotation.pdfPublicId,
          {
            resource_type: "raw",
          }
        );
      } catch (deleteError) {
        console.error(
          "Quotation PDF deletion error:",
          deleteError.message
        );
      }
    }

    // =====================================================
    // HISTORY BEFORE DELETE
    // =====================================================

    try {
      await QuotationHistory.create({
        quotation: quotation._id,
        action: "deleted",
        description:
          `Quotation ${quotation.quotationNumber} was deleted`,
        performedBy:
          req.user?.userId || null,
      });
    } catch (historyError) {
      console.error(
        "Quotation delete history error:",
        historyError.message
      );
    }

    // =====================================================
    // DELETE QUOTATION
    // =====================================================

    await quotation.deleteOne();

    // Delete quotation history too
    await QuotationHistory.deleteMany({
      quotation: quotation._id,
    });

    res.status(200).json({
      message: "Quotation deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete quotation error:",
      error.message
    );

    res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================================
// UPLOAD QUOTATION PDF
// =====================================================

const uploadQuotationPdf = async (req, res) => {
  try {
    const quotation = await Quotation.findById(
      req.params.id
    );

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "PDF file is required",
      });
    }

    // =====================================================
    // DELETE OLD PDF
    // =====================================================

    const hadOldPdf = !!quotation.pdfPublicId;

    if (quotation.pdfPublicId) {
      try {
        await cloudinary.uploader.destroy(
          quotation.pdfPublicId,
          {
            resource_type: "raw",
          }
        );
      } catch (deleteError) {
        console.error(
          "Old quotation PDF deletion error:",
          deleteError.message
        );
      }
    }

    // =====================================================
    // UPLOAD NEW PDF
    // =====================================================

    const publicId =
      `quotations/${quotation._id}_${Date.now()}`;

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

    // =====================================================
    // SAVE PDF DETAILS
    // =====================================================

    quotation.pdfUrl =
      uploadResult.secure_url;

    quotation.pdfFileName =
      req.file.originalname;

    quotation.pdfPublicId =
      uploadResult.public_id;

    await quotation.save();

    // =====================================================
    // HISTORY
    // =====================================================

    try {
      await QuotationHistory.create({
        quotation: quotation._id,

        action: hadOldPdf
          ? "pdf_replaced"
          : "pdf_uploaded",

        description: hadOldPdf
          ? `Quotation PDF was replaced with ${req.file.originalname}`
          : `Quotation PDF ${req.file.originalname} was uploaded`,

        performedBy:
          req.user?.userId || null,
      });
    } catch (historyError) {
      console.error(
        "Quotation PDF history error:",
        historyError.message
      );
    }

    // =====================================================
    // RETURN UPDATED QUOTATION
    // =====================================================

    const updatedQuotation =
      await Quotation.findById(
        quotation._id
      )
        .populate(
          "customer",
          "companyName contactPerson email phone"
        )
        .populate(
          "distributor",
          "companyName contactPerson email phone"
        );

    res.status(200).json({
      message:
        "Quotation PDF uploaded successfully",
      quotation: updatedQuotation,
    });
  } catch (error) {
    console.error(
      "Upload quotation PDF error:",
      error.message
    );

    res.status(500).json({
      message:
        "Failed to upload quotation PDF",
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createQuotation,
  getAllQuotations,
  getCustomerQuotations,
  getDistributorQuotations,
  getQuotationById,
  getQuotationHistory,
  updateQuotation,
  deleteQuotation,
  uploadQuotationPdf,
};