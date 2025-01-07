const express = require("express");
const User = require("../controllers/userController");
const validationMiddleware = require("../middlewares/validationMiddleware");

const router = express.Router();

router.route("/signup").post(validationMiddleware.validateSignup, User.signup);
router.route("/login").post(validationMiddleware.validateLogin, User.login);

module.exports = router;
