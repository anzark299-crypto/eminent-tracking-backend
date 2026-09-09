  const Notification = require("../models/notification");
  const User = require("../models/user");
  const { getMessaging } = require("firebase-admin/messaging");
  const { sendEmailNotification } = require("../services/emailNotificationService");
  // ==========================================
  // GET MY NOTIFICATIONS
  // ==========================================

  const getMyNotifications = async (req, res) => {
    try {
      console.log("Logged in user ID:", req.user.userId);

      const notifications = await Notification.find({
        "recipients.user": req.user.userId,
      })
        .populate("customer", "companyName")
        .populate(
          "customerService",
          "startDate endDate amount status"
        )
        .populate("recipients.user", "name email role")
        .sort({ createdAt: -1 });

      // Find this user's individual read status
      const formattedNotifications = notifications.map(
        (notification) => {
          const notificationData = notification.toObject();

          const recipient = notification.recipients.find(
            (item) =>
              item.user &&
              item.user._id.toString() ===
                req.user.userId.toString()
          );

          
          // Flutter already expects notification["read"]
          notificationData.read = recipient
            ? recipient.read
            : false;

          return notificationData;
        }
      );

      console.log(
        "Notifications found:",
        formattedNotifications.length
      );

      res.status(200).json({
        success: true,
        notifications: formattedNotifications,
      });
    } catch (error) {
      console.error(
        "Get notifications error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to fetch notifications",
      });
    }
  };

  // ==========================================
  // CREATE TEST NOTIFICATION
  // ==========================================

  const createTestNotification = async (req, res) => {
    try {
      const notification = await Notification.create({
        title: "Test Notification",
        message: "Your notification system is working!",
        type: "general",

        recipients: [
          {
            user: req.user.userId,
            read: false,
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: "Test notification created",
        notification,
      });
    } catch (error) {
      console.error(
        "Create test notification error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to create test notification",
      });
    }
  };

  // ==========================================
  // GET UNREAD COUNT
  // ==========================================

  const getUnreadNotificationCount = async (req, res) => {
    try {
      const count = await Notification.countDocuments({
        recipients: {
          $elemMatch: {
            user: req.user.userId,
            read: false,
          },
        },
      });

      res.status(200).json({
        success: true,
        count,
      });
    } catch (error) {
      console.error(
        "Unread notification count error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to get unread notification count",
      });
    }
  };

  // ==========================================
  // MARK ONE NOTIFICATION AS READ
  // ==========================================

  const markNotificationAsRead = async (req, res) => {
    try {
      const notification =
        await Notification.findOneAndUpdate(
          {
            _id: req.params.id,

            recipients: {
              $elemMatch: {
                user: req.user.userId,
              },
            },
          },

          {
            $set: {
              "recipients.$.read": true,
            },
          },

          {
            new: true,
          }
        );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Notification marked as read",
        notification,
      });
    } catch (error) {
      console.error(
        "Mark notification read error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to mark notification as read",
      });
    }
  };

  // ==========================================
  // MARK ALL NOTIFICATIONS AS READ
  // ==========================================

  const markAllNotificationsAsRead = async (req, res) => {
    try {
      await Notification.updateMany(
        {
          recipients: {
            $elemMatch: {
              user: req.user.userId,
              read: false,
            },
          },
        },

        {
          $set: {
            "recipients.$[recipient].read": true,
          },
        },

        {
          arrayFilters: [
            {
              "recipient.user": req.user.userId,
              "recipient.read": false,
            },
          ],
        }
      );

      res.status(200).json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error(
        "Mark all notifications read error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to mark notifications as read",
      });
    }
  };
  const sendTestPushNotification = async (req, res) => {
    try {
      const user = await User.findById(req.user.userId).select("fcmTokens");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.fcmTokens || user.fcmTokens.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No FCM tokens found for this user",
        });
      }

      const message = {
        notification: {
          title: "Eminent Tracking",
          body: "Push notifications are working! 🚀",
        },
        tokens: user.fcmTokens,
      };

      const response = await getMessaging().sendEachForMulticast(message);

      console.log("Push notification result:");
      console.log("Successful:", response.successCount);
      console.log("Failed:", response.failureCount);

      res.status(200).json({
        success: true,
        message: "Push notification sent",
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    } catch (error) {
      console.error("Test push notification error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to send push notification",
        error: error.message,
      });
    }
  };

  const sendTestEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: "No email address found for this user",
      });
    }

    await sendEmailNotification(
      [user],
      "Eminent Tracking - Test Email",
      "Congratulations! Your Eminent Tracking email notification system is working successfully."
    );

    res.status(200).json({
      success: true,
      message: "Test email sent successfully",
    });
  } catch (error) {
    console.error("Test email error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to send test email",
    });
  }
};
  // ==========================================
  // EXPORTS
  // ==========================================

  module.exports = {
    getMyNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    createTestNotification,
    sendTestPushNotification,
    sendTestEmail,
  };