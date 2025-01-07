const { signup, login } = require("../utils/validationSchema");
const { sendResponse } = require("../utils/responseHandler");

const validateSignup = (req, res, next) => {
  const { error } = signup.validate(req.body);
  if (error) {
    return sendResponse(res, {
      status: 400,
      type: "error",
      message: "Invalid signup data",
      error: error.details[0].message,
    });
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { error } = login.validate(req.body);
  if (error) {
    return sendResponse(res, {
      status: 400,
      type: "error",
      message: "Invalid login data",
      error: error.details[0].message,
    });
  }
  next();
};

module.exports = { validateSignup, validateLogin };
