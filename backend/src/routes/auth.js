const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../config/db");
const env = require("../config/env");
const { authLimiter } = require("../middleware/rateLimit");
const authenticate = require("../middleware/auth");

const router = express.Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const adminLoginSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required").max(50),
  password: z.string().min(1, "Password is required"),
});

const voterLoginSchema = z.object({
  adminId: z.string().min(1, "Admin ID is required").max(50),
  enrollmentNo: z.string().min(1, "Enrollment number is required").max(50),
  password: z.string().min(1, "Password is required"),
});

const registerAdminSchema = z.object({
  adminId: z
    .string().min(3).max(50)
    .regex(/^[A-Za-z0-9_\-]+$/, "Admin ID can only contain letters, numbers, _ and -"),
  name: z.string().min(2).max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function buildTokenResponse(student) {
  const token = jwt.sign(
    {
      id: student.id,
      enrollmentNo: student.enrollmentNo,
      role: student.role,
      name: student.name,
      branch: student.branch,
      year: student.year,
      adminId: student.adminId ?? null,
    },
    env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  return {
    success: true,
    token,
    user: {
      id: student.id,
      enrollmentNo: student.enrollmentNo,
      name: student.name,
      branch: student.branch,
      year: student.year,
      role: student.role,
      adminId: student.adminId ?? null,
    },
  };
}

// ─── POST /api/auth/register-admin ───────────────────────────────────────────
router.post("/register-admin", authLimiter, async (req, res, next) => {
  try {
    const { adminId, name, password } = registerAdminSchema.parse(req.body);
    const enrollmentNo = adminId.trim().toUpperCase();

    // Admin IDs are globally unique (admins have adminId = null, unique by enrollmentNo)
    const existing = await prisma.student.findFirst({
      where: { enrollmentNo, role: "ADMIN" },
    });
    if (existing) {
      const err = new Error("This Admin ID is already taken. Please choose a different one.");
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.student.create({
      data: {
        enrollmentNo,
        name: name.trim(),
        passwordHash,
        branch: "ADMIN",
        year: 0,
        role: "ADMIN",
        adminId: null, // admins have no parent adminId
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ADMIN_REGISTERED",
        details: JSON.stringify({ adminId: enrollmentNo, name: admin.name }),
      },
    });

    res.status(201).json(buildTokenResponse(admin));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/admin-login ───────────────────────────────────────────────
router.post("/admin-login", authLimiter, async (req, res, next) => {
  try {
    const { adminId, password } = adminLoginSchema.parse(req.body);
    const enrollmentNo = adminId.trim().toUpperCase();

    const admin = await prisma.student.findFirst({
      where: { enrollmentNo, role: "ADMIN" },
    });

    const invalid = () => { const e = new Error("Invalid Admin ID or password"); e.statusCode = 401; return e; };
    if (!admin) throw invalid();
    if (!admin.passwordHash) throw invalid();

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) throw invalid();

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ADMIN_LOGIN",
        details: JSON.stringify({ adminId: enrollmentNo }),
      },
    });

    res.json(buildTokenResponse(admin));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/voter-login ───────────────────────────────────────────────
// Voter must provide: adminId (which admin's system), enrollmentNo, password
router.post("/voter-login", authLimiter, async (req, res, next) => {
  try {
    const { adminId, enrollmentNo, password } = voterLoginSchema.parse(req.body);

    // Resolve the admin first
    const admin = await prisma.student.findFirst({
      where: { enrollmentNo: adminId.trim().toUpperCase(), role: "ADMIN" },
    });

    const invalid = () => {
      const e = new Error("Invalid Admin ID, enrollment number, or password");
      e.statusCode = 401;
      return e;
    };

    if (!admin) throw invalid();

    // Find student scoped to this admin
    const student = await prisma.student.findFirst({
      where: {
        enrollmentNo: enrollmentNo.trim().toUpperCase(),
        adminId: admin.id,
        role: "STUDENT",
      },
    });

    if (!student) throw invalid();
    if (!student.passwordHash) {
      const e = new Error("No password set for this account. Contact your administrator.");
      e.statusCode = 401;
      throw e;
    }

    const isValid = await bcrypt.compare(password, student.passwordHash);
    if (!isValid) throw invalid();

    await prisma.auditLog.create({
      data: {
        actorId: student.id,
        action: "VOTER_LOGIN",
        details: JSON.stringify({ enrollmentNo: student.enrollmentNo, adminId }),
      },
    });

    res.json(buildTokenResponse(student));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
