import jwt from "jsonwebtoken";

const authToken = (req, res, next) => {
  const authorization = req.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      code: 401,
      message: "Authentication token is required.",
    });
  }

  const token = authorization.slice("Bearer ".length);

  jwt.verify(token, process.env.JWT_SECRET || "EFREI", (err, user) => {
    if (err) {
      return res.status(401).json({
        code: 401,
        message: "Invalid or expired token.",
      });
    }

    req.user = user;
    next();
  });
};

export default authToken;
