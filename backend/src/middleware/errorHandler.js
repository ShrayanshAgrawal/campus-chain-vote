function errorHandler(err, req, res, next) {
  // Never log sensitive student secrets or tokens
  const statusCode = err.statusCode || (err.status && typeof err.status === "number" ? err.status : 500);

  console.error(`[Error] ${req.method} ${req.url} -> ${statusCode}:`, err);

  // Handle Zod validation errors
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "Validation error",
      details: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
    });
  }

  // Handle Prisma unique constraint error
  if (err.code === "P2002") {
    return res.status(409).json({
      error: "Unique constraint violation: resource already exists",
    });
  }

  // Handle Smart Contract revert messages
  if (err.reason || err.shortMessage) {
    const reason = err.reason || err.shortMessage;
    if (reason.includes("Nullifier already used")) {
      return res.status(409).json({ error: "Vote already recorded on blockchain for this election" });
    }
    if (reason.includes("Election is not open")) {
      return res.status(400).json({ error: "Election is not open for voting" });
    }
    if (reason.includes("Invalid candidate")) {
      return res.status(400).json({ error: "Invalid candidate selected" });
    }
    return res.status(400).json({ error: `Blockchain error: ${reason}` });
  }

  res.status(statusCode).json({
    error: err.message || "An internal server error occurred",
  });
}

module.exports = errorHandler;
