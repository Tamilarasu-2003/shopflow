const crypto = require("crypto");
const bcrypt = require("bcrypt");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const AWS = require("aws-sdk");

const hash = require("../utils/hashPassword");
const jwt = require("jsonwebtoken");
const jwtToken = require("../utils/jwtAuth");

const { sendResponse } = require("../utils/responseHandler");
const emailService = require("../utils/emailServices");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const signup = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      return sendResponse(res, {
        status: 409,
        type: "error",
        message: `User with email ${email} already exists.`,
        data: existingUser,
      });
    }

    const hashedPassword = await hash.hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name: name,
        email: email,
        password: hashedPassword,
        phone: phone,
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;

    sendResponse(res, {
      status: 201,
      type: "success",
      message: "User created successfully.",
      data: userWithoutPassword,
    });

  } catch (error) {
    console.error(error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Error creating user.",
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!existingUser) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "User not found.",
      });
    }

    const hashCompare = await hash.hashCompare(password, existingUser.password);

    if (!hashCompare) {
      return sendResponse(res, {
        status: 401,
        type: "error",
        message: "Password authentication failed.",
      });
    }

    let token = await jwtToken.createToken({
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
    });

    const { password: _, ...userWithoutPassword } = existingUser;

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Login successful",
      data: {
        ...userWithoutPassword,
        profile_pic: userWithoutPassword.image,
      },
      token: token,
    });
  } catch (error) {
    console.error(error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Login error, please try again later.",
      error: error.message,
    });
  }
};

const oAuth = async (req, res) => {
  try {
    const { id, name, email, image } = req.body;
    console.log("body : ",req.body);

    let user = await prisma.user.findUnique({
      where: { googleId: id },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          googleId: id,
          email: email,
          name: name,
          profilePicture: image,
          password: hashedPassword,
        },
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    let token = await jwtToken.createToken({
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
    });

    const { password: _, ...userWithoutPassword } = existingUser;

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Login successful",
      data: userWithoutPassword,
      token: token,
    });
  } catch (error) {
    console.error(error.message);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Login error, please try again later.",
      error: error.message,
    });
  }
};

const userProfileInfo = async (req, res) => {
  const userId  = req.user.id;

  if (!userId) {
    return sendResponse(res, {
      status: 404,
      type: "error",
      message: "User id required.",
    });
  };

  const existingUser = await prisma.user.findUnique({
    where: {
      id: parseInt(userId),
    },
  });

  if (!existingUser) {
    return sendResponse(res, {
      status: 404,
      type: "error",
      message: "User not found.",
    });
  }

  sendResponse(res, {
    status: 200,
    type: "success",
    data: {
      name: existingUser.name,
      email: existingUser.email,
      phone: existingUser.phone,
      profile_pic: existingUser.image,
    },
  });
};

const updateUserProfile = async (req, res) => {
  try {
    let image = req.file;
    const data = req.body;
    const userId  = req.user.id;

    const { name, phone } = data;

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

    if (phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ phone: phone, NOT: { id: parseInt(userId) } }],
        },
      });

      if (existingUser) {
        return sendResponse(res, {
          status: 400,
          type: "error",
          message: "Email or phone already exists for another user.",
        });
      }
    }

    if (image) {
      const fileName = `profile-images/${userId}-${Date.now()}.jpg`;
      const params = {
        Bucket: process.env.S3_BUCKET_USERPROFILE,
        Key: fileName,
        Body: image.buffer,
        ContentType: image.mimetype,
      };
      const s3Response = await s3.upload(params).promise();
      imageUrl = s3Response.Location;
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(image && { image: imageUrl }),
      },
    });

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Profile Updated",
      data: {
        ...updatedUser,
        profile_pic: updatedUser.image,
      },
    });
  } catch (error) {
    console.error("Error updating user profile:", error);

    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error in updateUserProfile",
      error: error,
    });
  }
};

const addAddress = async (req, res) => {
  try {
    const { userId, street, city, state, country, zip, isPrimary } = req.query;
    const booleanValue = isPrimary === "true" ? true : false;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return sendResponse(res, {
        status:404,
        type:"error",
        message:"User not found."
      })
    }

    if (booleanValue) {
      await prisma.addressOnUser.updateMany({
        where: { userId: parseInt(userId), isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: { street, city, state, country, postalCode: zip },
    });

    await prisma.addressOnUser.create({
      data: {
        userId: parseInt(userId),
        addressId: newAddress.id,
        isPrimary: booleanValue,
      },
    });

    sendResponse(res,{
        status:200,
        type:"success",
        message:"Add Address successfully completed."
    })
  } catch (error) {
    console.error("Error adding address:", error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error in addAddress",
      error: error,
    });
  }
};

