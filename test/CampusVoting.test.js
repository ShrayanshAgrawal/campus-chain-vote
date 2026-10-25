const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CampusVoting Contract", function () {
  let CampusVoting;
  let voting;
  let owner;
  let relayer;
  let nonRelayer;
  let student;

  const sampleNullifier1 = ethers.keccak256(ethers.toUtf8Bytes("nullifier-1"));
  const sampleNullifier2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier-2"));
  const sampleNullifier3 = ethers.keccak256(ethers.toUtf8Bytes("nullifier-3"));

  beforeEach(async function () {
    [owner, relayer, nonRelayer, student] = await ethers.getSigners();
    CampusVoting = await ethers.getContractFactory("CampusVoting");
    voting = await CampusVoting.deploy(owner.address, relayer.address);
    await voting.waitForDeployment();
  });

  describe("Deployment and Roles", function () {
    it("should set DEFAULT_ADMIN_ROLE and RELAYER_ROLE correctly", async function () {
      const DEFAULT_ADMIN_ROLE = await voting.DEFAULT_ADMIN_ROLE();
      const RELAYER_ROLE = await voting.RELAYER_ROLE();

      expect(await voting.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await voting.hasRole(RELAYER_ROLE, relayer.address)).to.be.true;
      expect(await voting.hasRole(RELAYER_ROLE, nonRelayer.address)).to.be.false;
    });
  });

  describe("Election Lifecycle and Events", function () {
    it("should create election and emit ElectionCreated event", async function () {
      await expect(voting.connect(owner).createElection("President 2026"))
        .to.emit(voting, "ElectionCreated")
        .withArgs(1, "President 2026");

      const election = await voting.getElection(1);
      expect(election[0]).to.equal(1n);
      expect(election[1]).to.equal("President 2026");
      expect(election[2]).to.equal(0n); // Created
      expect(election[3]).to.equal(0n); // candidateCount
      expect(election[4]).to.equal(0n); // totalVotes
    });

    it("should add candidates and emit CandidateAdded event", async function () {
      await voting.connect(owner).createElection("President 2026");

      await expect(voting.connect(owner).addCandidate(1, "Alice Smith"))
        .to.emit(voting, "CandidateAdded")
        .withArgs(1, 1, "Alice Smith");

      await expect(voting.connect(owner).addCandidate(1, "Bob Jones"))
        .to.emit(voting, "CandidateAdded")
        .withArgs(1, 2, "Bob Jones");

      const candidates = await voting.getCandidates(1);
      expect(candidates.length).to.equal(2);
      expect(candidates[0].name).to.equal("Alice Smith");
      expect(candidates[1].name).to.equal("Bob Jones");
    });

    it("should reject opening election with fewer than 2 candidates", async function () {
      await voting.connect(owner).createElection("President 2026");
      await voting.connect(owner).addCandidate(1, "Solo Candidate");

      await expect(voting.connect(owner).openElection(1)).to.be.revertedWith(
        "Needs at least 2 candidates to open"
      );
    });

    it("should open election and emit ElectionOpened event", async function () {
      await voting.connect(owner).createElection("President 2026");
      await voting.connect(owner).addCandidate(1, "Alice");
      await voting.connect(owner).addCandidate(1, "Bob");

      await expect(voting.connect(owner).openElection(1))
        .to.emit(voting, "ElectionOpened")
        .withArgs(1);

      const election = await voting.getElection(1);
      expect(election[2]).to.equal(1n); // Open
    });

    it("should lock candidates after opening (candidates locked after open)", async function () {
      await voting.connect(owner).createElection("President 2026");
      await voting.connect(owner).addCandidate(1, "Alice");
      await voting.connect(owner).addCandidate(1, "Bob");
      await voting.connect(owner).openElection(1);

      await expect(
        voting.connect(owner).addCandidate(1, "Charlie")
      ).to.be.revertedWith("Candidates locked after election opens");
    });

    it("should close election and emit ElectionClosed event", async function () {
      await voting.connect(owner).createElection("President 2026");
      await voting.connect(owner).addCandidate(1, "Alice");
      await voting.connect(owner).addCandidate(1, "Bob");
      await voting.connect(owner).openElection(1);

      await expect(voting.connect(owner).closeElection(1))
        .to.emit(voting, "ElectionClosed")
        .withArgs(1);

      const election = await voting.getElection(1);
      expect(election[2]).to.equal(2n); // Closed
    });

    it("should prevent reopening a closed election", async function () {
      await voting.connect(owner).createElection("President 2026");
      await voting.connect(owner).addCandidate(1, "Alice");
      await voting.connect(owner).addCandidate(1, "Bob");
      await voting.connect(owner).openElection(1);
      await voting.connect(owner).closeElection(1);

      await expect(voting.connect(owner).openElection(1)).to.be.revertedWith(
        "Election must be in Created status to open"
      );
    });
  });

  describe("Voting Rules and Security", function () {
    beforeEach(async function () {
      await voting.connect(owner).createElection("President 2026");
      await voting.connect(owner).addCandidate(1, "Alice");
      await voting.connect(owner).addCandidate(1, "Bob");
    });

    it("should reject votes on non-open (Created) election", async function () {
      await expect(
        voting.connect(relayer).castVote(1, 1, sampleNullifier1)
      ).to.be.revertedWith("Election is not open");
    });

    it("should reject votes from non-relayer addresses (only relayer can vote)", async function () {
      await voting.connect(owner).openElection(1);

      await expect(
        voting.connect(nonRelayer).castVote(1, 1, sampleNullifier1)
      ).to.be.reverted;
    });

    it("should allow relayer to cast valid vote and emit VoteCast event with correct args", async function () {
      await voting.connect(owner).openElection(1);

      const tx = await voting.connect(relayer).castVote(1, 1, sampleNullifier1);
      await expect(tx)
        .to.emit(voting, "VoteCast")
        .withArgs(1, 1, sampleNullifier1, (val) => val > 0n);

      expect(await voting.isNullifierUsed(1, sampleNullifier1)).to.be.true;
      expect(await voting.totalVotes(1)).to.equal(1n);
    });

    it("should reject duplicate nullifier in the same election", async function () {
      await voting.connect(owner).openElection(1);
      await voting.connect(relayer).castVote(1, 1, sampleNullifier1);

      await expect(
        voting.connect(relayer).castVote(1, 2, sampleNullifier1)
      ).to.be.revertedWith("Nullifier already used");
    });

    it("should reject invalid candidate ID", async function () {
      await voting.connect(owner).openElection(1);

      await expect(
        voting.connect(relayer).castVote(1, 0, sampleNullifier1)
      ).to.be.revertedWith("Invalid candidate");

      await expect(
        voting.connect(relayer).castVote(1, 999, sampleNullifier1)
      ).to.be.revertedWith("Invalid candidate");
    });

    it("should reject voting in a closed election", async function () {
      await voting.connect(owner).openElection(1);
      await voting.connect(owner).closeElection(1);

      await expect(
        voting.connect(relayer).castVote(1, 1, sampleNullifier1)
      ).to.be.revertedWith("Election is not open");
    });

    it("should accurately maintain candidate vote counts and total tallies", async function () {
      await voting.connect(owner).openElection(1);

      await voting.connect(relayer).castVote(1, 1, sampleNullifier1);
      await voting.connect(relayer).castVote(1, 2, sampleNullifier2);
      await voting.connect(relayer).castVote(1, 1, sampleNullifier3);

      const results = await voting.getResults(1);
      expect(results[0].voteCount).to.equal(2n); // Alice: 2
      expect(results[1].voteCount).to.equal(1n); // Bob: 1
      expect(await voting.totalVotes(1)).to.equal(3n);
    });
  });
});
