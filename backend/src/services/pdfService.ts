// backend/src/services/pdfService.ts
import PDFDocument from "pdfkit";
import { IApplication } from "../models/Application";
import { IInstitution } from "../models/Institution";

export interface GeneratePdfOptions {
  application: IApplication;
  institution?: IInstitution | null;
  letterTitle?: string;
}

/**
 * Generates an official AICTE decision letter (EoA, LoA, EoD, LoD) as a binary PDF Buffer.
 * Preserves the exact letter text content and formats it into an official A4 document.
 */
export function generateApprovalLetterPdf(options: GeneratePdfOptions): Promise<Buffer> {
  const { application: app, institution: inst, letterTitle } = options;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        info: {
          Title: `${letterTitle || app.result || "Approval"} Letter - ${app.applicationId}`,
          Author: "All India Council for Technical Education (AICTE)",
          Subject: `Official ${app.result || "EoA"} Letter for Application ${app.applicationId}`,
          Keywords: "AICTE, EoA, LoA, Approval Letter, Technical Education",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));

      const isDeficiency = app.result === "LoD" || app.result === "EoD";
      const primaryColor = isDeficiency ? "#92400e" : "#1e3a8a"; // Amber for deficiency, Navy for approval
      const bannerBg = isDeficiency ? "#fef3c7" : "#e0e7ff";
      const bannerText = isDeficiency ? "#78350f" : "#1e1b4b";

      // 1. Council Header
      doc.fontSize(15).font("Helvetica-Bold").fillColor(primaryColor).text(
        "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION",
        { align: "center", characterSpacing: 0.5 }
      );
      doc.fontSize(9).font("Helvetica").fillColor("#4b5563").text(
        "(A STATUTORY BODY OF THE GOVERNMENT OF INDIA)",
        { align: "center" }
      );
      doc.fontSize(8.5).text(
        "Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070 | Website: www.aicte-india.org",
        { align: "center" }
      );
      doc.moveDown(0.6);

      // Decorative divider
      const y = doc.y;
      doc.strokeColor(primaryColor).lineWidth(1.5).moveTo(50, y).lineTo(545, y).stroke();
      doc.moveDown(0.8);

      // 2. Letter Title & Notification Banner
      const displayType =
        letterTitle ||
        (app.result === "LoA"
          ? "LETTER OF APPROVAL (LoA)"
          : app.result === "EoA"
          ? "EXTENSION OF APPROVAL (EoA)"
          : app.result === "LoD"
          ? "LETTER OF DEFICIENCY (LoD)"
          : "EXTENSION DEFICIENCY NOTICE (EoD)");

      doc.fontSize(12).font("Helvetica-Bold").fillColor(primaryColor).text(
        displayType,
        { align: "center" }
      );
      doc.fontSize(8).font("Helvetica-Bold").fillColor(bannerText).text(
        "[OFFICIAL AICTE REGULATORY ISSUANCE — FINANCE DIVISION & APPROVAL BUREAU]",
        { align: "center" }
      );
      doc.moveDown(1);

      // 3. Official Letter Content
      const rawText = app.letterText && app.letterText.trim()
        ? app.letterText
        : generateDefaultLetterText(app, inst);

      // Clean out ASCII decorative separator lines for neat PDF rendering
      const cleanedLines = rawText
        .split("\n")
        .filter(line => !line.trim().startsWith("========") && !line.trim().startsWith("----------------"));

      const cleanedContent = cleanedLines.join("\n").trim();

      doc.fontSize(9.5).font("Courier").fillColor("#111827").text(cleanedContent, {
        align: "left",
        lineGap: 2.5,
      });

      doc.moveDown(1.5);

      // 4. Footer Note
      const bottomY = doc.page.height - 50;
      doc.fontSize(7.5).font("Helvetica-Oblique").fillColor("#6b7280").text(
        `Document Reference: ${app.letterReferenceNumber || app.applicationId} | Verified via AICTE Unified Digital Registry`,
        50,
        bottomY,
        { align: "center", width: 495 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function generateDefaultLetterText(app: IApplication, inst?: IInstitution | null): string {
  const isEoA = app.result === "EoA" || (!app.result && app.applicationType === "EOA");
  const letterTitle = isEoA ? "EXTENSION OF APPROVAL (EoA)" : "LETTER OF APPROVAL (LoA)";
  const ref = app.letterReferenceNumber || `AICTE/AB/2026-27/${app.collegeId}/${app.applicationId}`;
  const dateStr = app.letterSentDate
    ? new Date(app.letterSentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  return `Letter Ref. No.: ${ref}
Date of Issue: ${dateStr}

To,
The Principal / Director,
${inst?.name || app.collegeId},
College ID: ${app.collegeId}
Address: ${inst?.address || "Registered Address"}, ${inst?.state || ""}

Subject: Grant of ${letterTitle} for Academic Year 2026-2027

Sir / Madam,

In terms of the provisions under the All India Council for Technical Education (Grant of Approvals for Technical Institutions) Regulations, and based on the comprehensive verification of all mandatory documents submitted by the institution, I am directed to convey the official approval of the Council to:

  • Institution Name    : ${inst?.name || app.collegeId}
  • Permanent ID        : ${app.collegeId}
  • Application ID      : ${app.applicationId}
  • Category / Title    : ${app.title || "Technical Education"}
  • Programme           : ${app.programme || "Engineering and Technology"}
  • Approved Intake     : ${app.intake || 60} Seats
  • Academic Year       : 2026-2027

TERMS AND CONDITIONS OF APPROVAL:
1. The institution shall strictly adhere to the norms and standards prescribed by AICTE from time to time.
2. The approval is subject to condition that the institution shall maintain mandatory Joint Fixed Deposit Receipt (FDR) / Endowment deposits as specified by the Finance Division.
3. The Finance Division will issue specific Deposit Instructions detailing required deposit amount and bank account details.
4. No excess admission shall be made by the institution over and above the approved intake under any circumstances.
5. In case of any violation, AICTE reserves the right to withdraw the approval as per regulations.

Yours faithfully,
Competent Authority / Section Officer
Finance Division (FD) & Approval Bureau
All India Council for Technical Education`;
}
