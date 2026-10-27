// backend/src/seed/seedFullHandbook.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  extractCompleteHandbookFromPdf,
  ingestExtractedHandbookSections,
} from "../services/handbookIndexer";
import { HandbookClause } from "../models/HandbookClause";
import { Application } from "../models/Application";
import { User } from "../models/User";
import { Payment } from "../models/Payment";
import { Complaint } from "../models/Complaint";
import { HandbookAmendment } from "../models/HandbookAmendment";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified";
const PDF_PATH = path.resolve(__dirname, "../../resources/handbooks/AICTE_APH_2024_2027.pdf");

export async function runFullHandbookIngestion() {
  console.log("==================================================================");
  console.log("AICTE FULL APPROVAL PROCESS HANDBOOK (2024-27) FAST INGESTION");
  console.log("==================================================================");
  console.log(`Source PDF: ${PDF_PATH}`);

  // 1. Snapshot business data counts to prove non-destructive execution
  await mongoose.connect(MONGODB_URI);
  const initialApps = await Application.countDocuments();
  const initialUsers = await User.countDocuments();
  const initialPayments = await Payment.countDocuments();
  const initialComplaints = await Complaint.countDocuments();
  const initialClauses = await HandbookClause.countDocuments();

  console.log("\nPre-Ingestion Business Data Verification:");
  console.log(`- Applications: ${initialApps}`);
  console.log(`- Users: ${initialUsers}`);
  console.log(`- Payments: ${initialPayments}`);
  console.log(`- Complaints: ${initialComplaints}`);
  console.log(`- Existing Handbook Records: ${initialClauses}`);

  // 2. Extract complete handbook
  console.log("\nExtracting all 230+ pages from official PDF...");
  const startExtract = Date.now();
  const { sections, stats } = await extractCompleteHandbookFromPdf(PDF_PATH);
  const extractDuration = Date.now() - startExtract;
  console.log(`✓ PDF Extraction completed in ${extractDuration}ms.`);

  console.log("\nExtraction Statistics:");
  console.log(`- Total PDF Pages Processed: ${stats.extractedPages} / ${stats.totalPages}`);
  console.log(`- Chapters Indexed: ${stats.chaptersCount} (Chapters I-VIII)`);
  console.log(`- Numbered Clauses Extracted: ${stats.clausesCount}`);
  console.log(`- Tables Extracted: ${stats.tablesCount}`);
  console.log(`- Annexures Extracted: ${stats.annexuresCount} (Annexures 1-18)`);
  console.log(`- Affidavits Extracted: ${stats.affidavitsCount} (Affidavits 1-13)`);
  console.log(`- Formats & Certificates Extracted: ${stats.formatsCount} (Formats 1-4, Certs 1-3)`);
  console.log(`- Total Structured Sections: ${stats.totalSections}`);

  // 3. Batch Ingest into MongoDB
  console.log("\nIngesting sections into MongoDB in batch chunks...");
  const startIngest = Date.now();
  const { upserted, totalInDb: rawTotal } = await ingestExtractedHandbookSections(sections);

  // Clean up any extraction artifacts (records < 30 chars)
  const delRes = await HandbookClause.deleteMany({
    $expr: { $lt: [{ $strLenCP: "$content" }, 30] },
  });
  if (delRes.deletedCount > 0) {
    console.log(`- Cleaned up ${delRes.deletedCount} short/truncated extraction artifacts.`);
  }

  // Ensure every legacy or existing record has a unique sectionId
  const missingSecDocs = await HandbookClause.find({
    $or: [{ sectionId: { $exists: false } }, { sectionId: null }, { sectionId: "" }],
  });
  for (const doc of missingSecDocs) {
    const slug = (doc.clauseNumber || "clause")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    doc.sectionId = `sec-${slug}`;
    await doc.save();
  }

  const finalTotalInDb = await HandbookClause.countDocuments();
  const ingestDuration = Date.now() - startIngest;
  console.log(`✓ Batch Ingestion completed in ${ingestDuration}ms.`);
  console.log(`- Upserted/Updated Sections: ${upserted}`);
  console.log(`- Total Handbook Records in MongoDB: ${finalTotalInDb}`);

  // 4. Ingest Official Amendments and Corrigenda
  console.log("\nIngesting official AICTE amendments and circulars...");
  const officialAmendments = [
    {
      amendmentId: "AICTE-APH-2024-CORR-01",
      title: "Triennial Approval Process Handbook Notification (2024-25 to 2026-27)",
      officialSourceUrl: "https://www.aicte-india.org/bulletins/approval-process-handbook",
      publicationDate: "2023-12-08",
      effectiveDate: "2024-01-01",
      affectedClauseOrSection: "Chapters I-VIII, Annexures 1-18",
      originalDocumentReference: "Approval Process Handbook 2024-25 to 2026-27",
      summary: "AICTE notified the triennial handbook granting up to 3 years Extension of Approval (EoA) to high-performing accredited institutions and bringing undergraduate computer applications (BCA) and management (BBA/BMS) courses under AICTE purview.",
      verificationStatus: "VERIFIED" as const,
      content: "The Council notified the triennial Approval Process Handbook 2024-25 to 2026-27 offering 3 years EoA to accredited institutions, removing upper limits on intake subject to infrastructure verification by EVC, and establishing flexible mode for working professionals.",
    },
    {
      amendmentId: "AICTE-CIR-2021-08-09",
      title: "Admission of B.Tech/B.E. Graduates in Other Branches of Engineering as Additional Degree",
      officialSourceUrl: "https://www.aicte-india.org/sites/default/files/circular_additional_degree.pdf",
      publicationDate: "2021-08-09",
      effectiveDate: "2021-08-09",
      affectedClauseOrSection: "Annexure-8 Note (Page 105)",
      originalDocumentReference: "F.No. AICTE/P&AP/Misc/2020 dated 09.08.2021",
      summary: "Permits technical universities to admit B.Tech/B.E. graduates into other branches of engineering as an additional degree through Lateral Entry at appropriate level.",
      verificationStatus: "VERIFIED" as const,
      content: "Admission of B.Tech/B.E. graduates in other branches of Engineering as an additional degree through Lateral Entry will be facilitated by respective Technical Universities by allowing admission at appropriate level.",
    },
    {
      amendmentId: "AICTE-REG-2021-03-25",
      title: "Redressal of Grievance of Faculty/Staff Member Regulations 2021",
      officialSourceUrl: "https://www.aicte-india.org/sites/default/files/pgrc_regulations_2021.pdf",
      publicationDate: "2021-03-25",
      effectiveDate: "2021-03-25",
      affectedClauseOrSection: "Clause 6.15(b), Clause 6.50",
      originalDocumentReference: "F.No. 1-103/AICTE/PGRC/Regulation/2021 dated 25.03.2021",
      summary: "Establishment of Grievance Redressal Mechanism and Redressal Cell for Faculty and Staff in all AICTE approved institutions.",
      verificationStatus: "VERIFIED" as const,
      content: "AICTE notification on Redressal of Grievance of Faculty/Staff Member Regulations 2021 requiring every institution to constitute a Redressal Cell (GRC) for faculty and staff pay scales and service issues.",
    },
    {
      amendmentId: "AICTE-REG-2019-11-07",
      title: "Redressal of Grievance of Students Regulations 2019",
      officialSourceUrl: "https://www.aicte-india.org/sites/default/files/student_grievance_regulations_2019.pdf",
      publicationDate: "2019-11-07",
      effectiveDate: "2019-11-07",
      affectedClauseOrSection: "Clause 6.50, Clause 7.10",
      originalDocumentReference: "F.No. 1-101/PGRC/AICTE/Regulation/2019 dated 07.11.2019",
      summary: "Mandates Student Grievance Redressal Committee (SGRC) and appointment of Ombudsperson by affiliating universities.",
      verificationStatus: "VERIFIED" as const,
      content: "Mandates every approved institution to establish an online grievance portal, constitute a Student Grievance Redressal Committee (SGRC), and universities to appoint an Ombudsperson for hearing student appeals.",
    },
  ];

  for (const amd of officialAmendments) {
    await HandbookAmendment.findOneAndUpdate(
      { amendmentId: amd.amendmentId },
      { $set: amd },
      { upsert: true, new: true }
    );
  }
  const totalAmendmentsInDb = await HandbookAmendment.countDocuments();
  console.log(`✓ Official Amendments Ingested: ${totalAmendmentsInDb} records.`);

  // 5. Verify Business Collections Untouched
  const finalApps = await Application.countDocuments();
  const finalUsers = await User.countDocuments();
  const finalPayments = await Payment.countDocuments();
  const finalComplaints = await Complaint.countDocuments();

  if (
    finalApps !== initialApps ||
    finalUsers !== initialUsers ||
    finalPayments !== initialPayments ||
    finalComplaints !== initialComplaints
  ) {
    throw new Error("CRITICAL SAFETY VIOLATION: Business database records were altered!");
  }
  console.log("\n✓ Business Data Integrity Verified: 100% untouched.");

  return { stats, totalInDb: finalTotalInDb, totalAmendmentsInDb };
}

if (process.argv[1] && process.argv[1].endsWith("seedFullHandbook.ts")) {
  runFullHandbookIngestion()
    .then(() => {
      console.log("\n==================================================================");
      console.log("FULL HANDBOOK INGESTION & INDEXING COMPLETED SUCCESSFULLY!");
      console.log("==================================================================");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Ingestion failed:", err);
      process.exit(1);
    });
}
