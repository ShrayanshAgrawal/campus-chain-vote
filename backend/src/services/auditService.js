const prisma = require("../config/db");
const chainService = require("./chainService");

/**
 * Performs a complete, independent cryptographic recount and audit:
 * 1. Recounts all VoteCast events directly from the blockchain event logs.
 * 2. Fetches current on-chain state tallies via getResults().
 * 3. Fetches database resultCache tallies.
 * 4. Verifies nullifier uniqueness across all cast votes.
 * 5. Compares all three sources per candidate and detects any tampering.
 */
async function auditElection(electionIdOrChainId) {
  // Find election in database
  const searchId = String(electionIdOrChainId);
  const numericChainId = Number(electionIdOrChainId);

  let election = await prisma.election.findFirst({
    where: {
      OR: [
        { id: searchId },
        { chainElectionId: !isNaN(numericChainId) ? numericChainId : undefined },
      ],
    },
    include: {
      candidates: true,
      resultCache: true,
    },
  });

  if (!election) {
    const error = new Error("Election not found");
    error.statusCode = 404;
    throw error;
  }

  const chainElectionId = election.chainElectionId;
  if (!chainElectionId) {
    const error = new Error("Election does not have a linked smart contract election ID");
    error.statusCode = 400;
    throw error;
  }

  // 1. Recount all VoteCast events directly from blockchain logs
  const events = await chainService.getAllVoteCastEvents(chainElectionId);

  const eventCounts = {};
  const seenNullifiers = new Set();
  let duplicateNullifiers = 0;

  for (const evt of events) {
    const cid = evt.candidateId;
    eventCounts[cid] = (eventCounts[cid] || 0) + 1;

    if (seenNullifiers.has(evt.nullifier)) {
      duplicateNullifiers++;
    } else {
      seenNullifiers.add(evt.nullifier);
    }
  }

  // 2. Fetch live on-chain results
  const chainResults = await chainService.getResultsOnChain(chainElectionId);
  const chainTotalsMap = {};
  for (const c of chainResults) {
    chainTotalsMap[c.candidateId] = {
      candidateId: c.candidateId,
      name: c.name,
      voteCount: c.voteCount,
    };
  }

  // 3. Fetch DB resultCache
  const dbTotalsMap = {};
  for (const r of election.resultCache) {
    const cand = election.candidates.find((c) => c.id === r.candidateId);
    dbTotalsMap[r.chainCandidateId] = {
      candidateId: r.chainCandidateId,
      name: cand ? cand.name : `Candidate ${r.chainCandidateId}`,
      voteCount: r.voteCount,
    };
  }

  // 4. Compare all sources
  const mismatches = [];
  const comparisonTable = [];

  for (const candidate of election.candidates) {
    const cid = candidate.chainCandidateId;
    const eventCount = eventCounts[cid] || 0;
    const chainCount = chainTotalsMap[cid] ? chainTotalsMap[cid].voteCount : 0;
    const dbCount = dbTotalsMap[cid] ? dbTotalsMap[cid].voteCount : 0;

    const matchesChain = eventCount === chainCount;
    const matchesDb = chainCount === dbCount;
    const isRowMatch = matchesChain && matchesDb;

    if (!isRowMatch) {
      mismatches.push({
        candidateId: cid,
        name: candidate.name,
        eventCount,
        chainCount,
        dbCount,
        chainVsDbDiff: dbCount - chainCount,
        eventVsChainDiff: eventCount - chainCount,
      });
    }

    comparisonTable.push({
      candidateId: cid,
      name: candidate.name,
      eventVotes: eventCount,
      chainVotes: chainCount,
      dbVotes: dbCount,
      match: isRowMatch,
    });
  }

  const isOverallMatch = mismatches.length === 0 && duplicateNullifiers === 0;

  return {
    electionId: election.id,
    chainElectionId,
    electionName: election.name,
    match: isOverallMatch,
    totalEvents: events.length,
    uniqueNullifiers: seenNullifiers.size,
    duplicateNullifiers,
    comparisonTable,
    chainTotals: Object.values(chainTotalsMap),
    dbTotals: Object.values(dbTotalsMap),
    mismatches,
    auditedAt: new Date().toISOString(),
  };
}

module.exports = {
  auditElection,
};
