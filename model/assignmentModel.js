import mongoose from "mongoose";

const AssignmentSchema = new mongoose.Schema(
  {
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResearchPaper",
      required: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    conferenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conference",
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatically creates createdAt and updatedAt fields
  }
);

// Index to ensure unique assignments of a paper to a reviewer within a conference
AssignmentSchema.index(
  { paperId: 1, reviewerId: 1, conferenceId: 1 },
  { unique: true }
);

export default mongoose.model("Assignment", AssignmentSchema);
