const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "Name, email, phone and password are required",
      });
    }

    // Validate phone number
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        message: "Phone number must be a valid 10-digit number",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
    });

    // Send safe response
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Check password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Create JWT
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Send response
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

const saveFcmToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        message: "FCM token is required",
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Avoid storing the same device token multiple times
    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      await user.save();
    }

    res.status(200).json({
      message: "FCM token saved successfully",
    });
  } catch (error) {
    console.error("Save FCM token error:", error.message);

    res.status(500).json({
      message: "Failed to save FCM token",
    });
  }
};

// GET PROFILE
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "-password -fcmTokens"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error.message);

    res.status(500).json({
      message: "Failed to fetch profile",
    });
  }
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Basic validation
    if (!name || !email || !phone) {
      return res.status(400).json({
        message: "Name, email and phone are required",
      });
    }

    // Validate phone
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        message: "Phone number must be a valid 10-digit number",
      });
    }

    // Find current user
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Check if another user already has this email
    const existingUser = await User.findOne({
      email,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email is already in use",
      });
    }

    // Update fields
    user.name = name.trim();
    user.email = email.trim().toLowerCase();
    user.phone = phone.trim();

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error.message);

    res.status(500).json({
      message: "Failed to update profile",
    });
  }
};


const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../services/emailNotificationService");

// In-memory throttle for password-reset requests.
// This is a basic per-process safeguard, not a replacement for
// production-wide rate limiting.
const resetRequestWindows = new Map();
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX_REQUESTS = 5;

const forgotPassword = async (req, res) => {
  const genericResponse = {
    message: "If an account matches that email, a password-reset link will be sent.",
  };

  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(200).json(genericResponse);
    }

    const now = Date.now();
    const clientKey = String(req.ip || "unknown");
    let windowData = resetRequestWindows.get(clientKey);

    if (!windowData || now - windowData.startedAt >= RESET_WINDOW_MS) {
      windowData = { startedAt: now, count: 0 };
      resetRequestWindows.set(clientKey, windowData);
    }

    if (windowData.count >= RESET_MAX_REQUESTS) {
      return res.status(200).json(genericResponse);
    }

    windowData.count += 1;

    const user = await User.findOne({ email });

    // Keep the response identical when the account does not exist.
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const resetPageUrl = process.env.PASSWORD_RESET_URL;
    if (!resetPageUrl) {
      throw new Error("Password-reset page URL is not configured");
    }

    const resetUrl = new URL(resetPageUrl);
    if (resetUrl.protocol !== "https:" || resetUrl.username || resetUrl.password) {
      throw new Error("Password-reset page URL must be a valid HTTPS URL");
    }
    resetUrl.searchParams.set("token", rawToken);
    const resetLink = resetUrl.toString();

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, resetLink);
    } catch (emailError) {
      // Never log the reset token or reset link.
      console.error("Password-reset email delivery failed:", emailError.message);

      try {
        await User.updateOne(
          {
            _id: user._id,
            passwordResetTokenHash: tokenHash,
          },
          {
            $unset: {
              passwordResetTokenHash: "",
              passwordResetExpiresAt: "",
            },
          }
        );
      } catch (cleanupError) {
        // The token still expires after 15 minutes if cleanup fails.
        console.error(
          "Password-reset token cleanup failed:",
          cleanupError.message
        );
      }
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot-password request failed:", error.message);
    return res.status(200).json(genericResponse);
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = req.body?.password;

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        message: "This reset link is invalid or expired. Request a new one.",
      });
    }

    if (typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128) {
      return res.status(400).json({
        message: "Password must be between 8 and 128 characters.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: now },
    });

    if (!user) {
      return res.status(400).json({
        message: "This reset link is invalid or expired. Request a new one.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // The token hash in the update filter makes concurrent reuse fail
    // after the first successful update clears the token.
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: { password: hashedPassword },
        $unset: {
          passwordResetTokenHash: "",
          passwordResetExpiresAt: "",
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(400).json({
        message: "This reset link is invalid or expired. Request a new one.",
      });
    }

    return res.status(200).json({
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Password-reset failed:", error.message);
    return res.status(500).json({
      message: "Unable to reset the password right now. Please try again.",
    });
  }
};
module.exports = {
  registerUser,
  loginUser,
  saveFcmToken,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
};