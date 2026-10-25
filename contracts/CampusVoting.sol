// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CampusVoting
 * @notice Tamper-proof hybrid campus voting smart contract.
 * @dev Stores election metadata, candidate lists, anonymous votes with nullifiers, and tallies.
 * Contains NO student identities, names, or enrollment numbers on-chain.
 * Contains NO function to edit/delete votes or reopen closed elections.
 */
contract CampusVoting is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    enum ElectionStatus {
        Created,
        Open,
        Closed
    }

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    struct Election {
        uint256 id;
        string name;
        ElectionStatus status;
        uint256 candidateCount;
        uint256 totalVotes;
    }

    uint256 public electionCount;

    // electionId => Election
    mapping(uint256 => Election) public elections;

    // electionId => candidateId => Candidate
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;

    // electionId => nullifier => used
    mapping(uint256 => mapping(bytes32 => bool)) public usedNullifiers;

    // Events
    event ElectionCreated(uint256 indexed electionId, string name);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event ElectionOpened(uint256 indexed electionId);
    event ElectionClosed(uint256 indexed electionId);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, bytes32 indexed nullifier, uint256 timestamp);

    constructor(address defaultAdmin, address initialRelayer) {
        address adminAddr = defaultAdmin == address(0) ? msg.sender : defaultAdmin;
        address relayerAddr = initialRelayer == address(0) ? msg.sender : initialRelayer;

        _grantRole(DEFAULT_ADMIN_ROLE, adminAddr);
        _grantRole(RELAYER_ROLE, relayerAddr);
    }

    /**
     * @notice Create a new election in Created status.
     * @param name Name / Title of the election.
     * @return electionId Assigned election ID.
     */
    function createElection(string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        require(bytes(name).length > 0, "Election name cannot be empty");
        electionCount++;
        uint256 newId = electionCount;

        elections[newId] = Election({
            id: newId,
            name: name,
            status: ElectionStatus.Created,
            candidateCount: 0,
            totalVotes: 0
        });

        emit ElectionCreated(newId, name);
        return newId;
    }

    /**
     * @notice Add a candidate to an election. Only permitted while status is Created.
     * @param electionId Target election ID.
     * @param name Candidate full name.
     */
    function addCandidate(uint256 electionId, string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(electionId > 0 && electionId <= electionCount, "Election does not exist");
        Election storage election = elections[electionId];
        require(election.status == ElectionStatus.Created, "Candidates locked after election opens");
        require(bytes(name).length > 0, "Candidate name cannot be empty");

        election.candidateCount++;
        uint256 candId = election.candidateCount;

        candidates[electionId][candId] = Candidate({
            id: candId,
            name: name,
            voteCount: 0
        });

        emit CandidateAdded(electionId, candId, name);
    }

    /**
     * @notice Open an election for voting. Requires at least 2 candidates.
     * Once opened, candidates can never be changed.
     * @param electionId Target election ID.
     */
    function openElection(uint256 electionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(electionId > 0 && electionId <= electionCount, "Election does not exist");
        Election storage election = elections[electionId];
        require(election.status == ElectionStatus.Created, "Election must be in Created status to open");
        require(election.candidateCount >= 2, "Needs at least 2 candidates to open");

        election.status = ElectionStatus.Open;
        emit ElectionOpened(electionId);
    }

    /**
     * @notice Close an active election. Once closed, cannot be reopened or voted in.
     * @param electionId Target election ID.
     */
    function closeElection(uint256 electionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(electionId > 0 && electionId <= electionCount, "Election does not exist");
        Election storage election = elections[electionId];
        require(election.status == ElectionStatus.Open, "Only Open elections can be closed");

        election.status = ElectionStatus.Closed;
        emit ElectionClosed(electionId);
    }

    /**
     * @notice Cast an anonymous vote with a nullifier.
     * Only addresses with RELAYER_ROLE may invoke this.
     * @param electionId Target election ID.
     * @param candidateId Chosen candidate ID (1-based index).
     * @param nullifier Cryptographic nullifier (keccak256 hash).
     */
    function castVote(
        uint256 electionId,
        uint256 candidateId,
        bytes32 nullifier
    ) external onlyRole(RELAYER_ROLE) {
        require(electionId > 0 && electionId <= electionCount, "Election does not exist");
        Election storage election = elections[electionId];
        require(election.status == ElectionStatus.Open, "Election is not open");
        require(candidateId > 0 && candidateId <= election.candidateCount, "Invalid candidate");
        require(!usedNullifiers[electionId][nullifier], "Nullifier already used");

        usedNullifiers[electionId][nullifier] = true;
        candidates[electionId][candidateId].voteCount++;
        election.totalVotes++;

        emit VoteCast(electionId, candidateId, nullifier, block.timestamp);
    }

    // --- View Functions ---

    function getElection(uint256 electionId) external view returns (
        uint256 id,
        string memory name,
        ElectionStatus status,
        uint256 candidateCount,
        uint256 totalVotesCount
    ) {
        require(electionId > 0 && electionId <= electionCount, "Election does not exist");
        Election storage e = elections[electionId];
        return (e.id, e.name, e.status, e.candidateCount, e.totalVotes);
    }

    function getCandidates(uint256 electionId) external view returns (Candidate[] memory) {
        require(electionId > 0 && electionId <= electionCount, "Election does not exist");
        uint256 count = elections[electionId].candidateCount;
        Candidate[] memory list = new Candidate[](count);
        for (uint256 i = 1; i <= count; i++) {
            list[i - 1] = candidates[electionId][i];
        }
        return list;
    }

    function getResults(uint256 electionId) external view returns (Candidate[] memory) {
        return this.getCandidates(electionId);
    }

    function isNullifierUsed(uint256 electionId, bytes32 nullifier) external view returns (bool) {
        return usedNullifiers[electionId][nullifier];
    }

    function totalVotes(uint256 electionId) external view returns (uint256) {
        require(electionId > 0 && electionId <= electionCount, "Election does not exist");
        return elections[electionId].totalVotes;
    }
}
