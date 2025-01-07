const Joi = require("joi");

const signup = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    "string.base": "Name should be a type of string",
    "string.min": "Name should have a minimum length of 3 characters",
    "string.max": "Name should have a maximum length of 50 characters",
    "any.required": "Name is required",
  }),

  email: Joi.string().email().required().messages({
    "string.base": "Email should be a type of string",
    "string.email": "Enter the email in correct format",
    "any.required": "Email is required",
  }),

  password: Joi.string().min(6).required().messages({
    "string.base": "Password should be a type of string",
    "string.min": "Password should have a minimum length of 6 characters",
    "any.required": "Password is required",
  }),

  googleId: Joi.string().optional().messages({
    "string.base": "Google ID should be a type of string",
  }),

  address: Joi.string().min(5).max(100).optional().messages({
    "string.base": "Address should be a type of string",
    "string.min": "Address should have a minimum length of 5 characters",
    "string.max": "Address should have a maximum length of 100 characters",
    "any.required": "Address is required",
  }),

  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,10}$/)
    .optional()
    .messages({
      "string.base": "Phone should be a type of string",
      "string.pattern.base": "Phone should be in a valid international format",
    }),
});

const login = Joi.object({
  email: Joi.string().email().required().messages({
    "string.base": "Email should be a type of string",
    "string.email": "Enter the email in correct format",
    "any.required": "Email is required",
  }),

  password: Joi.string().min(6).required().messages({
    "string.base": "Password should be a type of string",
    "string.min": "Password should have a minimum length of 6 characters",
    "any.required": "Password is required",
  }),
});

module.exports = { signup, login };
