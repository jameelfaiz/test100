// src/models/EmailVerificationToken.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IEmailVerificationToken extends Document {
  institutionId: mongoose.Schema.Types.ObjectId;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmailVerificationTokenSchema = new Schema<IEmailVerificationToken>(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: "Institution", required: true },
    userId: { type: String, required: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const EmailVerificationToken =
  mongoose.models.EmailVerificationToken ||
  mongoose.model<IEmailVerificationToken>("EmailVerificationToken", EmailVerificationTokenSchema);
