function rbacMiddleware(rbac, resource, action) {
    return function(req, res, next) {
        // Assuming `req.user` holds the current user's role
        if (!req.user) {
            return res.status(401).json({
                status: 0,
                type: "error",
                responseMessage: "Access denied",
                data: {},
                errorMessage: "You are not authenticated to perform this action"
            });  // No user logged in
        }

        const role = req.user.role;
        if (!role) {
            return res.status(403).json({
                status: 0,
                type: "error",
                responseMessage: "Access denied",
                data: {},
                errorMessage: "Role undefined for the user"
            });
        }
        console.log(role,resource, action, "CHECK PERMISSION", rbac.checkPermission(role, resource, action))
        // Check permission
        if (rbac.checkPermission(role, resource, action)) {
            next();  // Permission granted
        } else {
            res.status(403).json({
                status: 0,
                type: "error",
                responseMessage: "Access denied",
                data: {},
                errorMessage: "You are not allowed to perform this action"
            });  // Permission denied
        }
    };
};

module.exports = {rbacMiddleware};
