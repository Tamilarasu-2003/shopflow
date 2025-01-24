const express = require("express");
const User = require("../controllers/userController");
const validationMiddleware = require("../middlewares/validationMiddleware");
const {validateToken} = require('../middlewares/tokenAuthMiddleware');

const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router.route("/signup").post(validationMiddleware.validateSignup, User.signup);
router.route("/login").post(validationMiddleware.validateLogin, User.login);
router.route("/oAuth").post(User.oAuth);

router.route("/userProfileInfo").post(validateToken, User.userProfileInfo);
router.route("/updateUserProfile").post(validateToken,upload.single('profile'), User.updateUserProfile);

router.route('/getAllAddress').post(validateToken, User.getAllAddresses);
router.route('/addAddress').post(validateToken, User.addAddress);
router.route('/makePrimaryAddress').post(validateToken, User.makePrimaryAddress);
router.route('/editAddress').post(validateToken, User.editAddress);
router.route('/deleteAddress').post(validateToken, User.deleteAddress);

router.route('/forgotPassword').post(User.forgotPassword);
router.route('/resetPassword').post(User.resetPassword);

module.exports = router;
