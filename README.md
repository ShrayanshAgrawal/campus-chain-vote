# CampusChainVote: Tamper-Proof Hybrid Blockchain Campus Voting

CampusChainVote is an enterprise-grade hybrid campus election web application. It combines the speed, privacy, and eligibility isolation of a traditional PostgreSQL relational database with the immutability, tamper resistance, and cryptographic auditability of Ethereum smart contracts.

---

## 1. Objective

Campus voting systems frequently face trust issues: centralized database administrators can manipulate tallies, students worry their ballots are tied to their identities, and recounts lack cryptographic audit trails.

**CampusChainVote solves this by separating identity from ballot recording:**
- **Off-Chain (PostgreSQL):** Handles student authentication, role verification, branch-based eligibility enforcement, one-time passwords (OTPs), and prevents user enumeration.
- **On-Chain (Solidity ^0.8.20 Smart Contract):** Enforces election lifecycle rules, locks candidate lists upon election opening, prevents reopening of closed elections, records anonymous ballots via deterministic cryptographic nullifiers, and computes immutable tallies.
- **Strict Privacy Rule:** Smart contracts and transaction receipts contain **zero student names, zero enrollment numbers, and zero personally identifiable information (PII)**.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------+
|                                CLIENT LAYER                                 |
|         React + Vite + Tailwind CSS (Light Theme) + Recharts Visuals        |
+-----------------------------------------------------------------------------+
                                       |
                                       | HTTPS (REST API + JWT Bearer)
                                       v
+-----------------------------------------------------------------------------+
|                             EXPRESS BACKEND API                             |
|    - Rate Limiting, Helmet, Zod Validation, Central Error Handling          |
|    - OTP Verification Service (Nodemailer / Bcrypt / 5-min Expiry)          |
|    - Role & Scope-based Voter Eligibility Enforcement                       |
|    - Mutex Double-Click Concurrency Locks per Student & Election            |
|    - Deterministic Keccak256 Nullifier Generator (ethers.js v6)             |
+-----------------------------------------------------------------------------+
             |                                                |
  SQL via    |                                                | JSON-RPC via
  Prisma ORM |                                                | Relayer Wallet
             v                                                v
+-----------------------------+        +--------------------------------------+
|     POSTGRESQL DATABASE     |        |      ETHEREUM SMART CONTRACT         |
|         (Off-Chain)         |        |         CampusVoting.sol             |
+-----------------------------+        +--------------------------------------+
| • Students & Admins (PII)   |        | • Elections (id, status, count)      |
| • Department Eligibility    |        | • Locked Candidates List (id, name)  |
| • has_voted Flag (boolean)  |        | • Used Nullifiers Mapping (bytes32)  |
| • Anonymous Receipts        |        | • Immutable Vote Tallies             |
| • Cached Tallies (cache)    |        | • Event Logs: VoteCast, Opened, etc. |
| • Administrative Audit Logs |        | • AccessControl (Admin / Relayer)    |
+-----------------------------+        +--------------------------------------+
```

---

## 3. End-to-End Vote Flow Diagram

```
Student Browser            Express API Server          Relayer Wallet           CampusVoting.sol            PostgreSQL DB
      |                            |                         |                         |                          |
      |-- 1. POST /api/vote ------>|                         |                         |                          |
      |   (electionId, candId)     |                         |                         |                          |
      |                            |-- 2. Verify Open, ----->|                         |                          |
      |                            |      Eligible & !voted  |                         |                          |
      |                            |-- 3. Lock Mutex ------->|                         |                          |
      |                            |-- 4. Compute Nullifier->|                         |                          |
      |                            |      keccak256(enroll,  |                         |                          |
      |                            |                eid,     |                         |                          |
      |                            |                secret)  |                         |                          |
      |                            |-- 5. Dispatch Vote ---->|                         |                          |
      |                            |      via Relayer Wallet |-- 6. castVote(eid, cand,|                          |
      |                            |                         |               nullifier)|                          |
      |                            |                         |                         |-- 7. Require Open,       |
      |                            |                         |                         |      Valid candidate,    |
      |                            |                         |                         |      !usedNullifiers     |
      |                            |                         |                         |-- 8. usedNullifier=true  |
      |                            |                         |                         |-- 9. Increment counts    |
      |                            |                         |                         |-- 10. Emit VoteCast event|
      |                            |                         |<-- 11. Tx Receipt ------|                          |
      |                            |<-- 12. Confirmed Tx ----|                         |                          |
      |                            |                                                                              |
      |                            |-- 13. [Atomic Transaction] ------------------------------------------------->|
      |                            |       - Set hasVoted = true                                                  |
      |                            |       - Insert VoteReceipt(nullifier, txHash, blockNumber) [NO STUDENT ID!]  |
      |                            |       - Increment resultCache                                                |
      |                            |       - Insert AuditLog("VOTE_CAST") [NO CANDIDATE CHOICE!]                  |
      |                            |<-- 14. Transaction Committed ------------------------------------------------|
      |<-- 15. Return Receipt -----|
      |    { txHash, blockNumber,  |
      |      nullifier }           |
