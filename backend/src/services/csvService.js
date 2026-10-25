const { parse } = require("csv-parse/sync");
const bcrypt = require("bcryptjs");
const prisma = require("../config/db");

/**
 * Parses uploaded CSV containing name, enrollment_no, password columns.
 * Creates/updates students scoped to the given adminId.
 * Grants voter eligibility for the given election.
 *
 * CSV format:
 *   name,enrollment_no,password
 *   Rahul Sharma,23100BTCSDSI14399,123456
 */
async function importEligibilityCsv(electionId, adminId, csvBufferOrString) {
  const records = parse(csvBufferOrString, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) {
    const error = new Error("Election not found");
    error.statusCode = 404;
    throw error;
  }

  let addedCount = 0, skippedCount = 0, studentsCreated = 0, studentsUpdated = 0;
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const enrollmentNo = (
      row.enrollment_no || row.enrollmentNo || row.enrollment_number || row.enroll || ""
    ).trim().toUpperCase();

    if (!enrollmentNo) {
      errors.push(`Row ${i + 1}: Missing enrollment_no`);
      skippedCount++;
      continue;
    }

    const name = (row.name || row.student_name || row.full_name || "").trim();
    const rawPassword = (row.password || row.pass || "").trim();
    const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, 10) : null;

    let student = await prisma.student.findFirst({
      where: { enrollmentNo, adminId },
    });

    if (!student) {
      const email = (row.email || `${enrollmentNo.toLowerCase()}@campus.edu`).trim().toLowerCase();
      const studentName = name || `Student ${enrollmentNo.slice(-5)}`;
      const branch = (row.branch || (election.scope !== "ALL" ? election.scope : "GEN")).trim();
      const year = parseInt(row.year, 10) || 1;

      try {
        student = await prisma.student.create({
          data: {
            enrollmentNo,
            name: studentName,
            email,
            passwordHash,
            branch,
            year,
            role: "STUDENT",
            adminId,  // ← belongs to this admin
          },
        });
        studentsCreated++;
      } catch (createErr) {
        if (createErr.code === "P2002" && createErr.meta?.target?.includes("email")) {
          student = await prisma.student.create({
            data: {
              enrollmentNo,
              name: studentName,
              email: `${enrollmentNo.toLowerCase()}_${Date.now()}@campus.edu`,
              passwordHash,
              branch,
              year,
              role: "STUDENT",
              adminId,
            },
          });
          studentsCreated++;
        } else {
          errors.push(`Row ${i + 1}: Failed to create student — ${createErr.message}`);
          skippedCount++;
          continue;
        }
      }
    } else {
      // Update if this student belongs to this admin
      const updates = {};
      if (name && name !== student.name) updates.name = name;
      if (passwordHash) updates.passwordHash = passwordHash;
      if (Object.keys(updates).length > 0) {
        student = await prisma.student.update({ where: { id: student.id }, data: updates });
        studentsUpdated++;
      }
    }

    try {
      await prisma.voterEligibility.upsert({
        where: { electionId_studentId: { electionId: election.id, studentId: student.id } },
        update: {},
        create: { electionId: election.id, studentId: student.id, hasVoted: false },
      });
      addedCount++;
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e.message}`);
      skippedCount++;
    }
  }

  return { totalRows: records.length, addedCount, skippedCount, studentsCreated, studentsUpdated, errors };
}

module.exports = { importEligibilityCsv };
