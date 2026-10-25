const { ethers } = require("ethers");
const env = require("../config/env");

/**
 * Computes deterministic, anonymous nullifier:
 * keccak256(abi.encodePacked(enrollmentNo, electionId, NULLIFIER_SECRET))
 * Ensures each student can only vote once per election on-chain without revealing identity.
 */
function computeNullifier(enrollmentNo, chainElectionId) {
  const secret = process.env.NULLIFIER_SECRET || env.NULLIFIER_SECRET;
  if (!secret) {
    throw new Error("NULLIFIER_SECRET is not configured");
  }
  return ethers.solidityPackedKeccak256(
    ["string", "uint256", "string"],
    [enrollmentNo.trim(), BigInt(chainElectionId), secret]
  );
}

module.exports = {
  computeNullifier,
};
