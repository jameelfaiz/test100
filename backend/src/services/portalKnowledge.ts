// src/services/portalKnowledge.ts
/**
 * AICTE Unified Portal - Verified Procedural & Regulatory Knowledge Layer
 * 
 * Provides single source of truth for:
 * 1. Portal navigation routes, role permissions, and workflow states
 * 2. FDR security deposit maturity, release requests, clearances, and forfeiture rules
 * 3. LoD / EoD (Deficiency Notices) vs LoA / EoA (Approval Letters)
 * 4. Document uploads, deficiencies, and compliance re-submissions
 * 5. Complaint, PGRC, and Vigilance clearance logic
 */

export interface PortalRouteInfo {
  path: string;
  title: string;
  role: string;
  description: string;
}

export const PORTAL_ROUTES: Record<string, PortalRouteInfo> = {
  approvalSeeking: {
    path: "/institution/submit/approval",
    title: "Approval Seeking (12 Mandatory Documents)",
    role: "INSTITUTION",
    description: "Upload statutory documents for LoA or EoA (Clause 6.1, Annexure-1, Appendix 11).",
  },
  paymentFdr: {
    path: "/institution/submit/payment",
    title: "Payment / FDR Submission",
    role: "INSTITUTION",
    description: "Submit Joint Fixed Deposit Receipt details and bank lien document (Clause 1.12, Table 1.4).",
  },
  releaseRequest: {
    path: "/institution/submit/release",
    title: "Release Application",
    role: "INSTITUTION",
    description: "Submit matured FDR release request with Affidavit 6, EoA, and bank documents.",
  },
  receiveLoaEoa: {
    path: "/institution/receive/loa-eoa",
    title: "LoA / EoA Letters",
    role: "INSTITUTION",
    description: "Download official Letter of Approval (LoA) or Extension of Approval (EoA).",
  },
  receiveLodEod: {
    path: "/institution/receive/lod-eod",
    title: "LoD / EoD Letters",
    role: "INSTITUTION",
    description: "View Letter of Deficiency (LoD) or Extension of Deficiency (EoD) notices issued by AICTE FD.",
  },
  receiveDeposit: {
    path: "/institution/receive/deposit",
    title: "Deposit Details",
    role: "INSTITUTION",
    description: "View verified joint deposit details, lien status, and maturity timeline.",
  },
  receiveComplaints: {
    path: "/institution/receive/complaint-letters",
    title: "Complaint Outcome Letters",
    role: "INSTITUTION",
    description: "View grievance and vigilance complaint outcomes and verification remarks.",
  },
};

/**
 * Explains FDR maturity, release eligibility, clearance verification, and withholding vs forfeiture.
 * Strictly adheres to verified AICTE handbook clauses and clearance service logic.
 */
