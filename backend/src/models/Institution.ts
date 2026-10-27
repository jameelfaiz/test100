// src/models/Institution.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IInstitution extends Document {
  name: string;
  collegeId: string; // generated, required after creation
  email?: string;    // kept as contact info; not required for registration
  contactNumber?: string;
  address?: string;
  registrationStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalNumber?: string;
  institutionType?: string;
  state?: string;
  district?: string;
  principalName?: string;
  authorizedContactPerson?: string;
  registrationDate?: Date;
  linkedUser?: mongoose.Schema.Types.ObjectId;
  // New fields for profile completion
  trustName?: string;
  registrationYear?: number;
  phone?: string;
  city?: string;
  pinCode?: string;
  pincode?: string;
  principalEmail?: string;
  principalPhone?: string;
  profileCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionSchema = new Schema<IInstitution>(
  {
    name: { type: String, required: true },
    collegeId: { type: String, unique: true, sparse: true },
    email: { type: String, sparse: true },  // kept as contact info, no longer enforces uniqueness or required
    contactNumber: { type: String },
    address: { type: String },
    registrationStatus: { type: String, default: "APPROVED", enum: ["PENDING", "APPROVED", "REJECTED"] },
    approvalNumber: { type: String },
    institutionType: { type: String },
    state: { type: String },
    district: { type: String },
    principalName: { type: String },
    authorizedContactPerson: { type: String },
    registrationDate: { type: Date, default: Date.now },
    linkedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // New profile fields
    trustName: { type: String },
    registrationYear: { type: Number },
    phone: { type: String },
    city: { type: String },
    pinCode: { type: String },
    pincode: { type: String },
    principalEmail: { type: String },
    principalPhone: { type: String },
    profileCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Institution = mongoose.models.Institution || mongoose.model<IInstitution>("Institution", InstitutionSchema);
