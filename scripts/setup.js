const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

function runCommand(command, cwd = process.cwd()) {
  console.log(`\n▶ [Executing] ${command} in ${cwd}`);
  execSync(command, { cwd, stdio: "inherit" });
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, () => resolve(true));
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log("====================================================================");
  console.log("🚀 CampusChainVote - Automated One-Command Setup");
  console.log("====================================================================");

  const rootDir = path.resolve(__dirname, "..");
  const backendDir = path.join(rootDir, "backend");
  const frontendDir = path.join(rootDir, "frontend");

  // 1. Initialize environment files
  const envPath = path.join(rootDir, ".env");
  const envExamplePath = path.join(rootDir, ".env.example");
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    console.log("Creating .env from .env.example...");
    fs.copyFileSync(envExamplePath, envPath);
  }

  const backendEnvPath = path.join(backendDir, ".env");
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, backendEnvPath);
  }

  // 2. Install dependencies if node_modules missing
  if (!fs.existsSync(path.join(rootDir, "node_modules"))) {
    console.log("Installing root dependencies...");
    runCommand("npm install --legacy-peer-deps", rootDir);
  }
  if (!fs.existsSync(path.join(backendDir, "node_modules"))) {
    console.log("Installing backend dependencies...");
    runCommand("npm install", backendDir);
  }
  if (!fs.existsSync(path.join(frontendDir, "node_modules"))) {
    console.log("Installing frontend dependencies...");
    runCommand("npm install", frontendDir);
  }

  // 3. Compile Smart Contracts
  console.log("Compiling smart contracts...");
  runCommand("npx hardhat compile", rootDir);

  // 4. Ensure Hardhat Node is running
  const isNodeRunning = await checkPort(8545);
  if (!isNodeRunning) {
    console.log("Starting Hardhat local node on port 8545 in background...");
    const nodeProcess = spawn("npx", ["hardhat", "node", "--hostname", "127.0.0.1"], {
      cwd: rootDir,
      detached: true,
      stdio: "ignore",
      shell: true,
    });
    nodeProcess.unref();

    // Wait for node to be available
    let attempts = 0;
    while (attempts < 15) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkPort(8545)) break;
      attempts++;
    }
    console.log("Hardhat node is live on http://127.0.0.1:8545");
  } else {
    console.log("Hardhat node already active on port 8545.");
  }

  // 5. Deploy Smart Contract
  console.log("Deploying CampusVoting contract to local node...");
  runCommand("npx hardhat run scripts/deploy.js --network localhost", rootDir);

  // Re-sync updated .env with CONTRACT_ADDRESS to backend
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, backendEnvPath);
  }

  // 6. Push Prisma Database Schema
  console.log("Synchronizing PostgreSQL schema with Prisma...");
  runCommand("npx prisma db push", backendDir);

  // 7. Seed Database from CSVs
  console.log("Seeding database with students, elections, and candidates...");
  runCommand("node prisma/seed.js", backendDir);

  // 8. Seed Blockchain and replay votes
  console.log("Seeding smart contract and replaying votes...");
  runCommand("npx hardhat run scripts/seed-chain.js --network localhost", rootDir);

  console.log("\n====================================================================");
  console.log("🎉 SETUP COMPLETED SUCCESSFULLY!");
  console.log("   To start the entire application:");
  console.log("     npm run dev");
  console.log("   To run all smart contract and API tests:");
  console.log("     npm test");
  console.log("   To execute the tamper-detection demonstration:");
  console.log("     npm run tamper-demo");
  console.log("====================================================================\n");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
