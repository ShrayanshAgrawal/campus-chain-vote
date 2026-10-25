const express = require("express");
const prisma = require("../config/db");
const authenticate = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/elections
 * - Admin: sees only their own elections
 * - Student: sees only elections they are eligible for (scoped to their admin)
 */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const user = req.user;

    if (user.role === "ADMIN") {
      const allElections = await prisma.election.findMany({
        where: { adminId: user.id },
        orderBy: { startTime: "desc" },
        include: {
          candidates: true,
          _count: { select: { eligibility: true, receipts: true } },
        },
      });

      return res.json({
        elections: allElections.map((e) => ({
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
        })),
      });
    }

    // Student: fetch elections they are eligible for
    const eligibilities = await prisma.voterEligibility.findMany({
      where: { studentId: user.id },
      include: {
        election: { include: { candidates: true } },
      },
      orderBy: { election: { startTime: "desc" } },
    });

    res.json({
      elections: eligibilities.map((elig) => {
        const e = elig.election;
        return {
          id: e.id,
          chainElectionId: e.chainElectionId,
          name: e.name,
          scope: e.scope,
          status: e.status,
          startTime: e.startTime,
          endTime: e.endTime,
          candidateCount: e.candidates.length,
          hasVoted: elig.hasVoted,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/elections/:id
 */
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const election = await prisma.election.findFirst({
      where: {
        OR: [
          { id },
          { chainElectionId: isNaN(Number(id)) ? undefined : Number(id) },
        ],
      },
      include: { candidates: { orderBy: { chainCandidateId: "asc" } } },
    });

    if (!election) return res.status(404).json({ error: "Election not found" });

    let isEligible = false;
    let hasVoted = false;

    if (user.role === "ADMIN") {
      // Admin can only view their own elections
      if (election.adminId !== user.id) {
        return res.status(403).json({ error: "You do not have access to this election." });
      }
      isEligible = true;
    } else {
      const eligibility = await prisma.voterEligibility.findUnique({
        where: { electionId_studentId: { electionId: election.id, studentId: user.id } },
      });
      if (!eligibility) {
        return res.status(403).json({ error: "You are not eligible to view this election." });
      }
      isEligible = true;
      hasVoted = eligibility.hasVoted;
    }

    res.json({
      election: {
        id: election.id,
        chainElectionId: election.chainElectionId,
        name: election.name,
        scope: election.scope,
        status: election.status,
        startTime: election.startTime,
        endTime: election.endTime,
        candidates: election.candidates.map((c) => ({
          id: c.id,
          chainCandidateId: c.chainCandidateId,
          name: c.name,
          enrollmentNo: c.enrollmentNo,
          branch: c.branch,
          year: c.year,
          manifesto: c.manifesto,
        })),
        isEligible,
        hasVoted,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
