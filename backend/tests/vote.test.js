const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/config/db");
const env = require("../src/config/env");
const chainService = require("../src/services/chainService");

describe("Elections & Voting API", () => {
  let eceStudent;
  let eceStudentToken;
  let activeElection;
  let closedElection;
  let cseElection;
  let candidateToVote;

  beforeAll(async () => {
    // Find ECE student (eligible for 1 and 2, but NOT 3)
    eceStudent = await prisma.student.findUnique({
      where: { enrollmentNo: "25100BTEC00760" },
    });

    eceStudentToken = jwt.sign(
      {
        id: eceStudent.id,
        enrollmentNo: eceStudent.enrollmentNo,
        role: eceStudent.role,
        name: eceStudent.name,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    activeElection = await prisma.election.findFirst({
      where: { status: "ACTIVE" },
      include: { candidates: true },
    });

    closedElection = await prisma.election.findFirst({
      where: { status: "CLOSED" },
      include: { candidates: true },
    });

    cseElection = await prisma.election.findFirst({
      where: { scope: "CSE" },
    });

    candidateToVote = activeElection.candidates[0];

    // Ensure hasVoted is false for activeElection for this student at test start
    await prisma.voterEligibility.upsert({
      where: {
        electionId_studentId: {
          electionId: activeElection.id,
          studentId: eceStudent.id,
        },
      },
      update: { hasVoted: false },
      create: {
        electionId: activeElection.id,
        studentId: eceStudent.id,
        hasVoted: false,
      },
    });

    // Remove any previous vote receipts for this student's nullifier in this election
    const nullifierService = require("../src/services/nullifierService");
    const nullifier = nullifierService.computeNullifier(
      eceStudent.enrollmentNo,
      activeElection.chainElectionId
    );
    await prisma.voteReceipt.deleteMany({
      where: { nullifier },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should show only elections the student is eligible for in GET /api/elections", async () => {
    const res = await request(app)
      .get("/api/elections")
      .set("Authorization", `Bearer ${eceStudentToken}`);

    expect(res.status).toBe(200);
    const electionIds = res.body.elections.map((e) => e.id);
    expect(electionIds).toContain(activeElection.id);
    expect(electionIds).toContain(closedElection.id);
    expect(electionIds).not.toContain(cseElection.id); // ECE student cannot see CSE election
  });

  it("should block non-eligible student from accessing election details (403)", async () => {
    const res = await request(app)
      .get(`/api/elections/${cseElection.id}`)
      .set("Authorization", `Bearer ${eceStudentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not eligible/i);
  });

  it("should reject voting in a CLOSED election (400)", async () => {
    const res = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${eceStudentToken}`)
      .send({
        electionId: closedElection.id,
        candidateId: closedElection.candidates[0].id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not open/i);
  });

  it("should successfully cast a vote and return a receipt", async () => {
    // Mock chainService.castVoteOnChain
    const castVoteSpy = jest.spyOn(chainService, "castVoteOnChain").mockResolvedValueOnce({
      txHash: "0x" + "a".repeat(64),
      blockNumber: 101,
    });

    const res = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${eceStudentToken}`)
      .send({
        electionId: activeElection.id,
        candidateId: candidateToVote.id,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.receipt).toBeDefined();
    expect(res.body.receipt.txHash).toBe("0x" + "a".repeat(64));
    expect(res.body.receipt.blockNumber).toBe(101);
    expect(res.body.receipt.nullifier).toBeDefined();

    // Verify DB updated hasVoted = true
    const eligibility = await prisma.voterEligibility.findUnique({
      where: {
        electionId_studentId: {
          electionId: activeElection.id,
          studentId: eceStudent.id,
        },
      },
    });
    expect(eligibility.hasVoted).toBe(true);

    castVoteSpy.mockRestore();
  });

  it("should reject a second vote attempt with 409 Conflict (double vote rejected)", async () => {
    const res = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${eceStudentToken}`)
      .send({
        electionId: activeElection.id,
        candidateId: candidateToVote.id,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already cast your vote/i);
  });
});
