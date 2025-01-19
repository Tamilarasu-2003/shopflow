const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const razorpay = require("../utils/razorpay");
const crypto = require("crypto");

const createOrder = async (req, res) => {
  try {
    const { userId, items } = req.body;

    const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
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

    const orderData = await prisma.order.create({
      data: {
        userId,
        totalAmount,
        paymentStatus: "PENDING",
        items: { create: orderItems },
      },
      include: { items: true },
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully for summary.",
      order: orderData,
    });
  } catch (error) {
    console.error("Error creating temporary order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const checkoutOrder = async (req, res) => {
  try {
    const { orderId } = req.query;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentStatus !== "PENDING_SUMMARY")
      return res.status(400).json({ message: "Invalid order for checkout." });

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.ceil(order.totalAmount * 100),
      currency: "INR",
      receipt: `order_rcpt_${Date.now()}`,
    });

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PENDING_PAYMENT",
        paymentId: razorpayOrder.id,
      },
    });

    res.status(200).json({
      success: true,
      message: "Checkout initiated successfully.",
      razorpayOrder,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error confirming checkout:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const verifyPaymentAndUpdateOrder = async (req, res) => {
  try {
    const { orderId, paymentId, paymentSignature } = req.query;

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
    const { userId } = req.query;

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
    const { orderId } = req.query;

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
  checkoutOrder,
  verifyPaymentAndUpdateOrder,
  getUserOrders,
  cancelOrder,
};
