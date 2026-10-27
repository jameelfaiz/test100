import mongoose, { Document, Schema } from "mongoose";

export interface ITableData {
  headers: string[];
  rows: string[][];
}

export interface IHandbookClause extends Document {
  clauseNumber: string;
  chapter: string;
  title: string;
  year: string; // e.g. "2024-27", "2023-24"
  version: string; // e.g. "AICTE Approval Process Handbook 2024-2027 (Triennial)"
  pageNumber: string;
  pdfPageNumber?: number;
  printedPageNumber?: string;
  sectionHeading?: string;
  subclauseNumber?: string;
  tableOrAnnexureRef?: string;
  sourceFile?: string;
  sectionId?: string;
  isCompleteIndex?: boolean;
  category: string;
  requirementType: "MANDATORY" | "RECOMMENDED" | "REGULATORY_STATUTE" | "PROCEDURAL" | "INFORMATIONAL";
  applicability: string[];
  content: string;
  summary: string;
  tables?: ITableData[];
  exceptions?: string;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

const TableDataSchema = new Schema<ITableData>(
  {
    headers: [{ type: String }],
    rows: [[{ type: String }]],
  },
  { _id: false }
);

const HandbookClauseSchema = new Schema<IHandbookClause>(
  {
    clauseNumber: { type: String, required: true, index: true },
    chapter: { type: String, required: true, index: true },
    title: { type: String, required: true },
    year: { type: String, required: true, default: "2024-27", index: true },
    version: {
      type: String,
      required: true,
      default: "AICTE Approval Process Handbook 2024-2027 (Triennial)",
    },
    pageNumber: { type: String, default: "N/A" },
    pdfPageNumber: { type: Number, index: true },
    printedPageNumber: { type: String },
    sectionHeading: { type: String },
    subclauseNumber: { type: String },
    tableOrAnnexureRef: { type: String },
    sourceFile: {
      type: String,
      default: "backend/resources/handbooks/AICTE_APH_2024_2027.pdf",
    },
    sectionId: { type: String, index: true },
    isCompleteIndex: { type: Boolean, default: true },
    category: {
      type: String,
      required: true,
      index: true,
    },
    requirementType: {
      type: String,
      required: true,
      enum: ["MANDATORY", "RECOMMENDED", "REGULATORY_STATUTE", "PROCEDURAL", "INFORMATIONAL"],
      default: "MANDATORY",
    },
    applicability: [{ type: String, index: true }],
    content: { type: String, required: true },
    summary: { type: String, required: true },
    tables: [TableDataSchema],
    exceptions: { type: String, default: "" },
    keywords: [{ type: String, index: true }],
  },
  {
    timestamps: true,
  }
);

// Full text search index
HandbookClauseSchema.index({
  clauseNumber: "text",
  title: "text",
  content: "text",
  summary: "text",
  keywords: "text",
  sectionHeading: "text",
});

export const HandbookClause = mongoose.model<IHandbookClause>(
  "HandbookClause",
  HandbookClauseSchema
);
