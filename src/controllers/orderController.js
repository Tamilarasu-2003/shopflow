const Razorpay = require("razorpay");
const emailService = require("../utils/emailServices");

const Stripe = require("stripe");

// const { check, validationResult } = require("express-validator");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const razorpay = require("../utils/razorpay");
const { sendResponse } = require("../utils/responseHandler");

const createOrder = async (req, res) => {
  try {
    const { userId, items } = req.body;
    console.log("items : ", items);

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

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

    console.log("totalAmount : ", totalAmount);

    const orderData = await prisma.order.create({
      data: {
        userId,
        totalAmount: Math.floor(totalAmount),
        orderStatus: "PENDING",
        paymentStatus: "PENDING",
        orderDate: new Date(),

        items: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity || 1,
            price: item.price,
            paymentId: item.paymentId || null,
            orderStatus: "PENDING",
            paymentStatus: "PENDING",
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Order created successfully for summary.",
      order: orderData,
      totalAmount: totalAmount,
    });
  } catch (error) {
    console.error("Error creating temporary order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const createPaymentIntent = async (req, res) => {
  const { userId, totalAmount, currency = "usd" } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount * 100,
      currency: currency,
      description: "ShopFlow Order Payment",
      metadata: { userId: userId || "guest" },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).send({ error: "Failed to create payment intent" });
  }
};

const confirmPayment = async (req, res) => {
  const { paymentIntentId, paymentMethodId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    if (paymentIntent.status === "succeeded") {
      await prisma.orderedItem.updateMany({
        where: {
          orderId: parseInt(orderId),
        },
        data: {
          paymentStatus: "COMPLETED",
          orderStatus: "CONFIRMED",
          paymentId,
        },
      });

      await prisma.order.update({
        where: { id: parseInt(orderId) },
        data: {
          paymentStatus: "COMPLETED",
          orderStatus: "CONFIRMED",
          paymentId,
        },
      });

      const order = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: {
          items: true,
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: parseInt(order.userId) },
      });
      await emailService.orderUpdateEmail(user.email, order, "Placed");

      res.status(200).json({
        success: true,
        message: "Payment verified and order updated.",
        order: order,
      });
    } else {
      res
        .status(400)
        .send({ error: "Payment failed", status: paymentIntent.status });
    }
  } catch (error) {
    console.error("Error confirming payment:", error.message);
    res.status(500).send({ error: "Failed to confirm payment" });
  }
};

const checkoutOrder = async (req, res) => {
  try {
    const { orderId } = req.query;

    console.log("orderId : ", orderId);

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        items: true,
      },
    });

    if (
      !order ||
      order.items.some((item) => item.paymentStatus !== "PENDING")
    ) {
      return res.status(400).json({ message: "Invalid order for checkout." });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.ceil(order.totalAmount * 100),
      currency: "INR",
      receipt: `order_rcpt_${Date.now()}`,
    });

    await prisma.orderedItem.updateMany({
      where: {
        orderId: parseInt(orderId),
      },
      data: {
        paymentStatus: "PENDING",
        paymentId: razorpayOrder.id,
      },
    });

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: {
        paymentStatus: "PENDING",
        paymentId: razorpayOrder.id,
        updatedAt: new Date(),
      },
    });
    console.log("updatedOrder : ", updatedOrder);

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
    const { orderId, razorpayId, paymentId, paymentSignature } = req.query;

    if (!orderId || !razorpayId || !paymentId || !paymentSignature) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    console.log("Verifying Payment:", {
      orderId,
      razorpayId,
      paymentId,
      paymentSignature,
    });

    const isValidSignature = Razorpay.validateWebhookSignature(
      razorpayId + "|" + paymentId,
      paymentSignature,
      process.env.RAZORPAY_KEY_SECRET
    );

    if (!isValidSignature) {
      return res.status(400).json({ message: "Invalid payment signature." });
    }

    await prisma.orderedItem.updateMany({
      where: {
        orderId: parseInt(orderId),
      },
      data: {
        paymentStatus: "COMPLETED",
        orderStatus: "CONFIRMED",
        paymentId,
      },
    });

    await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: {
        paymentStatus: "COMPLETED",
        orderStatus: "CONFIRMED",
        paymentId,
      },
    });

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        items: true,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: parseInt(order.userId) },
    });
    await emailService.orderUpdateEmail(user.email, order, "Placed");

    res.status(200).json({
      success: true,
      message: "Payment verified and order updated.",
      order: order,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const DeleteOrderForFailedPayment = async (req, res) => {
  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required." });
    }

    console.log("Deleting failed order:", { orderId });

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.paymentStatus === "COMPLETED") {
      return res
        .status(400)
        .json({ message: "Cannot delete a completed order." });
    }

    await prisma.order.delete({
      where: { id: parseInt(orderId) },
    });

    res.status(200).json({
      success: true,
      message: "Order deleted successfully due to failed payment.",
    });
  } catch (error) {
    console.error("Error deleting failed order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.query;

    const orders = await prisma.order.findMany({
      where: {
        userId: parseInt(userId),
        items: {
          some: {
            orderStatus: "CONFIRMED",
          },
        },
      },
      include: {
        items: {
          where: {
            orderStatus: "CONFIRMED",
          },
          select: {
            id: true,
            product: true,
            quantity: true,
            price: true,
            orderStatus: true,
          },
        },
      },
    });

    const data = orders.map((order) => ({
      orderDate: new Date(order.createdAt).toISOString().split("T")[0],
      total: order.totalAmount,
      items: order.items.map((item) => ({
        orderId: item.id,
        status: item.orderStatus,
        quantity: item.quantity,
        productName: item.product.name,
        offerPrice: item.product.offerPrice,
        image: item.product.image,
      })),
    }));

    sendResponse(res, {
      status: 200,
      type: "success",
      data: [...data],
    });

    // res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.query;

    const updatedOrder = await prisma.orderedItem.update({
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

const getOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.query;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { items: { include: { product: true } } },
    });
    if (!order) {
      console.error("order not found");
    }
    console.log("order : ", order);
    const date = new Date(order.orderDate).toISOString().split("T")[0];
    const subCategoryId = order.items[0].product.subCategoryId;
    const productId = order.items[0].product.id;

    const similarProducts = await prisma.product.findMany({
      where: {
        subCategoryId: parseInt(subCategoryId),
        id: { not: parseInt(productId) },
      },
      select: {
        id: true,
        name: true,
        image: true,
        description: true,
        actualPrice: true,
        offerPrice: true,
        discountPercentage: true,
        subCategoryId: true,
        rating: true,
      },
    });

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Order Fetched Successfully.",
      data: {
        orderDate: date,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        product: order.items,
        similarProducts: similarProducts,
      },
    });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


module.exports = {
  createOrder,
  checkoutOrder,
  DeleteOrderForFailedPayment,
  verifyPaymentAndUpdateOrder,
  getUserOrders,
  cancelOrder,
  getOrderByOrderId,
  createPaymentIntent,
  confirmPayment,
};
