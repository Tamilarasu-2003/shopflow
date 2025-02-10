const express = require("express");
const {validateToken} = require('../middlewares/tokenAuthMiddleware');
const order = require('../controllers/orderController');

const router = express.Router();

router.post("/createOrder", validateToken, order.createOrder);

router.post("/checkoutOrder", order.checkoutOrder);
router.post("/verify", order.verifyPaymentAndUpdateOrder);
router.post("/failedPayment", order.failedPayment);
router.get("/getUserOrder", order.getUserOrders);
router.put("/cancelOrder", order.cancelOrder);
router.get("/getOrderById", order.getOrderByOrderId);
router.route('/getOrderForCheckout').get(order.getOrderForCheckout);

router.post("/createPaymentIntent",validateToken, order.createPaymentIntent);
router.post("/confirmPayment", order.confirmPayment);
router.get('/paymentMethodId', order.paymentMethodId);

module.exports = router;