const makePrimaryAddress = async (req, res) => {
  try {
    const { addressId } = req.query;
    const userId  = req.user.id;

    const addressOnUser = await prisma.addressOnUser.findFirst({
      where: {
        userId: parseInt(userId),
        addressId: parseInt(addressId),
      },
    });

    if (!addressOnUser) {
      return res.status(404).json({
        status: "error",
        message: "Address not found or does not belong to the user.",
      });
    }

    await prisma.addressOnUser.updateMany({
      where: { userId: parseInt(userId), isPrimary: true },
      data: { isPrimary: false },
    });

    await prisma.addressOnUser.update({
      where: { id: addressOnUser.id },
      data: { isPrimary: true },
    });

    sendResponse(res,{
      status:200,
      type:"success",
      message: "Address marked as primary successfully.",
    })
  } catch (error) {
    console.error("Error making address primary:", error);

    sendResponse(res, {
      status:500,
      type:"error",
      message: "Internal Server Error in makePrimaryAddress",
    })
  }
};

const editAddress = async (req, res) => {
  try {
    const { addressId, street, city, state, country, zip, isPrimary } = req.query;
    const userId  = req.user.id;
    const booleanValue = isPrimary === "true" ? true : false;

    if (booleanValue) {
      await prisma.addressOnUser.updateMany({
        where: { userId: parseInt(userId), isPrimary: true },
        data: { isPrimary: false },
      });
    }

    await prisma.address.update({
      where: { id: parseInt(addressId) },
      data: { street, city, state, country, postalCode: zip },
    });

    await prisma.addressOnUser.update({
      where: { id: parseInt(addressId) },
      data: {
        isPrimary: booleanValue,
      },
    });

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Address update successfully.",
    });

  } catch (error) {
    console.error("Error adding address:", error);
    sendResponse(res, {
      status:500,
      type: "error",
      message: "Internal Server Error while editAddress."
    });
  };
};

const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.query;
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

  await prisma.address.delete({
    where: { id: parseInt(addressId) },
  });
  sendResponse(res, {
    status:200,
    type:"success",
    message:"deletion successful...."
  });

  } catch (error) {
    console.error("Error adding address:", error);
    sendResponse(res, {
      status:500,
      type: "error",
      message: "Internal Server Error"
    });
  }
  
};

const getAllAddresses = async (req, res) => {
  try {
    const userId  = req.user.id;

    if (!userId) {
      return sendResponse(res, {
        status: 400,
        type: "error",
        message: "User ID is required.",
      });
    }

    const userAddresses = await prisma.addressOnUser.findMany({
      where: { userId: parseInt(userId) },
      orderBy: {
        address: { createdAt: "asc" },
      },
      include: {
        address: true,
      },
    });

    if (!userAddresses.length) {
      return sendResponse(res, {
        status: 200,
        type: "success",
        message: "No addresses found for this user.",
        data: [],
      });
    }

    const addresses = userAddresses
      .map((userAddress) => ({
        id: userAddress.address.id,
        userId: userAddresses[0].userId,
        street: userAddress.address.street,
        city: userAddress.address.city,
        state: userAddress.address.state,
        country: userAddress.address.country,
        zip: userAddress.address.postalCode,
        isPrimary: !!userAddress.isPrimary,
      }))
      .sort((a, b) => b.isPrimary - a.isPrimary);

    sendResponse(res, {
      status: 200,
      type: "success",
      message: "Addresses retrieved successfully.",
      data: addresses,
    });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  console.log("forgot password");

  const { email } = req.query;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "User not found.",
      });
    }

    let resetToken = await jwtToken.resetToken({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    const resetURL = `${process.env.FRONTEND_URL}?token=${resetToken}`;
    console.log(resetURL);

    await emailService.sendPasswordResetEmail(email, resetURL);

    sendResponse(res, {
      status: 404,
      type: "error",
      message: "Password reset link sent to your email.",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.query;

  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    if (!user) {
      return sendResponse(res, {
        status: 404,
        type: "error",
        message: "User not found.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email: user.email },
      data: {
        password: hashedPassword,
      },
    });

    sendResponse(res, {
      status: 200,
      success: true,
      message: "Password successfully reset.",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      sendResponse(res, {
        status: 500,
        type: "error",
        message: "Reset token has expired.",
        error: error.message,
      });
    }
    if (error.name === "JsonWebTokenError") {
      sendResponse(res, {
        status: 500,
        type: "error",
        message: "Invalid reset token.",
        error: error.message,
      });
    }

    console.error("Error resetting password:", error);
    sendResponse(res, {
      status: 500,
      type: "error",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  signup,
  login,
  oAuth,
  forgotPassword,
  resetPassword,
  userProfileInfo,
  updateUserProfile,
  addAddress,
  makePrimaryAddress,
  getAllAddresses,
  editAddress,
  deleteAddress,
};
