const express = require("express");
const User = require('../controllers/userController');
const validationMiddleware = require('../middlewares/validationMiddleware');

const router = express.Router();

router.route('/signup').get(validationMiddleware.validateSignup,User.signup);
router.route('/login').get(validationMiddleware.validateLogin, User.login);
