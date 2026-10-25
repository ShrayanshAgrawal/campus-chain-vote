const express = require("express");
const { verifyTransactionReceipt } = require("../services/chainService");

const router = express.Router();

/**
 * GET /api/verify/:txHash
 * Fetches transaction receipt from the blockchain, decodes the VoteCast event,
 * and returns verified on-chain details.
 */
router.get("/:txHash", async (req, res, next) => {
  try {
    const { txHash } = req.params;
    if (!txHash || !txHash.startsWith("0x")) {
      return res.status(400).json({ error: "Invalid transaction hash format" });
    }

    const verification = await verifyTransactionReceipt(txHash);

    if (!verification.found) {
      return res.status(404).json(verification);
    }

    res.json(verification);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
