// src/models/Complaint.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IComplaintNote {
  note: string;
  author: string;
  date: Date;
}

export interface IComplaint extends Document {
  complaintReference: string;
  institutionId: string;
  collegeId?: string;
  applicationId?: string;
  complainant?: {
    name: string;
    email: string;
    mobile?: string;
    phone?: string;
    address?: string;
  };
  category: string;
  title: string;
  subject?: string;
  description: string;
  institutionNameSnapshot?: string;
  attachments?: Array<{
    name: string;
    fileName: string;
    fileUrl: string;
    type?: string;
    size?: string;
    uploadDate?: Date;
  }>;
  source: "PUBLIC" | "INTERNAL" | "PGRC" | "VIGILANCE";
  assignedDepartment: "PGRC" | "VIGILANCE";
  assignedEmployee?: string;
  assignedOfficerId?: string;
  investigationStatus?: string;
  status:
    | "PENDING"
    | "NEW"
    | "UNDER_INVESTIGATION"
    | "INVESTIGATION"
    | "ON_PROCESS"
    | "ESCALATED"
    | "RESOLVED"
    | "PROVEN"
    | "UNPROVEN"
    | "NOT_PROVEN";
  finalOutcome?: "PROVEN" | "NOT_PROVEN" | "UNPROVEN" | "ON_PROCESS" | "UNSUBSTANTIATED" | "INCONCLUSIVE";
  reason?: string;
  publicStatusMessage?: string;
  findingSummary?: string;
  evidenceReferences?: string[];
  supportingDocuments?: string[];
  evidencePath?: string;
  escalatedToVigilance?: boolean;
  escalationReason?: string;
  investigationNotes?: IComplaintNote[];
  statusHistory?: Array<{
    status: string;
    reason?: string;
    updatedBy?: string;
    updatedAt: Date;
  }>;
  auditHistory?: Array<{
    action: string;
    performedBy?: string;
    timestamp: Date;
    details?: string;
  }>;
  decisionBy?: string;
  decisionAt?: Date;
  finalizedBy?: string;
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    complaintReference: { type: String, unique: true, sparse: true, index: true },
    institutionId: { type: String, required: true, index: true },
    collegeId: { type: String, index: true },
    institutionNameSnapshot: { type: String },
    applicationId: { type: String },
    complainant: {
      name: { type: String },
      email: { type: String },
      mobile: { type: String },
      phone: { type: String },
      address: { type: String },
    },
    category: {
      type: String,
      default: "Other Complaints",
    },
    title: { type: String, required: true },
    subject: { type: String },
    description: { type: String, required: true },
    source: {
      type: String,
      enum: ["PUBLIC", "INTERNAL", "PGRC", "VIGILANCE"],
      default: "PUBLIC",
    },
    assignedDepartment: {
      type: String,
      enum: ["PGRC", "VIGILANCE"],
      default: "PGRC",
      index: true,
    },
    assignedEmployee: { type: String },
    investigationStatus: { type: String, default: "NEW" },
    status: {
      type: String,
      default: "PENDING",
      index: true,
    },
    finalOutcome: {
      type: String,
      index: true,
    },
    findingSummary: { type: String },
    evidenceReferences: [{ type: String }],
    supportingDocuments: [{ type: String }],
    evidencePath: { type: String },
    attachments: [
      {
        name: { type: String },
        fileName: { type: String },
        fileUrl: { type: String },
        type: { type: String },
        size: { type: String },
        uploadDate: { type: Date, default: Date.now },
      },
    ],
    reason: { type: String },
    publicStatusMessage: { type: String },
    assignedOfficerId: { type: String },
    decisionBy: { type: String },
    decisionAt: { type: Date },
    statusHistory: [
      {
        status: { type: String },
        reason: { type: String },
        updatedBy: { type: String },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    auditHistory: [
      {
        action: { type: String },
        performedBy: { type: String },
        timestamp: { type: Date, default: Date.now },
        details: { type: String },
      },
    ],
    escalatedToVigilance: { type: Boolean, default: false, index: true },
    escalationReason: { type: String },
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

// Pre-save hook to ensure subject and title match and complaintReference exists
ComplaintSchema.pre("save", function () {
  if (!this.subject && this.title) {
    this.subject = this.title;
  } else if (!this.title && this.subject) {
    this.title = this.subject;
  }
  if (!this.complaintReference) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.complaintReference = `COMP-2026-${randomSuffix}`;
  }
});

export const Complaint =
  mongoose.models.Complaint || mongoose.model<IComplaint>("Complaint", ComplaintSchema);
