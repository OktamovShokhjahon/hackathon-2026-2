import { Schema, model, Types } from "mongoose";

export interface DrugReferenceSection {
  heading: string;
  text: string;
}

export interface DrugReferenceSource {
  name: string;
  url: string;
}

export interface DrugReferenceDoc {
  _id: Types.ObjectId;
  /** Lowercased lookup key, so the same drug is fetched once per window. */
  queryKey: string;
  found: boolean;
  rxcui?: string;
  genericName?: string;
  brandNames: string[];
  sections: DrugReferenceSection[];
  sources: DrugReferenceSource[];
  /** Plain-language condensation of `sections`, when the model was reachable. */
  plainSummary?: string;
  /** False when the matched label covers more than the medicine searched for. */
  exactMatch: boolean;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const drugReferenceSchema = new Schema<DrugReferenceDoc>(
  {
    queryKey: { type: String, required: true, unique: true, index: true },
    found: { type: Boolean, default: false },
    rxcui: { type: String },
    genericName: { type: String },
    brandNames: [{ type: String }],
    sections: [{ heading: String, text: String }],
    sources: [{ name: String, url: String }],
    plainSummary: { type: String },
    exactMatch: { type: Boolean, default: true },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const DrugReference = model<DrugReferenceDoc>("DrugReference", drugReferenceSchema);
