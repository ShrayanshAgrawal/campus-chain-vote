const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/db");

describe("Authentication & OTP API", () => {
  const testEnrollment = "25100BTEC00760"; // Valid student from dataset

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should request OTP for a valid student and return dev OTP in DEV_MODE", async () => {
    const res = await request(app)
      .post("/api/auth/request-otp")
      .send({ enrollmentNo: testEnrollment });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devOtp).toBeDefined();
    expect(res.body.devOtp).toMatch(/^\d{6}$/);
  });

  it("should return identical generic message for non-existent student (no user enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/request-otp")
      .send({ enrollmentNo: "NON_EXISTENT_STUDENT_999" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devOtp).toBeUndefined();
  });

  it("should reject OTP verification with incorrect OTP code", async () => {
    // Request fresh OTP first
    await request(app)
      .post("/api/auth/request-otp")
      .send({ enrollmentNo: testEnrollment });

    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ enrollmentNo: testEnrollment, otp: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid verification code/i);
  });

  it("should successfully verify OTP and return a signed JWT token", async () => {
    const reqRes = await request(app)
      .post("/api/auth/request-otp")
      .send({ enrollmentNo: testEnrollment });

    const validOtp = reqRes.body.devOtp;

    const verifyRes = await request(app)
      .post("/api/auth/verify-otp")
      .send({ enrollmentNo: testEnrollment, otp: validOtp });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeDefined();
    expect(verifyRes.body.user).toBeDefined();
    expect(verifyRes.body.user.enrollmentNo).toBe(testEnrollment);

    // Verify /api/auth/me works with the token
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${verifyRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.enrollmentNo).toBe(testEnrollment);
  });
});
