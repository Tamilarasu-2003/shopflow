const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { sendResponse } = require("../utils/responseHandler");

const addOrRemoveItem = async (req, res) => {
  try {
    const { productId } = req.query;
    console.log("productId : ",productId);

    const userId  = req.user.id;
    console.log("userId : ",userId);
    

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return sendResponse(res, {
        status:404,
        type:"error",
        message:"user not found.",
      })
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
    });

    if (!product) {
      sendResponse(res, {
        status:404,
        type:"error",
        message:"Product not found.",
      })
    }

    let wishlist = await prisma.wishlist.findUnique({
      where: { userId: parseInt(userId) },
      include: {
        products: {
          orderBy: { createdAt: "desc" },
          include: {
            product: true,
          },
        },
      },
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: {
          userId: parseInt(userId),
          products: {
            create: [{ productId: parseInt(productId) }],
          },
        },
        include: { products: true },
      });
      // return res.status(201).json({
      //   status: "success",
      //   message: "Product added to wishlist.",
      //   data: wishlist,
      // });
      sendResponse(res, {
        status:201,
        type:"success",
        message: "Product added to wishlist.",
        data:wishlist,
      })
    }

    const productInWishlist = wishlist.products.find(
      (item) => item.productId === parseInt(productId)
    );

    if (productInWishlist) {
      await prisma.wishlistProduct.delete({
        where: { id: productInWishlist.id },
      });
      // return res.status(200).json({
      //   status: "success",
      //   message: "Product removed from wishlist.",
      // });
      sendResponse(res, {
        status:200,
        type:"success",
        message:"Product removed from wishlist.",
      })
    } else {
      await prisma.wishlistProduct.create({
        data: {
          wishlistId: wishlist.id,
          productId: parseInt(productId),
        },
      });
      // return res.status(200).json({
      //   status: "success",
      //   message: "Product added to wishlist.",
      // });
      sendResponse(res, {
        status:200,
        type:"success",
        message:"Product added to wishlist.",
      })
    }
  } catch (error) {
    console.error("Error handling wishlist:", error);
    // res.status(500).json({
    //   status: "error",
    //   message: "Internal server error.",
    // });
    sendResponse(res, {
      status:500,
      type:"error",
      message:"Internal server error in wishlist"
    })
  }
};

const viewWishlist = async (req, res) => {
  try {
    const userId  = req.user.id;

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

    let wishlist = await prisma.wishlist.findUnique({
      where: { userId: parseInt(userId) },
      include: {
        products: {
          orderBy: { createdAt: "desc" },
          include: {
            product: true,
          },
        },
      },
    });

    if (!wishlist) {
      sendResponse(res, {
        status: 404,
        type: "error",
        message: "wishlist is empty.",
      });
    }

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "wishlist items fetched successfully",
      data: wishlist,
    });
  } catch (error) {
    console.error("Error handling wishlist:", error);
    // res.status(500).json({
    //   status: "error",
    //   message: "Internal server error.",
    // });
    sendResponse(res, {
      status:500,
      type:"error",
      message:"Internal server error in view Wishlist."
    })
  }
};

module.exports = { addOrRemoveItem, viewWishlist };