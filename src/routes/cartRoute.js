const express = require("express");
const {validateToken} = require('../middlewares/tokenAuthMiddleware');
const Cart = require('../controllers/cartController');

const router = express.Router();

router.route('/addItemToCart').post(validateToken, Cart.addItemToCart);
router.route('/viewCart').get(validateToken, Cart.viewCart);
router.route('/deleteFromCart').delete(validateToken, Cart.deleteFromCart);

module.exports = router;