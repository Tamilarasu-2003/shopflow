const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { sendResponse } = require("../utils/responseHandler");

const addItemToCart = async (req, res) => {
  const { userId, productId, quantity } = req.query;

  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
    });

    if (!product) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "Product not found.",
      });
    }

    let totalPrice = parseInt(quantity) * product.offerPrice;

    if (quantity > product.stock) {
      return sendResponse(res, {
        status: 400,
        type: "error",
        message: "Requested quantity exceeds available stock.",
      });
    }

    let cart = await prisma.cart.findUnique({
      where: { userId: parseInt(userId) },
      include: { items: true },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: parseInt(userId),
          totalPrice: totalPrice,
          items: {
            create: [
              {
                productId: parseInt(productId),
                quantity: parseInt(quantity),
              },
            ],
          },
        },
      });

      return sendResponse(res, {
        status: 201,
        type: "success",
        message: "Cart created, and item added successfully.",
        data: cart,
      });
    }

    const existingCartItem = cart.items.find(
      (item) => item.productId === parseInt(productId)
    );

    
    if (existingCartItem) {
      totalPrice = totalPrice + (parseInt(quantity)*product.offerPrice)
      const updatedCartItem = await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: existingCartItem.quantity + parseInt(quantity),
          totalPrice: totalPrice,
        },
      });

      return sendResponse(res, {
        status: 200,
        type: "success",
        message: "Cart item quantity updated successfully.",
        data: updatedCartItem,
      });
    }

    const newCartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: parseInt(productId),
        quantity: parseInt(quantity),
        totalPrice : totalPrice,
      },
    });

    sendResponse(res, {
      status: 201,
      type: "success",
      message: "Item added to cart successfully.",
      data: newCartItem,
    });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal server error.",
    });
  }
};

const viewCart = async (req, res) => {
  const { userId } = req.query;

  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
  });

  if (!user) {
    return sendResponse(res, {
      status: 404,
      type: "error",
      message: "User not found.",
    });
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: parseInt(userId) },
    include: {
      items: true,
    },
  });

  if (!cart) {
    sendResponse(res, {
      status: 404,
      type: "error",
      message: "cart is empty.",
    });
  }

  sendResponse(res, {
    status: 200,
    type: "success",
    message: "cart items fetched successfully",
    data: cart,
  });
};

const deleteFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "User not found.",
      });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: parseInt(userId) },
      include: {
        items: true,
      },
    });

    if (!cart) {
      sendResponse(res, {
        status: 404,
        type: "error",
        message: "cart is empty.",
      });
    }

    const indexFound = cart.items.findIndex(
      (item) => item.productId == productId
    );

    if (indexFound == -1) {
      sendResponse(res, {
        status: 404,
        type: "error",
        message: "Product not found in cart.",
      });
    }

    const updatedCart = await prisma.cart.update({
      where: {
        userId: parseInt(userId),
      },
      data: {
        items: {
          deleteMany: {
            productId: parseInt(productId),
          },
        },
      },
      include: {
        items: true,
      },
    });

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Product removed from the cart.",
      data: updatedCart,
    });
  } catch (error) {
    console.error("Error adding item to cart:", error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal server error.",
    });
  }
};

module.exports = { addItemToCart, viewCart, deleteFromCart };
