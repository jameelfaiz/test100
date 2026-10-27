// src/models/User.ts
import mongoose, { Schema, Document } from "mongoose";

export type Role =
  | "AICTE_FD_EMPLOYEE"
  | "PGRC_EMPLOYEE"
  | "VIGILANCE_EMPLOYEE"
  | "VIGILANCE_SUPERVISOR"
  | "INSTITUTION";

export interface IUser extends Document {
  userId: string;
  username?: string;
  collegeId?: string;
  passwordHash: string;
  alternatePasswordHash?: string;
  originalPasswordHash?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  role: Role;
  institutionId?: string;
  employeeId?: string;
  accountStatus: "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true },
    username: { type: String, sparse: true, index: true },
    collegeId: { type: String, sparse: true, index: true },
    passwordHash: { type: String, required: true },
    alternatePasswordHash: { type: String },
    originalPasswordHash: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    role: { type: String, required: true, enum: [
      "AICTE_FD_EMPLOYEE",
      "PGRC_EMPLOYEE",
      "VIGILANCE_EMPLOYEE",
      "VIGILANCE_SUPERVISOR",
      "INSTITUTION",
    ] },
    institutionId: { type: String },
    employeeId: { type: String },
    accountStatus: { type: String, default: "ACTIVE", enum: ["ACTIVE", "DISABLED", "PENDING_VERIFICATION"] },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
