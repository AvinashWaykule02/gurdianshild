const rbacMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user || !req.user.role) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }

            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: insufficient permissions",
                });
            }

            next();
        } catch (err) {
            console.error("RBAC Middleware Error:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error during authorization",
            });
        }
    };
};

module.exports = rbacMiddleware;
