const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const { parse } = require("csv-parse/sync");
const prisma = require("../config/db");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const { importEligibilityCsv } = require("../services/csvService");
const {
  createElectionOnChain,
  addCandidateOnChain,
  openElectionOnChain,
  closeElectionOnChain,
} = require("../services/chainService");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// All admin routes require authentication + ADMIN role
router.use(authenticate, requireRole("ADMIN"));

// ─── Helper: find election owned by this admin ────────────────────────────────
async function findOwnedElection(id, adminId, includeCandidates = false) {
  return prisma.election.findFirst({
    where: {
      adminId,
      OR: [
        { id },
        { chainElectionId: isNaN(Number(id)) ? undefined : Number(id) },
      ],
    },
    include: includeCandidates ? { candidates: true } : undefined,
  });
}

// ─── Schemas ──────────────────────────────────────────────────────────────────
const createElectionSchema = z.object({
  name: z.string().min(3, "Election name must be at least 3 characters"),
  scope: z.string().default("ALL"),
  startTime: z.string(),
  endTime: z.string(),
});

const addCandidateSchema = z.object({
  name: z.string().min(2, "Candidate name is required"),
  enrollmentNo: z.string().min(1, "Enrollment number is required"),
  branch: z.string().min(1, "Branch is required"),
  year: z.number().int().min(1).max(5),
  manifesto: z.string().min(5, "Manifesto is required"),
});

// ─── GET /api/admin/elections ─────────────────────────────────────────────────
// Returns only elections owned by this admin
router.get("/elections", async (req, res, next) => {
  try {
    const elections = await prisma.election.findMany({
      where: { adminId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        candidates: true,
        _count: { select: { eligibility: true, receipts: true } },
      },
    });

    const formatted = elections.map((e) => ({
      id: e.id,
      chainElectionId: e.chainElectionId,
      name: e.name,
      scope: e.scope,
      status: e.status,
      startTime: e.startTime,
      endTime: e.endTime,
      candidateCount: e.candidates.length,
      eligibleVotersCount: e._count.eligibility,
      votesCastCount: e._count.receipts,
    }));

    res.json({ elections: formatted });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/elections ────────────────────────────────────────────────
router.post("/elections", async (req, res, next) => {
  try {
    const data = createElectionSchema.parse(req.body);

    let chainElectionId = null;
    try {
      chainElectionId = await createElectionOnChain(data.name);
    } catch (err) {
      console.warn("Could not create election on chain:", err.message);
      const maxChain = await prisma.election.aggregate({ _max: { chainElectionId: true } });
      chainElectionId = (maxChain._max.chainElectionId || 0) + 1;
    }

    const election = await prisma.election.create({
      data: {
        chainElectionId,
        name: data.name,
        scope: data.scope,
        status: "CREATED",
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        adminId: req.user.id,  // ← owned by this admin
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: "ELECTION_CREATED",
        details: JSON.stringify({ electionId: election.id, chainElectionId, name: election.name }),
      },
    });

    res.status(201).json({ success: true, election });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/elections/:id/candidates ─────────────────────────────────
router.post("/elections/:id/candidates", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = addCandidateSchema.parse(req.body);

    const election = await findOwnedElection(id, req.user.id, true);
    if (!election) return res.status(404).json({ error: "Election not found" });
    if (election.status !== "CREATED") {
      return res.status(400).json({ error: "Candidates can only be added while election is in CREATED status." });
    }

    const nextCandidateId = election.candidates.length + 1;
    let chainCandidateId = nextCandidateId;
    if (election.chainElectionId) {
      try {
        chainCandidateId = await addCandidateOnChain(election.chainElectionId, data.name);
      } catch (err) {
        console.warn("Could not add candidate on chain:", err.message);
      }
    }

    const candidate = await prisma.candidate.create({
      data: {
        electionId: election.id,
        chainCandidateId,
        name: data.name,
        enrollmentNo: data.enrollmentNo,
        branch: data.branch,
        year: data.year,
        manifesto: data.manifesto,
      },
    });

    await prisma.resultCache.create({
      data: { electionId: election.id, candidateId: candidate.id, chainCandidateId, voteCount: 0 },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: "CANDIDATE_ADDED",
        details: JSON.stringify({ electionId: election.id, candidateName: candidate.name }),
      },
    });

    res.status(201).json({ success: true, candidate });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/elections/:id/eligibility ────────────────────────────────
router.post("/elections/:id/eligibility", upload.single("file"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const election = await findOwnedElection(id, req.user.id);
    if (!election) return res.status(404).json({ error: "Election not found" });

    let csvContent = "";
    if (req.file) {
      csvContent = req.file.buffer.toString("utf-8");
    } else if (req.body?.csvData) {
      csvContent = req.body.csvData;
    } else {
      return res.status(400).json({ error: "No CSV file or csvData provided" });
    }

    const summary = await importEligibilityCsv(election.id, req.user.id, csvContent);

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: "ELIGIBILITY_CSV_IMPORTED",
        details: JSON.stringify({ electionId: election.id, addedCount: summary.addedCount }),
      },
    });

    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/elections/:id/open ──────────────────────────────────────
router.post("/elections/:id/open", async (req, res, next) => {
  try {
    const election = await findOwnedElection(req.params.id, req.user.id, true);
    if (!election) return res.status(404).json({ error: "Election not found" });
    if (election.status !== "CREATED") return res.status(400).json({ error: "Election must be in CREATED status to open" });
    if (election.candidates.length < 2) return res.status(400).json({ error: "At least 2 candidates required before opening" });

    if (election.chainElectionId) {
      try { await openElectionOnChain(election.chainElectionId); } catch (err) { console.warn("Chain open failed:", err.message); }
    }

    const updated = await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });

    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: "ELECTION_OPENED", details: JSON.stringify({ electionId: election.id }) },
    });

    res.json({ success: true, message: "Election opened successfully", election: updated });
  } catch (err) { next(err); }
});

