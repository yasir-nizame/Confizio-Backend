import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema({
  paperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ResearchPaper", // Reference the ResearchPaper model
    required: true,
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users", // Reference to user model
    required: true,
  },
  originality: { type: Number, min: 1, max: 10, required: true },
  technicalQuality: { type: Number, min: 1, max: 10, required: true },
  significance: { type: Number, min: 1, max: 10, required: true },
  clarity: { type: Number, min: 1, max: 10, required: true },
  relevance: { type: Number, min: 1, max: 10, required: true },
  overallRecommendation: {
    type: String,
    enum: ["Accept", "Accept with minor correction", "Reject"],
    required: true,
  },
  commentsForAuthors: { type: String },
  commentsForOrganizers: { type: String },
  technicalConfidence: { type: Number, required: true },
});

export default mongoose.model("Review", ReviewSchema);
