const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const hash = require('../utils/hashPassword');
const jwtToken = require('../utils/jwtauth');

const {sendResponse} = require('../utils/responseHandler');

const signup = async (req, res) => {
    try{
        const {name, email, password, address, phone} = req.body;

        const existingUser = await prisma.user.findUnique({
            where: {
              email: email,
            }
          });

        if(existingUser){
            return sendResponse(res, {
                status: 400,
                type: 'error',
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
                phone : phone,
            },
        })

        const { password: _, ...userWithoutPassword } = newUser;

        sendResponse(res, {
            status: 201, 
            type: 'success',
            message: 'User created successfully.',
            data: userWithoutPassword,
        });

    }catch(error){
        console.error(error.message);
        sendResponse(res, {
            status: 500,
            type: 'error',
            message: 'Error creating user.',
            error: error.message,
        });
    }
}

const login = async (req, res) => {
    try{
        const {email, password} = req.body;

        const existingUser = await prisma.user.findUnique({
            where: {
              email: email,
            }
        });

        if(!existingUser){
            return sendResponse(res, {
                status: 404, 
                type: 'error',
                message: 'User not found.',
            });
        }

        const hashCompare = await hash.hashCompare(password, existingUser.password)

        if(!hashCompare){
            return sendResponse(res, {
                status: 401,
                type: 'error',
                message: 'Password authentication failed.',
            });
        }

        let token = await jwtToken.createToken({
            id:existingUser.id,
            name:existingUser.name,
            email:existingUser.email,
            role:existingUser.role,
        });

        const { password: _, ...userWithoutPassword } = existingUser;
        

        sendResponse(res, {
            status: 200,
            type: 'success',
            message: 'Login successful',
            data: {
                user: userWithoutPassword,
                token: token,
            },
        });

    }catch(error){
        console.error(error.message);
        sendResponse(res, {
            status: 500,
            type: 'error',
            message: 'Login error, please try again later.',
            error: error.message,
        });

    }
}

module.exports = {signup, login};