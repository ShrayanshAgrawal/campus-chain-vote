const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding from CSV files...");

  const dataDir = path.resolve(__dirname, "../../data");

  // Default password hash for all seeded students: "123456"
  const defaultPasswordHash = await bcrypt.hash("123456", 10);
  // Admin password: "admin123"
  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  // 1. Seed Students
  console.log("Loading students.csv...");
  const studentsFile = fs.readFileSync(path.join(dataDir, "students.csv"), "utf-8");
  const studentRows = parse(studentsFile, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`Found ${studentRows.length} students/admins in CSV.`);
  for (const row of studentRows) {
    const isAdmin = row.role?.toUpperCase() === "ADMIN";
    await prisma.student.upsert({
      where: { enrollmentNo: row.enrollment_no },
      update: {
        name: row.name,
        email: row.email,
        branch: row.branch,
        year: parseInt(row.year, 10) || 0,
        role: row.role.toUpperCase(),
        passwordHash: isAdmin ? adminPasswordHash : defaultPasswordHash,
      },
      create: {
        enrollmentNo: row.enrollment_no,
        name: row.name,
        email: row.email,
        branch: row.branch,
        year: parseInt(row.year, 10) || 0,
        role: row.role.toUpperCase(),
        passwordHash: isAdmin ? adminPasswordHash : defaultPasswordHash,
      },
    });
  }

  // 2. Seed Elections
  console.log("Loading elections.csv...");
  const electionsFile = fs.readFileSync(path.join(dataDir, "elections.csv"), "utf-8");
  const electionRows = parse(electionsFile, { columns: true, skip_empty_lines: true, trim: true });

  const electionIdMap = {}; // maps csv election_id -> db election record
  for (const row of electionRows) {
    const chainId = parseInt(row.election_id, 10);
    const election = await prisma.election.upsert({
      where: { chainElectionId: chainId },
      update: {
        name: row.name,
        scope: row.scope,
        status: row.status.toUpperCase(),
        startTime: new Date(row.start_time),
        endTime: new Date(row.end_time),
      },
      create: {
        chainElectionId: chainId,
        name: row.name,
        scope: row.scope,
        status: row.status.toUpperCase(),
        startTime: new Date(row.start_time),
        endTime: new Date(row.end_time),
      },
    });
    electionIdMap[row.election_id] = election;
  }

  // 3. Seed Candidates
  console.log("Loading candidates.csv...");
  const candidatesFile = fs.readFileSync(path.join(dataDir, "candidates.csv"), "utf-8");
  const candidateRows = parse(candidatesFile, { columns: true, skip_empty_lines: true, trim: true });

  for (const row of candidateRows) {
    const election = electionIdMap[row.election_id];
    if (!election) {
      console.warn(`Election ${row.election_id} not found for candidate ${row.name}`);
      continue;
    }
    const chainCandId = parseInt(row.candidate_id, 10);
    const candidate = await prisma.candidate.upsert({
      where: {
        electionId_chainCandidateId: {
          electionId: election.id,
          chainCandidateId: chainCandId,
        },
      },
      update: {
        name: row.name,
        enrollmentNo: row.enrollment_no,
        branch: row.branch,
        year: parseInt(row.year, 10) || 1,
        manifesto: row.manifesto,
      },
      create: {
        electionId: election.id,
        chainCandidateId: chainCandId,
        name: row.name,
        enrollmentNo: row.enrollment_no,
        branch: row.branch,
        year: parseInt(row.year, 10) || 1,
        manifesto: row.manifesto,
      },
    });

    // Initialize or update ResultCache
    await prisma.resultCache.upsert({
      where: {
        electionId_candidateId: {
          electionId: election.id,
          candidateId: candidate.id,
        },
      },
      update: {
        chainCandidateId: chainCandId,
      },
      create: {
        electionId: election.id,
        candidateId: candidate.id,
        chainCandidateId: chainCandId,
        voteCount: 0,
      },
    });
  }

  // 4. Seed Voter Eligibility
  console.log("Loading eligibility.csv...");
  const eligibilityFile = fs.readFileSync(path.join(dataDir, "eligibility.csv"), "utf-8");
  const eligibilityRows = parse(eligibilityFile, { columns: true, skip_empty_lines: true, trim: true });

  // Pre-fetch all students into a map by enrollmentNo for fast lookup
  const allStudents = await prisma.student.findMany();
  const studentMap = {};
  for (const s of allStudents) {
    studentMap[s.enrollmentNo] = s.id;
  }

  const eligibilityCreates = [];
  for (const row of eligibilityRows) {
    const election = electionIdMap[row.election_id];
    const studentId = studentMap[row.enrollment_no];
    if (election && studentId) {
      eligibilityCreates.push({
        electionId: election.id,
        studentId: studentId,
        hasVoted: row.has_voted === "1" || row.has_voted === "true",
      });
    }
  }

  console.log(`Processing ${eligibilityCreates.length} voter eligibility records...`);
  // Clear existing voter eligibility for clean seed
  await prisma.voterEligibility.deleteMany({});
  
  // Batch insert in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < eligibilityCreates.length; i += CHUNK_SIZE) {
    const chunk = eligibilityCreates.slice(i, i + CHUNK_SIZE);
    await prisma.voterEligibility.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }

  const studentCount = await prisma.student.count();
  const electionCount = await prisma.election.count();
  const candidateCount = await prisma.candidate.count();
  const eligibilityCount = await prisma.voterEligibility.count();

  console.log(`Seeding complete! Loaded:`);
  console.log(`- Students/Admins: ${studentCount}`);
  console.log(`- Elections: ${electionCount}`);
  console.log(`- Candidates: ${candidateCount}`);
  console.log(`- Voter Eligibility records: ${eligibilityCount}`);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
