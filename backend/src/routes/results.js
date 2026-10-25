const express = require("express");
const prisma = require("../config/db");
const { getResultsOnChain, getElectionOnChain } = require("../services/chainService");

const router = express.Router();

/**
 * GET /api/results/:electionId
 * Fetches live on-chain vote counts from getResults() and calculates turnout percentage.
 */
router.get("/:electionId", async (req, res, next) => {
  try {
    const { electionId } = req.params;

    const election = await prisma.election.findFirst({
      where: {
        OR: [
          { id: electionId },
          { chainElectionId: isNaN(Number(electionId)) ? undefined : Number(electionId) },
        ],
      },
      include: {
        candidates: {
          orderBy: { chainCandidateId: "asc" },
        },
      },
    });

    if (!election) {
      return res.status(404).json({ error: "Election not found" });
    }

    const totalEligible = await prisma.voterEligibility.count({
      where: { electionId: election.id },
    });

    let chainResults = [];
    let totalVotes = 0;
    let chainStatus = election.status;

    if (election.chainElectionId) {
      try {
        chainResults = await getResultsOnChain(election.chainElectionId);
        const onChainElection = await getElectionOnChain(election.chainElectionId);
        totalVotes = onChainElection.totalVotes;
        chainStatus = onChainElection.status;
      } catch (err) {
        console.warn("Could not query chain results directly, falling back to db cache:", err.message);
        // Fallback to db result cache if local node is not reachable
        const dbCache = await prisma.resultCache.findMany({
          where: { electionId: election.id },
        });
        const cacheMap = {};
        for (const c of dbCache) {
          cacheMap[c.chainCandidateId] = c.voteCount;
          totalVotes += c.voteCount;
        }
        chainResults = election.candidates.map((cand) => ({
          candidateId: cand.chainCandidateId,
          name: cand.name,
          voteCount: cacheMap[cand.chainCandidateId] || 0,
        }));
      }
    }

    // Merge candidates with vote counts
    const candidateResults = election.candidates.map((cand) => {
      const match = chainResults.find((cr) => cr.candidateId === cand.chainCandidateId);
      const voteCount = match ? match.voteCount : 0;
      return {
        id: cand.id,
        chainCandidateId: cand.chainCandidateId,
        name: cand.name,
        branch: cand.branch,
        year: cand.year,
        manifesto: cand.manifesto,
        voteCount,
        percentage: totalVotes > 0 ? Number(((voteCount / totalVotes) * 100).toFixed(1)) : 0,
      };
    });

    // Determine winner if closed or leading
    let winner = null;
    if (candidateResults.length > 0 && totalVotes > 0) {
      const sorted = [...candidateResults].sort((a, b) => b.voteCount - a.voteCount);
      if (sorted[0].voteCount > 0) {
        winner = sorted[0];
      }
    }

    const turnoutPercentage = totalEligible > 0
      ? Number(((totalVotes / totalEligible) * 100).toFixed(2))
      : 0;

    res.json({
      electionId: election.id,
      chainElectionId: election.chainElectionId,
      name: election.name,
      scope: election.scope,
      status: election.status,
      chainStatus,
      startTime: election.startTime,
      endTime: election.endTime,
      totalEligible,
      totalVotes,
      turnoutPercentage,
      candidates: candidateResults,
      winner: election.status === "CLOSED" ? winner : null,
      leadingCandidate: winner,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
