const express = require("express");
const order = require('../controllers/orderController');

const router = express.Router();

router.post("/createOrder", order.createOrder);
router.post("/checkoutOrder", order.checkoutOrder);
router.post("/verify", order.verifyPaymentAndUpdateOrder);
router.post("/failedVerify", order.DeleteOrderForFailedPayment);
router.get("/getUserOrder", order.getUserOrders);
router.put("/:orderId/cancel", order.cancelOrder);

module.exports = router;
