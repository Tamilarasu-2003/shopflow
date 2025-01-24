const express = require("express");
const {validateToken} = require('../middlewares/tokenAuthMiddleware');
const order = require('../controllers/orderController');

const router = express.Router();

router.post("/createOrder", order.createOrder);
router.post("/checkoutOrder", order.checkoutOrder);
router.post("/verify", order.verifyPaymentAndUpdateOrder);
router.post("/failedVerify", order.DeleteOrderForFailedPayment);
router.get("/getUserOrder", order.getUserOrders);
router.put("/cancelOrder", order.cancelOrder);
router.get("/getOrderById", order.getOrderByOrderId);
module.exports = router;
