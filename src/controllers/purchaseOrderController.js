const PurchaseOrder = require("../models/purchaseOrder");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const Activity = require("../models/activity");

// =====================================================
// CREATE PURCHASE ORDER
// =====================================================

const createPurchaseOrder = async (req, res) => {
  try {
    const {
      customer,
      customerService,
      distributor,
      distributorService,
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

    const {
      customerService,
      distributorService,
      poNumber,
      poDate,
      poIssuedTo,
      ourPoNumber,
      ourPoDate,
      amount,
      notes,
    } = req.body;

    // SERVICE LINK
    if (purchaseOrder.customer) {
      if (customerService !== undefined) {
        purchaseOrder.customerService =
          customerService || null;
      }
    }

    if (purchaseOrder.distributor) {
      if (distributorService !== undefined) {
        purchaseOrder.distributorService =
          distributorService || null;
      }
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
  getPurchaseOrdersByDistributor,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  uploadPurchaseOrderPdf,
};