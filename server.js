require("dotenv").config();

const admin = require("./src/config/firebaseAdmin");
const cron = require("node-cron");
const express = require("express");
const distributorRoutes = require("./src/routes/distributorRoutes");
const distributorServiceRoutes = require("./src/routes/distributorServiceRoutes");
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
app.use(express.json());


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

    // Check service expiry immediately when server starts
    await checkServiceExpiryNotifications();

    // Check service expiry every day at 9:00 AM IST
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