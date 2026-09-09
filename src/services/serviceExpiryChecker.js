
const CustomerService = require("../models/customerService");
const DistributorService = require("../models/distributorService");
const Notification = require("../models/notification");
const User = require("../models/user");
const Activity = require("../models/activity");

const {
  sendPushNotification,
} = require("./pushNotificationService");

const {
  sendEmailNotification,
} = require("./emailNotificationService");

// ==========================================================
// GET DATE AS YYYY-MM-DD IN IST
// ==========================================================

const getISTDateString = (date) => {
  if (!date) {
    return null;
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsedDate);
};

// ==========================================================
// CALCULATE CALENDAR DAYS
// ==========================================================

const getDaysDifference = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  return Math.round(
    (end - start) / (1000 * 60 * 60 * 24)
  );
};

// ==========================================================
// SEND DISTRIBUTOR EMAIL
// ==========================================================

const sendDistributorEmail = async (
  distributor,
  subject,
  message
) => {
  if (!distributor?.email) {
    console.log(
      `No distributor email found for ${
        distributor?.companyName || "Distributor"
      }.`
    );

    return;
  }

  try {
    await sendEmailNotification(
      [
        {
          email: distributor.email,
        },
      ],
      subject,
      message
    );

    console.log(
      `Distributor email sent to ${distributor.email}`
    );
  } catch (error) {
    console.error(
      "Distributor email error:",
      error.message
    );
  }
};

// ==========================================================
// DISTRIBUTOR SERVICE EXPIRY MILESTONES
// ==========================================================

const getExpiryReminderMilestones = () => {
  return [30, 15, 7];
};

// ==========================================================
// CHECK CUSTOMER SERVICE EXPIRY
// ==========================================================

