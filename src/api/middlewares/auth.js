const { ValidateSignature } = require('../../utils');

module.exports = async (req,res,next) => {
    const isAuthorized = await ValidateSignature(req);

    if(isAuthorized){
        return next();
    }
    return res.status(401).json({
        status: 0,  // 0 for success, 0 for error
        type: 'error',  // success/error/ info / error
        responseMessage: "You are not authenticated. Please try logging in again", // some description of the response
        data:{}, // data if it is there
        errorMessage:"", // error message, what is the reason of the error
    })
}