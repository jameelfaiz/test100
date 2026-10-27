// scratch/inspect_balaji.ts
import mongoose from "mongoose";
import { Complaint } from "../src/models/Complaint";
import { Investigation } from "../src/models/Investigation";
import { Institution } from "../src/models/Institution";
import { ReleaseRequest } from "../src/models/ReleaseRequest";

async function check() {
  await mongoose.connect("mongodb://127.0.0.1:27017/aicte_unified");
  
  console.log("=== INSTITUTIONS ===");
  const insts = await Institution.find().lean();
  console.log(insts.map((i: any) => ({ _id: i._id, name: i.name, collegeId: i.collegeId, code: i.code })));

  console.log("\n=== COMPLAINTS ===");
  const comps = await Complaint.find().lean();
  console.log(comps.map((c: any) => ({
    _id: c._id,
    collegeId: c.collegeId,
    collegeName: c.collegeName,
    institutionId: c.institutionId,
    status: c.status,
    finalOutcome: c.finalOutcome,
    assignedDepartment: c.assignedDepartment,
    escalatedToVigilance: c.escalatedToVigilance,
  })));

  console.log("\n=== INVESTIGATIONS ===");
  const invs = await Investigation.find().lean();
  console.log(invs.map((i: any) => ({
    _id: i._id,
    investigationId: i.investigationId,
    collegeId: i.collegeId,
    collegeName: i.collegeName,
    institutionId: i.institutionId,
    complaintId: i.complaintId,
    status: i.status,
    finalOutcome: i.finalOutcome,
    supervisorDecision: i.supervisorDecision,
  })));

  console.log("\n=== RELEASE REQUESTS ===");
  const rrs = await ReleaseRequest.find().lean();
  console.log(rrs.map((r: any) => ({
    _id: r._id,
    requestId: r.requestId,
    collegeId: r.collegeId,
    collegeName: r.collegeName,
    institutionId: r.institutionId,
    status: r.status,
    documents: r.documents,
    pgrcClearance: r.pgrcClearance,
    vigilanceClearance: r.vigilanceClearance,
    overallDecision: r.overallDecision,
  })));

  await mongoose.disconnect();
}

check();
