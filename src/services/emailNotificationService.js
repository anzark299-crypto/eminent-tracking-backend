const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

const sendEmailNotification = async (users, subject, message) => {
  try {
    const emailAddresses = users
      .map((user) => user.email)
      .filter((email) => email);

    if (emailAddresses.length === 0) {
      console.log("No user email addresses found. Skipping email.");
      return;
    }

    await transporter.sendMail({
      from: `"Eminent Tracking" <${process.env.EMAIL_USER}>`,
      to: emailAddresses,
      subject,
      text: message,
    });

    console.log(
      `Email notification sent to ${emailAddresses.length} user(s).`
    );
  } catch (error) {
    console.error(
      "Email notification error:",
      error.message
    );
  }
};

module.exports = {
  sendEmailNotification,
};