export function getFdrMaturityAndRefundExplanation(portalContext?: any): {
  explanation: string;
  supportingClauses: string[];
} {
  const explanation =
    `Here is the verified AICTE regulatory and portal procedure regarding **matured FDR / security deposit return**:\n\n` +
    `### 1. FDR Maturity vs. Automatic Return:\n` +
    `- **Completion of Maturity Term:** Under **Clause 1.12** and **Table 1.4**, an institution's security deposit is established for a mandatory lock-in period of **8 to 10 years** in the joint name of the institution and the **Regional Officer, AICTE**.\n` +
    `- **No Automatic Payout:** Reaching the maturity date alone does **NOT** trigger an automatic transfer of funds back into the college account. The institution must initiate a formal **Release Request**.\n\n` +
    `### 2. Eligibility for Release (Affidavit 6 & Clause 6.46):\n` +
    `To be eligible for deposit release, the institution must submit an official application under **Submit → Release Application** (\`/institution/submit/release\`) confirming:\n` +
    `- That the institution has completed its prescribed 8/10-year lock-in period.\n` +
    `- That all conditions of the Letter of Approval (LoA) have been fulfilled.\n` +
    `- That the institution operates from its approved permanent site (not a temporary location).\n` +
    `- That the institution is NOT placed under the "No Admission Category".\n` +
    `- That no inquiry, cognizable legal action, or fee refund complaints (**Clause 6.45**) are pending against the institution.\n\n` +
    `### 3. Mandatory Document & Clearance Verification in the Portal:\n` +
    `Before release can be approved, the AICTE Finance Division (FD) verifies:\n` +
    `1. **All 4 Mandatory Documents Must Be "Verified":**\n` +
    `   - Extension of Approval (EoA)\n` +
    `   - Joint Undertaking Affidavit (**Affidavit 6** sworn before a Judicial Magistrate or Notary)\n` +
    `   - Release Approval Letter\n` +
    `   - Original FDR Receipt Copy (with bank lien discharge)\n` +
    `2. **Public Grievance Redressal Cell (PGRC) Clearance:** Must be **APPROVED**. If any student/faculty complaint is under inquiry, status is marked **MATURITY DATE EXTENDED** (release held).\n` +
    `3. **Vigilance Clearance:** Must be **APPROVED**. If any vigilance investigation is ongoing, status is marked **MATURITY DATE EXTENDED** (release held).\n` +
    `4. **Proven Violations Block Release:** Any matching **PROVEN** grievance or vigilance record sets clearance to **REJECTED**, blocking release.\n\n` +
    `### 4. Portal Withholding vs. Statutory Forfeiture:\n` +
    `- **Portal Release-Blocking Decision:** A status of \`REJECTED\` or \`MATURITY DATE EXTENDED\` blocks or suspends the current portal release request; it does not automatically confiscate the funds.\n` +
    `- **Statutory Forfeiture:** Under **Clause 4.10 Note iii** and **Chapter VII (Clause 7.3 & 7.4)**, **statutory forfeiture** of the principal deposit or term extension can ONLY be formally ordered by the **Executive Committee / Council of AICTE** after due notice and inquiry for established grave violations of norms, non-performance, or financial malfeasance.\n\n` +
    `### 5. Practical Next Steps for the Institution:\n` +
    `- Check your current clearance and document verification status under **Receive → Deposit Details** (\`/institution/receive/deposit\`).\n` +
    `- Submit or track your release application under **Submit → Release Application** (\`/institution/submit/release\`).\n` +
    `- If blocked due to pending investigations, resolve outstanding complaints with the respective department (PGRC or Vigilance) to achieve affirmative clearance.`;

  return {
    explanation,
    supportingClauses: ["Clause 1.12", "Table 1.4", "Clause 4.10", "Affidavit-6", "Clause 7.3"],
  };
}

/**
 * Explains EoD (Extension of Deficiency) versus EoA (Extension of Approval).
 * Differentiates official terminology and outlines practical steps in the portal.
 */
export function getEodVsEoaExplanation(isActionQuestion: boolean = false): {
  explanation: string;
  supportingClauses: string[];
} {
  const explanation =
    `Here is the verified distinction between **EoA** and **EoD** in the AICTE Approval System and Portal:\n\n` +
    `### 1. What is EoA (Extension of Approval)?\n` +
    `- **Approval Granted:** An **Extension of Approval (EoA)** is the official regulatory grant issued annually under **Chapter II (Clause 2.1)** to existing technical institutions.\n` +
    `- **Entitlement:** It authorizes the institution to continue offering approved technical programmes/courses and admit students for the academic year.\n` +
    `- **Portal Location:** Once granted, download your official EoA letter under **Receive → LoA / EoA** (\`/institution/receive/loa-eoa\`).\n\n` +
    `### 2. What is EoD (Extension Deficiency Notice / Letter of Deficiency)?\n` +
    `- **Deficiency Identified:** In the AICTE Portal under **Receive → LoD / EoD** (\`/institution/receive/lod-eod\`), an **EoD (Extension of Deficiency)** or **LoD (Letter of Deficiency)** is issued when submitted documents or compliance details have **unresolved deficiencies** or compliance is overdue.\n` +
    `- **Approval Withheld:** Unlike EoA, an EoD signifies that Extension of Approval is **NOT granted yet** because specific mandatory requirements (such as faculty cadre ratios, land documents, building approvals, or affidavits) were rejected or marked deficient during Scrutiny / FD verification.\n\n` +
    `### 3. What You Are Supposed to Do (Step-by-Step Practical Action):\n` +
    `1. **Access Your Deficiency Notice:** In the portal sidebar, navigate to **Receive → LoD / EoD** (\`/institution/receive/lod-eod\`).\n` +
    `2. **Review Specific Deficiency Remarks:** Click *Preview Letter* or download the PDF to examine the **"Specific Deficiencies Identified by FD Employee"** section. Note exactly which documents or clauses failed verification.\n` +
    `3. **Prepare Rectifications:** Obtain the corrected authentic certificates, updated municipal building plans, or sworn affidavits as required by **Annexure-2** of the Approval Process Handbook.\n` +
    `4. **Re-upload Compliant Documents:** Navigate to **Submit → Approval Seeking** (\`/institution/submit/approval\`) and re-upload the rectified documents for Re-Scrutiny before the compliance cutoff date.\n` +
    `5. **Appeal / Representation (if needed):** If an aggrieved institution seeks to contest a deficiency, **Clause 1.11 / Clause 2.25** provides the right to appeal through the portal within 7 days to the Standing Appellate Committee (SAC).\n\n` +
    `> **Clarification Note:** If your notice or portal screen displays a different reference or term for EoD, what does EoD refer to in your notice or portal screen? You can share the exact wording without sensitive information.`;

  return {
    explanation,
    supportingClauses: ["Clause 2.1", "Clause 1.8", "Clause 1.10", "Clause 1.11", "Annexure-2"],
  };
}

