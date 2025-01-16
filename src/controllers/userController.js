const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const hash = require("../utils/hashPassword");
const jwtToken = require("../utils/jwtAuth");

const { sendResponse } = require("../utils/responseHandler");

const signup = async (req, res) => {
  try {
    const { name, email, password, address, phone } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      return sendResponse(res, {
        status: 400,
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
        address: address,
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

const oAuth = async (req, res) => {
  try {
    const { id, name, email, image } = req.body;
    console.log(req.body);
    
    // const email = emails[0]?.value;
    // const profilePicture = photos[0]?.value;

    let user = await prisma.user.findUnique({
      where: { googleId: id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: id,
          email: email,
          name: name,
          profilePicture: image,
          password: "Tamil@9976",
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

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    let resetToken = await jwtToken.resetToken({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordResetEmail(email, resetURL);

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email: user.email },
      data: {
        password: hashedPassword,
      },
    });

    res.status(200).json({ message: 'Password successfully reset.' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'Reset token has expired.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ message: 'Invalid reset token.' });
    }

    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = { signup, login, oAuth, forgotPassword, resetPassword };
