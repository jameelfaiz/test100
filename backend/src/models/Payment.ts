// src/models/Payment.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IPayment extends Document {
  collegeId: string; // linked institution
  paymentId: string; // unique ID
  applicationId?: string; // optional reference
  referenceNumber: string;
  paymentDate: Date;
  amount: number;
  method: string;
  receiptPath?: string;
  status: "SUBMITTED" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  bankName?: string;
  branchName?: string;
  ifscCode?: string;
  maturityDate?: Date;
  bankEmployeeName?: string;
  bankEmployeeId?: string;
  bankEmployeeDesignation?: string;
  bankEmployeeContact?: string;
  isActive?: boolean;
  remarks?: string;
  documents?: any[];
  verificationLetter?: any;
  verificationLetterSent?: boolean;
  isReviewed?: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
  maturityReminder?: any;
  maturityReminders?: any[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    collegeId: { type: String, required: true, index: true },
    paymentId: { type: String, required: true, unique: true },
    applicationId: { type: String },
    referenceNumber: { type: String, required: true },
    paymentDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    receiptPath: { type: String },
    status: {
      type: String,
      enum: ["SUBMITTED", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"],
      default: "SUBMITTED",
    },
    bankName: { type: String },
    branchName: { type: String },
    ifscCode: { type: String },
    maturityDate: { type: Date },
    bankEmployeeName: { type: String },
    bankEmployeeId: { type: String },
    bankEmployeeDesignation: { type: String },
    bankEmployeeContact: { type: String },
    isActive: { type: Boolean, default: true },
    remarks: { type: String, default: "" },
    documents: { type: Schema.Types.Mixed },
    verificationLetter: { type: Schema.Types.Mixed },
    verificationLetterSent: { type: Boolean, default: false },
    isReviewed: { type: Boolean, default: false },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    maturityReminder: { type: Schema.Types.Mixed },
    maturityReminders: [{ type: Schema.Types.Mixed }],
  },
  { timestamps: true }
);

export const Payment =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
