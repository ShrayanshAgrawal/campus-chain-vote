const express = require("express");
const { auditElection } = require("../services/auditService");
const authenticate = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/audit/:electionId
 * Public to authenticated users:
 * Cryptographically recounts all blockchain VoteCast events, compares with on-chain getResults
 * and database resultCache, and validates nullifier uniqueness.
 */
router.get("/:electionId", authenticate, async (req, res, next) => {
  try {
    const { electionId } = req.params;
    const auditReport = await auditElection(electionId);
    res.json(auditReport);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
