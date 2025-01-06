const express = require("express");
const passport = require("passport");
const authController = require("../controllers/authController");

const router = express.Router();

// Google OAuth Routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  authController.googleCallback
);

module.exports = router;
