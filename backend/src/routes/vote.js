const express = require("express");
const { z } = require("zod");
const prisma = require("../config/db");
const authenticate = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const nullifierService = require("../services/nullifierService");
const chainService = require("../services/chainService");

const router = express.Router();

const voteSchema = z.object({
  electionId: z.string().min(1, "Election ID is required"),
  candidateId: z.union([z.string(), z.number()]),
});

// In-memory mutex per student+election to prevent concurrent double-click race conditions
const activeVoteLocks = new Set();

router.post("/", authenticate, requireRole("STUDENT"), async (req, res, next) => {
  const student = req.user;

  try {
    const { electionId, candidateId } = voteSchema.parse(req.body);

    // Resolve election
    const election = await prisma.election.findFirst({
      where: {
        OR: [
          { id: electionId },
          { chainElectionId: isNaN(Number(electionId)) ? undefined : Number(electionId) },
        ],
      },
    });

    if (!election) {
      return res.status(404).json({ error: "Election not found" });
    }

    // Verify election is OPEN
    if (election.status !== "OPEN" && election.status !== "ACTIVE") {
      return res.status(400).json({
        error: `Election is not open for voting (current status: ${election.status})`,
      });
    }

    if (!election.chainElectionId) {
      return res.status(400).json({
        error: "Election has not been deployed to the smart contract yet.",
      });
    }

    // Concurrency lock per student and election
    const lockKey = `${student.id}:${election.id}`;
    if (activeVoteLocks.has(lockKey)) {
      return res.status(409).json({
        error: "A vote submission is already being processed for this election. Please wait.",
      });
    }
    activeVoteLocks.add(lockKey);

    try {
      // Check eligibility
      const eligibility = await prisma.voterEligibility.findUnique({
        where: {
          electionId_studentId: {
            electionId: election.id,
            studentId: student.id,
          },
        },
      });

      if (!eligibility) {
        return res.status(403).json({
          error: "You are not eligible to vote in this election.",
        });
      }

      if (eligibility.hasVoted) {
        return res.status(409).json({
          error: "You have already cast your vote in this election. Multiple votes are prohibited.",
        });
      }

      // Resolve candidate
      const candidate = await prisma.candidate.findFirst({
        where: {
          electionId: election.id,
          OR: [
            { id: String(candidateId) },
            { chainCandidateId: isNaN(Number(candidateId)) ? undefined : Number(candidateId) },
          ],
        },
      });

      if (!candidate) {
        return res.status(400).json({ error: "Invalid candidate selected for this election." });
      }

      // Compute deterministic, anonymous cryptographic nullifier
      const nullifier = nullifierService.computeNullifier(student.enrollmentNo, election.chainElectionId);

      // Submit vote on-chain via Relayer wallet
      let txHash;
      let blockNumber;
      try {
        const chainResult = await chainService.castVoteOnChain(
          election.chainElectionId,
          candidate.chainCandidateId,
          nullifier
        );
        txHash = chainResult.txHash;
        blockNumber = chainResult.blockNumber;
      } catch (chainErr) {
        const errorMsg = chainErr.message || "";
        if (errorMsg.includes("Nullifier already used")) {
          return res.status(409).json({
            error: "This vote nullifier has already been recorded on the blockchain.",
          });
        }
        if (errorMsg.includes("Election is not open")) {
          return res.status(400).json({
            error: "The smart contract rejected the vote: election is not open.",
          });
        }
        return res.status(500).json({
          error: `Blockchain transaction failed: ${chainErr.reason || chainErr.message}`,
        });
      }

      // ONLY after on-chain transaction confirmation, update off-chain database in a single transaction
      await prisma.$transaction(async (tx) => {
        // Mark student as voted
        await tx.voterEligibility.update({
          where: { id: eligibility.id },
          data: { hasVoted: true },
        });

        // Store anonymous receipt (NO studentId!)
        await tx.voteReceipt.create({
          data: {
            electionId: election.id,
            nullifier,
            txHash,
            blockNumber,
          },
        });

        // Update cached tally
        await tx.resultCache.upsert({
          where: {
            electionId_candidateId: {
              electionId: election.id,
              candidateId: candidate.id,
            },
          },
          update: {
            voteCount: { increment: 1 },
          },
          create: {
            electionId: election.id,
            candidateId: candidate.id,
            chainCandidateId: candidate.chainCandidateId,
            voteCount: 1,
          },
        });

        // Write AuditLog WITHOUT candidate choice
        await tx.auditLog.create({
          data: {
            actorId: student.id,
            action: "VOTE_CAST",
            details: JSON.stringify({
              electionId: election.id,
              chainElectionId: election.chainElectionId,
              txHash,
              blockNumber,
            }),
          },
        });
      });

      return res.json({
        success: true,
        message: "Vote cast and confirmed on the blockchain successfully.",
        receipt: {
          txHash,
          blockNumber,
          nullifier,
          electionId: election.id,
          chainElectionId: election.chainElectionId,
        },
      });
    } finally {
      activeVoteLocks.delete(lockKey);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
