// src/models/Investigation.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IInvestigationNote {
  note: string;
  author: string;
  date: Date;
}

export interface IInvestigation extends Document {
  investigationId: string; // unique ID
  complaintId: mongoose.Schema.Types.ObjectId; // reference to Complaint
  complaintReference?: string;
  institutionId?: string;
  collegeId?: string;
  assignedInvestigatorId?: mongoose.Schema.Types.ObjectId; // User assigned
  assignedInvestigator?: string;
  assignedInvestigatorName?: string;
  status: "OPEN" | "IN_PROGRESS" | "UNDER_REVIEW" | "ON_PROCESS" | "COMPLETED";
  findings?: string;
  findingSummary?: string;
  finalOutcome?: "PROVEN" | "NOT_PROVEN" | "ON_PROCESS" | "UNSUBSTANTIATED" | "INCONCLUSIVE";
  supervisorDecision?: string;
  evidencePath?: string;
  evidenceReferences?: string[];
  investigationNotes?: IInvestigationNote[];
  finalizedBy?: string;
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvestigationSchema = new Schema<IInvestigation>(
  {
    investigationId: { type: String, required: true, unique: true, index: true },
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      unique: true,
      index: true,
    },
    complaintReference: { type: String, index: true },
    institutionId: { type: String, index: true },
    collegeId: { type: String, index: true },
    assignedInvestigatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedInvestigator: { type: String },
    assignedInvestigatorName: { type: String },
    status: {
      type: String,
      default: "OPEN",
      index: true,
    },
    findings: { type: String },
    findingSummary: { type: String },
    finalOutcome: {
      type: String,
      index: true,
    },
    supervisorDecision: { type: String },
    evidencePath: { type: String },
    evidenceReferences: [{ type: String }],
    investigationNotes: [
      {
        note: { type: String, required: true },
        author: { type: String, required: true },
        date: { type: Date, default: Date.now },
      },
    ],
    finalizedBy: { type: String },
    finalizedAt: { type: Date },
  },
  { timestamps: true }
);

export const Investigation =
  mongoose.models.Investigation ||
  mongoose.model<IInvestigation>("Investigation", InvestigationSchema);
