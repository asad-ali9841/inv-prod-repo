const { getRedisClient } = require("../../database/connection");
const { checkPermission } = require("../../utils/rbac-utils");
const redisClient = getRedisClient();
function rbacMiddleware(path, action) {
  return async function (req, res, next) {
    if (!req.user)
      return res.status(401).json({
        status: 0,
        type: "error",
        responseMessage: "You are not authenticated to perform this action",
        data: {},
      }); // No user logged in
    const roles = req.user.role;
    if (!roles || !Array.isArray(roles) || roles.length === 0)
      return res.status(403).json({
        status: 0,
        type: "error",
        responseMessage: "Access denied. No valid roles defined for the user",
        data: {},
      });

    // Check permissions across all roles
    for (const role of roles) {
      const cacheRole = await redisClient.hGet("roles", role);
      if (!cacheRole) continue; // Skip invalid roles

      const roleObj = JSON.parse(cacheRole);

      // If any role has the required permission, grant access
      if (checkPermission(path, action, roleObj)) return next(); // Permission granted
    }

    return res.status(403).json({
      status: 0,
      type: "error",
      responseMessage: [
        "Access denied. You are not allowed to perform this action",
      ],
      data: {},
    }); // Permission denied
  };
}

module.exports = { rbacMiddleware };
