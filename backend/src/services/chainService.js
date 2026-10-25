const { ethers } = require("ethers");
const { getContract, getProvider, getRelayerWallet } = require("../config/chain");

/**
 * Cast an anonymous vote on-chain via the relayer wallet.
 */
async function castVoteOnChain(chainElectionId, chainCandidateId, nullifier) {
  const contract = getContract();
  const tx = await contract.castVote(
    BigInt(chainElectionId),
    BigInt(chainCandidateId),
    nullifier
  );
  const receipt = await tx.wait();
  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
  };
}

/**
 * Fetch on-chain election metadata.
 */
async function getElectionOnChain(chainElectionId) {
  const contract = getContract();
  const [id, name, status, candidateCount, totalVotesCount] = await contract.getElection(BigInt(chainElectionId));
  const statusMap = ["CREATED", "OPEN", "CLOSED"];
  return {
    id: Number(id),
    name,
    status: statusMap[Number(status)] || "UNKNOWN",
    candidateCount: Number(candidateCount),
    totalVotes: Number(totalVotesCount),
  };
}

/**
 * Fetch on-chain candidates with vote counts.
 */
async function getResultsOnChain(chainElectionId) {
  const contract = getContract();
  const rawResults = await contract.getResults(BigInt(chainElectionId));
  return rawResults.map((c) => ({
    candidateId: Number(c.id),
    name: c.name,
    voteCount: Number(c.voteCount),
  }));
}

/**
 * Check if a nullifier has already been recorded on-chain for an election.
 */
async function isNullifierUsedOnChain(chainElectionId, nullifier) {
  const contract = getContract();
  return await contract.isNullifierUsed(BigInt(chainElectionId), nullifier);
}

/**
 * Recount all VoteCast events from the blockchain logs.
 */
async function getAllVoteCastEvents(chainElectionId) {
  const contract = getContract();
  const filter = contract.filters.VoteCast(BigInt(chainElectionId));
  const events = await contract.queryFilter(filter, 0, "latest");

  return events.map((evt) => {
    return {
      electionId: Number(evt.args[0]),
      candidateId: Number(evt.args[1]),
      nullifier: evt.args[2],
      timestamp: Number(evt.args[3]),
      blockNumber: evt.blockNumber,
      transactionHash: evt.transactionHash,
    };
  });
}

/**
 * Verify a transaction by receipt and decode the VoteCast event.
 */
async function verifyTransactionReceipt(txHash) {
  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    return { found: false, message: "Transaction receipt not found on chain" };
  }

  const contract = getContract();
  let voteCastEvent = null;

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "VoteCast") {
        voteCastEvent = parsed;
        break;
      }
    } catch (_) {
      // Ignore logs not matching our interface
    }
  }

  if (!voteCastEvent) {
    return {
      found: false,
      message: "Transaction exists but does not contain a VoteCast event",
      blockNumber: receipt.blockNumber,
    };
  }

  const electionId = Number(voteCastEvent.args[0]);
  const candidateId = Number(voteCastEvent.args[1]);
  const nullifier = voteCastEvent.args[2];
  const timestamp = Number(voteCastEvent.args[3]);

  // Lookup candidate name from contract
  let candidateName = `Candidate #${candidateId}`;
  try {
    const candidates = await contract.getCandidates(BigInt(electionId));
    const foundCand = candidates.find((c) => Number(c.id) === candidateId);
    if (foundCand) candidateName = foundCand.name;
  } catch (_) {}

  return {
    found: true,
    electionId,
    candidateId,
    candidateName,
    nullifier,
    blockNumber: receipt.blockNumber,
    timestamp: new Date(timestamp * 1000).toISOString(),
    txHash: receipt.hash,
  };
}

/**
 * Admin helpers to interact with smart contract.
 */
async function createElectionOnChain(name) {
  const contract = getContract();
  const tx = await contract.createElection(name);
  const receipt = await tx.wait();
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "ElectionCreated") {
        return Number(parsed.args[0]);
      }
    } catch (_) {}
  }
  return Number(await contract.electionCount());
}

async function addCandidateOnChain(chainElectionId, name) {
  const contract = getContract();
  const tx = await contract.addCandidate(BigInt(chainElectionId), name);
  const receipt = await tx.wait();
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "CandidateAdded") {
        return Number(parsed.args[1]);
      }
    } catch (_) {}
  }
  return 1;
}

async function openElectionOnChain(chainElectionId) {
  const contract = getContract();
  const tx = await contract.openElection(BigInt(chainElectionId));
  await tx.wait();
  return true;
}

async function closeElectionOnChain(chainElectionId) {
  const contract = getContract();
  const tx = await contract.closeElection(BigInt(chainElectionId));
  await tx.wait();
  return true;
}

module.exports = {
  castVoteOnChain,
  getElectionOnChain,
  getResultsOnChain,
  isNullifierUsedOnChain,
  getAllVoteCastEvents,
  verifyTransactionReceipt,
  createElectionOnChain,
  addCandidateOnChain,
  openElectionOnChain,
  closeElectionOnChain,
};