```

---

## 4. Cryptographic Nullifiers: One-Vote-Per-Student Without Identity

In electronic voting, the fundamental challenge is preventing double-voting while maintaining absolute ballot secrecy.

CampusChainVote generates a **deterministic cryptographic nullifier**:
$$\text{Nullifier} = \text{keccak256}(\text{abi.encodePacked}(\text{enrollmentNo}, \text{chainElectionId}, \text{NULLIFIER\_SECRET}))$$

1. **Uniqueness:** For any given election and student, the nullifier is identical and deterministic. If the student attempts to vote a second time, the smart contract's `mapping(uint256 => mapping(bytes32 => bool)) usedNullifiers` reverts with `"Nullifier already used"`.
2. **Anonymity (One-Way):** Due to the pre-image resistance of keccak256 and the high-entropy server salt `NULLIFIER_SECRET`, it is mathematically infeasible to reverse-engineer the student's enrollment number or identity from the on-chain nullifier.
3. **Receipt Disassociation:** The `VoteReceipt` table in PostgreSQL stores `nullifier`, `txHash`, and `blockNumber`—**with no foreign key or relation to the Student table**. Thus, even a compromised database cannot link a receipt to an individual.

---

## 5. On-Chain vs Off-Chain Data Separation

| Feature / Data Point | Storage Location | Privacy & Security Rationale |
| :--- | :--- | :--- |
| **Student Names, Emails, Branches, Years** | Off-Chain (PostgreSQL) | Sensitive PII must never be stored on a transparent public blockchain. |
| **Authentication & OTP Hashes** | Off-Chain (PostgreSQL) | Password hashes and temporary credentials belong in private database storage. |
| **Voter Eligibility & has_voted Flag** | Off-Chain (PostgreSQL) | Fast branch-level query filtering and instant gatekeeping. |
| **Election Lifecycle Rules & Status** | On-Chain (Smart Contract) | Rules (Open, Closed) are enforced by immutable EVM code. Cannot be bypassed. |
| **Candidate Profiles & Manifesto** | Hybrid (DB + On-Chain) | Names and IDs are locked on-chain; extended manifestos stored off-chain. |
| **Anonymous Ballots & Nullifiers** | On-Chain (Smart Contract) | Cryptographically proves each vote was counted without revealing identity. |
| **Audit Recount Event Logs (VoteCast)** | On-Chain (Smart Contract) | Provides immutable event log for independent verification and recounts. |
| **Cached Tally (ResultCache)** | Off-Chain (PostgreSQL) | High-speed read cache. Automatically audited against on-chain logs. |

---

## 6. Demo Accounts (Synthetic Dataset)

All dataset users are generated deterministically with seed 42. In development mode (`DEV_MODE=true`, `DEV_SHOW_OTP=true`), the OTP is displayed directly in the UI with a one-click **"Auto-fill"** button.

### Election Administrator
- **Enrollment ID:** `ADMIN001`
- **Name:** Election Commissioner
- **Role:** `ADMIN` (Access to Admin Dashboard, candidate deployment, CSV upload, lifecycle control)

### Active Election Students (Unvoted Voters for Election 2)
The following 5 students have `has_voted = 0` for **Cultural Committee Secretary 2026** (ACTIVE, campus-wide):

| Enrollment Number | Student Name | Branch | Year | Status in Election 2 |
| :--- | :--- | :--- | :--- | :--- |
| `24100BTEC00981` | Urvashi Kulkarni | ECE | 2 | Eligible • Ready to vote |
| `24100BTCSDS00544` | Jason Sha | CSE-DS | 2 | Eligible • Ready to vote |
| `23100BTEE00998` | Meera Prakash | EE | 3 | Eligible • Ready to vote |
| `24100BTCSDS00308` | Ekavir Wable | CSE-DS | 2 | Eligible • Ready to vote |
| `24100BTCSDS00136` | Odika Nori | CSE-DS | 2 | Eligible • Ready to vote |

*(Note: Students from non-CSE branches such as `24100BTEC00981` are automatically excluded from the CSE-only Election #3).*

---

## 7. How to Run Locally (One-Command Setup)

### Prerequisites
- Node.js (v18+ or v20+)
- PostgreSQL service running locally on port 5432 (or Docker Compose)

### One-Command Setup
Clone the repository and run:
```bash
npm run setup
```
This automated script executes:
1. Environment configuration setup from `.env.example`
2. Dependency installation for root, backend, and frontend
3. Smart contract compilation (`npx hardhat compile`)
4. Verification and background launch of local Hardhat node (port 8545)
5. Deployment of `CampusVoting.sol` and recording of contract address
6. PostgreSQL schema synchronization via Prisma
7. Database seeding with 1,002 students/admins, 3 elections, 12 candidates, 2,288 eligibility entries
8. Blockchain seeding: replaying 693 votes on Election 1, 369 votes on Election 2, and syncing DB resultCache.

### Starting Development Servers
Run the full-stack application (Express API on port 5000 + Vite Frontend on port 5173):
```bash
npm run dev
```
Open **http://localhost:5173** in your browser.

---

## 8. Running Automated Tests

Run the complete test suite (Smart contract tests + Supertest backend API tests):
```bash
npm test
```

### Individual Test Suites
- **Contract Unit Tests (Hardhat + Chai):**
  ```bash
  npm run test:contract
  ```
  *Tests AccessControl, only relayer voting, duplicate nullifier rejection, non-open election rejection, invalid candidate checks, candidate freeze upon open, and tally math.*

- **Backend API Integration Tests (Jest + Supertest):**
  ```bash
  npm run test:backend
  ```
  *Tests login & OTP verification, anti-user enumeration, department-based election filtering, ballot casting, 409 double-voting rejection, closed election rejection, cryptographic audit match, and tamper detection.*

---

## 9. Tamper Detection Demonstration

To observe how the cryptographic audit catches off-chain database alterations:
```bash
npm run tamper-demo
```

### What Happens in the Demo:
1. **Baseline Audit:** Executes an independent recount of all blockchain `VoteCast` event logs for Election #1 and verifies a clean 100% match against the database cache.
2. **Malicious Injection:** Directly alters the PostgreSQL `ResultCache` table, adding **+75 fake votes** to Candidate #1.
3. **Audit Recount:** Reruns the audit. The blockchain event logs detect the discrepancy immediately, producing:
   ```
   ============================ AUDIT REPORT ============================
     Match Status: 🚨 MISMATCH DETECTED!
     Mismatches Count: 1

     🚨 FRAUD / TAMPERING DETECTED:
        Candidate:        Maanas Munshi (ID: 1)
        Blockchain Logs:  201 verified votes
        Smart Contract:   201 contract votes
        Database Cache:   276 votes (UNVERIFIED DISCREPANCY: +75)
   ======================================================================
   ```
4. **Self-Healing:** Restores the authentic vote count, confirming that the blockchain remains the unshakeable source of truth.

---

## 10. Deploying to Ethereum Sepolia Testnet

1. Open `.env` and set your Sepolia credentials:
   ```env
   SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
   SEPOLIA_PRIVATE_KEY="YOUR_SEPOLIA_PRIVATE_KEY_WITH_TEST_ETH"
   ```
2. Deploy the contract:
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```
3. Copy the deployed contract address output into `CONTRACT_ADDRESS` in `.env` and `backend/.env`.

---

## 11. Limitations & Security Considerations

1. **Relayer Trust Model:** In this hybrid architecture, the Express backend holds the `RELAYER_ROLE` private key and relays student votes to save students from paying gas or managing Web3 wallets (MetaMask). If the relayer server is compromised, it could theoretically drop transactions (censorship) or reorder votes, although it cannot forge votes without valid student OTPs or vote twice with the same student's nullifier.
2. **OTP Proves Email Access, Not Physical Identity:** One-Time Passwords prove access to the campus `@campus.edu` email mailbox rather than biometric presence. Compromised student email inboxes could be voted on by unauthorized parties.
3. **No Coercion Resistance / Receipt-Free Coercion:** Because students receive a transaction hash that decodes their specific candidate choice on-chain, a student can voluntarily reveal their receipt to a third party to prove how they voted.
4. **Synthetic Dataset:** All 1,002 students and candidates in `/data` were generated synthetically using Faker with random distributions for demonstration and stress testing.

---

## 12. License
MIT License. Built for secure, transparent campus self-governance.
