const jwt = require("jsonwebtoken");
const env = require("../config/env");
const prisma = require("../config/db");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const student = await prisma.student.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        enrollmentNo: true,
        name: true,
        email: true,
        branch: true,
        year: true,
        role: true,
      },
    });

    if (!student) {
      return res.status(401).json({ error: "User account no longer exists" });
    }

    req.user = student;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session token expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid authentication token" });
  }
}

module.exports = authenticate;
