// backend/src/services/handbookIndexer.ts
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
import { HandbookClause, IHandbookClause } from "../models/HandbookClause";

export interface ExtractedHandbookSection {
  sectionId: string;
  clauseNumber: string;
  subclauseNumber?: string;
  chapter: string;
  title: string;
  year: string;
  version: string;
  pageNumber: string;
  printedPageNumber: string;
  pdfPageNumber: number;
  sectionHeading?: string;
  tableOrAnnexureRef?: string;
  sourceFile: string;
  category: string;
  requirementType: "MANDATORY" | "RECOMMENDED" | "REGULATORY_STATUTE" | "PROCEDURAL" | "INFORMATIONAL";
  applicability: string[];
  content: string;
  summary: string;
  tables?: Array<{ headers: string[]; rows: string[][] }>;
  exceptions?: string;
  keywords: string[];
}

export interface ExtractionStats {
  totalPages: number;
  extractedPages: number;
  chaptersCount: number;
  clausesCount: number;
  tablesCount: number;
  annexuresCount: number;
  affidavitsCount: number;
  formatsCount: number;
  definitionsCount: number;
  abbreviationsCount: number;
  totalSections: number;
}

/**
 * Extracts and structures all 230+ pages from AICTE Approval Process Handbook PDF
 */
export async function extractCompleteHandbookFromPdf(
  pdfPath: string
): Promise<{ sections: ExtractedHandbookSection[]; stats: ExtractionStats }> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Handbook PDF not found at path: ${pdfPath}`);
  }

  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  await parser.load();
  const textResult = await parser.getText();
  const rawText: string = typeof textResult === "string" ? textResult : (textResult as any)?.text || "";

  // Split into pages using "-- <n> of 231 --"
  const rawPages = rawText.split(/--\s*(\d+)\s*of\s*231\s*--/);
  const pageMap = new Map<number, string>();

  for (let i = 1; i < rawPages.length; i += 2) {
    const pageNum = parseInt(rawPages[i]);
    const pageContent = rawPages[i + 1]?.trim() || "";
    pageMap.set(pageNum, pageContent);
  }

  const sections: ExtractedHandbookSection[] = [];
  const chaptersFound = new Set<string>();
  let tablesCount = 0;
  let annexuresCount = 0;
  let affidavitsCount = 0;
  let formatsCount = 0;
  let definitionsCount = 0;
  let abbreviationsCount = 0;

  // Helper to extract printed page number from page text
  function getPrintedPage(pdfPage: number, text: string): string {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let k = 0; k < Math.min(5, lines.length); k++) {
      if (/^\d+$/.test(lines[k])) return lines[k];
      if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(lines[k])) return lines[k].toLowerCase();
    }
    const lastLines = lines.slice(-4);
    for (const l of lastLines) {
      if (/^\d+$/.test(l)) return l;
      if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i.test(l)) return l.toLowerCase();
    }
    return String(pdfPage);
  }

  // 1. Legal Status & Foreword (PDF pages 3 to 7)
  for (let p = 3; p <= 7; p++) {
    const text = pageMap.get(p) || "";
    if (!text) continue;
    const printed = getPrintedPage(p, text);
    if (p === 3) {
      sections.push({
        sectionId: "aph-2024-27-legal-status",
        clauseNumber: "Legal Document Status",
        chapter: "Statutory Basis & Legal Mandate",
        title: "AICTE Act 1987 & Regulatory Authority Legal Framework",
        year: "2024-27",
        version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
        pageNumber: printed,
        printedPageNumber: printed,
        pdfPageNumber: p,
        sectionHeading: "Legal Document as per AICTE Act 1987 (52 of 1987)",
        sourceFile: pdfPath,
        category: "REGULATORY_STATUTE",
        requirementType: "REGULATORY_STATUTE",
        applicability: ["ALL", "INSTITUTION", "UNIVERSITIES"],
        content: text,
        summary: "Declares the Handbook as a Legal Document under AICTE Act 1987, Mandatory Accreditation Reg 2014, NSQF Reg 2012, PGDM Reg 2017, Graded Autonomy Reg 2018/2019, Approvals Reg 2020/2021, ODL/OL 2021, and PGRC Reg 2021.",
        keywords: ["legal document", "aicte act 1987", "regulations", "statutory", "mandate", "gazette"],
      });
    } else if (p === 4 || p === 5) {
      sections.push({
        sectionId: `aph-2024-27-foreword-p${p}`,
        clauseNumber: `Foreword Part ${p - 3}`,
        chapter: "Foreword & Executive Overview",
        title: "Chairman's Foreword — National Technical Hub & NEP 2020 Reforms",
        year: "2024-27",
        version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
        pageNumber: printed,
        printedPageNumber: printed,
        pdfPageNumber: p,
        sectionHeading: "Foreword by Prof. T. G. Sitharam, Chairman AICTE",
        sourceFile: pdfPath,
        category: "INFORMATIONAL",
        requirementType: "INFORMATIONAL",
        applicability: ["ALL", "INSTITUTION"],
        content: text,
        summary: "Introduces key 2024-27 reforms: 3-year EoA for top institutions, removal of upper intake limits subject to EVC, working professionals flexible mode, BCA/BBA brought under AICTE, off-campus provisions, and INDOVATION.",
        keywords: ["foreword", "chairman", "reforms", "triennial", "nep 2020", "extended eoa", "working professionals", "bca", "bba", "indovation"],
      });
    }
  }

  // 2. Abbreviations (PDF pages 9-10)
  for (let p = 9; p <= 10; p++) {
    const text = pageMap.get(p) || "";
    if (!text) continue;
    abbreviationsCount++;
    const printed = getPrintedPage(p, text);
    sections.push({
      sectionId: `aph-2024-27-abbreviations-p${p}`,
      clauseNumber: `Abbreviations Part ${p - 8}`,
      chapter: "Abbreviations & Acronyms",
      title: "Official AICTE Abbreviations & Regulatory Glossary",
      year: "2024-27",
      version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
      pageNumber: printed,
      printedPageNumber: printed,
      pdfPageNumber: p,
      sectionHeading: "AICTE Official Acronyms and Abbreviations",
      sourceFile: pdfPath,
      category: "ABBREVIATIONS",
      requirementType: "INFORMATIONAL",
      applicability: ["ALL"],
      content: text,
      summary: "Official definitions of AICTE acronyms including FDR (Fixed Deposit Receipt), LoA (Letter of Approval), EoA (Extension of Approval), EVC (Expert Visit Committee), SAC, SHC, SCSC, PGRC, NSWS, TER, etc.",
      keywords: ["abbreviations", "acronyms", "fdr", "loa", "eoa", "evc", "pgrc", "sac", "shc", "ter", "nba", "naac"],
    });
  }

  // 3. Definitions (PDF pages 11-14)
  for (let p = 11; p <= 14; p++) {
    const text = pageMap.get(p) || "";
    if (!text) continue;
    definitionsCount++;
    const printed = getPrintedPage(p, text);
    sections.push({
      sectionId: `aph-2024-27-definitions-p${p}`,
      clauseNumber: `Definitions Part ${p - 10}`,
      chapter: "Definitions",
      title: "Official AICTE Statutory Definitions (Clauses 1 to 63)",
      year: "2024-27",
      version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
      pageNumber: printed,
      printedPageNumber: printed,
      pdfPageNumber: p,
      sectionHeading: "Official Definitions under AICTE Regulations",
      sourceFile: pdfPath,
      category: "DEFINITIONS",
      requirementType: "REGULATORY_STATUTE",
      applicability: ["ALL"],
      content: text,
      summary: "Defines 63 key statutory terms including Academic Year, Approved Institution, Approved Intake, Autonomous Institution, Break in EoA, Hibernation, Division, Faculty member, LoA, EoA, Standalone Institutions, SAC, SHC, SCSC, etc.",
      keywords: ["definitions", "division", "break in eoa", "hibernation", "approved intake", "faculty", "autonomous", "supernumerary"],
    });
  }

  // 4. Preamble (PDF page 15)
  const preambleText = pageMap.get(15) || "";
  if (preambleText) {
    sections.push({
      sectionId: "aph-2024-27-preamble",
      clauseNumber: "Preamble",
      chapter: "Preamble",
      title: "Preamble — Mandate of AICTE Act 1987 in Approval Process",
      year: "2024-27",
      version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
      pageNumber: "xii",
      printedPageNumber: "xii",
      pdfPageNumber: 15,
      sectionHeading: "Preamble and Powers of Council under Section 10 & 11",
      sourceFile: pdfPath,
      category: "REGULATORY_STATUTE",
      requirementType: "REGULATORY_STATUTE",
      applicability: ["ALL"],
      content: preambleText,
      summary: "Sets forth Council's powers under Section 10(g), 10(i), 10(k), 10(n), 10(p), and Section 11(1)-(4) to regulate quality, norms, curricula, inspection, and prevent commercialization.",
      keywords: ["preamble", "powers", "section 10", "section 11", "inspection", "quality"],
    });
  }

  // 5. Main Regulatory Chapters I to VIII (PDF pages 16 to 90)
  // Let's segment by Clause numbers and Tables
  const chapterPageRanges: Array<{
    chapter: string;
    chapterNum: number;
    title: string;
    startPdf: number;
    endPdf: number;
    category: string;
  }> = [
    {
      chapter: "Chapter-I",
      chapterNum: 1,
      title: "Grant of Approval for New Institution",
      startPdf: 16,
      endPdf: 25,
      category: "NEW_INSTITUTION_LOA",
    },
    {
      chapter: "Chapter-II",
      chapterNum: 2,
      title: "Grant of Extension of Approval for Existing Institutions",
      startPdf: 26,
      endPdf: 47,
      category: "EXTENSION_EOA",
    },
    {
      chapter: "Chapter-III",
      chapterNum: 3,
      title: "Collaboration & Twinning Programmes",
      startPdf: 48,
      endPdf: 51,
      category: "COLLABORATION_TWINNING",
    },
    {
      chapter: "Chapter-IV",
      chapterNum: 4,
      title: "Grant of Approval for Universities",
      startPdf: 52,
      endPdf: 59,
      category: "UNIVERSITIES",
    },
    {
      chapter: "Chapter-V",
      chapterNum: 5,
      title: "Approval for Open and Distance Learning (ODL) / Online Learning (OL)",
      startPdf: 60,
      endPdf: 66,
      category: "ODL_ONLINE",
    },
    {
      chapter: "Chapter-VI",
      chapterNum: 6,
      title: "Standard Norms and Requirements",
      startPdf: 67,
      endPdf: 84,
      category: "INFRASTRUCTURE_NORMS",
    },
    {
      chapter: "Chapter-VII",
      chapterNum: 7,
      title: "Penal Actions on Violation of Norms",
      startPdf: 85,
      endPdf: 89,
      category: "PENALTY_VIOLATION",
    },
    {
      chapter: "Chapter-VIII",
      chapterNum: 8,
      title: "DOS and DON'TS",
      startPdf: 90,
      endPdf: 90,
      category: "GENERAL_PROCEDURE",
    },
  ];

  for (const chInfo of chapterPageRanges) {
    chaptersFound.add(chInfo.chapter);
    const pageRecords: Array<{ pdfPage: number; printed: string; text: string }> = [];

    for (let p = chInfo.startPdf; p <= chInfo.endPdf; p++) {
      const pageText = pageMap.get(p) || "";
      if (!pageText) continue;
      const printed = getPrintedPage(p, pageText);
      pageRecords.push({ pdfPage: p, printed, text: pageText });
    }

    interface TempSection {
      clauseNumber: string;
      pdfPage: number;
      printedPage: string;
      heading: string;
      contentLines: string[];
    }

    const rawSections: TempSection[] = [];
    let current: TempSection | null = null;

    for (const pr of pageRecords) {
      const lines = pr.text.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("Approval Process Handbook")) continue;

        // Table heading must have a colon or dash and a title
        const tableMatch = line.match(new RegExp(`^(Table\\s*${chInfo.chapterNum}\\.\\d+)[ \\t]*[:–-][ \\t]+(.+)$`, "i"));
        // Clause heading must start with chapter index (e.g., 1.x in Ch 1, 2.x in Ch 2)
        const clauseMatch = line.match(new RegExp(`^(${chInfo.chapterNum}\\.\\d+(?:\\.\\d+)?)[ \\t]+([A-Z].*)$`));
        const isCitation =
          line.includes("as per Clause") ||
          line.includes("mentioned in Clause") ||
          line.includes("refer Clause") ||
          line.includes("of Chapter") ||
          line.includes("as per Table");

        if (tableMatch) {
          if (current) rawSections.push(current);
          current = {
            clauseNumber: tableMatch[1].replace(/\s+/g, " "),
            pdfPage: pr.pdfPage,
            printedPage: pr.printed,
            heading: tableMatch[2].trim(),
            contentLines: [line],
          };
        } else if (clauseMatch && !isCitation) {
          if (current) rawSections.push(current);
          current = {
            clauseNumber: `Clause ${clauseMatch[1]}`,
            pdfPage: pr.pdfPage,
            printedPage: pr.printed,
            heading: clauseMatch[2].trim(),
            contentLines: [line],
          };
        } else if (current) {
          current.contentLines.push(line);
        }
      }
    }
    if (current) rawSections.push(current);

    // Merge sections shorter than 35 characters so no truncated headings exist
    const chapterSections: TempSection[] = [];
    for (let i = 0; i < rawSections.length; i++) {
      const sec = rawSections[i];
      const textLen = sec.contentLines.join("\n").trim().length;
      if (textLen < 35) {
        if (i + 1 < rawSections.length) {
          rawSections[i + 1].contentLines.unshift(...sec.contentLines);
        } else if (chapterSections.length > 0) {
          chapterSections[chapterSections.length - 1].contentLines.push(...sec.contentLines);
        }
      } else {
        chapterSections.push(sec);
      }
    }

    if (chapterSections.length > 0) {
      for (const cs of chapterSections) {
        const cleanContent = cs.contentLines.join("\n").trim();
        if (cleanContent.length < 35) continue;

        let reqType: "MANDATORY" | "RECOMMENDED" | "REGULATORY_STATUTE" | "PROCEDURAL" = "MANDATORY";
        if (/shall not|mandatory|shall submit|penalty|forfeited|compulsory/i.test(cleanContent)) {
          reqType = "MANDATORY";
        } else if (/recommended|desirable|encouraged|suggested/i.test(cleanContent)) {
          reqType = "RECOMMENDED";
        } else if (/act|statute|regulation|powers/i.test(cleanContent)) {
          reqType = "REGULATORY_STATUTE";
        }

        const isTable = cs.clauseNumber.startsWith("Table");
        if (isTable) tablesCount++;

        let cat = chInfo.category;
        if (/fdr|security deposit|bank guarantee/i.test(cleanContent)) cat = "SECURITY_DEPOSIT";
        else if (/grievance|pgrc|complaint|ombudsperson/i.test(cleanContent)) cat = "GRIEVANCE_COMPLAINT";
        else if (/penalty|punitive|fine|violation|excess admission/i.test(cleanContent)) cat = "PENALTY_VIOLATION";
        else if (/faculty|cadre ratio|principal/i.test(cleanContent)) cat = "FACULTY_NORMS";
        else if (/land|built-up|infrastructure|laboratory|library/i.test(cleanContent)) cat = "INFRASTRUCTURE_NORMS";
        else if (isTable) cat = "TABLE_SCHEDULE";

        const firstFewLines = cleanContent.split("\n").filter(Boolean).slice(0, 3).join(" ");
        const summary = firstFewLines.length > 300 ? firstFewLines.substring(0, 297) + "..." : firstFewLines;

        const words = cleanContent.toLowerCase().match(/\b[a-z0-9_-]{2,}\b/g) || [];
        const freq: Record<string, number> = {};
        for (const w of words) {
          if (!["the", "and", "for", "with", "that", "shall", "per", "from", "are", "this"].includes(w)) {
            freq[w] = (freq[w] || 0) + 1;
          }
        }
        const topKeywords = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([k]) => k);

        sections.push({
          sectionId: `aph-2024-27-${cs.clauseNumber.toLowerCase().replace(/[^a-z0-9.]/g, "-")}`,
          clauseNumber: cs.clauseNumber,
          chapter: `${chInfo.chapter}: ${chInfo.title}`,
          title: cs.heading ? `${cs.clauseNumber} — ${cs.heading}` : `${chInfo.title} (${cs.clauseNumber})`,
          year: "2024-27",
          version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
          pageNumber: cs.printedPage,
          printedPageNumber: cs.printedPage,
          pdfPageNumber: cs.pdfPage,
          sectionHeading: cs.heading,
          sourceFile: pdfPath,
          category: cat,
          requirementType: reqType,
          applicability: ["ALL", "INSTITUTION", "AICTE_FD_EMPLOYEE"],
          content: cleanContent,
          summary: summary || `${cs.clauseNumber} regulations in ${chInfo.title}`,
          keywords: Array.from(new Set([cs.clauseNumber.toLowerCase(), chInfo.chapter.toLowerCase(), ...topKeywords])),
        });
      }
    } else {
      // If no headings found, store page-by-page
      for (const pr of pageRecords) {
        sections.push({
          sectionId: `aph-2024-27-${chInfo.chapter.toLowerCase()}-p${pr.pdfPage}`,
          clauseNumber: `${chInfo.chapter} (Page ${pr.printed})`,
          chapter: `${chInfo.chapter}: ${chInfo.title}`,
          title: `${chInfo.title} — Page ${pr.printed}`,
          year: "2024-27",
          version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
          pageNumber: pr.printed,
          printedPageNumber: pr.printed,
          pdfPageNumber: pr.pdfPage,
          sourceFile: pdfPath,
          category: chInfo.category,
          requirementType: "MANDATORY",
          applicability: ["ALL", "INSTITUTION"],
          content: pr.text,
          summary: `${chInfo.title} norms and procedures on printed page ${pr.printed}`,
          keywords: [chInfo.chapter.toLowerCase(), "handbook", "aicte", "approval"],
        });
      }
    }
  }

  // 6. Annexures 1 through 18 (PDF pages 91 to 183)
  const annexureDefs: Array<{
    annexureNum: number;
    title: string;
    startPdf: number;
    endPdf: number;
    category: string;
  }> = [
    { annexureNum: 1, title: "Documents for Setting up New Technical Institution", startPdf: 91, endPdf: 94, category: "MANDATORY_DOCUMENTS" },
    { annexureNum: 2, title: "Documents to be uploaded/submitted by Existing Institutions", startPdf: 95, endPdf: 100, category: "MANDATORY_DOCUMENTS" },
    { annexureNum: 3, title: "Norms for Land and Built-up Area Requirements", startPdf: 101, endPdf: 106, category: "INFRASTRUCTURE_NORMS" },
    { annexureNum: 4, title: "Norms for Books, Library, Computers, Software and Labs", startPdf: 107, endPdf: 109, category: "INFRASTRUCTURE_NORMS" },
    { annexureNum: 5, title: "Norms for Faculty Requirements and Cadre Ratio", startPdf: 110, endPdf: 111, category: "FACULTY_NORMS" },
    { annexureNum: 6, title: "Norms for PGDM/PGCM Courses", startPdf: 112, endPdf: 114, category: "MANDATORY_DOCUMENTS" },
    { annexureNum: 7, title: "Process Flow Chart for Establishment of New Technical Institution", startPdf: 115, endPdf: 115, category: "NEW_INSTITUTION_LOA" },
    { annexureNum: 8, title: "Norms for Duration, Entry Level Qualifications & Reservations", startPdf: 116, endPdf: 125, category: "CURRICULUM_NOMENCLATURE" },
    { annexureNum: 9, title: "MBA/PGDM in Innovation, Entrepreneurship and Venture Development", startPdf: 126, endPdf: 126, category: "CURRICULUM_NOMENCLATURE" },
    { annexureNum: 10, title: "Undertaking for Student Induction, Exam Reforms & Internship", startPdf: 127, endPdf: 127, category: "MANDATORY_DOCUMENTS" },
    { annexureNum: 11, title: "Approved Nomenclature of Courses", startPdf: 128, endPdf: 139, category: "CURRICULUM_NOMENCLATURE" },
    { annexureNum: 12, title: "Closest available Nomenclature for Conversion of Levels", startPdf: 140, endPdf: 150, category: "CURRICULUM_NOMENCLATURE" },
    { annexureNum: 13, title: "Major Disciplines and Relevant Branch Mapping", startPdf: 151, endPdf: 161, category: "CURRICULUM_NOMENCLATURE" },
    { annexureNum: 14, title: "State Wise Competent Authorities for Land/Building Certificates", startPdf: 162, endPdf: 168, category: "MANDATORY_DOCUMENTS" },
    { annexureNum: 15, title: "Fellow Programme in Management Conduct & Admission", startPdf: 169, endPdf: 174, category: "CURRICULUM_NOMENCLATURE" },
    { annexureNum: 16, title: "Structure of Various Committees", startPdf: 175, endPdf: 177, category: "COMMITTEES" },
    { annexureNum: 17, title: "Recommended Composition of Board of Governors (BoG)/BoM", startPdf: 178, endPdf: 178, category: "COMMITTEES" },
    { annexureNum: 18, title: "Mandatory Disclosures Format", startPdf: 179, endPdf: 183, category: "MANDATORY_DOCUMENTS" },
  ];

  for (const ann of annexureDefs) {
    annexuresCount++;
    for (let p = ann.startPdf; p <= ann.endPdf; p++) {
      const pageText = pageMap.get(p) || "";
      if (!pageText) continue;
      const printed = getPrintedPage(p, pageText);
      const isMulti = ann.startPdf !== ann.endPdf;
      const clauseNum = isMulti ? `Annexure-${ann.annexureNum} (Part ${p - ann.startPdf + 1})` : `Annexure-${ann.annexureNum}`;

      sections.push({
        sectionId: `aph-2024-27-annexure-${ann.annexureNum}-p${p}`,
        clauseNumber: clauseNum,
        chapter: `Annexure-${ann.annexureNum}`,
        title: `${ann.title} (Page ${printed})`,
        year: "2024-27",
        version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
        pageNumber: printed,
        printedPageNumber: printed,
        pdfPageNumber: p,
        tableOrAnnexureRef: `Annexure-${ann.annexureNum}`,
        sourceFile: pdfPath,
        category: ann.category,
        requirementType: "MANDATORY",
        applicability: ["ALL", "INSTITUTION", "AICTE_FD_EMPLOYEE"],
        content: pageText,
        summary: `${ann.title} regulations, tables, and standards from Annexure-${ann.annexureNum} on printed page ${printed}.`,
        keywords: [
          `annexure-${ann.annexureNum}`,
          ann.title.toLowerCase(),
          "norms",
          "handbook",
          "aicte",
        ],
      });
    }
  }

  // 7. Affidavits 1 to 13 (PDF pages 185 to 199)
  const affidavitDefs: Array<{ num: number; title: string; startPdf: number; endPdf: number }> = [
    { num: 1, title: "For creation of New Password/Forgotten Password", startPdf: 185, endPdf: 185 },
    { num: 2, title: "For applications submitted under Chapter I/II/IV except Closure", startPdf: 186, endPdf: 188 },
    { num: 3, title: "For submitting Security Deposit Upon establishment of New Institution/Programme/Level", startPdf: 189, endPdf: 189 },
    { num: 4, title: "For Progressive/Complete Closure of the Institution", startPdf: 190, endPdf: 190 },
    { num: 5, title: "For compliance of AICTE norms for Universities applying as per Chapter IV", startPdf: 191, endPdf: 191 },
    { num: 6, title: "For Release of Security Deposit (FDR)", startPdf: 192, endPdf: 192 },
    { num: 7, title: "For transfer of private Property / Building", startPdf: 193, endPdf: 193 },
    { num: 8, title: "For Additional Course / Increase in Intake", startPdf: 194, endPdf: 194 },
    { num: 9, title: "For change in the Bank details", startPdf: 195, endPdf: 195 },
    { num: 10, title: "For Change in Name / Address of the Trust / Society / Company", startPdf: 196, endPdf: 196 },
    { num: 11, title: "For Collaboration and Twinning Programme", startPdf: 197, endPdf: 197 },
    { num: 12, title: "For Conducting Academic Course(s) of other Regulatory Bodies", startPdf: 198, endPdf: 198 },
    { num: 13, title: "For Conducting Open and Distance Learning (ODL) / Online Learning Mode", startPdf: 199, endPdf: 200 },
  ];

  for (const aff of affidavitDefs) {
    affidavitsCount++;
    for (let p = aff.startPdf; p <= aff.endPdf; p++) {
      const pageText = pageMap.get(p) || "";
      if (!pageText) continue;
      const printed = getPrintedPage(p, pageText);
      const isMulti = aff.startPdf !== aff.endPdf;
      const clauseNum = isMulti ? `Affidavit-${aff.num} (Part ${p - aff.startPdf + 1})` : `Affidavit-${aff.num}`;

      sections.push({
        sectionId: `aph-2024-27-affidavit-${aff.num}-p${p}`,
        clauseNumber: clauseNum,
        chapter: `Affidavit-${aff.num}`,
        title: `Affidavit ${aff.num} — ${aff.title}`,
        year: "2024-27",
        version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
        pageNumber: printed,
        printedPageNumber: printed,
        pdfPageNumber: p,
        tableOrAnnexureRef: `Affidavit-${aff.num}`,
        sourceFile: pdfPath,
        category: "STATUTORY_AFFIDAVIT",
        requirementType: "REGULATORY_STATUTE",
        applicability: ["ALL", "INSTITUTION", "AICTE_FD_EMPLOYEE"],
        content: pageText,
        summary: `Official sworn legal format for Affidavit ${aff.num}: ${aff.title} on Rs. 100 Non-Judicial stamp paper.`,
        keywords: [`affidavit-${aff.num}`, `affidavit ${aff.num}`, aff.title.toLowerCase(), "stamp paper", "notary"],
      });
    }
  }

  // 8. Formats 1 to 4 & Certificates 1 to 3 (PDF pages 201 to 213)
  const formatDefs: Array<{
    code: string;
    type: "FORMAT" | "CERTIFICATE";
    title: string;
    startPdf: number;
    endPdf: number;
  }> = [
    { code: "Format-1", type: "FORMAT", title: "No Objection Certificate from the State Government/ UT", startPdf: 201, endPdf: 201 },
    { code: "Format-2", type: "FORMAT", title: "No Objection Certificate from the Affiliating University/ Board", startPdf: 202, endPdf: 204 },
    { code: "Format-3", type: "FORMAT", title: "Resolution of the Trust/ Society/ Company", startPdf: 205, endPdf: 206 },
    { code: "Format-4", type: "FORMAT", title: "MoU between Institution and Skill Knowledge Providers / Trainers", startPdf: 207, endPdf: 209 },
    { code: "Certificate-1", type: "CERTIFICATE", title: "Certificate of an Advocate (Land and Title)", startPdf: 210, endPdf: 211 },
    { code: "Certificate-2", type: "CERTIFICATE", title: "Certificate of an Architect Registered with Council of Architecture", startPdf: 212, endPdf: 212 },
    { code: "Certificate-3", type: "CERTIFICATE", title: "Certificate of the Bank Manager (Funds & FDR)", startPdf: 213, endPdf: 213 },
  ];

  for (const fmt of formatDefs) {
    formatsCount++;
    for (let p = fmt.startPdf; p <= fmt.endPdf; p++) {
      const pageText = pageMap.get(p) || "";
      if (!pageText) continue;
      const printed = getPrintedPage(p, pageText);
      const isMulti = fmt.startPdf !== fmt.endPdf;
      const clauseNum = isMulti ? `${fmt.code} (Part ${p - fmt.startPdf + 1})` : fmt.code;

      sections.push({
        sectionId: `aph-2024-27-${fmt.code.toLowerCase()}-p${p}`,
        clauseNumber: clauseNum,
        chapter: `${fmt.type}: ${fmt.code}`,
        title: `${fmt.code} — ${fmt.title}`,
        year: "2024-27",
        version: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
        pageNumber: printed,
        printedPageNumber: printed,
        pdfPageNumber: p,
        tableOrAnnexureRef: fmt.code,
        sourceFile: pdfPath,
        category: "FORMAT_CERTIFICATE",
        requirementType: "MANDATORY",
        applicability: ["ALL", "INSTITUTION", "AICTE_FD_EMPLOYEE"],
        content: pageText,
        summary: `Prescribed official ${fmt.type.toLowerCase()} template for ${fmt.code}: ${fmt.title}.`,
        keywords: [fmt.code.toLowerCase(), fmt.title.toLowerCase(), "format", "certificate", "official template"],
      });
    }
  }

  const stats: ExtractionStats = {
    totalPages: 231,
    extractedPages: pageMap.size,
    chaptersCount: chaptersFound.size,
    clausesCount: sections.filter((s) => s.clauseNumber.startsWith("Clause")).length,
    tablesCount,
    annexuresCount,
    affidavitsCount,
    formatsCount,
    definitionsCount,
    abbreviationsCount,
    totalSections: sections.length,
  };

  return { sections, stats };
}

/**
 * Idempotently ingests extracted sections in batches into MongoDB
 */
export async function ingestExtractedHandbookSections(
  sections: ExtractedHandbookSection[]
): Promise<{ upserted: number; totalInDb: number }> {
  const operations = sections.map((sec) => ({
    updateOne: {
      filter: {
        $or: [
          { sectionId: sec.sectionId },
          { clauseNumber: sec.clauseNumber, year: sec.year },
        ],
      },
      update: {
        $set: {
          clauseNumber: sec.clauseNumber,
          chapter: sec.chapter,
          title: sec.title,
          year: sec.year,
          version: sec.version,
          pageNumber: sec.pageNumber,
          pdfPageNumber: sec.pdfPageNumber,
          printedPageNumber: sec.printedPageNumber,
          sectionHeading: sec.sectionHeading,
          subclauseNumber: sec.subclauseNumber,
          tableOrAnnexureRef: sec.tableOrAnnexureRef,
          sourceFile: sec.sourceFile,
          sectionId: sec.sectionId,
          isCompleteIndex: true,
          category: sec.category,
          requirementType: sec.requirementType,
          applicability: sec.applicability,
          content: sec.content,
          summary: sec.summary,
          keywords: sec.keywords,
          ...(sec.tables && sec.tables.length > 0 ? { tables: sec.tables } : {}),
          ...(sec.exceptions ? { exceptions: sec.exceptions } : {}),
        },
      },
      upsert: true,
    },
  }));

  // Batch execute in chunks of 50
  const CHUNK_SIZE = 50;
  let totalUpserted = 0;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const res = await HandbookClause.bulkWrite(chunk, { ordered: false });
    totalUpserted += (res.upsertedCount || 0) + (res.modifiedCount || 0);
  }

  const totalInDb = await HandbookClause.countDocuments();
  return { upserted: totalUpserted, totalInDb };
}
