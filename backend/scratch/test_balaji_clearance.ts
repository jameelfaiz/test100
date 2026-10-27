// scratch/test_balaji_clearance.ts
import mongoose from "mongoose";
import { ReleaseRequest } from "../src/models/ReleaseRequest";
import {
  calculatePgrcClearance,
  calculateVigilanceClearance,
  calculateOverallReleaseDecision,
  resolveInstitutionIdentifiers,
} from "../src/services/clearanceService";

async function test() {
  await mongoose.connect("mongodb://127.0.0.1:27017/aicte_unified");

  const rr = await ReleaseRequest.findOne({ collegeId: /balaji/i });
  console.log("=== BALAJI RELEASE REQUEST FOUND ===");
  console.log({
    id: rr?._id,
    collegeId: rr?.collegeId,
    institutionId: rr?.institutionId,
    documents: rr?.documents,
  });

  const identifiers = await resolveInstitutionIdentifiers(rr);
  console.log("\n=== RESOLVED IDENTIFIERS ===");
  console.log(identifiers);

  const pgrc = await calculatePgrcClearance(rr);
  console.log("\n=== PGRC CLEARANCE RESULT ===");
  console.log(pgrc);

  const vig = await calculateVigilanceClearance(rr);
  console.log("\n=== VIGILANCE CLEARANCE RESULT ===");
  console.log(vig);

  const defaultNames = ["EoA", "Affidavit", "Release Approval Letter", "FDR Copy"];
  const docs = defaultNames.map((name, idx) => ({
    id: `doc-${idx + 1}`,
    name,
    status: "Verified",
  }));

  const decision = calculateOverallReleaseDecision(
    docs,
    pgrc.status,
    vig.status,
    pgrc.reason,
    vig.reason
  );
  console.log("\n=== OVERALL DECISION WITH ALL DOCS VERIFIED ===");
  console.log(decision);

  await mongoose.disconnect();
}

test();
