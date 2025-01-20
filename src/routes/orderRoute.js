const express = require("express");
const {validateToken} = require('../middlewares/tokenAuthMiddleware');
const order = require('../controllers/orderController');

const router = express.Router();

router.post("/createOrder", validateToken, order.createOrder);
router.post("/checkoutOrder", validateToken, order.checkoutOrder);
router.post("/verify", validateToken, order.verifyPaymentAndUpdateOrder);
router.post("/failedVerify", validateToken, order.DeleteOrderForFailedPayment);
router.get("/getUserOrder", validateToken, order.getUserOrders);
router.put("/cancelOrder", validateToken, order.cancelOrder);

module.exports = router;
