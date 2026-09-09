const express = require("express");

const {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createTestNotification,
  sendTestPushNotification,
  sendTestEmail,
} = require("../controllers/notificationController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// ==========================================
// EMAIL NOTIFICATION
// ==========================================


router.post("/test-email", protect, sendTestEmail);

// ==========================================
// PUSH NOTIFICATION
// ==========================================

router.post("/test-push", protect, sendTestPushNotification);

// ==========================================
// CREATE TEST NOTIFICATION
// ==========================================

router.post("/test", protect, createTestNotification);

// ==========================================
// GET ALL MY NOTIFICATIONS
// ==========================================

router.get("/", protect, getMyNotifications);

// ==========================================
// GET UNREAD COUNT
// ==========================================

router.get("/unread-count", protect, getUnreadNotificationCount);

// ==========================================
// MARK ONE AS READ
// ==========================================

router.put("/:id/read", protect, markNotificationAsRead);

// ==========================================
// MARK ALL AS READ
// ==========================================

router.put("/read-all", protect, markAllNotificationsAsRead);

module.exports = router;