const checkCustomerServices = async (
  users,
  recipients,
  today
) => {
  const customerServices =
    await CustomerService.find({
      status: "active",
    })
      .populate(
        "customer",
        "companyName email"
      )
      .populate(
        "service",
        "name"
      );

  // ========================================================
  // CHECK EACH CUSTOMER SERVICE
  // ========================================================

  for (const customerService of customerServices) {
    const endDate = getISTDateString(
      customerService.endDate
    );

    const daysRemaining = getDaysDifference(
      today,
      endDate
    );

    const reminderDays =
      customerService.reminderDaysBefore ?? 30;

    console.log(
      `Customer service ${customerService._id}: ${daysRemaining} day(s) remaining`
    );

    // ======================================================
    // REMINDER MILESTONES
    // ======================================================

    let reminderMilestones = [];

    if (reminderDays >= 30) {
      reminderMilestones = [30, 15, 7];
    } else if (reminderDays >= 15) {
      reminderMilestones = [15, 7];
    } else if (reminderDays >= 7) {
      reminderMilestones = [7];
    }

    // ======================================================
    // EXPIRY REMINDER
    // ======================================================

    if (
      daysRemaining > 0 &&
      reminderMilestones.includes(daysRemaining)
    ) {
      const existingNotification =
        await Notification.findOne({
          customerService:
            customerService._id,
          type: "service_expiry",
          reminderDays: daysRemaining,
        });

      if (!existingNotification) {
        const serviceName =
          customerService.service?.name ||
          "Service";

        const companyName =
          customerService.customer?.companyName ||
          "Customer";

        const customerEmail =
          customerService.customer?.email;

        const title =
          "Service Expiring Soon";

        const message =
          `${serviceName} for ${companyName} expires in ` +
          `${daysRemaining} ` +
          `${
            daysRemaining === 1
              ? "day"
              : "days"
          }.`;

        // ==================================================
        // IN-APP
        // ==================================================

        await Notification.create({
          title,
          message,
          type: "service_expiry",
          reminderDays: daysRemaining,

          recipients: recipients.map(
            (recipient) => ({
              user: recipient.user,
              read: false,
            })
          ),

          customer:
            customerService.customer?._id,

          customerService:
            customerService._id,
        });

        // ==================================================
        // PUSH
        // ==================================================

        await sendPushNotification(
          users,
          title,
          message,
          {
            type: "service_expiry",
            customerServiceId:
              customerService._id,
            reminderDays:
              daysRemaining,
          }
        );

        // ==================================================
        // STAFF / ADMIN EMAIL
        // ==================================================

        await sendEmailNotification(
          users,
          title,
          message
        );

        // ==================================================
        // CUSTOMER EMAIL
        // ==================================================

        if (customerEmail) {
          const customerSubject =
            `Service Expiry Reminder - ${serviceName}`;

          const customerMessage =
            `Dear ${companyName},\n\n` +
            `This is a reminder that your ` +
            `${serviceName} service is scheduled to ` +
            `expire in ${daysRemaining} ` +
            `${
              daysRemaining === 1
                ? "day"
                : "days"
            } on ${endDate}.\n\n` +
            `Please contact Eminent Infosolutions ` +
            `regarding renewal to avoid any interruption ` +
            `of service.\n\n` +
            `Regards,\n` +
            `Eminent Tracking`;

          await sendEmailNotification(
            [
              {
                email: customerEmail,
              },
            ],
            customerSubject,
            customerMessage
          );

          console.log(
            `Customer expiry email sent to ${customerEmail}`
          );
        } else {
          console.log(
            `No customer email found for ${companyName}.`
          );
        }

        console.log(
          `${daysRemaining}-day customer expiry reminder sent for service ${customerService._id}`
        );
      }
    }

    // ======================================================
    // SERVICE EXPIRED
    // ======================================================

    if (daysRemaining <= 0) {
      customerService.status = "expired";

      await customerService.save();

      const existingNotification =
        await Notification.findOne({
          customerService:
            customerService._id,
          type: "service_expired",
        });

      // ONLY ONCE
      if (!existingNotification) {
        const serviceName =
          customerService.service?.name ||
          "Service";

        const companyName =
          customerService.customer?.companyName ||
          "Customer";

        const customerEmail =
          customerService.customer?.email;

        // ==================================================
        // ACTIVITY
        // ==================================================

        try {
          await Activity.create({
            customer:
              customerService.customer?._id,

            type: "service_expired",

            title: "Service Expired",

            description:
              `${serviceName} service for ${companyName} has expired.`,

            customerService:
              customerService._id,
          });
        } catch (activityError) {
          console.error(
            "Service expired activity creation error:",
            activityError.message
          );
        }

        const title =
          "Service Expired";

        const message =
          `${serviceName} for ${companyName} has expired.`;

        // ==================================================
        // IN-APP
        // ==================================================

        await Notification.create({
          title,
          message,
          type: "service_expired",

          recipients: recipients.map(
            (recipient) => ({
              user: recipient.user,
              read: false,
            })
          ),

          customer:
            customerService.customer?._id,

          customerService:
            customerService._id,
        });

        // ==================================================
        // PUSH
        // ==================================================

        await sendPushNotification(
          users,
          title,
          message,
          {
            type: "service_expired",
            customerServiceId:
              customerService._id,
          }
        );

        // ==================================================
        // STAFF / ADMIN EMAIL
        // ==================================================

        await sendEmailNotification(
          users,
          title,
          message
        );

        // ==================================================
        // CUSTOMER EMAIL
        // ==================================================

        if (customerEmail) {
          const customerSubject =
            `Service Expired - ${serviceName}`;

          const customerMessage =
            `Dear ${companyName},\n\n` +
            `Your ${serviceName} service expired ` +
            `on ${endDate}.\n\n` +
            `Please contact Eminent Infosolutions ` +
            `regarding renewal or continuation of ` +
            `your service.\n\n` +
            `Regards,\n` +
            `Eminent Tracking`;

          await sendEmailNotification(
            [
              {
                email: customerEmail,
              },
            ],
            customerSubject,
            customerMessage
          );

          console.log(
            `Customer expired email sent to ${customerEmail}`
          );
        } else {
          console.log(
            `No customer email found for ${companyName}.`
          );
        }

        console.log(
          `Customer expired notification created for service ${customerService._id}`
        );
      }
    }
  }
};

// ==========================================================
// CHECK DISTRIBUTOR SERVICE EXPIRY
// ==========================================================

