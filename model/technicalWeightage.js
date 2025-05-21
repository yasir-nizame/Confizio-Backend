import mongoose from "mongoose";

const TechnicalWeightageSchema = new mongoose.Schema({
  conferenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conference",
    required: true,
  },
  originality: { type: Number, required: true, default: 30 },
  technicalQuality: { type: Number, required: true, default: 25 },
  significance: { type: Number, required: true, default: 20 },
  clarity: { type: Number, required: true, default: 15 },
  relevance: { type: Number, required: true, default: 10 },
});

export default mongoose.model("TechnicalWeightage", TechnicalWeightageSchema);
