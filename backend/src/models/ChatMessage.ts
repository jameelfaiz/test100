import mongoose, { Document, Schema } from "mongoose";

export interface IChatCitation {
  clauseNumber: string;
  chapter: string;
  year: string;
  pageNumber?: string;
  title: string;
  excerpt: string;
  requirementType?: string;
}

export interface IChatAttachment {
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  url?: string;
  extractedSnippet?: string;
  findings?: string[];
}

export interface IPortalContext {
  portal: string;
  route: string;
  stage?: string;
  applicationId?: string;
  status?: string;
}

export interface IChatMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: IChatCitation[];
  attachments: IChatAttachment[];
  portalContext?: IPortalContext;
  isRefusal?: boolean;
  modelConfigured?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChatCitationSchema = new Schema<IChatCitation>(
  {
    clauseNumber: { type: String, required: true },
    chapter: { type: String, required: true },
    year: { type: String, required: true },
    pageNumber: { type: String },
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    requirementType: { type: String },
  },
  { _id: false }
);

const ChatAttachmentSchema = new Schema<IChatAttachment>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    url: { type: String },
    extractedSnippet: { type: String },
    findings: [{ type: String }],
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    citations: [ChatCitationSchema],
    attachments: [ChatAttachmentSchema],
    portalContext: {
      portal: { type: String },
      route: { type: String },
      stage: { type: String },
      applicationId: { type: String },
      status: { type: String },
    },
    isRefusal: { type: Boolean, default: false },
    modelConfigured: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const ChatMessage = mongoose.model<IChatMessage>(
  "ChatMessage",
  ChatMessageSchema
);
