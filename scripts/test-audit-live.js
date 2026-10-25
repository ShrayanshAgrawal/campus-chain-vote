require("dotenv").config();
const { auditElection } = require("../backend/src/services/auditService");
const prisma = require("../backend/src/config/db");

async function run() {
  console.log("Checking live cryptographic audit against blockchain...");
  const a1 = await auditElection(1);
  console.log("Election 1 Audit Result:", {
    name: a1.electionName,
    match: a1.match,
    totalEvents: a1.totalEvents,
    uniqueNullifiers: a1.uniqueNullifiers,
    duplicateNullifiers: a1.duplicateNullifiers,
    mismatchesCount: a1.mismatches.length,
  });

  const a2 = await auditElection(2);
  console.log("Election 2 Audit Result:", {
    name: a2.electionName,
    match: a2.match,
    totalEvents: a2.totalEvents,
    uniqueNullifiers: a2.uniqueNullifiers,
    duplicateNullifiers: a2.duplicateNullifiers,
    mismatchesCount: a2.mismatches.length,
  });

  if (a1.match && a2.match) {
    console.log("✅ SUCCESS: Both on-chain elections audit match: true with zero mismatches!");
  } else {
    console.error("❌ FAILURE: Audit detected mismatch!");
    process.exit(1);
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
