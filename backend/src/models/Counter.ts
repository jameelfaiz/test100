// src/models/Counter.ts
import mongoose, { Schema } from "mongoose";

export interface ICounter {
  _id: string; // e.g., "collegeId"
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: false }
);

export const Counter = mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);
