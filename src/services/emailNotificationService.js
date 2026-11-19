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

const sendPasswordResetEmail = async (email, resetLink) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend API key is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Eminent Tracking <onboarding@resend.dev>",
      to: [email],
      subject: "Reset your Eminent Tracking password",
      text: [
        "We received a request to reset your Eminent Tracking password.",
        "",
        "Open this link on your device to choose a new password:",
        resetLink,
        "",
        "This link expires in 15 minutes and can only be used once.",
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Resend email failed (${response.status}): ${
        result.message || "Unknown provider error"
      }`
    );
  }

  console.log(`Password-reset email accepted by Resend for ${email}.`);
};

module.exports = {
  sendPasswordResetEmail,
  sendEmailNotification,
};
