// src/models/DocumentVerification.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IDocVerificationHistory {
  decision: string;
  status: string;
  remarks: string;
  employeeId?: mongoose.Schema.Types.ObjectId;
  employeeUserId?: string;
  date: Date;
  documentPath?: string;
  documentName?: string;
}

export interface IDocumentVerification extends Document {
  applicationId: mongoose.Schema.Types.ObjectId; // reference to Application
  institutionId?: string;
  collegeId?: string;
  applicationRef?: string;
  documentId?: string;
  documentName?: string;
  documentPath: string; // stored file path
  verified: boolean;
  status?: "PENDING" | "VERIFIED" | "NOT_VERIFIED";
  reviewed?: boolean;
  category?: string;
  categoryName?: string;
  originalName?: string;
  fileUrl?: string;
  remarks?: string;
  employeeId: mongoose.Schema.Types.ObjectId; // reference to User (FD employee)
  employeeUserId?: string;
  decisionDate?: Date;
  history?: IDocVerificationHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const DocumentVerificationSchema = new Schema<IDocumentVerification>(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    institutionId: { type: String, index: true },
    collegeId: { type: String, index: true },
    applicationRef: { type: String, index: true },
    documentId: { type: String },
    documentName: { type: String },
    documentPath: { type: String, required: true },
    verified: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ["PENDING", "VERIFIED", "NOT_VERIFIED"], default: "PENDING" },
    reviewed: { type: Boolean, default: false },
    category: { type: String },
    categoryName: { type: String },
    originalName: { type: String },
    fileUrl: { type: String },
    remarks: { type: String, default: "" },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employeeUserId: { type: String },
    decisionDate: { type: Date },
    history: [
      {
        decision: { type: String },
        status: { type: String },
        remarks: { type: String },
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        employeeUserId: { type: String },
        date: { type: Date, default: Date.now },
        documentPath: { type: String },
        documentName: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export const DocumentVerification =
  mongoose.models.DocumentVerification ||
  mongoose.model<IDocumentVerification>("DocumentVerification", DocumentVerificationSchema);

