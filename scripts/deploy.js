const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying CampusVoting with account:", deployer.address);

  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  console.log("Initial Relayer address:", relayerAddress);

  const CampusVoting = await hre.ethers.getContractFactory("CampusVoting");
  const voting = await CampusVoting.deploy(deployer.address, relayerAddress);
  await voting.waitForDeployment();

  const contractAddress = await voting.getAddress();
  console.log("CampusVoting deployed to:", contractAddress);

  // Write deployment info for backend and frontend
  const deploymentDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentInfo = {
    address: contractAddress,
    network: hre.network.name,
    deployer: deployer.address,
    relayer: relayerAddress,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(deploymentDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Saved deployment info to data/deployment.json");

  // Also update .env and backend/.env CONTRACT_ADDRESS if files exist
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf-8");
    if (envContent.includes("CONTRACT_ADDRESS=")) {
      envContent = envContent.replace(/CONTRACT_ADDRESS=.*/g, `CONTRACT_ADDRESS=${contractAddress}`);
    } else {
      envContent += `\nCONTRACT_ADDRESS=${contractAddress}\n`;
    }
    fs.writeFileSync(envPath, envContent);
  }

  const backendEnvPath = path.join(__dirname, "..", "backend", ".env");
  if (fs.existsSync(backendEnvPath)) {
    let backendEnvContent = fs.readFileSync(backendEnvPath, "utf-8");
    if (backendEnvContent.includes("CONTRACT_ADDRESS=")) {
      backendEnvContent = backendEnvContent.replace(/CONTRACT_ADDRESS=.*/g, `CONTRACT_ADDRESS=${contractAddress}`);
    } else {
      backendEnvContent += `\nCONTRACT_ADDRESS=${contractAddress}\n`;
    }
    fs.writeFileSync(backendEnvPath, backendEnvContent);
  }

  return contractAddress;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
