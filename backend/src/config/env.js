require("dotenv").config({ path: process.env.ENV_FILE || undefined });
require("dotenv").config({ path: "../.env" });

const { z } = require("zod");

const envSchema = z.object({
  PORT: z.string().default("5000"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/campus_vote?schema=public"),
  JWT_SECRET: z.string().default("campus_chain_vote_jwt_super_secret_key_2026_secure"),
  NULLIFIER_SECRET: z.string().default("campus_voting_secret_salt_for_deterministic_nullifiers_2026"),
  RELAYER_PRIVATE_KEY: z.string().default("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"),
  RPC_URL: z.string().default("http://127.0.0.1:8545"),
  CONTRACT_ADDRESS: z.string().optional().default(""),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  DEV_MODE: z.string().transform((v) => v === "true" || v === "1").default("true"),
  DEV_SHOW_OTP: z.string().transform((v) => v === "true" || v === "1").default("true"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.string().optional().default("587"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("noreply@campus.edu"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.format());
  process.exit(1);
}

module.exports = parsed.data;
