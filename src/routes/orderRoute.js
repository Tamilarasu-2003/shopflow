const express = require("express");
const {validateToken} = require('../middlewares/tokenAuthMiddleware');
const order = require('../controllers/orderController');

const router = express.Router();

router.post("/createOrder", validateToken, order.createOrder);

router.post("/checkoutOrder",validateToken, order.checkoutOrder);
router.post("/verify",validateToken, order.verifyPaymentAndUpdateOrder);
router.post("/failedPayment",validateToken, order.failedPayment);
router.get("/getUserOrder",validateToken, order.getUserOrders);
router.put("/cancelOrder",validateToken, order.cancelOrder);
router.get("/getOrderById",validateToken, order.getOrderByOrderId);
router.route('/getOrderForCheckout').get(validateToken,order.getOrderForCheckout);

router.post("/createPaymentIntent",validateToken, order.createPaymentIntent);
router.post("/confirmPayment",validateToken, order.confirmPayment);
router.get('/paymentMethodId',validateToken, order.paymentMethodId);

module.exports = router;
