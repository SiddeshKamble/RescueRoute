function allowUserTypes(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!allowed.includes(req.user.userType)) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

module.exports = { allowUserTypes };
