const express = require("express");

const {
  registerUser,
  loginUser,
  saveFcmToken,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/fcm-token", protect, saveFcmToken);

// Protected test route
router.get("/me", protect, (req, res) => {
  res.json({
    message: "You are authenticated!",
    user: req.user,
  });
});

module.exports = router;