const checkDistributorServiceExpiry = async (
  users,
  recipients,
  today
) => {
  const distributorServices =
    await DistributorService.find({
      status: "active",
    })
      .populate(
        "distributor",
        "companyName email"
      )
      .populate(
        "service",
        "name"
      );

  const reminderMilestones =
    getExpiryReminderMilestones();

  // ========================================================
  // CHECK EACH DISTRIBUTOR SERVICE
  // ========================================================

  for (
    const distributorService
    of distributorServices
  ) {console.log(
  "Checking distributor service:",
  distributorService._id,
  "serviceEndDate:",
  distributorService.serviceEndDate
);

const endDate = getISTDateString(
  distributorService.serviceEndDate
);

if (!endDate) {
  console.error(
    `Invalid serviceEndDate for distributor service ${distributorService._id}`
  );
  continue;
}

    const daysRemaining = getDaysDifference(
      today,
      endDate
    );

    console.log(
      `Distributor service ${distributorService._id}: ${daysRemaining} day(s) remaining`
    );

    // ======================================================
    // SERVICE EXPIRY REMINDER
    // ======================================================

    if (
      daysRemaining > 0 &&
      reminderMilestones.includes(daysRemaining)
    ) {
      const existingNotification =
        await Notification.findOne({
          distributorService:
            distributorService._id,

          type: "service_expiry",

          reminderDays:
            daysRemaining,
        });

      if (!existingNotification) {
        const serviceName =
          distributorService.service?.name ||
          "Service";

        const companyName =
          distributorService.distributor?.companyName ||
          "Distributor";

        const title =
          "Distributor Service Expiring Soon";

        const message =
          `${serviceName} for ${companyName} expires in ` +
          `${daysRemaining} ` +
          `${
            daysRemaining === 1
              ? "day"
              : "days"
          }.`;

        // ==================================================
        // IN-APP
        // ==================================================

        await Notification.create({
          title,
          message,
          type: "service_expiry",

          reminderDays:
            daysRemaining,

          recipients: recipients.map(
            (recipient) => ({
              user: recipient.user,
              read: false,
            })
          ),

          distributor:
            distributorService.distributor?._id,

          distributorService:
            distributorService._id,
        });

        // ==================================================
        // PUSH
        // ==================================================

        await sendPushNotification(
          users,
          title,
          message,
          {
            type: "service_expiry",

            distributorServiceId:
              distributorService._id,

            reminderDays:
              daysRemaining,
          }
        );

        // ==================================================
        // STAFF / ADMIN EMAIL
        // ==================================================

        await sendEmailNotification(
          users,
          title,
          message
        );

        // ==================================================
        // DISTRIBUTOR EMAIL
        // ==================================================

        const distributorSubject =
          `Service Expiry Reminder - ${serviceName}`;

        const distributorMessage =
          `Dear ${companyName},\n\n` +
          `This is a reminder that the ` +
          `${serviceName} service is scheduled to ` +
          `expire in ${daysRemaining} ` +
          `${
            daysRemaining === 1
              ? "day"
              : "days"
          } on ${endDate}.\n\n` +
          `Please contact Eminent Infosolutions ` +
          `regarding the service.\n\n` +
          `Regards,\n` +
          `Eminent Tracking`;

        await sendDistributorEmail(
          distributorService.distributor,
          distributorSubject,
          distributorMessage
        );

        console.log(
          `${daysRemaining}-day distributor expiry reminder sent for service ${distributorService._id}`
        );
      }
    }

    // ======================================================
    // SERVICE EXPIRED
    // ======================================================

    if (daysRemaining <= 0) {
      distributorService.status =
        "expired";

      await distributorService.save();

      const existingNotification =
        await Notification.findOne({
          distributorService:
            distributorService._id,

          type: "service_expired",
        });

      // ONLY ONCE
      if (!existingNotification) {
        const serviceName =
          distributorService.service?.name ||
          "Service";

        const companyName =
          distributorService.distributor?.companyName ||
          "Distributor";

        // ==================================================
        // ACTIVITY
        // ==================================================

        try {
          await Activity.create({
            distributor:
              distributorService.distributor?._id,

            distributorService:
              distributorService._id,

            type: "service_expired",

            title: "Service Expired",

            description:
              `${serviceName} service for ${companyName} has expired.`,
          });
        } catch (activityError) {
          console.error(
            "Distributor service expired activity creation error:",
            activityError.message
          );
        }

        const title =
          "Distributor Service Expired";

        const message =
          `${serviceName} for ${companyName} has expired.`;

        // ==================================================
        // IN-APP
        // ==================================================

        await Notification.create({
          title,
          message,
          type: "service_expired",

          recipients: recipients.map(
            (recipient) => ({
              user: recipient.user,
              read: false,
            })
          ),

          distributor:
            distributorService.distributor?._id,

          distributorService:
            distributorService._id,
        });

        // ==================================================
        // PUSH
        // ==================================================

        await sendPushNotification(
          users,
          title,
          message,
          {
            type: "service_expired",

            distributorServiceId:
              distributorService._id,
          }
        );

        // ==================================================
        // STAFF / ADMIN EMAIL
        // ==================================================

        await sendEmailNotification(
          users,
          title,
          message
        );

        // ==================================================
        // DISTRIBUTOR EMAIL
        // ==================================================

        const distributorSubject =
          `Service Expired - ${serviceName}`;

        const distributorMessage =
          `Dear ${companyName},\n\n` +
          `Your ${serviceName} service expired ` +
          `on ${endDate}.\n\n` +
          `Please contact Eminent Infosolutions ` +
          `regarding renewal or continuation of ` +
          `the service.\n\n` +
          `Regards,\n` +
          `Eminent Tracking`;

        await sendDistributorEmail(
          distributorService.distributor,
          distributorSubject,
          distributorMessage
        );

        console.log(
          `Distributor expired notification created for service ${distributorService._id}`
        );
      }
    }
  }
};

