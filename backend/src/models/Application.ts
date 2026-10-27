// src/models/Application.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IApplication extends Document {
  collegeId: string; // linked institution
  applicationId: string; // unique ID
  title: string;
  type: string;
  description: string;
  documents: string[]; // file paths
  submissionDate: Date;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  programme?: string;
  intake?: number;
  result?: "LoA" | "EoA" | "LoD" | "EoD" | null;
  letterType?: "LoA" | "EoA" | "LoD" | "EoD" | null;
  letterReferenceNumber?: string;
  deficiencyRemarks?: any[];
  letterGenerated?: boolean;
  letterText?: string;
  letterSent?: boolean;
  letterSentDate?: Date;
  depositDetails?: any;
  depositDetailsSent?: boolean;
  documentItems?: any[];
  categoryDocuments?: any[];
  applicationType?: "LOA" | "EOA" | string | null;
  isReviewed?: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    collegeId: { type: String, required: true, index: true },
    applicationId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    type: { type: String, default: "Technical Education" },
    description: { type: String, default: "AICTE Approval Application" },
    documents: [{ type: String }],
    submissionDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"],
      default: "SUBMITTED",
    },
    programme: { type: String },
    intake: { type: Number },
    result: { type: String, enum: ["LoA", "EoA", "LoD", "EoD", null], default: null },
    letterType: { type: String, enum: ["LoA", "EoA", "LoD", "EoD", null], default: null },
    letterReferenceNumber: { type: String },
    deficiencyRemarks: [{ type: Schema.Types.Mixed }],
    letterGenerated: { type: Boolean, default: false },
    letterText: { type: String, default: "" },
    letterSent: { type: Boolean, default: false },
    letterSentDate: { type: Date },
    depositDetails: { type: Schema.Types.Mixed },
    depositDetailsSent: { type: Boolean, default: false },
    documentItems: { type: Schema.Types.Mixed },
    categoryDocuments: [{ type: Schema.Types.Mixed }],
    applicationType: { type: String, enum: ["LOA", "EOA", "LoA", "EoA", null], default: null },
    isReviewed: { type: Boolean, default: false },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
  },
  { timestamps: true }
);

export const Application =
  mongoose.models.Application || mongoose.model<IApplication>("Application", ApplicationSchema);
