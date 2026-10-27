// src/models/Otp.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
  email: string;
  purpose: "REGISTRATION" | "TRACKING";
  complaintReference?: string;
  otpHash: string;
  attempts: number;
  resendCooldownUntil: Date;
  expiresAt: Date;
  verified: boolean;
  verificationToken?: string;
  verificationTokenExpiresAt?: Date;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, enum: ["REGISTRATION", "TRACKING"], required: true, index: true },
    complaintReference: { type: String, uppercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    resendCooldownUntil: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    verified: { type: Boolean, default: false },
    verificationToken: { type: String, index: true },
    verificationTokenExpiresAt: { type: Date },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Otp = mongoose.models.Otp || mongoose.model<IOtp>("Otp", OtpSchema);
