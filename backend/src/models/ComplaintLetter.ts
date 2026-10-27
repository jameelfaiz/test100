// src/models/ComplaintLetter.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IComplaintLetter extends Document {
  letterReference: string;
  institutionId: string;
  collegeId: string;
  institutionName: string;
  department: "PGRC" | "VIGILANCE";
  complaintReferences: string[];
  status: "REJECTED" | "ON_PROCESS" | "VERIFIED";
  reason: string;
  content: string;
  generatedBy: string;
  generatedDate: Date;
  isSent: boolean;
  sentBy?: string;
  sentDate?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintLetterSchema = new Schema<IComplaintLetter>(
  {
    letterReference: { type: String, required: true, unique: true, index: true },
    institutionId: { type: String, required: true, index: true },
    collegeId: { type: String, required: true, index: true },
    institutionName: { type: String, required: true },
    department: { type: String, enum: ["PGRC", "VIGILANCE"], required: true, index: true },
    complaintReferences: [{ type: String }],
    status: { type: String, enum: ["REJECTED", "ON_PROCESS", "VERIFIED"], required: true, index: true },
    reason: { type: String, default: "" },
    content: { type: String, required: true },
    generatedBy: { type: String, required: true },
    generatedDate: { type: Date, default: Date.now },
    isSent: { type: Boolean, default: false, index: true },
    sentBy: { type: String },
    sentDate: { type: Date },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const ComplaintLetter =
  mongoose.models.ComplaintLetter ||
  mongoose.model<IComplaintLetter>("ComplaintLetter", ComplaintLetterSchema);
