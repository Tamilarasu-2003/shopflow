const express = require("express");
const {validateToken} = require('../middlewares/tokenAuthMiddleware');
const Wishlist = require('../controllers/wishlistController');

const router = express.Router();

router.route('/addOrRemoveItem').post(validateToken, Wishlist.addOrRemoveItem);
router.route('/viewWishlist').get(validateToken, Wishlist.viewWishlist);

module.exports = router;