const { getMessaging } = require("firebase-admin/messaging");

const sendPushNotification = async (users, title, body, data = {}) => {
  try {
    const tokens = users.flatMap((user) => user.fcmTokens || []);

    if (tokens.length === 0) {
      console.log("No FCM tokens found. Skipping push notification.");
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          String(value),
        ])
      ),
      tokens,
    };

    const response = await getMessaging().sendEachForMulticast(message);

    console.log("Push notification result:");
    console.log("Successful:", response.successCount);
    console.log("Failed:", response.failureCount);

    // Remove invalid tokens
    const invalidTokens = [];

    response.responses.forEach((result, index) => {
      if (!result.success) {
        const errorCode = result.error?.code;

        if (
          errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      console.log(
        `Removing ${invalidTokens.length} invalid FCM token(s).`
      );

      for (const user of users) {
        user.fcmTokens = (user.fcmTokens || []).filter(
          (token) => !invalidTokens.includes(token)
        );

        await user.save();
      }
    }
  } catch (error) {
    console.error(
      "Push notification service error:",
      error.message
    );
  }
};

module.exports = {
  sendPushNotification,
};