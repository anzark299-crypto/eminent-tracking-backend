const express = require("express");

const {
  registerUser,
  loginUser,
  saveFcmToken,
  getProfile,
  updateProfile,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/fcm-token", protect, saveFcmToken);

// Profile
router.get("/profile", protect, getProfile);

router.put("/profile", protect, updateProfile);

// Protected test route
router.get("/me", protect, (req, res) => {
  res.json({
    message: "You are authenticated!",
    user: req.user,
  });
});

module.exports = router;