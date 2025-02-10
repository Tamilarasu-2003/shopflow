const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const jwt = require('jsonwebtoken');

const { sendResponse } = require("../utils/responseHandler");


const validateToken = async (req, res, next) => {
    try {
        
   
    // const {userId} = req.query;
    let token = req.headers.authorization?.split(' ')[1];
    console.log("token : ",token);
    
    

    if (!token){
        return sendResponse(res, {
            status: 401,
            type: 'error',
            message: 'No token found......',
        });
    };
    
    const payload = jwt.verify(token, process.env.JWT_TOKEN)

    const user = await prisma.user.findUnique({
        where: { id: payload.id }
    });

    if (!user) {
        return sendResponse(res, {
            status: 404,
            type: 'error',
            message: 'User not found.',
        });
    } 

    // const requestedUserId = parseInt(userId, 10);

    // if (isNaN(requestedUserId) || requestedUserId !== payload.id) {
    //     return sendResponse(res, {
    //         status: 403,
    //         type: 'error',
    //         message: 'ID mismatch with token.',
    //     });
    // }

    req.user = user;
    console.log("req.user.id : ",req.user.id);
    

    return next();
} catch (error) {
       console.log(error);
         
}


}

module.exports = {validateToken}