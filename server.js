require("dotenv").config();
const quotationRoutes = require("./src/routes/quotationRoutes");
const admin = require("./src/config/firebaseAdmin");
const cron = require("node-cron");
const express = require("express");
const cors = require("cors");
const distributorRoutes = require("./src/routes/distributorRoutes");
const distributorServiceRoutes = require("./src/routes/distributorServiceRoutes");
const tallyRoutes = require("./src/routes/tallyRoutes");
// ==========================
// CONFIG
// ==========================

const connectDatabase = require("./src/config/database");

// ==========================
// ROUTES
// ==========================

const notificationRoutes = require("./src/routes/notificationRoutes");
const authRoutes = require("./src/routes/authRoutes");
const customerRoutes = require("./src/routes/customerRoutes");
const serviceRoutes = require("./src/routes/serviceRoutes");
const customerServiceRoutes = require("./src/routes/customerServiceRoutes");
const serviceCycleRoutes = require("./src/routes/serviceCycleRoutes");
const purchaseOrderRoutes = require("./src/routes/purchaseOrderRoutes");
const invoiceRoutes = require("./src/routes/invoiceRoutes");
const activityRoutes = require("./src/routes/activityRoutes");

// ==========================
// SERVICES
// ==========================

const {
  checkServiceExpiryNotifications,
} = require("./src/services/serviceExpiryChecker");

// ==========================
// APP
// ==========================

const app = express();

const PORT = process.env.PORT || 4000;

// ==========================
// MIDDLEWARE
// ==========================

// Parse JSON request bodies
// IMPORTANT: This MUST come before all routes.
// Allow the hosted password-reset page to call the reset API.
app.use("/api/auth/reset-password", cors({
  origin: "https://lucky-meadow-874a.anzark299.workers.dev",
  methods: ["POST"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "10mb" }));
app.use("/api/quotations", quotationRoutes);


app.use("/api/tally", tallyRoutes);
app.use(
  "/api/distributor-services",
  distributorServiceRoutes
);
// ==========================
// ROUTES
// ==========================
app.use("/api/distributors", distributorRoutes);
// Purchase Orders
app.use("/api/purchase-orders", purchaseOrderRoutes);

// Invoices
app.use("/api/invoices", invoiceRoutes);

// Notifications
app.use("/api/notifications", notificationRoutes);

// Authentication
app.use("/api/auth", authRoutes);

// Customers
app.use("/api/customers", customerRoutes);

// Services
app.use("/api/services", serviceRoutes);

// Customer Services
app.use("/api/customer-services", customerServiceRoutes);
app.use("/api/service-cycles", serviceCycleRoutes);


app.use("/api/activities", activityRoutes);

// ==========================
// ROOT ROUTE
// ==========================

app.get("/", (req, res) => {
  res.json({
    message: "Eminent Tracking Backend is running!",
  });
});

// ==========================
// START SERVER
// ==========================

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Notifications are disabled by default.
    // Set ENABLE_EXPIRY_NOTIFICATIONS=true to enable them.
    if (process.env.ENABLE_EXPIRY_NOTIFICATIONS === "true") {
      await checkServiceExpiryNotifications();

      cron.schedule(
        "0 9 * * *",
        async () => {
          console.log("Running scheduled service expiry check...");
          await checkServiceExpiryNotifications();
        },
        {
          timezone: "Asia/Kolkata",
        }
      );
    } else {
      console.log("Service expiry notifications are disabled.");
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });   
  } catch (error) {
    console.error(
      "Failed to start server:",
      error.message
    );
  }
};

startServer();

