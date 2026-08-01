const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    next();
  };
};

const requireJayAdministrator = (req, res, next) => {
  if (
    !req.user ||
    req.user.role_name !== "administrator" ||
    req.user.email !== "jay.more@valencianutrition.com"
  ) {
    return res.status(403).json({
      success: false,
      message: "Only Jay More can access the administrator dashboard.",
    });
  }

  next();
};

module.exports = {
  requireRole,
  requireJayAdministrator,
};