// ==========================================================
// CHECK DISTRIBUTOR INSTALLMENTS
// ==========================================================

const checkDistributorInstallments = async (
  users,
  recipients,
  today
) => {
  const distributorServices =
    await DistributorService.find({
      installments: {
        $exists: true,
        $ne: [],
      },
    })
      .populate(
        "distributor",
        "companyName email"
      )
      .populate(
        "service",
        "name"
      );

  // ========================================================
  // CHECK EVERY SERVICE
  // ========================================================

  for (
    const distributorService
    of distributorServices
  ) {
    if (
      !distributorService.installments ||
      distributorService.installments.length === 0
    ) {
      continue;
    }

    let serviceChanged = false;

    const serviceName =
      distributorService.service?.name ||
      "Service";

    const companyName =
      distributorService.distributor?.companyName ||
      "Distributor";

    // ======================================================
    // CHECK EVERY INSTALLMENT INDEPENDENTLY
    // ======================================================

    for (
      const installment
      of distributorService.installments
    ) {
      // ====================================================
      // PAID INSTALLMENT
      // ====================================================

      if (
        installment.status === "paid" ||
        installment.paymentDate
      ) {
        continue;
      }

    const dueDate = getISTDateString(
  installment.dueDate
);

if (!dueDate) {
  console.error(
    `Invalid installment dueDate for distributor service ${distributorService._id}, ` +
    `installment ${installment.installmentNumber}`
  );
  continue;
}

const daysUntilDue = getDaysDifference(
  today,
  dueDate
);

      // ====================================================
      // UPDATE INSTALLMENT STATUS
      // ====================================================

      if (daysUntilDue < 0) {
        if (
          installment.status !== "overdue"
        ) {
          installment.status =
            "overdue";

          serviceChanged = true;
        }
      } else if (daysUntilDue === 0) {
        if (
          installment.status !== "due"
        ) {
          installment.status =
            "due";

          serviceChanged = true;
        }
      } else {
        if (
          installment.status !== "upcoming"
        ) {
          installment.status =
            "upcoming";

          serviceChanged = true;
        }
      }

      // ====================================================
      // 7 DAYS BEFORE
      // ====================================================

      if (daysUntilDue === 7) {
        const existingNotification =
          await Notification.findOne({
            distributorService:
              distributorService._id,

            installmentId:
              installment._id,

            type: "payment_due",

            reminderDays: 7,
          });

        if (!existingNotification) {
          const title =
            "Installment Payment Due Soon";

          const message =
            `${serviceName} for ${companyName}: ` +
            `Installment ${installment.installmentNumber} ` +
            `of ₹${installment.amount} is due in 7 days ` +
            `on ${dueDate}.`;

          // ==============================================
          // IN-APP
          // ==============================================

          await Notification.create({
            title,
            message,
            type: "payment_due",

            reminderDays: 7,

            recipients: recipients.map(
              (recipient) => ({
                user: recipient.user,
                read: false,
              })
            ),

            distributor:
              distributorService.distributor?._id,

            distributorService:
              distributorService._id,

            installmentId:
              installment._id,
          });

          // ==============================================
          // PUSH
          // ==============================================

          await sendPushNotification(
            users,
            title,
            message,
            {
              type: "payment_due",

              distributorServiceId:
                distributorService._id,

              installmentId:
                installment._id,

              reminderDays: 7,
            }
          );

          // ==============================================
          // STAFF / ADMIN EMAIL
          // ==============================================

          await sendEmailNotification(
            users,
            title,
            message
          );

          // ==============================================
          // DISTRIBUTOR EMAIL
          // ==============================================

          const distributorSubject =
            `Installment Payment Due Soon - ${serviceName}`;

          const distributorMessage =
            `Dear ${companyName},\n\n` +
            `Installment ${installment.installmentNumber} ` +
            `of ${serviceName} amounting to ` +
            `₹${installment.amount} is due in 7 days.\n\n` +
            `Due Date: ${dueDate}\n\n` +
            `Please contact Eminent Infosolutions ` +
            `regarding the payment.\n\n` +
            `Regards,\n` +
            `Eminent Tracking`;

          await sendDistributorEmail(
            distributorService.distributor,
            distributorSubject,
            distributorMessage
          );

          console.log(
            `7-day installment reminder sent: ${distributorService._id} / ${installment._id}`
          );
        }
      }

      // ====================================================
      // DUE TODAY
      // ====================================================

      if (daysUntilDue === 0) {
        const existingNotification =
          await Notification.findOne({
            distributorService:
              distributorService._id,

            installmentId:
              installment._id,

            type: "payment_due",

            reminderDays: 0,
          });

        if (!existingNotification) {
          const title =
            "Installment Payment Due Today";

          const message =
            `${serviceName} for ${companyName}: ` +
            `Installment ${installment.installmentNumber} ` +
            `of ₹${installment.amount} is due today.`;

          // ==============================================
          // IN-APP
          // ==============================================

          await Notification.create({
            title,
            message,
            type: "payment_due",

            reminderDays: 0,

            recipients: recipients.map(
              (recipient) => ({
                user: recipient.user,
                read: false,
              })
            ),

            distributor:
              distributorService.distributor?._id,

            distributorService:
              distributorService._id,

            installmentId:
              installment._id,
          });

          // ==============================================
          // PUSH
          // ==============================================

          await sendPushNotification(
            users,
            title,
            message,
            {
              type: "payment_due",

              distributorServiceId:
                distributorService._id,

              installmentId:
                installment._id,

              reminderDays: 0,
            }
          );

          // ==============================================
          // STAFF / ADMIN EMAIL
          // ==============================================

          await sendEmailNotification(
            users,
            title,
            message
          );

          // ==============================================
          // DISTRIBUTOR EMAIL
          // ==============================================

          const distributorSubject =
            `Installment Payment Due Today - ${serviceName}`;

          const distributorMessage =
            `Dear ${companyName},\n\n` +
            `Installment ${installment.installmentNumber} ` +
            `of ${serviceName} amounting to ` +
            `₹${installment.amount} is due today.\n\n` +
            `Due Date: ${dueDate}\n\n` +
            `Please contact Eminent Infosolutions ` +
            `regarding the payment.\n\n` +
            `Regards,\n` +
            `Eminent Tracking`;

          await sendDistributorEmail(
            distributorService.distributor,
            distributorSubject,
            distributorMessage
          );

          console.log(
            `Due-today installment notification sent: ${distributorService._id} / ${installment._id}`
          );
        }
      }

      // ====================================================
      // OVERDUE
      // ====================================================

      if (daysUntilDue < 0) {
        const existingNotification =
          await Notification.findOne({
            distributorService:
              distributorService._id,

            installmentId:
              installment._id,

            type: "payment_overdue",
          });

        // ONLY ONE OVERDUE NOTIFICATION
        if (!existingNotification) {
          const overdueDays =
            Math.abs(daysUntilDue);

          const title =
            "Installment Payment Overdue";

          const message =
            `${serviceName} for ${companyName}: ` +
            `Installment ${installment.installmentNumber} ` +
            `of ₹${installment.amount} is overdue by ` +
            `${overdueDays} ` +
            `${
              overdueDays === 1
                ? "day"
                : "days"
            }.`;

          // ==============================================
          // IN-APP
          // ==============================================

          await Notification.create({
            title,
            message,
            type: "payment_overdue",

            reminderDays: null,

            recipients: recipients.map(
              (recipient) => ({
                user: recipient.user,
                read: false,
              })
            ),

            distributor:
              distributorService.distributor?._id,

            distributorService:
              distributorService._id,

            installmentId:
              installment._id,
          });

          // ==============================================
          // PUSH
          // ==============================================

          await sendPushNotification(
            users,
            title,
            message,
            {
              type: "payment_overdue",

              distributorServiceId:
                distributorService._id,

              installmentId:
                installment._id,
            }
          );

          // ==============================================
          // STAFF / ADMIN EMAIL
          // ==============================================

          await sendEmailNotification(
            users,
            title,
            message
          );

          // ==============================================
          // DISTRIBUTOR EMAIL
          // ==============================================

          const distributorSubject =
            `Installment Payment Overdue - ${serviceName}`;

          const distributorMessage =
            `Dear ${companyName},\n\n` +
            `Installment ${installment.installmentNumber} ` +
            `of ${serviceName} amounting to ` +
            `₹${installment.amount} was due on ` +
            `${dueDate} and is now overdue by ` +
            `${overdueDays} ` +
            `${
              overdueDays === 1
                ? "day"
                : "days"
            }.\n\n` +
            `Please contact Eminent Infosolutions ` +
            `regarding the payment.\n\n` +
            `Regards,\n` +
            `Eminent Tracking`;

          await sendDistributorEmail(
            distributorService.distributor,
            distributorSubject,
            distributorMessage
          );

          console.log(
            `Overdue installment notification sent: ${distributorService._id} / ${installment._id}`
          );
        }
      }
    }

    // ======================================================
    // SAVE STATUS CHANGES
    // ======================================================

    if (serviceChanged) {
      await distributorService.save();
    }
  }
};

