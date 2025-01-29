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
    console.log("start createPaymentIntent");
    
    const customer = await stripe.customers.create({
      metadata: { userId: userId || "guest" },
    });
    console.log("step 1 createPaymentIntent");

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: "2024-12-18.acacia" }
    );
    console.log("step 2 createPaymentIntent");
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount * 100,
      currency: currency,
      customer: customer.id,
      description: "ShopFlow Order Payment",
      metadata: { userId: userId || "guest" },
      automatic_payment_methods: {
        enabled: true, 
      },
    });
    console.log("step 3 createPaymentIntent");

    res.status(200).json({
      paymentIntent: paymentIntent.client_secret,
      paymentIntentId:paymentIntent.id,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
    console.log("step 4 createPaymentIntent");

  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).send({ error: "Failed to create payment intent" });
  }
};

const confirmPayment = async (req, res) => {
  console.log("confirmPayment start");
  
  const { orderId, paymentIntentId, paymentMethodId } = req.body;


  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  console.log("confirmPayment step 1");


    if (paymentIntent.status === "succeeded") {
      await prisma.orderedItem.updateMany({
        where: {
          orderId: parseInt(orderId),
        },
        data: {
          paymentStatus: "COMPLETED",
          orderStatus: "CONFIRMED",

        },
      });

  console.log("confirmPayment step 2");


      await prisma.order.update({
        where: { id: parseInt(orderId) },
        data: {
          paymentStatus: "COMPLETED",
          orderStatus: "CONFIRMED",
        },
      });

  console.log("confirmPayment step 3");


      const order = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: {
          items: true,
        },
      });
  console.log("confirmPayment step 4");


      const user = await prisma.user.findUnique({
        where: { id: parseInt(order.userId) },
      });
      await emailService.orderUpdateEmail(user.email, order, "Placed");

  console.log("confirmPayment step 5");


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

const paymentMethodId = async (req, res) => {
  const { paymentIntentId } = req.query;

  // Validate paymentIntentId
  if (!paymentIntentId) {
    return res.status(400).json({ error: "Missing paymentIntentId in request" });
  }

  console.log("Received paymentIntentId:", paymentIntentId);

  try {
    // Retrieve the payment intent using the ID
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Extract payment method ID
    const paymentMethodId = paymentIntent.payment_method;

    res.status(200).json({ paymentMethodId });
  } catch (error) {
    console.error("Error retrieving payment intent:", error.message);

    // Handle specific Stripe errors if needed
    if (error.type === "StripeInvalidRequestError") {
      return res
        .status(400)
        .json({ error: "Invalid paymentIntentId or request parameters" });
    }

    res.status(500).json({ error: "Failed to retrieve payment details" });
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
      currency: "USD",
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
    console.log(orderId, razorpayId, paymentId, paymentSignature);
    

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

const failedPayment = async (req, res) => {
  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required." });
    }

    console.log("Deleting failed order:", { orderId });

    const userOrder = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
    });

    if (!userOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (userOrder.paymentStatus === "COMPLETED") {
      return res
        .status(400)
        .json({ message: "Cannot delete a completed order." });
    }

    await prisma.orderedItem.updateMany({
      where: {
        orderId: parseInt(orderId),
      },
      data: {
        paymentStatus: "FAILED",
        orderStatus: "FAILED",
        paymentId,
      },
    });

    await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: {
        paymentStatus: "FAILED",
        orderStatus: "FAILED",
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
        productId: item.product.id,
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

const getOrderForCheckout = async (req, res) => {
  const {orderId} = req.query;
  if (!orderId || isNaN(orderId)) {
    return sendResponse(res, {
      status: 400,
      type: "error",
      message: "Invalid or missing orderId.",
    });
  }
  
  try {
    const orderData = await prisma.order.findUnique({
      where: {
        id: parseInt(orderId),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    
    

    if(!orderData){
      sendResponse(res, {
        status:404,
        type: "error",
        message: "no order found..",
      })
    }

    console.log("orderData : ",orderData);


    sendResponse(res, {
      status: 200,
      type: "success",
      message :"order fetched successfully..",
      data : orderData || "null",

    })
    
  } catch (error) {
    console.error(error);
    sendResponse(res, {
      status:500,
      type:error,
      message : "Error on getOrderForCheckout..",
    })
    
  }
}


module.exports = {
  createOrder,
  checkoutOrder,
  failedPayment,
  verifyPaymentAndUpdateOrder,
  getUserOrders,
  cancelOrder,
  getOrderByOrderId,
  createPaymentIntent,
  confirmPayment,
  paymentMethodId,
  getOrderForCheckout,
};
