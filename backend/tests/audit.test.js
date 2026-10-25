const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/config/db");
const env = require("../src/config/env");
const chainService = require("../src/services/chainService");

describe("Audit API and Tamper Detection", () => {
  let userToken;
  let testElection;
  let targetCandidateCache;
  let originalVoteCount;

  beforeAll(async () => {
    const student = await prisma.student.findFirst();
    userToken = jwt.sign(
      {
        id: student.id,
        enrollmentNo: student.enrollmentNo,
        role: student.role,
        name: student.name,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    testElection = await prisma.election.findFirst({
      where: { chainElectionId: 1 },
      include: {
        candidates: true,
        resultCache: true,
      },
    });

    targetCandidateCache = testElection.resultCache[0];
    originalVoteCount = targetCandidateCache.voteCount;
  });

  afterAll(async () => {
    // Ensure restored
    if (targetCandidateCache) {
      await prisma.resultCache.update({
        where: { id: targetCandidateCache.id },
        data: { voteCount: originalVoteCount },
      });
    }
    await prisma.$disconnect();
  });

  it("should return match: true when blockchain events, chain getResults, and DB resultCache agree", async () => {
    // Generate mock events that match the current DB resultCache
    const mockEvents = [];
    let nullifierCounter = 1;
    for (const r of testElection.resultCache) {
      for (let i = 0; i < r.voteCount; i++) {
        mockEvents.push({
          electionId: testElection.chainElectionId,
          candidateId: r.chainCandidateId,
          nullifier: `0x${nullifierCounter.toString(16).padStart(64, "0")}`,
          timestamp: Math.floor(Date.now() / 1000),
          blockNumber: 100 + i,
        });
        nullifierCounter++;
      }
    }

    const mockChainResults = testElection.candidates.map((c) => {
      const cache = testElection.resultCache.find((rc) => rc.candidateId === c.id);
      return {
        candidateId: c.chainCandidateId,
        name: c.name,
        voteCount: cache ? cache.voteCount : 0,
      };
    });

    const getEventsSpy = jest.spyOn(chainService, "getAllVoteCastEvents").mockResolvedValue(mockEvents);
    const getResultsSpy = jest.spyOn(chainService, "getResultsOnChain").mockResolvedValue(mockChainResults);

    const res = await request(app)
      .get(`/api/audit/${testElection.id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.match).toBe(true);
    expect(res.body.mismatches.length).toBe(0);
    expect(res.body.duplicateNullifiers).toBe(0);

    getEventsSpy.mockRestore();
    getResultsSpy.mockRestore();
  });

  it("should detect mismatch (match: false) when database resultCache has been tampered with", async () => {
    // Tamper directly with the database count
    const tamperedCount = originalVoteCount + 50;
    await prisma.resultCache.update({
      where: { id: targetCandidateCache.id },
      data: { voteCount: tamperedCount },
    });

    // Mock chain still returning genuine original counts
    const mockEvents = [];
    let nullifierCounter = 1;
    for (const r of testElection.resultCache) {
      const genuineCount = r.id === targetCandidateCache.id ? originalVoteCount : r.voteCount;
      for (let i = 0; i < genuineCount; i++) {
        mockEvents.push({
          electionId: testElection.chainElectionId,
          candidateId: r.chainCandidateId,
          nullifier: `0x${nullifierCounter.toString(16).padStart(64, "0")}`,
          timestamp: Math.floor(Date.now() / 1000),
          blockNumber: 100 + i,
        });
        nullifierCounter++;
      }
    }

    const mockChainResults = testElection.candidates.map((c) => {
      const cache = testElection.resultCache.find((rc) => rc.candidateId === c.id);
      const count = (cache && cache.id === targetCandidateCache.id) ? originalVoteCount : (cache ? cache.voteCount : 0);
      return {
        candidateId: c.chainCandidateId,
        name: c.name,
        voteCount: count,
      };
    });

    const getEventsSpy = jest.spyOn(chainService, "getAllVoteCastEvents").mockResolvedValue(mockEvents);
    const getResultsSpy = jest.spyOn(chainService, "getResultsOnChain").mockResolvedValue(mockChainResults);

    const res = await request(app)
      .get(`/api/audit/${testElection.id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.match).toBe(false);
    expect(res.body.mismatches.length).toBeGreaterThan(0);
    expect(res.body.mismatches[0].dbCount).toBe(tamperedCount);

    // Restore original vote count
    await prisma.resultCache.update({
      where: { id: targetCandidateCache.id },
      data: { voteCount: originalVoteCount },
    });

    getEventsSpy.mockRestore();
    getResultsSpy.mockRestore();
  });
});
