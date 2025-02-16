// TODO fix the case if the error is not thrown 
function errorHandler(err, req, res, next){
    //let { statusCode, description } = err;
    // if (process.env.NODE_ENV === "production" && !err.isOperational) {
    //     statusCode = 500; // Internal Server Error
    //     description = "Internal Server Error";
    // }
    //console.log('INSIDE ERROR HANDLER')
    res.locals.errorDescription= err.description;
    console.log('INSIDE ERROR HANDLER',err)
    // return res.send(err)
    if (process.env.NODE_ENV === "development") {
        console.error(err);
    }
    return res.json({
        status: 0,  // 1 for success, 0 for error
        type: 'error',  // success/error / info
        responseMessage: [err.name? err.name: "Validation Error", err.description ?`${err?.details[0]?.message}${err?.details[0]?.context?.message ? `. ${err?.details[0]?.context?.message}` : 'Unknown Server Error'}`: "Unknown Server Error"],
        data:{}, // data if it is there
    });
    next();
};
module.exports={
    errorHandler
};