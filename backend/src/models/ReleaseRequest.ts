// src/models/ReleaseRequest.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IClearanceSnapshot {
  status: "APPROVED" | "REJECTED" | "MATURITY EXTENDED" | "ERROR";
  reason: string;
  count: number;
  calculatedAt: Date;
}

export interface IReleaseRequest extends Document {
  collegeId: string; // linked institution
  institutionId?: string;
  releaseRequestId: string; // unique ID
  applicationId?: string;
  fdrReference: string;
  depositDetails: string;
  reason: string;
  documents: string[]; // file paths
  documentItems?: any[];
  documentVerificationResults?: any;
  documentRemarks?: any;
  pgrcClearanceSnapshot?: IClearanceSnapshot;
  vigilanceClearanceSnapshot?: IClearanceSnapshot;
  overallReleaseStatus?:
    | "DOCUMENT_DEFICIENCY"
    | "REJECTED"
    | "MATURITY_EXTENDED"
    | "ELIGIBLE_FOR_APPROVAL"
    | "APPROVED"
    | "DECLINED"
    | "Pending";
  reviewedBy?: string;
  reviewedAt?: Date;
  isReviewed?: boolean;
  submissionDate: Date;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "Pending" | "Approved" | "Declined";
  pgrcStatus?: string;
  violenceStatus?: string;
  declineRemarks?: string;
  amount?: number;
  fdrId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReleaseRequestSchema = new Schema<IReleaseRequest>(
  {
    collegeId: { type: String, required: true, index: true },
    institutionId: { type: String, index: true },
    releaseRequestId: { type: String, required: true, unique: true, index: true },
    applicationId: { type: String },
    fdrReference: { type: String, default: "" },
    depositDetails: { type: Schema.Types.Mixed, default: "" },
    reason: { type: String, default: "FDR Release Request" },
    documents: [{ type: String }],
    documentItems: { type: Schema.Types.Mixed },
    documentVerificationResults: { type: Schema.Types.Mixed },
    documentRemarks: { type: Schema.Types.Mixed },
    pgrcClearanceSnapshot: {
      status: { type: String },
      reason: { type: String },
      count: { type: Number },
      calculatedAt: { type: Date },
    },
    vigilanceClearanceSnapshot: {
      status: { type: String },
      reason: { type: String },
      count: { type: Number },
      calculatedAt: { type: Date },
    },
    overallReleaseStatus: {
      type: String,
      default: "Pending",
      index: true,
    },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    isReviewed: { type: Boolean, default: false },
    submissionDate: { type: Date, default: Date.now },
    status: {
      type: String,
      default: "Pending",
      index: true,
    },
    pgrcStatus: { type: String, default: "PENDING" },
    violenceStatus: { type: String, default: "PENDING" },
    declineRemarks: { type: String, default: "" },
    amount: { type: Number },
    fdrId: { type: String },
  },
  { timestamps: true }
);

ReleaseRequestSchema.pre("save", function () {
  if (!this.applicationId && this.releaseRequestId) {
    this.applicationId = this.releaseRequestId;
  }
});

export const ReleaseRequest =
  mongoose.models.ReleaseRequest ||
  mongoose.model<IReleaseRequest>("ReleaseRequest", ReleaseRequestSchema);
