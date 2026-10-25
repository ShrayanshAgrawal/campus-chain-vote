const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const env = require("./env");

let contractAbi = null;

// Try to locate compiled contract artifact
const artifactPaths = [
  path.resolve(__dirname, "../../../artifacts/contracts/CampusVoting.sol/CampusVoting.json"),
  path.resolve(__dirname, "../../artifacts/contracts/CampusVoting.sol/CampusVoting.json"),
  path.resolve(__dirname, "../contracts/CampusVoting.json"),
];

for (const p of artifactPaths) {
  if (fs.existsSync(p)) {
    try {
      const artifact = JSON.parse(fs.readFileSync(p, "utf-8"));
      contractAbi = artifact.abi;
      break;
    } catch (e) {
      console.warn("Could not read artifact at", p, e.message);
    }
  }
}

// Fallback minimal ABI in case artifact is not accessible at runtime
if (!contractAbi) {
  contractAbi = [
    "function createElection(string calldata name) external returns (uint256)",
    "function addCandidate(uint256 electionId, string calldata name) external",
    "function openElection(uint256 electionId) external",
    "function closeElection(uint256 electionId) external",
    "function castVote(uint256 electionId, uint256 candidateId, bytes32 nullifier) external",
    "function getElection(uint256 electionId) external view returns (uint256 id, string memory name, uint8 status, uint256 candidateCount, uint256 totalVotesCount)",
    "function getCandidates(uint256 electionId) external view returns (tuple(uint256 id, string name, uint256 voteCount)[] memory)",
    "function getResults(uint256 electionId) external view returns (tuple(uint256 id, string name, uint256 voteCount)[] memory)",
    "function isNullifierUsed(uint256 electionId, bytes32 nullifier) external view returns (bool)",
    "function totalVotes(uint256 electionId) external view returns (uint256)",
    "event ElectionCreated(uint256 indexed electionId, string name)",
    "event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name)",
    "event ElectionOpened(uint256 indexed electionId)",
    "event ElectionClosed(uint256 indexed electionId)",
    "event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, bytes32 indexed nullifier, uint256 timestamp)"
  ];
}

function getContractAddress() {
  if (process.env.CONTRACT_ADDRESS && process.env.CONTRACT_ADDRESS.trim() !== "") {
    return process.env.CONTRACT_ADDRESS.trim();
  }
  if (env.CONTRACT_ADDRESS && env.CONTRACT_ADDRESS.trim() !== "") {
    return env.CONTRACT_ADDRESS.trim();
  }
  // Check data/deployment.json
  const depPath = path.resolve(__dirname, "../../../data/deployment.json");
  if (fs.existsSync(depPath)) {
    try {
      const dep = JSON.parse(fs.readFileSync(depPath, "utf-8"));
      if (dep && dep.address) return dep.address;
    } catch (_) {}
  }
  return "";
}

function getProvider() {
  const rpc = process.env.RPC_URL || env.RPC_URL || "http://127.0.0.1:8545";
  return new ethers.JsonRpcProvider(rpc);
}

function getRelayerWallet(provider) {
  const p = provider || getProvider();
  const key = process.env.RELAYER_PRIVATE_KEY || env.RELAYER_PRIVATE_KEY;
  return new ethers.Wallet(key, p);
}

function getContract(signerOrProvider) {
  const address = getContractAddress();
  if (!address) {
    throw new Error("CONTRACT_ADDRESS is not set. Please deploy the contract first.");
  }
  const sp = signerOrProvider || getRelayerWallet();
  return new ethers.Contract(address, contractAbi, sp);
}

module.exports = {
  getProvider,
  getRelayerWallet,
  getContract,
  getContractAddress,
  contractAbi,
};
