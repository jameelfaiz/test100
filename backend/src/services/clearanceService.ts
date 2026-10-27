// src/services/clearanceService.ts
import mongoose from "mongoose";
import { Institution } from "../models/Institution";
import { Complaint } from "../models/Complaint";
import { Investigation } from "../models/Investigation";

export interface ClearanceResult {
  status: "APPROVED" | "REJECTED" | "MATURITY DATE EXTENDED" | "ERROR";
  reason: string;
  department: "PGRC" | "Vigilance";
  count: number;
  calculatedAt: Date;
  details?: any[];
}

export interface OverallDecisionResult {
  overallStatus: "DOCUMENT_DEFICIENCY" | "REJECTED" | "MATURITY_EXTENDED" | "ELIGIBLE_FOR_APPROVAL";
  message: string;
  isEligibleForApproval: boolean;
  documentsVerified: boolean;
  pgrcApproved: boolean;
  vigilanceApproved: boolean;
  responsibleDepartment?: string;
  blockingReason?: string;
}

export interface ResolvedInstitutionIdentifiers {
  institutionDoc?: any;
  institutionIds: string[];
  collegeCodes: string[];
  exactNames: string[];
}

/**
 * Normalizes an institution name by trimming and collapsing multiple spaces.
 */
export function normalizeInstitutionName(name: string): string {
  return (name || "").trim().replace(/\s+/g, " ");
}

/**
 * Escapes regex special characters.
 */
