const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const razorpay = require("../utils/razorpay");
const crypto = require("crypto");

const createOrder = async (req, res) => {
  try {
    const { userId, items } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found." });

    let totalAmount = 0;
    const orderItems = await Promise.all(
      items.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });
        if (!product)
          throw new Error(`Product with ID ${item.productId} not found.`);
        totalAmount += product.offerPrice * item.quantity;

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.offerPrice,
        };
      })
    );
    console.log("totalAmount ",totalAmount);
    

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.ceil(totalAmount * 100),
      currency: "INR",
      receipt: `order_rcpt_${Date.now()}`,
    });
    console.log("check");
    const order = await prisma.order.create({
      data: {
        userId,
        totalAmount,
        paymentId: razorpayOrder.id,
        paymentStatus: "PENDING",
        items: { create: orderItems },
      },
      include: { items: true },
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order,
      razorpayOrder,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const verifyPaymentAndUpdateOrder = async (req, res) => {
  try {
    const { orderId, paymentId, paymentSignature } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + "|" + paymentId)
      .digest("hex");

    if (generatedSignature !== paymentSignature) {
      return res.status(400).json({ message: "Invalid payment signature." });
    }

    const updatedOrder = await prisma.order.update({
      where: { paymentId: orderId },
      data: { paymentStatus: "COMPLETED", paymentId },
    });

    res.status(200).json({
      success: true,
      message: "Payment verified and order updated.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await prisma.order.findMany({
      where: { userId: parseInt(userId) },
      include: { items: { include: { product: true } } },
    });

    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { orderStatus: "CANCELLED" },
    });

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  createOrder,
  verifyPaymentAndUpdateOrder,
  getUserOrders,
  cancelOrder,
};