// ==========================================================
// MAIN CHECKER
// ==========================================================

const checkServiceExpiryNotifications =
  async () => {
    try {
      console.log(
        "Checking service expiry and payment notifications..."
      );

      // ====================================================
      // GET STAFF + ADMIN
      // ====================================================

      const users = await User.find({
        role: {
          $in: ["staff", "admin"],
        },
      }).select(
        "_id fcmTokens email"
      );

      if (users.length === 0) {
        console.log(
          "No staff/admin users found."
        );

        return;
      }

      const recipients =
        users.map((user) => ({
          user: user._id,
          read: false,
        }));

      // ====================================================
      // TODAY IN IST
      // ====================================================

      const today =
        getISTDateString(
          new Date()
        );

      console.log(
        `Today's date: ${today}`
      );

      // ====================================================
      // CUSTOMER SERVICES
      // ====================================================

      await checkCustomerServices(
        users,
        recipients,
        today
      );

      // ====================================================
      // DISTRIBUTOR SERVICE EXPIRY
      // ====================================================

      await checkDistributorServiceExpiry(
        users,
        recipients,
        today
      );

      // ====================================================
      // DISTRIBUTOR INSTALLMENTS
      // ====================================================

      await checkDistributorInstallments(
        users,
        recipients,
        today
      );

      console.log(
        "Service expiry and payment notification check completed."
      );
    } catch (error) {
      console.error(
        "Service expiry checker error:",
        error.message
      );
    }
  };

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  checkServiceExpiryNotifications,
};
