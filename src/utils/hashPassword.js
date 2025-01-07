const bcrypt = require('bcrypt');

const hashPassword =async(password)=>{
    let salt= await bcrypt.genSalt(Number(process.env.SALT_ROUNDS))
    let hash = await bcrypt.hash(password,salt)
    return hash
    
}
const hashCompare = async (password,hash)=>{
    return await bcrypt.compare(password,hash)

}

module.exports = {hashPassword, hashCompare}