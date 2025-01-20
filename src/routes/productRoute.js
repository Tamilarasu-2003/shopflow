const express = require("express");
const products = require("../controllers/productController");
const { validateSearchQuery } = require("../middlewares/validateSearchQuery");

const router = express.Router();

router.route("/getAllProducts").get(products.getAllProducts);
router.route("/flashDealProducts").get(products.getFlashDealProducts);
router.route("/filteredProducts").get(products.getFilteredProducts);
router.route("/Category").get(products.getCategory);
router.route("/subCategory").get(products.getSubCategory);
router.route("/getProductsByCategory").get(products.getProductsByCategory);
router.route("/getProductById").get(products.getProdyctById);
router
  .route("/getProductBySearch")
  .get(validateSearchQuery, products.searchProducts);

router.route('/getTrendingProducts').get(products.getTrendingProducts);
router.route('/getNewArrivals').get(products.getNewArrivals);
router.route('/getLimitedTimeOffers').get(products.getLimitedTimeOffers);

module.exports = router;
