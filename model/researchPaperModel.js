import mongoose from "mongoose";

const researchPaperSchema = new mongoose.Schema({
  title: { type: String },
  abstract: { type: String },
  keywords: { type: [String] },
  authors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Author" }], // Link to authors
  paperFilePath: { type: String }, // Path to uploaded PDF
  conferenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Conference" },
  conferenceName: { type: String },
  conferenceAcronym: { type: String },
  status: {
    type: String,
    enum: ["pending", "assigned", "reviewed", "resubmitted"],
    default: "pending",
  },
  finaldecision: {
    type: String,
    enum: ["Accepted", "Rejected", "Modification Required", "pending"],
    default: "pending",
  },
  complianceScore: { type: String },
  complianceReport: {
    type: {
      percentage: { type: Number },
      details: [
        {
          rule: { type: String },
          passed: { type: Boolean },
          message: { type: String },
          suggestion: { type: String },
        },
      ],
    },
    default: {
      percentage: 0,
      details: [
        {
          rule: "Pending",
          passed: false,
          message: "Compliance check is running...",
          suggestion:
            "Please wait a few seconds for the compliance check to complete.",
        },
      ],
    },
  },

  plagiarismReport: {
    type: {
      score: { type: Number },
      isAIGenerated: { type: Boolean },
      details: [
        {
          type: { type: String },
          value: { type: Number },
          description: { type: String },
        },
      ],
    },
    default: {
      score: 0,
      isAIGenerated: false,
      details: [
        {
          type: "Pending",
          value: 0,
          description: "Plagiarism check is running...",
        },
      ],
    },
  },
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }], // Array of review references
  isReviewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("ResearchPaper", researchPaperSchema);
