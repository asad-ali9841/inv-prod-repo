const { ValidateSignature } = require("../../utils");
const { getRedisClient } = require("../../database/connection");
const redisClient = getRedisClient();

module.exports = async (req, res, next) => {
  const isAuthorized = await ValidateSignature(req);
  if (!isAuthorized) {
    return res.status(401).json({
      status: 0, // 0 for success, 0 for error
      type: "error", // success/error/ info / error
      responseMessage: "Unauthorized token. Please try logging in again", // some description of the response
      data: {}, // data if it is there
    });
  }
  // Check if the user is logged in or not (fetching from redis)
  const loggedInData = await redisClient.hGetAll(req.user.key);
  const isLoggedIn = Object.values(loggedInData).includes(
    req.get("Authorization")
  );

  if (isAuthorized && isLoggedIn) {
    return next();
  }

  return res.status(401).json({
    status: 0, // 0 for success, 0 for error
    type: "error", // success/error/ info / error
    responseMessage: "You are not authenticated. Please try logging in again", // some description of the response
    data: {}, // data if it is there
  });
};