// ─── POST /api/admin/elections/:id/close ─────────────────────────────────────
router.post("/elections/:id/close", async (req, res, next) => {
  try {
    const election = await findOwnedElection(req.params.id, req.user.id);
    if (!election) return res.status(404).json({ error: "Election not found" });
    if (election.status !== "OPEN" && election.status !== "ACTIVE") {
      return res.status(400).json({ error: "Only OPEN/ACTIVE elections can be closed" });
    }

    if (election.chainElectionId) {
      try { await closeElectionOnChain(election.chainElectionId); } catch (err) { console.warn("Chain close failed:", err.message); }
    }

    const updated = await prisma.election.update({ where: { id: election.id }, data: { status: "CLOSED" } });

    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: "ELECTION_CLOSED", details: JSON.stringify({ electionId: election.id }) },
    });

    res.json({ success: true, message: "Election closed successfully", election: updated });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────
// Returns only this admin's audit logs
router.get("/audit-log", async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { actorId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ logs });
  } catch (err) { next(err); }
});

// ─── POST /api/admin/students/upload ─────────────────────────────────────────
// CSV: name, enrollment_no, password — students belong to this admin
router.post("/students/upload", upload.single("file"), async (req, res, next) => {
  try {
    let csvContent = "";
    if (req.file) {
      csvContent = req.file.buffer.toString("utf-8");
    } else if (req.body?.csvData) {
      csvContent = req.body.csvData;
    } else {
      return res.status(400).json({ error: "No CSV file or csvData provided" });
    }

    const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const enrollmentNo = (row.enrollment_no || row.enrollmentNo || row.enroll || "").trim().toUpperCase();
      if (!enrollmentNo) { errors.push(`Row ${i + 1}: Missing enrollment_no`); skipped++; continue; }

      const name = (row.name || row.student_name || "").trim();
      const rawPassword = (row.password || row.pass || "").trim();
      const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, 10) : null;

      try {
        // Only look up students that belong to this admin
        const existing = await prisma.student.findFirst({
          where: { enrollmentNo, adminId: req.user.id },
        });

        // Also check if enrollment no exists under a different admin (conflict)
        const anyExisting = await prisma.student.findFirst({ where: { enrollmentNo } });

        if (anyExisting && anyExisting.adminId !== req.user.id) {
          // Different admin has this enrollment — create a new record under this admin
          // (enrollment is only unique per adminId, so this is allowed)
        }

        if (!existing) {
          const email = (row.email || `${enrollmentNo.toLowerCase()}@campus.edu`).trim().toLowerCase();
          const studentName = name || `Student ${enrollmentNo.slice(-5)}`;
          const branch = (row.branch || "GEN").trim();
          const year = parseInt(row.year, 10) || 1;

          try {
            await prisma.student.create({
              data: {
                enrollmentNo,
                name: studentName,
                email,
                passwordHash,
                branch,
                year,
                role: "STUDENT",
                adminId: req.user.id,  // ← belongs to this admin
              },
            });
            created++;
          } catch (createErr) {
            if (createErr.code === "P2002" && createErr.meta?.target?.includes("email")) {
              await prisma.student.create({
                data: {
                  enrollmentNo,
                  name: studentName,
                  email: `${enrollmentNo.toLowerCase()}_${Date.now()}@campus.edu`,
                  passwordHash,
                  branch,
                  year,
                  role: "STUDENT",
                  adminId: req.user.id,
                },
              });
              created++;
            } else throw createErr;
          }
        } else {
          const updates = {};
          if (name && name !== existing.name) updates.name = name;
          if (passwordHash) updates.passwordHash = passwordHash;
          if (Object.keys(updates).length > 0) {
            await prisma.student.update({ where: { id: existing.id }, data: updates });
            updated++;
          } else skipped++;
        }
      } catch (rowErr) {
        errors.push(`Row ${i + 1} (${enrollmentNo}): ${rowErr.message}`);
        skipped++;
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: "STUDENTS_CSV_UPLOADED",
        details: JSON.stringify({ totalRows: records.length, created, updated, skipped }),
      },
    });

    res.json({ success: true, summary: { totalRows: records.length, created, updated, skipped, errors } });
  } catch (err) { next(err); }
});

// ─── GET /api/admin/students ──────────────────────────────────────────────────
// Returns only students belonging to this admin
router.get("/students", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const search = (req.query.search || "").trim();

    const where = {
      adminId: req.user.id,  // ← only this admin's students
      role: "STUDENT",
      ...(search ? {
        OR: [
          { enrollmentNo: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    };

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: { id: true, enrollmentNo: true, name: true, email: true, branch: true, year: true, role: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    res.json({ students, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

module.exports = router;
