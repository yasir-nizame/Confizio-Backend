import mongoose from "mongoose";

const conferenceSchema = new mongoose.Schema({
  conferenceName: { type: String, required: true },
  acronym: { type: String, required: true },
  organizerName: { type: String, required: true },
  organizerEmail: { type: String, required: true },
  webPage: { type: String },
  venue: { type: String },
  city: { type: String },
  country: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  abstractDeadline: { type: Date, required: true },
  submissionDeadline: { type: Date, required: true },
  primaryArea: { type: String },
  secondaryArea: { type: String },
  topics: [String],
  expertise: [String],
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  submissionLink: { type: String, unique: true }, // Unique link for submissions
  papers: [{ type: mongoose.Schema.Types.ObjectId, ref: "ResearchPaper" }], // Reference ResearchPaper
  organizer: { type: String },
  proceedingsPdfUrl: { type: String },
});

export default mongoose.model("Conference", conferenceSchema);
