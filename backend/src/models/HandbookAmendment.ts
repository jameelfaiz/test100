// backend/src/models/HandbookAmendment.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IHandbookAmendment extends Document {
  amendmentId: string;
  title: string;
  officialSourceUrl: string;
  publicationDate: string;
  effectiveDate?: string;
  affectedClauseOrSection: string;
  originalDocumentReference: string;
  summary: string;
  verificationStatus: "VERIFIED" | "INCOMPLETE";
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const HandbookAmendmentSchema = new Schema<IHandbookAmendment>(
  {
    amendmentId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    officialSourceUrl: { type: String, required: true },
    publicationDate: { type: String, required: true },
    effectiveDate: { type: String },
    affectedClauseOrSection: { type: String, required: true, index: true },
    originalDocumentReference: { type: String, required: true },
    summary: { type: String, required: true },
    verificationStatus: {
      type: String,
      enum: ["VERIFIED", "INCOMPLETE"],
      default: "VERIFIED",
    },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const HandbookAmendment = mongoose.model<IHandbookAmendment>(
  "HandbookAmendment",
  HandbookAmendmentSchema
);
