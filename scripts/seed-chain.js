const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
let parse;
try {
  parse = require("csv-parse/sync").parse;
} catch (_) {
  parse = require(path.resolve(__dirname, "../backend/node_modules/csv-parse/sync")).parse;
}

let PrismaClient;
try {
  PrismaClient = require("@prisma/client").PrismaClient;
} catch (_) {
  PrismaClient = require(path.resolve(__dirname, "../backend/node_modules/@prisma/client")).PrismaClient;
}

const prisma = new PrismaClient();

async function main() {
  console.log("=== Starting Chain Seeding (CampusChainVote) ===");

  const dataDir = path.resolve(__dirname, "../data");
  const NULLIFIER_SECRET = process.env.NULLIFIER_SECRET || "campus_voting_secret_salt_for_deterministic_nullifiers_2026";

  // Get deployer / relayer signer
  const [relayer] = await hre.ethers.getSigners();
  console.log("Relayer account:", relayer.address);

  // Get contract address from deployment.json or .env
  let contractAddress = process.env.CONTRACT_ADDRESS;
  const depPath = path.join(dataDir, "deployment.json");
  if (!contractAddress && fs.existsSync(depPath)) {
    const dep = JSON.parse(fs.readFileSync(depPath, "utf-8"));
    contractAddress = dep.address;
  }

  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS not found. Run scripts/deploy.js first.");
  }
  console.log("Using CampusVoting at:", contractAddress);

  const CampusVoting = await hre.ethers.getContractFactory("CampusVoting");
  const voting = CampusVoting.attach(contractAddress).connect(relayer);

  // Load CSV data
  const electionsData = parse(fs.readFileSync(path.join(dataDir, "elections.csv"), "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const candidatesData = parse(fs.readFileSync(path.join(dataDir, "candidates.csv"), "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const eligibilityData = parse(fs.readFileSync(path.join(dataDir, "eligibility.csv"), "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const simulatedVotesData = parse(fs.readFileSync(path.join(dataDir, "simulated_votes.csv"), "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Prepare simulated votes distribution per election
  const simulatedDistributions = {};
  for (const row of simulatedVotesData) {
    const eid = row.election_id;
    if (!simulatedDistributions[eid]) simulatedDistributions[eid] = [];
    simulatedDistributions[eid].push(parseInt(row.candidate_id, 10));
  }

  const currentElectionCount = Number(await voting.electionCount());
  console.log(`Current on-chain election count: ${currentElectionCount}`);

  for (const eRow of electionsData) {
    const csvEid = parseInt(eRow.election_id, 10);
    const targetStatus = eRow.status.toUpperCase();
    console.log(`\n--- Processing Election #${csvEid}: "${eRow.name}" (Target: ${targetStatus}) ---`);

    let onChainEid = csvEid;
    if (csvEid > currentElectionCount) {
      console.log(`Creating Election #${csvEid} on-chain...`);
      const tx = await voting.createElection(eRow.name);
      await tx.wait();

      // Add candidates
      const eCandidates = candidatesData.filter((c) => parseInt(c.election_id, 10) === csvEid);
      for (const cand of eCandidates) {
        console.log(`  Adding Candidate #${cand.candidate_id}: ${cand.name}`);
        const addTx = await voting.addCandidate(csvEid, cand.name);
        await addTx.wait();
      }
    } else {
      console.log(`Election #${csvEid} already exists on-chain.`);
    }

    // Check on-chain election status
    const onChainElection = await voting.getElection(csvEid);
    let onChainStatus = Number(onChainElection[2]); // 0: Created, 1: Open, 2: Closed

    // Open if in Created status
    if (onChainStatus === 0 && (targetStatus === "ACTIVE" || targetStatus === "OPEN" || targetStatus === "CLOSED")) {
      console.log(`Opening Election #${csvEid} on-chain...`);
      const openTx = await voting.openElection(csvEid);
      await openTx.wait();
      onChainStatus = 1;
    }

    // Replay votes if status was opened and target is CLOSED or ACTIVE
    if (onChainStatus === 1 && (targetStatus === "ACTIVE" || targetStatus === "OPEN" || targetStatus === "CLOSED")) {
      const votedEligibility = eligibilityData.filter(
        (el) => parseInt(el.election_id, 10) === csvEid && (el.has_voted === "1" || el.has_voted === "true")
      );
      const dist = simulatedDistributions[String(csvEid)] || [1, 2];

      console.log(`Replaying ${votedEligibility.length} votes on-chain for Election #${csvEid}...`);

      const dbElection = await prisma.election.findFirst({
        where: { chainElectionId: csvEid },
        include: { candidates: true },
      });

      let replayedCount = 0;
      for (let i = 0; i < votedEligibility.length; i++) {
        const studentRow = votedEligibility[i];
        const assignedCandidateId = dist[i % dist.length];

        // Compute deterministic keccak256 nullifier
        const nullifier = hre.ethers.solidityPackedKeccak256(
          ["string", "uint256", "string"],
          [studentRow.enrollment_no.trim(), BigInt(csvEid), NULLIFIER_SECRET]
        );

        // Check if already used on chain
        const isUsed = await voting.isNullifierUsed(csvEid, nullifier);
        if (!isUsed) {
          const voteTx = await voting.castVote(csvEid, assignedCandidateId, nullifier);
          const receipt = await voteTx.wait();
          replayedCount++;

          // Record receipt in DB
          if (dbElection) {
            await prisma.voteReceipt.upsert({
              where: { nullifier },
              update: {},
              create: {
                electionId: dbElection.id,
                nullifier,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
              },
            });
          }

          if (replayedCount % 100 === 0) {
            console.log(`  ...replayed ${replayedCount}/${votedEligibility.length} votes`);
          }
        }
      }
      console.log(`Finished vote replay. Total new votes cast on chain: ${replayedCount}`);

      // Close election on-chain if targetStatus is CLOSED
      if (targetStatus === "CLOSED") {
        console.log(`Closing Election #${csvEid} on-chain...`);
        const closeTx = await voting.closeElection(csvEid);
        await closeTx.wait();
      }
    }

    // Synchronize DB resultCache with on-chain results
    const finalResults = await voting.getResults(csvEid);
    const dbElection = await prisma.election.findFirst({
      where: { chainElectionId: csvEid },
      include: { candidates: true },
    });

    if (dbElection) {
      console.log(`Synchronizing database resultCache with on-chain tallies for Election #${csvEid}...`);
      for (const r of finalResults) {
        const cid = Number(r.id);
        const vCount = Number(r.voteCount);
        const cand = dbElection.candidates.find((c) => c.chainCandidateId === cid);
        if (cand) {
          await prisma.resultCache.upsert({
            where: {
              electionId_candidateId: {
                electionId: dbElection.id,
                candidateId: cand.id,
              },
            },
            update: {
              voteCount: vCount,
            },
            create: {
              electionId: dbElection.id,
              candidateId: cand.id,
              chainCandidateId: cid,
              voteCount: vCount,
            },
          });
          console.log(`  Candidate #${cid} (${r.name}): ${vCount} votes`);
        }
      }
    }
  }

  console.log("\n=== Chain Seeding and DB Synchronization Complete! ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error in seed-chain:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