export function escapeRegex(str: string): string {
  return (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolves institution identifiers using:
 * 1. Stable institution database ID / college code (preferred)
 * 2. Normalized exact-name matching as validated fallback (prevents partial-name false matches)
 */
export async function resolveInstitutionIdentifiers(
  targetOrCollegeId: any,
  institutionId?: string
): Promise<ResolvedInstitutionIdentifiers> {
  let targetCollegeId = "";
  let targetInstitutionId = institutionId || "";
  let targetCollegeName = "";

  if (typeof targetOrCollegeId === "object" && targetOrCollegeId !== null) {
    targetCollegeId = targetOrCollegeId.collegeId || "";
    targetInstitutionId = targetOrCollegeId.institutionId || targetInstitutionId;
    targetCollegeName = targetOrCollegeId.collegeName || targetOrCollegeId.name || "";
  } else if (typeof targetOrCollegeId === "string") {
    targetCollegeId = targetOrCollegeId;
  }

  let institutionDoc: any = null;

  // 1. Prefer stable institution database ID
  if (targetInstitutionId && mongoose.Types.ObjectId.isValid(targetInstitutionId)) {
    try {
      institutionDoc = await Institution.findById(targetInstitutionId).lean();
    } catch {
      // ignore invalid id
    }
  }

  // If not found yet and collegeId is an ObjectId
  if (!institutionDoc && targetCollegeId && mongoose.Types.ObjectId.isValid(targetCollegeId)) {
    try {
      institutionDoc = await Institution.findById(targetCollegeId).lean();
    } catch {
      // ignore
    }
  }

  // 2. Try college code (e.g. CLG-2026-000015)
  if (!institutionDoc && targetCollegeId) {
    institutionDoc = await Institution.findOne({ collegeId: targetCollegeId }).lean();
  }

  // 3. Normalized exact-name matching as validated fallback
  // Uses exact anchors (^ and $) so "Balaji" will NEVER falsely match "Balaji College" or "Balaji Institute"
  if (!institutionDoc) {
    const candidateNames = [targetCollegeName, targetCollegeId].filter(
      (n) => typeof n === "string" && n.trim().length > 0 && !mongoose.Types.ObjectId.isValid(n)
    );

    for (const rawName of candidateNames) {
      const norm = normalizeInstitutionName(rawName);
      if (!norm) continue;
      const escaped = escapeRegex(norm);
      institutionDoc = await Institution.findOne({
        name: new RegExp(`^\\s*${escaped}\\s*$`, "i"),
      }).lean();
      if (institutionDoc) break;
    }
  }

  const institutionIds: Set<string> = new Set();
  const collegeCodes: Set<string> = new Set();
  const exactNames: Set<string> = new Set();

  if (institutionDoc) {
    if (institutionDoc._id) institutionIds.add(institutionDoc._id.toString());
    if (institutionDoc.collegeId) collegeCodes.add(institutionDoc.collegeId);
    if (institutionDoc.name) exactNames.add(normalizeInstitutionName(institutionDoc.name));
  }

  if (targetInstitutionId) institutionIds.add(targetInstitutionId);
  if (targetCollegeId) {
    if (targetCollegeId.startsWith("CLG-") || /^\d+$/.test(targetCollegeId)) {
      collegeCodes.add(targetCollegeId);
    } else {
      exactNames.add(normalizeInstitutionName(targetCollegeId));
    }
  }
  if (targetCollegeName) {
    exactNames.add(normalizeInstitutionName(targetCollegeName));
  }

  return {
    institutionDoc,
    institutionIds: Array.from(institutionIds),
    collegeCodes: Array.from(collegeCodes),
    exactNames: Array.from(exactNames),
  };
}

/**
 * Builds MongoDB $or query conditions from resolved identifiers.
 */
function buildInstitutionQuery(identifiers: ResolvedInstitutionIdentifiers): any[] {
  const orConditions: any[] = [];

  for (const id of identifiers.institutionIds) {
    orConditions.push({ institutionId: id });
    if (mongoose.Types.ObjectId.isValid(id)) {
      orConditions.push({ institutionId: new mongoose.Types.ObjectId(id) });
    }
  }

  for (const code of identifiers.collegeCodes) {
    orConditions.push({ collegeId: code });
  }

  for (const name of identifiers.exactNames) {
    const escaped = escapeRegex(name);
    const exactRegex = new RegExp(`^\\s*${escaped}\\s*$`, "i");
    orConditions.push({ collegeName: exactRegex });
    orConditions.push({ institutionNameSnapshot: exactRegex });
    orConditions.push({ collegeId: exactRegex });
  }

  return orConditions.length > 0 ? orConditions : [{ collegeId: "__NO_MATCH_SAFETY_ID__" }];
}

/**
 * Checks if a complaint or investigation record is PROVEN.
 */
function isRecordProven(record: any): boolean {
  if (!record) return false;
  const status = (record.status || "").toUpperCase();
  const outcome = (record.finalOutcome || "").toUpperCase();
  const supervisor = (record.supervisorDecision || "").toUpperCase();
  return outcome === "PROVEN" || status === "PROVEN" || supervisor === "PROVEN";
}

/**
 * Checks if a complaint or investigation record is conclusively UNPROVEN.
 * NOTE: Unknown or missing statuses must NEVER be treated as Unproven.
 */
function isRecordConclusivelyUnproven(record: any): boolean {
  if (!record) return false;
  if (isRecordProven(record)) return false;

  const status = (record.status || "").toUpperCase();
  const outcome = (record.finalOutcome || "").toUpperCase();
  const supervisor = (record.supervisorDecision || "").toUpperCase();

  const unprovenOutcomes = ["NOT_PROVEN", "UNPROVEN", "UNSUBSTANTIATED"];

  if (unprovenOutcomes.includes(outcome)) return true;
  if (unprovenOutcomes.includes(status)) return true;
  if (unprovenOutcomes.includes(supervisor)) return true;

  if (status === "RESOLVED" || status === "COMPLETED") {
    if (unprovenOutcomes.includes(outcome) || unprovenOutcomes.includes(supervisor)) {
      return true;
    }
  }

  // Any other status (PENDING, ON_PROCESS, OPEN, IN_PROGRESS, empty, unknown) is NOT unproven
  return false;
}

/**
 * Calculates PGRC clearance for an institution based on real MongoDB complaints.
 * 
 * Rules:
 * - PROVEN: Any matching Proven record -> REJECTED ("Proven Complaint")
 * - INVESTIGATION: Any matching unresolved investigation -> MATURITY DATE EXTENDED ("Complaint Investigation in Progress")
 * - UNPROVEN: All matching records conclusively Unproven, with no Proven or pending records -> APPROVED ("Complaint Not Proven")
 * - NO MATCH: No matching records -> APPROVED ("No Complaints Found")
 * - Priority: PROVEN > MATURITY DATE EXTENDED > APPROVED
 */
export async function calculatePgrcClearance(
  targetOrCollegeId: any,
  institutionId?: string
): Promise<ClearanceResult> {
  const identifiers = await resolveInstitutionIdentifiers(targetOrCollegeId, institutionId);
  const queryConditions = buildInstitutionQuery(identifiers);

  const allComplaints = await Complaint.find({ $or: queryConditions }).lean();
  const calculatedAt = new Date();

  // PGRC department complaints:
  // Complaints where assignedDepartment === 'PGRC', or category is PGRC, or neither assigned to Vigilance nor escalated to Vigilance
  const pgrcComplaints = (allComplaints || []).filter(
    (c: any) =>
      !c.escalatedToVigilance &&
      c.assignedDepartment !== "VIGILANCE" &&
      c.category !== "VIGILANCE"
  );

  // NO MATCH
  if (pgrcComplaints.length === 0) {
    return {
      status: "APPROVED",
      reason: "No Complaints Found",
      department: "PGRC",
      count: 0,
      calculatedAt,
    };
  }

  // 1. PROVEN Priority: Any matching Proven record -> REJECTED
  const provenComplaints = pgrcComplaints.filter(isRecordProven);
  if (provenComplaints.length > 0) {
    return {
      status: "REJECTED",
      reason: "Proven Complaint",
      department: "PGRC",
      count: pgrcComplaints.length,
      calculatedAt,
      details: provenComplaints.map((c: any) => ({
        id: c._id,
        ref: c.complaintReference,
        status: c.status,
        finalOutcome: c.finalOutcome,
      })),
    };
  }

  // 2. INVESTIGATION Priority: Any unresolved investigation (or missing/unknown status) -> MATURITY DATE EXTENDED
  const pendingComplaints = pgrcComplaints.filter((c: any) => !isRecordConclusivelyUnproven(c));
  if (pendingComplaints.length > 0) {
    return {
      status: "MATURITY DATE EXTENDED",
      reason: "Complaint Investigation in Progress",
      department: "PGRC",
      count: pgrcComplaints.length,
      calculatedAt,
      details: pendingComplaints.map((c: any) => ({
        id: c._id,
        ref: c.complaintReference,
        status: c.status,
        finalOutcome: c.finalOutcome,
      })),
    };
  }

  // 3. UNPROVEN: All matching records are conclusively Unproven -> APPROVED
  return {
    status: "APPROVED",
    reason: "Complaint Not Proven",
    department: "PGRC",
    count: pgrcComplaints.length,
    calculatedAt,
  };
}

/**
 * Calculates Vigilance clearance independently for an institution based on real MongoDB investigations.
 * 
 * Rules:
 * - PROVEN: Any matching Proven record -> REJECTED ("Proven Investigation")
 * - INVESTIGATION: Any matching unresolved investigation -> MATURITY DATE EXTENDED ("Investigation in Progress")
 * - UNPROVEN: All matching records conclusively Unproven, with no Proven or pending records -> APPROVED ("Investigation Not Proven")
 * - NO MATCH: No matching records -> APPROVED ("No Investigations Found")
 * - Priority: PROVEN > MATURITY DATE EXTENDED > APPROVED
 */
export async function calculateVigilanceClearance(
  targetOrCollegeId: any,
  institutionId?: string
): Promise<ClearanceResult> {
  const identifiers = await resolveInstitutionIdentifiers(targetOrCollegeId, institutionId);
  const institutionConditions = buildInstitutionQuery(identifiers);

  // 1. Find all complaints related to this institution (including Vigilance-assigned or escalated)
  const relatedComplaints = await Complaint.find({ $or: institutionConditions }).lean();
  const complaintIds = relatedComplaints.map((c: any) => c._id);

  // 2. Query investigations matching either institution identifiers OR linked complaints
  const invConditions: any[] = [...institutionConditions];
  if (complaintIds.length > 0) {
    invConditions.push({ complaintId: { $in: complaintIds } });
  }

  const investigations = await Investigation.find({ $or: invConditions }).lean();

  // 3. Also include Vigilance complaints directly (whether or not a separate Investigation doc exists)
  const directVigilanceComplaints = relatedComplaints.filter(
    (c: any) =>
      c.assignedDepartment === "VIGILANCE" ||
      c.category === "VIGILANCE" ||
      c.escalatedToVigilance === true
  );

  // Combine vigilance records, avoiding duplicate counts if an investigation references a complaint
  const linkedComplaintIdSet = new Set(
    investigations.map((inv: any) => inv.complaintId?.toString()).filter(Boolean)
  );
  const standaloneVigComplaints = directVigilanceComplaints.filter(
    (c: any) => !linkedComplaintIdSet.has(c._id.toString())
  );

  const totalVigilanceRecords = [...investigations, ...standaloneVigComplaints];
  const calculatedAt = new Date();

  // NO MATCH
  if (totalVigilanceRecords.length === 0) {
    return {
      status: "APPROVED",
      reason: "No Investigations Found",
      department: "Vigilance",
      count: 0,
      calculatedAt,
    };
  }

  // 1. PROVEN Priority: Any matching Proven record -> REJECTED
  const provenRecords = totalVigilanceRecords.filter(isRecordProven);
  if (provenRecords.length > 0) {
    return {
      status: "REJECTED",
      reason: "Proven Investigation",
      department: "Vigilance",
      count: totalVigilanceRecords.length,
      calculatedAt,
      details: provenRecords.map((r: any) => ({
        id: r._id,
        investigationId: r.investigationId,
        status: r.status,
        finalOutcome: r.finalOutcome,
      })),
    };
  }

  // 2. INVESTIGATION Priority: Any unresolved investigation (or missing/unknown status) -> MATURITY DATE EXTENDED
  const pendingRecords = totalVigilanceRecords.filter((r: any) => !isRecordConclusivelyUnproven(r));
  if (pendingRecords.length > 0) {
    return {
      status: "MATURITY DATE EXTENDED",
      reason: "Investigation in Progress",
      department: "Vigilance",
      count: totalVigilanceRecords.length,
      calculatedAt,
      details: pendingRecords.map((r: any) => ({
        id: r._id,
        investigationId: r.investigationId,
        status: r.status,
      })),
    };
  }

  // 3. UNPROVEN: All matching records are conclusively Unproven -> APPROVED
  return {
    status: "APPROVED",
    reason: "Investigation Not Proven",
    department: "Vigilance",
    count: totalVigilanceRecords.length,
    calculatedAt,
  };
}

/**
 * Calculates overall release decision based on all 4 required document verifications
 * plus both department clearances (Part 6.4):
 * - Any document pending -> release blocked
 * - Either department REJECTED -> release blocked (shows responsible department & reason)
 * - Either department MATURITY DATE EXTENDED -> release blocked (shows investigation-pending reason)
 * - Release permitted only when all 4 documents are VERIFIED and both departments are APPROVED
 * - Never let one department's APPROVED status override the other department's rejection or pending investigation
 */
export function calculateOverallReleaseDecision(
  documents: any[],
  pgrcStatus: string,
  vigilanceStatus: string,
  pgrcReason?: string,
  vigilanceReason?: string
): OverallDecisionResult {
  const docs = Array.isArray(documents) ? documents : [];
  const requiredDocCount = 4;
  const verifiedDocCount = docs.filter(
    (d: any) => d && (d.status === "Verified" || d.status === "VERIFIED")
  ).length;
  const allDocsVerified = docs.length >= requiredDocCount && verifiedDocCount >= requiredDocCount;

  const isPgrcApproved = pgrcStatus === "APPROVED";
  const isVigilanceApproved = vigilanceStatus === "APPROVED";

  const isPgrcRejected = pgrcStatus === "REJECTED";
  const isVigilanceRejected = vigilanceStatus === "REJECTED";

  const isPgrcPending =
    pgrcStatus === "MATURITY DATE EXTENDED" ||
    pgrcStatus === "MATURITY EXTENDED" ||
    (!isPgrcApproved && !isPgrcRejected);
  const isVigilancePending =
    vigilanceStatus === "MATURITY DATE EXTENDED" ||
    vigilanceStatus === "MATURITY EXTENDED" ||
    (!isVigilanceApproved && !isVigilanceRejected);

  // 1. REJECTED: Either department REJECTED -> release blocked; show responsible department and reason
  if (isPgrcRejected || isVigilanceRejected) {
    let responsibleDepartment = "";
    let blockingReason = "";

    if (isPgrcRejected && isVigilanceRejected) {
      responsibleDepartment = "PGRC & Vigilance";
      blockingReason = `PGRC: ${pgrcReason || "Proven Complaint"}; Vigilance: ${vigilanceReason || "Proven Investigation"}`;
    } else if (isPgrcRejected) {
      responsibleDepartment = "PGRC";
      blockingReason = pgrcReason || "Proven Complaint";
    } else {
      responsibleDepartment = "Vigilance";
      blockingReason = vigilanceReason || "Proven Investigation";
    }

    return {
      overallStatus: "REJECTED",
      message: `Release blocked: ${responsibleDepartment} clearance rejected (${blockingReason}).`,
      isEligibleForApproval: false,
      documentsVerified: allDocsVerified,
      pgrcApproved: isPgrcApproved,
      vigilanceApproved: isVigilanceApproved,
      responsibleDepartment,
      blockingReason,
    };
  }

  // 2. MATURITY DATE EXTENDED: Either department pending -> release blocked; show investigation-pending reason
  if (isPgrcPending || isVigilancePending) {
    let responsibleDepartment = "";
    let blockingReason = "";

    if (isPgrcPending && isVigilancePending) {
      responsibleDepartment = "PGRC & Vigilance";
      blockingReason = "Investigations pending in both departments";
    } else if (isPgrcPending) {
      responsibleDepartment = "PGRC";
      blockingReason = pgrcReason || "Complaint Investigation in Progress";
    } else {
      responsibleDepartment = "Vigilance";
      blockingReason = vigilanceReason || "Investigation in Progress";
    }

    return {
      overallStatus: "MATURITY_EXTENDED",
      message: `Release blocked: ${responsibleDepartment} investigation pending (${blockingReason}).`,
      isEligibleForApproval: false,
      documentsVerified: allDocsVerified,
      pgrcApproved: isPgrcApproved,
      vigilanceApproved: isVigilanceApproved,
      responsibleDepartment,
      blockingReason,
    };
  }

  // 3. DOCUMENT DEFICIENCY: Any document pending -> release blocked
  if (!allDocsVerified) {
    return {
      overallStatus: "DOCUMENT_DEFICIENCY",
      message: `Release blocked: Required documents pending verification (${verifiedDocCount}/${requiredDocCount} verified). All 4 mandatory documents must be verified.`,
      isEligibleForApproval: false,
      documentsVerified: false,
      pgrcApproved: isPgrcApproved,
      vigilanceApproved: isVigilanceApproved,
      blockingReason: "Document verification incomplete",
    };
  }

  // 4. Release permitted only when all 4 documents are VERIFIED and both departments are APPROVED
  return {
    overallStatus: "ELIGIBLE_FOR_APPROVAL",
    message: "Release permitted: All 4 documents verified and both department clearances approved.",
    isEligibleForApproval: true,
    documentsVerified: true,
    pgrcApproved: true,
    vigilanceApproved: true,
  };
}
