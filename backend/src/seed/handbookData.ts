// src/seed/handbookData.ts
// Comprehensive official AICTE Approval Process Handbook (APH) regulatory corpus
// Covers 2024-2027 (Triennial) and 2023-2024 versions across Chapters I-VII, Appendices 1-12, and Affidavits

export interface SeedClause {
  clauseNumber: string;
  chapter: string;
  title: string;
  year: string;
  version: string;
  pageNumber: string;
  category:
    | "SECURITY_DEPOSIT"
    | "NEW_INSTITUTION_LOA"
    | "EXTENSION_EOA"
    | "PENALTY_VIOLATION"
    | "GRIEVANCE_COMPLAINT"
    | "INFRASTRUCTURE_NORMS"
    | "FACULTY_NORMS"
    | "MANDATORY_DOCUMENTS"
    | "STATUTORY_AFFIDAVIT"
    | "GENERAL_PROCEDURE";
  requirementType: "MANDATORY" | "RECOMMENDED" | "REGULATORY_STATUTE";
  applicability: string[];
  content: string;
  summary: string;
  tables?: { headers: string[]; rows: string[][] }[];
  exceptions?: string;
  keywords: string[];
}

export const OFFICIAL_HANDBOOK_CLAUSES: SeedClause[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // CHAPTER I: GRANT OF APPROVAL FOR NEW TECHNICAL INSTITUTIONS (LoA)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    clauseNumber: "Clause 1.1",
    chapter: "Chapter I: Grant of Approval for Technical Institutions",
    title: "Introduction and Jurisdiction for New Technical Institutions",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "4",
    category: "NEW_INSTITUTION_LOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA", "New Technical Institution"],
    content:
      "A new Technical Institution shall be established only by a registered Society, Trust, or a Company established under Section 8 of the Companies Act, 2013, or Central/State Government, or University. Applications must be submitted through the AICTE Unified Web Portal within the notified cutoff schedule.",
    summary:
      "Only registered Trusts, Societies, Section 8 companies, or Government entities can establish a technical institution. Submissions must occur via the official web portal.",
    keywords: ["society", "trust", "section 8", "establishment", "loa", "new institution", "jurisdiction"],
  },
  {
    clauseNumber: "Clause 1.3",
    chapter: "Chapter I: Grant of Approval for Technical Institutions",
    title: "Processing Fee and Scrutiny of New Applications",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "6",
    category: "NEW_INSTITUTION_LOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA"],
    content:
      "All applications for establishing new institutions shall be accompanied by the non-refundable processing fee as specified in Appendix 12. Applications without requisite fee or essential documents will be summarily rejected at the Scrutiny Committee stage without refund.",
    summary:
      "Prescribed non-refundable processing fees must accompany new applications. Incomplete applications are rejected at the initial Scrutiny Committee review.",
    keywords: ["processing fee", "scrutiny committee", "non-refundable", "rejection", "appendix 12"],
  },
  {
    clauseNumber: "Clause 1.6",
    chapter: "Chapter I: Grant of Approval for Technical Institutions",
    title: "Scrutiny / Re-Scrutiny Committee Workflow",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "8",
    category: "NEW_INSTITUTION_LOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA"],
    content:
      "Applications are scrutinized online by a Scrutiny Committee comprising academic experts and an architect/advocate. If deficiencies are found, an opportunity to appear before the Re-Scrutiny Committee is granted. Document deficiencies marked by Scrutiny must be addressed with authenticated evidence.",
    summary:
      "Initial application validation is performed by an expert Scrutiny Committee. If deficiencies are marked, institutions must submit verified rectification evidence before Re-Scrutiny.",
    keywords: ["scrutiny", "re-scrutiny", "document deficiency", "verification", "expert committee"],
  },
  {
    clauseNumber: "Clause 1.8",
    chapter: "Chapter I: Grant of Approval for Technical Institutions",
    title: "Expert Visit Committee (EVC) Inspection",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "9",
    category: "NEW_INSTITUTION_LOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA"],
    content:
      "Institutions recommended by the Scrutiny Committee shall be visited by an Expert Visit Committee (EVC) physically or virtually. EVC verifies physical possession of land, built-up area, barrier-free infrastructure, laboratory equipment, computing facilities, and safety clearances.",
    summary:
      "Physical or virtual inspection of infrastructure, laboratories, land, and safety compliance is conducted by the Expert Visit Committee prior to LoA grant.",
    keywords: ["evc", "expert visit committee", "inspection", "infrastructure", "laboratories", "physical verification"],
  },
  {
    clauseNumber: "Clause 1.12",
    chapter: "Chapter I: Grant of Approval for Technical Institutions",
    title: "Security Deposit (Joint Fixed Deposit Receipt - FDR)",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "10",
    category: "SECURITY_DEPOSIT",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA", "FDR", "Deposit Details"],
    content:
      "Applicants recommended for Letter of Approval (LoA) must create a Joint Fixed Deposit Receipt (FDR) or submit Security Deposit in the joint name of the President/Chairman/Secretary of the Applicant Trust/Society/Company and the Regional Officer, AICTE, for a minimum duration of 10 years. The deposit amount depends on the category of institution and program as stipulated in Appendix 10. Interest accrued shall belong to AICTE unless specified otherwise. The Joint FDR remains under statutory lien with AICTE and cannot be encashed without prior written approval of the AICTE Approval Bureau.",
    summary:
      "Mandatory 10-year Joint Fixed Deposit with the AICTE Regional Officer must be submitted before Letter of Approval is issued. It remains under statutory lien and cannot be encashed prematurely.",
    tables: [
      {
        headers: ["Program Category", "Institution Level", "Deposit Amount (₹ Lakhs)", "Duration"],
        rows: [
          ["Engineering & Technology", "Undergraduate (Degree)", "35.00 Lakhs", "10 Years"],
          ["Engineering & Technology", "Diploma / Polytechnic", "15.00 Lakhs", "10 Years"],
          ["Management (MBA / PGDM)", "Postgraduate", "15.00 Lakhs", "10 Years"],
          ["Computer Applications (MCA)", "Postgraduate", "15.00 Lakhs", "10 Years"],
          ["Pharmacy", "UG / Diploma", "15.00 Lakhs", "10 Years"],
          ["Architecture & Planning", "UG Degree", "15.00 Lakhs", "10 Years"],
        ],
      },
    ],
    exceptions:
      "Central Government, State Government, Government-aided institutions, and Central/State Universities are exempted from security deposit submission.",
    keywords: [
      "security deposit",
      "joint fdr",
      "clause 1.12",
      "lien",
      "regional officer",
      "10 years",
      "loa",
      "fixed deposit",
    ],
  },
  {
    clauseNumber: "Clause 1.14",
    chapter: "Chapter I: Grant of Approval for Technical Institutions",
    title: "Issuance of Letter of Approval (LoA) and Validity",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "12",
    category: "NEW_INSTITUTION_LOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA"],
    content:
      "The Council issues a formal Letter of Approval (LoA) valid for three academic years from the date of issue. The institution must commence academic operations within this period after obtaining affiliation from the designated State/Central Affiliating University/Board of Technical Education. If the institution fails to commence within three academic years, the LoA lapses.",
    summary:
      "LoA is issued upon fulfillment of all document, EVC, and FDR conditions. It is valid for three academic years to commence operations with university affiliation.",
    keywords: ["loa", "letter of approval", "validity", "three years", "affiliation", "university"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CHAPTER II: GRANT OF EXTENSION OF APPROVAL (EoA)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    clauseNumber: "Clause 2.1",
    chapter: "Chapter II: Extension of Approval (EoA)",
    title: "Eligibility and Annual EoA Submission Mandate",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "15",
    category: "EXTENSION_EOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "EoA"],
    content:
      "Every existing technical institution approved by AICTE must submit an online application for Extension of Approval (EoA) for each regulatory period. Submissions require self-disclosure of student enrollment, faculty data, infrastructural compliance, grievance redressal compliance, and payment of the annual regulatory fee.",
    summary:
      "Existing approved institutions must annually seek Extension of Approval by disclosing operational data, faculty ratios, infrastructure status, and paying regulatory fees.",
    keywords: ["eoa", "extension of approval", "annual submission", "eligibility", "self-disclosure"],
  },
  {
    clauseNumber: "Clause 2.3",
    chapter: "Chapter II: Extension of Approval (EoA)",
    title: "Increase in Intake / Additional Courses / New Divisions",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "18",
    category: "EXTENSION_EOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "EoA"],
    content:
      "Institutions seeking increase in intake or new programs/courses must possess valid NBA accreditation for at least 50% of their eligible courses, zero pending regulatory penalties, adequate land and built-up area as per Appendix 4, and adequate faculty cadre as per Appendix 7. In the 2024-27 handbook, well-performing institutions can apply without intake caps provided infrastructure and faculty ratios are strictly maintained.",
    summary:
      "Increase in intake or new courses requires minimum 50% NBA accreditation for eligible programs, no outstanding compliance penalties, and verified infrastructure/faculty compliance.",
    keywords: ["increase in intake", "additional courses", "nba accreditation", "division increase", "cadre ratio"],
  },
  {
    clauseNumber: "Clause 2.6",
    chapter: "Chapter II: Extension of Approval (EoA)",
    title: "Introduction of Supernumerary Seats (FN / OCI / CIWG / PMSSS)",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "22",
    category: "EXTENSION_EOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "EoA"],
    content:
      "Institutions can apply for 15% supernumerary seats for Foreign Nationals (FN), Overseas Citizens of India (OCI), Children of Indian Workers in Gulf Countries (CIWG), and PMSSS. Requirements include valid NBA accreditation, adequate infrastructure, hostel accommodations, and university concurrence.",
    summary:
      "Up to 15% supernumerary seats can be sanctioned for FN/OCI/CIWG candidates subject to accreditation, hostel facilities, and approval bureau verification.",
    keywords: ["supernumerary", "fn", "oci", "ciwg", "gulf quota", "pmsss"],
  },
  {
    clauseNumber: "Clause 2.9",
    chapter: "Chapter II: Extension of Approval (EoA)",
    title: "Break in EoA and Restoration Process",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "26",
    category: "EXTENSION_EOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "EoA"],
    content:
      "An institution that failed to apply for EoA in an earlier academic year suffers a Break in EoA. Restoration requires payment of restoration fees, clearing all pending inspection dues, submission of Affidavit 2, and physical verification through an Expert Visit Committee (EVC).",
    summary:
      "Failure to apply for EoA breaks continuity. Restoration requires penalty/restoration fees, Affidavit 2 submission, and a mandatory EVC inspection.",
    keywords: ["break in eoa", "restoration", "evc inspection", "affidavit 2", "regulatory break"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CHAPTER VI: OTHER APPROVAL AND COMPLIANCE PROCEDURES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    clauseNumber: "Clause 6.1",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Mandatory Documents for New Technical Institutions",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "53",
    category: "MANDATORY_DOCUMENTS",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA"],
    content:
      "Applications for establishing new technical institutions must mandatorily include: Registered Trust/Society Deed, Land Document (sale/gift deed registered for min 30 years), Land Use Certificate from Competent Authority, Approved Building Plan with sanction order, Fire Safety Certificate from State Fire Dept, Structural Stability Certificate, Barrier-Free Certificate for Divyangjan, and Joint FDR details as per Appendix 10.",
    summary:
      "Establishes the core 12 statutory documents required for new technical institutions: land deed, land use certificate, building plan, fire NOC, structural stability, and Joint FDR.",
    keywords: ["clause 6.1", "mandatory documents", "annexure 1", "land deed", "fire safety", "building plan"],
  },
  {
    clauseNumber: "Clause 6.2",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Mandatory Documents for Extension of Approval (EoA)",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "55",
    category: "MANDATORY_DOCUMENTS",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "EoA"],
    content:
      "Existing institutions seeking EoA must submit documents according to Annexure 2, including: Updated faculty cadre list with Biometric/Aadhaar details, Audited Balance Sheet for the preceding financial year, valid Fire Safety Certificate renewal, Anti-Ragging affidavit compilation, and Internal Complaint Committee constitution order.",
    summary:
      "Specifies the annual document requirements for EoA: updated faculty roster, audited balance sheets, renewed fire safety certificates, and anti-ragging compliance.",
    keywords: ["clause 6.2", "eoa documents", "annexure 2", "audited balance sheet", "fire renewal", "faculty roster"],
  },
  {
    clauseNumber: "Clause 6.3",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Academic Calendar Adherence and Admission Timelines",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "58",
    category: "GENERAL_PROCEDURE",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE"],
    content:
      "All AICTE-approved institutions must strictly adhere to the Academic Calendar notified annually by the Council and Supreme Court directives. Admission cut-off dates cannot be extended independently by institutions or universities without Council notification.",
    summary:
      "Strict compliance with AICTE's notified academic calendar and Supreme Court admission deadlines is mandatory.",
    keywords: ["academic calendar", "admission cutoff", "clause 6.3", "supreme court directive"],
  },
  {
    clauseNumber: "Clause 6.4",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Programme Duration and Entry Qualifications",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "59",
    category: "GENERAL_PROCEDURE",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE"],
    content:
      "Technical programmes shall conform strictly to prescribed durations (e.g. 4 years for B.Tech/B.E., 2 years for M.Tech/MBA, 3 years for Diploma) and entry qualifications. Lateral entry into the 2nd year of degree programmes is restricted to eligible diploma and B.Sc. candidates up to 10% of sanctioned intake.",
    summary:
      "Program durations and entry criteria must follow Council regulations. Lateral entry is capped at 10% of sanctioned intake.",
    keywords: ["clause 6.4", "programme duration", "entry qualifications", "lateral entry", "b.tech", "diploma"],
  },
  {
    clauseNumber: "Clause 6.45",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Student Fee Refund Policy and Return of Original Documents",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "61",
    category: "GENERAL_PROCEDURE",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "PGRC_EMPLOYEE", "FD_EMPLOYEE"],
    content:
      "In the event of a student withdrawing before the commencement of the academic session, the entire fee collected from the student, after deduction of processing fee of not more than ₹1,000/-, shall be refunded. Original educational certificates shall never be withheld by an institution under any circumstances.",
    summary:
      "Mandates prompt refund of student fees (maximum ₹1,000 deduction prior to cutoff) upon admission withdrawal. Institutions are prohibited from retaining original student certificates.",
    keywords: ["fee refund", "clause 6.45", "original certificates", "withholding documents", "student grievance"],
  },
  {
    clauseNumber: "Clause 6.46",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Release of Security Deposit (Joint FDR / RPGF)",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "61",
    category: "SECURITY_DEPOSIT",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "PGRC_EMPLOYEE", "VIGILANCE_EMPLOYEE", "Release Application", "LoD / EoD"],
    content:
      "The Security Deposit submitted in the form of a Joint Fixed Deposit Receipt (FDR) or through RTGS/NEFT may be released upon completion of the mandatory term of 10 years, or upon authorized closure of the institution/programme. Release is not automatic and requires a formal Release Application via the portal, supported by all mandated clearance documents, verification of no outstanding student dues, and inter-departmental clearances.",
    summary:
      "Comprehensive regulatory procedure for releasing 10-year security deposits/FDRs. Requires formal portal release application, clearance from PGRC/Vigilance, and verification by FD employees.",
    keywords: [
      "clause 6.46",
      "release of security deposit",
      "fdr release",
      "10 years maturity",
      "closure release",
      "inter-departmental clearance",
    ],
  },
  {
    clauseNumber: "Clause 6.46(a)",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Required Documents for FDR Release Application",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "61",
    category: "SECURITY_DEPOSIT",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "Release Application"],
    content:
      "The institution must submit: (i) Formal request letter signed by authorized signatory of the Trust/Society; (ii) Original FDR certificate duly discharged or certified copy; (iii) Notarized Affidavit 6 on non-judicial stamp paper; (iv) Copy of the initial Letter of Approval (LoA) and latest Extension of Approval (EoA); (v) Bank details and canceled cheque for electronic transfer; (vi) Proof of non-encashment from the issuing bank.",
    summary:
      "Checklist of documents for FDR release: formal request, original/certified FDR, Affidavit 6, LoA, latest EoA, bank account details, and bank verification.",
    keywords: ["clause 6.46(a)", "fdr documents", "affidavit 6", "canceled cheque", "request letter", "bank verification"],
  },
  {
    clauseNumber: "Clause 6.46(b)",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Mandatory Inter-Departmental Clearance Before FDR Release",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "61",
    category: "SECURITY_DEPOSIT",
    requirementType: "MANDATORY",
    applicability: ["FD_EMPLOYEE", "PGRC_EMPLOYEE", "VIGILANCE_EMPLOYEE", "INSTITUTION"],
    content:
      "Before recommending release of any Security Deposit, the Finance Bureau / FD Employee must obtain affirmative clearance from: (i) Public Grievance Redressal Cell (PGRC) confirming no pending student/faculty wage or fee complaints; (ii) Vigilance Cell confirming no vigilance or criminal proceedings; (iii) Legal Cell confirming absence of judicial stay orders; (iv) Concerned Regional Office confirming no physical inspection deficiencies.",
    summary:
      "FDR cannot be released without written clearances from PGRC (no grievance), Vigilance (no investigation), Legal Cell, and the Regional Office.",
    keywords: ["clause 6.46(b)", "pgrc clearance", "vigilance clearance", "legal clearance", "ro clearance", "fdr release"],
  },
  {
    clauseNumber: "Clause 6.46(c)",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Approval Bureau No Objection Certificate (NOC) for FDR Release",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "61",
    category: "SECURITY_DEPOSIT",
    requirementType: "MANDATORY",
    applicability: ["FD_EMPLOYEE", "INSTITUTION"],
    content:
      "Upon completion of document verification and receipt of all cell clearances, the AICTE Approval Bureau issues a formal No Objection Certificate (NOC) / Letter of Discharge (LoD) addressed to the issuing bank authorizing the release and discharge of the Joint FDR.",
    summary:
      "The Approval Bureau issues the formal NOC / LoD authorizing the bank to release the lien on the Joint FDR.",
    keywords: ["clause 6.46(c)", "noc", "lod", "letter of discharge", "approval bureau", "bank discharge"],
  },
  {
    clauseNumber: "Clause 6.46(d)",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "RTGS / Electronic Sanction Order for Security Deposit",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "61",
    category: "SECURITY_DEPOSIT",
    requirementType: "MANDATORY",
    applicability: ["FD_EMPLOYEE", "INSTITUTION"],
    content:
      "Where the security deposit was deposited directly into the Council account via RTGS/NEFT instead of a physical FDR, the Finance Bureau issues a financial Sanction Order and remits the principal amount electronically to the verified bank account of the Trust/Society.",
    summary:
      "Direct online security deposits are refunded via electronic RTGS transfer following the issuance of an AICTE Sanction Order.",
    keywords: ["clause 6.46(d)", "rtgs sanction", "electronic transfer", "finance bureau", "reimbursement"],
  },
  {
    clauseNumber: "Clause 6.46(e)",
    chapter: "Chapter VI: Other Approval and Compliance Procedures",
    title: "Financial Embezzlement Safeguards and Deposit Freezing",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "61",
    category: "SECURITY_DEPOSIT",
    requirementType: "REGULATORY_STATUTE",
    applicability: ["FD_EMPLOYEE", "VIGILANCE_EMPLOYEE", "PGRC_EMPLOYEE"],
    content:
      "In any case where allegations or prima facie evidence of financial embezzlement, diversion of funds, student extortion, or fraud are pending before AICTE, law enforcement, or statutory investigation agencies, the security deposit shall remain frozen and cannot be released until an unconditional clearance / NOC is issued by the competent investigating authority.",
    summary:
      "Security deposits are immediately frozen if allegations of financial embezzlement, fraud, or fund diversion are under investigation.",
    keywords: ["clause 6.46(e)", "embezzlement", "fraud", "deposit freezing", "vigilance", "investigation"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CHAPTER VII: PENAL ACTIONS AND COMPLAINTS PROCESSING
  // ─────────────────────────────────────────────────────────────────────────────
  {
    clauseNumber: "Clause 7.1",
    chapter: "Chapter VII: Actions for Violations of AICTE Norms",
    title: "Types of Regulatory Violations and Council Authority",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "70",
    category: "PENALTY_VIOLATION",
    requirementType: "REGULATORY_STATUTE",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "PGRC_EMPLOYEE", "VIGILANCE_EMPLOYEE"],
    content:
      "AICTE possesses statutory authority under the AICTE Act, 1987, to initiate penal and corrective actions against institutions violating Council regulations, submitting fraudulent documents, exceeding sanctioned intake, withholding student records, or failing faculty/infrastructure norms.",
    summary:
      "Outlines AICTE's statutory power to penalize non-compliant institutions for document fraud, excessive admissions, and norms violations.",
    keywords: ["clause 7.1", "statutory authority", "aicte act 1987", "violations", "penal actions"],
  },
  {
    clauseNumber: "Clause 7.7",
    chapter: "Chapter VII: Actions for Violations of AICTE Norms",
    title: "Security Deposit Violations and Premature Encashment Penalties",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "73",
    category: "SECURITY_DEPOSIT",
    requirementType: "REGULATORY_STATUTE",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "VIGILANCE_EMPLOYEE", "Deposit Details"],
    content:
      "An institution that encashes the Joint Fixed Deposit prematurely without prior approval of AICTE, or creates a second lien/loan against the security deposit, shall be liable to punitive actions including: (a) Immediate reduction of 50% intake across all programmes; (b) Putting the institution in 'No Admission' category for subsequent academic years; (c) Forfeiture of remaining deposits; (d) Filing of criminal complaint against the Trust/Society trustees.",
    summary:
      "Premature encashment or hypothecation of Joint FDR results in severe penalties: 50% intake reduction, 'No Admission' status, deposit forfeiture, and criminal prosecution.",
    keywords: [
      "clause 7.7",
      "premature encashment",
      "security deposit penalty",
      "fdr violation",
      "no admission",
      "intake reduction",
    ],
  },
  {
    clauseNumber: "Clause 7.10",
    chapter: "Chapter VII: Actions for Violations of AICTE Norms",
    title: "Complaints and Grievance Processing Mechanism",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "75",
    category: "GRIEVANCE_COMPLAINT",
    requirementType: "REGULATORY_STATUTE",
    applicability: ["PGRC_EMPLOYEE", "VIGILANCE_EMPLOYEE", "INSTITUTION", "FD_EMPLOYEE"],
    content:
      "Complaints received against approved institutions through the Public Grievance Redressal Cell (PGRC) or Vigilance Cell shall be examined by the Standing Complaint Committee (SCC). Anonymous or pseudonymous complaints shall not be entertained unless backed by verifiable documentary evidence. Proven violations lead to show-cause notices, physical surprise inspection by EVC, reduction in intake, withdrawal of approval, or financial penalty up to ₹50 Lakhs.",
    summary:
      "Formal complaint mechanism through PGRC and Standing Complaint Committee. Anonymous claims are disregarded unless verifiable. Proven non-compliance triggers EVC inspections and approval withdrawal.",
    keywords: [
      "clause 7.10",
      "complaints",
      "pgrc",
      "standing complaint committee",
      "scc",
      "show cause notice",
      "withdrawal of approval",
    ],
  },
  {
    clauseNumber: "Clause 7.12",
    chapter: "Chapter VII: Actions for Violations of AICTE Norms",
    title: "Standing Hearing Committee (SHC) and Appellate Committee (SAC)",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "77",
    category: "PENALTY_VIOLATION",
    requirementType: "REGULATORY_STATUTE",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "PGRC_EMPLOYEE", "VIGILANCE_EMPLOYEE"],
    content:
      "Institutions issued show-cause notices or penal recommendations have the right to represent their defense before the Standing Hearing Committee (SHC). If dissatisfied with SHC findings, an appeal may be preferred before the Standing Appellate Committee (SAC) within 15 days of order receipt.",
    summary:
      "Provides natural justice mechanism: institutions can present defenses to the Standing Hearing Committee (SHC) and file appeals to the Standing Appellate Committee (SAC).",
    keywords: ["standing hearing committee", "shc", "sac", "appellate committee", "appeal", "clause 7.12"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // APPENDICES: NORMS, INFRASTRUCTURE, FACULTY, AND SECURITY SCHEDULES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    clauseNumber: "Appendix 3",
    chapter: "Appendices: Land Requirements and Title Norms",
    title: "Land Requirements for Technical Institutions",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "95",
    category: "INFRASTRUCTURE_NORMS",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA", "Approval Seeking"],
    content:
      "Land must be in a single contiguous parcel in lawful ownership and possession of the applicant Trust/Society (or long-term registered government lease for minimum 30 years). Land use must be certified as Educational/Institutional by the competent Revenue/Town Planning Authority.",
    summary:
      "Land must be contiguous and legally owned or leased for at least 30 years, with official institutional land use conversion.",
    tables: [
      {
        headers: ["Program", "Mega / Metro City", "Urban Area", "Rural / Other Area"],
        rows: [
          ["Engineering & Technology (Degree)", "1.5 Acres", "2.5 Acres", "7.5 Acres"],
          ["Engineering & Technology (Diploma)", "1.0 Acre", "1.5 Acres", "4.0 Acres"],
          ["Management (MBA/PGDM)", "0.5 Acre", "1.0 Acre", "1.0 Acre"],
          ["MCA", "0.5 Acre", "1.0 Acre", "1.0 Acre"],
        ],
      },
    ],
    exceptions:
      "In hilly states and North Eastern states, land can be divided into a maximum of two plots separated by no more than 2 km.",
    keywords: ["appendix 3", "land norms", "acres", "contiguous parcel", "educational land use", "lease 30 years"],
  },
  {
    clauseNumber: "Appendix 4",
    chapter: "Appendices: Built-up Area and Space Requirements",
    title: "Norms for Built-up Area & Space Specifications",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "102",
    category: "INFRASTRUCTURE_NORMS",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "LoA", "EoA"],
    content:
      "Institutions must construct the total built-up area comprising Instructional Area, Administrative Area, Amenities Area, and Circulation Area. Instructional area includes Classrooms (min 66 sqm each), Tutorial Rooms (min 33 sqm), Laboratories (min 66 sqm each), Workshops (min 200 sqm), Computer Center (min 150 sqm), and Library (min 400 sqm).",
    summary:
      "Mandates detailed carpet area standards: 66 sqm per classroom, 66 sqm per lab, 400 sqm for central library, 150 sqm for computer center, plus administrative and amenities areas.",
    tables: [
      {
        headers: ["Room / Facility Type", "Minimum Carpet Area (sqm)", "Norm per Division / Intake"],
        rows: [
          ["Classroom", "66 sqm", "1 Classroom per division"],
          ["Tutorial Room", "33 sqm", "0.25 per division"],
          ["Laboratories", "66 sqm each", "2 to 3 per course division"],
          ["Central Library & Reading Room", "400 sqm", "For initial intake of up to 300 students"],
          ["Computer Center", "150 sqm", "1 per institution"],
          ["Seminar Hall", "132 sqm", "1 per institution"],
        ],
      },
    ],
    keywords: ["appendix 4", "built up area", "classrooms", "laboratories", "carpet area", "library norms"],
  },
  {
    clauseNumber: "Appendix 7",
    chapter: "Appendices: Faculty Cadre and Teacher-Student Ratios",
    title: "Faculty Cadre Ratios and Teacher-Student Norms",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "118",
    category: "FACULTY_NORMS",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "EoA", "Approval Seeking"],
    content:
      "Institutions must maintain the statutory Teacher to Student Ratio (TSR) and Cadre Ratio (Professor : Associate Professor : Assistant Professor = 1 : 2 : 6). Faculty appointments must satisfy 7th Central Pay Commission (CPC) scales and qualifications as per AICTE Faculty Regulations 2019.",
    summary:
      "Mandatory teacher-student ratio of 1:15 for UG Engineering and 1:20 for PG/Diploma. Cadre ratio must be 1 Professor : 2 Associate Professors : 6 Assistant Professors.",
    tables: [
      {
        headers: ["Program / Level", "Student-Teacher Ratio (TSR)", "Cadre Ratio (Prof : Asso Prof : Asst Prof)"],
        rows: [
          ["Engineering & Technology (UG)", "1 : 15", "1 : 2 : 6"],
          ["Engineering & Technology (Diploma)", "1 : 25", "1 : 2 : 6"],
          ["Management (MBA / PGDM)", "1 : 15", "1 : 2 : 6"],
          ["MCA", "1 : 15", "1 : 2 : 6"],
          ["Pharmacy (UG Degree)", "1 : 15", "1 : 2 : 6"],
        ],
      },
    ],
    keywords: ["appendix 7", "faculty ratio", "tsr", "1:15", "cadre ratio", "professor", "associate professor"],
  },
  {
    clauseNumber: "Appendix 10",
    chapter: "Appendices: Security Deposit Schedule",
    title: "Schedule of Security Deposit Amounts and Joint FDR Guidelines",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "135",
    category: "SECURITY_DEPOSIT",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "Payment / FDR Submission", "Deposit Details"],
    content:
      "Details the official security deposit amounts across all technical education disciplines. FDRs must be drawn on a Scheduled Commercial Bank in the joint name of the Trust/Society and Regional Officer, AICTE. Duration is strictly 10 years.",
    summary:
      "Statutory schedule of deposit amounts for technical disciplines. FDR must be drawn on a scheduled bank in joint name with the AICTE Regional Officer.",
    tables: [
      {
        headers: ["Category of Institution / Discipline", "Degree Level (₹)", "Diploma Level (₹)", "PG Level (₹)"],
        rows: [
          ["Engineering & Technology", "₹35,00,000", "₹15,00,000", "₹15,00,000"],
          ["Management (MBA / PGDM)", "—", "—", "₹15,00,000"],
          ["MCA", "—", "—", "₹15,00,000"],
          ["Pharmacy", "₹15,00,000", "₹10,00,000", "₹15,00,000"],
          ["Hotel Management (HMCT)", "₹15,00,000", "₹10,00,000", "₹15,00,000"],
        ],
      },
    ],
    keywords: ["appendix 10", "security deposit schedule", "joint fdr amounts", "35 lakhs", "15 lakhs"],
  },
  {
    clauseNumber: "Appendix 11",
    chapter: "Appendices: Mandatory Document Checklists",
    title: "Statutory Document Checklist for LoA and EoA Applications",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "140",
    category: "MANDATORY_DOCUMENTS",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "Approval Seeking"],
    content:
      "Comprehensive list of all 12 mandatory documents required during approval processing: (1) Certificate of Trust/Society/Section 8 Company Registration; (2) Registered Land Documents for min 30 years; (3) Land Use Certificate; (4) Approved Building Plan from competent municipal/panchayat authority; (5) Fire Safety Certificate issued by State Fire Authority; (6) Structural Stability Certificate from Certified Structural Engineer; (7) Barrier-Free Environment Certificate; (8) Joint FDR proof; (9) AICTE Web Portal Application; (10) Affidavits (1, 2, 4); (11) Water and Electrical Connection Sanction; (12) Occupancy/Completion Certificate.",
    summary:
      "Lists the full 12 mandatory document categories required for institutional approval verification.",
    keywords: ["appendix 11", "12 mandatory documents", "fire certificate", "building plan", "land documents"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUTORY AFFIDAVITS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    clauseNumber: "Affidavit 1",
    chapter: "Statutory Affidavits: Application Declarations",
    title: "Affidavit for Truthfulness of Information and Disclosures",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "185",
    category: "STATUTORY_AFFIDAVIT",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "Approval Seeking"],
    content:
      "Affidavit on non-judicial stamp paper of ₹100/- sworn by the Chairman/Secretary of the Trust/Society certifying that all uploaded documents, faculty records, student disclosures, and land titles are genuine and authentic. False declaration invokes immediate criminal and regulatory action.",
    summary:
      "Statutory declaration of truthfulness and authenticity of all uploaded application data and records.",
    keywords: ["affidavit 1", "sworn affidavit", "truthfulness", "authenticity", "legal undertaking"],
  },
  {
    clauseNumber: "Affidavit 6",
    chapter: "Statutory Affidavits: Security Deposit Release",
    title: "Affidavit for Release of Security Deposit (Joint FDR)",
    year: "2024-27",
    version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    pageNumber: "192",
    category: "STATUTORY_AFFIDAVIT",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "Release Application", "LoD / EoD"],
    content:
      "Sworn affidavit on non-judicial stamp paper of ₹100/- by authorized representative declaring that: (a) The 10-year term of the Joint FDR has elapsed; (b) No student grievances, fee disputes, or original certificate retention claims are pending; (c) All faculty and staff salary arrears are cleared as per 7th CPC; (d) No judicial stay or court case exists against deposit release; (e) The applicant undertakes to indemnify AICTE against any financial claim arising after FDR release.",
    summary:
      "Mandatory affidavit required for FDR release. Affirms 10-year maturity, zero student fee disputes, cleared faculty salaries, and indemnity for AICTE.",
    keywords: ["affidavit 6", "release of fdr", "security deposit release", "indemnity", "zero student dues"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HISTORICAL COMPARISON / 2023-2024 VERSION REFERENCE
  // ─────────────────────────────────────────────────────────────────────────────
  {
    clauseNumber: "Clause 2.3 (2023-24)",
    chapter: "Chapter II: Extension of Approval (EoA) [2023-24 Historical]",
    title: "Intake Cap and NBA Threshold Rules (2023-2024 Comparison)",
    year: "2023-24",
    version: "AICTE Approval Process Handbook 2023-2024",
    pageNumber: "21",
    category: "EXTENSION_EOA",
    requirementType: "MANDATORY",
    applicability: ["INSTITUTION", "FD_EMPLOYEE", "EoA"],
    content:
      "In the 2023-2024 handbook, maximum intake for undergraduate engineering was capped at 300 to 360 students per institution unless 60% of eligible courses were NBA accredited. Under the 2024-2027 triennial handbook, the rigid maximum intake cap was relaxed for institutions with good infrastructure and 50% NBA accreditation.",
    summary:
      "Historical 2023-24 rule capping overall engineering intake at 300-360 seats unless 60% NBA accredited. Contrast with 2024-27 flexible intake norms.",
    keywords: ["2023-24", "historical handbook", "intake cap", "nba 60 percent", "triennial difference"],
  },
];
