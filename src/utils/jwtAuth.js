const  jwt = require('jsonwebtoken');

const createToken = async(payload)=>{
    const token = await jwt.sign(payload,process.env.JWT_TOKEN,{
        expiresIn:process.env.JWT_EXPIRE
    })
    return token
}



module.exports = {createToken}
