const jwt = require("jsonwebtoken");

const createToken = async (payload) => {
  const token = await jwt.sign(payload, process.env.JWT_TOKEN, {
    expiresIn: process.env.JWT_EXPIRE,
  });
  return token;
};

const verifyToken = async (token) => {
  await jwt.verify(token, process.env.JWT_TOKEN, (err, user) => {
    if (err) {
      return sendResponse(res, {
        status: 403,
        type: "error",
        message: "Invalid or expired token",
      });
    }
    console.log("user",user);
    
    return user;
  });
  
};

module.exports = { createToken, verifyToken };
