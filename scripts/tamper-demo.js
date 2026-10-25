const prisma = require("../backend/src/config/db");
const { auditElection } = require("../backend/src/services/auditService");

async function main() {
  console.log("\n====================================================================");
  console.log("🔒 CampusChainVote - Tamper Detection Demo");
  console.log("   Demonstrating how off-chain DB alterations are immediately caught");
  console.log("   by independent smart-contract cryptographic log recounting.");
  console.log("====================================================================\n");

  // 1. Audit election before tampering
  const election = await prisma.election.findFirst({
    where: { chainElectionId: 1 },
    include: {
      candidates: true,
      resultCache: true,
    },
  });

  if (!election) {
    throw new Error("Election #1 not found in database.");
  }

  console.log(`[Step 1] Running baseline audit on "${election.name}"...`);
  const initialAudit = await auditElection(election.id);
  console.log(`  Initial Audit Status: ${initialAudit.match ? "✅ ALL TOTALS MATCH" : "❌ MISMATCH"}`);
  console.log(`  Total Blockchain Vote Events: ${initialAudit.totalEvents}`);
  console.log(`  Unique Nullifiers: ${initialAudit.uniqueNullifiers} (Duplicates: ${initialAudit.duplicateNullifiers})`);

  // 2. Pick candidate and tamper with database resultCache
  const targetCache = election.resultCache[0];
  const targetCandidate = election.candidates.find((c) => c.id === targetCache.candidateId);
  const originalCount = targetCache.voteCount;
  const TAMPER_INJECTION = 75; // Maliciously add 75 votes directly into database

  console.log(`\n[Step 2] MALICIOUS ACT: Directly modifying PostgreSQL database table...`);
  console.log(`  Target Candidate: ${targetCandidate.name} (Chain ID: ${targetCache.chainCandidateId})`);
  console.log(`  Original Cached Count: ${originalCount}`);
  console.log(`  Injecting +${TAMPER_INJECTION} fake votes directly into database table 'ResultCache'...`);

  await prisma.resultCache.update({
    where: { id: targetCache.id },
    data: { voteCount: originalCount + TAMPER_INJECTION },
  });

  console.log(`  Database record successfully tampered with! (New DB Count: ${originalCount + TAMPER_INJECTION})`);

  // 3. Re-run audit
  console.log(`\n[Step 3] Running blockchain cryptographic recount audit...`);
  const tamperedAudit = await auditElection(election.id);

  console.log(`\n============================ AUDIT REPORT ============================`);
  console.log(`  Match Status: ${tamperedAudit.match ? "✅ MATCH" : "🚨 MISMATCH DETECTED!"}`);
  console.log(`  Mismatches Count: ${tamperedAudit.mismatches.length}`);

  for (const m of tamperedAudit.mismatches) {
    console.log(`\n  🚨 FRAUD / TAMPERING DETECTED:`);
    console.log(`     Candidate:        ${m.name} (ID: ${m.candidateId})`);
    console.log(`     Blockchain Logs:  ${m.eventCount} verified votes`);
    console.log(`     Smart Contract:   ${m.chainCount} contract votes`);
    console.log(`     Database Cache:   ${m.dbCount} votes (UNVERIFIED DISCREPANCY: ${m.chainVsDbDiff > 0 ? "+" : ""}${m.chainVsDbDiff})`);
  }
  console.log(`======================================================================\n`);

  // 4. Restore original state
  console.log(`[Step 4] Restoring original verified vote count to database...`);
  await prisma.resultCache.update({
    where: { id: targetCache.id },
    data: { voteCount: originalCount },
  });

  const restoredAudit = await auditElection(election.id);
  console.log(`  Restored Audit Status: ${restoredAudit.match ? "✅ ALL TOTALS MATCH (Clean)" : "❌ MISMATCH"}`);
  console.log("\nTamper demonstration completed successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Tamper demo error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
