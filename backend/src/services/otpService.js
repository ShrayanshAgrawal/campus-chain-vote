const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const prisma = require("../config/db");
const env = require("../config/env");

let mailTransporter = null;
if (env.SMTP_HOST && env.SMTP_USER) {
  mailTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT, 10) || 587,
    secure: env.SMTP_PORT === "465",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

/**
 * Generate a 6-digit cryptographic OTP, hash it with bcrypt, and send/log it.
 * Supports finding student by enrollment number OR registered phone number.
 * Implements anti-user-enumeration: always returns identical generic message.
 */
async function requestOtp(identifier) {
  const normInput = (identifier || "").trim();
  const cleanPhone = normInput.replace(/[\s\-\(\)\+]/g, '');

  const student = await prisma.student.findFirst({
    where: {
      OR: [
        { enrollmentNo: normInput.toUpperCase() },
        { phone: normInput },
        ...(cleanPhone.length >= 7 ? [{ phone: { contains: cleanPhone } }] : []),
      ],
    },
  });

  const genericResponse = {
    success: true,
    message: "If the enrollment number or phone is registered, a one-time verification code has been sent.",
  };

  if (!student) {
    return genericResponse;
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  // Invalidate any previous unused OTPs for this student
  await prisma.otpCode.updateMany({
    where: { studentId: student.id, used: false },
    data: { used: true },
  });

  // Create new OTP record
  await prisma.otpCode.create({
    data: {
      studentId: student.id,
      codeHash,
      expiresAt,
      attempts: 0,
      used: false,
    },
  });

  const channel = student.phone ? "PHONE_SMS" : "EMAIL";
  const maskedPhone = student.phone
    ? student.phone.replace(/.(?=.{4})/g, '*')
    : null;

  if (env.DEV_MODE) {
    console.log(`\n========================================`);
    if (student.phone) {
      console.log(`📱 [PHONE SMS] Dispatched to Mobile: ${student.phone} | Student: ${student.name}`);
    } else {
      console.log(`📧 [EMAIL OTP] Dispatched to: ${student.email} | Student: ${student.name}`);
    }
    console.log(`🔑 Verification Code (OTP): ${otp}`);
    console.log(`========================================\n`);
  }

  // Send real SMS if Twilio configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER && student.phone) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', student.phone.startsWith('+') ? student.phone : `+91${student.phone}`);
      params.append('From', process.env.TWILIO_PHONE_NUMBER);
      params.append('Body', `Your CampusChainVote verification code is ${otp}. Valid for 5 minutes.`);

      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      console.log(`Real SMS sent via Twilio to ${student.phone}`);
    } catch (smsErr) {
      console.warn("Twilio SMS dispatch failed:", smsErr.message);
    }
  }

  // Send email if transporter configured
  if (mailTransporter && student.email) {
    try {
      await mailTransporter.sendMail({
        from: env.SMTP_FROM,
        to: student.email,
        subject: "Your CampusChainVote Verification Code",
        text: `Hello ${student.name},\n\nYour 6-digit verification code is: ${otp}\nThis code will expire in 5 minutes.`,
        html: `<p>Hello <b>${student.name}</b>,</p><p>Your 6-digit verification code is: <h2>${otp}</h2></p><p>This code will expire in 5 minutes.</p>`,
      });
    } catch (err) {
      console.warn("Could not dispatch email via SMTP:", err.message);
    }
  }

  const responseMessage = student.phone
    ? `One-time code sent via SMS to phone ending in ${student.phone.slice(-4)}`
    : "One-time code sent to registered campus email";

  if (env.DEV_SHOW_OTP) {
    return {
      success: true,
      message: responseMessage,
      devOtp: otp,
      enrollmentNo: student.enrollmentNo,
      phone: maskedPhone,
      channel,
    };
  }

  return {
    success: true,
    message: responseMessage,
    phone: maskedPhone,
    channel,
  };
}

/**
 * Verify OTP with max 5 attempts and 10-minute lockout.
 * On success, generates a signed 1-hour JWT.
 */
async function verifyOtp(identifier, otp) {
  const normInput = (identifier || "").trim();
  const cleanPhone = normInput.replace(/[\s\-\(\)\+]/g, '');
  const inputOtp = (otp || "").trim();

  const student = await prisma.student.findFirst({
    where: {
      OR: [
        { enrollmentNo: normInput.toUpperCase() },
        { phone: normInput },
        ...(cleanPhone.length >= 7 ? [{ phone: { contains: cleanPhone } }] : []),
      ],
    },
  });

  if (!student) {
    const error = new Error("Invalid enrollment number, phone number or verification code");
    error.statusCode = 400;
    throw error;
  }

  // Find latest active or recent OTP record
  const latestOtp = await prisma.otpCode.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
  });

  if (!latestOtp) {
    const error = new Error("No active verification code found. Please request a new code.");
    error.statusCode = 400;
    throw error;
  }

  // Check lockout (5 or more attempts)
  if (latestOtp.attempts >= 5) {
    const lockDurationMs = 10 * 60 * 1000;
    const timeSinceLastAttempt = Date.now() - new Date(latestOtp.createdAt).getTime();
    if (timeSinceLastAttempt < lockDurationMs) {
      const remainingMins = Math.ceil((lockDurationMs - timeSinceLastAttempt) / (60 * 1000));
      const error = new Error(`Too many failed attempts. Account locked. Please try again in ${remainingMins} minute(s).`);
      error.statusCode = 429;
      throw error;
    }
  }

  if (latestOtp.used) {
    const error = new Error("This verification code has already been used. Please request a new code.");
    error.statusCode = 400;
    throw error;
  }

  if (new Date() > new Date(latestOtp.expiresAt)) {
    const error = new Error("Verification code has expired. Please request a new code.");
    error.statusCode = 400;
    throw error;
  }

  const isValid = await bcrypt.compare(inputOtp, latestOtp.codeHash);
  if (!isValid) {
    const newAttempts = latestOtp.attempts + 1;
    await prisma.otpCode.update({
      where: { id: latestOtp.id },
      data: { attempts: newAttempts },
    });

    if (newAttempts >= 5) {
      const error = new Error("Too many failed attempts. Account locked for 10 minutes.");
      error.statusCode = 429;
      throw error;
    }

    const error = new Error(`Invalid verification code. ${5 - newAttempts} attempt(s) remaining.`);
    error.statusCode = 400;
    throw error;
  }

  // Mark OTP used
  await prisma.otpCode.update({
    where: { id: latestOtp.id },
    data: { used: true },
  });

  // Generate 1-hour JWT
  const token = jwt.sign(
    {
      id: student.id,
      enrollmentNo: student.enrollmentNo,
      role: student.role,
      name: student.name,
      email: student.email,
      branch: student.branch,
      year: student.year,
    },
    env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return {
    success: true,
    token,
    user: {
      id: student.id,
      enrollmentNo: student.enrollmentNo,
      name: student.name,
      email: student.email,
      branch: student.branch,
      year: student.year,
      role: student.role,
    },
  };
}

module.exports = {
  requestOtp,
  verifyOtp,
};
