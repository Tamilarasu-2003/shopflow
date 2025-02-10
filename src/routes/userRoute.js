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

router.route("/userProfileInfo").get(validateToken, User.userProfileInfo);
router.route("/updateUserProfile").put(validateToken,upload.single('profile'), User.updateUserProfile);

router.route('/getAllAddress').get(validateToken, User.getAllAddresses);
router.route('/addAddress').post(validateToken, User.addAddress);
router.route('/makePrimaryAddress').put(validateToken, User.makePrimaryAddress);
router.route('/editAddress').put(validateToken, User.editAddress);
router.route('/deleteAddress').delete(validateToken, User.deleteAddress);

router.route('/forgotPassword').post(User.forgotPassword);
router.route('/resetPassword').post(User.resetPassword);

module.exports = router;