/**
 * Explains practical next steps after receiving a Letter of Approval (LoA).
 */
export function getLoaNextStepsExplanation(): {
  explanation: string;
  supportingClauses: string[];
} {
  const explanation =
    `After receiving the official **Letter of Approval (LoA)** from AICTE under **Clause 1.14**, the institution must complete the following practical and regulatory next steps before admitting students:\n\n` +
    `### Practical Next Steps Supported by the AICTE Handbook:\n` +
    `1. **Obtain University Affiliation / State Board Approval (Clause 1.14 & Clause 1.10):** Submit the AICTE LoA to your designated Affiliating University or State Board of Technical Education to secure formal academic affiliation. Institutions cannot admit students without university affiliation.\n` +
    `2. **Participate in State Centralized Admission (Clause 1.7):** Coordinate with the State Admission Authority / Centralized Counseling body to admit students strictly within approved intake and reservation guidelines.\n` +
    `3. **Complete Faculty & Principal Recruitment (Clause 1.6 & Annexure-5):** Ensure the Principal/Director and teaching faculty are recruited as per AICTE Cadre Ratio and qualifications before starting academic classes.\n` +
    `4. **Maintain 10-Year Joint FDR Under Lien (Clause 1.12 & Clause 7.7):** The Security Deposit created with the Regional Officer, AICTE must remain untouched for the mandatory 10-year period. Unauthorized premature encashment incurs immediate penal reduction of intake under Clause 7.7.\n` +
    `5. **Annual Extension of Approval (EoA) (Clause 2.1):** For subsequent academic sessions, apply for annual Extension of Approval through the AICTE Portal under Chapter 2.`;

  return {
    explanation,
    supportingClauses: ["Clause 1.14", "Clause 1.6", "Clause 1.12", "Clause 2.1"],
  };
}

/**
 * Returns exact portal instructions on where to upload documents depending on topic.
 */
export function getPortalUploadInstructions(topic?: string): string {
  const lower = (topic || "").toLowerCase();
  if (lower.includes("fdr") || lower.includes("deposit") || lower.includes("payment")) {
    return (
      `You should upload your FDR details in the **AICTE Institution Portal** at:\n\n` +
      `👉 **Submit → Payment / FDR Submission** (\`/institution/submit/payment\`)\n\n` +
      `Enter the FDR Reference Number, Amount, Bank Name, Maturity Date, and upload the scanned bank receipt PDF with lien endorsement.`
    );
  }
  if (lower.includes("release")) {
    return (
      `You should submit your FDR release documents at:\n\n` +
      `👉 **Submit → Release Application** (\`/institution/submit/release\`)\n\n` +
      `Upload your sworn **Affidavit 6**, FDR receipt copy, and clearance request declaration.`
    );
  }
  return (
    `To upload statutory approval documents (Land Deed, Approved Building Plan, Fire NOC, Structural Stability, Affidavits), navigate to:\n\n` +
    `👉 **Submit → Approval Seeking** (\`/institution/submit/approval\`)\n\n` +
    `Upload each mandatory document in its designated slot under Appendix 11.`
  );
}
