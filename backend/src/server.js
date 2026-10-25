const app = require("./app");
const env = require("./config/env");

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 CampusChainVote Backend API running on port ${PORT}`);
  console.log(`   Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`   Dev Mode: ${env.DEV_MODE} | Dev Show OTP: ${env.DEV_SHOW_OTP}`);
  console.log(`======================================================\n`);
});

process.on("SIGINT", () => {
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  server.close(() => {
    console.log("Server terminated");
    process.exit(0);
  });
});
